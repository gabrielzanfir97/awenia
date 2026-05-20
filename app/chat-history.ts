import { supabase } from "./supabase";

export async function saveChatMessage(role: string, content: string) {
  const { error } = await supabase.from("chat_history").insert({
    role,
    content,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getRecentChatHistory(limit = 10) {
  const { data, error } = await supabase
    .from("chat_history")
    .select("role, content")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.reverse();
}