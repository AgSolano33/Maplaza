"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MODALITY_LABELS, STATUS_LABELS } from "@/domain/constants";
import { formatDateTime } from "@/domain/format";
import { api } from "@/lib/client";
import { btn, btnPrimary, card, fieldClass } from "./styles";
import { Empty, ErrorNote, PageHeader, Pill, StatusPill } from "./ui";

export default function FormLibrary() {
  const [items, setItems] = useState(null);
  const [modality, setModality] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

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
        subtitle="Evaluaciones para personas candidatas y encuestas anónimas para las áreas."
        actions={<Link href="/formularios/nuevo" className={btnPrimary}>Nuevo formulario</Link>}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${fieldClass} max-w-xs`} placeholder="Buscar por título" value={q} onChange={(event) => { setPage(1); setQ(event.target.value); }} />
        <select className={`${fieldClass} max-w-[200px]`} value={modality} onChange={(event) => { setPage(1); setModality(event.target.value); }}>
          <option value="">Todas las modalidades</option>
          <option value="recruitment">{MODALITY_LABELS.recruitment}</option>
          <option value="climate">{MODALITY_LABELS.climate}</option>
        </select>
        <select className={`${fieldClass} max-w-[180px]`} value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {items === null ? <p className="text-sm text-muted">Cargando formularios…</p> : null}
      {items !== null && items.length === 0 ? <div className={card}><Empty>No hay formularios con estos filtros.</Empty></div> : null}
      <div className="space-y-3">
        {items?.map((form) => (
          <article key={form.id} className={`${card} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill>{MODALITY_LABELS[form.modality]}</Pill>
                <StatusPill status={form.status} label={STATUS_LABELS[form.status]} />
                {form.targetRole ? <Pill tone="gray">{form.targetRole}</Pill> : null}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{form.title}</h2>
              <p className="text-xs text-muted">{form.questionCount} preguntas · Actualizado {formatDateTime(form.updatedAt)}</p>
              {form.links?.length ? (
                <div className="mt-3 space-y-3">
                  {form.links.map((link) => (
                    <div key={link.id} className="flex items-center gap-3">
                      <Image src={`/api/links/${link.id}/qr`} alt="Código QR" width={72} height={72} unoptimized className="h-[72px] w-[72px] shrink-0 rounded-[10px] border border-line bg-white p-1" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{link.areaName || "Enlace público"}{link.versionNumber ? ` · v${link.versionNumber}` : ""}</p>
                        <p className="truncate text-xs text-muted">{link.url}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" className="text-xs font-bold text-brand" onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(link.url);
                              setCopiedId(link.id);
                            } catch {
                              setError("No se pudo copiar el enlace.");
                            }
                          }}>{copiedId === link.id ? "Enlace copiado" : "Copiar enlace"}</button>
                          <a className="text-xs font-bold text-brand" href={`/api/links/${link.id}/qr?download=1`}>Descargar QR</a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/formularios/${form.id}${form.publishedVersion ? "?paso=publicar" : ""}`} className={btn}>{form.publishedVersion ? "Enlace y QR" : "Editar"}</Link>
              {form.publishedVersion ? <Link href={`/formularios/${form.id}`} className={btn}>Editar</Link> : null}
              <Link href={form.modality === "climate" ? `/clima?formId=${form.id}` : `/formularios/${form.id}/resultados`} className={btn}>Resultados</Link>
            </div>
          </article>
        ))}
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
