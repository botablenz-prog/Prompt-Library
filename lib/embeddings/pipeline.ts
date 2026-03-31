// Using `any` here because @huggingface/transformers pipeline() return type is a
// large discriminated union that causes "too complex to represent" TS errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedPipeline = any;

let embedder: EmbedPipeline | null = null;

async function getEmbedder(): Promise<EmbedPipeline> {
  if (!embedder) {
    const { pipeline } = await import("@huggingface/transformers");
    // all-MiniLM-L6-v2: 384-dim, fast, good semantic similarity quality
    // Model is downloaded on first use (~25MB) and cached locally
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "fp32",
      cacheDir: "/tmp/transformers-cache",
    });
  }
  return embedder;
}

// Returns a 384-dimensional embedding vector for the given text
export async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
