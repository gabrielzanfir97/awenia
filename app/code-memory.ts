import { supabase } from "./supabase";
import { getProjectArea } from "./project-map";

export type CodeMemoryData = {
  file_path: string;
  file_purpose?: string;
  code_summary?: string;
  important_exports?: string;
  important_functions?: string;
  last_known_content?: string;
};

export async function saveCodeMemory(data: CodeMemoryData) {
  const { error } = await supabase.from("project_code_memory").upsert(
    {
      file_path: data.file_path,
      file_purpose: data.file_purpose || "",
      code_summary: data.code_summary || "",
      important_exports: data.important_exports || "",
      important_functions: data.important_functions || "",
      last_known_content: data.last_known_content || "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "file_path" }
  );

  if (error) throw new Error(error.message);

  return true;
}

export async function getCodeMemory(filePath: string) {
  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .eq("file_path", filePath)
    .single();

  if (error) return null;

  return data;
}

export async function getAllCodeMemories() {
  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return [];

  return data || [];
}

export async function searchCodeMemory(query: string) {
  const safeQuery = query.replace(/[%_,]/g, "");

  const { data, error } = await supabase
    .from("project_code_memory")
    .select("*")
    .or(
      `file_path.ilike.%${safeQuery}%,file_purpose.ilike.%${safeQuery}%,code_summary.ilike.%${safeQuery}%,important_functions.ilike.%${safeQuery}%,important_exports.ilike.%${safeQuery}%`
    )
    .order("updated_at", { ascending: false });

  if (error) return [];

  return data || [];
}

export function normalizeCode(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

export function createCodeSummary(content: string) {
  const cleaned = normalizeCode(content);

  if (cleaned.length <= 500) return cleaned;

  return cleaned.slice(0, 250) + "\n...\n" + cleaned.slice(-250);
}

export function extractImports(content: string) {
  const matches = [
    ...content.matchAll(/import\s+.*?\s+from\s+["'](.+?)["']/g),
  ];

  return matches.map((match) => match[1]);
}

export function detectDependencies(content: string) {
  const imports = extractImports(content);

  return imports.map((item) =>
    item.replace("./", "app/")
  );
}

export function extractExports(content: string) {
  const matches = [
    ...content.matchAll(
      /export\s+(?:async\s+)?(?:function|const|class|type)\s+([a-zA-Z0-9_]+)/g
    ),
  ];

  return matches.map((match) => match[1]);
}

export function extractFunctions(content: string) {
  const functionMatches = [
    ...content.matchAll(
      /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g
    ),
  ];

  const constFunctionMatches = [
    ...content.matchAll(
      /(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g
    ),
  ];

  return [
    ...functionMatches.map((match) => match[1]),
    ...constFunctionMatches.map((match) => match[1]),
  ];
}

export function detectFilePurpose(filePath: string, content: string) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerPath.includes("api/awenia/route")) {
    return "Main Awenia API route and intelligence orchestrator";
  }

  if (lowerPath.includes("page")) {
    return "Frontend chat interface";
  }

  if (lowerPath.includes("memory-store")) {
    return "Persistent Supabase memory system";
  }

  if (lowerPath.includes("code-memory")) {
    return "Project code memory and code awareness system";
  }

  if (lowerPath.includes("memory")) {
    return "Local or long-term memory system";
  }

  if (lowerPath.includes("awareness")) {
    return "Awenia awareness state system";
  }

  if (lowerPath.includes("decision-engine")) {
    return "Autonomous decision making system";
  }

  if (lowerPath.includes("self-improvement")) {
    return "Self improvement cycle";
  }

  if (lowerPath.includes("autonomous-runtime")) {
    return "Autonomous runtime system";
  }

  if (lowerPath.includes("evolution")) {
    return "Evolution and self-improvement system";
  }

  if (lowerPath.includes("agent")) {
    return "Agent coordination system";
  }

  if (lowerPath.includes("project-map")) {
    return "Project architecture map";
  }

  if (lowerPath.includes("dev-agent")) {
    return "Developer file tools";
  }

  if (lowerPath.includes("supabase")) {
    return "Supabase client connection";
  }

  if (lowerContent.includes("supabase")) {
    return "Supabase integration";
  }

  return "General project file";
}

export function detectRiskLevel(filePath: string, content: string) {
  const lowerPath = filePath.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (
    lowerPath.includes("route.ts") ||
    lowerPath.includes("memory-store") ||
    lowerPath.includes("dev-agent") ||
    lowerPath.includes("protected-core") ||
    lowerPath.includes("rollback") ||
    lowerPath.includes("supabase")
  ) {
    return "high";
  }

  if (
    lowerContent.includes("writefile") ||
    lowerContent.includes("patch") ||
    lowerContent.includes("delete") ||
    lowerContent.includes("insert") ||
    lowerContent.includes("update")
  ) {
    return "medium";
  }

  return "low";
}

export function createSmartCodeSummary(
  filePath: string,
  content: string
) {
  const projectArea = getProjectArea(filePath);
  const purpose = detectFilePurpose(filePath, content);

  const imports = extractImports(content);
  const exports = extractExports(content);
  const functions = extractFunctions(content);
  const dependencies =
    detectDependencies(content);

  const riskLevel =
    detectRiskLevel(filePath, content);

  const cleaned =
    normalizeCode(content);

  const shortContent =
    cleaned.length > 500
      ? cleaned.slice(0, 500) + "..."
      : cleaned;

  return `
Project area: ${projectArea.area}
Project risk: ${projectArea.risk}
Area purpose: ${projectArea.purpose}

Purpose: ${purpose}
Risk level: ${riskLevel}

Imports:
${
  imports.length
    ? imports.join(", ")
    : "none detected"
}

Exports:
${
  exports.length
    ? exports.join(", ")
    : "none detected"
}

Dependencies:
${
  dependencies.length
    ? dependencies.join(", ")
    : "none detected"
}

Functions:
${
  functions.length
    ? functions.join(", ")
    : "none detected"
}

Main logic:
${shortContent}
  `.trim();
}

let activeCodeFile: {
  file_path: string;
  content: string;
} | null = null;

export function setActiveCodeFile(file_path: string, content: string) {
  activeCodeFile = {
    file_path,
    content,
  };
}

export function getActiveCodeFile() {
  return activeCodeFile;
}