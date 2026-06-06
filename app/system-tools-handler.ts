import { runBackgroundWorker } from "@/app/background-worker";
import { analyzeError } from "@/app/self-debug";
import { createTaskPlan } from "@/app/task-planner";
import { runOmniscientCognition } from "@/app/omniscient-cognition";

export async function handleRunBackgroundWorker() {
  const result = await runBackgroundWorker();

  return Response.json({
    reply: JSON.stringify(result, null, 2),
  });
}

export async function handleDebugError(message: string) {
  const errorText = message
    .replace("DEBUG_ERROR:", "")
    .trim();

  const analysis = analyzeError(errorText);

  return Response.json({
    reply: JSON.stringify(analysis, null, 2),
  });
}

export async function handleTaskPlan(message: string) {
  const task = message
    .replace("TASK_PLAN:", "")
    .trim();

  const plan = await createTaskPlan(task);

  return Response.json({
    reply: JSON.stringify(plan, null, 2),
  });
}

export async function handleAweniaStatus() {
  const status = await runOmniscientCognition();

  return Response.json({
    reply: JSON.stringify(status, null, 2),
  });
}