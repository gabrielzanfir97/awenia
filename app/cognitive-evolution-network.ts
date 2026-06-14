import { runIntelligenceExpansion } from "./intelligence-expansion";
import { optimizeCognition } from "./cognitive-optimization";
import { runReasoningNetwork } from "./reasoning-network";
import { coordinateAgents } from "./agent-orchestrator";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type CognitiveEvolutionStatus =
  | "stable"
  | "evolving"
  | "needs_approval"
  | "needs_attention"
  | "failed";

export type CognitiveEvolutionTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
  score: number;
};

function getPriority(score: number): CognitiveEvolutionTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: CognitiveEvolutionTarget[],
  target: Omit<CognitiveEvolutionTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

async function shouldSaveSuggestion(area: string, action: string) {
  const recent = await getEvolutionSuggestions(20);

  const signature = `${area} ${action}`.toLowerCase();

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature.slice(0, 80))
  );
}

function buildEvolutionTargets(input: {
  expansion: any;
  optimization: any;
  reasoning: any;
}) {
  const targets: CognitiveEvolutionTarget[] = [];

  const expansionTarget = input.expansion.expansion?.primaryTarget;
  const optimizationTarget = input.optimization.optimization?.primaryTarget;
  const reasoningStatus = input.reasoning.status;
  const truthCheck = input.reasoning.reasoning?.truthCheck;

  if (expansionTarget && expansionTarget.area !== "controlled_growth") {
    addTarget(targets, {
      area: expansionTarget.area,
      reason: expansionTarget.reason,
      action: expansionTarget.action,
      risk: expansionTarget.risk,
      requiresApproval: expansionTarget.requiresApproval === true,
      score: expansionTarget.score || 70,
    });
  }

  if (optimizationTarget && optimizationTarget.area !== "monitoring") {
    addTarget(targets, {
      area: optimizationTarget.area,
      reason: optimizationTarget.reason,
      action: optimizationTarget.action,
      risk: optimizationTarget.risk,
      requiresApproval:
        optimizationTarget.risk === "high" ||
        optimizationTarget.risk === "critical",
      score: optimizationTarget.score || 65,
    });
  }

  if (reasoningStatus !== "clear") {
    addTarget(targets, {
      area: "reasoning_verification",
      reason: "Reasoning network is not fully clear",
      action: "Verify uncertain or conflicted reasoning before evolution",
      risk: "high",
      requiresApproval: true,
      score: 85,
    });
  }

  if (truthCheck?.mustVerify === true) {
    addTarget(targets, {
      area: "truth_control",
      reason: truthCheck.reason || "System must verify before confident answer",
      action: "Strengthen verified truth layer and prevent guessed system status",
      risk: "critical",
      requiresApproval: true,
      score: 95,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "stable_monitoring",
      reason: "No urgent cognitive evolution target detected",
      action: "Continue monitoring and evolve only when real evidence appears",
      risk: "low",
      requiresApproval: false,
      score: 20,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildEvolutionPlan(targets: CognitiveEvolutionTarget[]) {
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

function calculateStatus(
  primaryTarget: CognitiveEvolutionTarget
): CognitiveEvolutionStatus {
  if (primaryTarget.risk === "critical") return "needs_approval";
  if (primaryTarget.requiresApproval) return "needs_approval";
  if (primaryTarget.priority === "critical") return "needs_attention";
  if (primaryTarget.area === "stable_monitoring") return "stable";
  return "evolving";
}

export async function runCognitiveEvolutionNetwork(
  task = "Analyze safe cognitive evolution for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const expansion = await runIntelligenceExpansion(task);

    const optimization = await optimizeCognition();

    const reasoning = await runReasoningNetwork({
      cognitiveEvolutionTask: task,
      expansionStatus: expansion.status,
      optimizationStatus: optimization.status,
    });

    const targets = buildEvolutionTargets({
      expansion,
      optimization,
      reasoning,
    });

    const primaryTarget = targets[0];

    const evolutionPlan = buildEvolutionPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (
      primaryTarget.area !== "stable_monitoring" &&
      primaryTarget.priority !== "low" &&
      (await shouldSaveSuggestion(primaryTarget.area, primaryTarget.action))
    ) {
      await createEvolutionSuggestion(
        `Cognitive evolution: ${primaryTarget.area}`,
        `${primaryTarget.reason}. Recommended action: ${primaryTarget.action}`,
        primaryTarget.priority === "critical"
          ? 9
          : primaryTarget.priority === "high"
            ? 8
            : 6
      );

      suggestionSaved = true;
    }

    const status = calculateStatus(primaryTarget);

    return {
      status,

      cognitiveEvolution: {
        task,

        primaryTarget,

        targets,

        evolutionPlan,

        workflowPlan,

        suggestionSaved,

        requiresGabiApproval:
          primaryTarget.requiresApproval ||
          primaryTarget.risk === "high" ||
          primaryTarget.risk === "critical",

        safeToContinue:
          primaryTarget.requiresApproval === false &&
          primaryTarget.risk !== "critical",

        confidence:
          expansion.expansion?.confidence ||
          optimization.optimization?.confidence ||
          reasoning.reasoning?.confidence ||
          0,

        expansion,

        optimization,

        reasoning,
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

      cognitiveEvolution: {
        task,

        primaryTarget: {
          area: "cognitive_evolution_network",
          priority: "critical",
          reason:
            error?.message || "Cognitive evolution network failed",
          action:
            "Repair cognitive-evolution-network.ts or connected systems",
          risk: "critical",
          requiresApproval: true,
          score: 100,
        },

        targets: [],

        evolutionPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        requiresGabiApproval: true,

        safeToContinue: false,

        confidence: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error:
        error?.message || "Unknown cognitive evolution network error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildCognitiveEvolutionNetwork(task?: string) {
  return runCognitiveEvolutionNetwork(task);
}

export async function analyzeCognitiveEvolutionNetwork(task?: string) {
  return runCognitiveEvolutionNetwork(task);
}

export async function evolveCognitiveNetwork(task?: string) {
  return runCognitiveEvolutionNetwork(task);
}