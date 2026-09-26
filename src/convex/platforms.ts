/**
 * Real public-profile lookups for the platforms creators publish on.
 *
 * Bio verification is the security anchor of CLIPTIC: a creator proves they own
 * a handle by putting a one-time code in that handle's bio. To check the code
 * honestly we have to actually read the bio, so each platform here is fetched
 * and parsed the way that platform really serves it:
 *
 *  - YouTube  the channel description ships in the page's meta description
 *  - TikTok   the bio is in the `signature` field of the embedded page JSON
 *  - X        the bio ships in the page's meta description
 *  - Instagram renders nothing server-side, so its public web profile API is
 *             used, which returns the `biography` field
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

export type ProfileResult =
  | { ok: true; handle: string; bio: string }
  | { ok: false; reason: string };

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

async function fetchTikTok(handle: string): Promise<ProfileResult> {
  const html = await fetchText(`https://www.tiktok.com/@${handle}`);
  if (html === null) {
    return { ok: false, reason: "We couldn't reach TikTok. Try again shortly." };
  }
  const resolved = tiktokHandle(html);
  if (!resolved) {
    return { ok: false, reason: `There's no public TikTok account called @${handle}.` };
  }
  return { ok: true, handle: resolved.toLowerCase(), bio: tiktokBio(html) ?? "" };
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
  return { ok: true, handle: handle.toLowerCase(), bio };
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

async function fetchInstagram(handle: string): Promise<ProfileResult> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
  const headers: Record<string, string> = {
    "user-agent": BROWSER_UA,
    accept: "*/*",
    "x-ig-app-id": INSTAGRAM_APP_ID,
    referer: `https://www.instagram.com/${handle}/`,
  };

  /* Instagram throttles aggressively per IP, so back off and retry once
     before telling the creator anything is wrong. */
  let response: Response | null = null;
  let rateLimited = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1_200 * attempt));
    }
    try {
      response = await fetch(url, { headers, redirect: "follow" });
    } catch {
      response = null;
    }
    if (response && response.status === 429) {
      rateLimited = true;
      continue;
    }
    break;
  }

  if (!response) {
    return {
      ok: false,
      reason: "We couldn't reach Instagram. Try again in a moment.",
    };
  }
  if (response.status === 429) {
    return {
      ok: false,
      reason:
        "Instagram is rate-limiting us right now. Wait a minute and hit Verify again, or connect this handle from a TikTok or YouTube profile.",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      reason: `We couldn't find an Instagram account called @${handle}.`,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: `Instagram returned an error (${response.status}). Try again shortly.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      reason: "Instagram didn't return a profile we could read. Try again shortly.",
    };
  }

  const user = (payload as { data?: { user?: Record<string, unknown> } })?.data
    ?.user;
  if (!user || typeof user.username !== "string") {
    return {
      ok: false,
      reason: `There's no public Instagram account called @${handle}.`,
    };
  }

  return {
    ok: true,
    handle: user.username.toLowerCase(),
    bio: typeof user.biography === "string" ? user.biography : "",
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
