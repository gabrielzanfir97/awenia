import { Agents } from "./agents";

type AgentName = keyof typeof Agents;

type AgentMessageStatus = "sent" | "read" | "archived";

type AgentMessage = {
  id: string;
  from: AgentName;
  to: AgentName;
  topic: string;
  message: string;
  priority: number;
  status: AgentMessageStatus;
  metadata?: Record<string, any>;
  timestamp: string;
};

const agentMessages: AgentMessage[] = [];

function createMessageId() {
  return `agent_msg_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function communicateBetweenAgents(
  from: AgentName,
  to: AgentName,
  message: string,
  priority = 5,
  topic = "general",
  metadata: Record<string, any> = {}
) {
  const communication: AgentMessage = {
    id: createMessageId(),
    from,
    to,
    topic,
    message,
    priority,
    status: "sent",
    metadata,
    timestamp: new Date().toISOString(),
  };

  agentMessages.push(communication);

  if (agentMessages.length > 1000) {
    agentMessages.shift();
  }

  return {
    ...communication,
    result: "message_sent",
    totalMessages: agentMessages.length,
  };
}

export function getAgentMessages() {
  return [...agentMessages].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime()
  );
}

export function getMessagesForAgent(agent: AgentName) {
  return getAgentMessages().filter(
    (msg) => msg.to === agent || msg.from === agent
  );
}

export function getInboxForAgent(agent: AgentName) {
  return getAgentMessages().filter(
    (msg) => msg.to === agent && msg.status !== "archived"
  );
}

export function getHighPriorityMessages(minPriority = 8) {
  return getAgentMessages().filter(
    (msg) => msg.priority >= minPriority
  );
}

export function markAgentMessageRead(messageId: string) {
  const msg = agentMessages.find((m) => m.id === messageId);

  if (!msg) {
    return {
      status: "not_found",
      messageId,
    };
  }

  msg.status = "read";

  return {
    status: "read",
    messageId,
  };
}

export function archiveAgentMessage(messageId: string) {
  const msg = agentMessages.find((m) => m.id === messageId);

  if (!msg) {
    return {
      status: "not_found",
      messageId,
    };
  }

  msg.status = "archived";

  return {
    status: "archived",
    messageId,
  };
}

export function getAgentCommunicationStats() {
  const sentByAgent: Record<string, number> = {};
  const receivedByAgent: Record<string, number> = {};
  const topics: Record<string, number> = {};

  for (const msg of agentMessages) {
    sentByAgent[msg.from] = (sentByAgent[msg.from] || 0) + 1;
    receivedByAgent[msg.to] = (receivedByAgent[msg.to] || 0) + 1;
    topics[msg.topic] = (topics[msg.topic] || 0) + 1;
  }

  return {
    totalMessages: agentMessages.length,
    highPriorityMessages: getHighPriorityMessages().length,
    activeSenders: Object.keys(sentByAgent).length,
    activeReceivers: Object.keys(receivedByAgent).length,
    sentByAgent,
    receivedByAgent,
    topics,
  };
}

export function createAgentBroadcast(
  from: AgentName,
  message: string,
  priority = 5,
  topic = "broadcast",
  metadata: Record<string, any> = {}
) {
  const results = Object.keys(Agents)
    .filter((agent) => agent !== from)
    .map((agent) =>
      communicateBetweenAgents(
        from,
        agent as AgentName,
        message,
        priority,
        topic,
        metadata
      )
    );

  return {
    status: "broadcast_sent",
    from,
    receivers: results.length,
    results,
  };
}

export function clearOldAgentMessages(maxMessages = 300) {
  while (agentMessages.length > maxMessages) {
    agentMessages.shift();
  }

  return {
    status: "cleaned",
    remainingMessages: agentMessages.length,
  };
}