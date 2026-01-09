import type { NextConfig } from "next";
console.log(process.env.ALLOWED_DEV_ORIGINS)
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Exclude TypeORM and entity files from bundling to preserve decorator metadata
  // This is critical for production builds with string-based relation decorators
  serverExternalPackages: [
    'typeorm',
    'pg',
    '@/database/entities',
  ],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(',').map(s => s.trim())
    : ['127.0.0.1', 'localhost'],
};


export default nextConfig;
