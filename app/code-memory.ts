import { supabase, isSupabaseConfigured } from "./supabase";
import { saveCodeEmbedding } from "./embeddings";

export type CodeRiskLevel = "low" | "medium" | "high" | "critical";

export type CodeMemoryStatus =
  | "saved"
  | "loaded"
  | "searched"
  | "partial"
  | "fallback"
  | "failed";

export type CodeMemoryData = {
  file_path: string;
  file_purpose: string;
  code_summary: string;
  important_exports: string[];
  important_functions: string[];
  imports: string[];
  exports: string[];
  risk_level: CodeRiskLevel;
  line_count: number;
  content_length: number;
  last_known_content: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
};

const runtimeCodeMemory = new Map<string, CodeMemoryData>();

let activeCodeFile: {
  filePath: string;
  content?: string;
  summary?: string;
  updatedAt: string;
} | null = null;

const MAX_STORED_CONTENT_LENGTH = 12000;
const MAX_CONTEXT_SUMMARY_LENGTH = 1200;
const SUPABASE_TIMEOUT_MS = 7000;
const EMBEDDING_TIMEOUT_MS = 7000;

function now() {
  return new Date().toISOString();
}

function normalizePath(filePath = "") {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function normalizeCode(content = "") {
  return String(content || "").replace(/\r\n/g, "\n");
}

function normalizeArray(value: any, fallback: string[] = []): string[] {
  if (!value) return fallback;

  if (Array.isArray(value)) {
    return unique(value.map(String).map((item) => item.trim()).filter(Boolean));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return unique(
          parsed.map(String).map((item) => item.trim()).filter(Boolean)
        );
      }
    } catch {
      return unique(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      );
    }
  }

  return fallback;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function calculateLineCount(content = "") {
  const clean = normalizeCode(content);

  if (!clean) return 0;

  return clean.split("\n").length;
}

function riskRank(risk: CodeRiskLevel) {
  const ranks: Record<CodeRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return ranks[risk] || 1;
}

function maxRisk(a: CodeRiskLevel, b: CodeRiskLevel): CodeRiskLevel {
  return riskRank(a) >= riskRank(b) ? a : b;
}

function isValidRisk(value: any): value is CodeRiskLevel {
  return ["low", "medium", "high", "critical"].includes(String(value || ""));
}

function redactSensitiveContent(content = "") {
  return normalizeCode(content)
    .replace(/sb_secret_[A-Za-z0-9._-]+/g, "[REDACTED_SUPABASE_SECRET_KEY]")
    .replace(/sb_publishable_[A-Za-z0-9._-]+/g, "[REDACTED_SUPABASE_PUBLIC_KEY]")
    .replace(/eyJ[A-Za-z0-9._-]{40,}/g, "[REDACTED_JWT_LIKE_TOKEN]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]")
    .replace(/(OPENAI_API_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]")
    .replace(/(GROQ_API_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]")
    .replace(/(GEMINI_API_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]")
    .replace(/(API_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]")
    .replace(/(PRIVATE_KEY\s*=\s*)(.+)/gi, "$1[REDACTED]");
}

function containsSecretLikeValue(content = "") {
  const code = normalizeCode(content);

  return (
    /sb_secret_[A-Za-z0-9._-]{20,}/.test(code) ||
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*.+/i.test(code) ||
    /OPENAI_API_KEY\s*=\s*.+/i.test(code) ||
    /GROQ_API_KEY\s*=\s*.+/i.test(code) ||
    /GEMINI_API_KEY\s*=\s*.+/i.test(code) ||
    /PRIVATE_KEY\s*=\s*.+/i.test(code)
  );
}

async function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function extractImports(content = "") {
  const code = normalizeCode(content);
  const imports: string[] = [];

  const importRegex =
    /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["'];?/g;

  for (const match of code.matchAll(importRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  const sideEffectImportRegex = /import\s+["']([^"']+)["'];?/g;

  for (const match of code.matchAll(sideEffectImportRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of code.matchAll(dynamicImportRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of code.matchAll(requireRegex)) {
    if (match[1]) imports.push(match[1]);
  }

  return unique(imports);
}

export function extractExports(content = "") {
  const code = normalizeCode(content);
  const exports: string[] = [];

  const namedExportRegex =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

  for (const match of code.matchAll(namedExportRegex)) {
    if (match[1]) exports.push(match[1]);
  }

  const defaultExportRegex = /export\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;

  for (const match of code.matchAll(defaultExportRegex)) {
    if (match[1]) exports.push(`default:${match[1]}`);
  }

  const defaultFunctionRegex =
    /export\s+default\s+(?:async\s+)?function\s*([A-Za-z_$][A-Za-z0-9_$]*)?/g;

  for (const match of code.matchAll(defaultFunctionRegex)) {
    exports.push(match[1] ? `default:${match[1]}` : "default:function");
  }

  const defaultClassRegex =
    /export\s+default\s+class\s*([A-Za-z_$][A-Za-z0-9_$]*)?/g;

  for (const match of code.matchAll(defaultClassRegex)) {
    exports.push(match[1] ? `default:${match[1]}` : "default:class");
  }

  const groupedExportRegex =
    /export\s*{\s*([^}]+)\s*}(?:\s+from\s+["'][^"']+["'])?/g;

  for (const match of code.matchAll(groupedExportRegex)) {
    const names = (match[1] || "")
      .split(",")
      .map((item) => item.trim().split(/\s+as\s+/i)[0])
      .filter(Boolean);

    exports.push(...names);
  }

  return unique(exports);
}

export function extractFunctions(content = "") {
  const code = normalizeCode(content);
  const functions: string[] = [];

  const functionRegex =
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

  for (const match of code.matchAll(functionRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  const arrowFunctionRegex =
    /(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g;

  for (const match of code.matchAll(arrowFunctionRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  const functionExpressionRegex =
    /(?:export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?function\s*\(/g;

  for (const match of code.matchAll(functionExpressionRegex)) {
    if (match[1]) functions.push(match[1]);
  }

  return unique(functions);
}

export function detectRiskLevel(
  filePath: string,
  content = ""
): CodeRiskLevel {
  const file = normalizePath(filePath).toLowerCase();
  const lowerContent = normalizeCode(content).toLowerCase();

  if (
    file.includes(".env") ||
    file.includes(".git") ||
    file.includes("node_modules") ||
    file.includes("protected-core.ts") ||
    containsSecretLikeValue(content)
  ) {
    return "critical";
  }

  if (
    file.includes("app/api/awenia/route.ts") ||
    file.includes("memory-store.ts") ||
    file.includes("supabase.ts") ||
    file.includes("security.ts") ||
    file.includes("pending-actions.ts") ||
    file.includes("dev-agent.ts") ||
    file.includes("code-tools-handler.ts") ||
    file.includes("patch-generator.ts") ||
    file.includes("rollback.ts") ||
    file.includes("system-tools-handler.ts") ||
    file.includes("ai-provider-router.ts")
  ) {
    return "high";
  }

  if (
    file.includes("api/") ||
    file.includes("runtime") ||
    file.includes("agent") ||
    file.includes("evolution") ||
    file.includes("consciousness") ||
    file.includes("awareness") ||
    lowerContent.includes("fetch(") ||
    lowerContent.includes("supabase.") ||
    lowerContent.includes("writeprojectfile") ||
    lowerContent.includes("patchprojectfile") ||
    lowerContent.includes("rollbackprojectfile")
  ) {
    return "medium";
  }

  return "low";
}

export function detectFilePurpose(filePath: string, content = "") {
  const file = normalizePath(filePath).toLowerCase();
  const code = normalizeCode(content).toLowerCase();

  if (file.includes("app/api/awenia/route.ts")) {
    return "Main Awenia API route / backend brain";
  }

  if (file.includes("app/api/test-local/route.ts")) {
    return "Local AI test API route";
  }

  if (file.endsWith("page.tsx")) {
    return "Main chat UI page";
  }

  if (file.includes("ui.tsx")) {
    return "Reusable Awenia UI component";
  }

  if (file.includes("layout.tsx")) {
    return "Next.js layout";
  }

  if (file.includes("globals.css")) {
    return "Global CSS styling";
  }

  if (file.includes("memory-store.ts")) {
    return "Supabase long-term memory store";
  }

  if (file.includes("permanent-memory.ts")) {
    return "Permanent memory layer";
  }

  if (file.includes("memory-ranking.ts")) {
    return "Memory ranking and importance system";
  }

  if (file.includes("memory-intent.ts")) {
    return "Memory-related intent handler";
  }

  if (file.includes("memory.ts")) {
    return "Awenia memory context and local memory seed";
  }

  if (file.includes("code-memory.ts")) {
    return "Project code memory and code awareness system";
  }

  if (file.includes("code-tools-handler.ts")) {
    return "Handlers for reading, writing, patching and analyzing code files";
  }

  if (file.includes("dev-agent.ts")) {
    return "Local filesystem development agent";
  }

  if (file.includes("patch-generator.ts")) {
    return "Safe patch generation and preview system";
  }

  if (file.includes("rollback.ts")) {
    return "Rollback and backup restore system";
  }

  if (file.includes("pending-actions.ts")) {
    return "Approval queue for risky code actions";
  }

  if (file.includes("supabase.ts")) {
    return "Supabase client and connection health system";
  }

  if (file.includes("embeddings.ts")) {
    return "Embedding generation and semantic memory support";
  }

  if (file.includes("internet-learning.ts")) {
    return "Internet learning runtime";
  }

  if (file.includes("internet.ts")) {
    return "Verified internet search and fetch system";
  }

  if (file.includes("awareness.ts")) {
    return "Real awareness state from memory, goals, skills and evolution";
  }

  if (file.includes("consciousness.ts")) {
    return "Combined Awenia consciousness state";
  }

  if (file.includes("decision-engine.ts")) {
    return "Autonomous decision engine";
  }

  if (file.includes("goal-manager.ts")) {
    return "Autonomous goal manager";
  }

  if (file.includes("self-improvement.ts")) {
    return "Self-improvement cycle";
  }

  if (file.includes("self-debug.ts")) {
    return "Self-debugging and error analysis system";
  }

  if (file.includes("autonomous-testing.ts")) {
    return "Autonomous runtime test system";
  }

  if (file.includes("autonomous-loop.ts")) {
    return "Autonomous loop coordinator";
  }

  if (file.includes("autonomous-runtime.ts")) {
    return "Autonomous runtime coordinator";
  }

  if (file.includes("evolution-runtime.ts")) {
    return "Evolution runtime coordinator";
  }

  if (file.includes("evolution-intent.ts")) {
    return "Evolution intent handler";
  }

  if (file.includes("evolution.ts")) {
    return "Awenia evolution system";
  }

  if (file.includes("agents.ts")) {
    return "Agent definitions and runtime agent memory";
  }

  if (file.includes("agent-communication.ts")) {
    return "Agent communication and message queue";
  }

  if (file.includes("agent-orchestrator.ts")) {
    return "Multi-agent workflow orchestrator";
  }

  if (file.includes("orchestrator.ts")) {
    return "Main message orchestrator";
  }

  if (file.includes("intent-router.ts")) {
    return "Intent routing and intent execution planner";
  }

  if (file.includes("routing.ts")) {
    return "Message and tool routing system";
  }

  if (file.includes("skills.ts")) {
    return "Skill detection and skill state system";
  }

  if (file.includes("skill-instructions.ts")) {
    return "Skill-specific instruction builder";
  }

  if (file.includes("system-prompt.ts") || file.includes("prompts.ts")) {
    return "System prompt and message prompt builder";
  }

  if (file.includes("personality-intent.ts")) {
    return "Personality-related intent handler";
  }

  if (file.includes("personality.ts")) {
    return "Awenia personality state and behavior rules";
  }

  if (file.includes("security.ts")) {
    return "Security, truth and approval validation layer";
  }

  if (file.includes("protected-core.ts")) {
    return "Protected immutable Awenia core rules";
  }

  if (file.includes("project-map.ts")) {
    return "Project map and module awareness";
  }

  if (file.includes("project-state.ts")) {
    return "Verified project state summary";
  }

  if (file.includes("ai-provider-router.ts")) {
    return "AI provider router and fallback system";
  }

  if (file.includes("local-ai-provider.ts")) {
    return "Local AI provider interface";
  }

  if (file.includes("voice-ai.ts")) {
    return "Voice AI response system";
  }

  if (file.includes("voice.ts")) {
    return "Voice synthesis and speech utility";
  }

  if (file.includes("task-planner.ts")) {
    return "Task planning system";
  }

  if (file.includes("tasks.ts")) {
    return "Task management utilities";
  }

  if (file.includes("planning.ts")) {
    return "Planning and strategy system";
  }

  if (
    file.includes("global-cognition.ts") ||
    file.includes("cognitive") ||
    file.includes("super-intelligence.ts") ||
    file.includes("unified-intelligence-core.ts") ||
    file.includes("distributed-intelligence.ts") ||
    file.includes("infinite-evolution.ts") ||
    file.includes("transcendence.ts") ||
    file.includes("omniscient-cognition.ts") ||
    file.includes("intelligence")
  ) {
    return "Advanced cognition and intelligence architecture layer";
  }

  if (file.includes("test-local.ts")) {
    return "Local AI test helper";
  }

  if (code.includes("export async function")) {
    return "Async TypeScript module with exported runtime functions";
  }

  if (code.includes("export function")) {
    return "TypeScript utility module with exported functions";
  }

  if (file.endsWith(".tsx")) {
    return "React/Next.js UI component";
  }

  return "General TypeScript project file";
}

function extractMainLogicPreview(content = "") {
  return normalizeCode(content)
    .split("\n")
    .filter((line) => {
      const clean = line.trim();

      if (!clean) return false;
      if (clean.startsWith("import ")) return false;
      if (clean.startsWith("//")) return false;
      if (clean.startsWith("*")) return false;

      return (
        clean.startsWith("export ") ||
        clean.startsWith("async function") ||
        clean.startsWith("function") ||
        clean.includes("return ") ||
        clean.includes("await ") ||
        clean.includes("supabase") ||
        clean.includes("fetch(") ||
        clean.includes("Response.json") ||
        clean.includes("NextResponse") ||
        clean.includes("writeProjectFile") ||
        clean.includes("patchProjectFile") ||
        clean.includes("savePendingAction")
      );
    })
    .slice(0, 30)
    .join("\n");
}

function extractDependencyHints(filePath: string, imports: string[]) {
  const normalizedPath = normalizePath(filePath);

  return imports.map((importPath) => {
    const isLocal =
      importPath.startsWith(".") ||
      importPath.startsWith("@/app") ||
      importPath.startsWith("@/");

    return {
      from: normalizedPath,
      to: importPath,
      type: isLocal ? "local" : "package",
    };
  });
}

export function createCodeSummary(
  filePathOrContent: string,
  maybeContent?: string
) {
  const filePath = maybeContent ? filePathOrContent : "unknown";
  const content = maybeContent ? maybeContent : filePathOrContent;

  const imports = extractImports(content);
  const exports = extractExports(content);
  const functions = extractFunctions(content);
  const purpose = detectFilePurpose(filePath, content);
  const risk = detectRiskLevel(filePath, content);

  return [
    `Purpose: ${purpose}`,
    `Risk: ${risk}`,
    `Lines: ${calculateLineCount(content)}`,
    `Imports: ${imports.length ? imports.join(", ") : "none"}`,
    `Exports: ${exports.length ? exports.join(", ") : "none"}`,
    `Functions: ${functions.length ? functions.join(", ") : "none"}`,
  ].join("\n");
}

export function createSmartCodeSummary(filePath: string, content = "") {
  const normalizedPath = normalizePath(filePath);
  const cleanContent = normalizeCode(content);

  const imports = extractImports(cleanContent);
  const exports = extractExports(cleanContent);
  const functions = extractFunctions(cleanContent);
  const purpose = detectFilePurpose(normalizedPath, cleanContent);
  const risk = detectRiskLevel(normalizedPath, cleanContent);
  const dependencies = extractDependencyHints(normalizedPath, imports);
  const mainLogic = extractMainLogicPreview(cleanContent);

  return [
    `File: ${normalizedPath}`,
    `Purpose: ${purpose}`,
    `Risk level: ${risk}`,
    `Line count: ${calculateLineCount(cleanContent)}`,
    `Content length: ${cleanContent.length}`,
    "",
    `Imports (${imports.length}): ${imports.length ? imports.join(", ") : "none"}`,
    `Exports (${exports.length}): ${exports.length ? exports.join(", ") : "none"}`,
    `Functions (${functions.length}): ${functions.length ? functions.join(", ") : "none"}`,
    `Dependencies (${dependencies.length}): ${dependencies.length
      ? dependencies
        .map((dependency) => `${dependency.to} [${dependency.type}]`)
        .join(", ")
      : "none"
    }`,
    "",
    "Main logic preview:",
    mainLogic || "No main logic detected.",
  ].join("\n");
}

function buildCodeMemoryRecord(
  filePath: string,
  content = "",
  metadata: any = {}
): CodeMemoryData {
  const normalizedPath = normalizePath(filePath);
  const cleanContent = normalizeCode(content);
  const safeStoredContent = redactSensitiveContent(cleanContent).slice(
    0,
    MAX_STORED_CONTENT_LENGTH
  );

  const imports = extractImports(cleanContent);
  const exports = extractExports(cleanContent);
  const functions = extractFunctions(cleanContent);
  const purpose = detectFilePurpose(normalizedPath, cleanContent);
  const risk = detectRiskLevel(normalizedPath, cleanContent);

  return {
    file_path: normalizedPath,
    file_purpose: purpose,
    code_summary: createSmartCodeSummary(normalizedPath, cleanContent),
    important_exports: exports,
    important_functions: functions,
    imports,
    exports,
    risk_level: risk,
    line_count: calculateLineCount(cleanContent),
    content_length: cleanContent.length,
    last_known_content: safeStoredContent,
    metadata: {
      ...metadata,
      dependencyHints: extractDependencyHints(normalizedPath, imports),
      codeMemoryVersion: "v4",
      sensitiveContentRedacted:
        safeStoredContent !== cleanContent.slice(0, MAX_STORED_CONTENT_LENGTH),
    },
    created_at: now(),
    updated_at: now(),
  };
}

async function saveCodeMemoryToSupabase(record: CodeMemoryData) {
  if (!isSupabaseConfigured()) {
    return {
      status: "fallback",
      saved: false,
      error: "Supabase is not configured",
    };
  }

  try {
    const payload = {
      file_path: record.file_path,
      file_purpose: record.file_purpose,
      code_summary: record.code_summary,
      important_exports: record.important_exports,
      important_functions: record.important_functions,
      imports: record.imports,
      exports: record.exports,
      risk_level: record.risk_level,
      line_count: record.line_count,
      content_length: record.content_length,
      last_known_content: record.last_known_content,
      metadata: record.metadata || {},
      updated_at: record.updated_at,
    };

    const query = supabase
      .from("project_code_memory")
      .upsert(payload as any, {
        onConflict: "file_path",
      })
      .select()
      .single();

    const result: any = await withTimeout(
      query as any,
      SUPABASE_TIMEOUT_MS,
      "saveCodeMemoryToSupabase"
    );

    const { data, error } = result;

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
      error: error?.message || "Failed to save code memory",
    };
  }
}

function mergePartialRecord(
  input: Partial<CodeMemoryData>,
  content = "",
  metadata: any = {}
): CodeMemoryData {
  const filePath = normalizePath(input.file_path || "unknown");
  const baseContent = input.last_known_content || content || "";
  const base = buildCodeMemoryRecord(filePath, baseContent, {
    ...(metadata || {}),
    ...(input.metadata || {}),
  });

  const providedRisk = isValidRisk(input.risk_level)
    ? input.risk_level
    : base.risk_level;

  const cleanLastKnownContent = redactSensitiveContent(
    normalizeCode(input.last_known_content || base.last_known_content || "")
  ).slice(0, MAX_STORED_CONTENT_LENGTH);

  return {
    ...base,
    ...input,
    file_path: filePath,
    file_purpose: input.file_purpose || base.file_purpose,
    code_summary: input.code_summary || base.code_summary,
    important_exports: normalizeArray(
      input.important_exports,
      base.important_exports
    ),
    important_functions: normalizeArray(
      input.important_functions,
      base.important_functions
    ),
    imports: normalizeArray(input.imports, base.imports),
    exports: normalizeArray(input.exports, base.exports),
    risk_level: maxRisk(base.risk_level, providedRisk),
    line_count: Number(input.line_count || base.line_count || 0),
    content_length: Number(input.content_length || base.content_length || 0),
    last_known_content: cleanLastKnownContent,
    metadata: {
      ...(base.metadata || {}),
      ...(input.metadata || {}),
      ...(metadata || {}),
      codeMemoryVersion: "v4",
    },
    created_at: input.created_at || base.created_at || now(),
    updated_at: now(),
  };
}

function calculateSaveStatus(supabaseResult: any, embeddingResult: any) {
  const supabaseStatus = supabaseResult?.status;
  const embeddingStatus = embeddingResult?.status;

  if (supabaseStatus === "saved" && embeddingStatus !== "failed") {
    return "saved" as CodeMemoryStatus;
  }

  if (supabaseStatus === "fallback" && !embeddingResult) {
    return "fallback" as CodeMemoryStatus;
  }

  if (supabaseStatus === "failed" || embeddingStatus === "failed") {
    return "partial" as CodeMemoryStatus;
  }

  if (supabaseStatus === "fallback" || embeddingStatus === "fallback") {
    return "partial" as CodeMemoryStatus;
  }

  return "saved" as CodeMemoryStatus;
}

export async function saveCodeMemory(
  input: string | Partial<CodeMemoryData>,
  content = "",
  options?: {
    saveToSupabase?: boolean;
    saveEmbedding?: boolean;
    metadata?: any;
  }
) {
  const record =
    typeof input === "string"
      ? buildCodeMemoryRecord(input, content, options?.metadata || {})
      : mergePartialRecord(input, content, options?.metadata || {});

  runtimeCodeMemory.set(record.file_path, record);

  let supabaseResult: any = null;
  let embeddingResult: any = null;

  if (options?.saveToSupabase ?? true) {
    supabaseResult = await saveCodeMemoryToSupabase(record);
  }

  if (options?.saveEmbedding ?? true) {
    try {
      embeddingResult = await withTimeout(
        saveCodeEmbedding(record.file_path, record.last_known_content, {
          purpose: record.file_purpose,
          risk: record.risk_level,
          exports: record.important_exports,
          functions: record.important_functions,
        }),
        EMBEDDING_TIMEOUT_MS,
        "saveCodeEmbedding"
      );
    } catch (error: any) {
      embeddingResult = {
        status: "failed",
        error: error?.message || "Failed to save code embedding",
      };
    }
  }

  const status = calculateSaveStatus(supabaseResult, embeddingResult);

  return {
    status,
    record,
    runtimeSaved: true,
    supabase: supabaseResult,
    embedding: embeddingResult,
    timestamp: now(),
    truthPolicy: {
      runtimeMemorySavedEvenIfSupabaseFails: true,
      supabaseStatusReportedSeparately: true,
      noFakeCodeMemorySave: true,
    },
  };
}

function normalizeSupabaseCodeMemory(item: any): CodeMemoryData {
  const filePath = normalizePath(item.file_path || "unknown");
  const content = item.last_known_content || "";
  const fallback = buildCodeMemoryRecord(filePath, content, item.metadata || {});

  return {
    file_path: filePath,
    file_purpose: item.file_purpose || fallback.file_purpose,
    code_summary: item.code_summary || fallback.code_summary,
    important_exports: normalizeArray(
      item.important_exports,
      fallback.important_exports
    ),
    important_functions: normalizeArray(
      item.important_functions,
      fallback.important_functions
    ),
    imports: normalizeArray(item.imports, fallback.imports),
    exports: normalizeArray(item.exports, fallback.exports),
    risk_level: isValidRisk(item.risk_level)
      ? item.risk_level
      : fallback.risk_level,
    line_count: Number(item.line_count || fallback.line_count || 0),
    content_length: Number(item.content_length || fallback.content_length || 0),
    last_known_content: redactSensitiveContent(content).slice(
      0,
      MAX_STORED_CONTENT_LENGTH
    ),
    metadata: item.metadata || fallback.metadata || {},
    created_at: item.created_at || now(),
    updated_at: item.updated_at || now(),
  };
}

export async function getCodeMemory(filePath: string) {
  const normalizedPath = normalizePath(filePath);

  const runtime = runtimeCodeMemory.get(normalizedPath);

  if (runtime) {
    return {
      status: "loaded" as CodeMemoryStatus,
      source: "runtime",
      record: runtime,
      timestamp: now(),
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "fallback" as CodeMemoryStatus,
      source: "runtime",
      record: null,
      error: "Supabase is not configured and runtime memory has no record",
      timestamp: now(),
    };
  }

  try {
    const query = supabase
      .from("project_code_memory")
      .select("*")
      .eq("file_path", normalizedPath)
      .maybeSingle();

    const result: any = await withTimeout(
      query as any,
      SUPABASE_TIMEOUT_MS,
      "getCodeMemory"
    );

    const { data, error } = result;

    if (error) {
      return {
        status: "failed" as CodeMemoryStatus,
        source: "supabase",
        record: null,
        error: error.message,
        timestamp: now(),
      };
    }

    if (!data) {
      return {
        status: "fallback" as CodeMemoryStatus,
        source: "supabase",
        record: null,
        error: "No code memory found",
        timestamp: now(),
      };
    }

    const record = normalizeSupabaseCodeMemory(data);

    runtimeCodeMemory.set(record.file_path, record);

    return {
      status: "loaded" as CodeMemoryStatus,
      source: "supabase",
      record,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as CodeMemoryStatus,
      source: "supabase",
      record: null,
      error: error?.message || "Failed to load code memory",
      timestamp: now(),
    };
  }
}

export async function getAllCodeMemories(limit = 200) {
  const runtime = Array.from(runtimeCodeMemory.values()).slice(0, limit);

  if (!isSupabaseConfigured()) {
    return {
      status: "fallback" as CodeMemoryStatus,
      runtime,
      supabase: [],
      records: runtime,
      count: runtime.length,
      timestamp: now(),
    };
  }

  try {
    const query = supabase
      .from("project_code_memory")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);

    const result: any = await withTimeout(
      query as any,
      SUPABASE_TIMEOUT_MS,
      "getAllCodeMemories"
    );

    const { data, error } = result;

    if (error) {
      return {
        status: runtime.length > 0 ? "partial" : "failed",
        runtime,
        supabase: [],
        records: runtime,
        error: error.message,
        count: runtime.length,
        timestamp: now(),
      };
    }

    const supabaseRecords = (data || []).map(normalizeSupabaseCodeMemory);

    for (const record of supabaseRecords) {
      runtimeCodeMemory.set(record.file_path, record);
    }

    const merged = Array.from(runtimeCodeMemory.values())
      .sort((a, b) => {
        return (
          new Date(b.updated_at).getTime() -
          new Date(a.updated_at).getTime()
        );
      })
      .slice(0, limit);

    return {
      status: "loaded" as CodeMemoryStatus,
      runtime,
      supabase: supabaseRecords,
      records: merged,
      count: merged.length,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: runtime.length > 0 ? "partial" : "failed",
      runtime,
      supabase: [],
      records: runtime,
      error: error?.message || "Failed to load all code memories",
      count: runtime.length,
      timestamp: now(),
    };
  }
}

function scoreText(haystack: string, query: string) {
  const lowerHaystack = haystack.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/).filter(Boolean);

  let score = 0;

  if (lowerHaystack.includes(lowerQuery)) score += 20;

  for (const word of words) {
    if (word.length < 2) continue;
    if (lowerHaystack.includes(word)) score += 4;
  }

  return score;
}

function scoreCodeMemory(record: CodeMemoryData, query: string) {
  const lowerQuery = query.toLowerCase();

  const importantSymbols = [
    ...record.important_exports,
    ...record.important_functions,
    ...record.exports,
  ];

  const haystack = [
    record.file_path,
    record.file_purpose,
    record.code_summary,
    record.important_exports.join(" "),
    record.important_functions.join(" "),
    record.imports.join(" "),
    record.exports.join(" "),
    record.metadata?.dependencyHints
      ? JSON.stringify(record.metadata.dependencyHints)
      : "",
    record.last_known_content.slice(0, 3000),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;

  if (record.file_path.toLowerCase() === lowerQuery) score += 120;
  if (record.file_path.toLowerCase().includes(lowerQuery)) score += 60;
  if (record.file_purpose.toLowerCase().includes(lowerQuery)) score += 35;
  if (record.code_summary.toLowerCase().includes(lowerQuery)) score += 30;

  if (
    importantSymbols.some((symbol) => symbol.toLowerCase() === lowerQuery)
  ) {
    score += 70;
  }

  if (
    importantSymbols.some((symbol) =>
      symbol.toLowerCase().includes(lowerQuery)
    )
  ) {
    score += 35;
  }

  if (record.imports.some((item) => item.toLowerCase().includes(lowerQuery))) {
    score += 25;
  }

  if (haystack.includes(lowerQuery)) score += 15;

  score += scoreText(haystack, query);

  return score;
}

export async function searchCodeMemory(query: string, limit = 10) {
  const safeQuery = String(query || "").trim();

  if (!safeQuery) {
    return {
      status: "searched" as CodeMemoryStatus,
      query,
      results: [],
      count: 0,
      timestamp: now(),
    };
  }

  const all = await getAllCodeMemories(300);
  const records: CodeMemoryData[] = all.records || [];

  const results = records
    .map((record) => ({
      record,
      score: scoreCodeMemory(record, safeQuery),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    status: "searched" as CodeMemoryStatus,
    query: safeQuery,
    results,
    count: results.length,
    sourceStatus: all.status,
    sourceError: (all as any).error,
    timestamp: now(),
  };
}

export function setActiveCodeFile(filePath: string, content?: string) {
  const normalizedPath = normalizePath(filePath);

  activeCodeFile = {
    filePath: normalizedPath,
    content,
    summary: content
      ? createSmartCodeSummary(normalizedPath, content)
      : undefined,
    updatedAt: now(),
  };

  return activeCodeFile;
}

export function getActiveCodeFile() {
  return activeCodeFile;
}

export async function rememberCodeFile(
  filePath: string,
  content: string,
  metadata: any = {}
) {
  setActiveCodeFile(filePath, content);

  return saveCodeMemory(filePath, content, {
    saveToSupabase: true,
    saveEmbedding: true,
    metadata,
  });
}

export async function analyzeCodeFile(filePath: string, content: string) {
  const record = buildCodeMemoryRecord(filePath, content);

  return {
    status: "loaded" as CodeMemoryStatus,
    record,
    summary: record.code_summary,
    purpose: record.file_purpose,
    risk: record.risk_level,
    imports: record.imports,
    exports: record.exports,
    functions: record.important_functions,
    dependencyHints: record.metadata?.dependencyHints || [],
    timestamp: now(),
  };
}

export function buildCodeMemoryContext(records: CodeMemoryData[]) {
  if (records.length === 0) {
    return "Nu există code memory verificată pentru această căutare.";
  }

  return records
    .map((record, index) => {
      return [
        `${index + 1}. ${record.file_path}`,
        `Purpose: ${record.file_purpose}`,
        `Risk: ${record.risk_level}`,
        `Imports: ${record.imports.join(", ") || "none"}`,
        `Exports: ${record.important_exports.join(", ") || "none"}`,
        `Functions: ${record.important_functions.join(", ") || "none"}`,
        `Summary: ${record.code_summary.slice(0, MAX_CONTEXT_SUMMARY_LENGTH)}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function getCodeMemoryContext(query: string, limit = 5) {
  const search = await searchCodeMemory(query, limit);

  return buildCodeMemoryContext(
    search.results.map((item: any) => item.record)
  );
}

export function getRuntimeCodeMemories() {
  return Array.from(runtimeCodeMemory.values());
}

export function clearRuntimeCodeMemory() {
  const count = runtimeCodeMemory.size;

  runtimeCodeMemory.clear();

  return {
    status: "cleared",
    count,
    timestamp: now(),
  };
}

export function getCodeMemoryState() {
  return {
    status: "loaded" as CodeMemoryStatus,
    runtimeCount: runtimeCodeMemory.size,
    activeCodeFile,
    supabaseConfigured: isSupabaseConfigured(),
    truthPolicy: {
      noFakeCodeAwareness: true,
      noClaimFileKnownWithoutRead: true,
      runtimeMemoryIsNotDatabaseMemory: true,
      supabaseConfiguredIsNotSameAsSaved: true,
    },
    timestamp: now(),
  };
}

export async function runCodeMemorySystem(query = "") {
  if (!query.trim()) {
    return getCodeMemoryState();
  }

  const search = await searchCodeMemory(query, 10);

  return {
    status: "searched" as CodeMemoryStatus,
    query,
    search,
    context: buildCodeMemoryContext(
      search.results.map((item: any) => item.record)
    ),
    state: getCodeMemoryState(),
    timestamp: now(),
  };
}

export const getCodeMemoryByFile = getCodeMemory;
export const listCodeMemories = getAllCodeMemories;
export const rememberCode = rememberCodeFile;
export const saveProjectCodeMemory = saveCodeMemory;
export const searchProjectCodeMemory = searchCodeMemory;
export const createSmartSummary = createSmartCodeSummary;
export const createSummary = createCodeSummary;
export const detectPurpose = detectFilePurpose;
export const detectCodeRisk = detectRiskLevel;
export const codeMemory = runtimeCodeMemory;

export default saveCodeMemory;