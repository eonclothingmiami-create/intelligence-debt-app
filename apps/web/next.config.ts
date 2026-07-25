import type { NextConfig } from 'next';

/**
 * GitHub Pages project site: set NEXT_PUBLIC_BASE_PATH=/intelligence-debt-app
 * Local/dev: leave unset.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath
    ? {
        basePath,
        assetPrefix: basePath,
      }
    : {}),
  transpilePackages: [
    '@fie/break-even-engine',
    '@fie/cashflow-engine',
    '@fie/debt-manager',
    '@fie/erp-integration',
    '@fie/financial-engine',
    '@fie/liquidity-engine',
    '@fie/recommendation-engine',
    '@fie/risk-engine',
    '@fie/shared',
  ],
  experimental: {
    optimizePackageImports: ['@fie/break-even-engine', '@fie/cashflow-engine'],
  },
};

export default nextConfig;
