"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_SCALE_LABELS, LIMITS, MODALITY_LABELS, QUESTION_LABELS } from "@/domain/constants";
import { orderedOptions, shuffleOrder } from "@/domain/options";
import { HEADER_SIZES, QUESTION_SIZES, TEXT_SIZES, THEME_FONTS, normalizeTextStyle, textStyle } from "@/domain/theme";
import { toPublicForm } from "@/domain/public-form";
import { normalizeDraft } from "@/domain/validators";
import { api } from "@/lib/client";
import { useUnsaved } from "./AppShell";
import PublicSurvey from "./PublicSurvey";
import { btn, btnPrimary, fieldClass } from "./styles";
import { ErrorNote, FieldError } from "./ui";
import ResponseReview from "./ResponseReview";
import ImageCropDialog from "./ImageCropDialog";

const STEPS = [
  { id: "crear", label: "Crear" },
  { id: "preguntas", label: "Preguntas" },
  { id: "configuracion", label: "Configuración" },
  { id: "diseno", label: "Diseño" },
  { id: "publicar", label: "Publicar" },
];

const QUESTION_TYPES = [
  { type: "short_text", title: "Respuesta corta", hint: "Una línea de texto." },
  { type: "long_text", title: "Párrafo", hint: "Un comentario más largo." },
  { type: "single", title: "Opción única", hint: "Una sola opción entre varias." },
  { type: "dropdown", title: "Lista", hint: "Una opción dentro de un menú." },
  { type: "multiple", title: "Varias opciones", hint: "Puede marcar más de una." },
  { type: "yes_no", title: "Sí o no", hint: "Solo acepta sí o no." },
  { type: "scale", title: "Escala", hint: "Valoración de 1 a 5 con etiquetas." },
  { type: "rating", title: "Estrellas", hint: "Una valoración de 1 a 5." },
  { type: "email", title: "Correo", hint: "Solo acepta un correo." },
  { type: "phone", title: "Teléfono", hint: "Solo acepta un teléfono." },
  { type: "number", title: "Número", hint: "Solo acepta números." },
  { type: "date", title: "Fecha", hint: "Solo acepta una fecha." },
  { type: "time", title: "Hora", hint: "Solo acepta una hora." },
  { type: "url", title: "Enlace", hint: "Solo acepta un enlace." },
];

const CHOICE_TYPES = ["single", "dropdown", "multiple"];
const LOCKED_TYPES = ["email", "phone", "number", "date", "time", "url"];

function starterOptions(recruitment) {
  return [
    { id: crypto.randomUUID(), label: "", score: 0 },
    { id: crypto.randomUUID(), label: "", score: 0 },
  ];
}

function blankQuestion(type, modality) {
  const recruitment = modality === "recruitment";
  return {
    id: crypto.randomUUID(),
    type,
    prompt: "",
    required: false,
    scored: false,
    shuffleOptions: false,
    competencyId: "",
    options: CHOICE_TYPES.includes(type) ? starterOptions(recruitment) : [],
    scaleLabels: [...DEFAULT_SCALE_LABELS],
  };
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromForm(form) {
  return {
    title: form.title || "",
    description: form.description || "",
    modality: form.modality || "recruitment",
    targetRole: form.targetRole || "",
    instructions: form.instructions || "",
    confirmationMessage: form.confirmationMessage || "",
    showScore: Boolean(form.showScore),
    opensAt: toInputDate(form.opensAt),
    closesAt: toInputDate(form.closesAt),
    appearance: {
      primaryColor: form.appearance?.primaryColor || "#315ce8",
      backgroundColor: form.appearance?.backgroundColor || "#f5f7fb",
      ...normalizeTextStyle(form.appearance),
      logo: form.appearance?.logo || "",
      cover: form.appearance?.cover || "",
      poster: form.appearance?.poster || "",
    },
    questions: (form.questions || []).map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt || "",
      required: Boolean(question.required),
      scored: Boolean(question.scored) || (question.type === "single" && Boolean(question.competencyId)),
      shuffleOptions: Boolean(question.shuffleOptions),
      competencyId: question.competencyId || "",
      options: (question.options || []).map((option) => ({
        id: option.id,
        label: option.label || "",
        score: typeof option.score === "number" ? option.score : 0,
      })),
      scaleLabels: question.scaleLabels?.length === 5 ? question.scaleLabels : [...DEFAULT_SCALE_LABELS],
    })),
  };
}

function toPayload(draft) {
  const recruitment = draft.modality === "recruitment";
  return {
    ...draft,
    opensAt: draft.opensAt ? new Date(draft.opensAt).toISOString() : null,
    closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : null,
    questions: draft.questions.map((question) => ({
      ...question,
      scored: question.type === "single" && question.scored,
      competencyId: question.type === "single" && question.scored ? question.competencyId || null : null,
      required: question.type === "single" && question.scored ? true : question.required,
      shuffleOptions: CHOICE_TYPES.includes(question.type) && question.shuffleOptions === true,
      options: CHOICE_TYPES.includes(question.type) ? question.options : [],
      scaleLabels: question.type === "scale" ? question.scaleLabels : [],
    })),
  };
}

function publishLabel(meta, pendingChanges) {
  if (meta?.status === "archived") return "Archivado";
  const live = meta?.status === "published" || meta?.status === "closed";
  if (!live) return "Publicar";
  if (pendingChanges || meta?.hasUnpublishedChanges) return "Publicar cambios";
  if (meta?.status === "closed") return "Cerrado";
  return "Publicado";
}

export default function FormEditor({ formId }) {
  const router = useRouter();
  const { setDirty } = useUnsaved();
  const [meta, setMeta] = useState(null);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState("");
  const [competencies, setCompetencies] = useState([]);
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [step, setStep] = useState("preguntas");
  const [selectedId, setSelectedId] = useState("");
  const [linkArea, setLinkArea] = useState("");
  const [linkVersion, setLinkVersion] = useState("");
  const [viewport, setViewport] = useState("desktop");
  const [publishOpen, setPublishOpen] = useState(false);
  const [panel, setPanel] = useState("preguntas");
  const [themeOpen, setThemeOpen] = useState(false);
  const [cropRequest, setCropRequest] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const past = useRef([]);
  const future = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const latest = useRef(null);
  const saving = useRef(false);
  const baselineRef = useRef("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [competencyData, areaData, form, responseData] = await Promise.all([
          api("/api/competencies"),
          api("/api/areas"),
          api(`/api/forms/${formId}`),
          api(`/api/forms/${formId}/responses`).catch(() => ({ total: 0 })),
        ]);
        if (ignore) return;
        setResponseCount(responseData.total || 0);
        const next = fromForm(form);
        const serialized = JSON.stringify(next);
        setCompetencies(competencyData.items || []);
        setAreas(areaData.items || []);
        setMeta(form);
        setDraft(next);
        setBaseline(serialized);
        baselineRef.current = serialized;
        latest.current = next;
        setLinkVersion(form.versions?.[0]?.id || "");
        const paso = new URLSearchParams(window.location.search).get("paso");
        if (paso === "respuestas") setPanel("respuestas");
        else if (paso === "configuracion" || paso === "diseno" || paso === "publicar" || paso === "crear") setPanel("configuracion");
        if (STEPS.some((item) => item.id === paso)) setStep(paso);
      } catch (loadError) {
        if (!ignore) setError(loadError.message);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [formId]);

  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  useEffect(() => {
    setDirty(Boolean(draft) && baseline !== "" && JSON.stringify(draft) !== baseline);
    return () => setDirty(false);
  }, [baseline, draft, setDirty]);

  useEffect(() => {
    const onHide = () => {
      const snapshot = latest.current;
      if (!snapshot || JSON.stringify(snapshot) === baselineRef.current || meta?.status === "archived") return;
      fetch(`/api/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(snapshot)),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [formId, meta?.status]);

  async function persist() {
    if (saving.current) await saving.current.catch(() => {});
    const snapshot = latest.current;
    if (!snapshot) return false;
    if (meta?.status === "archived") return true;
    const serialized = JSON.stringify(snapshot);
    if (serialized === baselineRef.current) return true;
    let finish = () => {};
    const job = new Promise((resolve) => {
      finish = resolve;
    });
    saving.current = job;
    setPending(true);
    try {
      const saved = await api(`/api/forms/${formId}`, { method: "PATCH", body: JSON.stringify(toPayload(snapshot)) });
      if (JSON.stringify(latest.current) === serialized) {
        baselineRef.current = serialized;
        setBaseline(serialized);
        setError("");
        setMeta((current) => current ? {
          ...current,
          hasUnpublishedChanges: Boolean(saved?.hasUnpublishedChanges),
          status: saved?.status || (current.publishedVersion > 0 ? current.status : "draft"),
          title: saved?.title || snapshot.title,
        } : current);
      }
      return true;
    } catch (saveError) {
      setError(saveError.message);
      focusFieldErrors(saveError.fields || {});
      return false;
    } finally {
      setPending(false);
      if (saving.current === job) saving.current = null;
      finish();
    }
  }

  async function refreshMeta() {
    const form = await api(`/api/forms/${formId}`);
    setMeta(form);
  }

  async function refresh() {
    const form = await api(`/api/forms/${formId}`);
    const next = fromForm(form);
    const serialized = JSON.stringify(next);
    setMeta(form);
    setDraft(next);
    latest.current = next;
    setBaseline(serialized);
    baselineRef.current = serialized;
    setLinkVersion(form.versions?.[0]?.id || "");
  }

  function focusFieldErrors(nextFields) {
    const key = Object.keys(nextFields).find((item) => item.startsWith("questions."));
    if (key) {
      showPanel("preguntas");
      const index = Number(key.split(".")[1]);
      const question = latest.current?.questions?.[index];
      if (question) setSelectedId(question.id);
      return;
    }
    if (nextFields.logo || nextFields.cover || nextFields.poster || nextFields.primaryColor || nextFields.targetRole || nextFields.closesAt || nextFields.opensAt || nextFields.confirmationMessage || nextFields.instructions) {
      showPanel("configuracion");
    }
  }

  function showIssues(message, nextFields) {
    setPublishOpen(false);
    setError(message || "");
    focusFieldErrors(nextFields || {});
  }

  async function act(path) {
    const snapshot = latest.current;
    if (!snapshot) return;
    setMenu(false);
    setPending(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(toPayload(snapshot)) });
      await refresh();
      setPublishOpen(false);
      setError("");
    } catch (actionError) {
      showIssues(actionError.message, actionError.fields || {});
    } finally {
      setPending(false);
    }
  }

  function updateDraft(next) {
    setDraftSaved(false);
    setDraft((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (current) {
        past.current.push(current);
        if (past.current.length > 40) past.current.shift();
        future.current = [];
      }
      latest.current = resolved;
      return resolved;
    });
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    if (!draft || past.current.length === 0) return;
    setDraftSaved(false);
    future.current.push(draft);
    const previous = past.current.pop();
    latest.current = previous;
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
    setDraft(previous);
  }

  function redo() {
    if (!draft || future.current.length === 0) return;
    setDraftSaved(false);
    past.current.push(draft);
    const next = future.current.pop();
    latest.current = next;
    setCanUndo(true);
    setCanRedo(future.current.length > 0);
    setDraft(next);
  }

  async function copyLink() {
    const url = meta?.links?.[0]?.url;
    if (!url) {
      setError("Publica el formulario para copiar el enlace.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  async function addCompetency(name) {
    const created = await api("/api/competencies", { method: "POST", body: JSON.stringify({ name }) });
    setCompetencies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, "es")));
    return created;
  }

  function startCrop(file, field) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Usa una imagen PNG o JPG.");
      return;
    }
    if (file.size > 12_000_000) {
      setError("La imagen pesa demasiado. Elige una de menos de 12 MB.");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    setCropRequest((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return {
        url,
        field,
        aspect: field === "logo" ? 1 : field === "poster" ? 16 / 9 : 4,
        maxEdge: field === "logo" ? 480 : 1600,
        title: field === "logo" ? "Recortar logo" : field === "poster" ? "Recortar portada" : "Recortar encabezado",
      };
    });
  }

  function closeCrop() {
    setCropRequest((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function confirmCrop(blob) {
    const request = cropRequest;
    if (!request) return;
    const body = new FormData();
    body.append("file", blob, "imagen.jpg");
    const response = await fetch("/api/uploads", { method: "POST", body, credentials: "same-origin" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.url) throw new Error(data?.error?.message || "No se pudo guardar la imagen.");
    const current = latest.current;
    if (!current) throw new Error("No se pudo guardar la imagen.");
    const next = {
      ...current,
      appearance: { ...(current.appearance || {}), [request.field]: data.url },
    };
    latest.current = next;
    updateDraft(next);
    const stored = await persist();
    if (!stored) throw new Error("La imagen se subió, pero no quedó guardada en el formulario.");
    URL.revokeObjectURL(request.url);
    setCropRequest(null);
  }

  function showPanel(next) {
    setPanel(next);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  async function saveDraft() {
    const stored = await persist();
    if (stored && JSON.stringify(latest.current) === baselineRef.current) setDraftSaved(true);
  }

  async function leave() {
    const stored = await persist();
    if (!stored) return;
    setDirty(false);
    router.push("/formularios");
  }

  const publishIssues = useMemo(() => (draft ? normalizeDraft(toPayload(draft), { strict: true }).errors : {}), [draft]);

  if (!draft && !error) return <p className="text-sm text-muted">Cargando formulario…</p>;
  if (!draft) return <ErrorNote>{error}</ErrorNote>;

  const lockedModality = (meta?.publishedVersion || 0) > 0;
  const dirty = JSON.stringify(draft) !== baseline;
  const linkOutOfDate = (meta?.links || []).some((item) => item.versionNumber && item.versionNumber !== meta.publishedVersion);
  const publishDisabled = pending || meta?.status === "archived" || (meta?.publishedVersion > 0 && !meta?.hasUnpublishedChanges && !dirty && !linkOutOfDate);

  const tabs = [
    { id: "preguntas", label: "Preguntas" },
    { id: "respuestas", label: `Respuestas (${responseCount})` },
    { id: "configuracion", label: "Configuración" },
  ];

  return (
    <div>
      <header className="sticky top-0 z-30 -mx-4 bg-canvas px-4 pt-5 pb-2 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/formularios" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <span aria-hidden="true">←</span>
            Formularios
          </Link>
          <input
            className="h-10 min-w-[12rem] flex-1 rounded-[8px] border border-transparent bg-transparent px-2 text-lg font-semibold outline-none placeholder:text-[#b7c0d0] hover:border-line focus:border-brand focus:bg-white"
            maxLength={LIMITS.title}
            placeholder="Título del formulario"
            value={draft.title}
            onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
          />
          <div className="flex items-center gap-1">
            <IconTool label="Tema" pressed={themeOpen} onClick={() => { setPreviewOpen(false); setThemeOpen((open) => !open); }}><PaletteIcon /></IconTool>
            <IconTool label="Vista previa" pressed={previewOpen} onClick={() => { setThemeOpen(false); setPreviewOpen(true); }}><EyeIcon /></IconTool>
            <IconTool label="Deshacer" disabled={!canUndo} onClick={undo}><UndoIcon /></IconTool>
            <IconTool label="Rehacer" disabled={!canRedo} onClick={redo}><RedoIcon /></IconTool>
            <ShareMenu links={meta?.links || []} onError={setError} />
            <button type="button" className={`${btn} ml-2`} disabled={pending || meta?.status === "archived"} onClick={saveDraft}>
              {pending ? "Guardando…" : draftSaved ? "Guardado" : "Guardar borrador"}
            </button>
            <button type="button" className={btnPrimary} onClick={() => setPublishOpen(true)}>
              {publishLabel(meta, dirty || linkOutOfDate)}
            </button>
          </div>
        </div>
        <nav className="mt-5 flex justify-center gap-8 border-b border-line">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => showPanel(tab.id)}
              className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold ${panel === tab.id ? "border-brand text-brand" : "border-transparent text-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mt-6 flex items-start gap-4">
        <div className="min-w-0 flex-1 rounded-[16px] px-1 py-6 sm:px-3" style={{ background: hexColor(draft.appearance?.backgroundColor, "#f5f7fb") }}>
          {panel === "preguntas" ? (
            <QuestionsTab
              draft={draft}
              fields={publishIssues}
              competencies={competencies}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={updateDraft}
              onAddCompetency={addCompetency}
            />
          ) : null}
          {panel === "respuestas" ? <ResponsesPanel formId={formId} onCount={setResponseCount} background={draft.appearance?.backgroundColor} /> : null}
          {panel === "configuracion" ? (
            <ConfigPanel
              draft={draft}
              fields={publishIssues}
              meta={meta}
              formId={formId}
              lockedModality={lockedModality}
            onChange={updateDraft}
            onPickImage={startCrop}
            onRefreshMeta={refreshMeta}
            onError={setError}
          />
          ) : null}
        </div>
        {themeOpen || Object.keys(publishIssues).length ? (
          <div className="sticky top-36 flex max-h-[calc(100vh-10rem)] w-full shrink-0 flex-col gap-4 overflow-y-auto lg:w-[320px]">
            {Object.keys(publishIssues).length ? (
              <IssuePanel
                fields={publishIssues}
                questions={draft.questions}
                onJump={(key) => {
                  focusFieldErrors({ [key]: true });
                  const match = /^questions\.(\d+)/.exec(key);
                  if (!match) return;
                  const question = draft.questions[Number(match[1])];
                  if (!question) return;
                  setSelectedId(question.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`question-${question.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  });
                }}
              />
            ) : null}
            {themeOpen ? <ThemePanel draft={draft} onChange={updateDraft} onPickImage={startCrop} onClose={() => setThemeOpen(false)} /> : null}
          </div>
        ) : null}
      </div>
      {previewOpen ? <FormPreview draft={draft} onClose={() => setPreviewOpen(false)} onCopy={copyLink} copied={copiedLink} published={meta?.status === "published" || meta?.status === "closed"} /> : null}
      {publishOpen ? (
        <PublishModal
          draft={draft}
          fields={publishIssues}
          error={error}
          meta={meta}
          pending={pending}
          publishDisabled={publishDisabled}
          lockedModality={lockedModality}
          onChange={updateDraft}
          formId={formId}
          onClose={() => setPublishOpen(false)}
          onPublish={() => act(`/api/forms/${formId}/publish`)}
          onRefreshMeta={refreshMeta}
          onError={setError}
          onPickImage={startCrop}
        />
      ) : null}
      {cropRequest ? (
        <ImageCropDialog
          src={cropRequest.url}
          title={cropRequest.title}
          aspect={cropRequest.aspect}
          maxEdge={cropRequest.maxEdge}
          onCancel={closeCrop}
          onConfirm={confirmCrop}
        />
      ) : null}

    </div>
  );
}

function ResponsesPanel({ formId, onCount, background }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    api(`/api/forms/${formId}/responses`)
      .then((response) => {
        if (ignore) return;
        setData(response);
        onCount(response.total || 0);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      });
    return () => {
      ignore = true;
    };
  }, [formId, onCount]);
  if (data === null && !error) return <p className="text-sm text-muted">Cargando respuestas…</p>;
  return <ResponseReview items={data?.items || []} total={data?.total || 0} error={error} pin="top-[8.75rem]" background={background} />;
}

function ConfigPanel({ draft, fields, meta, formId, lockedModality, onChange, onPickImage, onRefreshMeta, onError }) {
  const recruitment = draft.modality === "recruitment";
  const appearance = draft.appearance || { primaryColor: "#315ce8", logo: "", cover: "" };
  const [schedule, setSchedule] = useState(Boolean(draft.closesAt));
  const [toggling, setToggling] = useState(false);
  const live = meta?.status === "published" || meta?.status === "closed";
  function update(patch) {
    onChange({ ...draft, ...patch });
  }
  function updateAppearance(patch) {
    onChange({ ...draft, appearance: { ...appearance, ...patch } });
  }
  async function toggleResponses() {
    setToggling(true);
    try {
      await api(`/api/forms/${formId}/${meta?.status === "published" ? "close" : "reopen"}`, { method: "POST" });
      await onRefreshMeta();
    } catch (toggleError) {
      onError(toggleError.message);
    } finally {
      setToggling(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <section className="rounded-[8px] border border-line bg-white px-6 shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.04)]">
        <h2 className="border-b border-line py-4 text-lg font-semibold">Configuración</h2>
        <div className="divide-y divide-line">
          <div className="py-4">
            <h3 className="text-sm font-semibold">Quién puede responder</h3>
            <div className="mt-3 grid gap-2">
              <AccessChoice title="Pública" text="Cualquier persona con el enlace. No pide nombre ni correo." selected={!recruitment} disabled={lockedModality} onClick={() => update({ modality: "climate", targetRole: "", showScore: false })} />
              <AccessChoice title="Privada" text="Cualquier persona con el enlace, pero pide nombre y correo. Las respuestas quedan identificadas." selected={recruitment} disabled={lockedModality} onClick={() => update({ modality: "recruitment" })} />
            </div>
            {lockedModality ? <p className="mt-2 text-xs text-muted">Esto queda fijo después de la primera publicación.</p> : null}
            {recruitment ? (
              <label className="mt-3 block space-y-1.5">
                <span className="text-sm font-semibold">Puesto que se está evaluando</span>
                <input className={fieldClass} maxLength={LIMITS.role} value={draft.targetRole} onChange={(event) => update({ targetRole: event.target.value })} placeholder="Operador de producción" />
                <FieldError>{fields.targetRole}</FieldError>
              </label>
            ) : null}
          </div>
          <div className="py-4">
            <h3 className="text-sm font-semibold">Respuestas</h3>
            <div className="mt-3 grid gap-2">
              <AccessChoice title="Siempre disponible" text="El enlace recibe respuestas hasta que lo cierres." selected={!schedule} onClick={() => { setSchedule(false); update({ opensAt: "", closesAt: "" }); }} />
              <AccessChoice title="Fecha de cierre" text="Después de esa fecha el enlace deja de recibir respuestas." selected={schedule} onClick={() => setSchedule(true)} />
            </div>
            {schedule ? (
              <label className="mt-3 block space-y-1.5">
                <span className="text-sm font-semibold">Cierra el</span>
                <input type="datetime-local" className={fieldClass} value={draft.closesAt} onChange={(event) => update({ closesAt: event.target.value })} />
                <FieldError>{fields.closesAt}</FieldError>
              </label>
            ) : null}
            {live ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Se aceptan respuestas</span>
                <button type="button" role="switch" aria-label="Se aceptan respuestas" aria-checked={meta?.status === "published"} disabled={toggling} onClick={toggleResponses} className={`relative h-6 w-11 shrink-0 rounded-full disabled:opacity-70 ${meta?.status === "published" ? "bg-brand" : "bg-[#d5dbe6]"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${meta?.status === "published" ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ) : null}
          </div>
          <div className="py-4">
            <h3 className="text-sm font-semibold">Presentación</h3>
            <p className="mt-1 text-xs leading-5 text-muted">La portada abre el formulario, con el título y la descripción. El encabezado del cuestionario se elige en el tema.</p>
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold">Logo</span>
                <span className="flex items-center gap-2">
                  {appearance.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appearance.logo} alt="Logo" className="h-10 w-10 rounded-[8px] object-contain" />
                  ) : <span className="grid h-10 w-10 place-items-center rounded-[8px] text-sm font-black text-white" style={{ background: /^#[0-9a-fA-F]{6}$/.test(appearance.primaryColor) ? appearance.primaryColor : "#315ce8" }}>M</span>}
                  <label className={`${btn} cursor-pointer`}>
                    {appearance.logo ? "Cambiar" : "Subir"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseFile(event, onPickImage, "logo")} />
                  </label>
                  {appearance.logo ? <button type="button" className={btn} onClick={() => updateAppearance({ logo: "" })}>Quitar</button> : null}
                </span>
              </div>
              <FieldError>{fields.logo}</FieldError>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold">Portada</span>
                <span className="flex items-center gap-2">
                  {appearance.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appearance.poster} alt="Portada" className="h-10 w-16 rounded-[8px] object-cover" />
                  ) : null}
                  <label className={`${btn} cursor-pointer`}>
                    {appearance.poster ? "Cambiar" : "Subir"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseFile(event, onPickImage, "poster")} />
                  </label>
                  {appearance.poster ? <button type="button" className={btn} onClick={() => updateAppearance({ poster: "" })}>Quitar</button> : null}
                </span>
              </div>
              <FieldError>{fields.poster}</FieldError>
            </div>
          </div>
          {recruitment ? (
            <div className="py-4">
              <h3 className="text-sm font-semibold">Resultado al terminar</h3>
              <div className="mt-3 grid gap-2">
                <AccessChoice title="Solo el mensaje" text="La persona no ve cuántos puntos obtuvo." selected={!draft.showScore} onClick={() => update({ showScore: false })} />
                <AccessChoice title="Mostrar el puntaje" text="Al terminar ve su resultado sobre 100, además del mensaje." selected={Boolean(draft.showScore)} onClick={() => update({ showScore: true })} />
              </div>
            </div>
          ) : null}
          <label className="block py-4">
            <span className="text-sm font-semibold">Mensaje al enviar</span>
            <textarea className={`${fieldClass} mt-2 min-h-20`} maxLength={LIMITS.confirmation} value={draft.confirmationMessage} onChange={(event) => update({ confirmationMessage: event.target.value })} placeholder="Gracias por participar. Tu respuesta fue enviada." />
          </label>
        </div>
      </section>
    </div>
  );
}

function hexColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
}

function tintColor(value) {
  const hex = hexColor(value, "#315ce8").slice(1);
  const channels = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * 0.86));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function readableInk(value) {
  const hex = hexColor(value, "#315ce8").slice(1);
  const channels = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const light = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return light > 165 ? "#172338" : "#ffffff";
}

function GrowingField({ value, onChange, className, style, placeholder, maxLength }) {
  const ref = useRef(null);
  const fontSize = style?.fontSize || "";
  const fontFamily = style?.fontFamily || "";
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [value, fontSize, fontFamily]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      style={style}
      placeholder={placeholder}
      maxLength={maxLength}
      value={value}
      onChange={onChange}
    />
  );
}

function editorFace(style, minPx) {
  const size = Number.parseFloat(style?.fontSize);
  return {
    fontFamily: style?.fontFamily,
    fontSize: `${Math.max(Number.isFinite(size) ? size : minPx, minPx)}px`,
  };
}

const THEME_COLORS = ["#e23b3b", "#7b3ff2", "#315ce8", "#1a8fd0", "#12b5c9", "#f07820", "#e0a020", "#1f9d6a", "#5f6b7c", "#9aa3b2"];

function IconTool({ label, pressed, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`grid h-10 w-10 place-items-center rounded-full ${pressed ? "bg-[#e7eefc] text-brand" : "text-[#3c4758] hover:bg-[#f4f7fb]"} disabled:opacity-30`}>
      {children}
    </button>
  );
}

const ISSUE_LABELS = {
  title: "Título",
  modality: "Tipo de formulario",
  targetRole: "Puesto",
  opensAt: "Fecha de apertura",
  closesAt: "Fecha de cierre",
  logo: "Logo",
  cover: "Encabezado",
  poster: "Portada",
  primaryColor: "Color",
  backgroundColor: "Fondo",
  confirmationMessage: "Mensaje al enviar",
  instructions: "Instrucciones",
  questions: "Preguntas",
};

const QUESTION_ISSUE = {
  prompt: "Enunciado",
  options: "Opciones",
  score: "Puntos",
  competencyId: "Competencia",
  scaleLabels: "Escala",
  type: "Tipo",
};

function issueTitle(key, questions) {
  const match = /^questions\.(\d+)\.(\w+)$/.exec(key);
  if (!match) return ISSUE_LABELS[key] || "Formulario";
  const question = questions[Number(match[1])];
  const name = question?.prompt?.trim() || `Pregunta ${Number(match[1]) + 1}`;
  return `${QUESTION_ISSUE[match[2]] || "Pregunta"} · ${name}`;
}

function IssuePanel({ fields, questions, onJump }) {
  const entries = Object.entries(fields);
  return (
    <aside className="shrink-0 rounded-[12px] border border-[#ffd0d0] bg-white shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.06)]">
      <div className="border-b border-[#ffd0d0] px-4 py-3">
        <h2 className="text-base font-semibold text-[#9b3b3b]">Para publicar</h2>
        <p className="mt-1 text-sm leading-5 text-[#9b3b3b]">Estos puntos siguen pendientes. Al corregirlos, desaparecen.</p>
      </div>
      {entries.length ? (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto p-2">
          {entries.map(([key, message]) => (
            <li key={key}>
              <button type="button" className="w-full rounded-[8px] px-3 py-2 text-left hover:bg-[#fff5f5]" onClick={() => onJump(key)}>
                <span className="block text-sm font-semibold">{issueTitle(key, questions)}</span>
                <span className="mt-0.5 block text-sm leading-5 text-[#9b3b3b]">{message}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function ThemePanel({ draft, onChange, onPickImage, onClose }) {
  const appearance = { primaryColor: "#315ce8", backgroundColor: "#f5f7fb", logo: "", cover: "", ...normalizeTextStyle(draft.appearance), ...(draft.appearance || {}) };
  const color = hexColor(appearance.primaryColor, "#315ce8").toLowerCase();
  const background = hexColor(appearance.backgroundColor, "#f5f7fb").toLowerCase();
  const [customColors, setCustomColors] = useState([]);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  function updateAppearance(patch) {
    onChange({ ...draft, appearance: { ...appearance, ...patch } });
  }
  const accents = uniqueHexes([...THEME_COLORS, ...customColors, color]);
  const fondos = uniqueHexes([...THEME_COLORS.map((item) => tintColor(item)), ...customBackgrounds, background]);
  function chooseAccent(value) {
    const next = value.toLowerCase();
    const preset = THEME_COLORS.includes(next);
    if (!preset) setCustomColors((current) => current.includes(next) ? current : [...current, next]);
    updateAppearance(preset ? { primaryColor: next, backgroundColor: tintColor(next) } : { primaryColor: next });
  }
  function chooseBackground(value) {
    const next = value.toLowerCase();
    if (!THEME_COLORS.some((item) => tintColor(item) === next)) {
      setCustomBackgrounds((current) => current.includes(next) ? current : [...current, next]);
    }
    updateAppearance({ backgroundColor: next });
  }
  return (
    <aside className="flex max-h-[calc(100vh-12rem)] w-full shrink-0 flex-col overflow-hidden rounded-[12px] border border-line bg-white shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.06)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-semibold"><PaletteIcon /> Tema</h2>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-lg text-muted hover:bg-[#f4f7fb]" onClick={onClose} aria-label="Cerrar tema">×</button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div>
          <p className="text-sm font-semibold">Estilo de texto</p>
          <StyleRow label="Encabezado" font={appearance.headerFont} size={appearance.headerSize} sizes={HEADER_SIZES} onFont={(headerFont) => updateAppearance({ headerFont })} onSize={(headerSize) => updateAppearance({ headerSize })} />
          <StyleRow label="Pregunta" font={appearance.questionFont} size={appearance.questionSize} sizes={QUESTION_SIZES} onFont={(questionFont) => updateAppearance({ questionFont })} onSize={(questionSize) => updateAppearance({ questionSize })} />
          <StyleRow label="Texto" font={appearance.textFont} size={appearance.textSize} sizes={TEXT_SIZES} onFont={(textFont) => updateAppearance({ textFont })} onSize={(textSize) => updateAppearance({ textSize })} />
        </div>
        <div className="border-t border-line pt-5">
          <p className="text-sm font-semibold">Encabezado</p>
          <p className="mt-1 text-xs text-muted">La imagen queda arriba del formulario.</p>
          {appearance.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={appearance.cover} alt="Encabezado" className="mt-3 h-20 w-full rounded-[8px] object-cover" />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`${btn} cursor-pointer`}>
              {appearance.cover ? "Cambiar imagen" : "Seleccionar imagen"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseFile(event, onPickImage, "cover")} />
            </label>
            {appearance.cover ? <button type="button" className={btn} onClick={() => updateAppearance({ cover: "" })}>Quitar</button> : null}
          </div>
        </div>
        <div className="border-t border-line pt-5">
          <p className="text-sm font-semibold">Color</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {accents.map((item) => (
              <button key={item} type="button" aria-label={item} className="grid h-8 w-8 place-items-center rounded-full border border-black/10" style={{ background: item }} onClick={() => chooseAccent(item)}>
                {color === item ? <span className="text-sm" style={{ color: readableInk(item) }}>✓</span> : null}
              </button>
            ))}
            <AddColor label="Agregar color" value={color} onPick={chooseAccent} />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Fondo</p>
          <p className="mt-1 text-xs text-muted">Es el mismo color, más claro. Puedes cambiarlo si quieres otro.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {fondos.map((item) => (
              <button key={item} type="button" aria-label={item} className="grid h-8 w-8 place-items-center rounded-full border border-black/10" style={{ background: item }} onClick={() => chooseBackground(item)}>
                {background === item ? <span className="text-sm" style={{ color: readableInk(item) }}>✓</span> : null}
              </button>
            ))}
            <AddColor label="Agregar fondo" value={background} onPick={chooseBackground} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function hexToHsv(value) {
  const raw = hexColor(value, "#315ce8").slice(1);
  const channels = [0, 2, 4].map((start) => Number.parseInt(raw.slice(start, start + 2), 16) / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === channels[0]) hue = ((channels[1] - channels[2]) / delta) % 6;
    else if (max === channels[1]) hue = (channels[2] - channels[0]) / delta + 2;
    else hue = (channels[0] - channels[1]) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToHex(h, s, v) {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];
  const channel = (part) => Math.round((part + m) * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function AddColor({ label, value, onPick }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  function openPicker() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 232;
    const height = 292;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const above = rect.top - height - 8;
    setPlace({ left, top: above >= 8 ? above : rect.bottom + 8 });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (buttonRef.current?.contains(event.target) || popoverRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <>
      <button ref={buttonRef} type="button" className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-[#c5cedd] text-lg leading-none text-muted" title={label} aria-label={label} aria-expanded={open} onClick={() => (open ? setOpen(false) : openPicker())}>+</button>
      {open && place ? createPortal(
        <ColorPopover popoverRef={popoverRef} place={place} value={value} onPick={onPick} onClose={() => setOpen(false)} />,
        document.body,
      ) : null}
    </>
  );
}

function ColorPopover({ popoverRef, place, value, onPick, onClose }) {
  const initial = hexColor(value, "#315ce8").toLowerCase();
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [hex, setHex] = useState(initial);
  const padRef = useRef(null);
  function apply(next) {
    setHsv(next);
    setHex(hsvToHex(next.h, next.s, next.v));
  }
  function confirm() {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const next = hex.toLowerCase();
    if (next !== initial) onPick(next);
    onClose();
  }
  function pickAt(event) {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height));
    apply({ ...hsv, s, v });
  }
  return (
    <div ref={popoverRef} className="fixed z-50 w-[232px] rounded-[14px] border border-line bg-white p-3 shadow-[0_18px_50px_rgba(17,28,50,0.18)]" style={{ left: place.left, top: place.top }}>
      <div
        ref={padRef}
        className="relative h-32 cursor-crosshair rounded-[10px]"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) pickAt(event);
        }}
      >
        <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <input
        aria-label="Tono"
        className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full"
        type="range"
        min="0"
        max="360"
        value={Math.round(hsv.h)}
        style={{ background: "linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" }}
        onChange={(event) => apply({ ...hsv, h: Number(event.target.value) })}
      />
      <div className="mt-3 flex items-center gap-2">
        <span className="h-11 w-11 shrink-0 rounded-[10px] border border-line" style={{ background: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : hsvToHex(hsv.h, hsv.s, hsv.v) }} aria-hidden="true" />
        <input
          aria-label="Código de color"
          className={`${fieldClass} font-mono uppercase`}
          maxLength={7}
          value={hex}
          onChange={(event) => {
            const next = event.target.value;
            setHex(next);
            if (/^#[0-9a-fA-F]{6}$/.test(next)) setHsv(hexToHsv(next));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") confirm();
          }}
        />
      </div>
      <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={confirm}>Usar</button>
    </div>
  );
}

function uniqueHexes(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const hex = String(item).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    result.push(hex);
  }
  return result;
}

function StyleRow({ label, font, size, sizes, onFont, onSize }) {
  return (
    <div className="mt-3">
      <p className="text-sm">{label}</p>
      <div className="mt-1.5 flex gap-2">
        <select className="h-10 min-w-0 flex-1 rounded-[6px] border border-line bg-white px-2 text-sm" value={font} onChange={(event) => onFont(event.target.value)} aria-label={`Fuente de ${label}`}>
          {THEME_FONTS.map((item) => <option key={item.id} value={item.id} style={{ fontFamily: item.family }}>{item.id}</option>)}
        </select>
        <select className="h-10 w-[4.5rem] rounded-[6px] border border-line bg-white px-2 text-sm" value={size} onChange={(event) => onSize(Number(event.target.value))} aria-label={`Tamaño de ${label}`}>
          {sizes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </div>
  );
}

function FormPreview({ draft, onClose, onCopy, copied, published }) {
  const color = hexColor(draft.appearance?.primaryColor, "#315ce8");
  const background = hexColor(draft.appearance?.backgroundColor, "#f5f7fb");
  const typeface = textStyle(draft.appearance);
  const [optionOrder] = useState(() => shuffleOrder(draft.questions));
  const [started, setStarted] = useState(false);
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background }}>
      <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-white px-4 py-3">
        <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold" onClick={onClose}>
          <span aria-hidden="true">←</span>
          Vista previa
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{published ? "Publicado" : "No se publicó"}</span>
          <button type="button" className={btn} onClick={onCopy}>{copied ? "Enlace copiado" : "Copiar vínculo"}</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {started ? null : (
            <section className="overflow-hidden rounded-[8px] border border-line bg-white">
              {draft.appearance?.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.appearance.poster} alt="" className="aspect-video w-full object-cover" />
              ) : null}
              <div className="px-6 py-6">
                <h1 className="font-semibold leading-tight" style={typeface.header}>{draft.title || "Formulario sin título"}</h1>
                {draft.description ? <p className="mt-3 leading-6 text-muted" style={typeface.text}>{draft.description}</p> : null}
                <button type="button" className="mt-6 rounded-[10px] px-4 py-2.5 text-sm font-bold text-white" style={{ background: color }} onClick={() => setStarted(true)}>Iniciar cuestionario</button>
              </div>
            </section>
          )}
          {started && draft.appearance?.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.appearance.cover} alt="" className="aspect-[4/1] w-full rounded-[8px] object-cover" />
          ) : null}
          {started ? (
          <section className="overflow-hidden rounded-[8px] border border-line bg-white">
            <div className="h-2.5" style={{ background: color }} />
            <div className="px-6 py-5">
              <h1 className="font-semibold leading-tight" style={typeface.header}>{draft.title || "Formulario sin título"}</h1>
            </div>
          </section>
          ) : null}
          {started ? draft.questions.map((question) => (
            <article key={question.id} className="rounded-[8px] border border-line bg-white px-6 py-4">
              <p className="font-semibold" style={typeface.question}>{question.prompt || "Pregunta sin título"}{question.required ? <span className="text-[#c44545]"> *</span> : null}</p>
              <PreviewAnswer question={{ ...question, options: orderedOptions(question, optionOrder[question.id]) }} style={typeface.text} />
            </article>
          )) : null}
          {started && draft.questions.length === 0 ? <p className="text-center text-sm text-muted">Este formulario todavía no tiene preguntas.</p> : null}
        </div>
      </div>
    </div>
  );
}

function PreviewAnswer({ question, style }) {
  if (CHOICE_TYPES.includes(question.type) || question.type === "yes_no") {
    const labels = question.type === "yes_no" ? ["Sí", "No"] : (question.options || []).map((option) => option.label || "Opción");
    return (
      <div className="mt-3 space-y-2">
        {labels.map((label) => (
          <p key={label} className="flex items-center gap-2 text-muted" style={style}>
            <ChoiceMark type={question.type === "yes_no" ? "single" : question.type} />
            {label}
          </p>
        ))}
      </div>
    );
  }
  if (question.type === "rating") return <p className="mt-3 text-lg text-[#f5b942]">★★★★★</p>;
  if (question.type === "scale") return <p className="mt-3 text-muted" style={style}>1 · 2 · 3 · 4 · 5</p>;
  return <p className="mt-4 border-b border-dotted border-[#d5deec] pb-2 text-muted" style={style}>{LOCKED_PREVIEW[question.type] || (question.type === "long_text" ? "Texto de respuesta larga" : "Texto de respuesta breve")}</p>;
}

function PaletteIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 0 0 0 17h1.2a2 2 0 0 0 1.4-3.4l-.4-.4a1.2 1.2 0 0 1 .8-2h2.4A4.6 4.6 0 0 0 20.5 10 7.5 7.5 0 0 0 12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="8" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="8" r="1" fill="currentColor" /><circle cx="16" cy="10" r="1" fill="currentColor" /></svg>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

function UndoIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M8 8H4.5V4.5M5 12a7 7 0 1 0 2-4.9L4.5 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function RedoIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M16 8h3.5V4.5M19 12a7 7 0 1 1-2-4.9l2.5.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7.3l2.2-2.2a4 4 0 0 0-5.6-5.6L11 7.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.2 2.2a4 4 0 0 0 5.6 5.6L13 16.7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function ShareMenu({ links, onError }) {
  const [open, setOpen] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const root = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!root.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  async function copy(link) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
    } catch {
      onError("No se pudo copiar el enlace.");
    }
  }
  return (
    <div className="relative" ref={root}>
      <IconTool label="Enlace y código QR" pressed={open} onClick={() => setOpen((current) => !current)}><LinkIcon /></IconTool>
      {open ? (
        <div className="absolute right-0 top-[3.25rem] z-50 w-[20.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_18px_50px_rgba(17,28,50,0.16)]">
          {links.length === 0 ? <p className="px-5 py-5 text-sm leading-6 text-muted">Publica el formulario para obtener el enlace y el código QR.</p> : null}
          <div className="max-h-[min(32rem,70vh)] divide-y divide-line overflow-y-auto">
            {links.map((link) => (
              <div key={link.id} className="px-5 py-5">
                <p className="text-center text-sm font-semibold">{link.areaName || "Enlace público"}</p>
                <p className="mt-0.5 text-center text-xs text-muted">{[link.versionNumber ? `Versión ${link.versionNumber}` : "", link.acceptingResponses ? "Recibiendo respuestas" : "Enlace desactivado"].filter(Boolean).join(" · ")}</p>
                <div className="mx-auto mt-4 w-fit rounded-[18px] bg-[#f5f7fb] p-3">
                  <NextImage src={`/api/links/${link.id}/qr`} alt="Código QR" width={156} height={156} unoptimized style={{ width: 156, height: 156 }} className="rounded-[12px] bg-white" />
                </div>
                <input readOnly className={`${fieldClass} mt-4 text-xs`} value={link.url} onFocus={(event) => event.target.select()} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className={`${btnPrimary} w-full px-2`} onClick={() => copy(link)}>{copiedId === link.id ? "Copiado" : "Copiar enlace"}</button>
                  <a className={`${btn} w-full px-2`} href={`/api/links/${link.id}/qr?download=1`}>Descargar QR</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({ children, onClick }) {
  return <button type="button" className="block w-full rounded-[10px] px-3 py-2 text-left text-sm font-semibold hover:bg-[#f4f7ff]" onClick={onClick}>{children}</button>;
}

function QuestionsTab({ draft, fields, competencies, selectedId, onSelect, onChange, onAddCompetency }) {
  const typeface = textStyle(draft.appearance);
  const selected = draft.questions.find((question) => question.id === selectedId) || draft.questions[0] || null;
  const recruitment = draft.modality === "recruitment";
  const [dragId, setDragId] = useState("");

  function replace(next) {
    onChange({
      ...draft,
      questions: draft.questions.map((question) => (question.id === next.id ? next : question)),
    });
  }

  function addAfter(question) {
    const next = blankQuestion("short_text", draft.modality);
    const questions = [...draft.questions];
    const index = question ? questions.findIndex((item) => item.id === question.id) : questions.length - 1;
    questions.splice(index + 1, 0, next);
    onChange({ ...draft, questions });
    onSelect(next.id);
  }

  function duplicate(question) {
    const index = draft.questions.findIndex((item) => item.id === question.id);
    const clone = {
      ...question,
      id: crypto.randomUUID(),
      options: question.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
      scaleLabels: [...question.scaleLabels],
    };
    const questions = [...draft.questions];
    questions.splice(index + 1, 0, clone);
    onChange({ ...draft, questions });
    onSelect(clone.id);
  }

  function remove(question) {
    const questions = draft.questions.filter((item) => item.id !== question.id);
    onChange({ ...draft, questions });
    onSelect(questions[Math.max(0, draft.questions.findIndex((item) => item.id === question.id) - 1)]?.id || "");
  }

  function move(question, direction) {
    const index = draft.questions.findIndex((item) => item.id === question.id);
    const target = index + direction;
    if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions];
    const [item] = questions.splice(index, 1);
    questions.splice(target, 0, item);
    onChange({ ...draft, questions });
  }

  function dropOn(targetId, sourceId) {
    const movingId = sourceId || dragId;
    if (!movingId || movingId === targetId) return;
    const questions = [...draft.questions];
    const from = questions.findIndex((item) => item.id === movingId);
    const to = questions.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = questions.splice(from, 1);
    questions.splice(to, 0, item);
    onChange({ ...draft, questions });
    setDragId("");
  }

  return (
    <div className="mx-auto grid w-full max-w-[860px] grid-cols-1 items-start gap-y-3 sm:grid-cols-[minmax(0,1fr)_52px] sm:gap-x-3">
      {draft.appearance?.cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.appearance.cover} alt="" className="aspect-[4/1] w-full rounded-[8px] object-cover sm:col-start-1" />
          <div className="hidden sm:block" />
        </>
      ) : null}
      <section className="overflow-hidden rounded-[8px] border border-line bg-white shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.04)] sm:col-start-1">
        <div className="h-2.5" style={{ background: hexColor(draft.appearance?.primaryColor, "#315ce8") }} />
        <div className="px-6 py-5">
          <input
            className="w-full bg-transparent font-semibold leading-tight outline-none placeholder:text-[#b7c0d0]"
            style={typeface.header}
            maxLength={LIMITS.title}
            placeholder="Formulario sin título"
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
          <FieldError>{fields.title}</FieldError>
          <textarea
            rows={2}
            className="mt-3 w-full resize-none bg-transparent text-sm leading-5 outline-none placeholder:text-[#b7c0d0]"
            style={editorFace(typeface.text, 14)}
            maxLength={LIMITS.description}
            placeholder="Explica de qué trata. Se ve en la portada, antes de empezar."
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
          />
        </div>
      </section>
      <div className="hidden sm:block" />
      {draft.questions.length === 0 ? (
        <>
          <button type="button" className="rounded-[8px] border border-dashed border-[#c9d3e6] bg-white px-4 py-10 text-sm font-bold text-brand sm:col-start-1" onClick={() => addAfter(null)}>Agregar la primera pregunta</button>
          <div className="hidden sm:block" />
        </>
      ) : null}
      {draft.questions.map((question, index) => (
        <GoogleQuestion
          key={question.id}
          question={question}
          index={index}
          active={question.id === selected?.id}
          dragging={dragId === question.id}
          accent={hexColor(draft.appearance?.primaryColor, "#315ce8")}
          typeface={typeface}
          recruitment={recruitment}
          competencies={competencies}
          fields={fields}
          canUp={index > 0}
          canDown={index < draft.questions.length - 1}
          onSelect={() => onSelect(question.id)}
          onChange={replace}
          onDuplicate={() => duplicate(question)}
          onRemove={() => remove(question)}
          onMove={(direction) => move(question, direction)}
          onAddAfter={() => addAfter(question)}
          onDragStart={() => setDragId(question.id)}
          onDragEnd={() => setDragId("")}
          onDrop={(sourceId) => dropOn(question.id, sourceId)}
          onAddCompetency={onAddCompetency}
        />
      ))}
    </div>
  );
}

function GoogleQuestion({ question, index, active, dragging, accent, typeface, recruitment, competencies, fields, canUp, canDown, onSelect, onChange, onDuplicate, onRemove, onMove, onAddAfter, onDragStart, onDragEnd, onDrop, onAddCompetency }) {
  const scorable = question.type === "single" && question.scored;
  const [creatingCompetency, setCreatingCompetency] = useState(false);
  const [competencyName, setCompetencyName] = useState("");
  const [competencyError, setCompetencyError] = useState("");
  const [savingCompetency, setSavingCompetency] = useState(false);
  const creatingRef = useRef(false);
  function chooseCompetency(value) {
    if (value === "__new__") {
      setCreatingCompetency(true);
      setCompetencyName("");
      setCompetencyError("");
      return;
    }
    onChange({ ...question, competencyId: value });
  }
  async function createCompetency() {
    const name = competencyName.trim();
    if (name.length < 2 || creatingRef.current) return;
    creatingRef.current = true;
    setSavingCompetency(true);
    setCompetencyError("");
    try {
      const created = await onAddCompetency(name);
      onChange({ ...question, competencyId: created.id });
      setCompetencyName("");
      setCreatingCompetency(false);
    } catch (createError) {
      setCompetencyError(createError.message);
    } finally {
      creatingRef.current = false;
      setSavingCompetency(false);
    }
  }
  const questionMax = scorable ? Math.max(0, ...question.options.map((option) => (Number.isInteger(option.score) ? option.score : 0))) : 0;
  const optionGrid = scorable
    ? "grid grid-cols-[24px_minmax(0,1fr)_84px_32px] gap-x-3"
    : "grid grid-cols-[24px_minmax(0,1fr)_32px] gap-x-3";
  function changeType(type) {
    onChange({
      ...question,
      type,
      scored: type === "single" ? question.scored : false,
      required: type === "single" && question.scored ? true : question.required,
      options: CHOICE_TYPES.includes(type) && question.options.length < 2 ? starterOptions(recruitment) : question.options,
      scaleLabels: question.scaleLabels?.length === 5 ? question.scaleLabels : [...DEFAULT_SCALE_LABELS],
    });
  }
  function updateOption(id, patch) {
    onChange({ ...question, options: question.options.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  }
  return (
    <>
    <article
      id={`question-${question.id}`}
      className={`relative overflow-hidden rounded-[8px] border bg-white shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.04)] ${active ? "border-[#d7deea]" : "border-line"} ${dragging ? "opacity-60" : ""}`}
      onClick={onSelect}
      onDragOver={(event) => {
        if (!dragIdAllowed(event)) return;
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData("text/plain"));
      }}
    >
      {active ? <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: accent }} /> : null}
      {active ? (
        <button
          type="button"
          draggable
          aria-label="Arrastrar para mover"
          title="Arrastra para mover"
          className="mx-auto mt-1 grid h-6 w-10 cursor-grab place-items-center text-[#9aa6b8] active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", question.id);
            event.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >
          <GripIcon />
        </button>
      ) : <div className="h-3" />}
      <div className="px-6 pb-2 pt-1">
        <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_232px]">
          <GrowingField
            className="min-h-11 w-full resize-none overflow-hidden rounded-[8px] bg-[#f4f7fb] px-4 py-2.5 text-base font-medium leading-6 outline-none placeholder:text-[#b7c0d0] focus:bg-[#eef3ff]"
            style={editorFace(typeface?.question, 16)}
            placeholder="Pregunta"
            maxLength={LIMITS.prompt}
            value={question.prompt}
            onChange={(event) => onChange({ ...question, prompt: event.target.value })}
          />
          <label className="flex h-11 items-center gap-2 rounded-[8px] border border-[#dce2ec] bg-white px-3">
            <TypeMark type={question.type} />
            <select className="h-full w-full bg-transparent text-sm outline-none" value={question.type} onChange={(event) => changeType(event.target.value)}>
              {QUESTION_TYPES.map((item) => <option key={item.type} value={item.type}>{item.title}</option>)}
            </select>
          </label>
        </div>
        <FieldError>{fields[`questions.${index}.prompt`]}</FieldError>

        {CHOICE_TYPES.includes(question.type) ? (
          <div className="mt-4 space-y-1.5">
            {scorable ? (
              <div className={`${optionGrid} items-center px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase`}>
                <span />
                <span>Opciones</span>
                <span className="text-center">Puntos</span>
                <span />
              </div>
            ) : null}
            {question.options.map((option, optionIndex) => (
              <div key={option.id} className={`${optionGrid} items-start min-h-11 rounded-[8px] px-1 hover:bg-[#f8fafc]`}>
                <span className="mt-2.5"><ChoiceMark type={question.type} /></span>
                <GrowingField
                  className="min-h-10 w-full resize-none overflow-hidden rounded-[8px] border border-transparent bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-[#b7c0d0] hover:bg-white focus:border-[#dce2ec] focus:bg-white"
                  style={editorFace(typeface?.text, 15)}
                  placeholder={`Opción ${optionIndex + 1}`}
                  maxLength={LIMITS.option}
                  value={option.label}
                  onChange={(event) => updateOption(option.id, { label: event.target.value })}
                />
                {scorable ? (
                  <div className="mt-1">
                    <ScoreStepper value={option.score} label={`Puntos de la opción ${optionIndex + 1}`} onChange={(score) => updateOption(option.id, { score })} />
                  </div>
                ) : null}
                <button type="button" aria-label="Quitar opción" disabled={question.options.length <= 2} className="mt-1 grid h-8 w-8 place-items-center rounded-full text-[#8b97a8] hover:bg-white disabled:opacity-30" onClick={() => onChange({ ...question, options: question.options.filter((item) => item.id !== option.id) })}>×</button>
              </div>
            ))}
            <button type="button" className={`${optionGrid} min-h-10 w-full items-center rounded-[8px] bg-transparent px-1 text-left text-sm text-muted hover:bg-[#f8fafc]`} onClick={() => onChange({ ...question, options: [...question.options, { id: crypto.randomUUID(), label: "", score: 0 }] })}>
              <ChoiceMark type={question.type} />
              <span>Agregar opción</span>
            </button>
            <FieldError>{fields[`questions.${index}.options`] || fields[`questions.${index}.score`]}</FieldError>
          </div>
        ) : null}

        {question.type === "scale" ? (
          <div className="mt-4 space-y-2">
            {question.scaleLabels.map((label, labelIndex) => (
              <label key={labelIndex} className="flex items-center gap-2">
                <span className="w-6 text-sm font-bold text-brand">{labelIndex + 1}</span>
                <input className="min-w-0 flex-1 border-b border-[#e4e9f2] bg-transparent py-2 text-sm outline-none focus:border-brand" style={editorFace(typeface?.text, 15)} value={label} onChange={(event) => onChange({ ...question, scaleLabels: question.scaleLabels.map((item, itemIndex) => (itemIndex === labelIndex ? event.target.value : item)) })} />
              </label>
            ))}
          </div>
        ) : null}

        {question.type === "short_text" || question.type === "long_text" ? (
          <p className="mt-5 border-b border-dotted border-[#d5deec] pb-2 text-muted" style={typeface?.text}>{question.type === "long_text" ? "Texto de respuesta larga" : "Texto de respuesta breve"}</p>
        ) : null}
        {question.type === "yes_no" ? <p className="mt-5 text-sm text-muted">Sí / No</p> : null}
        {question.type === "rating" ? <p className="mt-5 text-lg text-[#f5b942]">★★★★★</p> : null}
        {LOCKED_TYPES.includes(question.type) ? <p className="mt-5 border-b border-dotted border-[#d5deec] pb-2 text-muted" style={typeface?.text}>{LOCKED_PREVIEW[question.type]}</p> : null}

        {active && !recruitment && (question.type === "email" || question.type === "phone") ? (
          <p className="mt-3 text-xs leading-5 text-muted">En una encuesta de área este dato no se liga a una cuenta, pero identifica a quien lo escribe.</p>
        ) : null}
      {active ? (
        <div className="-mx-6 mt-4 border-t border-line px-4 py-2" onClick={(event) => event.stopPropagation()}>
          {scorable ? (
            <div className="mb-2">
              <label className="flex items-center gap-3">
                <span className="shrink-0 text-sm text-muted">Competencia <span className="text-[#c44545]">*</span></span>
                {creatingCompetency ? (
                  <input
                    autoFocus
                    className={`${fieldClass} min-w-0 flex-1`}
                    value={competencyName}
                    maxLength={LIMITS.catalog}
                    placeholder={savingCompetency ? "Guardando…" : "Escribe y presiona Enter"}
                    disabled={savingCompetency}
                    onChange={(event) => setCompetencyName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createCompetency();
                      }
                      if (event.key === "Escape") {
                        setCreatingCompetency(false);
                        setCompetencyName("");
                        setCompetencyError("");
                      }
                    }}
                    onBlur={() => {
                      if (competencyName.trim().length >= 2) createCompetency();
                      else if (!savingCompetency) setCreatingCompetency(false);
                    }}
                  />
                ) : (
                  <select className={`${fieldClass} min-w-0 flex-1`} required value={question.competencyId} onChange={(event) => chooseCompetency(event.target.value)}>
                    <option value="">Elige una competencia</option>
                    {competencies.filter((item) => item.active || item.id === question.competencyId).map((item) => (
                      <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inactiva)"}</option>
                    ))}
                    <option value="__new__">+ Agregar competencia</option>
                  </select>
                )}
              </label>
              {competencyError ? <p className="mt-1 text-xs text-[#c44545]">{competencyError}</p> : null}
            </div>
          ) : null}
          {scorable ? <FieldError>{fields[`questions.${index}.competencyId`]}</FieldError> : null}
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <button type="button" aria-label="Duplicar pregunta" className="grid h-9 w-9 place-items-center text-[#5f6b7c]" onClick={onDuplicate}><CopyIcon /></button>
            <button type="button" aria-label="Eliminar pregunta" className="grid h-9 w-9 place-items-center text-[#5f6b7c]" onClick={onRemove}><TrashIcon /></button>
            <span className="h-6 w-px bg-line" />
            {CHOICE_TYPES.includes(question.type) ? (
              <FooterSwitch label="Aleatorio" checked={Boolean(question.shuffleOptions)} onClick={() => onChange({ ...question, shuffleOptions: !question.shuffleOptions })} />
            ) : null}
            {question.type === "single" ? (
              <FooterSwitch label="Evaluar" checked={question.scored} onClick={() => onChange({ ...question, scored: !question.scored, required: !question.scored ? true : question.required })} />
            ) : null}
            <FooterSwitch label="Obligatoria" checked={scorable || question.required} disabled={scorable} onClick={() => onChange({ ...question, required: !(scorable || question.required) })} />
          </div>
        </div>
      ) : <div className="h-4" />}
      </div>
    </article>
    {active ? (
      <div className="flex h-fit flex-row gap-1 self-start rounded-[10px] border border-line bg-white p-1 shadow-[0_1px_2px_rgba(38,61,100,0.06),0_8px_24px_rgba(38,61,100,0.06)] sm:flex-col" onClick={(event) => event.stopPropagation()}>
        <RailButton label="Agregar pregunta después" onClick={onAddAfter}><span className="text-xl leading-none">+</span></RailButton>
        <RailButton label="Subir pregunta" disabled={!canUp} onClick={() => onMove(-1)}><Chevron direction="up" /></RailButton>
        <RailButton label="Bajar pregunta" disabled={!canDown} onClick={() => onMove(1)}><Chevron direction="down" /></RailButton>
      </div>
    ) : <div className="hidden sm:block" />}
    </>
  );
}

function dragIdAllowed(event) {
  return [...event.dataTransfer.types].includes("text/plain");
}

function RailButton({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-[8px] text-[#3c4758] hover:bg-[#f4f7fb] disabled:opacity-30">
      {children}
    </button>
  );
}

function PublishModal({ draft, fields, error, meta, pending, publishDisabled, lockedModality, formId, onChange, onClose, onPublish, onRefreshMeta, onError, onPickImage }) {
  const recruitment = draft.modality === "recruitment";
  const appearance = draft.appearance || { primaryColor: "#315ce8", logo: "", cover: "" };
  const [schedule, setSchedule] = useState(Boolean(draft.closesAt));
  const link = meta?.links?.[0];
  const live = meta?.status === "published" || meta?.status === "closed";
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  function update(patch) {
    onChange({ ...draft, ...patch });
  }
  function updateAppearance(patch) {
    onChange({ ...draft, appearance: { ...appearance, ...patch } });
  }
  async function toggleResponses() {
    setToggling(true);
    try {
      await api(`/api/forms/${formId}/${meta?.status === "published" ? "close" : "reopen"}`, { method: "POST" });
      await onRefreshMeta();
    } catch (toggleError) {
      onError(toggleError.message);
    } finally {
      setToggling(false);
    }
  }
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const previousBody = body.style.overflow;
    const previousRoot = root.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - root.clientWidth;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previousBody;
      root.style.overflow = previousRoot;
      body.style.paddingRight = previousPadding;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-hidden overscroll-none bg-[#0c1634]/45 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="publish-title" className="max-h-[min(780px,92vh)] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[16px] bg-white shadow-[0_18px_50px_rgba(12,22,52,0.22)]" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-line px-5 py-4">
          <h2 id="publish-title" className="text-xl font-semibold">{live ? "Opciones publicadas" : "Publicar formulario"}</h2>
        </div>
        <div className="divide-y divide-line px-5">
          {error ? <div className="py-4"><ErrorNote>{error}</ErrorNote></div> : null}
          <section className="py-4">
            <h3 className="text-sm font-semibold">Quién puede responder</h3>
            <div className="mt-3 grid gap-2">
              <AccessChoice
                title="Pública"
                text="Cualquier persona con el enlace. No pide nombre ni correo."
                selected={!recruitment}
                disabled={lockedModality}
                onClick={() => update({ modality: "climate", targetRole: "", showScore: false })}
              />
              <AccessChoice
                title="Privada"
                text="Cualquier persona con el enlace, pero pide nombre y correo. Las respuestas quedan identificadas."
                selected={recruitment}
                disabled={lockedModality}
                onClick={() => update({ modality: "recruitment" })}
              />
            </div>
            {lockedModality ? <p className="mt-2 text-xs text-muted">Esto queda fijo después de la primera publicación.</p> : null}
            {recruitment ? (
              <label className="mt-3 block space-y-1.5">
                <span className="text-sm font-semibold">Puesto que se está evaluando</span>
                <input className={fieldClass} maxLength={LIMITS.role} value={draft.targetRole} onChange={(event) => update({ targetRole: event.target.value })} placeholder="Operador de producción" />
                <FieldError>{fields.targetRole}</FieldError>
              </label>
            ) : null}
          </section>
          <section className="py-4">
            <h3 className="text-sm font-semibold">Disponibilidad</h3>
            <div className="mt-3 grid gap-2">
              <AccessChoice title="Siempre disponible" text="El enlace recibe respuestas hasta que lo cierres." selected={!schedule} onClick={() => { setSchedule(false); update({ opensAt: "", closesAt: "" }); }} />
              <AccessChoice title="Fecha de cierre" text="Después de esa fecha el enlace deja de recibir respuestas." selected={schedule} onClick={() => setSchedule(true)} />
            </div>
            {schedule ? (
              <label className="mt-3 block space-y-1.5">
                <span className="text-sm font-semibold">Cierra el</span>
                <input type="datetime-local" className={fieldClass} value={draft.closesAt} onChange={(event) => update({ closesAt: event.target.value })} />
                <FieldError>{fields.closesAt}</FieldError>
              </label>
            ) : null}
            {live ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Se aceptan respuestas</span>
                <button type="button" role="switch" aria-label="Se aceptan respuestas" aria-checked={meta?.status === "published"} disabled={toggling} onClick={toggleResponses} className={`relative h-6 w-11 shrink-0 rounded-full disabled:opacity-70 ${meta?.status === "published" ? "bg-brand" : "bg-[#d5dbe6]"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${meta?.status === "published" ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ) : null}
          </section>
          <section className="py-4">
            <h3 className="text-sm font-semibold">Apariencia</h3>
            <p className="mt-1 text-xs leading-5 text-muted">La portada es la pantalla con la que abre el formulario: la foto, el título y la descripción. Después, la persona pulsa Iniciar cuestionario.</p>
            <div className="mt-3 grid gap-3">
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold">Logo</span>
                <span className="flex items-center gap-2">
                  {appearance.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appearance.logo} alt="Logo" className="h-10 w-10 rounded-[8px] object-contain" />
                  ) : <span className="grid h-10 w-10 place-items-center rounded-[8px] text-sm font-black text-white" style={{ background: /^#[0-9a-fA-F]{6}$/.test(appearance.primaryColor) ? appearance.primaryColor : "#315ce8" }}>M</span>}
                  <label className={`${btn} cursor-pointer`}>
                    {appearance.logo ? "Cambiar" : "Subir"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseFile(event, onPickImage, "logo")} />
                  </label>
                  {appearance.logo ? <button type="button" className={btn} onClick={() => updateAppearance({ logo: "" })}>Quitar</button> : null}
                </span>
              </div>
              <FieldError>{fields.logo}</FieldError>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold">Portada</span>
                <span className="flex items-center gap-2">
                  {appearance.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={appearance.poster} alt="Portada" className="h-10 w-16 rounded-[8px] object-cover" />
                  ) : null}
                  <label className={`${btn} cursor-pointer`}>
                    {appearance.poster ? "Cambiar" : "Subir"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseFile(event, onPickImage, "poster")} />
                  </label>
                  {appearance.poster ? <button type="button" className={btn} onClick={() => updateAppearance({ poster: "" })}>Quitar</button> : null}
                </span>
              </div>
              <FieldError>{fields.poster}</FieldError>
            </div>
          </section>
          {recruitment ? (
            <section className="py-4">
              <h3 className="text-sm font-semibold">Resultado al terminar</h3>
              <div className="mt-3 grid gap-2">
                <AccessChoice title="Solo el mensaje" text="La persona no ve cuántos puntos obtuvo." selected={!draft.showScore} onClick={() => update({ showScore: false })} />
                <AccessChoice title="Mostrar el puntaje" text="Al terminar ve su resultado sobre 100, además del mensaje." selected={Boolean(draft.showScore)} onClick={() => update({ showScore: true })} />
              </div>
            </section>
          ) : null}
          {link ? (
            <section className="py-4">
              <h3 className="text-sm font-semibold">Vínculo</h3>
              <input readOnly className={`${fieldClass} mt-3`} value={link.url} onFocus={(event) => event.target.select()} />
              <p className="mt-2 text-xs text-muted">{link.acceptingResponses ? "Recibiendo respuestas" : "Enlace desactivado"}{link.versionNumber ? ` · versión ${link.versionNumber}` : ""}</p>
            </section>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
          {link ? (
            <button type="button" className={`${btn} mr-auto`} onClick={async () => {
              try {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              } catch {
                onError("No se pudo copiar el enlace.");
              }
            }}>{copied ? "Enlace copiado" : "Copiar vínculo"}</button>
          ) : null}
          <button type="button" className={btn} onClick={onClose}>Descartar</button>
          <button type="button" className={btnPrimary} disabled={publishDisabled || toggling} onClick={() => {
            if (schedule && !draft.closesAt) {
              onError("Elige la fecha de cierre.");
              return;
            }
            onPublish();
          }}>
            {pending ? "Publicando…" : live ? "Publicar cambios" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessChoice({ title, text, selected, disabled, onClick }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 rounded-[12px] border px-3 py-3 text-left disabled:cursor-default ${selected ? "border-brand bg-[#f5f8ff]" : "border-line bg-white"} ${disabled && !selected ? "opacity-60" : ""}`}>
      <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${selected ? "border-brand" : "border-[#c5cedd]"}`}>
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">{text}</span>
      </span>
    </button>
  );
}

function CreateStep({ draft, fields, lockedModality, onChange }) {
  const recruitment = draft.modality === "recruitment";
  function update(patch) {
    onChange({ ...draft, ...patch });
  }
  return (
    <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
      <h2 className="text-lg font-semibold">Información del formulario</h2>
      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-semibold">Nombre del formulario</span>
        <input className={fieldClass} maxLength={LIMITS.title} value={draft.title} onChange={(event) => update({ title: event.target.value })} />
        <FieldError>{fields.title}</FieldError>
      </label>
      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-semibold">Descripción</span>
        <textarea className={`${fieldClass} min-h-20`} maxLength={LIMITS.description} value={draft.description} onChange={(event) => update({ description: event.target.value })} />
        <span className="block text-right text-xs text-muted">{draft.description.length}/{LIMITS.description}</span>
      </label>
      <h3 className="mt-5 text-base font-semibold">¿Cuál es el propósito de este formulario?</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ChoiceCard
          title="Recolectar información"
          text="Opiniones del equipo, sin nombre ni correo."
          selected={!recruitment}
          disabled={lockedModality}
          onClick={() => update({ modality: "climate", targetRole: "" })}
        />
        <ChoiceCard
          title="Evaluar personas"
          text="Mide competencias. La puntuación de cada pregunta es opcional."
          selected={recruitment}
          disabled={lockedModality}
          onClick={() => update({ modality: "recruitment" })}
        />
      </div>
      {lockedModality ? <p className="mt-2 text-xs text-muted">El propósito queda fijo después de la primera publicación.</p> : null}
      {recruitment ? (
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-semibold">Puesto que se está evaluando</span>
          <input className={fieldClass} maxLength={LIMITS.role} value={draft.targetRole} onChange={(event) => update({ targetRole: event.target.value })} placeholder="Operador de producción" />
          <p className="text-xs text-muted">Lo usa RH. Quien responde no ve este dato. Hace falta para publicar.</p>
          <FieldError>{fields.targetRole}</FieldError>
        </label>
      ) : null}
    </section>
  );
}

function ConfigStep({ draft, fields, onChange }) {
  const recruitment = draft.modality === "recruitment";
  function update(patch) {
    onChange({ ...draft, ...patch });
  }
  return (
    <div className="space-y-4">
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <h2 className="text-base font-semibold">Acceso</h2>
        <p className="mt-1 text-sm text-muted">Define quién puede responder este formulario.</p>
        <div className="mt-3">
          <ChoiceCard
            title="Sin iniciar sesión"
            text="Cualquier persona con el enlace puede responder."
            selected
            onClick={() => {}}
          />
        </div>
      </section>
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <h2 className="text-base font-semibold">Identificación</h2>
        <p className="mt-1 text-sm text-muted">Elige si se piden datos de quien responde. Depende del propósito del paso Crear.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ChoiceCard
            title="Solicitar nombre y correo"
            text="Se piden antes de enviar. Quedan en el perfil de la persona candidata."
            selected={recruitment}
            disabled={!recruitment}
            onClick={() => {}}
          />
          <ChoiceCard
            title="Anónima"
            text="La respuesta se guarda sin nombre ni correo."
            selected={!recruitment}
            disabled={recruitment}
            onClick={() => {}}
          />
        </div>
        <p className="mt-3 rounded-[12px] bg-[#f5f8ff] px-3 py-2 text-xs leading-5 text-muted">
          {recruitment
            ? "Para evaluar a una persona, se piden sus datos. Si quieres una encuesta anónima, cambia el propósito en el paso Crear."
            : "Esta encuesta no pide nombre ni correo. Si necesitas identificar a alguien, cambia el propósito en el paso Crear, antes de publicar."}
        </p>
      </section>
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <h2 className="text-base font-semibold">Fechas de disponibilidad</h2>
        <p className="mt-1 text-sm text-muted">Opcionales. Fuera de este rango el enlace avisa que el formulario no recibe respuestas.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Fecha de apertura</span>
            <input type="datetime-local" className={fieldClass} value={draft.opensAt} onChange={(event) => update({ opensAt: event.target.value })} />
            <FieldError>{fields.opensAt}</FieldError>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Fecha de cierre</span>
            <input type="datetime-local" className={fieldClass} value={draft.closesAt} onChange={(event) => update({ closesAt: event.target.value })} />
            <FieldError>{fields.closesAt}</FieldError>
          </label>
        </div>
      </section>
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <h2 className="text-base font-semibold">Mensaje de confirmación</h2>
        <p className="mt-1 text-sm text-muted">Se muestra después de que la persona envía sus respuestas.</p>
        <textarea className={`${fieldClass} mt-3 min-h-20`} maxLength={LIMITS.confirmation} value={draft.confirmationMessage} onChange={(event) => update({ confirmationMessage: event.target.value })} placeholder="Gracias por participar. Tu respuesta fue enviada." />
        <span className="mt-1 block text-right text-xs text-muted">{draft.confirmationMessage.length}/{LIMITS.confirmation}</span>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-semibold">Instrucciones</span>
          <textarea className={`${fieldClass} min-h-20`} maxLength={LIMITS.instructions} value={draft.instructions} onChange={(event) => update({ instructions: event.target.value })} placeholder="Texto que ve la persona antes de empezar." />
        </label>
      </section>
    </div>
  );
}

function DesignStep({ draft, fields, viewport, onViewport, onChange }) {
  const appearance = draft.appearance || { primaryColor: "#315ce8", logo: "", cover: "" };
  function updateAppearance(patch) {
    onChange({ ...draft, appearance: { ...appearance, ...patch } });
  }
  async function pickImage(file, field, edge) {
    try {
      const dataUrl = await resizeImage(file, edge);
      updateAppearance({ [field]: dataUrl });
    } catch (imageError) {
      updateAppearance({ [field]: appearance[field] });
      window.alert(imageError.message);
    }
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="space-y-5 rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <div>
          <h2 className="text-base font-semibold">Apariencia del formulario</h2>
          <p className="mt-1 text-sm text-muted">El logo, el color y la portada se ven en la encuesta. Se guardan con el borrador.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Logo</p>
          <div className="mt-2 flex items-center gap-3 rounded-[12px] border border-dashed border-[#d5deec] p-3">
            {appearance.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={appearance.logo} alt="Logo" className="h-10 max-w-[120px] object-contain" />
            ) : <span className="grid h-10 w-10 place-items-center rounded-[10px] text-sm font-black text-white" style={{ background: appearance.primaryColor }}>M</span>}
            <div className="flex flex-wrap gap-2">
              <label className={`${btn} cursor-pointer`}>
                Cambiar logo
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => pickImage(event.target.files?.[0], "logo", 480)} />
              </label>
              {appearance.logo ? <button type="button" className={btn} onClick={() => updateAppearance({ logo: "" })}>Quitar</button> : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted">PNG o JPG.</p>
          <FieldError>{fields.logo}</FieldError>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Color principal</span>
          <span className="flex items-center gap-2">
            <input type="color" className="h-11 w-14 cursor-pointer rounded-[10px] border border-line bg-white p-1" value={appearance.primaryColor} onChange={(event) => updateAppearance({ primaryColor: event.target.value })} />
            <input className={fieldClass} value={appearance.primaryColor} maxLength={7} onChange={(event) => updateAppearance({ primaryColor: event.target.value })} />
          </span>
        </label>
        <div>
          <p className="text-sm font-semibold">Portada</p>
          <p className="mt-1 text-xs text-muted">Opcional. Aparece arriba de la encuesta.</p>
          {appearance.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={appearance.cover} alt="Portada" className="mt-2 h-24 w-full rounded-[12px] object-cover" />
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <label className={`${btn} cursor-pointer`}>
              {appearance.cover ? "Cambiar portada" : "Subir portada"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => pickImage(event.target.files?.[0], "cover", 1200)} />
            </label>
            {appearance.cover ? <button type="button" className={btn} onClick={() => updateAppearance({ cover: "" })}>Quitar</button> : null}
          </div>
          <FieldError>{fields.cover}</FieldError>
        </div>
      </section>
      <section className="rounded-[16px] border border-line bg-[#f7f9fc] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Vista previa</h2>
          <div className="flex rounded-[10px] border border-line bg-white p-1">
            <button type="button" className={`rounded-[8px] px-3 py-1.5 text-xs font-bold ${viewport === "desktop" ? "bg-[#eef3ff] text-brand" : "text-muted"}`} onClick={() => onViewport("desktop")}>Escritorio</button>
            <button type="button" className={`rounded-[8px] px-3 py-1.5 text-xs font-bold ${viewport === "mobile" ? "bg-[#eef3ff] text-brand" : "text-muted"}`} onClick={() => onViewport("mobile")}>Móvil</button>
          </div>
        </div>
        <div className={viewport === "mobile" ? "mx-auto max-w-[390px]" : ""}>
          <PublicSurvey embedded initial={{ available: true, form: toPublicForm(toPayload(draft)) }} />
        </div>
      </section>
    </div>
  );
}

function chooseFile(event, onPick, field) {
  onPick(event.target.files?.[0], field);
  event.target.value = "";
}

function resizeImage(file, maxEdge) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error("Usa una imagen PNG o JPG."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.onerror = () => reject(new Error("No se pudo leer la imagen."));
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function PublishStep({ formId, draft, meta, areas, recruitment, linkArea, linkVersion, pending, publishDisabled, onArea, onVersion, onRefresh, onError, onPublish }) {
  const published = Boolean(meta?.publishedVersion);
  const href = `/formularios/${formId}#respuestas`;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        <h2 className="text-lg font-semibold">Resumen del formulario</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-semibold">{draft.title}</dt>
            <dd className="text-muted">{MODALITY_LABELS[draft.modality]}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Descripción</dt>
            <dd className="mt-1">{draft.description || "Sin descripción."}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Preguntas</dt>
            <dd className="mt-1">{draft.questions.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Acceso</dt>
            <dd className="mt-1">Sin iniciar sesión. {recruitment ? "Pide nombre y correo." : "Anónima."}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Versión</dt>
            <dd className="mt-1">{published ? `v${meta.publishedVersion}${meta.hasUnpublishedChanges ? " · hay cambios en borrador" : " publicada"}` : "Todavía en borrador"}</dd>
          </div>
        </dl>
        {published ? <Link href={href} className={`${btn} mt-5`}>Ver resultados</Link> : null}
      </section>
      <section className="rounded-[16px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
        {published && !meta?.hasUnpublishedChanges ? (
          <div className="rounded-[14px] bg-[#eefbf3] px-4 py-3">
            <p className="text-sm font-bold text-[#1f8a4c]">Tu formulario está listo para recibir respuestas.</p>
            <p className="mt-1 text-sm text-[#3d6b52]">Comparte el enlace o el código QR. Abren la versión publicada.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">{published ? "Publicar los cambios" : "Publicar"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {published
                ? "El enlace que ya compartiste pasa a esta versión. Las respuestas que ya llegaron no cambian."
                : "Hasta este momento el formulario es un borrador. Al publicar se crea el enlace y el código QR."}
            </p>
            <button type="button" className={`${btnPrimary} mt-4`} disabled={publishDisabled} onClick={onPublish}>
              {pending ? "Publicando…" : published ? "Publicar cambios" : "Publicar formulario"}
            </button>
          </div>
        )}
        <div className="mt-5">
          <ShareTab
            formId={formId}
            meta={meta}
            areas={areas}
            recruitment={recruitment}
            linkArea={linkArea}
            linkVersion={linkVersion}
            pending={pending}
            onArea={onArea}
            onVersion={onVersion}
            onRefresh={onRefresh}
            onError={onError}
          />
        </div>
      </section>
    </div>
  );
}

function ChoiceCard({ title, text, selected, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[14px] border px-3 py-3 text-left disabled:cursor-default ${selected ? "border-brand bg-[#f5f8ff] ring-4 ring-brand/10" : "border-line bg-white"} ${disabled && !selected ? "opacity-60" : ""}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted">{text}</span>
        </span>
        <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-brand" : "border-[#c5cedd]"}`}>
          {selected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
        </span>
      </span>
    </button>
  );
}

function PublishedLinks({ links, onError }) {
  const [copiedId, setCopiedId] = useState("");
  return (
    <div className="rounded-[16px] border border-line bg-white p-4 shadow-[0_7px_28px_rgba(38,61,100,0.04)]">
      <h2 className="text-sm font-semibold">Enlace publicado</h2>
      <div className="mt-3 space-y-3">
        {links.map((link) => (
          <div key={link.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <NextImage src={`/api/links/${link.id}/qr`} alt="Código QR" width={96} height={96} unoptimized style={{ width: 96, height: 96 }} className="shrink-0 rounded-[12px] border border-line bg-white p-1" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{link.areaName || "Enlace público"}{link.versionNumber ? ` · versión ${link.versionNumber}` : ""}</p>
              <p className="text-xs text-muted">{link.acceptingResponses ? "Recibiendo respuestas" : "Enlace desactivado"}</p>
              <input readOnly className={`${fieldClass} mt-2`} value={link.url} onFocus={(event) => event.target.select()} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    setCopiedId(link.id);
                  } catch {
                    onError("No se pudo copiar el enlace.");
                  }
                }}>{copiedId === link.id ? "Enlace copiado" : "Copiar enlace"}</button>
                <a className={btn} href={link.url} target="_blank" rel="noreferrer">Abrir</a>
                <a className={btn} href={`/api/links/${link.id}/qr?download=1`}>Descargar QR</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WizardSteps({ current, onPick }) {
  const index = Math.max(0, STEPS.findIndex((item) => item.id === current));
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((item, stepIndex) => {
        const done = stepIndex < index;
        const active = stepIndex === index;
        return (
          <li key={item.id} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(item.id)} className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${active ? "bg-brand text-white" : done ? "bg-[#e7f8ef] text-[#1f8a4c]" : "bg-[#eef1f6] text-muted"}`}>
                {done ? "✓" : stepIndex + 1}
              </span>
              <span className={`text-sm font-semibold whitespace-nowrap ${active ? "text-ink" : "text-muted"}`}>{item.label}</span>
            </button>
            {stepIndex < STEPS.length - 1 ? <span className="text-muted">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ShareTab({ formId, meta, areas, recruitment, linkArea, linkVersion, pending, onArea, onVersion, onRefresh, onError }) {
  const [copiedId, setCopiedId] = useState("");
  async function addLink() {
    try {
      await api(`/api/forms/${formId}/links`, {
        method: "POST",
        body: JSON.stringify({ versionId: linkVersion, areaId: recruitment ? null : linkArea || null }),
      });
      await onRefresh();
    } catch (linkError) {
      onError(linkError.message);
    }
  }
  async function copy(link) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
    } catch {
      onError("No se pudo copiar el enlace.");
    }
  }
  const links = meta?.links || [];
  return (
    <div>
      <h2 className="text-base font-semibold">{recruitment ? "Enlace para la persona candidata" : "Enlaces por área"}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        {recruitment
          ? "Comparte el enlace o el código QR. Abren la misma evaluación."
          : "Cada área puede tener su enlace y su código QR. El área la define este enlace, no quien responde."}
      </p>
      {links.length === 0 ? <p className="mt-4 text-sm text-muted">Publica el formulario para generar el primer enlace y su código QR.</p> : null}
      <div className="mt-4 space-y-4">
        {links.map((link) => (
          <article key={link.id} className="rounded-[14px] border border-line p-4">
            <p className="text-sm font-bold">Versión {link.versionNumber}{link.areaName ? ` · ${link.areaName}` : ""}</p>
            <p className="text-xs text-muted">{link.acceptingResponses ? "Recibiendo respuestas" : "Enlace desactivado"}</p>
            <p className="mt-3 text-sm font-semibold">Enlace público</p>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input readOnly className={`${fieldClass} min-w-0 flex-1`} value={link.url} onFocus={(event) => event.target.select()} />
              <button type="button" className={`${btnPrimary} shrink-0`} onClick={() => copy(link)}>{copiedId === link.id ? "Enlace copiado" : "Copiar enlace"}</button>
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <NextImage
                src={`/api/links/${link.id}/qr`}
                alt={`Código QR ${link.areaName || "del formulario"}`}
                width={160}
                height={160}
                unoptimized
                style={{ width: 160, height: 160 }}
                className="shrink-0 rounded-[12px] border border-line bg-white p-2"
              />
              <div className="flex flex-col items-start gap-2">
                <a className={btn} href={link.url} target="_blank" rel="noreferrer">Abrir formulario</a>
                <a className={btn} href={`/api/links/${link.id}/qr?download=1`}>Descargar QR</a>
                <button type="button" className={btn} onClick={async () => {
                  try {
                    await api(`/api/links/${link.id}`, { method: "PATCH", body: JSON.stringify({ acceptingResponses: !link.acceptingResponses }) });
                    await onRefresh();
                  } catch (toggleError) {
                    onError(toggleError.message);
                  }
                }}>{link.acceptingResponses ? "Desactivar" : "Activar"}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {meta?.versions?.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Versión</span>
            <select className={fieldClass} value={linkVersion} onChange={(event) => onVersion(event.target.value)}>
              {meta.versions.map((version) => <option key={version.id} value={version.id}>Versión {version.versionNumber}</option>)}
            </select>
          </label>
          {recruitment ? null : (
            <label className="space-y-1.5">
              <span className="text-sm font-semibold">Área</span>
              <select className={fieldClass} value={linkArea} onChange={(event) => onArea(event.target.value)}>
                <option value="">Sin área</option>
                {areas.filter((area) => area.active).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" className={`${btn} sm:col-span-2 sm:justify-self-start`} disabled={pending} onClick={addLink}>Crear otro enlace</button>
        </div>
      ) : null}
      {links.length ? <p className="mt-3 text-xs leading-5 text-muted">Al publicar cambios, estos enlaces muestran la versión nueva. Las respuestas anteriores se quedan como estaban.</p> : null}
    </div>
  );
}

function FooterSwitch({ label, checked, disabled, onClick }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={onClick}
        className={`relative h-5 w-9 shrink-0 rounded-full disabled:opacity-70 ${checked ? "bg-brand" : "bg-[#d5dbe6]"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${checked ? "left-4" : "left-0.5"}`} />
      </button>
    </span>
  );
}

function ScoreStepper({ value, label, onChange }) {
  const score = Number.isInteger(value) ? Math.min(LIMITS.optionScore, Math.max(0, value)) : 0;
  const [draft, setDraft] = useState(null);
  const shown = draft == null ? String(score) : draft;
  function commit(next) {
    const parsed = next === "" ? 0 : Number(next);
    const clamped = Number.isInteger(parsed) ? Math.min(LIMITS.optionScore, Math.max(0, parsed)) : score;
    onChange(clamped);
    setDraft(null);
  }
  return (
    <div className="flex h-8 items-stretch overflow-hidden rounded-[8px] border border-[#dce2ec] bg-white focus-within:border-brand">
      <input
        aria-label={label}
        inputMode="numeric"
        className="w-10 bg-transparent text-center text-xs font-semibold outline-none"
        value={shown}
        onFocus={() => setDraft(String(score))}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={() => commit(shown)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <span className="flex flex-col border-l border-[#e7ebf2]">
        <button type="button" aria-label={`Subir ${label}`} className="flex flex-1 items-center px-1 text-muted hover:bg-[#f4f7fb] hover:text-ink" onClick={() => onChange(Math.min(LIMITS.optionScore, score + 1))}><Chevron direction="up" small /></button>
        <button type="button" aria-label={`Bajar ${label}`} className="flex flex-1 items-center border-t border-[#e7ebf2] px-1 text-muted hover:bg-[#f4f7fb] hover:text-ink" onClick={() => onChange(Math.max(0, score - 1))}><Chevron direction="down" small /></button>
      </span>
    </div>
  );
}

function Chevron({ direction, small = false }) {
  return (
    <svg viewBox="0 0 16 16" className={small ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} aria-hidden="true">
      <path d={direction === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <rect x="5.5" y="5.5" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.5 5.5V4.2A1.2 1.2 0 0 0 9.3 3H4.2A1.2 1.2 0 0 0 3 4.2v5.1c0 .7.5 1.2 1.2 1.2H5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M4 4.5h8M6.2 4.5V3.8c0-.4.4-.8.8-.8h2c.4 0 .8.4.8.8v.7M5 4.5l.5 8h5l.5-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LOCKED_PREVIEW = {
  email: "ana@empresa.com",
  phone: "55 1234 5678",
  number: "0",
  date: "aaaa-mm-dd",
  time: "09:30",
  url: "https://empresa.com",
};

function ChoiceMark({ type }) {
  if (type === "multiple") return <span className="grid h-5 w-5 place-items-center"><span className="h-4 w-4 rounded-[3px] border border-[#c5cedd]" /></span>;
  if (type === "dropdown") return <span className="grid h-5 w-5 place-items-center text-xs leading-none text-muted">▾</span>;
  return <span className="grid h-5 w-5 place-items-center"><span className="h-4 w-4 rounded-full border border-[#c5cedd]" /></span>;
}

function TypeMark({ type, large = false }) {
  const className = large ? "h-5 w-5" : "h-3.5 w-3.5";
  if (type === "single") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><circle cx="8" cy="8" r="2.2" fill="currentColor" /></svg>;
  }
  if (type === "scale") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M3 12h10M4.5 9.5h2M7 6.5h2M9.5 9.5h2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "long_text") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "email") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><rect x="2.5" y="4" width="11" height="8" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M3 5l5 4 5-4" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>;
  }
  if (type === "phone") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M5 3.5h2l1 2.5-1.2 1a7 7 0 0 0 2.2 2.2l1-1.2 2.5 1v2A1.5 1.5 0 0 1 11 12.5 8.5 8.5 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>;
  }
  if (type === "number") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M6 3.5L5 12.5M11 3.5L10 12.5M3.5 6.5h9M3 10h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "date") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "time") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5.2V8l2 1.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "dropdown") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="9" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M6 8l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "multiple") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5 8.2l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "yes_no") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M3.5 8.5l2.2 2.2 6-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
  }
  if (type === "rating") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M8 2.8l1.4 2.9 3.2.4-2.3 2.2.6 3.1L8 10l-2.9 1.4.6-3.1L3.4 6.1l3.2-.4L8 2.8Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /></svg>;
  }
  if (type === "url") {
    return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M6.5 9.5l3-3M7 5.5H5.2A2.2 2.2 0 0 0 3 7.7v0A2.2 2.2 0 0 0 5.2 10H7M9 10.5h1.8A2.2 2.2 0 0 0 13 8.3v0A2.2 2.2 0 0 0 10.8 6H9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><path d="M3 6h10M3 9.5h6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}
