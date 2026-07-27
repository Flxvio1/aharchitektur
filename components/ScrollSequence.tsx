"use client";

import { useEffect, useRef } from "react";

const FRAME_COUNT = 240;
// frames fetched up front so the first paint is never an empty canvas
const EAGER_COUNT = 24;
// How hard the drawn frame chases the scroll position. Kept fairly tight
// because Lenis already eases the scroll itself — stacking two soft followers
// reads as lag rather than smoothness.
const SMOOTHING = 0.22;

// window of the sequence over which the closing statement resolves
const OUTRO_START = 0.7;
const OUTRO_END = 0.92;

function framePath(set: 768 | 1440, index: number) {
  return `/hero/${set}/frame_${String(index + 1).padStart(4, "0")}.webp`;
}

export default function ScrollSequence({
  children,
}: {
  children?: React.ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!canvas || !section || !sticky) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const set: 768 | 1440 = window.innerWidth < 900 ? 768 : 1440;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const images = new Array<HTMLImageElement | undefined>(FRAME_COUNT);
    const loaded = new Array<boolean>(FRAME_COUNT).fill(false);

    let disposed = false;
    let rafId = 0;
    let current = 0;
    let target = 0;
    let inView = true;
    let navInvert = 0;
    let sampleTick = 0;

    function loadFrame(i: number) {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          loaded[i] = true;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = framePath(set, i);
        images[i] = img;
      });
    }

    // nearest already-decoded neighbour, so scrolling ahead of the download
    // shows the closest available frame instead of a blank gap
    function nearestLoaded(i: number) {
      if (loaded[i]) return images[i];
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (i - d >= 0 && loaded[i - d]) return images[i - d];
        if (i + d < FRAME_COUNT && loaded[i + d]) return images[i + d];
      }
      return undefined;
    }

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawCover(img: HTMLImageElement, alpha: number) {
      if (!canvas || !ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }

    // blend the two frames the playhead sits between, so the sequence glides
    // instead of stepping from one still to the next
    function render() {
      if (!ctx || !canvas) return;
      const floor = Math.floor(current);
      const frac = current - floor;
      const a = nearestLoaded(floor);
      const b = nearestLoaded(Math.min(floor + 1, FRAME_COUNT - 1));

      if (!a && !b) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (a) drawCover(a, 1);
      if (b && b !== a && frac > 0.001) drawCover(b, frac);
    }

    function updateTarget() {
      if (!section || !sticky) return;
      const scrollable = section.offsetHeight - window.innerHeight;
      const progress =
        scrollable > 0
          ? Math.min(Math.max(-section.getBoundingClientRect().top / scrollable, 0), 1)
          : 0;
      const outro = Math.min(
        Math.max((progress - OUTRO_START) / (OUTRO_END - OUTRO_START), 0),
        1,
      );
      // ease-out so the statement decelerates into place instead of tracking
      // the wheel one-to-one
      const outroEased = 1 - Math.pow(1 - outro, 3);

      sticky.style.setProperty("--seq-progress", progress.toFixed(4));
      sticky.style.setProperty("--outro", outroEased.toFixed(4));
      document.documentElement.style.setProperty(
        "--seq-progress",
        progress.toFixed(4),
      );
      target = progress * (FRAME_COUNT - 1);
    }

    // Measure what is actually painted behind the logo rather than guessing
    // from scroll position: frames stream in out of order, so progress alone
    // is a poor proxy for how dark the backdrop currently is.
    function sampleBackdropLuma() {
      if (!canvas || !ctx || !canvas.width || !canvas.height) return null;
      const dpr = canvas.width / Math.max(canvas.clientWidth, 1);
      const x = Math.round(24 * dpr);
      const y = Math.round(20 * dpr);
      const w = Math.round(100 * dpr);
      const h = Math.round(50 * dpr);
      if (x + w > canvas.width || y + h > canvas.height) return null;

      const { data } = ctx.getImageData(x, y, w, h);
      let sum = 0;
      let n = 0;
      for (let i = 0; i < data.length; i += 4 * 8) {
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        n++;
      }
      return n ? sum / n / 255 : null;
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
      current = Math.abs(delta) < 0.01 ? target : current + delta * SMOOTHING;
      render();
      if (++sampleTick % 6 === 0) updateNavContrast();
      rafId = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && !rafId) rafId = requestAnimationFrame(tick);
        if (!inView && rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
          // the loop is what animates the value, so hand the header back to
          // its default dark-on-white state before it stops
          navInvert = 0;
          document.documentElement.style.setProperty("--nav-invert", "0");
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(section);

    (async () => {
      await Promise.all(
        Array.from({ length: Math.min(EAGER_COUNT, FRAME_COUNT) }, (_, i) =>
          loadFrame(i),
        ),
      );
      if (disposed) return;
      render();

      if (reduced) {
        // no scrub — just settle on the finished building
        await loadFrame(FRAME_COUNT - 1);
        if (disposed) return;
        current = FRAME_COUNT - 1;
        target = current;
        render();
        return;
      }

      for (let i = EAGER_COUNT; i < FRAME_COUNT; i += 8) {
        if (disposed) return;
        await Promise.all(
          Array.from({ length: Math.min(8, FRAME_COUNT - i) }, (_, k) =>
            loadFrame(i + k),
          ),
        );
      }
    })();

    if (!reduced) rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div ref={sectionRef} className="relative h-[320vh]">
      <div ref={stickyRef} className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {children}
      </div>
    </div>
  );
}
