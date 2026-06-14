import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  createAutonomousReflection,
} from "./memory-store";

import { validateSecurityAction } from "./security";
import { analyzeProjectFile } from "./project-map";

export type UpgradeArea =
  | "core"
  | "memory"
  | "code"
  | "security"
  | "internet"
  | "autonomy"
  | "ui"
  | "voice"
  | "performance"
  | "project"
  | "unknown";

export type UpgradeRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type UpgradeStatus =
  | "analyzed"
  | "suggested"
  | "duplicate"
  | "needs_approval"
  | "blocked"
  | "failed";

export type UpgradeSuggestion = {
  title: string;
  description: string;
  area: UpgradeArea;
  risk: UpgradeRisk;
  priority: number;
  requiresApproval: boolean;
  blocked: boolean;
  targetFile?: string;
  reason: string;
  expectedBenefit: string;
  safeNextStep: string;
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\\/g, "/").replace(/\s+/g, " ");
}

function clampPriority(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function detectTargetFile(text: string) {
  const match = text.match(/app\/[a-zA-Z0-9_\-./]+\.(ts|tsx|css|ico)/);

  return match?.[0] || undefined;
}

function detectArea(text: string): UpgradeArea {
  const lower = normalize(text);

  if (lower.includes("memory") || lower.includes("memorie") || lower.includes("supabase")) {
    return "memory";
  }

  if (lower.includes("security") || lower.includes("siguran") || lower.includes("approval") || lower.includes("aprobare")) {
    return "security";
  }

  if (lower.includes("internet") || lower.includes("online") || lower.includes("fetch")) {
    return "internet";
  }

  if (lower.includes("autonom") || lower.includes("runtime") || lower.includes("loop") || lower.includes("worker")) {
    return "autonomy";
  }

  if (lower.includes("ui") || lower.includes("page.tsx") || lower.includes("globals.css") || lower.includes("interfa")) {
    return "ui";
  }

  if (lower.includes("voice") || lower.includes("voce")) {
    return "voice";
  }

  if (lower.includes("rapid") || lower.includes("performance") || lower.includes("întârzie") || lower.includes("intarzie")) {
    return "performance";
  }

  if (lower.includes("code") || lower.includes("cod") || lower.includes(".ts") || lower.includes(".tsx")) {
    return "code";
  }

  if (lower.includes("project") || lower.includes("proiect") || lower.includes("audit")) {
    return "project";
  }

  if (lower.includes("core") || lower.includes("awenia")) {
    return "core";
  }

  return "unknown";
}

function detectRisk(text: string, area: UpgradeArea, targetFile?: string): UpgradeRisk {
  const lower = normalize(text);
  const file = normalize(targetFile || "");

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("private_key") ||
    lower.includes("service_role") ||
    lower.includes("delete") ||
    lower.includes("șterge") ||
    lower.includes("sterge")
  ) {
    return "critical";
  }

  if (targetFile) {
    const projectFile = analyzeProjectFile(targetFile);

    if (projectFile.risk === "critical") return "critical";
    if (projectFile.risk === "high") return "high";
  }

  if (
    file.includes("app/api/awenia/route.ts") ||
    file.includes("security.ts") ||
    file.includes("protected-core.ts") ||
    file.includes("supabase.ts") ||
    file.includes("memory-store.ts")
  ) {
    return "high";
  }

  if (
    area === "core" ||
    area === "security" ||
    area === "memory" ||
    area === "autonomy" ||
    area === "code"
  ) {
    return "medium";
  }

  return "low";
}

function detectPriority(area: UpgradeArea, risk: UpgradeRisk, text: string) {
  const lower = normalize(text);
  let priority = 5;

  if (area === "security") priority += 3;
  if (area === "core") priority += 2;
  if (area === "memory") priority += 2;
  if (area === "code") priority += 2;
  if (area === "performance") priority += 2;
  if (area === "autonomy") priority += 2;

  if (risk === "medium") priority += 1;
  if (risk === "high") priority += 2;
  if (risk === "critical") priority += 3;

  if (lower.includes("important")) priority += 2;
  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("build") || lower.includes("eroare") || lower.includes("error")) {
    priority += 2;
  }

  return clampPriority(priority);
}

function buildBenefit(area: UpgradeArea) {
  if (area === "memory") return "Awenia își amintește mai corect și folosește date reale.";
  if (area === "code") return "Awenia înțelege mai bine codul și reduce erorile.";
  if (area === "security") return "Awenia devine mai sigură și păstrează controlul lui Gabi.";
  if (area === "internet") return "Awenia verifică mai bine informațiile online.";
  if (area === "autonomy") return "Awenia devine mai autonomă, dar controlată.";
  if (area === "ui") return "Gabi lucrează mai ușor cu interfața.";
  if (area === "voice") return "Awenia pregătește mai bine sistemul de voce.";
  if (area === "performance") return "Awenia răspunde mai repede și rulează mai eficient.";
  if (area === "core") return "Identitatea și regulile Aweniei devin mai stabile.";

  return "Awenia poate deveni mai bună după verificare.";
}

function buildSafeNextStep(risk: UpgradeRisk, targetFile?: string) {
  if (risk === "critical") {
    return "Nu executa. Cere aprobarea explicită a lui Gabi.";
  }

  if (risk === "high") {
    return "Citește fișierul real și pregătește planul, dar nu modifica fără aprobarea lui Gabi.";
  }

  if (targetFile) {
    return `Citește fișierul real ${targetFile}, apoi pregătește modificarea.`;
  }

  return "Salvează propunerea și aplică doar pașii siguri.";
}

function createTitle(area: UpgradeArea, targetFile?: string) {
  if (targetFile) {
    return `Upgrade ${area}: ${targetFile}`;
  }

  return `Upgrade ${area}`;
}

async function isDuplicate(description: string) {
  const suggestions = await getEvolutionSuggestions(80);
  const signature = normalize(description).slice(0, 120);

  return suggestions.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(signature)
  );
}

export function analyzeUpgradeSuggestion(description = "") {
  const clean = description.trim();
  const targetFile = detectTargetFile(clean);
  const area = detectArea(clean);
  const risk = detectRisk(clean, area, targetFile);
  const priority = detectPriority(area, risk, clean);

  const security = validateSecurityAction({
    action: "upgrade_suggestion",
    content: clean,
    approvedByGabi: false,
    verified: true,
    reason: "Upgrade suggestion safety check",
  });

  const isCritical = (risk as UpgradeRisk) === "critical";
  const blocked = isCritical || security.blocked === true;

  const requiresApproval =
    blocked || ([("medium"), ("high"), ("critical")] as UpgradeRisk[]).includes(risk);

  const suggestion: UpgradeSuggestion = {
    title: createTitle(area, targetFile),
    description: clean || "Upgrade Awenia safely",
    area,
    risk,
    priority,
    requiresApproval,
    blocked,
    targetFile,
    reason: `Area detectată: ${area}. Risk detectat: ${risk}.`,
    expectedBenefit: buildBenefit(area),
    safeNextStep: buildSafeNextStep(risk, targetFile),
    timestamp: now(),
  };

  return {
    status: blocked ? "blocked" : requiresApproval ? "needs_approval" : "analyzed",
    suggestion,
    security,
    truthPolicy: {
      suggestionIsNotExecution: true,
      noFakeUpgradeDone: true,
      riskyUpgradeRequiresGabiApproval: true,
      targetFileMustBeReadBeforePatch: true,
    },
    timestamp: now(),
  };
}

export async function createUpgradeSuggestion(description = "") {
  const analysis = analyzeUpgradeSuggestion(description);
  const suggestion = analysis.suggestion;

  if (suggestion.blocked) {
    await createAutonomousReflection(
      "Upgrade suggestion blocked",
      suggestion.description,
      "Blocked because risk is critical or security rejected it."
    );

    return {
      status: "blocked" as UpgradeStatus,
      analysis,
      saved: false,
      timestamp: now(),
    };
  }

  const duplicate = await isDuplicate(suggestion.description);

  if (duplicate) {
    return {
      status: "duplicate" as UpgradeStatus,
      analysis,
      saved: false,
      timestamp: now(),
    };
  }

  const saved = await createEvolutionSuggestion({
    suggestion: suggestion.title,
    reason: `${suggestion.description}\nBenefit: ${suggestion.expectedBenefit}\nNext: ${suggestion.safeNextStep}`,
    priority: suggestion.priority,
    status: suggestion.requiresApproval ? "pending" : "suggested",
    metadata: {
      source: "upgrade-suggestions",
      area: suggestion.area,
      risk: suggestion.risk,
      targetFile: suggestion.targetFile,
      requiresApproval: suggestion.requiresApproval,
    },
  });

  const reflection = await createAutonomousReflection(
    `Upgrade suggested: ${suggestion.area}`,
    suggestion.description,
    suggestion.safeNextStep
  );

  return {
    status: suggestion.requiresApproval ? "needs_approval" : "suggested",
    analysis,
    saved,
    reflection,
    timestamp: now(),
  };
}

export async function getUpgradeSuggestions(limit = 50) {
  const suggestions = await getEvolutionSuggestions(limit);

  const upgrades = suggestions.filter((item: any) => {
    return (
      item?.metadata?.source === "upgrade-suggestions" ||
      normalize(item?.suggestion || "").includes("upgrade")
    );
  });

  return {
    status: "loaded",
    suggestions: upgrades,
    count: upgrades.length,
    timestamp: now(),
  };
}

export async function buildUpgradeSuggestionsContext(limit = 10) {
  const result = await getUpgradeSuggestions(limit);

  if (!result.suggestions.length) {
    return "Nu există upgrade suggestions salvate.";
  }

  return result.suggestions
    .slice(0, limit)
    .map((item: any, index: number) => {
      return [
        `${index + 1}. ${item.suggestion || "Upgrade"}`,
        `Reason: ${item.reason || ""}`,
        `Priority: ${item.priority || "unknown"}`,
        `Status: ${item.status || "unknown"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function runUpgradeSuggestions(description = "") {
  if (!description.trim()) {
    return getUpgradeSuggestions();
  }

  return createUpgradeSuggestion(description);
}

export async function getUpgradeSuggestionsState() {
  const suggestions = await getUpgradeSuggestions(100);

  const pending = suggestions.suggestions.filter((item: any) => {
    return item.status === "pending" || !item.status;
  });

  return {
    status: "loaded",
    total: suggestions.count,
    pending: pending.length,
    suggestions: suggestions.suggestions,
    truthPolicy: {
      suggestionsAreNotExecutedChanges: true,
      noFakeUpgradeDone: true,
      approvalRequiredForRiskyChanges: true,
    },
    timestamp: now(),
  };
}

export const suggestUpgrade = createUpgradeSuggestion;
export const saveUpgradeSuggestion = createUpgradeSuggestion;
export const analyzeUpgrade = analyzeUpgradeSuggestion;
export const getUpgradeState = getUpgradeSuggestionsState;
export const upgradeSuggestions = runUpgradeSuggestions;

export default runUpgradeSuggestions;