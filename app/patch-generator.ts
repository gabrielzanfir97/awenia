export function generatePatch(
  filePath: string,
  searchText: string,
  replaceText: string
) {
  return `
PATCH_FILE: ${filePath}
---SEARCH---
${searchText}
---REPLACE---
${replaceText}
  `.trim();
}