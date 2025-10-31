import type { NextConfig } from "next";
import createNextPwa from 'next-pwa';

const withPWA = createNextPwa({
  dest: 'public',
  // By default, disable PWA in dev to avoid SW caching issues.
  // Set PWA_DEV=true to enable PWA while running `next dev`.
  disable: process.env.NODE_ENV === 'development' && process.env.PWA_DEV !== 'true',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds to allow development
    ignoreDuringBuilds: true,
  },
  // Silence upcoming dev change by explicitly allowing common loopback origins
  experimental: {
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://0.0.0.0:3000'
    ]
  },
};

export default withPWA(nextConfig);
