import { Agents } from "./agents";

type AgentMessage = {
  from: string;
  to: string;
  message: string;
  timestamp: string;
  priority?: number;
};

const agentMessages: AgentMessage[] = [];

export function communicateBetweenAgents(
  from: keyof typeof Agents,
  to: keyof typeof Agents,
  message: string,
  priority = 5
) {
  const communication: AgentMessage = {
    from,
    to,
    message,
    priority,
    timestamp: new Date().toISOString(),
  };

  agentMessages.push(communication);

  if (agentMessages.length > 500) {
    agentMessages.shift();
  }

  return {
    ...communication,
    status: "sent",
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

export function getMessagesForAgent(
  agent: keyof typeof Agents
) {
  return agentMessages.filter(
    (msg) =>
      msg.to === agent ||
      msg.from === agent
  );
}

export function getHighPriorityMessages() {
  return agentMessages.filter(
    (msg) => (msg.priority || 0) >= 8
  );
}

export function getAgentCommunicationStats() {
  const stats: Record<string, number> = {};

  for (const msg of agentMessages) {
    stats[msg.from] =
      (stats[msg.from] || 0) + 1;
  }

  return {
    totalMessages: agentMessages.length,
    activeAgents: Object.keys(stats).length,
    stats,
  };
}

export function clearOldAgentMessages(
  maxMessages = 200
) {
  while (agentMessages.length > maxMessages) {
    agentMessages.shift();
  }

  return {
    remainingMessages:
      agentMessages.length,
  };
}