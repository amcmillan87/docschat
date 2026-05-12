import pdfParse from 'pdf-parse';

export interface ParsedPage {
  text: string;
  page: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  // Bulk extraction is much faster than per-page callbacks for large PDFs
  const data = await pdfParse(buffer);

  if (!data.text?.trim()) return [];

  // Split on form-feed characters (\f) which PDFs use as page breaks,
  // falling back to one big chunk if none are present
  const rawPages = data.text.split(/\f/);

  return rawPages
    .map((text, i) => ({ text: text.trim(), page: i + 1 }))
    .filter((p) => p.text.length > 10);
}
