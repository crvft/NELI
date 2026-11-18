import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Partial prerendering: static shell from the CDN, cached data segments,
  // live data streamed in behind Suspense.
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Tree-shake the large icon package down to the glyphs we import.
    optimizePackageImports: ['@hugeicons/core-free-icons'],
  },
};

export default nextConfig;
