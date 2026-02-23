/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@mastra/core", "@ai-sdk/google", "zod"],
}

export default nextConfig
