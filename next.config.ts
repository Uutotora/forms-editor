import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['googleapis'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
