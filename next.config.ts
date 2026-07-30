import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Files in public/ are served with `max-age=0` by default, which means a
    // sequence costs hundreds of revalidation round trips on every visit — the
    // latency of that is felt on a phone far more than on a desktop.
    //
    // Safe to pin for a year because ScrollSequence requests every frame with
    // a ?v=<content hash> from components/frame-manifest.json, so regenerating
    // a sequence moves it to fresh URLs rather than waiting out a TTL. Without
    // that the filenames are stable and a re-render of the video simply never
    // reaches anyone who already has the old bytes.
    const frames = [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ];
    return [
      { source: "/hero/:path*", headers: frames },
      { source: "/interior/:path*", headers: frames },
    ];
  },
};

export default nextConfig;
