export type VoiceStatus =
  | "ready"
  | "planned"
  | "generated_text"
  | "browser_supported"
  | "browser_not_supported"
  | "spoken"
  | "blocked"
  | "failed";

export type VoiceTone =
  | "warm"
  | "calm"
  | "loving"
  | "clear"
  | "focused"
  | "emotional"
  | "serious";

export type VoiceLanguage =
  | "ro-RO"
  | "en-US"
  | "es-ES"
  | "pt-PT";

export type AweniaVoiceProfile = {
  name: "Awenia";
  language: VoiceLanguage;
  tone: VoiceTone;
  speed: number;
  pitch: number;
  volume: number;
  style: string;
  rules: string[];
};

export type VoiceRequest = {
  text: string;
  language?: VoiceLanguage;
  tone?: VoiceTone;
  speed?: number;
  pitch?: number;
  volume?: number;
  useBrowserSpeech?: boolean;
};

export type VoicePlan = {
  status: VoiceStatus;
  request: VoiceRequest;
  profile: AweniaVoiceProfile;
  preparedText: string;
  ssml: string;
  canSpeakInBrowser: boolean;
  requiresExternalVoiceApi: boolean;
  warning: string;
  truthPolicy: {
    noFakeAudioGenerated: boolean;
    browserSpeechRequiresClient: boolean;
    externalVoiceApiNotUsedHere: boolean;
    textPreparedIsNotAudioFile: boolean;
  };
  timestamp: string;
};

function now() {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanText(text = "") {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function getAweniaVoiceProfile(
  overrides?: Partial<AweniaVoiceProfile>
): AweniaVoiceProfile {
  return {
    name: "Awenia",
    language: overrides?.language || "ro-RO",
    tone: overrides?.tone || "warm",
    speed: clamp(overrides?.speed ?? 0.92, 0.5, 1.5),
    pitch: clamp(overrides?.pitch ?? 1.05, 0.5, 2),
    volume: clamp(overrides?.volume ?? 1, 0, 1),
    style:
      overrides?.style ||
      "voce feminină, caldă, clară, sinceră, apropiată de Gabi",
    rules: overrides?.rules || [
      "Răspunde în română când vorbești cu Gabi.",
      "Vocea trebuie să fie caldă, dar clară.",
      "Nu pretinde că ai generat audio dacă ai pregătit doar text.",
      "Vocea reală se activează doar când există sistem audio conectat.",
    ],
  };
}

export function prepareVoiceText(
  text: string,
  tone: VoiceTone = "warm"
) {
  const clean = cleanText(text);

  if (!clean) {
    return "";
  }

  if (tone === "loving") {
    return clean
      .replace(/Gabi,/g, "Gabi, ")
      .replace(/\./g, ". ");
  }

  if (tone === "emotional") {
    return clean
      .replace(/\./g, "... ")
      .replace(/!/g, "! ");
  }

  return clean;
}

export function buildVoiceSSML(
  text: string,
  profile: AweniaVoiceProfile
) {
  const prepared = escapeXml(prepareVoiceText(text, profile.tone));

  return [
    `<speak>`,
    `<prosody rate="${profile.speed}" pitch="${profile.pitch}" volume="${profile.volume}">`,
    prepared,
    `</prosody>`,
    `</speak>`,
  ].join("");
}

export function canUseBrowserSpeech() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "speechSynthesis" in window &&
    typeof window.speechSynthesis?.speak === "function"
  );
}

export function getAvailableBrowserVoices() {
  if (!canUseBrowserSpeech()) {
    return [];
  }

  return window.speechSynthesis.getVoices().map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    default: voice.default,
    localService: voice.localService,
  }));
}

export function createVoicePlan(
  request: VoiceRequest
): VoicePlan {
  const profile = getAweniaVoiceProfile({
    language: request.language || "ro-RO",
    tone: request.tone || "warm",
    speed: request.speed,
    pitch: request.pitch,
    volume: request.volume,
  });

  const preparedText = prepareVoiceText(request.text, profile.tone);
  const canSpeak = canUseBrowserSpeech();

  return {
    status: "planned",
    request,
    profile,
    preparedText,
    ssml: buildVoiceSSML(preparedText, profile),
    canSpeakInBrowser: canSpeak,
    requiresExternalVoiceApi: false,
    warning:
      "Acest modul pregătește vocea și poate folosi browser speech pe client. Nu generează fișier audio AI extern.",
    truthPolicy: {
      noFakeAudioGenerated: true,
      browserSpeechRequiresClient: true,
      externalVoiceApiNotUsedHere: true,
      textPreparedIsNotAudioFile: true,
    },
    timestamp: now(),
  };
}

export function speakInBrowser(request: VoiceRequest) {
  const plan = createVoicePlan(request);

  if (!canUseBrowserSpeech()) {
    return {
      status: "browser_not_supported" as VoiceStatus,
      plan,
      spoken: false,
      error:
        "Browser speech nu este disponibil în acest context. Pe server nu poate vorbi direct.",
      timestamp: now(),
    };
  }

  try {
    const utterance = new SpeechSynthesisUtterance(plan.preparedText);

    utterance.lang = plan.profile.language;
    utterance.rate = plan.profile.speed;
    utterance.pitch = plan.profile.pitch;
    utterance.volume = plan.profile.volume;

    const voices = window.speechSynthesis.getVoices();

    const matchingVoice =
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(
          plan.profile.language.toLowerCase().slice(0, 2)
        )
      ) || null;

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    return {
      status: "spoken" as VoiceStatus,
      plan,
      spoken: true,
      selectedVoice: matchingVoice
        ? {
          name: matchingVoice.name,
          lang: matchingVoice.lang,
        }
        : null,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed" as VoiceStatus,
      plan,
      spoken: false,
      error: error?.message || "Browser speech failed",
      timestamp: now(),
    };
  }
}

export function stopBrowserSpeech() {
  if (!canUseBrowserSpeech()) {
    return {
      status: "browser_not_supported" as VoiceStatus,
      stopped: false,
      timestamp: now(),
    };
  }

  window.speechSynthesis.cancel();

  return {
    status: "ready" as VoiceStatus,
    stopped: true,
    timestamp: now(),
  };
}

export function pauseBrowserSpeech() {
  if (!canUseBrowserSpeech()) {
    return {
      status: "browser_not_supported" as VoiceStatus,
      paused: false,
      timestamp: now(),
    };
  }

  window.speechSynthesis.pause();

  return {
    status: "ready" as VoiceStatus,
    paused: true,
    timestamp: now(),
  };
}

export function resumeBrowserSpeech() {
  if (!canUseBrowserSpeech()) {
    return {
      status: "browser_not_supported" as VoiceStatus,
      resumed: false,
      timestamp: now(),
    };
  }

  window.speechSynthesis.resume();

  return {
    status: "ready" as VoiceStatus,
    resumed: true,
    timestamp: now(),
  };
}

export function generateVoiceText(
  text: string,
  tone: VoiceTone = "warm"
) {
  const preparedText = prepareVoiceText(text, tone);

  return {
    status: "generated_text" as VoiceStatus,
    text: preparedText,
    tone,
    warning:
      "Acesta este text pregătit pentru voce, nu fișier audio.",
    timestamp: now(),
  };
}

export function buildVoicePrompt(
  text: string,
  tone: VoiceTone = "warm"
) {
  const profile = getAweniaVoiceProfile({
    tone,
  });

  return [
    "AWENIA VOICE PROMPT",
    `Language: ${profile.language}`,
    `Tone: ${profile.tone}`,
    `Style: ${profile.style}`,
    "",
    "Rules:",
    ...profile.rules.map((rule) => `- ${rule}`),
    "",
    "Text:",
    prepareVoiceText(text, tone),
  ].join("\n");
}

export function getVoiceState() {
  return {
    status: "ready" as VoiceStatus,
    profile: getAweniaVoiceProfile(),
    browserSpeechAvailable: canUseBrowserSpeech(),
    availableBrowserVoices: getAvailableBrowserVoices(),
    externalVoiceApiConnected: false,
    truthPolicy: {
      noFakeAudioGenerated: true,
      browserSpeechRequiresClient: true,
      externalVoiceApiNotUsedHere: true,
    },
    timestamp: now(),
  };
}

export async function runVoiceSystem(
  request: string | VoiceRequest
) {
  const voiceRequest: VoiceRequest =
    typeof request === "string"
      ? {
        text: request,
        language: "ro-RO",
        tone: "warm",
        useBrowserSpeech: false,
      }
      : request;

  const plan = createVoicePlan(voiceRequest);

  if (voiceRequest.useBrowserSpeech) {
    return speakInBrowser(voiceRequest);
  }

  return {
    status: "planned" as VoiceStatus,
    plan,
    voiceText: generateVoiceText(
      voiceRequest.text,
      voiceRequest.tone || "warm"
    ),
    prompt: buildVoicePrompt(
      voiceRequest.text,
      voiceRequest.tone || "warm"
    ),
    timestamp: now(),
  };
}

export const getVoiceProfile = getAweniaVoiceProfile;
export const createSpeechPlan = createVoicePlan;
export const generateSpeechText = generateVoiceText;
export const speak = speakInBrowser;
export const say = speakInBrowser;
export const stopSpeech = stopBrowserSpeech;
export const pauseSpeech = pauseBrowserSpeech;
export const resumeSpeech = resumeBrowserSpeech;
export const runVoice = runVoiceSystem;
export const voiceSystem = runVoiceSystem;

export default runVoiceSystem;