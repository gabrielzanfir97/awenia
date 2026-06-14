import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";

export type AdaptiveMode =
  | "recovery"
  | "debugging"
  | "coding"
  | "memory"
  | "upgrade"
  | "goal"
  | "learning"
  | "monitoring";

export type AdaptiveStrategy = {
  mode: AdaptiveMode;
  priority: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
};

function addStrategy(
  strategies: AdaptiveStrategy[],
  strategy: AdaptiveStrategy
) {
  const exists = strategies.some((item) => item.mode === strategy.mode);

  if (!exists) {
    strategies.push(strategy);
  }
}

function calculateMemoryLoad(memory: any) {
  const conversations = memory?.memory?.conversations || 0;
  const summaries = memory?.memory?.summaries || 0;

  if (conversations === 0) return 0;

  return Math.max(
    0,
    Math.min(100, Math.round((conversations - summaries * 10) / 5))
  );
}

export async function adaptSystemBehavior(systemState: any = {}) {
  const startedAt = new Date().toISOString();

  try {
    const awareness = await buildAwarenessState();
    const memory = await buildLongTermMemory();
    const goals = await manageAutonomousGoals();

    const awarenessScore = awareness.awareness?.awarenessScore || 0;
    const sourceFailures = awareness.awareness?.metrics?.sourceFailures || 0;
    const weakSkills = awareness.awareness?.weakSkills || [];
    const pendingUpgrades =
      awareness.awareness?.pendingUpgrades?.length || 0;
    const activeGoals =
      goals.goalAnalysis?.totalActiveGoals ||
      awareness.awareness?.activeGoals?.length ||
      0;

    const memoryLoad = calculateMemoryLoad(memory);

    const decision = makeAutonomousDecision({
      errors: systemState.errors || sourceFailures,
      memoryLoad,
      pendingUpgrades,
      weakSkills,
      activeGoals,
      awarenessScore,
      lastFailureCount: systemState.lastFailureCount || sourceFailures,
    });

    const strategies: AdaptiveStrategy[] = [];

    if (sourceFailures > 0 || awarenessScore < 45) {
      addStrategy(strategies, {
        mode: "recovery",
        priority: 10,
        reason: "System has failed sources or low awareness score",
        action: "Stabilize awareness, memory and runtime before autonomy",
        risk: "critical",
      });
    }

    if (decision.priority === "debug") {
      addStrategy(strategies, {
        mode: "debugging",
        priority: 9,
        reason: decision.reason,
        action: decision.action,
        risk: decision.risk,
      });
    }

    if (weakSkills.includes("coding") || decision.priority === "coding") {
      addStrategy(strategies, {
        mode: "coding",
        priority: 8,
        reason: "Coding ability needs improvement",
        action: "Use project files and code memory for safer code changes",
        risk: "high",
      });
    }

    if (
      memoryLoad >= 70 ||
      memory.memoryAnalysis?.compressionNeeded === true ||
      decision.priority === "memory"
    ) {
      addStrategy(strategies, {
        mode: "memory",
        priority: 7,
        reason: `Memory load is ${memoryLoad}%`,
        action: "Compress, rank and clean long-term memory",
        risk: "medium",
      });
    }

    if (pendingUpgrades > 0 || decision.priority === "upgrade") {
      addStrategy(strategies, {
        mode: "upgrade",
        priority: 7,
        reason: `${pendingUpgrades} pending upgrades detected`,
        action: "Review evolution suggestions before applying changes",
        risk: "high",
      });
    }

    if (activeGoals > 0 || decision.priority === "goal") {
      addStrategy(strategies, {
        mode: "goal",
        priority: 6,
        reason: `${activeGoals} active goals detected`,
        action: goals.nextAction || "Continue active autonomous goal",
        risk: "medium",
      });
    }

    if (weakSkills.length > 0) {
      addStrategy(strategies, {
        mode: "learning",
        priority: 6,
        reason: `Weak skills detected: ${weakSkills.join(", ")}`,
        action: "Create learning path connected to real project needs",
        risk: "medium",
      });
    }

    if (strategies.length === 0) {
      addStrategy(strategies, {
        mode: "monitoring",
        priority: 3,
        reason: "System appears stable",
        action: "Continue monitoring without heavy changes",
        risk: "low",
      });
    }

    const sortedStrategies = strategies.sort(
      (a, b) => b.priority - a.priority
    );

    const primaryStrategy = sortedStrategies[0];

    const workflowPlan = coordinateAgents(
      decision.priority,
      `${primaryStrategy.action}. Reason: ${primaryStrategy.reason}`
    );

    return {
      status:
        primaryStrategy.mode === "recovery"
          ? "needs_attention"
          : "adapted",

      primaryStrategy,

      strategies: sortedStrategies,

      decision,

      awareness,

      memory,

      goals,

      workflowPlan,

      adaptation: {
        mode: primaryStrategy.mode,
        action: primaryStrategy.action,
        risk: primaryStrategy.risk,
        confidence: decision.confidence,
        awarenessScore,
        memoryLoad,
        sourceFailures,
        weakSkills,
        pendingUpgrades,
        activeGoals,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "failed",

      primaryStrategy: {
        mode: "recovery",
        priority: 10,
        reason: error?.message || "Adaptive intelligence failed",
        action: "Repair adaptive-intelligence.ts and connected systems",
        risk: "critical",
      },

      strategies: [],

      adaptation: {
        mode: "recovery",
        action: "Repair adaptive intelligence",
        risk: "critical",
        confidence: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown adaptive intelligence error",

      timestamp: new Date().toISOString(),
    };
  }
}