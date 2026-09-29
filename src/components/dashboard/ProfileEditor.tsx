import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useClipVault } from "@/lib/clip-vault-store";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { useState } from "react";
import { Camera, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";

/**
 * Lets a creator set the name and picture shown across Clip Vault.
 *
 * The picture is a link rather than an upload so the profile works without
 * giving this app a file store: paste any https image address and it shows up
 * everywhere the creator is named.
 */
export function ProfileEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile, updateProfile } = useClipVault();
  const { role, user } = useAuth();
  const setOwnPassword = useAction(api.roles.setOwnPassword);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  /* Same two keyboard guards as the sign-in form: the password can be
     inspected before saving, and Caps Lock is called out before it wastes an
     attempt. */
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  /* Re-seed from the saved profile each time the dialog opens, so a cancelled
     edit never leaks into the next one.

     Done while rendering rather than inside an effect: React endorses
     adjusting state during render when it guards on a prop change, it avoids
     a cascading render pass, and the dialog never flashes stale values because
     the seeding happens before the first paint with it open. */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(profile?.name ?? "");
      setImage(profile?.avatarUrl ?? "");
      setError(null);
      setPassword("");
      setPasswordError(null);
      setShowPassword(false);
      setCapsOn(false);
    }
  }

  /**
   * Puts a password on the operator account so the same person can sign in
   * with their email as well as with Google. The password is hashed by Convex
   * Auth on the server; it is never sent anywhere else or stored in the browser.
   *
   * Failures are translated here for the same reason the sign-in form does it:
   * a stock server string about "invalid password" reads as though saving
   * broke, when the real problem is length or a rate limit.
   */
  const savePassword = async () => {
    setPasswordError(null);
    setPasswordBusy(true);
    try {
      const result = await setOwnPassword({ password });
      setPassword("");
      toast.success("Password saved", { description: result.message });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setPasswordError(
        /rate limit|too many/i.test(raw)
          ? "Too many attempts. Wait a moment and try again."
          : /short|at least 8|8 char/i.test(raw)
            ? "Passwords need to be at least 8 characters."
            : raw.slice(0, 160) || "We couldn't set that password. Try again.",
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ name, image });
      toast.success("Profile updated", {
        description: "Your name and picture now show across Clip Vault.",
      });
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save that. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const preview = image.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] overflow-hidden gap-0 p-0 sm:max-w-md">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#8B3FE2]/20 blur-[80px]" />

          <div className="relative p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-extrabold tracking-tight">
                Edit your profile
              </DialogTitle>
              <DialogDescription>
                This is how you appear on campaigns, payouts and the admin
                directory.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 flex items-center gap-4">
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
                />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A855F7] to-[#5B0FA6] text-xl font-extrabold text-white">
                  {name.trim().slice(0, 1).toUpperCase() || "C"}
                </span>
              )}
              <div className="flex-1">
                <Label
                  htmlFor="profile-name"
                  className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Display name
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or brand"
                  className="mt-2 h-10"
                />
              </div>
            </div>

            <Label
              htmlFor="profile-image"
              className="mt-5 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Picture link
            </Label>
            <div className="relative mt-2">
              <Camera className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="profile-image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
                className="h-10 pl-9"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Any https image address. Clear it to go back to your initials.
            </p>

            {error && (
              <p className="mt-3 text-sm text-red-500 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5 glow-primary"
                onClick={save}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Saving…" : "Save profile"}
              </Button>
            </div>

            {/* Operator-only: the one account that owns the console. */}
            {role === "admin" && (
              <div className="mt-7 border-t border-black/8 pt-6 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand" />
                  <h3 className="text-[13px] font-extrabold tracking-tight">
                    Sign-in &amp; security
                  </h3>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  You sign in with Google on {user?.email}. Add a password and
                  the same address works on the sign-in form too — both open this
                  one account.
                </p>

                <Label
                  htmlFor="operator-password"
                  className="mt-4 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Password
                </Label>
                <div className="relative mt-2">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="operator-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => setCapsOn(e.getModifierState("CapsLock"))}
                    onKeyDown={(e) => {
                      setCapsOn(e.getModifierState("CapsLock"));
                      if (e.key === "Enter" && password.length >= 8) {
                        e.preventDefault();
                        void savePassword();
                      }
                    }}
                    onBlur={() => setCapsOn(false)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    className="h-10 pl-9 pr-11"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {capsOn && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-amber-600 dark:text-amber-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Caps Lock is on
                  </p>
                )}

                {passwordError && (
                  <p
                    role="alert"
                    className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-[12px] leading-relaxed text-red-600 dark:text-red-300"
                  >
                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>{passwordError}</span>
                  </p>
                )}

                <Button
                  variant="outline"
                  className="mt-3 w-full gap-1.5"
                  onClick={savePassword}
                  disabled={passwordBusy || password.length < 8}
                >
                  {passwordBusy && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {passwordBusy ? "Saving…" : "Save password"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
