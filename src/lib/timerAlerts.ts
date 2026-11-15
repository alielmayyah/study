import type { PomodoroState } from "./types";

export type TimerAlert = {
  id: string;
  title: string;
  body: string;
  complete: boolean;
};
export function deadline(timer?: PomodoroState): number | null {
  return timer?.run_state === "running" && timer.phase_started_at
    ? Date.parse(timer.phase_started_at) + timer.remaining_ms
    : null;
}

// Only emit a recent completion; reopening days later must not replay old alarms.
export function timerAlert(
  previous: PomodoroState | undefined,
  next: PomodoroState | undefined,
  now: number,
): TimerAlert | null {
  const end = deadline(previous);
  const changed = previous?.updated_at !== next?.updated_at;
  const stoppedEarly =
    changed && next && Date.parse(next.updated_at) < (end ?? Infinity);
  if (
    previous &&
    end !== null &&
    now >= end &&
    now - end < 60000 &&
    !stoppedEarly
  ) {
    return {
      id: `${previous.user_id}:${previous.phase}:${end}`,
      title:
        previous.phase === "focus"
          ? "Focus complete. Take a breath."
          : "Your break is over.",
      body:
        previous.phase === "focus"
          ? "Your focus time is saved. Time for a little rest."
          : "Ready for another focus session?",
      complete: true,
    };
  }
  if (
    !next ||
    !changed ||
    (next.phase === previous?.phase && next.run_state === previous?.run_state)
  )
    return null;
  if (now - Date.parse(next.updated_at) > 60000) return null;
  const title =
    next.phase === "idle"
      ? "Session ended."
      : next.run_state === "paused"
        ? next.phase === "break"
          ? "Break paused."
          : "Focus paused."
        : next.phase === "break"
          ? "Break timer is running."
          : previous?.run_state === "paused"
            ? "Focus resumed."
            : "Your focus timer is running.";
  return {
    id: `${next.user_id}:${next.updated_at}:${next.phase}:${next.run_state}`,
    title,
    body:
      next.run_state === "running"
        ? "Your timer keeps counting if you close the browser."
        : "Your progress is saved.",
    complete: false,
  };
}

let audio: AudioContext | undefined;
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state !== "running") void audio.resume().catch(() => {});
  } catch {
    /* Audio is optional on unsupported browsers. */
  }
}
let output: AudioNode | undefined;

export type ChimeKind = "focusDone" | "breakDone" | "tap";

// Music-box melodies (Hz). Bright, high and sweet.
const MELODIES: Record<ChimeKind, { notes: number[]; step: number }> = {
  // Focus finished: a little twinkling run up and back down.
  focusDone: { notes: [1318.5, 1568, 2093, 2637, 2349.3, 2093, 1568, 2093], step: 0.15 },
  // Break over: a gentle rising "let's go" arpeggio.
  breakDone: { notes: [1046.5, 1318.5, 1568, 1760, 2093], step: 0.17 },
  // Start / pause / resume: two quick sparkles.
  tap: { notes: [1760, 2637], step: 0.09 },
};

function musicBoxNote(context: AudioContext, destination: AudioNode, frequency: number, start: number, level: number) {
  // A music-box tine: pure tone + soft overtones, instant attack, long ring.
  [
    [1, 1],
    [2, 0.28],
    [3.01, 0.08],
  ].forEach(([ratio, amount]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * ratio;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level * amount, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.3 / ratio);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + 1.4);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });
}

// Loud, sweet chime. A soft echo adds sparkle; a compressor keeps it from clipping.
export function playChime(volume: number, kind: ChimeKind = "tap") {
  if (!audio || audio.state !== "running") return;
  const context = audio;
  if (!output) {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 6;
    const makeup = context.createGain();
    makeup.gain.value = 1.6;
    compressor.connect(makeup);
    makeup.connect(context.destination);
    const echo = context.createDelay();
    echo.delayTime.value = 0.19;
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const wet = context.createGain();
    wet.gain.value = 0.35;
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(compressor);
    const input = context.createGain();
    input.connect(compressor);
    input.connect(echo);
    output = input;
  }
  const level = Math.max(0, Math.min(1, volume)) * 0.7;
  const { notes, step } = MELODIES[kind];
  const repeat = kind === "tap" ? 1 : 2;
  for (let r = 0; r < repeat; r++) {
    notes.forEach((frequency, index) => {
      const start = context.currentTime + 0.02 + r * (notes.length * step + 0.6) + index * step;
      musicBoxNote(context, output!, frequency, start, level);
    });
  }
}
