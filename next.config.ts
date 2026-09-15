import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress the NextAuth v5 redirect detection warning during build
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
