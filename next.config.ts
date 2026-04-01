import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/bin/napi-v3/darwin/**",
      "node_modules/onnxruntime-node/bin/napi-v3/win32/**",
    ],
  },
};

export default nextConfig;
