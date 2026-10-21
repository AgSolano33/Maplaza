"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_SCALE_LABELS, LIMITS, MODALITY_LABELS, QUESTION_LABELS } from "@/domain/constants";
import { toPublicForm } from "@/domain/public-form";
import { api } from "@/lib/client";
import { useUnsaved } from "./AppShell";
import PublicSurvey from "./PublicSurvey";
import { btn, btnPrimary, fieldClass } from "./styles";
import { ErrorNote, FieldError } from "./ui";

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
    { id: crypto.randomUUID(), label: "", score: recruitment ? 5 : 0 },
    { id: crypto.randomUUID(), label: "", score: 0 },
  ];
}

function blankQuestion(type, modality) {
  const recruitment = modality === "recruitment";
  return {
    id: crypto.randomUUID(),
    type,
    prompt: "",
    required: type !== "long_text",
    scored: false,
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
    opensAt: toInputDate(form.opensAt),
    closesAt: toInputDate(form.closesAt),
    appearance: {
      primaryColor: form.appearance?.primaryColor || "#315ce8",
      logo: form.appearance?.logo || "",
      cover: form.appearance?.cover || "",
    },
    questions: (form.questions || []).map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt || "",
      required: Boolean(question.required),
      scored: Boolean(question.scored) || (question.type === "single" && Boolean(question.competencyId)),
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
      scored: recruitment && question.type === "single" && question.scored,
      competencyId: recruitment && question.type === "single" && question.scored ? question.competencyId || null : null,
      required: recruitment && question.type === "single" && question.scored ? true : question.required,
      options: CHOICE_TYPES.includes(question.type) ? question.options : [],
      scaleLabels: question.type === "scale" ? question.scaleLabels : [],
    })),
  };
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
  const [fields, setFields] = useState({});
  const [pending, setPending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [step, setStep] = useState("preguntas");
  const [selectedId, setSelectedId] = useState("");
  const [linkArea, setLinkArea] = useState("");
  const [linkVersion, setLinkVersion] = useState("");
  const [viewport, setViewport] = useState("desktop");
  const latest = useRef(null);
  const saving = useRef(false);
  const baselineRef = useRef("");

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [competencyData, areaData, form] = await Promise.all([
          api("/api/competencies"),
          api("/api/areas"),
          api(`/api/forms/${formId}`),
        ]);
        if (ignore) return;
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
    const snapshot = latest.current;
    if (!snapshot || saving.current) return false;
    if (meta?.status === "archived") return true;
    const serialized = JSON.stringify(snapshot);
    if (serialized === baselineRef.current) return true;
    saving.current = true;
    setPending(true);
    try {
      await api(`/api/forms/${formId}`, { method: "PATCH", body: JSON.stringify(toPayload(snapshot)) });
      if (JSON.stringify(latest.current) === serialized) {
        baselineRef.current = serialized;
        setBaseline(serialized);
        setError("");
        setFields({});
        setMeta((current) => current ? { ...current, hasUnpublishedChanges: true, status: current.publishedVersion > 0 ? current.status : "draft", title: snapshot.title } : current);
      }
      return true;
    } catch (saveError) {
      setError(saveError.message);
      setFields(saveError.fields || {});
      focusFieldErrors(saveError.fields || {});
      return false;
    } finally {
      saving.current = false;
      setPending(false);
    }
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
      setStep("preguntas");
      const index = Number(key.split(".")[1]);
      const question = latest.current?.questions?.[index];
      if (question) setSelectedId(question.id);
      return;
    }
    if (nextFields.logo || nextFields.cover || nextFields.primaryColor) setStep("diseno");
    else if (nextFields.title || nextFields.targetRole || nextFields.closesAt || nextFields.opensAt) setStep("configuracion");
  }

  async function act(path, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError("");
    setFields({});
    setMenu(false);
    const stored = await persist();
    if (!stored) return;
    setPending(true);
    try {
      await api(path, { method: "POST" });
      await refresh();
    } catch (actionError) {
      setError(actionError.message);
      setFields(actionError.fields || {});
      focusFieldErrors(actionError.fields || {});
    } finally {
      setPending(false);
    }
  }

  async function goTo(nextStep) {
    const stored = await persist();
    if (!stored) return;
    setStep(nextStep);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", nextStep);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  async function leave() {
    const stored = await persist();
    if (!stored) return;
    setDirty(false);
    router.push("/formularios");
  }

  if (!draft && !error) return <p className="text-sm text-muted">Cargando formulario…</p>;
  if (!draft) return <ErrorNote>{error}</ErrorNote>;

  const recruitment = draft.modality === "recruitment";
  const lockedModality = (meta?.publishedVersion || 0) > 0;
  const dirty = JSON.stringify(draft) !== baseline;
  const stepIndex = Math.max(0, STEPS.findIndex((item) => item.id === step));
  const nextStep = STEPS[stepIndex + 1];
  const previousStep = STEPS[stepIndex - 1];
  const live = meta?.status === "published" && !dirty && !meta?.hasUnpublishedChanges;
  const publishDisabled = pending || meta?.status === "archived" || (meta?.publishedVersion > 0 && !meta?.hasUnpublishedChanges && !dirty);

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WizardSteps current={step} onPick={goTo} />
          <button type="button" className={btn} disabled={pending} onClick={leave}>{pending ? "Guardando…" : "Salir"}</button>
        </div>
        <div className="flex flex-col gap-3 rounded-[16px] border border-line bg-white px-4 py-3 shadow-[0_7px_28px_rgba(38,61,100,0.04)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{draft.title || "Formulario sin título"}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${live ? "bg-[#e7f8ef] text-[#1f8a4c]" : "bg-[#eef3ff] text-brand"}`}>
                {live ? "Publicado" : "Borrador"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {MODALITY_LABELS[draft.modality]}
              <span className="px-1.5">·</span>
              Se guarda como borrador al cambiar de paso o al salir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button type="button" className={btn} aria-expanded={menu} onClick={() => setMenu((open) => !open)}>Más</button>
              {menu ? (
                <div className="absolute right-0 z-20 mt-2 w-52 rounded-[14px] border border-line bg-white p-1.5 shadow-[0_12px_32px_rgba(23,35,56,0.12)]">
                  <MenuButton onClick={async () => {
                    setMenu(false);
                    const stored = await persist();
                    if (!stored) return;
                    const copy = await api(`/api/forms/${formId}/duplicate`, { method: "POST" });
                    setDirty(false);
                    router.push(`/formularios/${copy.id}?paso=preguntas`);
                  }}>Duplicar</MenuButton>
                  {meta?.status === "published" ? <MenuButton onClick={() => act(`/api/forms/${formId}/close`, "¿Cerrar la recepción de respuestas?")}>Cerrar recepción</MenuButton> : null}
                  {meta?.status === "closed" ? <MenuButton onClick={() => act(`/api/forms/${formId}/reopen`)}>Reabrir recepción</MenuButton> : null}
                  {meta?.status !== "archived" ? <MenuButton onClick={() => act(`/api/forms/${formId}/archive`, "¿Archivar este formulario? Las respuestas se conservan.")}>Archivar</MenuButton> : null}
                  {meta?.status === "archived" ? <MenuButton onClick={() => act(`/api/forms/${formId}/restore`)}>Restaurar</MenuButton> : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {meta?.links?.length ? <PublishedLinks links={meta.links} onError={setError} /> : null}
      </div>

      <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
        {step === "crear" ? (
          <CreateStep draft={draft} fields={fields} lockedModality={lockedModality} onChange={setDraft} />
        ) : null}
        {step === "preguntas" ? (
          <QuestionsTab
            draft={draft}
            fields={fields}
            competencies={competencies}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={setDraft}
            onAdd={() => setAdding(true)}
          />
        ) : null}
        {step === "configuracion" ? (
          <ConfigStep draft={draft} fields={fields} onChange={setDraft} />
        ) : null}
        {step === "diseno" ? (
          <DesignStep draft={draft} fields={fields} viewport={viewport} onViewport={setViewport} onChange={setDraft} />
        ) : null}
        {step === "publicar" ? (
          <PublishStep
            formId={formId}
            draft={draft}
            meta={meta}
            areas={areas}
            recruitment={recruitment}
            linkArea={linkArea}
            linkVersion={linkVersion}
            pending={pending}
            publishDisabled={publishDisabled}
            onArea={setLinkArea}
            onVersion={setLinkVersion}
            onRefresh={refresh}
            onError={setError}
            onPublish={() => act(`/api/forms/${formId}/publish`)}
          />
        ) : null}
      </div>

      {step !== "publicar" ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[16px] border border-[#d9e4ff] bg-[#f5f8ff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {step === "preguntas"
              ? "Repite este paso para añadir más preguntas. Todo sigue en borrador."
              : "Puedes salir y volver después. El formulario no se publica hasta el último paso."}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {previousStep ? <button type="button" className={btn} disabled={pending} onClick={() => goTo(previousStep.id)}>Atrás</button> : null}
            {nextStep ? (
              <button type="button" className={btnPrimary} disabled={pending} onClick={() => goTo(nextStep.id)}>
                {pending ? "Guardando…" : `Continuar a ${nextStep.label.toLowerCase()}`}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {adding ? (
        <AddQuestionDialog
          onClose={() => setAdding(false)}
          onPick={(type) => {
            const question = blankQuestion(type, draft.modality);
            setDraft((current) => ({ ...current, questions: [...current.questions, question] }));
            setSelectedId(question.id);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuButton({ children, onClick }) {
  return <button type="button" className="block w-full rounded-[10px] px-3 py-2 text-left text-sm font-semibold hover:bg-[#f4f7ff]" onClick={onClick}>{children}</button>;
}

function QuestionsTab({ draft, fields, competencies, selectedId, onSelect, onChange, onAdd }) {
  const selected = draft.questions.find((question) => question.id === selectedId) || draft.questions[0] || null;
  const selectedIndex = selected ? draft.questions.findIndex((question) => question.id === selected.id) : -1;
  const recruitment = draft.modality === "recruitment";

  function replace(next) {
    onChange({
      ...draft,
      questions: draft.questions.map((question) => (question.id === next.id ? next : question)),
    });
  }

  function move(direction) {
    if (!selected) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= draft.questions.length) return;
    const questions = [...draft.questions];
    const [item] = questions.splice(selectedIndex, 1);
    questions.splice(target, 0, item);
    onChange({ ...draft, questions });
  }

  function duplicate() {
    if (!selected) return;
    const clone = {
      ...selected,
      id: crypto.randomUUID(),
      options: selected.options.map((option) => ({ ...option, id: crypto.randomUUID() })),
      scaleLabels: [...selected.scaleLabels],
    };
    const questions = [...draft.questions];
    questions.splice(selectedIndex + 1, 0, clone);
    onChange({ ...draft, questions });
    onSelect(clone.id);
  }

  function remove() {
    if (!selected) return;
    const questions = draft.questions.filter((question) => question.id !== selected.id);
    onChange({ ...draft, questions });
    onSelect(questions[Math.max(0, selectedIndex - 1)]?.id || "");
  }

  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="flex h-full flex-col rounded-[16px] border border-line bg-white p-4 shadow-[0_7px_28px_rgba(38,61,100,0.04)]">
        <p className="flex h-8 items-center text-base font-semibold">Preguntas ({draft.questions.length})</p>
        <div className="mt-3 space-y-1 pb-4">
          {draft.questions.map((question, index) => {
            const active = question.id === selected?.id;
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onSelect(question.id)}
                className={`grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-2 rounded-[12px] px-2 py-2.5 text-left ${active ? "bg-[#f3f7ff] shadow-[inset_3px_0_0_#315ce8]" : "hover:bg-[#f7f9fc]"}`}
              >
                <span className={`text-center text-sm font-semibold leading-5 ${active ? "text-brand" : "text-muted"}`}>{index + 1}</span>
                <span className="min-w-0">
                  <span className={`line-clamp-2 block text-sm font-semibold leading-5 ${active ? "text-brand" : ""}`}>{question.prompt || "Pregunta sin enunciado"}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs leading-4 text-muted">
                    <TypeMark type={question.type} />
                    {QUESTION_LABELS[question.type]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="mt-auto flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-[#d5defb] bg-white px-3 text-sm font-bold text-brand hover:bg-[#f4f7ff]" onClick={onAdd}>
          <span aria-hidden="true">+</span> Añadir pregunta
        </button>
      </aside>

      <section className="min-w-0 h-full">
        {selected ? (
          <QuestionCanvas
            question={selected}
            index={selectedIndex}
            total={draft.questions.length}
            recruitment={recruitment}
            onChange={replace}
            onMove={move}
            canUp={selectedIndex > 0}
            canDown={selectedIndex < draft.questions.length - 1}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[16px] border border-dashed border-[#c9d3e6] bg-white px-4 py-16 text-center">
            <p className="text-sm text-muted">Este formulario todavía no tiene preguntas.</p>
            <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-[12px] border border-[#d5defb] px-4 py-2.5 text-sm font-bold text-brand" onClick={onAdd}>Añadir la primera pregunta</button>
          </div>
        )}
      </section>

      <aside className="h-full rounded-[16px] border border-line bg-white p-4 shadow-[0_7px_28px_rgba(38,61,100,0.04)]">
        {selected ? (
          <QuestionProperties
            question={selected}
            index={selectedIndex}
            recruitment={recruitment}
            competencies={competencies}
            fields={fields}
            onChange={replace}
            onDuplicate={duplicate}
            onRemove={remove}
          />
        ) : (
          <p className="text-sm text-muted">Añade una pregunta para ver sus propiedades.</p>
        )}
      </aside>
    </div>
  );
}

function QuestionCanvas({ question, index, total, recruitment, onChange, onMove, canUp, canDown }) {
  const scorable = recruitment && question.type === "single" && question.scored;
  const optionRow = scorable
    ? "grid grid-cols-[20px_minmax(0,1fr)_74px_44px_44px] items-center gap-2"
    : "grid grid-cols-[20px_minmax(0,1fr)_44px_44px] items-center gap-2";

  function updateOption(id, patch) {
    onChange({
      ...question,
      options: question.options.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  }

  function duplicateOption(option) {
    const optionIndex = question.options.findIndex((item) => item.id === option.id);
    const options = [...question.options];
    options.splice(optionIndex + 1, 0, { ...option, id: crypto.randomUUID() });
    onChange({ ...question, options });
  }

  return (
    <article className="h-full rounded-[16px] border border-line bg-white p-4 shadow-[0_7px_28px_rgba(38,61,100,0.04)]">
      <div className="flex h-8 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted">Pregunta {index + 1} de {total}</h2>
        <div className="flex h-8 overflow-hidden rounded-[10px] border border-line">
          <button type="button" aria-label="Subir" disabled={!canUp} onClick={() => onMove(-1)} className="grid w-8 place-items-center border-r border-line text-muted disabled:opacity-40"><Chevron direction="up" /></button>
          <button type="button" aria-label="Bajar" disabled={!canDown} onClick={() => onMove(1)} className="grid w-8 place-items-center text-muted disabled:opacity-40"><Chevron direction="down" /></button>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Enunciado de la pregunta</span>
        <textarea
          rows={2}
          className={`${fieldClass} mt-1.5 min-h-0 resize-y`}
          placeholder="Escribe la pregunta"
          value={question.prompt}
          onChange={(event) => onChange({ ...question, prompt: event.target.value })}
        />
      </label>

      {CHOICE_TYPES.includes(question.type) ? (
        <div className="mt-5">
          <div className={`${optionRow} mb-2`}>
            <span />
            <span className="text-sm font-semibold">Opciones de respuesta</span>
            {scorable ? <span className="text-center text-xs font-semibold text-muted">puntos</span> : null}
            <span />
            <span />
          </div>
          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <div key={option.id} className={optionRow}>
                <span className="grid h-11 place-items-center text-muted"><GripIcon /></span>
                <label className="flex h-11 min-w-0 items-center gap-2 rounded-[10px] border border-[#dce2ec] bg-white px-3 focus-within:border-[#5b7af1] focus-within:ring-4 focus-within:ring-brand/10">
                  <ChoiceMark type={question.type} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    placeholder={`Opción ${optionIndex + 1}`}
                    value={option.label}
                    onChange={(event) => updateOption(option.id, { label: event.target.value })}
                  />
                </label>
                {scorable ? (
                  <ScoreStepper
                    value={option.score}
                    label={`Puntos de la opción ${optionIndex + 1}`}
                    onChange={(score) => updateOption(option.id, { score })}
                  />
                ) : null}
                <IconButton label="Duplicar opción" onClick={() => duplicateOption(option)}><CopyIcon /></IconButton>
                <IconButton
                  label="Quitar opción"
                  disabled={question.options.length <= 2}
                  onClick={() => onChange({ ...question, options: question.options.filter((item) => item.id !== option.id) })}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#eef3ff] px-3 py-2 text-sm font-bold text-brand"
            onClick={() => onChange({ ...question, options: [...question.options, { id: crypto.randomUUID(), label: "", score: 0 }] })}
          >
            <span aria-hidden="true">+</span> Añadir opción
          </button>
        </div>
      ) : null}

      {question.type === "scale" ? (
        <div className="mt-5">
          <span className="text-sm font-semibold">Etiquetas de la escala</span>
          <div className="mt-2 space-y-2">
            {question.scaleLabels.map((label, labelIndex) => (
              <label key={labelIndex} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2">
                <span className="grid h-11 place-items-center rounded-[10px] bg-[#eef3ff] text-sm font-bold text-brand">{labelIndex + 1}</span>
                <input
                  className={`${fieldClass} h-11`}
                  value={label}
                  onChange={(event) => onChange({
                    ...question,
                    scaleLabels: question.scaleLabels.map((item, itemIndex) => (itemIndex === labelIndex ? event.target.value : item)),
                  })}
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {question.type === "short_text" ? (
        <p className="mt-4 rounded-[12px] border border-dashed border-[#d5deec] bg-[#f8fafc] px-3 py-3 text-sm text-muted">Quien responde escribe una línea. No suma puntos.</p>
      ) : null}
      {question.type === "long_text" ? (
        <p className="mt-4 rounded-[12px] border border-dashed border-[#d5deec] bg-[#f8fafc] px-3 py-6 text-sm text-muted">Quien responde escribe un comentario. No suma puntos.</p>
      ) : null}
      {question.type === "yes_no" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {["Sí", "No"].map((label) => (
            <div key={label} className="flex h-11 items-center justify-center rounded-[10px] border border-dashed border-[#d5deec] bg-[#f8fafc] text-sm font-semibold text-muted">{label}</div>
          ))}
        </div>
      ) : null}
      {question.type === "rating" ? (
        <div className="mt-4 flex h-11 items-center gap-1 rounded-[10px] border border-dashed border-[#d5deec] bg-[#f8fafc] px-3 text-lg text-[#f5b942]">★★★★★</div>
      ) : null}
      {LOCKED_TYPES.includes(question.type) ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">Campo bloqueado</p>
          <div className="mt-1.5 flex h-11 items-center rounded-[10px] border border-dashed border-[#d5deec] bg-[#f8fafc] px-3 text-sm text-muted">
            {LOCKED_PREVIEW[question.type]}
          </div>
          <p className="mt-1 text-xs text-muted">{QUESTION_TYPES.find((item) => item.type === question.type)?.hint} No suma puntos.</p>
        </div>
      ) : null}
    </article>
  );
}

function QuestionProperties({ question, index, recruitment, competencies, fields, onChange, onDuplicate, onRemove }) {
  const scorable = recruitment && question.type === "single" && question.scored;
  const typeInfo = QUESTION_TYPES.find((item) => item.type === question.type);
  function changeType(type) {
    onChange({
      ...question,
      type,
      scored: type === "single" ? question.scored : false,
      required: recruitment && type === "single" && question.scored ? true : question.required,
      options: CHOICE_TYPES.includes(type) && question.options.length < 2 ? starterOptions(recruitment) : question.options,
      scaleLabels: question.scaleLabels?.length === 5 ? question.scaleLabels : [...DEFAULT_SCALE_LABELS],
    });
  }
  return (
    <div className="flex h-full flex-col">
      <h2 className="flex h-8 items-center text-base font-semibold">Propiedades de la pregunta</h2>
      <label className="mt-4 block space-y-1.5">
        <span className="text-sm font-semibold">Tipo de pregunta</span>
        <select className={fieldClass} value={question.type} onChange={(event) => changeType(event.target.value)}>
          {QUESTION_TYPES.map((item) => <option key={item.type} value={item.type}>{item.title}</option>)}
        </select>
        {typeInfo ? <p className="text-xs leading-5 text-muted">{typeInfo.hint}{LOCKED_TYPES.includes(question.type) || question.type === "yes_no" ? " Quien responde no puede escribir otro tipo de dato." : ""}</p> : null}
      </label>
      <div className="mt-4">
        <Toggle
          checked={scorable || question.required}
          disabled={scorable}
          label="Obligatoria"
          hint={scorable ? "Si esta pregunta se evalúa, hay que responderla." : "La persona tiene que responderla para continuar."}
          onChange={(required) => onChange({ ...question, required })}
        />
      </div>
      {recruitment && question.type === "single" ? (
        <div className="mt-4">
          <Toggle
            checked={question.scored}
            label="Evaluar esta pregunta"
            hint="Se asignan puntos según la opción elegida. Si lo dejas apagado, la pregunta no suma a la competencia."
            onChange={(scored) => onChange({ ...question, scored, required: scored ? true : question.required })}
          />
        </div>
      ) : null}
      {scorable ? (
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-semibold">Competencia relacionada</span>
          <select className={fieldClass} value={question.competencyId} onChange={(event) => onChange({ ...question, competencyId: event.target.value })}>
            <option value="">Selecciona una competencia</option>
            {competencies.filter((item) => item.active || item.id === question.competencyId).map((item) => (
              <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inactiva)"}</option>
            ))}
          </select>
          <FieldError>{fields[`questions.${index}.competencyId`]}</FieldError>
          <p className="text-xs leading-5 text-muted">Los puntos de las opciones cuentan para esta competencia. Quien responde no los ve.</p>
        </label>
      ) : null}
      <div className="mt-3">
        <FieldError>{fields[`questions.${index}.prompt`] || fields[`questions.${index}.options`] || fields[`questions.${index}.score`]}</FieldError>
      </div>
      {!recruitment && (question.type === "email" || question.type === "phone") ? (
        <p className="mt-3 text-xs leading-5 text-muted">En una encuesta de área este dato no se liga a una cuenta, pero quien lo escribe queda identificado en la respuesta guardada.</p>
      ) : null}
      {question.type === "scale" && !recruitment ? (
        <p className="mt-3 text-xs leading-5 text-muted">Las escalas se promedian cuando el grupo tiene al menos 5 respuestas.</p>
      ) : null}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
        <button type="button" className="h-11 rounded-[10px] border border-[#ffd0d0] text-sm font-bold text-[#c44545]" onClick={onRemove}>Eliminar</button>
        <button type="button" className="h-11 rounded-[10px] border border-line text-sm font-bold" onClick={onDuplicate}>Duplicar</button>
      </div>
    </div>
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

function resizeImage(file, maxEdge) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      reject(new Error("Usa una imagen PNG o JPG."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const image = new Image();
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
  const href = recruitment ? `/formularios/${formId}/resultados` : `/clima?formId=${formId}`;
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
            <p className="mt-1 text-sm text-[#3d6b52]">Comparte el enlace o el código QR. Las respuestas quedan en esta versión.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold">{published ? "Publicar los cambios" : "Publicar"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {published
                ? "Los enlaces que ya existen siguen en su versión. Publicar crea una versión nueva."
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
            <Image src={`/api/links/${link.id}/qr`} alt="Código QR" width={96} height={96} unoptimized style={{ width: 96, height: 96 }} className="shrink-0 rounded-[12px] border border-line bg-white p-1" />
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
              <Image
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
      {links.length ? <p className="mt-3 text-xs leading-5 text-muted">Un enlace nuevo no cambia los anteriores. Cada código sigue apuntando a la versión con la que se creó.</p> : null}
    </div>
  );
}

function AddQuestionDialog({ onClose, onPick }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[#0c1634]/45 p-4" onClick={onClose}>
      <div className="max-h-[min(720px,85vh)] w-full max-w-3xl overflow-y-auto rounded-[18px] bg-white p-5 shadow-[0_18px_50px_rgba(12,22,52,0.2)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Elige el tipo de pregunta</h2>
            <p className="mt-1 text-sm text-muted">Después podrás cambiar el tipo y editar el contenido.</p>
          </div>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-lg text-muted hover:bg-[#f4f7fb]" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUESTION_TYPES.map((item) => (
            <button key={item.type} type="button" onClick={() => onPick(item.type)} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-3 text-left hover:border-brand hover:bg-[#f7f9ff]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#f3f6fb] text-brand"><TypeMark type={item.type} large /></span>
              <span>
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, label, hint, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {hint ? <p className="text-xs leading-5 text-muted">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full disabled:opacity-70 ${checked ? "bg-brand" : "bg-[#d5dbe6]"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function IconButton({ label, disabled, onClick, children }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid h-11 w-full place-items-center rounded-[10px] border border-line text-muted hover:text-ink disabled:opacity-40">
      {children}
    </button>
  );
}

function ScoreStepper({ value, label, onChange }) {
  const score = Number.isInteger(value) ? value : 0;
  return (
    <div className="flex h-11 w-full items-center justify-between rounded-[10px] border border-[#dce2ec] px-2">
      <span className="text-sm font-semibold">{score}</span>
      <span className="flex flex-col">
        <button type="button" aria-label={`Subir ${label}`} className="text-muted" onClick={() => onChange(Math.min(5, score + 1))}><Chevron direction="up" /></button>
        <button type="button" aria-label={`Bajar ${label}`} className="text-muted" onClick={() => onChange(Math.max(0, score - 1))}><Chevron direction="down" /></button>
      </span>
    </div>
  );
}

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
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
  if (type === "multiple") return <span className="h-4 w-4 shrink-0 rounded-[4px] border border-[#c5cedd]" />;
  if (type === "dropdown") return <span className="shrink-0 text-xs text-muted">▾</span>;
  return <span className="h-4 w-4 shrink-0 rounded-full border border-[#c5cedd]" />;
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
