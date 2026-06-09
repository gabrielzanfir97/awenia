export function makeAutonomousDecision(systemState: {
  errors?: number;
  memoryLoad?: number;
  pendingUpgrades?: number;
  weakSkills?: string[];
  activeGoals?: number;
}) {
  const errors = systemState.errors || 0;
  const memoryLoad = systemState.memoryLoad || 0;
  const pendingUpgrades =
    systemState.pendingUpgrades || 0;

  const weakSkills =
    systemState.weakSkills || [];

  const activeGoals =
    systemState.activeGoals || 0;

  if (errors > 0) {
    return {
      priority: "debug",
      action: "Run debugger workflow",
      reason: "System errors detected",
    };
  }

  if (weakSkills.includes("coding")) {
    return {
      priority: "coding",
      action: "Improve coding ability",
      reason: "Coding identified as weak skill",
    };
  }

  if (memoryLoad > 80) {
    return {
      priority: "memory",
      action: "Run memory optimization",
      reason: "Memory load is high",
    };
  }

  if (pendingUpgrades > 0) {
    return {
      priority: "upgrade",
      action: "Review evolution suggestions",
      reason: "Pending upgrades detected",
    };
  }

  if (activeGoals > 0) {
    return {
      priority: "goal",
      action: "Continue active goals",
      reason: "Active goals available",
    };
  }

  return {
    priority: "monitor",
    action: "Continue autonomous monitoring",
    reason: "No higher priority detected",
  };
}