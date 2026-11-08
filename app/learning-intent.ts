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

// Capture only explicit user-taught lessons, not every chat message or model answer.
// This is persistent retrieval memory, NOT training the model weights.
export async function learnFromChatMessage(message: string) {
  const clean = String(message || "").trim();
  const teachPattern = /^(?:awenia[,\s:]+)?(?:ține minte|tine minte|reține|retine|notează|noteaza|regula (?:este|e|mea este)|corect (?:este|e)|soluția (?:a fost|este)|solutia (?:a fost|este)|am rezolvat (?:prin|cu)|de acum (?:înainte|inainte)|pe viitor|prefer (?:să|sa))(?=\s|[,:.!?]|$)/i;

  if (clean.length < 15 || clean.length > 1600 || !teachPattern.test(clean)) {
    return { status: "not_detected", learned: false, persisted: false };
  }

  // Avoid automatic storage of apparent credentials, direct contacts and secrets.
  const sensitive = /(?:\b(?:api[_-]?key|token|password|parola|secret|service_role|private_key)\b\s*[:=]\s*\S+|sk-[a-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[^\s@]+@[^\s@]+\.[^\s@]+|\b(?:\+?\d[ -]?){11,16}\b)/i;
  if (sensitive.test(clean)) {
    return { status: "skipped_sensitive", learned: false, persisted: false };
  }

  try {
    const { getRecentMemories, saveMemory } = await import("./memory-store");
    const normalizeLesson = (value: string) =>
      value.toLocaleLowerCase("ro-RO").replace(/\s+/g, " ").trim();
    const previous = await getRecentMemories(400);
    const alreadySaved = previous.some((item: any) =>
      item.category === "learning" &&
      item.metadata?.source === "chat" &&
      normalizeLesson(String(item.user_message || "")) === normalizeLesson(clean)
    );

    if (alreadySaved) {
      return { status: "duplicate", learned: false, persisted: false };
    }

    const saved = await saveMemory({
      user_message: clean,
      awenia_reply: "Explicit user-taught lesson; treat as user statement, not independently verified fact.",
      category: "learning",
      importance: 8,
      metadata: {
        source: "chat",
        evidence: "explicit_user_statement",
        independentlyVerified: false,
        learnedAt: new Date().toISOString(),
      },
    });

    const persisted = saved.supabase?.saved === true;
    return {
      status: persisted ? "saved" : "partial",
      learned: true,
      persisted,
      error: saved.supabase?.error || null,
    };
  } catch (error: any) {
    return {
      status: "failed", learned: false, persisted: false,
      error: error?.message || "Chat learning failed",
    };
  }
}

// Bounded, keyword-based retrieval of explicit chat lessons and fetched knowledge.
// Semantic embeddings and richer conflict resolution can be added in phase two.
export async function recallRelevantLearnedKnowledge(query: string, limit = 4) {
  const normalizeWords = (value: string): string[] =>
    (value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9]{4,}/g) || []);
  const ignored = new Set([
    "awenia", "despre", "pentru", "care", "cand", "cum", "este", "sunt",
    "vreau", "spune", "poti", "poate", "acest", "aceasta", "acum",
    "invata", "invatat", "memorie", "remember", "from", "that", "what",
    "with", "your", "have", "please", "knowledge", "learning",
  ]);
  const queryWords = [...new Set(normalizeWords(String(query || "")))]
    .filter((word) => !ignored.has(word)).slice(0, 12);
  if (!queryWords.length) return { status: "no_query_terms", matches: [] };

  try {
    const { getRecentMemories } = await import("./memory-store");
    const memories = await getRecentMemories(400);
    const ranked = memories
      .filter((item: any) => item.category === "learning" &&
        ["chat", "internet"].includes(String(item.metadata?.source || "")))
      .map((item: any) => {
        const text = String(item.user_message || "");
        const terms = new Set(normalizeWords(
          text.slice(0, 5000) + " " + String(item.metadata?.topic || "")
        ));
        const score = queryWords.reduce((sum, word) =>
          sum + ([...terms].some((term) =>
            term === word || (word.length >= 5 && term.startsWith(word.slice(0, 5)))
          ) ? 1 : 0), 0);
        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(6, limit)))
      .map(({ item, score }) => ({
        text: String(item.user_message || "").slice(0, 1100),
        source: String(item.metadata?.source || "unknown"),
        independentlyVerified: item.metadata?.independentlyVerified === true,
        sourceUrls: Array.isArray(item.metadata?.sourceUrls)
          ? item.metadata.sourceUrls.slice(0, 3) : [],
        createdAt: item.created_at,
        score,
      }));

    return { status: ranked.length ? "found" : "empty", matches: ranked };
  } catch (error: any) {
    return {
      status: "failed", matches: [],
      error: error?.message || "Knowledge retrieval failed",
    };
  }
}

export function getLearningPriority(message: string) {
  return detectPriority(message);
}