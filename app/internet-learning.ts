import { searchInternet } from "./internet";
import { supabase } from "./supabase";

export async function learnFromInternet(topic: string) {
  const result = await searchInternet(topic);

  const learned = result.slice(0, 2000);

  await supabase.from("internet_learning").insert({
    topic,
    learned,
    status: "learned",
  });

  return {
    topic,
    learned,
    timestamp: new Date().toISOString(),
    status: "learned",
  };
}

export async function runInternetLearning() {
  const { data } = await supabase
    .from("internet_learning")
    .select("*")
    .order("created_at", { ascending: false })
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

    sources: [
      "Wikipedia",
      "Open knowledge",
      "AI research",
      "Programming patterns",
      "Architecture analysis",
    ],

    timestamp:
      new Date().toISOString(),
  };
}