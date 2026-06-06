export function shouldCreateLearningTask(message: string): boolean {
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

export function buildLearningTask(message: string): string {
  return `Learn and improve knowledge about: ${message}`;
}