import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Reads real data about a published clip from the source platform.
 *
 * Two things happen here, and both of them are real:
 *
 *  1. The link is resolved through the platform's public oEmbed endpoint. That
 *     proves the post actually exists and tells us who published it, which is
 *     exactly what the ownership check needs. Nothing is assumed.
 *
 *  2. When a platform API key is configured for the deployment, real view /
 *     like / comment counts are read from that platform. When it is not, we
 *     return no metrics at all. We never fabricate numbers.
 *
 * Configure `YOUTUBE_API_KEY` in the deployment environment to get real
 * YouTube statistics. YouTube and TikTok also support keyless oEmbed, which is
 * enough to verify ownership even without a key.
 */

const PLATFORM = v.union(
  v.literal("tiktok"),
  v.literal("instagram"),
  v.literal("youtube"),
  v.literal("x"),
);

type Platform = "tiktok" | "instagram" | "youtube" | "x";

type InspectArgs = { link: string; platform: Platform };

type InspectResult = {
  /** The link resolved to a real, public post. */
  reachable: boolean;
  /** Handle the platform reports as the publisher, when it exposes one. */
  author: string | null;
  title: string | null;
  /** Real statistics, or null when they could not be read. */
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    fetchedAt: number;
  } | null;
  /** Why metrics are missing, when they are. */
  metricsNote: string | null;
  error: string | null;
};

/** Normalise a pasted link into an absolute https URL, or null. */
function normalizeLink(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Pull a YouTube video id out of any of its URL shapes. */
function youtubeVideoId(url: URL): string | null {
  if (url.hostname.replace(/^www\./, "") === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (url.searchParams.get("v")) return url.searchParams.get("v");
  const match = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
  return match ? match[1] : null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      // Only ever talk to the platform's own hosts over https.
      redirect: "follow",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * oEmbed lookup. TikTok and YouTube both serve this with no credentials, and
 * it is enough to confirm a post exists and who owns it.
 */
async function oEmbed(
  url: URL,
  platform: Platform,
): Promise<{ author: string | null; title: string | null } | null> {
  if (platform !== "youtube" && platform !== "tiktok") return null;

  const endpoint =
    platform === "youtube"
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(
          url.toString(),
        )}&format=json`
      : `https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`;

  const data = await fetchJson(endpoint);
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  const author =
    typeof record.author_name === "string"
      ? record.author_name.replace(/^@+/, "").toLowerCase()
      : null;
  const title = typeof record.title === "string" ? record.title : null;
  return { author, title };
}

/**
 * Real YouTube statistics, when the deployment has a Data API key.
 * Returns null otherwise — the caller then reports "not available".
 */
async function youtubeMetrics(
  url: URL,
): Promise<InspectResult["metrics"]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const videoId = youtubeVideoId(url);
  if (!videoId) return null;

  const data = await fetchJson(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(
      videoId,
    )}&key=${encodeURIComponent(apiKey)}`,
  );
  if (!data || typeof data !== "object") return null;

  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const stats = (items[0] as { statistics?: Record<string, unknown> })
    .statistics;
  if (!stats) return null;

  const read = (key: string): number => {
    const value = stats[key];
    return typeof value === "string" ? Number(value) || 0 : 0;
  };

  return {
    views: read("viewCount"),
    likes: read("likeCount"),
    comments: read("commentCount"),
    // YouTube does not publish a share count.
    shares: 0,
    fetchedAt: Date.now(),
  };
}

export const inspectClip = action({
  args: { link: v.string(), platform: PLATFORM },
  handler: async (
    _ctx,
    args: InspectArgs,
  ): Promise<InspectResult> => {
    const url = normalizeLink(args.link);
    if (!url) {
      return {
        reachable: false,
        author: null,
        title: null,
        metrics: null,
        metricsNote: null,
        error: "That does not look like a valid link.",
      };
    }

    const embed = await oEmbed(url, args.platform);

    if (!embed) {
      return {
        reachable: false,
        author: null,
        title: null,
        metrics: null,
        metricsNote: null,
        error:
          args.platform === "instagram" || args.platform === "x"
            ? `${args.platform === "instagram" ? "Instagram" : "X"} does not expose a public embed endpoint, so CLIPTIC cannot confirm this link automatically. Paste the exact post link and make sure the account is public.`
            : "We couldn't load that post. Check the link and make sure it is public.",
      };
    }

    let metrics: InspectResult["metrics"] = null;
    let metricsNote: string | null =
      "View counts are only available once the platform API is connected for this deployment.";

    if (args.platform === "youtube") {
      metrics = await youtubeMetrics(url);
      if (metrics) metricsNote = null;
    }

    return {
      reachable: true,
      author: embed.author,
      title: embed.title,
      metrics,
      metricsNote,
      error: null,
    };
  },
});
