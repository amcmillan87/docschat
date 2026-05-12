import * as cheerio from 'cheerio';

export async function parseUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DocsChatBot/1.0)' },
  });

  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, aside, [role="navigation"]').remove();

  return $('body').text().replace(/\s+/g, ' ').trim();
}
