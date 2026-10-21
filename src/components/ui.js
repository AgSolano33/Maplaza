"use client";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-[11px] font-bold tracking-[0.18em] text-brand uppercase">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Pill({ children, tone = "blue" }) {
  const tones = {
    blue: "bg-[#edf2ff] text-[#3b5ac5]",
    green: "bg-[#e8f9f3] text-[#168468]",
    orange: "bg-[#fff4e5] text-[#b77b2b]",
    gray: "bg-[#eef1f5] text-[#6b788c]",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone] || tones.gray}`}>{children}</span>;
}

export function Empty({ children }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="mb-4 rounded-[11px] border border-[#ffd0d0] bg-[#fff5f5] px-3 py-2 text-sm text-[#9b3b3b]">{children}</div>;
}

export function Notice({ children }) {
  return <div className="rounded-[11px] border border-[#ffe8b8] bg-[#fff8eb] px-3 py-2 text-xs text-[#92621b]">{children}</div>;
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-xs font-semibold text-[#9b3b3b]">{children}</p>;
}

const REVIEW_TONE = {
  pending: "gray",
  interview: "orange",
  hired: "green",
  rejected: "gray",
  draft: "gray",
  published: "green",
  closed: "orange",
  archived: "gray",
  active: "green",
  exited: "gray",
};

export function StatusPill({ status, label }) {
  return <Pill tone={REVIEW_TONE[status] || "gray"}>{label || status}</Pill>;
}
