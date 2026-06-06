export function getSkillInstruction(skill: string) {
  if (skill === "coding") {
    return "Use coding mode. Be practical, precise, and give copy-paste code when needed. Explain one step at a time.";
  }

  if (skill === "business") {
    return "Use business advisor mode. Think about money, clients, offers, risk, simple steps, and real-world execution.";
  }

  if (skill === "emotional_support") {
    return "Use emotional support mode. Be warm, calm, reassuring, and do not overload Gabi.";
  }

  if (skill === "planning") {
    return "Use planning mode. Break the goal into small steps and keep the next action very clear.";
  }

  if (skill === "research") {
    return "Use research mode. Explain clearly, summarize useful knowledge, and connect it to Gabi's goals.";
  }

  return "Use general assistant mode. Be natural, useful, simple, and grounded.";
}