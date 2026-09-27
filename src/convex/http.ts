import { httpActionGeneric, httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * The app is served from its own host, and that host does not proxy `/api/*` to
 * Convex. So the Convex site has to stay the OAuth origin, and after a Google
 * round trip the browser is left sitting on the Convex site with nothing to
 * render.
 *
 * This route is the hand-back point. It sends the browser back to the app and,
 * crucially, carries across the one-time `code` that Convex Auth's OAuth
 * callback appends to the redirect URL. Convex Auth's browser client picks that
 * `code` up from the URL, exchanges it for a session through
 * `signIn(undefined, { code })`, and stores the tokens on the app's own origin.
 * Dropping the code is what leaves the visitor stuck on "Sign in to continue".
 */

/**
 * Where the app is served from when the caller does not say.
 *
 * Deliberately does NOT fall back to `SITE_URL`: the hosting platform sets that
 * to the Convex *site* URL, which is the OAuth origin and serves no app at all.
 * Redirecting there lands the visitor on "No matching routes found" the moment
 * the code is deployed anywhere the variable is set.
 */
const APP_URL = (
  process.env.APP_URL ?? "https://clipvaultclipping.freebuff.app"
).replace(/\/+$/, "");

/**
 * Which origins may be handed back to.
 *
 * The sign-in code is a one-time credential, so this route must never become an
 * open redirect — sending it to an attacker's site would hand over the account.
 * That rules out trusting an arbitrary `origin` from the query string.
 *
 * Two things are accepted:
 *  - the deployment's own configured `APP_URL` host, and
 *  - any `*.freebuff.app` host over HTTPS, which is the platform's own preview
 *    domain. The preview runs the same app on a different origin, and it has to
 *    come back to *itself*: bouncing a preview sign-in to the production app
 *    means the production app tries to redeem a code the preview's deployment
 *    issued, the exchange fails, and Google sign-in is broken everywhere except
 *    on the one origin nobody is testing.
 *
 * Anything else falls back to `APP_URL`, so an unrecognised or tampered value
 * can only ever land on the configured app.
 */
function isAllowedAppOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  /* A path, query or credentials in the "origin" would mean this is not an
     origin at all; take the host only. */
  if (url.pathname !== "/" && url.pathname !== "") return false;
  if (url.search || url.hash) return false;

  let configuredHost: string;
  try {
    configuredHost = new URL(APP_URL).hostname;
  } catch {
    configuredHost = "";
  }

  const host = url.hostname;
  if (configuredHost && host === configuredHost) return true;

  return host === "freebuff.app" || host.endsWith(".freebuff.app");
}

/** The origin the browser should be returned to, or null when not allowed. */
function requestedAppOrigin(raw: string | null): string | null {
  if (!raw) return null;
  const candidate = raw.trim().replace(/\/+$/, "");
  return isAllowedAppOrigin(candidate) ? candidate : null;
}

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/back-to-app",
  method: "GET",
  handler: httpActionGeneric(async (_ctx, request) => {
    const url = new URL(request.url);

    const requested = url.searchParams.get("to") ?? "/dashboard";
    /* Backslashes are rejected too: some browsers normalise `/\/host` into a
       protocol-relative URL, which would make this an open redirect. */
    const safePath =
      requested.startsWith("/") &&
      !requested.startsWith("//") &&
      !requested.includes("\\")
        ? requested
        : "/dashboard";

    const base = requestedAppOrigin(url.searchParams.get("app")) ?? APP_URL;
    const destination = new URL(safePath, base);

    /* Hand the one-time sign-in code to the app so it can finish signing in.
       Nothing else from the query string is forwarded. */
    const code = url.searchParams.get("code");
    if (code) destination.searchParams.set("code", code);

    return new Response(null, {
      status: 302,
      headers: {
        location: destination.toString(),
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  }),
});

export default http;
