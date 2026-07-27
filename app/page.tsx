import NavBar from "@/components/NavBar";
import Preloader from "@/components/Preloader";
import ScrollSequence from "@/components/ScrollSequence";

const SERVICES = [
  {
    no: "01",
    title: "Neubau",
    body: "Vom Grundstück bis zum Bezug — Entwurf, Planung und Ausführung aus einer Hand.",
  },
  {
    no: "02",
    title: "Umbau & Sanierung",
    body: "Bestand weiterdenken: mehr Licht, bessere Grundrisse, zeitgemässe Technik.",
  },
  {
    no: "03",
    title: "Innenausbau",
    body: "Materialien, Licht und Möblierung als Teil des Entwurfs, nicht als Zusatz.",
  },
  {
    no: "04",
    title: "Baueingabe",
    body: "Bewilligungsverfahren und Behördenkontakt, sauber vorbereitet und begleitet.",
  },
];

const PROJECTS = [
  "NIMA",
  "TRIO",
  "RUCH",
  "HUMA",
  "ARIS",
  "WALD",
  "LOOP",
  "CUBE",
  "BINA",
  "KRUS",
  "INSA",
];

export default function Home() {
  return (
    <>
      <Preloader />
      <NavBar />

      <main className="bg-background">
        <ScrollSequence
          name="hero"
          frameCount={240}
          sets={[768, 1440]}
          publishGlobals
        >
          {/* soft scrim: keeps the left column legible over the drawing
              without tinting the type itself */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-background via-background/70 to-transparent sm:w-3/5"
            style={{ opacity: "calc(1 - var(--seq-progress, 0) * 2.8)" }}
            aria-hidden="true"
          />

          <div
            className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10"
            style={{ opacity: "calc(1 - var(--seq-progress, 0) * 2.8)" }}
          >
            <div className="max-w-xl">
              <p
                className="mb-7 flex items-center gap-4 text-[11px] uppercase tracking-[0.32em] text-muted opacity-0"
                style={{ animation: "fade-up 900ms ease-out 2600ms both" }}
              >
                <span
                  className="h-px w-8 origin-left bg-muted/60"
                  style={{
                    animation:
                      "rule-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) 2850ms both",
                  }}
                  aria-hidden="true"
                />
                Architektur &amp; Planung — Lausen
              </p>

              <h1
                className="text-[10vw] font-bold leading-[0.92] tracking-[-0.04em] text-foreground sm:text-[4.6vw]"
              >
                <span
                  className="block opacity-0"
                  style={{ animation: "fade-up 950ms ease-out 2750ms both" }}
                >
                  Architektur,
                </span>
                <span
                  className="block opacity-0"
                  style={{ animation: "fade-up 950ms ease-out 2870ms both" }}
                >
                  die bleibt.
                </span>
              </h1>

              <p
                className="mt-7 max-w-md text-base leading-relaxed text-muted opacity-0"
                style={{ animation: "fade-up 900ms ease-out 3050ms both" }}
              >
                Vom ersten Strich bis zum fertigen Haus — funktionelle,
                individuelle Architektur für Neubauten und Umbauten.
              </p>

              <div
                className="mt-10 opacity-0"
                style={{ animation: "fade-up 800ms ease-out 3220ms both" }}
              >
                <a
                  href="mailto:a.haziri@aharchitektur.ch"
                  className="pointer-events-auto inline-flex items-center rounded-full bg-foreground px-7 py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-background transition-colors hover:bg-accent"
                >
                  Projekt besprechen
                </a>
              </div>
            </div>
            {/* scroll cue — the hero only reveals itself once the wheel
                moves, so it needs to say so. Nested here to inherit the
                same fade-out as the rest of the copy. */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center opacity-0 sm:bottom-10"
              style={{ animation: "fade-up 900ms ease-out 3400ms both" }}
              aria-hidden="true"
            >
              <div
                className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted"
                style={{
                  animation: "cue-drift 2600ms ease-in-out 4300ms infinite",
                }}
              >
                Scrollen
                <span className="h-8 w-px bg-gradient-to-b from-muted/70 to-transparent" />
              </div>
            </div>
          </div>

          {/* sits between canvas and statement: lifts the white caps off the
              render and lends the ending a calmer, more expensive feel */}
          <div
            className="pointer-events-none absolute inset-0 bg-black"
            style={{ opacity: "calc(var(--outro, 0) * 0.45)" }}
            aria-hidden="true"
          />

          {/* closing statement — resolves over the finished building */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
            style={{ opacity: "var(--outro, 0)" }}
            aria-hidden="true"
          >
            <p
              className="text-center font-display text-[7vw] font-light uppercase leading-[1.25] text-white sm:text-[3.4vw]"
              style={{
                letterSpacing: "calc(0.14em + (1 - var(--outro, 0)) * 0.12em)",
                transform: "translateY(calc((1 - var(--outro, 0)) * 26px))",
              }}
            >
              Wo aus Plan
              <br />
              Zuhause wird
            </p>
          </div>
        </ScrollSequence>

        {/* Interior sequence: the room furnishes itself on the right while the
            offering is read on the left. The canvas is masked rather than
            overlaid with a gradient div, so it dissolves into the page
            background instead of into a hard-coded colour. */}
        <section id="leistungen" aria-label="Leistungen">
          <ScrollSequence
            name="interior"
            frameCount={160}
            sets={[640, 1200]}
            heightVh={300}
            canvasClassName="absolute right-0 top-1/2 h-auto w-full -translate-y-1/2 aspect-video lg:w-[62%]"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, var(--background) 26%, transparent 62%)",
              }}
              aria-hidden="true"
            />

            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10">
              <div
                className="max-w-md"
                style={{
                  // resolves over the first third of the section, then holds
                  opacity: "clamp(0, calc(var(--seq-progress, 0) * 6), 1)",
                  transform:
                    "translateY(calc((1 - clamp(0, var(--seq-progress, 0) * 6, 1)) * 24px))",
                }}
              >
                <p className="mb-7 flex items-center gap-4 text-[11px] uppercase tracking-[0.32em] text-muted">
                  <span
                    className="h-px w-8 bg-muted/60"
                    aria-hidden="true"
                  />
                  Was wir bieten
                </p>

                <h2 className="text-[9vw] font-bold leading-[0.95] tracking-[-0.035em] text-foreground sm:text-[3.4vw]">
                  Vom Rohbau
                  <br />
                  zum Zuhause.
                </h2>

                <p className="mt-7 text-base leading-relaxed text-muted">
                  Wir begleiten ein Projekt über seine ganze Länge — vom
                  Entwurf über die Baueingabe bis zur Ausführung und dem
                  Innenausbau.
                </p>

                <ul className="mt-10 flex flex-col">
                  {SERVICES.map((service) => (
                    <li
                      key={service.title}
                      className="flex gap-5 border-t border-line py-4 last:border-b"
                    >
                      <span className="pt-0.5 text-[11px] tabular-nums tracking-[0.2em] text-muted/70">
                        {service.no}
                      </span>
                      <div>
                        <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-foreground">
                          {service.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {service.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollSequence>
        </section>

        <section id="projekte" className="border-t border-line px-6 py-24 sm:px-10">
          <h2 className="mb-12 text-3xl font-bold uppercase tracking-[-0.02em] text-foreground sm:text-4xl">
            Ausgewählte Projekte
          </h2>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {PROJECTS.map((project) => (
              <li
                key={project}
                className="border-b border-line pb-4 text-lg uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground"
              >
                {project}
              </li>
            ))}
          </ul>
        </section>

        <footer
          id="kontakt"
          className="border-t border-line px-6 py-12 text-xs uppercase tracking-[0.14em] text-muted sm:px-10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span>AH Architektur © {new Date().getFullYear()}</span>
            <a
              href="mailto:a.haziri@aharchitektur.ch"
              className="hover:text-foreground"
            >
              a.haziri@aharchitektur.ch
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
