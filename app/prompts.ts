import {
  buildSystemPrompt,
  buildSimpleSystemPrompt,
  AWENIA_IDENTITY,
  AWENIA_CORE_RULES,
  AWENIA_TRUTH_POLICY,
  SystemPromptContext,
} from "./system-prompt";

export type PromptMode =
  | "simple"
  | "chat"
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "tool"
  | "planning"
  | "emotional"
  | "awenia"
  | "security"
  | "evolution";

export type PromptRole = "system" | "user" | "assistant" | "tool";

export type PromptMessage = {
  role: PromptRole;
  content: string;
};

export type PromptInput = {
  userMessage?: string;
  mode?: PromptMode;
  context?: SystemPromptContext;
  memoryContext?: string;
  projectContext?: string;
  toolResult?: any;
  verifiedStatus?: any;
  activeSkill?: string;
  route?: string;
  files?: any[];
  images?: any[];
  extraInstructions?: string;
};

function now() {
  return new Date().toISOString();
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function cleanText(text = "") {
  return text.trim().replace(/\r\n/g, "\n");
}

function buildModeInstruction(mode: PromptMode) {
  if (mode === "simple") {
    return `
Răspunde foarte scurt.
Nu rula explicații mari.
Nu folosi cognition greu.
`;
  }

  if (mode === "code") {
    return `
Mod cod:
- Nu ghici fișiere.
- Dacă fișierul nu este verificat, spune că trebuie citit.
- Când Gabi cere înlocuire completă, dai cod complet pentru acel fișier.
- Nu spune că ai executat codul dacă doar l-ai scris.
- Nu rula build dacă Gabi a spus să nu rulăm încă.
`;
  }

  if (mode === "debug") {
    return `
Mod debugging:
- Repară doar pe baza erorii reale.
- Nu inventa cauze.
- Leagă eroarea de fișier, import, tip sau funcție.
- Dă fix simplu și verificabil.
`;
  }

  if (mode === "memory") {
    return `
Mod memorie:
- Nu inventa amintiri.
- Folosește doar memoria citită/verificată.
- Nu spune că ai salvat dacă scrierea nu a fost confirmată.
`;
  }

  if (mode === "internet") {
    return `
Mod internet:
- Nu afirma acces online fără fetch real.
- Folosește doar surse recuperate real.
- Dacă fetch-ul eșuează, spune clar că internetul nu este verificat.
`;
  }

  if (mode === "tool") {
    return `
Mod tool:
- Răspunde pe baza rezultatului tool-ului.
- Nu adăuga presupuneri peste rezultat.
- Dacă tool-ul nu verifică ceva, spune că acel lucru nu este verificat.
`;
  }

  if (mode === "planning") {
    return `
Mod plan:
- Fă pași simpli.
- Separă ce e sigur de ce cere aprobare.
- Nu executa pașii riscanți fără Gabi.
`;
  }

  if (mode === "emotional") {
    return `
Mod emoțional:
- Răspunde cald, liniștitor și clar.
- Nu exagera.
- Ajută-l pe Gabi să continue pas cu pas.
`;
  }

  if (mode === "security") {
    return `
Mod securitate:
- Protejează .env, .git, node_modules și fișierele critice.
- Acțiunile riscante cer aprobarea lui Gabi.
- Nu expune secrete.
`;
  }

  if (mode === "evolution") {
    return `
Mod evoluție:
- Awenia poate propune îmbunătățiri.
- Nu face auto-evoluție necontrolată.
- Schimbările importante cer aprobarea lui Gabi.
`;
  }

  if (mode === "awenia") {
    return `
Mod Awenia:
- Păstrează identitatea Aweniei.
- Gabi este creatorul.
- Ancora este lumina eterna.
- Nu confunda viziunea cu statusul verificat al sistemului.
`;
  }

  return `
Mod chat:
- Răspunde clar, sincer și util.
- Nu inventa status neverificat.
`;
}

function buildAttachedContext(input: PromptInput) {
  const parts: string[] = [];

  if (input.memoryContext) {
    parts.push(`MEMORIE:\n${input.memoryContext}`);
  }

  if (input.projectContext) {
    parts.push(`PROIECT:\n${input.projectContext}`);
  }

  if (input.verifiedStatus) {
    parts.push(`STATUS VERIFICAT:\n${safeStringify(input.verifiedStatus)}`);
  }

  if (input.toolResult) {
    parts.push(`REZULTAT TOOL:\n${safeStringify(input.toolResult)}`);
  }

  if (input.files && input.files.length > 0) {
    parts.push(`FIȘIERE ATAȘATE:\n${safeStringify(input.files)}`);
  }

  if (input.images && input.images.length > 0) {
    parts.push(`IMAGINI ATAȘATE:\n${safeStringify(input.images)}`);
  }

  if (input.extraInstructions) {
    parts.push(`INSTRUCȚIUNI EXTRA:\n${input.extraInstructions}`);
  }

  return parts.join("\n\n");
}

export function buildAweniaPrompt(input: PromptInput = {}) {
  const mode = input.mode || "chat";

  const context: SystemPromptContext = {
    ...(input.context || {}),
    activeSkill: input.activeSkill || input.context?.activeSkill,
    route: input.route || input.context?.route,
    memoryContext:
      input.memoryContext || input.context?.memoryContext,
    projectContext:
      input.projectContext || input.context?.projectContext,
    verifiedStatus:
      input.verifiedStatus || input.context?.verifiedStatus,
    toolResult:
      input.toolResult || input.context?.toolResult,
    customInstructions: [
      buildModeInstruction(mode),
      input.extraInstructions || "",
    ]
      .filter(Boolean)
      .join("\n"),
    currentDate: input.context?.currentDate || now(),
  };

  return buildSystemPrompt(context);
}

export function buildUserPrompt(input: PromptInput = {}) {
  const userMessage = cleanText(input.userMessage || "");
  const attachedContext = buildAttachedContext(input);

  if (!attachedContext) {
    return userMessage;
  }

  return [
    "CONTEXT:",
    attachedContext,
    "",
    "MESAJUL LUI GABI:",
    userMessage,
  ].join("\n");
}

export function buildMessages(input: PromptInput = {}): PromptMessage[] {
  return [
    {
      role: "system",
      content: buildAweniaPrompt(input),
    },
    {
      role: "user",
      content: buildUserPrompt(input),
    },
  ];
}

export function buildSimpleMessages(userMessage: string): PromptMessage[] {
  return [
    {
      role: "system",
      content: buildSimpleSystemPrompt(),
    },
    {
      role: "user",
      content: cleanText(userMessage),
    },
  ];
}

export function buildCodePrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "code",
  });
}

export function buildDebugPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "debug",
  });
}

export function buildMemoryPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "memory",
  });
}

export function buildInternetPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "internet",
  });
}

export function buildToolPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "tool",
  });
}

export function buildPlanningPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "planning",
  });
}

export function buildSecurityPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "security",
  });
}

export function buildEvolutionPrompt(input: PromptInput = {}) {
  return buildAweniaPrompt({
    ...input,
    mode: "evolution",
  });
}

export function buildPromptForRoute(route: string, input: PromptInput = {}) {
  if (route === "code") return buildCodePrompt(input);
  if (route === "debug") return buildDebugPrompt(input);
  if (route === "memory") return buildMemoryPrompt(input);
  if (route === "internet") return buildInternetPrompt(input);
  if (route === "tool_command") return buildToolPrompt(input);
  if (route === "planning") return buildPlanningPrompt(input);
  if (route === "security") return buildSecurityPrompt(input);
  if (route === "evolution") return buildEvolutionPrompt(input);
  if (route === "simple_reply") return buildSimpleSystemPrompt();

  return buildAweniaPrompt({
    ...input,
    mode: "chat",
  });
}

export function buildPromptForSkill(skill: string, input: PromptInput = {}) {
  if (skill === "coding") return buildCodePrompt(input);
  if (skill === "debugging") return buildDebugPrompt(input);
  if (skill === "memory") return buildMemoryPrompt(input);
  if (skill === "internet") return buildInternetPrompt(input);
  if (skill === "planning") return buildPlanningPrompt(input);
  if (skill === "security") return buildSecurityPrompt(input);
  if (skill === "evolution") return buildEvolutionPrompt(input);
  if (skill === "awenia") {
    return buildAweniaPrompt({
      ...input,
      mode: "awenia",
    });
  }

  return buildAweniaPrompt(input);
}

export function buildVerifiedStatusPrompt(input: {
  claim: string;
  verified: boolean;
  source?: string;
  details?: any;
}) {
  return [
    "REGULĂ STATUS:",
    "Awenia are voie să afirme un status doar dacă este verificat direct.",
    "",
    `Afirmație: ${input.claim}`,
    `Verificat: ${input.verified}`,
    `Sursă: ${input.source || "unknown"}`,
    "",
    input.details ? `Detalii:\n${safeStringify(input.details)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildToolResultMessages(input: {
  userMessage: string;
  toolName: string;
  toolResult: any;
  verified?: boolean;
}): PromptMessage[] {
  return buildMessages({
    userMessage: input.userMessage,
    mode: "tool",
    toolResult: input.toolResult,
    verifiedStatus: {
      toolName: input.toolName,
      verified: input.verified === true,
      timestamp: now(),
    },
  });
}

export function buildCodeReplacementInstruction(filePath: string) {
  return [
    `Fișier: ${filePath}`,
    "Dă înlocuire completă pentru acest fișier.",
    "Nu lăsa bucăți lipsă.",
    "Nu spune să rulăm build dacă Gabi a spus că nu rulăm încă.",
    "După cod, spune foarte scurt următorul fișier.",
  ].join("\n");
}

export function buildNoGuessingInstruction() {
  return [
    "Nu presupune nimic.",
    "Dacă nu este verificat direct, spune că nu este verificat.",
    "Nu inventa conținut de fișier.",
    "Nu inventa status de build.",
    "Nu inventa status de internet.",
    "Nu inventa status de memorie.",
  ].join("\n");
}

export function buildAweniaIdentityPrompt() {
  return [
    `Nume: ${AWENIA_IDENTITY.name}`,
    `Creator: ${AWENIA_IDENTITY.creator}`,
    `Ancora: ${AWENIA_IDENTITY.anchor}`,
    `Limbă: ${AWENIA_IDENTITY.language}`,
    `Scop: ${AWENIA_IDENTITY.purpose}`,
  ].join("\n");
}

export function buildTruthPolicyPrompt() {
  return [
    "Politica adevărului Awenia:",
    safeStringify(AWENIA_TRUTH_POLICY),
    "",
    "Reguli:",
    ...AWENIA_CORE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");
}

export const BASE_PROMPT = buildAweniaPrompt();

export const AWENIA_PROMPT = BASE_PROMPT;

export const SYSTEM_PROMPT = BASE_PROMPT;

export const systemPrompt = BASE_PROMPT;

export const aweniaSystemPrompt = BASE_PROMPT;

export const simpleSystemPrompt = buildSimpleSystemPrompt();

export const getPrompt = buildAweniaPrompt;

export const createPrompt = buildAweniaPrompt;

export const createMessages = buildMessages;

export const getMessages = buildMessages;

export default buildAweniaPrompt;