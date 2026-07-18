import { supabase } from "@/lib/supabase";
import type { FunctionInvokeOptions } from "@supabase/supabase-js";

type InvokeAuthedOptions = Omit<FunctionInvokeOptions, "headers"> & {
  headers?: Record<string, string>;
};

export async function invokeAuthedFunction<T = unknown>(
  functionName: string,
  accessToken: string,
  options: InvokeAuthedOptions = {}
) {
  return supabase.functions.invoke<T>(functionName, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
