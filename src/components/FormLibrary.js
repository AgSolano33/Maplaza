"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MODALITY_LABELS, STATUS_LABELS } from "@/domain/constants";
import { formatDateTime } from "@/domain/format";
import { api } from "@/lib/client";
import { btn, btnPrimary, card, fieldClass } from "./styles";
import { Empty, ErrorNote, PageHeader, StatusPill } from "./ui";

export default function FormLibrary() {
  const [items, setItems] = useState(null);
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (modality) params.set("modality", modality);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    let ignore = false;
    api(`/api/forms?${params.toString()}`)
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
  }, [modality, page, q, status]);

  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca"
        title="Formularios"
        subtitle="Elige un formulario para ver su información y las respuestas."
        actions={<Link href="/formularios/nuevo" className={btnPrimary}>Nuevo formulario</Link>}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${fieldClass} max-w-xs`} placeholder="Buscar por título" value={q} onChange={(event) => { setPage(1); setQ(event.target.value); }} />
        <select className={`${fieldClass} max-w-[220px]`} value={modality} onChange={(event) => { setPage(1); setModality(event.target.value); }}>
          <option value="">Todos los tipos</option>
          <option value="recruitment">{MODALITY_LABELS.recruitment}</option>
          <option value="climate">{MODALITY_LABELS.climate}</option>
        </select>
        <select className={`${fieldClass} max-w-[180px]`} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className={`${card} overflow-x-auto p-0`}>
        {items === null ? <p className="px-5 py-8 text-sm text-muted">Cargando formularios…</p> : null}
        {items !== null && items.length === 0 ? <Empty>No hay formularios con estos filtros.</Empty> : null}
        {items?.length ? (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f7f9fc] text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Formulario</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Preguntas</th>
                <th className="px-4 py-3 font-semibold">Actualizado</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {items.map((form) => (
                <tr key={form.id} className="border-t border-line hover:bg-[#f8faff]">
                  <td className="px-4 py-3">
                    <Link href={`/formularios/${form.id}`} className="font-semibold hover:text-brand">{form.title}</Link>
                    {form.targetRole ? <p className="text-xs text-muted">{form.targetRole}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{MODALITY_LABELS[form.modality]}</td>
                  <td className="px-4 py-3"><StatusPill status={form.status} label={STATUS_LABELS[form.status]} /></td>
                  <td className="px-4 py-3">{form.questionCount}</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(form.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/formularios/${form.id}`} className="font-bold text-brand">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
      {total > 20 ? (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <button type="button" className={btn} disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <span>Página {page}</span>
          <button type="button" className={btn} disabled={page * 20 >= total} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
        </div>
      ) : null}
    </div>
  );
}
