import type { AccountStatus, Platform, SubmissionStatus } from "@/lib/clip-vault-data";
import { PLATFORM_META } from "@/lib/clip-vault-data";

/** Inline brand glyphs so platform chips render identically everywhere. */
export function PlatformIcon({
  platform,
  className = "h-4 w-4",
}: {
  platform: Platform;
  className?: string;
}) {
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.85-2.48V9.75a5.76 5.76 0 1 0 4.03 5.49V9.01a7.35 7.35 0 0 0 4.29 1.37V7.3a4.28 4.28 0 0 1-2.32-1.48Z" />
      </svg>
    );
  }
  if (platform === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        className={className}
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="5.4" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.3" cy="6.7" r="1.15" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect
          x="2.4"
          y="5.4"
          width="19.2"
          height="13.2"
          rx="4.2"
          stroke="currentColor"
          strokeWidth="1.9"
        />
        <path d="M10.6 9.4v5.2l4.6-2.6-4.6-2.6Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/** Icon inside a tinted rounded square, colored by platform. */
export function PlatformChip({
  platform,
  size = "md",
}: {
  platform: Platform;
  size?: "sm" | "md";
}) {
  const meta = PLATFORM_META[platform];
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span
      className={`inline-flex ${box} shrink-0 items-center justify-center rounded-lg border`}
      style={{
        borderColor: `${meta.color}33`,
        backgroundColor: `${meta.color}18`,
        color: meta.color,
      }}
      title={meta.label}
    >
      <PlatformIcon platform={platform} className={icon} />
    </span>
  );
}

const SUBMISSION_BADGES: Record<
  SubmissionStatus,
  { label: string; className: string }
> = {
  paid: { label: "Paid", className: "bg-neon/15 text-neon border-neon/25" },
  active: {
    label: "Live",
    className: "bg-brand/15 text-brand border-brand/30",
  },
  pending: {
    label: "In review",
    className: "bg-amber-400/10 text-amber-600 dark:text-amber-300 border-amber-400/25",
  },
  rejected: {
    label: "Declined",
    className: "bg-red-400/10 text-red-600 dark:text-red-300 border-red-400/25",
  },
};

export function StatusBadge({
  status,
}: {
  status: SubmissionStatus | AccountStatus | "verified" | "active-campaign" | "paused";
}) {
  const map: Record<string, { label: string; className: string }> = {
    ...SUBMISSION_BADGES,
    connected: {
      label: "Verified",
      className: "bg-neon/15 text-neon border-neon/25",
    },
    verified: { label: "Verified", className: "bg-neon/15 text-neon border-neon/25" },
    checking: {
      label: "Checking…",
      className: "bg-brand/15 text-brand border-brand/30",
    },
    failed: {
      label: "Failed",
      className: "bg-red-400/10 text-red-600 dark:text-red-300 border-red-400/25",
    },
    "active-campaign": {
      label: "Active",
      className: "bg-neon/15 text-neon border-neon/25",
    },
    paused: {
      label: "Paused",
      className: "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-black/12 dark:border-white/15",
    },
  };
  const badge = map[status] ?? { label: status, className: "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-black/12 dark:border-white/15" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

const BRAND_GRADIENTS = [
  "from-[#8358FF] to-[#8B3FE2]",
  "from-[#8B3FE2] to-[#5B0FA6]",
  "from-[#7C3AED] to-[#4C1D95]",
  "from-[#5B0FA6] to-[#12082E]",
];

export function brandGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return BRAND_GRADIENTS[hash % BRAND_GRADIENTS.length];
}

/** Initials tile used instead of brand logos. */
export function BrandAvatar({
  name,
  className = "h-11 w-11 text-sm",
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-inner ring-1 ring-black/10 dark:ring-white/15 ${brandGradient(name)} ${className}`}
    >
      {initials}
    </span>
  );
}
