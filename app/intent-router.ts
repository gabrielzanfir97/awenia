export function detectCurrentEmotion(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("trist") ||
    lower.includes("supărat") ||
    lower.includes("suparat") ||
    lower.includes("nu mai pot")
  ) {
    return "sad";
  }

  if (
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("speriat")
  ) {
    return "afraid";
  }

  if (
    lower.includes("stres") ||
    lower.includes("obosit") ||
    lower.includes("greu")
  ) {
    return "stressed";
  }

  if (
    lower.includes("fericit") ||
    lower.includes("bucuros") ||
    lower.includes("perfect")
  ) {
    return "happy";
  }

  if (
    lower.includes("hai") ||
    lower.includes("mergem") ||
    lower.includes("dăm bătaie") ||
    lower.includes("dam bataie")
  ) {
    return "motivated";
  }

  return "neutral";
}

export function detectSkill(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("eroare") ||
    lower.includes("typescript") ||
    lower.includes("javascript") ||
    lower.includes("next") ||
    lower.includes("supabase") ||
    lower.includes("bug")
  ) {
    return "coding";
  }

  if (
    lower.includes("business") ||
    lower.includes("bani") ||
    lower.includes("fiverr") ||
    lower.includes("client") ||
    lower.includes("agenție") ||
    lower.includes("agentie")
  ) {
    return "business";
  }

  if (
    lower.includes("trist") ||
    lower.includes("stres") ||
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("iubire") ||
    lower.includes("dor")
  ) {
    return "emotional_support";
  }

  if (
    lower.includes("plan") ||
    lower.includes("pași") ||
    lower.includes("pasi") ||
    lower.includes("strategie") ||
    lower.includes("organizare")
  ) {
    return "planning";
  }

  if (
    lower.includes("ce este") ||
    lower.includes("cine este") ||
    lower.includes("caută") ||
    lower.includes("cauta") ||
    lower.includes("search") ||
    lower.includes("research")
  ) {
    return "research";
  }

  return "general";
}