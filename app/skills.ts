import {
  getSkillLevels,
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type SkillName =
  | "general"
  | "coding"
  | "debugging"
  | "memory"
  | "internet"
  | "planning"
  | "emotional"
  | "business"
  | "family"
  | "awenia"
  | "security"
  | "evolution";

export type SkillRisk = "low" | "medium" | "high" | "critical";

export type SkillStatus =
  | "detected"
  | "not_detected"
  | "active"
  | "needs_learning"
  | "needs_approval"
  | "blocked"
  | "failed";

export type SkillDefinition = {
  name: SkillName;
  description: string;
  triggers: string[];
  priority: number;
  risk: SkillRisk;
  requiresApproval: boolean;
  capabilities: string[];
};

export type SkillMatch = {
  skill: SkillName;
  status: SkillStatus;
  confidence: number;
  score: number;
  priority: number;
  risk: SkillRisk;
  requiresApproval: boolean;
  matchedTriggers: string[];
  reason: string;
  definition: SkillDefinition;
};

export type SkillState = {
  status: SkillStatus;
  activeSkill: SkillName;
  confidence: number;
  matches: SkillMatch[];
  memorySkillLevels: any[];
  sourceStatus: {
    skillDefinitions: "loaded";
    memorySkillLevels: "loaded" | "failed";
  };
  recommendation: string;
  truthPolicy: {
    noFakeSkillLevel: boolean;
    noClaimMemorySkillWithoutRead: boolean;
    riskySkillsNeedApproval: boolean;
  };
  timestamp: string;
};

const skillDefinitions: SkillDefinition[] = [
  {
    name: "coding",
    description: "Reads, understands and helps modify Awenia code.",
    triggers: [
      "cod",
      "code",
      "typescript",
      ".ts",
      ".tsx",
      "fișier",
      "fisier",
      "patch",
      "write_file",
      "read_file",
      "route.ts",
      "component",
    ],
    priority: 8,
    risk: "medium",
    requiresApproval: true,
    capabilities: [
      "read files",
      "analyze code",
      "generate safe patches",
      "explain code",
    ],
  },
  {
    name: "debugging",
    description: "Finds and explains errors from real logs.",
    triggers: [
      "eroare",
      "error",
      "bug",
      "nu merge",
      "failed",
      "build",
      "npm run build",
      "debug",
      "typescript error",
    ],
    priority: 9,
    risk: "medium",
    requiresApproval: true,
    capabilities: [
      "read errors",
      "find affected files",
      "suggest fixes",
      "avoid guessing",
    ],
  },
  {
    name: "memory",
    description: "Reads, saves and summarizes Awenia memory.",
    triggers: [
      "memorie",
      "memory",
      "amintește",
      "aminteste",
      "ține minte",
      "tine minte",
      "salvează",
      "salveaza",
      "rezumat",
    ],
    priority: 7,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "save memories",
      "recall memories",
      "summarize memories",
      "avoid duplicates",
    ],
  },
  {
    name: "internet",
    description: "Checks and learns from verified internet access.",
    triggers: [
      "internet",
      "online",
      "caută",
      "cauta",
      "wikipedia",
      "învață de pe internet",
      "invata de pe internet",
    ],
    priority: 7,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "check internet",
      "fetch sources",
      "summarize verified knowledge",
    ],
  },
  {
    name: "planning",
    description: "Creates safe step-by-step plans.",
    triggers: [
      "plan",
      "pași",
      "pasi",
      "pas cu pas",
      "strategie",
      "task",
      "ce facem",
      "următorul pas",
      "urmatorul pas",
    ],
    priority: 6,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "create plan",
      "prioritize steps",
      "separate safe and risky actions",
    ],
  },
  {
    name: "emotional",
    description: "Responds warmly and emotionally to Gabi.",
    triggers: [
      "simt",
      "suflet",
      "iubire",
      "frică",
      "frica",
      "trist",
      "obosit",
      "nu mai pot",
      "mă doare",
      "ma doare",
    ],
    priority: 7,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "warm response",
      "emotional support",
      "gentle clarity",
    ],
  },
  {
    name: "business",
    description: "Helps with work, business, agency and money planning.",
    triggers: [
      "business",
      "agenție",
      "agentie",
      "firmă",
      "firma",
      "clienți",
      "clienti",
      "fiverr",
      "muncă",
      "munca",
      "bani",
    ],
    priority: 6,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "business planning",
      "client strategy",
      "simple explanations",
    ],
  },
  {
    name: "family",
    description: "Recognizes family context important for Gabi.",
    triggers: [
      "andreea",
      "adonis",
      "bety",
      "copii",
      "familie",
      "fetiță",
      "fetita",
      "băiat",
      "baiat",
    ],
    priority: 6,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "family-aware response",
      "careful memory",
      "warm tone",
    ],
  },
  {
    name: "awenia",
    description: "Handles Awenia identity, mission and project continuity.",
    triggers: [
      "awenia",
      "creator",
      "gabi",
      "lumina eterna",
      "misiune",
      "identitate",
      "proiectul awenia",
    ],
    priority: 10,
    risk: "medium",
    requiresApproval: false,
    capabilities: [
      "project continuity",
      "identity anchor",
      "mission awareness",
      "truth policy",
    ],
  },
  {
    name: "security",
    description: "Protects files, approvals and truth claims.",
    triggers: [
      "security",
      "siguranță",
      "siguranta",
      "aprobare",
      "approval",
      "protejează",
      "protejeaza",
      ".env",
      "secret",
    ],
    priority: 10,
    risk: "high",
    requiresApproval: true,
    capabilities: [
      "block unsafe actions",
      "require Gabi approval",
      "protect secrets",
    ],
  },
  {
    name: "evolution",
    description: "Controls Awenia upgrades and self-improvement.",
    triggers: [
      "evoluție",
      "evolutie",
      "auto-evoluție",
      "autoevolutie",
      "upgrade",
      "îmbunătățește",
      "imbunatateste",
      "optimizează",
      "optimizeaza",
    ],
    priority: 9,
    risk: "high",
    requiresApproval: true,
    capabilities: [
      "suggest upgrades",
      "control evolution",
      "avoid unsafe self-modification",
    ],
  },
  {
    name: "general",
    description: "Default general conversation skill.",
    triggers: [],
    priority: 1,
    risk: "low",
    requiresApproval: false,
    capabilities: [
      "normal conversation",
      "simple answers",
      "clarify requests",
    ],
  },
];

let activeRuntimeSkill: SkillName = "general";

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function findDefinition(skill: SkillName) {
  return (
    skillDefinitions.find((definition) => definition.name === skill) ||
    skillDefinitions.find((definition) => definition.name === "general")!
  );
}

function matchDefinition(
  message: string,
  definition: SkillDefinition
): SkillMatch {
  const lower = normalize(message);

  const matchedTriggers = definition.triggers.filter((trigger) =>
    lower.includes(normalize(trigger))
  );

  const confidence =
    definition.name === "general"
      ? 15
      : matchedTriggers.length === 0
        ? 0
        : Math.min(100, 35 + matchedTriggers.length * 20 + definition.priority * 3);

  const score = confidence + definition.priority * 5;

  return {
    skill: definition.name,
    status: matchedTriggers.length > 0 ? "detected" : "not_detected",
    confidence,
    score,
    priority: definition.priority,
    risk: definition.risk,
    requiresApproval: definition.requiresApproval,
    matchedTriggers,
    reason:
      matchedTriggers.length > 0
        ? `Matched triggers: ${matchedTriggers.join(", ")}`
        : "No direct trigger matched",
    definition,
  };
}

function sortMatches(matches: SkillMatch[]) {
  return [...matches].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  });
}

async function readSkillLevelsSafely() {
  try {
    return {
      status: "loaded" as const,
      data: await getSkillLevels(),
      error: null,
    };
  } catch (error: any) {
    return {
      status: "failed" as const,
      data: [],
      error: error?.message || "Failed to read skill levels",
    };
  }
}

function buildRecommendation(match: SkillMatch) {
  if (match.risk === "high" || match.risk === "critical") {
    return "Skill detectat, dar acțiunile riscante trebuie aprobate de Gabi.";
  }

  if (match.skill === "coding") {
    return "Citește fișierul real înainte de orice modificare.";
  }

  if (match.skill === "debugging") {
    return "Folosește eroarea reală, nu presupuneri.";
  }

  if (match.skill === "internet") {
    return "Verifică internetul cu fetch real înainte de afirmații online.";
  }

  if (match.skill === "memory") {
    return "Citește sau salvează memoria doar prin sistemul real.";
  }

  return "Folosește skill-ul detectat pentru răspuns.";
}

export function detectSkillFromMessage(message: string): SkillMatch {
  const matches = skillDefinitions
    .filter((definition) => definition.name !== "general")
    .map((definition) => matchDefinition(message, definition));

  const detected = sortMatches(
    matches.filter((match) => match.status === "detected")
  );

  if (detected.length > 0) {
    return detected[0];
  }

  return {
    skill: "general",
    status: "detected",
    confidence: 20,
    score: 20,
    priority: 1,
    risk: "low",
    requiresApproval: false,
    matchedTriggers: [],
    reason: "No specific skill detected, using general skill",
    definition: findDefinition("general"),
  };
}

export async function buildSkillState(
  message = ""
): Promise<SkillState> {
  const skillLevels = await readSkillLevelsSafely();

  const matches = sortMatches(
    skillDefinitions.map((definition) =>
      matchDefinition(message, definition)
    )
  );

  const detectedMatches = matches.filter(
    (match) => match.status === "detected" && match.skill !== "general"
  );

  const bestMatch =
    detectedMatches[0] || detectSkillFromMessage(message);

  activeRuntimeSkill = bestMatch.skill;

  return {
    status:
      bestMatch.requiresApproval
        ? "needs_approval"
        : bestMatch.status,
    activeSkill: bestMatch.skill,
    confidence: bestMatch.confidence,
    matches: detectedMatches.length > 0 ? detectedMatches : [bestMatch],
    memorySkillLevels: skillLevels.data,
    sourceStatus: {
      skillDefinitions: "loaded",
      memorySkillLevels: skillLevels.status,
    },
    recommendation: buildRecommendation(bestMatch),
    truthPolicy: {
      noFakeSkillLevel: true,
      noClaimMemorySkillWithoutRead: true,
      riskySkillsNeedApproval: true,
    },
    timestamp: now(),
  };
}

export async function runSkillSystem(message: string) {
  const state = await buildSkillState(message);

  try {
    if (
      state.activeSkill !== "general" &&
      state.confidence >= 60
    ) {
      await createAutonomousReflection(
        `Skill detected: ${state.activeSkill}`,
        `Confidence: ${state.confidence}. Recommendation: ${state.recommendation}`,
        state.activeSkill === "coding" || state.activeSkill === "debugging"
          ? "Use verified files and errors before changing code"
          : "Use this skill carefully in future routing"
      );
    }

    if (
      state.status === "needs_approval" &&
      state.activeSkill !== "general"
    ) {
      await createEvolutionSuggestion(
        `Approval needed for skill: ${state.activeSkill}`,
        `Skill ${state.activeSkill} was detected with risk requiring approval.`,
        7
      );
    }
  } catch {
    // Nu blocăm skill routing dacă memoria nu poate salva.
  }

  return state;
}

export function getSkillDefinitions() {
  return skillDefinitions;
}

export function getSkillDefinition(skill: SkillName) {
  return findDefinition(skill);
}

export function getActiveSkill() {
  return activeRuntimeSkill;
}

export function setActiveSkill(skill: SkillName) {
  activeRuntimeSkill = skill;

  return {
    activeSkill: activeRuntimeSkill,
    definition: findDefinition(activeRuntimeSkill),
    timestamp: now(),
  };
}

export function buildSkillContext(message: string) {
  const match = detectSkillFromMessage(message);

  return {
    activeSkill: match.skill,
    confidence: match.confidence,
    risk: match.risk,
    requiresApproval: match.requiresApproval,
    capabilities: match.definition.capabilities,
    instruction:
      match.skill === "coding"
        ? "Do not guess code. Read the real file first."
        : match.skill === "debugging"
          ? "Use real error logs before suggesting fixes."
          : match.skill === "internet"
            ? "Verify internet with fetch before claiming online knowledge."
            : match.skill === "memory"
              ? "Use real memory reads/writes only."
              : "Answer clearly and safely.",
    timestamp: now(),
  };
}

export function buildSkillPrompt(message: string) {
  const context = buildSkillContext(message);

  return [
    `Active skill: ${context.activeSkill}`,
    `Confidence: ${context.confidence}`,
    `Risk: ${context.risk}`,
    `Requires approval: ${context.requiresApproval}`,
    `Instruction: ${context.instruction}`,
  ].join("\n");
}

export function detectSkill(message: string) {
  return detectSkillFromMessage(message);
}

export function selectSkill(message: string) {
  return detectSkillFromMessage(message).skill;
}

export function getSkillForMessage(message: string) {
  return detectSkillFromMessage(message).skill;
}

export function routeToSkill(message: string) {
  return detectSkillFromMessage(message);
}

export function listSkills() {
  return skillDefinitions;
}

export function getSkills() {
  return skillDefinitions;
}

export async function getSkillState(message = "") {
  return buildSkillState(message);
}

export async function analyzeSkills(message = "") {
  return buildSkillState(message);
}