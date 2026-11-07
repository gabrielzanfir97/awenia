import { readLongTermMemorySources } from "./memory-store";

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
  const categories: Record<string, number> = Object.create(null);

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
  const emotions: Record<string, number> = Object.create(null);

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

  return duplicates;
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

  const failedSource = {
    data: [] as any[],
    status: "failed",
    verified: false,
    error: "Long-term memory source read failed",
  };

  const sourcesRead = await safeRead(
    () => readLongTermMemorySources(),
    {
      memories: failedSource,
      summaries: failedSource,
      goals: failedSource,
      reports: failedSource,
    }
  );

  const {
    memories: memoriesResult,
    summaries: summariesResult,
    goals: goalsResult,
    reports: reportsResult,
  } = sourcesRead.data;

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
    (status) => status === "failed" || status === "fallback"
  ).length;

  const sourcesVerified = [
    memoriesResult,
    summariesResult,
    goalsResult,
    reportsResult,
  ].every(
    (source) =>
      source.verified === true &&
      (source.status === "connected" || source.status === "empty")
  );

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

      verified: sourcesVerified,

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
        memories.length > 0 ? "records_present" : "not_observed",
      learning:
        summaries.length > 0 || reports.length > 0
          ? "learning_artifacts_present"
          : "not_verified",
      optimization:
        reports.length > 0
          ? "reports_present"
          : compressionNeeded
            ? "needed"
            : "not_verified",
      protection: "not_checked",
    },

    snapshot: {
      createdAt: new Date().toISOString(),
      countScope: "recent_sample",
      sampleLimits: {
        memories: 50,
        summaries: 20,
        goals: 20,
        reports: 20,
      },
      databaseReadsVerified: sourcesVerified,
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
        : memoryHealth === "healthy"
          ? "stable"
          : memories.length === 0
            ? "empty"
            : "partial",

    execution: {
      startedAt,
      completedAt: new Date().toISOString(),
    },

    timestamp: new Date().toISOString(),
  };
}