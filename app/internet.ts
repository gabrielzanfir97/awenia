export type InternetStatus =
  | "connected"
  | "limited"
  | "failed"
  | "not_checked";

export type InternetSourceStatus =
  | "success"
  | "empty"
  | "failed";

export type InternetSource = {
  name: string;
  url: string;
  status: InternetSourceStatus;
  title?: string;
  summary?: string;
  extract?: string;
  error?: string;
};

export type InternetSearchResult = {
  status: InternetStatus;
  verified: boolean;
  query: string;
  sources: InternetSource[];
  summary: string;
  confidence: number;
  errors: string[];
  truthPolicy: {
    noFakeInternetStatus: boolean;
    internetMustBeCheckedWithFetch: boolean;
    failedFetchMeansNotVerified: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AweniaLocalAI/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkInternetConnection() {
  const startedAt = now();

  try {
    const response = await fetchWithTimeout(
      "https://www.wikipedia.org",
      6000
    );

    return {
      status: response.ok ? "connected" : "limited",
      verified: true,
      connected: response.ok,
      httpStatus: response.status,
      checkedUrl: "https://www.wikipedia.org",
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      verified: true,
      connected: false,
      error: error?.message || "Internet check failed",
      checkedUrl: "https://www.wikipedia.org",
      execution: {
        startedAt,
        completedAt: now(),
      },
      timestamp: now(),
    };
  }
}

async function searchWikipediaTitles(query: string, limit = 5) {
  const encoded = encodeURIComponent(query);

  const url =
    `https://en.wikipedia.org/w/api.php?action=opensearch` +
    `&search=${encoded}&limit=${limit}&namespace=0&format=json&origin=*`;

  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }

  const data = await response.json();

  const titles: string[] = Array.isArray(data?.[1]) ? data[1] : [];

  return titles;
}

async function readWikipediaSummary(title: string): Promise<InternetSource> {
  const encoded = encodeURIComponent(title);

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return {
        name: "Wikipedia",
        url,
        status: "failed",
        title,
        error: `Wikipedia summary failed: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      name: "Wikipedia",
      url: data?.content_urls?.desktop?.page || url,
      status: data?.extract ? "success" : "empty",
      title: data?.title || title,
      summary: data?.description || "",
      extract: data?.extract || "",
    };
  } catch (error: any) {
    return {
      name: "Wikipedia",
      url,
      status: "failed",
      title,
      error: error?.message || "Wikipedia summary error",
    };
  }
}

function buildInternetSummary(sources: InternetSource[]) {
  const successful = sources.filter(
    (source) => source.status === "success" && source.extract
  );

  if (successful.length === 0) {
    return "No verified internet knowledge was retrieved.";
  }

  return successful
    .slice(0, 3)
    .map((source) => {
      return `${source.title}: ${source.extract}`;
    })
    .join("\n\n");
}

function calculateConfidence(
  status: InternetStatus,
  sources: InternetSource[]
) {
  const successful = sources.filter(
    (source) => source.status === "success"
  ).length;

  if (status === "failed") return 0;
  if (successful === 0) return 25;

  return Math.min(95, 50 + successful * 15);
}

export async function searchInternet(
  query: string,
  limit = 5
): Promise<InternetSearchResult> {
  const cleanQuery = normalizeQuery(query);
  const errors: string[] = [];

  if (!cleanQuery) {
    return {
      status: "failed",
      verified: true,
      query,
      sources: [],
      summary: "No query provided.",
      confidence: 0,
      errors: ["Missing query"],
      truthPolicy: {
        noFakeInternetStatus: true,
        internetMustBeCheckedWithFetch: true,
        failedFetchMeansNotVerified: true,
      },
      timestamp: now(),
    };
  }

  const connection = await checkInternetConnection();

  if (!connection.connected) {
    return {
      status: "failed",
      verified: true,
      query: cleanQuery,
      sources: [],
      summary: "Internet is not verified as connected.",
      confidence: 0,
      errors: [connection.error || "Internet connection failed"],
      truthPolicy: {
        noFakeInternetStatus: true,
        internetMustBeCheckedWithFetch: true,
        failedFetchMeansNotVerified: true,
      },
      timestamp: now(),
    };
  }

  try {
    const titles = await searchWikipediaTitles(cleanQuery, limit);

    if (titles.length === 0) {
      return {
        status: "limited",
        verified: true,
        query: cleanQuery,
        sources: [],
        summary: "No Wikipedia results found for this query.",
        confidence: 20,
        errors: [],
        truthPolicy: {
          noFakeInternetStatus: true,
          internetMustBeCheckedWithFetch: true,
          failedFetchMeansNotVerified: true,
        },
        timestamp: now(),
      };
    }

    const sources = await Promise.all(
      titles.map((title) => readWikipediaSummary(title))
    );

    const failedSources = sources.filter(
      (source) => source.status === "failed"
    );

    for (const source of failedSources) {
      if (source.error) errors.push(source.error);
    }

    const successfulSources = sources.filter(
      (source) => source.status === "success"
    );

    const status: InternetStatus =
      successfulSources.length > 0 ? "connected" : "limited";

    return {
      status,
      verified: true,
      query: cleanQuery,
      sources,
      summary: buildInternetSummary(sources),
      confidence: calculateConfidence(status, sources),
      errors,
      truthPolicy: {
        noFakeInternetStatus: true,
        internetMustBeCheckedWithFetch: true,
        failedFetchMeansNotVerified: true,
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      verified: true,
      query: cleanQuery,
      sources: [],
      summary: "Internet search failed.",
      confidence: 0,
      errors: [error?.message || "Unknown internet search error"],
      truthPolicy: {
        noFakeInternetStatus: true,
        internetMustBeCheckedWithFetch: true,
        failedFetchMeansNotVerified: true,
      },
      timestamp: now(),
    };
  }
}

export async function learnFromInternet(topic: string) {
  const result = await searchInternet(topic, 5);

  return {
    topic,
    learned: result.status === "connected",
    knowledge: result.summary,
    sources: result.sources,
    confidence: result.confidence,
    verified: result.verified,
    status: result.status,
    errors: result.errors,
    timestamp: now(),
  };
}

export async function getInternetKnowledge(query: string) {
  return searchInternet(query, 5);
}

export async function searchWikipedia(query: string, limit = 5) {
  return searchInternet(query, limit);
}

export async function runInternetSearch(query: string) {
  return searchInternet(query, 5);
}

export async function checkInternetStatus() {
  return checkInternetConnection();
}

export async function getInternetState() {
  const connection = await checkInternetConnection();

  return {
    status: connection.status,
    verified: true,
    connected: connection.connected,
    truthPolicy: {
      noFakeInternetStatus: true,
      internetMustBeCheckedWithFetch: true,
      failedFetchMeansNotVerified: true,
    },
    timestamp: now(),
  };
}