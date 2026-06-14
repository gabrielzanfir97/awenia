export type DecisionPriority =
  | "debug"
  | "coding"
  | "memory"
  | "upgrade"
  | "goal"
  | "monitor";

export type DecisionRisk = "low" | "medium" | "high" | "critical";

export type DecisionUrgency = "low" | "medium" | "high" | "immediate";

export type DecisionInput = {
  errors?: number;
  memoryLoad?: number;
  pendingUpgrades?: number;
  weakSkills?: string[];
  activeGoals?: number;
  awarenessScore?: number;
  lastFailureCount?: number;
};

export type DecisionCandidate = {
  priority: DecisionPriority;
  score: number;
  action: string;
  reason: string;
  risk: DecisionRisk;
  urgency: DecisionUrgency;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getRisk(priority: DecisionPriority, score: number): DecisionRisk {
  if (priority === "debug" && score >= 200) return "critical";
  if (priority === "coding" || priority === "upgrade") return "high";
  if (priority === "memory") return score >= 80 ? "high" : "medium";
  if (priority === "goal") return "medium";
  return "low";
}

function getUrgency(priority: DecisionPriority, score: number): DecisionUrgency {
  if (priority === "debug" && score >= 200) return "immediate";
  if (score >= 100) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function buildCandidate(
  priority: DecisionPriority,
  score: number,
  action: string,
  reason: string
): DecisionCandidate {
  return {
    priority,
    score,
    action,
    reason,
    risk: getRisk(priority, score),
    urgency: getUrgency(priority, score),
  };
}

export function makeAutonomousDecision(systemState: DecisionInput) {
  const errors = systemState.errors || 0;
  const memoryLoad = clamp(systemState.memoryLoad || 0);
  const pendingUpgrades = systemState.pendingUpgrades || 0;
  const weakSkills = systemState.weakSkills || [];
  const activeGoals = systemState.activeGoals || 0;
  const awarenessScore = clamp(systemState.awarenessScore ?? 70);
  const lastFailureCount = systemState.lastFailureCount || 0;

  const scores: Record<DecisionPriority, number> = {
    debug: 0,
    coding: 0,
    memory: 0,
    upgrade: 0,
    goal: 0,
    monitor: 10,
  };

  scores.debug += errors * 100;
  scores.debug += lastFailureCount * 40;

  if (weakSkills.includes("coding")) {
    scores.coding += 90;
  }

  scores.memory += memoryLoad;

  scores.upgrade += pendingUpgrades * 18;

  scores.goal += activeGoals * 12;

  if (awarenessScore < 50) {
    scores.debug += 40;
    scores.memory += 20;
  }

  if (awarenessScore >= 75 && errors === 0 && pendingUpgrades === 0) {
    scores.monitor += 35;
  }

  const candidates: DecisionCandidate[] = [
    buildCandidate(
      "debug",
      scores.debug,
      "Run debugger workflow",
      `Detected ${errors} errors and ${lastFailureCount} recent failures`
    ),

    buildCandidate(
      "coding",
      scores.coding,
      "Improve coding ability",
      weakSkills.includes("coding")
        ? "Coding is detected as a weak skill"
        : "Coding does not require urgent improvement"
    ),

    buildCandidate(
      "memory",
      scores.memory,
      "Run memory optimization",
      `Memory load is ${memoryLoad}%`
    ),

    buildCandidate(
      "upgrade",
      scores.upgrade,
      "Review evolution suggestions",
      `${pendingUpgrades} upgrades pending`
    ),

    buildCandidate(
      "goal",
      scores.goal,
      "Continue active goals",
      `${activeGoals} active goals detected`
    ),

    buildCandidate(
      "monitor",
      scores.monitor,
      "Continue autonomous monitoring",
      "System appears stable enough for monitoring"
    ),
  ].sort((a, b) => b.score - a.score);

  const winner = candidates[0];

  const secondaryPriorities = candidates
    .slice(1)
    .filter((candidate) => candidate.score >= 40)
    .map((candidate) => ({
      priority: candidate.priority,
      score: candidate.score,
      action: candidate.action,
      reason: candidate.reason,
      risk: candidate.risk,
      urgency: candidate.urgency,
    }));

  const confidence = clamp(
    winner.score === 0
      ? 50
      : 50 + (winner.score - (candidates[1]?.score || 0)),
    20,
    100
  );

  const executionPlan = [
    {
      step: 1,
      action: "Confirm current system state",
      priority: winner.priority,
    },
    {
      step: 2,
      action: winner.action,
      priority: winner.priority,
    },
    {
      step: 3,
      action: "Save result and update awareness",
      priority: winner.priority,
    },
  ];

  return {
    priority: winner.priority,
    action: winner.action,
    reason: winner.reason,

    risk: winner.risk,
    urgency: winner.urgency,
    confidence,

    scores,

    candidates,

    secondaryPriorities,

    executionPlan,

    systemState: {
      errors,
      memoryLoad,
      pendingUpgrades,
      weakSkills,
      activeGoals,
      awarenessScore,
      lastFailureCount,
    },

    timestamp: new Date().toISOString(),
  };
}