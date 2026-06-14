import {
  analyzeLearningIntent,
  runLearningIntent,
  buildLearningPlan,
} from "./learning-intent";

import {
  analyzeMemoryIntent,
  runMemoryIntent,
  buildMemoryIntentPlan,
} from "./memory-intent";

import {
  analyzePersonalityIntent,
  runPersonalityIntent,
  buildPersonalityPlan,
} from "./personality-intent";

import {
  analyzeGoalIntent,
  runGoalIntent,
  buildGoalIntentPlan,
} from "./goal-intent";

import {
  analyzeEvolutionIntent,
  runEvolutionIntent,
  buildEvolutionIntentPlan,
} from "./evolution-intent";

export type IntentRouterStatus =
  | "not_detected"
  | "detected"
  | "executed"
  | "partial"
  | "needs_approval"
  | "blocked"
  | "failed";

export type IntentName =
  | "learning"
  | "memory"
  | "personality"
  | "goal"
  | "evolution";

export type IntentSource = "user" | "system";

export type IntentCandidate = {
  name: IntentName;
  shouldAct: boolean;
  confidence: number;
  priority: number;
  score: number;
  requiresApproval: boolean;
  blocked: boolean;
  reason: string;
  intent: any;
};

export type IntentRouterAnalysis = {
  status: IntentRouterStatus;
  message: string;
  source: IntentSource;
  detected: boolean;
  primaryIntent: IntentCandidate | null;
  candidates: IntentCandidate[];
  detectedCandidates: IntentCandidate[];
  recommendation: string;
  truthPolicy: {
    noFakeIntentExecution: boolean;
    noClaimSavedWithoutDatabaseWrite: boolean;
    noHighRiskExecutionWithoutApproval: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeMessage(message: string) {
  return message.trim().replace(/\s+/g, " ");
}

function getPriority(intent: any) {
  return Number(intent?.priority ?? intent?.score ?? 5);
}

function getConfidence(intent: any) {
  return Number(intent?.confidence ?? 0);
}

function getScore(intent: any) {
  const priority = getPriority(intent);
  const confidence = getConfidence(intent);

  return confidence + priority * 5;
}

function buildCandidate(
  name: IntentName,
  intent: any
): IntentCandidate {
  return {
    name,
    shouldAct: Boolean(intent?.shouldAct),
    confidence: getConfidence(intent),
    priority: getPriority(intent),
    score: getScore(intent),
    requiresApproval: Boolean(intent?.requiresApproval),
    blocked: intent?.risk === "critical" || intent?.status === "blocked",
    reason: intent?.reason || "No reason provided",
    intent,
  };
}

function sortCandidates(candidates: IntentCandidate[]) {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  });
}

function buildRecommendation(
  detectedCandidates: IntentCandidate[]
) {
  if (detectedCandidates.length === 0) {
    return "No intent detected. Reply normally.";
  }

  const blocked = detectedCandidates.filter((item) => item.blocked);
  const approval = detectedCandidates.filter(
    (item) => item.requiresApproval && !item.blocked
  );

  if (blocked.length > 0) {
    return "One or more intents are blocked. Do not execute blocked actions.";
  }

  if (approval.length > 0) {
    return "One or more intents need Gabi approval before execution.";
  }

  return "Detected intents can be processed safely.";
}

export function analyzeIntentRouter(
  message: string,
  source: IntentSource = "user"
): IntentRouterAnalysis {
  const cleanMessage = normalizeMessage(message);

  const candidates = [
    buildCandidate(
      "learning",
      analyzeLearningIntent(cleanMessage, source)
    ),
    buildCandidate(
      "memory",
      analyzeMemoryIntent(cleanMessage, source)
    ),
    buildCandidate(
      "personality",
      analyzePersonalityIntent(cleanMessage, source)
    ),
    buildCandidate(
      "goal",
      analyzeGoalIntent(cleanMessage, source)
    ),
    buildCandidate(
      "evolution",
      analyzeEvolutionIntent(cleanMessage, source)
    ),
  ];

  const detectedCandidates = sortCandidates(
    candidates.filter((candidate) => candidate.shouldAct)
  );

  const primaryIntent = detectedCandidates[0] || null;

  const blocked = detectedCandidates.some((item) => item.blocked);
  const needsApproval = detectedCandidates.some(
    (item) => item.requiresApproval
  );

  return {
    status:
      detectedCandidates.length === 0
        ? "not_detected"
        : blocked
          ? "blocked"
          : needsApproval
            ? "needs_approval"
            : "detected",

    message: cleanMessage,

    source,

    detected: detectedCandidates.length > 0,

    primaryIntent,

    candidates: sortCandidates(candidates),

    detectedCandidates,

    recommendation: buildRecommendation(detectedCandidates),

    truthPolicy: {
      noFakeIntentExecution: true,
      noClaimSavedWithoutDatabaseWrite: true,
      noHighRiskExecutionWithoutApproval: true,
    },

    timestamp: now(),
  };
}

async function executeIntentCandidate(
  candidate: IntentCandidate,
  message: string,
  source: IntentSource
) {
  if (candidate.blocked) {
    return {
      name: candidate.name,
      status: "blocked",
      executed: false,
      reason: "Intent blocked by safety rules",
      intent: candidate.intent,
      timestamp: now(),
    };
  }

  try {
    if (candidate.name === "learning") {
      return {
        name: candidate.name,
        executed: true,
        result: await runLearningIntent(message, source),
        timestamp: now(),
      };
    }

    if (candidate.name === "memory") {
      return {
        name: candidate.name,
        executed: true,
        result: await runMemoryIntent(message, source),
        timestamp: now(),
      };
    }

    if (candidate.name === "personality") {
      return {
        name: candidate.name,
        executed: true,
        result: await runPersonalityIntent(message, source),
        timestamp: now(),
      };
    }

    if (candidate.name === "goal") {
      return {
        name: candidate.name,
        executed: true,
        result: await runGoalIntent(message, source),
        timestamp: now(),
      };
    }

    if (candidate.name === "evolution") {
      return {
        name: candidate.name,
        executed: true,
        result: await runEvolutionIntent(message, source),
        timestamp: now(),
      };
    }

    return {
      name: candidate.name,
      status: "failed",
      executed: false,
      reason: "Unknown intent candidate",
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      name: candidate.name,
      status: "failed",
      executed: false,
      error: error?.message || "Unknown intent execution error",
      timestamp: now(),
    };
  }
}

export async function runIntentRouter(
  message: string,
  source: IntentSource = "user",
  options?: {
    execute?: boolean;
    onlyPrimary?: boolean;
    skipApprovalRequired?: boolean;
  }
) {
  const startedAt = now();

  const execute = options?.execute ?? true;
  const onlyPrimary = options?.onlyPrimary ?? false;
  const skipApprovalRequired = options?.skipApprovalRequired ?? true;

  const analysis = analyzeIntentRouter(message, source);

  if (!analysis.detected) {
    return {
      status: "not_detected" as IntentRouterStatus,
      analysis,
      executed: false,
      results: [],
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }

  if (!execute) {
    return {
      status: "detected" as IntentRouterStatus,
      analysis,
      executed: false,
      results: [],
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }

  const candidatesToRun = onlyPrimary && analysis.primaryIntent
    ? [analysis.primaryIntent]
    : analysis.detectedCandidates;

  const results = [];

  for (const candidate of candidatesToRun) {
    if (skipApprovalRequired && candidate.requiresApproval) {
      results.push({
        name: candidate.name,
        status: "needs_approval",
        executed: false,
        reason: "Skipped because this intent requires Gabi approval",
        intent: candidate.intent,
        timestamp: now(),
      });

      continue;
    }

    results.push(
      await executeIntentCandidate(candidate, message, source)
    );
  }

  const failed = results.filter((item: any) => item.status === "failed");
  const blocked = results.filter((item: any) => item.status === "blocked");
  const needsApproval = results.filter(
    (item: any) => item.status === "needs_approval"
  );
  const executedResults = results.filter((item: any) => item.executed);

  const status: IntentRouterStatus =
    blocked.length > 0
      ? "blocked"
      : failed.length > 0 && executedResults.length > 0
        ? "partial"
        : failed.length > 0
          ? "failed"
          : needsApproval.length > 0 && executedResults.length === 0
            ? "needs_approval"
            : executedResults.length > 0
              ? "executed"
              : "detected";

  return {
    status,

    analysis,

    executed: executedResults.length > 0,

    results,

    execution: {
      startedAt,
      completedAt: now(),
    },

    timestamp: now(),
  };
}

export function buildIntentRouterPlan(message: string) {
  const analysis = analyzeIntentRouter(message);

  return {
    analysis,

    plans: {
      learning: buildLearningPlan(message),
      memory: buildMemoryIntentPlan(message),
      personality: buildPersonalityPlan(message),
      goal: buildGoalIntentPlan(message),
      evolution: buildEvolutionIntentPlan(message),
    },

    routing: {
      primaryIntent: analysis.primaryIntent?.name || null,
      detectedCount: analysis.detectedCandidates.length,
      recommendation: analysis.recommendation,
    },

    truthPolicy: {
      noFakeIntentExecution: true,
      noClaimSavedWithoutDatabaseWrite: true,
      approvalRequiredForRiskyEvolution: true,
    },

    timestamp: now(),
  };
}

export function detectIntent(message: string) {
  return analyzeIntentRouter(message);
}

export function getPrimaryIntent(message: string) {
  return analyzeIntentRouter(message).primaryIntent;
}

export function getDetectedIntents(message: string) {
  return analyzeIntentRouter(message).detectedCandidates;
}

export async function routeIntent(message: string) {
  return runIntentRouter(message);
}

export async function routeUserIntent(message: string) {
  return runIntentRouter(message, "user");
}

export async function handleIntentRouter(message: string) {
  return runIntentRouter(message, "user");
}

export async function handleIntentRouting(message: string) {
  return runIntentRouter(message, "user");
}