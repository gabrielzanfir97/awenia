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