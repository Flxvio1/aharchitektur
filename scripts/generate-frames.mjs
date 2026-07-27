// Regenerates the scroll-sequence frames in public/hero/ and public/interior/
// from the source videos in assets/video/ (deliberately kept out of git).
//
//   bun run frames            # all sequences
//   bun run frames hero       # just one
//
// frameCount here must match the frameCount prop passed to <ScrollSequence>
// for that sequence — the component maps scroll progress onto exactly this
// many stills.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ffmpeg from "ffmpeg-static";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SEQUENCES = {
  // plan drawing resolving into the finished building
  hero: {
    source: "assets/video/hero.mp4",
    frameCount: 240,
    fps: 24,
    // 16:9 at both sizes so the canvas cover maths never has to letterbox
    variants: [
      { width: 1440, height: 810, quality: 58 },
      { width: 768, height: 432, quality: 56 },
    ],
  },
  // empty room furnishing itself — shown in a half-width panel, so it needs
  // far less pixel width than the full-bleed hero
  interior: {
    source: "assets/video/interior.mp4",
    frameCount: 160,
    fps: 20,
    variants: [
      { width: 1200, height: 675, quality: 62 },
      { width: 640, height: 360, quality: 58 },
    ],
  },
};

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(SEQUENCES);

for (const name of names) {
  const seq = SEQUENCES[name];
  if (!seq) {
    console.error(`Unknown sequence "${name}". Known: ${Object.keys(SEQUENCES).join(", ")}`);
    process.exit(1);
  }

  const source = resolve(root, seq.source);
  if (!existsSync(source)) {
    console.error(`Source video not found: ${source}`);
    process.exit(1);
  }

  for (const { width, height, quality } of seq.variants) {
    const outDir = resolve(root, "public", name, String(width));
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    console.log(`[${name}] ${seq.frameCount} frames at ${width}x${height} …`);
    execFileSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        source,
        "-vf",
        `fps=${seq.fps},scale=${width}:${height}:flags=lanczos`,
        "-frames:v",
        String(seq.frameCount),
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
}

console.log("Done.");
