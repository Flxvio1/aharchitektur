// Regenerates the scroll-sequence frames in public/hero/ and public/interior/
// from the source videos in assets/video/ (deliberately kept out of git).
//
//   bun run frames            # all sequences
//   bun run frames hero       # just one
//
// frameCount here must match the frameCount prop passed to <ScrollSequence>
// for that sequence — the component maps scroll progress onto exactly this
// many stills. The `dir` of each variant must match a `dir` in that
// component's `sets` prop.
//
// Each variant is cropped to its own aspect ratio before scaling. That is what
// makes the phone-portrait set worth having: the canvas draws every frame with
// `cover`, so on a ~9:19.5 phone screen a 16:9 still has ~74% of its width
// cropped away unseen and the surviving strip is upscaled ~3.9x. Cropping at
// encode time instead spends every delivered byte on pixels that survive the
// crop — same centre framing, roughly 3x the effective resolution, for a
// comparable file size.

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
    variants: [
      { dir: "1440", width: 1440, height: 810, quality: 58 },
      // small landscape — phones held sideways, narrow tablet windows
      { dir: "768", width: 768, height: 432, quality: 56 },
      // phone portrait. Quality is set lower than the landscape sets on
      // purpose: at nearly 3x the pixel count a lower setting still resolves
      // far more detail, and it keeps the payload close to the 16:9 set.
      { dir: "portrait", width: 720, height: 1280, quality: 44 },
    ],
  },
  // empty room furnishing itself — shown in a half-width panel on desktop and
  // a full-width 16:9 panel on phones, so it stays landscape at every size
  interior: {
    source: "assets/video/interior.mp4",
    frameCount: 160,
    fps: 20,
    variants: [
      { dir: "1200", width: 1200, height: 675, quality: 62 },
      // 800 rather than 640: a phone draws this panel at ~390 CSS px, which is
      // 780 device pixels at dpr 2
      { dir: "800", width: 800, height: 450, quality: 56 },
    ],
  },
};

// `ffmpeg -i` with no output exits non-zero and prints the stream info to
// stderr, so the throw is the expected path here rather than a failure.
function sourceSize(file) {
  let text = "";
  try {
    text = execFileSync(ffmpeg, ["-hide_banner", "-i", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    text = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  const match = text.match(/Video:.*?, (\d+)x(\d+)/);
  if (!match) throw new Error(`Could not read video dimensions from ${file}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

// largest centred rectangle of `aspect` that fits the source; a no-op when the
// variant already matches the source's own aspect ratio
function centredCrop(srcW, srcH, aspect) {
  const w = Math.min(srcW, Math.round(srcH * aspect)) & ~1;
  const h = Math.min(srcH, Math.round(srcW / aspect)) & ~1;
  return { w, h, x: (srcW - w) >> 1, y: (srcH - h) >> 1 };
}

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

  const { width: srcW, height: srcH } = sourceSize(source);

  for (const { dir, width, height, quality } of seq.variants) {
    const outDir = resolve(root, "public", name, dir);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const crop = centredCrop(srcW, srcH, width / height);
    const cropped = crop.w !== srcW || crop.h !== srcH;

    console.log(
      `[${name}/${dir}] ${seq.frameCount} frames at ${width}x${height}` +
        (cropped ? ` (crop ${crop.w}x${crop.h} from ${srcW}x${srcH})` : "") +
        " …",
    );

    execFileSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        source,
        "-vf",
        [
          `fps=${seq.fps}`,
          `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
          `scale=${width}:${height}:flags=lanczos`,
        ].join(","),
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
