import { httpActionGeneric, httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * The app is served from its own host (APP_URL) rather than from the Convex
 * site, and that host does not proxy /api/* to Convex. So the Convex site has
 * to stay the OAuth origin, and after a Google round trip the browser is left
 * sitting on the Convex site with nothing to render.
 *
 * This route is the hand-back point. It sends the browser back to the app and,
 * crucially, carries across the one-time `code` that Convex Auth's OAuth
 * callback appends to the redirect URL. Convex Auth's browser client picks
 * that `code` up from the URL, exchanges it for a session through
 * `signIn(undefined, { code })`, and stores the tokens on the app's own
 * origin. Dropping the code here is what leaves the visitor stuck on the
 * "Sign in to continue" screen.
 *
 * Only a same-app path is accepted from the query string — never an absolute
 * URL — so this cannot be used to bounce people to an attacker's site.
 */
/**
 * The origin the app itself is served from, used to hand the browser back after
 * an OAuth round trip.
 *
 * `SITE_URL` is the variable the hosting platform publishes, so it is read
 * first — preferring `APP_URL` over it would mean an override that nobody sets
 * silently shadows the value that is actually configured, and the hand-back
 * would quietly fall through to the compiled-in default. `APP_URL` stays
 * supported as an explicit override for self-hosting.
 */
const APP_URL = (
  process.env.APP_URL ??
  process.env.SITE_URL ??
  "https://clipvaultclipping.freebuff.app"
).replace(/\/+$/, "");

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

    const destination = new URL(safePath, APP_URL);

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
