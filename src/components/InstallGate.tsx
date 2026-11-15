import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Share, SquarePlus, Sparkles } from "lucide-react";
import "../pages/room.css";

gsap.registerPlugin(useGSAP);

const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/*
 * On iPhone/iPad in Safari the app can't go full screen or send lock-screen
 * alerts, so this page asks for the Home Screen install first. One big step at
 * a time, cycling on its own (or tap to move on). Nothing identifying is shown.
 */
export function InstallGate({ onSkip }: { onSkip: () => void }) {
  const root = useRef<HTMLElement>(null);
  const iPad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const steps = [
    { icon: <Share size={56} strokeWidth={1.5} />, text: <>Tap <b>Share</b> {iPad ? "up top" : "below"}</> },
    { icon: <SquarePlus size={56} strokeWidth={1.5} />, text: <>Choose <b>Add to Home Screen</b></> },
    { icon: <Sparkles size={56} strokeWidth={1.5} />, text: <>Open it from your <b>Home Screen</b></> },
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 3), 3200);
    return () => window.clearInterval(id);
  }, []);

  // Entrance + the arrow nudging toward Safari's Share button.
  useGSAP(
    () => {
      if (calm()) return;
      gsap
        .timeline()
        .from(".ig-eyebrow", { y: 16, autoAlpha: 0, duration: 0.5, ease: "power3.out" })
        .from(".ig-line", { yPercent: 110, duration: 0.8, ease: "power4.out", stagger: 0.12 }, "-=0.2")
        .from(".ig-stage", { scale: 0.85, autoAlpha: 0, duration: 0.7, ease: "back.out(1.6)" }, "-=0.4")
        .from(".ig-foot", { autoAlpha: 0, duration: 0.5 }, "-=0.2");
      gsap.to(".ig-arrow", { y: iPad ? -12 : 12, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(".ig-halo", { scale: 1.12, autoAlpha: 0.5, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      const reveal = window.setTimeout(
        () => gsap.set(".ig-eyebrow, .ig-line, .ig-stage, .ig-foot", { clearProps: "opacity,visibility,transform" }),
        2000,
      );
      return () => window.clearTimeout(reveal);
    },
    { scope: root },
  );

  // Each step swaps in: the icon pops, the words rise.
  useGSAP(
    () => {
      if (calm()) return;
      gsap.fromTo(".ig-icon", { scale: 0.4, rotate: -25, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.7, ease: "back.out(2.2)" });
      gsap.fromTo(".ig-text", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: "power3.out", delay: 0.08 });
      const reveal = window.setTimeout(() => gsap.set(".ig-icon, .ig-text", { clearProps: "opacity,visibility,transform" }), 1200);
      return () => window.clearTimeout(reveal);
    },
    { scope: root, dependencies: [step] },
  );

  return (
    <main className={`install-gate ${iPad ? "is-ipad" : ""}`} ref={root}>
      <div className="ig-head">
        <p className="ig-eyebrow">One quick step</p>
        <h1>
          <span className="ig-mask"><span className="ig-line">Add me to your</span></span>
          <span className="ig-mask"><span className="ig-line ig-accent">Home Screen</span></span>
        </h1>
      </div>

      <button className="ig-stage" onClick={() => setStep((s) => (s + 1) % 3)} aria-label="Next step">
        <span className="ig-halo" aria-hidden="true" />
        <span className="ig-icon" key={`i${step}`} aria-hidden="true">{steps[step].icon}</span>
      </button>
      <p className="ig-text" key={`t${step}`} aria-live="polite">
        <span className="ig-step">{step + 1}</span>
        {steps[step].text}
      </p>
      <div className="ig-dots" aria-hidden="true">
        {steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}
      </div>

      <div className="ig-foot">
        <p>Full screen and timer alerts, even when your phone is locked.</p>
        <button className="ig-skip" onClick={onSkip}>Continue in Safari</button>
      </div>
      <div className="ig-arrow" aria-hidden="true">{iPad ? "↑" : "↓"}</div>
    </main>
  );
}
