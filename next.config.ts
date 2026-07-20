import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-tools indicator out of the sidebar footer's corner.
  devIndicators: {
    position: "bottom-right",
  },
  // Static export: the packaged Electron app has no Node/Next server at
  // runtime, just the exported HTML/CSS/JS served locally — see
  // electron/main.js. Every page here is already client-rendered and talks to
  // the backend over HTTP, so there's no SSR/route-handler functionality lost.
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
