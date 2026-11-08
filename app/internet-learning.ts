import {
  checkInternetConnection,
  learnFromInternet,
  searchInternet,
} from "./internet";

import {
  createAutonomousReflection,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
} from "./memory-store";

export type InternetLearningStatus =
  | "learned"
  | "limited"
  | "not_connected"
  | "needs_attention"
  | "failed";

export type InternetLearningTarget = {
  topic: string;
  reason: string;
  priority: number;
  safeToLearn: boolean;
};

function now() {
  return new Date().toISOString();
}

function normalizeTopic(topic: string) {
  return topic.trim().replace(/\s+/g, " ");
}

function extractLearningTopics(input: string): InternetLearningTarget[] {
  const clean = normalizeTopic(input);

  if (!clean) {
    return [
      {
        topic: "Awenia artificial intelligence safety",
        reason: "Default safe learning topic",
        priority: 3,
        safeToLearn: true,
      },
    ];
  }

  return [
    {
      topic: clean,
      reason: "User or system requested internet learning",
      priority: 7,
      safeToLearn: true,
    },
  ];
}

async function shouldSaveLearningSuggestion(topic: string, action: string) {
  const recent = await getEvolutionSuggestions(20);

  const signature = `${topic} ${action}`.toLowerCase().slice(0, 80);

  return !recent.some((item: any) =>
    `${item.suggestion || ""} ${item.reason || ""}`
      .toLowerCase()
      .includes(signature)
  );
}

export async function runInternetLearning(
  topic = "Awenia safe internet learning"
) {
  const startedAt = now();

  try {
    const connection = await checkInternetConnection();

    if (!connection.connected) {
      await createAutonomousReflection(
        "Internet learning skipped",
        "Internet connection is not verified as connected",
        "Do not claim internet knowledge without verified fetch"
      );

      return {
        status: "not_connected" as InternetLearningStatus,

        internetLearning: {
          topic,
          connection,
          learned: false,
          verified: true,
          knowledge: "",
          sources: [],
          confidence: 0,
          recommendation:
            "Internet is not verified. Awenia must not pretend it learned online.",
          truthPolicy: {
            noFakeInternetLearning: true,
            mustVerifyConnectionWithFetch: true,
            failedFetchMeansNotLearned: true,
          },
        },

        execution: {
          startedAt,
          completedAt: now(),
        },

        timestamp: now(),
      };
    }

    const targets = extractLearningTopics(topic);

    const results = [];

    for (const target of targets) {
      if (!target.safeToLearn) {
        results.push({
          target,
          status: "skipped",
          reason: "Target is not safe to learn automatically",
        });

        continue;
      }

      const learned = await learnFromInternet(target.topic);

      results.push({
        target,
        result: learned,
        status: learned.learned ? "learned" : "limited",
      });
    }

    const learnedResults = results.filter(
      (item: any) => item.status === "learned"
    );

    const limitedResults = results.filter(
      (item: any) => item.status === "limited"
    );

    const confidence =
      learnedResults.length > 0
        ? Math.round(
          learnedResults.reduce(
            (sum: number, item: any) =>
              sum + (item.result?.confidence || 0),
            0
          ) / learnedResults.length
        )
        : 0;

    const status: InternetLearningStatus =
      learnedResults.length > 0
        ? "learned"
        : limitedResults.length > 0
          ? "limited"
          : "needs_attention";

    const combinedKnowledge = results
      .map((item: any) => item.result?.knowledge || "")
      .filter(Boolean)
      .join("\n\n");

    const sources = results.flatMap((item: any) => item.result?.sources || []);

    // Persist fetched source summaries separately from reflections and learning tasks.
    // "learned" here means source material was fetched, not independently fact-checked.
    let knowledgePersistence: any = { status: "not_saved", persisted: false };
    const usableSources = sources.filter((source: any) =>
      source?.status === "success" &&
      typeof source.url === "string" &&
      /^https:\/\//i.test(source.url)
    );

    if (status === "learned" && usableSources.length > 0 &&
        combinedKnowledge.trim().length > 25) {
      try {
        const { getRecentMemories, saveMemory } = await import("./memory-store");
        const existing = await getRecentMemories(400);
        const duplicate = existing.some((item: any) =>
          item.category === "learning" &&
          item.metadata?.source === "internet" &&
          String(item.metadata?.topic || "").toLowerCase() === topic.trim().toLowerCase()
        );

        if (duplicate) {
          knowledgePersistence = { status: "duplicate", persisted: false };
        } else {
          const saved = await saveMemory({
            user_message: `Internet topic: ${topic}\n${combinedKnowledge.slice(0, 6000)}`,
            awenia_reply: "Fetched source summaries; independent factual verification not performed.",
            category: "learning",
            importance: 7,
            metadata: {
              source: "internet",
              topic,
              evidence: "fetched_wikipedia_summaries",
              independentlyVerified: false,
              verifiedFetch: true,
              confidence,
              sourceUrls: usableSources.slice(0, 5).map((item: any) => item.url),
              learnedAt: now(),
            },
          });
          knowledgePersistence = {
            status: saved.status,
            persisted: saved.supabase?.saved === true,
            error: saved.supabase?.error || null,
          };
        }
      } catch (error: any) {
        knowledgePersistence = {
          status: "failed", persisted: false,
          error: error?.message || "Knowledge persistence failed",
        };
      }
    }

    await createAutonomousReflection(
      `Internet learning completed: ${topic}`,
      `Status: ${status}. Learned topics: ${learnedResults.length}. Limited: ${limitedResults.length}.`,
      status === "learned"
        ? "Use verified knowledge carefully with source awareness"
        : "Do not rely on internet learning result until verified better"
    );

    let suggestionSaved = false;

    if (
      status !== "learned" &&
      (await shouldSaveLearningSuggestion(
        topic,
        "Improve internet learning reliability"
      ))
    ) {
      await createEvolutionSuggestion(
        "Improve internet learning reliability",
        `Internet learning for "${topic}" returned status ${status}.`,
        7
      );

      suggestionSaved = true;
    }

    return {
      status,

      internetLearning: {
        topic,
        connection,
        targets,
        results,
        learned: status === "learned",
        verified: true,
        knowledge: combinedKnowledge,
        sources,
        confidence,
        suggestionSaved,
        knowledgePersistence,
        recommendation:
          status === "learned"
            ? "Use learned knowledge as verified internet summary"
            : "Treat result as limited and avoid confident claims",
        truthPolicy: {
          noFakeInternetLearning: true,
          mustVerifyConnectionWithFetch: true,
          sourcesRequiredForOnlineKnowledge: true,
          failedFetchMeansNotLearned: true,
        },
      },

      execution: {
        startedAt,
        completedAt: now(),
      },

      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as InternetLearningStatus,

      internetLearning: {
        topic,
        learned: false,
        verified: false,
        knowledge: "",
        sources: [],
        confidence: 0,
        error: error?.message || "Unknown internet learning error",
        recommendation:
          "Repair internet-learning.ts or connected internet system",
        truthPolicy: {
          noFakeInternetLearning: true,
          mustVerifyConnectionWithFetch: true,
          failedFetchMeansNotLearned: true,
        },
      },

      execution: {
        startedAt,
        completedAt: now(),
      },

      error: error?.message || "Unknown internet learning error",

      timestamp: now(),
    };
  }
}

export async function learnTopicFromInternet(topic: string) {
  return runInternetLearning(topic);
}

export async function buildInternetLearningState(topic?: string) {
  return runInternetLearning(topic);
}

export async function analyzeInternetLearning(topic?: string) {
  return runInternetLearning(topic);
}

export async function searchAndLearn(query: string) {
  const result = await searchInternet(query, 5);

  return {
    status: result.status,
    learned: result.status === "connected",
    query,
    result,
    timestamp: now(),
  };
}