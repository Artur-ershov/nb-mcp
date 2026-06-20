/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the Google GenAI SDK (and its gRPC/protobuf deps) out of the bundler so
  // it runs as a normal Node dependency inside the serverless function.
  serverExternalPackages: ["@google/genai"],
};

export default nextConfig;
