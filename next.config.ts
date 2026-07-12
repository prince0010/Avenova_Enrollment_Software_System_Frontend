import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-tools indicator out of the sidebar footer's corner.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
