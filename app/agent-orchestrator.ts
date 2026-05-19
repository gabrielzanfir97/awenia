import { Agents } from "./agents";

export function coordinateAgents(taskType: string) {
  if (taskType === "debug") {
    return {
      activeAgents: [
        Agents.debugger,
        Agents.coder,
        Agents.orchestrator,
      ],
      workflow: [
        "Analyze error",
        "Generate fix",
        "Validate patch",
      ],
    };
  }

  if (taskType === "memory") {
    return {
      activeAgents: [
        Agents.memory,
        Agents.researcher,
        Agents.orchestrator,
      ],
      workflow: [
        "Analyze memory",
        "Optimize storage",
        "Save improvements",
      ],
    };
  }

  if (taskType === "upgrade") {
    return {
      activeAgents: [
        Agents.researcher,
        Agents.planner,
        Agents.coder,
        Agents.orchestrator,
      ],
      workflow: [
        "Research best practice",
        "Plan upgrade",
        "Generate patch",
        "Validate safety",
      ],
    };
  }

  return {
    activeAgents: [
      Agents.planner,
      Agents.orchestrator,
    ],
    workflow: [
      "Analyze request",
      "Coordinate execution",
    ],
  };
}