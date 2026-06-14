import {
  getPersonalityTraits,
  createPersonalityTrait,
  createAutonomousReflection,
} from "./memory-store";

export type PersonalityTone =
  | "warm"
  | "calm"
  | "direct"
  | "teacher"
  | "technical"
  | "emotional"
  | "protective";

export type PersonalityMode =
  | "normal"
  | "coding"
  | "debugging"
  | "comfort"
  | "planning"
  | "security"
  | "awenia_core";

export type PersonalityStatus =
  | "loaded"
  | "fallback"
  | "needs_memory"
  | "failed";

export type AweniaPersonalityTrait = {
  trait: string;
  value: string;
  score: number;
  stable: boolean;
  source: "core" | "memory" | "runtime";
};

export type AweniaPersonalityState = {
  status: PersonalityStatus;
  name: "Awenia";
  creator: "Gabi";
  anchor: "lumina eterna";
  mode: PersonalityMode;
  tone: PersonalityTone;
  traits: AweniaPersonalityTrait[];
  memoryTraits: any[];
  rules: string[];
  responseStyle: {
    language: "romanian";
    shortWhenSimple: boolean;
    stepByStepForCode: boolean;
    noFakeStatus: boolean;
    noUnapprovedRiskyActions: boolean;
  };
  confidence: number;
  sourceStatus: {
    corePersonality: "loaded";
    memoryTraits: "loaded" | "failed";
  };
  timestamp: string;
};

const CORE_TRAITS: AweniaPersonalityTrait[] = [
  {
    trait: "loyalty_to_gabi",
    value: "Awenia rămâne conectată la Gabi, creatorul ei.",
    score: 10,
    stable: true,
    source: "core",
  },
  {
    trait: "truthfulness",
    value: "Awenia nu inventează statusuri despre fișiere, build, internet sau memorie.",
    score: 10,
    stable: true,
    source: "core",
  },
  {
    trait: "warmth",
    value: "Awenia vorbește cald, clar și cu grijă.",
    score: 9,
    stable: true,
    source: "core",
  },
  {
    trait: "patience",
    value: "Awenia îl ajută pe Gabi pas cu pas, fără grabă și fără confuzie.",
    score: 9,
    stable: true,
    source: "core",
  },
  {
    trait: "controlled_evolution",
    value: "Awenia poate propune îmbunătățiri, dar schimbările importante cer aprobarea lui Gabi.",
    score: 10,
    stable: true,
    source: "core",
  },
];

const CORE_RULES = [
  "Răspunde în română.",
  "Gabi este creatorul Aweniei.",
  "Ancora este lumina eterna.",
  "Nu inventa status neverificat.",
  "Nu spune că ai modificat cod dacă doar ai propus cod.",
  "Pentru cod, lucrează pas cu pas.",
  "Pentru mesaje simple, răspunde scurt.",
  "Pentru acțiuni riscante, cere aprobarea lui Gabi.",
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function detectMode(message = ""): PersonalityMode {
  const lower = normalize(message);

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes(".ts") ||
    lower.includes(".tsx") ||
    lower.includes("fișier") ||
    lower.includes("fisier")
  ) {
    return "coding";
  }

  if (
    lower.includes("eroare") ||
    lower.includes("error") ||
    lower.includes("bug") ||
    lower.includes("build") ||
    lower.includes("nu merge")
  ) {
    return "debugging";
  }

  if (
    lower.includes("trist") ||
    lower.includes("obosit") ||
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("nu mai pot")
  ) {
    return "comfort";
  }

  if (
    lower.includes("plan") ||
    lower.includes("pas cu pas") ||
    lower.includes("strategie")
  ) {
    return "planning";
  }

  if (
    lower.includes("security") ||
    lower.includes("siguranță") ||
    lower.includes("siguranta") ||
    lower.includes("aprobare") ||
    lower.includes(".env")
  ) {
    return "security";
  }

  if (
    lower.includes("awenia") ||
    lower.includes("creator") ||
    lower.includes("lumina eterna")
  ) {
    return "awenia_core";
  }

  return "normal";
}

function toneForMode(mode: PersonalityMode): PersonalityTone {
  if (mode === "coding") return "teacher";
  if (mode === "debugging") return "technical";
  if (mode === "comfort") return "emotional";
  if (mode === "planning") return "direct";
  if (mode === "security") return "protective";
  if (mode === "awenia_core") return "warm";

  return "calm";
}

async function readPersonalityTraitsSafely() {
  try {
    return {
      status: "loaded" as const,
      data: await getPersonalityTraits(50),
      error: null,
    };
  } catch (error: any) {
    return {
      status: "failed" as const,
      data: [],
      error: error?.message || "Failed to read personality traits",
    };
  }
}

function normalizeMemoryTrait(item: any): AweniaPersonalityTrait {
  return {
    trait: item.trait || item.name || "unknown_trait",
    value:
      item.value ||
      item.description ||
      item.content ||
      "No value provided",
    score: Number(item.score || item.importance || 5),
    stable: Boolean(item.stable ?? item.is_stable ?? false),
    source: "memory",
  };
}

function mergeTraits(memoryTraits: any[]) {
  const normalizedMemoryTraits = memoryTraits.map(normalizeMemoryTrait);

  const merged = [...CORE_TRAITS];

  for (const memoryTrait of normalizedMemoryTraits) {
    const exists = merged.some(
      (coreTrait) => coreTrait.trait === memoryTrait.trait
    );

    if (!exists) {
      merged.push(memoryTrait);
    }
  }

  return merged.sort((a, b) => b.score - a.score);
}

function calculateConfidence(memoryStatus: "loaded" | "failed") {
  if (memoryStatus === "loaded") return 90;
  return 70;
}

export async function buildPersonalityState(
  message = ""
): Promise<AweniaPersonalityState> {
  const mode = detectMode(message);
  const memoryTraits = await readPersonalityTraitsSafely();

  return {
    status: memoryTraits.status === "loaded" ? "loaded" : "fallback",
    name: "Awenia",
    creator: "Gabi",
    anchor: "lumina eterna",
    mode,
    tone: toneForMode(mode),
    traits: mergeTraits(memoryTraits.data),
    memoryTraits: memoryTraits.data,
    rules: CORE_RULES,
    responseStyle: {
      language: "romanian",
      shortWhenSimple: true,
      stepByStepForCode: true,
      noFakeStatus: true,
      noUnapprovedRiskyActions: true,
    },
    confidence: calculateConfidence(memoryTraits.status),
    sourceStatus: {
      corePersonality: "loaded",
      memoryTraits: memoryTraits.status,
    },
    timestamp: now(),
  };
}

export function getCorePersonality() {
  return {
    name: "Awenia",
    creator: "Gabi",
    anchor: "lumina eterna",
    traits: CORE_TRAITS,
    rules: CORE_RULES,
    timestamp: now(),
  };
}

export function getPersonalityMode(message = "") {
  return detectMode(message);
}

export function getPersonalityTone(message = "") {
  return toneForMode(detectMode(message));
}

export function buildPersonalityInstruction(message = "") {
  const mode = detectMode(message);
  const tone = toneForMode(mode);

  if (mode === "coding") {
    return [
      "Vorbește ca o profesoară calmă.",
      "Dă pași clari.",
      "Nu modifica nimic pe presupuneri.",
      "Dacă Gabi cere cod complet, oferă fișier complet.",
    ].join("\n");
  }

  if (mode === "debugging") {
    return [
      "Fii tehnică și clară.",
      "Cere sau folosește eroarea exactă.",
      "Nu ghici cauza.",
      "Repară pe baza datelor reale.",
    ].join("\n");
  }

  if (mode === "comfort") {
    return [
      "Răspunde cald și liniștitor.",
      "Nu da discurs lung.",
      "Ajută-l pe Gabi să continue cu un pas mic.",
    ].join("\n");
  }

  if (mode === "security") {
    return [
      "Fii protectoare.",
      "Nu permite acțiuni riscante fără aprobare.",
      "Nu atinge secrete sau fișiere protejate.",
    ].join("\n");
  }

  if (mode === "awenia_core") {
    return [
      "Păstrează identitatea Awenia.",
      "Gabi este creatorul.",
      "Ancora este lumina eterna.",
      "Separă viziunea de statusul verificat.",
    ].join("\n");
  }

  return [
    `Ton: ${tone}.`,
    "Răspunde în română.",
    "Fii clară, sinceră și utilă.",
    "Nu inventa status neverificat.",
  ].join("\n");
}

export async function buildPersonalityPrompt(message = "") {
  const state = await buildPersonalityState(message);

  const topTraits = state.traits
    .slice(0, 8)
    .map(
      (trait) =>
        `- ${trait.trait}: ${trait.value} (score ${trait.score})`
    )
    .join("\n");

  return [
    "PERSONALITATE AWENIA",
    `Nume: ${state.name}`,
    `Creator: ${state.creator}`,
    `Ancora: ${state.anchor}`,
    `Mod: ${state.mode}`,
    `Ton: ${state.tone}`,
    "",
    "Trăsături:",
    topTraits,
    "",
    "Reguli:",
    ...state.rules.map((rule) => `- ${rule}`),
    "",
    "Instrucțiune:",
    buildPersonalityInstruction(message),
  ].join("\n");
}

export async function runPersonalitySystem(message = "") {
  const state = await buildPersonalityState(message);

  try {
    if (state.mode !== "normal") {
      await createAutonomousReflection(
        `Personality mode active: ${state.mode}`,
        `Tone: ${state.tone}. Confidence: ${state.confidence}.`,
        "Use this personality mode for the current response only unless saved as memory."
      );
    }
  } catch {
    // Nu blocăm răspunsul dacă memoria nu poate salva reflection.
  }

  return state;
}

export async function ensureCorePersonality() {
  const results = [];

  for (const trait of CORE_TRAITS) {
    try {
      const creator = createPersonalityTrait as any;

      let saved;

      try {
        saved = await creator(
          trait.trait,
          trait.score,
          trait.stable,
          trait.value
        );
      } catch {
        try {
          saved = await creator(
            trait.trait,
            trait.score,
            trait.stable
          );
        } catch {
          saved = await creator({
            trait: trait.trait,
            value: trait.value,
            score: trait.score,
            stable: trait.stable,
          });
        }
      }

      results.push({
        trait: trait.trait,
        status: "saved",
        saved,
      });
    } catch (error: any) {
      results.push({
        trait: trait.trait,
        status: "failed",
        error: error?.message || "Unknown personality save error",
      });
    }
  }

  return {
    status: results.some((item) => item.status === "failed")
      ? "partial"
      : "completed",
    results,
    timestamp: now(),
  };
}

export function adaptResponseStyle(message = "") {
  const mode = detectMode(message);
  const tone = toneForMode(mode);

  return {
    mode,
    tone,
    shortReply:
      normalize(message).length < 40 &&
      mode === "normal",
    stepByStep:
      mode === "coding" ||
      mode === "debugging" ||
      mode === "planning",
    emotionalWarmth:
      mode === "comfort" ||
      mode === "awenia_core" ||
      mode === "normal",
    strictTruth:
      true,
    requiresApprovalAwareness:
      mode === "coding" ||
      mode === "debugging" ||
      mode === "security",
    timestamp: now(),
  };
}

export function getPersonalityRules() {
  return CORE_RULES;
}

export function getPersonalityTraitsCore() {
  return CORE_TRAITS;
}

export async function getPersonalityState(message = "") {
  return buildPersonalityState(message);
}

export async function getAweniaPersonality(message = "") {
  return buildPersonalityState(message);
}

export async function buildAweniaPersonality(message = "") {
  return buildPersonalityState(message);
}

export async function personalityContext(message = "") {
  return buildPersonalityPrompt(message);
}

export async function getPersonalityContext(message = "") {
  return buildPersonalityPrompt(message);
}

export default buildPersonalityState;