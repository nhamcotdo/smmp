import type { NextConfig } from "next";
console.log(process.env.ALLOWED_DEV_ORIGINS)
const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['typeorm', 'pg'],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(',').map(s => s.trim())
    : ['127.0.0.1', 'localhost'],
};


export default nextConfig;
