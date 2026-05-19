import { Agents } from "./agents";

export function communicateBetweenAgents(
  from: keyof typeof Agents,
  to: keyof typeof Agents,
  message: string
) {
  return {
    from,
    to,
    message,
    timestamp: new Date().toISOString(),
    status: "sent",
  };
}