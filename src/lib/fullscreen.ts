// Browsers only allow fullscreen after a tap, so call this from a click handler.
// iPhone Safari has no page fullscreen; there the Home Screen app is already full screen.
export function goFullscreen() {
  try {
    if (document.fullscreenElement) return;
    if (matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches) return;
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* Fullscreen is optional. */
  }
}
