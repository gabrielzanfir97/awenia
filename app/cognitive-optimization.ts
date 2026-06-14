import { buildCognitiveArchitecture } from "./cognitive-architecture";
import { adaptSystemBehavior } from "./adaptive-intelligence";
import { coordinateAgents } from "./agent-orchestrator";

export type OptimizationPriority =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type OptimizationTarget = {
  area: string;
  priority: OptimizationPriority;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  score: number;
};

function calculatePriority(score: number): OptimizationPriority {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: OptimizationTarget[],
  target: Omit<OptimizationTarget, "priority">
) {
  targets.push({
    ...target,
    priority: calculatePriority(target.score),
  });
}

function sortTargets(targets: OptimizationTarget[]) {
  return targets.sort((a, b) => b.score - a.score);
}

function getArchitectureData(architecture: any) {
  return architecture?.architecture || {};
}

function detectOptimizationTargets(architecture: any, adaptation: any) {
  const data = getArchitectureData(architecture);

  const targets: OptimizationTarget[] = [];

  const awarenessScore = data.cognitiveState?.awarenessScore || 0;
  const sourceFailures = data.cognitiveState?.sourceFailures || 0;
  const memoryLoad = data.cognitiveState?.memoryLoad || 0;
  const weakSkills = data.cognitiveState?.weakSkills || [];
  const pendingUpgrades = data.cognitiveState?.pendingUpgrades || 0;
  const activeGoals = data.cognitiveState?.activeGoals || 0;

  const memoryLayer = data.layers?.memory || {};
  const decisionLayer = data.layers?.decision || {};
  const agentsLayer = data.layers?.agents || {};

  if (sourceFailures > 0) {
    addTarget(targets, {
      area: "system_recovery",
      reason: `${sourceFailures} cognitive sources failed`,
      action: "Repair failed sources before continuing autonomy",
      risk: "critical",
      score: 100,
    });
  }

  if (awarenessScore < 60) {
    addTarget(targets, {
      area: "awareness",
      reason: `Awareness score is low: ${awarenessScore}`,
      action: "Improve awareness reliability and real system checks",
      risk: "high",
      score: 85,
    });
  }

  if (
    memoryLayer.health === "needs_compression" ||
    memoryLayer.compressionNeeded === true ||
    memoryLoad >= 70
  ) {
    addTarget(targets, {
      area: "memory",
      reason: `Memory load is ${memoryLoad}%`,
      action: "Compress, rank and clean long-term memory",
      risk: "medium",
      score: 75,
    });
  }

  if (memoryLayer.health === "degraded") {
    addTarget(targets, {
      area: "memory_repair",
      reason: "Long-term memory is degraded",
      action: "Check Supabase memory reads and memory-store functions",
      risk: "high",
      score: 90,
    });
  }

  if (weakSkills.length > 0) {
    addTarget(targets, {
      area: "skill_learning",
      reason: `Weak skills detected: ${weakSkills.join(", ")}`,
      action: "Create learning path connected to real project needs",
      risk: "medium",
      score: 65,
    });
  }

  if (pendingUpgrades > 0) {
    addTarget(targets, {
      area: "evolution",
      reason: `${pendingUpgrades} pending upgrades detected`,
      action: "Review and approve evolution suggestions",
      risk: "high",
      score: 70,
    });
  }

  if (activeGoals === 0) {
    addTarget(targets, {
      area: "goals",
      reason: "No active goals detected",
      action: "Create or activate a clear autonomous goal",
      risk: "medium",
      score: 55,
    });
  }

  if (decisionLayer.risk === "critical" || decisionLayer.urgency === "immediate") {
    addTarget(targets, {
      area: "decision_engine",
      reason: `Decision engine selected ${decisionLayer.priority} with ${decisionLayer.urgency} urgency`,
      action: decisionLayer.action || "Run critical decision workflow",
      risk: "critical",
      score: 95,
    });
  }

  if (!agentsLayer.selectedAgents || agentsLayer.selectedAgents.length === 0) {
    addTarget(targets, {
      area: "agents",
      reason: "No agents were selected for workflow planning",
      action: "Repair agent selection and orchestrator workflow",
      risk: "high",
      score: 80,
    });
  }

  if (adaptation?.primaryStrategy?.mode === "recovery") {
    addTarget(targets, {
      area: "adaptive_recovery",
      reason: adaptation.primaryStrategy.reason,
      action: adaptation.primaryStrategy.action,
      risk: "critical",
      score: 100,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "monitoring",
      reason: "No urgent optimization target detected",
      action: "Continue monitoring and avoid unnecessary heavy changes",
      risk: "low",
      score: 20,
    });
  }

  return sortTargets(targets);
}

function buildOptimizationPlan(targets: OptimizationTarget[]) {
  return targets.slice(0, 5).map((target, index) => ({
    step: index + 1,
    area: target.area,
    priority: target.priority,
    action: target.action,
    reason: target.reason,
    risk: target.risk,
  }));
}

export async function optimizeCognition() {
  const startedAt = new Date().toISOString();

  try {
    const architecture = await buildCognitiveArchitecture();

    const adaptation = await adaptSystemBehavior({
      errors:
        architecture.architecture?.cognitiveState?.sourceFailures || 0,
      lastFailureCount:
        architecture.architecture?.cognitiveState?.sourceFailures || 0,
    });

    const targets = detectOptimizationTargets(
      architecture,
      adaptation
    );

    const primaryTarget = targets[0];

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    const optimizationPlan = buildOptimizationPlan(targets);

    return {
      status:
        primaryTarget.priority === "critical"
          ? "needs_attention"
          : primaryTarget.area === "monitoring"
            ? "stable"
            : "optimization_planned",

      architecture,

      adaptation,

      optimization: {
        primaryTarget,

        targets,

        optimizationPlan,

        workflowPlan,

        recommendedAction: primaryTarget.action,

        risk: primaryTarget.risk,

        confidence:
          architecture.architecture?.confidence ||
          adaptation.decision?.confidence ||
          0,
      },

      metrics: {
        targetCount: targets.length,
        criticalTargets: targets.filter(
          (target) => target.priority === "critical"
        ).length,
        highTargets: targets.filter(
          (target) => target.priority === "high"
        ).length,
        architectureStatus:
          architecture.architecture?.status || "unknown",
        adaptationStatus: adaptation.status || "unknown",
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

      optimization: {
        primaryTarget: {
          area: "cognitive_optimization",
          priority: "critical",
          reason:
            error?.message || "Cognitive optimization failed",
          action:
            "Repair cognitive-optimization.ts or connected cognitive systems",
          risk: "critical",
          score: 100,
        },

        targets: [],

        optimizationPlan: [],

        workflowPlan: null,

        recommendedAction:
          "Repair cognitive optimization before continuing",
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error:
        error?.message || "Unknown cognitive optimization error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function runCognitiveOptimization() {
  return optimizeCognition();
}