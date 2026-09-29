import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();
  const ensureOperatorRole = useMutation(api.roles.ensureOperatorRole);

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  /**
   * One account, every way in.
   *
   * Convex Auth only links a Google sign-in to an existing account when that
   * account is the single verified holder of the address, so a deployment that
   * was signed into before the operator account existed ends up with two rows
   * for one person — and then Google quietly mints a fresh account every time.
   * `ensureOperatorRole` merges those rows back together and re-asserts the
   * admin role, on the server, from the signed-in session alone. Once per user
   * id is enough: the result is a row the reactive queries pick up themselves.
   */
  const repairedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (repairedFor.current === user._id) return;
    repairedFor.current = user._id;
    void ensureOperatorRole().catch(() => {
      /* Retry on the next render rather than locking the user out of the app. */
      repairedFor.current = null;
    });
  }, [isAuthenticated, user, ensureOperatorRole]);

  return {
    isLoading,
    isAuthenticated,
    user,
    /**
     * The role comes from the user's row in the database, so it is decided by
     * the server and cannot be influenced by anything the browser sends.
     */
    role: user?.role === "admin" ? ("admin" as const) : ("creator" as const),
    /**
     * The role exactly as it is stored, for interfaces that label an account —
     * the platform's own account reads "developer".
     *
     * It grants nothing. Every privileged operation tests the database role
     * against "admin" on the server, so this string can only ever change how
     * the account is labelled, never what it is allowed to reach.
     */
    accountRole: user?.role ?? null,
    /** Display name, preferring the real auth record over anything guessed. */
    name:
      user?.name ?? user?.email?.split("@")[0] ?? "Creator",
    signIn,
    signOut,
  };
}
