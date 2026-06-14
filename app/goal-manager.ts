import { getAutonomousGoals } from "./memory-store";

export type GoalHealth =
  | "healthy"
  | "near_completion"
  | "stalled"
  | "urgent"
  | "inactive"
  | "unknown";

export type GoalUrgency = "low" | "medium" | "high" | "critical";

export type GoalExecutionStep = {
  step: number;
  action: string;
  reason: string;
};

export type ManagedGoal = {
  id?: string;
  goal: string;
  status: string;
  priority: number;
  progress: number;
  health: GoalHealth;
  urgency: GoalUrgency;
  score: number;
  reason: string;
  nextAction: string;
  createdAt?: string;
  updatedAt?: string;
  raw: any;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizePriority(priority: any) {
  const value = Number(priority || 5);
  return Math.max(1, Math.min(10, value));
}

function normalizeProgress(progress: any) {
  return clamp(Number(progress || 0), 0, 100);
}

function daysSince(date?: string) {
  if (!date) return null;

  const parsed = new Date(date).getTime();

  if (Number.isNaN(parsed)) return null;

  const diff = Date.now() - parsed;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function detectGoalHealth(goal: any): GoalHealth {
  const status = goal.status || "unknown";
  const progress = normalizeProgress(goal.progress);
  const priority = normalizePriority(goal.priority);
  const lastUpdateDays = daysSince(goal.updated_at || goal.created_at);

  if (status !== "active") {
    return "inactive";
  }

  if (progress >= 85) {
    return "near_completion";
  }

  if (priority >= 9 && progress < 50) {
    return "urgent";
  }

  if (
    lastUpdateDays !== null &&
    lastUpdateDays >= 14 &&
    progress < 60
  ) {
    return "stalled";
  }

  return "healthy";
}

function detectGoalUrgency(goal: any, health: GoalHealth): GoalUrgency {
  const priority = normalizePriority(goal.priority);
  const progress = normalizeProgress(goal.progress);

  if (health === "urgent") return "critical";
  if (health === "stalled" && priority >= 8) return "critical";
  if (priority >= 9) return "high";
  if (priority >= 7 && progress < 70) return "high";
  if (priority >= 5) return "medium";

  return "low";
}

function scoreGoal(goal: any, health: GoalHealth, urgency: GoalUrgency) {
  const priority = normalizePriority(goal.priority);
  const progress = normalizeProgress(goal.progress);

  let score = priority * 10;

  if (urgency === "critical") score += 40;
  if (urgency === "high") score += 25;
  if (urgency === "medium") score += 10;

  if (health === "near_completion") score += 20;
  if (health === "urgent") score += 30;
  if (health === "stalled") score += 15;

  score += Math.max(0, 100 - progress) * 0.2;

  return Math.round(score);
}

function buildGoalReason(goal: any, health: GoalHealth, urgency: GoalUrgency) {
  const priority = normalizePriority(goal.priority);
  const progress = normalizeProgress(goal.progress);

  return `Priority ${priority}/10, progress ${progress}%, health ${health}, urgency ${urgency}`;
}

function buildNextAction(goal: any, health: GoalHealth) {
  const goalText = goal.goal || "Unnamed goal";

  if (health === "near_completion") {
    return `Finish final steps for: ${goalText}`;
  }

  if (health === "stalled") {
    return `Restart stalled goal with one small concrete action: ${goalText}`;
  }

  if (health === "urgent") {
    return `Focus immediately on high-priority goal: ${goalText}`;
  }

  if (health === "inactive") {
    return `Review whether this goal should stay active: ${goalText}`;
  }

  return `Continue progress on: ${goalText}`;
}

function analyzeGoal(goal: any): ManagedGoal {
  const health = detectGoalHealth(goal);
  const urgency = detectGoalUrgency(goal, health);
  const score = scoreGoal(goal, health, urgency);

  return {
    id: goal.id,
    goal: goal.goal || "Unnamed goal",
    status: goal.status || "unknown",
    priority: normalizePriority(goal.priority),
    progress: normalizeProgress(goal.progress),
    health,
    urgency,
    score,
    reason: buildGoalReason(goal, health, urgency),
    nextAction: buildNextAction(goal, health),
    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
    raw: goal,
  };
}

function buildExecutionPlan(mainGoal: ManagedGoal | null): GoalExecutionStep[] {
  if (!mainGoal) {
    return [
      {
        step: 1,
        action: "Create or activate a clear autonomous goal",
        reason: "No active goal was found",
      },
      {
        step: 2,
        action: "Connect goal to memory and awareness",
        reason: "Awenia needs a real mission to continue autonomous work",
      },
    ];
  }

  return [
    {
      step: 1,
      action: "Confirm goal state",
      reason: mainGoal.reason,
    },
    {
      step: 2,
      action: mainGoal.nextAction,
      reason: `This goal has the highest score: ${mainGoal.score}`,
    },
    {
      step: 3,
      action: "Save progress after action",
      reason: "Goal progress must update memory and awareness",
    },
  ];
}

export async function manageAutonomousGoals() {
  const startedAt = new Date().toISOString();

  try {
    const rawGoals = await getAutonomousGoals(50);

    const analyzedGoals = rawGoals.map(analyzeGoal);

    const activeGoals = analyzedGoals
      .filter((goal) => goal.status === "active")
      .sort((a, b) => b.score - a.score);

    const inactiveGoals = analyzedGoals.filter(
      (goal) => goal.status !== "active"
    );

    const highUrgencyGoals = activeGoals.filter(
      (goal) => goal.urgency === "high" || goal.urgency === "critical"
    );

    const stalledGoals = activeGoals.filter(
      (goal) => goal.health === "stalled"
    );

    const nearCompletionGoals = activeGoals.filter(
      (goal) => goal.health === "near_completion"
    );

    const mainGoal = activeGoals[0] || null;

    const executionPlan = buildExecutionPlan(mainGoal);

    return {
      goals: analyzedGoals,

      activeGoals,

      inactiveGoals,

      activeMission: mainGoal
        ? mainGoal.goal
        : "No active mission detected",

      nextAction: mainGoal
        ? mainGoal.nextAction
        : "Create or review autonomous goals",

      executionPlan,

      goalAnalysis: {
        totalGoals: analyzedGoals.length,
        totalActiveGoals: activeGoals.length,
        totalInactiveGoals: inactiveGoals.length,
        highUrgencyGoals: highUrgencyGoals.length,
        stalledGoals: stalledGoals.length,
        nearCompletionGoals: nearCompletionGoals.length,
        strongestGoal: mainGoal,
        averageProgress:
          activeGoals.length > 0
            ? Math.round(
              activeGoals.reduce(
                (sum, goal) => sum + goal.progress,
                0
              ) / activeGoals.length
            )
            : 0,
      },

      health: {
        hasUrgentGoals: highUrgencyGoals.length > 0,
        hasStalledGoals: stalledGoals.length > 0,
        hasNearCompletionGoals: nearCompletionGoals.length > 0,
        needsNewGoal: activeGoals.length === 0,
      },

      hasRealGoals: activeGoals.length > 0,

      status:
        activeGoals.length === 0
          ? "no_active_goals"
          : highUrgencyGoals.length > 0
            ? "urgent"
            : stalledGoals.length > 0
              ? "needs_attention"
              : "active",

      source: {
        verified: true,
        status: rawGoals.length > 0 ? "connected" : "empty",
        error: null,
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      goals: [],
      activeGoals: [],
      inactiveGoals: [],

      activeMission: "Goal manager failed",

      nextAction: "Repair goal manager or Supabase goal source",

      executionPlan: [
        {
          step: 1,
          action: "Check getAutonomousGoals()",
          reason: "Goal manager could not read goals",
        },
        {
          step: 2,
          action: "Check Supabase autonomous goals table",
          reason: "Goal source may be unavailable",
        },
      ],

      goalAnalysis: {
        totalGoals: 0,
        totalActiveGoals: 0,
        totalInactiveGoals: 0,
        highUrgencyGoals: 0,
        stalledGoals: 0,
        nearCompletionGoals: 0,
        strongestGoal: null,
        averageProgress: 0,
      },

      health: {
        hasUrgentGoals: false,
        hasStalledGoals: false,
        hasNearCompletionGoals: false,
        needsNewGoal: false,
      },

      hasRealGoals: false,

      status: "failed",

      source: {
        verified: false,
        status: "failed",
        error: error?.message || "Unknown goal manager error",
      },

      execution: {
        startedAt,
        completedAt: new Date().toISOString(),
      },

      timestamp: new Date().toISOString(),
    };
  }
}