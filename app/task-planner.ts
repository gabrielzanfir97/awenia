export function createTaskPlan(goal: string) {
  const lower = goal.toLowerCase();

  if (
    lower.includes("ui") ||
    lower.includes("button") ||
    lower.includes("design")
  ) {
    return {
      type: "ui",
      steps: [
        "Identify UI file",
        "Analyze current interface",
        "Generate minimal patch",
        "Request approval",
        "Apply patch",
      ],
    };
  }

  if (
    lower.includes("memory") ||
    lower.includes("embedding")
  ) {
    return {
      type: "memory",
      steps: [
        "Identify memory system",
        "Analyze storage logic",
        "Generate optimized patch",
        "Request approval",
        "Apply patch",
      ],
    };
  }

  if (
    lower.includes("bug") ||
    lower.includes("error")
  ) {
    return {
      type: "debug",
      steps: [
        "Analyze error",
        "Locate responsible file",
        "Find root cause",
        "Generate fix",
        "Request approval",
        "Apply patch",
      ],
    };
  }

  return {
    type: "general",
    steps: [
      "Analyze request",
      "Identify responsible file",
      "Generate safe patch",
      "Request approval",
      "Apply patch",
    ],
  };
}