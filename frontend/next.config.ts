import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default bottom-left position collides with the sidebar's theme toggle/sign-out row.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
