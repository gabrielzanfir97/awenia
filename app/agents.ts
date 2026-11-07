export type AgentStatus =
  | "idle"
  | "active"
  | "completed"
  | "ready_for_review"
  | "failed"
  | "cooldown";

export type AgentExecutionResult = {
  agentId: string;
  status: AgentStatus;
  task: string;
  result: string;
  confidence: number;
  timestamp: string;
  proposal?: import("./self-coding-v6").CodingProposal;
  debugAnalysis?: import("./self-debug").DebugAnalysis;
  fileChanged?: false;
  requiresApproval?: boolean;
};

export type AgentMemory = {
  lastTask?: string;
  lastResult?: string;
  lastError?: string;
  lastRunAt?: string;
  activeWorkflowId?: string;
  runs: number;
  failures: number;
  successes: number;
  messagesSent: number;
  messagesReceived: number;
  learnedPatterns: string[];
};

export type AgentSnapshot = {
  id: string;
  role: string;
  priority: number;
  status: AgentStatus;
  capabilities: string[];
  confidence: number;
  successRate: number;
  memory: AgentMemory;
};

export type AgentDefinition = {
  id: string;
  role: string;
  priority: number;
  status: AgentStatus;
  capabilities: string[];
  confidence: number;
  memory: AgentMemory;

  canHandle: (task: string) => boolean;
  execute: (task: string, workflowId?: string) => Promise<AgentExecutionResult>;
  learn: (pattern: string) => void;
  reflect: () => string;
  receiveMessage: () => void;
  sendMessage: () => void;
  getSnapshot: () => AgentSnapshot;
};

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function matchesCapability(task: string, capability: string) {
  const normalizedTask = normalize(task);
  const normalizedCapability = normalize(capability);
  return normalizedTask.includes(normalizedCapability) ||
    normalizedTask.includes(normalizedCapability.replace(/_/g, " "));
}

function calculateSuccessRate(memory: AgentMemory) {
  if (memory.runs === 0) return 0;
  return memory.successes / memory.runs;
}

function calculateConfidence(memory: AgentMemory) {
  const successRate = calculateSuccessRate(memory);
  const experienceBonus = Math.min(memory.runs * 0.02, 0.2);
  const failurePenalty = Math.min(memory.failures * 0.05, 0.3);

  return Math.max(
    0.1,
    Math.min(1, successRate + experienceBonus - failurePenalty)
  );
}

function createAgent(
  id: string,
  role: string,
  priority: number,
  capabilities: string[]
): AgentDefinition {
  const memory: AgentMemory = {
    runs: 0,
    failures: 0,
    successes: 0,
    messagesSent: 0,
    messagesReceived: 0,
    learnedPatterns: [],
  };

  const agent: AgentDefinition = {
    id,
    role,
    priority,
    status: "idle",
    capabilities,
    confidence: 0.5,
    memory,

    canHandle(task: string) {
      const lowerTask = normalize(task);

      return this.capabilities.some((capability) =>
        matchesCapability(lowerTask, capability)
      );
    },

    async execute(task: string, workflowId?: string) {
      this.status = "active";
      this.memory.lastTask = task;
      this.memory.lastRunAt = new Date().toISOString();
      this.memory.activeWorkflowId = workflowId;
      this.memory.runs += 1;

      try {
        // Explicit commands only: regular autonomy workflow text is never code execution.
        if (this.id === "planner") {
          const { buildTaskPlanPreview } = await import("./task-planner");
          const plan = buildTaskPlanPreview(task);
          const blocked = plan.risk === "critical";

          const result =
            `Planner generated a real task plan preview: ${JSON.stringify(plan)}. ` +
            "No workflow steps executed. No files changed.";

          this.status = blocked ? "failed" : "completed";

          if (blocked) {
            this.memory.failures += 1;
            this.memory.lastError = "Critical task blocked by Planner.";
          } else {
            this.memory.successes += 1;
            this.memory.lastError = undefined;
          }

          this.memory.lastResult = result;
          this.confidence = calculateConfidence(this.memory);

          return {
            agentId: this.id,
            status: this.status,
            task,
            result,
            confidence: this.confidence,
            fileChanged: false,
            requiresApproval: plan.requiresApproval,
            timestamp: new Date().toISOString(),
          };
        }

        if (this.id === "memory") {
          const { searchMemories, getRecentMemories } =
            await import("./memory-store");

          const prefix = "MEMORY_SEARCH:";
          const explicitSearch = task.startsWith(prefix);
          const query = explicitSearch
            ? task.slice(prefix.length).trim()
            : "";

          if (explicitSearch && !query) {
            throw new Error("Memory search requires a query.");
          }

          const memories = explicitSearch
            ? await searchMemories(query, 5)
            : await getRecentMemories(5);

          const records = memories.map((memory) => ({
            category: memory.category,
            content: memory.user_message.slice(0, 300),
            createdAt: memory.created_at,
          }));

          const result = JSON.stringify({
            operation: explicitSearch ? "memory_search" : "recent_memories",
            query,
            records,
            count: records.length,
            source: "memory-store",
            supabaseConnectionVerified: false,
            fileChanged: false,
            note:
              "Read-only memory retrieval. Database availability is not verified by this operation.",
          });

          this.status = "completed";
          this.memory.successes += 1;
          this.memory.lastResult = result;
          this.memory.lastError = undefined;
          this.confidence = calculateConfidence(this.memory);

          return {
            agentId: this.id,
            status: this.status,
            task,
            result,
            confidence: this.confidence,
            fileChanged: false,
            timestamp: new Date().toISOString(),
          };
        }

        if (this.id === "researcher" && task.startsWith("RESEARCH_QUERY:")) {
          const query = task.slice("RESEARCH_QUERY:".length).trim();

          if (!query || query.length > 300) {
            throw new Error("Researcher requires a valid search query.");
          }

          const { searchAndLearn } = await import("./internet-learning");

          const research = await searchAndLearn(query);
          const searchSucceeded = research.status === "connected";

          const result = JSON.stringify({
            operation: "internet_research",
            query,
            searchStatus: research.status,
            searchResult: JSON.stringify(research.result || {}).slice(0, 5000),
            source: "internet-learning",
            knowledgeSaved: false,
            fileChanged: false,
            note:
              "Internet search performed. Results require source verification before factual claims.",
          });

          this.status = searchSucceeded ? "completed" : "failed";

          if (searchSucceeded) {
            this.memory.successes += 1;
            this.memory.lastError = undefined;
          } else {
            this.memory.failures += 1;
            this.memory.lastError = result;
          }

          this.memory.lastResult = result;
          this.confidence = calculateConfidence(this.memory);

          return {
            agentId: this.id,
            status: this.status,
            task,
            result,
            confidence: this.confidence,
            fileChanged: false,
            timestamp: new Date().toISOString(),
          };
        }

        if (
          this.id === "orchestrator" &&
          task.startsWith("ORCHESTRATOR_FINALIZE_JSON:")
        ) {
          const raw = task.slice("ORCHESTRATOR_FINALIZE_JSON:".length);
          const parsed: unknown = JSON.parse(raw);

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Invalid orchestration request.");
          }

          const request = parsed as Record<string, unknown>;

          if (
            typeof request.workflowId !== "string" ||
            !request.workflowId.trim() ||
            !Array.isArray(request.steps) ||
            request.steps.length === 0 ||
            request.steps.length > 20
          ) {
            throw new Error("Invalid workflow summary.");
          }

          const valid = request.steps.every((item: unknown) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return false;
            }

            const step = item as Record<string, unknown>;

            return (
              typeof step.agentId === "string" &&
              step.agentId !== "orchestrator" &&
              step.status === "completed"
            );
          });

          if (!valid) {
            throw new Error(
              "Cannot finalize workflow with incomplete agent steps."
            );
          }

          const result =
            `Orchestrator finalized ${request.steps.length} reported completed ` +
            `agent steps for workflow ${request.workflowId}. ` +
            "No additional actions executed.";

          this.status = "completed";
          this.memory.successes += 1;
          this.memory.lastResult = result;
          this.memory.lastError = undefined;
          this.confidence = calculateConfidence(this.memory);

          return {
            agentId: this.id,
            status: this.status,
            task,
            result,
            confidence: this.confidence,
            fileChanged: false,
            timestamp: new Date().toISOString(),
          };
        }

        if (this.id === "coder" && task.startsWith("CODER_PROPOSAL_JSON:")) {
          const raw = task.slice("CODER_PROPOSAL_JSON:".length);
          const request: unknown = JSON.parse(raw);
          if (!request || typeof request !== "object" || Array.isArray(request)) {
            throw new Error("Invalid coder proposal request.");
          }
          const fields = request as Record<string, unknown>;
          if (typeof fields.filePath !== "string" ||
              typeof fields.task !== "string" ||
              !fields.filePath.trim() || !fields.task.trim()) {
            throw new Error("Coder requires an explicit file path and task.");
          }
          const { createCodingProposal } = await import("./self-coding-v6");
          const proposal = await createCodingProposal(fields.filePath, fields.task);
          if (proposal.status !== "ready_for_review" ||
              proposal.requiresApproval !== true || proposal.fileChanged !== false) {
            throw new Error("Unverified coding proposal result.");
          }
          const result = `Coding proposal ready for review: ${proposal.filePath}. No file changed.`;
          this.status = "ready_for_review";
          this.memory.successes += 1; // Proposal generation only, NOT patch application.
          this.memory.lastResult = result;
          this.memory.lastError = undefined;
          this.confidence = calculateConfidence(this.memory);
          return {
            agentId: this.id, status: this.status, task: fields.task,
            result, confidence: this.confidence, proposal,
            fileChanged: false, requiresApproval: true,
            timestamp: new Date().toISOString(),
          };
        }

        if (this.id === "debugger" && task.startsWith("DEBUG_ANALYSIS_TEXT:")) {
          const errorText = task.slice("DEBUG_ANALYSIS_TEXT:".length).trim();
          if (!errorText) throw new Error("Debugger requires real error text.");
          const { analyzeError } = await import("./self-debug");
          const debugAnalysis = analyzeError(errorText);
          if (debugAnalysis.status !== "analyzed") {
            throw new Error("Debugger could not analyze the supplied error.");
          }
          const result = `Debugger analyzed supplied error: ${debugAnalysis.errorType}. No fix applied.`;
          this.status = "completed"; // Error-text analysis was performed; not a code fix.
          this.memory.successes += 1;
          this.memory.lastResult = result;
          this.memory.lastError = undefined;
          this.confidence = calculateConfidence(this.memory);
          return {
            agentId: this.id, status: this.status, task: errorText,
            result, confidence: this.confidence, debugAnalysis,
            fileChanged: false,
            timestamp: new Date().toISOString(),
          };
        }

        const matchedCapabilities = this.capabilities.filter((capability) =>
          matchesCapability(task, capability)
        );

        const capabilityText =
          matchedCapabilities.length > 0
            ? matchedCapabilities.join(", ")
            : "general reasoning";

        const result =
          `Agent ${this.id} has no real task executor connected. ` +
          `Matched capabilities: ${capabilityText}. Task not executed: ${task}`;

        this.status = "failed";
        this.memory.failures += 1;
        this.memory.lastError = result;
        this.memory.lastResult = result;
        this.confidence = calculateConfidence(this.memory);

        return {
          agentId: this.id,
          status: this.status,
          task,
          result,
          confidence: this.confidence,
          timestamp: new Date().toISOString(),
        };
      } catch (error: any) {
        const errorMessage = error?.message || "Unknown agent error";

        this.status = "failed";
        this.memory.failures += 1;
        this.memory.lastError = errorMessage;
        this.memory.lastResult = errorMessage;
        this.confidence = calculateConfidence(this.memory);

        return {
          agentId: this.id,
          status: this.status,
          task,
          result: errorMessage,
          confidence: this.confidence,
          timestamp: new Date().toISOString(),
        };
      }
    },

    learn(pattern: string) {
      const cleanPattern = pattern.trim();

      if (!cleanPattern) return;

      if (!this.memory.learnedPatterns.includes(cleanPattern)) {
        this.memory.learnedPatterns.push(cleanPattern);
      }

      if (this.memory.learnedPatterns.length > 50) {
        this.memory.learnedPatterns.shift();
      }

      this.confidence = calculateConfidence(this.memory);
    },

    reflect() {
      const successRate = calculateSuccessRate(this.memory);

      if (this.memory.runs === 0) {
        return `${this.id} has not executed tasks yet.`;
      }

      if (successRate >= 0.8) {
        return `${this.id} is performing well with ${(successRate * 100).toFixed(
          0
        )}% success rate.`;
      }

      if (this.memory.failures > 0) {
        return `${this.id} needs improvement. Last error: ${this.memory.lastError || "unknown"
          }`;
      }

      return `${this.id} is learning from recent tasks.`;
    },

    receiveMessage() {
      this.memory.messagesReceived += 1;
    },

    sendMessage() {
      this.memory.messagesSent += 1;
    },

    getSnapshot() {
      return {
        id: this.id,
        role: this.role,
        priority: this.priority,
        status: this.status,
        capabilities: this.capabilities,
        confidence: this.confidence,
        successRate: calculateSuccessRate(this.memory),
        memory: { ...this.memory, learnedPatterns: [...this.memory.learnedPatterns] },
      };
    },
  };

  return agent;
}

export const Agents = {
  planner: createAgent(
    "planner",
    "Task planning and workflow generation",
    8,
    [
      "planning",
      "workflow",
      "task_breakdown",
      "strategy",
      "goal",
      "next_action",
    ]
  ),

  coder: createAgent(
    "coder",
    "Generate and improve code patches",
    9,
    [
      "coding",
      "patching",
      "typescript",
      "javascript",
      "nextjs",
      "supabase",
      "code_review",
      "implementation",
    ]
  ),

  debugger: createAgent(
    "debugger",
    "Analyze errors and suggest fixes",
    10,
    [
      "debugging",
      "error_analysis",
      "fix_suggestion",
      "bug",
      "build_error",
      "typescript_error",
    ]
  ),

  memory: createAgent(
    "memory",
    "Manage long-term memory and rankings",
    8,
    [
      "memory",
      "summaries",
      "ranking",
      "recall",
      "permanent_memory",
      "compression",
      "context",
    ]
  ),

  researcher: createAgent(
    "researcher",
    "Learn from internet and detect upgrades",
    7,
    [
      "research",
      "learning",
      "upgrade_detection",
      "internet",
      "knowledge",
      "source_checking",
    ]
  ),

  orchestrator: createAgent(
    "orchestrator",
    "Coordinate all agents together",
    10,
    [
      "coordination",
      "workflow_execution",
      "agent_control",
      "safety",
      "approval",
      "validation",
    ]
  ),
};

export type AgentName = keyof typeof Agents;

export function getAgentList() {
  return Object.values(Agents);
}

export function getAgentById(id: string) {
  return getAgentList().find((agent) => agent.id === id) || null;
}

export function getAgentState() {
  return getAgentList().map((agent) => agent.getSnapshot());
}

export function findBestAgentsForTask(task: string, limit = 3) {
  const ranked = getAgentList()
    .map((agent) => {
      const capabilityMatches = agent.capabilities.filter((capability) =>
        matchesCapability(task, capability)
      ).length;

      const statusScore =
        agent.status === "idle" || agent.status === "completed" ? 10 : 0;

      const successRate = calculateSuccessRate(agent.memory);

      const score =
        capabilityMatches * 30 +
        agent.priority * 5 +
        statusScore +
        successRate * 20 +
        agent.confidence * 20 -
        agent.memory.failures * 5;

      return {
        agent,
        score,
        capabilityMatches,
      };
    })
    .filter((item) => item.capabilityMatches > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.agent);

  return ranked.length > 0 ? ranked : [Agents.planner];
}

export function resetAgentRuntimeState() {
  for (const agent of getAgentList()) {
    if (agent.status === "active" || agent.status === "failed") {
      agent.status = "idle";
    }
  }

  return getAgentState();
}