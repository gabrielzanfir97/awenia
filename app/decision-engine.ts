export function makeAutonomousDecision(systemState: {
  errors?: number;
  memoryLoad?: number;
  pendingUpgrades?: number;
  weakSkills?: string[];
  activeGoals?: number;
}) {
  const scores = {
    debug: 0,
    coding: 0,
    memory: 0,
    upgrade: 0,
    goal: 0,
    monitor: 1,
  };

  const errors = systemState.errors || 0;
  const memoryLoad = systemState.memoryLoad || 0;
  const pendingUpgrades =
    systemState.pendingUpgrades || 0;

  const weakSkills =
    systemState.weakSkills || [];

  const activeGoals =
    systemState.activeGoals || 0;

  scores.debug += errors * 100;

  if (weakSkills.includes("coding")) {
    scores.coding += 80;
  }

  scores.memory += Math.floor(memoryLoad);

  scores.upgrade += pendingUpgrades * 15;

  scores.goal += activeGoals * 10;

  const winner = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  const priority = winner[0];

  if (priority === "debug") {
    return {
      priority,
      action: "Run debugger workflow",
      reason: `Detected ${errors} system errors`,
      scores,
    };
  }

  if (priority === "coding") {
    return {
      priority,
      action: "Improve coding ability",
      reason: "Coding skill requires improvement",
      scores,
    };
  }

  if (priority === "memory") {
    return {
      priority,
      action: "Run memory optimization",
      reason: `Memory load is ${memoryLoad}%`,
      scores,
    };
  }

  if (priority === "upgrade") {
    return {
      priority,
      action: "Review evolution suggestions",
      reason: `${pendingUpgrades} upgrades pending`,
      scores,
    };
  }

  if (priority === "goal") {
    return {
      priority,
      action: "Continue active goals",
      reason: `${activeGoals} active goals detected`,
      scores,
    };
  }

  return {
    priority: "monitor",
    action: "Continue autonomous monitoring",
    reason: "System appears stable",
    scores,
  };
}