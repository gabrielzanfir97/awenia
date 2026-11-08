import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type AutonomousTestStatus =
  | "passed"
  | "failed"
  | "partial"
  | "skipped";

export type AutonomousTestResult = {
  name: string;
  status: AutonomousTestStatus;
  passed: boolean;
  durationMs: number;
  result: any;
  error?: string;
  timestamp: string;
};

export type AutonomousTestReport = {
  status: AutonomousTestStatus;
  passed: boolean;
  tests: AutonomousTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    partial: number;
    skipped: number;
    durationMs: number;
  };
  recommendation: string;
  truthPolicy: {
    noFakeTests: boolean;
    failedTestMustBeReported: boolean;
    buildStatusNotCheckedHere: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

async function safeTest(
  name: string,
  runner: () => Promise<any> | any
): Promise<AutonomousTestResult> {
  const started = Date.now();

  try {
    const result = await runner();

    const outcome = ((): AutonomousTestStatus => {
      switch (name) {
        case "awareness":
          if (result?.hasAwareness !== true) return "failed";
          return result?.verified === true ? "passed" : "partial";
        case "long_term_memory":
          if (result?.hasMemory !== true || result?.status === "failed") return "failed";
          return result?.status === "partial" || result?.memoryHealth === "unknown"
            ? "partial" : "passed";
        case "goal_manager":
          return result?.hasGoals === true && result?.status !== "failed"
            ? "passed" : "failed";
        case "decision_engine":
          return result?.hasDecision === true &&
            typeof result?.decision?.action === "string"
            ? "passed" : "failed";
        case "agent_workflow":
          if (result?.workflow?.status === "skipped") return "skipped";
          return result?.workflow?.success === true &&
            result?.workflow?.status === "completed" &&
            Array.isArray(result?.workflow?.steps) &&
            result.workflow.steps.length > 0 &&
            result.workflow.steps.every((step: any) => step.status === "completed")
            ? "passed" : "failed";
        case "memory_store_write":
          return result?.reflection?.status === "saved" &&
            result?.reflection?.supabase?.saved === true
            ? "passed" : "failed";
        default:
          return "failed";
      }
    })();

    return {
      name,
      status: outcome,
      passed: outcome === "passed",
      durationMs: Date.now() - started,
      result,
      ...(outcome === "failed" ? {
        error: result?.reflection?.supabase?.error ||
          `Test ${name} did not meet its success criteria`,
      } : {}),
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      name,
      status: "failed",
      passed: false,
      durationMs: Date.now() - started,
      result: null,
      error: error?.message || "Unknown autonomous test error",
      timestamp: now(),
    };
  }
}

function summarizeTests(tests: AutonomousTestResult[]) {
  return {
    total: tests.length,
    passed: tests.filter((test) => test.status === "passed").length,
    failed: tests.filter((test) => test.status === "failed").length,
    partial: tests.filter((test) => test.status === "partial").length,
    skipped: tests.filter((test) => test.status === "skipped").length,
    durationMs: tests.reduce((sum, test) => sum + test.durationMs, 0),
  };
}

function buildRecommendation(summary: {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}) {
  if (summary.failed > 0) {
    return "Unele teste autonome au eșuat. Nu folosi acele sisteme ca verificate până nu reparăm erorile.";
  }

  if (summary.passed === summary.total) {
    return "Testele autonome au trecut. Atenție: asta nu confirmă build-ul complet.";
  }

  return "Testele autonome sunt parțiale. Verifică rezultatele înainte să continui.";
}

export async function testAwarenessSystem() {
  return safeTest("awareness", async () => {
    const awareness: any = await buildAwarenessState();

    return {
      checked: true,
      hasAwareness: Boolean(awareness),
      status: awareness?.status || "loaded",
      verified: awareness?.verified ?? false,
      confidence: awareness?.confidence ?? 0,
      sourceStatuses: awareness?.sourceStatuses || {},
      sourceErrors: awareness?.sourceErrors || [],
    };
  });
}

export async function testLongTermMemorySystem() {
  return safeTest("long_term_memory", async () => {
    const memory: any = await buildLongTermMemory();

    return {
      checked: true,
      hasMemory: Boolean(memory),
      status: memory?.status || "loaded",
      memoryHealth: memory?.memoryHealth || "unknown",
      counts: {
        conversations:
          memory?.memory?.conversations ??
          memory?.conversations ??
          0,
        summaries:
          memory?.memory?.summaries ??
          memory?.summaries ??
          0,
        goals:
          memory?.memory?.goals ??
          memory?.goals ??
          0,
      },
    };
  });
}

export async function testGoalManagerSystem() {
  return safeTest("goal_manager", async () => {
    const goals: any = await manageAutonomousGoals();

    return {
      checked: true,
      hasGoals: Boolean(goals),
      status: goals?.status || "loaded",
      activeMission: goals?.activeMission || null,
      nextAction: goals?.nextAction || null,
      goalCount:
        Array.isArray(goals?.goals)
          ? goals.goals.length
          : Number(goals?.goalCount || 0),
    };
  });
}

export async function testDecisionEngineSystem() {
  return safeTest("decision_engine", async () => {
    const decision: any = await makeAutonomousDecision({
      errors: 0,
      memoryLoad: 30,
      pendingUpgrades: 0,
      weakSkills: [],
      activeGoals: 0,
    } as any);

    return {
      checked: true,
      hasDecision: Boolean(decision),
      decision,
      priority:
        decision?.priority ||
        decision?.decision?.priority ||
        "monitor",
    };
  });
}

export async function testAgentWorkflowSystem() {
  return safeTest("agent_workflow", async () => {
    const orchestrator: any = await import("./agent-orchestrator");

    const workflow =
      typeof orchestrator.executeAgentWorkflow === "function"
        ? await orchestrator.executeAgentWorkflow("monitor")
        : {
            status: "skipped",
            reason: "No agent workflow function found",
          };

    return {
      checked: true,
      workflow,
    };
  });
}

export async function testMemoryStoreWriteSystem() {
  return safeTest("memory_store_write", async () => {
    const reflection = await createAutonomousReflection(
      "Autonomous test reflection",
      "Awenia autonomous testing system checked runtime modules.",
      "This reflection does not mean build passed."
    );

    return {
      checked: true,
      reflection,
    };
  });
}

export async function runAutonomousTests(): Promise<AutonomousTestReport> {
  const started = Date.now();

  const tests: AutonomousTestResult[] = [];

  tests.push(await testAwarenessSystem());
  tests.push(await testLongTermMemorySystem());
  tests.push(await testGoalManagerSystem());
  tests.push(await testDecisionEngineSystem());
  tests.push(await testAgentWorkflowSystem());
  tests.push(await testMemoryStoreWriteSystem());

  const summary = summarizeTests(tests);

  const status: AutonomousTestStatus =
    summary.passed === summary.total
      ? "passed"
      : summary.failed === summary.total
        ? "failed"
        : "partial";

  const report: AutonomousTestReport = {
    status,
    passed: status === "passed",
    tests,
    summary: {
      ...summary,
      durationMs: Date.now() - started,
    },
    recommendation: buildRecommendation(summary),
    truthPolicy: {
      noFakeTests: true,
      failedTestMustBeReported: true,
      buildStatusNotCheckedHere: true,
    },
    timestamp: now(),
  };

  if (summary.failed > 0) {
    try {
      const failedTests = tests
        .filter((test) => test.status === "failed")
        .map((test) => test.name)
        .sort();
      const { getEvolutionSuggestions } = await import("./memory-store");
      const previousSuggestions = await getEvolutionSuggestions(200);
      const duplicate = previousSuggestions.some((item: any) => {
        const previousFailures = item?.metadata?.failedTests;
        return item?.status === "pending" &&
          item?.suggestion === "Fix autonomous testing failures" &&
          item?.metadata?.source === "autonomous-testing" &&
          Array.isArray(previousFailures) &&
          JSON.stringify([...previousFailures].sort()) === JSON.stringify(failedTests);
      });
      if (!duplicate) {
        await createEvolutionSuggestion({
          suggestion: "Fix autonomous testing failures",
          reason: report.recommendation,
          priority: 8,
          status: "pending",
          metadata: {
            source: "autonomous-testing",
            failedTests,
          },
        });
      }
    } catch { }
  }

  return report;
}

export async function runAutonomousTesting() {
  return runAutonomousTests();
}

export async function buildAutonomousTestReport() {
  return runAutonomousTests();
}

export async function getAutonomousTestingState() {
  return {
    status: "ready",
    availableTests: [
      "awareness",
      "long_term_memory",
      "goal_manager",
      "decision_engine",
      "agent_workflow",
      "memory_store_write",
    ],
    truthPolicy: {
      testsDoNotConfirmBuild: true,
      testsDoNotConfirmBrowser: true,
      failedTestMustBeReported: true,
    },
    timestamp: now(),
  };
}

export async function buildAutonomousTestingContext() {
  const state = await getAutonomousTestingState();

  return [
    "AUTONOMOUS TESTING",
    `Status: ${state.status}`,
    `Tests: ${state.availableTests.join(", ")}`,
    "Atenție: aceste teste nu confirmă build-ul complet.",
  ].join("\n");
}

export const autonomousTests = runAutonomousTests;
export const autonomousTesting = runAutonomousTesting;
export const runAutonomousTestSuite = runAutonomousTests;
export const getAutonomousTestsState = getAutonomousTestingState;

export default runAutonomousTests;