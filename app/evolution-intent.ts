export function shouldCreateEvolutionSuggestion(message: string): boolean {
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

export function buildEvolutionSuggestion(message: string) {
  return {
    suggestion: `Improve Awenia based on: ${message}`,
    reason:
      "Gabi mentioned improvement, evolution, or upgrade. This should be reviewed before implementation.",
    priority: 8,
  };
}

export function shouldCreateEvolutionReport(message: string): boolean {
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

export function shouldCreateReflection(message: string): boolean {
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

export function buildEvolutionReport(
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

export function buildReflectionReport(
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