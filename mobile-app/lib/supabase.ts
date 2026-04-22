import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Add this temporarily for debugging
console.log("🔧 Supabase Config:", {
  hasUrl: !!supabaseUrl,
  urlLength: supabaseUrl.length,
  urlPreview: supabaseUrl.substring(0, 20) + "...",
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey.length,
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
    flowType: "pkce",
  },
  global: {
    headers: {
      "x-client-info": `tally-runner-mobile/${Platform.OS}`,
    },
  },
  // Add retry logic for network failures
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
