import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: [
    'nodejs-whisper',
    'shelljs',
    '@vladmandic/face-api',
    '@tensorflow/tfjs-node',
    'canvas',
  ],
};

export default nextConfig;
