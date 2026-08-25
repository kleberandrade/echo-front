import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@echo-front/protocol', '@echo-front/sim'],
};

export default nextConfig;
