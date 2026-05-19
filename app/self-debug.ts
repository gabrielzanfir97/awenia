export function analyzeError(errorText: string) {
  const lower = errorText.toLowerCase();

  if (
    lower.includes("cannot find module") ||
    lower.includes("module not found")
  ) {
    return {
      type: "missing_import",
      explanation:
        "A module import is missing or the file path is incorrect.",
      suggestedFix:
        "Check import paths and verify the file exists.",
    };
  }

  if (
    lower.includes("unexpected token") ||
    lower.includes("syntax")
  ) {
    return {
      type: "syntax_error",
      explanation:
        "There is a syntax error in the code structure.",
      suggestedFix:
        "Check brackets, commas, parentheses and TypeScript syntax.",
    };
  }

  if (
    lower.includes("undefined") ||
    lower.includes("null")
  ) {
    return {
      type: "runtime_error",
      explanation:
        "A variable or object is undefined or null.",
      suggestedFix:
        "Check variable initialization and async data flow.",
    };
  }

  if (
    lower.includes("build failed") ||
    lower.includes("failed to compile")
  ) {
    return {
      type: "build_error",
      explanation:
        "Project build failed because of TypeScript or dependency issues.",
      suggestedFix:
        "Check the latest modified files and TypeScript errors.",
    };
  }

  return {
    type: "general_error",
    explanation:
      "Unknown error detected.",
    suggestedFix:
      "Analyze logs and inspect recently modified files.",
  };
}