"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Startseite", href: "/" },
  { label: "Leistungen", href: "#leistungen" },
  { label: "Projekte", href: "#projekte" },
  { label: "Büro", href: "#buero" },
  { label: "Kontakt", href: "#kontakt" },
];

const CONTACT_HREF = "mailto:a.haziri@aharchitektur.ch";

export default function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <Link
        href="/"
        className="absolute left-6 top-6 sm:left-10 sm:top-7"
        aria-label="AH Architektur — Startseite"
        style={{ animation: "fade-up 800ms ease-out 2400ms both" }}
      >
        <Image
          src="/logo.webp"
          alt="AH Architektur"
          width={1044}
          height={500}
          priority
          unoptimized
          className="h-8 w-auto sm:h-9"
          style={{ filter: "brightness(0) invert(var(--nav-invert))" }}
        />
      </Link>

      {/* the notch: grows out of the top edge, held there by the concave
          fillets on either side so the whole thing reads as one surface */}
      <div
        className="absolute left-1/2 top-0 hidden -translate-x-1/2 lg:block"
        style={{ "--notch-r": "28px" } as React.CSSProperties}
      >
        {/* the drop-in lives on an inner layer: animating transform out here
            would clobber the -translate-x-1/2 that centres the notch */}
        <div
          className="flex items-start"
          style={{
            animation:
              "notch-drop 900ms cubic-bezier(0.22, 1, 0.36, 1) 2500ms both",
          }}
        >
          <span className="nav-fillet nav-fillet-left" aria-hidden="true" />

          <nav
            className="rounded-b-[30px] bg-foreground px-3 py-3.5"
            aria-label="Hauptnavigation"
          >
            <ul className="flex items-center gap-1">
              {NAV_LINKS.map((link, i) => (
                <li key={link.href} className="flex items-center">
                  <a
                    href={link.href}
                    className="rounded-full px-4 py-2 text-[13px] font-medium uppercase tracking-[0.14em] text-background/70 transition-colors hover:text-background"
                  >
                    {link.label}
                  </a>
                  {i < NAV_LINKS.length - 1 && (
                    <span className="text-background/30" aria-hidden="true">
                      /
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <span className="nav-fillet nav-fillet-right" aria-hidden="true" />
        </div>
      </div>

      <a
        href={CONTACT_HREF}
        className="absolute right-10 top-7 hidden items-center rounded-full bg-foreground px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-accent lg:inline-flex"
        style={{ animation: "fade-up 800ms ease-out 2750ms both" }}
      >
        Projekt anfragen
      </a>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-6 top-6 inline-flex items-center rounded-full bg-foreground px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-background lg:hidden"
        style={{ animation: "fade-up 800ms ease-out 2600ms both" }}
        aria-expanded={open}
        aria-label="Menü öffnen"
      >
        Menü
      </button>

      {open && (
        <div className="absolute inset-x-4 top-20 flex flex-col gap-1 rounded-2xl bg-foreground p-4 lg:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-medium uppercase tracking-[0.14em] text-background/70 transition-colors hover:bg-background/10 hover:text-background"
            >
              {link.label}
            </a>
          ))}
          <a
            href={CONTACT_HREF}
            onClick={() => setOpen(false)}
            className="mt-2 rounded-xl bg-background px-4 py-3 text-center text-sm font-medium uppercase tracking-[0.14em] text-foreground"
          >
            Projekt anfragen
          </a>
        </div>
      )}
    </header>
  );
}
