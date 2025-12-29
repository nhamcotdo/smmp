import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['typeorm', 'pg'],
};

export default nextConfig;
