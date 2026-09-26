import { httpActionGeneric, httpRouter } from "convex/server";
import { auth } from "./auth";

/**
 * The app is served from its own host (APP_URL) rather than from the Convex
 * site, and that host does not proxy /api/* to Convex. So the Convex site has
 * to stay the OAuth origin, and after a Google round trip the browser is left
 * sitting on the Convex site with nothing to render.
 *
 * This route is the hand-back point: the client asks to be returned to a path
 * on the app, and we send it there. Only paths are accepted — never an
 * absolute URL from the query string — so this cannot be used to bounce people
 * to an attacker's site.
 */
const APP_URL = (
  process.env.APP_URL ?? "https://smart-showers-attend.freebuff.dev"
).replace(/\/+$/, "");

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/back-to-app",
  method: "GET",
  handler: httpActionGeneric(async (_ctx, request) => {
    const url = new URL(request.url);
    const requested = url.searchParams.get("to") ?? "/dashboard";

    /* Only a same-app path is honoured, so this stays a closed redirect.
       Backslashes are rejected too: some browsers normalise `/\/host` into a
       protocol-relative URL, which would turn this into an open redirect. */
    const safePath =
      requested.startsWith("/") &&
      !requested.startsWith("//") &&
      !requested.includes("\\")
        ? requested
        : "/dashboard";

    return new Response(null, {
      status: 302,
      headers: {
        location: `${APP_URL}${safePath}`,
        "cache-control": "no-store",
      },
    });
  }),
});

export default http;
