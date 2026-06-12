import { getAutonomousGoals } from "./memory-store";

export async function manageAutonomousGoals() {
  const goals = await getAutonomousGoals(10);

  const activeGoals = goals
    .filter((goal: any) => goal.status === "active")
    .map((goal: any) => ({
      id: goal.id,
      name: goal.goal,
      description: goal.description,
      priority: goal.priority || 5,
      progress: goal.progress || 0,
      status: goal.status,

      health:
        (goal.progress || 0) >= 80
          ? "near_completion"
          : (goal.progress || 0) <= 10
          ? "stalled_or_starting"
          : "in_progress",

      urgency:
        (goal.priority || 5) >= 8
          ? "high"
          : (goal.priority || 5) >= 5
          ? "medium"
          : "low",
    }));

  const sortedGoals = activeGoals.sort((a, b) => {
    const priorityDiff = b.priority - a.priority;

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.progress - b.progress;
  });

  const topGoal = sortedGoals[0];

  return {
    goals: sortedGoals,

    activeMission:
      topGoal?.name || "Continuous autonomous evolution",

    nextAction:
      topGoal
        ? topGoal.health === "near_completion"
          ? `Finish goal: ${topGoal.name}`
          : topGoal.health === "stalled_or_starting"
          ? `Start or unblock goal: ${topGoal.name}`
          : `Continue goal: ${topGoal.name}`
        : "Create or review autonomous goals",

    goalAnalysis: {
      totalActiveGoals: sortedGoals.length,
      highUrgencyGoals: sortedGoals.filter(
        (goal) => goal.urgency === "high"
      ).length,
      stalledGoals: sortedGoals.filter(
        (goal) => goal.health === "stalled_or_starting"
      ).length,
      nearCompletionGoals: sortedGoals.filter(
        (goal) => goal.health === "near_completion"
      ).length,
    },

    hasRealGoals: sortedGoals.length > 0,

    timestamp: new Date().toISOString(),
  };
}