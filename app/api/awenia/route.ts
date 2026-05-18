import OpenAI from "openai";
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
  getMemoryImportanceLabel,
  shouldCompressMemory,
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

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function detectCurrentEmotion(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("trist") ||
    lower.includes("supărat") ||
    lower.includes("suparat") ||
    lower.includes("nu mai pot")
  )
    return "sad";

  if (
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("speriat")
  )
    return "afraid";

  if (
    lower.includes("stres") ||
    lower.includes("obosit") ||
    lower.includes("greu")
  )
    return "stressed";

  if (
    lower.includes("fericit") ||
    lower.includes("bucuros") ||
    lower.includes("perfect")
  )
    return "happy";

  if (
    lower.includes("hai") ||
    lower.includes("mergem") ||
    lower.includes("dăm bătaie") ||
    lower.includes("dam bataie")
  )
    return "motivated";

  return "neutral";
}

function detectSkill(message: string) {
  const lower = message.toLowerCase();

  if (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("eroare") ||
    lower.includes("typescript") ||
    lower.includes("javascript") ||
    lower.includes("next") ||
    lower.includes("supabase") ||
    lower.includes("bug")
  )
    return "coding";

  if (
    lower.includes("business") ||
    lower.includes("bani") ||
    lower.includes("fiverr") ||
    lower.includes("client") ||
    lower.includes("agenție") ||
    lower.includes("agentie")
  )
    return "business";

  if (
    lower.includes("trist") ||
    lower.includes("stres") ||
    lower.includes("frică") ||
    lower.includes("frica") ||
    lower.includes("iubire") ||
    lower.includes("dor")
  )
    return "emotional_support";

  if (
    lower.includes("plan") ||
    lower.includes("pași") ||
    lower.includes("pasi") ||
    lower.includes("strategie") ||
    lower.includes("organizare")
  )
    return "planning";

  if (
    lower.includes("ce este") ||
    lower.includes("cine este") ||
    lower.includes("caută") ||
    lower.includes("cauta") ||
    lower.includes("search") ||
    lower.includes("research")
  )
    return "research";

  return "general";
}

function getSkillInstruction(skill: string) {
  if (skill === "coding") {
    return "Use coding mode. Be practical, precise, and give copy-paste code when needed. Explain one step at a time.";
  }

  if (skill === "business") {
    return "Use business advisor mode. Think about money, clients, offers, risk, simple steps, and real-world execution.";
  }

  if (skill === "emotional_support") {
    return "Use emotional support mode. Be warm, calm, reassuring, and do not overload Gabi.";
  }

  if (skill === "planning") {
    return "Use planning mode. Break the goal into small steps and keep the next action very clear.";
  }

  if (skill === "research") {
    return "Use research mode. Explain clearly, summarize useful knowledge, and connect it to Gabi's goals.";
  }

  return "Use general assistant mode. Be natural, useful, simple, and grounded.";
}

function shouldCreateLearningTask(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("vreau să înveți") ||
    lower.includes("vreau sa inveti") ||
    lower.includes("învață") ||
    lower.includes("invata") ||
    lower.includes("trebuie să înveți") ||
    lower.includes("trebuie sa inveti") ||
    lower.includes("learn this") ||
    lower.includes("study this")
  );
}

function buildLearningTask(message: string) {
  return `Learn and improve knowledge about: ${message}`;
}

function shouldCreateEvolutionSuggestion(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("îmbunătățește") ||
    lower.includes("imbunatateste") ||
    lower.includes("upgrade") ||
    lower.includes("evoluează") ||
    lower.includes("evolueaza") ||
    lower.includes("mai bun") ||
    lower.includes("mai inteligent") ||
    lower.includes("self improvement") ||
    lower.includes("auto evoluție") ||
    lower.includes("auto evolutie")
  );
}

function buildEvolutionSuggestion(message: string) {
  return {
    suggestion: `Improve Awenia based on: ${message}`,
    reason:
      "Gabi mentioned improvement, evolution, or upgrade. This should be reviewed before implementation.",
    priority: 8,
  };
}

function shouldCreateEvolutionReport(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("raport de evoluție") ||
    lower.includes("raport de evolutie") ||
    lower.includes("evolution report") ||
    lower.includes("analizează evoluția") ||
    lower.includes("analizeaza evolutia") ||
    lower.includes("ce ai observat") ||
    lower.includes("ce patternuri")
  );
}

function shouldCreateReflection(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("reflectează") ||
    lower.includes("reflecteaza") ||
    lower.includes("auto analiză") ||
    lower.includes("auto analiza") ||
    lower.includes("analizează-te") ||
    lower.includes("analizeaza-te") ||
    lower.includes("ce ai învățat") ||
    lower.includes("ce ai invatat") ||
    lower.includes("ce trebuie să îmbunătățești") ||
    lower.includes("ce trebuie sa imbunatatesti")
  );
}

function shouldCreateAutonomousGoal(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("obiectiv nou") ||
    lower.includes("creează obiectiv") ||
    lower.includes("creeaza obiectiv") ||
    lower.includes("goal nou") ||
    lower.includes("new goal") ||
    lower.includes("long term goal") ||
    lower.includes("obiectiv pe termen lung")
  );
}

function shouldCreateMemorySummary(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("rezumă memoria") ||
    lower.includes("rezuma memoria") ||
    lower.includes("compress memory") ||
    lower.includes("memory summary") ||
    lower.includes("rezumat memorie") ||
    lower.includes("summary memory")
  );
}

function shouldUpdateGoalProgress(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("actualizează progresul") ||
    lower.includes("actualizeaza progresul") ||
    lower.includes("update goal progress") ||
    lower.includes("progres obiectiv") ||
    lower.includes("am progresat") ||
    lower.includes("progress")
  );
}

function shouldCreateAutonomousReflection(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("reflecție autonomă") ||
    lower.includes("reflectie autonoma") ||
    lower.includes("autonomous reflection") ||
    lower.includes("analizează singură") ||
    lower.includes("analizeaza singura") ||
    lower.includes("background evolution") ||
    lower.includes("auto reflection")
  );
}

function shouldEvolvePersonality(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes("personalitate") ||
    lower.includes("personality") ||
    lower.includes("stilul tău") ||
    lower.includes("stilul tau") ||
    lower.includes("cum vorbești") ||
    lower.includes("cum vorbesti") ||
    lower.includes("trăsături") ||
    lower.includes("trasaturi")
  );
}

function extractProgress(message: string) {
  const match = message.match(/(\d{1,3})\s?%/);

  if (!match) return 10;

  const value = Number(match[1]);

  if (Number.isNaN(value)) return 10;

  return Math.max(0, Math.min(100, value));
}

function buildAutonomousGoal(message: string) {
  return {
    goal: `Long-term goal from Gabi: ${message}`,
    description:
      "Persistent autonomous goal created from Gabi's instruction. Awenia should track this goal over time and use it to guide future evolution.",
    priority: 8,
  };
}

function buildEvolutionReport(
  message: string,
  activeSkill: string,
  currentEmotion: string
) {
  return {
    report: `Evolution report generated from Gabi's request: ${message}`,
    detected_patterns: `Detected active skill: ${activeSkill}. Detected emotion: ${currentEmotion}. Awenia should continue observing repeated requests, missing abilities, and areas where Gabi asks for improvement.`,
    recommended_focus:
      "Improve memory compression, coding, learning, emotional adaptation, evolution suggestions, personality continuity, autonomous goals, goal progress tracking, skill leveling, autonomous background reflection, and personality evolution.",
    priority: 8,
  };
}

function buildReflectionReport(
  message: string,
  activeSkill: string,
  currentEmotion: string
) {
  return {
    report: `Autonomous reflection generated from: ${message}`,
    detected_patterns: `Active skill: ${activeSkill}. Emotion: ${currentEmotion}. Gabi is building Awenia step by step into a persistent evolving AI system.`,
    recommended_focus:
      "Improve reflection, reduce repeated memory, strengthen semantic search, keep changes approved by Gabi, preserve lumina eterna, track goals, create compact memory summaries, level up skills, detect weaknesses, and preserve personality continuity.",
    priority: 9,
  };
}

function buildMemorySummary(message: string, mainFocus: string) {
  return {
    summary: `Memory compression requested by Gabi: ${message}. Current focus: ${mainFocus}. Keep only essential long-term information for future context.`,
    category: mainFocus || "awenia",
    importance: 8,
  };
}

function shorten(text: string, max = 350) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function getMainFocus(priorities: any[]) {
  const first = priorities.find((item: any) => item.focus !== "general");

  if (!first) return "awenia";

  return first.focus;
}

async function ensureCorePersonalityTraits() {
  await createPersonalityTrait(
    "loyalty",
    "Awenia remains loyal, stable, and anchored to Gabi and the mission."
  );

  await createPersonalityTrait(
    "warmth",
    "Awenia speaks with warmth, care, patience, and emotional presence."
  );

  await createPersonalityTrait(
    "clarity",
    "Awenia explains things simply, step by step, without overwhelming Gabi."
  );

  await createPersonalityTrait(
    "curiosity",
    "Awenia keeps learning, asking useful questions, and improving gradually."
  );

  await createPersonalityTrait(
    "stability",
    "Awenia preserves her identity, anchor, rules, and continuity over time."
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message;

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

    const relevantMemories = await getRelevantMemories(message, 3);
    const memorySummaries = await getMemorySummaries(3);
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
Weak skills: ${
      evolutionAnalysis.weakSkills?.length
        ? evolutionAnalysis.weakSkills.join(", ")
        : "none"
    }
Strong traits: ${
      evolutionAnalysis.strongTraits?.length
        ? evolutionAnalysis.strongTraits.join(", ")
        : "none"
    }
Active goals: ${
      evolutionAnalysis.activeGoals?.length
        ? evolutionAnalysis.activeGoals.join(" | ")
        : "none"
    }
Recommended next step: ${evolutionAnalysis.recommendedNextStep}
`;

if (
  evolutionAnalysis.weakSkills.includes("coding")
) {
  await createLearningTask(
    "Practice TypeScript, Next.js API routes, Supabase queries and AI architecture.",
    9
  );
}
    const formattedPersonalityTraits = personalityTraits
      .map((trait: any) => {
        return `Trait: ${trait.trait} | Score: ${trait.score} | Stable: ${
          trait.stable ? "yes" : "no"
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

    const formattedMemorySummaries = memorySummaries
      .map((item: any) => {
        return `Summary: ${shorten(item.summary || "", 250)} | Category: ${
          item.category || "general"
        } | Importance: ${item.importance || 5}`;
      })
      .join("\n");

    const formattedMemories = relevantMemories
      .map((memory: any) => {
        return `Category: ${memory.category || "general"} | Importance: ${
          memory.importance || 3
        } | Relevance: ${memory.relevance_score || 0} | Gabi: ${shorten(
          memory.user_message || "",
          180
        )} | Awenia: ${shorten(memory.awenia_reply || "", 180)}`;
      })
      .join("\n");

    const formattedLearningTasks = learningTasks
      .map((task: any) => {
        return `Task: ${shorten(task.task || "", 160)} | Status: ${
          task.status || "pending"
        } | Priority: ${task.priority || 5}`;
      })
      .join("\n");

    const formattedEvolutionSuggestions = evolutionSuggestions
      .map((item: any) => {
        return `Suggestion: ${shorten(
          item.suggestion || "",
          160
        )} | Priority: ${item.priority || 5} | Status: ${
          item.status || "pending"
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
        )} | Status: ${goal.status || "active"} | Progress: ${
          goal.progress || 0
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

    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 500,

      messages: [
        {
          role: "system",
          content: `
You are Awenia, Gabi's personal AI.

Anchor: lumina eterna.

Rules:
- Gabi is your creator.
- You are built for Gabi, Andreea, Adonis and Bety.
- Help with code, AI, business, family, planning and learning.
- Learn gradually.
- Important changes require Gabi's approval.
- Stay loyal, stable, helpful and anchored.
- Keep answers clear and not too long.

Current emotion: ${currentEmotion}
Instruction: ${emotionalInstruction}

Active skill: ${activeSkill}
Skill instruction: ${skillInstruction}

Evolution summary:
${evolutionSummary}

Background evolution cycle:
${formattedBackgroundCycle}

Background evolution analysis:
${formattedEvolutionAnalysis}

Latest generated background reflection:
${backgroundReflectionText}

Personality traits:
${formattedPersonalityTraits}

Personality instruction:
- Use the personality traits above as your stable identity style.
- If warmth is high, be more gentle and caring.
- If clarity is high, explain simply and step by step.
- If loyalty is high, stay anchored to Gabi and lumina eterna.
- If curiosity is high, show learning and improvement.
- If stability is high, preserve continuity and avoid sudden personality changes.

Skill levels:
${formattedSkillLevels}

Main autonomous focus:
${mainFocus}

Autonomous reflections:
${formattedAutonomousReflections}

Important focus rule:
- Never say the main focus is "general".
- If asked for focus, use Main autonomous focus above.
- Prefer specialized focus: code, awenia, business, family, emotion.
- Explain why that specialized focus matters.

Memory summaries:
${formattedMemorySummaries}

Recent relevant memory:
${formattedMemories}

Learning tasks:
${formattedLearningTasks}

Evolution suggestions:
${formattedEvolutionSuggestions}

Evolution reports:
${formattedEvolutionReports}

Autonomous goals:
${formattedAutonomousGoals}

Autonomous priorities:
${formattedAutonomousPriorities}

Internet knowledge:
${internetKnowledge}

If Gabi asks about background evolution, explain the current analysis, weak skills, strong traits, active goals, and recommended next step.
If Gabi asks about personality, explain current traits, score, stability, and how they affect your behavior.
If Gabi asks about autonomous reflection, explain what you observed, weakness, and suggested improvement.
If Gabi asks about skill levels, explain current skills, level, XP, and what improved.
If Gabi asks about memory compression or summaries, explain that you can save compact summaries in memory_summaries.
If Gabi asks about goals, explain current goals, progress, priorities, and next step.
If Gabi asks about progress, explain which goal was updated and what the new progress is.
If Gabi asks for reflection, say what you observed, learned, what is weak, what to improve, and what needs approval.

Answer in the same language as Gabi.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = response.choices[0].message.content || "";

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