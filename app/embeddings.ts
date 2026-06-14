import { supabase, isSupabaseConfigured } from "./supabase";

export type EmbeddingStatus =
  | "created"
  | "saved"
  | "loaded"
  | "searched"
  | "partial"
  | "fallback"
  | "failed";

export type EmbeddingSource =
  | "local"
  | "runtime"
  | "supabase"
  | "code"
  | "memory"
  | "system";

export type EmbeddingRecord = {
  id: string;
  text: string;
  embedding: number[];
  source: EmbeddingSource;
  type: string;
  reference?: string;
  metadata?: any;
  createdAt: string;
};

export type EmbeddingSearchResult = {
  record: EmbeddingRecord;
  similarity: number;
  score: number;
};

const EMBEDDING_DIMENSIONS = 384;

const runtimeEmbeddings: EmbeddingRecord[] = [];

function now() {
  return new Date().toISOString();
}

function createId(prefix = "embedding") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/\r\n/g, "\n")
    .replace(/[^\p{L}\p{N}_./:-]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(text = "") {
  const normalized = normalizeText(text);

  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function hashString(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return Math.abs(hash >>> 0);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );

  if (!magnitude) return vector;

  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

export function generateLocalEmbedding(
  text: string,
  dimensions = EMBEDDING_DIMENSIONS
) {
  const tokens = tokenize(text);
  const vector = new Array(dimensions).fill(0);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const baseHash = hashString(token);

    const indexA = baseHash % dimensions;
    const indexB = hashString(`${token}:b`) % dimensions;
    const indexC = hashString(`${token}:c`) % dimensions;

    vector[indexA] += 1;
    vector[indexB] += 0.5;
    vector[indexC] -= 0.25;
  }

  return normalizeVector(vector);
}

export async function createEmbedding(input: {
  text: string;
  source?: EmbeddingSource;
  type?: string;
  reference?: string;
  metadata?: any;
}) {
  const record: EmbeddingRecord = {
    id: createId("embedding"),
    text: input.text,
    embedding: generateLocalEmbedding(input.text),
    source: input.source || "local",
    type: input.type || "text",
    reference: input.reference,
    metadata: input.metadata || {},
    createdAt: now(),
  };

  return {
    status: "created" as EmbeddingStatus,
    record,
    dimensions: record.embedding.length,
    provider: "local_deterministic_hash_embedding",
    truthPolicy: {
      noExternalEmbeddingApi: true,
      localEmbeddingIsApproximate: true,
      noFakeSemanticPrecision: true,
    },
    timestamp: now(),
  };
}

export async function generateEmbedding(text: string) {
  return generateLocalEmbedding(text);
}

export async function getTextEmbedding(text: string) {
  return generateLocalEmbedding(text);
}

export async function embedText(text: string) {
  return generateLocalEmbedding(text);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length) return 0;

  const length = Math.min(a.length, b.length);

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index++) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) return 0;

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function calculateSimilarity(a: number[], b: number[]) {
  return cosineSimilarity(a, b);
}

export function calculateTextSimilarity(textA: string, textB: string) {
  return cosineSimilarity(
    generateLocalEmbedding(textA),
    generateLocalEmbedding(textB)
  );
}

async function saveEmbeddingToSupabase(record: EmbeddingRecord) {
  if (!isSupabaseConfigured()) {
    return {
      status: "fallback",
      saved: false,
      error: "Supabase is not configured",
    };
  }

  try {
    const { data, error } = await supabase
      .from("project_code_embeddings")
      .insert({
        text: record.text,
        embedding: record.embedding,
        source: record.source,
        type: record.type,
        reference: record.reference,
        metadata: record.metadata || {},
        created_at: record.createdAt,
      } as any)
      .select()
      .single();

    if (error) {
      return {
        status: "failed",
        saved: false,
        error: error.message,
      };
    }

    return {
      status: "saved",
      saved: true,
      data,
    };
  } catch (error: any) {
    return {
      status: "failed",
      saved: false,
      error: error?.message || "Failed to save embedding to Supabase",
    };
  }
}

export async function saveEmbedding(input: {
  text: string;
  source?: EmbeddingSource;
  type?: string;
  reference?: string;
  metadata?: any;
  saveToSupabase?: boolean;
}) {
  const created = await createEmbedding(input);
  const record = created.record;

  runtimeEmbeddings.unshift(record);

  let supabaseResult: any = null;

  if (input.saveToSupabase) {
    supabaseResult = await saveEmbeddingToSupabase(record);
  }

  return {
    status:
      input.saveToSupabase && supabaseResult?.saved !== true
        ? "partial"
        : "saved",
    record,
    runtimeSaved: true,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function saveCodeEmbedding(
  filePath: string,
  content: string,
  metadata: any = {}
) {
  return saveEmbedding({
    text: content,
    source: "code",
    type: "code_file",
    reference: filePath,
    metadata: {
      filePath,
      contentLength: content.length,
      ...metadata,
    },
    saveToSupabase: true,
  });
}

export async function saveMemoryEmbedding(
  text: string,
  reference?: string,
  metadata: any = {}
) {
  return saveEmbedding({
    text,
    source: "memory",
    type: "memory",
    reference,
    metadata,
    saveToSupabase: true,
  });
}

export function searchRuntimeEmbeddings(
  query: string,
  options?: {
    limit?: number;
    type?: string;
    source?: EmbeddingSource;
    threshold?: number;
  }
) {
  const queryEmbedding = generateLocalEmbedding(query);
  const limit = options?.limit || 10;
  const threshold = options?.threshold ?? 0;

  const filtered = runtimeEmbeddings.filter((record) => {
    if (options?.type && record.type !== options.type) return false;
    if (options?.source && record.source !== options.source) return false;

    return true;
  });

  const results: EmbeddingSearchResult[] = filtered
    .map((record) => {
      const similarity = cosineSimilarity(queryEmbedding, record.embedding);

      return {
        record,
        similarity,
        score: Math.round(similarity * 1000) / 10,
      };
    })
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return {
    status: "searched" as EmbeddingStatus,
    query,
    results,
    count: results.length,
    source: "runtime",
    truthPolicy: {
      localEmbeddingIsApproximate: true,
      noFakeDatabaseSearch: true,
    },
    timestamp: now(),
  };
}

export async function searchEmbeddings(
  query: string,
  options?: {
    limit?: number;
    type?: string;
    source?: EmbeddingSource;
    threshold?: number;
  }
) {
  return searchRuntimeEmbeddings(query, options);
}

export async function searchCodeEmbeddings(
  query: string,
  limit = 10
) {
  return searchEmbeddings(query, {
    limit,
    source: "code",
    type: "code_file",
  });
}

export async function findSimilarCode(
  query: string,
  limit = 10
) {
  return searchCodeEmbeddings(query, limit);
}

export async function findSimilarMemories(
  query: string,
  limit = 10
) {
  return searchEmbeddings(query, {
    limit,
    source: "memory",
    type: "memory",
  });
}

export function chunkText(
  text: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
  }
) {
  const chunkSize = options?.chunkSize || 1200;
  const overlap = options?.overlap || 120;

  const clean = text.replace(/\r\n/g, "\n");
  const chunks: string[] = [];

  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const chunk = clean.slice(start, end).trim();

    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;

    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export async function embedChunks(
  text: string,
  options?: {
    chunkSize?: number;
    overlap?: number;
    source?: EmbeddingSource;
    type?: string;
    reference?: string;
    saveToSupabase?: boolean;
  }
) {
  const chunks = chunkText(text, {
    chunkSize: options?.chunkSize,
    overlap: options?.overlap,
  });

  const results = [];

  for (let index = 0; index < chunks.length; index++) {
    results.push(
      await saveEmbedding({
        text: chunks[index],
        source: options?.source || "local",
        type: options?.type || "chunk",
        reference: options?.reference
          ? `${options.reference}#chunk-${index + 1}`
          : `chunk-${index + 1}`,
        metadata: {
          chunkIndex: index,
          totalChunks: chunks.length,
        },
        saveToSupabase: options?.saveToSupabase,
      })
    );
  }

  return {
    status: "saved" as EmbeddingStatus,
    chunks: chunks.length,
    results,
    timestamp: now(),
  };
}

export function buildEmbeddingContext(
  results: EmbeddingSearchResult[],
  limit = 5
) {
  if (results.length === 0) {
    return "Nu există rezultate embedding relevante în runtime.";
  }

  return results
    .slice(0, limit)
    .map((result, index) => {
      return `${index + 1}. [score ${result.score}] ${result.record.reference || result.record.type
        }\n${result.record.text.slice(0, 800)}`;
    })
    .join("\n\n");
}

export async function getEmbeddingContext(
  query: string,
  limit = 5
) {
  const search = await searchEmbeddings(query, {
    limit,
  });

  return buildEmbeddingContext(search.results, limit);
}

export function getRuntimeEmbeddings() {
  return runtimeEmbeddings;
}

export function clearRuntimeEmbeddings() {
  const count = runtimeEmbeddings.length;

  runtimeEmbeddings.splice(0, runtimeEmbeddings.length);

  return {
    status: "cleared",
    count,
    timestamp: now(),
  };
}

export function getEmbeddingState() {
  return {
    status: "loaded" as EmbeddingStatus,
    provider: "local_deterministic_hash_embedding",
    dimensions: EMBEDDING_DIMENSIONS,
    runtimeCount: runtimeEmbeddings.length,
    supabaseConfigured: isSupabaseConfigured(),
    truthPolicy: {
      noExternalEmbeddingApi: true,
      localEmbeddingIsApproximate: true,
      databaseSearchOnlyIfImplemented: true,
    },
    timestamp: now(),
  };
}

export function analyzeEmbeddingHealth() {
  return {
    status: "loaded",
    dimensions: EMBEDDING_DIMENSIONS,
    runtimeEmbeddings: runtimeEmbeddings.length,
    canGenerate: true,
    canSearchRuntime: true,
    canSaveRuntime: true,
    canSaveSupabase: isSupabaseConfigured(),
    limits: {
      semanticQuality: "basic",
      provider: "local hash embedding",
      note:
        "Aceste embeddings sunt locale și aproximative, nu embeddings AI externe.",
    },
    timestamp: now(),
  };
}

export async function runEmbeddingSystem(query = "") {
  if (!query.trim()) {
    return getEmbeddingState();
  }

  const search = await searchEmbeddings(query, {
    limit: 10,
  });

  return {
    status: "searched" as EmbeddingStatus,
    query,
    search,
    context: buildEmbeddingContext(search.results),
    state: getEmbeddingState(),
    timestamp: now(),
  };
}

export const getEmbedding = generateEmbedding;
export const createTextEmbedding = generateEmbedding;
export const vectorSimilarity = cosineSimilarity;
export const similarity = cosineSimilarity;
export const searchSimilarEmbeddings = searchEmbeddings;
export const embeddings = runtimeEmbeddings;

export default generateEmbedding;