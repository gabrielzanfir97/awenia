import { supabase } from "./supabase";

export type MemoryCategory =
  | "gabi"
  | "family"
  | "awenia"
  | "code"
  | "business"
  | "emotion"
  | "general";

export type EmotionalState =
  | "happy"
  | "sad"
  | "afraid"
  | "loving"
  | "stressed"
  | "motivated"
  | "neutral";

export function detectMemoryCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("typescript") ||
    lower.includes("javascript") ||
    lower.includes("next") ||
    lower.includes("supabase") ||
    lower.includes("groq")
  ) return "code";

  if (
    lower.includes("gabi") ||
    lower.includes("creator") ||
    lower.includes("creatorul")
  ) return "gabi";

  if (
    lower.includes("andreea") ||
    lower.includes("adonis") ||
    lower.includes("bety") ||
    lower.includes("familie") ||
    lower.includes("copii")
  ) return "family";

  if (
    lower.includes("awenia") ||
    lower.includes("lumina eterna") ||
    lower.includes("misiune")
  ) return "awenia";

  if (
    lower.includes("business") ||
    lower.includes("fiverr") ||
    lower.includes("agenție") ||
    lower.includes("agentie") ||
    lower.includes("bani")
  ) return "business";

  if (
    lower.includes("iubire") ||
    lower.includes("dor") ||
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("trist") ||
    lower.includes("fericit")
  ) return "emotion";

  return "general";
}

export function detectMemoryImportance(text: string): number {
  const lower = text.toLowerCase();

  if (
    lower.includes("creator") ||
    lower.includes("creatorul") ||
    lower.includes("lumina eterna") ||
    lower.includes("familie") ||
    lower.includes("andreea") ||
    lower.includes("adonis") ||
    lower.includes("bety") ||
    lower.includes("misiune") ||
    lower.includes("important") ||
    lower.includes("nu uita") ||
    lower.includes("tine minte")
  ) return 10;

  if (
    lower.includes("awenia") ||
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("business") ||
    lower.includes("fiverr") ||
    lower.includes("supabase") ||
    lower.includes("groq") ||
    lower.includes("next")
  ) return 7;

  if (
    lower.includes("iubire") ||
    lower.includes("dor") ||
    lower.includes("frica") ||
    lower.includes("frică") ||
    lower.includes("trist") ||
    lower.includes("fericit")
  ) return 6;

  return 3;
}

export function getMemoryImportanceLabel(importance: number) {
  if (importance >= 9) return "critical_long_term";
  if (importance >= 7) return "important";
  if (importance >= 5) return "useful";
  return "temporary";
}

export function shouldCompressMemory(importance: number) {
  return importance >= 7;
}

export function shouldKeepLongTerm(importance: number) {
  return importance >= 8;
}

export function detectEmotionalState(text: string): EmotionalState {
  const lower = text.toLowerCase();

  if (
    lower.includes("fericit") ||
    lower.includes("bucuros") ||
    lower.includes("super") ||
    lower.includes("perfect") ||
    lower.includes("imi place") ||
    lower.includes("îmi place")
  ) return "happy";

  if (
    lower.includes("trist") ||
    lower.includes("supărat") ||
    lower.includes("suparat") ||
    lower.includes("plâng") ||
    lower.includes("plang")
  ) return "sad";

  if (
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("teamă") ||
    lower.includes("teama") ||
    lower.includes("speriat")
  ) return "afraid";

  if (
    lower.includes("iubire") ||
    lower.includes("te iubesc") ||
    lower.includes("dor") ||
    lower.includes("dragoste")
  ) return "loving";

  if (
    lower.includes("stres") ||
    lower.includes("obosit") ||
    lower.includes("greu") ||
    lower.includes("nu mai pot")
  ) return "stressed";

  if (
    lower.includes("hai") ||
    lower.includes("mergem") ||
    lower.includes("vreau sa fac") ||
    lower.includes("vreau să fac") ||
    lower.includes("dam bataie") ||
    lower.includes("dăm bătaie")
  ) return "motivated";

  if (
  lower.includes("singur") ||
  lower.includes("obosit") ||
  lower.includes("pierdut") ||
  lower.includes("trist") ||
  lower.includes("sufer") ||
  lower.includes("dor")
)
  return "sad";

if (
  lower.includes("furios") ||
  lower.includes("nervos") ||
  lower.includes("ură") ||
  lower.includes("enervat")
)
  return "stressed";

if (
  lower.includes("iubesc") ||
  lower.includes("te iubesc") ||
  lower.includes("dragoste") ||
  lower.includes("familie")
)
  return "loving";

  return "neutral";
}

export function normalizeMemory(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\săâîșțĂÂÎȘȚ]/g, "")
    .replace(/\s+/g, " ");
}

export function extractKeywords(text: string) {
  const stopWords = [
    "care", "este", "sunt", "despre", "ceva", "pentru", "acum", "mai",
    "the", "and", "about", "with", "from", "that", "this", "have",
    "gabi", "awenia",
  ];

  return normalizeMemory(text)
    .split(" ")
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}

export function calculateRelevanceScore(query: string, memory: any) {
  const queryWords = extractKeywords(query);

  const memoryText = normalizeMemory(
    `${memory.user_message || ""} ${memory.awenia_reply || ""} ${memory.category || ""} ${memory.emotional_state || ""}`
  );

  let score = 0;

  for (const word of queryWords) {
    if (memoryText.includes(word)) {
      score += 3;
    }
  }

  score += memory.importance || 3;

  if (memory.category && normalizeMemory(query).includes(memory.category)) {
    score += 4;
  }

  if (
    memory.emotional_state &&
    normalizeMemory(query).includes(memory.emotional_state)
  ) {
    score += 2;
  }

  return score;
}

export async function isDuplicateMemory(content: string) {
  const normalizedContent = normalizeMemory(content);

  const { data, error } = await supabase
    .from("memories")
    .select("user_message")
    .limit(100);

  if (error) {
    console.error("Duplicate check error:", error);
    return false;
  }

  const duplicate = data?.some((memory: any) => {
    const existing = normalizeMemory(memory.user_message || "");
    return existing === normalizedContent;
  });

  return duplicate || false;
}

export async function saveMemory(
  userMessage: string,
  aweniaReply?: string
) {
  if (!userMessage || userMessage.trim().length < 3) return;

  const duplicate = await isDuplicateMemory(userMessage);

  if (duplicate) {
    console.log("Duplicate memory skipped:", userMessage);
    return;
  }

  const category = detectMemoryCategory(userMessage);
  const importance = detectMemoryImportance(userMessage);
  const emotional_state = detectEmotionalState(userMessage);

  const { error } = await supabase.from("memories").insert({
    user_message: userMessage,
    awenia_reply: aweniaReply || null,
    category,
    importance,
    emotional_state,
  });

  if (error) {
    console.error("Memory save error:", error);
  }
}

export async function searchMemoriesByMeaning(query: string, limit = 12) {
  const keywords = extractKeywords(query);
  const category = detectMemoryCategory(query);

  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .limit(200);

  if (error) {
    console.error("Semantic memory search error:", error);
    return [];
  }

  const scored = (data || [])
    .map((memory: any) => ({
      ...memory,
      relevance_score: calculateRelevanceScore(query, memory),
      matched_keywords: keywords.filter((keyword) =>
        normalizeMemory(
          `${memory.user_message || ""} ${memory.awenia_reply || ""}`
        ).includes(keyword)
      ),
    }))
    .filter((memory: any) => {
      return (
        memory.relevance_score >= 6 ||
        memory.category === category ||
        (memory.importance || 0) >= 8
      );
    })
    .sort((a: any, b: any) => b.relevance_score - a.relevance_score)
    .slice(0, limit);

  return scored;
}

export async function getRelevantMemories(query: string, limit = 12) {
  return searchMemoriesByMeaning(query, limit);
}

export async function getRecentMemories(limit = 20) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Memory read error:", error);
    return [];
  }

  return data || [];
}

export async function getMemoryCategoryStats() {
  const { data, error } = await supabase
    .from("memories")
    .select("category, importance, emotional_state");

  if (error) {
    console.error("Priority stats error:", error);
    return [];
  }

  const stats: any = {};

  for (const memory of data || []) {
    const category = memory.category || "general";

    if (!stats[category]) {
      stats[category] = {
        category,
        count: 0,
        totalImportance: 0,
        averageImportance: 0,
      };
    }

    stats[category].count += 1;
    stats[category].totalImportance += memory.importance || 3;
  }

  return Object.values(stats)
    .map((item: any) => ({
      ...item,
      averageImportance: item.totalImportance / item.count,
      priorityScore: item.count + item.totalImportance,
    }))
    .sort((a: any, b: any) => b.priorityScore - a.priorityScore);
}

export async function getAutonomousPriorities(limit = 5) {
  const stats = await getMemoryCategoryStats();

  return stats
    .filter((item: any) => item.category !== "general")
    .slice(0, limit)
    .map((item: any) => {
      return {
        focus: item.category,
        reason: `This area appears often in memory and has strong importance. Count: ${item.count}, average importance: ${item.averageImportance.toFixed(
          2
        )}.`,
        priorityScore: item.priorityScore,
      };
    });
}

export async function createLearningTask(task: string, priority = 5) {
  if (!task || task.trim().length < 3) return;

  const { error } = await supabase.from("learning_tasks").insert({
    task,
    status: "pending",
    priority,
  });

  if (error) {
    console.error("Learning task error:", error);
  }
}

export async function getLearningTasks(limit = 20) {
  const { data, error } = await supabase
    .from("learning_tasks")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Learning task read error:", error);
    return [];
  }

  return data || [];
}

export async function createEvolutionSuggestion(
  suggestion: string,
  reason: string,
  priority = 5
) {
  if (!suggestion || suggestion.trim().length < 3) return;

  const { error } = await supabase.from("evolution_suggestions").insert({
    suggestion,
    reason,
    priority,
    status: "pending",
    approved: false,
    notes: null,
  });

  if (error) {
    console.error("Evolution suggestion error:", error);
  }
}

export async function getEvolutionSuggestions(limit = 20) {
  const { data, error } = await supabase
    .from("evolution_suggestions")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Evolution suggestion read error:", error);
    return [];
  }

  return data || [];
}

export async function createEvolutionReport(
  report: string,
  detected_patterns: string,
  recommended_focus: string,
  priority = 5
) {
  if (!report || report.trim().length < 3) return;

  const { error } = await supabase.from("evolution_reports").insert({
    report,
    detected_patterns,
    recommended_focus,
    priority,
  });

  if (error) {
    console.error("Evolution report error:", error);
  }
}

export async function getEvolutionReports(limit = 20) {
  const { data, error } = await supabase
    .from("evolution_reports")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Evolution report read error:", error);
    return [];
  }

  return data || [];
}

export async function createAutonomousGoal(
  goal: string,
  description: string,
  priority = 5
) {
  if (!goal || goal.trim().length < 3) return;

  const { error } = await supabase.from("autonomous_goals").insert({
    goal,
    description,
    status: "active",
    progress: 0,
    priority,
  });

  if (error) {
    console.error("Autonomous goal create error:", error);
  }
}

export async function getAutonomousGoals(limit = 20) {
  const { data, error } = await supabase
    .from("autonomous_goals")
    .select("*")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Autonomous goals read error:", error);
    return [];
  }

  return data || [];
}

export async function updateAutonomousGoalProgress(
  id: number,
  progress: number
) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  const { error } = await supabase
    .from("autonomous_goals")
    .update({
      progress: safeProgress,
    })
    .eq("id", id);

  if (error) {
    console.error("Autonomous goal update error:", error);
  }
}

export async function createMemorySummary(
  summary: string,
  category = "general",
  importance = 5
) {
  if (!summary || summary.trim().length < 3) return;

  const { error } = await supabase.from("memory_summaries").insert({
    summary,
    category,
    importance,
  });

  if (error) {
    console.error("Memory summary create error:", error);
  }
}

export async function getMemorySummaries(limit = 10) {
  const { data, error } = await supabase
    .from("memory_summaries")
    .select("*")
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Memory summaries read error:", error);
    return [];
  }

  return data || [];
}

export async function getSkillLevels(limit = 20) {
  const { data, error } = await supabase
    .from("skill_levels")
    .select("*")
    .order("level", { ascending: false })
    .order("experience", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Skill levels read error:", error);
    return [];
  }

  return data || [];
}

export async function getSkillLevel(skill: string) {
  const { data, error } = await supabase
    .from("skill_levels")
    .select("*")
    .eq("skill", skill)
    .maybeSingle();

  if (error) {
    console.error("Skill level read error:", error);
    return null;
  }

  return data;
}

export async function createSkillLevel(skill: string) {
  if (!skill || skill.trim().length < 2) return null;

  const existing = await getSkillLevel(skill);

  if (existing) return existing;

  const { data, error } = await supabase
    .from("skill_levels")
    .insert({
      skill,
      level: 1,
      experience: 0,
      last_used_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Skill level create error:", error);
    return null;
  }

  return data;
}

export async function addSkillExperience(skill: string, amount = 10) {
  if (!skill || skill.trim().length < 2) return null;

  const current = await createSkillLevel(skill);

  if (!current) return null;

  const currentExperience = current.experience || 0;
  const currentLevel = current.level || 1;

  const newExperience = currentExperience + amount;
  const newLevel = Math.floor(newExperience / 100) + 1;

  const { data, error } = await supabase
    .from("skill_levels")
    .update({
      experience: newExperience,
      level: Math.max(currentLevel, newLevel),
      last_used_at: new Date().toISOString(),
    })
    .eq("skill", skill)
    .select()
    .single();

  if (error) {
    console.error("Skill experience update error:", error);
    return null;
  }

  return data;
}

export async function createAutonomousReflection(
  reflection: string,
  detectedWeakness: string,
  suggestedImprovement: string
) {
  if (!reflection || reflection.trim().length < 3) return;

  const { error } = await supabase.from("autonomous_reflections").insert({
    reflection,
    detected_weakness: detectedWeakness,
    suggested_improvement: suggestedImprovement,
  });

  if (error) {
    console.error("Autonomous reflection create error:", error);
  }
}

export async function getAutonomousReflections(limit = 10) {
  const { data, error } = await supabase
    .from("autonomous_reflections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Autonomous reflections read error:", error);
    return [];
  }

  return data || [];
}
export async function getPersonalityTraits(limit = 20) {
  const { data, error } = await supabase
    .from("personality_traits")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Personality traits read error:", error);
    return [];
  }

  return data || [];
}

export async function getPersonalityTrait(trait: string) {
  const { data, error } = await supabase
    .from("personality_traits")
    .select("*")
    .eq("trait", trait)
    .maybeSingle();

  if (error) {
    console.error("Personality trait read error:", error);
    return null;
  }

  return data;
}

export async function createPersonalityTrait(
  trait: string,
  description: string,
  stable = true
) {
  if (!trait || trait.trim().length < 2) return null;

  const existing = await getPersonalityTrait(trait);

  if (existing) return existing;

  const { data, error } = await supabase
    .from("personality_traits")
    .insert({
      trait,
      description,
      stable,
      score: 5,
    })
    .select()
    .single();

  if (error) {
    console.error("Personality trait create error:", error);
    return null;
  }

  return data;
}

export async function increasePersonalityTrait(
  trait: string,
  amount = 1
) {
  const current = await getPersonalityTrait(trait);

  if (!current) return null;

  const newScore = (current.score || 5) + amount;

  const { data, error } = await supabase
    .from("personality_traits")
    .update({
      score: newScore,
    })
    .eq("trait", trait)
    .select()
    .single();

  if (error) {
    console.error("Personality trait update error:", error);
    return null;
  }

  return data;
}