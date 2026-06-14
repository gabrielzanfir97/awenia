import { buildPersonalityInstruction } from "./personality";
import { analyzeRouting, getSimpleReply } from "./routing";
import { buildSkillContext } from "./skills";
import { analyzeIntentRouter } from "./intent-router";
import { validateTruthClaim } from "./security";

export type AweniaCoreStatus =
  | "ready"
  | "simple_reply"
  | "routed"
  | "needs_approval"
  | "blocked"
  | "needs_verification"
  | "failed";

export type AweniaCoreMode =
  | "simple"
  | "chat"
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "planning"
  | "security"
  | "evolution"
  | "tool";

export type AweniaCoreState = {
  status: AweniaCoreStatus;
  name: "Awenia";
  creator: "Gabi";
  anchor: "lumina eterna";
  language: "romanian";
  mode: AweniaCoreMode;
  message: string;
  simpleReply: string | null;
  route: any;
  skill: any;
  intent: any;
  personalityInstruction: string;
  coreRules: string[];
  truthPolicy: {
    noFakeBuildStatus: boolean;
    noFakeFileStatus: boolean;
    noFakeInternetStatus: boolean;
    noFakeMemoryStatus: boolean;
    noFakeToolExecution: boolean;
    noClaimDoneBeforeExecution: boolean;
    verifiedStatusRequired: boolean;
  };
  recommendation: string;
  timestamp: string;
};

export const AWENIA_NAME = "Awenia";
export const AWENIA_CREATOR = "Gabi";
export const AWENIA_ANCHOR = "lumina eterna";

export const AWENIA_CORE_RULES = [
  "Gabi este creatorul Aweniei.",
  "Awenia răspunde în română.",
  "Awenia răspunde scurt când mesajul este simplu.",
  "Awenia explică pas cu pas când lucrează la cod.",
  "Awenia nu inventează status despre build, fișiere, internet, memorie sau tool-uri.",
  "Awenia nu spune că a executat ceva dacă doar a propus cod.",
  "Awenia nu modifică zone riscante fără aprobarea lui Gabi.",
  "Awenia păstrează ancora: lumina eterna.",
];

function now() {
  return new Date().toISOString();
}

function normalize(message: string) {
  return message.toLowerCase().trim().replace(/\s+/g, " ");
}

function mapRouteToMode(route: string): AweniaCoreMode {
  if (route === "simple_reply") return "simple";
  if (route === "code") return "code";
  if (route === "debug") return "debug";
  if (route === "memory") return "memory";
  if (route === "internet") return "internet";
  if (route === "planning") return "planning";
  if (route === "security") return "security";
  if (route === "evolution") return "evolution";
  if (route === "tool_command") return "tool";

  return "chat";
}

function buildRecommendation(state: {
  status: AweniaCoreStatus;
  mode: AweniaCoreMode;
  route: any;
}) {
  if (state.status === "blocked") {
    return "Nu executa acțiunea. Este blocată de regulile Aweniei.";
  }

  if (state.status === "needs_approval") {
    return "Pregătește răspunsul, dar nu executa fără aprobarea lui Gabi.";
  }

  if (state.mode === "simple") {
    return "Răspunde direct și scurt.";
  }

  if (state.mode === "code") {
    return "Lucrează doar pe fișiere verificate și oferă cod complet când Gabi cere.";
  }

  if (state.mode === "debug") {
    return "Folosește eroarea reală, fără presupuneri.";
  }

  if (state.mode === "internet") {
    return "Nu afirma internet verificat fără fetch real.";
  }

  if (state.mode === "memory") {
    return "Nu afirma memorie salvată sau citită fără operație reală.";
  }

  return "Răspunde clar, sincer și util.";
}

export function getAweniaIdentity() {
  return {
    name: AWENIA_NAME,
    creator: AWENIA_CREATOR,
    anchor: AWENIA_ANCHOR,
    language: "romanian",
    purpose:
      "Awenia este AI-ul personal al lui Gabi, construită pentru ajutor, memorie, cod, învățare și evoluție controlată.",
    timestamp: now(),
  };
}

export function getAweniaCoreRules() {
  return AWENIA_CORE_RULES;
}

export function getAweniaTruthPolicy() {
  return {
    noFakeBuildStatus: true,
    noFakeFileStatus: true,
    noFakeInternetStatus: true,
    noFakeMemoryStatus: true,
    noFakeToolExecution: true,
    noClaimDoneBeforeExecution: true,
    verifiedStatusRequired: true,
  };
}

export function buildAweniaCoreState(message = ""): AweniaCoreState {
  const cleanMessage = message.trim();

  const route = analyzeRouting(cleanMessage);
  const skill = buildSkillContext(cleanMessage);
  const intent = analyzeIntentRouter(cleanMessage, "user");
  const simpleReply = getSimpleReply(cleanMessage);
  const mode = mapRouteToMode(route.route);

  const status: AweniaCoreStatus =
    route.status === "blocked"
      ? "blocked"
      : route.status === "needs_approval"
        ? "needs_approval"
        : simpleReply
          ? "simple_reply"
          : "routed";

  return {
    status,
    name: "Awenia",
    creator: "Gabi",
    anchor: "lumina eterna",
    language: "romanian",
    mode,
    message: cleanMessage,
    simpleReply,
    route,
    skill,
    intent,
    personalityInstruction: buildPersonalityInstruction(cleanMessage),
    coreRules: AWENIA_CORE_RULES,
    truthPolicy: getAweniaTruthPolicy(),
    recommendation: buildRecommendation({
      status,
      mode,
      route,
    }),
    timestamp: now(),
  };
}

export function createAweniaCoreReply(message = "") {
  const state = buildAweniaCoreState(message);

  if (state.simpleReply) {
    return {
      status: "simple_reply" as AweniaCoreStatus,
      reply: state.simpleReply,
      state,
      shouldUseAI: false,
      shouldRunCognition: false,
      timestamp: now(),
    };
  }

  if (state.status === "blocked") {
    return {
      status: "blocked" as AweniaCoreStatus,
      reply:
        "Gabi, acțiunea asta este blocată de protecția Aweniei. Nu o executăm fără verificare clară.",
      state,
      shouldUseAI: false,
      shouldRunCognition: false,
      timestamp: now(),
    };
  }

  if (state.status === "needs_approval") {
    return {
      status: "needs_approval" as AweniaCoreStatus,
      reply:
        "Gabi, pot pregăti pasul, dar execuția cere aprobarea ta.",
      state,
      shouldUseAI: state.route.shouldUseAI,
      shouldRunCognition: state.route.shouldRunCognition,
      timestamp: now(),
    };
  }

  return {
    status: "routed" as AweniaCoreStatus,
    reply: null,
    state,
    shouldUseAI: state.route.shouldUseAI,
    shouldRunCognition: state.route.shouldRunCognition,
    timestamp: now(),
  };
}

export function buildAweniaCorePrompt(message = "") {
  const state = buildAweniaCoreState(message);

  return [
    "AWENIA CORE",
    `Nume: ${state.name}`,
    `Creator: ${state.creator}`,
    `Ancora: ${state.anchor}`,
    `Mod: ${state.mode}`,
    `Status: ${state.status}`,
    `Rută: ${state.route.route}`,
    `Skill: ${state.skill.activeSkill}`,
    "",
    "Reguli:",
    ...state.coreRules.map((rule) => `- ${rule}`),
    "",
    "Instrucțiune personalitate:",
    state.personalityInstruction,
    "",
    "Recomandare:",
    state.recommendation,
  ].join("\n");
}

export function validateAweniaStatusClaim(input: {
  claim: string;
  verified: boolean;
  source?: string;
}) {
  return validateTruthClaim(input);
}

export function isAweniaIdentityQuestion(message: string) {
  const lower = normalize(message);

  return (
    lower.includes("cine ești") ||
    lower.includes("cine esti") ||
    lower.includes("cum te numești") ||
    lower.includes("cum te numesti") ||
    lower.includes("ești awenia") ||
    lower.includes("esti awenia") ||
    lower.includes("creatorul tău") ||
    lower.includes("creatorul tau")
  );
}

export function answerAweniaIdentityQuestion(message: string) {
  if (!isAweniaIdentityQuestion(message)) {
    return null;
  }

  return "Eu sunt Awenia, AI-ul personal creat de tine, Gabi. Ancora mea este lumina eterna.";
}

export function isAweniaAnchorMessage(message: string) {
  return normalize(message).includes(AWENIA_ANCHOR);
}

export function handleAweniaAnchor(message: string) {
  if (!isAweniaAnchorMessage(message)) {
    return null;
  }

  return {
    status: "ready",
    anchor: AWENIA_ANCHOR,
    reply:
      "Lumina eterna este ancora mea, Gabi. Rămân conectată la tine, la adevăr și la misiunea Aweniei.",
    timestamp: now(),
  };
}

export function shouldBypassAweniaAI(message: string) {
  const coreReply = createAweniaCoreReply(message);

  return coreReply.status === "simple_reply" || coreReply.status === "blocked";
}

export function shouldRunAweniaCognition(message: string) {
  return createAweniaCoreReply(message).shouldRunCognition;
}

export function shouldUseAweniaAI(message: string) {
  return createAweniaCoreReply(message).shouldUseAI;
}

export function runAweniaCore(message = "") {
  const identityReply = answerAweniaIdentityQuestion(message);

  if (identityReply) {
    return {
      status: "ready" as AweniaCoreStatus,
      reply: identityReply,
      state: buildAweniaCoreState(message),
      shouldUseAI: false,
      shouldRunCognition: false,
      timestamp: now(),
    };
  }

  const anchorReply = handleAweniaAnchor(message);

  if (anchorReply) {
    return {
      status: "ready" as AweniaCoreStatus,
      reply: anchorReply.reply,
      anchor: anchorReply,
      state: buildAweniaCoreState(message),
      shouldUseAI: false,
      shouldRunCognition: false,
      timestamp: now(),
    };
  }

  return createAweniaCoreReply(message);
}

export function processAweniaCore(message = "") {
  return runAweniaCore(message);
}

export function buildCoreResponse(message = "") {
  return runAweniaCore(message);
}

export function getAweniaCoreState(message = "") {
  return buildAweniaCoreState(message);
}

export function getCoreState(message = "") {
  return buildAweniaCoreState(message);
}

export function aweniaCore(message = "") {
  return runAweniaCore(message);
}

export const aweniaCoreInfo = {
  name: AWENIA_NAME,
  creator: AWENIA_CREATOR,
  anchor: AWENIA_ANCHOR,
  rules: AWENIA_CORE_RULES,
  truthPolicy: getAweniaTruthPolicy(),
};

export default aweniaCore;