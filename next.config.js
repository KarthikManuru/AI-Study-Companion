/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'bcryptjs', 'bullmq', 'ioredis'],
  },
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
