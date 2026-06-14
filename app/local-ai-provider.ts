export type LocalAIStatus =
  | "configured"
  | "connected"
  | "available"
  | "completed"
  | "failed"
  | "not_checked";

export type LocalAIMessageRole =
  | "system"
  | "user"
  | "assistant"
  | "tool";

export type LocalAIMessage = {
  role: LocalAIMessageRole;
  content: string;
};

export type LocalAIOptions = {
  model?: string;
  temperature?: number;
  numCtx?: number;
  timeoutMs?: number;
  stream?: boolean;
};

export type LocalAIResponse = {
  status: LocalAIStatus;
  provider: "ollama";
  model: string;
  reply: string;
  content: string;
  choices: {
    message: {
      role: "assistant";
      content: string;
    };
  }[];
  raw?: any;
  error?: string;
  verified: boolean;
  execution: {
    startedAt: string;
    completedAt: string;
  };
  truthPolicy: {
    noFakeLocalAIStatus: boolean;
    noClaimModelAvailableWithoutFetch: boolean;
    failedFetchMeansNotAvailable: boolean;
  };
  timestamp: string;
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b";

function now() {
  return new Date().toISOString();
}

function getBaseUrl() {
  return (
    process.env.OLLAMA_BASE_URL ||
    process.env.LOCAL_AI_BASE_URL ||
    DEFAULT_OLLAMA_BASE_URL
  ).replace(/\/+$/, "");
}

function getModel(model?: string) {
  return (
    model ||
    process.env.OLLAMA_MODEL ||
    process.env.LOCAL_AI_MODEL ||
    DEFAULT_OLLAMA_MODEL
  );
}

function normalizeMessages(messages: LocalAIMessage[]) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        content: `Tool result:\n${message.content}`,
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 120000
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildFailedResponse(input: {
  model: string;
  startedAt: string;
  error: string;
}): LocalAIResponse {
  return {
    status: "failed",
    provider: "ollama",
    model: input.model,
    reply: "Gabi, modelul local nu a răspuns acum.",
    content: "Gabi, modelul local nu a răspuns acum.",
    choices: [
      {
        message: {
          role: "assistant",
          content: "Gabi, modelul local nu a răspuns acum.",
        },
      },
    ],
    error: input.error,
    verified: true,
    execution: {
      startedAt: input.startedAt,
      completedAt: now(),
    },
    truthPolicy: {
      noFakeLocalAIStatus: true,
      noClaimModelAvailableWithoutFetch: true,
      failedFetchMeansNotAvailable: true,
    },
    timestamp: now(),
  };
}

export function getLocalAIConfig() {
  return {
    provider: "ollama",
    baseUrl: getBaseUrl(),
    model: getModel(),
    configured: true,
    source: {
      baseUrl:
        process.env.OLLAMA_BASE_URL || process.env.LOCAL_AI_BASE_URL
          ? "env"
          : "default",
      model:
        process.env.OLLAMA_MODEL || process.env.LOCAL_AI_MODEL
          ? "env"
          : "default",
    },
    truthPolicy: {
      configDoesNotMeanConnected: true,
      connectionRequiresFetch: true,
    },
    timestamp: now(),
  };
}

export async function checkLocalAIConnection(
  options?: LocalAIOptions
) {
  const startedAt = now();
  const baseUrl = getBaseUrl();
  const model = getModel(options?.model);

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/tags`,
      {
        method: "GET",
      },
      options?.timeoutMs || 8000
    );

    if (!response.ok) {
      return {
        status: "failed" as LocalAIStatus,
        connected: false,
        verified: true,
        provider: "ollama",
        baseUrl,
        model,
        httpStatus: response.status,
        error: `Ollama tags check failed with status ${response.status}`,
        execution: {
          startedAt,
          completedAt: now(),
        },
        timestamp: now(),
      };
    }

    const data = await response.json();

    const models = Array.isArray(data?.models)
      ? data.models.map((item: any) => item.name).filter(Boolean)
      : [];

    const modelAvailable =
      models.length === 0
        ? false
        : models.some((name: string) => name === model);

    return {
      status: "connected" as LocalAIStatus,
      connected: true,
      verified: true,
      provider: "ollama",
      baseUrl,
      model,
      modelAvailable,
      availableModels: models,
      execution: {
        startedAt,
        completedAt: now(),
      },
      truthPolicy: {
        noFakeLocalAIStatus: true,
        connectionCheckedWithFetch: true,
        modelAvailableOnlyIfListed: true,
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as LocalAIStatus,
      connected: false,
      verified: true,
      provider: "ollama",
      baseUrl,
      model,
      error: error?.message || "Local AI connection check failed",
      execution: {
        startedAt,
        completedAt: now(),
      },
      truthPolicy: {
        noFakeLocalAIStatus: true,
        failedFetchMeansNotConnected: true,
      },
      timestamp: now(),
    };
  }
}

export async function callOllamaChat(
  messages: LocalAIMessage[],
  options: LocalAIOptions = {}
): Promise<LocalAIResponse> {
  const startedAt = now();
  const baseUrl = getBaseUrl();
  const model = getModel(options.model);

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: normalizeMessages(messages),
          stream: options.stream ?? false,
          options: {
            temperature: options.temperature ?? 0.2,
            num_ctx: options.numCtx ?? 8192,
          },
        }),
      },
      options.timeoutMs || 180000
    );

    if (!response.ok) {
      return buildFailedResponse({
        model,
        startedAt,
        error: `Ollama chat failed with status ${response.status}`,
      });
    }

    const data = await response.json();

    const reply =
      data?.message?.content ||
      data?.response ||
      "";

    if (!reply) {
      return buildFailedResponse({
        model,
        startedAt,
        error: "Ollama returned empty reply",
      });
    }

    return {
      status: "completed",
      provider: "ollama",
      model,
      reply,
      content: reply,
      choices: [
        {
          message: {
            role: "assistant",
            content: reply,
          },
        },
      ],
      raw: data,
      verified: true,
      execution: {
        startedAt,
        completedAt: now(),
      },
      truthPolicy: {
        noFakeLocalAIStatus: true,
        noClaimModelAvailableWithoutFetch: true,
        failedFetchMeansNotAvailable: true,
      },
      timestamp: now(),
    };
  } catch (error: any) {
    return buildFailedResponse({
      model,
      startedAt,
      error: error?.message || "Unknown local AI error",
    });
  }
}

export async function callLocalAI(
  messages: LocalAIMessage[],
  options?: LocalAIOptions
) {
  return callOllamaChat(messages, options);
}

export async function callLocalAIProvider(
  messages: LocalAIMessage[],
  options?: LocalAIOptions
) {
  return callOllamaChat(messages, options);
}

export async function callAweniaLocalAI(
  messages: LocalAIMessage[],
  options?: LocalAIOptions
) {
  return callOllamaChat(messages, options);
}

export async function callAIWithFallbackOptimized(
  messages: LocalAIMessage[],
  options?: LocalAIOptions
) {
  return callOllamaChat(messages, options);
}

export async function generateLocalAIReply(
  userMessage: string,
  systemPrompt = "Răspunde în română, clar și sincer.",
  options?: LocalAIOptions
) {
  return callOllamaChat(
    [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    options
  );
}

export async function testLocalAI(
  prompt = "Răspunde scurt: ești conectat local?"
) {
  return generateLocalAIReply(prompt, "Răspunde foarte scurt în română.", {
    timeoutMs: 60000,
  });
}

export async function getLocalAIState() {
  const config = getLocalAIConfig();
  const connection = await checkLocalAIConnection();

  return {
    status: connection.connected ? "connected" : "failed",
    config,
    connection,
    verified: true,
    timestamp: now(),
  };
}

export async function runLocalAIProvider(
  messages: LocalAIMessage[],
  options?: LocalAIOptions
) {
  return callOllamaChat(messages, options);
}

export const checkOllamaConnection = checkLocalAIConnection;
export const callOllama = callOllamaChat;
export const callOllamaProvider = callOllamaChat;
export const localAIProvider = callLocalAIProvider;
export const getLocalAIProviderState = getLocalAIState;

export default callLocalAIProvider;

export const callLocalOllama = callOllamaChat;
export const callLocalOllamaChat = callOllamaChat;
export const testLocalOllama = testLocalAI;