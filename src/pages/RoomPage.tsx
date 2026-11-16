import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BloomTimer } from "../components/BloomTimer";
import { BloomLoader } from "../components/Transitions";
import { goFullscreen } from "../lib/fullscreen";
import {
  Check,
  History,
  LogOut,
  ArrowRight,
  BarChart3,
  Flower2,
  Heart,
  Target,
  Minus,
  Plus,
  Pause,
  Play,
  Smartphone,
  WifiOff,
  Bell,
  X,
  Share2,
  PlusSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useRoom } from "../hooks/useRoom";
import type { RoomData } from "../hooks/useRoom";
import { useClock } from "../hooks/useClock";
import { useTimerAlerts } from "../hooks/useTimerAlerts";
import {
  activeIntervals,
  formatCountdown,
  formatMinutes,
  localDayRange,
  totalTime,
} from "../lib/time";
import { remaining, isFocusing } from "../lib/pomodoro";
import { supabase } from "../lib/supabase";
import { useOwner } from "../lib/avatars";
import {
  isIOS,
  isStandalone,
} from "../lib/pushSubscription";
import type { UserStatus } from "../lib/types";
import "./room.css";

const CHEERS = [
  "You’re doing amazing, {name} 🌸",
  "Future Dr. {name} is proud of you 🩺",
  "One page at a time. You’ve got this ✨",
  "Small steps still move you forward 💗",
  "Your focus is your superpower 💪",
  "Stay with it. Your break is coming ☕",
  "Every minute here counts 📚",
  "Breathe in, keep going 🌷",
  "Hard now, proud later 💫",
  "You’re building something beautiful 🌼",
];
const BREAK_CHEERS = [
  "Stretch, sip some water 💧",
  "Rest your eyes for a moment 🌙",
  "You earned this little break 🍓",
  "Breathe. You’re doing so well 🌸",
];
// The connected page owns persistence; the view receives authoritative snapshots.
export function RoomPage({ userId }: { userId: string }) {
  const room = useRoom(userId);
  const now = useClock();
  if (room.loading && !room.data)
    return (
      <div className="loading-screen">
        <BloomLoader />
      </div>
    );
  if (!room.data)
    return (
      <main className="empty-screen">
        <h1>We couldn’t open the room.</h1>
        <p>{room.error}</p>
        <button className="primary" onClick={() => void room.reload()}>
          Try again
        </button>
        <button
          className="text-button"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </main>
    );
  if (!room.data.profiles.some((p) => p.id === userId))
    return (
      <main className="empty-screen">
        <h1>Account not set up</h1>
        <p>Your account needs a profile in this room.</p>
        <button
          className="secondary"
          onClick={() => void supabase.auth.signOut()}
        >
          Sign out
        </button>
      </main>
    );
  return <RoomView {...room} data={room.data} userId={userId} now={now} />;
}

type RoomViewProps = {
  data: RoomData;
  userId: string;
  now: number;
  connected: boolean;
  error: string;
  reload: () => Promise<void>;
};

export function RoomView({
  data,
  userId,
  now,
  connected,
  error,
  reload,
}: RoomViewProps) {
  const [busy, setBusy] = useState(false);
  const commandPending = useRef(false);
  const owner = useOwner();
  const root = useRef<HTMLDivElement>(null);
  const [actionError, setActionError] = useState("");
  const ownTimer = data.timers.find((t) => t.user_id === userId);
  const alerts = useTimerAlerts(ownTimer, now, userId);
  const [preset, setPreset] = useState(() => {
    const f = ownTimer?.focus_minutes ?? 25,
      b = ownTimer?.break_minutes ?? 5;
    return f === 25 && b === 5
      ? "25/5"
      : f === 50 && b === 10
        ? "50/10"
        : "Custom";
  });
  const [focusMinutes, setFocusMinutes] = useState(
    ownTimer?.focus_minutes ?? 25,
  );
  const [breakMinutes, setBreakMinutes] = useState(
    ownTimer?.break_minutes ?? 5,
  );
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const isIosDevice = isIOS();
  const isStandaloneMode = isStandalone();

  useEffect(() => {
    if (isIosDevice && !isStandaloneMode) {
      const dismissed = sessionStorage.getItem("study_dismissed_ios_guide");
      if (!dismissed) {
        const timer = setTimeout(() => setShowIosGuide(true), 600);
        return () => clearTimeout(timer);
      }
    } else if (alerts.pushSupported && !alerts.push) {
      const dismissed = sessionStorage.getItem("study_dismissed_push_modal");
      if (!dismissed) {
        const timer = setTimeout(() => setShowPushModal(true), 700);
        return () => clearTimeout(timer);
      }
    }
  }, [isIosDevice, isStandaloneMode, alerts.pushSupported, alerts.push]);

  const dismissIosGuide = () => {
    setShowIosGuide(false);
    try {
      sessionStorage.setItem("study_dismissed_ios_guide", "true");
    } catch {
      /* storage unavailable */
    }
  };

  const dismissPushModal = () => {
    setShowPushModal(false);
    try {
      sessionStorage.setItem("study_dismissed_push_modal", "true");
    } catch {
      /* storage unavailable */
    }
  };

  const me = data.profiles.find((p) => p.id === userId)!;
  const day = localDayRange(new Date(now));
  const mySessions = data.sessions.filter((s) => s.user_id === userId);
  const sessionTimes = mySessions.map((s) => {
    const timer = data.timers.find((t) => t.focus_session_id === s.id);
    const cap =
      timer?.run_state === "running" && timer.phase_started_at
        ? Date.parse(timer.phase_started_at) + timer.remaining_ms
        : undefined;
    return totalTime(activeIntervals(s, data.breaks, now, day, cap));
  });
  const total = sessionTimes.reduce((sum, t) => sum + t, 0);
  const longest = sessionTimes.length ? Math.max(...sessionTimes) : 0;
  const completed = mySessions.filter(
    (s) => s.ended_at && Date.parse(s.ended_at) >= day.start,
  ).length;
  const focusing = isFocusing(ownTimer, now);
  const idle = !ownTimer || ownTimer.phase === "idle";
  const paused = ownTimer?.run_state === "paused";
  const onBreak = ownTimer?.phase === "break";
  const timeLeft = idle ? focusMinutes * 60000 : remaining(ownTimer, now);
  const duration =
    (idle
      ? focusMinutes
      : onBreak
        ? ownTimer.break_minutes
        : ownTimer.focus_minutes) * 60000;
  const progress =
    duration > 0 ? Math.max(0, Math.min(1, timeLeft / duration)) : 0;
  const validDuration =
    Number.isInteger(focusMinutes) &&
    focusMinutes >= 1 &&
    focusMinutes <= 180 &&
    Number.isInteger(breakMinutes) &&
    breakMinutes >= 1 &&
    breakMinutes <= 60;
  async function command(action: string, status?: UserStatus["status"]) {
    if (commandPending.current || !connected) return;
    commandPending.current = true;
    setBusy(true);
    setActionError("");
    try {
      const run = async (next: string) => {
        const { error: cause } = await supabase.rpc("pomodoro_command", {
          p_room: data.room.id,
          p_action: next,
          p_focus_minutes:
            next === "start"
              ? action === "back_to_focus"
                ? (ownTimer?.focus_minutes ?? focusMinutes)
                : focusMinutes
              : null,
          p_break_minutes:
            next === "start"
              ? action === "back_to_focus"
                ? (ownTimer?.break_minutes ?? breakMinutes)
                : breakMinutes
              : null,
          p_status: status || null,
        });
        if (cause) throw cause;
      };
      if (action === "back_to_focus") {
        await run("skip_break");
        await run("start");
      } else await run(action);
      await reload();
      alerts.dismissReturn();
      if (action === "start" || action === "back_to_focus") {
        supabase.functions.invoke("push-dispatch").catch(() => {});
      }
    } catch {
      setActionError("Could not save that change. Please try again.");
      await reload();
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  }
  function selectPreset(value: string) {
    setPreset(value);
    if (value === "25/5") {
      setFocusMinutes(25);
      setBreakMinutes(5);
    }
    if (value === "50/10") {
      setFocusMinutes(50);
      setBreakMinutes(10);
    }
  }
  const activePreset = idle
    ? preset
    : ownTimer.focus_minutes === 25 && ownTimer.break_minutes === 5
      ? "25/5"
      : ownTimer.focus_minutes === 50 && ownTimer.break_minutes === 10
        ? "50/10"
        : "Custom";

  const hour = new Date(now).getHours();
  const greeting = focusing
    ? "In the zone."
    : onBreak
      ? "Take a breath."
      : paused
        ? "Paused. Take your time."
        : `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${me.display_name}.`;
  const primaryAction = idle
    ? "start"
    : onBreak
      ? "back_to_focus"
      : paused
        ? "resume"
        : "pause";
  const primaryLabel = busy
    ? "Saving…"
    : idle
      ? "Start"
      : onBreak
        ? "Focus again"
        : paused
          ? "Resume"
          : "Pause";

  // Rotating motivational lines while a timer runs.
  const cheering = focusing || (onBreak && !paused);
  const [cheer, setCheer] = useState(() => Math.floor(Math.random() * CHEERS.length));
  useEffect(() => {
    if (!cheering) return;
    const id = window.setInterval(() => setCheer((c) => c + 1), 14000);
    return () => window.clearInterval(id);
  }, [cheering]);
  const cheerLines = onBreak ? BREAK_CHEERS : CHEERS;
  const cheerText = cheerLines[cheer % cheerLines.length].replace("{name}", me.display_name);
  const phaseKey = idle ? "idle" : `${ownTimer.phase}-${ownTimer.run_state}`;
  const lastPhase = useRef(phaseKey);

  // Entrance: everything rises in, one after another.
  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".m-in", {
          y: 24,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
        });
        gsap.from(".m-avatar img", { scale: 0.7, duration: 0.9, ease: "elastic.out(1, 0.6)" });
      });
      // Safety net: if animation frames are paused, still show everything.
      const reveal = window.setTimeout(() => gsap.set(".m-in, .m-avatar img", { clearProps: "opacity,visibility,transform" }), 2000);
      return () => window.clearTimeout(reveal);
    },
    { scope: root },
  );

  // While focusing: the glow breathes and the photo floats gently.
  useGSAP(
    () => {
      if (!focusing) return;
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".m-dial-glow",
          { scale: 0.92, autoAlpha: 0.35 },
          { scale: 1.06, autoAlpha: 0.8, duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true },
        );
        gsap.to(".m-avatar", { y: -6, duration: 2.6, ease: "sine.inOut", repeat: -1, yoyo: true });
      });
    },
    { scope: root, dependencies: [focusing], revertOnUpdate: true },
  );

  // Phase changes: the time pops, and finishing a focus throws petals.
  useGSAP(
    () => {
      const previous = lastPhase.current;
      lastPhase.current = phaseKey;
      if (previous === phaseKey) return;
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".lj-copy",
          { scale: 0.85, autoAlpha: 0.3 },
          { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2)" },
        );
        if (previous.startsWith("focus") && phaseKey.startsWith("break")) burst();
      });
    },
    { scope: root, dependencies: [phaseKey] },
  );

  function burst() {
    const host = root.current?.querySelector(".m-burst");
    if (!host) return;
    for (let i = 0; i < 16; i++) {
      const petal = document.createElement("i");
      host.appendChild(petal);
      const angle = (i / 16) * Math.PI * 2;
      const distance = 140 + Math.random() * 80;
      gsap.fromTo(
        petal,
        { x: 0, y: 0, scale: 0.4, rotate: 0, autoAlpha: 1 },
        {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance + 40,
          rotate: Math.random() * 360,
          scale: 1,
          autoAlpha: 0,
          duration: 1.6,
          ease: "power2.out",
          onComplete: () => petal.remove(),
        },
      );
    }
  }

  return (
    <div
      ref={root}
      className={`app-shell room-shell theme-main ${focusing ? "is-focusing" : ""}`}
    >
      <header className="m-header">
        <span className="m-brand">{me.display_name.toUpperCase()}</span>
        <nav aria-label="Main navigation">
          <Link className="m-history-pill" to="/history">
            <History size={16} aria-hidden="true" />
            History
          </Link>
          <button
            className="icon-button"
            onClick={() => void supabase.auth.signOut()}
            aria-label="Lock room"
            title="Lock"
          >
            <LogOut size={18} />
          </button>
        </nav>
      </header>
      {(!connected || error) && (
        <div className="m-banner" role={error ? "alert" : "status"}>
          {error ? (
            <>
              {error} <button onClick={() => void reload()}>Retry</button>
            </>
          ) : (
            <>
              <WifiOff size={14} /> Reconnecting… your timer is saved.
            </>
          )}
        </div>
      )}
      <main className="m-main">
        {alerts.returnReminder && (
          <section className="m-banner m-reminder" aria-label="Running timer reminder">
            <Bell size={14} aria-hidden="true" />
            <span>Your {onBreak ? "break" : "focus"} kept going while you were away.</span>
            <button onClick={alerts.dismissReturn}>Continue</button>
            <button disabled={busy || !connected} onClick={() => void command("end")}>
              End
            </button>
          </section>
        )}
        <div className="m-avatar m-in">
          <div className="m-avatar-glow" aria-hidden="true" />
          <img src={owner.avatar} alt="" />
        </div>
        <p className="m-greeting m-in">{greeting}</p>
        {cheering && <Cheer text={cheerText} />}
        <div
          className={`m-dial m-in ${onBreak ? "is-break" : ""} ${idle ? "is-pressable" : ""}`}
          role={idle ? "button" : "timer"}
          tabIndex={idle ? 0 : undefined}
          aria-disabled={idle ? busy || !connected || !validDuration : undefined}
          aria-label={
            idle
              ? `Press to start a ${focusMinutes} minute focus`
              : `${paused ? "Paused" : onBreak ? "Break" : "Focus"} timer: ${formatCountdown(timeLeft)} remaining`
          }
          onClick={() => {
            goFullscreen();
            if (idle && !busy && connected && validDuration) void command("start");
          }}
          onKeyDown={(event) => {
            if (idle && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              if (!busy && connected && validDuration) void command("start");
            }
          }}
        >
          <div className="m-dial-glow" aria-hidden="true" />
          <div className="m-burst" aria-hidden="true" />
          <BloomTimer
            timeLeft={timeLeft}
            progress={progress}
            mode={idle ? "idle" : paused ? "paused" : onBreak ? "break" : "focus"}
          />
        </div>
        {idle && (
          <div className="m-presets m-in" role="group" aria-label="Focus and break duration">
            {["25/5", "50/10", "Custom"].map((value) => (
              <button
                key={value}
                disabled={busy}
                aria-pressed={activePreset === value}
                className={activePreset === value ? "selected" : ""}
                onClick={() => selectPreset(value)}
              >
                {value === "Custom" ? "Custom" : value.replace("/", " · ")}
              </button>
            ))}
          </div>
        )}
        {idle && preset === "Custom" && (
          <div className="m-custom">
            <Stepper
              label="Focus"
              value={focusMinutes}
              min={1}
              max={180}
              step={focusMinutes >= 30 ? 5 : 1}
              onChange={setFocusMinutes}
            />
            <Stepper
              label="Break"
              value={breakMinutes}
              min={1}
              max={60}
              step={1}
              onChange={setBreakMinutes}
            />
          </div>
        )}
        {!idle && (
        <div className="m-actions">
          <button
            className="m-primary"
            disabled={busy || !connected || !validDuration}
            onClick={() => void command(primaryAction)}
          >
            {primaryAction === "pause" ? <Pause size={16} /> : <Play size={16} />}
            {primaryLabel}
          </button>
          {!idle && !onBreak && (
            <button
              className="m-ghost"
              disabled={busy || !connected}
              onClick={() => void command("break")}
            >
              Break
            </button>
          )}
          {!idle && (
            <button
              className="m-ghost"
              disabled={busy || !connected}
              onClick={() => void command("end")}
            >
              End
            </button>
          )}
        </div>
        )}
        {actionError && (
          <p className="error m-error" role="alert">
            {actionError}
          </p>
        )}
        <section className="m-day m-in" aria-labelledby="today-heading">
          <div className="m-day-head">
            <h2 id="today-heading">
              <BarChart3 size={15} aria-hidden="true" /> TODAY
            </h2>
            <Link to="/history" className="m-day-link">
              View insights <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="m-day-grid">
            <div className="m-stat">
              <span className="m-stat-label"><Target size={15} aria-hidden="true" /> Focus</span>
              <strong>{formatMinutes(total)}</strong>
            </div>
            <div className="m-stat">
              <span className="m-stat-label"><Flower2 size={15} aria-hidden="true" /> Pomodoros</span>
              <strong>{completed}</strong>
            </div>
            <div className="m-stat">
              <span className="m-stat-label"><Heart size={15} aria-hidden="true" /> Longest</span>
              <strong>{formatMinutes(longest)}</strong>
            </div>
          </div>
        </section>
      </main>
      <div
        className="timer-toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {alerts.notice && (
          <div className="timer-toast">
            <Bell size={18} aria-hidden="true" />
            <div>
              <strong>{alerts.notice.title}</strong>
              <p>{alerts.notice.body}</p>
            </div>
            <button
              className="icon-button"
              aria-label="Dismiss timer notification"
              onClick={alerts.dismissNotice}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {showIosGuide && (
        <div
          className="modal-overlay"
          onClick={dismissIosGuide}
          role="dialog"
          aria-modal="true"
          aria-label="iPhone notification setup guide"
        >
          <div className="ios-guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ios-guide-header">
              <div>
                <h3 className="ios-guide-title">
                  <Smartphone size={20} color="var(--pink-soft)" /> Enable on iPhone
                </h3>
                <p className="ios-guide-subtitle">
                  Get a ping when your focus or break ends, even with your phone locked.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={dismissIosGuide}
                aria-label="Close guide"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ios-step-list">
              <div className="ios-step-item">
                <div className="ios-step-badge">1</div>
                <div className="ios-step-content">
                  <p className="ios-step-title">
                    <Share2 size={16} /> Tap the Share button
                  </p>
                  <p className="ios-step-desc">
                    In Safari’s bottom toolbar, tap the <strong>Share</strong> icon (square with arrow pointing up).
                  </p>
                </div>
              </div>

              <div className="ios-step-item">
                <div className="ios-step-badge">2</div>
                <div className="ios-step-content">
                  <p className="ios-step-title">
                    <PlusSquare size={16} /> Tap "Add to Home Screen"
                  </p>
                  <p className="ios-step-desc">
                    Scroll down and select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </p>
                </div>
              </div>

              <div className="ios-step-item">
                <div className="ios-step-badge">3</div>
                <div className="ios-step-content">
                  <p className="ios-step-title">
                    <Bell size={16} /> Open & Turn On Alerts
                  </p>
                  <p className="ios-step-desc">
                    Open <strong>Study Room</strong> from your Home Screen and tap <strong>Allow</strong> when prompted!
                  </p>
                </div>
              </div>
            </div>

            <button
              className="primary"
              onClick={dismissIosGuide}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {showPushModal && alerts.pushSupported && (
        <div
          className="modal-overlay"
          onClick={dismissPushModal}
          role="dialog"
          aria-modal="true"
          aria-label="Turn on notifications"
        >
          <div className="ios-guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ios-guide-header">
              <div>
                <h3 className="ios-guide-title">
                  <Bell size={20} color="var(--accent)" /> Enable Phone Notifications
                </h3>
                <p className="ios-guide-subtitle">
                  Never miss the end of a pomodoro.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={dismissPushModal}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {alerts.push ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "rgba(74, 222, 128, 0.15)",
                    border: "1px solid rgba(74, 222, 128, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                  }}
                >
                  <Check size={28} color="#4ade80" />
                </div>
                <h4
                  style={{
                    margin: "0 0 6px",
                    fontSize: 17,
                    color: "var(--text-primary)",
                  }}
                >
                  Notifications Active!
                </h4>
                <p
                  style={{
                    margin: "0 0 16px",
                    color: "var(--text-secondary)",
                    fontSize: 13.5,
                    lineHeight: 1.45,
                  }}
                >
                  You’ll get a lock-screen alert when your focus or break time is up.
                </p>
                <button
                  className="primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={dismissPushModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--text-secondary)",
                    margin: "4px 0 10px 0",
                    lineHeight: 1.5,
                  }}
                >
                  Allow notifications so you’re alerted when your timer
                  completes, even with your phone locked or the browser closed.
                </p>

                {alerts.pushError && (
                  <div
                    className="test-push-feedback"
                    style={{
                      borderColor: "#f87171",
                      color: "#fca5a5",
                      marginBottom: 8,
                    }}
                  >
                    {alerts.pushError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 4,
                  }}
                >
                  <button
                    className="primary"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      padding: "12px 16px",
                    }}
                    onClick={async () => {
                      await alerts.togglePush();
                    }}
                  >
                    <Bell size={16} /> Allow Notifications
                  </button>
                  <button
                    className="secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={dismissPushModal}
                  >
                    Maybe later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const set = (next: number) => onChange(Math.max(min, Math.min(max, next)));
  return (
    <div className="m-stepper" role="group" aria-label={`${label} minutes`}>
      <span className="m-stepper-label">{label}</span>
      <div className="m-stepper-row">
        <button
          type="button"
          aria-label={`Less ${label.toLowerCase()} time`}
          disabled={value <= min}
          onClick={() => set(value - step)}
        >
          <Minus size={16} />
        </button>
        <output aria-live="polite">
          {value}
          <small>min</small>
        </output>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()} time`}
          disabled={value >= max}
          onClick={() => set(value + step)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

// Fades each new line in once, only when the text actually changes.
function Cheer({ text }: { text: string }) {
  const el = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(el.current, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" });
    },
    { dependencies: [text] },
  );
  return (
    <p className="m-cheer" ref={el} aria-live="polite">
      {text}
    </p>
  );
}
