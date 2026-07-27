"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const ENTER_MS = 1000;
const SUB_DELAY_MS = 750;
const SUB_MS = 800;
const HOLD_MS = 700;
const EXIT_MS = 800;

// the subtitle lands last, so the hold only starts once it has settled
const SETTLED_MS = Math.max(ENTER_MS, SUB_DELAY_MS + SUB_MS);

export default function Preloader() {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }

    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => setReady(true));
    const exitTimer = setTimeout(() => setExiting(true), SETTLED_MS + HOLD_MS);
    const removeTimer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, SETTLED_MS + HOLD_MS + EXIT_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
      document.body.style.overflow = "";
    };
  }, []);

  if (!visible) return null;

  return (
    // deliberately hard-coded dark: the intro stays black even though the
    // site palette itself is light
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b0a08] transition-opacity duration-[800ms] ease-in-out ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`w-28 transition-all duration-[1000ms] ease-out sm:w-36 ${
          ready ? "scale-100 opacity-100 blur-0" : "scale-90 opacity-0 blur-[6px]"
        }`}
      >
        <Image
          src="/logo.webp"
          alt="AH Architektur"
          width={1044}
          height={500}
          priority
          unoptimized
          className="h-auto w-full brightness-0 invert"
        />
      </div>

      <p
        className="mt-6 text-[10px] uppercase tracking-[0.42em] text-white/55 opacity-0 sm:text-xs"
        style={{
          animation: `fade-up ${SUB_MS}ms ease-out ${SUB_DELAY_MS}ms both`,
        }}
      >
        Architektur aus Lausen
      </p>
    </div>
  );
}
