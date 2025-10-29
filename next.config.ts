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

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds to allow development
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
