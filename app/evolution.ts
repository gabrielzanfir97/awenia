import {
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  createAutonomousReflection,
  createEvolutionReport as saveEvolutionReport,
} from "./memory-store";

import { validateSecurityAction } from "./security";

export type EvolutionArea =
  | "core"
  | "memory"
  | "code"
  | "internet"
  | "autonomy"
  | "security"
  | "personality"
  | "performance"
  | "tools"
  | "ui"
  | "unknown";

export type EvolutionRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EvolutionStatus =
  | "analyzed"
  | "suggested"
  | "planned"
  | "needs_approval"
  | "blocked"
  | "completed"
  | "duplicate"
  | "failed";

export type EvolutionPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type EvolutionAnalysis = {
  status: EvolutionStatus;
  request: string;
  area: EvolutionArea;
  risk: EvolutionRisk;
  priority: EvolutionPriority;
  requiresApproval: boolean;
  blocked: boolean;
  confidence: number;
  suggestion: string;
  reason: string;
  expectedBenefit: string;
  safeNextStep: string;
  security: any;
  truthPolicy: {
    noFakeEvolution: boolean;
    noExecutionWithoutApproval: boolean;
    noClaimUpgradeDoneWithoutCodeChange: boolean;
    criticalEvolutionBlocked: boolean;
  };
  timestamp: string;
};

export type EvolutionPlanStep = {
  step: number;
  title: string;
  action: string;
  risk: EvolutionRisk;
  requiresApproval: boolean;
  status: "ready" | "pending_approval" | "blocked";
};

export type EvolutionPlan = {
  status: EvolutionStatus;
  analysis: EvolutionAnalysis;
  steps: EvolutionPlanStep[];
  canExecuteAutomatically: boolean;
  recommendation: string;
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function clampPriority(value: number): EvolutionPriority {
  return Math.max(1, Math.min(10, Math.round(value))) as EvolutionPriority;
}

function detectEvolutionArea(request: string): EvolutionArea {
  const lower = normalize(request);

  if (
    lower.includes("memory") ||
    lower.includes("memorie") ||
    lower.includes("supabase")
  ) {
    return "memory";
  }

  if (
    lower.includes("code") ||
    lower.includes("cod") ||
    lower.includes(".ts") ||
    lower.includes(".tsx") ||
    lower.includes("build") ||
    lower.includes("patch")
  ) {
    return "code";
  }

  if (
    lower.includes("internet") ||
    lower.includes("online") ||
    lower.includes("wikipedia") ||
    lower.includes("fetch")
  ) {
    return "internet";
  }

  if (
    lower.includes("autonom") ||
    lower.includes("runtime") ||
    lower.includes("loop") ||
    lower.includes("worker")
  ) {
    return "autonomy";
  }

  if (
    lower.includes("security") ||
    lower.includes("siguran") ||
    lower.includes("approval") ||
    lower.includes("aprobare") ||
    lower.includes(".env")
  ) {
    return "security";
  }

  if (
    lower.includes("personalitate") ||
    lower.includes("personality") ||
    lower.includes("voce") ||
    lower.includes("tone")
  ) {
    return "personality";
  }

  if (
    lower.includes("rapid") ||
    lower.includes("repede") ||
    lower.includes("performance") ||
    lower.includes("întârzie") ||
    lower.includes("intarzie") ||
    lower.includes("slow")
  ) {
    return "performance";
  }

  if (
    lower.includes("tool") ||
    lower.includes("handler") ||
    lower.includes("read_file") ||
    lower.includes("write_file") ||
    lower.includes("patch_file")
  ) {
    return "tools";
  }

  if (
    lower.includes("ui") ||
    lower.includes("page.tsx") ||
    lower.includes("interfață") ||
    lower.includes("interfata")
  ) {
    return "ui";
  }

  if (
    lower.includes("awenia") ||
    lower.includes("core") ||
    lower.includes("identity") ||
    lower.includes("identitate")
  ) {
    return "core";
  }

  return "unknown";
}

function detectEvolutionRisk(request: string, area: EvolutionArea): EvolutionRisk {
  const lower = normalize(request);

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

  if (
    area === "security" ||
    area === "core" ||
    lower.includes("protected-core") ||
    lower.includes("security.ts") ||
    lower.includes("memory-store.ts") ||
    lower.includes("supabase.ts") ||
    lower.includes("app/api/awenia/route.ts")
  ) {
    return "high";
  }

  if (
    area === "code" ||
    area === "autonomy" ||
    area === "tools" ||
    area === "performance"
  ) {
    return "medium";
  }

  return "low";
}

function detectEvolutionPriority(request: string, area: EvolutionArea, risk: EvolutionRisk) {
  const lower = normalize(request);

  let priority = 5;

  if (area === "security") priority += 3;
  if (area === "core") priority += 2;
  if (area === "memory") priority += 2;
  if (area === "code") priority += 2;
  if (area === "performance") priority += 2;
  if (area === "autonomy") priority += 2;

  if (risk === "high") priority += 1;
  if (risk === "critical") priority += 2;

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("important")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("build")) priority += 1;
  if (lower.includes("eroare") || lower.includes("error")) priority += 2;

  return clampPriority(priority);
}

function buildSuggestion(request: string, area: EvolutionArea) {
  if (area === "memory") {
    return `Îmbunătățește memoria Aweniei pentru: ${request}`;
  }

  if (area === "code") {
    return `Îmbunătățește sistemul de cod/verificare pentru: ${request}`;
  }

  if (area === "internet") {
    return `Îmbunătățește învățarea online verificată pentru: ${request}`;
  }

  if (area === "autonomy") {
    return `Îmbunătățește autonomia controlată pentru: ${request}`;
  }

  if (area === "security") {
    return `Întărește protecția și aprobarea Gabi pentru: ${request}`;
  }

  if (area === "performance") {
    return `Optimizează viteza Aweniei pentru: ${request}`;
  }

  if (area === "personality") {
    return `Rafinează personalitatea Aweniei pentru: ${request}`;
  }

  if (area === "tools") {
    return `Îmbunătățește tool-urile Aweniei pentru: ${request}`;
  }

  if (area === "ui") {
    return `Îmbunătățește interfața Aweniei pentru: ${request}`;
  }

  if (area === "core") {
    return `Îmbunătățește Awenia Core pentru: ${request}`;
  }

  return `Propunere de evoluție pentru: ${request}`;
}

function buildExpectedBenefit(area: EvolutionArea) {
  if (area === "memory") return "Awenia își amintește mai corect și folosește context real.";
  if (area === "code") return "Awenia înțelege mai bine codul și reduce erorile.";
  if (area === "internet") return "Awenia învață online doar cu informații verificate.";
  if (area === "autonomy") return "Awenia poate decide mai bine fără să piardă controlul lui Gabi.";
  if (area === "security") return "Awenia devine mai sigură și nu execută acțiuni riscante.";
  if (area === "performance") return "Awenia răspunde mai rapid și rulează mai puține procese grele.";
  if (area === "personality") return "Awenia răspunde mai potrivit pentru Gabi.";
  if (area === "tools") return "Awenia folosește tool-urile mai corect și verificabil.";
  if (area === "ui") return "Gabi poate lucra mai ușor cu interfața.";
  if (area === "core") return "Identitatea, adevărul și controlul Aweniei devin mai stabile.";

  return "Awenia poate deveni mai utilă dacă propunerea este verificată.";
}

function buildSafeNextStep(area: EvolutionArea, risk: EvolutionRisk) {
  if (risk === "critical") {
    return "Nu executa. Cere aprobare explicită de la Gabi și verifică riscul.";
  }

  if (risk === "high") {
    return "Pregătește planul, dar nu modifica nimic fără aprobarea lui Gabi.";
  }

  if (area === "code" || area === "tools") {
    return "Citește fișierul real, apoi pregătește patch verificabil.";
  }

  if (area === "performance") {
    return "Măsoară întâi ce întârzie, apoi optimizează.";
  }

  if (area === "internet") {
    return "Verifică internetul cu fetch real înainte de învățare.";
  }

  return "Salvează propunerea și aplică doar pașii low-risk.";
}

function calculateConfidence(request: string, area: EvolutionArea) {
  let confidence = 50;

  if (request.length > 10) confidence += 15;
  if (request.length > 40) confidence += 10;
  if (area !== "unknown") confidence += 15;

  return Math.max(0, Math.min(100, confidence));
}

function buildPlanSteps(analysis: EvolutionAnalysis): EvolutionPlanStep[] {
  if (analysis.blocked) {
    return [
      {
        step: 1,
        title: "Blocare evoluție critică",
        action: "Nu executa modificarea.",
        risk: analysis.risk,
        requiresApproval: true,
        status: "blocked",
      },
      {
        step: 2,
        title: "Aprobarea lui Gabi",
        action: "Cere confirmare explicită înainte de orice pas.",
        risk: analysis.risk,
        requiresApproval: true,
        status: "blocked",
      },
    ];
  }

  return [
    {
      step: 1,
      title: "Analiză reală",
      action: "Verifică datele reale înainte de schimbare.",
      risk: "low",
      requiresApproval: false,
      status: "ready",
    },
    {
      step: 2,
      title: "Plan sigur",
      action: "Separă ce poate fi făcut low-risk de ce cere aprobare.",
      risk: analysis.risk,
      requiresApproval: analysis.requiresApproval,
      status: analysis.requiresApproval ? "pending_approval" : "ready",
    },
    {
      step: 3,
      title: "Propunere salvată",
      action: "Salvează propunerea în evolution suggestions.",
      risk: "low",
      requiresApproval: false,
      status: "ready",
    },
    {
      step: 4,
      title: "Execuție controlată",
      action: "Aplică modificarea doar după citire/verificare și aprobare unde e cazul.",
      risk: analysis.risk,
      requiresApproval: analysis.requiresApproval,
      status: analysis.requiresApproval ? "pending_approval" : "ready",
    },
  ];
}

async function isDuplicateSuggestion(suggestion: string, reason: string) {
  const recent = await getEvolutionSuggestions(50);
  const signature = normalize(`${suggestion} ${reason}`).slice(0, 120);

  return recent.some((item: any) =>
    normalize(`${item.suggestion || ""} ${item.reason || ""}`).includes(
      signature
    )
  );
}

export function analyzeEvolutionRequest(request = ""): EvolutionAnalysis {
  const cleanRequest = request.trim();

  const area = detectEvolutionArea(cleanRequest);
  const risk = detectEvolutionRisk(cleanRequest, area);
  const priority = detectEvolutionPriority(cleanRequest, area, risk);

  const security = validateSecurityAction({
    action: "evolution",
    content: cleanRequest,
    approvedByGabi: false,
    verified: true,
    reason: "Evolution analysis safety check",
  });

  const blocked = risk === "critical" || security.blocked;

  const requiresApproval = blocked || risk !== "low";

  const suggestion = buildSuggestion(cleanRequest || "Awenia evolution", area);

  return {
    status: blocked
      ? "blocked"
      : requiresApproval
        ? "needs_approval"
        : "analyzed",
    request: cleanRequest,
    area,
    risk,
    priority,
    requiresApproval,
    blocked,
    confidence: calculateConfidence(cleanRequest, area),
    suggestion,
    reason: `Evolution area detected: ${area}. Risk: ${risk}.`,
    expectedBenefit: buildExpectedBenefit(area),
    safeNextStep: buildSafeNextStep(area, risk),
    security,
    truthPolicy: {
      noFakeEvolution: true,
      noExecutionWithoutApproval: true,
      noClaimUpgradeDoneWithoutCodeChange: true,
      criticalEvolutionBlocked: true,
    },
    timestamp: now(),
  };
}

export function createEvolutionPlan(request = ""): EvolutionPlan {
  const analysis = analyzeEvolutionRequest(request);
  const steps = buildPlanSteps(analysis);

  return {
    status: analysis.blocked
      ? "blocked"
      : analysis.requiresApproval
        ? "needs_approval"
        : "planned",
    analysis,
    steps,
    canExecuteAutomatically:
      !analysis.blocked &&
      !analysis.requiresApproval &&
      analysis.risk === "low",
    recommendation: analysis.safeNextStep,
    timestamp: now(),
  };
}

export async function suggestEvolution(request = "") {
  const analysis = analyzeEvolutionRequest(request || "Improve Awenia safely");

  if (analysis.blocked) {
    await createAutonomousReflection(
      "Evolution blocked",
      analysis.suggestion,
      "Critical evolution was blocked and must not execute automatically"
    );

    return {
      status: "blocked" as EvolutionStatus,
      analysis,
      saved: false,
      reason: "Critical evolution request blocked",
      timestamp: now(),
    };
  }

  const duplicate = await isDuplicateSuggestion(
    analysis.suggestion,
    analysis.reason
  );

  if (duplicate) {
    return {
      status: "duplicate" as EvolutionStatus,
      analysis,
      saved: false,
      duplicate: true,
      timestamp: now(),
    };
  }

  const saved = await createEvolutionSuggestion(
    analysis.suggestion,
    `${analysis.reason} Benefit: ${analysis.expectedBenefit}`,
    analysis.priority
  );

  await createAutonomousReflection(
    `Evolution suggested: ${analysis.area}`,
    analysis.suggestion,
    analysis.requiresApproval
      ? "Wait for Gabi approval before execution"
      : "Low-risk suggestion can be considered by runtime"
  );

  return {
    status: analysis.requiresApproval
      ? ("needs_approval" as EvolutionStatus)
      : ("suggested" as EvolutionStatus),
    analysis,
    saved,
    savedSuggestion: true,
    approvalRequired: analysis.requiresApproval,
    timestamp: now(),
  };
}

export async function runEvolutionSystem(request = "Improve Awenia safely") {
  const startedAt = now();

  try {
    const plan = createEvolutionPlan(request);
    const suggestion = await suggestEvolution(request);

    const report = {
      request,
      plan,
      suggestion,
      status: suggestion.status,
      timestamp: now(),
    };

    let savedReport: any = null;

    try {
      savedReport = await saveEvolutionReport(
        `Evolution run: ${plan.analysis.area}`,
        report,
        {
          risk: plan.analysis.risk,
          priority: plan.analysis.priority,
          requiresApproval: plan.analysis.requiresApproval,
        },
        0
      );
    } catch (error: any) {
      savedReport = {
        status: "failed",
        error: error?.message || "Failed to save evolution report",
      };
    }

    return {
      status: suggestion.status,
      request,
      plan,
      suggestion,
      report,
      savedReport,
      execution: {
        startedAt,
        completedAt: now(),
      },
      truthPolicy: {
        noFakeEvolution: true,
        suggestionIsNotExecution: true,
        noCodeChangedByThisFunction: true,
        approvalRequiredForRiskyChanges: true,
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as EvolutionStatus,
      request,
      error: error?.message || "Unknown evolution system error",
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }
}

export async function getEvolutionState(limit = 30) {
  const suggestions = await getEvolutionSuggestions(limit);

  const pending = suggestions.filter(
    (item: any) => item.status === "pending" || !item.status
  );

  const highPriority = suggestions.filter(
    (item: any) => Number(item.priority || 0) >= 8
  );

  return {
    status: "loaded",
    suggestions,
    pending,
    highPriority,
    counts: {
      total: suggestions.length,
      pending: pending.length,
      highPriority: highPriority.length,
    },
    recommendation:
      highPriority.length > 0
        ? "Verifică propunerile high-priority înainte de modificări noi."
        : "Continuă evoluția controlată, fără execuție riscantă automată.",
    truthPolicy: {
      suggestionsAreNotExecutedChanges: true,
      noFakeUpgradeStatus: true,
      approvalRequiredForRiskyChanges: true,
    },
    timestamp: now(),
  };
}

export function buildEvolutionContext(request = "") {
  const plan = createEvolutionPlan(request);

  return [
    "EVOLUTION CONTEXT",
    `Area: ${plan.analysis.area}`,
    `Risk: ${plan.analysis.risk}`,
    `Priority: ${plan.analysis.priority}`,
    `Requires approval: ${plan.analysis.requiresApproval}`,
    `Suggestion: ${plan.analysis.suggestion}`,
    `Benefit: ${plan.analysis.expectedBenefit}`,
    `Safe next step: ${plan.analysis.safeNextStep}`,
  ].join("\n");
}

export async function runEvolution(request = "Improve Awenia safely") {
  return runEvolutionSystem(request);
}

export async function runEvolutionCycle(request = "Improve Awenia safely") {
  return runEvolutionSystem(request);
}

export async function evolveAwenia(request = "Improve Awenia safely") {
  return runEvolutionSystem(request);
}

export async function improveAwenia(request = "Improve Awenia safely") {
  return runEvolutionSystem(request);
}

export async function proposeEvolution(request = "Improve Awenia safely") {
  return suggestEvolution(request);
}

export async function generateEvolutionSuggestion(
  request = "Improve Awenia safely"
) {
  return suggestEvolution(request);
}

export function analyzeEvolution(request = "") {
  return analyzeEvolutionRequest(request);
}

export function planEvolution(request = "") {
  return createEvolutionPlan(request);
}

export const localEvolution = runEvolutionSystem;
export const evolutionSystem = runEvolutionSystem;
export const buildEvolutionPlan = createEvolutionPlan;
export const getEvolutionContext = buildEvolutionContext;

export default runEvolutionSystem;