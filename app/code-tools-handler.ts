import {
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
  patchProjectFile,
} from "@/app/dev-agent";

import {
  searchCodeMemory,
  getAllCodeMemories,
  saveCodeMemory,
  createImpactAwareCodeSummary,
  detectFilePurpose,
  setActiveCodeFile,
  extractExports,
  extractFunctions,
} from "@/app/code-memory";

import { saveCodeEmbedding } from "@/app/embeddings";
import { generatePatch } from "@/app/patch-generator";
import { rollbackFile } from "@/app/rollback";

async function rememberCodeFile(filePath: string, content: string) {
  await saveCodeMemory({
    file_path: filePath,
    file_purpose: detectFilePurpose(filePath, content),
    code_summary: await createImpactAwareCodeSummary(filePath, content),
    important_exports: extractExports(content).join(", "),
    important_functions: extractFunctions(content).join(", "),
    last_known_content: content.slice(0, 12000),
  });

  await saveCodeEmbedding(filePath, content);
}

export async function handleListFiles() {
  const files = await listProjectFiles();

  return Response.json({
    reply: JSON.stringify(files, null, 2),
  });
}

export async function handleSearchCodeMemory(query: string) {
  const results = await searchCodeMemory(query);

  return Response.json({
    reply: JSON.stringify(results, null, 2),
  });
}

export async function handleReadRealFile(filePath: string) {
  const content = await readProjectFile(filePath);

  setActiveCodeFile(filePath, content);
  await rememberCodeFile(filePath, content);

  return Response.json({
    reply: content,
  });
}

export async function handleReadFile(filePath: string) {
  const memoryResults = await searchCodeMemory(filePath);
  const allCodeMemories = await getAllCodeMemories();

  if (memoryResults && memoryResults.length > 0) {
    const memory = memoryResults[0];

    return Response.json({
      reply:
        "Am găsit fișierul în memoria de cod:\n\n" +
        JSON.stringify(memory, null, 2) +
        "\n\nProject code memory overview:\n\n" +
        JSON.stringify(
          allCodeMemories.map((item: any) => ({
            file_path: item.file_path,
            file_purpose: item.file_purpose,
            code_summary: item.code_summary,
            important_exports: item.important_exports,
            important_functions: item.important_functions,
          })),
          null,
          2
        ),
    });
  }

  const content = await readProjectFile(filePath);

  setActiveCodeFile(filePath, content);
  await rememberCodeFile(filePath, content);

  return Response.json({
    reply: content,
  });
}

export async function handleWriteFile(message: string) {
  const parts = message.split("---CONTENT---");

  const filePath = parts[0].replace("WRITE_FILE:", "").trim();
  const content = parts[1]?.trim();

  if (!filePath || !content) {
    return Response.json({
      reply:
        "Format greșit. Folosește WRITE_FILE: app/file.ts ---CONTENT--- codul aici",
    });
  }

  const result = await writeProjectFile(filePath, content);

  setActiveCodeFile(filePath, content);
  await rememberCodeFile(filePath, content);

  return Response.json({
    reply: `Fișier modificat: ${filePath}\nBackup: ${result.backup}`,
  });
}

export async function handlePatchFile(message: string) {
  const parts = message.split("---SEARCH---");

  const filePath = parts[0].replace("PATCH_FILE:", "").trim();
  const searchAndReplace = parts[1]?.split("---REPLACE---");
  const searchText = searchAndReplace?.[0]?.trim();
  const replaceText = searchAndReplace?.[1]?.trim();

  if (!filePath || !searchText || !replaceText) {
    return Response.json({
      reply: "Format greșit pentru PATCH_FILE.",
    });
  }

  const result = await patchProjectFile(filePath, searchText, replaceText);
  const updatedContent = await readProjectFile(filePath);

  setActiveCodeFile(filePath, updatedContent);
  await rememberCodeFile(filePath, updatedContent);

  return Response.json({
    reply: `Patch aplicat: ${filePath}\nBackup: ${result.backup}`,
  });
}

export async function handleAnalyzeRealFile(
  filePath: string,
  callAI: (messages: any[]) => Promise<any>
) {
  const content = await readProjectFile(filePath);

  setActiveCodeFile(filePath, content);
  await rememberCodeFile(filePath, content);

  const response = await callAI([
    {
      role: "system",
      content: `
Ești Awenia, asistent de programare pentru Gabi.

Analizează DOAR codul primit mai jos.
Nu inventa cod.
Nu folosi memorii.
Găsește buguri reale, optimizări reale și patch concret.
Răspunde în română.

FIȘIER:
${filePath}

COD:
${content.slice(0, 12000)}
`,
    },
    {
      role: "user",
      content:
        "Analizează acest fișier. Găsește un bug real, explică-l și propune un patch. Nu modifica nimic fără aprobarea mea.",
    },
  ]);

  return Response.json({
    reply: response.choices[0].message.content || "Nu am găsit analiză.",
  });
}

export async function handleGeneratePatch(message: string) {
  const parts = message.split("---");

  const filePath = parts[1]?.trim();
  const searchText = parts[2]?.trim();
  const replaceText = parts[3]?.trim();

  if (!filePath || !searchText || !replaceText) {
    return Response.json({
      reply:
        "Format: GENERATE_PATCH: --- filePath --- searchText --- replaceText",
    });
  }

  const patch = generatePatch(filePath, searchText, replaceText);

  return Response.json({
    reply: patch,
  });
}

export async function handleRollbackFile(filePath: string) {
  const result = await rollbackFile(filePath, filePath);

  return Response.json({
    reply: JSON.stringify(result, null, 2),
  });
}