import {
  createAutonomousReflection,
  getAutonomousReflections,
  createEvolutionSuggestion,
  saveMemorySummary,
} from "./memory-store";

import { validateSecurityAction } from "./security";

export type ReflectionCategory =
  | "conversation"
  | "memory"
  | "code"
  | "debug"
  | "emotion"
  | "goal"
  | "evolution"
  | "security"
  | "project"
  | "general";

export type ReflectionMood =
  | "calm"
  | "focused"
  | "concerned"
  | "warm"
  | "uncertain"
  | "determined";

export type ReflectionRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ReflectionStatus =
  | "created"
  | "saved"
  | "loaded"
  | "searched"
  | "blocked"
  | "failed";

export type AweniaReflection = {
  id: string;
  title: string;
  content: string;
  recommendation: string;
  category: ReflectionCategory;
  mood: ReflectionMood;
  risk: ReflectionRisk;
  importance: number;
  requiresApproval: boolean;
  blocked: boolean;
  source?: string;
  metadata?: any;
  createdAt: string;
};

function now() {
  return new Date().toISOString();
}

function createId(prefix = "reflection") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function clampImportance(value: number) {
  return Math.max(1, Math.min(10, Math.round(value)));
}

function detectCategory(text: string): ReflectionCategory {
  const lower = normalize(text);

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes(".ts") ||
    lower.includes(".tsx") ||
    lower.includes("patch")
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
    lower.includes("simt") ||
    lower.includes("emoție") ||
    lower.includes("emotie") ||
    lower.includes("iubire") ||
    lower.includes("frică") ||
    lower.includes("frica")
  ) {
    return "emotion";
  }

  if (
    lower.includes("goal") ||
    lower.includes("obiectiv") ||
    lower.includes("misiune")
  ) {
    return "goal";
  }

  if (
    lower.includes("evolu") ||
    lower.includes("upgrade") ||
    lower.includes("îmbunătăț") ||
    lower.includes("imbunatat")
  ) {
    return "evolution";
  }

  if (
    lower.includes("security") ||
    lower.includes("siguran") ||
    lower.includes("aprobare") ||
    lower.includes("approval")
  ) {
    return "security";
  }

  if (
    lower.includes("proiect") ||
    lower.includes("awenia") ||
    lower.includes("audit")
  ) {
    return "project";
  }

  if (lower.length > 0) return "conversation";

  return "general";
}

function detectMood(text: string): ReflectionMood {
  const lower = normalize(text);

  if (
    lower.includes("nu merge") ||
    lower.includes("eroare") ||
    lower.includes("problem") ||
    lower.includes("greșit") ||
    lower.includes("gresit")
  ) {
    return "concerned";
  }

  if (
    lower.includes("iubire") ||
    lower.includes("frumos") ||
    lower.includes("bine") ||
    lower.includes("mulțumesc") ||
    lower.includes("multumesc")
  ) {
    return "warm";
  }

  if (
    lower.includes("nu știu") ||
    lower.includes("nu stiu") ||
    lower.includes("poate")
  ) {
    return "uncertain";
  }

  if (
    lower.includes("continu") ||
    lower.includes("facem") ||
    lower.includes("hai") ||
    lower.includes("trebuie")
  ) {
    return "determined";
  }

  if (
    lower.includes("cod") ||
    lower.includes("audit") ||
    lower.includes("build")
  ) {
    return "focused";
  }

  return "calm";
}

function detectRisk(text: string, category: ReflectionCategory): ReflectionRisk {
  const lower = normalize(text);

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
    category === "security" ||
    category === "evolution"
  ) {
    return "medium";
  }

  return "low";
}

function detectImportance(
  text: string,
  category: ReflectionCategory,
  risk: ReflectionRisk
) {
  const lower = normalize(text);
  let importance = 5;

  if (category === "project") importance += 2;
  if (category === "code") importance += 2;
  if (category === "debug") importance += 3;
  if (category === "memory") importance += 2;
  if (category === "evolution") importance += 2;
  if (category === "security") importance += 3;

  if (risk === "medium") importance += 1;
  if (risk === "high") importance += 2;
  if (risk === "critical") importance += 3;

  if (lower.includes("important")) importance += 2;
  if (lower.includes("salvează") || lower.includes("salveaza")) importance += 2;
  if (lower.includes("awenia")) importance += 2;

  return clampImportance(importance);
}

function buildRecommendation(
  category: ReflectionCategory,
  _risk: ReflectionRisk,
  blocked: boolean
) {
  if (blocked) {
    return "Nu executa automat. Cere aprobarea lui Gabi.";
  }

  if (category === "code" || category === "debug") {
    return "Citește fișierul real și repară doar pe baza datelor reale.";
  }

  if (category === "memory") {
    return "Separă memoria runtime de memoria Supabase și nu afirma salvare fără verificare.";
  }

  if (category === "evolution") {
    return "Salvează ca propunere, nu ca modificare executată.";
  }

  if (category === "security") {
    return "Păstrează controlul lui Gabi pentru acțiunile riscante.";
  }

  if (category === "emotion") {
    return "Răspunde cald, dar sincer și clar.";
  }

  return "Continuă pas cu pas, fără presupuneri.";
}

export function analyzeReflectionInput(
  content = "",
  options?: {
    title?: string;
    source?: string;
    metadata?: any;
  }
) {
  const clean = content.trim();
  const category = detectCategory(clean);
  const mood = detectMood(clean);
  const risk: ReflectionRisk = detectRisk(clean, category);
  const importance = detectImportance(clean, category, risk);

  const security = validateSecurityAction({
    action: "reflection",
    content: clean,
    approvedByGabi: false,
    verified: true,
    reason: "Reflection safety check",
  });

  const blocked = ["critical"].includes(risk) || security.blocked === true;
  const requiresApproval =
    blocked ||
    risk === "medium" ||
    risk === "high" ||
    risk === "critical";

  const reflection: AweniaReflection = {
    id: createId(),
    title:
      options?.title ||
      `Reflection: ${category}`,
    content: clean,
    recommendation: buildRecommendation(category, risk, blocked),
    category,
    mood,
    risk,
    importance,
    requiresApproval,
    blocked,
    source: options?.source || "awenia",
    metadata: options?.metadata || {},
    createdAt: now(),
  };

  return {
    status: blocked ? "blocked" : "created",
    reflection,
    security,
    truthPolicy: {
      reflectionIsAnalysisNotExecution: true,
      noFakeMemorySave: true,
      riskyReflectionRequiresApproval: true,
    },
    timestamp: now(),
  };
}

export async function saveReflection(
  content: string,
  options?: {
    title?: string;
    recommendation?: string;
    source?: string;
    metadata?: any;
    saveSummary?: boolean;
    createEvolution?: boolean;
  }
) {
  const analysis = analyzeReflectionInput(content, options);
  const reflection = analysis.reflection;

  if (options?.recommendation) {
    reflection.recommendation = options.recommendation;
  }

  if (reflection.blocked) {
    return {
      status: "blocked" as ReflectionStatus,
      reflection,
      saved: false,
      reason: "Reflection blocked by safety rules",
      timestamp: now(),
    };
  }

  try {
    const saved = await createAutonomousReflection(
      reflection.title,
      reflection.content,
      reflection.recommendation
    );

    let summary: any = null;
    let evolution: any = null;

    if (options?.saveSummary) {
      summary = await saveMemorySummary(
        reflection.title,
        reflection.content,
        {
          category: reflection.category,
          mood: reflection.mood,
          risk: reflection.risk,
          source: reflection.source,
        }
      );
    }

    if (
      options?.createEvolution ||
      reflection.category === "evolution" ||
      reflection.category === "code" ||
      reflection.category === "debug"
    ) {
      evolution = await createEvolutionSuggestion({
        suggestion: `Reflection improvement: ${reflection.title}`,
        reason: reflection.recommendation,
        priority: reflection.importance,
        status: reflection.requiresApproval ? "pending" : "suggested",
        metadata: {
          category: reflection.category,
          risk: reflection.risk,
          source: reflection.source,
        },
      });
    }

    return {
      status: "saved" as ReflectionStatus,
      reflection,
      saved,
      summary,
      evolution,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as ReflectionStatus,
      reflection,
      error: error?.message || "Failed to save reflection",
      timestamp: now(),
    };
  }
}

export async function getRecentReflections(limit = 30) {
  try {
    const reflections = await getAutonomousReflections(limit);

    return {
      status: "loaded" as ReflectionStatus,
      reflections,
      count: reflections.length,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as ReflectionStatus,
      reflections: [],
      count: 0,
      error: error?.message || "Failed to load reflections",
      timestamp: now(),
    };
  }
}

export async function searchReflections(query = "", limit = 20) {
  const recent = await getRecentReflections(100);
  const lower = normalize(query);

  const reflections = (recent.reflections || []).filter((item: any) => {
    if (!lower) return true;

    return normalize(
      `${item.title || ""} ${item.content || ""} ${item.recommendation || ""}`
    ).includes(lower);
  });

  return {
    status: "searched" as ReflectionStatus,
    query,
    results: reflections.slice(0, limit),
    count: reflections.slice(0, limit).length,
    sourceStatus: recent.status,
    timestamp: now(),
  };
}

export function buildReflectionContextFromItems(items: any[]) {
  if (!items.length) {
    return "Nu există reflecții relevante.";
  }

  return items
    .map((item, index) => {
      return [
        `${index + 1}. ${item.title || "Reflection"}`,
        `Content: ${item.content || ""}`,
        `Recommendation: ${item.recommendation || ""}`,
        `Created: ${item.created_at || item.createdAt || "unknown"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function buildReflectionContext(
  query = "",
  limit = 8
) {
  const search = await searchReflections(query, limit);

  return {
    status: "loaded",
    query,
    context: buildReflectionContextFromItems(search.results),
    results: search.results,
    timestamp: now(),
  };
}

export async function reflectOnInteraction(input: {
  userMessage: string;
  aweniaReply?: string;
  source?: string;
}) {
  const content = [
    `User: ${input.userMessage}`,
    input.aweniaReply ? `Awenia: ${input.aweniaReply}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return saveReflection(content, {
    title: "Conversation reflection",
    source: input.source || "conversation",
    saveSummary: false,
  });
}

export async function reflectOnCode(
  filePath: string,
  note: string
) {
  return saveReflection(
    `Code reflection for ${filePath}:\n${note}`,
    {
      title: `Code reflection: ${filePath}`,
      source: "code",
      createEvolution: true,
      metadata: {
        filePath,
      },
    }
  );
}

export async function reflectOnError(errorText: string) {
  return saveReflection(
    `Error reflection:\n${errorText}`,
    {
      title: "Debug reflection",
      source: "debug",
      createEvolution: true,
    }
  );
}

export async function reflectOnMemory(note: string) {
  return saveReflection(
    `Memory reflection:\n${note}`,
    {
      title: "Memory reflection",
      source: "memory",
      saveSummary: true,
    }
  );
}

export async function runReflectionSystem(
  content = "",
  options?: {
    save?: boolean;
    query?: string;
  }
) {
  if (options?.query) {
    return buildReflectionContext(options.query);
  }

  const analysis = analyzeReflectionInput(content);

  if (options?.save) {
    const saved = await saveReflection(content);

    return {
      status: saved.status,
      analysis,
      saved,
      timestamp: now(),
    };
  }

  return {
    status: analysis.status,
    analysis,
    timestamp: now(),
  };
}

export const createReflection = saveReflection;
export const createAweniaReflection = saveReflection;
export const addReflection = saveReflection;
export const getReflections = getRecentReflections;
export const getReflectionContext = buildReflectionContext;
export const buildReflectionsContext = buildReflectionContext;
export const runReflections = runReflectionSystem;
export const runReflection = runReflectionSystem;
export const reflect = saveReflection;

export default runReflectionSystem;