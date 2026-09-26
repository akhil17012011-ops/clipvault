import { useId } from "react";

/**
 * The CLIPTIC app mark: a violet rounded square with three slanted bars over a
 * glossy play tile — the identity used across nav, auth, dashboard and footer.
 */
export function ClipticMark({ className = "h-9 w-9" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `ct-${name}-${uid}`;

  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
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
          <stop stopColor="#8358FF" />
          <stop offset="0.5" stopColor="#8B3FE2" />
          <stop offset="1" stopColor="#5B0FA6" />
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
          <stop stopColor="#F3EFFF" />
          <stop offset="1" stopColor="#8B6BFA" />
        </linearGradient>
        <linearGradient
          id={id("bar")}
          x1="0"
          y1="12"
          x2="0"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E4DCFF" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="92" height="92" rx="26" fill={`url(#${id("body")})`} />
      <rect x="2" y="2" width="92" height="92" rx="26" fill={`url(#${id("gloss")})`} />
      <g transform="skewX(-16)" fill={`url(#${id("bar")})`}>
        <rect x="36" y="14" width="15" height="26" rx="6.5" />
        <rect x="55" y="14" width="15" height="26" rx="6.5" />
        <rect x="74" y="14" width="15" height="26" rx="6.5" />
      </g>
      <rect x="16" y="46" width="64" height="38" rx="15" fill={`url(#${id("shine")})`} />
      <path
        d="M43 55.5c0-1.6 1.7-2.6 3.1-1.8l15.4 8.3c1.4.8 1.4 2.8 0 3.6L46.1 74c-1.4.8-3.1-.2-3.1-1.8V55.5Z"
        fill="#2E1C84"
      />
    </svg>
  );
}

/** Mark + wordmark lockup used in navigation bars. */
export function ClipticLogo({
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
      <ClipticMark className={markClassName} />
      <span
        className={`font-extrabold tracking-[-0.03em] text-foreground ${textClassName}`}
      >
        CLIPTIC
      </span>
    </span>
  );
}
