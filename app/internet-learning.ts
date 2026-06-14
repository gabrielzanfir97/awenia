import { searchInternet } from "./internet";
import { supabase } from "./supabase";
import { createAutonomousReflection } from "./memory-store";

function detectLearningCategory(topic: string) {
  const t = topic.toLowerCase();

  if (
    t.includes("code") ||
    t.includes("programming") ||
    t.includes("typescript")
  ) {
    return "code";
  }

  if (
    t.includes("ai") ||
    t.includes("intelligence") ||
    t.includes("model")
  ) {
    return "ai";
  }

  if (
    t.includes("memory") ||
    t.includes("learning")
  ) {
    return "learning";
  }

  if (
    t.includes("truth") ||
    t.includes("identity") ||
    t.includes("values")
  ) {
    return "values";
  }

  return "general";
}

function estimateImportance(category: string) {
  if (category === "values") return 9;

  if (
    category === "ai" ||
    category === "code"
  ) {
    return 8;
  }

  return 6;
}

export async function learnFromInternet(
  topic: string
) {
  const result = await searchInternet(topic);

  const learned = String(result).slice(
    0,
    3000
  );

  const category =
    detectLearningCategory(topic);

  const importance =
    estimateImportance(category);

  const summary = learned.slice(0, 500);

  await supabase
    .from("internet_learning")
    .insert({
      topic,
      category,
      learned,
      summary,
      importance,
      source: "internet",
      status: "learned",
    });

  await createAutonomousReflection(
    `Learned about ${topic}`,
    category,
    summary
  );

  return {
    system:
      "Awenia Internet Learning V2",

    topic,

    category,

    importance,

    summary,

    learnedLength:
      learned.length,

    status: "learned",

    timestamp:
      new Date().toISOString(),
  };
}

export async function runInternetLearning() {
  const { data } = await supabase
    .from("internet_learning")
    .select("*")
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  const learnedTopics =
    (data || []).map(
      (item: any) => item.topic
    );

  return {
    status: "learning",

    learningState: {
      totalLearnedTopics:
        learnedTopics.length,

      latestTopics:
        learnedTopics.slice(0, 5),

      hasLearningHistory:
        learnedTopics.length > 0,
    },

    timestamp:
      new Date().toISOString(),
  };
}