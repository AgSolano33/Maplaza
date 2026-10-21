"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REVIEW_LABELS } from "@/domain/constants";
import { formatDateTime } from "@/domain/format";
import { formatScore } from "@/domain/scoring";
import { api } from "@/lib/client";
import { btn, btnPrimary, card, fieldClass, labelClass } from "./styles";
import { ErrorNote, Notice, PageHeader, StatusPill } from "./ui";

export default function CandidateProfile({ candidateId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api(`/api/candidates/${candidateId}`).then(setData).catch((loadError) => setError(loadError.message));
  }, [candidateId]);

  async function save(application, patch) {
    setPending(true);
    setError("");
    try {
      await api(`/api/applications/${application.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData(await api(`/api/candidates/${candidateId}`));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setPending(false);
    }
  }

  if (!data) return <p className="text-sm text-muted">{error || "Cargando perfil…"}</p>;

  return (
    <div>
      <PageHeader eyebrow="Candidato" title={data.name} subtitle={data.email} actions={<Link href="/candidatos" className={btn}>Volver</Link>} />
      <ErrorNote>{error}</ErrorNote>
      {data.applications.length === 0 ? <p className="text-sm text-muted">Esta persona todavía no tiene postulaciones.</p> : null}
      <div className="space-y-4">
        {data.applications.map((application) => (
          <ApplicationCard key={application.id} application={application} pending={pending} onSave={save} />
        ))}
      </div>
    </div>
  );
}

function ApplicationCard({ application, pending, onSave }) {
  const [status, setStatus] = useState(application.reviewStatus);
  const [notes, setNotes] = useState(application.internalNotes || "");
  return (
    <article className={card}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{application.formTitle}</h2>
          <p className="text-xs text-muted">Versión {application.versionNumber} · {formatDateTime(application.submittedAt)}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{formatScore(application.globalScore)}<span className="text-sm font-normal text-muted">{application.globalScore == null ? "" : "/100"}</span></div>
          <StatusPill status={application.reviewStatus} label={application.reviewLabel} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {application.competencies.length === 0 ? <p className="text-sm text-muted">Sin puntuación</p> : application.competencies.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-xs"><span>{item.name}</span><b>{item.scoreLabel}/100</b></div>
            <div className="h-2 overflow-hidden rounded-full bg-[#edf0f6]"><div className="h-full bg-brand" style={{ width: `${Math.round(item.scorePercent)}%` }} /></div>
          </div>
        ))}
      </div>
      <Notice>La puntuación orienta la entrevista. No representa una probabilidad de permanencia ni una decisión automática.</Notice>
      <div className="mt-4 space-y-2">
        {application.answers.map((answer) => (
          <div key={answer.prompt} className="rounded-xl border border-line px-3 py-2 text-sm">
            <p className="font-bold">{answer.prompt}</p>
            <p className="text-muted">{answer.value}{answer.points != null ? ` · ${answer.points}/5` : ""}{answer.competencyName ? ` · ${answer.competencyName}` : ""}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="space-y-1.5">
          <span className={labelClass}>Estado de revisión</span>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>Notas internas de RH</span>
          <textarea className={`${fieldClass} min-h-20`} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <button type="button" className={`${btnPrimary} mt-3`} disabled={pending} onClick={() => onSave(application, { reviewStatus: status, internalNotes: notes })}>
        {pending ? "Guardando…" : "Guardar revisión"}
      </button>
    </article>
  );
}
