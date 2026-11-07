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
  | "failed"
  | "ready_for_review";

export type DistributedTask = {
  id: string;
  task: string;
  assignedAgent: AgentName;
  status: DistributedTaskStatus;
  priority: number;
  result?: string;
  proposal?: import("./self-coding-v6").CodingProposal;
  debugAnalysis?: import("./self-debug").DebugAnalysis;
  requiresApproval?: boolean;
  fileChanged?: boolean;
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
  if (tasks.some((task) => task.status === "ready_for_review")) {
    return "ready_for_review";
  }
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
    if (task.trim().startsWith("{")) {
      try {
        const codingInput = JSON.parse(task);
        if (
          codingInput &&
          typeof codingInput.filePath === "string" &&
          codingInput.filePath.trim() &&
          typeof codingInput.task === "string" &&
          codingInput.task.trim() &&
          !selectedAgents.some((agent) => agent.id === "coder")
        ) {
          const orchestratorIndex = selectedAgents.findIndex(
            (agent) => agent.id === "orchestrator"
          );
          if (orchestratorIndex >= 0) {
            selectedAgents.splice(orchestratorIndex, 1);
          } else if (selectedAgents.length >= 5) {
            selectedAgents.pop();
          }
          selectedAgents.push(Agents.coder);
        }
      } catch {
        // Invalid JSON does not force coder selection.
      }
    }

    const finalAgents = selectedAgents.some(
      (agent) => agent.id === "orchestrator"
    )
      ? [...selectedAgents.filter((agent) => agent.id !== "orchestrator"), Agents.orchestrator]
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
        distributedTask.assignedAgent === "orchestrator"
          ? `ORCHESTRATOR_FINALIZE_JSON:${JSON.stringify({
              workflowId: distributionId,
              steps: tasks
                .filter((item) => item.assignedAgent !== "orchestrator")
                .map((item) => ({
                  agentId: item.assignedAgent,
                  status: item.status,
                })),
            })}`
          : distributedTask.assignedAgent === "coder" &&
              task.trim().startsWith("{")
            ? `CODER_PROPOSAL_JSON:${task.trim()}`
            : distributedTask.assignedAgent === "researcher"
            ? `RESEARCH_QUERY:${task.slice(0, 300)}`
            : distributedTask.assignedAgent === "debugger"
              ? `DEBUG_ANALYSIS_TEXT:${task.slice(0, 4000)}`
              : distributedTask.assignedAgent === "memory"
                ? `MEMORY_SEARCH:${task.slice(0, 300)}`
                :
        distributedTask.task,
        distributionId
      );

      distributedTask.status =
        result.status === "completed"
          ? "completed"
          : result.status === "ready_for_review" &&
              distributedTask.assignedAgent === "coder" &&
              result.proposal &&
              result.fileChanged === false &&
              result.requiresApproval === true
            ? "ready_for_review"
            : "failed";

      distributedTask.result = result.result;
      distributedTask.proposal = result.proposal;
      distributedTask.debugAnalysis = result.debugAnalysis;
      distributedTask.requiresApproval = result.requiresApproval;
      distributedTask.fileChanged = result.fileChanged;
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

      if (distributedTask.status === "ready_for_review") {
        messages.push(
          "Workflow stopped at ready_for_review. Gabi approval is required before further execution."
        );
        break;
      }
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