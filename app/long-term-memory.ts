import {
  getRecentMemories,
  getMemorySummaries,
  getAutonomousGoals,
  getEvolutionReports,
} from "./memory-store";

type MemoryReadStatus = "connected" | "empty" | "failed";

async function safeRead<T>(
  reader: () => Promise<T>,
  fallback: T
): Promise<{
  data: T;
  status: MemoryReadStatus;
  error?: string;
}> {
  try {
    const data = await reader();
    const isEmptyArray = Array.isArray(data) && data.length === 0;

    return {
      data,
      status: isEmptyArray ? "empty" : "connected",
    };
  } catch (error: any) {
    return {
      data: fallback,
      status: "failed",
      error: error?.message || "Unknown long-term memory error",
    };
  }
}

function countByCategory(memories: any[]) {
  const categories: Record<string, number> = {};

  for (const memory of memories) {
    const category = memory.category || "general";
    categories[category] = (categories[category] || 0) + 1;
  }

  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
    }));
}

function countByEmotion(memories: any[]) {
  const emotions: Record<string, number> = {};

  for (const memory of memories) {
    const emotion = memory.emotional_state || "neutral";
    emotions[emotion] = (emotions[emotion] || 0) + 1;
  }

  return Object.entries(emotions)
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, count]) => ({
      emotion,
      count,
    }));
}

function detectPossibleDuplicates(memories: any[]) {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const memory of memories) {
    const normalized = `${memory.user_message || ""}`
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

    if (!normalized) continue;

    if (seen.has(normalized)) {
      duplicates.push(normalized.slice(0, 120));
    }

    seen.add(normalized);
  }

  return duplicates.slice(0, 10);
}

function calculateMemoryHealth(input: {
  memories: any[];
  summaries: any[];
  reports: any[];
  readFailures: number;
  duplicateCount: number;
}) {
  if (input.readFailures > 0) {
    return "degraded";
  }

  if (input.memories.length === 0) {
    return "empty";
  }

  if (input.memories.length > 30 && input.summaries.length === 0) {
    return "needs_compression";
  }

  if (input.duplicateCount > 5) {
    return "needs_cleanup";
  }

  if (input.summaries.length > 0 && input.reports.length > 0) {
    return "healthy";
  }

  return "partial";
}

function buildMemoryTimeline(memories: any[]) {
  return memories
    .filter((memory) => memory.created_at)
    .slice(0, 10)
    .map((memory) => ({
      createdAt: memory.created_at,
      category: memory.category || "general",
      importance: memory.importance || 3,
      preview: `${memory.user_message || ""}`.slice(0, 120),
    }));
}

export async function buildLongTermMemory() {
  const startedAt = new Date().toISOString();

  const memoriesResult = await safeRead(
    () => getRecentMemories(50),
    []
  );

  const summariesResult = await safeRead(
    () => getMemorySummaries(20),
    []
  );

  const goalsResult = await safeRead(
    () => getAutonomousGoals(20),
    []
  );

  const reportsResult = await safeRead(
    () => getEvolutionReports(20),
    []
  );

  const memories: any[] = memoriesResult.data;
  const summaries: any[] = summariesResult.data;
  const goals: any[] = goalsResult.data;
  const reports: any[] = reportsResult.data;

  const readStatuses = {
    memories: memoriesResult.status,
    summaries: summariesResult.status,
    goals: goalsResult.status,
    reports: reportsResult.status,
  };

  const readErrors = [
    memoriesResult.error,
    summariesResult.error,
    goalsResult.error,
    reportsResult.error,
  ].filter(Boolean);

  const readFailures = Object.values(readStatuses).filter(
    (status) => status === "failed"
  ).length;

  const dominantMemoryAreas = countByCategory(memories).slice(0, 5);
  const emotionalMemoryMap = countByEmotion(memories).slice(0, 5);
  const possibleDuplicates = detectPossibleDuplicates(memories);

  const activeGoals = goals.filter(
    (goal: any) => goal.status === "active"
  );

  const criticalMemories = memories.filter(
    (memory: any) => (memory.importance || 0) >= 8
  );

  const memoryHealth = calculateMemoryHealth({
    memories,
    summaries,
    reports,
    readFailures,
    duplicateCount: possibleDuplicates.length,
  });

  const strongestArea =
    dominantMemoryAreas[0]?.category || "none";

  const recommendedFocus =
    memoryHealth === "needs_compression"
      ? "memory_compression"
      : memoryHealth === "needs_cleanup"
        ? "duplicate_cleanup"
        : strongestArea !== "none"
          ? strongestArea
          : "general";

  const compressionNeeded =
    memories.length > 30 && summaries.length < Math.ceil(memories.length / 25);

  return {
    memory: {
      conversations: memories.length,
      summaries: summaries.length,
      goals: goals.length,
      activeGoals: activeGoals.length,
      evolutionReports: reports.length,
      criticalMemories: criticalMemories.length,
    },

    memoryAnalysis: {
      memoryHealth,

      verified: readFailures === 0,

      readStatuses,

      readErrors,

      dominantMemoryAreas,

      emotionalMemoryMap,

      activeGoals: activeGoals.length,

      strongestArea,

      recommendedFocus,

      compressionNeeded,

      duplicateCount: possibleDuplicates.length,

      possibleDuplicates,

      memoryTimeline: buildMemoryTimeline(memories),
    },

    continuity: {
      identity:
        criticalMemories.length > 0 || memories.length > 0
          ? "persistent"
          : "weak",

      learning:
        summaries.length > 0 || reports.length > 0
          ? "continuous"
          : memories.length > 0
            ? "starting"
            : "inactive",

      optimization:
        reports.length > 0
          ? "active"
          : compressionNeeded
            ? "needed"
            : "idle",

      protection:
        readFailures === 0 && criticalMemories.length > 0
          ? "stable"
          : readFailures === 0
            ? "partial"
            : "degraded",
    },

    snapshot: {
      createdAt: new Date().toISOString(),
      memoryHealth,
      strongestArea,
      recommendedFocus,
      totalMemories: memories.length,
      totalSummaries: summaries.length,
      totalGoals: goals.length,
      totalReports: reports.length,
      compressionNeeded,
      duplicateCount: possibleDuplicates.length,
    },

    status:
      readFailures > 0
        ? "degraded"
        : memories.length > 0
          ? "stable"
          : "empty",

    execution: {
      startedAt,
      completedAt: new Date().toISOString(),
    },

    timestamp: new Date().toISOString(),
  };
}