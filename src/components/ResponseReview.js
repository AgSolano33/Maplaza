"use client";

import { useState } from "react";
import { formatDateTime } from "@/domain/format";

function tone(percent) {
  if (percent >= 80) return { ring: "#1f9d6a", ink: "#157a50", wash: "#e7f6ee" };
  if (percent >= 60) return { ring: "#e0a020", ink: "#8a6410", wash: "#fff6e4" };
  return { ring: "#e23b3b", ink: "#c44545", wash: "#fdecec" };
}

function Mark({ selected, multiple }) {
  return (
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${multiple ? "rounded-[4px]" : "rounded-full"}`}
      style={selected ? { background: "#1f9d6a", borderColor: "#1f9d6a" } : { background: "#fff", borderColor: "#c5cedd" }}
    >
      {selected ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M3.2 8.3 6.3 11.2 12.8 4.6" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

function ScoreRing({ label, percent, caption }) {
  const color = tone(percent);
  const size = 84;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const filled = length * (Math.max(0, Math.min(100, percent)) / 100);
  return (
    <div className="flex w-[96px] shrink-0 flex-col items-center text-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e6ebf3" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${length - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color.ink} fontSize="15" fontWeight="700">
          {Math.round(percent)}%
        </text>
      </svg>
      <p className="mt-1 line-clamp-2 text-xs font-semibold">{label}</p>
      {caption ? <p className="text-[11px] text-muted">{caption}</p> : null}
    </div>
  );
}

function responseLabel(item, index) {
  if (item.anonymous) return `Respuesta anónima ${index + 1}`;
  return item.name || `Respuesta ${index + 1}`;
}

export default function ResponseReview({ items = [], total = 0, error = "", pin = "top-0", background = "" }) {
  const [index, setIndex] = useState(0);
  const current = items.length ? Math.min(index, items.length - 1) : 0;
  const item = items[current];
  const page = /^#[0-9a-fA-F]{6}$/.test(background) ? background : "#f5f7fb";

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className={`sticky ${pin} relative z-20 pb-3`} style={pin === "top-0" ? undefined : { background: page }}>
        {pin === "top-0" ? null : <div className="absolute inset-x-0 bottom-full h-5" style={{ background: page }} aria-hidden="true" />}
        <div className="overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.04)]">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <button type="button" aria-label="Respuesta anterior" disabled={!item || current === 0} className="grid h-10 w-10 place-items-center rounded-full text-xl text-ink hover:bg-[#f4f7fb] disabled:opacity-30" onClick={() => setIndex(current - 1)}>‹</button>
          <div className="min-w-0 text-center">
            <h2 className="text-base font-semibold leading-6">{error || (item ? responseLabel(item, current) : "Respuestas")}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {item
                ? `${current + 1} de ${items.length}${item.email ? ` · ${item.email}` : ""}${item.areaName ? ` · ${item.areaName}` : ""} · ${formatDateTime(item.submittedAt)}`
                : error
                  ? ""
                  : "Todavía no hay respuestas."}
            </p>
          </div>
          <button type="button" aria-label="Respuesta siguiente" disabled={!item || current >= items.length - 1} className="grid h-10 w-10 place-items-center rounded-full text-xl text-ink hover:bg-[#f4f7fb] disabled:opacity-30" onClick={() => setIndex(current + 1)}>›</button>
        </div>
        </div>
      </div>
      {item?.scored ? (
        <section className="rounded-[8px] border border-line bg-white px-4 py-5 text-center shadow-[0_1px_2px_rgba(38,61,100,0.04)]">
          <h3 className="text-s font-semibold">Estadísticas</h3>
          <div className="mt-4 flex flex-wrap items-start justify-center gap-x-6 gap-y-4">
            <ScoreRing label="Global" percent={item.percent || 0} caption={item.possible ? `${item.earned} / ${item.possible}` : null} />
            {(item.competencies || []).map((competency) => (
              <ScoreRing
                key={competency.name}
                label={competency.name}
                percent={competency.scorePercent || 0}
                caption={competency.possible ? `${competency.earned} / ${competency.possible}` : null}
              />
            ))}
          </div>
        </section>
      ) : null}
      {item ? (
        <div className={`${item.scored ? "mt-3" : ""} space-y-3`}>
          {item.answers.map((answer, answerIndex) => {
            const ratio = answer.maximum ? (answer.points / answer.maximum) * 100 : null;
            const color = ratio == null ? null : tone(ratio);
            return (
              <article key={`${item.id}-${answerIndex}`} className="rounded-[8px] border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(38,61,100,0.04)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {answer.competencyName ? <p className="text-xs font-semibold text-muted">{answer.competencyName}</p> : null}
                    <p className="font-semibold leading-6">{answer.prompt}</p>
                  </div>
                  {answer.maximum != null ? (
                    <span className="shrink-0 text-sm font-semibold" style={{ color: color.ink }}>{answer.points} / {answer.maximum}</span>
                  ) : null}
                </div>
                {answer.options?.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {answer.options.map((option) => (
                      <li key={option.id} className={`flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm ${option.selected ? "font-semibold" : "text-muted"}`} style={option.selected ? { background: "#e7f6ee", color: "#157a50" } : undefined}>
                        <Mark selected={option.selected} multiple={answer.type === "multiple"} />
                        <span className="min-w-0 flex-1">{option.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6">{answer.value}</p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
      {total > items.length ? <p className="mt-3 text-xs text-muted">Se muestran las {items.length} respuestas más recientes.</p> : null}
    </section>
  );
}
