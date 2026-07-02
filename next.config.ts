import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker multi-stage build (produces .next/standalone)
  output: "standalone",
  // Allow cross-origin dev HMR requests from local network IP
  allowedDevOrigins: ["192.168.137.43", "100.92.213.18", "192.168.137.43:3000", "100.92.213.18:3000", "localhost:3000"],
} as any;

export default nextConfig;
