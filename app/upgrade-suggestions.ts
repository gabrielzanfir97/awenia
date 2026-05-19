export function generateUpgradeSuggestion(
  topic: string,
  learned: string
) {
  const lower = learned.toLowerCase();

  if (
    lower.includes("performance") ||
    lower.includes("optimization")
  ) {
    return {
      type: "optimization",
      suggestion:
        "Awenia detected possible performance improvements.",
    };
  }

  if (
    lower.includes("security") ||
    lower.includes("auth")
  ) {
    return {
      type: "security",
      suggestion:
        "Awenia detected possible security upgrades.",
    };
  }

  if (
    lower.includes("memory") ||
    lower.includes("embedding")
  ) {
    return {
      type: "memory",
      suggestion:
        "Awenia detected memory system improvements.",
    };
  }

  return {
    type: "general",
    suggestion:
      "Awenia found possible architecture improvements.",
  };
}