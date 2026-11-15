import { describe, expect, it } from "vitest";
import { isFocusing, remaining } from "./pomodoro";
import type { PomodoroState } from "./types";

const now = Date.UTC(2026, 8, 19, 9);
const timer = (
  ago: number,
  overrides: Partial<PomodoroState> = {},
): PomodoroState => ({
  room_id: "room",
  user_id: "owner",
  phase: "focus",
  run_state: "running",
  phase_started_at: new Date(now - ago).toISOString(),
  remaining_ms: 25 * 60000,
  focus_minutes: 25,
  break_minutes: 5,
  focus_session_id: "session",
  updated_at: new Date(now).toISOString(),
  ...overrides,
});

describe("timestamp-driven Pomodoro presentation", () => {
  it("restores the same remaining time after refresh and elapsed time", () => {
    const saved = timer(5 * 60000);
    expect(remaining(JSON.parse(JSON.stringify(saved)), now)).toBe(20 * 60000);
    expect(remaining(saved, now + 60000)).toBe(19 * 60000);
  });
  it("does not decrement paused time", () => {
    expect(
      remaining(
        timer(60000, {
          run_state: "paused",
          phase_started_at: null,
          remaining_ms: 42000,
        }),
        now + 3600000,
      ),
    ).toBe(42000);
  });
  it("does not count expired focus while waiting for a server refresh", () => {
    const expired = timer(26 * 60000);
    expect(remaining(expired, now)).toBe(0);
    expect(isFocusing(expired, now)).toBe(false);
  });
  it("is not focusing without a timer or on break", () => {
    expect(isFocusing(timer(60000, { phase: "break" }), now)).toBe(false);
    expect(isFocusing(undefined, now)).toBe(false);
  });
});
