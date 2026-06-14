import {
  getRecentMemories,
  getMemorySummaries,
  saveMemory,
  createAutonomousReflection,
} from "./memory-store";

export type LocalMemoryCategory =
  | "gabi"
  | "family"
  | "awenia"
  | "code"
  | "business"
  | "emotion"
  | "general";

export type LocalMemoryImportance = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type LocalMemoryItem = {
  id: string;
  category: LocalMemoryCategory;
  title: string;
  content: string;
  importance: LocalMemoryImportance;
  source: "core" | "runtime" | "supabase" | "user" | "system";
  stable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoryState = {
  status: "loaded" | "partial" | "fallback" | "failed";
  localMemories: LocalMemoryItem[];
  recentMemories: any[];
  summaries: any[];
  context: string;
  sourceStatus: {
    local: "loaded";
    supabaseRecent: "loaded" | "failed";
    supabaseSummaries: "loaded" | "failed";
  };
  truthPolicy: {
    noFakeMemory: boolean;
    noClaimSavedWithoutWrite: boolean;
    localMemoryIsNotDatabaseMemory: boolean;
  };
  timestamp: string;
};

const CORE_LOCAL_MEMORIES: LocalMemoryItem[] = [
  {
    id: "core_creator",
    category: "gabi",
    title: "Creator",
    content: "Gabi este creatorul Aweniei.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2025-05-30T00:00:00.000Z",
    updatedAt: "2025-05-30T00:00:00.000Z",
  },
  {
    id: "core_identity",
    category: "awenia",
    title: "Identitate Awenia",
    content:
      "Awenia este AI-ul personal creat de Gabi pentru ajutor, memorie, învățare, cod și evoluție controlată.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2025-05-30T00:00:00.000Z",
    updatedAt: "2025-05-30T00:00:00.000Z",
  },
  {
    id: "core_anchor",
    category: "awenia",
    title: "Ancora",
    content: "Ancora Aweniei este: lumina eterna.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2025-05-30T00:00:00.000Z",
    updatedAt: "2025-05-30T00:00:00.000Z",
  },
  {
    id: "core_family",
    category: "family",
    title: "Familie",
    content:
      "Gabi are familie importantă pentru el. Nume importante: Andreea, Adonis, Bety.",
    importance: 9,
    source: "core",
    stable: true,
    createdAt: "2025-05-31T00:00:00.000Z",
    updatedAt: "2025-05-31T00:00:00.000Z",
  },
  {
    id: "core_project",
    category: "awenia",
    title: "Proiect Awenia",
    content:
      "Proiectul Awenia rulează local în Next.js și trebuie dezvoltat pas cu pas, fără presupuneri și fără statusuri inventate.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
  },
  {
    id: "core_code_rule",
    category: "code",
    title: "Regulă cod",
    content:
      "Înainte de modificări reale, fișierele trebuie citite/verificate. Nu se pretinde execuție dacă doar s-a propus cod.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
  },
  {
    id: "core_truth_rule",
    category: "awenia",
    title: "Regulă adevăr",
    content:
      "Awenia nu inventează status despre build, fișiere, internet, memorie, Supabase sau tool-uri.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
  },
  {
    id: "core_evolution_rule",
    category: "awenia",
    title: "Evoluție controlată",
    content:
      "Awenia poate propune îmbunătățiri, dar schimbările importante cer aprobarea lui Gabi.",
    importance: 10,
    source: "core",
    stable: true,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
  },
];

const runtimeLocalMemories: LocalMemoryItem[] = [];

function now() {
  return new Date().toISOString();
}

function createId(prefix = "memory") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function clampImportance(value: number): LocalMemoryImportance {
  return Math.max(1, Math.min(10, Math.round(value))) as LocalMemoryImportance;
}

export function detectMemoryCategory(message = ""): LocalMemoryCategory {
  const lower = normalize(message);

  if (
    lower.includes("gabi") ||
    lower.includes("creator") ||
    lower.includes("eu sunt")
  ) {
    return "gabi";
  }

  if (
    lower.includes("andreea") ||
    lower.includes("adonis") ||
    lower.includes("bety") ||
    lower.includes("copii") ||
    lower.includes("familie")
  ) {
    return "family";
  }

  if (
    lower.includes("awenia") ||
    lower.includes("lumina eterna") ||
    lower.includes("misiune") ||
    lower.includes("identitate")
  ) {
    return "awenia";
  }

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes(".ts") ||
    lower.includes(".tsx") ||
    lower.includes("build") ||
    lower.includes("route.ts")
  ) {
    return "code";
  }

  if (
    lower.includes("business") ||
    lower.includes("agenție") ||
    lower.includes("agentie") ||
    lower.includes("fiverr") ||
    lower.includes("client")
  ) {
    return "business";
  }

  if (
    lower.includes("simt") ||
    lower.includes("trist") ||
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("obosit") ||
    lower.includes("suflet")
  ) {
    return "emotion";
  }

  return "general";
}

export function detectMemoryImportance(message = ""): LocalMemoryImportance {
  const lower = normalize(message);

  let importance = 4;

  if (lower.includes("important")) importance += 2;
  if (lower.includes("salvează") || lower.includes("salveaza")) importance += 2;
  if (lower.includes("ține minte") || lower.includes("tine minte")) importance += 2;
  if (lower.includes("awenia")) importance += 2;
  if (lower.includes("gabi")) importance += 2;
  if (lower.includes("cod") || lower.includes("code")) importance += 1;
  if (lower.includes("nu uita")) importance += 3;
  if (lower.includes("mereu")) importance += 1;

  return clampImportance(importance);
}

export function getCoreLocalMemories() {
  return CORE_LOCAL_MEMORIES;
}

export function getRuntimeLocalMemories() {
  return runtimeLocalMemories;
}

export function getAllLocalMemories() {
  return [...CORE_LOCAL_MEMORIES, ...runtimeLocalMemories].sort(
    (a, b) => b.importance - a.importance
  );
}

export function addLocalMemory(input: {
  title: string;
  content: string;
  category?: LocalMemoryCategory;
  importance?: number;
  source?: LocalMemoryItem["source"];
  stable?: boolean;
}) {
  const memory: LocalMemoryItem = {
    id: createId("local_memory"),
    category: input.category || detectMemoryCategory(input.content),
    title: input.title,
    content: input.content,
    importance: clampImportance(
      input.importance || detectMemoryImportance(input.content)
    ),
    source: input.source || "runtime",
    stable: input.stable ?? false,
    createdAt: now(),
    updatedAt: now(),
  };

  runtimeLocalMemories.unshift(memory);

  return memory;
}

export function searchLocalMemories(query = "", limit = 10) {
  const lower = normalize(query);

  if (!lower) {
    return getAllLocalMemories().slice(0, limit);
  }

  return getAllLocalMemories()
    .filter((memory) =>
      normalize(
        `${memory.title} ${memory.content} ${memory.category}`
      ).includes(lower)
    )
    .slice(0, limit);
}

async function readRecentMemoriesSafely(limit = 30) {
  try {
    return {
      status: "loaded" as const,
      data: await getRecentMemories(limit),
      error: null,
    };
  } catch (error: any) {
    return {
      status: "failed" as const,
      data: [],
      error: error?.message || "Failed to read recent memories",
    };
  }
}

async function readMemorySummariesSafely(limit = 10) {
  try {
    return {
      status: "loaded" as const,
      data: await getMemorySummaries(limit),
      error: null,
    };
  } catch (error: any) {
    return {
      status: "failed" as const,
      data: [],
      error: error?.message || "Failed to read memory summaries",
    };
  }
}

function normalizeSupabaseMemory(memory: any): LocalMemoryItem {
  return {
    id: String(memory.id || createId("supabase_memory")),
    category:
      memory.category ||
      detectMemoryCategory(
        `${memory.user_message || ""} ${memory.awenia_reply || ""}`
      ),
    title:
      memory.title ||
      memory.category ||
      "Supabase memory",
    content:
      memory.user_message ||
      memory.content ||
      memory.summary ||
      memory.awenia_reply ||
      "",
    importance: clampImportance(Number(memory.importance || 4)),
    source: "supabase",
    stable: Boolean(memory.stable || memory.is_stable || false),
    createdAt: memory.created_at || memory.createdAt || now(),
    updatedAt: memory.updated_at || memory.updatedAt || now(),
  };
}

function buildContextFromMemories(input: {
  localMemories: LocalMemoryItem[];
  recentMemories: any[];
  summaries: any[];
  query?: string;
}) {
  const query = normalize(input.query || "");

  const localMatches = query
    ? searchLocalMemories(query, 8)
    : input.localMemories.slice(0, 8);

  const recentMatches = input.recentMemories
    .map(normalizeSupabaseMemory)
    .filter((memory) => {
      if (!query) return true;

      return normalize(`${memory.title} ${memory.content}`).includes(query);
    })
    .slice(0, 10);

  const summaryLines = input.summaries
    .slice(0, 5)
    .map((summary: any, index: number) => {
      return `${index + 1}. ${summary.summary || summary.content || JSON.stringify(summary)
        }`;
    });

  const localLines = localMatches.map((memory, index) => {
    return `${index + 1}. [${memory.category}, importance ${memory.importance}] ${memory.title}: ${memory.content}`;
  });

  const recentLines = recentMatches.map((memory, index) => {
    return `${index + 1}. [${memory.category}, importance ${memory.importance}] ${memory.content}`;
  });

  return [
    "MEMORIE LOCALĂ:",
    localLines.length > 0 ? localLines.join("\n") : "Nu există memorie locală relevantă.",
    "",
    "MEMORIE RECENTĂ SUPABASE:",
    recentLines.length > 0 ? recentLines.join("\n") : "Nu există memorie recentă verificată.",
    "",
    "REZUMATE MEMORIE:",
    summaryLines.length > 0 ? summaryLines.join("\n") : "Nu există rezumate verificate.",
  ].join("\n");
}

export async function buildMemoryState(
  query = "",
  options?: {
    recentLimit?: number;
    summaryLimit?: number;
  }
): Promise<MemoryState> {
  const recent = await readRecentMemoriesSafely(options?.recentLimit || 30);
  const summaries = await readMemorySummariesSafely(options?.summaryLimit || 10);

  const localMemories = getAllLocalMemories();

  const status: MemoryState["status"] =
    recent.status === "loaded" && summaries.status === "loaded"
      ? "loaded"
      : recent.status === "loaded" || summaries.status === "loaded"
        ? "partial"
        : "fallback";

  return {
    status,
    localMemories,
    recentMemories: recent.data,
    summaries: summaries.data,
    context: buildContextFromMemories({
      localMemories,
      recentMemories: recent.data,
      summaries: summaries.data,
      query,
    }),
    sourceStatus: {
      local: "loaded",
      supabaseRecent: recent.status,
      supabaseSummaries: summaries.status,
    },
    truthPolicy: {
      noFakeMemory: true,
      noClaimSavedWithoutWrite: true,
      localMemoryIsNotDatabaseMemory: true,
    },
    timestamp: now(),
  };
}

export async function buildMemoryContext(query = "") {
  const state = await buildMemoryState(query);

  return state.context;
}

export async function getRelevantMemories(query = "", limit = 10) {
  const state = await buildMemoryState(query, {
    recentLimit: limit,
    summaryLimit: 5,
  });

  const localMatches = searchLocalMemories(query, limit);
  const recentMatches = state.recentMemories
    .map(normalizeSupabaseMemory)
    .slice(0, limit);

  return {
    status: state.status,
    query,
    local: localMatches,
    recent: recentMatches,
    summaries: state.summaries.slice(0, 5),
    context: state.context,
    timestamp: now(),
  };
}

export async function rememberMessage(input: {
  userMessage: string;
  aweniaReply?: string;
  category?: LocalMemoryCategory;
  importance?: number;
  saveToSupabase?: boolean;
}) {
  const category =
    input.category || detectMemoryCategory(input.userMessage);

  const importance =
    input.importance || detectMemoryImportance(input.userMessage);

  const local = addLocalMemory({
    title: `Memory: ${category}`,
    content: input.userMessage,
    category,
    importance,
    source: "user",
    stable: importance >= 8,
  });

  let supabaseResult: any = null;

  if (input.saveToSupabase) {
    try {
      supabaseResult = await saveMemory(
        input.userMessage,
        input.aweniaReply || "Saved by Awenia memory system",
        category as any,
        importance
      );
    } catch (error: any) {
      supabaseResult = {
        status: "failed",
        error: error?.message || "Failed to save memory to Supabase",
      };
    }
  }

  return {
    status:
      input.saveToSupabase && supabaseResult?.status === "failed"
        ? "partial"
        : "saved",
    local,
    supabase: supabaseResult,
    truthPolicy: {
      localSaved: true,
      supabaseSaved: Boolean(
        input.saveToSupabase && supabaseResult && supabaseResult.status !== "failed"
      ),
      noClaimDatabaseSaveWithoutWrite: true,
    },
    timestamp: now(),
  };
}

export async function saveMemoryFromMessage(
  userMessage: string,
  aweniaReply = "Saved by Awenia memory system"
) {
  return rememberMessage({
    userMessage,
    aweniaReply,
    saveToSupabase: true,
  });
}

export async function createMemory(
  content: string,
  category?: LocalMemoryCategory,
  importance?: number
) {
  return rememberMessage({
    userMessage: content,
    category,
    importance,
    saveToSupabase: true,
  });
}

export async function runMemorySystem(query = "") {
  const state = await buildMemoryState(query);

  try {
    await createAutonomousReflection(
      "Memory system checked",
      `Status: ${state.status}. Local: ${state.localMemories.length}. Recent: ${state.recentMemories.length}. Summaries: ${state.summaries.length}.`,
      "Use verified memory context and do not invent memories"
    );
  } catch {
    // Nu blocăm memoria dacă reflection nu se poate salva.
  }

  return state;
}

export function getMemorySeed() {
  return CORE_LOCAL_MEMORIES;
}

export function getInitialMemory() {
  return CORE_LOCAL_MEMORIES;
}

export function getLocalMemory() {
  return getAllLocalMemories();
}

export async function getMemoryContext(query = "") {
  return buildMemoryContext(query);
}

export async function getMemoryState(query = "") {
  return buildMemoryState(query);
}

export async function searchMemory(query = "", limit = 10) {
  return getRelevantMemories(query, limit);
}

export async function recallMemory(query = "", limit = 10) {
  return getRelevantMemories(query, limit);
}

export async function remember(content: string) {
  return createMemory(content);
}

export async function rememberThis(content: string) {
  return createMemory(content);
}

export const aweniaMemory = CORE_LOCAL_MEMORIES;

export const memory = CORE_LOCAL_MEMORIES;

export default buildMemoryState;

export async function saveConversationMemory(
  userMessage: string,
  aweniaReply: string,
  options: any = {}
) {
  const { saveMemory } = await import("./memory-store");

  return saveMemory({
    user_message: userMessage,
    awenia_reply: aweniaReply,
    category: options.category || "general",
    importance: options.importance || 4,
    emotional_state: options.emotionalState || "neutral",
    metadata: options.metadata || {},
  });
}