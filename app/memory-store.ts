import { isSupabaseConfigured } from "./supabase";
import { getSupabaseServer } from "./supabase-server";

const supabase = getSupabaseServer();

export type MemoryCategory =
  | "gabi"
  | "family"
  | "awenia"
  | "code"
  | "business"
  | "emotion"
  | "general"
  | string;

export type StoreStatus =
  | "saved"
  | "loaded"
  | "partial"
  | "fallback"
  | "failed";

export type MemoryRecord = {
  id: string;
  user_message: string;
  awenia_reply: string;
  category: MemoryCategory;
  importance: number;
  emotional_state?: string;
  metadata?: any;
  created_at: string;
  updated_at?: string;
};

function now() {
  return new Date().toISOString();
}

function createId(prefix = "memory") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function clampImportance(value: any) {
  const number = Number(value ?? 4);
  return Number.isFinite(number)
    ? Math.max(1, Math.min(10, Math.round(number)))
    : 4;
}

function normalize(text = "") {
  return String(text).toLowerCase().trim().replace(/\s+/g, " ");
}

function sortNewest(items: any[]) {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
    const dateB = new Date(b.created_at || b.createdAt || 0).getTime();

    return dateB - dateA;
  });
}

function limitItems<T>(items: T[], limit = 50) {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 50;
  return items.slice(0, safeLimit);
}

const runtimeMemories: MemoryRecord[] = [];
const runtimeSummaries: any[] = [];
const runtimeGoals: any[] = [];
const runtimePriorities: any[] = [];
const runtimeSkillLevels: any[] = [];
const runtimeEvolutionSuggestions: any[] = [];
const runtimePersonalityTraits: any[] = [];
const runtimeReflections: any[] = [];
const runtimeLearningTasks: any[] = [];
const runtimeEvolutionReports: any[] = [];

const CORE_SKILLS = [
  { skill: "coding", level: 7, confidence: 75 },
  { skill: "debugging", level: 7, confidence: 75 },
  { skill: "memory", level: 8, confidence: 80 },
  { skill: "internet", level: 5, confidence: 60 },
  { skill: "planning", level: 8, confidence: 80 },
  { skill: "security", level: 8, confidence: 80 },
  { skill: "evolution", level: 6, confidence: 65 },
  { skill: "awenia", level: 9, confidence: 90 },
];

function ensureRuntimeSeeds() {
  if (runtimeSkillLevels.length === 0) {
    runtimeSkillLevels.push(
      ...CORE_SKILLS.map((skill) => ({
        id: createId("skill"),
        ...skill,
        source: "core",
        created_at: now(),
      }))
    );
  }

  if (runtimePriorities.length === 0) {
    runtimePriorities.push(
      {
        id: createId("priority"),
        priority: "truth_before_status_claims",
        score: 10,
        status: "active",
        created_at: now(),
      },
      {
        id: createId("priority"),
        priority: "gabi_approval_for_risky_actions",
        score: 10,
        status: "active",
        created_at: now(),
      },
      {
        id: createId("priority"),
        priority: "connect_existing_systems_before_new_modules",
        score: 9,
        status: "active",
        created_at: now(),
      }
    );
  }
}

ensureRuntimeSeeds();

async function safeInsert(table: string, payload: any) {
  if (!isSupabaseConfigured()) {
    return {
      status: "fallback",
      saved: false,
      error: "Supabase is not configured",
    };
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .insert(payload as any)
      .select()
      .single();

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
      error: error?.message || `Failed to insert into ${table}`,
    };
  }
}

async function safeSelect(
  table: string,
  options?: {
    limit?: number;
    orderBy?: string;
    ascending?: boolean;
    filters?: Record<string, any>;
  }
) {
  if (!isSupabaseConfigured()) {
    return {
      status: "fallback" as StoreStatus,
      data: [],
      error: "Supabase is not configured",
    };
  }

  try {
    let query: any = supabase.from(table).select("*");

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value);
      }
    }

    query = query.order(options?.orderBy || "created_at", {
      ascending: options?.ascending ?? false,
    });

    const requestedLimit = Number(options?.limit ?? 50);
    const queryLimit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(500, Math.floor(requestedLimit)))
      : 50;
    query = query.limit(queryLimit);

    const { data, error } = await query;

    if (error) {
      return {
        status: "failed" as StoreStatus,
        data: [],
        error: error.message,
      };
    }

    return {
      status: "loaded" as StoreStatus,
      data: data || [],
      error: null,
    };
  } catch (error: any) {
    return {
      status: "failed" as StoreStatus,
      data: [],
      error: error?.message || `Failed to read ${table}`,
    };
  }
}

function normalizeMemory(input: any): MemoryRecord {
  return {
    id: String(input.id || createId("memory")),
    user_message:
      input.user_message ||
      input.userMessage ||
      input.content ||
      input.message ||
      "",
    awenia_reply:
      input.awenia_reply ||
      input.aweniaReply ||
      input.reply ||
      "",
    category: input.category || "general",
    importance: clampImportance(input.importance),
    emotional_state:
      input.emotional_state ||
      input.emotionalState ||
      "neutral",
    metadata: input.metadata || {},
    created_at: input.created_at || input.createdAt || now(),
    updated_at: input.updated_at || input.updatedAt || now(),
  };
}

export async function saveMemory(
  userMessageOrInput: string | Partial<MemoryRecord>,
  aweniaReply = "Saved by Awenia memory store",
  category: MemoryCategory = "general",
  importance = 4,
  emotionalState = "neutral"
) {
  const record =
    typeof userMessageOrInput === "string"
      ? normalizeMemory({
        user_message: userMessageOrInput,
        awenia_reply: aweniaReply,
        category,
        importance,
        emotional_state: emotionalState,
      })
      : normalizeMemory(userMessageOrInput);

  runtimeMemories.unshift(record);

  const supabaseResult = await safeInsert("memories", {
    user_message: record.user_message,
    awenia_reply: record.awenia_reply,
    category: record.category,
    importance: record.importance,
    emotional_state: record.emotional_state,
    metadata: record.metadata || {},
    created_at: record.created_at,
    updated_at: record.updated_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    runtimeSaved: true,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

async function loadRecentMemories(limit = 50) {
  const supabaseResult = await safeSelect("memories", {
    limit,
    orderBy: "created_at",
  });

  const stored = (supabaseResult.data || []).map(normalizeMemory);
  const memoryKey = (record: MemoryRecord) =>
    JSON.stringify([
      record.created_at,
      record.user_message,
      record.awenia_reply,
      record.category,
    ]);
  const runtimeKeys = new Set(runtimeMemories.map(memoryKey));
  const uniqueStored = stored.filter(
    (record: MemoryRecord) => !runtimeKeys.has(memoryKey(record))
  );

  return {
    records: limitItems(sortNewest([...runtimeMemories, ...uniqueStored]), limit),
    databaseStatus: supabaseResult.status,
    databaseError: supabaseResult.error,
  };
}

export async function getRecentMemories(limit = 50) {
  return (await loadRecentMemories(limit)).records;
}

export async function searchMemories(query = "", limit = 20) {
  const memories = await getRecentMemories(200);
  const lower = normalize(query);

  if (!lower) return limitItems(memories, limit);

  return limitItems(
    memories.filter((memory) =>
      normalize(
        `${memory.user_message} ${memory.awenia_reply} ${memory.category}`
      ).includes(lower)
    ),
    limit
  );
}

export async function readLongTermMemorySources() {
  const [memoriesRead, summariesRead, goalsRead, reportsRead] = await Promise.all([
    loadRecentMemories(50),
    safeSelect("memory_summaries", { limit: 20, orderBy: "created_at" }),
    safeSelect("autonomous_goals", { limit: 20, orderBy: "created_at" }),
    safeSelect("evolution_reports", { limit: 20, orderBy: "created_at" }),
  ]);

  const makeSource = (
    data: any[],
    databaseStatus: StoreStatus,
    error?: string | null
  ) => ({
    data,
    status:
      databaseStatus === "loaded"
        ? data.length === 0 ? "empty" : "connected"
        : databaseStatus === "fallback"
          ? "fallback"
          : "failed",
    verified: databaseStatus === "loaded",
    error: error ?? null,
  });

  return {
    memories: makeSource(
      memoriesRead.records,
      memoriesRead.databaseStatus,
      memoriesRead.databaseError
    ),
    summaries: makeSource(
      limitItems(sortNewest([...runtimeSummaries, ...(summariesRead.data || [])]), 20),
      summariesRead.status,
      summariesRead.error
    ),
    goals: makeSource(
      limitItems(sortNewest([...runtimeGoals, ...(goalsRead.data || [])]), 20),
      goalsRead.status,
      goalsRead.error
    ),
    reports: makeSource(
      limitItems(sortNewest([...runtimeEvolutionReports, ...(reportsRead.data || [])]), 20),
      reportsRead.status,
      reportsRead.error
    ),
  };
}

export async function getMemoryCategoryStats(limit = 500) {
  const { records: memories, databaseStatus, databaseError } =
    await loadRecentMemories(limit);
  const stats: Record<string, number> = Object.create(null);

  for (const memory of memories) {
    const category = memory.category || "general";
    stats[category] = (stats[category] || 0) + 1;
  }

  const categories = Object.entries(stats)
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);

  return {
    ...stats,
    categories,
    _total: memories.length,
    _source: "memory-store",
    _databaseStatus: databaseStatus,
    _databaseError: databaseError,
    _timestamp: now(),
  };
}

export async function saveMemorySummary(
  topic: string,
  summary: string,
  metadata: any = {}
) {
  const record = {
    id: createId("summary"),
    topic,
    summary,
    metadata,
    created_at: now(),
  };

  runtimeSummaries.unshift(record);

  const supabaseResult = await safeInsert("memory_summaries", {
    topic,
    summary,
    metadata,
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getMemorySummaries(limit = 20) {
  const supabaseResult = await safeSelect("memory_summaries", {
    limit,
    orderBy: "created_at",
  });

  const stored = supabaseResult.data || [];
  return limitItems(sortNewest([...runtimeSummaries, ...stored]), limit);
}

export async function createMemorySummary(
  topic: string,
  summary: string,
  metadata: any = {}
) {
  return saveMemorySummary(topic, summary, metadata);
}

export async function createAutonomousReflection(
  title: string,
  content = "",
  recommendation = ""
) {
  const record = {
    id: createId("reflection"),
    title,
    content,
    recommendation,
    status: "created",
    created_at: now(),
  };

  runtimeReflections.unshift(record);

  const supabaseResult = await safeInsert("autonomous_reflections", {
    title,
    content,
    recommendation,
    status: "created",
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getAutonomousReflections(limit = 30) {
  const supabaseResult = await safeSelect("autonomous_reflections", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimeReflections, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function createEvolutionSuggestion(
  suggestionOrInput: string | any,
  reason = "",
  priority = 5
) {
  const record =
    typeof suggestionOrInput === "string"
      ? {
        id: createId("evolution"),
        suggestion: suggestionOrInput,
        reason,
        priority: clampImportance(priority),
        status: "pending",
        created_at: now(),
      }
      : {
        id: createId("evolution"),
        suggestion: suggestionOrInput.suggestion || "",
        reason: suggestionOrInput.reason || reason,
        priority: clampImportance(
          suggestionOrInput.priority || priority
        ),
        status: suggestionOrInput.status || "pending",
        metadata: suggestionOrInput.metadata || {},
        created_at: now(),
      };

  runtimeEvolutionSuggestions.unshift(record);

  const supabaseResult = await safeInsert("evolution_suggestions", {
    suggestion: record.suggestion,
    reason: record.reason,
    priority: record.priority,
    status: record.status,
    metadata: record.metadata || {},
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getEvolutionSuggestions(limit = 50) {
  const supabaseResult = await safeSelect("evolution_suggestions", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([
      ...runtimeEvolutionSuggestions,
      ...(supabaseResult.data || []),
    ]),
    limit
  );
}

export async function createEvolutionReport(
  title: string, report: any, metadata: any = {}, p0: number) {
  const record = {
    id: createId("evolution_report"),
    title,
    report,
    metadata,
    created_at: now(),
  };

  runtimeEvolutionReports.unshift(record);

  const supabaseResult = await safeInsert("evolution_reports", {
    title,
    report,
    metadata,
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getEvolutionReports(limit = 30) {
  const supabaseResult = await safeSelect("evolution_reports", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimeEvolutionReports, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function createAutonomousGoal(
  goalOrInput: string | any,
  priority = 5
) {
  const record =
    typeof goalOrInput === "string"
      ? {
        id: createId("goal"),
        goal: goalOrInput,
        priority: clampImportance(priority),
        status: "active",
        progress: 0,
        created_at: now(),
      }
      : {
        id: createId("goal"),
        goal: goalOrInput.goal || goalOrInput.title || "",
        priority: clampImportance(goalOrInput.priority || priority),
        status: goalOrInput.status || "active",
        progress: Number(goalOrInput.progress || 0),
        metadata: goalOrInput.metadata || {},
        created_at: now(),
      };

  runtimeGoals.unshift(record);

  const supabaseResult = await safeInsert("autonomous_goals", {
    goal: record.goal,
    priority: record.priority,
    status: record.status,
    progress: record.progress,
    metadata: record.metadata || {},
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getAutonomousGoals(limit = 50) {
  const supabaseResult = await safeSelect("autonomous_goals", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimeGoals, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function createAutonomousPriority(
  priority: string,
  score = 5,
  metadata: any = {}
) {
  const record = {
    id: createId("priority"),
    priority,
    score: clampImportance(score),
    status: "active",
    metadata,
    created_at: now(),
  };

  runtimePriorities.unshift(record);

  const supabaseResult = await safeInsert("autonomous_priorities", {
    priority,
    score: record.score,
    status: record.status,
    metadata,
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getAutonomousPriorities(limit = 30) {
  ensureRuntimeSeeds();

  const supabaseResult = await safeSelect("autonomous_priorities", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimePriorities, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function createLearningTask(
  taskOrInput: string | any,
  priority = 5
) {
  const record =
    typeof taskOrInput === "string"
      ? {
        id: createId("learning"),
        task: taskOrInput,
        priority: clampImportance(priority),
        status: "pending",
        created_at: now(),
      }
      : {
        id: createId("learning"),
        task: taskOrInput.task || taskOrInput.topic || "",
        priority: clampImportance(taskOrInput.priority || priority),
        status: taskOrInput.status || "pending",
        metadata: taskOrInput.metadata || {},
        created_at: now(),
      };

  runtimeLearningTasks.unshift(record);

  const supabaseResult = await safeInsert("learning_tasks", {
    task: record.task,
    priority: record.priority,
    status: record.status,
    metadata: record.metadata || {},
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getLearningTasks(limit = 50) {
  const supabaseResult = await safeSelect("learning_tasks", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimeLearningTasks, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function createPersonalityTrait(
  traitOrInput: string | any,
  score = 5,
  stable = false,
  value = ""
) {
  const record =
    typeof traitOrInput === "string"
      ? {
        id: createId("trait"),
        trait: traitOrInput,
        value,
        score: clampImportance(score),
        stable: Boolean(stable),
        created_at: now(),
      }
      : {
        id: createId("trait"),
        trait: traitOrInput.trait || traitOrInput.name || "",
        value: traitOrInput.value || traitOrInput.description || "",
        score: clampImportance(traitOrInput.score || score),
        stable: Boolean(traitOrInput.stable ?? stable),
        metadata: traitOrInput.metadata || {},
        created_at: now(),
      };

  runtimePersonalityTraits.unshift(record);

  const supabaseResult = await safeInsert("personality_traits", {
    trait: record.trait,
    value: record.value,
    score: record.score,
    stable: record.stable,
    metadata: record.metadata || {},
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getPersonalityTraits(limit = 50) {
  const supabaseResult = await safeSelect("personality_traits", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([
      ...runtimePersonalityTraits,
      ...(supabaseResult.data || []),
    ]),
    limit
  );
}

export async function saveSkillLevel(
  skill: string,
  level = 5,
  confidence = 50,
  metadata: any = {}
) {
  const record = {
    id: createId("skill"),
    skill,
    level: clampImportance(level),
    confidence: Math.max(0, Math.min(100, Number(confidence || 50))),
    metadata,
    created_at: now(),
  };

  runtimeSkillLevels.unshift(record);

  const supabaseResult = await safeInsert("skill_levels", {
    skill: record.skill,
    level: record.level,
    confidence: record.confidence,
    metadata,
    created_at: record.created_at,
  });

  return {
    status:
      supabaseResult.status === "saved"
        ? "saved"
        : "partial",
    record,
    supabase: supabaseResult,
    timestamp: now(),
  };
}

export async function getSkillLevels(limit = 50) {
  ensureRuntimeSeeds();

  const supabaseResult = await safeSelect("skill_levels", {
    limit,
    orderBy: "created_at",
  });

  return limitItems(
    sortNewest([...runtimeSkillLevels, ...(supabaseResult.data || [])]),
    limit
  );
}

export async function buildMemoryStoreContext(query = "") {
  const memories = await searchMemories(query, 10);
  const summaries = await getMemorySummaries(5);
  const goals = await getAutonomousGoals(10);
  const suggestions = await getEvolutionSuggestions(10);

  return {
    query,
    context: [
      "MEMORIES:",
      memories
        .map(
          (memory, index) =>
            `${index + 1}. [${memory.category}] ${memory.user_message}`
        )
        .join("\n") || "No memories.",
      "",
      "SUMMARIES:",
      summaries
        .map(
          (summary: any, index: number) =>
            `${index + 1}. ${summary.summary || summary.topic || ""}`
        )
        .join("\n") || "No summaries.",
      "",
      "GOALS:",
      goals
        .map(
          (goal: any, index: number) =>
            `${index + 1}. ${goal.goal || goal.title || ""}`
        )
        .join("\n") || "No goals.",
      "",
      "EVOLUTION SUGGESTIONS:",
      suggestions
        .map(
          (suggestion: any, index: number) =>
            `${index + 1}. ${suggestion.suggestion || ""}`
        )
        .join("\n") || "No suggestions.",
    ].join("\n"),
    timestamp: now(),
  };
}

export function getRuntimeMemoryStore() {
  return {
    memories: runtimeMemories,
    summaries: runtimeSummaries,
    goals: runtimeGoals,
    priorities: runtimePriorities,
    skillLevels: runtimeSkillLevels,
    evolutionSuggestions: runtimeEvolutionSuggestions,
    personalityTraits: runtimePersonalityTraits,
    reflections: runtimeReflections,
    learningTasks: runtimeLearningTasks,
    evolutionReports: runtimeEvolutionReports,
    timestamp: now(),
  };
}

export function getMemoryStoreState() {
  ensureRuntimeSeeds();

  return {
    status: "loaded",
    supabaseConfigured: isSupabaseConfigured(),
    runtimeCounts: {
      memories: runtimeMemories.length,
      summaries: runtimeSummaries.length,
      goals: runtimeGoals.length,
      priorities: runtimePriorities.length,
      skillLevels: runtimeSkillLevels.length,
      evolutionSuggestions: runtimeEvolutionSuggestions.length,
      personalityTraits: runtimePersonalityTraits.length,
      reflections: runtimeReflections.length,
      learningTasks: runtimeLearningTasks.length,
      evolutionReports: runtimeEvolutionReports.length,
    },
    truthPolicy: {
      noFakeDatabaseStatus: true,
      runtimeFallbackIsNotDatabase: true,
      databaseStatusRequiresSupabaseQuery: true,
    },
    timestamp: now(),
  };
}

export async function checkMemoryStoreHealth() {
  const memories = await safeSelect("memories", {
    limit: 1,
  });

  return {
    status:
      memories.status === "loaded"
        ? "connected"
        : isSupabaseConfigured()
          ? "failed"
          : "fallback",
    supabaseConfigured: isSupabaseConfigured(),
    memoryTable: memories.status,
    error: memories.error,
    runtimeState: getMemoryStoreState(),
    timestamp: now(),
  };
}

export async function runMemoryStore(query = "") {
  const context = await buildMemoryStoreContext(query);

  return {
    status: "loaded",
    context,
    state: getMemoryStoreState(),
    timestamp: now(),
  };
}

export const getMemories = getRecentMemories;
export const getAllMemories = getRecentMemories;
export const recallMemories = searchMemories;
export const searchMemoryStore = searchMemories;
export const saveMemoryToStore = saveMemory;

export const saveSummary = saveMemorySummary;
export const getSummaries = getMemorySummaries;

export const saveAutonomousGoal = createAutonomousGoal;
export const saveAutonomousPriority = createAutonomousPriority;
export const saveEvolutionSuggestion = createEvolutionSuggestion;
export const saveEvolutionReport = createEvolutionReport;
export const savePersonalityTrait = createPersonalityTrait;
export const saveLearningTask = createLearningTask;
export const saveAutonomousReflection = createAutonomousReflection;

export const updateSkillLevel = saveSkillLevel;
export const getReflections = getAutonomousReflections;
export const getMemoryContextFromStore = buildMemoryStoreContext;
export const memoryStore = getMemoryStoreState;

export default {
  saveMemory,
  getRecentMemories,
  searchMemories,
  getMemoryCategoryStats,
  getMemorySummaries,
  saveMemorySummary,
  createAutonomousReflection,
  getAutonomousReflections,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  createEvolutionReport,
  getEvolutionReports,
  createAutonomousGoal,
  getAutonomousGoals,
  createAutonomousPriority,
  getAutonomousPriorities,
  createLearningTask,
  getLearningTasks,
  createPersonalityTrait,
  getPersonalityTraits,
  saveSkillLevel,
  getSkillLevels,
  getMemoryStoreState,
  checkMemoryStoreHealth,
};