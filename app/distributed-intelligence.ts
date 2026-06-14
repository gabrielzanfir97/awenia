import {
  Agents,
  AgentDefinition,
  AgentName,
  AgentStatus,
  findBestAgentsForTask,
  getAgentState,
} from "./agents";

import {
  communicateBetweenAgents,
  createAgentBroadcast,
  getAgentCommunicationStats,
} from "./agent-communication";

import { runReasoningNetwork } from "./reasoning-network";

export type DistributedTaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed";

export type DistributedTask = {
  id: string;
  task: string;
  assignedAgent: AgentName;
  status: DistributedTaskStatus;
  priority: number;
  result?: string;
  confidence?: number;
  startedAt?: string;
  completedAt?: string;
};

export type DistributedIntelligenceResult = {
  status: AgentStatus | "partial";
  distributionId: string;
  originalTask: string;
  reasoning: any;
  selectedAgents: AgentDefinition[];
  tasks: DistributedTask[];
  results: DistributedTask[];
  agentState: ReturnType<typeof getAgentState>;
  communicationStats: ReturnType<typeof getAgentCommunicationStats>;
  confidence: number;
  success: boolean;
  messages: string[];
  startedAt: string;
  completedAt?: string;
  timestamp: string;
};

function createDistributionId() {
  return `distribution_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createTaskId(agentId: string, index: number) {
  return `task_${agentId}_${index + 1}_${Date.now()}`;
}

function calculateConfidence(tasks: DistributedTask[]) {
  if (tasks.length === 0) return 0;

  const completed = tasks.filter((task) => task.status === "completed");
  const failed = tasks.filter((task) => task.status === "failed");

  const averageConfidence =
    tasks.reduce((sum, task) => sum + (task.confidence || 0), 0) /
    tasks.length;

  const completionBonus = (completed.length / tasks.length) * 30;
  const failurePenalty = failed.length * 15;

  return Math.max(
    0,
    Math.min(100, Math.round(averageConfidence * 70 + completionBonus - failurePenalty))
  );
}

function buildAgentSpecificTask(input: {
  originalTask: string;
  agent: AgentDefinition;
  reasoningConclusion?: string;
  recommendedAction?: string;
}) {
  return [
    `Distributed task for agent: ${input.agent.id}`,
    `Agent role: ${input.agent.role}`,
    `Agent capabilities: ${input.agent.capabilities.join(", ")}`,
    `Original task: ${input.originalTask}`,
    `Reasoning conclusion: ${input.reasoningConclusion || "not available"}`,
    `Recommended action: ${input.recommendedAction || "continue analysis"}`,
    `Return a clear result from this agent perspective.`,
  ].join("\n");
}

function buildDistributedTasks(
  _distributionId: string,
  originalTask: string,
  agents: AgentDefinition[],
  reasoning: any
): DistributedTask[] {
  const conclusion =
    reasoning?.reasoning?.finalConclusion ||
    reasoning?.reasoning?.recommendedAction ||
    "No reasoning conclusion";

  const recommendedAction =
    reasoning?.reasoning?.recommendedAction || "Continue distributed analysis";

  return agents.map((agent, index) => ({
    id: createTaskId(agent.id, index),
    task: buildAgentSpecificTask({
      originalTask,
      agent,
      reasoningConclusion: conclusion,
      recommendedAction,
    }),
    assignedAgent: agent.id as AgentName,
    status: "pending",
    priority: agent.priority,
  }));
}

function detectOverallStatus(tasks: DistributedTask[]) {
  const failed = tasks.filter((task) => task.status === "failed");
  const completed = tasks.filter((task) => task.status === "completed");

  if (tasks.length === 0) return "failed";
  if (failed.length === tasks.length) return "failed";
  if (failed.length > 0 && completed.length > 0) return "partial";
  if (completed.length === tasks.length) return "completed";

  return "active";
}

export async function runDistributedIntelligence(
  task = "Analyze current system state"
): Promise<DistributedIntelligenceResult> {
  const startedAt = new Date().toISOString();
  const distributionId = createDistributionId();
  const messages: string[] = [];

  try {
    const reasoning = await runReasoningNetwork({
      distributedTask: task,
      distributionId,
    });

    const reasoningText = [
      task,
      reasoning?.reasoning?.finalConclusion || "",
      reasoning?.reasoning?.recommendedAction || "",
      reasoning?.reasoning?.decision?.priority || "",
    ].join("\n");

    const selectedAgents = findBestAgentsForTask(reasoningText, 5);

    const finalAgents = selectedAgents.some(
      (agent) => agent.id === "orchestrator"
    )
      ? selectedAgents
      : [...selectedAgents, Agents.orchestrator];

    const tasks = buildDistributedTasks(
      distributionId,
      task,
      finalAgents,
      reasoning
    );

    await createAgentBroadcast(
      "orchestrator",
      `Starting distributed intelligence ${distributionId}`,
      8,
      "distributed_start",
      {
        distributionId,
        task,
        selectedAgents: finalAgents.map((agent) => agent.id),
      },
      finalAgents.map((agent) => agent.id),
      `Starting distributed intelligence ${distributionId}`,
      {
        distributionId,
        task,
        selectedAgents: finalAgents.map((agent) => agent.id),
      }
    );

    for (const distributedTask of tasks) {
      const agent = Agents[distributedTask.assignedAgent];

      if (!agent) {
        distributedTask.status = "failed";
        distributedTask.result = `Agent not found: ${distributedTask.assignedAgent}`;
        distributedTask.completedAt = new Date().toISOString();
        messages.push(distributedTask.result);
        continue;
      }

      distributedTask.status = "assigned";

      Agents.orchestrator.sendMessage();
      agent.receiveMessage();

      await communicateBetweenAgents(
        "orchestrator",
        distributedTask.assignedAgent,
        distributedTask.task,
        {
          distributionId,
          taskId: distributedTask.id,
        },
        "distributed_task",
        {
          distributionId,
          taskId: distributedTask.id,
        }
      );

      distributedTask.status = "running";
      distributedTask.startedAt = new Date().toISOString();

      const result = await agent.execute(
        distributedTask.task,
        distributionId
      );

      distributedTask.status =
        result.status === "completed" ? "completed" : "failed";

      distributedTask.result = result.result;
      distributedTask.confidence = result.confidence;
      distributedTask.completedAt = new Date().toISOString();

      agent.sendMessage();
      Agents.orchestrator.receiveMessage();

      await communicateBetweenAgents(
        distributedTask.assignedAgent,
        "orchestrator",
        result.result,
        {
          distributionId,
          taskId: distributedTask.id,
        },
        "distributed_result",
        {
          distributionId,
          taskId: distributedTask.id,
        }
      );

      agent.learn(
        `Distributed task ${distributedTask.id} ended with ${distributedTask.status}`
      );

      messages.push(`${agent.id}: ${result.result}`);
    }

    const confidence = calculateConfidence(tasks);
    const status = detectOverallStatus(tasks);

    return {
      status,
      distributionId,
      originalTask: task,
      reasoning,
      selectedAgents: finalAgents,
      tasks,
      results: tasks,
      agentState: getAgentState(),
      communicationStats: getAgentCommunicationStats(),
      confidence,
      success: status === "completed",
      messages,
      startedAt,
      completedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      distributionId,
      originalTask: task,
      reasoning: null,
      selectedAgents: [],
      tasks: [],
      results: [],
      agentState: getAgentState(),
      communicationStats: getAgentCommunicationStats(),
      confidence: 0,
      success: false,
      messages: [
        error?.message || "Unknown distributed intelligence error",
      ],
      startedAt,
      completedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
  }
}

export async function buildDistributedIntelligence(task?: string) {
  return runDistributedIntelligence(task);
}

export async function coordinateDistributedIntelligence(task?: string) {
  return runDistributedIntelligence(task);
}