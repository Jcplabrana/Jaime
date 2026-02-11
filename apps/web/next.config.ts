import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Standalone output for Docker deployment
  output: "standalone",

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {},

  // Optimize imports for tree-shaking heavy icon libraries
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
    ],
  },

  // Webpack customizations for bundle optimization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Externalize large optional deps that are server-only
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
