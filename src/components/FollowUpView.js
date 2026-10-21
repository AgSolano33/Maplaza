"use client";

import { useEffect, useState } from "react";
import { EXIT_REASON_SUGGESTIONS, SITUATION_LABELS } from "@/domain/constants";
import { formatDate } from "@/domain/format";
import { api } from "@/lib/client";
import { btn, btnPrimary, card, fieldClass, labelClass } from "./styles";
import { Empty, ErrorNote, Notice, PageHeader, StatusPill } from "./ui";

const empty = { applicationId: "", startDate: "", situation: "active", exitDate: "", exitReason: "", notes: "" };

export default function FollowUpView() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function load() {
    return api("/api/follow-ups").then(setData).catch((loadError) => setError(loadError.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      if (editing) await api(`/api/follow-ups/${editing}`, { method: "PATCH", body: JSON.stringify(form) });
      else await api("/api/follow-ups", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      setEditing("");
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setPending(false);
    }
  }

  const summary = data?.summary;

  return (
    <div>
      <PageHeader eyebrow="Seguimiento" title="Permanencia y salidas" subtitle="Registra ingresos y salidas. Las cifras describen lo ocurrido; no predicen renuncias." />
      <ErrorNote>{error}</ErrorNote>
      {summary ? (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className={card}><p className="text-xs text-muted">Seguimientos</p><strong className="text-3xl">{summary.total}</strong></article>
          <article className={card}><p className="text-xs text-muted">Personal activo</p><strong className="text-3xl">{summary.active}</strong></article>
          <article className={card}><p className="text-xs text-muted">Salidas</p><strong className="text-3xl">{summary.exited}</strong></article>
          <article className={card}><p className="text-xs text-muted">Permanencia media al salir</p><strong className="text-3xl">{summary.averageTenureDaysExited == null ? "—" : Math.round(summary.averageTenureDaysExited)}</strong><small className="text-xs text-muted"> días</small></article>
        </div>
      ) : <p className="text-sm text-muted">Cargando seguimiento…</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className={card}>
          <h2 className="font-semibold">Motivos de salida</h2>
          {summary?.reasons?.length ? summary.reasons.map((item) => (
            <div key={item.reason} className="mt-3">
              <div className="mb-1 flex justify-between text-xs"><span>{item.reason}</span><b>{item.count}</b></div>
              <div className="h-2 rounded-full bg-[#edf0f6]"><div className="h-full rounded-full bg-brand" style={{ width: `${(item.count / Math.max(1, summary.exited)) * 100}%` }} /></div>
            </div>
          )) : <Empty>Sin salidas registradas.</Empty>}
          <div className="mt-4"><Notice>{summary?.notice}</Notice></div>
        </section>
        <form className={`${card} space-y-3`} onSubmit={save}>
          <h2 className="font-semibold">{editing ? "Editar seguimiento" : "Registrar seguimiento"}</h2>
          {!editing ? (
            <label className="block space-y-1.5">
              <span className={labelClass}>Contratación</span>
              <select className={fieldClass} value={form.applicationId} onChange={(event) => setForm({ ...form, applicationId: event.target.value })}>
                <option value="">Elige una postulación contratada</option>
                {(data?.pendingHires || []).map((item) => <option key={item.applicationId} value={item.applicationId}>{item.name} · {item.formTitle}</option>)}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5"><span className={labelClass}>Fecha de ingreso</span><input type="date" className={fieldClass} value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
            <label className="space-y-1.5"><span className={labelClass}>Situación</span>
              <select className={fieldClass} value={form.situation} onChange={(event) => setForm({ ...form, situation: event.target.value })}>
                <option value="active">Activo</option>
                <option value="exited">Salida</option>
              </select>
            </label>
          </div>
          {form.situation === "exited" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className={labelClass}>Fecha de salida</span><input type="date" className={fieldClass} value={form.exitDate} onChange={(event) => setForm({ ...form, exitDate: event.target.value })} /></label>
              <label className="space-y-1.5"><span className={labelClass}>Motivo</span>
                <input className={fieldClass} list="motivos-salida" value={form.exitReason} onChange={(event) => setForm({ ...form, exitReason: event.target.value })} />
                <datalist id="motivos-salida">{EXIT_REASON_SUGGESTIONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
              </label>
            </div>
          ) : null}
          <label className="block space-y-1.5"><span className={labelClass}>Observaciones internas</span><textarea className={`${fieldClass} min-h-20`} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <button className={btnPrimary} disabled={pending}>{pending ? "Guardando…" : "Guardar seguimiento"}</button>
        </form>
      </div>
      <section className={`${card} mt-4 overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Historial</h2>
        {data?.items?.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-2">Persona</th><th>Puntuación</th><th>Ingreso</th><th>Días</th><th>Situación</th><th>Motivo</th><th></th></tr></thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-[#f0f2f6]">
                  <td className="py-3"><b>{item.name}</b><span className="block text-xs text-muted">{item.formTitle}</span></td>
                  <td>{item.globalScoreLabel}</td>
                  <td>{formatDate(item.startDate)}</td>
                  <td>{item.tenureDays ?? "—"}</td>
                  <td><StatusPill status={item.situation} label={SITUATION_LABELS[item.situation]} /></td>
                  <td>{item.exitReason || "—"}</td>
                  <td><button type="button" className={btn} onClick={() => {
                    setEditing(item.id);
                    setForm({
                      applicationId: item.applicationId,
                      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
                      situation: item.situation,
                      exitDate: item.exitDate ? String(item.exitDate).slice(0, 10) : "",
                      exitReason: item.exitReason || "",
                      notes: item.notes || "",
                    });
                  }}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty>Cuando marques una postulación como contratada, podrás registrar aquí su permanencia.</Empty>}
      </section>
    </div>
  );
}
