"use strict";

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://test.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key-for-vitest";

const Module = require("module");

const origRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === "react-native") {
    return origRequire.call(this, "react-native-web");
  }
  return origRequire.apply(this, arguments);
};
