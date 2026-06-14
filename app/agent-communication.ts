import {
  createAutonomousReflection,
  createEvolutionSuggestion,
} from "./memory-store";

export type AgentMessageStatus =
  | "sent"
  | "received"
  | "read"
  | "archived"
  | "blocked"
  | "failed";

export type AgentMessageType =
  | "info"
  | "request"
  | "response"
  | "warning"
  | "decision"
  | "task"
  | "reflection"
  | "error";

export type AgentMessagePriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AgentMessage = {
  id: string;
  from: string;
  to: string;
  type: AgentMessageType;
  priority: AgentMessagePriority;
  content: string;
  metadata?: any;
  status: AgentMessageStatus;
  createdAt: string;
  readAt?: string;
};

export type AgentChannel = {
  id: string;
  agents: string[];
  topic: string;
  messages: AgentMessage[];
  createdAt: string;
};

const runtimeMessages: AgentMessage[] = [];
const runtimeChannels: AgentChannel[] = [];

function now() {
  return new Date().toISOString();
}

function createId(prefix = "agent_message") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function detectPriority(content = ""): AgentMessagePriority {
  const lower = normalize(content);

  if (
    lower.includes("critical") ||
    lower.includes("blocked") ||
    lower.includes(".env") ||
    lower.includes("security") ||
    lower.includes("protected-core")
  ) {
    return "critical";
  }

  if (
    lower.includes("error") ||
    lower.includes("build") ||
    lower.includes("failed") ||
    lower.includes("route.ts") ||
    lower.includes("memory-store")
  ) {
    return "high";
  }

  if (
    lower.includes("code") ||
    lower.includes("memory") ||
    lower.includes("debug") ||
    lower.includes("evolution")
  ) {
    return "medium";
  }

  return "low";
}

function detectType(content = ""): AgentMessageType {
  const lower = normalize(content);

  if (lower.includes("error") || lower.includes("failed")) return "error";
  if (lower.includes("warning") || lower.includes("risk")) return "warning";
  if (lower.includes("decision")) return "decision";
  if (lower.includes("task")) return "task";
  if (lower.includes("reflection")) return "reflection";
  if (lower.includes("request") || lower.includes("please")) return "request";
  if (lower.includes("response") || lower.includes("result")) return "response";

  return "info";
}

function isBlockedMessage(message: AgentMessage) {
  const text = normalize(
    `${message.from} ${message.to} ${message.content}`
  );

  return (
    text.includes(".env") ||
    text.includes("private_key") ||
    text.includes("service_role") ||
    text.includes("delete all") ||
    text.includes("rm -rf")
  );
}

export function createAgentMessage(input: {
  from: string;
  to: string;
  content: string;
  type?: AgentMessageType;
  priority?: AgentMessagePriority;
  metadata?: any;
}): AgentMessage {
  const message: AgentMessage = {
    id: createId(),
    from: input.from || "unknown",
    to: input.to || "unknown",
    type: input.type || detectType(input.content),
    priority: input.priority || detectPriority(input.content),
    content: input.content,
    metadata: input.metadata || {},
    status: "sent",
    createdAt: now(),
  };

  if (isBlockedMessage(message)) {
    message.status = "blocked";
  }

  return message;
}

export async function sendAgentMessage(
  from: string,
  to: string,
  content: string,
  metadata: any = {}
) {
  const message = createAgentMessage({
    from,
    to,
    content,
    metadata,
  });

  if (message.status !== "blocked") {
    runtimeMessages.unshift(message);
  }

  if (
    message.priority === "high" ||
    message.priority === "critical" ||
    message.type === "error"
  ) {
    try {
      await createAutonomousReflection(
        `Agent message: ${from} -> ${to}`,
        content,
        message.priority === "critical"
          ? "Critical agent message requires Gabi review."
          : "Important agent message saved for awareness."
      );
    } catch { }
  }

  if (message.status === "blocked") {
    try {
      await createEvolutionSuggestion({
        suggestion: "Review blocked agent communication",
        reason: content,
        priority: 9,
        status: "pending",
        metadata: {
          from,
          to,
          source: "agent-communication",
        },
      });
    } catch { }
  }

  return {
    status: message.status,
    message,
    savedRuntime: message.status !== "blocked",
    timestamp: now(),
  };
}

export async function broadcastAgentMessage(
  from: string,
  agents: string[],
  content: string,
  metadata: any = {}
) {
  const results = [];

  for (const agent of agents) {
    if (agent !== from) {
      results.push(
        await sendAgentMessage(from, agent, content, metadata)
      );
    }
  }

  return {
    status: "sent",
    from,
    agents,
    results,
    count: results.length,
    timestamp: now(),
  };
}

export function getAgentMessages(options?: {
  from?: string;
  to?: string;
  type?: AgentMessageType;
  status?: AgentMessageStatus;
  limit?: number;
}) {
  const limit = options?.limit || 50;

  const messages = runtimeMessages
    .filter((message) => {
      if (options?.from && message.from !== options.from) return false;
      if (options?.to && message.to !== options.to) return false;
      if (options?.type && message.type !== options.type) return false;
      if (options?.status && message.status !== options.status) return false;

      return true;
    })
    .slice(0, limit);

  return {
    status: "received",
    messages,
    count: messages.length,
    timestamp: now(),
  };
}

export function getAgentInbox(agentName: string, limit = 30) {
  return getAgentMessages({
    to: agentName,
    limit,
  });
}

export function getAgentOutbox(agentName: string, limit = 30) {
  return getAgentMessages({
    from: agentName,
    limit,
  });
}

export function markAgentMessageRead(messageId: string) {
  const message = runtimeMessages.find((item) => item.id === messageId);

  if (!message) {
    return {
      status: "failed" as AgentMessageStatus,
      error: "Agent message not found",
      timestamp: now(),
    };
  }

  message.status = "read";
  message.readAt = now();

  return {
    status: "read" as AgentMessageStatus,
    message,
    timestamp: now(),
  };
}

export function archiveAgentMessage(messageId: string) {
  const message = runtimeMessages.find((item) => item.id === messageId);

  if (!message) {
    return {
      status: "failed" as AgentMessageStatus,
      error: "Agent message not found",
      timestamp: now(),
    };
  }

  message.status = "archived";

  return {
    status: "archived" as AgentMessageStatus,
    message,
    timestamp: now(),
  };
}

export function createAgentChannel(
  agents: string[],
  topic = "general"
) {
  const channel: AgentChannel = {
    id: createId("agent_channel"),
    agents,
    topic,
    messages: [],
    createdAt: now(),
  };

  runtimeChannels.unshift(channel);

  return {
    status: "sent",
    channel,
    timestamp: now(),
  };
}

export async function sendChannelMessage(
  channelId: string,
  from: string,
  content: string,
  metadata: any = {}
) {
  const channel = runtimeChannels.find((item) => item.id === channelId);

  if (!channel) {
    return {
      status: "failed" as AgentMessageStatus,
      error: "Agent channel not found",
      timestamp: now(),
    };
  }

  const recipients = channel.agents.filter((agent) => agent !== from);

  const broadcast = await broadcastAgentMessage(
    from,
    recipients,
    content,
    {
      ...metadata,
      channelId,
      topic: channel.topic,
    }
  );

  channel.messages.push(
    ...broadcast.results
      .map((result: any) => result.message)
      .filter(Boolean)
  );

  return {
    status: "sent" as AgentMessageStatus,
    channel,
    broadcast,
    timestamp: now(),
  };
}

export function getAgentChannels() {
  return {
    status: "received",
    channels: runtimeChannels,
    count: runtimeChannels.length,
    timestamp: now(),
  };
}

export function getAgentChannel(channelId: string) {
  const channel = runtimeChannels.find((item) => item.id === channelId);

  return {
    status: channel ? "received" : "failed",
    channel: channel || null,
    timestamp: now(),
  };
}

export function clearAgentMessages() {
  const count = runtimeMessages.length;

  runtimeMessages.splice(0, runtimeMessages.length);

  return {
    status: "archived",
    cleared: count,
    timestamp: now(),
  };
}

export function clearAgentChannels() {
  const count = runtimeChannels.length;

  runtimeChannels.splice(0, runtimeChannels.length);

  return {
    status: "archived",
    cleared: count,
    timestamp: now(),
  };
}

export function buildAgentCommunicationContext(limit = 20) {
  const messages = runtimeMessages.slice(0, limit);

  if (!messages.length) {
    return "Nu există mesaje recente între agenți.";
  }

  return messages
    .map((message, index) => {
      return [
        `${index + 1}. ${message.from} -> ${message.to}`,
        `Type: ${message.type}`,
        `Priority: ${message.priority}`,
        `Status: ${message.status}`,
        `Content: ${message.content}`,
      ].join("\n");
    })
    .join("\n\n");
}

export function getAgentCommunicationState() {
  return {
    status: "received",
    messages: runtimeMessages.length,
    channels: runtimeChannels.length,
    blockedMessages: runtimeMessages.filter(
      (message) => message.status === "blocked"
    ).length,
    highPriorityMessages: runtimeMessages.filter(
      (message) =>
        message.priority === "high" ||
        message.priority === "critical"
    ).length,
    truthPolicy: {
      runtimeCommunicationIsNotPermanentMemory: true,
      blockedMessagesAreNotDelivered: true,
      noAgentCanBypassGabiApproval: true,
    },
    timestamp: now(),
  };
}

export async function runAgentCommunication(input?: {
  from?: string;
  to?: string;
  content?: string;
}) {
  if (input?.from && input?.to && input?.content) {
    return sendAgentMessage(
      input.from,
      input.to,
      input.content
    );
  }

  return {
    status: "received",
    state: getAgentCommunicationState(),
    context: buildAgentCommunicationContext(),
    timestamp: now(),
  };
}

export const sendMessageToAgent = sendAgentMessage;
export const broadcastToAgents = broadcastAgentMessage;
export const getMessagesForAgent = getAgentInbox;
export const getAgentCommunicationContext = buildAgentCommunicationContext;
export const agentCommunication = runAgentCommunication;

export default runAgentCommunication;

export async function communicateBetweenAgents(
  from: string, to: string, content: string, metadata: any = {}, p0: string, p1: { distributionId: string; taskId: string; }) {
  return sendAgentMessage(from, to, content, metadata);
}

export async function createAgentBroadcast(
  from: string, p0: string, p1: number, p2: string, p3: { distributionId: string; task: string; selectedAgents: string[]; }, agents: string[], content: string, metadata: any = {}) {
  return broadcastAgentMessage(from, agents, content, metadata);
}

export function getAgentCommunicationStats() {
  return {
    status: "received",
    totalMessages: runtimeMessages.length,
    totalChannels: runtimeChannels.length,
    blockedMessages: runtimeMessages.filter(
      (message) => message.status === "blocked"
    ).length,
    highPriorityMessages: runtimeMessages.filter(
      (message) =>
        message.priority === "high" ||
        message.priority === "critical"
    ).length,
    timestamp: now(),
  };
}