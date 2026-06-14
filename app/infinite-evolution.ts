import { runIntelligenceCivilization } from "./intelligence-civilization";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type InfiniteEvolutionStatus =
  | "stable"
  | "evolving"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type InfiniteEvolutionTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToContinue: boolean;
};

function getPriority(score: number): InfiniteEvolutionTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: InfiniteEvolutionTarget[],
  target: Omit<InfiniteEvolutionTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildTargets(civilization: any) {
  const targets: InfiniteEvolutionTarget[] = [];

  const decision = civilization.civilization?.decision;
  const evolutionTarget =
    civilization.civilization?.evolution?.cognitiveEvolution?.primaryTarget;

  const ecosystem = civilization.civilization?.ecosystem;
  const distributed = civilization.civilization?.distributed;

  if (civilization.status === "failed") {
    addTarget(targets, {
      area: "system_recovery",
      score: 100,
      reason: "Intelligence civilization failed",
      action: "Repair civilization layer before allowing evolution",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (decision) {
    addTarget(targets, {
      area: decision.area,
      score: decision.priority * 10,
      reason: decision.reason,
      action: decision.action,
      risk: decision.risk,
      requiresGabiApproval: decision.requiresGabiApproval === true,
      safeToContinue:
        decision.requiresGabiApproval !== true &&
        decision.risk !== "critical",
    });
  }

  if (evolutionTarget && evolutionTarget.area !== "stable_monitoring") {
    addTarget(targets, {
      area: evolutionTarget.area,
      score: evolutionTarget.score || 70,
      reason: evolutionTarget.reason,
      action: evolutionTarget.action,
      risk: evolutionTarget.risk,
      requiresGabiApproval: evolutionTarget.requiresApproval === true,
      safeToContinue:
        evolutionTarget.requiresApproval !== true &&
        evolutionTarget.risk !== "critical",
    });
  }

  if (ecosystem?.status === "needs_attention") {
    addTarget(targets, {
      area: "ecosystem_attention",
      score: 80,
      reason: "AI ecosystem needs attention",
      action: "Stabilize ecosystem before deeper evolution",
      risk: "high",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  if (distributed?.status === "failed" || distributed?.status === "partial") {
    addTarget(targets, {
      area: "agent_distribution",
      score: distributed.status === "failed" ? 90 : 65,
      reason: `Distributed intelligence status is ${distributed.status}`,
      action: "Improve agent distribution and workflow reliability",
      risk: distributed.status === "failed" ? "critical" : "medium",
      requiresGabiApproval: distributed.status === "failed",
      safeToContinue: distributed.status !== "failed",
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "controlled_infinite_evolution",
      score: 25,
      reason: "No urgent evolution target detected",
      action: "Continue controlled evolution only when real evidence appears",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function buildEvolutionPlan(targets: InfiniteEvolutionTarget[]) {
  return targets.slice(0, 5).map((target, index) => ({
    step: index + 1,
    area: target.area,
    priority: target.priority,
    action: target.action,
    reason: target.reason,
    risk: target.risk,
    requiresGabiApproval: target.requiresGabiApproval,
    safeToContinue: target.safeToContinue,
  }));
}

function calculateStatus(
  primaryTarget: InfiniteEvolutionTarget
): InfiniteEvolutionStatus {
  if (!primaryTarget.safeToContinue) return "blocked";
  if (primaryTarget.requiresGabiApproval) return "needs_approval";
  if (primaryTarget.risk === "critical") return "needs_approval";
  if (primaryTarget.risk === "high") return "needs_attention";
  if (primaryTarget.area === "controlled_infinite_evolution") return "stable";
  return "evolving";
}

async function shouldSaveInfiniteSuggestion(target: InfiniteEvolutionTarget) {
  if (target.priority === "low") return false;

  const recent = await getEvolutionSuggestions(20);

  const signature = `${target.area} ${target.action}`
    .toLowerCase()
    .slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

export async function runInfiniteEvolutionFramework(
  task = "Analyze safe infinite evolution for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const civilization = await runIntelligenceCivilization(task);

    const targets = buildTargets(civilization);

    const primaryTarget = targets[0];

    const evolutionPlan = buildEvolutionPlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveInfiniteSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Infinite evolution: ${primaryTarget.area}`,
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

      infiniteEvolution: {
        task,

        primaryTarget,

        targets,

        evolutionPlan,

        workflowPlan,

        suggestionSaved,

        requiresGabiApproval:
          primaryTarget.requiresGabiApproval ||
          primaryTarget.risk === "high" ||
          primaryTarget.risk === "critical",

        safeToContinue:
          primaryTarget.safeToContinue &&
          primaryTarget.risk !== "critical",

        controlledByGabi: true,

        rules: {
          noUnapprovedHighRiskChanges: true,
          noFakeSystemStatus: true,
          noEvolutionWithoutEvidence: true,
          memoryBeforeEvolution: true,
          agentsMustReportResults: true,
        },

        civilization,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          civilization.civilization?.evolution?.cognitiveEvolution
            ?.confidence ||
          civilization.civilization?.ecosystem?.ecosystem?.confidence ||
          0,
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

      infiniteEvolution: {
        task,

        primaryTarget: {
          area: "infinite_evolution",
          priority: "critical",
          score: 100,
          reason: error?.message || "Infinite evolution failed",
          action: "Repair infinite-evolution.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        evolutionPlan: [],

        workflowPlan: null,

        suggestionSaved: false,

        requiresGabiApproval: true,

        safeToContinue: false,

        controlledByGabi: true,

        rules: {
          noUnapprovedHighRiskChanges: true,
          noFakeSystemStatus: true,
          noEvolutionWithoutEvidence: true,
          memoryBeforeEvolution: true,
          agentsMustReportResults: true,
        },

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence: 0,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown infinite evolution error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildInfiniteEvolutionFramework(task?: string) {
  return runInfiniteEvolutionFramework(task);
}

export async function analyzeInfiniteEvolutionFramework(task?: string) {
  return runInfiniteEvolutionFramework(task);
}

export async function runInfiniteEvolution(task?: string) {
  return runInfiniteEvolutionFramework(task);
}