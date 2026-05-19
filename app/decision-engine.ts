export function makeAutonomousDecision(
  systemState: {
    errors?: number;
    memoryLoad?: number;
    pendingUpgrades?: number;
  }
) {
  if ((systemState.errors || 0) > 0) {
    return {
      priority: "debug",
      action: "Run debugger workflow",
    };
  }

  if ((systemState.memoryLoad || 0) > 80) {
    return {
      priority: "memory",
      action: "Run memory optimization",
    };
  }

  if ((systemState.pendingUpgrades || 0) > 0) {
    return {
      priority: "upgrade",
      action: "Run upgrade workflow",
    };
  }

  return {
    priority: "monitor",
    action: "Continue autonomous monitoring",
  };
}