"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REVIEW_LABELS } from "@/domain/constants";
import { formatScore } from "@/domain/scoring";
import { api } from "@/lib/client";
import { btn, btnPrimary, card } from "./styles";
import { Empty, ErrorNote, PageHeader, StatusPill } from "./ui";

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/dashboard").then(setData).catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <div>
      <PageHeader eyebrow="Plataforma de talento" title="Visión general" subtitle="Decisiones de talento con evidencia, no con suposiciones." />
      <ErrorNote>{error}</ErrorNote>
      <section className="mb-5 rounded-[18px] bg-gradient-to-r from-[#1a2c52] to-[#3156ad] p-6 text-white">
        <p className="text-[11px] tracking-[0.16em] text-[#aabfff]">EL TALENTO EMPIEZA ANTES DE CONTRATAR</p>
        <h2 className="mt-2 text-2xl font-semibold">Conoce las competencias detrás de cada candidato.</h2>
        <p className="mt-2 max-w-xl text-sm text-[#c8d7ff]">Configura preguntas, publica un enlace y revisa los resultados. La contratación sigue siendo una decisión humana.</p>
        <Link href="/formularios/nuevo" className={`${btn} mt-4`}>Crear formulario</Link>
      </section>
      {!data ? <p className="text-sm text-muted">Cargando indicadores…</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Candidatos evaluados" value={data.candidatesEvaluated} hint={`${data.applications} envíos`} />
            <Stat label="Formularios publicados" value={data.publishedForms} />
            <Stat label="Puntuación promedio" value={data.averageScore == null ? "Sin puntuación" : `${formatScore(data.averageScore)}/100`} />
            <Stat label="Pendientes de revisión" value={data.pendingReview} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <section className={card}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Candidatos recientes</h2>
                <Link href="/candidatos" className="text-sm font-bold text-brand">Ver todos</Link>
              </div>
              {data.recent.length === 0 ? <Empty>Todavía no hay evaluaciones enviadas.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted"><tr><th className="py-2">Candidato</th><th>Evaluación</th><th>Puntuación</th><th>Estado</th></tr></thead>
                    <tbody>
                      {data.recent.map((item) => (
                        <tr key={item.applicationId} className="border-t border-[#f0f2f6]">
                          <td className="py-3">
                            <Link href={item.candidateId ? `/candidatos/${item.candidateId}` : "/candidatos"} className="font-bold">{item.name}</Link>
                            <span className="block text-xs text-muted">{item.email}</span>
                          </td>
                          <td>{item.formTitle}</td>
                          <td className="font-bold">{item.globalScoreLabel}</td>
                          <td><StatusPill status={item.reviewStatus} label={REVIEW_LABELS[item.reviewStatus]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className={card}>
              <h2 className="text-lg font-semibold">Promedios por competencia</h2>
              <div className="mt-4 space-y-3">
                {data.competencies.length === 0 ? <Empty>Crea competencias para ver este resumen.</Empty> : data.competencies.map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex justify-between text-xs"><span>{item.name}</span><b>{item.averageLabel}{item.average == null ? "" : "/100"}</b></div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#edf0f6]"><div className="h-full bg-gradient-to-r from-[#6c8afc] to-[#335ce9]" style={{ width: `${item.average == null ? 0 : Math.round(item.average)}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl bg-[#f0f4ff] px-3 py-2 text-xs text-[#445779]">Los puntajes reflejan las reglas del formulario. No predicen personalidad ni permanencia.</p>
            </section>
          </div>
        </>
      )}
      <div className="mt-4 flex justify-end">
        <Link href="/formularios" className={btnPrimary}>Explorar formularios</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <article className={card}>
      <p className="text-xs text-muted">{label}</p>
      <strong className="mt-2 block text-3xl tracking-tight">{value}</strong>
      {hint ? <small className="text-good">{hint}</small> : null}
    </article>
  );
}
