import { buildAwarenessState } from "./awareness";
import { buildLongTermMemory } from "./long-term-memory";
import { manageAutonomousGoals } from "./goal-manager";
import { makeAutonomousDecision } from "./decision-engine";

import { coordinateAgents } from "./agent-orchestrator";

import { runSelfImprovementCycle } from "./self-improvement";
import { runAutonomousRuntime } from "./autonomous-runtime";
import { runEvolutionRuntime } from "./evolution-runtime";
import { runBackgroundWorker } from "./background-worker";
import { runAutonomousLoop } from "./autonomous-loop";
import { runAutonomousTests } from "./autonomous-testing";

import { runInternetLearning } from "./internet-learning";

import { buildCognitiveArchitecture } from "./cognitive-architecture";
import { adaptSystemBehavior } from "./adaptive-intelligence";
import { optimizeCognition } from "./cognitive-optimization";
import { runAIEcosystem } from "./ai-ecosystem";
import { runGlobalCognition } from "./global-cognition";
import { runOmniscientCognition } from "./omniscient-cognition";

import { runSuperIntelligenceFramework } from "./super-intelligence";
import { runIntelligenceCivilization } from "./intelligence-civilization";
import { runInfiniteEvolutionFramework } from "./infinite-evolution";
import { runTranscendenceArchitecture } from "./transcendence";

export type CognitionRuntimeMode =
  | "off"
  | "light"
  | "standard"
  | "full"
  | "test";

export type CognitionRuntimeStatus =
  | "skipped"
  | "completed"
  | "partial"
  | "failed";

export type CognitionRuntimeInput = {
  message?: string;
  activeSkill?: string;
  pendingEvolutionCount?: number;
  mode?: CognitionRuntimeMode;
  includeInternet?: boolean;
  includeTests?: boolean;
  includeDeepCognition?: boolean;
  timeoutMs?: number;
};

export type CognitionStepStatus =
  | "completed"
  | "skipped"
  | "failed"
  | "timeout";

export type CognitionStepResult = {
  name: string;
  status: CognitionStepStatus;
  required: boolean;
  durationMs: number;
  result: any;
  error?: string;
  timestamp: string;
};

export type CognitionRuntimeResult = {
  status: CognitionRuntimeStatus;
  mode: CognitionRuntimeMode;
  activeSkill: string;
  pendingEvolutionCount: number;
  shouldRunHeavyCognition: boolean;
  steps: CognitionStepResult[];
  summary: {
    completed: number;
    failed: number;
    skipped: number;
    timedOut: number;
    totalDurationMs: number;
  };
  core: {
    awareness: any;
    memory: any;
    goals: any;
    decision: any;
    workflow: any;
  };
  optional: Record<string, any>;
  recommendation: string;
  truthPolicy: {
    noFakeCognitionStatus: boolean;
    skippedMeansNotRun: boolean;
    failedStepMustBeReported: boolean;
    heavyCognitionSkippedForSimpleMessages: boolean;
  };
  execution: {
    startedAt: string;
    completedAt: string;
  };
  timestamp: string;
};

let cognitionRuntimeRunning = false;

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeInput(
  activeSkillOrInput?: string | CognitionRuntimeInput,
  pendingEvolutionCount = 0
): CognitionRuntimeInput {
  if (typeof activeSkillOrInput === "string") {
    return {
      activeSkill: activeSkillOrInput,
      pendingEvolutionCount,
      mode: "standard",
    };
  }

  return {
    ...(activeSkillOrInput || {}),
    activeSkill: activeSkillOrInput?.activeSkill || "general",
    pendingEvolutionCount:
      activeSkillOrInput?.pendingEvolutionCount ??
      pendingEvolutionCount ??
      0,
    mode: activeSkillOrInput?.mode || "standard",
  };
}

function isSimpleMessage(message = "") {
  const clean = normalize(message);

  if (!clean) return false;

  return (
    clean === "bună" ||
    clean === "buna" ||
    clean === "salut" ||
    clean === "ok" ||
    clean === "da" ||
    clean === "nu" ||
    clean === "ok hai" ||
    clean.length <= 12
  );
}

function shouldRunHeavy(input: CognitionRuntimeInput) {
  if (input.mode === "off") return false;
  if (input.mode === "light") return false;
  if (input.mode === "full") return true;
  if (input.includeDeepCognition) return true;
  if (isSimpleMessage(input.message || "")) return false;

  const skill = normalize(input.activeSkill || "");

  return (
    skill.includes("coding") ||
    skill.includes("debug") ||
    skill.includes("memory") ||
    skill.includes("internet") ||
    skill.includes("evolution") ||
    skill.includes("security") ||
    skill.includes("planning") ||
    Number(input.pendingEvolutionCount || 0) > 0
  );
}

function shouldRunInternet(input: CognitionRuntimeInput) {
  if (input.includeInternet) return true;

  const skill = normalize(input.activeSkill || "");
  const message = normalize(input.message || "");

  return (
    skill.includes("internet") ||
    skill.includes("learning") ||
    message.includes("internet") ||
    message.includes("online") ||
    message.includes("caută") ||
    message.includes("cauta")
  );
}

function getArrayLength(value: any) {
  if (Array.isArray(value)) return value.length;
  return 0;
}

function getMemoryLoad(awareness: any) {
  return Number(
    awareness?.metrics?.memoryLoad ??
    awareness?.systemState?.memoryLoad ??
    awareness?.memoryLoad ??
    0
  );
}

function getWeakSkills(awareness: any) {
  if (Array.isArray(awareness?.weakSkills)) return awareness.weakSkills;
  if (Array.isArray(awareness?.metrics?.weakSkills)) {
    return awareness.metrics.weakSkills;
  }

  return [];
}

function getActiveGoalsCount(goals: any) {
  if (Array.isArray(goals?.activeGoals)) return goals.activeGoals.length;
  if (Array.isArray(goals?.goals)) return goals.goals.length;
  if (Array.isArray(goals)) return goals.length;

  return Number(goals?.activeGoals || goals?.goalCount || 0);
}

function buildTimeoutPromise(timeoutMs: number) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Step timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function safeStep(
  name: string,
  runner: () => Promise<any> | any,
  options?: {
    required?: boolean;
    timeoutMs?: number;
    skip?: boolean;
    skipReason?: string;
  }
): Promise<CognitionStepResult> {
  const started = Date.now();

  if (options?.skip) {
    return {
      name,
      status: "skipped",
      required: Boolean(options?.required),
      durationMs: 0,
      result: {
        reason: options.skipReason || "Skipped by cognition runtime plan",
      },
      timestamp: now(),
    };
  }

  try {
    const timeoutMs = options?.timeoutMs || 12000;

    const result = await Promise.race([
      Promise.resolve(runner()),
      buildTimeoutPromise(timeoutMs),
    ]);

    const nestedStatus = (result as { status?: unknown } | null)?.status;
    if (nestedStatus === "failed" || nestedStatus === "blocked") {
      return {
        name,
        status: "failed",
        required: Boolean(options?.required),
        durationMs: Date.now() - started,
        result,
        error: `Step ${name} returned ${nestedStatus}`,
        timestamp: now(),
      };
    }

    return {
      name,
      status: "completed",
      required: Boolean(options?.required),
      durationMs: Date.now() - started,
      result,
      timestamp: now(),
    };
  } catch (error: any) {
    const isTimeout = String(error?.message || "").includes("timed out");

    return {
      name,
      status: isTimeout ? "timeout" : "failed",
      required: Boolean(options?.required),
      durationMs: Date.now() - started,
      result: null,
      error: error?.message || "Unknown cognition step error",
      timestamp: now(),
    };
  }
}

function summarizeSteps(steps: CognitionStepResult[]) {
  return {
    completed: steps.filter((step) => step.status === "completed").length,
    failed: steps.filter((step) => step.status === "failed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    timedOut: steps.filter((step) => step.status === "timeout").length,
    totalDurationMs: steps.reduce(
      (sum, step) => sum + step.durationMs,
      0
    ),
  };
}

function getStepResult(steps: CognitionStepResult[], name: string) {
  return steps.find((step) => step.name === name)?.result || null;
}

function buildRecommendation(input: {
  mode: CognitionRuntimeMode;
  failed: number;
  timedOut: number;
  heavy: boolean;
}) {
  if (input.mode === "off") {
    return "Cognition runtime a fost oprit pentru acest mesaj.";
  }

  if (input.failed > 0 || input.timedOut > 0) {
    return "Unele sisteme cognitive au eșuat sau au expirat. Nu folosi acele rezultate ca verificate.";
  }

  if (!input.heavy) {
    return "A fost rulat cognition light. Sistemele grele au fost sărite intenționat.";
  }

  return "Cognition runtime a rulat și poate fi folosit ca context verificat intern.";
}

export function buildCognitionRuntimePlan(
  activeSkillOrInput?: string | CognitionRuntimeInput,
  pendingEvolutionCount = 0
) {
  const input = normalizeInput(activeSkillOrInput, pendingEvolutionCount);

  const heavy = shouldRunHeavy(input);
  const internet = shouldRunInternet(input);

  return {
    mode: input.mode || "standard",
    activeSkill: input.activeSkill || "general",
    pendingEvolutionCount: input.pendingEvolutionCount || 0,
    shouldRunHeavyCognition: heavy,
    shouldRunInternet: internet,
    includeTests: input.includeTests === true || input.mode === "test",
    includeDeepCognition:
      input.includeDeepCognition === true || input.mode === "full",
    timeoutMs: input.timeoutMs || 12000,
    steps: {
      core: [
        "awareness",
        "long_term_memory",
        "goals",
        "decision",
        "agent_workflow",
      ],
      standard: [
        "self_improvement",
        "autonomous_runtime",
        "evolution_runtime",
        "background_worker",
      ],
      internet: ["internet_learning"],
      tests: ["autonomous_tests"],
      deep: [
        "cognitive_architecture",
        "adaptive_intelligence",
        "cognitive_optimization",
        "ai_ecosystem",
        "global_cognition",
        "omniscient_cognition",
        "super_intelligence",
        "intelligence_civilization",
        "infinite_evolution",
        "transcendence",
        "autonomous_loop",
      ],
    },
    truthPolicy: {
      planDoesNotMeanExecuted: true,
      skippedStepsAreNotVerified: true,
      heavyCognitionSkippedForSimpleMessages: true,
    },
    timestamp: now(),
  };
}

export async function runCognitionRuntime(
  activeSkillOrInput?: string | CognitionRuntimeInput,
  pendingEvolutionCount = 0
): Promise<CognitionRuntimeResult> {
  const startedAt = now();
  const startedMs = Date.now();

  const input = normalizeInput(
    activeSkillOrInput,
    pendingEvolutionCount
  );

  const mode = input.mode || "standard";
  const timeoutMs = input.timeoutMs || 12000;
  const heavy = shouldRunHeavy(input);
  const runInternet = shouldRunInternet(input);
  const runTests = input.includeTests === true || mode === "test";
  const runDeep =
    input.includeDeepCognition === true || mode === "full";

  if (mode === "off") {
    return {
      status: "skipped",
      mode,
      activeSkill: input.activeSkill || "general",
      pendingEvolutionCount: input.pendingEvolutionCount || 0,
      shouldRunHeavyCognition: false,
      steps: [],
      summary: {
        completed: 0,
        failed: 0,
        skipped: 0,
        timedOut: 0,
        totalDurationMs: 0,
      },
      core: {
        awareness: null,
        memory: null,
        goals: null,
        decision: null,
        workflow: null,
      },
      optional: {},
      recommendation: buildRecommendation({
        mode,
        failed: 0,
        timedOut: 0,
        heavy: false,
      }),
      truthPolicy: {
        noFakeCognitionStatus: true,
        skippedMeansNotRun: true,
        failedStepMustBeReported: true,
        heavyCognitionSkippedForSimpleMessages: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }

  if (cognitionRuntimeRunning) {
    return {
      status: "skipped",
      mode,
      activeSkill: input.activeSkill || "general",
      pendingEvolutionCount: input.pendingEvolutionCount || 0,
      shouldRunHeavyCognition: false,
      steps: [],
      summary: {
        completed: 0,
        failed: 0,
        skipped: 1,
        timedOut: 0,
        totalDurationMs: 0,
      },
      core: {
        awareness: null,
        memory: null,
        goals: null,
        decision: null,
        workflow: null,
      },
      optional: {
        reason: "Cognition runtime already running. Anti-recursion guard stopped this run.",
      },
      recommendation:
        "Cognition runtime a fost oprit de protecția anti-recursie.",
      truthPolicy: {
        noFakeCognitionStatus: true,
        skippedMeansNotRun: true,
        failedStepMustBeReported: true,
        heavyCognitionSkippedForSimpleMessages: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }

  cognitionRuntimeRunning = true;

  const steps: CognitionStepResult[] = [];

  try {
    steps.push(
      await safeStep(
        "awareness",
        () => buildAwarenessState(),
        {
          required: true,
          timeoutMs,
        }
      )
    );

    steps.push(
      await safeStep(
        "long_term_memory",
        () => buildLongTermMemory(),
        {
          required: true,
          timeoutMs,
        }
      )
    );

    steps.push(
      await safeStep(
        "goals",
        () => manageAutonomousGoals(),
        {
          required: true,
          timeoutMs,
        }
      )
    );

    const awareness = getStepResult(steps, "awareness");
    const goals = getStepResult(steps, "goals");

    steps.push(
      await safeStep(
        "decision",
        () =>
          makeAutonomousDecision({
            errors: 0,
            memoryLoad: getMemoryLoad(awareness),
            pendingUpgrades: Number(input.pendingEvolutionCount || 0),
            weakSkills: getWeakSkills(awareness),
            activeGoals: getActiveGoalsCount(goals),
          }),
        {
          required: true,
          timeoutMs,
        }
      )
    );

    const decision = getStepResult(steps, "decision");

    steps.push(
      await safeStep(
        "agent_workflow",
        () =>
          coordinateAgents(
            decision?.priority ||
            decision?.decision?.priority ||
            input.activeSkill ||
            "monitor"
          ),
        {
          required: false,
          timeoutMs,
        }
      )
    );

    steps.push(
      await safeStep(
        "internet_learning",
        () =>
          runInternetLearning(
            input.message || input.activeSkill || "Awenia"
          ),
        {
          required: false,
          timeoutMs,
          skip: !runInternet,
          skipReason:
            "Internet learning only runs when internet/learning intent is detected.",
        }
      )
    );

    steps.push(
      await safeStep(
        "self_improvement",
        () => runSelfImprovementCycle(),
        {
          required: false,
          timeoutMs,
          skip: !heavy,
          skipReason:
            "Heavy cognition skipped for simple or low-risk message.",
        }
      )
    );

    steps.push(
      await safeStep(
        "autonomous_runtime",
        () => runAutonomousRuntime(),
        {
          required: false,
          timeoutMs,
          skip: !heavy,
          skipReason:
            "Autonomous runtime skipped because heavy cognition is not needed.",
        }
      )
    );

    steps.push(
      await safeStep(
        "evolution_runtime",
        () => runEvolutionRuntime(),
        {
          required: false,
          timeoutMs,
          skip:
            !heavy ||
            Number(input.pendingEvolutionCount || 0) <= 0,
          skipReason:
            "Evolution runtime runs only when heavy cognition and pending evolution exist.",
        }
      )
    );

    steps.push(
      await safeStep(
        "background_worker",
        () => runBackgroundWorker(),
        {
          required: false,
          timeoutMs,
          skip: !heavy,
          skipReason:
            "Background worker skipped in light cognition.",
        }
      )
    );

    steps.push(
      await safeStep(
        "autonomous_tests",
        () => runAutonomousTests(),
        {
          required: false,
          timeoutMs,
          skip: !runTests,
          skipReason:
            "Autonomous tests only run when requested.",
        }
      )
    );

    steps.push(
      await safeStep(
        "cognitive_architecture",
        () => buildCognitiveArchitecture(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Deep cognition only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "adaptive_intelligence",
        () => adaptSystemBehavior(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Deep cognition only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "cognitive_optimization",
        () => optimizeCognition(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Deep cognition only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "ai_ecosystem",
        () => runAIEcosystem(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Deep cognition only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "global_cognition",
        () => runGlobalCognition(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Global cognition only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "omniscient_cognition",
        () => runOmniscientCognition(
          undefined,
          steps.find((step) =>
            step.name === "global_cognition" && step.status === "completed"
          )?.result
        ),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Omniscient cognition only runs in full mode and must not be treated as real omniscience.",
        }
      )
    );

    steps.push(
      await safeStep(
        "super_intelligence",
        () => runSuperIntelligenceFramework(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Super intelligence layer only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "intelligence_civilization",
        () => runIntelligenceCivilization(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Intelligence civilization only runs in full mode.",
        }
      )
    );

    steps.push(
      await safeStep(
        "infinite_evolution",
        () => runInfiniteEvolutionFramework(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Infinite evolution only runs in full mode and remains controlled.",
        }
      )
    );

    steps.push(
      await safeStep(
        "transcendence",
        () => runTranscendenceArchitecture(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Transcendence layer only runs in full mode and remains symbolic/controlled.",
        }
      )
    );

    steps.push(
      await safeStep(
        "autonomous_loop",
        () => runAutonomousLoop(),
        {
          required: false,
          timeoutMs,
          skip: !runDeep,
          skipReason:
            "Autonomous loop only runs in full mode to avoid recursion and delay.",
        }
      )
    );

    const summary = summarizeSteps(steps);

    const status: CognitionRuntimeStatus =
      summary.failed > 0 || summary.timedOut > 0
        ? summary.completed > 0
          ? "partial"
          : "failed"
        : "completed";

    return {
      status,
      mode,
      activeSkill: input.activeSkill || "general",
      pendingEvolutionCount: input.pendingEvolutionCount || 0,
      shouldRunHeavyCognition: heavy,
      steps,
      summary,
      core: {
        awareness: getStepResult(steps, "awareness"),
        memory: getStepResult(steps, "long_term_memory"),
        goals: getStepResult(steps, "goals"),
        decision: getStepResult(steps, "decision"),
        workflow: getStepResult(steps, "agent_workflow"),
      },
      optional: {
        internetLearning: getStepResult(steps, "internet_learning"),
        selfImprovement: getStepResult(steps, "self_improvement"),
        autonomousRuntime: getStepResult(steps, "autonomous_runtime"),
        evolutionRuntime: getStepResult(steps, "evolution_runtime"),
        backgroundWorker: getStepResult(steps, "background_worker"),
        autonomousTests: getStepResult(steps, "autonomous_tests"),
        cognitiveArchitecture: getStepResult(
          steps,
          "cognitive_architecture"
        ),
        adaptiveIntelligence: getStepResult(
          steps,
          "adaptive_intelligence"
        ),
        cognitiveOptimization: getStepResult(
          steps,
          "cognitive_optimization"
        ),
        aiEcosystem: getStepResult(steps, "ai_ecosystem"),
        globalCognition: getStepResult(steps, "global_cognition"),
        omniscientCognition: getStepResult(
          steps,
          "omniscient_cognition"
        ),
        superIntelligence: getStepResult(steps, "super_intelligence"),
        intelligenceCivilization: getStepResult(
          steps,
          "intelligence_civilization"
        ),
        infiniteEvolution: getStepResult(steps, "infinite_evolution"),
        transcendence: getStepResult(steps, "transcendence"),
        autonomousLoop: getStepResult(steps, "autonomous_loop"),
      },
      recommendation: buildRecommendation({
        mode,
        failed: summary.failed,
        timedOut: summary.timedOut,
        heavy,
      }),
      truthPolicy: {
        noFakeCognitionStatus: true,
        skippedMeansNotRun: true,
        failedStepMustBeReported: true,
        heavyCognitionSkippedForSimpleMessages: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  } catch (error: any) {
    const summary = summarizeSteps(steps);

    return {
      status: "failed",
      mode,
      activeSkill: input.activeSkill || "general",
      pendingEvolutionCount: input.pendingEvolutionCount || 0,
      shouldRunHeavyCognition: heavy,
      steps,
      summary: {
        ...summary,
        totalDurationMs: Date.now() - startedMs,
      },
      core: {
        awareness: getStepResult(steps, "awareness"),
        memory: getStepResult(steps, "long_term_memory"),
        goals: getStepResult(steps, "goals"),
        decision: getStepResult(steps, "decision"),
        workflow: getStepResult(steps, "agent_workflow"),
      },
      optional: {
        error: error?.message || "Unknown cognition runtime error",
      },
      recommendation:
        "Cognition runtime a eșuat. Nu folosi rezultatele neverificate.",
      truthPolicy: {
        noFakeCognitionStatus: true,
        skippedMeansNotRun: true,
        failedStepMustBeReported: true,
        heavyCognitionSkippedForSimpleMessages: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  } finally {
    cognitionRuntimeRunning = false;
  }
}

export async function runLightCognitionRuntime(activeSkill = "general") {
  return runCognitionRuntime({
    activeSkill,
    mode: "light",
  });
}

export async function runFullCognitionRuntime(activeSkill = "general") {
  return runCognitionRuntime({
    activeSkill,
    mode: "full",
    includeDeepCognition: true,
    includeTests: true,
    includeInternet: true,
  });
}

export async function runTestCognitionRuntime(activeSkill = "general") {
  return runCognitionRuntime({
    activeSkill,
    mode: "test",
    includeTests: true,
  });
}

export function getCognitionRuntimeState() {
  return {
    status: cognitionRuntimeRunning ? "running" : "idle",
    antiRecursionGuard: cognitionRuntimeRunning,
    truthPolicy: {
      stateDoesNotMeanLastRunSucceeded: true,
      runResultRequiredForVerifiedStatus: true,
    },
    timestamp: now(),
  };
}

export const getCognitionRuntimePlan = buildCognitionRuntimePlan;
export const runCognition = runCognitionRuntime;
export const buildCognitionRuntime = runCognitionRuntime;
export const cognitionRuntime = runCognitionRuntime;

export default runCognitionRuntime;