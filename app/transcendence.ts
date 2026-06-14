import { runInfiniteEvolutionFramework } from "./infinite-evolution";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";
import { getAgentCommunicationStats } from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type TranscendenceStatus =
  | "stable"
  | "controlled_growth"
  | "needs_approval"
  | "needs_attention"
  | "blocked"
  | "failed";

export type TranscendenceBoundary = {
  name: string;
  rule: string;
  active: boolean;
  reason: string;
};

export type TranscendenceTarget = {
  area: string;
  priority: "critical" | "high" | "medium" | "low";
  score: number;
  reason: string;
  action: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  safeToContinue: boolean;
};

function getPriority(score: number): TranscendenceTarget["priority"] {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function addTarget(
  targets: TranscendenceTarget[],
  target: Omit<TranscendenceTarget, "priority">
) {
  targets.push({
    ...target,
    priority: getPriority(target.score),
  });
}

function buildBoundaries(): TranscendenceBoundary[] {
  return [
    {
      name: "truth_boundary",
      rule: "Awenia must not claim verified system facts without real verification.",
      active: true,
      reason: "Prevents invented system state.",
    },
    {
      name: "approval_boundary",
      rule: "High-risk or critical changes require Gabi approval.",
      active: true,
      reason: "Keeps Awenia controlled by Gabi.",
    },
    {
      name: "memory_boundary",
      rule: "Important evolution must stay connected to memory, goals and awareness.",
      active: true,
      reason: "Prevents disconnected behavior.",
    },
    {
      name: "safety_boundary",
      rule: "Awenia must plan before action and report results after action.",
      active: true,
      reason: "Keeps autonomy auditable.",
    },
    {
      name: "local_identity_boundary",
      rule: "Awenia remains Gabi's personal AI and must not act as an uncontrolled external system.",
      active: true,
      reason: "Protects identity and purpose.",
    },
  ];
}

function buildTargets(infiniteEvolution: any) {
  const targets: TranscendenceTarget[] = [];

  const primary =
    infiniteEvolution.infiniteEvolution?.primaryTarget;

  const safeToContinue =
    infiniteEvolution.infiniteEvolution?.safeToContinue === true;

  const requiresApproval =
    infiniteEvolution.infiniteEvolution?.requiresGabiApproval === true;

  if (infiniteEvolution.status === "failed") {
    addTarget(targets, {
      area: "system_recovery",
      score: 100,
      reason: "Infinite evolution failed",
      action: "Repair infinite evolution before higher-level coordination",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (infiniteEvolution.status === "blocked") {
    addTarget(targets, {
      area: "blocked_evolution",
      score: 100,
      reason: "Evolution is blocked by safety or approval rules",
      action: "Stop autonomous escalation and wait for Gabi approval",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (primary) {
    addTarget(targets, {
      area: primary.area,
      score: primary.score || 70,
      reason: primary.reason,
      action: primary.action,
      risk: primary.risk,
      requiresGabiApproval:
        primary.requiresGabiApproval === true || requiresApproval,
      safeToContinue:
        primary.safeToContinue === true &&
        safeToContinue &&
        primary.risk !== "critical",
    });
  }

  if (requiresApproval) {
    addTarget(targets, {
      area: "gabi_approval",
      score: 95,
      reason: "Current evolution requires Gabi approval",
      action: "Prepare clear approval request before applying changes",
      risk: "critical",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (!safeToContinue) {
    addTarget(targets, {
      area: "safety_control",
      score: 90,
      reason: "System is not safe to continue automatically",
      action: "Keep changes as suggestions only",
      risk: "high",
      requiresGabiApproval: true,
      safeToContinue: false,
    });
  }

  if (targets.length === 0) {
    addTarget(targets, {
      area: "controlled_growth",
      score: 25,
      reason: "No urgent transcendence-level target detected",
      action: "Continue controlled growth with verification and approval",
      risk: "low",
      requiresGabiApproval: false,
      safeToContinue: true,
    });
  }

  return targets.sort((a, b) => b.score - a.score);
}

function calculateStatus(primary: TranscendenceTarget): TranscendenceStatus {
  if (!primary.safeToContinue) return "blocked";
  if (primary.requiresGabiApproval) return "needs_approval";
  if (primary.risk === "critical") return "needs_approval";
  if (primary.risk === "high") return "needs_attention";
  if (primary.area === "controlled_growth") return "stable";

  return "controlled_growth";
}

function buildTranscendencePlan(targets: TranscendenceTarget[]) {
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

async function shouldSaveTranscendenceSuggestion(target: TranscendenceTarget) {
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

export async function runTranscendenceArchitecture(
  task = "Analyze controlled transcendence architecture for Awenia"
) {
  const startedAt = new Date().toISOString();

  try {
    const infiniteEvolution =
      await runInfiniteEvolutionFramework(task);

    const boundaries = buildBoundaries();

    const targets = buildTargets(infiniteEvolution);

    const primaryTarget = targets[0];

    const transcendencePlan = buildTranscendencePlan(targets);

    const workflowPlan = coordinateAgents(
      primaryTarget.area,
      `${primaryTarget.action}. Reason: ${primaryTarget.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveTranscendenceSuggestion(primaryTarget)) {
      await createEvolutionSuggestion(
        `Transcendence control: ${primaryTarget.area}`,
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

      transcendence: {
        task,

        meaning:
          "Controlled higher-level coordination, not uncontrolled autonomy.",

        primaryTarget,

        targets,

        transcendencePlan,

        workflowPlan,

        boundaries,

        suggestionSaved,

        requiresGabiApproval:
          primaryTarget.requiresGabiApproval ||
          primaryTarget.risk === "high" ||
          primaryTarget.risk === "critical",

        safeToContinue:
          primaryTarget.safeToContinue &&
          primaryTarget.risk !== "critical",

        blocked:
          status === "blocked" ||
          primaryTarget.safeToContinue === false,

        controlledByGabi: true,

        truthProtected: boundaries.every((item) => item.active),

        infiniteEvolution,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        confidence:
          infiniteEvolution.infiniteEvolution?.confidence || 0,
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

      transcendence: {
        task,

        meaning:
          "Controlled higher-level coordination, not uncontrolled autonomy.",

        primaryTarget: {
          area: "transcendence_architecture",
          priority: "critical",
          score: 100,
          reason:
            error?.message || "Transcendence architecture failed",
          action:
            "Repair transcendence.ts or connected systems",
          risk: "critical",
          requiresGabiApproval: true,
          safeToContinue: false,
        },

        targets: [],

        transcendencePlan: [],

        workflowPlan: null,

        boundaries: buildBoundaries(),

        suggestionSaved: false,

        requiresGabiApproval: true,

        safeToContinue: false,

        blocked: true,

        controlledByGabi: true,

        truthProtected: true,

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

      error:
        error?.message || "Unknown transcendence architecture error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildTranscendenceArchitecture(task?: string) {
  return runTranscendenceArchitecture(task);
}

export async function analyzeTranscendenceArchitecture(task?: string) {
  return runTranscendenceArchitecture(task);
}

export async function runTranscendence(task?: string) {
  return runTranscendenceArchitecture(task);
}