"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REVIEW_LABELS } from "@/domain/constants";
import { formatDateTime } from "@/domain/format";
import { api, downloadCsv } from "@/lib/client";
import { btn, card, fieldClass } from "./styles";
import { Empty, ErrorNote, PageHeader, StatusPill } from "./ui";

export default function CandidatesView({ initialFormId = "" }) {
  const [items, setItems] = useState(null);
  const [forms, setForms] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [formId, setFormId] = useState(initialFormId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/forms?modality=recruitment&limit=50").then((data) => setForms(data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (formId) params.set("formId", formId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    let ignore = false;
    api(`/api/applications?${params.toString()}`)
      .then((data) => {
        if (ignore) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      });
    return () => {
      ignore = true;
    };
  }, [formId, from, page, q, status, to]);

  async function exportCsv() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (formId) params.set("formId", formId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      await downloadCsv(`/api/applications/export?${params.toString()}`, "maplasa-candidatos.csv");
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reclutamiento"
        title="Candidatos"
        subtitle="Cada fila es una postulación. La misma persona puede tener varias evaluaciones."
        actions={<button type="button" className={btn} onClick={exportCsv}>Exportar CSV</button>}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="mb-4 grid gap-2 md:grid-cols-5">
        <input className={fieldClass} placeholder="Nombre o correo" value={q} onChange={(event) => { setPage(1); setQ(event.target.value); }} />
        <select className={fieldClass} value={formId} onChange={(event) => { setPage(1); setFormId(event.target.value); }}>
          <option value="">Todas las evaluaciones</option>
          {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
        </select>
        <select className={fieldClass} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">Todos los estados</option>
          {Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="date" className={fieldClass} value={from} onChange={(event) => { setPage(1); setFrom(event.target.value); }} />
        <input type="date" className={fieldClass} value={to} onChange={(event) => { setPage(1); setTo(event.target.value); }} />
      </div>
      <div className={`${card} overflow-x-auto`}>
        {items === null ? <p className="text-sm text-muted">Cargando postulaciones…</p> : null}
        {items !== null && items.length === 0 ? <Empty>No hay postulaciones que coincidan.</Empty> : null}
        {items?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-2">Candidato</th><th>Evaluación</th><th>Puntuación</th><th>Estado</th><th>Fecha</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#f0f2f6]">
                  <td className="py-3"><b className="block">{item.name}</b><span className="text-xs text-muted">{item.email}</span></td>
                  <td>{item.formTitle}{item.versionNumber ? ` · v${item.versionNumber}` : ""}</td>
                  <td className="font-bold">{item.globalScoreLabel}</td>
                  <td><StatusPill status={item.reviewStatus} label={item.reviewLabel} /></td>
                  <td>{formatDateTime(item.submittedAt)}</td>
                  <td><Link href={`/candidatos/${item.candidateId}`} className="font-bold text-brand">Ver perfil</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      {total > 20 ? (
        <div className="mt-4 flex gap-2 text-sm">
          <button type="button" className={btn} disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <button type="button" className={btn} disabled={page * 20 >= total} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
        </div>
      ) : null}
    </div>
  );
}
