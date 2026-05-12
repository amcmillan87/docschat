import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { parseAndChunk, parseUrl } from '@/lib/parsers';
import { chunkText } from '@/lib/chunker';

export async function GET() {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: documents } = await supabase
    .from('documents')
    .select('id, name, type, uploaded_at, chunk_count, status, source_url')
    .order('uploaded_at', { ascending: false });

  return NextResponse.json(documents ?? []);
}

export async function POST(request: NextRequest) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? '';

  let docName: string;
  let docType: string;
  let sourceUrl: string | null = null;
  let rawChunks: { content: string; metadata: Record<string, unknown>; chunkIndex: number }[];

  if (contentType.includes('application/json')) {
    const { url } = await request.json();
    if (!url?.trim()) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

    const text = await parseUrl(url);
    if (!text) return NextResponse.json({ error: 'Could not extract content from URL' }, { status: 400 });

    rawChunks = chunkText(text, {}).map((c, i) => ({ ...c, chunkIndex: i }));
    const parsed = new URL(url);
    docName = parsed.hostname + parsed.pathname;
    docType = 'url';
    sourceUrl = url;
  } else {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    docName = file.name;
    docType = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
    rawChunks = await parseAndChunk(buffer, file.name);
  }

  if (rawChunks.length === 0) {
    return NextResponse.json({ error: 'No content could be extracted from this file' }, { status: 400 });
  }

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ name: docName, type: docType, source_url: sourceUrl, uploaded_by: userId, status: 'processing', chunk_count: rawChunks.length })
    .select('id')
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
  }

  // Store chunks WITHOUT embeddings — embedding happens in batches via /embed endpoint
  const rows = rawChunks.map((chunk) => ({
    document_id: doc.id,
    content: chunk.content,
    chunk_index: chunk.chunkIndex,
    metadata: chunk.metadata,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('document_chunks').insert(rows.slice(i, i + 100));
    if (error) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json({ error: 'Failed to store document chunks' }, { status: 500 });
    }
  }

  return NextResponse.json({ id: doc.id, totalChunks: rawChunks.length });
}
