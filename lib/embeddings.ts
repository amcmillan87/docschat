const VOYAGE_API = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3';

async function fetchEmbeddings(texts: string[], retries = 5): Promise<number[][]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(VOYAGE_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: texts, model: MODEL }),
    });

    if (res.status === 429) {
      // Rate limited — wait before retrying (2s, 4s, 8s, 16s, 32s)
      const wait = Math.pow(2, attempt + 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) throw new Error(`Voyage embed failed: ${res.statusText}`);
    const data = await res.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  throw new Error('Voyage API rate limit exceeded — please wait a moment and try again');
}

export async function embedText(text: string): Promise<number[]> {
  const results = await fetchEmbeddings([text]);
  return results[0];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH = 40;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    if (i > 0) {
      // Small pause between batches to stay within rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
    const batch = texts.slice(i, i + BATCH);
    const embeddings = await fetchEmbeddings(batch);
    results.push(...embeddings);
  }

  return results;
}
