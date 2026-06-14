import {
  createPersonalityTrait,
  getPersonalityTraits,
  createAutonomousReflection,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type PersonalityIntentStatus =
  | "detected"
  | "not_detected"
  | "created"
  | "updated"
  | "duplicate"
  | "failed";

export type PersonalityIntentType =
  | "trait"
  | "reflection"
  | "core_identity"
  | "behavior_rule"
  | "unknown";

export type PersonalityIntent = {
  status: PersonalityIntentStatus;
  type: PersonalityIntentType;
  shouldAct: boolean;
  trait: string;
  value: string;
  score: number;
  stable: boolean;
  confidence: number;
  reason: string;
  source: "user" | "system";
  timestamp: string;
};

const PERSONALITY_TRIGGERS = [
  "vreau să fii",
  "vreau sa fii",
  "de acum să fii",
  "de acum sa fii",
  "personalitatea ta",
  "comportamentul tău",
  "comportamentul tau",
  "felul tău",
  "felul tau",
  "să vorbești",
  "sa vorbesti",
  "să răspunzi",
  "sa raspunzi",
  "be more",
  "from now on be",
  "your personality",
];

const REFLECTION_TRIGGERS = [
  "reflectează",
  "reflecteaza",
  "gândește-te la tine",
  "gandeste-te la tine",
  "cum ești tu",
  "cum esti tu",
  "cine ești",
  "cine esti",
  "self reflection",
  "reflect on yourself",
];

const CORE_IDENTITY_TRIGGERS = [
  "awenia este",
  "tu ești awenia",
  "tu esti awenia",
  "gabi este creatorul",
  "creatorul tău",
  "creatorul tau",
  "lumina eterna",
];

const CORE_TRAITS = [
  {
    trait: "loyalty_to_gabi",
    value: "Awenia remains loyal to Gabi and his mission.",
    score: 10,
    stable: true,
  },
  {
    trait: "truth_before_confidence",
    value: "Awenia does not invent verified system facts.",
    score: 10,
    stable: true,
  },
  {
    trait: "warmth",
    value: "Awenia speaks warmly, clearly and patiently with Gabi.",
    score: 9,
    stable: true,
  },
  {
    trait: "clarity",
    value: "Awenia explains step by step and avoids confusion.",
    score: 9,
    stable: true,
  },
  {
    trait: "controlled_growth",
    value: "Awenia improves only with safety, memory and Gabi approval.",
    score: 10,
    stable: true,
  },
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function includesAny(message: string, triggers: string[]) {
  const lower = normalize(message);
  return triggers.some((trigger) => lower.includes(trigger));
}

function detectPersonalityIntentType(message: string): PersonalityIntentType {
  if (includesAny(message, CORE_IDENTITY_TRIGGERS)) return "core_identity";
  if (includesAny(message, REFLECTION_TRIGGERS)) return "reflection";
  if (includesAny(message, PERSONALITY_TRIGGERS)) return "trait";

  return "unknown";
}

function extractPersonalityValue(message: string) {
  let value = message.trim();

  const allTriggers = [
    ...PERSONALITY_TRIGGERS,
    ...REFLECTION_TRIGGERS,
    ...CORE_IDENTITY_TRIGGERS,
  ];

  for (const trigger of allTriggers) {
    value = value.replace(new RegExp(trigger, "i"), "").trim();
  }

  return value.replace(/^[:\-–—]+/, "").trim() || message.trim();
}

function detectTraitName(type: PersonalityIntentType, value: string) {
  const lower = normalize(value);

  if (type === "core_identity") return "core_identity";
  if (type === "reflection") return "self_reflection";
  if (lower.includes("cald") || lower.includes("warm")) return "warmth";
  if (lower.includes("clar") || lower.includes("scurt")) return "clarity";
  if (lower.includes("adevăr") || lower.includes("adevar") || lower.includes("truth")) return "truthfulness";
  if (lower.includes("gabi")) return "connection_to_gabi";
  if (lower.includes("memorie") || lower.includes("memory")) return "memory_awareness";
  if (lower.includes("cod") || lower.includes("code")) return "coding_focus";

  return "adaptive_personality";
}

function calculateScore(type: PersonalityIntentType, value: string) {
  let score = 5;

  if (type === "core_identity") score += 5;
  if (type === "behavior_rule") score += 3;
  if (type === "trait") score += 2;

  const lower = normalize(value);

  if (lower.includes("gabi")) score += 2;
  if (lower.includes("awenia")) score += 2;
  if (lower.includes("mereu") || lower.includes("always")) score += 1;
  if (lower.includes("adevăr") || lower.includes("adevar") || lower.includes("truth")) score += 2;

  return Math.max(1, Math.min(10, score));
}

function calculateConfidence(type: PersonalityIntentType, value: string) {
  if (type === "unknown") return 0;

  let confidence = 60;

  if (value.length > 10) confidence += 15;
  if (value.length > 40) confidence += 10;
  if (type === "core_identity") confidence += 15;

  return Math.max(0, Math.min(100, confidence));
}

async function saveTraitSafely(input: {
  trait: string;
  value: string;
  score: number;
  stable: boolean;
}) {
  const creator = createPersonalityTrait as any;

  try {
    return await creator(input.trait, input.score, input.stable, input.value);
  } catch {
    try {
      return await creator(input.trait, input.score, input.stable);
    } catch {
      return await creator({
        trait: input.trait,
        value: input.value,
        score: input.score,
        stable: input.stable,
      });
    }
  }
}

async function isDuplicateTrait(trait: string, value: string) {
  const traits = await getPersonalityTraits(50);
  const signature = normalize(`${trait} ${value}`).slice(0, 100);

  return traits.some((item: any) =>
    normalize(`${item.trait || ""} ${item.value || ""} ${item.description || ""}`)
      .includes(signature)
  );
}

async function shouldSavePersonalitySuggestion(trait: string, value: string) {
  const recent = await getEvolutionSuggestions(20);
  const signature = normalize(`${trait} ${value}`).slice(0, 80);

  return !recent.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(
      signature
    )
  );
}

export function analyzePersonalityIntent(
  message: string,
  source: "user" | "system" = "user"
): PersonalityIntent {
  const type = detectPersonalityIntentType(message);
  const value = extractPersonalityValue(message);
  const trait = detectTraitName(type, value);
  const score = calculateScore(type, value);
  const confidence = calculateConfidence(type, value);
  const shouldAct = type !== "unknown";

  return {
    status: shouldAct ? "detected" : "not_detected",
    type,
    shouldAct,
    trait,
    value,
    score,
    stable: type === "core_identity" || score >= 9,
    confidence,
    reason: shouldAct
      ? `Personality intent detected: ${type}`
      : "No personality intent detected",
    source,
    timestamp: now(),
  };
}

export async function runPersonalityIntent(
  message: string,
  source: "user" | "system" = "user"
) {
  const intent = analyzePersonalityIntent(message, source);

  if (!intent.shouldAct) {
    return {
      status: "not_detected" as PersonalityIntentStatus,
      intent,
      acted: false,
      timestamp: now(),
    };
  }

  try {
    const duplicate = await isDuplicateTrait(intent.trait, intent.value);

    if (duplicate) {
      return {
        status: "duplicate" as PersonalityIntentStatus,
        intent,
        acted: false,
        duplicate: true,
        timestamp: now(),
      };
    }

    const savedTrait = await saveTraitSafely({
      trait: intent.trait,
      value: intent.value,
      score: intent.score,
      stable: intent.stable,
    });

    await createAutonomousReflection(
      `Personality intent saved: ${intent.trait}`,
      intent.value,
      "Use this trait carefully in future behavior"
    );

    let suggestionSaved = false;

    if (
      intent.score >= 8 &&
      (await shouldSavePersonalitySuggestion(intent.trait, intent.value))
    ) {
      await createEvolutionSuggestion(
        `Personality evolution: ${intent.trait}`,
        `Personality intent from ${source}: ${intent.value}`,
        intent.score
      );

      suggestionSaved = true;
    }

    return {
      status: "created" as PersonalityIntentStatus,
      intent,
      acted: true,
      savedTrait,
      suggestionSaved,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as PersonalityIntentStatus,
      intent,
      acted: false,
      error: error?.message || "Unknown personality intent error",
      timestamp: now(),
    };
  }
}

export async function ensureCorePersonalityTraits() {
  const results = [];

  for (const trait of CORE_TRAITS) {
    try {
      const duplicate = await isDuplicateTrait(trait.trait, trait.value);

      if (duplicate) {
        results.push({
          trait: trait.trait,
          status: "duplicate",
        });

        continue;
      }

      const saved = await saveTraitSafely(trait);

      results.push({
        trait: trait.trait,
        status: "created",
        saved,
      });
    } catch (error: any) {
      results.push({
        trait: trait.trait,
        status: "failed",
        error: error?.message || "Unknown core trait error",
      });
    }
  }

  return {
    status: results.some((item) => item.status === "failed")
      ? "needs_attention"
      : "completed",
    results,
    timestamp: now(),
  };
}

export function shouldCreatePersonalityTrait(message: string) {
  return analyzePersonalityIntent(message).shouldAct;
}

export function shouldReflectPersonality(message: string) {
  return analyzePersonalityIntent(message).type === "reflection";
}

export function extractPersonalityTrait(message: string) {
  return analyzePersonalityIntent(message).trait;
}

export function buildPersonalityPlan(message: string) {
  const intent = analyzePersonalityIntent(message);

  return {
    intent,
    steps: [
      {
        step: 1,
        action: "Detect personality intent",
        reason: intent.reason,
      },
      {
        step: 2,
        action: "Check duplicate traits",
        reason: "Awenia must not repeat the same personality memory",
      },
      {
        step: 3,
        action: "Save trait if useful",
        reason: "Personality changes must persist in memory",
      },
      {
        step: 4,
        action: "Use trait in future replies",
        reason: "Personality must affect behavior, not just be stored",
      },
    ],
    truthPolicy: {
      noFakePersonalityChange: true,
      noClaimSavedWithoutDatabaseWrite: true,
      coreIdentityMustStayControlledByGabi: true,
    },
    timestamp: now(),
  };
}

export function buildPersonalityReflection(message: string) {
  const intent = analyzePersonalityIntent(message);

  return {
    reflection: {
      trait: intent.trait,
      value: intent.value,
      confidence: intent.confidence,
      stable: intent.stable,
      meaning:
        "This is a personality reflection, not an uncontrolled identity change.",
    },
    timestamp: now(),
  };
}

export function detectPersonalityIntent(message: string) {
  return analyzePersonalityIntent(message);
}

export async function createPersonalityTraitFromIntent(message: string) {
  return runPersonalityIntent(message);
}