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

type SecurityActionName =
  | "read"
  | "patch"
  | "execute"
  | "evolution"
  | "system_change";

type ToolCommandKind =
  | "status"
  | "read"
  | "analyze"
  | "search"
  | "write"
  | "patch"
  | "rollback"
  | "debug"
  | "planning"
  | "background";

type ToolCommandDefinition = {
  prefix: string;
  kind: ToolCommandKind;
  risk: RouteRisk;
  requiresApproval: boolean;
  securityAction: SecurityActionName;
  description: string;
};

type ToolCommandMatch = ToolCommandDefinition & {
  matchedPrefix: string;
};

const TOOL_COMMANDS: ToolCommandDefinition[] = [
  {
    prefix: "LIST_FILES",
    kind: "read",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "List project files",
  },
  {
    prefix: "READ_FILE:",
    kind: "read",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Read remembered or virtual file",
  },
  {
    prefix: "READ_REAL_FILE:",
    kind: "read",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Read real project file",
  },
  {
    prefix: "ANALYZE_REAL_FILE:",
    kind: "analyze",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Analyze real project file",
  },
  {
    prefix: "SEARCH_CODE:",
    kind: "search",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Search code memory",
  },
  {
    prefix: "SEARCH_INSIDE_FILE:",
    kind: "search",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Search inside file",
  },
  {
    prefix: "CHECK_AWENIA_STATUS",
    kind: "status",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Check Awenia status",
  },
  {
    prefix: "CHECK_PROJECT_STATE",
    kind: "status",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Check project state",
  },
  {
    prefix: "CHECK_MEMORY_SYSTEM",
    kind: "status",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Check memory system",
  },
  {
    prefix: "CHECK_SUPABASE_SYSTEM",
    kind: "status",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Check Supabase system",
  },
  {
    prefix: "CHECK_INTERNET_SYSTEM",
    kind: "status",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Check internet system",
  },
  {
    prefix: "RUN_AUTONOMOUS_TESTS",
    kind: "status",
    risk: "medium",
    requiresApproval: false,
    securityAction: "read",
    description: "Run autonomous tests",
  },
  {
    prefix: "DEBUG_ERROR:",
    kind: "debug",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Analyze error text",
  },
  {
    prefix: "TASK_PLAN:",
    kind: "planning",
    risk: "low",
    requiresApproval: false,
    securityAction: "read",
    description: "Create task plan",
  },
  {
    prefix: "WRITE_FILE:",
    kind: "write",
    risk: "medium",
    requiresApproval: true,
    securityAction: "patch",
    description: "Prepare file write",
  },
  {
    prefix: "PATCH_FILE:",
    kind: "patch",
    risk: "medium",
    requiresApproval: true,
    securityAction: "patch",
    description: "Prepare file patch",
  },
  {
    prefix: "EXECUTE_WRITE:",
    kind: "write",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Execute approved file write",
  },
  {
    prefix: "EXECUTE_WRITE_FILE:",
    kind: "write",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Execute approved file write",
  },
  {
    prefix: "EXECUTE_PATCH:",
    kind: "patch",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Execute approved file patch",
  },
  {
    prefix: "EXECUTE_PATCH_FILE:",
    kind: "patch",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Execute approved file patch",
  },
  {
    prefix: "ROLLBACK_FILE:",
    kind: "rollback",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Prepare rollback",
  },
  {
    prefix: "EXECUTE_ROLLBACK:",
    kind: "rollback",
    risk: "high",
    requiresApproval: true,
    securityAction: "patch",
    description: "Execute approved rollback",
  },
  {
    prefix: "RUN_BACKGROUND_WORKER",
    kind: "background",
    risk: "medium",
    requiresApproval: true,
    securityAction: "execute",
    description: "Run background worker",
  },
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

const CRITICAL_PATH_MARKERS = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  "app/protected-core.ts",
];

const HIGH_RISK_PATH_MARKERS = [
  "app/api/awenia/route.ts",
  "app/api/",
  "app/memory-store.ts",
  "app/supabase.ts",
  "app/security.ts",
  "app/pending-actions.ts",
  "app/dev-agent.ts",
];

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return String(text).toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizePath(text = "") {
  return String(text).replace(/\\/g, "/").trim();
}

function upperTrim(text = "") {
  return String(text).trim().toUpperCase();
}

function isSimpleGreeting(message: string) {
  const clean = normalize(message);

  return SIMPLE_GREETINGS.includes(clean);
}

function isSimpleShortMessage(message: string) {
  const clean = normalize(message);

  return (
    clean.length > 0 &&
    clean.length <= 20 &&
    !clean.includes(":") &&
    !clean.includes("cod") &&
    !clean.includes("code") &&
    !clean.includes("eroare") &&
    !clean.includes("error") &&
    !clean.includes("awenia") &&
    !clean.includes("internet") &&
    !clean.includes("memorie") &&
    !clean.includes("memory") &&
    !clean.includes("supabase") &&
    !clean.includes("status") &&
    !clean.includes("check")
  );
}

function matchesCommandPrefix(upperMessage: string, prefix: string) {
  const upperPrefix = prefix.toUpperCase();

  return upperMessage.startsWith(upperPrefix);
}

function detectCommandDefinition(message: string): ToolCommandMatch | null {
  const upper = upperTrim(message);

  const exactMatch = TOOL_COMMANDS.find((command) =>
    matchesCommandPrefix(upper, command.prefix)
  );

  if (exactMatch) {
    return {
      ...exactMatch,
      matchedPrefix: exactMatch.prefix,
    };
  }

  if (upper.startsWith("CHECK_")) {
    return {
      prefix: "CHECK_",
      matchedPrefix: "CHECK_",
      kind: "status",
      risk: "low",
      requiresApproval: false,
      securityAction: "read",
      description: "Generic status check command",
    };
  }

  return null;
}

function detectCommand(message: string) {
  return detectCommandDefinition(message)?.matchedPrefix || null;
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

function includesAnyMarker(message: string, markers: string[]) {
  const normalized = normalizePath(message).toLowerCase();

  return markers.some((marker) =>
    normalized.includes(normalizePath(marker).toLowerCase())
  );
}

function maxRisk(a: RouteRisk, b: RouteRisk): RouteRisk {
  const order: Record<RouteRisk, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return order[b] > order[a] ? b : a;
}

function detectRouteRisk(
  route: RouteName,
  message: string,
  commandMatch?: ToolCommandMatch | null
): RouteRisk {
  let risk: RouteRisk = commandMatch?.risk || "low";

  if (includesAnyMarker(message, CRITICAL_PATH_MARKERS)) {
    return "critical";
  }

  if (includesAnyMarker(message, HIGH_RISK_PATH_MARKERS)) {
    risk = maxRisk(risk, "high");
  }

  if (
    !commandMatch &&
    (route === "code" ||
      route === "debug" ||
      route === "evolution" ||
      route === "security")
  ) {
    risk = maxRisk(risk, "medium");
  }

  return risk;
}

function routeRequiresApproval(
  route: RouteName,
  risk: RouteRisk,
  commandMatch?: ToolCommandMatch | null
) {
  if (risk === "critical") return true;

  if (commandMatch) {
    return commandMatch.requiresApproval;
  }

  if (risk === "high") return true;
  if (risk === "medium") return true;

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
  requiresApproval: boolean,
  commandMatch?: ToolCommandMatch | null
) {
  if (route === "blocked" || risk === "critical") {
    return "Nu executa. Acțiunea este blocată sau critică.";
  }

  if (commandMatch && !requiresApproval) {
    return `Execută doar handlerul verificat pentru comandă: ${commandMatch.description}.`;
  }

  if (commandMatch && requiresApproval) {
    return `Pregătește acțiunea, dar execuția cere aprobarea lui Gabi: ${commandMatch.description}.`;
  }

  if (requiresApproval) {
    return "Pregătește răspunsul sau acțiunea, dar execuția cere aprobarea lui Gabi.";
  }

  if (route === "simple_reply") {
    return "Răspunde direct, fără AI greu și fără cognition runtime.";
  }

  return "Continuă pe ruta detectată.";
}

function buildDefaultIntent(cleanMessage: string) {
  return {
    status: "not_detected",
    message: cleanMessage,
    source: "user",
    detected: false,
    primaryIntent: null,
    candidates: [],
    detectedCandidates: [],
    recommendation: "Intent router was skipped for this route.",
    truthPolicy: {
      noFakeIntentExecution: true,
      noClaimSavedWithoutDatabaseWrite: true,
      noHighRiskExecutionWithoutApproval: true,
    },
    timestamp: now(),
  };
}

function getSecurityAction(
  route: RouteName,
  commandMatch?: ToolCommandMatch | null
): SecurityActionName {
  if (commandMatch) return commandMatch.securityAction;

  if (route === "code") return "patch";
  if (route === "evolution") return "evolution";
  if (route === "security") return "system_change";

  return "read";
}

function shouldAnalyzeIntentForRoute(
  cleanMessage: string,
  commandMatch: ToolCommandMatch | null
) {
  if (!cleanMessage) return false;
  if (commandMatch) return false;
  if (isSimpleGreeting(cleanMessage)) return false;
  if (isSimpleShortMessage(cleanMessage)) return false;

  return true;
}

export function analyzeRouting(message: string): RouteDecision {
  const cleanMessage = String(message || "").trim();
  const commandMatch = detectCommandDefinition(cleanMessage);
  const command = commandMatch?.matchedPrefix || null;

  const skill = detectSkillFromMessage(cleanMessage);

  const intent = shouldAnalyzeIntentForRoute(cleanMessage, commandMatch)
    ? analyzeIntentRouter(cleanMessage, "user")
    : buildDefaultIntent(cleanMessage);

  const intentRoute = mapIntentToRoute(
    intent.primaryIntent?.name
  );

  let route: RouteName = "chat";
  let reason = "Default chat route";

  if (!cleanMessage) {
    route = "simple_reply";
    reason = "Empty message detected";
  } else if (commandMatch) {
    route = "tool_command";
    reason = `Tool command detected: ${commandMatch.matchedPrefix}`;
  } else if (isSimpleGreeting(cleanMessage)) {
    route = "simple_reply";
    reason = "Simple greeting detected";
  } else if (isSimpleShortMessage(cleanMessage)) {
    route = "simple_reply";
    reason = "Simple short message detected";
  } else if (intentRoute) {
    route = intentRoute;
    reason = `Intent route detected: ${intentRoute}`;
  } else {
    route = mapSkillToRoute(skill.skill);
    reason = `Skill route detected: ${skill.skill}`;
  }

  const risk = detectRouteRisk(route, cleanMessage, commandMatch);
  const requiresApprovalValue = routeRequiresApproval(
    route,
    risk,
    commandMatch
  );

  const securityAction = getSecurityAction(route, commandMatch);

  const security = validateSecurityAction({
    action: securityAction,
    content: cleanMessage,
    approvedByGabi: false,
    verified: true,
    reason: `Routing safety check for ${route}`,
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
      requiresApprovalValue,
      commandMatch
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

async function safeSaveRoutingReflection(route: RouteDecision) {
  try {
    const reflection = await createAutonomousReflection(
      `Routing decision: ${route.route}`,
      `Risk: ${route.risk}. Approval: ${route.requiresApproval}. Reason: ${route.reason}`,
      route.recommendation
    );

    let suggestion: any = null;

    if (route.requiresApproval) {
      suggestion = await createEvolutionSuggestion(
        `Routing needs approval: ${route.route}`,
        `Route ${route.route} was detected with risk ${route.risk}.`,
        7
      );
    }

    return {
      status: "saved",
      reflection,
      suggestion,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      error: error?.message || "Failed to save routing reflection",
      timestamp: now(),
    };
  }
}

async function safeCreateTaskPlan(message: string) {
  try {
    return await createTaskPlan(message);
  } catch (error: any) {
    return {
      status: "failed",
      error: error?.message || "Failed to create task plan",
      timestamp: now(),
    };
  }
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
  let reflectionResult: any = null;

  try {
    const shouldRunSkillSystem =
      options?.runSkill ??
      (
        route.route !== "simple_reply" &&
        route.route !== "tool_command" &&
        route.route !== "blocked"
      );

    if (shouldRunSkillSystem) {
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

    if (
      options?.createPlan &&
      route.route !== "simple_reply" &&
      route.route !== "tool_command" &&
      route.route !== "blocked"
    ) {
      taskPlan = await safeCreateTaskPlan(message);
    }

    if (
      (options?.saveReflection ?? false) &&
      route.route !== "simple_reply"
    ) {
      reflectionResult = await safeSaveRoutingReflection(route);
    }

    return {
      status: route.status,
      route,
      skillState,
      intentResult,
      taskPlan,
      reflectionResult,
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
      reflectionResult,
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
      `Run tools: ${route.shouldRunTools}`,
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