import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase, configured } from './lib/supabase'
import { RoomPage } from './pages/RoomPage'
import { HistoryPage } from './pages/HistoryPage'
import { DemoRoom } from './pages/DemoRoom'
import { HelloPage } from './pages/HelloPage'
import { Splash } from './components/Splash'
import { BloomLoader, PageTransition } from './components/Transitions'
import { goFullscreen } from './lib/fullscreen'
import { OwnerContext, fallbackAvatar, type Owner } from './lib/avatars'

const PIN_LENGTH = 4

function SignIn({ session, onUnlocked }: { session: Session | null; onUnlocked: (id: string) => void }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  async function submit(pin: string) {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (!session) {
        const { error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError
      }
      const { data, error: unlockError } = await supabase.rpc('unlock', { p_passcode: pin })
      if (unlockError || !data) throw unlockError || new Error('Could not unlock identity')
      setPasscode('')
      onUnlocked(data as string)
    } catch (cause) {
      if (import.meta.env.DEV) console.error(cause)
      const locked = cause instanceof Object && 'message' in cause && /too many attempts/i.test(String(cause.message))
      setError(locked ? 'Too many tries. Wait 15 minutes, then try again.' : 'That PIN didn’t work. Try again.')
      setPasscode('')
    } finally {
      setBusy(false)
      requestAnimationFrame(() => input.current?.focus())
    }
  }
  function type(value: string) {
    const pin = value.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setPasscode(pin)
    if (pin.length === PIN_LENGTH) void submit(pin)
  }
  return <main className="sign-in theme-main">
    <section className="sign-in-panel">
      <h1>Welcome.<br/><em>Let’s bloom.</em></h1>
      {!configured ? <div className="notice">Add your Supabase URL and public key to <code>.env.local</code> to connect this room.</div> : <>
        <form onSubmit={e => { e.preventDefault(); if (passcode.length === PIN_LENGTH) void submit(passcode) }}>
          <label htmlFor="passcode" className="pin-label">Enter your PIN</label>
          <div className={`pin-cells ${error ? 'has-error' : ''} ${busy ? 'is-busy' : ''}`} onClick={() => { goFullscreen(); input.current?.focus() }}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span key={i} className={`pin-cell ${i < passcode.length ? 'filled' : ''} ${i === passcode.length && !busy ? 'active' : ''}`} aria-hidden="true">
                {i < passcode.length && <i />}
              </span>
            ))}
            <input ref={input} id="passcode" className="pin-input" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={PIN_LENGTH} required autoComplete="one-time-code" value={passcode} onChange={e => type(e.target.value)} readOnly={busy} autoFocus/>
          </div>
        </form>
        {error && <p role="alert" className="error">{error}</p>}
      </>}
    </section>
  </main>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [splash, setSplash] = useState(true)
  // The greeting page shows every time the app opens, and again after each unlock.
  const [greeted, setGreeted] = useState(false)
  const [owner, setOwner] = useState<Owner | null>(null)
  useEffect(() => {
    if (!profileId) return
    let live = true
    void supabase.from('profiles').select('display_name, avatar').eq('id', profileId).maybeSingle().then(({ data }) => {
      if (live) setOwner({ name: data?.display_name || '', avatar: data?.avatar || fallbackAvatar() })
    })
    return () => { live = false }
  }, [profileId])
  const greet = () => setGreeted(true)
  const unlocked = (id: string) => {
    setGreeted(false)
    setProfileId(id)
  }
  useEffect(() => {
    let mounted = true
    const load = async (next: Session | null) => {
      if (!mounted) return
      setSession(next)
      if (next) {
        const { data } = await supabase.from('profile_access').select('profile_id').eq('auth_user_id', next.user.id).maybeSingle()
        if (mounted) setProfileId(data?.profile_id || null)
      } else setProfileId(null)
      if (mounted) setReady(true)
    }
    void supabase.auth.getSession().then(({ data }) => load(data.session)).catch(() => load(null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { void load(next) })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!session || !profileId) return
    const checkAccess = async () => {
      const { data, error } = await supabase.from('profile_access').select('profile_id').eq('auth_user_id', session.user.id).maybeSingle()
      if (!error && data?.profile_id !== profileId) setProfileId(null)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void checkAccess() }
    const timer = window.setInterval(() => { void checkAccess() }, 30000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [session, profileId])
  return <OwnerContext.Provider value={owner || { name: '', avatar: fallbackAvatar() }}>
    {splash && <Splash onDone={() => setSplash(false)} />}
    {screen()}
  </OwnerContext.Provider>
  function screen() {
    if (import.meta.env.DEV && window.location.hash.startsWith('#/demo-hello')) return <HelloPage onContinue={() => {}} />
    if (import.meta.env.DEV && window.location.hash.startsWith('#/demo')) return <DemoRoom />
    if (!ready) return splash ? null : <div className="loading-screen"><BloomLoader /></div>
    if (!profileId) return splash ? null : <SignIn session={session} onUnlocked={unlocked} />
    if (!greeted) return splash || !owner ? null : <HelloPage onContinue={greet} />
    return <PageTransition><Routes><Route path="/" element={<RoomPage userId={profileId}/>} /><Route path="/history" element={<HistoryPage userId={profileId}/>} /><Route path="*" element={<Navigate to="/" replace/>}/></Routes></PageTransition>
  }
}
