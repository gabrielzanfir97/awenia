import { supabase } from "./supabase";

export async function savePendingAction(data: {
  action_type: string;
  file_path: string;
  content?: string;
  search_text?: string;
  replace_text?: string;
}) {
  const { error } = await supabase.from("pending_actions").insert({
    action_type: data.action_type,
    file_path: data.file_path,
    content: data.content || "",
    search_text: data.search_text || "",
    replace_text: data.replace_text || "",
    status: "pending",
  });

  if (error) throw new Error(error.message);

  return true;
}

export async function getLatestPendingAction() {
  const { data, error } = await supabase
    .from("pending_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;

  return data;
}

export async function completePendingAction(id: number) {
  await supabase
    .from("pending_actions")
    .update({ status: "completed" })
    .eq("id", id);

  return true;
}