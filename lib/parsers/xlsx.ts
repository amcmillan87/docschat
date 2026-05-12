import * as XLSX from 'xlsx';

export interface ParsedSheet {
  text: string;
  sheet: string;
}

export function parseXlsx(buffer: Buffer): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    // Remove empty trailing columns
    const text = csv
      .split('\n')
      .map((row) => row.replace(/,+$/, ''))
      .filter((row) => row.trim())
      .join('\n');

    if (text.length > 10) {
      sheets.push({ text, sheet: sheetName });
    }
  }

  return sheets;
}
