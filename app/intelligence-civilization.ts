import { runCognitiveEvolutionNetwork } from "./cognitive-evolution-network";
import { runDistributedIntelligence } from "./distributed-intelligence";
import { runAIEcosystem } from "./ai-ecosystem";
import { coordinateAgents } from "./agent-orchestrator";

import {
  Agents,
  AgentName,
  getAgentState,
} from "./agents";

import {
  communicateBetweenAgents,
  broadcastAgentMessage,
  getAgentCommunicationStats,
} from "./agent-communication";

import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type CivilizationStatus =
  | "stable"
  | "coordinating"
  | "needs_approval"
  | "needs_attention"
  | "failed";

export type CivilizationCouncilMember = {
  agentId: AgentName;
  role: string;
  priority: number;
  responsibility: string;
  status: string;
  confidence: number;
};

export type CivilizationLaw = {
  name: string;
  rule: string;
  enforced: boolean;
  reason: string;
};

export type CivilizationDecision = {
  area: string;
  action: string;
  reason: string;
  risk: "low" | "medium" | "high" | "critical";
  requiresGabiApproval: boolean;
  priority: number;
};

function buildCivilizationLaws(): CivilizationLaw[] {
  return [
    {
      name: "truth_before_confidence",
      rule: "Awenia must not invent system status, file contents, build results or internet status.",
      enforced: true,
      reason: "System truth must come from verified checks.",
    },
    {
      name: "gabi_approval_for_high_risk",
      rule: "High-risk or critical changes require Gabi approval before execution.",
      enforced: true,
      reason: "Awenia must remain controlled by Gabi.",
    },
    {
      name: "memory_before_action",
      rule: "Important actions must consider memory, goals and awareness first.",
      enforced: true,
      reason: "Autonomy must stay connected to long-term context.",
    },
    {
      name: "agents_must_communicate",
      rule: "Agents must share task results through agent communication before final decisions.",
      enforced: true,
      reason: "Distributed work needs coordination.",
    },
  ];
}

function buildCouncil(): CivilizationCouncilMember[] {
  return Object.values(Agents).map((agent) => ({
    agentId: agent.id as AgentName,
    role: agent.role,
    priority: agent.priority,
    responsibility: agent.capabilities.join(", "),
    status: agent.status,
    confidence: agent.confidence,
  }));
}

function calculateDecision(input: {
  evolution: any;
  distributed: any;
  ecosystem: any;
}): CivilizationDecision {
  const evolutionTarget =
    input.evolution.cognitiveEvolution?.primaryTarget;

  const ecosystemAction =
    input.ecosystem.ecosystem?.coordination?.recommendedAction;

  const distributedSuccess = input.distributed.success === true;

  if (evolutionTarget) {
    return {
      area: evolutionTarget.area,
      action: evolutionTarget.action,
      reason: evolutionTarget.reason,
      risk: evolutionTarget.risk,
      requiresGabiApproval:
        evolutionTarget.requiresApproval === true ||
        evolutionTarget.risk === "high" ||
        evolutionTarget.risk === "critical",
      priority:
        evolutionTarget.priority === "critical"
          ? 10
          : evolutionTarget.priority === "high"
            ? 8
            : evolutionTarget.priority === "medium"
              ? 6
              : 3,
    };
  }

  if (!distributedSuccess) {
    return {
      area: "agent_coordination",
      action: "Improve distributed agent coordination",
      reason: "Distributed intelligence did not fully complete",
      risk: "medium",
      requiresGabiApproval: false,
      priority: 6,
    };
  }

  return {
    area: "civilization_monitoring",
    action: ecosystemAction || "Continue coordinated monitoring",
    reason: "No critical civilization-level issue detected",
    risk: "low",
    requiresGabiApproval: false,
    priority: 3,
  };
}

function calculateCivilizationStatus(
  decision: CivilizationDecision,
  input: {
    evolutionStatus?: string;
    distributedStatus?: string;
    ecosystemStatus?: string;
  }
): CivilizationStatus {
  if (
    input.evolutionStatus === "failed" ||
    input.distributedStatus === "failed" ||
    input.ecosystemStatus === "failed"
  ) {
    return "failed";
  }

  if (decision.requiresGabiApproval) {
    return "needs_approval";
  }

  if (decision.risk === "critical" || decision.risk === "high") {
    return "needs_attention";
  }

  if (decision.area === "civilization_monitoring") {
    return "stable";
  }

  return "coordinating";
}

async function shouldSaveCivilizationSuggestion(decision: CivilizationDecision) {
  if (decision.risk !== "high" && decision.risk !== "critical") {
    return false;
  }

  const recent = await getEvolutionSuggestions(20);

  const signature = `${decision.area} ${decision.action}`
    .toLowerCase()
    .slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

export async function runIntelligenceCivilization(
  task = "Coordinate Awenia intelligence civilization"
) {
  const startedAt = new Date().toISOString();

  try {
    const ecosystem = await runAIEcosystem(task);

    const distributed = await runDistributedIntelligence(task);

    const evolution = await runCognitiveEvolutionNetwork(task);

    const laws = buildCivilizationLaws();

    const council = buildCouncil();

    const decision = calculateDecision({
      evolution,
      distributed,
      ecosystem,
    });

    const status = calculateCivilizationStatus(decision, {
      evolutionStatus: evolution.status,
      distributedStatus: distributed.status,
      ecosystemStatus: ecosystem.status,
    });

    createAgentBroadcast(
      "orchestrator",
      `Civilization decision: ${decision.action}`,
      decision.priority,
      "civilization_decision",
      {
        area: decision.area,
        risk: decision.risk,
        requiresGabiApproval: decision.requiresGabiApproval,
      }
    );

    for (const member of council) {
      communicateBetweenAgents(
        "orchestrator",
        member.agentId,
        `Civilization law check: ${laws
          .map((law) => law.name)
          .join(", ")}`,
        decision.priority,
        "civilization_law_check",
        {
          distributionId: decision.area,
          taskId: String(decision.priority),
        }
      );
    }

    const workflowPlan = coordinateAgents(
      decision.area,
      `${decision.action}. Reason: ${decision.reason}`
    );

    let suggestionSaved = false;

    if (await shouldSaveCivilizationSuggestion(decision)) {
      await createEvolutionSuggestion(
        `Civilization upgrade: ${decision.area}`,
        `${decision.reason}. Recommended action: ${decision.action}`,
        decision.risk === "critical" ? 9 : 8
      );

      suggestionSaved = true;
    }

    return {
      status,

      civilization: {
        task,

        laws,

        council,

        decision,

        workflowPlan,

        suggestionSaved,

        requiresGabiApproval: decision.requiresGabiApproval,

        safeToContinue:
          decision.requiresGabiApproval === false &&
          decision.risk !== "critical",

        ecosystem,

        distributed,

        evolution,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        governance: {
          owner: "Gabi",
          approvalRequiredForHighRisk: true,
          truthVerificationRequired: true,
          memoryRequiredBeforeImportantAction: true,
          protectedAgainstGuessing: true,
        },
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

      civilization: {
        task,

        laws: buildCivilizationLaws(),

        council: buildCouncil(),

        decision: {
          area: "intelligence_civilization",
          action:
            "Repair intelligence-civilization.ts or connected systems",
          reason:
            error?.message ||
            "Intelligence civilization failed",
          risk: "critical",
          requiresGabiApproval: true,
          priority: 10,
        },

        workflowPlan: null,

        suggestionSaved: false,

        requiresGabiApproval: true,

        safeToContinue: false,

        agents: {
          state: getAgentState(),
          communicationStats: getAgentCommunicationStats(),
        },

        governance: {
          owner: "Gabi",
          approvalRequiredForHighRisk: true,
          truthVerificationRequired: true,
          memoryRequiredBeforeImportantAction: true,
          protectedAgainstGuessing: true,
        },
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error:
        error?.message ||
        "Unknown intelligence civilization error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildIntelligenceCivilization(task?: string) {
  return runIntelligenceCivilization(task);
}

export async function analyzeIntelligenceCivilization(task?: string) {
  return runIntelligenceCivilization(task);
}

export async function coordinateIntelligenceCivilization(task?: string) {
  return runIntelligenceCivilization(task);
}

function createAgentBroadcast(arg0: string, arg1: string, priority: number, arg3: string, arg4: { area: string; risk: "low" | "medium" | "high" | "critical"; requiresGabiApproval: boolean; }) {
  throw new Error("Function not implemented.");
}
