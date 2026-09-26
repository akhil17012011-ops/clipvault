import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * One-time provisioning of the CLIPTIC operator account.
 *
 * The password is supplied by the operator at call time and is never written
 * into the repo or the browser bundle. It is handed straight to Convex Auth's
 * `createAccount`, which runs the Password provider's own hashing (Scrypt)
 * before persisting it, so the stored credential is a salted hash and the
 * plaintext only ever exists in this process's memory for the length of the
 * call.
 *
 * The action is idempotent: re-running it with the same email simply
 * re-confirms the role, so it is safe to retry.
 *
 * Run from the CLI:
 *   bunx convex run admin:bootstrapAdmin '{"email":"...","password":"..."}'
 */

const PROVIDER = "password";
const PASSWORD_MIN = 8;

type BootstrapArgs = { email: string; password: string };
type BootstrapResult = { ok: boolean; created: boolean; message: string };

export const bootstrapAdmin = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (
    ctx,
    args: BootstrapArgs,
  ): Promise<BootstrapResult> => {
    const email = args.email.trim().toLowerCase();
    const password = args.password;

    if (!email.includes("@")) {
      return { ok: false, created: false, message: "A valid email is required." };
    }
    if (password.length < PASSWORD_MIN) {
      return {
        ok: false,
        created: false,
        message: `Password must be at least ${PASSWORD_MIN} characters.`,
      };
    }

    let created = false;

    try {
      await createAccount(ctx, {
        provider: PROVIDER,
        account: { id: email, secret: password },
        profile: {
          email,
          emailVerificationTime: Date.now(),
          role: "admin",
        },
      });
      created = true;
    } catch (createError) {
      // The most common reason to land here is that the account already
      // exists. Confirm that by checking whether the user row is reachable,
      // and only then treat the failure as benign.
      const existing = await ctx.runMutation(internal.roles.setRole, {
        email,
        role: "admin",
      });
      if (existing.found) {
        return {
          ok: true,
          created: false,
          message: "Operator account already existed; role confirmed.",
        };
      }
      throw createError;
    }

    // The role is also written in the profile above; this second pass makes the
    // action safe to re-run and repairs a user created by any other provider.
    const granted = await ctx.runMutation(internal.roles.setRole, {
      email,
      role: "admin",
    });

    if (!granted.found) {
      return {
        ok: false,
        created,
        message: `No user row matched ${email}; role was not applied.`,
      };
    }

    return {
      ok: true,
      created,
      message: "Operator account created.",
    };
  },
});
