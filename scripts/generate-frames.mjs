// Regenerates the scroll-sequence frames in public/hero/ from the source
// video in assets/video/ (which is deliberately kept out of git).
//
//   bun run frames [path/to/source.mp4]
//
// The frame count is fixed at 240: ScrollSequence.tsx maps scroll progress
// onto exactly that many stills, so changing it here means changing it there.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ffmpeg from "ffmpeg-static";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.argv[2] ?? resolve(root, "assets/video/Design ohne Titel (1).mp4");

const FRAME_COUNT = 240;
const FPS = 24;

// 16:9 at both sizes so the canvas cover maths never has to letterbox.
// Quality is tuned per size: the small set is only ever seen on phones.
const VARIANTS = [
  { width: 1440, height: 810, quality: 58 },
  { width: 768, height: 432, quality: 56 },
];

if (!existsSync(source)) {
  console.error(`Source video not found: ${source}`);
  console.error("Pass the path explicitly: bun run frames <file.mp4>");
  process.exit(1);
}

for (const { width, height, quality } of VARIANTS) {
  const outDir = resolve(root, "public/hero", String(width));
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  console.log(`Extracting ${FRAME_COUNT} frames at ${width}x${height} …`);
  execFileSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      source,
      "-vf",
      `fps=${FPS},scale=${width}:${height}:flags=lanczos`,
      "-frames:v",
      String(FRAME_COUNT),
      "-c:v",
      "libwebp",
      "-lossless",
      "0",
      "-quality",
      String(quality),
      "-compression_level",
      "6",
      "-preset",
      "picture",
      resolve(outDir, "frame_%04d.webp"),
    ],
    { stdio: "inherit" },
  );
}

console.log("Done — frames written to public/hero/");
