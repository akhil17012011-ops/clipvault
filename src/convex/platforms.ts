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
    }
  | { ok: false; reason: string };

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
    response = await fetch(url, { headers, redirect: "follow" });
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
    return {
      ok: false,
      reason: `We couldn't find an Instagram account called @${handle}.`,
    };
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

  return {
    ok: true,
    handle: first.username.toLowerCase(),
    bio: typeof first.biography === "string" ? first.biography : "",
    followers: parseCount(first.followers_count),
    // The field was renamed across actor versions, so read both spellings
    // rather than reporting a zero when only one is present.
    posts: parseCount(first.media_count ?? first.posts_count),
  };
}

async function fetchInstagram(handle: string): Promise<ProfileResult> {
  // Instagram directly first: free, fast, and it works from most networks.
  const direct = await fetchInstagramDirect(handle);
  if (direct) return direct;

  // Refused, so read the identical public profile through Apify instead.
  const viaApify = await fetchInstagramViaApify(handle);
  if (viaApify) return viaApify;

  return {
    ok: false,
    reason:
      "Instagram isn't answering profile lookups from our servers right now. Try again in a few minutes.",
  };
}

/** Reads a public profile's bio. Never invents one. */
export function fetchProfile(
  platform: Platform,
  handle: string,
): Promise<ProfileResult> {
  switch (platform) {
    case "tiktok":
      return fetchTikTok(handle);
    case "youtube":
      return fetchYouTube(handle);
    case "x":
      return fetchX(handle);
    case "instagram":
      return fetchInstagram(handle);
  }
}
