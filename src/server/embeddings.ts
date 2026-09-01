// Local, in-process text embeddings — no API key, no external network call once the model
// is cached locally (first run downloads the model from the Hugging Face hub and caches it
// under node_modules/@xenova/transformers/.cache or the XENOVA_CACHE_DIR you configure).
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"; // 384-dim sentence embeddings
export const EMBEDDING_DIM = 384;

let pipelinePromise: Promise<any> | null = null;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("feature-extraction", EMBEDDING_MODEL);
    })();
  }
  return pipelinePromise;
}

/**
 * Embeds free text into a 384-dim vector for pgvector similarity search.
 * Returns null on any failure (model load error, empty text, etc.) so callers can degrade
 * gracefully to non-vector ranking rather than breaking the request.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  try {
    const extractor = await getPipeline();
    const output = await extractor(trimmed.slice(0, 8000), { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.error("Local embedding generation failed:", err);
    return null;
  }
}

/** Warms the model on server boot so the first real request isn't slowed by the initial download/load. */
export async function warmEmbeddingModel(): Promise<void> {
  try {
    await getPipeline();
    console.log(`Embedding model "${EMBEDDING_MODEL}" ready.`);
  } catch (err) {
    console.warn("Embedding model failed to warm up (matching will fall back to flat filtering):", (err as Error).message);
  }
}
