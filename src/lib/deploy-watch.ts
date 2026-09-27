/**
 * Keeps open tabs on the deployed build they were loaded with.
 *
 * A publish swaps the hashed asset filenames in `index.html` but cannot reach
 * into tabs that are already open — they keep running the JavaScript they
 * started with. That is how a user ends up staring at a bug that was fixed
 * minutes ago, or clicking through a UI that no longer matches the server.
 *
 * Rather than asking anyone to refresh, this watches for a new build and
 * reloads on its own.
 *
 * How the version is detected: the app's entry script is content-hashed, so a
 * code change necessarily produces a new filename. The currently-loaded
 * fingerprint of every script and stylesheet is compared against the one in a
 * freshly fetched `index.html`. No build step, no version file, no deploy
 * hook — it works with whatever static host serves the app, and a no-op in
 * development where the filenames do not change on a hot edit.
 */

const POLL_INTERVAL_MS = 60_000;

/** Cooldown after a reload, so a mismatch can never become a reload loop. */
const RELOAD_GUARD_MS = 5_000;

let lastReloadAt = 0;
let checking = false;

/**
 * Normalises an asset URL to just its path.
 *
 * Query strings are dropped because a dev server appends a changing `?t=`
 * cache-buster to every module it serves, and a CDN appends its own. Neither
 * means a new build — only the content-hashed filename does. Without this the
 * watcher would see a "new build" on every hot edit in development.
 */
function normalize(url: string): string {
  return url.split("#")[0].split("?")[0];
}

/**
 * A stable fingerprint of the build currently in the document.
 *
 * Includes every script and stylesheet, not just the entry, so a change to any
 * lazily-loaded chunk's hash — which happens when shared code moves between
 * them — is caught too. Sorted so document order cannot cause a false positive.
 */
function currentFingerprint(): string {
  const assets = [
    ...document.querySelectorAll<HTMLScriptElement>("script[src]"),
    ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ]
    .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
    .filter(Boolean)
    .map(normalize)
    .sort();

  return assets.join("|");
}

/** The same fingerprint, read out of a freshly fetched index.html. */
function fingerprintFrom(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const assets = [
    ...doc.querySelectorAll<HTMLScriptElement>("script[src]"),
    ...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ]
    .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
    .filter(Boolean)
    .map(normalize)
    .sort();

  return assets.length > 0 ? assets.join("|") : null;
}

/**
 * True when someone is part-way through typing something they would not want
 * to lose. Reloading mid-form is the one genuinely destructive thing this
 * watcher could do, so it waits.
 */
function isUserEditing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return true;
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

async function checkForNewBuild(): Promise<void> {
  /* One check at a time — a slow response must not queue up behind itself. */
  if (checking) return;
  checking = true;

  try {
    const response = await fetch("/", {
      cache: "no-store",
      headers: { accept: "text/html" },
    });
    if (!response.ok) return;

    const served = fingerprintFrom(await response.text());
    if (!served) return;

    /* A changed fingerprint is a new build. A fingerprint that is somehow
       * *missing* assets is a truncated or intercepted response, not a deploy,
       and must never trigger a reload. */
    if (served === currentFingerprint()) return;

    if (Date.now() - lastReloadAt < RELOAD_GUARD_MS) return;
    if (isUserEditing()) return;

    lastReloadAt = Date.now();

    /* `location.replace` rather than `reload()` so the reload does not add
       another entry to the back-button history — the user is not going back to
       the broken build, they are moving onto the new one. */
    window.location.replace(window.location.href);
  } catch {
    /* Offline, or the request was blocked. A watcher that throws on every
       failed poll would be noise, so this is deliberately silent: the next
       tick tries again. */
  } finally {
    checking = false;
  }
}

/**
 * Starts the watcher. Safe to call once; repeated calls are ignored.
 *
 * Exported for tests and for a manual "check now" trigger.
 */
export function startDeployWatch(): void {
  /* Development is a hard no-op.

     The dev server rewrites module URLs with a changing `?t=` cache-buster and
     injects proxy scripts that come and go, so a fingerprint taken here would
     differ from the last one on almost every hot edit. Reloading in response
     would fight Vite's own fast refresh and make the app feel broken while
     someone is actively editing it. Only a real deployment needs watching. */
  if (import.meta.env.DEV) return;

  if (startDeployWatch.started) return;
  startDeployWatch.started = true;

  /* Poll while the tab is visible. A hidden tab is not being looked at, and
     there is no reason to spend requests on it. */
  window.setInterval(() => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  }, POLL_INTERVAL_MS);

  /* The cases a 60s poll handles badly: someone leaves a tab open and comes
     back to it hours later, or was offline and just reconnected. Both want an
     immediate check rather than a wait. */
  window.addEventListener("focus", () => void checkForNewBuild());
  window.addEventListener("online", () => void checkForNewBuild());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  });
}

startDeployWatch.started = false;
