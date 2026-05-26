import React from 'react';

export interface GitIconProps {
  size?: number;
  className?: string;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    className,
    'aria-hidden': true as const,
  };
}

export function GitIconRefresh({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M13 8a5 5 0 1 1-1.46-3.54" strokeLinecap="round" />
      <path d="M13 4.5V8h-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconSync({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M12.5 2.75v2.75h-2.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.8 5.2A5.5 5.5 0 0 0 3.5 8" strokeLinecap="round" />
      <path d="M3.5 13.25v-2.75h2.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.2 10.8A5.5 5.5 0 0 0 12.5 8" strokeLinecap="round" />
    </svg>
  );
}

export function GitIconMore({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={0} fill="currentColor">
      <circle cx="3.5" cy="8" r="1.1" />
      <circle cx="8" cy="8" r="1.1" />
      <circle cx="12.5" cy="8" r="1.1" />
    </svg>
  );
}

export function GitIconPlus({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8 4v8M4 8h8" strokeLinecap="round" />
    </svg>
  );
}

export function GitIconMinus({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 8h8" strokeLinecap="round" />
    </svg>
  );
}

export function GitIconClose({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" strokeLinecap="round" />
    </svg>
  );
}

export function GitIconChevronDown({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconChevronRight({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconArrowDown({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8 3.5v7M5.5 8 8 10.5 10.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconArrowUp({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8 12.5v-7M5.5 8 8 5.5 10.5 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconRebase({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 4.5h4.5a2.5 2.5 0 0 1 0 5H8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 6 5 4.5 6.5 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 11.5H6.5a2.5 2.5 0 0 1 0-5H8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 10 11 11.5 9.5 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconCheck({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3.5 8.2 6.5 11.2 12.5 4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconUndo({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4.5 6.5H10a2.5 2.5 0 1 1 0 5H8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 4.5 4.5 6.5 6.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconDiff({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5.5 3.5v9M10.5 3.5v9" strokeLinecap="round" />
      <path d="M3.5 8h3M9.5 6h3M9.5 10h3" strokeLinecap="round" />
    </svg>
  );
}

export function GitIconOpenExternal({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M6.5 9.5H4.5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1H9a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3.5h4.5V8M7 9 12 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GitIconStageModified({ size = 14, className }: GitIconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M4 5.5h8M4 8h8M4 10.5h8" strokeLinecap="round" />
    </svg>
  );
}

export type GitRowActionKind = 'stage' | 'unstage' | 'discard' | 'open' | 'diff';

export function GitRowActionIcon({ kind, size = 12, className }: { kind: GitRowActionKind; size?: number; className?: string }) {
  switch (kind) {
    case 'stage': return <GitIconPlus size={size} className={className} />;
    case 'unstage': return <GitIconMinus size={size} className={className} />;
    case 'discard': return <GitIconUndo size={size} className={className} />;
    case 'open': return <GitIconOpenExternal size={size} className={className} />;
    case 'diff': return <GitIconDiff size={size} className={className} />;
  }
}
