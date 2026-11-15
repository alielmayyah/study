import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "../pages/room.css";

gsap.registerPlugin(useGSAP);

// Anonymous opening animation: a blossom opens, then the whole screen fades away.
export function Splash({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  // Safety net: never let the splash hang if animation frames are paused.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const id = window.setTimeout(() => done.current(), 4500);
    return () => window.clearTimeout(id);
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.to(root.current, { autoAlpha: 0, duration: 0.3, delay: 0.4, onComplete: onDone });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ onComplete: onDone })
          .from(".splash-petal", {
            scale: 0,
            rotate: -40,
            transformOrigin: "50% 100%",
            duration: 0.7,
            ease: "back.out(1.8)",
            stagger: 0.08,
          })
          .from(".splash-heart", { scale: 0, duration: 0.4, ease: "back.out(3)" }, "-=0.3")
          .to(".splash-flower", { rotate: 72, duration: 1.4, ease: "power2.inOut" }, 0.2)
          .from(".splash-word", { y: 14, autoAlpha: 0, duration: 0.6, ease: "power3.out" }, "-=0.8")
          .to(".splash-inner", { scale: 1.08, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, "+=0.35")
          .to(root.current, { autoAlpha: 0, duration: 0.45, ease: "power1.out" }, "-=0.15");
      });
    },
    { scope: root },
  );

  return (
    <div className="splash" ref={root} aria-hidden="true">
      <div className="splash-inner">
        <svg className="splash-flower" viewBox="-60 -60 120 120" width="120" height="120">
          {[0, 72, 144, 216, 288].map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path
                className="splash-petal"
                d="M0 -6 C -20 -18, -18 -46, 0 -52 C 18 -46, 20 -18, 0 -6 Z"
              />
            </g>
          ))}
          <circle className="splash-heart" r="8" />
        </svg>
        <p className="splash-word">Let’s bloom.</p>
      </div>
    </div>
  );
}
