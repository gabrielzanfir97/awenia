import { runSuperIntelligenceFramework } from "./super-intelligence";
import { optimizeCognition } from "./cognitive-optimization";
import { runDistributedIntelligence } from "./distributed-intelligence";
import { coordinateAgents } from "./agent-orchestrator";
import { createEvolutionSuggestion } from "./memory-store";

export type ExpansionPriority = "critical" | "high" | "medium" | "low";

export type ExpansionTarget = {
  area: string;
  priority: ExpansionPriority;
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
};

function getPriority(score: number): ExpansionPriority {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: ExpansionTarget[],
  target: Omit<ExpansionTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildExpansionTargets(input: {
  superState: any;
  optimization: any;
  distributed: any;
}) {
  const targets: ExpansionTarget[] = [];

  const superData = input.superState.superIntelligence || {};
  const optimizationData = input.optimization.optimization || {};
  const distributedData = input.distributed || {};

  const confidence = superData.confidence || 0;
  const limits: string[] = superData.limits || [];
  const capabilities = superData.capabilities || {};
  const primaryTarget = optimizationData.primaryTarget;

  if (input.superState.status === "failed") {
    addTarget(targets, {
      area: "system_recovery",
      score: 100,
      reason: "Super-intelligence framework failed",
      action: "Repair failed intelligence layer before expansion",
      risk: "critical",
      requiresApproval: true,
    });
  }

  if (confidence < 60) {
    addTarget(targets, {
      area: "confidence",
      score: 85,
      reason: `Super-intelligence confidence is low: ${confidence}`,
      action: "Improve verified state, reasoning, memory and awareness",
      risk: "high",
      requiresApproval: false,
    });
  }

  if (limits.length > 0 && !limits.includes("No critical limitation detected.")) {
    addTarget(targets, {
      area: "limitations",
      score: 80,
      reason: limits.join(" | "),
      action: "Reduce known limitations before adding new autonomy",
      risk: "high",
      requiresApproval: false,
    });
  }

  if (capabilities.canAnswerConfidently === false) {
    addTarget(targets, {
      area: "truth_verification",
      score: 90,
      reason: "Awenia cannot answer confidently without verification",
      action: "Strengthen verified system-status answers and stop guessing",
      risk: "critical",
      requiresApproval: true,
    });
  }

  if (capabilities.canActAutonomously === false) {
    addTarget(targets, {
      area: "autonomy",
      score: 75,
      reason: "Autonomous action is not reliable enough yet",
      action: "Improve approval gates, workflow execution and result checking",
      risk: "high",
      requiresApproval: true,
    });
  }

  if (primaryTarget && primaryTarget.area !== "monitoring") {
    addTarget(targets, {
      area: primaryTarget.area,
      score: primaryTarget.score || 70,
      reason: primaryTarget.reason || "Optimization target detected",
      action: primaryTarget.action || "Review optimization target",
      risk: primaryTarget.risk || "medium",
      requiresApproval:
        primaryTarget.risk === "high" || primaryTarget.risk === "critical",
    });
  }

  if (distributedData.status === "partial") {
    addTarget(targets, {
      area: "agent_coordination",
      score: 65,
      reason: "Distributed intelligence completed only partially",
      action: "Improve agent coordination and failed task handling",
      risk: "medium",
      requiresApproval: false,
    });
  }

  if (distributedData.status === "failed") {
    addTarget(targets, {
      area: "distributed_intelligence",
      score: 90,
      reason: "Distributed intelligence failed",
      action: "Repair distributed task execution and agent communication",
      risk: "critical",
      requiresApproval: true,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "controlled_growth",
      score: 25,
      reason: "No urgent expansion target detected",
      action: "Continue controlled monitoring without unnecessary expansion",
      risk: "low",
      requiresApproval: false,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildExpansionPlan(targets: ExpansionTarget[]) {
  return targets.slice(0, 5).map((target, index) => ({
    step: index + 1,
    area: target.area,
    priority: target.priority,
    action: target.action,
    reason: target.reason,
    risk: target.risk,
    requiresApproval: target.requiresApproval,
  }));
}

async function saveImportantExpansionSuggestion(target: ExpansionTarget) {
  if (target.priority !== "critical" && target.priority !== "high") {
    return false;
  }

  await createEvolutionSuggestion(
    `Expand intelligence area: ${target.area}`,
    `${target.reason}. Recommended action: ${target.action}`,
    target.priority === "critical" ? 9 : 8
  );

  return true;
}

export async function runIntelligenceExpansion(
  task = "Analyze safe intelligence expansion for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const superState = await runSuperIntelligenceFramework(task);

    const optimization = await optimizeCognition();

    const distributed = await runDistributedIntelligence(task);

    const targets = buildExpansionTargets({
      superState,
      optimization,
      distributed,
    });

    const primaryTarget = targets[0];

    const expansionPlan = buildExpansionPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    const suggestionSaved = await saveImportantExpansionSuggestion(primaryTarget);

    return {
      status:
        primaryTarget.priority === "critical"
          ? "needs_approval"
          : primaryTarget.area === "controlled_growth"
            ? "stable"
            : "expansion_planned",

      expansion: {
        task,

        primaryTarget,

        targets,

        expansionPlan,

        workflowPlan,

        suggestionSaved,

        safeToExecuteWithoutApproval:
          primaryTarget.requiresApproval === false &&
          primaryTarget.risk !== "high" &&
          primaryTarget.risk !== "critical",

        requiresGabiApproval:
          primaryTarget.requiresApproval === true,

        confidence:
          superState.superIntelligence?.confidence ||
          optimization.optimization?.confidence ||
          distributed.confidence ||
          0,

        superState,

        optimization,

        distributed,
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

      expansion: {
        task,

        primaryTarget: {
          area: "intelligence_expansion",
          priority: "critical",
          score: 100,
          reason: error?.message || "Intelligence expansion failed",
          action: "Repair intelligence-expansion.ts or connected systems",
          risk: "critical",
          requiresApproval: true,
        },

        targets: [],

        expansionPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        safeToExecuteWithoutApproval: false,

        requiresGabiApproval: true,

        confidence: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown intelligence expansion error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildIntelligenceExpansion(task?: string) {
  return runIntelligenceExpansion(task);
}

export async function analyzeIntelligenceExpansion(task?: string) {
  return runIntelligenceExpansion(task);
}

export async function expandIntelligence(task?: string) {
  return runIntelligenceExpansion(task);
}