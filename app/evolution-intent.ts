import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  createAutonomousReflection,
} from "./memory-store";

export type EvolutionIntentStatus =
  | "detected"
  | "not_detected"
  | "created"
  | "duplicate"
  | "needs_approval"
  | "blocked"
  | "failed";

export type EvolutionIntentType =
  | "improvement"
  | "bug_fix"
  | "optimization"
  | "self_evolution"
  | "system_upgrade"
  | "safety_rule"
  | "unknown";

export type EvolutionIntent = {
  status: EvolutionIntentStatus;
  type: EvolutionIntentType;
  shouldAct: boolean;
  suggestion: string;
  reason: string;
  priority: number;
  risk: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
  confidence: number;
  source: "user" | "system";
  timestamp: string;
};

const IMPROVEMENT_TRIGGERS = [
  "îmbunătățește",
  "imbunatateste",
  "fă mai bun",
  "fa mai bun",
  "improve",
  "make better",
  "upgradează",
  "upgradeaza",
];

const BUG_FIX_TRIGGERS = [
  "repară",
  "repara",
  "fix",
  "bug",
  "eroare",
  "nu merge",
  "problemă",
  "problema",
];

const OPTIMIZATION_TRIGGERS = [
  "optimizează",
  "optimizeaza",
  "mai rapid",
  "mai repede",
  "performance",
  "optimize",
  "slow",
  "întârzie",
  "intarzie",
];

const SELF_EVOLUTION_TRIGGERS = [
  "auto-evoluție",
  "autoevolutie",
  "auto evoluție",
  "auto evolutie",
  "să evoluezi",
  "sa evoluezi",
  "self evolution",
  "evolve yourself",
];

const SYSTEM_UPGRADE_TRIGGERS = [
  "upgrade sistem",
  "sistem nou",
  "modul nou",
  "schimbă sistemul",
  "schimba sistemul",
  "system upgrade",
  "core upgrade",
];

const SAFETY_TRIGGERS = [
  "siguranță",
  "siguranta",
  "approval",
  "aprobare",
  "protejează",
  "protejeaza",
  "security",
  "safe",
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

function detectEvolutionIntentType(message: string): EvolutionIntentType {
  if (includesAny(message, SAFETY_TRIGGERS)) return "safety_rule";
  if (includesAny(message, SELF_EVOLUTION_TRIGGERS)) return "self_evolution";
  if (includesAny(message, SYSTEM_UPGRADE_TRIGGERS)) return "system_upgrade";
  if (includesAny(message, OPTIMIZATION_TRIGGERS)) return "optimization";
  if (includesAny(message, BUG_FIX_TRIGGERS)) return "bug_fix";
  if (includesAny(message, IMPROVEMENT_TRIGGERS)) return "improvement";

  return "unknown";
}

function extractEvolutionSuggestion(message: string) {
  let suggestion = message.trim();

  const allTriggers = [
    ...IMPROVEMENT_TRIGGERS,
    ...BUG_FIX_TRIGGERS,
    ...OPTIMIZATION_TRIGGERS,
    ...SELF_EVOLUTION_TRIGGERS,
    ...SYSTEM_UPGRADE_TRIGGERS,
    ...SAFETY_TRIGGERS,
  ];

  for (const trigger of allTriggers) {
    suggestion = suggestion.replace(new RegExp(trigger, "i"), "").trim();
  }

  return suggestion.replace(/^[:\-–—]+/, "").trim() || message.trim();
}

function detectRisk(type: EvolutionIntentType, message: string) {
  const lower = normalize(message);

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("delete") ||
    lower.includes("șterge") ||
    lower.includes("sterge")
  ) {
    return "critical";
  }

  if (
    type === "self_evolution" ||
    type === "system_upgrade" ||
    lower.includes("route.ts") ||
    lower.includes("memory-store") ||
    lower.includes("supabase") ||
    lower.includes("security") ||
    lower.includes("protected-core")
  ) {
    return "high";
  }

  if (
    type === "bug_fix" ||
    type === "optimization" ||
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("build")
  ) {
    return "medium";
  }

  return "low";
}

function detectPriority(type: EvolutionIntentType, message: string) {
  const lower = normalize(message);

  let priority = 5;

  if (type === "bug_fix") priority += 2;
  if (type === "optimization") priority += 1;
  if (type === "self_evolution") priority += 3;
  if (type === "system_upgrade") priority += 3;
  if (type === "safety_rule") priority += 3;

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("build")) priority += 2;
  if (lower.includes("eroare") || lower.includes("bug")) priority += 2;

  return Math.max(1, Math.min(10, priority));
}

function calculateConfidence(type: EvolutionIntentType, suggestion: string) {
  if (type === "unknown") return 0;

  let confidence = 55;

  if (suggestion.length > 10) confidence += 15;
  if (suggestion.length > 40) confidence += 10;
  if (type === "bug_fix" || type === "optimization") confidence += 10;

  return Math.max(0, Math.min(100, confidence));
}

async function isDuplicateEvolutionSuggestion(
  suggestion: string,
  reason: string
) {
  const recent = await getEvolutionSuggestions(40);
  const signature = normalize(`${suggestion} ${reason}`).slice(0, 120);

  return recent.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(
      signature
    )
  );
}

async function createSuggestionSafely(input: {
  suggestion: string;
  reason: string;
  priority: number;
}) {
  const creator = createEvolutionSuggestion as any;

  try {
    return await creator(input.suggestion, input.reason, input.priority);
  } catch {
    try {
      return await creator({
        suggestion: input.suggestion,
        reason: input.reason,
        priority: input.priority,
        status: "pending",
      });
    } catch {
      return await creator(input.suggestion);
    }
  }
}

export function analyzeEvolutionIntent(
  message: string,
  source: "user" | "system" = "user"
): EvolutionIntent {
  const type = detectEvolutionIntentType(message);
  const suggestion = extractEvolutionSuggestion(message);
  const priority = detectPriority(type, message);
  const risk = detectRisk(type, message);
  const confidence = calculateConfidence(type, suggestion);
  const shouldAct = type !== "unknown";

  return {
    status: shouldAct ? "detected" : "not_detected",
    type,
    shouldAct,
    suggestion,
    reason: shouldAct
      ? `Evolution intent detected: ${type}`
      : "No evolution intent detected",
    priority,
    risk,
    requiresApproval:
      risk === "medium" || risk === "high" || risk === "critical",
    confidence,
    source,
    timestamp: now(),
  };
}

export async function runEvolutionIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  const intent = analyzeEvolutionIntent(message, source);

  if (!intent.shouldAct) {
    return {
      status: "not_detected" as EvolutionIntentStatus,
      intent,
      acted: false,
      timestamp: now(),
    };
  }

  if (intent.risk === "critical") {
    await createAutonomousReflection(
      "Critical evolution intent blocked",
      intent.suggestion,
      "Do not execute critical evolution actions automatically"
    );

    return {
      status: "blocked" as EvolutionIntentStatus,
      intent,
      acted: false,
      reason: "Critical evolution action blocked",
      timestamp: now(),
    };
  }

  try {
    const duplicate = await isDuplicateEvolutionSuggestion(
      intent.suggestion,
      intent.reason
    );

    if (duplicate) {
      return {
        status: "duplicate" as EvolutionIntentStatus,
        intent,
        acted: false,
        duplicate: true,
        timestamp: now(),
      };
    }

    const savedSuggestion = await createSuggestionSafely({
      suggestion: intent.suggestion,
      reason: `${intent.reason}. Source: ${source}. Risk: ${intent.risk}.`,
      priority: intent.priority,
    });

    await createAutonomousReflection(
      `Evolution intent saved: ${intent.type}`,
      intent.suggestion,
      intent.requiresApproval
        ? "Wait for Gabi approval before high-risk execution"
        : "Can be considered by autonomous runtime if safe"
    );

    return {
      status: intent.requiresApproval
        ? ("needs_approval" as EvolutionIntentStatus)
        : ("created" as EvolutionIntentStatus),
      intent,
      acted: true,
      savedSuggestion,
      approvalRequired: intent.requiresApproval,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as EvolutionIntentStatus,
      intent,
      acted: false,
      error: error?.message || "Unknown evolution intent error",
      timestamp: now(),
    };
  }
}

export function shouldCreateEvolutionSuggestion(message: string) {
  return analyzeEvolutionIntent(message).shouldAct;
}

export function shouldRequireEvolutionApproval(message: string) {
  return analyzeEvolutionIntent(message).requiresApproval;
}

export function extractEvolutionIntentSuggestion(message: string) {
  return analyzeEvolutionIntent(message).suggestion;
}

export function getEvolutionIntentPriority(message: string) {
  return analyzeEvolutionIntent(message).priority;
}

export function buildEvolutionIntentPlan(message: string) {
  const intent = analyzeEvolutionIntent(message);

  return {
    intent,

    steps: [
      {
        step: 1,
        action: "Detect evolution intent",
        reason: intent.reason,
      },
      {
        step: 2,
        action: "Check risk and approval",
        reason: "Awenia must not evolve dangerously or secretly",
      },
      {
        step: 3,
        action: "Save evolution suggestion",
        reason: "Evolution must be remembered before execution",
      },
      {
        step: 4,
        action: "Wait for Gabi approval if required",
        reason: "Important changes remain controlled by Gabi",
      },
    ],

    safety: {
      risk: intent.risk,
      requiresApproval: intent.requiresApproval,
      blockedIfCritical: true,
    },

    truthPolicy: {
      noFakeEvolution: true,
      noExecutionWithoutApproval: true,
      noClaimUpgradeDoneWithoutCodeChange: true,
      noSystemStatusClaimWithoutVerification: true,
    },

    timestamp: now(),
  };
}

export function detectEvolutionIntent(message: string) {
  return analyzeEvolutionIntent(message);
}

export async function createEvolutionSuggestionFromIntent(message: string) {
  return runEvolutionIntent(message);
}