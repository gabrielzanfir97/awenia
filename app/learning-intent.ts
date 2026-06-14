import {
  createLearningTask,
  getLearningTasks,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type LearningIntentStatus =
  | "detected"
  | "not_detected"
  | "created"
  | "duplicate"
  | "failed";

export type LearningIntent = {
  status: LearningIntentStatus;
  shouldCreate: boolean;
  topic: string;
  task: string;
  priority: number;
  confidence: number;
  reason: string;
  source: "user" | "system";
  timestamp: string;
};

const LEARNING_TRIGGERS = [
  "vreau să înveți",
  "vreau sa inveti",
  "învață",
  "invata",
  "learn this",
  "study this",
  "studiază",
  "studiaza",
  "documentează-te",
  "documenteaza-te",
  "caută și învață",
  "cauta si invata",
  "trebuie să înveți",
  "trebuie sa inveti",
];

const HIGH_PRIORITY_WORDS = [
  "awenia",
  "cod",
  "code",
  "typescript",
  "next",
  "supabase",
  "memorie",
  "memory",
  "eroare",
  "bug",
  "build",
  "important",
  "urgent",
  "autonomie",
  "internet",
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function cleanTopic(message: string) {
  let topic = message.trim();

  for (const trigger of LEARNING_TRIGGERS) {
    const regex = new RegExp(trigger, "i");
    topic = topic.replace(regex, "").trim();
  }

  topic = topic
    .replace(/^[:\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return topic || message.trim();
}

function detectPriority(message: string) {
  const lower = normalize(message);

  let priority = 5;

  for (const word of HIGH_PRIORITY_WORDS) {
    if (lower.includes(word)) {
      priority += 1;
    }
  }

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("cod") || lower.includes("code")) priority += 2;

  return Math.max(1, Math.min(10, priority));
}

function calculateConfidence(message: string, topic: string) {
  const lower = normalize(message);

  let confidence = 40;

  if (LEARNING_TRIGGERS.some((trigger) => lower.includes(trigger))) {
    confidence += 35;
  }

  if (topic.length > 8) confidence += 15;
  if (topic.length > 40) confidence += 10;

  return Math.max(0, Math.min(100, confidence));
}

export function shouldCreateLearningTask(message: string) {
  const lower = normalize(message);

  return LEARNING_TRIGGERS.some((trigger) =>
    lower.includes(trigger)
  );
}

export function extractLearningTopic(message: string) {
  return cleanTopic(message);
}

export function buildLearningTask(message: string) {
  const topic = extractLearningTopic(message);

  return `Learn and study: ${topic}`;
}

export function analyzeLearningIntent(
  message: string,
  source: "user" | "system" = "user"
): LearningIntent {
  const shouldCreate = shouldCreateLearningTask(message);
  const topic = extractLearningTopic(message);
  const priority = detectPriority(message);
  const confidence = shouldCreate
    ? calculateConfidence(message, topic)
    : 0;

  return {
    status: shouldCreate ? "detected" : "not_detected",
    shouldCreate,
    topic,
    task: buildLearningTask(message),
    priority,
    confidence,
    reason: shouldCreate
      ? "Learning trigger detected in message"
      : "No learning trigger detected",
    source,
    timestamp: now(),
  };
}

async function isDuplicateLearningTask(task: string) {
  const recentTasks = await getLearningTasks(30);
  const signature = normalize(task).slice(0, 120);

  return recentTasks.some((item: any) =>
    normalize(item.task || "").includes(signature)
  );
}

async function shouldSaveLearningSuggestion(topic: string) {
  const recent = await getEvolutionSuggestions(20);
  const signature = normalize(topic).slice(0, 80);

  return !recent.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(
      signature
    )
  );
}

export async function createLearningTaskFromIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  const intent = analyzeLearningIntent(message, source);

  if (!intent.shouldCreate) {
    return {
      status: "not_detected" as LearningIntentStatus,
      intent,
      created: false,
      duplicate: false,
      timestamp: now(),
    };
  }

  try {
    const duplicate = await isDuplicateLearningTask(intent.task);

    if (duplicate) {
      return {
        status: "duplicate" as LearningIntentStatus,
        intent,
        created: false,
        duplicate: true,
        timestamp: now(),
      };
    }

    await createLearningTask(intent.task, intent.priority);

    if (
      intent.priority >= 8 &&
      (await shouldSaveLearningSuggestion(intent.topic))
    ) {
      await createEvolutionSuggestion(
        `Learning needed: ${intent.topic}`,
        `A learning task was created from ${source} input with priority ${intent.priority}.`,
        intent.priority
      );
    }

    return {
      status: "created" as LearningIntentStatus,
      intent,
      created: true,
      duplicate: false,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as LearningIntentStatus,
      intent,
      created: false,
      duplicate: false,
      error: error?.message || "Unknown learning intent error",
      timestamp: now(),
    };
  }
}

export async function runLearningIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  return createLearningTaskFromIntent(message, source);
}

export function buildLearningPlan(message: string) {
  const intent = analyzeLearningIntent(message);

  return {
    topic: intent.topic,
    task: intent.task,
    priority: intent.priority,
    confidence: intent.confidence,
    steps: [
      {
        step: 1,
        action: "Save learning task",
        reason: "Awenia needs to remember what to study",
      },
      {
        step: 2,
        action: "Connect topic to memory and project context",
        reason: "Learning must be useful for Awenia, not random",
      },
      {
        step: 3,
        action: "Use verified internet learning only when internet is checked",
        reason: "Awenia must not invent online knowledge",
      },
      {
        step: 4,
        action: "Save result as memory or evolution suggestion",
        reason: "Learning must improve future behavior",
      },
    ],
    truthPolicy: {
      noFakeLearning: true,
      noInternetClaimWithoutFetch: true,
      learningMustBeSavedOrReported: true,
    },
    timestamp: now(),
  };
}

export function detectLearningIntent(message: string) {
  return analyzeLearningIntent(message);
}

export function shouldStudyTopic(message: string) {
  return shouldCreateLearningTask(message);
}

export function getLearningPriority(message: string) {
  return detectPriority(message);
}