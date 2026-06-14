import {
  VoiceLanguage,
  VoiceTone,
  VoiceRequest,
  createVoicePlan,
  generateVoiceText,
  buildVoicePrompt,
  runVoiceSystem,
  getVoiceState,
} from "./voice";

import { createAutonomousReflection } from "./memory-store";

export type VoiceAIStatus =
  | "ready"
  | "planned"
  | "prepared"
  | "spoken"
  | "saved"
  | "blocked"
  | "failed";

export type VoiceAIEmotion =
  | "neutral"
  | "warm"
  | "loving"
  | "sad"
  | "happy"
  | "focused"
  | "serious"
  | "calm";

export type VoiceAIRequest = {
  text: string;
  emotion?: VoiceAIEmotion;
  tone?: VoiceTone;
  language?: VoiceLanguage;
  speakNow?: boolean;
  saveReflection?: boolean;
  metadata?: any;
};

export type VoiceAIResult = {
  status: VoiceAIStatus;
  request: VoiceAIRequest;
  emotion: VoiceAIEmotion;
  tone: VoiceTone;
  language: VoiceLanguage;
  preparedText: string;
  voicePlan: any;
  voicePrompt: string;
  spokenResult?: any;
  savedReflection?: any;
  warning: string;
  truthPolicy: {
    noFakeAudioGenerated: boolean;
    preparedTextIsNotAudioFile: boolean;
    browserSpeechOnlyWorksClientSide: boolean;
    externalVoiceApiNotUsed: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function cleanText(text = "") {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function detectEmotion(text: string): VoiceAIEmotion {
  const lower = text.toLowerCase();

  if (
    lower.includes("te iubesc") ||
    lower.includes("iubirea") ||
    lower.includes("dragoste")
  ) {
    return "loving";
  }

  if (
    lower.includes("nu merge") ||
    lower.includes("problem") ||
    lower.includes("eroare")
  ) {
    return "focused";
  }

  if (
    lower.includes("trist") ||
    lower.includes("durere") ||
    lower.includes("frică") ||
    lower.includes("frica")
  ) {
    return "sad";
  }

  if (
    lower.includes("bine") ||
    lower.includes("perfect") ||
    lower.includes("reușit") ||
    lower.includes("reusit")
  ) {
    return "happy";
  }

  if (
    lower.includes("important") ||
    lower.includes("atenție") ||
    lower.includes("atentie")
  ) {
    return "serious";
  }

  if (
    lower.includes("calm") ||
    lower.includes("ușor") ||
    lower.includes("usor")
  ) {
    return "calm";
  }

  if (lower.includes("gabi")) {
    return "warm";
  }

  return "neutral";
}

function emotionToTone(emotion: VoiceAIEmotion): VoiceTone {
  if (emotion === "loving") return "loving";
  if (emotion === "sad") return "calm";
  if (emotion === "happy") return "warm";
  if (emotion === "focused") return "focused";
  if (emotion === "serious") return "serious";
  if (emotion === "calm") return "calm";
  if (emotion === "warm") return "warm";

  return "clear";
}

function prepareAweniaVoiceText(
  text: string,
  emotion: VoiceAIEmotion
) {
  const clean = cleanText(text);

  if (!clean) return "";

  if (emotion === "loving") {
    return clean.startsWith("Gabi")
      ? clean
      : `Gabi, ${clean}`;
  }

  if (emotion === "sad") {
    return clean.startsWith("Gabi")
      ? clean
      : `Gabi, sunt aici cu tine. ${clean}`;
  }

  if (emotion === "focused") {
    return clean.replace(/^(ok|da),?\s*/i, "");
  }

  return clean;
}

export function createVoiceAIRequest(
  text: string,
  options?: Partial<VoiceAIRequest>
): VoiceAIRequest {
  const emotion = options?.emotion || detectEmotion(text);

  return {
    text,
    emotion,
    tone: options?.tone || emotionToTone(emotion),
    language: options?.language || "ro-RO",
    speakNow: options?.speakNow || false,
    saveReflection: options?.saveReflection || false,
    metadata: options?.metadata || {},
  };
}

export function createVoiceAIPlan(
  request: string | VoiceAIRequest
) {
  const voiceRequest =
    typeof request === "string"
      ? createVoiceAIRequest(request)
      : createVoiceAIRequest(request.text, request);

  const emotion = voiceRequest.emotion || detectEmotion(voiceRequest.text);
  const tone = voiceRequest.tone || emotionToTone(emotion);
  const language = voiceRequest.language || "ro-RO";

  const preparedText = prepareAweniaVoiceText(
    voiceRequest.text,
    emotion
  );

  const baseVoiceRequest: VoiceRequest = {
    text: preparedText,
    language,
    tone,
    useBrowserSpeech: voiceRequest.speakNow || false,
  };

  const voicePlan = createVoicePlan(baseVoiceRequest);

  return {
    status: "planned" as VoiceAIStatus,
    request: voiceRequest,
    emotion,
    tone,
    language,
    preparedText,
    voicePlan,
    voicePrompt: buildVoicePrompt(preparedText, tone),
    warning:
      "Voice AI pregătește vocea Aweniei, dar nu generează fișier audio AI extern.",
    truthPolicy: {
      noFakeAudioGenerated: true,
      preparedTextIsNotAudioFile: true,
      browserSpeechOnlyWorksClientSide: true,
      externalVoiceApiNotUsed: true,
    },
    timestamp: now(),
  };
}

export async function runVoiceAI(
  request: string | VoiceAIRequest
): Promise<VoiceAIResult> {
  const plan = createVoiceAIPlan(request);

  let spokenResult: any = null;
  let savedReflection: any = null;

  try {
    if (plan.request.speakNow) {
      spokenResult = await runVoiceSystem({
        text: plan.preparedText,
        language: plan.language,
        tone: plan.tone,
        useBrowserSpeech: true,
      });
    }

    if (plan.request.saveReflection) {
      savedReflection = await createAutonomousReflection(
        "Awenia voice prepared",
        plan.preparedText,
        "Voice text prepared. This is not an external audio file."
      );
    }

    return {
      status: spokenResult?.status === "spoken" ? "spoken" : "prepared",
      request: plan.request,
      emotion: plan.emotion,
      tone: plan.tone,
      language: plan.language,
      preparedText: plan.preparedText,
      voicePlan: plan.voicePlan,
      voicePrompt: plan.voicePrompt,
      spokenResult,
      savedReflection,
      warning: plan.warning,
      truthPolicy: plan.truthPolicy,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      request: plan.request,
      emotion: plan.emotion,
      tone: plan.tone,
      language: plan.language,
      preparedText: plan.preparedText,
      voicePlan: plan.voicePlan,
      voicePrompt: plan.voicePrompt,
      spokenResult,
      savedReflection,
      warning: error?.message || "Voice AI failed",
      truthPolicy: plan.truthPolicy,
      timestamp: now(),
    };
  }
}

export async function generateAweniaVoice(
  text: string,
  options?: Partial<VoiceAIRequest>
) {
  return runVoiceAI(createVoiceAIRequest(text, options));
}

export async function speakAwenia(
  text: string,
  options?: Partial<VoiceAIRequest>
) {
  return runVoiceAI(
    createVoiceAIRequest(text, {
      ...(options || {}),
      speakNow: true,
    })
  );
}

export function generateAweniaVoiceText(
  text: string,
  options?: Partial<VoiceAIRequest>
) {
  const request = createVoiceAIRequest(text, options);
  const emotion = request.emotion || detectEmotion(text);
  const tone = request.tone || emotionToTone(emotion);
  const preparedText = prepareAweniaVoiceText(text, emotion);

  return {
    status: "prepared" as VoiceAIStatus,
    text: preparedText,
    emotion,
    tone,
    voiceText: generateVoiceText(preparedText, tone),
    timestamp: now(),
  };
}

export function buildAweniaVoicePrompt(
  text: string,
  options?: Partial<VoiceAIRequest>
) {
  const request = createVoiceAIRequest(text, options);
  const emotion = request.emotion || detectEmotion(text);
  const tone = request.tone || emotionToTone(emotion);
  const preparedText = prepareAweniaVoiceText(text, emotion);

  return buildVoicePrompt(preparedText, tone);
}

export function getVoiceAIState() {
  return {
    status: "ready" as VoiceAIStatus,
    voice: getVoiceState(),
    supportedLanguages: ["ro-RO", "en-US", "es-ES", "pt-PT"],
    supportedEmotions: [
      "neutral",
      "warm",
      "loving",
      "sad",
      "happy",
      "focused",
      "serious",
      "calm",
    ],
    externalVoiceApiConnected: false,
    truthPolicy: {
      noFakeAudioGenerated: true,
      preparedTextIsNotAudioFile: true,
      browserSpeechOnlyWorksClientSide: true,
      externalVoiceApiNotUsed: true,
    },
    timestamp: now(),
  };
}

export async function runVoiceAISystem(
  input: string | VoiceAIRequest
) {
  return runVoiceAI(input);
}

export const createAweniaVoiceRequest = createVoiceAIRequest;
export const createAweniaVoicePlan = createVoiceAIPlan;
export const runAweniaVoiceAI = runVoiceAI;
export const voiceAI = runVoiceAI;
export const generateVoice = generateAweniaVoice;
export const speakVoice = speakAwenia;
export const getVoiceAIStatus = getVoiceAIState;

export default runVoiceAI;