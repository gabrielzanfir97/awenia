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
    }));

  const topGoal = activeGoals[0];

  return {
    goals: activeGoals,

    activeMission:
      topGoal?.name || "Continuous autonomous evolution",

    nextAction:
      topGoal
        ? `Continue goal: ${topGoal.name}`
        : "Create or review autonomous goals",

    hasRealGoals: activeGoals.length > 0,

    timestamp: new Date().toISOString(),
  };
}