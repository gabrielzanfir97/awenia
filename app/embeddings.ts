import { supabase } from "./supabase";

export function createSimpleEmbedding(text: string) {
  const vector = new Array(768).fill(0);

  for (let i = 0; i < text.length; i++) {
    const index = text.charCodeAt(i) % 768;
    vector[index] += 1;
  }

  const length = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );

  return vector.map((value) => (length ? value / length : 0));
}

export async function saveCodeEmbedding(filePath: string, content: string) {
  const embedding = createSimpleEmbedding(content.slice(0, 3000));

  const { error } = await supabase.from("code_embeddings").insert({
    file_path: filePath,
    content: content.slice(0, 3000),
    embedding,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function searchCodeEmbeddings(query: string) {
  const queryEmbedding = createSimpleEmbedding(query);

  const { data, error } = await supabase
    .from("code_embeddings")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  const ranked = (data || [])
    .map((item: any) => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        item.embedding
      );

      return {
        ...item,
        similarity,
      };
    })
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, 5);

  return ranked;
}