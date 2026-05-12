import pdfParse from 'pdf-parse';

export interface ParsedPage {
  text: string;
  page: number;
}

export async function parsePdf(buffer: Buffer): Promise<ParsedPage[]> {
  const pages: ParsedPage[] = [];
  let pageNum = 0;

  await pdfParse(buffer, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagerender: (pageData: any) => {
      pageNum++;
      const num = pageNum;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return pageData.getTextContent().then((content: { items: { str: string }[] }) => {
        const text = content.items.map((item) => item.str).join(' ').trim();
        if (text.length > 10) {
          pages.push({ text, page: num });
        }
        return text;
      });
    },
  });

  return pages;
}
