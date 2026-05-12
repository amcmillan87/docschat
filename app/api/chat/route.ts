import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { embedText } from '@/lib/embeddings';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatLocation(metadata: Record<string, unknown>): string {
  if (metadata.page) return `p. ${metadata.page}`;
  if (metadata.slide) return `slide ${metadata.slide}`;
  if (metadata.sheet) return `sheet "${metadata.sheet}"`;
  return '';
}

export async function POST(request: NextRequest) {
  const { message, history } = await request.json();
  if (!message?.trim()) {
    return new Response('Missing message', { status: 400 });
  }

  const embedding = await embedText(message);

  const { data: chunks, error } = await supabase.rpc('search_chunks', {
    query_embedding: embedding,
    match_count: 8,
  });

  if (error) {
    console.error('Search error:', error);
    return new Response('Search failed', { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            "I don't have any documents to reference yet. Please ask an admin to upload some documents."
          )
        );
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const docIds = [...new Set(chunks.map((c: { document_id: string }) => c.document_id))];
  const { data: docs } = await supabase
    .from('documents')
    .select('id, name')
    .in('id', docIds);

  const docMap = new Map<string, string>(
    docs?.map((d: { id: string; name: string }) => [d.id, d.name]) ?? []
  );

  const context = chunks
    .map((chunk: { document_id: string; metadata: Record<string, unknown>; content: string }) => {
      const docName = docMap.get(chunk.document_id) ?? 'Unknown';
      const loc = formatLocation(chunk.metadata);
      const label = loc ? `[${docName}, ${loc}]` : `[${docName}]`;
      return `${label}\n${chunk.content}`;
    })
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful assistant that answers questions based strictly on the provided documents.

Rules:
- Only use information from the document excerpts below
- If the answer is not in the documents, say so clearly — do not guess
- Cite your sources inline using exactly the source label shown (e.g. [Report.pdf, p. 4]) immediately after each statement that uses that source
- Only include citations for sources you actually used in your answer
- Be concise and direct

Documents:
${context}`;

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []),
    { role: 'user', content: message },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
