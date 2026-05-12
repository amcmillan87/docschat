const VOYAGE_API = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';

export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: MODEL }),
  });

  if (!res.ok) throw new Error(`Voyage embed failed: ${res.statusText}`);
  const data = await res.json();
  return data.data[0].embedding as number[];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH = 128;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(VOYAGE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: batch, model: MODEL }),
    });

    if (!res.ok) throw new Error(`Voyage batch embed failed: ${res.statusText}`);
    const data = await res.json();
    results.push(...data.data.map((d: { embedding: number[] }) => d.embedding));
  }

  return results;
}
