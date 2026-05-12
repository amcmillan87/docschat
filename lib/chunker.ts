export interface Chunk {
  content: string;
  metadata: Record<string, unknown>;
}

export function chunkText(
  text: string,
  metadata: Record<string, unknown> = {},
  chunkSize = 1500,
  overlap = 200
): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      const sentBreak = text.lastIndexOf('. ', end);

      if (paraBreak > start + chunkSize * 0.5) {
        end = paraBreak + 2;
      } else if (sentBreak > start + chunkSize * 0.5) {
        end = sentBreak + 2;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 50) {
      chunks.push({ content, metadata });
    }

    start = end - overlap;
  }

  return chunks;
}
