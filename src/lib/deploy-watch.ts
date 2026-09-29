/**
 * Notices when a new build has been deployed, and says so — quietly.
 *
 * A publish swaps the hashed asset filenames in `index.html` but cannot reach
 * into tabs that are already open, so those keep running the JavaScript they
 * started with.
 *
 * This used to solve that by reloading the tab on its own. It does not any
 * more, and that is deliberate: a page that reappears by itself is a page that
 * interrupts. People lose what they were typing, people are thrown out of the
 * view they were reading, and — because the check also ran on window focus —
 * it felt like the site was refreshing at random moments. So the only thing
 * this file does now is *offer* the refresh, and the person decides.
 *
 * How a new build is detected: the entry script is content-hashed, so any code
 * change produces a new filename. An asset this tab is running that the server
 * is no longer serving is a new build. The comparison deliberately goes in one
 * direction only — see `hasNewBuild` — because the page gains runtime scripts
 * and styles of its own after load, and treating those as evidence of a deploy
 * is what made the old check fire on a perfectly current build.
 */

const POLL_INTERVAL_MS = 60_000;

/** What the app listens for to show the "a new version is ready" notice. */
export const NEW_BUILD_EVENT = "clipvault:new-build";

/** Remembers the build we already offered, so it is never announced twice. */
const ANNOUNCED_KEY = "clipvault:announced-build";

/** A change has to survive this many consecutive checks to count as a deploy. */
const CONFIRMATIONS_NEEDED = 2;

let checking = false;
let confirmations = 0;

/**
 * Normalises an asset URL to just its path.
 *
 * Query strings are dropped because a dev server appends a changing `?t=`
 * cache-buster to every module it serves, and a CDN appends its own. Neither
 * means a new build — only the content-hashed filename does.
 */
function normalize(url: string): string {
  return url.split("#")[0].split("?")[0];
}

function assetPaths(root: ParentNode): string[] {
  return [
    ...root.querySelectorAll<HTMLScriptElement>("script[src]"),
    ...root.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ]
    .map((el) => el.getAttribute("src") ?? el.getAttribute("href") ?? "")
    .filter(Boolean)
    .map(normalize);
}

/** The assets this tab is actually running. */
function currentAssets(): Set<string> {
  return new Set(assetPaths(document));
}

/** The assets the server is currently serving, from a fetched index.html. */
function servedAssets(html: string): Set<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return new Set(assetPaths(doc));
}

/**
 * The hash-free name of a built asset: `/assets/index-DiwrgTda.js` becomes
 * `/assets/index-.js`.
 *
 * Two builds of the same app put different hashes in the same slot, which is
 * what makes "did the build change?" answerable without a version file.
 */
function slotOf(path: string): string {
  return path.replace(/-[A-Za-z0-9_-]{8,}(\.[a-z0-9]+)$/i, "-$1");
}

/**
 * True when this tab is running a build the server has moved past.
 *
 * An asset counts as stale only when the server still serves *its slot* under
 * a different hash — that is a rebuilt file, and only that. Assets with no
 * matching slot are things the page injected into itself after load (the dev
 * toolbar, runtime integrations, analytics): they were never part of the
 * build, so their absence from the HTML is not a deploy and must never be
 * treated as one. That distinction is the whole reason this check exists in
 * this shape — comparing the two sets for equality reports a new build on
 * every poll, which is what made the tab reload itself at random.
 */
function hasNewBuild(served: Set<string>): boolean {
  const servedSlots = new Set([...served].map(slotOf));
  for (const asset of currentAssets()) {
    if (served.has(asset)) continue;
    if (servedSlots.has(slotOf(asset))) return true;
  }
  return false;
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

    const served = servedAssets(await response.text());
    /* An index.html with no assets is a truncated or intercepted response,
       not a deploy, and must never be treated as one. */
    if (served.size === 0) return;

    if (!hasNewBuild(served)) {
      confirmations = 0;
      return;
    }

    /* A single poll can catch a response mid-deploy, or a proxy answering for
       a moment. A real deploy shows up on the next check as well. */
    confirmations += 1;
    if (confirmations < CONFIRMATIONS_NEEDED) return;

    const build = [...served].sort().join("|");
    if (sessionStorage.getItem(ANNOUNCED_KEY) === build) return;
    sessionStorage.setItem(ANNOUNCED_KEY, build);

    /* Announced, not performed. Nothing about this page changes until the
       person chooses to refresh. */
    window.dispatchEvent(new Event(NEW_BUILD_EVENT));
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
     injects proxy scripts that come and go, so any comparison here would fire
     on a hot edit. Only a real deployment is worth watching. */
  if (import.meta.env.DEV) return;

  if (startDeployWatch.started) return;
  startDeployWatch.started = true;

  /* A quiet poll while the tab is in front of somebody.

     There are no focus, online or visibilitychange triggers here on purpose.
     Those fire constantly — every tab switch, every network blip, every
     return to the window — and they are what turned a background freshness
     check into something that interrupted the user at random. A minute of
     staleness costs nothing; a surprise reload costs a form. */
  window.setInterval(() => {
    if (document.visibilityState === "visible") void checkForNewBuild();
  }, POLL_INTERVAL_MS);
}

startDeployWatch.started = false;
