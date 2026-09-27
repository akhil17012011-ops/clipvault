import { useId, useState } from "react";

/**
 * The supplied brand artwork, used exactly as given. It lives in `public/` so
 * the browser fetches and caches the real file — nothing here redraws it.
 */
const MARK_SRC = "/assets/1000007882.jpg";

/**
 * The Clip Vault mark, used across nav, auth, the dashboard and the footer.
 *
 * The vector mark below is only a stand-in for the case where the artwork file
 * has not been added yet, so a build that predates it still renders something
 * rather than a broken image box.
 */
export function ClipVaultMark({ className = "h-9 w-9" }: { className?: string }) {
  const [artworkMissing, setArtworkMissing] = useState(false);

  if (artworkMissing) return <FallbackMark className={className} />;

  return (
    <img
      src={MARK_SRC}
      alt=""
      aria-hidden="true"
      onError={() => setArtworkMissing(true)}
      className={`${className} shrink-0 rounded-[22%] object-cover`}
    />
  );
}

/** The previous vector mark — fallback only, see {@link ClipVaultMark}. */
function FallbackMark({ className = "h-9 w-9" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `ct-${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: "drop-shadow(0 4px 14px rgb(139 92 246 / 0.45))" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id("body")}
          x1="8"
          y1="4"
          x2="88"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7C3AED" />
          <stop offset="0.45" stopColor="#5B21B6" />
          <stop offset="1" stopColor="#2E0A5E" />
        </linearGradient>
        {/* Electric violet rim, as on the reference mark. */}
        <linearGradient
          id={id("rim")}
          x1="14"
          y1="6"
          x2="82"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C084FC" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#A855F7" stopOpacity="0.2" />
          <stop offset="1" stopColor="#7C3AED" stopOpacity="0.75" />
        </linearGradient>
        <linearGradient
          id={id("gloss")}
          x1="48"
          y1="2"
          x2="48"
          y2="94"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={id("shine")}
          x1="24"
          y1="44"
          x2="74"
          y2="88"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DDD6FE" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient
          id={id("bar")}
          x1="0"
          y1="12"
          x2="0"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="92" height="92" rx="26" fill={`url(#${id("body")})`} />
      <rect
        x="2.75"
        y="2.75"
        width="90.5"
        height="90.5"
        rx="25.5"
        fill="none"
        stroke={`url(#${id("rim")})`}
        strokeWidth="1.5"
      />
      <rect x="2" y="2" width="92" height="92" rx="26" fill={`url(#${id("gloss")})`} />
      <g transform="skewX(-16)" fill={`url(#${id("bar")})`}>
        <rect x="36" y="14" width="15" height="26" rx="6.5" />
        <rect x="55" y="14" width="15" height="26" rx="6.5" />
        <rect x="74" y="14" width="15" height="26" rx="6.5" />
      </g>
      <rect x="16" y="46" width="64" height="38" rx="15" fill={`url(#${id("shine")})`} />
      <path
        d="M43 55.5c0-1.6 1.7-2.6 3.1-1.8l15.4 8.3c1.4.8 1.4 2.8 0 3.6L46.1 74c-1.4.8-3.1-.2-3.1-1.8V55.5Z"
        fill="#2A0A5C"
      />
    </svg>
  );
}

/** Mark + wordmark lockup used in navigation bars. */
export function ClipVaultLogo({
  className = "",
  markClassName = "h-8 w-8",
  textClassName = "text-lg",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ClipVaultMark className={markClassName} />
      <span
        className={`font-extrabold tracking-[-0.01em] text-foreground ${textClassName}`}
      >
        Clip Vault
      </span>
    </span>
  );
}
