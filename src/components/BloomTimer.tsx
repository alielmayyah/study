import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatCountdown } from "../lib/time";

gsap.registerPlugin(useGSAP);

type Props = {
  timeLeft: number;
  /** 1 = full time left, 0 = done. */
  progress: number;
  mode: "idle" | "focus" | "break" | "paused";
};

const WAVE = 120; // wavelength in SVG units
// One long sine-wave surface, filled down to the bottom of the jar.
function wavePath(amplitude: number, phase: number) {
  let d = `M ${-WAVE * 2} 0`;
  for (let x = -WAVE * 2; x <= 300 + WAVE * 2; x += 10) {
    d += ` L ${x} ${Math.sin(((x + phase) / WAVE) * Math.PI * 2) * amplitude}`;
  }
  return `${d} L ${300 + WAVE * 2} 400 L ${-WAVE * 2} 400 Z`;
}
const BACK = wavePath(7, WAVE / 2);
const FRONT = wavePath(9, 0);
const BUBBLES = Array.from({ length: 8 }, (_, i) => ({
  x: 60 + ((i * 37) % 180),
  r: 2 + (i % 4) * 1.6,
}));

/*
 * A glass of pink lemonade: it fills up while you focus and drains during a
 * break. The surface sloshes, bubbles rise, digits flip in, the last ten seconds
 * wobble, and finishing a phase makes a splash.
 */
export function BloomTimer({ timeLeft, progress, mode }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const text = formatCountdown(timeLeft);
  const lastText = useRef(text);
  const lastMode = useRef(mode);
  const fill = mode === "idle" ? 0.1 : mode === "break" ? Math.max(0.04, progress) : Math.max(0.06, 1 - progress);
  const surface = 300 - fill * 300;
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finale = mode !== "idle" && mode !== "paused" && timeLeft > 0 && timeLeft <= 10000;

  // Endless sloshing waves and rising bubbles.
  useGSAP(
    () => {
      if (calm()) return;
      gsap.to(".lj-wave-front", { x: -WAVE, duration: 2.6, ease: "none", repeat: -1 });
      gsap.fromTo(".lj-wave-back", { x: -WAVE }, { x: 0, duration: 3.8, ease: "none", repeat: -1 });
      gsap.to(".lj-waves", { rotation: 2.5, svgOrigin: "150 150", duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.utils.toArray<SVGCircleElement>(".lj-bubble").forEach((bubble, i) => {
        gsap.fromTo(
          bubble,
          { y: 0, x: 0, autoAlpha: 0 },
          {
            keyframes: [
              { autoAlpha: 0.9, duration: 0.3 },
              { y: -260, x: gsap.utils.random(-14, 14), duration: gsap.utils.random(3, 6), ease: "power1.in" },
              { autoAlpha: 0, duration: 0.2 },
            ],
            repeat: -1,
            delay: i * 0.45,
          },
        );
      });
    },
    { scope: root },
  );

  // Idle: "Press to start" gently breathes.
  useGSAP(
    () => {
      if (mode !== "idle" || calm()) return;
      gsap.to(".lj-phase", { autoAlpha: 0.55, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
    },
    { scope: root, dependencies: [mode], revertOnUpdate: true },
  );

  // The liquid level glides to where the time is.
  useGSAP(
    () => {
      gsap.to(".lj-level", { y: surface, duration: calm() ? 0 : 1.2, ease: "power2.out", overwrite: "auto" });
    },
    { scope: root, dependencies: [surface] },
  );

  // Bubbles only fizz while the timer is running.
  useGSAP(
    () => {
      gsap.to(".lj-bubbles", { autoAlpha: mode === "focus" || mode === "break" ? 1 : 0.25, duration: 0.6 });
    },
    { scope: root, dependencies: [mode] },
  );

  // Digits flip in; the last ten seconds wobble the glass; phase changes splash.
  useLayoutEffect(() => {
    const previousText = lastText.current;
    const previousMode = lastMode.current;
    lastText.current = text;
    lastMode.current = mode;
    if (calm()) return;
    if (previousText !== text) {
      root.current?.querySelectorAll<HTMLElement>(".lj-digit").forEach((el, i) => {
        if (previousText[i] === text[i]) return;
        gsap.fromTo(
          el,
          { yPercent: -70, rotateX: 100, autoAlpha: 0 },
          { yPercent: 0, rotateX: 0, autoAlpha: 1, duration: 0.55, ease: "back.out(2.4)" },
        );
      });
    }
    if (finale && previousText !== text) {
      gsap.fromTo(".lj-glass", { rotation: -4 }, { rotation: 0, duration: 0.8, ease: "elastic.out(1.2, 0.3)" });
      gsap.fromTo(".lj-time", { scale: 1.14 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    }
    if (previousMode !== mode) {
      gsap.fromTo(".lj-glass", { scale: 0.94 }, { scale: 1, duration: 0.9, ease: "elastic.out(1, 0.45)" });
      gsap.utils.toArray<SVGCircleElement>(".lj-drop").forEach((drop, i) => {
        const angle = (i / 10) * Math.PI - Math.PI;
        gsap.fromTo(
          drop,
          { x: 0, y: 0, autoAlpha: 1, scale: 1 },
          {
            x: Math.cos(angle) * gsap.utils.random(50, 110),
            y: Math.sin(angle) * gsap.utils.random(60, 120),
            autoAlpha: 0,
            scale: 0.4,
            duration: 1,
            ease: "power2.out",
          },
        );
      });
    }
  }, [text, mode, finale]);

  return (
    <div className={`lj lj-${mode}`} ref={root}>
      <div className="lj-glass">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <defs>
            <clipPath id="lj-clip">
              <circle cx="150" cy="150" r="136" />
            </clipPath>
            <linearGradient id="lj-juice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--lj-top)" />
              <stop offset="1" stopColor="var(--lj-bottom)" />
            </linearGradient>
          </defs>
          <circle className="lj-back" cx="150" cy="150" r="136" />
          <g clipPath="url(#lj-clip)">
            <g className="lj-level" transform="translate(0 270)">
              <g className="lj-waves">
                <path className="lj-wave-back" d={BACK} />
                <path className="lj-wave-front" d={FRONT} fill="url(#lj-juice)" />
              </g>
            </g>
            <g className="lj-bubbles" transform="translate(0 300)">
              {BUBBLES.map((b, i) => (
                <circle key={i} className="lj-bubble" cx={b.x} cy={0} r={b.r} />
              ))}
            </g>
          </g>
          <circle className="lj-rim" cx="150" cy="150" r="138" />
          <path className="lj-shine" d="M70 72 A 110 110 0 0 1 128 40" />
          <g transform="translate(150 150)">
            {Array.from({ length: 10 }, (_, i) => (
              <circle key={i} className="lj-drop" r={4 + (i % 3)} />
            ))}
          </g>
        </svg>
        <div className="lj-copy">
          <span className="lj-phase">{mode === "idle" ? "Press to start" : mode}</span>
          <strong className="lj-time" aria-hidden="true">
            {text.split("").map((ch, i) =>
              ch === ":" ? (
                <span key={i} className="lj-colon">:</span>
              ) : (
                <span key={i} className="lj-digit">{ch}</span>
              ),
            )}
          </strong>
        </div>
      </div>
    </div>
  );
}
