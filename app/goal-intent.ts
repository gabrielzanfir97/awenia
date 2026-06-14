import {
  createAutonomousGoal,
  getAutonomousGoals,
  createAutonomousReflection,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type GoalIntentStatus =
  | "detected"
  | "not_detected"
  | "created"
  | "duplicate"
  | "needs_attention"
  | "failed";

export type GoalIntentType =
  | "create_goal"
  | "continue_goal"
  | "update_goal"
  | "complete_goal"
  | "prioritize_goal"
  | "unknown";

export type GoalIntent = {
  status: GoalIntentStatus;
  type: GoalIntentType;
  shouldAct: boolean;
  goal: string;
  priority: number;
  confidence: number;
  reason: string;
  progress?: number;
  deadline?: string;
  source: "user" | "system";
  timestamp: string;
};

const CREATE_GOAL_TRIGGERS = [
  "vreau să fac",
  "vreau sa fac",
  "obiectivul meu",
  "scopul meu",
  "setează obiectiv",
  "seteaza obiectiv",
  "creează obiectiv",
  "creeaza obiectiv",
  "goal:",
  "new goal",
  "create goal",
  "my goal is",
];

const CONTINUE_GOAL_TRIGGERS = [
  "continuă obiectivul",
  "continua obiectivul",
  "continuăm obiectivul",
  "continuam obiectivul",
  "hai să continuăm",
  "hai sa continuam",
  "continue goal",
  "resume goal",
];

const UPDATE_GOAL_TRIGGERS = [
  "actualizează obiectivul",
  "actualizeaza obiectivul",
  "update goal",
  "schimbă obiectivul",
  "schimba obiectivul",
  "progres",
  "progress",
];

const COMPLETE_GOAL_TRIGGERS = [
  "am terminat obiectivul",
  "obiectiv complet",
  "complete goal",
  "goal completed",
  "finished goal",
];

const PRIORITY_WORDS = [
  "urgent",
  "important",
  "awenia",
  "cod",
  "code",
  "build",
  "eroare",
  "bug",
  "memorie",
  "memory",
  "autonomie",
  "business",
  "familie",
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function includesAny(message: string, triggers: string[]) {
  const lower = normalize(message);
  return triggers.some((trigger) => lower.includes(trigger));
}

function detectGoalIntentType(message: string): GoalIntentType {
  if (includesAny(message, COMPLETE_GOAL_TRIGGERS)) return "complete_goal";
  if (includesAny(message, UPDATE_GOAL_TRIGGERS)) return "update_goal";
  if (includesAny(message, CONTINUE_GOAL_TRIGGERS)) return "continue_goal";
  if (includesAny(message, CREATE_GOAL_TRIGGERS)) return "create_goal";

  return "unknown";
}

function extractGoal(message: string) {
  let goal = message.trim();

  const allTriggers = [
    ...CREATE_GOAL_TRIGGERS,
    ...CONTINUE_GOAL_TRIGGERS,
    ...UPDATE_GOAL_TRIGGERS,
    ...COMPLETE_GOAL_TRIGGERS,
  ];

  for (const trigger of allTriggers) {
    goal = goal.replace(new RegExp(trigger, "i"), "").trim();
  }

  return goal.replace(/^[:\-–—]+/, "").trim() || message.trim();
}

function detectPriority(message: string, type: GoalIntentType) {
  const lower = normalize(message);

  let priority = 5;

  for (const word of PRIORITY_WORDS) {
    if (lower.includes(word)) priority += 1;
  }

  if (type === "complete_goal") priority += 2;
  if (type === "update_goal") priority += 1;
  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("awenia")) priority += 2;

  return Math.max(1, Math.min(10, priority));
}

function detectProgress(message: string) {
  const percentMatch = message.match(/(\d{1,3})\s*%/);

  if (!percentMatch) return undefined;

  const progress = Number(percentMatch[1]);

  if (Number.isNaN(progress)) return undefined;

  return Math.max(0, Math.min(100, progress));
}

function detectDeadline(message: string) {
  const dateMatch = message.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  if (dateMatch?.[1]) return dateMatch[1];

  if (normalize(message).includes("azi")) return "today";
  if (normalize(message).includes("mâine")) return "tomorrow";
  if (normalize(message).includes("maine")) return "tomorrow";
  if (normalize(message).includes("săptămâna asta")) return "this_week";
  if (normalize(message).includes("saptamana asta")) return "this_week";

  return undefined;
}

function calculateConfidence(type: GoalIntentType, goal: string) {
  if (type === "unknown") return 0;

  let confidence = 55;

  if (goal.length > 10) confidence += 15;
  if (goal.length > 40) confidence += 10;
  if (type === "create_goal") confidence += 10;
  if (type === "complete_goal") confidence += 10;

  return Math.max(0, Math.min(100, confidence));
}

async function createGoalSafely(goal: string, priority: number) {
  const creator = createAutonomousGoal as any;

  try {
    return await creator(goal, priority);
  } catch {
    try {
      return await creator({
        goal,
        priority,
        status: "active",
        progress: 0,
      });
    } catch {
      return await creator(goal);
    }
  }
}

async function isDuplicateGoal(goal: string) {
  const goals = await getAutonomousGoals(50);
  const signature = normalize(goal).slice(0, 120);

  return goals.some((item: any) =>
    normalize(`${item.goal || ""}`).includes(signature)
  );
}

async function shouldSaveGoalSuggestion(goal: string, action: string) {
  const recent = await getEvolutionSuggestions(20);
  const signature = normalize(`${goal} ${action}`).slice(0, 80);

  return !recent.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(
      signature
    )
  );
}

export function analyzeGoalIntent(
  message: string,
  source: "user" | "system" = "user"
): GoalIntent {
  const type = detectGoalIntentType(message);
  const goal = extractGoal(message);
  const progress = detectProgress(message);
  const deadline = detectDeadline(message);
  const priority = detectPriority(message, type);
  const confidence = calculateConfidence(type, goal);
  const shouldAct = type !== "unknown";

  return {
    status: shouldAct ? "detected" : "not_detected",
    type,
    shouldAct,
    goal,
    priority,
    confidence,
    reason: shouldAct
      ? `Goal intent detected: ${type}`
      : "No goal intent detected",
    progress,
    deadline,
    source,
    timestamp: now(),
  };
}

export async function runGoalIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  const intent = analyzeGoalIntent(message, source);

  if (!intent.shouldAct) {
    return {
      status: "not_detected" as GoalIntentStatus,
      intent,
      acted: false,
      timestamp: now(),
    };
  }

  try {
    if (intent.type === "create_goal") {
      const duplicate = await isDuplicateGoal(intent.goal);

      if (duplicate) {
        return {
          status: "duplicate" as GoalIntentStatus,
          intent,
          acted: false,
          duplicate: true,
          timestamp: now(),
        };
      }

      const savedGoal = await createGoalSafely(intent.goal, intent.priority);

      await createAutonomousReflection(
        `Goal created: ${intent.goal}`,
        `Priority: ${intent.priority}. Source: ${source}.`,
        "Connect this goal to awareness, memory and next actions"
      );

      let suggestionSaved = false;

      if (
        intent.priority >= 8 &&
        (await shouldSaveGoalSuggestion(intent.goal, "Create goal execution plan"))
      ) {
        await createEvolutionSuggestion(
          `Goal needs execution plan: ${intent.goal}`,
          `A goal was created with priority ${intent.priority}.`,
          intent.priority
        );

        suggestionSaved = true;
      }

      return {
        status: "created" as GoalIntentStatus,
        intent,
        acted: true,
        savedGoal,
        suggestionSaved,
        timestamp: now(),
      };
    }

    if (
      intent.type === "continue_goal" ||
      intent.type === "update_goal" ||
      intent.type === "complete_goal" ||
      intent.type === "prioritize_goal"
    ) {
      const goals = await getAutonomousGoals(50);

      const matchingGoal =
        goals.find((item: any) =>
          normalize(`${item.goal || ""}`).includes(normalize(intent.goal).slice(0, 80))
        ) || goals.find((item: any) => item.status === "active");

      await createAutonomousReflection(
        `Goal intent: ${intent.type}`,
        `Goal: ${intent.goal}. Matching goal: ${matchingGoal?.goal || "none"
        }. Progress: ${intent.progress ?? "not specified"}. Deadline: ${intent.deadline || "not specified"
        }.`,
        intent.type === "complete_goal"
          ? "Review and mark goal completion if confirmed by Gabi"
          : "Continue or update the active goal carefully"
      );

      if (
        intent.priority >= 7 &&
        (await shouldSaveGoalSuggestion(intent.goal, intent.type))
      ) {
        await createEvolutionSuggestion(
          `Goal update needed: ${intent.goal}`,
          `Goal intent ${intent.type} detected. Progress: ${intent.progress ?? "not specified"
          }.`,
          intent.priority
        );
      }

      return {
        status: "created" as GoalIntentStatus,
        intent,
        acted: true,
        action: intent.type,
        matchingGoal: matchingGoal || null,
        note:
          "Goal update was saved as reflection/suggestion. Direct database update should be done only through verified goal update functions.",
        timestamp: now(),
      };
    }

    return {
      status: "needs_attention" as GoalIntentStatus,
      intent,
      acted: false,
      reason: "Goal intent type is not executable yet",
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as GoalIntentStatus,
      intent,
      acted: false,
      error: error?.message || "Unknown goal intent error",
      timestamp: now(),
    };
  }
}

export function shouldCreateAutonomousGoal(message: string) {
  return analyzeGoalIntent(message).type === "create_goal";
}

export function shouldUpdateAutonomousGoal(message: string) {
  const type = analyzeGoalIntent(message).type;

  return (
    type === "update_goal" ||
    type === "continue_goal" ||
    type === "complete_goal" ||
    type === "prioritize_goal"
  );
}

export function extractAutonomousGoal(message: string) {
  return analyzeGoalIntent(message).goal;
}

export function getGoalPriority(message: string) {
  return analyzeGoalIntent(message).priority;
}

export function buildGoalIntentPlan(message: string) {
  const intent = analyzeGoalIntent(message);

  return {
    intent,

    steps: [
      {
        step: 1,
        action: "Detect goal intent",
        reason: intent.reason,
      },
      {
        step: 2,
        action: "Check duplicate active goals",
        reason: "Awenia must not create repeated goals",
      },
      {
        step: 3,
        action: "Save goal or save goal reflection",
        reason: "Goal changes must be remembered",
      },
      {
        step: 4,
        action: "Connect goal to awareness and autonomous runtime",
        reason: "Goals must guide future decisions",
      },
    ],

    truthPolicy: {
      noFakeGoalCreation: true,
      noClaimGoalSavedWithoutDatabaseWrite: true,
      noGoalCompletionWithoutGabiConfirmation: true,
    },

    timestamp: now(),
  };
}

export function detectGoalIntent(message: string) {
  return analyzeGoalIntent(message);
}

export async function createGoalFromIntent(message: string) {
  return runGoalIntent(message);
}