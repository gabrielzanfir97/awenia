import {
  createAutonomousReflection,
  createEvolutionSuggestion,
  createLearningTask,
} from "./memory-store";

import { validateSecurityAction } from "./security";

export type PlanningCategory =
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "awenia"
  | "business"
  | "family"
  | "fitness"
  | "legal"
  | "project"
  | "general";

export type PlanningRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type PlanningStatus =
  | "planned"
  | "needs_approval"
  | "blocked"
  | "saved"
  | "failed";

export type PlanningStep = {
  step: number;
  title: string;
  action: string;
  reason: string;
  risk: PlanningRisk;
  requiresApproval: boolean;
  status: "pending" | "ready" | "blocked";
};

export type AweniaPlan = {
  status: PlanningStatus;
  task: string;
  category: PlanningCategory;
  risk: PlanningRisk;
  priority: number;
  requiresApproval: boolean;
  blocked: boolean;
  steps: PlanningStep[];
  summary: string;
  nextAction: string;
  security: any;
  truthPolicy: {
    planIsNotExecution: boolean;
    noFakeCompletion: boolean;
    riskyActionsRequireGabiApproval: boolean;
    buildStatusMustBeVerifiedSeparately: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function clampPriority(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function detectCategory(task: string): PlanningCategory {
  const lower = normalize(task);

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes(".ts") ||
    lower.includes(".tsx") ||
    lower.includes("patch") ||
    lower.includes("file") ||
    lower.includes("fișier") ||
    lower.includes("fisier")
  ) {
    return "code";
  }

  if (
    lower.includes("eroare") ||
    lower.includes("error") ||
    lower.includes("debug") ||
    lower.includes("build")
  ) {
    return "debug";
  }

  if (
    lower.includes("memorie") ||
    lower.includes("memory") ||
    lower.includes("supabase")
  ) {
    return "memory";
  }

  if (
    lower.includes("internet") ||
    lower.includes("online") ||
    lower.includes("caută") ||
    lower.includes("cauta") ||
    lower.includes("search")
  ) {
    return "internet";
  }

  if (
    lower.includes("awenia") ||
    lower.includes("ai") ||
    lower.includes("asistent")
  ) {
    return "awenia";
  }

  if (
    lower.includes("business") ||
    lower.includes("fiverr") ||
    lower.includes("agenție") ||
    lower.includes("agentie") ||
    lower.includes("muncă") ||
    lower.includes("munca")
  ) {
    return "business";
  }

  if (
    lower.includes("copii") ||
    lower.includes("familie") ||
    lower.includes("andreea") ||
    lower.includes("adonis") ||
    lower.includes("bety")
  ) {
    return "family";
  }

  if (
    lower.includes("sală") ||
    lower.includes("sala") ||
    lower.includes("fitness") ||
    lower.includes("mușchi") ||
    lower.includes("muschi")
  ) {
    return "fitness";
  }

  if (
    lower.includes("legal") ||
    lower.includes("avocat") ||
    lower.includes("solicitor") ||
    lower.includes("proces")
  ) {
    return "legal";
  }

  if (
    lower.includes("proiect") ||
    lower.includes("audit") ||
    lower.includes("plan")
  ) {
    return "project";
  }

  return "general";
}

function detectRisk(task: string, category: PlanningCategory): PlanningRisk {
  const lower = normalize(task);

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
    lower.includes("app/api/awenia/route.ts") ||
    lower.includes("security.ts") ||
    lower.includes("protected-core.ts") ||
    lower.includes("supabase.ts") ||
    lower.includes("memory-store.ts")
  ) {
    return "high";
  }

  if (
    category === "code" ||
    category === "debug" ||
    category === "memory" ||
    category === "legal"
  ) {
    return "medium";
  }

  return "low";
}

function detectPriority(
  task: string,
  category: PlanningCategory,
  risk: PlanningRisk
) {
  const lower = normalize(task);

  let priority = 5;

  if (category === "awenia") priority += 2;
  if (category === "code") priority += 2;
  if (category === "debug") priority += 3;
  if (category === "memory") priority += 2;
  if (category === "legal") priority += 2;

  if (risk === "medium") priority += 1;
  if (risk === "high") priority += 2;
  if (risk === "critical") priority += 3;

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("important")) priority += 2;
  if (lower.includes("acum")) priority += 1;

  return clampPriority(priority);
}

function buildSteps(
  task: string,
  category: PlanningCategory,
  risk: PlanningRisk,
  blocked: boolean,
  requiresApproval: boolean
): PlanningStep[] {
  if (blocked) {
    return [
      {
        step: 1,
        title: "Oprire acțiune",
        action: "Nu executa nimic automat.",
        reason: "Planul conține risc critic sau acțiune blocată.",
        risk,
        requiresApproval: true,
        status: "blocked",
      },
      {
        step: 2,
        title: "Aprobarea lui Gabi",
        action: "Cere aprobare explicită înainte de orice modificare.",
        reason: "Gabi trebuie să controleze acțiunile riscante.",
        risk,
        requiresApproval: true,
        status: "blocked",
      },
    ];
  }

  const baseSteps: PlanningStep[] = [
    {
      step: 1,
      title: "Clarificare scop",
      action: `Înțelege exact cererea: ${task}`,
      reason: "Fără scop clar, planul poate merge greșit.",
      risk: "low",
      requiresApproval: false,
      status: "ready",
    },
    {
      step: 2,
      title: "Verificare reală",
      action: "Verifică informațiile reale înainte de execuție.",
      reason: "Awenia nu trebuie să presupună.",
      risk: "low",
      requiresApproval: false,
      status: "ready",
    },
  ];

  if (category === "code" || category === "debug") {
    baseSteps.push(
      {
        step: 3,
        title: "Citește fișierul",
        action: "Citește fișierul real afectat înainte de patch.",
        reason: "Nu modificăm cod fără conținut real.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      },
      {
        step: 4,
        title: "Pregătește modificarea",
        action: "Fă patch-ul doar pe baza codului real și a erorii reale.",
        reason: "Evităm modificările repetate și ghicite.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      }
    );
  } else if (category === "memory") {
    baseSteps.push(
      {
        step: 3,
        title: "Verifică memoria",
        action: "Separă memoria runtime de memoria Supabase.",
        reason: "Nu afirmăm salvare reală fără rezultat DB.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      },
      {
        step: 4,
        title: "Salvare controlată",
        action: "Salvează doar date utile și verificabile.",
        reason: "Memoria trebuie să rămână curată.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      }
    );
  } else if (category === "internet") {
    baseSteps.push(
      {
        step: 3,
        title: "Verifică internetul",
        action: "Rulează verificare fetch înainte de informații online.",
        reason: "Nu spunem că internetul merge fără verificare.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      },
      {
        step: 4,
        title: "Folosește surse",
        action: "Folosește doar rezultate verificate.",
        reason: "Evităm informații inventate.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      }
    );
  } else {
    baseSteps.push(
      {
        step: 3,
        title: "Plan simplu",
        action: "Împarte cererea în pași mici și clari.",
        reason: "Gabi preferă lucru pas cu pas.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      },
      {
        step: 4,
        title: "Execuție controlată",
        action: "Execută doar pasul următor, nu totul deodată.",
        reason: "Păstrăm controlul și evităm haosul.",
        risk,
        requiresApproval,
        status: requiresApproval ? "pending" : "ready",
      }
    );
  }

  baseSteps.push({
    step: baseSteps.length + 1,
    title: "Confirmare",
    action: "Confirmă rezultatul doar după verificare reală.",
    reason: "Nu declarăm nimic terminat fără dovadă.",
    risk: "low",
    requiresApproval: false,
    status: "ready",
  });

  return baseSteps;
}

function isCriticalRisk(risk: PlanningRisk): boolean {
  return risk === "critical";
}

function isMediumOrHighRisk(risk: PlanningRisk): boolean {
  return risk === "medium" || risk === "high";
}

function shouldRequireApproval(risk: PlanningRisk): boolean {
  return isMediumOrHighRisk(risk) || isCriticalRisk(risk);
}

function buildNextAction(
  category: PlanningCategory,
  risk: PlanningRisk,
  blocked: boolean
) {
  if (blocked) {
    return "Oprește execuția și cere aprobarea lui Gabi.";
  }

  if (category === "code" || category === "debug") {
    return "Citește fișierul real afectat înainte de modificare.";
  }

  if (category === "memory") {
    return "Verifică dacă memoria este runtime sau Supabase.";
  }

  if (category === "internet") {
    return "Verifică internetul cu fetch real.";
  }

  if (isMediumOrHighRisk(risk)) {
    return "Cere aprobarea lui Gabi înainte de execuție.";
  }

  return "Execută pasul 1 simplu și verificabil.";
}

export function createPlan(task = ""): AweniaPlan {
  const cleanTask = task.trim() || "Plan general Awenia";
  const category = detectCategory(cleanTask);
  const risk: PlanningRisk = detectRisk(cleanTask, category);
  const priority = detectPriority(cleanTask, category, risk);

  const security = validateSecurityAction({
    action: "planning",
    content: cleanTask,
    approvedByGabi: false,
    verified: true,
    reason: "Planning safety check",
  });

  const blocked = isCriticalRisk(risk) || security.blocked === true;

  const requiresApproval =
    blocked ||
    shouldRequireApproval(risk);

  const steps = buildSteps(
    cleanTask,
    category,
    risk,
    blocked,
    requiresApproval
  );

  return {
    status: blocked
      ? "blocked"
      : requiresApproval
        ? "needs_approval"
        : "planned",
    task: cleanTask,
    category,
    risk,
    priority,
    requiresApproval,
    blocked,
    steps,
    summary: `Plan pentru ${category}, risc ${risk}, prioritate ${priority}.`,
    nextAction: buildNextAction(category, risk, blocked),
    security,
    truthPolicy: {
      planIsNotExecution: true,
      noFakeCompletion: true,
      riskyActionsRequireGabiApproval: true,
      buildStatusMustBeVerifiedSeparately: true,
    },
    timestamp: now(),
  };
}

export async function savePlan(plan: AweniaPlan) {
  try {
    const reflection = await createAutonomousReflection(
      `Plan created: ${plan.category}`,
      plan.summary,
      plan.nextAction
    );

    let learningTask: any = null;
    let evolutionSuggestion: any = null;

    if (plan.category === "internet" || plan.category === "awenia") {
      learningTask = await createLearningTask({
        task: plan.task,
        priority: plan.priority,
        status: "pending",
        metadata: {
          category: plan.category,
          risk: plan.risk,
        },
      });
    }

    if (
      plan.category === "code" ||
      plan.category === "debug" ||
      plan.category === "memory" ||
      plan.category === "awenia"
    ) {
      evolutionSuggestion = await createEvolutionSuggestion({
        suggestion: `Plan improvement: ${plan.task}`,
        reason: plan.summary,
        priority: plan.priority,
        status: plan.requiresApproval ? "pending" : "suggested",
        metadata: {
          category: plan.category,
          risk: plan.risk,
          nextAction: plan.nextAction,
        },
      });
    }

    return {
      status: "saved" as PlanningStatus,
      plan,
      reflection,
      learningTask,
      evolutionSuggestion,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as PlanningStatus,
      plan,
      error: error?.message || "Failed to save plan",
      timestamp: now(),
    };
  }
}

export async function createAndSavePlan(task = "") {
  const plan = createPlan(task);
  const saved = await savePlan(plan);

  return {
    status: saved.status,
    plan,
    saved,
    timestamp: now(),
  };
}

export function buildPlanContext(task = "") {
  const plan = createPlan(task);

  return [
    "AWENIA PLAN",
    `Task: ${plan.task}`,
    `Category: ${plan.category}`,
    `Risk: ${plan.risk}`,
    `Priority: ${plan.priority}`,
    `Requires approval: ${plan.requiresApproval}`,
    `Blocked: ${plan.blocked}`,
    "",
    "Steps:",
    ...plan.steps.map(
      (step) =>
        `${step.step}. ${step.title} — ${step.action} [${step.status}]`
    ),
    "",
    `Next action: ${plan.nextAction}`,
  ].join("\n");
}

export async function runPlanning(task = "") {
  const plan = createPlan(task);

  return {
    status: plan.status,
    plan,
    context: buildPlanContext(task),
    timestamp: now(),
  };
}

export async function runSavedPlanning(task = "") {
  return createAndSavePlan(task);
}

export function analyzePlanning(task = "") {
  return createPlan(task);
}

export function createProjectPlan(task = "") {
  return createPlan(task);
}

export function buildActionPlan(task = "") {
  return createPlan(task);
}

export function planTask(task = "") {
  return createPlan(task);
}

export const createAweniaPlan = createPlan;
export const buildPlanningContext = buildPlanContext;
export const planningSystem = runPlanning;
export const runPlanningSystem = runPlanning;

export default createPlan;