import fs from "fs/promises";

export async function rollbackFile(
  backupPath: string,
  targetPath: string
) {
  const backupContent = await fs.readFile(
    backupPath,
    "utf-8"
  );

  await fs.writeFile(
    targetPath,
    backupContent,
    "utf-8"
  );

  return {
    success: true,
    restored: targetPath,
    backup: backupPath,
  };
}