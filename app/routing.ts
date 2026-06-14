import {
  detectSkillFromMessage,
  buildSkillContext,
  runSkillSystem,
  SkillName,
} from "./skills";

import {
  analyzeIntentRouter,
  runIntentRouter,
} from "./intent-router";

import { createTaskPlan } from "./task-planner";

import { validateSecurityAction } from "./security";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type RouteName =
  | "simple_reply"
  | "chat"
  | "tool_command"
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "learning"
  | "personality"
  | "goal"
  | "evolution"
  | "security"
  | "planning"
  | "blocked";

export type RouteRisk = "low" | "medium" | "high" | "critical";

export type RouteStatus =
  | "routed"
  | "needs_approval"
  | "blocked"
  | "needs_verification"
  | "failed";

export type RouteDecision = {
  status: RouteStatus;
  route: RouteName;
  message: string;
  command: string | null;
  activeSkill: SkillName;
  confidence: number;
  risk: RouteRisk;
  requiresApproval: boolean;
  shouldUseAI: boolean;
  shouldRunTools: boolean;
  shouldRunIntentRouter: boolean;
  shouldRunCognition: boolean;
  reason: string;
  skill: any;
  intent: any;
  taskPlan?: any;
  security: any;
  recommendation: string;
  truthPolicy: {
    noFakeRouting: boolean;
    noToolExecutionWithoutVerification: boolean;
    noHighRiskExecutionWithoutApproval: boolean;
    noStatusClaimWithoutCheck: boolean;
  };
  timestamp: string;
};

const TOOL_COMMAND_PREFIXES = [
  "LIST_FILES",
  "READ_FILE:",
  "READ_REAL_FILE:",
  "ANALYZE_REAL_FILE:",
  "WRITE_FILE:",
  "PATCH_FILE:",
  "EXECUTE_WRITE:",
  "EXECUTE_PATCH:",
  "ROLLBACK_FILE:",
  "EXECUTE_ROLLBACK:",
  "SEARCH_CODE:",
  "SEARCH_INSIDE_FILE:",
  "CHECK_AWENIA_STATUS",
  "RUN_AUTONOMOUS_TESTS",
  "RUN_BACKGROUND_WORKER",
  "DEBUG_ERROR:",
  "TASK_PLAN:",
  "CHECK_INTERNET_SYSTEM",
];

const SIMPLE_GREETINGS = [
  "bună",
  "buna",
  "salut",
  "hei",
  "hello",
  "hi",
  "hey",
];

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function upperTrim(text: string) {
  return text.trim().toUpperCase();
}

function isSimpleGreeting(message: string) {
  const clean = normalize(message);

  return SIMPLE_GREETINGS.includes(clean);
}

function isSimpleShortMessage(message: string) {
  const clean = normalize(message);

  return (
    clean.length <= 20 &&
    !clean.includes(":") &&
    !clean.includes("cod") &&
    !clean.includes("code") &&
    !clean.includes("eroare") &&
    !clean.includes("error") &&
    !clean.includes("awenia") &&
    !clean.includes("internet") &&
    !clean.includes("memorie")
  );
}

function detectCommand(message: string) {
  const trimmed = message.trim();
  const upper = upperTrim(trimmed);

  const command = TOOL_COMMAND_PREFIXES.find((prefix) =>
    upper.startsWith(prefix)
  );

  return command || null;
}

function mapSkillToRoute(skill: SkillName): RouteName {
  if (skill === "coding") return "code";
  if (skill === "debugging") return "debug";
  if (skill === "memory") return "memory";
  if (skill === "internet") return "internet";
  if (skill === "planning") return "planning";
  if (skill === "security") return "security";
  if (skill === "evolution") return "evolution";
  if (skill === "awenia") return "chat";
  if (skill === "emotional") return "chat";
  if (skill === "business") return "chat";
  if (skill === "family") return "chat";

  return "chat";
}

function mapIntentToRoute(intentName?: string): RouteName | null {
  if (!intentName) return null;

  if (intentName === "learning") return "learning";
  if (intentName === "memory") return "memory";
  if (intentName === "personality") return "personality";
  if (intentName === "goal") return "goal";
  if (intentName === "evolution") return "evolution";

  return null;
}

function detectRouteRisk(route: RouteName, message: string): RouteRisk {
  const lower = normalize(message);

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("delete") ||
    lower.includes("șterge") ||
    lower.includes("sterge") ||
    lower.includes(".git") ||
    lower.includes("node_modules")
  ) {
    return "critical";
  }

  if (
    lower.includes("app/api/awenia/route.ts") ||
    lower.includes("memory-store.ts") ||
    lower.includes("supabase.ts") ||
    lower.includes("security.ts") ||
    lower.includes("protected-core.ts")
  ) {
    return "high";
  }

  if (
    route === "tool_command" ||
    route === "code" ||
    route === "debug" ||
    route === "evolution" ||
    route === "security"
  ) {
    return "medium";
  }

  return "low";
}

function routeRequiresApproval(route: RouteName, risk: RouteRisk) {
  if (risk === "critical") return true;
  if (risk === "high") return true;
  if (risk === "medium") return true;

  if (route === "tool_command") return true;
  if (route === "code") return true;
  if (route === "debug") return true;
  if (route === "evolution") return true;
  if (route === "security") return true;

  return false;
}

function shouldUseAI(route: RouteName) {
  if (route === "simple_reply") return false;
  if (route === "tool_command") return false;
  if (route === "blocked") return false;

  return true;
}

function shouldRunTools(route: RouteName) {
  return route === "tool_command";
}

function shouldRunIntentRouter(route: RouteName) {
  if (route === "simple_reply") return false;
  if (route === "tool_command") return false;
  if (route === "blocked") return false;

  return true;
}

function shouldRunCognition(route: RouteName, message: string) {
  if (route === "simple_reply") return false;
  if (route === "tool_command") return false;
  if (route === "blocked") return false;

  if (isSimpleShortMessage(message)) return false;

  return (
    route === "code" ||
    route === "debug" ||
    route === "memory" ||
    route === "internet" ||
    route === "learning" ||
    route === "goal" ||
    route === "evolution" ||
    route === "security" ||
    route === "planning"
  );
}

function buildRecommendation(
  route: RouteName,
  risk: RouteRisk,
  requiresApproval: boolean
) {
  if (route === "blocked" || risk === "critical") {
    return "Nu executa. Acțiunea este blocată sau critică.";
  }

  if (requiresApproval) {
    return "Pregătește răspunsul sau acțiunea, dar execuția cere aprobarea lui Gabi.";
  }

  if (route === "simple_reply") {
    return "Răspunde direct, fără AI greu și fără cognition runtime.";
  }

  if (route === "tool_command") {
    return "Execută doar handlerul verificat pentru comandă.";
  }

  return "Continuă pe ruta detectată.";
}

export function analyzeRouting(message: string): RouteDecision {
  const cleanMessage = message.trim();
  const command = detectCommand(cleanMessage);

  const skill = detectSkillFromMessage(cleanMessage);
  const intent = analyzeIntentRouter(cleanMessage, "user");

  const intentRoute = mapIntentToRoute(
    intent.primaryIntent?.name
  );

  let route: RouteName = "chat";
  let reason = "Default chat route";

  if (!cleanMessage) {
    route = "simple_reply";
    reason = "Empty or simple message";
  } else if (isSimpleGreeting(cleanMessage)) {
    route = "simple_reply";
    reason = "Simple greeting detected";
  } else if (command) {
    route = "tool_command";
    reason = `Tool command detected: ${command}`;
  } else if (intentRoute) {
    route = intentRoute;
    reason = `Intent route detected: ${intentRoute}`;
  } else {
    route = mapSkillToRoute(skill.skill);
    reason = `Skill route detected: ${skill.skill}`;
  }

  const risk = detectRouteRisk(route, cleanMessage);
  const requiresApprovalValue = routeRequiresApproval(route, risk);

  const security = validateSecurityAction({
    action:
      route === "tool_command"
        ? "execute"
        : route === "code"
          ? "patch"
          : route === "evolution"
            ? "evolution"
            : route === "security"
              ? "system_change"
              : "read",
    content: cleanMessage,
    approvedByGabi: false,
    verified: true,
    reason: "Routing safety check",
  });

  const blocked = risk === "critical" || security.blocked;

  const finalRoute: RouteName = blocked ? "blocked" : route;

  const status: RouteStatus = blocked
    ? "blocked"
    : requiresApprovalValue
      ? "needs_approval"
      : "routed";

  return {
    status,
    route: finalRoute,
    message: cleanMessage,
    command,
    activeSkill: skill.skill,
    confidence: Math.max(
      skill.confidence || 0,
      intent.primaryIntent?.confidence || 0
    ),
    risk,
    requiresApproval: requiresApprovalValue,
    shouldUseAI: shouldUseAI(finalRoute),
    shouldRunTools: shouldRunTools(finalRoute),
    shouldRunIntentRouter: shouldRunIntentRouter(finalRoute),
    shouldRunCognition: shouldRunCognition(finalRoute, cleanMessage),
    reason,
    skill,
    intent,
    security,
    recommendation: buildRecommendation(
      finalRoute,
      risk,
      requiresApprovalValue
    ),
    truthPolicy: {
      noFakeRouting: true,
      noToolExecutionWithoutVerification: true,
      noHighRiskExecutionWithoutApproval: true,
      noStatusClaimWithoutCheck: true,
    },
    timestamp: now(),
  };
}

export async function runRouting(
  message: string,
  options?: {
    runIntent?: boolean;
    runSkill?: boolean;
    createPlan?: boolean;
    saveReflection?: boolean;
  }
) {
  const startedAt = now();

  const route = analyzeRouting(message);

  let skillState: any = null;
  let intentResult: any = null;
  let taskPlan: any = null;

  try {
    if (options?.runSkill ?? true) {
      skillState = await runSkillSystem(message);
    }

    if (
      (options?.runIntent ?? true) &&
      route.shouldRunIntentRouter
    ) {
      intentResult = await runIntentRouter(message, "user", {
        execute: false,
        onlyPrimary: false,
        skipApprovalRequired: true,
      });
    }

    if (options?.createPlan && route.route !== "simple_reply") {
      taskPlan = await createTaskPlan(message);
    }

    if (
      (options?.saveReflection ?? false) &&
      route.route !== "simple_reply"
    ) {
      await createAutonomousReflection(
        `Routing decision: ${route.route}`,
        `Risk: ${route.risk}. Approval: ${route.requiresApproval}. Reason: ${route.reason}`,
        route.recommendation
      );

      if (route.requiresApproval) {
        await createEvolutionSuggestion(
          `Routing needs approval: ${route.route}`,
          `Route ${route.route} was detected with risk ${route.risk}.`,
          7
        );
      }
    }

    return {
      status: route.status,
      route,
      skillState,
      intentResult,
      taskPlan,
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as RouteStatus,
      route,
      skillState,
      intentResult,
      taskPlan,
      error: error?.message || "Unknown routing error",
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }
}

export function buildRoutingContext(message: string) {
  const route = analyzeRouting(message);
  const skillContext = buildSkillContext(message);

  return {
    route,
    skillContext,
    prompt: [
      `Route: ${route.route}`,
      `Status: ${route.status}`,
      `Risk: ${route.risk}`,
      `Requires approval: ${route.requiresApproval}`,
      `Use AI: ${route.shouldUseAI}`,
      `Run cognition: ${route.shouldRunCognition}`,
      `Instruction: ${route.recommendation}`,
    ].join("\n"),
    timestamp: now(),
  };
}

export function getSimpleReply(message: string) {
  if (isSimpleGreeting(message)) {
    return "Bună, Gabi.";
  }

  if (isSimpleShortMessage(message)) {
    return "Da, Gabi.";
  }

  return null;
}

export function shouldUseSimpleReply(message: string) {
  return analyzeRouting(message).route === "simple_reply";
}

export function shouldBypassHeavyRuntime(message: string) {
  const route = analyzeRouting(message);

  return !route.shouldRunCognition;
}

export function shouldCallAI(message: string) {
  return analyzeRouting(message).shouldUseAI;
}

export function shouldExecuteTools(message: string) {
  return analyzeRouting(message).shouldRunTools;
}

export function getRoute(message: string) {
  return analyzeRouting(message).route;
}

export function detectRoute(message: string) {
  return analyzeRouting(message);
}

export function routeMessage(message: string) {
  return analyzeRouting(message);
}

export function routeUserMessage(message: string) {
  return analyzeRouting(message);
}

export async function runRoute(message: string) {
  return runRouting(message);
}

export async function routeAweniaMessage(message: string) {
  return runRouting(message);
}

export async function routeAweniaRequest(message: string) {
  return runRouting(message);
}