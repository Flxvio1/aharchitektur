import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Files in public/ are served with `max-age=0` by default, which means a
    // sequence costs hundreds of revalidation round trips on every visit — the
    // latency of that is felt on a phone far more than on a desktop. The frames
    // are regenerated rarely and only by `bun run frames`, so a week of
    // freshness is safe and any regeneration self-heals well within that.
    const frames = [
      {
        key: "Cache-Control",
        value: "public, max-age=604800, stale-while-revalidate=86400",
      },
    ];
    return [
      { source: "/hero/:path*", headers: frames },
      { source: "/interior/:path*", headers: frames },
    ];
  },
};

export default nextConfig;
