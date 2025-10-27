import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds to allow development
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
