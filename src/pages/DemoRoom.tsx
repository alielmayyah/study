// Dev-only preview of the room with sample data, so the design can be checked
// without a database. Open http://localhost:5173/#/demo while `npm run dev` runs.
import { useClock } from "../hooks/useClock";
import type { RoomData } from "../hooks/useRoom";
import { RoomView } from "./RoomPage";

const id = "demo-owner";
const room = "demo-room";
const started = Date.now() - 14 * 60000;
const iso = (ms: number) => new Date(ms).toISOString();

const data: RoomData = {
  room: { id: room, name: "Demo", created_at: iso(started) },
  profiles: [{ id, display_name: "Demo", created_at: iso(started) }],
  sessions: [
    { id: "s1", room_id: room, user_id: id, subject: null, started_at: iso(started - 3 * 3600000), ended_at: iso(started - 3 * 3600000 + 25 * 60000), created_at: iso(started) },
    { id: "s2", room_id: room, user_id: id, subject: null, started_at: iso(started - 2 * 3600000), ended_at: iso(started - 2 * 3600000 + 50 * 60000), created_at: iso(started) },
    { id: "s3", room_id: room, user_id: id, subject: null, started_at: iso(started), ended_at: null, created_at: iso(started) },
  ],
  breaks: [],
  timers: [
    { room_id: room, user_id: id, phase: "focus", run_state: "running", phase_started_at: iso(started), remaining_ms: 25 * 60000, focus_minutes: 25, break_minutes: 5, focus_session_id: "s3", updated_at: iso(started) },
  ],
  statuses: [{ room_id: room, user_id: id, status: "focus", updated_at: iso(started) }],
};

export function DemoRoom() {
  const now = useClock();
  return <RoomView data={data} userId={id} now={now} connected error="" reload={async () => {}} />;
}
