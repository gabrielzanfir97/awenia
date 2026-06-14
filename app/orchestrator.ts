import {
  runAweniaCore,
  buildAweniaCorePrompt,
  getAweniaIdentity,
} from "./awenia-core";

import {
  analyzeRouting,
  runRouting,
} from "./routing";

import {
  runIntentRouter,
  analyzeIntentRouter,
} from "./intent-router";

import {
  runSkillSystem,
  buildSkillContext,
} from "./skills";

import {
  runPersonalitySystem,
  buildPersonalityInstruction,
} from "./personality";

import {
  buildMessages,
  buildPromptForRoute,
  buildPromptForSkill,
} from "./prompts";

import { createTaskPlan } from "./task-planner";

import { validateSecurityAction } from "./security";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type OrchestratorStatus =
  | "simple_reply"
  | "ready_for_ai"
  | "tool_command"
  | "needs_approval"
  | "blocked"
  | "planned"
  | "failed";

export type OrchestratorMode =
  | "simple"
  | "chat"
  | "tool"
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "planning"
  | "security"
  | "evolution";

export type OrchestratorOptions = {
  runIntent?: boolean;
  runSkill?: boolean;
  runPersonality?: boolean;
  createPlan?: boolean;
  saveReflection?: boolean;
  allowDirectReply?: boolean;
};

export type OrchestratorResult = {
  status: OrchestratorStatus;
  mode: OrchestratorMode;
  message: string;
  reply: string | null;
  shouldUseAI: boolean;
  shouldRunTools: boolean;
  shouldRunCognition: boolean;
  command: string | null;
  requiresApproval: boolean;
  risk: string;
  confidence: number;
  core: any;
  route: any;
  skill: any;
  intent: any;
  personality: any;
  taskPlan: any;
  security: any;
  prompts: {
    systemPrompt: string;
    messages: any[];
    corePrompt: string;
    personalityInstruction: string;
  };
  recommendation: string;
  truthPolicy: {
    noFakeExecution: boolean;
    noFakeToolResult: boolean;
    noFakeBuildStatus: boolean;
    noFakeInternetStatus: boolean;
    noHighRiskWithoutApproval: boolean;
  };
  execution: {
    startedAt: string;
    completedAt: string;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function mapRouteToMode(route: string): OrchestratorMode {
  if (route === "simple_reply") return "simple";
  if (route === "tool_command") return "tool";
  if (route === "code") return "code";
  if (route === "debug") return "debug";
  if (route === "memory") return "memory";
  if (route === "internet") return "internet";
  if (route === "planning") return "planning";
  if (route === "security") return "security";
  if (route === "evolution") return "evolution";

  return "chat";
}

function mapStatus(input: {
  core: any;
  route: any;
  directReply: string | null;
  blocked: boolean;
  needsApproval: boolean;
}): OrchestratorStatus {
  if (input.blocked) return "blocked";
  if (input.directReply) return "simple_reply";
  if (input.route?.route === "tool_command") return "tool_command";
  if (input.needsApproval) return "needs_approval";

  return "ready_for_ai";
}

function buildRecommendation(input: {
  status: OrchestratorStatus;
  mode: OrchestratorMode;
  route: any;
}) {
  if (input.status === "blocked") {
    return "Nu executa. Acțiunea este blocată.";
  }

  if (input.status === "needs_approval") {
    return "Pregătește răspunsul sau planul, dar nu executa fără aprobarea lui Gabi.";
  }

  if (input.status === "tool_command") {
    return "Trimite comanda către handlerul verificat, fără AI greu.";
  }

  if (input.status === "simple_reply") {
    return "Răspunde direct și scurt.";
  }

  if (input.mode === "code") {
    return "Lucrează doar pe fișiere reale/verificate și nu pretinde execuție.";
  }

  if (input.mode === "debug") {
    return "Folosește eroarea reală și nu ghici cauza.";
  }

  return "Continuă cu AI doar dacă ruta cere răspuns generativ.";
}

function shouldUseAIFromStatus(status: OrchestratorStatus, route: any) {
  if (status === "blocked") return false;
  if (status === "simple_reply") return false;
  if (status === "tool_command") return false;

  return Boolean(route?.shouldUseAI ?? true);
}

function shouldRunToolsFromStatus(status: OrchestratorStatus, route: any) {
  if (status !== "tool_command") return false;

  return Boolean(route?.shouldRunTools ?? true);
}

async function maybeSaveOrchestrationReflection(input: {
  message: string;
  status: OrchestratorStatus;
  mode: OrchestratorMode;
  route: any;
  recommendation: string;
}) {
  try {
    await createAutonomousReflection(
      `Orchestration: ${input.mode}`,
      `Status: ${input.status}. Route: ${input.route?.route}. Risk: ${input.route?.risk}.`,
      input.recommendation
    );

    if (input.status === "needs_approval") {
      await createEvolutionSuggestion(
        `Orchestrator needs approval: ${input.mode}`,
        `Message routed to ${input.mode} with approval requirement.`,
        7
      );
    }
  } catch {
    // Nu blocăm răspunsul dacă memoria nu poate salva.
  }
}

export async function orchestrateMessage(
  message: string,
  options: OrchestratorOptions = {}
): Promise<OrchestratorResult> {
  const startedAt = now();

  const cleanMessage = message.trim();

  try {
    const allowDirectReply = options.allowDirectReply ?? true;

    const core = runAweniaCore(cleanMessage);
    const route = analyzeRouting(cleanMessage);
    const mode = mapRouteToMode(route.route);

    let skill: any = buildSkillContext(cleanMessage);
    let intent: any = analyzeIntentRouter(cleanMessage, "user");
    let personality: any = {
      instruction: buildPersonalityInstruction(cleanMessage),
    };
    let taskPlan: any = null;

    if (options.runSkill ?? true) {
      skill = await runSkillSystem(cleanMessage);
    }

    if (options.runIntent ?? true) {
      intent = await runIntentRouter(cleanMessage, "user", {
        execute: false,
        onlyPrimary: false,
        skipApprovalRequired: true,
      });
    }

    if (options.runPersonality ?? true) {
      personality = await runPersonalitySystem(cleanMessage);
    }

    if (options.createPlan ?? false) {
      taskPlan = await createTaskPlan(cleanMessage);
    }

    const security = validateSecurityAction({
      action:
        route.route === "tool_command"
          ? "execute"
          : route.route === "code"
            ? "patch"
            : route.route === "evolution"
              ? "evolution"
              : route.route === "security"
                ? "system_change"
                : "read",
      content: cleanMessage,
      approvedByGabi: false,
      verified: true,
      reason: "Orchestrator safety check",
    });

    const blocked =
      route.status === "blocked" ||
      security.blocked ||
      core.status === "blocked";

    const needsApproval =
      route.requiresApproval ||
      security.requiresGabiApproval ||
      core.status === "needs_approval";

    const directReply =
      allowDirectReply && core.reply && !route.shouldRunTools
        ? core.reply
        : null;

    const status = mapStatus({
      core,
      route,
      directReply,
      blocked,
      needsApproval,
    });

    const finalMode = blocked ? "security" : mode;

    const recommendation = buildRecommendation({
      status,
      mode: finalMode,
      route,
    });

    const systemPrompt = buildPromptForRoute(route.route, {
      userMessage: cleanMessage,
      route: route.route,
      activeSkill: skill.activeSkill || skill.skill,
      verifiedStatus: {
        route: route.route,
        risk: route.risk,
        requiresApproval: needsApproval,
        securityStatus: security.status,
      },
      extraInstructions: recommendation,
    });

    const messages = buildMessages({
      userMessage: cleanMessage,
      route: route.route,
      activeSkill: skill.activeSkill || skill.skill,
      mode: finalMode === "tool" ? "tool" : (finalMode as any),
      verifiedStatus: {
        route: route.route,
        risk: route.risk,
        requiresApproval: needsApproval,
        securityStatus: security.status,
      },
      extraInstructions: recommendation,
    });

    if (options.saveReflection ?? false) {
      await maybeSaveOrchestrationReflection({
        message: cleanMessage,
        status,
        mode: finalMode,
        route,
        recommendation,
      });
    }

    return {
      status,
      mode: finalMode,
      message: cleanMessage,
      reply:
        blocked
          ? "Gabi, acțiunea asta este blocată de protecția Aweniei."
          : directReply,
      shouldUseAI: shouldUseAIFromStatus(status, route),
      shouldRunTools: shouldRunToolsFromStatus(status, route),
      shouldRunCognition: Boolean(route.shouldRunCognition),
      command: route.command,
      requiresApproval: needsApproval,
      risk: route.risk,
      confidence: route.confidence,
      core,
      route,
      skill,
      intent,
      personality,
      taskPlan,
      security,
      prompts: {
        systemPrompt,
        messages,
        corePrompt: buildAweniaCorePrompt(cleanMessage),
        personalityInstruction: buildPersonalityInstruction(cleanMessage),
      },
      recommendation,
      truthPolicy: {
        noFakeExecution: true,
        noFakeToolResult: true,
        noFakeBuildStatus: true,
        noFakeInternetStatus: true,
        noHighRiskWithoutApproval: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      mode: "chat",
      message: cleanMessage,
      reply: null,
      shouldUseAI: true,
      shouldRunTools: false,
      shouldRunCognition: false,
      command: null,
      requiresApproval: true,
      risk: "medium",
      confidence: 0,
      core: null,
      route: null,
      skill: null,
      intent: null,
      personality: null,
      taskPlan: null,
      security: null,
      prompts: {
        systemPrompt: buildPromptForSkill("general", {
          userMessage: cleanMessage,
        }),
        messages: buildMessages({
          userMessage: cleanMessage,
        }),
        corePrompt: "",
        personalityInstruction: "",
      },
      recommendation:
        "Orchestrator failed. Răspunde simplu și repară eroarea pe baza logului real.",
      truthPolicy: {
        noFakeExecution: true,
        noFakeToolResult: true,
        noFakeBuildStatus: true,
        noFakeInternetStatus: true,
        noHighRiskWithoutApproval: true,
      },
      execution: {
        startedAt,
        completedAt: now(),
      },
      error: error?.message || "Unknown orchestrator error",
      timestamp: now(),
    } as any;
  }
}

export async function runOrchestrator(
  message: string,
  options?: OrchestratorOptions
) {
  return orchestrateMessage(message, options);
}

export async function orchestrateAwenia(
  message: string,
  options?: OrchestratorOptions
) {
  return orchestrateMessage(message, options);
}

export async function orchestrateAweniaMessage(
  message: string,
  options?: OrchestratorOptions
) {
  return orchestrateMessage(message, options);
}

export async function processMessage(message: string) {
  return orchestrateMessage(message);
}

export async function processUserMessage(message: string) {
  return orchestrateMessage(message);
}

export async function handleMessage(message: string) {
  return orchestrateMessage(message);
}

export async function handleUserMessage(message: string) {
  return orchestrateMessage(message);
}

export async function routeAndOrchestrate(message: string) {
  return orchestrateMessage(message, {
    runIntent: true,
    runSkill: true,
    runPersonality: true,
    createPlan: false,
    saveReflection: false,
  });
}

export async function planAndOrchestrate(message: string) {
  return orchestrateMessage(message, {
    runIntent: true,
    runSkill: true,
    runPersonality: true,
    createPlan: true,
    saveReflection: true,
  });
}

export function getOrchestratorIdentity() {
  return {
    identity: getAweniaIdentity(),
    role: "main_message_orchestrator",
    responsibility:
      "Route messages between Awenia core, skills, intents, tools, prompts and AI generation.",
    truthPolicy: {
      noFakeExecution: true,
      noFakeStatus: true,
      noHighRiskWithoutApproval: true,
    },
    timestamp: now(),
  };
}

export function buildOrchestratorPreview(message: string) {
  const route = analyzeRouting(message);
  const skill = buildSkillContext(message);
  const intent = analyzeIntentRouter(message, "user");

  return {
    message,
    route,
    skill,
    intent,
    mode: mapRouteToMode(route.route),
    shouldUseAI: route.shouldUseAI,
    shouldRunTools: route.shouldRunTools,
    shouldRunCognition: route.shouldRunCognition,
    requiresApproval: route.requiresApproval,
    timestamp: now(),
  };
}

export const orchestrator = orchestrateMessage;

export default orchestrateMessage;