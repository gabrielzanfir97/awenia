import {
  callOllamaChat,
  checkLocalAIConnection,
  getLocalAIConfig,
  getLocalAIState,
  LocalAIMessage,
  LocalAIOptions,
} from "./local-ai-provider";

export type AIProviderName =
  | "local"
  | "ollama"
  | "awenia_local";

export type AIProviderRouterStatus =
  | "configured"
  | "selected"
  | "connected"
  | "completed"
  | "failed"
  | "fallback";

export type AIProviderRouterOptions = LocalAIOptions & {
  provider?: AIProviderName;
  allowExternalProviders?: boolean;
  requireConnectionCheck?: boolean;
};

export type AIProviderRouterResult = {
  status: AIProviderRouterStatus;
  provider: AIProviderName;
  selectedProvider: AIProviderName;
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
  routing: {
    externalProvidersAllowed: boolean;
    localOnly: boolean;
    reason: string;
  };
  truthPolicy: {
    noFakeProviderStatus: boolean;
    noExternalProviderUnlessAllowed: boolean;
    localProviderMustBeCheckedWithFetch: boolean;
    noClaimAIResponseWithoutModelReply: boolean;
  };
  timestamp: string;
};

let activeProvider: AIProviderName = "local";

function now() {
  return new Date().toISOString();
}

function normalizeProvider(provider?: string): AIProviderName {
  if (!provider) return activeProvider;

  const lower = provider.toLowerCase().trim();

  if (lower === "ollama") return "ollama";
  if (lower === "awenia_local") return "awenia_local";
  if (lower === "local") return "local";

  return "local";
}

function normalizeMessages(messages: any[]): LocalAIMessage[] {
  return messages.map((message) => {
    const role =
      message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "tool"
        ? message.role
        : "user";

    return {
      role,
      content:
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content || ""),
    };
  });
}

function buildFailure(input: {
  provider: AIProviderName;
  model: string;
  error: string;
  reason?: string;
}): AIProviderRouterResult {
  const reply = "Gabi, providerul AI local nu a răspuns acum.";

  return {
    status: "failed",
    provider: input.provider,
    selectedProvider: input.provider,
    model: input.model,
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
    error: input.error,
    verified: true,
    routing: {
      externalProvidersAllowed: false,
      localOnly: true,
      reason: input.reason || "Local AI provider failed",
    },
    truthPolicy: {
      noFakeProviderStatus: true,
      noExternalProviderUnlessAllowed: true,
      localProviderMustBeCheckedWithFetch: true,
      noClaimAIResponseWithoutModelReply: true,
    },
    timestamp: now(),
  };
}

export function getActiveAIProvider() {
  return activeProvider;
}

export function setActiveAIProvider(provider: AIProviderName) {
  activeProvider = normalizeProvider(provider);

  return {
    status: "selected" as AIProviderRouterStatus,
    activeProvider,
    localOnly: true,
    externalProvidersAllowed: false,
    timestamp: now(),
  };
}

export function getAIProviderRouterConfig() {
  const localConfig = getLocalAIConfig();

  return {
    status: "configured" as AIProviderRouterStatus,
    activeProvider,
    availableProviders: ["local", "ollama", "awenia_local"],
    disabledExternalProviders: ["groq", "gemini", "openai"],
    localConfig,
    localOnly: true,
    truthPolicy: {
      configDoesNotMeanConnected: true,
      providerConnectionRequiresFetch: true,
      externalProvidersDisabledByDefault: true,
    },
    timestamp: now(),
  };
}

export async function checkAIProviderRouter(
  options?: AIProviderRouterOptions
) {
  const selectedProvider = normalizeProvider(options?.provider);
  const local = await checkLocalAIConnection(options);

  return {
    status: local.connected ? "connected" : "failed",
    selectedProvider,
    activeProvider,
    local,
    externalProviders: {
      enabled: options?.allowExternalProviders === true,
      used: false,
      reason:
        "Awenia este configurată local-first. Providerii externi nu sunt folosiți implicit.",
    },
    verified: true,
    timestamp: now(),
  };
}

export async function routeAIProvider(
  messages: any[],
  options: AIProviderRouterOptions = {}
): Promise<AIProviderRouterResult> {
  const selectedProvider = normalizeProvider(options.provider);
  const externalAllowed = options.allowExternalProviders === true;

  activeProvider = selectedProvider;

  const localConfig = getLocalAIConfig();
  const model = options.model || localConfig.model;

  if (externalAllowed) {
    return buildFailure({
      provider: selectedProvider,
      model,
      error:
        "External providers are intentionally disabled in this router.",
      reason:
        "Awenia is local-first. External provider routing is blocked unless implemented safely later.",
    });
  }

  if (options.requireConnectionCheck) {
    const connection = await checkLocalAIConnection(options);

    if (!connection.connected) {
      return buildFailure({
        provider: selectedProvider,
        model,
        error: connection.error || "Local AI connection failed",
        reason: "Connection check failed before chat call",
      });
    }
  }

  const localResult = await callOllamaChat(
    normalizeMessages(messages),
    options
  );

  if (localResult.status !== "completed") {
    return buildFailure({
      provider: selectedProvider,
      model: localResult.model || model,
      error: localResult.error || "Local AI call failed",
      reason: "Ollama did not complete the response",
    });
  }

  return {
    status: "completed",
    provider: selectedProvider,
    selectedProvider,
    model: localResult.model,
    reply: localResult.reply,
    content: localResult.content,
    choices: localResult.choices,
    raw: localResult.raw,
    verified: true,
    routing: {
      externalProvidersAllowed: false,
      localOnly: true,
      reason: "Local Ollama provider selected and completed response",
    },
    truthPolicy: {
      noFakeProviderStatus: true,
      noExternalProviderUnlessAllowed: true,
      localProviderMustBeCheckedWithFetch: true,
      noClaimAIResponseWithoutModelReply: true,
    },
    timestamp: now(),
  };
}

export async function callAIProvider(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, options);
}

export async function callAI(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, options);
}

export async function callAweniaAI(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, options);
}

export async function callAIWithFallbackOptimized(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, {
    ...(options || {}),
    provider: options?.provider || activeProvider,
    allowExternalProviders: false,
  });
}

export async function callProviderRouter(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, options);
}

export async function generateAIResponse(
  userMessage: string,
  systemPrompt = "Răspunde în română, clar și sincer.",
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(
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

export async function generateAweniaResponse(
  userMessage: string,
  systemPrompt = "Tu ești Awenia. Răspunzi în română pentru Gabi.",
  options?: AIProviderRouterOptions
) {
  return generateAIResponse(userMessage, systemPrompt, options);
}

export async function selectAIProviderForMessage(
  message: string,
  options?: AIProviderRouterOptions
) {
  const selectedProvider = normalizeProvider(options?.provider);

  return {
    status: "selected" as AIProviderRouterStatus,
    messagePreview: message.slice(0, 200),
    selectedProvider,
    reason:
      "Awenia folosește provider local. Mesajul nu schimbă providerul automat.",
    localOnly: true,
    externalProvidersAllowed: false,
    timestamp: now(),
  };
}

export async function getAIProviderState() {
  const localState = await getLocalAIState();

  return {
    status: localState.status,
    activeProvider,
    localState,
    routerConfig: getAIProviderRouterConfig(),
    truthPolicy: {
      noFakeProviderStatus: true,
      configDoesNotMeanConnected: true,
      connectionRequiresFetch: true,
      localOnly: true,
    },
    timestamp: now(),
  };
}

export async function runAIProviderRouter(
  messages: any[],
  options?: AIProviderRouterOptions
) {
  return routeAIProvider(messages, options);
}

export async function testAIProviderRouter(
  prompt = "Răspunde scurt: funcționează providerul local?"
) {
  return generateAIResponse(
    prompt,
    "Răspunde foarte scurt în română.",
    {
      requireConnectionCheck: true,
      timeoutMs: 60000,
    }
  );
}

export function isExternalProviderAllowed() {
  return false;
}

export function getDisabledExternalProviders() {
  return {
    disabled: ["groq", "gemini", "openai"],
    reason:
      "Awenia este configurată local-first. Providerii externi pot fi adăugați doar explicit și controlat.",
    timestamp: now(),
  };
}

export const getProviderRouterConfig = getAIProviderRouterConfig;
export const checkAIProviders = checkAIProviderRouter;
export const routeProvider = routeAIProvider;
export const routerAIProvider = routeAIProvider;
export const generateReply = generateAIResponse;
export const getProviderState = getAIProviderState;
export const aiProviderRouter = routeAIProvider;

export default routeAIProvider;