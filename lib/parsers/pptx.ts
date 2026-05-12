import JSZip from 'jszip';

export interface ParsedSlide {
  text: string;
  slide: number;
}

export async function parsePptx(buffer: Buffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slides: ParsedSlide[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? '0');
      return numA - numB;
    });

  for (let i = 0; i < slideFiles.length; i++) {
    const content = await zip.files[slideFiles[i]].async('string');

    // Extract text from <a:t> elements (PPTX text runs)
    const texts: string[] = [];
    const textRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
    let match;
    while ((match = textRegex.exec(content)) !== null) {
      const t = match[1].trim();
      if (t) texts.push(t);
    }

    const text = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > 10) {
      slides.push({ text, slide: i + 1 });
    }
  }

  return slides;
}
