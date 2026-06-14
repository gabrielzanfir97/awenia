import { NextRequest, NextResponse } from "next/server";

import { callAIWithFallbackOptimized } from "@/app/ai-provider-router";

import {
  isSystemToolCommand,
  handleSystemToolCommand,
} from "@/app/system-tools-handler";

import {
  analyzeRouting,
  getSimpleReply,
} from "@/app/routing";

import {
  buildSystemPrompt,
} from "@/app/system-prompt";

import {
  buildMemoryContext,
  saveConversationMemory,
} from "@/app/memory";

import {
  saveChatTurn,
} from "@/app/chat-history";

import {
  runIntentRouter,
} from "@/app/intent-router";

import {
  detectSkill,
  buildSkillContext,
} from "@/app/skills";

import {
  runCognitionRuntime,
} from "@/app/cognition-runtime";

import {
  validateSecurityAction,
} from "@/app/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedFile = {
  name: string;
  type?: string;
  size?: number;
  content?: string;
  encoding?: "text" | "data_url";
};

type AweniaRequestBody = {
  message?: string;
  files?: UploadedFile[];
  timestamp?: string;
  source?: string;
  sessionId?: string;
};

function now() {
  return new Date().toISOString();
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
  });
}

function cleanMessage(message = "") {
  return String(message || "").trim();
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalize(text = "") {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function createFallbackReply(message: string) {
  const lower = normalize(message);

  if (
    lower === "bună" ||
    lower === "buna" ||
    lower === "salut" ||
    lower === "hey"
  ) {
    return "Bună, Gabi. Sunt aici.";
  }

  if (lower === "ok" || lower === "ok hai" || lower === "hai") {
    return "Da, Gabi. Continuăm.";
  }

  if (lower === "cine ești" || lower === "cine esti") {
    return "Sunt Awenia, AI-ul personal creat de Gabi.";
  }

  return "";
}

function detectCodeToolCommand(message: string) {
  const upper = message.trim().toUpperCase();

  return (
    upper.startsWith("LIST_FILES") ||
    upper.startsWith("READ_FILE:") ||
    upper.startsWith("READ_REAL_FILE:") ||
    upper.startsWith("ANALYZE_FILE:") ||
    upper.startsWith("ANALYZE_REAL_FILE:") ||
    upper.startsWith("WRITE_FILE:") ||
    upper.startsWith("PATCH_FILE:") ||
    upper.startsWith("EXECUTE_WRITE:") ||
    upper.startsWith("EXECUTE_PATCH:") ||
    upper.startsWith("ROLLBACK_FILE:") ||
    upper.startsWith("SEARCH_CODE:") ||
    upper.startsWith("SEARCH_INSIDE:")
  );
}

async function handleCodeToolCommand(message: string) {
  const module: any = await import("@/app/code-tools-handler");

  if (typeof module.handleCodeToolCommand === "function") {
    return module.handleCodeToolCommand(message);
  }

  if (typeof module.handleCodeCommand === "function") {
    return module.handleCodeCommand(message);
  }

  if (typeof module.default === "function") {
    return module.default(message);
  }

  return json(
    {
      reply:
        "Gabi, code-tools-handler există, dar nu am găsit funcția de comandă potrivită.",
      status: "failed",
      verified: true,
    },
    500
  );
}

function buildFilesContext(files: UploadedFile[] = []) {
  if (!files.length) return "";

  return files
    .map((file, index) => {
      const content =
        file.encoding === "data_url"
          ? "[binary/data_url file uploaded]"
          : (file.content || "").slice(0, 8000);

      return [
        `FILE ${index + 1}`,
        `Name: ${file.name}`,
        `Type: ${file.type || "unknown"}`,
        `Size: ${file.size || 0}`,
        `Encoding: ${file.encoding || "text"}`,
        "",
        content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function shouldRunCognitionForMessage(message: string) {
  const lower = normalize(message);

  if (!lower) return false;

  if (
    lower === "bună" ||
    lower === "buna" ||
    lower === "salut" ||
    lower === "ok" ||
    lower === "ok hai" ||
    lower.length <= 12
  ) {
    return false;
  }

  return (
    lower.includes("cod") ||
    lower.includes("code") ||
    lower.includes("debug") ||
    lower.includes("eroare") ||
    lower.includes("memory") ||
    lower.includes("memorie") ||
    lower.includes("internet") ||
    lower.includes("awenia") ||
    lower.includes("audit") ||
    lower.includes("proiect") ||
    lower.includes("evolu")
  );
}

async function saveSafely(input: {
  userMessage: string;
  aweniaReply: string;
  sessionId?: string;
  metadata?: any;
}) {
  const results: any = {};

  try {
    results.chat = await saveChatTurn({
      sessionId: input.sessionId || "default",
      userMessage: input.userMessage,
      aweniaReply: input.aweniaReply,
      metadata: input.metadata || {},
    } as any);
  } catch (error: any) {
    results.chat = {
      status: "failed",
      error: error?.message || "Failed to save chat turn",
    };
  }

  try {
    results.memory = await saveConversationMemory(
      input.userMessage,
      input.aweniaReply,
      {
        category: "general",
        importance: 4,
        metadata: input.metadata || {},
      } as any
    );
  } catch (error: any) {
    results.memory = {
      status: "failed",
      error: error?.message || "Failed to save conversation memory",
    };
  }

  return results;
}

async function buildAweniaMessages(input: {
  message: string;
  files: UploadedFile[];
  skill: any;
  routing: any;
  memoryContext: string;
  cognitionRuntime: any;
}) {
  const filesContext = buildFilesContext(input.files);

  const systemPrompt = buildSystemPrompt({
    mode: "chat",
    skill: input.skill?.skill || input.skill?.name || "general",
    extraContext: [
      "Reguli importante:",
      "- Răspunde în română pentru Gabi.",
      "- Nu inventa status de build, internet, Supabase sau fișiere.",
      "- Dacă ceva nu a fost verificat, spune clar că nu este verificat.",
      "- Pentru cod, lucrează pas cu pas și nu modifica fără citire/verificare.",
      "- Gabi preferă răspunsuri scurte, clare și directe.",
      "",
      "Memory context:",
      input.memoryContext || "No memory context.",
      "",
      "Routing:",
      safeStringify(input.routing).slice(0, 3000),
      "",
      "Cognition runtime summary:",
      safeStringify({
        status: input.cognitionRuntime?.status,
        mode: input.cognitionRuntime?.mode,
        summary: input.cognitionRuntime?.summary,
        recommendation: input.cognitionRuntime?.recommendation,
      }).slice(0, 3000),
    ].join("\n"),
  } as any);

  const skillContext = buildSkillContext(
    input.skill?.skill || input.skill?.name || "general"
  );

  const userContent = [
    input.message,
    filesContext ? "\n\nUploaded files:\n" + filesContext : "",
  ].join("");

  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "system",
      content: skillContext,
    },
    {
      role: "user",
      content: userContent,
    },
  ];
}

export async function POST(request: NextRequest) {
  console.time("TOTAL_POST");

  try {
    const body = (await request.json()) as AweniaRequestBody;

    const message = cleanMessage(body.message || "");
    const files = Array.isArray(body.files) ? body.files : [];
    const sessionId = body.sessionId || "default";

    if (!message && files.length === 0) {
      console.timeEnd("TOTAL_POST");

      return json(
        {
          reply: "Gabi, trimite-mi un mesaj ca să pot răspunde.",
          status: "blocked",
          verified: true,
        },
        400
      );
    }

    const earlySimpleReply =
      files.length === 0
        ? createFallbackReply(message) || getSimpleReply(message) || ""
        : "";

    if (earlySimpleReply) {
      const saveResult = await saveSafely({
        userMessage: message,
        aweniaReply: earlySimpleReply,
        sessionId,
        metadata: {
          source: body.source || "api",
          fastPath: true,
          skippedSecurityForSimpleReply: true,
        },
      });

      console.timeEnd("TOTAL_POST");

      return json({
        reply: earlySimpleReply,
        status: "completed",
        verified: true,
        fastPath: true,
        saveResult,
        timestamp: now(),
      });
    }

    const security = validateSecurityAction({
      action: "api_message",
      content: message,
      approvedByGabi: false,
      verified: true,
      reason: "Incoming Awenia API message",
    });

    if (security.blocked) {
      console.timeEnd("TOTAL_POST");

      return json(
        {
          reply:
            "Gabi, am blocat mesajul pentru siguranță. Nu execut nimic riscant fără aprobarea ta.",
          status: "blocked",
          verified: true,
          security,
        },
        403
      );
    }

    if (isSystemToolCommand(message)) {
      console.time("SYSTEM_TOOL");
      const response = await handleSystemToolCommand(message);
      console.timeEnd("SYSTEM_TOOL");
      console.timeEnd("TOTAL_POST");

      return response;
    }

    if (detectCodeToolCommand(message)) {
      console.time("CODE_TOOL");
      const response = await handleCodeToolCommand(message);
      console.timeEnd("CODE_TOOL");
      console.timeEnd("TOTAL_POST");

      return response;
    }

    let simpleReply = "";

    try {
      simpleReply = getSimpleReply(message) || "";
    } catch {
      simpleReply = createFallbackReply(message);
    }

    if (!simpleReply) {
      simpleReply = createFallbackReply(message);
    }

    if (simpleReply && files.length === 0) {
      const saveResult = await saveSafely({
        userMessage: message,
        aweniaReply: simpleReply,
        sessionId,
        metadata: {
          source: body.source || "api",
          fastPath: true,
        },
      });

      console.timeEnd("TOTAL_POST");

      return json({
        reply: simpleReply,
        status: "completed",
        verified: true,
        fastPath: true,
        saveResult,
        timestamp: now(),
      });
    }

    console.time("ROUTING_SKILL_MEMORY");

    const routing = analyzeRouting(message);
    const skill = detectSkill(message);

    const memoryContext = await buildMemoryContext(message);

    console.timeEnd("ROUTING_SKILL_MEMORY");

    let intentResult: any = null;

    try {
      console.time("INTENT_ROUTER");
      intentResult = await runIntentRouter(message, {
        execute: false,
      } as any);
      console.timeEnd("INTENT_ROUTER");
    } catch (error: any) {
      console.timeEnd("INTENT_ROUTER");
      intentResult = {
        status: "failed",
        error: error?.message || "Intent router failed",
      };
    }

    let cognitionRuntime: any = null;

    if (shouldRunCognitionForMessage(message)) {
      console.time("COGNITION_RUNTIME");

      cognitionRuntime = await runCognitionRuntime({
        message,
        activeSkill: skill?.skill || "general",
        pendingEvolutionCount: 0,
        mode: "light",
        includeInternet: false,
        includeTests: false,
        includeDeepCognition: false,
        timeoutMs: 8000,
      });

      console.timeEnd("COGNITION_RUNTIME");
    } else {
      cognitionRuntime = {
        status: "skipped",
        reason: "Simple/low-risk message",
        timestamp: now(),
      };
    }

    const aiMessages = await buildAweniaMessages({
      message,
      files,
      skill,
      routing,
      memoryContext:
        typeof memoryContext === "string"
          ? memoryContext
          : safeStringify(memoryContext),
      cognitionRuntime,
    });

    console.time("AI_CALL");

    const aiResponse = await callAIWithFallbackOptimized(aiMessages as any, {
      timeoutMs: 180000,
      temperature: 0.2,
      numCtx: 8192,
    } as any);

    console.timeEnd("AI_CALL");

    const reply =
      aiResponse?.reply ||
      aiResponse?.choices?.[0]?.message?.content ||
      aiResponse?.content ||
      "Gabi, Awenia nu a primit răspuns clar de la modelul local.";

    const saveResult = await saveSafely({
      userMessage: message,
      aweniaReply: reply,
      sessionId,
      metadata: {
        source: body.source || "api",
        routing,
        skill,
        intentStatus: intentResult?.status,
        cognitionStatus: cognitionRuntime?.status,
        aiStatus: aiResponse?.status,
      },
    });

    console.timeEnd("TOTAL_POST");

    return json({
      reply,
      status: aiResponse?.status || "completed",
      verified: true,
      routing,
      skill,
      intent: intentResult,
      cognitionRuntime,
      ai: {
        status: aiResponse?.status,
        provider: aiResponse?.provider,
        model: aiResponse?.model,
        error: aiResponse?.error,
      },
      saveResult,
      timestamp: now(),
      truthPolicy: {
        noFakeBuildStatus: true,
        noFakeInternetStatus: true,
        noFakeFileStatus: true,
        modelReplyIsNotSystemVerification: true,
      },
    });
  } catch (error: any) {
    console.timeEnd("TOTAL_POST");

    return json(
      {
        reply:
          "Gabi, a apărut o eroare în route.ts. Trimite eroarea din terminal și o reparăm exact.",
        status: "failed",
        verified: true,
        error: error?.message || "Unknown route error",
        timestamp: now(),
      },
      500
    );
  }
}

export async function GET() {
  return json({
    status: "ready",
    name: "Awenia API",
    owner: "Gabi",
    verified: true,
    warning:
      "GET verifică doar că route-ul răspunde. Nu confirmă build complet, Supabase, internet sau model local.",
    commands: [
      "CHECK_AWENIA_STATUS",
      "CHECK_PROJECT_STATE",
      "CHECK_MEMORY_SYSTEM",
      "CHECK_SUPABASE_SYSTEM",
      "CHECK_INTERNET_SYSTEM",
      "RUN_AUTONOMOUS_TESTS",
      "LIST_FILES",
      "READ_REAL_FILE: app/api/awenia/route.ts",
    ],
    truthPolicy: {
      routeRespondingIsNotFullSystemHealth: true,
      buildStatusRequiresNpmRunBuild: true,
      internetRequiresFetchCheck: true,
      supabaseRequiresQueryCheck: true,
    },
    timestamp: now(),
  });
}

function isSimpleMessage(message: string) {
  throw new Error("Function not implemented.");
}
