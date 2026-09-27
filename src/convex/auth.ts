// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

/**
 * Google sign-in.
 *
 * This provider is what *starts* a Google sign-in. The matching entry in
 * auth.config.ts only tells Convex Auth which providers exist for verifying
 * incoming tokens, so without the entry below `signIn("google")` fails with
 * "Provider `google` is not configured".
 *
 * The client id and secret are read from the deployment environment as
 * AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (Auth.js's naming convention), so no
 * credential is ever present in this file or in the browser bundle. The
 * callback is <CONVEX_SITE_URL>/api/auth/callback/google.
 */
const Google = {
  id: "google",
  name: "Google",
  type: "oidc" as const,
  issuer: "https://accounts.google.com",
  checks: ["pkce", "state", "nonce"] as ("pkce" | "state" | "nonce")[],
  profile(profile: {
    sub?: string;
    name?: string;
    email?: string;
    picture?: string;
    email_verified?: boolean | string;
  }) {
    return {
      id: profile.sub ?? crypto.randomUUID(),
      name: profile.name,
      email: profile.email,
      image: profile.picture,
      /**
       * Google only sets this for an address it has verified, and Convex Auth
       * stamps `emailVerificationTime` from it. That is what lets a Google
       * sign-in go straight into the product instead of being asked for a
       * verification code by email.
       */
      emailVerified:
        profile.email_verified === true || profile.email_verified === "true",
    };
  },
};

/**
 * Email + password sign-in, with the address normalised.
 *
 * The stock provider uses the address exactly as typed as the credential key,
 * so `SignIn@Example.com` and `signin@example.com` are two different accounts.
 * A person who capitalised their address on sign-up then cannot sign in with
 * it, and a second sign-up mints a second account for the same human.
 * Lower-casing and trimming once, here, means the browser and the server always
 * agree on what the address is.
 *
 * Note what this deliberately does NOT try to do: catch a duplicate sign-up.
 * `profile` is synchronous and has no database handle, and the guard that
 * actually matters lives in {@link emailInUse} plus the sign-up form, which
 * checks before it submits.
 */
const PasswordProvider = Password({
  profile: (params) => {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }

    return { email };
  },
});

/**
 * Where the browser goes after an OAuth round trip.
 *
 * Out of the box Convex Auth resolves `redirectTo` against the `SITE_URL`
 * environment variable. That variable is shared across a project's deployments
 * by the hosting platform, so on the published deployment it can name a
 * *different* Convex site — and the browser then lands on a site that has
 * never heard of this deployment, which renders Convex's "No matching routes
 * found" page and signs nobody in.
 *
 * `CONVEX_SITE_URL` is set per deployment by Convex itself and is always the
 * site actually serving these functions, so relative redirect targets are
 * resolved against that instead. An absolute URL is only allowed when it is on
 * this same site, which keeps the callback from being used as an open redirect.
 */
async function resolveRedirect({ redirectTo }: { redirectTo: string }) {
  const site = (process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "");
  if (!site) {
    throw new Error("CONVEX_SITE_URL is not set on this deployment.");
  }
  if (/^https?:\/\//i.test(redirectTo)) {
    if (redirectTo === site || redirectTo.startsWith(`${site}/`)) {
      return redirectTo;
    }
    throw new Error(`Refusing to redirect off-site: ${redirectTo}`);
  }
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
    return `${site}${redirectTo}`;
  }
  throw new Error(`Invalid redirectTo: ${redirectTo}`);
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, PasswordProvider, Google],
  callbacks: { redirect: resolveRedirect },
});
