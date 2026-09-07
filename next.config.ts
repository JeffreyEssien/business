import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // Two 5 MB site images may upload in one action so Cloudinary work can run in parallel.
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
