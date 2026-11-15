import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useLocation } from "react-router-dom";
import "../pages/room.css";

gsap.registerPlugin(useGSAP);

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A blossom that slowly turns while its petals breathe in sequence. */
export function BloomLoader() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (calm()) return;
      gsap.from(root.current, { autoAlpha: 0, scale: 0.8, duration: 0.5, ease: "power2.out" });
      gsap.to(".bl-flower", { rotation: 360, svgOrigin: "0 0", duration: 6, ease: "none", repeat: -1 });
      gsap.fromTo(
        ".bl-petal",
        { scale: 0.55, autoAlpha: 0.35 },
        {
          scale: 1,
          autoAlpha: 1,
          duration: 0.6,
          ease: "sine.inOut",
          stagger: { each: 0.15, repeat: -1, yoyo: true },
          transformOrigin: "50% 100%",
        },
      );
    },
    { scope: root },
  );
  return (
    <div className="bloom-loader" ref={root} role="status" aria-label="Loading">
      <svg viewBox="-60 -60 120 120" width="84" height="84" aria-hidden="true">
        <g className="bl-flower">
          {[0, 72, 144, 216, 288].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path className="bl-petal" d="M0 -6 C -20 -18, -18 -46, 0 -52 C 18 -46, 20 -18, 0 -6 Z" />
            </g>
          ))}
          <circle className="bl-heart" r="8" />
        </g>
      </svg>
    </div>
  );
}

/** Fades and lifts each page in when the route changes. */
export function PageTransition({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useGSAP(
    () => {
      if (calm()) return;
      gsap.fromTo(
        root.current,
        { autoAlpha: 0, y: 18, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out", clearProps: "transform" },
      );
      // Safety net if animation frames are paused.
      const id = window.setTimeout(() => gsap.set(root.current, { clearProps: "opacity,visibility,transform" }), 1500);
      return () => window.clearTimeout(id);
    },
    { scope: root, dependencies: [pathname], revertOnUpdate: true },
  );
  return (
    <div ref={root} key={pathname}>
      {children}
    </div>
  );
}
