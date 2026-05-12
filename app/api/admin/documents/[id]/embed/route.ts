import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { embedBatch } from '@/lib/embeddings';

const BATCH_SIZE = 40;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch next batch of un-embedded chunks
  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('id, content')
    .eq('document_id', params.id)
    .is('embedding', null)
    .order('chunk_index')
    .limit(BATCH_SIZE);

  if (!chunks || chunks.length === 0) {
    await supabase.from('documents').update({ status: 'ready' }).eq('id', params.id);
    return NextResponse.json({ embedded: 0, remaining: 0, done: true });
  }

  const embeddings = await embedBatch(chunks.map((c) => c.content));

  await Promise.all(
    chunks.map((chunk, i) =>
      supabase
        .from('document_chunks')
        .update({ embedding: embeddings[i] })
        .eq('id', chunk.id)
    )
  );

  const { count } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', params.id)
    .is('embedding', null);

  const remaining = count ?? 0;
  const done = remaining === 0;

  if (done) {
    await supabase.from('documents').update({ status: 'ready' }).eq('id', params.id);
  }

  return NextResponse.json({ embedded: chunks.length, remaining, done });
}
