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
 *  - Instagram renders nothing server-side and blocks datacentre addresses
 *             outright, so it is read through the configured bot account's
 *             signed-in session, and failing that through a hosted reader
 *             running from an address Instagram does not block.
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

/**
 * A hard deadline for one outbound call.
 *
 * Without this the refresh loop could not keep its promise of a read every
 * second: the client ticks once a second and skips while a batch is in
 * flight, so one socket Instagram decides not to answer held the entire loop
 * until the runtime's multi-minute idle timeout gave up. Stall after the
 * headers instead of before them and the same signal cancels the body read. The timer is deliberately left to fire once rather than
 * meticulously cleared — aborting an already-finished request is a no-op and
 * the reference is released right after.
 */
function withDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export type ProfileResult =
  | {
      ok: true;
      handle: string;
      bio: string;
      /** Real follower count, when the platform exposes it in what we read. */
      followers?: number;
      /** Real post count, when the platform exposes it in what we read. */
      posts?: number;
    }
  | { ok: false; reason: string };

/**
 * Options for a profile read.
 */
export type ProfileOptions = {
  /**
   * Reads the profile through a saved signed-in session (the bot account).
   * Called only after the anonymous route is refused. Returning null means
   * "no session story to tell" and the chain keeps going. It lives in the
   * caller because only the caller can hold the database.
   */
  sessionReader?: (handle: string) => Promise<ProfileResult | null>;
  /**
   * The API token for a hosted reader, when one is configured.
   *
   * This is what carries Instagram once every direct route is refused. Read
   * from the environment inside the reader itself, so no key is ever handed
   * through a query result or a browser bundle.
   */
  scraperToken?: string | null;
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
       it short-circuited the whole chain, so the signed-in read never ran on
       exactly the days the IP was throttled, and a verified creator was told
       their own account doesn't exist. Inconclusive results come back as null
       so the next route gets its turn. */
    return null;
  }

  return {
    ok: true,
    handle: user.username.toLowerCase(),
    bio: typeof user.biography === "string" ? user.biography : "",
    ...instagramDirectCounts(user),
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
  if (response.status === 429) {
    /* Worth distinguishing carefully, because it is the one refusal that says
       nothing about the session. Instagram answers a *valid* sign-in from a
       rate-limited address with a 429 and an HTML page marked `logged-in` —
       the cookie was accepted, the address is simply throttled. Calling that a
       dead session would destroy a working credential, so it is reported as
       what it is and the session is left untouched. */
    return {
      ok: false,
      transient: true,
      reason:
        "Instagram is rate-limiting this server right now. The saved sign-in is fine — try again in a few minutes.",
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
  /* The bot account leads. It is the route this product actually depends on,
     and putting it first means a throttled anonymous read — which can sit on
     its ten-second deadline — never delays a signed-in answer behind it.
     Anonymous remains the fallback for when no session is configured or the
     session is being challenged, and whatever the session route said is kept
     as the most useful explanation when both end up failing. */
  let specific: string | null = null;
  if (options.sessionReader) {
    const viaSession = await options.sessionReader(handle);
    if (viaSession) {
      if (viaSession.ok) return viaSession;
      specific = viaSession.reason;
    }
  }

  const direct = await fetchInstagramDirect(handle);
  if (direct) return direct;

  /* Last, and only because it is the only one that survives a datacentre IP:
     the hosted reader. It is tried after the free routes so that on a network
     Instagram has not blocked us, nothing is ever paid for. */
  const viaReader = await fetchInstagramViaReader(
    options.scraperToken ?? "",
    handle,
  );
  if (viaReader) return viaReader;

  return {
    ok: false,
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

/* ---------------------------------------------------------------------------
 * Instagram, the sanctioned way.
 * ------------------------------------------------------------------------- */

/**
 * The follower count, from Instagram's own Graph API.
 *
 * The web routes above are the reason this file exists at all, and for TikTok,
 * YouTube and X they work. Instagram is the exception, and it is not a bug we
 * can retry our way out of: from a datacentre address the anonymous profile
 * endpoint answers `401 "Please wait a few minutes before you try again"` with
 * `require_login: true`, and the browser sign-in endpoint this deployment used
 * to get around it now returns a 404 page — Instagram removed it. Verified
 * against this deployment, both routes, while writing this.
 *
 * The Graph API is the route Instagram intends apps to use. A creator with an
 * Instagram *professional* account (Business or Creator) linked to a Facebook
 * Page can grant a long-lived token, and that token answers with the real
 * `followers_count` and `media_count` — no scraping, no shared bot sign-in, no
 * IP to get blocked, and it keeps working for as long as the token lives.
 *
 * `expectedHandle` is checked, not assumed. A token belongs to one account, so
 * reading it against a row that names a different handle means the token was
 * pasted onto the wrong account, and writing that count here would attribute
 * one creator's audience to another.
 */
export async function fetchInstagramGraph(
  accessToken: string,
  expectedHandle: string,
): Promise<ProfileResult> {
  const query = new URLSearchParams({
    fields: "id,username,followers_count,media_count,biography",
    access_token: accessToken,
  });

  let response: Response;
  try {
    response = await fetch(`https://graph.instagram.com/me?${query}`, {
      headers: { accept: "application/json" },
      signal: withDeadline(READ_DEADLINE_MS),
    });
  } catch {
    return {
      ok: false,
      reason: "Instagram's Graph API didn't answer. Try again shortly.",
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await response.json();
    payload =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    /* Meta sends the reason as `error.message`, and it is the difference
       between "paste a new token" and "your app is not approved for this",
       which a person cannot guess. */
    const error = payload?.error as
      | { message?: string; error_subcode?: number }
      | undefined;
    const detail =
      typeof error?.message === "string" ? error.message : "the token was refused";
    return {
      ok: false,
      reason: `Instagram's Graph API refused that token: ${detail}`,
    };
  }

  const username =
    typeof payload?.username === "string" ? payload.username.toLowerCase() : null;
  if (!username) {
    return {
      ok: false,
      reason:
        "That token isn't linked to an Instagram professional account yet. Connect the account to a Facebook Page, then try again.",
    };
  }

  /* A token that reads a different profile than the row names. Reported as a
     failure, never as a count: the number belongs to somebody else. */
  if (username !== expectedHandle.trim().toLowerCase()) {
    return {
      ok: false,
      reason: `That token belongs to @${username}, not @${expectedHandle}.`,
    };
  }

  const followers =
    typeof payload?.followers_count === "number" ? payload.followers_count : undefined;
  const posts =
    typeof payload?.media_count === "number" ? payload.media_count : undefined;

  return {
    ok: true,
    handle: username,
    bio: typeof payload?.biography === "string" ? payload.biography : "",
    ...(followers !== undefined ? { followers } : {}),
    ...(posts !== undefined ? { posts } : {}),
  };
}

/* ---------------------------------------------------------------------------
 * Instagram, via a hosted reader.
 * ------------------------------------------------------------------------- */

/** How long one hosted-reader run may take, start to finish. */
const SCRAPER_RUN_DEADLINE_MS = 120_000;

/** Apify's own "give up" deadline, sent so a stuck run cannot outlive ours. */
const SCRAPER_RUN_WAIT_SECONDS = 110;

const SCRAPER_ACTOR = "apify~instagram-profile-scraper";
const SCRAPER_API = "https://api.apify.com/v2";

/**
 * The real follower count, read by Apify rather than by this deployment.
 *
 * Why this exists: Instagram blocks datacentre addresses. Verified against this
 * server while writing it — the anonymous profile endpoint answers `429` /
 * `401 require_login`, the `/embed/` page is the same 640KB shell for every
 * handle, and the bot sign-in route now 404s. The mirrors that are still up
 * (dumpor, greatfon) answer `200` with a byte-identical page for three
 * different handles, so their "200" is a static shell, not a count.
 *
 * Apify runs the scrape from its own rotating residential addresses, which is
 * why it is the one thing that still answers. It costs a fraction of a cent
 * per profile, which on a free plan is a very large number of syncs per month,
 * and it needs no Meta app, no professional-account conversion, and no creator
 * to do anything at all.
 *
 * What it is *not*: a bypass of anything the creator agreed to. It reads the
 * same public profile page any visitor sees, and it is used for the same thing
 * the official token is used for — reading a public number so the operator can
 * see it. The Graph API stays the better route where a creator has offered a
 * token, because a token is exact and costs nothing at all.
 *
 * Returns null when no token is configured, so the chain can keep its other
 * routes and this stays an optional reader rather than a hard dependency.
 */
export async function fetchInstagramViaReader(
  token: string,
  expectedHandle: string,
): Promise<ProfileResult | null> {
  const wanted = expectedHandle.trim().toLowerCase();
  if (!token) return null;

  let runId: string | null = null;
  let datasetId: string | null = null;

  try {
    const start = await fetch(
      `${SCRAPER_API}/acts/${SCRAPER_ACTOR}/runs?token=${encodeURIComponent(
        token,
      )}&waitForFinish=${SCRAPER_RUN_WAIT_SECONDS}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usernames: [wanted] }),
        signal: withDeadline(SCRAPER_RUN_DEADLINE_MS),
      },
    );

    /* A refusal here is about the account, not the profile: a free plan that
       has run out of credit, a suspended token, an actor that has been
       renamed. Those are worth saying out loud, because "try again later"
       would send an operator to wait for a platform that is not the problem. */
    if (!start.ok) {
      return {
        ok: false,
        reason: readerRefusal(start.status),
      };
    }

    const started: unknown = await start.json();
    const run = (started as { data?: { id?: string; defaultDatasetId?: string } })
      ?.data;
    runId = run?.id ?? null;
    datasetId = run?.defaultDatasetId ?? null;

    if (!runId || !datasetId) {
      return {
        ok: false,
        reason: "The profile reader didn't return a readable result.",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "The profile reader didn't respond. Try pressing Sync again.",
    };
  }

  try {
    const items: unknown = await (
      await fetch(
        `${SCRAPER_API}/datasets/${datasetId}/items?token=${encodeURIComponent(
          token,
        )}&clean=true&limit=1`,
        { signal: withDeadline(20_000) },
      )
    ).json();

    const item = (Array.isArray(items) ? items[0] : null) as Record<
      string,
      unknown
    > | null;

    /* An empty dataset means the profile is gone, renamed, or private. Said as
       a fact about the profile, never as "we could not read it" — the reader
       answered, and its answer was "there is nothing there". */
    if (!item) {
      return {
        ok: false,
        reason: `@${expectedHandle} doesn't exist, is private, or was renamed.`,
      };
    }

    const username =
      typeof item.username === "string" ? item.username.toLowerCase() : null;
    if (!username) {
      return {
        ok: false,
        reason: `The profile reader found no profile for @${expectedHandle}.`,
      };
    }

    const followers =
      typeof item.followersCount === "number" ? item.followersCount : undefined;
    const posts =
      typeof item.postsCount === "number" ? item.postsCount : undefined;

    return {
      ok: true,
      handle: username,
      bio: typeof item.biography === "string" ? item.biography : "",
      ...(followers !== undefined ? { followers } : {}),
      ...(posts !== undefined ? { posts } : {}),
    };
  } catch {
    return {
      ok: false,
      reason:
        "The profile reader finished but we could not load its result. Try again.",
    };
  } finally {
    /* Every run is a stored dataset on somebody's account. It is read once,
       here, and has no reason to outlive that read, so it is deleted on the way
       out — including on the failure paths, which is the whole reason this is
       in a `finally` rather than at the end of the happy path. */
    if (runId) {
      void fetch(
        `${SCRAPER_API}/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
        { method: "DELETE" },
      ).catch(() => {
        /* A run left behind is Apify's problem to expire, not a reason to fail
           a read that already succeeded. */
      });
    }
  }
}

/** Turns a refusal status into something a person can act on. */
function readerRefusal(status: number): string {
  if (status === 401 || status === 403) {
    return "The profile reader's API key was refused. Add a valid APIFY_TOKEN to the Keys tab.";
  }
  if (status === 429) {
    return "The profile reader is out of monthly credit or rate-limited. Try again once it resets.";
  }
  return `The profile reader refused the request (HTTP ${status}).`;
}
