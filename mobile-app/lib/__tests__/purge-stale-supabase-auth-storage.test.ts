import { describe, it, expect, vi, beforeEach } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { purgeStaleSupabaseAuthStorage } from "@/lib/purge-stale-supabase-auth-storage";
import {
  getDefaultSupabaseAuthStorageKey,
  TALLY_RUNNER_AUTH_STORAGE_KEY,
} from "@/lib/supabase-auth-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    getAllKeys: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

describe("purgeStaleSupabaseAuthStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives default supabase-js storage keys from hostname first segment", () => {
    expect(getDefaultSupabaseAuthStorageKey("http://10.40.40.250:54321")).toBe("sb-10-auth-token");
    expect(getDefaultSupabaseAuthStorageKey("http://192.168.0.30:54321")).toBe("sb-192-auth-token");
  });

  it("removes legacy default keys but keeps the stable mobile storage key", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("http://192.168.0.30:54321");
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue([
      "sb-10-auth-token",
      "sb-10-auth-token-code-verifier",
      "sb-192-auth-token",
      TALLY_RUNNER_AUTH_STORAGE_KEY,
      "unrelated-key",
    ]);

    await purgeStaleSupabaseAuthStorage("http://192.168.0.30:54321");

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "sb-10-auth-token",
      "sb-192-auth-token",
      "sb-10-auth-token-code-verifier",
    ]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("records the current URL when it changes", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("http://10.40.40.250:54321");
    vi.mocked(AsyncStorage.getAllKeys).mockResolvedValue(["sb-10-auth-token", "sb-192-auth-token"]);

    await purgeStaleSupabaseAuthStorage("http://192.168.0.30:54321");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "tally-runner:last-supabase-url",
      "http://192.168.0.30:54321"
    );
  });
});
