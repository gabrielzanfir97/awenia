export function generatePatch(
  filePath: string,
  searchText: string,
  replaceText: string
) {
  const isValid =
    filePath &&
    searchText &&
    replaceText &&
    searchText !== replaceText;

  return {
    valid: isValid,

    filePath,

    searchText,

    replaceText,

    patchCommand: `
PATCH_FILE: ${filePath}
---SEARCH---
${searchText}
---REPLACE---
${replaceText}
`.trim(),

    summary: isValid
      ? `Replace text in ${filePath}`
      : "Invalid patch",

    timestamp: new Date().toISOString(),
  };
}