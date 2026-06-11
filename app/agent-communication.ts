import { Agents } from "./agents";

const agentMessages: {
  from: string;
  to: string;
  message: string;
  timestamp: string;
}[] = [];

export function communicateBetweenAgents(
  from: keyof typeof Agents,
  to: keyof typeof Agents,
  message: string
) {
  const communication = {
    from,
    to,
    message,
    timestamp: new Date().toISOString(),
  };

  agentMessages.push(communication);

  if (agentMessages.length > 100) {
    agentMessages.shift();
  }

  return {
    ...communication,
    status: "sent",
    totalMessages: agentMessages.length,
  };
}

export function getAgentMessages() {
  return agentMessages;
}

export function getMessagesForAgent(
  agent: keyof typeof Agents
) {
  return agentMessages.filter(
    (msg) => msg.to === agent
  );
}