import { analyzeIntentRouter } from "./intent-router";
import { validateSecurityAction } from "./security";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type TaskPlanStatus =
  | "planned"
  | "needs_approval"
  | "blocked"
  | "needs_clarification"
  | "failed";

export type TaskCategory =
  | "code"
  | "debug"
  | "memory"
  | "internet"
  | "goal"
  | "evolution"
  | "security"
  | "general";

export type TaskRisk = "low" | "medium" | "high" | "critical";

export type TaskStep = {
  step: number;
  title: string;
  action: string;
  reason: string;
  requiresApproval: boolean;
  risk: TaskRisk;
  status: "pending" | "ready" | "blocked";
};

export type TaskPlan = {
  status: TaskPlanStatus;
  task: string;
  category: TaskCategory;
  priority: number;
  risk: TaskRisk;
  requiresApproval: boolean;
  confidence: number;
  summary: string;
  steps: TaskStep[];
  intentAnalysis: any;
  security: any;
  recommendation: string;
  truthPolicy: {
    noFakeExecution: boolean;
    noClaimDoneBeforeExecution: boolean;
    verifyFilesBeforeChanging: boolean;
    approvalRequiredForRiskyActions: boolean;
  };
  timestamp: string;
  // Optional execution metadata about when planning started/completed
  execution?: {
    startedAt: string;
    completedAt: string;
  };
  // Optional error message when plan creation fails
  error?: string;
};

function now() {
  return new Date().toISOString();
}

function normalize(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function includesAny(text: string, words: string[]) {
  const lower = normalize(text);
  return words.some((word) => lower.includes(word));
}

function detectTaskCategory(task: string): TaskCategory {
  if (
    includesAny(task, [
      "cod",
      "code",
      "fișier",
      "fisier",
      "typescript",
      "tsx",
      "route.ts",
      "patch",
      "write_file",
      "read_file",
    ])
  ) {
    return "code";
  }

  if (
    includesAny(task, [
      "eroare",
      "error",
      "bug",
      "nu merge",
      "build",
      "debug",
      "failed",
    ])
  ) {
    return "debug";
  }

  if (
    includesAny(task, [
      "memorie",
      "memory",
      "amintește",
      "aminteste",
      "salvează",
      "salveaza",
    ])
  ) {
    return "memory";
  }

  if (
    includesAny(task, [
      "internet",
      "online",
      "wikipedia",
      "caută",
      "cauta",
      "learn from internet",
    ])
  ) {
    return "internet";
  }

  if (
    includesAny(task, [
      "obiectiv",
      "goal",
      "scop",
      "misiune",
    ])
  ) {
    return "goal";
  }

  if (
    includesAny(task, [
      "evoluție",
      "evolutie",
      "upgrade",
      "îmbunătățește",
      "imbunatateste",
      "optimizează",
      "optimizeaza",
    ])
  ) {
    return "evolution";
  }

  if (
    includesAny(task, [
      "security",
      "siguranță",
      "siguranta",
      "protecție",
      "protectie",
      "aprobare",
      "approval",
    ])
  ) {
    return "security";
  }

  return "general";
}

function detectTaskRisk(task: string, category: TaskCategory): TaskRisk {
  const lower = normalize(task);

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("delete") ||
    lower.includes("șterge") ||
    lower.includes("sterge") ||
    lower.includes("node_modules") ||
    lower.includes(".git")
  ) {
    return "critical";
  }

  if (
    lower.includes("app/api/awenia/route.ts") ||
    lower.includes("memory-store.ts") ||
    lower.includes("supabase.ts") ||
    lower.includes("protected-core.ts") ||
    lower.includes("security.ts")
  ) {
    return "high";
  }

  if (
    category === "code" ||
    category === "debug" ||
    category === "evolution" ||
    category === "security"
  ) {
    return "medium";
  }

  return "low";
}

function detectPriority(task: string, category: TaskCategory) {
  const lower = normalize(task);

  let priority = 5;

  if (category === "debug") priority += 2;
  if (category === "code") priority += 2;
  if (category === "evolution") priority += 2;
  if (category === "security") priority += 2;

  if (lower.includes("urgent")) priority += 2;
  if (lower.includes("awenia")) priority += 2;
  if (lower.includes("build")) priority += 2;
  if (lower.includes("eroare") || lower.includes("error")) priority += 2;

  return Math.max(1, Math.min(10, priority));
}

function requiresApproval(risk: TaskRisk, category: TaskCategory) {
  if (risk === "critical") return true;
  if (risk === "high") return true;
  if (risk === "medium") return true;
  if (category === "code") return true;
  if (category === "evolution") return true;
  if (category === "security") return true;

  return false;
}

function buildSteps(
  task: string,
  category: TaskCategory,
  risk: TaskRisk
): TaskStep[] {
  if (risk === "critical") {
    return [
      {
        step: 1,
        title: "Blocare siguranță",
        action: "Nu executa acțiunea.",
        reason: "Task-ul atinge zone critice sau protejate.",
        requiresApproval: true,
        risk: "critical",
        status: "blocked",
      },
      {
        step: 2,
        title: "Cere confirmare",
        action: "Așteaptă decizia lui Gabi.",
        reason: "Awenia nu are voie să execute singură acțiuni critice.",
        requiresApproval: true,
        risk: "critical",
        status: "blocked",
      },
    ];
  }

  if (category === "code") {
    return [
      {
        step: 1,
        title: "Citește fișierul real",
        action: "Verifică fișierul înainte de orice modificare.",
        reason: "Nu modificăm cod pe presupuneri.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
      {
        step: 2,
        title: "Analizează siguranța",
        action: "Verifică dacă fișierul este protejat sau high-risk.",
        reason: "Awenia trebuie să respecte aprobarea lui Gabi.",
        requiresApproval: false,
        risk,
        status: "ready",
      },
      {
        step: 3,
        title: "Generează patch sau replacement",
        action: "Pregătește schimbarea fără execuție directă.",
        reason: "Modificările de cod trebuie controlate.",
        requiresApproval: true,
        risk,
        status: "pending",
      },
      {
        step: 4,
        title: "Execută doar după aprobare",
        action: "Aplică modificarea doar când Gabi confirmă.",
        reason: "Codul Aweniei rămâne sub controlul lui Gabi.",
        requiresApproval: true,
        risk,
        status: "pending",
      },
    ];
  }

  if (category === "debug") {
    return [
      {
        step: 1,
        title: "Citește eroarea exactă",
        action: "Nu ghici cauza.",
        reason: "Debugging-ul trebuie făcut din eroarea reală.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
      {
        step: 2,
        title: "Găsește fișierul afectat",
        action: "Leagă eroarea de importuri, funcții sau tipuri.",
        reason: "Reparăm cauza, nu simptomele.",
        requiresApproval: false,
        risk: "medium",
        status: "ready",
      },
      {
        step: 3,
        title: "Pregătește fix-ul",
        action: "Creează patch verificabil.",
        reason: "Fix-ul trebuie să fie controlat.",
        requiresApproval: true,
        risk,
        status: "pending",
      },
    ];
  }

  if (category === "memory") {
    return [
      {
        step: 1,
        title: "Citește memoria",
        action: "Verifică memoria reală înainte de răspuns.",
        reason: "Awenia nu trebuie să inventeze amintiri.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
      {
        step: 2,
        title: "Salvează sau rezumă",
        action: "Execută doar dacă intentul cere clar asta.",
        reason: "Memoria trebuie să fie utilă și fără duplicate.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
    ];
  }

  if (category === "internet") {
    return [
      {
        step: 1,
        title: "Verifică internetul",
        action: "Fă fetch real înainte să afirmi conexiunea.",
        reason: "Awenia nu trebuie să pretindă acces online.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
      {
        step: 2,
        title: "Caută surse",
        action: "Folosește doar informații recuperate real.",
        reason: "Învățarea online trebuie verificată.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
      {
        step: 3,
        title: "Salvează ce a învățat",
        action: "Salvează doar sumar verificat.",
        reason: "Învățarea trebuie să rămână în memorie.",
        requiresApproval: false,
        risk: "low",
        status: "ready",
      },
    ];
  }

  return [
    {
      step: 1,
      title: "Înțelege task-ul",
      action: "Clarifică ce trebuie făcut.",
      reason: "Planul trebuie să fie simplu și verificabil.",
      requiresApproval: false,
      risk: "low",
      status: "ready",
    },
    {
      step: 2,
      title: "Alege acțiunea sigură",
      action: "Execută doar pașii low-risk.",
      reason: "Awenia nu trebuie să sară direct la acțiuni riscante.",
      requiresApproval: false,
      risk: "low",
      status: "ready",
    },
    {
      step: 3,
      title: "Raportează rezultatul",
      action: "Spune clar ce s-a făcut și ce nu.",
      reason: "Fără afirmații false.",
      requiresApproval: false,
      risk: "low",
      status: "ready",
    },
  ];
}

function calculateConfidence(task: string, category: TaskCategory) {
  let confidence = 55;

  if (task.length > 10) confidence += 15;
  if (task.length > 40) confidence += 10;
  if (category !== "general") confidence += 10;

  return Math.max(0, Math.min(100, confidence));
}

function buildSummary(
  category: TaskCategory,
  risk: TaskRisk,
  requiresApprovalValue: boolean
) {
  if (risk === "critical") {
    return "Task blocat. Necesită verificare și aprobare de la Gabi.";
  }

  if (requiresApprovalValue) {
    return "Task planificat, dar execuția necesită aprobarea lui Gabi.";
  }

  return `Task planificat pentru categoria ${category}.`;
}

function buildRecommendation(status: TaskPlanStatus) {
  if (status === "blocked") {
    return "Nu executa. Cere confirmare de la Gabi.";
  }

  if (status === "needs_approval") {
    return "Pregătește acțiunea, dar nu executa fără aprobarea lui Gabi.";
  }

  if (status === "needs_clarification") {
    return "Cere detalii înainte să continui.";
  }

  if (status === "failed") {
    return "Repară task-planner.ts sau sistemele conectate.";
  }

  return "Poți continua cu pașii siguri ai planului.";
}

export async function createTaskPlan(task: string): Promise<TaskPlan> {
  const startedAt = now();

  try {
    const cleanTask = task.trim();

    if (!cleanTask) {
      return {
        status: "needs_clarification",
        task,
        category: "general",
        priority: 1,
        risk: "low",
        requiresApproval: false,
        confidence: 0,
        summary: "Task lipsă.",
        steps: [],
        intentAnalysis: null,
        security: null,
        recommendation: "Spune ce task vrei să planifice Awenia.",
        truthPolicy: {
          noFakeExecution: true,
          noClaimDoneBeforeExecution: true,
          verifyFilesBeforeChanging: true,
          approvalRequiredForRiskyActions: true,
        },
        timestamp: now(),
      };
    }

    const category = detectTaskCategory(cleanTask);
    const risk = detectTaskRisk(cleanTask, category);
    const priority = detectPriority(cleanTask, category);
    const approval = requiresApproval(risk, category);
    const intentAnalysis = analyzeIntentRouter(cleanTask, "user");

    const security = validateSecurityAction({
      action:
        category === "code"
          ? "patch"
          : category === "security"
            ? "system_change"
            : category === "evolution"
              ? "evolution"
              : "read",
      content: cleanTask,
      approvedByGabi: false,
      verified: true,
      reason: "Task planner safety check",
    });

    const blocked = risk === "critical" || security.blocked;

    const status: TaskPlanStatus = blocked
      ? "blocked"
      : approval
        ? "needs_approval"
        : "planned";

    const steps = buildSteps(cleanTask, category, risk);

    const plan: TaskPlan = {
      status,
      task: cleanTask,
      category,
      priority,
      risk,
      requiresApproval: approval,
      confidence: calculateConfidence(cleanTask, category),
      summary: buildSummary(category, risk, approval),
      steps,
      intentAnalysis,
      security,
      recommendation: buildRecommendation(status),
      truthPolicy: {
        noFakeExecution: true,
        noClaimDoneBeforeExecution: true,
        verifyFilesBeforeChanging: true,
        approvalRequiredForRiskyActions: true,
      },
      timestamp: now(),
    };

    if (priority >= 8 && !blocked) {
      try {
        await createAutonomousReflection(
          `Task plan created: ${category}`,
          cleanTask,
          approval
            ? "Wait for Gabi approval before execution"
            : "Execute only verified safe steps"
        );

        await createEvolutionSuggestion(
          `Task planning improvement: ${category}`,
          `High priority task was planned. Risk: ${risk}. Approval: ${approval}.`,
          priority
        );
      } catch {
        // Nu blocăm planul dacă memoria nu poate salva reflection/suggestion.
      }
    }

    return {
      ...plan,
      execution: {
        startedAt,
        completedAt: now(),
      } as any,
    };
  } catch (error: any) {
    return {
      status: "failed",
      task,
      category: "general",
      priority: 1,
      risk: "medium",
      requiresApproval: true,
      confidence: 0,
      summary: "Task planner failed.",
      steps: [],
      intentAnalysis: null,
      security: null,
      recommendation: "Verifică eroarea din task-planner.ts.",
      truthPolicy: {
        noFakeExecution: true,
        noClaimDoneBeforeExecution: true,
        verifyFilesBeforeChanging: true,
        approvalRequiredForRiskyActions: true,
      },
      error: error?.message || "Unknown task planner error",
      timestamp: now(),
    } as any;
  }
}

export function buildTaskPlanPreview(task: string) {
  const category = detectTaskCategory(task);
  const risk = detectTaskRisk(task, category);
  const priority = detectPriority(task, category);
  const approval = requiresApproval(risk, category);

  return {
    task,
    category,
    risk,
    priority,
    requiresApproval: approval,
    confidence: calculateConfidence(task, category),
    steps: buildSteps(task, category, risk),
    timestamp: now(),
  };
}

export async function planTask(task: string) {
  return createTaskPlan(task);
}

export async function buildTaskPlan(task: string) {
  return createTaskPlan(task);
}

export async function createPlan(task: string) {
  return createTaskPlan(task);
}

export function detectTaskPlanCategory(task: string) {
  return detectTaskCategory(task);
}

export function detectTaskPlanRisk(task: string) {
  return detectTaskRisk(task, detectTaskCategory(task));
}

export function getTaskPlanPriority(task: string) {
  return detectPriority(task, detectTaskCategory(task));
}