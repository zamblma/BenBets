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
          className="absolute inset-[-12%] rounded-full bg-[#00ff87]/15 blur-xl pointer-events-none animate-omnitrix-pulse"
          aria-hidden="true"
        />
      )}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(0,255,135,0.35)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`omni-core-${uid}`} x1="20%" y1="15%" x2="80%" y2="85%">
            <stop offset="0%" stopColor="#6effb8" />
            <stop offset="45%" stopColor="#00ff87" />
            <stop offset="100%" stopColor="#00b862" />
          </linearGradient>
          <linearGradient id={`omni-ring-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0b0e17" />
            <stop offset="100%" stopColor="#1a2235" />
          </linearGradient>
          <radialGradient id={`omni-bg-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d1b16" />
            <stop offset="70%" stopColor="#06070d" />
            <stop offset="100%" stopColor="#040508" />
          </radialGradient>
        </defs>

        {/* Outer metallic housing */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill={`url(#omni-bg-${uid})`}
          stroke={`url(#omni-ring-${uid})`}
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="#00ff87"
          strokeOpacity="0.28"
          strokeWidth="1"
        />

        {/* Rotating tech dial ring */}
        <circle
          cx="50"
          cy="50"
          r="39"
          stroke="#00ff87"
          strokeOpacity="0.4"
          strokeWidth="1.4"
          strokeDasharray="6 4 2 4"
          className={animated ? 'origin-center animate-omnitrix-spin' : ''}
        />

        {/* 4 corner Omnitrix dial nodes */}
        <circle cx="50" cy="10" r="2.6" fill="#00ff87" />
        <circle cx="90" cy="50" r="2.6" fill="#00ff87" />
        <circle cx="50" cy="90" r="2.6" fill="#00ff87" />
        <circle cx="10" cy="50" r="2.6" fill="#00ff87" />

        {/* Inner dial bezel */}
        <circle
          cx="50"
          cy="50"
          r="32"
          fill="#06080f"
          stroke="#1f293d"
          strokeWidth="2"
        />

        {/* Side dark triangles framing the hourglass */}
        <path d="M21 31 L43 50 L21 69 Z" fill="#0d111d" stroke="#1e293b" strokeWidth="1" />
        <path d="M79 31 L57 50 L79 69 Z" fill="#0d111d" stroke="#1e293b" strokeWidth="1" />

        {/* Glowing alien hourglass core */}
        <path
          d="M27 24 H73 L53.5 50 L73 76 H27 L46.5 50 Z"
          fill={`url(#omni-core-${uid})`}
          stroke="#a7ffd4"
          strokeOpacity="0.7"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Center core slit */}
        <ellipse cx="50" cy="50" rx="2.6" ry="4.5" fill="#06070d" fillOpacity="0.45" />
      </svg>
    </div>
  );
}
