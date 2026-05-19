export function adaptSystemBehavior(
  systemState: {
    errors?: number;
    memoryLoad?: number;
    successfulCycles?: number;
  }
) {
  let mode = "stable";

  if ((systemState.errors || 0) > 5) {
    mode = "recovery";
  }

  if ((systemState.memoryLoad || 0) > 80) {
    mode = "optimization";
  }

  if ((systemState.successfulCycles || 0) > 10) {
    mode = "expansion";
  }

  return {
    adaptiveMode: mode,

    adjustments: {
      prioritizeSafety: mode === "recovery",
      optimizeMemory: mode === "optimization",
      increaseAutonomy: mode === "expansion",
    },

    timestamp: new Date().toISOString(),
  };
}