import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();

const BLOCKED = [
  ".env",
  ".env.local",
  ".git",
  "node_modules",
  "app/protected-core.ts",
];

function isBlocked(target: string) {
  return BLOCKED.some((item) => target.includes(item));
}

export async function readProjectFile(filePath: string) {
  const fullPath = path.join(ROOT, filePath);

  if (isBlocked(fullPath)) {
    throw new Error("Access denied.");
  }

  return await fs.readFile(fullPath, "utf-8");
}

export async function writeProjectFile(
  filePath: string,
  content: string
) {
  const fullPath = path.join(ROOT, filePath);

  if (isBlocked(fullPath)) {
    throw new Error("Access denied.");
  }

  const backupPath = fullPath + ".backup";

  try {
    const oldContent = await fs.readFile(fullPath, "utf-8");

    await fs.writeFile(backupPath, oldContent);
  } catch {}

  await fs.writeFile(fullPath, content);

  return {
    success: true,
    backup: backupPath,
  };
}

export async function listProjectFiles(folder = "app") {
  const fullPath = path.join(ROOT, folder);

  if (isBlocked(fullPath)) {
    throw new Error("Access denied.");
  }

  return await fs.readdir(fullPath);
}

export async function patchProjectFile(
  filePath: string,
  searchText: string,
  replaceText: string
) {
  const fullPath = path.join(ROOT, filePath);

  if (isBlocked(fullPath)) {
    throw new Error("Access denied.");
  }

  const oldContent = await fs.readFile(fullPath, "utf-8");

  if (!oldContent.includes(searchText)) {
    throw new Error("Search text not found.");
  }

  const backupPath = fullPath + ".backup";

  await fs.writeFile(backupPath, oldContent);

  const newContent = oldContent.replace(
    searchText,
    replaceText
  );

  await fs.writeFile(fullPath, newContent);

  return {
    success: true,
    backup: backupPath,
  };
}