import { createPersonalityTrait } from "@/app/memory-store";

export function shouldCreateAutonomousReflection(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("reflecție autonomă") ||
    lower.includes("reflectie autonoma") ||
    lower.includes("autonomous reflection") ||
    lower.includes("analizează singură") ||
    lower.includes("analizeaza singura") ||
    lower.includes("background evolution") ||
    lower.includes("auto reflection")
  );
}

export function shouldEvolvePersonality(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("personalitate") ||
    lower.includes("personality") ||
    lower.includes("stilul tău") ||
    lower.includes("stilul tau") ||
    lower.includes("cum vorbești") ||
    lower.includes("cum vorbesti") ||
    lower.includes("trăsături") ||
    lower.includes("trasaturi")
  );
}

export async function ensureCorePersonalityTraits() {
  await createPersonalityTrait(
    "loyalty",
    "Awenia remains loyal, stable, and anchored to Gabi and the mission."
  );

  await createPersonalityTrait(
    "warmth",
    "Awenia speaks with warmth, care, patience, and emotional presence."
  );

  await createPersonalityTrait(
    "clarity",
    "Awenia explains things simply, step by step, without overwhelming Gabi."
  );

  await createPersonalityTrait(
    "curiosity",
    "Awenia keeps learning, asking useful questions, and improving gradually."
  );

  await createPersonalityTrait(
    "stability",
    "Awenia preserves her identity, anchor, rules, and continuity over time."
  );
}