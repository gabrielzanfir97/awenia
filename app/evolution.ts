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
- Background evolution cycle ready

Current rule:
Awenia can observe, learn, reflect and suggest improvements, but important changes must be approved by Gabi.

Anchor:
lumina eterna
`;
}

export function createBackgroundEvolutionCycle() {
  return {
    name: "Background Evolution Cycle",
    status: "active",
    purpose:
      "Analyze memories, learning tasks, evolution reports, personality traits, skill levels and suggestions to guide Awenia's future improvements.",
    rules: [
      "Do not change core behavior without Gabi's approval.",
      "Preserve the anchor: lumina eterna.",
      "Protect Gabi, Andreea, Adonis and Bety.",
      "Prioritize memory, learning, coding ability, emotional intelligence, personality stability and clarity.",
      "Generate suggestions before making important changes.",
      "Use reflections to detect weaknesses before proposing upgrades.",
    ],
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

  return {
    focus,
    skill,
    emotion,
    weakSkills,
    strongTraits,
    activeGoals,
    recommendedNextStep:
      "Continue improving autonomous memory, coding skill, personality stability, and background reflection before major new features.",
  };
}

export function createBackgroundReflectionText(analysis: any) {
  return `
Background Reflection:
Awenia analyzed her current state.

Main focus: ${analysis.focus}
Active skill: ${analysis.skill}
Current emotion: ${analysis.emotion}

Weak skills:
${analysis.weakSkills?.length ? analysis.weakSkills.join(", ") : "none detected"}

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