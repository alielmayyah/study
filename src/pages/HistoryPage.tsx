import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useRoom } from '../hooks/useRoom'
import { useClock } from '../hooks/useClock'
import { useOwner } from '../lib/avatars'
import { activeIntervals, formatMinutes, localDayRange, totalTime } from '../lib/time'
import type { Interval } from '../lib/time'
import type { StudyBreak, StudySession } from '../lib/types'
import './room.css'
import './history.css'

gsap.registerPlugin(useGSAP)

type DaySession = { session: StudySession; duration: number; intervals: Interval[] }
type Day = { key: string; start: number; total: number; sessions: DaySession[] }
type Bucket = 'morning' | 'afternoon' | 'evening' | 'night'
type Analysis = { days: Map<string, Day>; longest: number; buckets: Record<Bucket, number> }

const CHART_DAYS = 14
const FLOWER_CAP = 12
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MOTION_OK = '(prefers-reduced-motion: no-preference)'

function dayKey(date: Date | number): string {
  return format(date, 'yyyy-MM-dd')
}

/** Local calendar day `offset` days from `base` (negative = past). DST-safe. */
function shiftDay(base: Date | number, offset: number): Date {
  const d = new Date(base)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
}

function bucketOf(hour: number): Bucket {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function analyse(sessions: StudySession[], breaks: StudyBreak[], now: number): Analysis {
  const breaksBySession = new Map<string, StudyBreak[]>()
  for (const b of breaks) {
    const list = breaksBySession.get(b.session_id)
    if (list) list.push(b)
    else breaksBySession.set(b.session_id, [b])
  }
  const days = new Map<string, Day>()
  const buckets: Record<Bucket, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  let longest = 0
  for (const session of sessions) {
    const own = breaksBySession.get(session.id) || []
    const end = session.ended_at ? Date.parse(session.ended_at) : now
    let sessionTotal = 0
    let range = localDayRange(new Date(session.started_at))
    // Walk every local day the session touches so midnight-crossing sessions are split.
    while (range.start < end) {
      const intervals = activeIntervals(session, own, now, range)
      const duration = totalTime(intervals)
      if (duration > 0) {
        const key = dayKey(range.start)
        const day = days.get(key) ?? { key, start: range.start, total: 0, sessions: [] }
        day.total += duration
        day.sessions.push({ session, duration, intervals })
        days.set(key, day)
        sessionTotal += duration
        for (const i of intervals) {
          let t = i.start
          while (t < i.end) {
            const d = new Date(t)
            const next = Math.min(i.end, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime())
            buckets[bucketOf(d.getHours())] += next - t
            t = next
          }
        }
      }
      range = localDayRange(new Date(range.end))
    }
    longest = Math.max(longest, sessionTotal)
  }
  return { days, longest, buckets }
}

function sumDays(days: Map<string, Day>, from: Date, count: number): number {
  let total = 0
  for (let i = 0; i < count; i++) total += days.get(dayKey(shiftDay(from, -i)))?.total ?? 0
  return total
}

function timeRange(session: StudySession): string {
  return `${format(new Date(session.started_at), 'h:mm a')} – ${format(new Date(session.ended_at!), 'h:mm a')}`
}

export function HistoryPage({ userId }: { userId: string }) {
  const owner = useOwner()
  const { data, loading, error, reload } = useRoom(userId, true)
  const now = useClock()
  const [picked, setPicked] = useState<number | null>(null) // null = today
  const [calOpen, setCalOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() })
  const scope = useRef<HTMLElement>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const sessions = useMemo(() => (data?.sessions || []).filter(s => s.ended_at), [data?.sessions])
  const breaks = useMemo(() => data?.breaks || [], [data?.breaks])
  // Recompute once a minute, not on every clock tick.
  const minute = Math.floor(now / 60000)
  const { days, longest, buckets } = useMemo(() => analyse(sessions, breaks, minute * 60000), [sessions, breaks, minute])
  const hasData = !loading && sessions.length > 0

  const today = shiftDay(now, 0)
  const todayKey = dayKey(today)
  const yesterday = shiftDay(today, -1)
  const yesterdayKey = dayKey(yesterday)
  const selectedStart = picked ?? today.getTime()
  const selectedKey = dayKey(selectedStart)
  const selected = days.get(selectedKey)
  const selectedRange = localDayRange(new Date(selectedStart))
  const selectedTitle = selectedKey === todayKey ? 'Today' : selectedKey === yesterdayKey ? 'Yesterday' : format(selectedStart, 'EEEE, MMM d')
  const pickedCustom = selectedKey !== todayKey && selectedKey !== yesterdayKey

  // Insights
  let streak = 0
  for (let i = days.has(todayKey) ? 0 : 1; days.has(dayKey(shiftDay(today, -i))); i++) streak++
  let best: Day | undefined
  let allTotal = 0
  let maxDay = 0
  for (const day of days.values()) {
    allTotal += day.total
    maxDay = Math.max(maxDay, day.total)
    if (!best || day.total > best.total) best = day
  }
  const favourite = (Object.entries(buckets) as [Bucket, number][]).reduce<[Bucket, number] | null>((top, entry) => entry[1] > (top?.[1] ?? 0) ? entry : top, null)
  const thisWeek = sumDays(days, today, 7)
  const lastWeek = sumDays(days, shiftDay(today, -7), 7)
  const weekChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null
  const average = days.size > 0 ? allTotal / days.size : 0
  const favouriteEmoji: Record<Bucket, string> = { morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌌' }

  // 14-day chart
  const chart = Array.from({ length: CHART_DAYS }, (_, idx) => {
    const date = shiftDay(today, idx - (CHART_DAYS - 1))
    const key = dayKey(date)
    return { key, date, total: days.get(key)?.total ?? 0 }
  })
  const chartMax = Math.max(...chart.map(d => d.total), 1)

  // Calendar month grid (Monday first)
  const monthStart = new Date(viewMonth)
  const leading = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
  const calCells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1)),
  ]
  const atCurrentMonth = monthStart.getFullYear() === today.getFullYear() && monthStart.getMonth() === today.getMonth()

  const selectDay = (start: number) => {
    setPicked(dayKey(start) === todayKey ? null : start)
    setCalOpen(false)
  }
  const toggleCalendar = () => {
    if (!calOpen) setViewMonth(new Date(new Date(selectedStart).getFullYear(), new Date(selectedStart).getMonth(), 1).getTime())
    setCalOpen(!calOpen)
  }
  const shiftMonth = (delta: number) => setViewMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + delta, 1).getTime())

  // Entrance: bars grow, insight cards rise.
  useGSAP(() => {
    if (!hasData) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      gsap.from('.h-bar-fill', { scaleY: 0, transformOrigin: 'bottom', duration: 0.6, ease: 'power3.out', stagger: 0.035 })
      gsap.from('.h-insight', { opacity: 0, y: 10, duration: 0.45, ease: 'power2.out', stagger: 0.06, delay: 0.15 })
    })
    return () => mm.revert()
  }, { scope, dependencies: [hasData], revertOnUpdate: true })

  // Day switch: fade/slide the card body.
  useGSAP(() => {
    if (!scope.current?.querySelector('.h-card-body')) return
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      gsap.from('.h-card-body', { opacity: 0, y: 8, duration: 0.35, ease: 'power2.out' })
    })
    return () => mm.revert()
  }, { scope, dependencies: [selectedKey, hasData], revertOnUpdate: true })

  // Calendar open/close.
  useGSAP(() => {
    const el = calRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.to(el, {
      height: calOpen ? 'auto' : 0,
      autoAlpha: calOpen ? 1 : 0,
      duration: reduce ? 0 : 0.3,
      ease: 'power2.out',
      overwrite: true,
    })
  }, { scope, dependencies: [calOpen, hasData] })

  return <div className="app-shell history-shell theme-main">
    <header className="m-header">
      <Link className="h-back" to="/" aria-label="Back to room"><ChevronLeft size={18} aria-hidden="true" /> Room</Link>
      <span className="m-brand">{owner.name.toUpperCase()}</span>
    </header>
    <main className="h-main" ref={scope}>
      <div className="h-hero">
        <img className="h-avatar" src={owner.avatar} alt="" width={60} height={60} />
        <h1 className="h-title">History</h1>
      </div>
      {error && <div className="h-error" role="alert"><span>{error}</span><button className="h-pill" onClick={() => void reload()}>Retry</button></div>}
      {loading ? <p className="h-quiet">Loading sessions…</p> : sessions.length === 0 ? <p className="h-quiet">No sessions yet. Your first pomodoro will show up here.</p> : <>

        {/* 1. Day picker */}
        <div className="h-chips" role="group" aria-label="Choose a day">
          <button className="h-chip" aria-pressed={selectedKey === todayKey} onClick={() => selectDay(today.getTime())}>Today</button>
          <button className="h-chip" aria-pressed={selectedKey === yesterdayKey} onClick={() => selectDay(yesterday.getTime())}>Yesterday</button>
          <button className="h-chip" aria-pressed={pickedCustom} aria-expanded={calOpen} aria-controls="h-calendar" onClick={toggleCalendar}>
            📅 {pickedCustom ? format(selectedStart, 'MMM d') : 'Pick a day'}
          </button>
        </div>
        <div className="h-cal" id="h-calendar" ref={calRef} onKeyDown={e => { if (e.key === 'Escape') setCalOpen(false) }}>
          <div className="h-cal-inner">
            <div className="h-cal-head">
              <button className="h-cal-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button>
              <span aria-live="polite">{format(monthStart, 'MMMM yyyy')}</span>
              <button className="h-cal-nav" aria-label="Next month" disabled={atCurrentMonth} onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button>
            </div>
            <div className="h-cal-grid">
              {WEEKDAYS.map((w, i) => <span key={i} className="h-cal-wd" aria-hidden="true">{w}</span>)}
              {calCells.map((date, i) => {
                if (!date) return <span key={`blank-${i}`} />
                const key = dayKey(date)
                const total = days.get(key)?.total ?? 0
                const ratio = maxDay > 0 ? total / maxDay : 0
                const future = date.getTime() > today.getTime()
                const cls = ['h-cal-day', key === selectedKey && 'is-selected', key === todayKey && 'is-today'].filter(Boolean).join(' ')
                return <button key={key} className={cls} disabled={future} aria-pressed={key === selectedKey}
                  aria-label={`${format(date, 'EEEE, MMM d')}${total > 0 ? `, ${formatMinutes(total)}` : ''}`}
                  onClick={() => selectDay(date.getTime())}>
                  {date.getDate()}
                  {total > 0 && <i className="h-cal-dot" style={{ width: 4 + ratio * 4, height: 4 + ratio * 4, opacity: 0.5 + ratio * 0.5 }} />}
                </button>
              })}
            </div>
          </div>
        </div>

        {/* 2. Selected day card */}
        <section className="h-card" aria-labelledby="h-card-title">
          <div className="h-card-body" key={selectedKey}>
            <h2 className="h-section" id="h-card-title">{selectedTitle}</h2>
            {!selected ? <p className="h-rest">A rest day 🌙 — that's okay too.</p> : <>
              <p className="h-big">{formatMinutes(selected.total)} <span>focused</span></p>
              <p className="h-flowers" aria-label={`${selected.sessions.length} ${selected.sessions.length === 1 ? 'pomodoro' : 'pomodoros'}`}>
                <span aria-hidden="true">{'🌸'.repeat(Math.min(FLOWER_CAP, selected.sessions.length))}</span>
                {selected.sessions.length > FLOWER_CAP && <span className="h-more" aria-hidden="true">+{selected.sessions.length - FLOWER_CAP}</span>}
                <span className="h-count" aria-hidden="true">{selected.sessions.length} {selected.sessions.length === 1 ? 'pomodoro' : 'pomodoros'}</span>
              </p>
              <div className="h-strip" aria-hidden="true">
                <div className="h-strip-bar">
                  {selected.sessions.flatMap(({ session, intervals }) => intervals.map((iv, n) => {
                    const span = selectedRange.end - selectedRange.start
                    return <span key={`${session.id}-${n}`} className="h-strip-seg" style={{ left: `${((iv.start - selectedRange.start) / span) * 100}%`, width: `${Math.max(0.6, ((iv.end - iv.start) / span) * 100)}%` }} />
                  }))}
                  {[25, 50, 75].map(p => <i key={p} className="h-strip-tick" style={{ left: `${p}%` }} />)}
                </div>
                <div className="h-strip-labels">
                  <span style={{ left: '0%' }}>12am</span><span style={{ left: '25%' }}>6am</span><span style={{ left: '50%' }}>12pm</span><span style={{ left: '75%' }}>6pm</span><span style={{ left: '100%' }}>12am</span>
                </div>
              </div>
              <ul className="h-sessions">
                {[...selected.sessions].sort((a, b) => Date.parse(a.session.started_at) - Date.parse(b.session.started_at)).map(({ session, duration }) =>
                  <li key={session.id}><span>{timeRange(session)}</span><span className="h-duration">{formatMinutes(duration)}</span></li>)}
              </ul>
            </>}
          </div>
        </section>

        {/* 3. Little insights */}
        <section className="h-block" aria-labelledby="h-insights-title">
          <h2 className="h-section" id="h-insights-title">Little insights</h2>
          <ul className="h-insights">
            {streak > 0 && <li className="h-insight"><span className="h-emoji" aria-hidden="true">🔥</span><strong>{streak}-day streak</strong><span>Keep it going</span></li>}
            {best && <li className="h-insight"><span className="h-emoji" aria-hidden="true">🏆</span><strong>{formatMinutes(best.total)}</strong><span>Best day · {format(best.start, 'MMM d')}</span></li>}
            {favourite && <li className="h-insight"><span className="h-emoji" aria-hidden="true">⏰</span><strong>{favouriteEmoji[favourite[0]]} {favourite[0][0].toUpperCase() + favourite[0].slice(1)}</strong><span>Favourite time to study</span></li>}
            {weekChange !== null && <li className="h-insight"><span className="h-emoji" aria-hidden="true">📈</span><strong>{weekChange === 0 ? 'Same' : `${weekChange > 0 ? '+' : ''}${weekChange}%`}</strong><span>{weekChange === 0 ? 'as last week' : 'vs last week'}</span></li>}
            {longest > 0 && <li className="h-insight"><span className="h-emoji" aria-hidden="true">🌙</span><strong>{formatMinutes(longest)}</strong><span>Longest session</span></li>}
            {average > 0 && <li className="h-insight"><span className="h-emoji" aria-hidden="true">🍵</span><strong>{formatMinutes(average)}</strong><span>Your average day</span></li>}
          </ul>
        </section>

        {/* 4. 14-day chart */}
        <section className="h-block" aria-labelledby="h-chart-title">
          <h2 className="h-section" id="h-chart-title">Last 14 days</h2>
          <ul className="h-chart">{chart.map(d => {
            const label = `${format(d.date, 'EEE, MMM d')}: ${formatMinutes(d.total)}`
            const cls = ['h-bar', d.key === todayKey && 'is-today', d.key === selectedKey && 'is-selected'].filter(Boolean).join(' ')
            return <li key={d.key} className={cls}>
              <button className="h-bar-btn" title={label} aria-label={label} aria-pressed={d.key === selectedKey} onClick={() => selectDay(d.date.getTime())}>
                <span className="h-bar-track">
                  <span className="h-bar-fill" style={{ height: d.total > 0 ? `${Math.max(4, (d.total / chartMax) * 100)}%` : undefined }} />
                </span>
                <span className="h-bar-label" aria-hidden="true">{format(d.date, 'EEEEE')}</span>
              </button>
            </li>
          })}</ul>
        </section>
      </>}
    </main>
  </div>
}
