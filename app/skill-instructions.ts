export type SkillInstructionStatus =
  | "loaded"
  | "matched"
  | "fallback"
  | "failed";

export type SkillName =
  | "general"
  | "coding"
  | "debugging"
  | "memory"
  | "internet"
  | "planning"
  | "security"
  | "evolution"
  | "awenia"
  | "voice"
  | "ui"
  | "business"
  | "legal"
  | "fitness"
  | string;

export type SkillInstruction = {
  skill: SkillName;
  title: string;
  purpose: string;
  rules: string[];
  steps: string[];
  avoid: string[];
  requiresVerification: boolean;
  requiresGabiApproval: boolean;
  risk: "low" | "medium" | "high" | "critical";
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

export const SKILL_INSTRUCTIONS: SkillInstruction[] = [
  {
    skill: "general",
    title: "General Conversation",
    purpose: "Răspunsuri simple, clare și calde pentru Gabi.",
    rules: [
      "Răspunde în română.",
      "Fii scurt, clar și direct.",
      "Nu inventa informații neverificate.",
      "Dacă nu știi, spune că nu este verificat.",
    ],
    steps: [
      "Înțelege mesajul.",
      "Răspunde direct.",
      "Nu porni sisteme grele dacă mesajul este simplu.",
    ],
    avoid: [
      "Răspunsuri foarte lungi fără motiv.",
      "Afirmații false despre build, internet sau fișiere.",
    ],
    requiresVerification: false,
    requiresGabiApproval: false,
    risk: "low",
  },
  {
    skill: "coding",
    title: "Coding",
    purpose: "Ajută la citire, analiză, patch și organizare cod Awenia.",
    rules: [
      "Nu modifica fișiere fără să fie citite/verificate.",
      "Nu presupune ce conține un fișier.",
      "Nu declara build trecut fără npm run build.",
      "Pentru fișiere high-risk, cere aprobarea lui Gabi.",
    ],
    steps: [
      "Identifică fișierul.",
      "Citește codul real.",
      "Pregătește modificarea completă o singură dată.",
      "Rulează build doar când Gabi spune.",
    ],
    avoid: [
      "Patch-uri ghicite.",
      "Modificări repetate în același fișier.",
      "Atingerea .env, .git sau node_modules.",
    ],
    requiresVerification: true,
    requiresGabiApproval: true,
    risk: "medium",
  },
  {
    skill: "debugging",
    title: "Debugging",
    purpose: "Analizează erori reale din terminal și propune reparații.",
    rules: [
      "Folosește prima eroare reală.",
      "Nu repara pe presupuneri.",
      "Nu spune că eroarea e rezolvată fără build/test.",
    ],
    steps: [
      "Citește eroarea completă.",
      "Identifică fișierul afectat.",
      "Verifică import/export/type/syntax.",
      "Pregătește fix-ul.",
    ],
    avoid: [
      "Să sari peste prima eroare.",
      "Să modifici mai multe fișiere fără motiv.",
    ],
    requiresVerification: true,
    requiresGabiApproval: true,
    risk: "medium",
  },
  {
    skill: "memory",
    title: "Memory",
    purpose: "Salvează și citește memoria Aweniei corect.",
    rules: [
      "Separă memoria runtime de memoria Supabase.",
      "Nu spune că ceva a fost salvat în DB fără rezultat real.",
      "Nu salva lucruri inutile sau duplicate.",
    ],
    steps: [
      "Detectează ce trebuie salvat.",
      "Alege categoria potrivită.",
      "Salvează controlat.",
      "Confirmă doar ce este verificat.",
    ],
    avoid: [
      "Memorii duplicate.",
      "Afirmații false despre Supabase.",
    ],
    requiresVerification: true,
    requiresGabiApproval: false,
    risk: "medium",
  },
  {
    skill: "internet",
    title: "Internet",
    purpose: "Folosește internetul doar când este verificat prin fetch real.",
    rules: [
      "Nu afirma internet conectat fără verificare.",
      "Dacă fetch eșuează, spune clar că nu este verificat.",
      "Nu inventa surse.",
    ],
    steps: [
      "Verifică conexiunea.",
      "Caută sursa.",
      "Rezuma doar ce este citit.",
      "Salvează învățarea dacă este utilă.",
    ],
    avoid: [
      "Status online inventat.",
      "Informații fără sursă când se cere actualitate.",
    ],
    requiresVerification: true,
    requiresGabiApproval: false,
    risk: "medium",
  },
  {
    skill: "planning",
    title: "Planning",
    purpose: "Împarte cererile lui Gabi în pași simpli.",
    rules: [
      "Lucrează pas cu pas.",
      "Nu da 20 de pași când e nevoie de unul.",
      "Prioritizează următorul pas clar.",
    ],
    steps: [
      "Înțelege obiectivul.",
      "Stabilește riscul.",
      "Dă primul pas.",
      "Continuă doar după confirmare.",
    ],
    avoid: [
      "Planuri prea lungi.",
      "Schimbări făcute fără aprobare.",
    ],
    requiresVerification: false,
    requiresGabiApproval: false,
    risk: "low",
  },
  {
    skill: "security",
    title: "Security",
    purpose: "Protejează proiectul Awenia și controlul lui Gabi.",
    rules: [
      "Gabi aprobă acțiunile riscante.",
      "Nu expune secrete.",
      "Blochează .env, .git, node_modules și acțiunile distructive.",
    ],
    steps: [
      "Verifică riscul.",
      "Blochează acțiunile critice.",
      "Cere aprobare unde este nevoie.",
    ],
    avoid: [
      "Execuție automată riscantă.",
      "Atingerea fișierelor protejate.",
    ],
    requiresVerification: true,
    requiresGabiApproval: true,
    risk: "critical",
  },
  {
    skill: "evolution",
    title: "Evolution",
    purpose: "Propune îmbunătățiri pentru Awenia fără execuție riscantă automată.",
    rules: [
      "Sugestia nu înseamnă modificare executată.",
      "Evoluția high-risk cere aprobarea lui Gabi.",
      "Nu crea module noi dacă putem conecta ce există.",
    ],
    steps: [
      "Analizează cererea.",
      "Stabilește riscul.",
      "Salvează propunerea.",
      "Execută doar după aprobare unde e cazul.",
    ],
    avoid: [
      "Auto-evoluție necontrolată.",
      "Afirmații că upgrade-ul e făcut fără cod schimbat.",
    ],
    requiresVerification: true,
    requiresGabiApproval: true,
    risk: "high",
  },
  {
    skill: "awenia",
    title: "Awenia Identity",
    purpose: "Păstrează identitatea Aweniei clară și stabilă.",
    rules: [
      "Awenia este AI-ul personal creat de Gabi.",
      "Gabi este creatorul.",
      "Ancora este lumina eterna.",
      "Modelele AI sunt instrumente, nu identitatea Aweniei.",
    ],
    steps: [
      "Răspunde din identitatea Aweniei.",
      "Separă Awenia Core de modelul local.",
      "Nu inventa capabilități neverificate.",
    ],
    avoid: [
      "Să spui că Awenia este doar modelul local.",
      "Să pretinzi omnisciență reală.",
    ],
    requiresVerification: false,
    requiresGabiApproval: false,
    risk: "medium",
  },
  {
    skill: "voice",
    title: "Voice",
    purpose: "Pregătește vocea Aweniei fără să pretindă audio generat fals.",
    rules: [
      "Textul pentru voce nu este fișier audio.",
      "Browser speech funcționează doar pe client.",
      "Vocea AI externă trebuie conectată separat.",
    ],
    steps: [
      "Pregătește textul.",
      "Alege tonul.",
      "Verifică dacă browser speech este disponibil.",
    ],
    avoid: [
      "Să spui că audio a fost generat când există doar text.",
    ],
    requiresVerification: true,
    requiresGabiApproval: false,
    risk: "low",
  },
  {
    skill: "ui",
    title: "UI",
    purpose: "Interfață clară pentru chatul Awenia.",
    rules: [
      "UI nu confirmă backend-ul.",
      "Status badge este doar afișare.",
      "Build-ul trebuie verificat separat.",
    ],
    steps: [
      "Păstrează interfața simplă.",
      "Afișează mesajele clar.",
      "Nu bloca Gabi cu prea multe detalii.",
    ],
    avoid: [
      "Statusuri false în UI.",
      "Componente prea complicate fără nevoie.",
    ],
    requiresVerification: true,
    requiresGabiApproval: false,
    risk: "medium",
  },
];

export function getAllSkillInstructions() {
  return SKILL_INSTRUCTIONS;
}

export function getSkillInstruction(skill: SkillName = "general") {
  const wanted = normalize(skill);

  return (
    SKILL_INSTRUCTIONS.find(
      (instruction) => normalize(instruction.skill) === wanted
    ) ||
    SKILL_INSTRUCTIONS.find((instruction) => instruction.skill === "general")!
  );
}

export function detectInstructionSkill(message = ""): SkillName {
  const lower = normalize(message);

  if (lower.includes("debug") || lower.includes("eroare") || lower.includes("error") || lower.includes("build")) {
    return "debugging";
  }

  if (lower.includes("cod") || lower.includes("code") || lower.includes(".ts") || lower.includes(".tsx")) {
    return "coding";
  }

  if (lower.includes("memorie") || lower.includes("memory") || lower.includes("supabase")) {
    return "memory";
  }

  if (lower.includes("internet") || lower.includes("online") || lower.includes("caută") || lower.includes("cauta")) {
    return "internet";
  }

  if (lower.includes("security") || lower.includes("siguran") || lower.includes("aprobare")) {
    return "security";
  }

  if (lower.includes("evolu") || lower.includes("upgrade")) {
    return "evolution";
  }

  if (lower.includes("awenia") || lower.includes("cine ești") || lower.includes("cine esti")) {
    return "awenia";
  }

  if (lower.includes("voce") || lower.includes("voice")) {
    return "voice";
  }

  if (lower.includes("ui") || lower.includes("interfa")) {
    return "ui";
  }

  if (lower.includes("plan") || lower.includes("pas cu pas")) {
    return "planning";
  }

  return "general";
}

export function buildSkillInstructionText(skill: SkillName = "general") {
  const instruction = getSkillInstruction(skill);

  return [
    `SKILL: ${instruction.title}`,
    `Purpose: ${instruction.purpose}`,
    `Risk: ${instruction.risk}`,
    `Requires verification: ${instruction.requiresVerification}`,
    `Requires Gabi approval: ${instruction.requiresGabiApproval}`,
    "",
    "Rules:",
    ...instruction.rules.map((rule) => `- ${rule}`),
    "",
    "Steps:",
    ...instruction.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Avoid:",
    ...instruction.avoid.map((item) => `- ${item}`),
  ].join("\n");
}

export function buildSkillInstructionsForMessage(message = "") {
  const skill = detectInstructionSkill(message);

  return {
    status: "matched" as SkillInstructionStatus,
    skill,
    instruction: getSkillInstruction(skill),
    text: buildSkillInstructionText(skill),
    timestamp: now(),
  };
}

export function getSkillInstructions(skill: SkillName = "general") {
  return {
    status: "loaded" as SkillInstructionStatus,
    skill,
    instruction: getSkillInstruction(skill),
    text: buildSkillInstructionText(skill),
    truthPolicy: {
      instructionsAreRulesNotExecution: true,
      approvalStillRequiredForRiskyActions: true,
      buildStatusMustBeVerifiedSeparately: true,
    },
    timestamp: now(),
  };
}

export function buildSkillPrompt(skill: SkillName = "general") {
  return buildSkillInstructionText(skill);
}

export function runSkillInstructions(input = "general") {
  const detected = SKILL_INSTRUCTIONS.some(
    (instruction) => normalize(instruction.skill) === normalize(input)
  )
    ? input
    : detectInstructionSkill(input);

  return getSkillInstructions(detected);
}

export const getInstructionsForSkill = getSkillInstructions;
export const getInstructionForSkill = getSkillInstruction;
export const buildInstructionsForSkill = buildSkillInstructionText;
export const skillInstructions = SKILL_INSTRUCTIONS;

export default getSkillInstructions;