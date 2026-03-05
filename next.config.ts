import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xlsx'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
