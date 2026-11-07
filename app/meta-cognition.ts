import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";
import { coordinateAgents } from "./agent-orchestrator";
import { getAgentState } from "./agents";

type MetaStatus =
  | "clear"
  | "uncertain"
  | "needs_verification"
  | "failed";

type KnowledgeItem = {
  area: string;
  status: "verified" | "estimated" | "unknown" | "failed";
  evidence: string;
  confidence: number;
};

async function safeRead<T>(
  name: string,
  reader: () => Promise<T>,
  fallback: T
) {
  try {
    const data = await reader();
    const nestedStatus = (data as { status?: unknown } | null)?.status;
    if (nestedStatus === "failed" || nestedStatus === "blocked") {
      return {
        name,
        data,
        status: "failed",
        error: `${name} returned ${nestedStatus}`,
      };
    }
    if (["partial", "degraded", "needs_verification"].includes(String(nestedStatus))) {
      return {
        name,
        data,
        status: "unverified",
        error: `${name} returned ${nestedStatus}`,
      };
    }
    return {
      name,
      data,
      status: "connected",
      error: null,
    };
  } catch (error: any) {
    return {
      name,
      data: fallback,
      status: "failed",
      error: error?.message || `Failed to read ${name}`,
    };
  }
}

function addKnowledge(
  list: KnowledgeItem[],
  item: KnowledgeItem
) {
  list.push(item);
}

function calculateMetaStatus(input: {
  sourceFailures: number;
  unknownCount: number;
  confidence: number;
}): MetaStatus {
  if (input.sourceFailures > 0) return "needs_verification";
  if (input.unknownCount > 0) return "uncertain";
  if (input.confidence >= 70) return "clear";
  return "uncertain";
}

export async function runMetaCognition(context: any = {}) {
  const startedAt = new Date().toISOString();

  try {
    const awarenessResult = await safeRead(
      "awareness",
      () => buildAwarenessState(),
      {
        awareness: {
          verified: false,
          awarenessScore: 0,
          primaryProblem: "Awareness unavailable",
          recommendedAction: "Repair awareness",
          metrics: {
            sourceFailures: 1,
            weakSkillCount: 0,
            activeGoalCount: 0,
            pendingUpgradeCount: 0,
            memoryAreaCount: 0,
            personalityTraitCount: 0
          },
          sourceErrors: [],
          active: false,
          confidence: 0,
          systemState: {
            runtime: "unknown",
            memory: "unknown",
            goals: "unknown",
            skills: "unknown",
            evolution: "unknown",
            personality: "unknown",
            protection: "unknown"
          },
          sourceStatuses: {
            memoryStats: { verified: false, status: "failed", error: null },
            autonomousGoals: { verified: false, status: "failed", error: null },
            autonomousPriorities: { verified: false, status: "failed", error: null },
            skillLevels: { verified: false, status: "failed", error: null },
            evolutionSuggestions: { verified: false, status: "failed", error: null },
            personalityTraits: { verified: false, status: "failed", error: null },
          } as any,
          memoryStats: [],
          activeGoals: [],
          autonomousPriorities: [],
          weakSkills: [],
          personalityTraits: [],
          pendingUpgrades: [],
          nextPriority: ""
        },
        timestamp: ""
      }
    );

    const memoryResult = await safeRead(
      "longTermMemory",
      () => buildLongTermMemory(),
      {
        memory: {
          conversations: 0,
          summaries: 0,
          goals: 0,
          evolutionReports: 0,
          activeGoals: 0,
          criticalMemories: 0
        },
        memoryAnalysis: {
          memoryHealth: "empty",
          verified: false,
          readErrors: [],
          readStatuses: {
            memories: { verified: false, status: "failed", error: null },
            summaries: { verified: false, status: "failed", error: null },
            goals: { verified: false, status: "failed", error: null },
            reports: { verified: false, status: "failed", error: null },
          } as any,
          dominantMemoryAreas: [],
          emotionalMemoryMap: [],
          activeGoals: 0,
          strongestArea: "",
          recommendedFocus: "",
          compressionNeeded: false,
          duplicateCount: 0,
          possibleDuplicates: [],
          memoryTimeline: []
        },
        status: "empty",
        continuity: {
          identity: "unknown",
          learning: "unknown",
          optimization: "unknown",
          protection: "unknown",
        },
        snapshot: {
          createdAt: "",
          countScope: "recent_sample",
          sampleLimits: {
            memories: 50,
            summaries: 20,
            goals: 20,
            reports: 20,
          },
          databaseReadsVerified: false,
          memoryHealth: "unknown",
          strongestArea: "",
          recommendedFocus: "",
          totalMemories: 0,
          totalSummaries: 0,
          totalGoals: 0,
          totalReports: 0,
          compressionNeeded: false,
          duplicateCount: 0,
        },
        execution: {
          startedAt: "",
          completedAt: "",
        },
        timestamp: ""
      }
    );

    const goalsResult = await safeRead(
      "goals",
      () => manageAutonomousGoals(),
      {
        goals: [],
        activeGoals: [],
        activeMission: "No active mission",
        nextAction: "Create or review goals",
        hasRealGoals: false,
        status: "failed",
        inactiveGoals: [],
        executionPlan: [],
        goalAnalysis: {
          totalGoals: 0,
          totalActiveGoals: 0,
          totalInactiveGoals: 0,
          highUrgencyGoals: 0,
          stalledGoals: 0,
          nearCompletionGoals: 0,
          strongestGoal: {} as any,
          averageProgress: 0,
        } as any,
        health: { verified: false, status: "failed", error: null } as any,
        source: { verified: false, status: "failed", error: null } as any,
        execution: { startedAt: "", completedAt: "" } as any,
        timestamp: ""
      }
    );

    const awareness = awarenessResult.data;
    const memory = memoryResult.data;
    const goals = goalsResult.data;

    const sourceFailures =
      Math.max(
        awarenessResult.status === "failed" ? 1 : 0,
        Number(awareness.awareness?.metrics?.sourceFailures) || 0,
        0
      ) +
      Math.max(
        memoryResult.status === "failed" ? 1 : 0,
        Array.isArray(memory.memoryAnalysis?.readErrors)
          ? memory.memoryAnalysis.readErrors.length
          : 0
      ) +
      Math.max(
        goalsResult.status === "failed" ? 1 : 0,
        goals.source?.status === "failed"
          ? 1
          : 0
      );


    const awarenessScore = awareness.awareness?.awarenessScore || 0;
    const weakSkills = awareness.awareness?.weakSkills || [];
    const pendingUpgrades =
      awareness.awareness?.pendingUpgrades?.length || 0;
    const activeGoals =
      goals.goalAnalysis?.totalActiveGoals ??
      awareness.awareness?.activeGoals?.length ??
      0;

    const memoryLoad =
      memory.memory?.conversations > 0
        ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (memory.memory.conversations -
                memory.memory.summaries * 10) /
              5
            )
          )
        )
        : 0;

    const decision = makeAutonomousDecision({
      errors: sourceFailures,
      memoryLoad,
      pendingUpgrades,
      weakSkills,
      activeGoals,
      awarenessScore,
      lastFailureCount: sourceFailures,
    });

    const requestText =
      typeof context?.message === "string"
        ? context.message
        : typeof context?.distributedTask === "string"
          ? context.distributedTask
          : "";

    const workflowPlan = coordinateAgents(
      decision.priority,
      [
        requestText ? `User request: ${requestText.slice(0, 700)}` : "",
        `Decision action: ${decision.action}`,
        `Decision reason: ${decision.reason}`,
      ].filter(Boolean).join("\n")
    );

    const knowledge: KnowledgeItem[] = [];

    addKnowledge(knowledge, {
      area: "awareness",
      status:
        awarenessResult.status === "failed"
          ? "failed"
          : awarenessResult.status === "connected" && awareness.awareness?.verified === true
            ? "verified"
            : "estimated",
      evidence: awareness.awareness?.primaryProblem || "No awareness evidence",
      confidence: awareness.awareness?.confidence || awarenessScore,
    });

    addKnowledge(knowledge, {
      area: "memory",
      status:
        memoryResult.status === "failed"
          ? "failed"
          : memoryResult.status === "connected" && memory.memoryAnalysis?.verified === true
            ? "verified"
            : "estimated",
      evidence:
        memory.memoryAnalysis?.memoryHealth ||
        "Memory health unavailable",
      confidence:
        memory.status === "stable"
          ? 80
          : memory.status === "degraded"
            ? 40
            : 50,
    });

    addKnowledge(knowledge, {
      area: "goals",
      status:
        goalsResult.status === "failed"
          ? "failed"
          : goalsResult.status === "connected" &&
              goals.source?.verified === true
            ? "verified"
            : goals.hasRealGoals
              ? "estimated"
              : "unknown",
      evidence: goals.activeMission || "No active mission detected",
      confidence: goals.hasRealGoals ? 80 : 30,
    });

    addKnowledge(knowledge, {
      area: "agents",
      status: "verified",
      evidence: `${getAgentState().length} agents registered; real execution not verified`,
      confidence: 75,
    });

    addKnowledge(knowledge, {
      area: "decision",
      status: "estimated",
      evidence: decision.reason,
      confidence: decision.confidence,
    });

    const unknowns = knowledge.filter(
      (item) => item.status === "unknown" || item.status === "failed"
    );

    const verifiedKnowledge = knowledge.filter(
      (item) => item.status === "verified"
    );

    const estimatedKnowledge = knowledge.filter(
      (item) => item.status === "estimated"
    );

    const confidence =
      knowledge.length > 0
        ? Math.round(
          knowledge.reduce(
            (sum, item) => sum + item.confidence,
            0
          ) / knowledge.length
        )
        : 0;

    const unverifiedSourceCount = knowledge.filter(
      (item) => ["awareness", "memory", "goals"].includes(item.area) &&
        item.status !== "verified"
    ).length;

    const status = calculateMetaStatus({
      sourceFailures,
      unknownCount: Math.max(unknowns.length, unverifiedSourceCount),
      confidence,
    });

    return {
      status,

      metaCognition: {
        selfCheck: {
          identity: "Awenia",
          canTrustOwnState: status === "clear",
          confidence,
          sourceFailures,
          unknownCount: unknowns.length,
          unverifiedSourceCount,
        },

        verifiedKnowledge,

        estimatedKnowledge,

        unknowns,

        knowledge,

        truthPolicy: {
          mustNotInvent: [
            "real internet access status",
            "Supabase connection status",
            "build result",
            "git status",
            "file contents",
            "tool execution result",
            "system health",
          ],

          mustVerifyBeforeAnswering: [
            "project file status",
            "whether a function really works",
            "whether memory was saved",
            "whether internet is connected",
            "whether build passed",
          ],

          safeAnswerRule:
            "If the system did not verify something directly, Awenia must say it is not verified instead of guessing.",
        },

        decision,

        workflowPlan,

        agentState: getAgentState(),

        contextReceived: context,

        recommendedAction:
          status === "clear"
            ? "Continue normal reasoning"
            : "Verify missing system information before answering confidently",
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

      metaCognition: {
        selfCheck: {
          identity: "Awenia",
          canTrustOwnState: false,
          confidence: 0,
          sourceFailures: 1,
          unknownCount: 1,
        },

        verifiedKnowledge: [],

        estimatedKnowledge: [],

        unknowns: [
          {
            area: "meta_cognition",
            status: "failed",
            evidence:
              error?.message || "Meta cognition failed",
            confidence: 0,
          },
        ],

        truthPolicy: {
          safeAnswerRule:
            "Do not invent system state. Repair meta-cognition first.",
        },

        recommendedAction:
          "Repair meta-cognition or connected systems",
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      error: error?.message || "Unknown meta-cognition error",

      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildMetaCognition(context: any = {}) {
  return runMetaCognition(context);
}

export async function analyzeMetaCognition(context: any = {}) {
  return runMetaCognition(context);
}