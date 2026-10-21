"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LIMITS } from "@/domain/constants";
import { FORM_TEMPLATES, materializeTemplate } from "@/domain/form-templates";
import { api } from "@/lib/client";
import { useUnsaved } from "./AppShell";
import { btn, btnPrimary, fieldClass } from "./styles";
import { ErrorNote, FieldError } from "./ui";

export default function FormCreate() {
  const router = useRouter();
  const { setDirty } = useUnsaved();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [modality, setModality] = useState("recruitment");
  const [start, setStart] = useState("blank");
  const [step, setStep] = useState("setup");
  const [templateId, setTemplateId] = useState("");
  const [competencies, setCompetencies] = useState([]);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;
    api("/api/competencies")
      .then((data) => {
        if (!ignore) setCompetencies(data.items || []);
      })
      .catch(() => {
        if (!ignore) setCompetencies([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setDirty(Boolean(title.trim() || description.trim()));
    return () => setDirty(false);
  }, [description, setDirty, title]);

  const templates = FORM_TEMPLATES.filter((item) => item.modality === modality);
  const selectedTemplate = templates.find((item) => item.id === templateId) || templates[0];
  const recruitment = modality === "recruitment";

  async function create(template) {
    setPending(true);
    setError("");
    setFields({});
    try {
      const created = await api("/api/forms", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          modality,
          targetRole: recruitment ? targetRole.trim() : "",
          questions: template ? materializeTemplate(template, competencies) : [],
        }),
      });
      setDirty(false);
      router.push(`/formularios/${created.id}?paso=preguntas`);
    } catch (createError) {
      setError(createError.message);
      setFields(createError.fields || {});
      setStep("setup");
    } finally {
      setPending(false);
    }
  }

  function continueSetup() {
    if (!title.trim()) {
      setFields({ title: "Escribe el nombre del formulario." });
      return;
    }
    if (start === "template") {
      setTemplateId(templates[0]?.id || "");
      setStep("templates");
      return;
    }
    create(null);
  }

  return (
    <div>
      <p className="text-sm text-muted">
        <Link href="/formularios" className="hover:text-ink">Formularios</Link>
        <span className="px-1.5">/</span>
        <span>{step === "templates" ? "Plantillas" : "Crear formulario"}</span>
      </p>
      {step === "setup" ? (
        <Setup
          title={title}
          description={description}
          targetRole={targetRole}
          modality={modality}
          start={start}
          fields={fields}
          error={error}
          pending={pending}
          onTitle={setTitle}
          onDescription={setDescription}
          onRole={setTargetRole}
          onModality={setModality}
          onStart={setStart}
          onContinue={continueSetup}
        />
      ) : (
        <TemplateLibrary
          templates={templates}
          selected={selectedTemplate}
          recruitment={recruitment}
          pending={pending}
          onSelect={setTemplateId}
          onBack={() => setStep("setup")}
          onUse={() => selectedTemplate && create(selectedTemplate)}
        />
      )}
    </div>
  );
}

function Setup({
  title, description, targetRole, modality, start, fields, error, pending,
  onTitle, onDescription, onRole, onModality, onStart, onContinue,
}) {
  const recruitment = modality === "recruitment";
  return (
    <>
      <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        {["Crear", "Preguntas", "Configuración", "Diseño", "Publicar"].map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index === 0 ? "bg-brand text-white" : "bg-[#eef1f6] text-muted"}`}>{index + 1}</span>
            <span className={index === 0 ? "font-semibold" : "text-muted"}>{label}</span>
            {index < 4 ? <span className="text-muted">→</span> : null}
          </li>
        ))}
      </ol>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Crear formulario</h1>
      <p className="mt-1 text-sm text-muted">Define la información básica y el propósito antes de añadir preguntas.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="mt-6 rounded-[18px] border border-line bg-white p-5 shadow-[0_7px_28px_rgba(38,61,100,0.05)] md:p-6">
          <h2 className="text-lg font-semibold">1. Información general</h2>
          <label className="mt-3 block space-y-1">
            <span className="text-base font-semibold">Nombre del formulario</span>
            <input className={fieldClass} value={title} maxLength={LIMITS.title} onChange={(event) => onTitle(event.target.value)} placeholder="Evaluación de clima organizacional" />
            <FieldError>{fields.title}</FieldError>
          </label>
          <label className="mt-3 block space-y-1">
            <span className="text-base font-semibold">Descripción</span>
            <textarea rows={2} className={`${fieldClass} min-h-0 resize-y`} value={description} maxLength={LIMITS.description} onChange={(event) => onDescription(event.target.value)} placeholder="Cuéntale a quien responde de qué trata este formulario." />
            <span className="block text-right text-xs text-muted">{description.length}/{LIMITS.description}</span>
          </label>

          <h2 className="mt-5 text-lg font-semibold">2. Propósito del formulario</h2>
          <p className="mt-1 text-sm text-muted">Elige si vas a evaluar candidaturas o a encuestar un área.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Choice
              selected={modality === "climate"}
              title="Recolectar información"
              text="Encuesta anónima para las áreas. Sirve para opiniones del equipo, sin nombre ni correo."
              icon={<DocIcon />}
              onClick={() => onModality("climate")}
            />
            <Choice
              selected={modality === "recruitment"}
              title="Evaluar personas"
              text="Evaluación de personas candidatas. Pide nombre y correo, y mide competencias para la revisión de RH."
              icon={<PeopleIcon />}
              onClick={() => onModality("recruitment")}
            />
          </div>
          {recruitment ? (
            <label className="mt-4 block space-y-1.5">
              <span className="text-base font-semibold">Puesto que se está evaluando</span>
              <input className={fieldClass} value={targetRole} maxLength={LIMITS.role} onChange={(event) => onRole(event.target.value)} placeholder="Operador de producción" />
              <p className="text-xs text-muted">Lo usa RH. Quien responde no ve este dato. Hace falta para publicar.</p>
              <FieldError>{fields.targetRole}</FieldError>
            </label>
          ) : null}

          <h2 className="mt-5 text-lg font-semibold">3. ¿Cómo deseas comenzar?</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Choice
              selected={start === "blank"}
              title="Comenzar desde cero"
              text="Crea las preguntas una por una, con el tipo que necesites."
              icon={<PlusIcon />}
              onClick={() => onStart("blank")}
            />
            <Choice
              selected={start === "template"}
              title="Usar plantilla"
              text={recruitment ? "Parte de escenarios de evaluación y ajústalos al puesto." : "Parte de una encuesta de área y ajusta las escalas."}
              icon={<DocIcon />}
              onClick={() => onStart("template")}
            />
          </div>

          <p className="mt-4 rounded-[12px] bg-[#f5f8ff] px-3 py-2 text-xs leading-5 text-muted">La puntuación es opcional. Puedes crear preguntas con o sin calificación. El formulario queda en borrador hasta que lo publiques.</p>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <Link href="/formularios" className={btn}>Cancelar</Link>
            <button type="button" className={btnPrimary} disabled={pending} onClick={onContinue}>
              {pending ? "Creando…" : start === "template" ? "Elegir plantilla" : "Crear y añadir preguntas"}
              {pending ? null : <span aria-hidden="true">→</span>}
            </button>
          </div>
      </div>
    </>
  );
}

function Choice({ selected, title, text, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[14px] border px-3 py-2.5 text-left ${selected ? "border-brand bg-[#f5f8ff] ring-4 ring-brand/10" : "border-line bg-white hover:border-[#c9d4f5]"}`}
    >
      <span className="flex items-center gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${selected ? "bg-white text-brand" : "bg-[#f3f6fb] text-[#607089]"}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="text-base font-semibold leading-5">{title}</span>
            <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-brand" : "border-[#c5cedd]"}`}>
              {selected ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
            </span>
          </span>
          <span className="mt-0.5 block text-sm leading-5 text-muted">{text}</span>
        </span>
      </span>
    </button>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M4 2.5h5l3 3V13.5H4v-11Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 2.5V5.5h3M6 8h4M6 10.5h4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <circle cx="6" cy="5.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 12.5c.4-2 1.7-3 3.2-3s2.8 1 3.2 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 12.5c.3-1.4 1.1-2.2 2.2-2.2 1 0 1.7.6 2.1 1.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TemplateLibrary({ templates, selected, recruitment, pending, onSelect, onBack, onUse }) {
  return (
    <>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plantillas</h1>
          <p className="mt-1 text-sm text-muted">
            {recruitment
              ? "Evaluaciones listas para personas candidatas. Después puedes cambiar preguntas, puntos y competencias."
              : "Encuestas listas para un área. Después puedes cambiar las escalas. Siguen siendo anónimas."}
          </p>
        </div>
        <button type="button" className={btn} onClick={onBack}>Volver</button>
      </div>
      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template.id)}
              className={`rounded-[16px] border bg-white p-4 text-left shadow-[0_7px_28px_rgba(38,61,100,0.04)] ${selected?.id === template.id ? "border-brand ring-4 ring-brand/10" : "border-line"}`}
            >
              <span className="inline-flex rounded-full bg-[#eef2ff] px-2 py-0.5 text-[11px] font-bold text-brand">{template.category}</span>
              <span className="mt-2 block text-base font-semibold">{template.title}</span>
              <span className="mt-1 block text-sm leading-5 text-muted">{template.description}</span>
              <span className="mt-3 block text-xs text-muted">{template.questions.length} preguntas · {template.minutes}</span>
            </button>
          ))}
        </div>
        {selected ? (
          <aside className="rounded-[16px] border border-line bg-white p-4 shadow-[0_7px_28px_rgba(38,61,100,0.05)]">
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            <p className="mt-1 text-sm text-muted">{selected.description}</p>
            <p className="mt-3 text-xs font-bold tracking-[0.14em] text-muted uppercase">Preguntas incluidas</p>
            <ol className="mt-2 space-y-2">
              {selected.questions.map((question, index) => (
                <li key={`${selected.id}-${index}`} className="text-sm">
                  <span className="font-bold text-brand">{index + 1}. </span>
                  {question.prompt}
                </li>
              ))}
            </ol>
            <button type="button" className={`${btnPrimary} mt-5 w-full`} disabled={pending} onClick={onUse}>
              {pending ? "Creando…" : "Usar plantilla"}
            </button>
          </aside>
        ) : null}
      </div>
    </>
  );
}
