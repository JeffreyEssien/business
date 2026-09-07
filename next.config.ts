import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Product images are validated at 5 MB; multipart encoding needs additional room.
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default nextConfig;
