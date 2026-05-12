import { parsePdf } from './pdf';
import { parsePptx } from './pptx';
import { parseXlsx } from './xlsx';
import { parseText } from './text';
import { chunkText, Chunk } from '../chunker';

export { parseUrl } from './web';

export interface IndexedChunk {
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
}

export async function parseAndChunk(
  buffer: Buffer,
  filename: string
): Promise<IndexedChunk[]> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const chunks: Chunk[] = [];

  if (ext === 'pdf') {
    const pages = await parsePdf(buffer);
    for (const { text, page } of pages) {
      chunks.push(...chunkText(text, { page }));
    }
  } else if (ext === 'pptx') {
    const slides = await parsePptx(buffer);
    for (const { text, slide } of slides) {
      chunks.push(...chunkText(text, { slide }));
    }
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const sheets = parseXlsx(buffer);
    for (const { text, sheet } of sheets) {
      chunks.push(...chunkText(text, { sheet }));
    }
  } else {
    const text = parseText(buffer);
    chunks.push(...chunkText(text, {}));
  }

  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}
