/**
 * Real public-profile lookups for the platforms creators publish on.
 *
 * Bio verification is the security anchor of Clip Vault: a creator proves they own
 * a handle by putting a one-time code in that handle's bio. To check the code
 * honestly we have to actually read the bio, so each platform here is fetched
 * and parsed the way that platform really serves it:
 *
 *  - YouTube  the channel description ships in the page's meta description
 *  - TikTok   the bio is in the `signature` field of the embedded page JSON
 *  - X        the bio ships in the page's meta description
 *  - Instagram renders nothing server-side, so its public web profile API is
 *             used, which returns the `biography` field. Instagram throttles
 *             datacentre IPs wholesale, so this one falls back to Apify, which
 *             reads the same public profile from a residential IP.
 *
 * Nothing here guesses. If a profile cannot be read the caller is told so
 * rather than being handed a fabricated bio.
 */

export type Platform = "tiktok" | "instagram" | "youtube" | "x";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Instagram's web app identifies itself with this public constant header. */
const INSTAGRAM_APP_ID = "936619743392459";

/* ------------------------------------------------------------------ */
/* Deadlines                                                           */

/** Profile/API reads and page loads. */
const READ_DEADLINE_MS = 10_000;
/** The two-call sign-in handshake. */
const LOGIN_DEADLINE_MS = 15_000;
/** The paid run carries its own 120s server timeout; this sits above it. */
const APIFY_DEADLINE_MS = 135_000;

/**
 * A hard deadline for one outbound call.
 *
 * Without this the refresh loop could not keep its promise of a read every
 * ~15 seconds: the client ticks every couple of seconds and skips while a
 * batch is in flight, so one socket Instagram decides not to answer held the
 * entire loop until the runtime's multi-minute idle timeout gave up. Stall
 * after the headers instead of before them and the same signal cancels the
 * body read. The timer is deliberately left to fire once rather than
 * meticulously cleared — aborting an already-finished request is a no-op and
 * the reference is released right after.
 */
function withDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** Apify's official Instagram Profile Scraper. */
const APIFY_ACTOR = "apify~instagram-profile-scraper";

export type ProfileResult =
  | {
      ok: true;
      handle: string;
      bio: string;
      /** Real follower count, when the platform exposes it in what we read. */
      followers?: number;
      /** Real post count, when the platform exposes it in what we read. */
      posts?: number;
      /**
       * True when the paid residential fallback was exercised to produce this
       * result. Callers use it to meter the paid route — it costs money per
       * run, so "it was allowed to run" has to be traceable to whoever pays
       * the bill.
       */
      usedFallback?: boolean;
    }
  | {
      ok: false;
      reason: string;
      /** See the `ok: true` branch. */
      usedFallback?: boolean;
    };

/**
 * Options for a profile read.
 *
 * `allowFallback` gates Instagram's paid residential route (Apify). It exists
 * because that route bills per profile: a poller allowed to reach it at full
 * speed would turn a creator's open dashboard into a running meter.
 */
export type ProfileOptions = {
  allowFallback?: boolean;
  /**
   * Reads the profile through a saved signed-in session (the bot account).
   * Called only after the anonymous route is refused. Returning null means
   * "no session story to tell" and the chain keeps going. It lives in the
   * caller because only the caller can hold the database.
   */
  sessionReader?: (handle: string) => Promise<ProfileResult | null>;
};

/**
 * Reads a follower or post count that a platform may report as a number, as a
 * grouped string like "12.3K", or with separators like "1,234". Returns
 * undefined rather than guessing when the text is not a count.
 */
function parseCount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }
  if (typeof value !== "string") return undefined;
  const text = value.replace(/,/g, "").trim();
  /* Spelled-out magnitudes are a trap, not a format. "30.5 million" would
     otherwise parse as 30 — a number off by six orders of magnitude, shown to
     a creator as if it were real. A count written in words is not a count this
     can read, so it is refused rather than guessed at. */
  if (/\b(thousand|million|billion|trillion)\b/i.test(text)) return undefined;
  const match = text.match(/^([\d.]+)\s*([KMB])?/i);
  if (!match) return undefined;
  const base = Number.parseFloat(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const suffix = (match[2] ?? "").toLowerCase();
  const scale = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return Math.round(base * scale);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

/** First `<meta name="description">` / `og:description` content on the page. */
function metaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:description["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).slice(0, 1000);
  }
  return null;
}

async function fetchText(url: string, headers: HeadersInit = {}): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, accept: "text/html,*/*", ...headers },
      redirect: "follow",
      signal: withDeadline(READ_DEADLINE_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** TikTok embeds the profile as JSON; the bio lives in `signature`. */
function tiktokBio(html: string): string | null {
  const match = html.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return decodeEntities(match[1]);
  }
}

/** TikTok also echoes the handle it resolved, so we can confirm it exists. */
function tiktokHandle(html: string): string | null {
  const match = html.match(/"uniqueId"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

/** TikTok publishes follower and video counts in the same embedded JSON. */
function tiktokCounts(html: string): { followers?: number; posts?: number } {
  return {
    followers: parseCount(html.match(/"followerCount"\s*:\s*"?(\d+)"?/)?.[1]),
    posts: parseCount(html.match(/"videoCount"\s*:\s*"?(\d+)"?/)?.[1]),
  };
}

/**
 * Reads a channel count out of the data YouTube embeds in the page.
 *
 * YouTube has shipped this number in several shapes, and pinning a regex to
 * one of them silently returns "no data" when they change:
 *
 *   "subscriberCountText":{...,"simpleText":"30.5M subscribers"}
 *   "videoCountText":{"runs":[{"text":"72"},{"text":" videos"}]}
 *
 * So the key is located first and the number is taken from the short window
 * after it, accepting either the rendered `simpleText` or a `runs` array.
 *
 * The accessibility label is deliberately NOT read. It spells the magnitude
 * out in words — "30.5 million subscribers" — which a numeric parser reads as
 * 30. That is the single worst way to be wrong about a follower count, so the
 * field is ignored entirely rather than special-cased.
 */
function youtubeCount(html: string, key: string): number | undefined {
  const at = html.indexOf(`"${key}"`);
  if (at < 0) return undefined;

  /* The window is this key's own object and nothing else. The subscriber and
     video counts sit directly next to each other in the page, so a plain
     fixed-width window around `videoCountText` also swallows the subscriber
     count — and reading that instead reports a channel's 72 videos as its
     30.5M subscribers.

     The boundary is the next `*CountText` key. That is exactly the level the
     two counts live on: cutting on any generic "next key" would instead stop
     at `,"simpleText":` nested inside the accessibility object and lose the
     number this is looking for. */
  const body = html.slice(at + key.length + 3);
  const next = body.search(/"[A-Za-z_][A-Za-z0-9_]*CountText":/);
  const window = body.slice(0, next > 0 && next < 400 ? next : 400);

  // The rendered form, when YouTube publishes one.
  const simple = window.match(/"simpleText"\s*:\s*"([^"]+)"/);
  if (simple?.[1]) {
    const n = parseCount(simple[1]);
    if (n !== undefined) return n;
  }

  // The split form: the number and its unit are separate runs.
  for (const match of window.matchAll(/"text"\s*:\s*"([^"]*)"/g)) {
    if (!/\d/.test(match[1])) continue;
    const n = parseCount(match[1]);
    if (n !== undefined) return n;
  }

  // A bare number immediately before the unit, as a last resort.
  const bare = window.match(
    /"(\d[\d.,]*\s*[KMB]?)\s*(?:subscribers?|videos?)/i,
  );
  if (bare?.[1]) return parseCount(bare[1]);

  return undefined;
}

/** YouTube's channel header carries the subscriber and video totals. */
function youtubeCounts(html: string): { followers?: number; posts?: number } {
  return {
    followers: youtubeCount(html, "subscriberCountText"),
    /* The key is `videoCountText`, singular. An earlier version of this looked
       for `videosCountText`, which YouTube does not emit at all — so the post
       count silently read as zero for every channel. */
    posts: youtubeCount(html, "videoCountText"),
  };
}

/** The direct Instagram API reports both counts numerically. */
function instagramDirectCounts(user: Record<string, unknown>): {
  followers?: number;
  posts?: number;
} {
  const timeline = user.edge_owner_to_timeline_media as
    | { count?: unknown }
    | undefined;
  /* `follower_count` is only sometimes present. On the degraded responses
     Instagram serves to datacentre IPs (`country_block: true`), the shorthand
     count fields are stripped but `edge_followed_by.count` still carries the
     real number. Reading both, in that order, means the count survives the
     degraded shape instead of reading as "not published". */
  const followedBy = user.edge_followed_by as
    | { count?: unknown }
    | undefined;
  return {
    followers: parseCount(user.follower_count) ?? parseCount(followedBy?.count),
    posts: parseCount(timeline?.count),
  };
}

async function fetchTikTok(handle: string): Promise<ProfileResult> {
  const html = await fetchText(`https://www.tiktok.com/@${handle}`);
  if (html === null) {
    return { ok: false, reason: "We couldn't reach TikTok. Try again shortly." };
  }
  const resolved = tiktokHandle(html);
  if (!resolved) {
    return { ok: false, reason: `There's no public TikTok account called @${handle}.` };
  }
  return {
    ok: true,
    handle: resolved.toLowerCase(),
    bio: tiktokBio(html) ?? "",
    ...tiktokCounts(html),
  };
}

async function fetchYouTube(handle: string): Promise<ProfileResult> {
  const html = await fetchText(`https://www.youtube.com/@${handle}`);
  if (html === null) {
    return {
      ok: false,
      reason: "We couldn't reach YouTube. Try again shortly.",
    };
  }
  const bio = metaDescription(html);
  if (bio === null) {
    return {
      ok: false,
      reason: `There's no public YouTube channel called @${handle}.`,
    };
  }
  return { ok: true, handle: handle.toLowerCase(), bio, ...youtubeCounts(html) };
}

async function fetchX(handle: string): Promise<ProfileResult> {
  const html = await fetchText(`https://x.com/${handle}`);
  if (html === null) {
    return { ok: false, reason: "We couldn't reach X. Try again shortly." };
  }
  const bio = metaDescription(html);
  if (bio === null) {
    return {
      ok: false,
      reason: `There's no public X account called @${handle}.`,
    };
  }
  return { ok: true, handle: handle.toLowerCase(), bio };
}

/**
 * Instagram's own public profile API.
 *
 * Returns a definitive result when the account can be told apart (it resolved,
 * or Instagram answered 404 for a username that does not exist), and `null`
 * when the request itself was refused. That distinction matters: a 429 here
 * means Instagram throttled our IP, not that the handle is wrong, so it must
 * be retried over a different route rather than reported to the creator.
 */
async function fetchInstagramDirect(
  handle: string,
): Promise<ProfileResult | null> {
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "*/*",
    "x-ig-app-id": INSTAGRAM_APP_ID,
    referer: `https://www.instagram.com/${handle}/`,
  };
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      redirect: "follow",
      signal: withDeadline(READ_DEADLINE_MS),
    });
  } catch {
    return null;
  }

  if (response.status === 404) {
    return {
      ok: false,
      reason: `We couldn't find an Instagram account called @${handle}.`,
    };
  }
  // A 429, or the 400/5xx Instagram's own serializer returns when it trips
  // over a malformed profile, says nothing either way about the handle.
  if (!response.ok) return null;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  const user = (payload as { data?: { user?: Record<string, unknown> } })?.data
    ?.user;
  if (!user || typeof user.username !== "string") {
    /* A 200 with no user is how Instagram answers when it has decided this
       server isn't worth serving — not a verdict about the handle. Telling
       the caller "couldn't find the account" here was worse than wrong:
       it short-circuited the whole chain, so the signed-in read and the paid
       fallback both never ran on exactly the days the IP was throttled, and
       a verified creator was told their own account doesn't exist. Inconclusive
       results come back as null so the next route gets its turn. */
    return null;
  }

  return {
    ok: true,
    handle: user.username.toLowerCase(),
    bio: typeof user.biography === "string" ? user.biography : "",
    ...instagramDirectCounts(user),
  };
}

/**
 * The same public profile, read through Apify.
 *
 * Instagram serves a blanket 429 to datacentre IP ranges — it does that even
 * for usernames that do not exist — so our own servers are routinely refused.
 * Apify fetches from residential IPs, which gets a normal answer.
 *
 * Apify charges per profile, so this runs only after the free direct lookup
 * has already been refused. `null` means "could not ask Apify at all" (not
 * configured, or the run failed), which is a different thing from Apify
 * running fine and reporting that the account does not exist.
 */
async function fetchInstagramViaApify(
  handle: string,
): Promise<ProfileResult | null> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    // Operator-facing hint. Without this variable Instagram verification only
    // works from networks Instagram happens not to be throttling.
    console.log(
      "APIFY_TOKEN is unset, so Instagram lookups are limited to the direct route",
    );
    return null;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?format=json&timeout=120`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Sent as a header rather than a query string so the token never
          // ends up in a URL that could be logged.
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usernames: [handle] }),
        signal: withDeadline(APIFY_DEADLINE_MS),
      },
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    console.log("Apify Instagram lookup failed with status", response.status);
    return null;
  }

  let items: unknown;
  try {
    items = await response.json();
  } catch {
    return null;
  }

  const first = (Array.isArray(items) ? items[0] : null) as Record<
    string,
    unknown
  > | null;

  // Apify ran successfully and matched nothing, so the handle really is not a
  // public account rather than our request having been refused.
  if (!first || typeof first.username !== "string") {
    return {
      ok: false,
      reason: `We couldn't find an Instagram account called @${handle}.`,
    };
  }

  /* The actor's field spellings have changed across versions: snake_case and
     camelCase both appear in the wild, and the bio has been `biography` and
     `bio`. Reading every plausible spelling costs nothing, while missing one
     is exactly how a working token still produces a tile that says no count
     was published. parseCount only accepts values that really look like
     counts — an array or an object is ignored, never guessed at. */
  const followers =
    parseCount(first.followers_count) ??
    parseCount(first.followersCount) ??
    parseCount(first.followerCount) ??
    parseCount(first.followers);
  const posts =
    parseCount(first.media_count) ??
    parseCount(first.posts_count) ??
    parseCount(first.mediaCount) ??
    parseCount(first.postCount) ??
    parseCount(first.posts);
  const bioText = first.biography ?? first.bio;

  if (followers === undefined) {
    // Operator-facing: when the actor changes its output shape again, the
    // names it now uses show up in the function logs instead of vanishing.
    console.log(
      "Apify profile item carried no follower count. Keys:",
      Object.keys(first).slice(0, 50).join(", "),
    );
  }

  return {
    ok: true,
    handle: first.username.toLowerCase(),
    bio: typeof bioText === "string" ? bioText : "",
    followers,
    posts,
  };
}

/* ------------------------------------------------------------------ */
/* Authenticated reads — the configured bot account                     */

/** Cookies from a successful sign-in. Persisted by the caller only. */
export type IgSession = {
  sessionid: string;
  csrfToken: string;
  dsUserId?: string;
};

type IgLoginResult =
  | { ok: true; session: IgSession }
  | {
      ok: false;
      reason: string;
      /** Instagram wants a human to confirm this sign-in from the
          account's own device before it will let it through. */
      challenge?: boolean;
    };

/** Reads every cookie the server set on a response. */
function parseSetCookies(response: Response): Record<string, string> {
  const jar: Record<string, string> = {};
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const lines =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (() => {
          const single = response.headers.get("set-cookie");
          return single ? [single] : [];
        })();
  for (const line of lines) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

/**
 * Signs the bot account in through Instagram's web login.
 *
 * This is the reverse-engineered browser flow — seed cookies, then a form
 * POST carrying the password in Instagram's `#PWD_INSTAGRAM_BROWSER` format.
 * It is deliberately the least certain part of this file: Instagram changes
 * it without notice, rate-limits sign-ins from datacenter IPs hard, and may
 * demand that a human confirm the new sign-in from the account's own phone.
 * So every failure comes back as a sentence a person can act on, and no
 * failure ever contains the password itself.
 */
export async function instagramLogin(
  username: string,
  password: string,
): Promise<IgLoginResult> {
  let landing: Response;
  try {
    landing = await fetch("https://www.instagram.com/", {
      headers: { "user-agent": BROWSER_UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: withDeadline(LOGIN_DEADLINE_MS),
    });
  } catch {
    return { ok: false, reason: "Instagram didn't answer the sign-in attempt. Try again shortly." };
  }

  const seed = parseSetCookies(landing);
  const csrf = seed.csrftoken ?? "";
  if (!landing.ok || !csrf) {
    return {
      ok: false,
      reason: "Instagram refused to start a sign-in from this server. Try again shortly.",
    };
  }

  const form = new URLSearchParams({
    username,
    /* Instagram's own browser format: the password sits behind a versioned
       prefix and a unix timestamp. Not RSA — that left the browser flow
       years ago; the prefix IS the marker of the format. */
    enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Math.floor(Date.now() / 1000)}:${password}`,
    queryParams: "{}",
    optIntoOneTap: "false",
    trustedDeviceRecords: "{}",
  });

  let login: Response;
  try {
    login = await fetch("https://www.instagram.com/api/v1/accounts/login/ajax/", {
      method: "POST",
      redirect: "follow",
      headers: {
        "user-agent": BROWSER_UA,
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
        "x-csrftoken": csrf,
        "x-ig-app-id": INSTAGRAM_APP_ID,
        "x-requested-with": "XMLHttpRequest",
        origin: "https://www.instagram.com",
        referer: "https://www.instagram.com/",
        cookie: Object.entries(seed)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
      },
      body: form.toString(),
      signal: withDeadline(LOGIN_DEADLINE_MS),
    });
  } catch {
    return { ok: false, reason: "Instagram didn't answer the sign-in attempt. Try again shortly." };
  }

  const jar = parseSetCookies(login);
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await login.json();
    payload =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
  } catch {
    payload = null;
  }

  const message = typeof payload?.message === "string" ? payload.message : "";

  /* The human-confirmation case, recognised in every shape it has been
     served in: as a message, as a challenge object, or as a redirect to a
     challenge/checkpoint page instead of any JSON at all. */
  if (
    message === "challenge_required" ||
    message === "checkpoint_required" ||
    (payload != null && payload.challenge != null) ||
    login.url.includes("/challenge") ||
    login.url.includes("/checkpoint")
  ) {
    return {
      ok: false,
      challenge: true,
      reason:
        "Instagram wants this account to confirm the new sign-in. Open Instagram on that account's own phone, approve the request, then let the next refresh try again.",
    };
  }

  if (
    jar.sessionid &&
    jar.sessionid !== "unset" &&
    (payload?.authenticated === true || jar.ds_user_id)
  ) {
    return {
      ok: true,
      session: {
        sessionid: jar.sessionid,
        csrfToken: jar.csrftoken ?? csrf,
        dsUserId: jar.ds_user_id,
      },
    };
  }

  if (login.status === 429) {
    return {
      ok: false,
      reason: "Instagram is rate-limiting sign-ins from this server. Try again in a while.",
    };
  }
  if (message === "bad_password" || message.includes("password")) {
    return {
      ok: false,
      reason:
        "Instagram rejected the configured bot account's sign-in details. Check IG_BOT_USERNAME and IG_BOT_PASSWORD.",
    };
  }
  return {
    ok: false,
    reason:
      "Instagram didn't complete the sign-in. Check that the bot account can log in normally on a phone.",
  };
}

/** What a signed-in profile read concluded. */
type IgRead =
  | { ok: true; handle: string; bio: string; followers?: number; posts?: number }
  | {
      ok: false;
      reason: string;
      /** The session is no longer usable — drop it and sign in again. */
      sessionDead?: boolean;
      /** A blip, not a verdict: say nothing and try nothing else yet. */
      transient?: boolean;
    };

/** Reads a profile as the signed-in bot account. */
export async function fetchInstagramLoggedIn(
  handle: string,
  session: IgSession,
): Promise<IgRead> {
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "*/*",
    "x-ig-app-id": INSTAGRAM_APP_ID,
    "x-csrftoken": session.csrfToken,
    cookie: [
      `sessionid=${session.sessionid}`,
      `csrftoken=${session.csrfToken}`,
      session.dsUserId ? `ds_user_id=${session.dsUserId}` : null,
    ]
      .filter(Boolean)
      .join("; "),
    referer: `https://www.instagram.com/${handle}/`,
  };

  let response: Response;
  try {
    response = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers, redirect: "follow", signal: withDeadline(READ_DEADLINE_MS) },
    );
  } catch {
    return { ok: false, reason: "Instagram didn't answer the profile read.", transient: true };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      sessionDead: true,
      reason: "The saved Instagram sign-in was rejected.",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      reason: `We couldn't find an Instagram account called @${handle}.`,
    };
  }
  if (!response.ok) {
    return { ok: false, reason: "Instagram didn't answer the profile read.", transient: true };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "Instagram didn't answer the profile read.", transient: true };
  }

  const user = (payload as { data?: { user?: Record<string, unknown> } })?.data
    ?.user;
  if (!user || typeof user.username !== "string") {
    /* The account exists — it passed bio verification — so an empty answer
       indicts the session, not the handle. */
    return {
      ok: false,
      sessionDead: true,
      reason: "The saved Instagram sign-in can't read profiles any more.",
    };
  }

  const counts = instagramDirectCounts(user);
  return {
    ok: true,
    handle: user.username.toLowerCase(),
    bio: typeof user.biography === "string" ? user.biography : "",
    ...(counts.followers !== undefined ? { followers: counts.followers } : {}),
    ...(counts.posts !== undefined ? { posts: counts.posts } : {}),
  };
}

async function fetchInstagram(
  handle: string,
  options: ProfileOptions,
): Promise<ProfileResult> {
  // Instagram directly first: free, fast, and it works from most networks.
  const direct = await fetchInstagramDirect(handle);
  if (direct) return direct;

  /* The anonymous route was refused or inconclusive. A signed-in read is
     still free, so it goes before the metered one — and whatever it says is
     kept as the most useful explanation we have, preferred over the generic
     wording below when everything ends up failing. */
  let specific: string | null = null;
  if (options.sessionReader) {
    const viaSession = await options.sessionReader(handle);
    if (viaSession) {
      if (viaSession.ok) return viaSession;
      specific = viaSession.reason;
    }
  }

  if (options.allowFallback === false) {
    return {
      ok: false,
      reason:
        specific ??
        "Instagram isn't answering profile lookups from our servers right now. Try again in a few minutes.",
    };
  }

  // Still refused: the metered residential route.
  const viaApify = await fetchInstagramViaApify(handle);
  if (viaApify) return { ...viaApify, usedFallback: true };

  return {
    ok: false,
    usedFallback: true,
    reason:
      specific ??
      "Instagram isn't answering profile lookups from our servers right now. Try again in a few minutes.",
  };
}

/** Reads a public profile's bio. Never invents one. */
export function fetchProfile(
  platform: Platform,
  handle: string,
  options: ProfileOptions = {},
): Promise<ProfileResult> {
  switch (platform) {
    case "tiktok":
      return fetchTikTok(handle);
    case "youtube":
      return fetchYouTube(handle);
    case "x":
      return fetchX(handle);
    case "instagram":
      return fetchInstagram(handle, options);
  }
}
