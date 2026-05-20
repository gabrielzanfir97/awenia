import { supabase } from "./supabase";

export async function savePermanentMemory(
  memory: string,
  category = "general",
  importance = 5
) {
  const { error } = await supabase
    .from("permanent_memory")
    .insert({
      memory,
      category,
      importance,
    });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getPermanentMemories(limit = 20) {
  const { data, error } = await supabase
    .from("permanent_memory")
    .select("*")
    .order("importance", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data;
}