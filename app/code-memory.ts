import { supabase } from "./supabase";

export async function saveCodeMemory(data: {
  file_path: string;
  file_purpose?: string;
  code_summary?: string;
  important_exports?: string;
  important_functions?: string;
  last_known_content?: string;
}) {
  const { error } = await supabase
    .from("project_code_memory")
    .upsert(
      {
        file_path: data.file_path,
        file_purpose: data.file_purpose || "",
        code_summary: data.code_summary || "",
        important_exports: data.important_exports || "",
        important_functions: data.important_functions || "",
        last_known_content: data.last_known_content || "",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "file_path",
      }
    );

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getCodeMemory(filePath: string) {
  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .eq("file_path", filePath)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function getAllCodeMemories() {
  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data;
}

export async function searchCodeMemory(query: string) {
  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .or(
      `file_path.ilike.%${query}%,file_purpose.ilike.%${query}%,code_summary.ilike.%${query}%,important_functions.ilike.%${query}%`
    )
    .order("updated_at", { ascending: false });

  if (error) {
    return [];
  }

  return data;
}