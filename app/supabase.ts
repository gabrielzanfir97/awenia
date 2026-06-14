import { createClient } from "@supabase/supabase-js";

export type SupabaseConnectionStatus =
  | "configured"
  | "missing_env"
  | "connected"
  | "failed";

export type SupabaseHealthResult = {
  status: SupabaseConnectionStatus;
  configured: boolean;
  connected: boolean;
  urlPresent: boolean;
  keyPresent: boolean;
  tableChecked?: string;
  error?: string;
  timestamp: string;
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const FALLBACK_SUPABASE_URL =
  "https://placeholder.supabase.co";

const FALLBACK_SUPABASE_KEY =
  "placeholder-key";

function now() {
  return new Date().toISOString();
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export function getSupabaseConfig() {
  return {
    configured: isSupabaseConfigured(),
    urlPresent: Boolean(SUPABASE_URL),
    keyPresent: Boolean(SUPABASE_KEY),
    urlPreview: SUPABASE_URL
      ? `${SUPABASE_URL.slice(0, 28)}...`
      : null,
    keyPreview: SUPABASE_KEY
      ? `${SUPABASE_KEY.slice(0, 8)}...`
      : null,
    timestamp: now(),
  };
}

export const supabase = createClient(
  SUPABASE_URL || FALLBACK_SUPABASE_URL,
  SUPABASE_KEY || FALLBACK_SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "x-awenia-client": "local-awenia",
      },
    },
  }
);

export async function checkSupabaseHealth(
  tableName = "memories"
): Promise<SupabaseHealthResult> {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return {
      status: "missing_env",
      configured: false,
      connected: false,
      urlPresent: Boolean(SUPABASE_URL),
      keyPresent: Boolean(SUPABASE_KEY),
      tableChecked: tableName,
      error:
        "Supabase env variables are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      timestamp: now(),
    };
  }

  try {
    const { error } = await supabase
      .from(tableName)
      .select("id")
      .limit(1);

    if (error) {
      return {
        status: "failed",
        configured: true,
        connected: false,
        urlPresent: true,
        keyPresent: true,
        tableChecked: tableName,
        error: error.message,
        timestamp: now(),
      };
    }

    return {
      status: "connected",
      configured: true,
      connected: true,
      urlPresent: true,
      keyPresent: true,
      tableChecked: tableName,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      status: "failed",
      configured: true,
      connected: false,
      urlPresent: true,
      keyPresent: true,
      tableChecked: tableName,
      error: error?.message || "Unknown Supabase connection error",
      timestamp: now(),
    };
  }
}

export async function checkSupabaseTables(
  tableNames = [
    "memories",
    "chat_history",
    "permanent_memory",
    "project_code_memory",
    "pending_actions",
  ]
) {
  const results = [];

  for (const tableName of tableNames) {
    results.push(await checkSupabaseHealth(tableName));
  }

  const failed = results.filter((item) => item.status === "failed");
  const connected = results.filter((item) => item.status === "connected");

  return {
    status:
      failed.length === 0 && connected.length > 0
        ? "connected"
        : connected.length > 0
          ? "partial"
          : "failed",

    configured: isSupabaseConfigured(),

    connectedTables: connected.length,

    failedTables: failed.length,

    results,

    timestamp: now(),
  };
}

export async function safeSupabaseRead<T>(
  reader: () => Promise<T>,
  fallback: T
) {
  try {
    return {
      data: await reader(),
      status: "connected",
      error: null,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      data: fallback,
      status: "failed",
      error: error?.message || "Unknown Supabase read error",
      timestamp: now(),
    };
  }
}

export async function safeSupabaseWrite<T>(
  writer: () => Promise<T>
) {
  try {
    return {
      data: await writer(),
      status: "completed",
      error: null,
      timestamp: now(),
    };
  } catch (error: any) {
    return {
      data: null,
      status: "failed",
      error: error?.message || "Unknown Supabase write error",
      timestamp: now(),
    };
  }
}

export function getSupabaseState() {
  return {
    status: isSupabaseConfigured()
      ? "configured"
      : "missing_env",

    configured: isSupabaseConfigured(),

    config: getSupabaseConfig(),

    truthPolicy: {
      noFakeConnectionStatus: true,
      connectionMustBeCheckedWithQuery: true,
      envPresenceIsNotSameAsDatabaseConnection: true,
    },

    timestamp: now(),
  };
}