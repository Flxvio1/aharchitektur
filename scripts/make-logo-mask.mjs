// Builds the removelogo mask that generate-frames.mjs uses to take the
// generator's sparkle out of the hero footage.
//
//   bun run logo-mask
//
// The mask is committed, so this only needs re-running if the source video is
// re-rendered (or re-exported at another resolution — removelogo requires the
// mask and the video to have identical dimensions, and generate-frames.mjs
// refuses to run if they drift apart).
//
// Detection exploits the one thing that separates the watermark from the
// scene: the footage under it runs from a near-white plan drawing to a
// near-black hedge over the ten seconds, but the watermark composites the same
// white star on top of every single frame. So the per-pixel minimum across the
// whole clip is dark everywhere except where the star sits, which hands us its
// shape with no background estimate to get wrong. That matters — a rectangle
// big enough to contain the star makes removelogo interpolate across 180px of
// building and hedge, which reads as an obvious smear; a mask that hugs the
// star only ever interpolates across the star itself.

import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ffmpeg from "ffmpeg-static";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE = "assets/video/hero.mp4";
const OUTPUT = "scripts/hero-logo-mask.png";
// Region to search, in source pixels. Generous margin on every side: the
// detector needs clean footage around the star to measure a floor from, and it
// warns if the result runs into the edge.
const WINDOW = { x: 3320, y: 1630, w: 320, h: 340 };
// how far to grow the detected shape, so the star's soft outer edge is inside
// the mask rather than left behind as a faint ghost
const GROW = 10;

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

const source = resolve(root, SOURCE);
const { width: FW, height: FH } = sourceSize(source);
const { x: X, y: Y, w: W, h: H } = WINDOW;
const area = W * H;

// every frame of the clip, cropped to the window, as 8-bit grey
const raw = execFileSync(
  ffmpeg,
  [
    "-hide_banner", "-loglevel", "error",
    "-i", source,
    "-vf", `crop=${W}:${H}:${X}:${Y}`,
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ],
  { maxBuffer: 1 << 30 },
);

const frames = Math.floor(raw.length / area);
const min = new Uint8Array(area).fill(255);
for (let f = 0; f < frames; f++) {
  const off = f * area;
  for (let i = 0; i < area; i++) if (raw[off + i] < min[i]) min[i] = raw[off + i];
}

// The floor of the min-image, measured on the window's border ring where there
// is certainly no watermark. p90 rather than the max so one bright stray pixel
// cannot push the threshold past the star.
const ring = [];
for (let x = 0; x < W; x++) { ring.push(min[x]); ring.push(min[(H - 1) * W + x]); }
for (let y = 0; y < H; y++) { ring.push(min[y * W]); ring.push(min[y * W + W - 1]); }
ring.sort((a, b) => a - b);
const floor = ring[Math.floor(ring.length * 0.9)];
const peak = min.reduce((a, c) => (c > a ? c : a), 0);
const cut = floor + Math.max(10, (peak - floor) * 0.12);

let mask = new Uint8Array(area);
for (let i = 0; i < area; i++) mask[i] = min[i] > cut ? 1 : 0;

function dilate(src, r) {
  const dst = new Uint8Array(area);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!src[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          if (dx * dx + dy * dy <= r * r) dst[yy * W + xx] = 1;
        }
      }
    }
  }
  return dst;
}

function erode(src, r) {
  const inv = new Uint8Array(area);
  for (let i = 0; i < area; i++) inv[i] = src[i] ? 0 : 1;
  const grown = dilate(inv, r);
  const dst = new Uint8Array(area);
  for (let i = 0; i < area; i++) dst[i] = grown[i] ? 0 : 1;
  return dst;
}

// Practical lights inside the building never go fully dark either, so the
// min-image has a few bright blobs beside the star. Keeping the largest
// connected component drops them: the watermark is much the biggest thing here.
function largestComponent(src) {
  const seen = new Uint8Array(area);
  let best = [];
  for (let seed = 0; seed < area; seed++) {
    if (!src[seed] || seen[seed]) continue;
    const comp = [];
    const stack = [seed];
    seen[seed] = 1;
    while (stack.length) {
      const p = stack.pop();
      comp.push(p);
      const px = p % W;
      const py = (p / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (src[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const dst = new Uint8Array(area);
  for (const p of best) dst[p] = 1;
  return dst;
}

mask = dilate(erode(mask, 2), 2);   // drop speckle
mask = erode(dilate(mask, 6), 6);   // close pinholes
mask = largestComponent(mask);
mask = dilate(mask, GROW);

let count = 0, minX = W, maxX = 0, minY = H, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    count++;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

console.log(`${frames} frames scanned, threshold ${cut.toFixed(1)} of ${peak}`);
console.log(
  `mask ${count}px, ${maxX - minX + 1}x${maxY - minY + 1} at ` +
    `${X + minX},${Y + minY} of ${FW}x${FH}`,
);
if (minX < GROW || minY < GROW || maxX > W - 1 - GROW || maxY > H - 1 - GROW) {
  console.error(
    "Mask runs into the search window — detection leaked into the scene. " +
      "Widen WINDOW or raise the threshold before trusting this mask.",
  );
  process.exit(1);
}

// removelogo wants a full-frame greyscale image, white where the logo is
const header = Buffer.from(`P5\n${FW} ${FH}\n255\n`, "ascii");
const body = Buffer.alloc(FW * FH, 0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (mask[y * W + x]) body[(Y + y) * FW + (X + x)] = 255;
  }
}
const pgm = resolve(root, "scripts/.logo-mask.pgm");
writeFileSync(pgm, Buffer.concat([header, body]));
execFileSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", pgm, "-pix_fmt", "gray", resolve(root, OUTPUT),
]);
rmSync(pgm, { force: true });
console.log(`wrote ${OUTPUT} — re-run \`bun run frames hero\` to apply it`);
