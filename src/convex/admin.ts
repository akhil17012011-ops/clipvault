import { v } from "convex/values";
import { internalAction, query } from "./_generated/server";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./access";

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

/**
 * Every user on the platform, with the accounts they connected and what their
 * clips have actually earned. Admin only.
 *
 * Earnings use the same rule the creator's payout screen does: a clip pays
 * once it is past its campaign's view threshold, and rejected clips never pay.
 * Reporting it here rather than in the browser keeps one definition of
 * "earned" from drifting between the two views.
 */
export const users = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const userRows = await ctx.db.query("users").collect();
    const accountRows = await ctx.db.query("connectedAccounts").collect();
    const submissionRows = await ctx.db.query("submissions").collect();
    const campaignRows = await ctx.db.query("campaigns").collect();

    const campaigns = new Map(
      campaignRows.map((c) => [
        c._id,
        { minViews: c.minViews, ratePer1k: c.ratePer1k },
      ]),
    );

    const accountsByUser = new Map<string, typeof accountRows>();
    for (const account of accountRows) {
      const list = accountsByUser.get(account.userId) ?? [];
      list.push(account);
      accountsByUser.set(account.userId, list);
    }

    return userRows
      .map((user) => {
        const mine = submissionRows.filter((s) => s.userId === user._id);
        let views = 0;
        let earned = 0;
        for (const submission of mine) {
          views += submission.views;
          const campaign = campaigns.get(submission.campaignId);
          if (!campaign) continue;
          if (submission.status === "rejected") continue;
          if (submission.views < campaign.minViews) continue;
          earned += (submission.views / 1000) * campaign.ratePer1k;
        }

        return {
          userId: user._id,
          name: user.name ?? user.email?.split("@")[0] ?? "Creator",
          email: user.email ?? "",
          image: user.image ?? null,
          role: user.role ?? "user",
          joined: user._creationTime,
          accounts: (accountsByUser.get(user._id) ?? []).map((account) => ({
            id: account._id,
            platform: account.platform,
            handle: account.handle,
            status: account.status,
            followers: account.followers ?? null,
            posts: account.posts ?? null,
            connectedAt: account.connectedAt ?? null,
          })),
          clips: mine.length,
          views,
          earned,
        };
      })
      .sort((a, b) => b.joined - a.joined);
  },
});
