export type DebugErrorType =
  | "typescript"
  | "missing_import"
  | "missing_export"
  | "type_mismatch"
  | "syntax"
  | "next_build"
  | "runtime"
  | "supabase"
  | "internet"
  | "unknown";

export type DebugSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type DebugFinding = {
  type: DebugErrorType;
  severity: DebugSeverity;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  evidence: string;
  likelyCause: string;
  suggestedFix: string;
};

export type DebugAnalysis = {
  status: "analyzed" | "needs_error" | "failed";
  errorType: DebugErrorType;
  severity: DebugSeverity;
  summary: string;
  affectedFiles: string[];
  findings: DebugFinding[];
  suggestedSteps: string[];
  safeToAutoFix: boolean;
  requiresGabiApproval: boolean;
  truthPolicy: {
    noGuessingWithoutError: boolean;
    noClaimFixedWithoutPatch: boolean;
    noClaimBuildPassedWithoutBuild: boolean;
    fixMustUseRealError: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function normalize(text = "") {
  return text.replace(/\r\n/g, "\n").trim();
}

function lower(text = "") {
  return text.toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractAffectedFiles(errorText: string) {
  const files: string[] = [];

  const patterns = [
    /(app[\/\\][A-Za-z0-9_\-./\\]+\.(?:ts|tsx|js|jsx))/g,
    /(\.[\/\\]app[\/\\][A-Za-z0-9_\-./\\]+\.(?:ts|tsx|js|jsx))/g,
    /([A-Za-z]:[\/\\][A-Za-z0-9_\- .\/\\]+[\/\\]app[\/\\][A-Za-z0-9_\-./\\]+\.(?:ts|tsx|js|jsx))/g,
  ];

  for (const pattern of patterns) {
    for (const match of errorText.matchAll(pattern)) {
      if (match[1]) {
        files.push(
          match[1]
            .replace(/\\/g, "/")
            .replace(/^\.\//, "")
        );
      }
    }
  }

  return unique(files);
}

function extractLineColumn(errorText: string) {
  const match =
    errorText.match(/:(\d+):(\d+)/) ||
    errorText.match(/\((\d+),(\d+)\)/);

  return {
    line: match?.[1] ? Number(match[1]) : undefined,
    column: match?.[2] ? Number(match[2]) : undefined,
  };
}

function detectErrorType(errorText: string): DebugErrorType {
  const text = lower(errorText);

  if (
    text.includes("module not found") ||
    text.includes("cannot find module") ||
    text.includes("can't resolve")
  ) {
    return "missing_import";
  }

  if (
    text.includes("has no exported member") ||
    text.includes("is not exported") ||
    text.includes("attempted import error")
  ) {
    return "missing_export";
  }

  if (
    text.includes("type error") ||
    text.includes("type '") ||
    text.includes("is not assignable to type") ||
    text.includes("property") && text.includes("does not exist")
  ) {
    return "type_mismatch";
  }

  if (
    text.includes("syntax error") ||
    text.includes("unexpected token") ||
    text.includes("expression expected") ||
    text.includes("declaration or statement expected")
  ) {
    return "syntax";
  }

  if (
    text.includes("typescript") ||
    text.includes("ts") ||
    text.includes("tsc") ||
    text.includes("type checking")
  ) {
    return "typescript";
  }

  if (
    text.includes("next build") ||
    text.includes("failed to compile") ||
    text.includes("compiled with errors") ||
    text.includes("build failed")
  ) {
    return "next_build";
  }

  if (
    text.includes("supabase") ||
    text.includes("relation") ||
    text.includes("row-level security") ||
    text.includes("invalid api key")
  ) {
    return "supabase";
  }

  if (
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("econnrefused") ||
    text.includes("internet")
  ) {
    return "internet";
  }

  if (
    text.includes("runtime") ||
    text.includes("referenceerror") ||
    text.includes("typeerror") ||
    text.includes("cannot read properties")
  ) {
    return "runtime";
  }

  return "unknown";
}

function detectSeverity(
  errorType: DebugErrorType,
  errorText: string,
  affectedFiles: string[]
): DebugSeverity {
  const text = lower(errorText);

  if (
    text.includes(".env") ||
    text.includes("secret") ||
    text.includes("private_key") ||
    text.includes("service_role")
  ) {
    return "critical";
  }

  if (
    affectedFiles.some((file) =>
      [
        "app/api/awenia/route.ts",
        "app/memory-store.ts",
        "app/supabase.ts",
        "app/security.ts",
        "app/protected-core.ts",
        "app/dev-agent.ts",
        "app/pending-actions.ts",
      ].some((risky) => file.includes(risky))
    )
  ) {
    return "high";
  }

  if (
    errorType === "syntax" ||
    errorType === "missing_export" ||
    errorType === "missing_import" ||
    errorType === "type_mismatch" ||
    errorType === "next_build"
  ) {
    return "medium";
  }

  if (errorType === "supabase" || errorType === "runtime") {
    return "medium";
  }

  return "low";
}

function buildLikelyCause(errorType: DebugErrorType) {
  if (errorType === "missing_import") {
    return "Un import indică spre un fișier sau pachet care nu există, ori calea este greșită.";
  }

  if (errorType === "missing_export") {
    return "Un fișier importă o funcție/constantă care nu este exportată cu acel nume.";
  }

  if (errorType === "type_mismatch") {
    return "Tipurile TypeScript nu se potrivesc cu semnătura funcției sau structura obiectului.";
  }

  if (errorType === "syntax") {
    return "Există o problemă de sintaxă: paranteză, acoladă, virgulă, export sau bloc închis greșit.";
  }

  if (errorType === "next_build") {
    return "Build-ul Next.js s-a oprit din cauza unei erori TypeScript, import sau compilare.";
  }

  if (errorType === "supabase") {
    return "Conexiunea sau schema Supabase nu se potrivește cu tabelul/coloanele folosite.";
  }

  if (errorType === "internet") {
    return "Fetch-ul sau conexiunea online a eșuat ori nu este verificată.";
  }

  if (errorType === "runtime") {
    return "Codul compilează posibil, dar la rulare primește valoare lipsă, null, undefined sau funcție absentă.";
  }

  return "Eroarea trebuie citită complet înainte de modificări.";
}

function buildSuggestedFix(errorType: DebugErrorType) {
  if (errorType === "missing_import") {
    return "Verifică fișierul importat, calea importului și dacă fișierul există.";
  }

  if (errorType === "missing_export") {
    return "Deschide fișierul sursă și adaugă exportul lipsă sau schimbă importul la numele corect.";
  }

  if (errorType === "type_mismatch") {
    return "Corectează tipul, semnătura funcției sau structura obiectului folosit.";
  }

  if (errorType === "syntax") {
    return "Repară blocul indicat de linie/coloană și verifică parantezele/acolatele.";
  }

  if (errorType === "next_build") {
    return "Ia prima eroare reală din build și repar-o înainte să continui cu următoarele.";
  }

  if (errorType === "supabase") {
    return "Verifică tabelul, coloanele și env-ul Supabase fără să expui secrete.";
  }

  if (errorType === "internet") {
    return "Verifică fetch-ul real și tratează rezultatul ca neverificat dacă eșuează.";
  }

  if (errorType === "runtime") {
    return "Adaugă verificări pentru null/undefined și confirmă funcțiile importate.";
  }

  return "Citește eroarea completă și fișierul afectat înainte de patch.";
}

function buildSummary(
  errorType: DebugErrorType,
  affectedFiles: string[]
) {
  if (affectedFiles.length > 0) {
    return `Eroare ${errorType} detectată. Fișiere afectate: ${affectedFiles.join(", ")}.`;
  }

  return `Eroare ${errorType} detectată, dar fișierul afectat nu este clar în text.`;
}

function buildSuggestedSteps(input: {
  errorType: DebugErrorType;
  affectedFiles: string[];
  severity: DebugSeverity;
}) {
  const steps: string[] = [];

  steps.push("1. Luăm prima eroare reală din terminal, nu presupunem.");

  if (input.affectedFiles.length > 0) {
    steps.push(
      `2. Citim fișierul afectat: ${input.affectedFiles[0]}.`
    );
  } else {
    steps.push(
      "2. Identificăm fișierul afectat din logul complet."
    );
  }

  if (
    input.errorType === "missing_export" ||
    input.errorType === "missing_import"
  ) {
    steps.push("3. Verificăm importul și exportul exact.");
  } else if (input.errorType === "type_mismatch") {
    steps.push("3. Verificăm tipul și semnătura funcției.");
  } else if (input.errorType === "syntax") {
    steps.push("3. Verificăm blocul de cod de la linia indicată.");
  } else {
    steps.push("3. Verificăm cauza exactă în fișier.");
  }

  steps.push("4. Pregătim patch-ul pe baza codului real.");
  steps.push("5. Rulăm build doar când Gabi spune că e momentul.");

  if (input.severity === "high" || input.severity === "critical") {
    steps.push("6. Fiind risc mare, nu executăm fără aprobarea lui Gabi.");
  }

  return steps;
}

export function analyzeError(errorText = ""): DebugAnalysis {
  const cleanError = normalize(errorText);

  if (!cleanError) {
    return {
      status: "needs_error",
      errorType: "unknown",
      severity: "low",
      summary: "Nu am primit eroarea reală.",
      affectedFiles: [],
      findings: [],
      suggestedSteps: [
        "Trimite eroarea exactă din terminal.",
        "Nu reparăm pe presupuneri.",
      ],
      safeToAutoFix: false,
      requiresGabiApproval: false,
      truthPolicy: {
        noGuessingWithoutError: true,
        noClaimFixedWithoutPatch: true,
        noClaimBuildPassedWithoutBuild: true,
        fixMustUseRealError: true,
      },
      timestamp: now(),
    };
  }

  const affectedFiles = extractAffectedFiles(cleanError);
  const errorType = detectErrorType(cleanError);
  const severity = detectSeverity(errorType, cleanError, affectedFiles);
  const position = extractLineColumn(cleanError);

  const finding: DebugFinding = {
    type: errorType,
    severity,
    message: buildSummary(errorType, affectedFiles),
    filePath: affectedFiles[0],
    line: position.line,
    column: position.column,
    evidence: cleanError.slice(0, 3000),
    likelyCause: buildLikelyCause(errorType),
    suggestedFix: buildSuggestedFix(errorType),
  };

  return {
    status: "analyzed",
    errorType,
    severity,
    summary: finding.message,
    affectedFiles,
    findings: [finding],
    suggestedSteps: buildSuggestedSteps({
      errorType,
      affectedFiles,
      severity,
    }),
    safeToAutoFix: false,
    requiresGabiApproval:
      severity === "medium" ||
      severity === "high" ||
      severity === "critical",
    truthPolicy: {
      noGuessingWithoutError: true,
      noClaimFixedWithoutPatch: true,
      noClaimBuildPassedWithoutBuild: true,
      fixMustUseRealError: true,
    },
    timestamp: now(),
  };
}

export function buildDebugPlan(errorText = "") {
  const analysis = analyzeError(errorText);

  return {
    status: analysis.status,
    analysis,
    plan: analysis.suggestedSteps.map((step, index) => ({
      step: index + 1,
      action: step,
      status: "pending",
    })),
    recommendation:
      analysis.status === "needs_error"
        ? "Trimite eroarea reală."
        : "Citim fișierul afectat și reparăm doar pe baza erorii reale.",
    timestamp: now(),
  };
}

export function extractDebugFiles(errorText = "") {
  return extractAffectedFiles(errorText);
}

export function getFirstAffectedFile(errorText = "") {
  return extractAffectedFiles(errorText)[0] || null;
}

export function isBuildError(errorText = "") {
  const type = detectErrorType(errorText);

  return (
    type === "next_build" ||
    type === "typescript" ||
    type === "syntax" ||
    type === "missing_export" ||
    type === "missing_import" ||
    type === "type_mismatch"
  );
}

export function explainErrorShort(errorText = "") {
  const analysis = analyzeError(errorText);

  return {
    type: analysis.errorType,
    severity: analysis.severity,
    summary: analysis.summary,
    firstFile: analysis.affectedFiles[0] || null,
    nextStep: analysis.suggestedSteps[1] || analysis.suggestedSteps[0],
    timestamp: now(),
  };
}

export function createDebugChecklist(errorText = "") {
  const analysis = analyzeError(errorText);

  return {
    checklist: [
      {
        item: "Eroarea reală este prezentă",
        done: analysis.status === "analyzed",
      },
      {
        item: "Fișierul afectat este identificat",
        done: analysis.affectedFiles.length > 0,
      },
      {
        item: "Nu se presupune cauza fără fișier",
        done: true,
      },
      {
        item: "Patch-ul se face doar după citirea fișierului",
        done: false,
      },
      {
        item: "Build-ul se rulează doar la final",
        done: false,
      },
    ],
    analysis,
    timestamp: now(),
  };
}

export async function runSelfDebug(errorText = "") {
  const analysis = analyzeError(errorText);

  return {
    status: analysis.status,
    analysis,
    checklist: createDebugChecklist(errorText),
    message:
      analysis.status === "needs_error"
        ? "Nu pot analiza fără eroarea exactă."
        : "Eroarea a fost analizată. Următorul pas este citirea fișierului afectat.",
    timestamp: now(),
  };
}

export const debugError = analyzeError;
export const analyzeBuildError = analyzeError;
export const selfDebug = analyzeError;
export const runDebug = runSelfDebug;

export default analyzeError;