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

export type IntentRouterOptions = {
  execute?: boolean;
  onlyPrimary?: boolean;
  skipApprovalRequired?: boolean;
  approvedByGabi?: boolean;
  approvedBy?: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeMessage(message = "") {
  return String(message).trim().replace(/\s+/g, " ");
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;

  return Math.min(Math.max(value, min), max);
}

function normalizeRisk(risk: any) {
  const value = String(risk || "").toLowerCase();

  if (value === "low") return "low";
  if (value === "medium") return "medium";
  if (value === "high") return "high";
  if (value === "critical") return "critical";

  return "low";
}

function getPriority(intent: any) {
  return clampNumber(Number(intent?.priority ?? intent?.score ?? 5), 0, 10);
}

function getConfidence(intent: any) {
  const raw = Number(intent?.confidence ?? 0);

  if (!Number.isFinite(raw)) return 0;

  if (raw > 1) {
    return clampNumber(raw / 100, 0, 1);
  }

  return clampNumber(raw, 0, 1);
}

function getScore(intent: any) {
  const priority = getPriority(intent);
  const confidence = getConfidence(intent);

  return priority * 10 + confidence * 10;
}

function getShouldAct(intent: any) {
  return Boolean(
    intent?.shouldAct ||
    intent?.shouldCreate ||
    intent?.shouldSave ||
    intent?.shouldUpdate ||
    intent?.shouldLearn ||
    intent?.shouldRemember ||
    intent?.shouldPlan ||
    intent?.detected ||
    intent?.status === "detected" ||
    intent?.status === "needs_approval"
  );
}

function getReason(intent: any) {
  return (
    intent?.reason ||
    intent?.recommendation ||
    intent?.message ||
    "No reason provided"
  );
}

function getRequiresApproval(intent: any) {
  const risk = normalizeRisk(intent?.risk);

  return Boolean(
    intent?.requiresApproval ||
    intent?.requires_approval ||
    intent?.needsApproval ||
    intent?.status === "needs_approval" ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical"
  );
}

function getBlocked(intent: any) {
  const risk = normalizeRisk(intent?.risk);

  return Boolean(
    intent?.blocked ||
    intent?.status === "blocked" ||
    risk === "critical"
  );
}

function buildCandidate(
  name: IntentName,
  intent: any
): IntentCandidate {
  return {
    name,
    shouldAct: getShouldAct(intent),
    confidence: getConfidence(intent),
    priority: getPriority(intent),
    score: getScore(intent),
    requiresApproval: getRequiresApproval(intent),
    blocked: getBlocked(intent),
    reason: getReason(intent),
    intent,
  };
}

function sortCandidates(candidates: IntentCandidate[]) {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.confidence - a.confidence;
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

function safeAnalyze(
  name: IntentName,
  message: string,
  source: IntentSource
) {
  try {
    if (name === "learning") {
      return analyzeLearningIntent(message, source);
    }

    if (name === "memory") {
      return analyzeMemoryIntent(message, source);
    }

    if (name === "personality") {
      return analyzePersonalityIntent(message, source);
    }

    if (name === "goal") {
      return analyzeGoalIntent(message, source);
    }

    if (name === "evolution") {
      return analyzeEvolutionIntent(message, source);
    }

    return {
      shouldAct: false,
      status: "not_detected",
      reason: "Unknown intent analyzer",
    };
  } catch (error: any) {
    return {
      shouldAct: false,
      status: "failed",
      risk: "low",
      reason: error?.message || `Failed to analyze ${name} intent`,
    };
  }
}

export function analyzeIntentRouter(
  message: string,
  source: IntentSource = "user"
): IntentRouterAnalysis {
  const cleanMessage = normalizeMessage(message);

  if (!cleanMessage) {
    return {
      status: "not_detected",
      message: cleanMessage,
      source,
      detected: false,
      primaryIntent: null,
      candidates: [],
      detectedCandidates: [],
      recommendation: "Empty message. Reply normally.",
      truthPolicy: {
        noFakeIntentExecution: true,
        noClaimSavedWithoutDatabaseWrite: true,
        noHighRiskExecutionWithoutApproval: true,
      },
      timestamp: now(),
    };
  }

  const candidates = sortCandidates([
    buildCandidate(
      "learning",
      safeAnalyze("learning", cleanMessage, source)
    ),
    buildCandidate(
      "memory",
      safeAnalyze("memory", cleanMessage, source)
    ),
    buildCandidate(
      "personality",
      safeAnalyze("personality", cleanMessage, source)
    ),
    buildCandidate(
      "goal",
      safeAnalyze("goal", cleanMessage, source)
    ),
    buildCandidate(
      "evolution",
      safeAnalyze("evolution", cleanMessage, source)
    ),
  ]);

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

    candidates,

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
  source: IntentSource,
  options: IntentRouterOptions
) {
  if (candidate.blocked) {
    return {
      name: candidate.name,
      status: "blocked" as IntentRouterStatus,
      executed: false,
      reason: "Intent blocked by safety rules",
      intent: candidate.intent,
      timestamp: now(),
    };
  }

  if (candidate.requiresApproval && !options.approvedByGabi) {
    return {
      name: candidate.name,
      status: "needs_approval" as IntentRouterStatus,
      executed: false,
      reason: "Intent requires Gabi approval before execution",
      approvedByGabi: false,
      intent: candidate.intent,
      timestamp: now(),
    };
  }

  try {
    if (candidate.name === "learning") {
      const result = await runLearningIntent(message, source);

      return {
        name: candidate.name,
        status: "executed" as IntentRouterStatus,
        executed: true,
        approvedBy: options.approvedBy || null,
        result,
        timestamp: now(),
      };
    }

    if (candidate.name === "memory") {
      const result = await runMemoryIntent(message, source);

      return {
        name: candidate.name,
        status: "executed" as IntentRouterStatus,
        executed: true,
        approvedBy: options.approvedBy || null,
        result,
        timestamp: now(),
      };
    }

    if (candidate.name === "personality") {
      const result = await runPersonalityIntent(message, source);

      return {
        name: candidate.name,
        status: "executed" as IntentRouterStatus,
        executed: true,
        approvedBy: options.approvedBy || null,
        result,
        timestamp: now(),
      };
    }

    if (candidate.name === "goal") {
      const result = await runGoalIntent(message, source);

      return {
        name: candidate.name,
        status: "executed" as IntentRouterStatus,
        executed: true,
        approvedBy: options.approvedBy || null,
        result,
        timestamp: now(),
      };
    }

    if (candidate.name === "evolution") {
      const result = await runEvolutionIntent(message, source);

      return {
        name: candidate.name,
        status: "executed" as IntentRouterStatus,
        executed: true,
        approvedBy: options.approvedBy || null,
        result,
        timestamp: now(),
      };
    }

    return {
      name: candidate.name,
      status: "failed" as IntentRouterStatus,
      executed: false,
      reason: "Unknown intent candidate",
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      name: candidate.name,
      status: "failed" as IntentRouterStatus,
      executed: false,
      error: error?.message || "Unknown intent execution error",
      timestamp: now(),
    };
  }
}

function getFinalStatus(results: any[]): IntentRouterStatus {
  const failed = results.filter((item) => item.status === "failed");
  const blocked = results.filter((item) => item.status === "blocked");
  const needsApproval = results.filter(
    (item) => item.status === "needs_approval"
  );
  const executedResults = results.filter((item) => item.executed);

  if (blocked.length > 0) return "blocked";

  if (failed.length > 0 && executedResults.length > 0) {
    return "partial";
  }

  if (failed.length > 0) return "failed";

  if (needsApproval.length > 0 && executedResults.length === 0) {
    return "needs_approval";
  }

  if (needsApproval.length > 0 && executedResults.length > 0) {
    return "partial";
  }

  if (executedResults.length > 0) return "executed";

  return "detected";
}

export async function runIntentRouter(
  message: string,
  source: IntentSource = "user",
  options?: IntentRouterOptions
) {
  const startedAt = now();

  const safeOptions: IntentRouterOptions = {
    execute: options?.execute ?? false,
    onlyPrimary: options?.onlyPrimary ?? true,
    skipApprovalRequired: options?.skipApprovalRequired ?? true,
    approvedByGabi: options?.approvedByGabi ?? false,
    approvedBy: options?.approvedBy || "Gabi",
  };

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
      truthPolicy: analysis.truthPolicy,
      timestamp: now(),
    };
  }

  if (!safeOptions.execute) {
    return {
      status: analysis.status,
      analysis,
      executed: false,
      results: [],
      reason:
        "Intent router analyzed the message only. Execution is disabled by default.",
      execution: {
        startedAt,
        completedAt: now(),
      },
      truthPolicy: analysis.truthPolicy,
      timestamp: now(),
    };
  }

  const candidatesToRun =
    safeOptions.onlyPrimary && analysis.primaryIntent
      ? [analysis.primaryIntent]
      : analysis.detectedCandidates;

  const results = [];

  for (const candidate of candidatesToRun) {
    if (
      safeOptions.skipApprovalRequired &&
      candidate.requiresApproval &&
      !safeOptions.approvedByGabi
    ) {
      results.push({
        name: candidate.name,
        status: "needs_approval" as IntentRouterStatus,
        executed: false,
        reason: "Skipped because this intent requires Gabi approval",
        approvedByGabi: false,
        intent: candidate.intent,
        timestamp: now(),
      });

      continue;
    }

    results.push(
      await executeIntentCandidate(
        candidate,
        analysis.message,
        source,
        safeOptions
      )
    );
  }

  const status = getFinalStatus(results);
  const executedResults = results.filter((item: any) => item.executed);

  return {
    status,

    analysis,

    executed: executedResults.length > 0,

    results,

    execution: {
      startedAt,
      completedAt: now(),
    },

    truthPolicy: analysis.truthPolicy,

    timestamp: now(),
  };
}

function safeBuildPlan(name: IntentName, message: string) {
  try {
    if (name === "learning") return buildLearningPlan(message);
    if (name === "memory") return buildMemoryIntentPlan(message);
    if (name === "personality") return buildPersonalityPlan(message);
    if (name === "goal") return buildGoalIntentPlan(message);
    if (name === "evolution") return buildEvolutionIntentPlan(message);

    return null;
  } catch (error: any) {
    return {
      status: "failed",
      reason: error?.message || `Failed to build ${name} plan`,
      timestamp: now(),
    };
  }
}

export function buildIntentRouterPlan(message: string) {
  const analysis = analyzeIntentRouter(message);

  return {
    analysis,

    plans: {
      learning: safeBuildPlan("learning", message),
      memory: safeBuildPlan("memory", message),
      personality: safeBuildPlan("personality", message),
      goal: safeBuildPlan("goal", message),
      evolution: safeBuildPlan("evolution", message),
    },

    routing: {
      primaryIntent: analysis.primaryIntent?.name || null,
      detectedCount: analysis.detectedCandidates.length,
      recommendation: analysis.recommendation,
      executeDefault: false,
      onlyPrimaryDefault: true,
    },

    truthPolicy: {
      noFakeIntentExecution: true,
      noClaimSavedWithoutDatabaseWrite: true,
      approvalRequiredForRiskyEvolution: true,
      executionDisabledByDefault: true,
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
  return runIntentRouter(message, "user", {
    execute: false,
  });
}

export async function routeUserIntent(message: string) {
  return runIntentRouter(message, "user", {
    execute: false,
  });
}

export async function handleIntentRouter(message: string) {
  return runIntentRouter(message, "user", {
    execute: false,
  });
}

export async function handleIntentRouting(message: string) {
  return runIntentRouter(message, "user", {
    execute: false,
  });
}