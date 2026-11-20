import React from 'react';

interface OmnitrixLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<OmnitrixLogoProps['size']>, string> = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20 sm:w-24 sm:h-24',
};

export default function OmnitrixLogo({
  size = 'md',
  animated = false,
  className = '',
}: OmnitrixLogoProps) {
  const uid = React.useId().replace(/:/g, '');
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${SIZE_MAP[size]} ${className}`}
      aria-label="BenBets Omnitrix"
    >
      {animated && (
        <div
          className="absolute inset-[-18%] rounded-full bg-[#00ff87]/20 blur-2xl pointer-events-none animate-omnitrix-pulse"
          aria-hidden="true"
        />
      )}
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full drop-shadow-[0_0_16px_rgba(0,255,135,0.42)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`omni-bezel-${uid}`} x1="12%" y1="8%" x2="88%" y2="92%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="35%" stopColor="#111827" />
            <stop offset="70%" stopColor="#090d16" />
            <stop offset="100%" stopColor="#26334a" />
          </linearGradient>
          <radialGradient id={`omni-well-${uid}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#0d291e" />
            <stop offset="60%" stopColor="#070a12" />
            <stop offset="100%" stopColor="#030408" />
          </radialGradient>
          <linearGradient id={`omni-core-${uid}`} x1="18%" y1="12%" x2="82%" y2="88%">
            <stop offset="0%" stopColor="#b8ffdd" />
            <stop offset="35%" stopColor="#00ff87" />
            <stop offset="80%" stopColor="#00cc6c" />
            <stop offset="100%" stopColor="#00944f" />
          </linearGradient>
          <linearGradient id={`omni-shine-${uid}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`omni-plate-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#182133" />
            <stop offset="100%" stopColor="#090c14" />
          </linearGradient>
        </defs>

        {/* Outer metallic housing */}
        <circle
          cx="60"
          cy="60"
          r="55"
          fill={`url(#omni-well-${uid})`}
          stroke={`url(#omni-bezel-${uid})`}
          strokeWidth="6"
        />

        {/* Subtle neon rim */}
        <circle
          cx="60"
          cy="60"
          r="51.5"
          stroke="#00ff87"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />

        {/* Rotating outer telemetry ring */}
        <circle
          cx="60"
          cy="60"
          r="46"
          stroke="#00ff87"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="8 5 2 5"
          className={animated ? 'origin-center animate-omnitrix-spin' : ''}
        />

        {/* Counter-rotating inner micro-dial */}
        <circle
          cx="60"
          cy="60"
          r="41.5"
          stroke="#7cffc4"
          strokeOpacity="0.22"
          strokeWidth="1"
          strokeDasharray="2 7"
          className={animated ? 'origin-center animate-omnitrix-spin-reverse' : ''}
        />

        {/* 4 Primary Omnitrix locking nodes */}
        <circle cx="60" cy="8.5" r="3.4" fill="#00ff87" stroke="#062819" strokeWidth="1.2" />
        <circle cx="111.5" cy="60" r="3.4" fill="#00ff87" stroke="#062819" strokeWidth="1.2" />
        <circle cx="60" cy="111.5" r="3.4" fill="#00ff87" stroke="#062819" strokeWidth="1.2" />
        <circle cx="8.5" cy="60" r="3.4" fill="#00ff87" stroke="#062819" strokeWidth="1.2" />

        {/* 4 Diagonal metallic dial bolts */}
        <circle cx="96.5" cy="23.5" r="1.8" fill="#475569" />
        <circle cx="96.5" cy="96.5" r="1.8" fill="#475569" />
        <circle cx="23.5" cy="96.5" r="1.8" fill="#475569" />
        <circle cx="23.5" cy="23.5" r="1.8" fill="#475569" />

        {/* Inner recessed face */}
        <circle
          cx="60"
          cy="60"
          r="37.5"
          fill="#05070e"
          stroke="#1e293b"
          strokeWidth="2.2"
        />

        {/* Side armor plates framing the hourglass */}
        <path
          d="M25.5 38 L50.5 60 L25.5 82 C22.8 75.3 22.8 44.7 25.5 38 Z"
          fill={`url(#omni-plate-${uid})`}
          stroke="#26344d"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M94.5 38 L69.5 60 L94.5 82 C97.2 75.3 97.2 44.7 94.5 38 Z"
          fill={`url(#omni-plate-${uid})`}
          stroke="#26344d"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Glowing alien hourglass core */}
        <path
          d="M32 29 H88 L64.5 60 L88 91 H32 L55.5 60 Z"
          fill={`url(#omni-core-${uid})`}
          stroke="#d1ffe8"
          strokeOpacity="0.85"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Top glass specular highlight on hourglass */}
        <path
          d="M35.5 31.5 H84.5 L67 54 H53 Z"
          fill={`url(#omni-shine-${uid})`}
        />

        {/* Center energy core node */}
        <polygon
          points="60,53 64,60 60,67 56,60"
          fill="#05130d"
          fillOpacity="0.55"
          stroke="#b8ffdd"
          strokeOpacity="0.5"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}
