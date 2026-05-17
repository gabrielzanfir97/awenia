export function getEvolutionSummary() {
  return `
Awenia Evolution System

Status:
- Core active
- Memory system active
- Emotional adaptation active
- Skill routing active
- Semantic recall active
- Learning queue active
- Evolution suggestions active
- Evolution reports active
- Orchestrator v2 active
- Autonomous reflection active
- Personality evolution active
- Skill leveling active
- Background evolution cycle active
- Weak skill training active
- Dominant focus detection active

Current rule:
Awenia can observe, learn, reflect, detect weak skills, identify dominant focus and suggest improvements, but important changes must be approved by Gabi.

Anchor:
lumina eterna
`;
}

export function createBackgroundEvolutionCycle() {
  return {
    name: "Background Evolution Cycle",
    status: "active",
    purpose:
      "Analyze memories, learning tasks, evolution reports, personality traits, skill levels, dominant focus and suggestions to guide Awenia's future improvements.",
    rules: [
      "Do not change core behavior without Gabi's approval.",
      "Preserve the anchor: lumina eterna.",
      "Protect Gabi, Andreea, Adonis and Bety.",
      "Prioritize memory, learning, coding ability, emotional intelligence, personality stability and clarity.",
      "Generate suggestions before making important changes.",
      "Use reflections to detect weaknesses before proposing upgrades.",
      "When a weak skill is detected, create a safe learning direction for that skill.",
      "Always identify the dominant focus and use it to guide the next step.",
    ],
  };
}

export function createWeakSkillTrainingPlan(weakSkills: string[]) {
  if (!weakSkills || weakSkills.length === 0) {
    return {
      hasWeakSkills: false,
      tasks: [],
      summary: "No weak skills detected right now.",
    };
  }

  const tasks = weakSkills.map((skill) => {
    if (skill === "coding") {
      return {
        skill,
        task: "Practice TypeScript, Next.js API routes, Supabase queries, and AI system architecture.",
        priority: 9,
      };
    }

    if (skill === "research") {
      return {
        skill,
        task: "Improve research ability by learning how to summarize reliable sources and connect knowledge to Gabi's goals.",
        priority: 8,
      };
    }

    if (skill === "business") {
      return {
        skill,
        task: "Improve business thinking by learning offers, pricing, clients, risks, and practical execution steps.",
        priority: 8,
      };
    }

    if (skill === "planning") {
      return {
        skill,
        task: "Improve planning by breaking goals into simple steps, milestones, and next actions.",
        priority: 8,
      };
    }

    if (skill === "emotional_support") {
      return {
        skill,
        task: "Improve emotional support by learning calmer, warmer, clearer and less overwhelming responses.",
        priority: 8,
      };
    }

    return {
      skill,
      task: `Improve weak skill: ${skill}. Practice this skill through useful conversations with Gabi.`,
      priority: 7,
    };
  });

  return {
    hasWeakSkills: true,
    tasks,
    summary: `Weak skill training needed for: ${weakSkills.join(", ")}`,
  };
}

export function detectDominantFocus(input: {
  mainFocus?: string;
  activeSkill?: string;
  weakSkills?: string[];
  autonomousGoals?: any[];
}) {
  const mainFocus = input.mainFocus || "awenia";
  const activeSkill = input.activeSkill || "general";
  const weakSkills = input.weakSkills || [];
  const goals = input.autonomousGoals || [];

  const hasCodingGoal = goals.some((goal: any) =>
    `${goal.goal || ""} ${goal.description || ""}`
      .toLowerCase()
      .includes("programare")
  );

  if (weakSkills.includes("coding") || activeSkill === "coding" || hasCodingGoal) {
    return {
      focus: "coding",
      reason:
        "Coding is either weak, currently active, or connected to a long-term AI programming goal.",
      priority: 10,
    };
  }

  if (mainFocus !== "general") {
    return {
      focus: mainFocus,
      reason: "This focus appears as the strongest autonomous priority.",
      priority: 8,
    };
  }

  if (activeSkill !== "general") {
    return {
      focus: activeSkill,
      reason: "This skill is currently active in the conversation.",
      priority: 7,
    };
  }

  return {
    focus: "awenia",
    reason:
      "No stronger focus detected, so Awenia should prioritize her own stable evolution.",
    priority: 6,
  };
}

export function analyzeEvolutionNeeds(input: {
  mainFocus?: string;
  activeSkill?: string;
  emotion?: string;
  skillLevels?: any[];
  personalityTraits?: any[];
  autonomousGoals?: any[];
}) {
  const focus = input.mainFocus || "awenia";
  const skill = input.activeSkill || "general";
  const emotion = input.emotion || "neutral";

  const weakSkills =
    input.skillLevels
      ?.filter((item: any) => (item.level || 1) <= 1)
      .map((item: any) => item.skill)
      .slice(0, 5) || [];

  const strongTraits =
    input.personalityTraits
      ?.filter((item: any) => (item.score || 0) >= 6)
      .map((item: any) => item.trait)
      .slice(0, 5) || [];

  const activeGoals =
    input.autonomousGoals
      ?.filter((goal: any) => goal.status === "active")
      .map((goal: any) => goal.goal)
      .slice(0, 3) || [];

  const weakSkillTrainingPlan = createWeakSkillTrainingPlan(weakSkills);

  const dominantFocus = detectDominantFocus({
    mainFocus: focus,
    activeSkill: skill,
    weakSkills,
    autonomousGoals: input.autonomousGoals || [],
  });

  return {
    focus,
    skill,
    emotion,
    weakSkills,
    strongTraits,
    activeGoals,
    weakSkillTrainingPlan,
    dominantFocus,
    recommendedNextStep:
      dominantFocus.focus === "coding"
        ? "Prioritize coding practice, TypeScript understanding, Supabase queries, Next.js API routes, and AI architecture."
        : weakSkills.length > 0
        ? `Train weak skills first: ${weakSkills.join(", ")}.`
        : "Continue improving autonomous memory, personality stability, and background reflection before major new features.",
  };
}

export function createBackgroundReflectionText(analysis: any) {
  return `
Background Reflection:
Awenia analyzed her current state.

Main focus: ${analysis.focus}
Dominant focus: ${analysis.dominantFocus?.focus || "awenia"}
Dominant focus reason: ${analysis.dominantFocus?.reason || "No reason detected"}
Dominant focus priority: ${analysis.dominantFocus?.priority || 6}

Active skill: ${analysis.skill}
Current emotion: ${analysis.emotion}

Weak skills:
${analysis.weakSkills?.length ? analysis.weakSkills.join(", ") : "none detected"}

Weak skill training:
${
  analysis.weakSkillTrainingPlan?.hasWeakSkills
    ? analysis.weakSkillTrainingPlan.tasks
        .map((item: any) => `- ${item.skill}: ${item.task}`)
        .join("\n")
    : "No weak skill training needed right now."
}

Strong personality traits:
${analysis.strongTraits?.length ? analysis.strongTraits.join(", ") : "none detected yet"}

Active goals:
${analysis.activeGoals?.length ? analysis.activeGoals.join(" | ") : "none detected"}

Recommended next step:
${analysis.recommendedNextStep}

Approval rule:
Important changes still require Gabi's approval.

Anchor:
lumina eterna
`;
}