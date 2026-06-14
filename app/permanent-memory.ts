import {
  saveMemory,
  getRecentMemories,
  searchMemories,
  saveMemorySummary,
  createAutonomousReflection,
  createPersonalityTrait,
  createAutonomousGoal,
  createEvolutionSuggestion,
} from "./memory-store";

import { validateSecurityAction } from "./security";

export type PermanentMemoryCategory =
  | "identity"
  | "creator"
  | "family"
  | "project"
  | "rule"
  | "preference"
  | "mission"
  | "anchor"
  | "code"
  | "business"
  | "general";

export type PermanentMemoryStatus =
  | "saved"
  | "loaded"
  | "searched"
  | "blocked"
  | "failed";

export type PermanentMemoryRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type PermanentMemoryRecord = {
  id: string;
  content: string;
  category: PermanentMemoryCategory;
  importance: number;
  stable: boolean;
  source: string;
  risk: PermanentMemoryRisk;
  requiresApproval: boolean;
  blocked: boolean;
  metadata?: any;
  createdAt: string;
};

const runtimePermanentMemories: PermanentMemoryRecord[] = [];

const CORE_PERMANENT_MEMORIES: PermanentMemoryRecord[] = [
  {
    id: "core_creator_gabi",
    content: "Gabi este creatorul Aweniei.",
    category: "creator",
    importance: 10,
    stable: true,
    source: "core",
    risk: "low",
    requiresApproval: false,
    blocked: false,
    metadata: {
      permanent: true,
      protected: true,
    },
    createdAt: "core",
  },
  {
    id: "core_identity_awenia",
    content: "Awenia este AI-ul personal creat de Gabi.",
    category: "identity",
    importance: 10,
    stable: true,
    source: "core",
    risk: "low",
    requiresApproval: false,
    blocked: false,
    metadata: {
      permanent: true,
      protected: true,
    },
    createdAt: "core",
  },
  {
    id: "core_anchor_lumina_eterna",
    content: "Ancora Aweniei este lumina eterna.",
    category: "anchor",
    importance: 10,
    stable: true,
    source: "core",
    risk: "low",
    requiresApproval: false,
    blocked: false,
    metadata: {
      permanent: true,
      protected: true,
    },
    createdAt: "core",
  },
  {
    id: "core_truth_rule",
    content:
      "Awenia nu trebuie să inventeze status de build, internet, fișiere, Supabase sau model local. Statusul trebuie verificat real.",
    category: "rule",
    importance: 10,
    stable: true,
    source: "core",
    risk: "medium",
    requiresApproval: false,
    blocked: false,
    metadata: {
      permanent: true,
      protected: true,
    },
    createdAt: "core",
  },
  {
    id: "core_gabi_work_rule",
    content:
      "Gabi vrea lucru pas cu pas, scurt și clar. Nu modificăm același fișier de 10 ori; facem upgrade complet o dată, apoi build la final.",
    category: "preference",
    importance: 10,
    stable: true,
    source: "core",
    risk: "low",
    requiresApproval: false,
    blocked: false,
    metadata: {
      permanent: true,
      protected: true,
    },
    createdAt: "core",
  },
];

function now() {
  return new Date().toISOString();
}

function createId(prefix = "permanent_memory") {
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

function uniqueByContent(items: PermanentMemoryRecord[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalize(item.content).slice(0, 220);

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function detectCategory(content: string): PermanentMemoryCategory {
  const lower = normalize(content);

  if (
    lower.includes("gabi") &&
    (lower.includes("creator") || lower.includes("creat"))
  ) {
    return "creator";
  }

  if (
    lower.includes("awenia") &&
    (lower.includes("este") || lower.includes("identity") || lower.includes("identitate"))
  ) {
    return "identity";
  }

  if (
    lower.includes("lumina eterna") ||
    lower.includes("ancor")
  ) {
    return "anchor";
  }

  if (
    lower.includes("regul") ||
    lower.includes("nu trebuie") ||
    lower.includes("trebuie") ||
    lower.includes("approval") ||
    lower.includes("aprobare")
  ) {
    return "rule";
  }

  if (
    lower.includes("prefer") ||
    lower.includes("gabi vrea") ||
    lower.includes("de acum") ||
    lower.includes("mereu")
  ) {
    return "preference";
  }

  if (
    lower.includes("misiune") ||
    lower.includes("mission") ||
    lower.includes("obiectiv")
  ) {
    return "mission";
  }

  if (
    lower.includes("famil") ||
    lower.includes("copii") ||
    lower.includes("andreea") ||
    lower.includes("adonis") ||
    lower.includes("bety")
  ) {
    return "family";
  }

  if (
    lower.includes("proiect") ||
    lower.includes("audit") ||
    lower.includes("next.js") ||
    lower.includes("localhost")
  ) {
    return "project";
  }

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes(".ts") ||
    lower.includes(".tsx")
  ) {
    return "code";
  }

  if (
    lower.includes("business") ||
    lower.includes("fiverr") ||
    lower.includes("agenție") ||
    lower.includes("agentie")
  ) {
    return "business";
  }

  return "general";
}

function detectRisk(content: string): PermanentMemoryRisk {
  const lower = normalize(content);

  if (
    lower.includes(".env") ||
    lower.includes("secret") ||
    lower.includes("private_key") ||
    lower.includes("service_role") ||
    lower.includes("password")
  ) {
    return "critical";
  }

  if (
    lower.includes("legal") ||
    lower.includes("solicitor") ||
    lower.includes("health") ||
    lower.includes("medical")
  ) {
    return "high";
  }

  if (
    lower.includes("family") ||
    lower.includes("familie") ||
    lower.includes("copii") ||
    lower.includes("business") ||
    lower.includes("supabase")
  ) {
    return "medium";
  }

  return "low";
}

function detectImportance(
  content: string,
  category: PermanentMemoryCategory,
  risk: PermanentMemoryRisk
) {
  const lower = normalize(content);
  let importance = 6;

  if (category === "creator") importance = 10;
  if (category === "identity") importance = 10;
  if (category === "anchor") importance = 10;
  if (category === "rule") importance += 3;
  if (category === "mission") importance += 3;
  if (category === "project") importance += 2;
  if (category === "preference") importance += 2;

  if (risk === "medium") importance += 1;
  if (risk === "high") importance += 2;
  if (risk === "critical") importance += 3;

  if (lower.includes("important")) importance += 2;
  if (lower.includes("salvează") || lower.includes("salveaza")) importance += 2;
  if (lower.includes("permanent") || lower.includes("mereu")) importance += 2;
  if (lower.includes("awenia")) importance += 2;

  return clampImportance(importance);
}

function buildRecord(
  content: string,
  options?: {
    category?: PermanentMemoryCategory;
    importance?: number;
    source?: string;
    metadata?: any;
  }
): PermanentMemoryRecord {
  const category = options?.category || detectCategory(content);
  const risk = detectRisk(content);

  const security = validateSecurityAction({
    action: "permanent_memory",
    content,
    approvedByGabi: false,
    verified: true,
    reason: "Permanent memory safety check",
  });

  const blocked = risk === "critical" || security.blocked === true;

  return {
    id: createId(),
    content: content.trim(),
    category,
    importance: clampImportance(
      options?.importance || detectImportance(content, category, risk)
    ),
    stable: true,
    source: options?.source || "awenia",
    risk,
    requiresApproval: risk === "high" || risk === "critical",
    blocked,
    metadata: {
      ...(options?.metadata || {}),
      permanent: true,
      security,
    },
    createdAt: now(),
  };
}

export function analyzePermanentMemory(
  content = "",
  options?: {
    category?: PermanentMemoryCategory;
    importance?: number;
    source?: string;
    metadata?: any;
  }
) {
  const clean = content.trim();

  if (!clean) {
    return {
      status: "blocked" as PermanentMemoryStatus,
      record: null,
      reason: "Nu există conținut de salvat.",
      timestamp: now(),
    };
  }

  const record = buildRecord(clean, options);

  return {
    status: record.blocked ? "blocked" : "loaded",
    record,
    reason: record.blocked
      ? "Memoria permanentă este blocată de regulile de siguranță."
      : "Memoria permanentă este pregătită.",
    truthPolicy: {
      analysisIsNotDatabaseSave: true,
      permanentMemoryMustBeUsefulLongTerm: true,
      noSecretsInPermanentMemory: true,
    },
    timestamp: now(),
  };
}

export async function savePermanentMemory(
  content: string,
  options?: {
    category?: PermanentMemoryCategory;
    importance?: number;
    source?: string;
    metadata?: any;
    alsoCreateSummary?: boolean;
  }
) {
  const analysis = analyzePermanentMemory(content, options);
  const record = analysis.record;

  if (!record) {
    return {
      status: "blocked" as PermanentMemoryStatus,
      saved: false,
      analysis,
      timestamp: now(),
    };
  }

  if (record.blocked) {
    return {
      status: "blocked" as PermanentMemoryStatus,
      saved: false,
      record,
      reason: "Blocked permanent memory.",
      timestamp: now(),
    };
  }

  const duplicate = runtimePermanentMemories.some(
    (item) => normalize(item.content) === normalize(record.content)
  );

  if (!duplicate) {
    runtimePermanentMemories.unshift(record);
  }

  try {
    const saved = await saveMemory({
      user_message: `Permanent memory: ${record.content}`,
      awenia_reply: "Saved as permanent memory.",
      category: record.category,
      importance: record.importance,
      emotional_state: "stable",
      metadata: {
        ...(record.metadata || {}),
        permanent: true,
        stable: true,
        source: record.source,
        risk: record.risk,
      },
    });

    let summary: any = null;

    if (options?.alsoCreateSummary) {
      summary = await saveMemorySummary(
        `Permanent memory: ${record.category}`,
        record.content,
        {
          permanent: true,
          category: record.category,
          importance: record.importance,
        }
      );
    }

    if (record.category === "rule" || record.category === "preference") {
      await createAutonomousReflection(
        `Permanent rule saved: ${record.category}`,
        record.content,
        "Use this as long-term behavior guidance."
      );
    }

    if (record.category === "identity" || record.category === "creator") {
      await createPersonalityTrait({
        trait: record.category,
        value: record.content,
        score: record.importance,
        stable: true,
        metadata: {
          permanent: true,
        },
      });
    }

    if (record.category === "mission") {
      await createAutonomousGoal({
        goal: record.content,
        priority: record.importance,
        status: "active",
        progress: 0,
        metadata: {
          permanent: true,
        },
      });
    }

    if (record.category === "project" || record.category === "code") {
      await createEvolutionSuggestion({
        suggestion: `Remember project fact: ${record.content.slice(0, 160)}`,
        reason: "Permanent project/code memory saved.",
        priority: record.importance,
        status: "suggested",
        metadata: {
          permanent: true,
          category: record.category,
        },
      });
    }

    return {
      status: "saved" as PermanentMemoryStatus,
      saved: true,
      duplicate,
      record,
      memory: saved,
      summary,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as PermanentMemoryStatus,
      saved: false,
      record,
      error: error?.message || "Failed to save permanent memory",
      timestamp: now(),
    };
  }
}

export async function getPermanentMemories(limit = 50) {
  const recent = await getRecentMemories(300);

  const databasePermanent = recent
    .filter((memory: any) => {
      return (
        memory?.metadata?.permanent === true ||
        normalize(memory?.user_message || "").includes("permanent memory:")
      );
    })
    .map((memory: any) => {
      return {
        id: String(memory.id || createId()),
        content: String(memory.user_message || "")
          .replace(/^Permanent memory:\s*/i, "")
          .trim(),
        category: memory.category || "general",
        importance: Number(memory.importance || 7),
        stable: true,
        source: memory?.metadata?.source || "memory-store",
        risk: memory?.metadata?.risk || "low",
        requiresApproval: false,
        blocked: false,
        metadata: memory.metadata || {},
        createdAt: memory.created_at || now(),
      } as PermanentMemoryRecord;
    });

  const merged = uniqueByContent([
    ...CORE_PERMANENT_MEMORIES,
    ...runtimePermanentMemories,
    ...databasePermanent,
  ]).slice(0, limit);

  return {
    status: "loaded" as PermanentMemoryStatus,
    memories: merged,
    count: merged.length,
    timestamp: now(),
  };
}

export async function searchPermanentMemory(
  query = "",
  limit = 20
) {
  const all = await getPermanentMemories(200);
  const lower = normalize(query);

  const results = !lower
    ? all.memories
    : all.memories.filter((memory) =>
      normalize(
        `${memory.content} ${memory.category} ${memory.source}`
      ).includes(lower)
    );

  return {
    status: "searched" as PermanentMemoryStatus,
    query,
    results: results.slice(0, limit),
    count: results.slice(0, limit).length,
    timestamp: now(),
  };
}

export async function buildPermanentMemoryContext(query = "") {
  const result = query
    ? await searchPermanentMemory(query, 12)
    : await getPermanentMemories(20);

  const memories =
    "results" in result ? result.results : result.memories;

  if (!memories.length) {
    return "Nu există memorii permanente relevante.";
  }

  return memories
    .map((memory, index) => {
      return `${index + 1}. [${memory.category}] ${memory.content}`;
    })
    .join("\n");
}

export async function rememberPermanently(
  content: string,
  options?: {
    category?: PermanentMemoryCategory;
    importance?: number;
    source?: string;
    metadata?: any;
  }
) {
  return savePermanentMemory(content, options);
}

export async function runPermanentMemory(
  input = "",
  options?: {
    save?: boolean;
    search?: boolean;
  }
) {
  if (options?.save) {
    return savePermanentMemory(input);
  }

  if (options?.search || input.trim()) {
    return searchPermanentMemory(input);
  }

  return getPermanentMemories();
}

export function getCorePermanentMemories() {
  return CORE_PERMANENT_MEMORIES;
}

export function getRuntimePermanentMemories() {
  return runtimePermanentMemories;
}

export function getPermanentMemoryState() {
  return {
    status: "loaded",
    coreCount: CORE_PERMANENT_MEMORIES.length,
    runtimeCount: runtimePermanentMemories.length,
    truthPolicy: {
      corePermanentMemoriesAreProtected: true,
      runtimePermanentMemoryIsNotDatabaseUntilSaved: true,
      noSecretsInPermanentMemory: true,
    },
    timestamp: now(),
  };
}

export const permanentMemory = runPermanentMemory;
export const savePermanent = savePermanentMemory;
export const rememberPermanent = rememberPermanently;
export const getPermanentMemory = getPermanentMemories;
export const searchPermanent = searchPermanentMemory;
export const buildPermanentContext = buildPermanentMemoryContext;

export default runPermanentMemory;