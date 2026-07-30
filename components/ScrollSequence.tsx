"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import frameManifest from "./frame-manifest.json";

// frames fetched up front so the first paint is never an empty canvas
const EAGER_COUNT = 16;
// Coarse-to-fine download. The first pass lands every 8th frame across the
// whole sequence, so the entire scrub range is covered after a fraction of the
// payload; later passes fill in the gaps. Loading strictly front-to-back
// instead means a visitor who scrolls faster than the download sees the
// playhead snap back to a distant frame — which reads as the sequence
// skipping, and is far more obvious on a phone connection than on a desktop.
const PASSES = [8, 4, 2, 1];
const CONCURRENCY = 6;

// How hard the drawn frame chases the scroll position. Lenis already eases the
// wheel, so pointer-driven scroll gets the softer follower; touch scrolling is
// left to the platform's own momentum (see SmoothScroll), and stacking a soft
// follower on top of that is what makes a phone feel laggy.
const SMOOTHING_FINE = 0.22;
const SMOOTHING_COARSE = 0.34;

// window of the sequence over which an outro overlay resolves
const OUTRO_START = 0.7;
const OUTRO_END = 0.92;

// patch of the canvas the fixed header sits over, in CSS pixels
const NAV_RECT = { x: 24, y: 20, w: 100, h: 50 };

/** One generated frame set — a folder under /public/<name>/. */
export type FrameSet = {
  /** folder name; must match a variant `dir` in scripts/generate-frames.mjs */
  dir: string;
  /** media query gating this set. Omit on the last entry: it is the fallback. */
  media?: string;
};

type Props = {
  /** folder under /public holding the frame sets */
  name: string;
  /** must match what scripts/generate-frames.mjs produced */
  frameCount: number;
  /** candidate frame sets, most specific first — the first match wins */
  sets: FrameSet[];
  /** scroll distance the sequence occupies, in vh */
  heightVh?: number;
  /** classes for the canvas — lets a caller inset or mask the panel */
  canvasClassName?: string;
  /**
   * Publish progress and backdrop luminance globally. Only the hero should do
   * this: it is what the fixed header reads to stay legible, and two
   * sequences writing the same custom properties would fight each other.
   */
  publishGlobals?: boolean;
  children?: React.ReactNode;
};

export default function ScrollSequence({
  name,
  frameCount,
  sets,
  heightVh = 320,
  canvasClassName = "absolute inset-0 h-full w-full",
  publishGlobals = false,
  children,
}: Props) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // keyed on the contents rather than the array identity, so a caller passing
  // an inline literal does not tear down and re-run the whole effect on every
  // render
  const setsKey = sets.map((s) => `${s.dir}|${s.media ?? ""}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => sets, [setsKey]);

  // Which set is live has to stay subscribed, not be read once: a set can be
  // gated on orientation, and a phone turned sideways would otherwise keep
  // drawing portrait frames into a landscape canvas.
  const subscribeToSets = useCallback(
    (onChange: () => void) => {
      const queries = candidates
        .filter((s) => s.media)
        .map((s) => window.matchMedia(s.media as string));
      queries.forEach((q) => q.addEventListener("change", onChange));
      return () => queries.forEach((q) => q.removeEventListener("change", onChange));
    },
    [candidates],
  );

  const fallbackDir = candidates[candidates.length - 1].dir;

  const readActiveDir = useCallback(
    () =>
      (
        candidates.find((s) => !s.media || window.matchMedia(s.media).matches) ??
        candidates[candidates.length - 1]
      ).dir,
    [candidates],
  );

  // the fallback is the widest set, which is also the sensible server render
  const readFallbackDir = useCallback(() => fallbackDir, [fallbackDir]);

  const activeDir = useSyncExternalStore(
    subscribeToSets,
    readActiveDir,
    readFallbackDir,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !section || !sticky) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smoothing = window.matchMedia("(pointer: coarse)").matches
      ? SMOOTHING_COARSE
      : SMOOTHING_FINE;

    // Sampling the visible canvas with getImageData stalls the GPU pipeline —
    // cheap on a desktop, a per-hitch tax on a phone. This tiny scratch canvas
    // is never composited, so reading 32 pixels back out of it costs nothing.
    const probe = document.createElement("canvas");
    probe.width = 8;
    probe.height = 4;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });

    const images = new Array<HTMLImageElement | undefined>(frameCount);
    const loaded = new Array<boolean>(frameCount).fill(false);
    const requested = new Array<boolean>(frameCount).fill(false);

    let disposed = false;
    let rafId = 0;
    let current = 0;
    let target = 0;
    let inView = true;
    let navInvert = 0;
    let sampleTick = 0;
    // set whenever the drawn result would differ from what is on screen, so a
    // settled sequence stops repainting instead of burning a phone's battery
    // (and thermal headroom) redrawing the same frame 60 times a second
    let dirty = true;
    let lastW = 0;
    let lastH = 0;

    // Frames are served with a long max-age under filenames that never change,
    // so a regenerated sequence would otherwise stay invisible to anyone
    // holding the previous bytes. The manifest's content hash makes each
    // generation a distinct cache entry.
    const version = (frameManifest as Record<string, string>)[name];
    const query = version ? `?v=${version}` : "";

    function framePath(index: number) {
      const file = String(index + 1).padStart(4, "0");
      return `/${name}/${activeDir}/frame_${file}.webp${query}`;
    }

    function loadFrame(i: number) {
      if (requested[i]) return Promise.resolve();
      requested[i] = true;
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        images[i] = img;
        const ready = () => {
          loaded[i] = true;
          dirty = true;
          resolve();
        };
        img.onload = () => {
          // Decode up front. Without this the first drawImage of each frame
          // pays a synchronous WebP decode on the main thread, mid-scroll.
          if (typeof img.decode === "function") img.decode().then(ready, ready);
          else ready();
        };
        img.onerror = () => resolve();
        img.src = framePath(i);
      });
    }

    // nearest already-decoded neighbour, so scrolling ahead of the download
    // shows the closest available frame instead of a blank gap
    function nearestLoaded(i: number) {
      if (loaded[i]) return images[i];
      for (let d = 1; d < frameCount; d++) {
        if (i - d >= 0 && loaded[i - d]) return images[i - d];
        if (i + d < frameCount && loaded[i + d]) return images[i + d];
      }
      return undefined;
    }

    function resize() {
      if (!canvas || !ctx) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(cw * dpr);
      const h = Math.round(ch * dpr);
      // Mobile browsers fire resize continuously while the URL bar collapses.
      // Reallocating the backing store on each of those events clears the
      // canvas to white mid-scroll and costs a frame every time, so only act
      // when the box genuinely changed.
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      dirty = true;
    }

    // geometry of a `cover` fit, in whatever unit `boxW`/`boxH` are given in
    function coverFit(img: HTMLImageElement, boxW: number, boxH: number) {
      const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      return { scale, w, h, x: (boxW - w) / 2, y: (boxH - h) / 2 };
    }

    function drawCover(img: HTMLImageElement, alpha: number) {
      if (!canvas || !ctx) return;
      const fit = coverFit(img, canvas.width, canvas.height);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
      ctx.globalAlpha = 1;
    }

    // blend the two frames the playhead sits between, so the sequence glides
    // instead of stepping from one still to the next
    function render() {
      if (!ctx || !canvas) return;
      const floor = Math.floor(current);
      const frac = current - floor;
      const a = nearestLoaded(floor);
      const b = nearestLoaded(Math.min(floor + 1, frameCount - 1));

      const base = a ?? b;
      if (!base) return;
      // `base` is drawn with cover geometry so it always fills the canvas —
      // no clearing fill needed, which saves a full-screen paint per frame
      drawCover(base, 1);
      if (a && b && b !== a && frac > 0.001) drawCover(b, frac);
    }

    function updateTarget() {
      if (!section || !sticky) return;
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(
              Math.max(-section.getBoundingClientRect().top / scrollable, 0),
              1,
            )
          : 0;
      const outro = Math.min(
        Math.max((progress - OUTRO_START) / (OUTRO_END - OUTRO_START), 0),
        1,
      );
      // ease-out so an outro decelerates into place instead of tracking the
      // wheel one-to-one
      const outroEased = 1 - Math.pow(1 - outro, 3);

      sticky.style.setProperty("--seq-progress", progress.toFixed(4));
      sticky.style.setProperty("--outro", outroEased.toFixed(4));
      if (publishGlobals) {
        document.documentElement.style.setProperty(
          "--seq-progress",
          progress.toFixed(4),
        );
      }
      target = progress * (frameCount - 1);
    }

    // Measure what is actually painted behind the logo rather than guessing
    // from scroll position: frames stream in out of order, so progress alone
    // is a poor proxy for how dark the backdrop currently is. The nav rect is
    // mapped back through the cover fit into source-image coordinates, so this
    // never has to touch the visible canvas.
    function sampleBackdropLuma() {
      if (!canvas || !probeCtx) return null;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (!cw || !ch) return null;
      const img = nearestLoaded(Math.round(current));
      if (!img) return null;

      const fit = coverFit(img, cw, ch);
      const sx = (NAV_RECT.x - fit.x) / fit.scale;
      const sy = (NAV_RECT.y - fit.y) / fit.scale;
      const sw = NAV_RECT.w / fit.scale;
      const sh = NAV_RECT.h / fit.scale;
      if (
        sx < 0 ||
        sy < 0 ||
        sx + sw > img.naturalWidth ||
        sy + sh > img.naturalHeight
      ) {
        return null;
      }

      probeCtx.drawImage(img, sx, sy, sw, sh, 0, 0, probe.width, probe.height);
      const { data } = probeCtx.getImageData(0, 0, probe.width, probe.height);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      return sum / (data.length / 4) / 255;
    }

    function updateNavContrast() {
      const luma = inView ? sampleBackdropLuma() : 1;
      if (luma === null) return;
      const wanted = luma < 0.5 ? 1 : 0;
      navInvert += (wanted - navInvert) * 0.12;
      document.documentElement.style.setProperty(
        "--nav-invert",
        navInvert.toFixed(3),
      );
    }

    function tick() {
      if (disposed) return;
      updateTarget();
      const delta = target - current;
      if (Math.abs(delta) < 0.005) {
        if (current !== target) dirty = true;
        current = target;
      } else {
        current += delta * smoothing;
        dirty = true;
      }
      if (dirty) {
        render();
        dirty = false;
      }
      // deliberately outside the dirty check: navInvert eases toward its target
      // over several samples, so stopping mid-scroll would otherwise freeze the
      // header halfway through a transition. The probe canvas makes this cheap
      // enough to keep running.
      if (publishGlobals && ++sampleTick % 6 === 0) updateNavContrast();
      rafId = requestAnimationFrame(tick);
    }

    resize();
    // Watch the element rather than the window: it picks up a canvas that was
    // still zero-sized at mount, and it stays quiet during the constant window
    // resizes a collapsing mobile URL bar produces, which never change this
    // box (the sticky wrapper is sized in vh, not in visual-viewport pixels).
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // devicePixelRatio can still change without the box changing — dragging the
    // window to a display with a different scale factor
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && !rafId) {
          dirty = true;
          rafId = requestAnimationFrame(tick);
        }
        if (!inView && rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
          if (publishGlobals) {
            // the loop is what animates the value, so hand the header back to
            // its default dark-on-white state before it stops
            navInvert = 0;
            document.documentElement.style.setProperty("--nav-invert", "0");
          }
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(section);

    (async () => {
      await Promise.all(
        Array.from({ length: Math.min(EAGER_COUNT, frameCount) }, (_, i) =>
          loadFrame(i),
        ),
      );
      if (disposed) return;

      if (reduced) {
        // no scrub — just settle on the finished state
        await loadFrame(frameCount - 1);
        if (disposed) return;
        current = frameCount - 1;
        target = current;
        dirty = true;
        render();
        return;
      }

      for (const stride of PASSES) {
        const pending: number[] = [];
        for (let i = 0; i < frameCount; i += stride) {
          if (!requested[i]) pending.push(i);
        }
        while (pending.length) {
          if (disposed) return;
          // nearest the playhead first: a missing frame only shows where the
          // visitor has actually scrolled to
          pending.sort((p, q) => Math.abs(p - current) - Math.abs(q - current));
          await Promise.all(pending.splice(0, CONCURRENCY).map(loadFrame));
        }
      }
    })();

    if (!reduced) rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [name, frameCount, activeDir, publishGlobals]);

  return (
    <div ref={sectionRef} className="relative" style={{ height: `${heightVh}vh` }}>
      <div ref={stickyRef} className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className={canvasClassName} />
        {children}
      </div>
    </div>
  );
}
