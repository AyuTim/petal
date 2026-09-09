export function PetalMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d="M12.8 2.2c-1.1 3.2-4.8 6.8-5.6 10.6-.7 3.4 1.4 6.4 4.6 7.1 3.1.7 6.1-1.5 6.8-4.8.9-4.2-1.4-8.6-5.8-12.9Z" />
    </svg>
  );
}

export function FlowerMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="7"
          rx="2.75"
          ry="4.8"
          fill="currentColor"
          opacity={angle % 120 === 0 ? 0.9 : 0.62}
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="2.55" fill="#fef3c7" stroke="rgba(255,255,255,0.92)" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="0.9" fill="#d97706" opacity="0.78" />
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`.trim()}>
      <img className="brand-flower brand-flower-logo" src="/petals-flower-logo.png" alt="" />
      <span>Petals</span>
    </span>
  );
}
