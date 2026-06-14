import {
  getRecentMemories,
  searchMemories,
  getMemoryCategoryStats,
} from "./memory-store";

export type MemoryRankingStatus =
  | "ranked"
  | "loaded"
  | "searched"
  | "empty"
  | "failed";

export type MemoryRankingReason = {
  type:
  | "query_match"
  | "category_match"
  | "importance"
  | "recency"
  | "emotional"
  | "creator"
  | "project"
  | "code"
  | "fallback";
  points: number;
  note: string;
};

export type RankedMemory = {
  memory: any;
  score: number;
  relevance: number;
  importance: number;
  recency: number;
  reasons: MemoryRankingReason[];
};

export type MemoryRankingOptions = {
  query?: string;
  category?: string;
  limit?: number;
  includeLowScore?: boolean;
  minScore?: number;
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getMemoryText(memory: any) {
  return [
    memory?.user_message,
    memory?.awenia_reply,
    memory?.content,
    memory?.message,
    memory?.summary,
    memory?.category,
    memory?.emotional_state,
  ]
    .filter(Boolean)
    .join(" ");
}

function getImportance(memory: any) {
  return clamp(Number(memory?.importance || 4) * 10, 0, 100);
}

function getCreatedAt(memory: any) {
  return (
    memory?.created_at ||
    memory?.createdAt ||
    memory?.timestamp ||
    memory?.updated_at ||
    ""
  );
}

function calculateRecency(memory: any) {
  const createdAt = getCreatedAt(memory);

  if (!createdAt) return 30;

  const time = new Date(createdAt).getTime();

  if (Number.isNaN(time)) return 30;

  const ageMs = Date.now() - time;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) return 100;
  if (ageDays <= 7) return 85;
  if (ageDays <= 30) return 70;
  if (ageDays <= 90) return 55;
  if (ageDays <= 180) return 40;

  return 25;
}

function calculateQueryMatch(memory: any, query = "") {
  const cleanQuery = normalize(query);

  if (!cleanQuery) return 0;

  const text = normalize(getMemoryText(memory));

  if (!text) return 0;

  let score = 0;

  if (text.includes(cleanQuery)) {
    score += 50;
  }

  const words = cleanQuery
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  for (const word of words) {
    if (text.includes(word)) {
      score += 8;
    }
  }

  return clamp(score, 0, 100);
}

function calculateCategoryMatch(memory: any, category = "") {
  if (!category) return 0;

  const memoryCategory = normalize(memory?.category || "");
  const wantedCategory = normalize(category);

  if (!memoryCategory || !wantedCategory) return 0;

  return memoryCategory === wantedCategory ? 100 : 0;
}

function calculateEmotionalScore(memory: any) {
  const emotional = normalize(memory?.emotional_state || "");

  if (!emotional) return 0;

  if (
    emotional.includes("important") ||
    emotional.includes("love") ||
    emotional.includes("iubire") ||
    emotional.includes("fear") ||
    emotional.includes("frică") ||
    emotional.includes("frica")
  ) {
    return 80;
  }

  if (
    emotional.includes("happy") ||
    emotional.includes("sad") ||
    emotional.includes("focused") ||
    emotional.includes("stable")
  ) {
    return 50;
  }

  return 20;
}

function calculateSpecialMemoryBoost(memory: any) {
  const text = normalize(getMemoryText(memory));
  const category = normalize(memory?.category || "");

  let boost = 0;
  const reasons: MemoryRankingReason[] = [];

  if (
    text.includes("gabi") ||
    category === "gabi" ||
    text.includes("creator")
  ) {
    boost += 20;
    reasons.push({
      type: "creator",
      points: 20,
      note: "Memorie legată de Gabi/creator.",
    });
  }

  if (
    text.includes("awenia") ||
    category === "awenia" ||
    text.includes("lumina eterna")
  ) {
    boost += 18;
    reasons.push({
      type: "project",
      points: 18,
      note: "Memorie legată de Awenia.",
    });
  }

  if (
    category === "code" ||
    text.includes(".ts") ||
    text.includes(".tsx") ||
    text.includes("route.ts") ||
    text.includes("build")
  ) {
    boost += 15;
    reasons.push({
      type: "code",
      points: 15,
      note: "Memorie legată de cod/proiect.",
    });
  }

  return {
    boost,
    reasons,
  };
}

export function scoreMemory(
  memory: any,
  options: MemoryRankingOptions = {}
): RankedMemory {
  const reasons: MemoryRankingReason[] = [];

  const queryMatch = calculateQueryMatch(memory, options.query);
  const categoryMatch = calculateCategoryMatch(memory, options.category);
  const importance = getImportance(memory);
  const recency = calculateRecency(memory);
  const emotional = calculateEmotionalScore(memory);
  const special = calculateSpecialMemoryBoost(memory);

  if (queryMatch > 0) {
    reasons.push({
      type: "query_match",
      points: queryMatch,
      note: "Memoria se potrivește cu întrebarea.",
    });
  }

  if (categoryMatch > 0) {
    reasons.push({
      type: "category_match",
      points: categoryMatch,
      note: "Categoria memoriei se potrivește.",
    });
  }

  if (importance > 0) {
    reasons.push({
      type: "importance",
      points: importance,
      note: "Scor bazat pe importanța salvată.",
    });
  }

  if (recency > 0) {
    reasons.push({
      type: "recency",
      points: recency,
      note: "Scor bazat pe cât de recentă este memoria.",
    });
  }

  if (emotional > 0) {
    reasons.push({
      type: "emotional",
      points: emotional,
      note: "Memorie cu valoare emoțională.",
    });
  }

  reasons.push(...special.reasons);

  const relevance = clamp(
    queryMatch * 0.45 +
    categoryMatch * 0.2 +
    importance * 0.2 +
    recency * 0.1 +
    emotional * 0.05 +
    special.boost
  );

  const score = Math.round(relevance);

  if (reasons.length === 0) {
    reasons.push({
      type: "fallback",
      points: score,
      note: "Scor minim calculat fără potrivire clară.",
    });
  }

  return {
    memory,
    score,
    relevance,
    importance,
    recency,
    reasons,
  };
}

export function rankMemoryList(
  memories: any[],
  options: MemoryRankingOptions = {}
) {
  const minScore = options.minScore ?? 1;

  const ranked = memories
    .map((memory) => scoreMemory(memory, options))
    .filter((item) => {
      if (options.includeLowScore) return true;
      return item.score >= minScore;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit || 20);

  return {
    status: ranked.length > 0 ? "ranked" : "empty",
    query: options.query || "",
    category: options.category || "",
    results: ranked,
    count: ranked.length,
    timestamp: now(),
  };
}

export async function rankMemories(
  options: MemoryRankingOptions = {}
) {
  try {
    const memories = options.query
      ? await searchMemories(options.query, 100)
      : await getRecentMemories(100);

    return rankMemoryList(memories, options);
  } catch (error: any) {
    return {
      status: "failed" as MemoryRankingStatus,
      query: options.query || "",
      category: options.category || "",
      results: [],
      count: 0,
      error: error?.message || "Failed to rank memories",
      timestamp: now(),
    };
  }
}

export async function getRankedMemories(
  query = "",
  limit = 10
) {
  return rankMemories({
    query,
    limit,
  });
}

export async function getRelevantMemories(
  query = "",
  limit = 10
) {
  return rankMemories({
    query,
    limit,
    minScore: 10,
  });
}

export async function getImportantMemories(limit = 10) {
  const memories = await getRecentMemories(200);

  return rankMemoryList(memories, {
    limit,
    includeLowScore: true,
  });
}

export async function getRankedMemoriesByCategory(
  category: string,
  limit = 10
) {
  const memories = await getRecentMemories(200);

  return rankMemoryList(memories, {
    category,
    limit,
  });
}

export function buildRankedMemoryContextFromResults(
  ranked: RankedMemory[]
) {
  if (!ranked.length) {
    return "Nu există memorii relevante pentru această cerere.";
  }

  return ranked
    .map((item, index) => {
      const memory = item.memory;

      return [
        `${index + 1}. [score ${item.score}] [${memory?.category || "general"
        }]`,
        `User: ${memory?.user_message || memory?.content || ""}`,
        memory?.awenia_reply ? `Awenia: ${memory.awenia_reply}` : "",
        `Reason: ${item.reasons
          .slice(0, 3)
          .map((reason) => reason.note)
          .join(" ")}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export async function buildRankedMemoryContext(
  query = "",
  limit = 8
) {
  const ranked = await getRelevantMemories(query, limit);

  return {
    status: ranked.status,
    query,
    context: buildRankedMemoryContextFromResults(ranked.results),
    results: ranked.results,
    timestamp: now(),
  };
}

export async function selectRelevantMemories(
  query = "",
  limit = 8
) {
  const ranked = await getRelevantMemories(query, limit);

  return ranked.results.map((item) => item.memory);
}

export async function analyzeMemoryRanking(query = "") {
  const ranked = await rankMemories({
    query,
    limit: 20,
  });

  const stats = await getMemoryCategoryStats();

  return {
    status: ranked.status,
    query,
    ranked,
    categoryStats: stats,
    recommendation:
      ranked.count > 0
        ? "Folosește primele memorii cu scor mare ca context."
        : "Nu există memorii relevante; nu inventa context.",
    truthPolicy: {
      rankingIsApproximate: true,
      noFakeMemoryRecall: true,
      runtimeRankingDoesNotProveDatabaseWrite: true,
    },
    timestamp: now(),
  };
}

export function rerankMemoryResults(
  memories: any[],
  query = "",
  limit = 10
) {
  return rankMemoryList(memories, {
    query,
    limit,
  });
}

export function sortMemoriesByImportance(memories: any[]) {
  return [...memories].sort(
    (a, b) => Number(b?.importance || 0) - Number(a?.importance || 0)
  );
}

export function sortMemoriesByRecency(memories: any[]) {
  return [...memories].sort((a, b) => {
    const timeA = new Date(getCreatedAt(a) || 0).getTime();
    const timeB = new Date(getCreatedAt(b) || 0).getTime();

    return timeB - timeA;
  });
}

export function calculateMemoryScore(
  memory: any,
  query = ""
) {
  return scoreMemory(memory, {
    query,
  }).score;
}

export async function runMemoryRanking(query = "") {
  if (!query.trim()) {
    return getImportantMemories(20);
  }

  return analyzeMemoryRanking(query);
}

export const rankMemory = scoreMemory;
export const rankMemoryResults = rankMemoryList;
export const getMemoryRanking = rankMemories;
export const buildMemoryRankingContext = buildRankedMemoryContext;
export const memoryRanking = runMemoryRanking;

export default runMemoryRanking;