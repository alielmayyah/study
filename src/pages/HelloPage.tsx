import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "lucide-react";
import { useOwner } from "../lib/avatars";
import { goFullscreen } from "../lib/fullscreen";
import "./room.css";

gsap.registerPlugin(useGSAP);

// Shown once per visit, right after the PIN is accepted.
export function HelloPage({ onContinue }: { onContinue: () => void }) {
  const root = useRef<HTMLElement>(null);
  const owner = useOwner();

  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline()
          .from(".hello-photo", { scale: 0.6, autoAlpha: 0, duration: 0.9, ease: "elastic.out(1, 0.7)" })
          .from(".hello-ring", { scale: 0.8, autoAlpha: 0, duration: 0.8, ease: "power3.out" }, "<0.1")
          .from(".hello-title", { y: 24, autoAlpha: 0, duration: 0.6, ease: "power3.out" }, "-=0.5")
          .from(".hello-sub", { y: 16, autoAlpha: 0, duration: 0.5, ease: "power3.out" }, "-=0.35")
          .from(".hello-go", { y: 16, autoAlpha: 0, duration: 0.5, ease: "power3.out" }, "-=0.3")
          .fromTo(
            ".hello-wave",
            { rotate: 0 },
            { rotate: 18, duration: 0.18, repeat: 5, yoyo: true, ease: "sine.inOut", transformOrigin: "70% 80%" },
            "-=0.6",
          );
        gsap.to(".hello-ring", { rotate: 360, duration: 24, repeat: -1, ease: "none" });
      });
    },
    { scope: root },
  );

  const left = useRef(false);
  const go = () => {
    if (left.current) return;
    left.current = true;
    onContinue();
  };
  const leave = contextSafe(() => {
    goFullscreen();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
    window.setTimeout(go, 900); // safety net if animation frames are paused
    gsap
      .timeline({ onComplete: go })
      .to(".hello-copy", { y: -12, autoAlpha: 0, duration: 0.3, ease: "power2.in" })
      .to(".hello-avatar", { scale: 0.4, autoAlpha: 0, duration: 0.45, ease: "power3.in" }, "<0.05");
  });

  return (
    <main className="hello theme-main" ref={root}>
      <div className="hello-avatar">
        <div className="hello-ring" aria-hidden="true" />
        <img className="hello-photo" src={owner.avatar} alt="" />
      </div>
      <div className="hello-copy">
        <h1 className="hello-title">
          Hello{owner.name ? ` ${owner.name}` : ""} <span className="hello-wave" role="img" aria-label="waving hand">👋</span>
        </h1>
        <p className="hello-sub">Ready to bloom today?</p>
        <button className="m-primary hello-go" onClick={leave} autoFocus>
          Let’s study <ArrowRight size={17} />
        </button>
      </div>
    </main>
  );
}
