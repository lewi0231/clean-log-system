import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR connections from 127.0.0.1 (browser MCP uses this)
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      // Local Supabase development (kong is the API gateway service)
      {
        protocol: "http",
        hostname: "kong",
        port: "8000",
        pathname: "/storage/v1/object/public/**",
      },
      // Alternative localhost patterns for local dev
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/**",
      },
      // Production Supabase storage URLs
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Allow any supabase.co subdomain (for custom domains)
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "flowerhead",

  project: "clean-log",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // Disabled in local Turbopack dev — tunnel injection into instrumentation-edge has been
  // crashing with "module factory is not available". Production still uses /monitoring.
  // Middleware also excludes this path (see middleware.ts matcher).
  tunnelRoute: process.env.NODE_ENV === "production" ? "/monitoring" : undefined,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
