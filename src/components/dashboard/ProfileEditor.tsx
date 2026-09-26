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
import { useCliptic } from "@/lib/cliptic-store";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

/**
 * Lets a creator set the name and picture shown across CLIPTIC.
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
  const { profile, updateProfile } = useCliptic();
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Re-seed from the saved profile each time the dialog opens, so a cancelled
     edit never leaks into the next one. */
  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setImage(profile?.avatarUrl ?? "");
    setError(null);
  }, [open, profile?.name, profile?.avatarUrl]);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await updateProfile({ name, image });
      toast.success("Profile updated", {
        description: "Your name and picture now show across CLIPTIC.",
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
