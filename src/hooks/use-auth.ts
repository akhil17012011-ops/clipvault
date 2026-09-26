import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state
  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    /**
     * The role comes from the user's row in the database, so it is decided by
     * the server and cannot be influenced by anything the browser sends.
     */
    role: user?.role === "admin" ? ("admin" as const) : ("creator" as const),
    /** Display name, preferring the real auth record over anything guessed. */
    name:
      user?.name ?? user?.email?.split("@")[0] ?? "Creator",
    signIn,
    signOut,
  };
}
