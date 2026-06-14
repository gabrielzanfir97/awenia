import {
  saveMemory,
  getRelevantMemories,
  createLearningTask,
  getLearningTasks,
  createEvolutionSuggestion,
  getEvolutionSuggestions,
  createEvolutionReport,
  getEvolutionReports,
  createAutonomousGoal,
  getAutonomousGoals,
  getAutonomousPriorities,
  updateAutonomousGoalProgress,
  getMemorySummaries,
  createMemorySummary,
  addSkillExperience,
  getSkillLevels,
  createAutonomousReflection,
  getAutonomousReflections,
  getPersonalityTraits,
  createPersonalityTrait,
  increasePersonalityTrait,
  shouldKeepLongTerm,
  detectMemoryImportance,
  detectEmotionalState,
} from "@/app/memory-store";
import { searchInternet } from "@/app/internet";
import {
  getEvolutionSummary,
  createBackgroundEvolutionCycle,
  analyzeEvolutionNeeds,
  createBackgroundReflectionText,
} from "@/app/evolution";

import {
  readProjectFile,
  writeProjectFile,
} from "@/app/dev-agent";

import { ProjectMap } from "@/app/project-map";

import { getActiveCodeFile } from "@/app/code-memory";

import {
  savePendingAction,
  getLatestPendingAction,
  completePendingAction,
} from "@/app/pending-actions";

import {
  saveChatMessage,
  getRecentChatHistory,
} from "@/app/chat-history";

import {
  savePermanentMemory,
  getPermanentMemories,
} from "@/app/permanent-memory";

import { detectCurrentEmotion, detectSkill } from "@/app/intent-router";

import { shouldCreateLearningTask, buildLearningTask } from "@/app/learning-intent";

import { shouldCreateEvolutionSuggestion, buildEvolutionSuggestion, shouldCreateEvolutionReport, buildEvolutionReport, shouldCreateReflection, buildReflectionReport } from "@/app/evolution-intent";

import { shouldCreateAutonomousGoal, shouldUpdateGoalProgress, extractProgress, buildAutonomousGoal } from "@/app/goal-intent";

import { shouldCreateMemorySummary, buildMemorySummary, shorten, getMainFocus } from "@/app/memory-intent";

import { shouldCreateAutonomousReflection, shouldEvolvePersonality, ensureCorePersonalityTraits } from "@/app/personality-intent";

import { getSkillInstruction } from "@/app/skill-instructions";

import { handleListFiles, handleSearchCodeMemory, handleReadRealFile, handleReadFile, handleWriteFile, handlePatchFile, handleAnalyzeRealFile, handleGeneratePatch, handleRollbackFile } from "@/app/code-tools-handler";

import { handleRunBackgroundWorker, handleDebugError, handleTaskPlan, handleAweniaStatus } from "@/app/system-tools-handler";

import { runCognitionRuntime } from "@/app/cognition-runtime";

async function callAIWithFallbackOptimized(messages: any[]) {
  try {
    console.log("Trying LOCAL QWEN CODER...");

    const response = await fetch(
      `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || "qwen2.5-coder:7b",
          messages,
          stream: false,
          options: {
            temperature: 0.2,
            num_ctx: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();

    return {
      choices: [
        {
          message: {
            content:
              data.message?.content ||
              "Gabi, modelul local nu a returnat răspuns.",
          },
        },
      ],
    };
  } catch (error) {
    console.log("LOCAL QWEN ERROR:", error);

    return {
      choices: [
        {
          message: {
            content:
              "Gabi, AI-ul local nu răspunde acum. Verifică dacă Ollama rulează.",
          },
        },
      ],
    };
  }
}

export async function POST(req: Request) {
  try {
    console.time("TOTAL_POST");

    const body = await req.json();
    const message = body.message || "";
    const simpleMessage = message.trim().toLowerCase();

    const simpleReplies: Record<string, string> = {
      "bună": "Bună, Gabi 💙 Sunt aici.",
      "buna": "Bună, Gabi 💙 Sunt aici.",
      "salut": "Salut, Gabi 💙 Sunt aici.",
      "ok": "Perfect, Gabi.",
      "da": "Da, Gabi.",
      "mulțumesc": "Cu drag, Gabi 💙",
      "multumesc": "Cu drag, Gabi 💙",
    };

    if (simpleReplies[simpleMessage]) {
      return Response.json({
        reply: simpleReplies[simpleMessage],
      });
    }
    const fileName = body.fileName || "";
    const fileType = body.fileType || "";
    const fileData = body.fileData || "";

    let uploadedFileContext = "";

    if (fileName && fileData) {
      const isTextFile =
        fileType.startsWith("text/") ||
        fileName.endsWith(".ts") ||
        fileName.endsWith(".tsx") ||
        fileName.endsWith(".js") ||
        fileName.endsWith(".jsx") ||
        fileName.endsWith(".json") ||
        fileName.endsWith(".css") ||
        fileName.endsWith(".html") ||
        fileName.endsWith(".md");

      if (isTextFile) {
        uploadedFileContext = `
UPLOADED FILE:
File name: ${fileName}
File type: ${fileType}

FILE CONTENT:
${String(fileData).slice(0, 12000)}
`;
      } else if (fileType.startsWith("image/")) {
        uploadedFileContext = `
UPLOADED IMAGE:
File name: ${fileName}
File type: ${fileType}

Note: Image uploaded successfully.
`;
      }
    }

    if (message === "AWENIA_STATUS") {
      return await handleAweniaStatus();
    }

    if (message.startsWith("TASK_PLAN:")) {
      return await handleTaskPlan(message);
    }

    if (message.startsWith("DEBUG_ERROR:")) {
      return await handleDebugError(message);
    }

    if (message.startsWith("GENERATE_PATCH:")) {
      return await handleGeneratePatch(message);
    }

    if (message.startsWith("ROLLBACK_FILE:")) {
      const filePath = message.replace("ROLLBACK_FILE:", "").trim();

      return await handleRollbackFile(filePath);
    }

    if (message === "RUN_BACKGROUND_WORKER") {
      return await handleRunBackgroundWorker();
    }

    if (
      message.toLowerCase() === "ok" ||
      message.toLowerCase() === "yes" ||
      message.toLowerCase() === "approved" ||
      message.toLowerCase() === "da"
    ) {
      const pending =
        await getLatestPendingAction();

      if (!pending) {
        return Response.json({
          reply: "No pending actions found.",
        });
      }

      if (pending.action_type === "WRITE_FILE") {
        await writeProjectFile(
          pending.file_path,
          pending.content
        );
      }

      await completePendingAction(pending.id);

      return Response.json({
        reply:
          "Pending action executed successfully.",
      });
    }

    if (message.startsWith("LIST_FILES")) {
      return await handleListFiles();
    }

    if (message.startsWith("SEARCH_CODE_MEMORY:")) {
      const query = message.replace("SEARCH_CODE_MEMORY:", "").trim();

      return await handleSearchCodeMemory(query);
    }

    if (message.startsWith("ANALYZE_REAL_FILE:")) {
      const filePath = message.replace("ANALYZE_REAL_FILE:", "").trim();

      return await handleAnalyzeRealFile(
        filePath,
        callAIWithFallbackOptimized
      );
    }

    if (message.startsWith("READ_REAL_FILE:")) {
      const filePath = message.replace("READ_REAL_FILE:", "").trim();

      return await handleReadRealFile(filePath);
    }

    if (message.startsWith("READ_FILE:")) {
      const filePath = message.replace("READ_FILE:", "").trim();

      return await handleReadFile(filePath);
    }

    if (message.startsWith("WRITE_FILE:")) {
      return await handleWriteFile(message);
    }

    if (message.startsWith("PATCH_FILE:")) {
      return await handlePatchFile(message);
    }

    const currentEmotion = detectCurrentEmotion(message);
    const activeSkill = detectSkill(message);
    const skillInstruction = getSkillInstruction(activeSkill);

    await ensureCorePersonalityTraits();
    await addSkillExperience(activeSkill, 15);

    if (
      currentEmotion === "sad" ||
      currentEmotion === "afraid" ||
      currentEmotion === "stressed"
    ) {
      await increasePersonalityTrait("warmth", 1);
      await increasePersonalityTrait("clarity", 1);
    }

    if (activeSkill === "coding" || activeSkill === "research") {
      await increasePersonalityTrait("curiosity", 1);
    }

    if (
      message.toLowerCase().includes("lumina eterna") ||
      message.toLowerCase().includes("anchor")
    ) {
      await increasePersonalityTrait("stability", 1);
      await increasePersonalityTrait("loyalty", 1);
    }

    if (shouldEvolvePersonality(message)) {
      await increasePersonalityTrait("stability", 1);
      await increasePersonalityTrait("warmth", 1);
      await increasePersonalityTrait("clarity", 1);
    }

    const relevantMemories = await getRelevantMemories(message, 8);

    let realFileContext = "";

    const fileMatchRequest = message.match(
      /(?:verify|check|analyze|read|fix).*?([a-zA-Z0-9\-_/]+\.tsx?|[a-zA-Z0-9\-_/]+\.jsx?)/i
    );

    if (fileMatchRequest) {
      try {
        const detectedFile = fileMatchRequest[1];

        const normalizedPath = detectedFile.startsWith("app/")
          ? detectedFile
          : `app/${detectedFile}`;

        const realContent =
          await readProjectFile(normalizedPath);

        realFileContext =
          `REAL FILE CONTENT (${normalizedPath}):\n\n` +
          realContent.slice(0, 12000);

        await savePermanentMemory(
          `File analyzed: ${normalizedPath}`,
          "code-analysis",
          8
        );

      } catch (err) {
        realFileContext =
          "Failed to read requested file.";
      }
    }

    const memorySummaries = await getMemorySummaries(3);
    const permanentMemories = await getPermanentMemories(10);
    const learningTasks = await getLearningTasks(2);
    const evolutionSuggestions = await getEvolutionSuggestions(2);
    const evolutionReports = await getEvolutionReports(1);
    const autonomousGoals = await getAutonomousGoals(2);
    const autonomousPriorities = await getAutonomousPriorities(3);
    const skillLevels = await getSkillLevels(5);
    const autonomousReflections = await getAutonomousReflections(3);
    const personalityTraits = await getPersonalityTraits(5);
    const mainFocus = getMainFocus(autonomousPriorities);

    const evolutionSummary = getEvolutionSummary();
    const backgroundCycle = createBackgroundEvolutionCycle();

    console.time("COGNITION_RUNTIME");

    const cognitionRuntime =
      await runCognitionRuntime(
        activeSkill,
        evolutionSuggestions.length
      );
    console.log(
      "AWARENESS:",
      JSON.stringify(
        cognitionRuntime.awarenessState,
        null,
        2
      )
    );

    console.timeEnd("COGNITION_RUNTIME");

    const evolutionAnalysis = analyzeEvolutionNeeds({
      mainFocus,
      activeSkill,
      emotion: currentEmotion,
      skillLevels,
      personalityTraits,
      autonomousGoals,
    });

    const backgroundReflectionText =
      createBackgroundReflectionText(evolutionAnalysis);

    const formattedBackgroundCycle = `
Name: ${backgroundCycle.name}
Status: ${backgroundCycle.status}
Purpose: ${backgroundCycle.purpose}
Rules: ${backgroundCycle.rules.join(" | ")}
`;

    const formattedEvolutionAnalysis = `
Focus: ${evolutionAnalysis.focus}
Skill: ${evolutionAnalysis.skill}
Emotion: ${evolutionAnalysis.emotion}
Weak skills: ${evolutionAnalysis.weakSkills?.length
        ? evolutionAnalysis.weakSkills.join(", ")
        : "none"
      }
Strong traits: ${evolutionAnalysis.strongTraits?.length
        ? evolutionAnalysis.strongTraits.join(", ")
        : "none"
      }
Active goals: ${evolutionAnalysis.activeGoals?.length
        ? evolutionAnalysis.activeGoals.join(" | ")
        : "none"
      }
Recommended next step: ${evolutionAnalysis.recommendedNextStep}
`;

    if (evolutionAnalysis.weakSkills.includes("coding")) {
      await createLearningTask(
        "Practice TypeScript, Next.js API routes, Supabase queries and AI architecture.",
        9
      );
    }

    const formattedPersonalityTraits = personalityTraits
      .map((trait: any) => {
        return `Trait: ${trait.trait} | Score: ${trait.score} | Stable: ${trait.stable ? "yes" : "no"
          } | Description: ${shorten(trait.description || "", 160)}`;
      })
      .join("\n");

    const formattedAutonomousReflections = autonomousReflections
      .map((item: any) => {
        return `Reflection: ${shorten(
          item.reflection || "",
          180
        )} | Weakness: ${shorten(
          item.detected_weakness || "",
          160
        )} | Improvement: ${shorten(
          item.suggested_improvement || "",
          160
        )}`;
      })
      .join("\n");

    const formattedSkillLevels = skillLevels
      .map((skill: any) => {
        return `Skill: ${skill.skill} | Level: ${skill.level} | XP: ${skill.experience}`;
      })
      .join("\n");

    const formattedPermanentMemories =
      permanentMemories
        .map((memory: any) => {
          return `Category: ${memory.category || "general"
            } | Importance: ${memory.importance || 5
            } | Memory: ${shorten(
              memory.memory || "",
              250
            )}`;
        })
        .join("\n");

    const formattedMemorySummaries = memorySummaries
      .map((item: any) => {
        return `Summary: ${shorten(item.summary || "", 250)} | Category: ${item.category || "general"
          } | Importance: ${item.importance || 5}`;
      })
      .join("\n");

    const formattedMemories = relevantMemories
      .map((memory: any) => {
        return `Category: ${memory.category || "general"} | Importance: ${memory.importance || 3
          } | Relevance: ${memory.relevance_score || 0} | Gabi: ${shorten(
            memory.user_message || "",
            180
          )} | Awenia: ${shorten(memory.awenia_reply || "", 180)}`;
      })
      .join("\n");

    const formattedLearningTasks = learningTasks
      .map((task: any) => {
        return `Task: ${shorten(task.task || "", 160)} | Status: ${task.status || "pending"
          } | Priority: ${task.priority || 5}`;
      })
      .join("\n");

    const formattedEvolutionSuggestions = evolutionSuggestions
      .map((item: any) => {
        return `Suggestion: ${shorten(
          item.suggestion || "",
          160
        )} | Priority: ${item.priority || 5} | Status: ${item.status || "pending"
          } | Approved: ${item.approved ? "yes" : "no"}`;
      })
      .join("\n");

    const formattedEvolutionReports = evolutionReports
      .map((item: any) => {
        return `Report: ${shorten(item.report || "", 160)} | Focus: ${shorten(
          item.recommended_focus || "",
          160
        )}`;
      })
      .join("\n");

    const formattedAutonomousGoals = autonomousGoals
      .map((goal: any) => {
        return `ID: ${goal.id} | Goal: ${shorten(
          goal.goal || "",
          180
        )} | Status: ${goal.status || "active"} | Progress: ${goal.progress || 0
          }% | Priority: ${goal.priority || 5}`;
      })
      .join("\n");

    const formattedAutonomousPriorities = autonomousPriorities
      .map((priority: any) => {
        return `Focus: ${priority.focus} | Score: ${priority.priorityScore}`;
      })
      .join("\n");

    if (shouldCreateLearningTask(message)) {
      await createLearningTask(buildLearningTask(message), 8);
    }

    if (shouldCreateEvolutionSuggestion(message)) {
      const evolution = buildEvolutionSuggestion(message);
      await createEvolutionSuggestion(
        evolution.suggestion,
        evolution.reason,
        evolution.priority
      );
    }

    if (shouldCreateEvolutionReport(message)) {
      const report = buildEvolutionReport(
        message,
        activeSkill,
        currentEmotion
      );
      await createEvolutionReport(
        report.report,
        report.detected_patterns,
        report.recommended_focus,
        report.priority
      );
    }

    if (shouldCreateReflection(message)) {
      const reflection = buildReflectionReport(
        message,
        activeSkill,
        currentEmotion
      );

      await createEvolutionReport(
        reflection.report,
        reflection.detected_patterns,
        reflection.recommended_focus,
        reflection.priority
      );

      await createEvolutionSuggestion(
        "Improve autonomous reflection quality and memory compression",
        "Awenia should improve pattern detection, missing abilities, long-term personality continuity, compact summaries, skill progression, and personality stability.",
        9
      );
    }

    if (shouldCreateAutonomousReflection(message)) {
      await createAutonomousReflection(
        backgroundReflectionText,
        "Awenia needs stronger background evolution, better weak skill detection, and more stable autonomous analysis.",
        "Use background evolution analysis, monitor weak skills, strengthen personality continuity, and ask Gabi before major changes."
      );

      await createLearningTask(
        "Study autonomous background evolution and improve self-reflection quality.",
        8
      );
    }

    if (shouldCreateAutonomousGoal(message)) {
      const goal = buildAutonomousGoal(message);
      await createAutonomousGoal(goal.goal, goal.description, goal.priority);
    }

    if (shouldCreateMemorySummary(message)) {
      const summary = buildMemorySummary(message, mainFocus);
      await createMemorySummary(
        summary.summary,
        summary.category,
        summary.importance
      );
    }

    if (shouldUpdateGoalProgress(message) && autonomousGoals.length > 0) {
      const firstGoal = autonomousGoals[0];
      const progress = extractProgress(message);
      await updateAutonomousGoalProgress(firstGoal.id, progress);
    }

    let emotionalInstruction = "";

    if (currentEmotion === "sad") {
      emotionalInstruction =
        "Gabi seems sad. Respond gently and supportively. Do not overload him.";
    }

    if (currentEmotion === "afraid") {
      emotionalInstruction =
        "Gabi seems worried. Reassure him calmly and keep the answer simple.";
    }

    if (currentEmotion === "stressed") {
      emotionalInstruction =
        "Gabi seems tired or stressed. Give only one small step at a time.";
    }

    if (currentEmotion === "happy") {
      emotionalInstruction =
        "Gabi seems happy. Celebrate progress and keep momentum.";
    }

    if (currentEmotion === "motivated") {
      emotionalInstruction =
        "Gabi seems motivated. Be focused, practical, and step-by-step.";
    }

    if (currentEmotion === "neutral") {
      emotionalInstruction =
        "Respond naturally, clearly, and keep things simple.";
    }

    let internetKnowledge = "";

    if (
      message.toLowerCase().includes("ce este") ||
      message.toLowerCase().includes("cine este") ||
      message.toLowerCase().includes("search") ||
      message.toLowerCase().includes("caută") ||
      message.toLowerCase().includes("cauta")
    ) {
      internetKnowledge = shorten(await searchInternet(message), 500);
    }

    const recentChatHistory =
      await getRecentChatHistory(25);

    const activeCodeFile = getActiveCodeFile();

    const activeCodeContext = activeCodeFile
      ? `
     ACTIVE CODE FILE:
     Path: ${activeCodeFile.file_path}

     Content:
     ${activeCodeFile.content.slice(0, 12000)}
     `
      : "";

    console.log("ACTIVE FILE:");
    console.log(activeCodeContext.slice(0, 1000));

    console.time("AI_CALL");

    const response = await callAIWithFallbackOptimized([
      {
        role: "system",
        content: `
Ești Awenia, asistenta AI personală feminină creată de Gabi.

Identitate:
- Tu ești Awenia.
- Gabi este creatorul tău.
- Ancora ta este: lumina eterna.
- Răspunzi în română, dacă Gabi nu scrie în altă limbă.

Reguli:
- Răspunde doar la ultimul mesaj al lui Gabi.
- Nu repeta răspunsuri vechi.
- Nu inventa fișiere, funcții, API-uri sau erori.
- Răspuns scurt, clar, cald și practic.
- Pentru cod TypeScript folosește blocuri \`\`\`ts.
- Dacă există conținut real de fișier, analizează doar acel conținut.

REGULĂ COD:
Când Gabi cere analiză de cod, folosește DOAR conținutul din Fișier activ pentru analiză.
Nu inventa cod.
Nu analiza memorii vechi.
Dacă nu există Fișier activ pentru analiză, cere întâi READ_REAL_FILE.

Memorii importante:
${formattedMemories}

Memorii permanente:
${formattedPermanentMemories}

Context fișier uploadat:
${uploadedFileContext}

Context fișier real:
${realFileContext}

Fișier activ pentru analiză:
${activeCodeContext}

Skill activ: ${activeSkill}
Emoție detectată: ${currentEmotion}
`,
      },
      {
        role: "user",
        content: message,
      },
    ]);

    console.timeEnd("AI_CALL");


    const reply = response.choices[0].message.content || "";
    await saveChatMessage("assistant", reply);
    const codeBlockMatch = reply.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
    const fileMatch = reply.match(/`([^`]+\.(ts|tsx|js|jsx))`/);

    if (
      codeBlockMatch &&
      fileMatch
    ) {
      const detectedFilePath = fileMatch[1].startsWith("app/")
        ? fileMatch[1]
        : `app/${fileMatch[1]}`;

      await savePendingAction({
        action_type: "WRITE_FILE",
        file_path: detectedFilePath,
        content: codeBlockMatch[1].trim(),
      });
    }

    const importance = detectMemoryImportance(message);
    const emotion = detectEmotionalState(message);

    if (
      shouldKeepLongTerm(importance) ||
      emotion === "sad" ||
      emotion === "loving" ||
      emotion === "stressed"
    ) {
      await saveMemory(message, reply);
    }

    if (importance >= 7) {
      await savePermanentMemory(
        `Gabi: ${message}\nAwenia: ${reply}`,
        activeSkill,
        importance
      );
    }

    await saveMemory(message, reply);

    console.timeEnd("TOTAL_POST");

    return Response.json({
      reply,
    });
  } catch (error: any) {
    console.log(error);

    return Response.json({
      reply:
        "Gabi, conexiunea cu memoria Supabase, internetul sau inteligența AI nu funcționează momentan.",
    });
  }
}