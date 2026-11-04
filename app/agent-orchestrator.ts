import {
  Agents,
  AgentDefinition,
  AgentName,
  AgentStatus,
  findBestAgentsForTask,
  getAgentState,
} from "./agents";

import {
  sendAgentMessage,
  broadcastAgentMessage,
  getAgentCommunicationState,
  getAgentCommunicationStats,
} from "./agent-communication";

export type AgentWorkflowStep = {
  step: number;
  workflowId: string;
  agentId: AgentName;
  task: string;
  status: AgentStatus;
  result?: string;
  confidence?: number;
  startedAt?: string;
  completedAt?: string;
};

export type AgentWorkflowResult = {
  workflowId: string;
  taskType: string;
  taskGoal: string;
  activeAgents: AgentDefinition[];
  workflow: string[];
  steps: AgentWorkflowStep[];
  messages: string[];
  agentState: ReturnType<typeof getAgentState>;
  communicationStats: ReturnType<typeof getAgentCommunicationStats>;
  status: AgentStatus;
  success: boolean;
  confidence: number;
  startedAt: string;
  completedAt?: string;
};

function createWorkflowId() {
  return `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function buildTaskGoal(taskType: string, taskDetail = "") {
  const cleanType = normalize(taskType);
  const cleanDetail = taskDetail.trim();

  const capabilityHints: Record<string, string> = {
    debug:
      "debugging error_analysis fix_suggestion bug build_error typescript_error coding validation",
    coding:
      "coding code_review implementation typescript javascript nextjs supabase patching validation",
    memory:
      "memory recall summaries ranking compression permanent_memory context",
    upgrade:
      "research learning upgrade_detection planning workflow implementation safety approval",
    goal:
      "goal planning strategy next_action memory context coordination",
    monitor:
      "coordination workflow_execution agent_control safety validation monitoring",
    research:
      "research internet knowledge source_checking learning upgrade_detection",
    planning:
      "planning workflow task_breakdown strategy goal next_action",
  };

  const inferred =
    capabilityHints[cleanType] ||
    `${cleanType} planning coordination workflow_execution`;

  return [
    `Task type: ${taskType}`,
    `Task detail: ${cleanDetail || "No extra detail provided"}`,
    `Needed capabilities: ${inferred}`,
  ].join("\n");
}

function ensureOrchestratorLast(agents: AgentDefinition[]) {
  const withoutDuplicates = agents.filter(
    (agent, index, all) => all.findIndex((item) => item.id === agent.id) === index
  );

  // The orchestration step belongs at the end of every workflow.
  return [
    ...withoutDuplicates.filter((agent) => agent.id !== "orchestrator"),
    Agents.orchestrator,
  ];
}

function buildAgentTask(
  agent: AgentDefinition,
  taskType: string,
  taskGoal: string,
  index: number,
  total: number
) {
  const position =
    index === 0
      ? "first"
      : index === total - 1
        ? "final"
        : "middle";

  return [
    `Workflow task type: ${taskType}`,
    `Agent role: ${agent.role}`,
    `Agent position: ${position}`,
    `Use capabilities: ${agent.capabilities.join(", ")}`,
    `Goal: ${taskGoal}`,
    `Return a clear execution result for this step.`,
  ].join("\n");
}

function calculateWorkflowConfidence(steps: AgentWorkflowStep[]) {
  if (steps.length === 0) return 0;

  const confidenceValues = steps.map((step) => step.confidence || 0.5);
  const total = confidenceValues.reduce((sum, value) => sum + value, 0);

  return Number((total / confidenceValues.length).toFixed(2));
}

export function coordinateAgents(
  taskType: string,
  taskDetail = ""
): AgentWorkflowResult {
  const workflowId = createWorkflowId();
  const taskGoal = buildTaskGoal(taskType, taskDetail);

  const selectedAgents = ensureOrchestratorLast(
    findBestAgentsForTask(taskGoal, 4)
  );

  const steps: AgentWorkflowStep[] = selectedAgents.map((agent, index) => ({
    step: index + 1,
    workflowId,
    agentId: agent.id as AgentName,
    task: buildAgentTask(agent, taskType, taskGoal, index, selectedAgents.length),
    status: "idle",
  }));

  return {
    workflowId,
    taskType,
    taskGoal,
    activeAgents: selectedAgents,
    workflow: steps.map((step) => step.task),
    steps,
    messages: [],
    agentState: getAgentState(),
    communicationStats: getAgentCommunicationStats(),
    status: "idle",
    success: false,
    confidence: 0,
    startedAt: new Date().toISOString(),
  };
}

export async function prepareCoderProposal(
  filePath: string,
  task: string
): Promise<{
  agentId: "coder";
  status: "ready_for_review" | "failed";
  proposal?: import("./self-coding-v6").CodingProposal;
  error?: string;
  fileChanged: false;
  requiresApproval: true;
}> {
  try {
    if (!filePath.trim() || !task.trim()) {
      throw new Error("File path and coding task are required.");
    }

    const executed = await Agents.coder.execute(
      `CODER_PROPOSAL_JSON:${JSON.stringify({ filePath, task })}`
    );
    if (executed.status !== "ready_for_review" || !executed.proposal) {
      throw new Error(executed.result || "Coder proposal generation failed.");
    }
    const proposal = executed.proposal;

    if (
      proposal.status !== "ready_for_review" ||
      proposal.fileChanged !== false ||
      proposal.requiresApproval !== true
    ) {
      throw new Error("Coding proposal failed safety validation.");
    }

    return {
      agentId: "coder",
      status: "ready_for_review",
      proposal,
      fileChanged: false,
      requiresApproval: true,
    };
  } catch (error: unknown) {
    return {
      agentId: "coder",
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      fileChanged: false,
      requiresApproval: true,
    };
  }
}

export async function prepareDebuggerAnalysis(errorText: string): Promise<{
  agentId: "debugger";
  status: "analyzed" | "failed";
  analysis?: import("./self-debug").DebugAnalysis;
  error?: string;
  fileChanged: false;
}> {
  try {
    const executed = await Agents.debugger.execute(`DEBUG_ANALYSIS_TEXT:${errorText}`);
    if (executed.status !== "completed" || !executed.debugAnalysis) {
      throw new Error(executed.result || "Debugger analysis failed.");
    }
    return {
      agentId: "debugger", status: "analyzed",
      analysis: executed.debugAnalysis, fileChanged: false,
    };
  } catch (error: unknown) {
    return {
      agentId: "debugger", status: "failed",
      error: error instanceof Error ? error.message : String(error),
      fileChanged: false,
    };
  }
}

export async function executeAgentWorkflow(
  taskType: string,
  taskDetail = ""
): Promise<AgentWorkflowResult> {
  const workflow = coordinateAgents(taskType, taskDetail);

  workflow.status = "active";

  const startBroadcast = await broadcastAgentMessage(
    "orchestrator",
    workflow.activeAgents.map((agent) => agent.id),
    `Starting workflow ${workflow.workflowId} for task type: ${taskType}`,
    {
      workflowId: workflow.workflowId,
      taskType,
      taskGoal: workflow.taskGoal,
    }
  );
  if (
    startBroadcast.status !== "sent" ||
    startBroadcast.results.some((item) => item.status !== "sent")
  ) {
    throw new Error("Workflow broadcast failed or was blocked");
  }

  for (const step of workflow.steps) {
    const agent = Agents[step.agentId];

    if (!agent) {
      step.status = "failed";
      step.result = `Agent not found: ${step.agentId}`;
      step.completedAt = new Date().toISOString();

      workflow.messages.push(step.result);
      workflow.status = "failed";
      workflow.success = false;
      workflow.completedAt = new Date().toISOString();
      workflow.agentState = getAgentState();
      workflow.communicationStats = getAgentCommunicationStats();

      return workflow;
    }

    step.status = "active";
    step.startedAt = new Date().toISOString();

    Agents.orchestrator.sendMessage();
    agent.receiveMessage();

    await communicateBetweenAgents(
      "orchestrator",
      step.agentId,
      `Execute workflow step ${step.step}: ${step.task}`,
      agent.priority,
      "workflow_step",
      {
        workflowId: workflow.workflowId,
        taskType,
        step: step.step,
      }
    );

    const result = await agent.execute(step.task, workflow.workflowId);

    step.status = result.status;
    step.result = result.result;
    step.confidence = result.confidence;
    step.completedAt = new Date().toISOString();

    agent.sendMessage();
    Agents.orchestrator.receiveMessage();

    await communicateBetweenAgents(
      step.agentId,
      "orchestrator",
      result.result,
      agent.priority,
      "workflow_result",
      {
        workflowId: workflow.workflowId,
        taskType,
        step: step.step,
        status: result.status,
        confidence: result.confidence,
      }
    );

    agent.learn(
      `Workflow ${taskType} step ${step.step} finished with status ${result.status}`
    );

    workflow.messages.push(`${result.agentId}: ${result.result}`);

    if (result.status !== "completed") {
      workflow.status = result.status;
      workflow.success = false;
      workflow.confidence = calculateWorkflowConfidence(workflow.steps);
      workflow.completedAt = new Date().toISOString();
      workflow.agentState = getAgentState();
      workflow.communicationStats = getAgentCommunicationStats();

      return workflow;
    }
  }

  workflow.status = "completed";
  workflow.success = true;
  workflow.confidence = calculateWorkflowConfidence(workflow.steps);
  workflow.completedAt = new Date().toISOString();
  workflow.agentState = getAgentState();
  workflow.communicationStats = getAgentCommunicationStats();

  await createAgentBroadcast(
    "orchestrator",
    `Workflow ${workflow.workflowId} completed with confidence ${workflow.confidence}`,
    7,
    "workflow_completed",
    {
      workflowId: workflow.workflowId,
      taskType,
      confidence: workflow.confidence,
      success: workflow.success,
    }
  );

  return workflow;
}

async function communicateBetweenAgents(
  from: string,
  to: string | string[],
  message: string,
  priority: number,
  type: string,
  meta: Record<string, any>
) {
  if (Array.isArray(to) || to === "all") {
    const recipients = Array.isArray(to) ? to : Object.keys(Agents);
    const result = await broadcastAgentMessage(from, recipients, message, {
      priority, type, meta,
    });
    if (result.status !== "sent" || result.results.some((entry) => entry.status !== "sent")) {
      throw new Error("Agent broadcast failed or was blocked");
    }
    return;
  }

  const result = await sendAgentMessage(from, to, message, {
    priority, type, meta,
  });
  if (result.status !== "sent" || result.savedRuntime !== true) {
    throw new Error(`Agent message was not delivered to ${to}`);
  }
}

async function createAgentBroadcast(
  from: string,
  message: string,
  priority: number,
  type: string,
  meta: { workflowId: string; taskType: string; confidence: number; success: boolean }
) {
  const recipients = Object.keys(Agents);
  const result = await broadcastAgentMessage(from, recipients, message, {
    priority, type, meta,
  });
  if (result.status !== "sent" || result.results.some((entry) => entry.status !== "sent")) {
    throw new Error("Final agent broadcast failed or was blocked");
  }
}
