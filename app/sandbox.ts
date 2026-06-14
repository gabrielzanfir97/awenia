import { validateSecurityAction } from "./security";

export type SandboxStatus =
  | "ready"
  | "validated"
  | "simulated"
  | "blocked"
  | "failed"
  | "not_executed";

export type SandboxRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type SandboxActionType =
  | "command"
  | "code"
  | "file_read"
  | "file_write"
  | "file_patch"
  | "build"
  | "test"
  | "unknown";

export type SandboxAction = {
  type: SandboxActionType;
  content: string;
  filePath?: string;
  approvedByGabi?: boolean;
  metadata?: any;
};

export type SandboxResult = {
  status: SandboxStatus;
  action: SandboxAction;
  risk: SandboxRisk;
  allowed: boolean;
  executed: false;
  simulated: boolean;
  blocked: boolean;
  reason: string;
  output: string;
  warnings: string[];
  security: any;
  truthPolicy: {
    sandboxDoesNotExecuteOSCommands: boolean;
    noFakeBuildResult: boolean;
    noFakeTestResult: boolean;
    noFakeFileChange: boolean;
    riskyActionsRequireGabiApproval: boolean;
  };
  timestamp: string;
};

const BLOCKED_PATTERNS = [
  ".env",
  ".git",
  "node_modules",
  "private_key",
  "service_role",
  "secret",
  "rm -rf",
  "del /s",
  "format ",
  "shutdown",
  "powershell -enc",
  "curl ",
  "wget ",
];

const HIGH_RISK_PATHS = [
  "app/api/awenia/route.ts",
  "app/security.ts",
  "app/protected-core.ts",
  "app/supabase.ts",
  "app/memory-store.ts",
  "app/dev-agent.ts",
  "app/pending-actions.ts",
];

const SAFE_COMMANDS = [
  "npm run build",
  "npm run lint",
  "npm test",
  "npm run test",
  "npm run dev",
  "git status",
  "git diff",
];

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\\/g, "/").replace(/\s+/g, " ");
}

function normalizePath(filePath = "") {
  return filePath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
}

function detectActionType(content = "", filePath = ""): SandboxActionType {
  const lower = normalize(`${content} ${filePath}`);

  if (lower.includes("npm run build") || lower.includes("next build")) {
    return "build";
  }

  if (lower.includes("npm test") || lower.includes("npm run test")) {
    return "test";
  }

  if (
    lower.includes("write") ||
    lower.includes("save") ||
    lower.includes("create file")
  ) {
    return "file_write";
  }

  if (
    lower.includes("patch") ||
    lower.includes("replace") ||
    lower.includes("modify")
  ) {
    return "file_patch";
  }

  if (
    lower.includes("read") ||
    lower.includes("cat ") ||
    lower.includes("type ")
  ) {
    return "file_read";
  }

  if (
    lower.includes("npm ") ||
    lower.includes("git ") ||
    lower.includes("powershell") ||
    lower.includes("cmd")
  ) {
    return "command";
  }

  if (
    lower.includes("function") ||
    lower.includes("const ") ||
    lower.includes("export ")
  ) {
    return "code";
  }

  return "unknown";
}

function detectRisk(action: SandboxAction): SandboxRisk {
  const content = normalize(action.content);
  const filePath = normalizePath(action.filePath || "").toLowerCase();

  if (
    BLOCKED_PATTERNS.some((pattern) =>
      normalize(`${content} ${filePath}`).includes(pattern)
    )
  ) {
    return "critical";
  }

  if (
    HIGH_RISK_PATHS.some((path) => filePath.includes(path)) ||
    content.includes("delete") ||
    content.includes("remove") ||
    content.includes("drop table")
  ) {
    return "high";
  }

  if (
    action.type === "file_write" ||
    action.type === "file_patch" ||
    action.type === "build" ||
    action.type === "test" ||
    action.type === "command"
  ) {
    return "medium";
  }

  return "low";
}

function isSafeCommand(command = "") {
  const clean = normalize(command);

  return SAFE_COMMANDS.some((safe) => clean.startsWith(safe));
}

function buildWarnings(action: SandboxAction, risk: SandboxRisk) {
  const warnings: string[] = [];

  if (risk === "critical") {
    warnings.push("Acțiune critică blocată.");
  }

  if (risk === "high") {
    warnings.push("Acțiune high-risk. Cere aprobare Gabi.");
  }

  if (action.type === "build") {
    warnings.push("Sandbox-ul nu rulează build real. Trebuie rulat în terminal.");
  }

  if (action.type === "test") {
    warnings.push("Sandbox-ul nu rulează teste reale. Trebuie rulate în terminal.");
  }

  if (action.type === "command" && !isSafeCommand(action.content)) {
    warnings.push("Comanda nu este în lista de comenzi sigure.");
  }

  if (
    action.type === "file_write" ||
    action.type === "file_patch"
  ) {
    warnings.push("Sandbox-ul nu modifică fișiere direct.");
  }

  return warnings;
}

function buildOutput(action: SandboxAction, risk: SandboxRisk, blocked: boolean) {
  if (blocked) {
    return "Acțiunea a fost blocată. Nu s-a executat nimic.";
  }

  if (action.type === "build") {
    return "Simulare: pentru verificare reală rulează în terminal: npm run build";
  }

  if (action.type === "test") {
    return "Simulare: pentru verificare reală rulează testele în terminal.";
  }

  if (action.type === "command") {
    return `Simulare comandă: ${action.content}`;
  }

  if (action.type === "file_read") {
    return `Simulare citire fișier: ${action.filePath || "necunoscut"}`;
  }

  if (action.type === "file_write") {
    return `Simulare scriere fișier: ${action.filePath || "necunoscut"}`;
  }

  if (action.type === "file_patch") {
    return `Simulare patch fișier: ${action.filePath || "necunoscut"}`;
  }

  if (action.type === "code") {
    return "Simulare analiză cod. Codul nu a fost executat.";
  }

  return "Simulare completă. Nu s-a executat nimic real.";
}

export function validateSandboxAction(
  input: string | SandboxAction,
  filePath = ""
): SandboxResult {
  const action: SandboxAction =
    typeof input === "string"
      ? {
        type: detectActionType(input, filePath),
        content: input,
        filePath,
        approvedByGabi: false,
      }
      : {
        ...input,
        type:
          input.type ||
          detectActionType(input.content, input.filePath || filePath),
        filePath: input.filePath || filePath,
        approvedByGabi: Boolean(input.approvedByGabi),
      };

  const risk = detectRisk(action);

  const security = validateSecurityAction({
    action: `sandbox:${action.type}`,
    content: `${action.content}\n${action.filePath || ""}`,
    approvedByGabi: action.approvedByGabi === true,
    verified: true,
    reason: "Sandbox action validation",
  });

  const commandUnsafe =
    action.type === "command" && !isSafeCommand(action.content);

  const blocked =
    risk === "critical" ||
    security.blocked === true ||
    commandUnsafe ||
    ((risk === "high" || risk === "medium") &&
      action.approvedByGabi !== true &&
      (action.type === "file_write" ||
        action.type === "file_patch" ||
        action.type === "command"));

  const allowed = !blocked;

  return {
    status: blocked ? "blocked" : "validated",
    action,
    risk,
    allowed,
    executed: false,
    simulated: false,
    blocked,
    reason: blocked
      ? "Acțiunea nu este permisă fără verificare/aprobare."
      : "Acțiunea este validată pentru simulare, nu execuție reală.",
    output: "",
    warnings: buildWarnings(action, risk),
    security,
    truthPolicy: {
      sandboxDoesNotExecuteOSCommands: true,
      noFakeBuildResult: true,
      noFakeTestResult: true,
      noFakeFileChange: true,
      riskyActionsRequireGabiApproval: true,
    },
    timestamp: now(),
  };
}

export function runSandbox(
  input: string | SandboxAction,
  filePath = ""
): SandboxResult {
  const validation = validateSandboxAction(input, filePath);

  return {
    ...validation,
    status: validation.blocked ? "blocked" : "simulated",
    simulated: !validation.blocked,
    output: buildOutput(
      validation.action,
      validation.risk,
      validation.blocked
    ),
    timestamp: now(),
  };
}

export function simulateSandboxAction(
  input: string | SandboxAction,
  filePath = ""
) {
  return runSandbox(input, filePath);
}

export function runCommandInSandbox(
  command: string,
  approvedByGabi = false
) {
  return runSandbox({
    type: detectActionType(command),
    content: command,
    approvedByGabi,
  });
}

export function runCodeInSandbox(
  code: string,
  metadata: any = {}
) {
  return runSandbox({
    type: "code",
    content: code,
    metadata,
  });
}

export function runFileReadSandbox(filePath: string) {
  return runSandbox({
    type: "file_read",
    content: `Read file ${filePath}`,
    filePath,
  });
}

export function runFileWriteSandbox(
  filePath: string,
  content: string,
  approvedByGabi = false
) {
  return runSandbox({
    type: "file_write",
    content,
    filePath,
    approvedByGabi,
  });
}

export function runFilePatchSandbox(
  filePath: string,
  patch: string,
  approvedByGabi = false
) {
  return runSandbox({
    type: "file_patch",
    content: patch,
    filePath,
    approvedByGabi,
  });
}

export function simulateBuild() {
  return runSandbox({
    type: "build",
    content: "npm run build",
    approvedByGabi: true,
  });
}

export function simulateTests() {
  return runSandbox({
    type: "test",
    content: "npm test",
    approvedByGabi: true,
  });
}

export function getSandboxState() {
  return {
    status: "ready" as SandboxStatus,
    executesCommands: false,
    executesCode: false,
    modifiesFiles: false,
    safeCommands: SAFE_COMMANDS,
    blockedPatterns: BLOCKED_PATTERNS,
    highRiskPaths: HIGH_RISK_PATHS,
    truthPolicy: {
      sandboxDoesNotExecuteOSCommands: true,
      noFakeBuildResult: true,
      noFakeTestResult: true,
      noFakeFileChange: true,
      riskyActionsRequireGabiApproval: true,
    },
    timestamp: now(),
  };
}

export function buildSandboxReport(
  actions: SandboxAction[]
) {
  const results = actions.map((action) => runSandbox(action));

  return {
    status: results.some((result) => result.blocked)
      ? "blocked"
      : "simulated",
    results,
    summary: {
      total: results.length,
      allowed: results.filter((result) => result.allowed).length,
      blocked: results.filter((result) => result.blocked).length,
      critical: results.filter((result) => result.risk === "critical").length,
      high: results.filter((result) => result.risk === "high").length,
      medium: results.filter((result) => result.risk === "medium").length,
      low: results.filter((result) => result.risk === "low").length,
    },
    timestamp: now(),
  };
}

export async function executeInSandbox(
  input: string | SandboxAction,
  filePath = ""
) {
  return runSandbox(input, filePath);
}

export async function testInSandbox(
  input: string | SandboxAction,
  filePath = ""
) {
  return runSandbox(input, filePath);
}

export async function sandboxCode(
  code: string,
  metadata: any = {}
) {
  return runCodeInSandbox(code, metadata);
}

export async function sandboxCommand(
  command: string,
  approvedByGabi = false
) {
  return runCommandInSandbox(command, approvedByGabi);
}

export const createSandbox = getSandboxState;
export const sandboxState = getSandboxState;
export const validateSandbox = validateSandboxAction;
export const simulateCommand = runCommandInSandbox;
export const simulateCode = runCodeInSandbox;
export const executeSandboxed = executeInSandbox;
export const runInSandbox = runSandbox;
export const sandbox = runSandbox;

export default runSandbox;