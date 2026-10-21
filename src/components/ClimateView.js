"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/domain/format";
import { api, downloadCsv } from "@/lib/client";
import { btn, card, fieldClass, labelClass } from "./styles";
import { Empty, ErrorNote, PageHeader } from "./ui";

export default function ClimateView({ initialFormId = "" }) {
  const [forms, setForms] = useState([]);
  const [areas, setAreas] = useState([]);
  const [formId, setFormId] = useState(initialFormId);
  const [versionId, setVersionId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/forms?modality=climate&limit=50"), api("/api/areas")])
      .then(([formData, areaData]) => {
        setForms(formData.items);
        setAreas(areaData.items);
        setFormId((current) => current || formData.items[0]?.id || "");
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (!formId) return;
    const params = new URLSearchParams({ formId });
    if (versionId) params.set("versionId", versionId);
    if (areaId) params.set("areaId", areaId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    let ignore = false;
    api(`/api/climate/results?${params.toString()}`)
      .then((data) => {
        if (!ignore) setResult(data);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      });
    return () => {
      ignore = true;
    };
  }, [areaId, formId, from, to, versionId]);

  async function exportCsv() {
    const params = new URLSearchParams({ formId });
    if (versionId || result?.versionId) params.set("versionId", versionId || result.versionId);
    if (areaId) params.set("areaId", areaId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      await downloadCsv(`/api/climate/export?${params.toString()}`, "maplasa-respuestas.csv");
    } catch (exportError) {
      setError(exportError.message);
    }
  }

  const responses = result?.responses || [];

  return (
    <div>
      <PageHeader
        eyebrow="Encuestas"
        title="Respuestas"
        subtitle="Cada tarjeta es un envío. Si la encuesta no pidió nombre, no hay nombre ni correo: solo la fecha, el área del enlace y lo que contestaron."
        actions={<button type="button" className={btn} disabled={!result?.responses} onClick={exportCsv}>Exportar CSV</button>}
      />
      <ErrorNote>{error}</ErrorNote>
      <div className={`${card} mb-4 grid gap-3 md:grid-cols-5`}>
        <label className="space-y-1.5"><span className={labelClass}>Formulario</span>
          <select className={fieldClass} value={formId} onChange={(event) => { setFormId(event.target.value); setVersionId(""); setResult(null); }}>
            <option value="">Elige una encuesta</option>
            {forms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
          </select>
        </label>
        <label className="space-y-1.5"><span className={labelClass}>Versión</span>
          <select className={fieldClass} value={versionId} onChange={(event) => { setVersionId(event.target.value); setResult(null); }}>
            <option value="">{result?.versions?.length > 1 ? "Elige versión" : "Única versión"}</option>
            {(result?.versions || []).map((version) => <option key={version.id} value={version.id}>Versión {version.versionNumber}</option>)}
          </select>
        </label>
        <label className="space-y-1.5"><span className={labelClass}>Área</span>
          <select className={fieldClass} value={areaId} onChange={(event) => { setAreaId(event.target.value); setResult(null); }}>
            <option value="">Todas</option>
            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </label>
        <label className="space-y-1.5"><span className={labelClass}>Desde</span><input type="date" className={fieldClass} value={from} onChange={(event) => { setFrom(event.target.value); setResult(null); }} /></label>
        <label className="space-y-1.5"><span className={labelClass}>Hasta</span><input type="date" className={fieldClass} value={to} onChange={(event) => { setTo(event.target.value); setResult(null); }} /></label>
      </div>
      {!result && formId ? <p className="mt-4 text-sm text-muted">Cargando respuestas…</p> : null}
      {result?.message && !result.responses ? <div className={`${card} mt-4`}><Empty>{result.message}</Empty></div> : null}
      {result?.responses && responses.length === 0 ? <div className={`${card} mt-4`}><Empty>Todavía no hay respuestas en este corte.</Empty></div> : null}
      {responses.length ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">{responses.length} {responses.length === 1 ? "respuesta" : "respuestas"}</p>
          {responses.map((response, index) => (
            <article key={response.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Respuesta {index + 1}</h2>
                <p className="text-sm text-muted">{formatDateTime(response.submittedAt)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">Anónima · {response.areaName}</p>
              <dl className="mt-4 space-y-3">
                {response.answers.map((answer, answerIndex) => (
                  <div key={`${response.id}-${answerIndex}`}>
                    <dt className="text-sm font-semibold">{answer.prompt}</dt>
                    <dd className="mt-0.5 text-sm leading-6">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
