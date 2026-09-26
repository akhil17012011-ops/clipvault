import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";

/**
 * Email verification for the signed-in user.
 *
 * Google accounts arrive already verified (Google proved the address), so
 * this only has work to do for people who signed up with a password.
 */
export function useVerification() {
  const status = useQuery(api.verification.status);
  /* Requesting a code sends mail, which is an action, not a mutation. */
  const requestCode = useAction(api.verification.requestCode);
  const checkCode = useMutation(api.verification.checkCode);

  return {
    /** `undefined` while the status is still loading. */
    status,
    isVerified: status?.verified === true,
    /** `undefined` until we know whether a code is worth showing. */
    isLoading: status === undefined,
    requestCode,
    checkCode,
  };
}
