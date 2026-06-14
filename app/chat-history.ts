import { supabase, isSupabaseConfigured } from "./supabase";

import {
  saveMemory,
  createAutonomousReflection,
} from "./memory-store";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatHistoryStatus =
  | "saved"
  | "loaded"
  | "partial"
  | "fallback"
  | "failed";

export type ChatHistoryMessage = {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  source: "runtime" | "supabase" | "system";
  metadata?: any;
  createdAt: string;
};

export type ChatTurn = {
  userMessage: string;
  aweniaReply: string;
  sessionId?: string;
  metadata?: any;
};

export type ChatHistoryState = {
  status: ChatHistoryStatus;
  sessionId: string;
  runtimeMessages: ChatHistoryMessage[];
  storedMessages: ChatHistoryMessage[];
  context: string;
  sourceStatus: {
    runtime: "loaded";
    supabase: "loaded" | "not_configured" | "failed";
  };
  truthPolicy: {
    noFakeChatHistory: boolean;
    noClaimSavedWithoutWrite: boolean;
    runtimeHistoryIsNotDatabaseHistory: boolean;
  };
  timestamp: string;
};

const runtimeChatHistory: ChatHistoryMessage[] = [];

const DEFAULT_SESSION_ID = "awenia_local_session";

function now() {
  return new Date().toISOString();
}

function createId(prefix = "chat") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeSessionId(sessionId?: string) {
  return (sessionId || DEFAULT_SESSION_ID).trim() || DEFAULT_SESSION_ID;
}

function normalizeContent(content = "") {
  return content.trim().replace(/\r\n/g, "\n");
}

function normalizeSupabaseMessage(item: any): ChatHistoryMessage {
  return {
    id: String(item.id || createId("stored_chat")),
    sessionId:
      item.session_id ||
      item.sessionId ||
      DEFAULT_SESSION_ID,
    role:
      item.role ||
      item.message_role ||
      item.sender ||
      "user",
    content:
      item.content ||
      item.message ||
      item.user_message ||
      item.awenia_reply ||
      "",
    source: "supabase",
    metadata: item.metadata || {},
    createdAt:
      item.created_at ||
      item.createdAt ||
      now(),
  };
}

function addRuntimeMessage(input: {
  role: ChatRole;
  content: string;
  sessionId?: string;
  metadata?: any;
  source?: ChatHistoryMessage["source"];
}) {
  const message: ChatHistoryMessage = {
    id: createId("runtime_chat"),
    sessionId: normalizeSessionId(input.sessionId),
    role: input.role,
    content: normalizeContent(input.content),
    source: input.source || "runtime",
    metadata: input.metadata || {},
    createdAt: now(),
  };

  runtimeChatHistory.unshift(message);

  return message;
}

async function saveMessageToSupabase(message: ChatHistoryMessage) {
  if (!isSupabaseConfigured()) {
    return {
      status: "not_configured",
      saved: false,
      error: "Supabase is not configured",
    };
  }

  const payload = {
    session_id: message.sessionId,
    role: message.role,
    content: message.content,
    metadata: message.metadata || {},
    created_at: message.createdAt,
  };

  const { data, error } = await supabase
    .from("chat_history")
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    return {
      status: "failed",
      saved: false,
      error: error.message,
    };
  }

  return {
    status: "saved",
    saved: true,
    data,
  };
}

async function readMessagesFromSupabase(
  sessionId = DEFAULT_SESSION_ID,
  limit = 50
) {
  if (!isSupabaseConfigured()) {
    return {
      status: "not_configured" as const,
      data: [],
      error: "Supabase is not configured",
    };
  }

  const { data, error } = await supabase
    .from("chat_history")
    .select("*")
    .eq("session_id", normalizeSessionId(sessionId))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return {
      status: "failed" as const,
      data: [],
      error: error.message,
    };
  }

  return {
    status: "loaded" as const,
    data: (data || []).map(normalizeSupabaseMessage),
    error: null,
  };
}

function buildHistoryContext(messages: ChatHistoryMessage[], limit = 12) {
  if (messages.length === 0) {
    return "Nu există istoric de chat verificat pentru această sesiune.";
  }

  return messages
    .slice(0, limit)
    .reverse()
    .map((message) => {
      const role =
        message.role === "user"
          ? "Gabi"
          : message.role === "assistant"
            ? "Awenia"
            : message.role;

      return `${role}: ${message.content}`;
    })
    .join("\n");
}

export async function addChatMessage(input: {
  role: ChatRole;
  content: string;
  sessionId?: string;
  metadata?: any;
  saveToSupabase?: boolean;
}) {
  const runtimeMessage = addRuntimeMessage({
    role: input.role,
    content: input.content,
    sessionId: input.sessionId,
    metadata: input.metadata,
  });

  let supabaseResult: any = null;

  if (input.saveToSupabase) {
    try {
      supabaseResult = await saveMessageToSupabase(runtimeMessage);
    } catch (error: any) {
      supabaseResult = {
        status: "failed",
        saved: false,
        error: error?.message || "Failed to save chat message",
      };
    }
  }

  return {
    status:
      input.saveToSupabase && supabaseResult?.saved !== true
        ? "partial"
        : "saved",
    runtimeMessage,
    supabase: supabaseResult,
    truthPolicy: {
      runtimeSaved: true,
      supabaseSaved: Boolean(supabaseResult?.saved),
      noClaimDatabaseSaveWithoutWrite: true,
    },
    timestamp: now(),
  };
}

export async function saveChatTurn(input: ChatTurn) {
  const sessionId = normalizeSessionId(input.sessionId);

  const user = await addChatMessage({
    role: "user",
    content: input.userMessage,
    sessionId,
    metadata: input.metadata,
    saveToSupabase: true,
  });

  const assistant = await addChatMessage({
    role: "assistant",
    content: input.aweniaReply,
    sessionId,
    metadata: input.metadata,
    saveToSupabase: true,
  });

  try {
    await saveMemory(
      input.userMessage,
      input.aweniaReply,
      "general" as any,
      4
    );
  } catch {
    // Chat history rămâne salvat chiar dacă memoria generală eșuează.
  }

  return {
    status:
      user.status === "saved" && assistant.status === "saved"
        ? "saved"
        : "partial",
    sessionId,
    user,
    assistant,
    timestamp: now(),
  };
}

export async function getChatHistory(
  sessionId = DEFAULT_SESSION_ID,
  limit = 50
): Promise<ChatHistoryState> {
  const normalizedSessionId = normalizeSessionId(sessionId);

  const runtimeMessages = runtimeChatHistory
    .filter((message) => message.sessionId === normalizedSessionId)
    .slice(0, limit);

  let storedResult: any = {
    status: "not_configured",
    data: [],
  };

  try {
    storedResult = await readMessagesFromSupabase(
      normalizedSessionId,
      limit
    );
  } catch (error: any) {
    storedResult = {
      status: "failed",
      data: [],
      error: error?.message || "Failed to read chat history",
    };
  }

  const storedMessages = storedResult.data || [];

  const combined = [...runtimeMessages, ...storedMessages];

  const status: ChatHistoryStatus =
    storedResult.status === "loaded"
      ? "loaded"
      : runtimeMessages.length > 0
        ? "fallback"
        : "partial";

  return {
    status,
    sessionId: normalizedSessionId,
    runtimeMessages,
    storedMessages,
    context: buildHistoryContext(combined, 16),
    sourceStatus: {
      runtime: "loaded",
      supabase:
        storedResult.status === "loaded"
          ? "loaded"
          : storedResult.status === "not_configured"
            ? "not_configured"
            : "failed",
    },
    truthPolicy: {
      noFakeChatHistory: true,
      noClaimSavedWithoutWrite: true,
      runtimeHistoryIsNotDatabaseHistory: true,
    },
    timestamp: now(),
  };
}

export async function getRecentChatHistory(
  sessionId = DEFAULT_SESSION_ID,
  limit = 20
) {
  return getChatHistory(sessionId, limit);
}

export async function buildChatHistoryContext(
  sessionId = DEFAULT_SESSION_ID,
  limit = 16
) {
  const state = await getChatHistory(sessionId, limit);

  return state.context;
}

export async function summarizeChatHistory(
  sessionId = DEFAULT_SESSION_ID,
  limit = 30
) {
  const state = await getChatHistory(sessionId, limit);

  const messages = [
    ...state.runtimeMessages,
    ...state.storedMessages,
  ].slice(0, limit);

  if (messages.length === 0) {
    return {
      status: "fallback",
      sessionId: state.sessionId,
      summary: "Nu există mesaje verificate de rezumat.",
      messageCount: 0,
      timestamp: now(),
    };
  }

  const summary = messages
    .reverse()
    .map((message, index) => {
      const role =
        message.role === "user"
          ? "Gabi"
          : message.role === "assistant"
            ? "Awenia"
            : message.role;

      return `${index + 1}. ${role}: ${message.content.slice(0, 300)}`;
    })
    .join("\n");

  try {
    await createAutonomousReflection(
      `Chat history summary: ${sessionId}`,
      summary,
      "Use this only as a verified summary of loaded chat history"
    );
  } catch {
    // Nu blocăm rezumatul dacă reflection nu se salvează.
  }

  return {
    status: "loaded",
    sessionId: state.sessionId,
    summary,
    messageCount: messages.length,
    sourceStatus: state.sourceStatus,
    timestamp: now(),
  };
}

export function getRuntimeChatHistory(sessionId = DEFAULT_SESSION_ID) {
  const normalizedSessionId = normalizeSessionId(sessionId);

  return runtimeChatHistory.filter(
    (message) => message.sessionId === normalizedSessionId
  );
}

export function clearRuntimeChatHistory(sessionId?: string) {
  if (!sessionId) {
    const count = runtimeChatHistory.length;
    runtimeChatHistory.splice(0, runtimeChatHistory.length);

    return {
      status: "cleared",
      count,
      timestamp: now(),
    };
  }

  const normalizedSessionId = normalizeSessionId(sessionId);
  const before = runtimeChatHistory.length;

  for (let index = runtimeChatHistory.length - 1; index >= 0; index--) {
    if (runtimeChatHistory[index].sessionId === normalizedSessionId) {
      runtimeChatHistory.splice(index, 1);
    }
  }

  return {
    status: "cleared",
    sessionId: normalizedSessionId,
    count: before - runtimeChatHistory.length,
    timestamp: now(),
  };
}

export async function runChatHistorySystem(
  sessionId = DEFAULT_SESSION_ID
) {
  const state = await getChatHistory(sessionId, 30);

  try {
    await createAutonomousReflection(
      "Chat history checked",
      `Status: ${state.status}. Runtime: ${state.runtimeMessages.length}. Stored: ${state.storedMessages.length}.`,
      "Use chat history only when verified and relevant"
    );
  } catch {
    // Nu blocăm sistemul dacă reflection nu se salvează.
  }

  return state;
}

export async function saveChatMessage(
  role: ChatRole,
  content: string,
  sessionId = DEFAULT_SESSION_ID
) {
  return addChatMessage({
    role,
    content,
    sessionId,
    saveToSupabase: true,
  });
}

export async function addToChatHistory(
  role: ChatRole,
  content: string,
  sessionId = DEFAULT_SESSION_ID
) {
  return saveChatMessage(role, content, sessionId);
}

export async function rememberConversation(
  userMessage: string,
  aweniaReply: string,
  sessionId = DEFAULT_SESSION_ID
) {
  return saveChatTurn({
    userMessage,
    aweniaReply,
    sessionId,
  });
}

export async function getChatMessages(
  sessionId = DEFAULT_SESSION_ID,
  limit = 50
) {
  return getChatHistory(sessionId, limit);
}

export async function getChatContext(
  sessionId = DEFAULT_SESSION_ID,
  limit = 16
) {
  return buildChatHistoryContext(sessionId, limit);
}

export async function getConversationHistory(
  sessionId = DEFAULT_SESSION_ID,
  limit = 50
) {
  return getChatHistory(sessionId, limit);
}

export async function getConversationContext(
  sessionId = DEFAULT_SESSION_ID,
  limit = 16
) {
  return buildChatHistoryContext(sessionId, limit);
}

export const chatHistory = runtimeChatHistory;

export default getChatHistory;