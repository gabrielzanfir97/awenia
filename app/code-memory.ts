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

export function createCodeSummary(content: string) {
  const cleaned = content
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 500) {
    return cleaned;
  }

  return (
    cleaned.slice(0, 250) +
    "\n...\n" +
    cleaned.slice(-250)
  );
}

export function detectFilePurpose(
  filePath: string,
  content: string
) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerPath.includes("route")) {
    return "API route handler";
  }

  if (lowerPath.includes("page")) {
    return "Frontend page";
  }

  if (lowerPath.includes("memory")) {
    return "Memory system";
  }

  if (lowerPath.includes("embedding")) {
    return "Semantic embedding system";
  }

  if (lowerPath.includes("evolution")) {
    return "Evolution and self-improvement system";
  }

  if (lowerContent.includes("supabase")) {
    return "Supabase integration";
  }

  if (lowerContent.includes("openai")) {
    return "AI provider integration";
  }

  return "General project file";
}