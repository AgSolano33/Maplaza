"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MODALITY_LABELS, STATUS_LABELS } from "@/domain/constants";
import { formatDateTime } from "@/domain/format";
import { api } from "@/lib/client";
import { btn, btnPrimary, card } from "./styles";
import { Empty, ErrorNote, StatusPill } from "./ui";

export default function FormDetail({ formId }) {
  const [form, setForm] = useState(null);
  const [responses, setResponses] = useState(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let ignore = false;
    Promise.all([api(`/api/forms/${formId}`), api(`/api/forms/${formId}/responses`)])
      .then(([formData, responseData]) => {
        if (ignore) return;
        setForm(formData);
        setResponses(responseData);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      });
    return () => {
      ignore = true;
    };
  }, [formId]);

  if (!form && !error) return <p className="text-sm text-muted">Cargando formulario…</p>;
  if (!form) return <ErrorNote>{error}</ErrorNote>;

  const items = responses?.items || [];
  const recruitment = form.modality === "recruitment";

  return (
    <div>
      <Link href="/formularios" className="text-sm text-muted hover:text-ink">← Formularios</Link>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
            <StatusPill status={form.status} label={STATUS_LABELS[form.status]} />
          </div>
          <p className="mt-1 text-sm text-muted">{MODALITY_LABELS[form.modality]}{form.targetRole ? ` · ${form.targetRole}` : ""}</p>
        </div>
        <Link href={`/formularios/${formId}/editar`} className={btnPrimary}>Editar</Link>
      </div>
      <ErrorNote>{error}</ErrorNote>

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className={card}>
            <h2 className="text-base font-semibold">Información</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="Descripción" value={form.description || "Sin descripción."} wide />
              <Info label="Preguntas" value={String(form.questionCount || form.questions?.length || 0)} />
              <Info label="Versión publicada" value={form.publishedVersion ? `v${form.publishedVersion}` : "Todavía en borrador"} />
              <Info label="Apertura" value={form.opensAt ? formatDateTime(form.opensAt) : "Sin fecha"} />
              <Info label="Cierre" value={form.closesAt ? formatDateTime(form.closesAt) : "Sin fecha"} />
              <Info label="Identificación" value={recruitment ? "Pide nombre y correo" : "Anónima"} />
              {form.confirmationMessage ? <Info label="Mensaje al terminar" value={form.confirmationMessage} wide /> : null}
            </dl>
            {form.questions?.length ? (
              <ol className="mt-5 space-y-2 border-t border-line pt-4">
                {form.questions.map((question, index) => (
                  <li key={question.id} className="text-sm">
                    <span className="font-semibold text-brand">{index + 1}. </span>
                    {question.prompt || "Pregunta sin enunciado"}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-4 text-sm text-muted">Este formulario todavía no tiene preguntas.</p>}
          </section>

          <section id="respuestas" className={`${card} p-0`}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">Respuestas</h2>
              <p className="mt-1 text-sm text-muted">
                {responses === null
                  ? "Cargando respuestas…"
                  : items.length
                    ? `${responses.total} ${responses.total === 1 ? "envío" : "envíos"}. Abre cada fila para ver lo que contestaron.`
                    : "Todavía no hay respuestas."}
              </p>
            </div>
            {responses && items.length === 0 ? <Empty>Cuando alguien envíe el formulario, aparecerá aquí.</Empty> : null}
            {items.map((item) => (
              <details key={item.id} className="group border-b border-line last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.anonymous ? "Respuesta anónima" : item.name || "Sin nombre"}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {formatDateTime(item.submittedAt)}
                      {item.email ? ` · ${item.email}` : ""}
                      {item.areaName ? ` · ${item.areaName}` : ""}
                      {item.versionNumber ? ` · v${item.versionNumber}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-brand group-open:hidden">Ver</span>
                  <span className="hidden shrink-0 text-xs font-bold text-muted group-open:inline">Ocultar</span>
                </summary>
                <dl className="space-y-3 px-5 pb-4">
                  {item.answers.map((answer, index) => (
                    <div key={`${item.id}-${index}`}>
                      <dt className="text-sm font-semibold">{answer.prompt}</dt>
                      <dd className="mt-0.5 text-sm leading-6 text-ink">{answer.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
            {responses && responses.total > items.length ? (
              <p className="px-5 py-3 text-xs text-muted">Se muestran las {items.length} respuestas más recientes.</p>
            ) : null}
          </section>
        </div>

        <aside className={card}>
          <h2 className="text-base font-semibold">Compartir</h2>
          {form.links?.length ? (
            <div className="mt-4 space-y-4">
              {form.links.map((link) => (
                <div key={link.id}>
                  <Image src={`/api/links/${link.id}/qr`} alt="Código QR" width={140} height={140} unoptimized style={{ width: 140, height: 140 }} className="rounded-[12px] border border-line bg-white p-2" />
                  <p className="mt-3 text-sm font-semibold">{link.areaName || "Enlace público"}{link.versionNumber ? ` · v${link.versionNumber}` : ""}</p>
                  <p className="mt-1 break-all text-xs leading-5 text-muted">{link.url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btn} onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.url);
                        setCopiedId(link.id);
                      } catch {
                        setError("No se pudo copiar el enlace.");
                      }
                    }}>{copiedId === link.id ? "Copiado" : "Copiar"}</button>
                    <a className={btn} href={`/api/links/${link.id}/qr?download=1`}>Descargar QR</a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted">Este formulario sigue en borrador. Publícalo para obtener el enlace y el código QR.</p>
          )}
          {!form.publishedVersion ? <Link href={`/formularios/${formId}/editar?paso=publicar`} className={`${btnPrimary} mt-4`}>Ir a publicar</Link> : null}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value, wide = false }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm leading-6">{value}</dd>
    </div>
  );
}
