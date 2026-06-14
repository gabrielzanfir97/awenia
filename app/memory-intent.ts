import {
  getRecentMemories,
  getMemorySummaries,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  saveMemory,
} from "./memory-store";

export type MemoryIntentStatus =
  | "detected"
  | "not_detected"
  | "created"
  | "duplicate"
  | "needs_attention"
  | "failed";

export type MemoryIntentType =
  | "summary"
  | "compress"
  | "remember"
  | "recall"
  | "cleanup"
  | "unknown";

export type MemoryIntent = {
  status: MemoryIntentStatus;
  type: MemoryIntentType;
  shouldAct: boolean;
  topic: string;
  priority: number;
  confidence: number;
  reason: string;
  source: "user" | "system";
  timestamp: string;
};

const SUMMARY_TRIGGERS = [
  "rezumă memoria",
  "rezuma memoria",
  "fă rezumat",
  "fa rezumat",
  "sumarizează",
  "sumarizeaza",
  "memory summary",
  "summarize memory",
];

const COMPRESS_TRIGGERS = [
  "comprimă memoria",
  "comprima memoria",
  "curăță memoria",
  "curata memoria",
  "optimizează memoria",
  "optimizeaza memoria",
  "compress memory",
  "clean memory",
];

const REMEMBER_TRIGGERS = [
  "ține minte",
  "tine minte",
  "salvează asta",
  "salveaza asta",
  "remember this",
  "save this memory",
];

const RECALL_TRIGGERS = [
  "ce îți amintești",
  "ce iti amintesti",
  "amintește-ți",
  "aminteste-ti",
  "what do you remember",
  "recall memory",
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function includesAny(message: string, triggers: string[]) {
  const lower = normalize(message);
  return triggers.some((trigger) => lower.includes(trigger));
}

function detectMemoryIntentType(message: string): MemoryIntentType {
  if (includesAny(message, SUMMARY_TRIGGERS)) return "summary";
  if (includesAny(message, COMPRESS_TRIGGERS)) return "compress";
  if (includesAny(message, REMEMBER_TRIGGERS)) return "remember";
  if (includesAny(message, RECALL_TRIGGERS)) return "recall";

  return "unknown";
}

function extractMemoryTopic(message: string) {
  let topic = message.trim();

  const allTriggers = [
    ...SUMMARY_TRIGGERS,
    ...COMPRESS_TRIGGERS,
    ...REMEMBER_TRIGGERS,
    ...RECALL_TRIGGERS,
  ];

  for (const trigger of allTriggers) {
    topic = topic.replace(new RegExp(trigger, "i"), "").trim();
  }

  return topic.replace(/^[:\-–—]+/, "").trim() || "general memory";
}

function calculatePriority(type: MemoryIntentType, message: string) {
  const lower = normalize(message);

  let priority = 5;

  if (type === "remember") priority += 2;
  if (type === "compress") priority += 2;
  if (type === "summary") priority += 1;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("important") || lower.includes("urgent")) priority += 2;
  if (lower.includes("cod") || lower.includes("code")) priority += 1;

  return Math.max(1, Math.min(10, priority));
}

function calculateConfidence(type: MemoryIntentType, topic: string) {
  if (type === "unknown") return 0;

  let confidence = 60;

  if (topic.length > 10) confidence += 15;
  if (topic.length > 40) confidence += 10;

  return Math.max(0, Math.min(100, confidence));
}

export function analyzeMemoryIntent(
  message: string,
  source: "user" | "system" = "user"
): MemoryIntent {
  const type = detectMemoryIntentType(message);
  const topic = extractMemoryTopic(message);
  const shouldAct = type !== "unknown";

  return {
    status: shouldAct ? "detected" : "not_detected",
    type,
    shouldAct,
    topic,
    priority: calculatePriority(type, message),
    confidence: calculateConfidence(type, topic),
    reason: shouldAct
      ? `Memory intent detected: ${type}`
      : "No memory intent detected",
    source,
    timestamp: now(),
  };
}

async function shouldSaveMemorySuggestion(topic: string, action: string) {
  const recent = await getEvolutionSuggestions(20);
  const signature = `${topic} ${action}`.toLowerCase().slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

async function isDuplicateSummary(topic: string) {
  const summaries = await getMemorySummaries(30);
  const signature = normalize(topic).slice(0, 80);

  return summaries.some((summary: any) =>
    normalize(`${summary.summary || ""} ${summary.topic || ""}`).includes(
      signature
    )
  );
}

function buildMemorySummary(memories: any[], topic: string) {
  const selected = memories.slice(0, 20);

  if (selected.length === 0) {
    return `No recent memories found for topic: ${topic}`;
  }

  return selected
    .map((memory: any, index: number) => {
      const userMessage = memory.user_message || "";
      const category = memory.category || "general";
      const importance = memory.importance || 3;

      return `${index + 1}. [${category}, importance ${importance}] ${userMessage}`;
    })
    .join("\n");
}

export async function runMemoryIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  const intent = analyzeMemoryIntent(message, source);

  if (!intent.shouldAct) {
    return {
      status: "not_detected" as MemoryIntentStatus,
      intent,
      acted: false,
      timestamp: now(),
    };
  }

  try {
    if (intent.type === "remember") {
      await saveMemory(
        intent.topic,
        "Saved by memory intent system",
        "general" as any,
        intent.priority
      );

      return {
        status: "created" as MemoryIntentStatus,
        intent,
        acted: true,
        action: "memory_saved",
        timestamp: now(),
      };
    }

    if (intent.type === "summary" || intent.type === "compress") {
      const duplicate = await isDuplicateSummary(intent.topic);

      if (duplicate) {
        return {
          status: "duplicate" as MemoryIntentStatus,
          intent,
          acted: false,
          duplicate: true,
          timestamp: now(),
        };
      }

      const recentMemories = await getRecentMemories(50);
      const summary = buildMemorySummary(recentMemories, intent.topic);

      await saveMemory(
        `Memory ${intent.type}: ${intent.topic}`,
        summary,
        "general" as any,
        intent.priority
      );

      if (
        intent.priority >= 7 &&
        (await shouldSaveMemorySuggestion(
          intent.topic,
          `Improve memory ${intent.type}`
        ))
      ) {
        await createEvolutionSuggestion(
          `Memory ${intent.type} needed: ${intent.topic}`,
          `Memory intent detected ${intent.type} with priority ${intent.priority}.`,
          intent.priority
        );
      }

      return {
        status: "created" as MemoryIntentStatus,
        intent,
        acted: true,
        action: `memory_${intent.type}_created`,
        summary,
        memoryCount: recentMemories.length,
        timestamp: now(),
      };
    }

    if (intent.type === "recall") {
      const recentMemories = await getRecentMemories(20);

      return {
        status: "created" as MemoryIntentStatus,
        intent,
        acted: true,
        action: "memory_recalled",
        memories: recentMemories,
        timestamp: now(),
      };
    }

    return {
      status: "needs_attention" as MemoryIntentStatus,
      intent,
      acted: false,
      reason: "Memory intent type is not executable yet",
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as MemoryIntentStatus,
      intent,
      acted: false,
      error: error?.message || "Unknown memory intent error",
      timestamp: now(),
    };
  }
}

export function shouldCreateMemorySummary(message: string) {
  const intent = analyzeMemoryIntent(message);
  return intent.type === "summary" || intent.type === "compress";
}

export function shouldSaveMemoryFromMessage(message: string) {
  const intent = analyzeMemoryIntent(message);
  return intent.type === "remember";
}

export function shouldRecallMemory(message: string) {
  const intent = analyzeMemoryIntent(message);
  return intent.type === "recall";
}

export function buildMemoryIntentPlan(message: string) {
  const intent = analyzeMemoryIntent(message);

  return {
    intent,
    steps: [
      {
        step: 1,
        action: "Detect memory intent",
        reason: intent.reason,
      },
      {
        step: 2,
        action: "Read recent memory before acting",
        reason: "Memory actions must use real stored memories",
      },
      {
        step: 3,
        action: "Save result or return recall result",
        reason: "Memory work must become useful for future context",
      },
      {
        step: 4,
        action: "Avoid duplicates",
        reason: "Memory must not be filled with repeated summaries",
      },
    ],
    truthPolicy: {
      noFakeMemoryStatus: true,
      noClaimMemorySavedWithoutDatabaseWrite: true,
      noClaimRecallWithoutReadingMemory: true,
    },
    timestamp: now(),
  };
}

export function detectMemoryIntent(message: string) {
  return analyzeMemoryIntent(message);
}

export function getMemoryIntentType(message: string) {
  return analyzeMemoryIntent(message).type;
}

export async function createMemorySummaryFromIntent(message: string) {
  return runMemoryIntent(message);
}