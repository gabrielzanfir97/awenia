import { buildCognitiveArchitecture } from "./cognitive-architecture";
import { runMetaCognition } from "./meta-cognition";
import { coordinateAgents } from "./agent-orchestrator";

type ReasoningStatus =
  | "clear"
  | "conflicted"
  | "needs_verification"
  | "failed";

type ReasoningFinding = {
  area: string;
  conclusion: string;
  evidence: string;
  confidence: number;
  verified: boolean;
};

type ReasoningConflict = {
  area: string;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function addFinding(
  findings: ReasoningFinding[],
  finding: ReasoningFinding
) {
  findings.push(finding);
}

function addConflict(
  conflicts: ReasoningConflict[],
  conflict: ReasoningConflict
) {
  conflicts.push(conflict);
}

function calculateReasoningConfidence(findings: ReasoningFinding[]) {
  if (findings.length === 0) return 0;

  const average =
    findings.reduce((sum, item) => sum + item.confidence, 0) /
    findings.length;

  const unverifiedPenalty =
    findings.filter((item) => !item.verified).length * 8;

  return clamp(Math.round(average - unverifiedPenalty));
}

function calculateStatus(input: {
  conflicts: ReasoningConflict[];
  confidence: number;
  sourceFailures: number;
  unverifiedFindings: number;
}): ReasoningStatus {
  if (input.sourceFailures > 0) return "needs_verification";

  if (
    input.conflicts.some(
      (conflict) =>
        conflict.severity === "critical" || conflict.severity === "high"
    )
  ) {
    return "conflicted";
  }

  if (input.conflicts.length > 0 || input.unverifiedFindings > 0 || input.confidence < 60) {
    return "needs_verification";
  }

  return "clear";
}

export async function runReasoningNetwork(context: any = {}) {
  const startedAt = new Date().toISOString();

  try {
    const architecture = await buildCognitiveArchitecture();
    const meta = await runMetaCognition(context);

    const architectureData = architecture.architecture || {};
    const metaData = meta.metaCognition || {};

    const awarenessLayer = architectureData.layers?.perception || {};
    const memoryLayer = architectureData.layers?.memory || {};
    const goalsLayer = architectureData.layers?.goals || {};
    const decisionLayer = architectureData.layers?.decision || {};
    const agentsLayer = architectureData.layers?.agents || {};

    const findings: ReasoningFinding[] = [];
    const conflicts: ReasoningConflict[] = [];

    addFinding(findings, {
      area: "awareness",
      conclusion:
        awarenessLayer.primaryProblem || "Awareness status unknown",
      evidence: `Awareness score: ${awarenessLayer.score || 0}`,
      confidence: awarenessLayer.score || 0,
      verified: architectureData.verified === true,
    });

    addFinding(findings, {
      area: "memory",
      conclusion: memoryLayer.health || "Memory health unknown",
      evidence: `Memory load: ${memoryLayer.load || 0}%`,
      confidence:
        memoryLayer.health === "healthy"
          ? 85
          : memoryLayer.health === "degraded"
            ? 35
            : 60,
      verified: memoryLayer.status === "connected",
    });

    addFinding(findings, {
      area: "goals",
      conclusion: goalsLayer.activeMission || "No active mission",
      evidence: `Active goals: ${goalsLayer.activeGoals || 0}`,
      confidence: goalsLayer.hasRealGoals ? 80 : 40,
      verified: goalsLayer.status === "connected",
    });

    addFinding(findings, {
      area: "decision",
      conclusion: decisionLayer.action || "No decision action",
      evidence: decisionLayer.reason || "No decision reason",
      confidence: decisionLayer.confidence || 0,
      verified: decisionLayer.verified === true,
    });

    addFinding(findings, {
      area: "meta_cognition",
      conclusion:
        metaData.recommendedAction ||
        "No meta-cognition recommendation",
      evidence: `Meta status: ${meta.status}`,
      confidence: metaData.selfCheck?.confidence || 0,
      verified: metaData.selfCheck?.canTrustOwnState === true,
    });

    if (architectureData.verified === false) {
      addConflict(conflicts, {
        area: "architecture",
        issue: "Cognitive architecture is not fully verified",
        severity: "high",
      });
    }

    if (meta.status !== "clear") {
      addConflict(conflicts, {
        area: "meta_cognition",
        issue: "Meta-cognition says system needs verification",
        severity: "medium",
      });
    }

    if (
      memoryLayer.health === "degraded" ||
      memoryLayer.status === "failed"
    ) {
      addConflict(conflicts, {
        area: "memory",
        issue: "Memory system is degraded or failed",
        severity: "high",
      });
    }

    if (
      awarenessLayer.score !== undefined &&
      decisionLayer.confidence !== undefined &&
      Math.abs(awarenessLayer.score - decisionLayer.confidence) > 40
    ) {
      addConflict(conflicts, {
        area: "decision",
        issue:
          "Decision confidence is very different from awareness score",
        severity: "medium",
      });
    }

    if (!Array.isArray(agentsLayer.selectedAgents) || agentsLayer.selectedAgents.length === 0) {
      addConflict(conflicts, {
        area: "agents",
        issue: "No agents selected for reasoning workflow",
        severity: "high",
      });
    }

    const sourceFailures = Math.max(
      0,
      Number(architectureData.cognitiveState?.sourceFailures) || 0,
      Number(metaData.selfCheck?.sourceFailures) || 0
    );

    const confidence = calculateReasoningConfidence(findings);

    const status = calculateStatus({
      conflicts,
      confidence,
      sourceFailures,
      unverifiedFindings: findings.filter((finding) => !finding.verified).length,
    });

    const finalConclusion =
      status === "clear"
        ? "Reasoning is clear enough to continue."
        : status === "conflicted"
          ? "Reasoning found conflicts that must be reviewed."
          : "Reasoning needs verification before confident action.";

    const recommendedAction =
      conflicts.length > 0
        ? conflicts[0].issue
        : decisionLayer.action || metaData.recommendedAction || "Continue monitoring";

    const requestText =
      typeof context?.message === "string"
        ? context.message
        : typeof context?.distributedTask === "string"
          ? context.distributedTask
          : "";

    const workflowPlan = coordinateAgents(
      typeof context?.activeSkill === "string" && context.activeSkill.trim()
        ? context.activeSkill
        : decisionLayer.priority || "reasoning",
      [
        requestText ? `User request: ${requestText.slice(0, 700)}` : "",
        `Recommendation: ${recommendedAction}`,
        `Conclusion: ${finalConclusion}`,
      ].filter(Boolean).join("\n")
    );

    return {
      status,

      reasoning: {
        finalConclusion,

        recommendedAction,

        confidence,

        findings,

        conflicts,

        architecture,

        metaCognition: meta,

        decision: {
          priority: decisionLayer.priority,
          action: decisionLayer.action,
          reason: decisionLayer.reason,
          risk: decisionLayer.risk,
          urgency: decisionLayer.urgency,
          confidence: decisionLayer.confidence,
          secondaryPriorities: decisionLayer.secondaryPriorities,
        },

        agents: {
          selectedAgents: Array.isArray(agentsLayer.selectedAgents) ? agentsLayer.selectedAgents : [],
          workflowSteps: agentsLayer.workflowSteps || [],
          workflowPlan,
        },

        truthCheck: {
          canAnswerConfidently:
            status === "clear" && metaData.selfCheck?.canTrustOwnState === true,

          mustVerify:
            status !== "clear" ||
            metaData.selfCheck?.canTrustOwnState !== true,

          reason:
            status === "clear"
              ? "Sources are aligned"
              : "One or more sources are uncertain, failed or conflicted",
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

      reasoning: {
        finalConclusion: "Reasoning network failed",
        recommendedAction:
          "Repair reasoning-network.ts or connected cognitive systems",
        confidence: 0,
        findings: [],
        conflicts: [
          {
            area: "reasoning_network",
            issue: error?.message || "Unknown reasoning network error",
            severity: "critical",
          },
        ],
        truthCheck: {
          canAnswerConfidently: false,
          mustVerify: true,
          reason: "Reasoning network error",
        },
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown reasoning network error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildReasoningNetwork(context: any = {}) {
  return runReasoningNetwork(context);
}

export async function analyzeReasoningNetwork(context: any = {}) {
  return runReasoningNetwork(context);
}