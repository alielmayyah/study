import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Share, SquarePlus, Smartphone } from "lucide-react";
import "../pages/room.css";

gsap.registerPlugin(useGSAP);

/*
 * On iPhone/iPad in Safari the app can't go full screen or send lock-screen
 * alerts. This page asks for the Home Screen install first; opening the app
 * from that icon skips it. Nothing identifying is shown here.
 */
export function InstallGate({ onSkip }: { onSkip: () => void }) {
  const root = useRef<HTMLElement>(null);
  const iPad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from(".ig-in", { y: 24, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.1 });
      gsap.to(".ig-arrow", { y: iPad ? -10 : 10, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: -1 });
      const reveal = window.setTimeout(() => gsap.set(".ig-in", { clearProps: "opacity,visibility,transform" }), 1800);
      return () => window.clearTimeout(reveal);
    },
    { scope: root },
  );

  return (
    <main className={`install-gate ${iPad ? "is-ipad" : ""}`} ref={root}>
      <div className="ig-card">
        <div className="ig-icon ig-in" aria-hidden="true">
          <Smartphone size={30} />
        </div>
        <h1 className="ig-in">Add to Home Screen</h1>
        <p className="ig-sub ig-in">For full screen and timer alerts, even when your phone is locked.</p>
        <ol className="ig-steps">
          <li className="ig-in">
            <span className="ig-num">1</span>
            <span>
              Tap <strong>Share</strong> <Share size={17} className="ig-inline" aria-label="Share icon" /> {iPad ? "at the top" : "at the bottom"} of Safari
            </span>
          </li>
          <li className="ig-in">
            <span className="ig-num">2</span>
            <span>
              Choose <strong>Add to Home Screen</strong> <SquarePlus size={17} className="ig-inline" aria-hidden="true" />
            </span>
          </li>
          <li className="ig-in">
            <span className="ig-num">3</span>
            <span>
              Tap <strong>Add</strong>, then open <strong>Study Room</strong> from your Home Screen
            </span>
          </li>
        </ol>
        <button className="ig-skip ig-in" onClick={onSkip}>
          Continue in Safari instead
        </button>
      </div>
      <div className="ig-arrow" aria-hidden="true">
        {iPad ? "↑" : "↓"}
      </div>
    </main>
  );
}
