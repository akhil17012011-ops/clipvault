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

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous, Password, Google],
});
