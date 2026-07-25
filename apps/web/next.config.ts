import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@fie/break-even-engine',
    '@fie/cashflow-engine',
    '@fie/financial-engine',
    '@fie/liquidity-engine',
    '@fie/recommendation-engine',
    '@fie/risk-engine',
    '@fie/shared',
  ],
  // Engines ship ESM from dist; keep package exports as source of truth.
  experimental: {
    optimizePackageImports: ['@fie/break-even-engine', '@fie/cashflow-engine'],
  },
};

export default nextConfig;
