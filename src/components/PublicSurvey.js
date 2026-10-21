"use client";

import { useMemo, useState } from "react";
import { LIMITS, QUESTION_LABELS } from "@/domain/constants";
import { fieldError, isLockedField, restrictInput } from "@/domain/fields";
import { fieldLg } from "./styles";
import { FieldError } from "./ui";

function answered(question, value) {
  if (!value) return false;
  if (question.type === "single" || question.type === "dropdown") return Boolean(value.optionId);
  if (question.type === "multiple") return Array.isArray(value.optionIds) && value.optionIds.length > 0;
  if (question.type === "scale" || question.type === "rating") return Number.isInteger(value.scaleValue) && value.scaleValue >= 1 && value.scaleValue <= 5;
  if (question.type === "yes_no") return value.text === "sí" || value.text === "no";
  return Boolean(String(value.text || "").trim());
}

function kindLabel(question, modality) {
  if (question.type === "single") return modality === "recruitment" ? "Situación" : "Opción única";
  if (question.type === "long_text") return "Pregunta abierta";
  return QUESTION_LABELS[question.type] || "Pregunta";
}

export default function PublicSurvey({ token, initial, embedded = false }) {
  const form = initial?.form;
  const questions = useMemo(() => form?.questions || [], [form]);
  const steps = useMemo(() => {
    const items = [];
    if (form?.requiresIdentity) items.push({ kind: "identity" });
    questions.forEach((question, index) => items.push({ kind: "question", question, index }));
    return items;
  }, [form?.requiresIdentity, questions]);
  const [stepIndex, setStepIndex] = useState(0);
  const [identity, setIdentity] = useState({ name: "", email: "" });
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [stepMessage, setStepMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState("");
  const [formError, setFormError] = useState("");
  const step = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))] || null;
  const progress = steps.length ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0;

  if (!initial?.available) {
    return (
      <Shell embedded={embedded}>
        <h1 className="text-2xl font-semibold tracking-tight">{initial?.title || "Formulario no disponible"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{initial?.message || "Este enlace no recibe respuestas."}</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell embedded={embedded}>
        <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">Respuesta recibida</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{form.title}</h1>
        <p className="mt-4 text-base leading-7">{done}</p>
      </Shell>
    );
  }

  function setAnswer(id, value) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setStepMessage("");
  }

  function currentStepError(current = step) {
    if (!current) return "Este formulario no tiene preguntas.";
    if (current.kind === "identity") {
      if (!identity.name.trim()) return "Escribe tu nombre.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim())) return "Escribe un correo válido.";
      return "";
    }
    const question = current.question;
    const text = String(answers[question.id]?.text || "");
    if (question.required && !answered(question, answers[question.id])) return "Esta respuesta es obligatoria.";
    const format = fieldError(question.type, text);
    if (format) return format;
    if (question.type === "short_text" && text.length > LIMITS.short) return `El texto admite hasta ${LIMITS.short} caracteres.`;
    if (question.type === "long_text" && text.length > LIMITS.long) return `El texto admite hasta ${LIMITS.long} caracteres.`;
    return "";
  }

  function goNext() {
    const message = currentStepError();
    if (message) {
      setStepMessage(message);
      return;
    }
    setStepMessage("");
    if (stepIndex < steps.length - 1) {
      setStepIndex((current) => current + 1);
      return;
    }
    submit();
  }

  async function submit() {
    if (embedded) {
      setDone(form.confirmationMessage || "Vista previa. Esta respuesta no se guardó.");
      return;
    }
    for (let index = 0; index < steps.length; index += 1) {
      const message = currentStepError(steps[index]);
      if (message) {
        setStepIndex(index);
        setStepMessage(message);
        return;
      }
    }
    setFormError("");
    setErrors({});
    setPending(true);
    const storageKey = `maplasa_submit_${token}`;
    let idempotencyKey = sessionStorage.getItem(storageKey);
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
    }
    try {
      const response = await fetch(`/api/public/forms/${token}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          ...(form.requiresIdentity ? identity : {}),
          answers: questions.map((question) => ({ questionId: question.id, ...(answers[question.id] || {}) })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        const nextErrors = data?.error?.fields || {};
        setErrors(nextErrors);
        setFormError(data?.error?.message || "No se pudo enviar el formulario.");
        const questionIndex = questions.findIndex((question) => nextErrors[question.id]);
        if (nextErrors.name || nextErrors.email) setStepIndex(0);
        else if (questionIndex >= 0) setStepIndex(questionIndex + (form.requiresIdentity ? 1 : 0));
        return;
      }
      sessionStorage.removeItem(storageKey);
      setDone(data.confirmationMessage || form.confirmationMessage || "Recibimos tu respuesta.");
    } catch {
      setFormError("No se pudo enviar. Puedes intentar de nuevo; no se duplicará esta solicitud.");
    } finally {
      setPending(false);
    }
  }

  const last = stepIndex >= steps.length - 1;
  const color = form.appearance?.primaryColor || "#315ce8";
  const subtitle = form.modality === "climate"
    ? "Encuesta anónima. No pedimos nombre ni correo."
    : (form.description || "Responde según cómo actuarías en cada situación.");

  return (
    <Shell embedded={embedded} color={color} logo={form.appearance?.logo} cover={form.appearance?.cover}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-[#17233b] md:text-[28px]">{form.title}</h1>
      <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-6 text-muted">{form.instructions || subtitle}</p>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e6ebf3]">
          <div className="h-full rounded-full" style={{ width: `${Math.max(progress, steps.length ? 8 : 0)}%`, background: color }} />
        </div>
        <span className="shrink-0 text-sm text-muted">{steps.length ? `${stepIndex + 1} de ${steps.length}` : "0 de 0"}</span>
      </div>
      <div className="mt-5">
        {step?.kind === "identity" ? (
          <section className="rounded-[16px] border border-line p-5">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eaf1ff] text-sm font-bold text-brand">1</span>
              Identificación
            </div>
            <h2 className="mt-3 text-lg font-semibold">¿Quién responde esta evaluación?</h2>
            <div className="mt-4 grid gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Nombre completo</span>
                <input className={fieldLg} value={identity.name} autoComplete="name" onChange={(event) => { setIdentity({ ...identity, name: event.target.value }); setStepMessage(""); }} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">Correo electrónico</span>
                <input className={fieldLg} type="email" value={identity.email} autoComplete="email" onChange={(event) => { setIdentity({ ...identity, email: event.target.value }); setStepMessage(""); }} />
              </label>
            </div>
          </section>
        ) : null}
        {step?.kind === "question" ? (
          <QuestionCard
            question={step.question}
            number={step.index + 1}
            modality={form.modality}
            value={answers[step.question.id]}
            onChange={(value) => setAnswer(step.question.id, value)}
          />
        ) : null}
        {!step ? <p className="text-sm text-muted">Este formulario no tiene preguntas para responder.</p> : null}
      </div>
      <FieldError>{stepMessage || (step?.kind === "question" ? errors[step.question.id] : "") || errors.name || errors.email}</FieldError>
      {formError ? <div className="mt-3"><FieldError>{formError}</FieldError></div> : null}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"
          disabled={stepIndex === 0 || pending}
          onClick={() => { setStepMessage(""); setStepIndex((current) => Math.max(0, current - 1)); }}
        >
          ← Atrás
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: color }}
          disabled={pending || !step}
          onClick={goNext}
        >
          {pending ? "Enviando…" : last ? "Enviar" : "Continuar"} {pending || last ? null : <span aria-hidden="true">→</span>}
        </button>
      </div>
      {embedded ? <p className="mt-4 text-center text-xs text-muted">Vista previa. Las respuestas de esta pantalla no se guardan.</p> : null}
    </Shell>
  );
}

function QuestionCard({ question, number, modality, value, onChange }) {
  const max = question.type === "long_text" ? LIMITS.long : LIMITS.short;
  return (
    <section className="rounded-[16px] border border-line p-5">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#eaf1ff] text-sm font-bold text-brand">{number}</span>
        {kindLabel(question, modality)}
        {question.required ? null : <span className="text-xs">· Opcional</span>}
      </div>
      <h2 className="mt-3 text-lg font-semibold leading-7">{question.prompt}</h2>
      <div className="mt-4">
        {question.type === "single" || question.type === "multiple" ? (
          <div className="space-y-2">
            {question.options.map((option) => {
              const selected = question.type === "multiple"
                ? (value?.optionIds || []).includes(option.id)
                : value?.optionId === option.id;
              return (
                <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-3 text-sm ${selected ? "border-[#8eafff] bg-[#f5f8ff]" : "border-[#e6ebf3]"}`}>
                  <input
                    type={question.type === "multiple" ? "checkbox" : "radio"}
                    className="mt-0.5 accent-brand"
                    name={question.id}
                    checked={selected}
                    onChange={() => {
                      if (question.type === "multiple") {
                        const current = value?.optionIds || [];
                        const optionIds = current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id];
                        onChange({ optionIds });
                        return;
                      }
                      onChange({ optionId: option.id });
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        ) : null}
        {question.type === "dropdown" ? (
          <select className={fieldLg} value={value?.optionId || ""} onChange={(event) => onChange(event.target.value ? { optionId: event.target.value } : {})}>
            <option value="">Selecciona una opción</option>
            {question.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        ) : null}
        {question.type === "yes_no" ? (
          <div className="grid grid-cols-2 gap-2">
            {[["sí", "Sí"], ["no", "No"]].map(([answer, label]) => {
              const selected = value?.text === answer;
              return (
                <label key={answer} className={`cursor-pointer rounded-[12px] border px-3 py-4 text-center text-sm font-semibold ${selected ? "border-[#8eafff] bg-[#f5f8ff]" : "border-[#e6ebf3]"}`}>
                  <input type="radio" className="sr-only" name={question.id} checked={selected} onChange={() => onChange({ text: answer })} />
                  {label}
                </label>
              );
            })}
          </div>
        ) : null}
        {question.type === "rating" ? (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((scaleValue) => {
              const selected = Number(value?.scaleValue) >= scaleValue;
              return (
                <button key={scaleValue} type="button" aria-label={`${scaleValue} de 5`} className={`text-3xl ${selected ? "text-[#f5b942]" : "text-[#d5dbe6]"}`} onClick={() => onChange({ scaleValue })}>★</button>
              );
            })}
          </div>
        ) : null}
        {question.type === "scale" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {question.scaleLabels.map((label, index) => {
              const scaleValue = index + 1;
              const selected = value?.scaleValue === scaleValue;
              return (
                <label key={`${scaleValue}-${label}`} className={`cursor-pointer rounded-[12px] border px-2 py-3 text-center ${selected ? "border-[#8eafff] bg-[#f5f8ff]" : "border-[#e6ebf3]"}`}>
                  <input type="radio" className="sr-only" name={question.id} checked={selected} onChange={() => onChange({ scaleValue })} />
                  <span className="block text-base font-bold text-brand">{scaleValue}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted">{label}</span>
                </label>
              );
            })}
          </div>
        ) : null}
        {question.type === "long_text" || question.type === "short_text" || isLockedField(question.type) ? (
          <LockedOrText question={question} max={max} value={value} onChange={onChange} />
        ) : null}
      </div>
    </section>
  );
}

function LockedOrText({ question, max, value, onChange }) {
  const text = value?.text || "";
  if (question.type === "long_text") {
    return (
      <div>
        <textarea className={`${fieldLg} min-h-28`} maxLength={max} placeholder="Escribe tu respuesta aquí…" value={text} onChange={(event) => onChange({ text: event.target.value })} />
        <p className="mt-1 text-right text-xs text-muted">{text.length}/{max}</p>
      </div>
    );
  }
  if (isLockedField(question.type)) {
    const inputType = question.type === "phone" ? "tel" : question.type === "number" ? "text" : question.type;
    return (
      <div>
        <input
          className={fieldLg}
          type={inputType}
          inputMode={question.type === "phone" ? "tel" : question.type === "number" ? "decimal" : question.type === "email" ? "email" : question.type === "url" ? "url" : undefined}
          placeholder={FIELD_PLACEHOLDERS[question.type]}
          value={text}
          onChange={(event) => onChange({ text: restrictInput(question.type, event.target.value) })}
        />
        <p className="mt-1 text-xs text-muted">{FIELD_LOCKS[question.type]}</p>
      </div>
    );
  }
  return (
    <div>
      <input className={fieldLg} maxLength={max} placeholder="Escribe tu respuesta" value={text} onChange={(event) => onChange({ text: event.target.value })} />
      <p className="mt-1 text-right text-xs text-muted">{text.length}/{max}</p>
    </div>
  );
}

const FIELD_PLACEHOLDERS = {
  email: "ana@empresa.com",
  phone: "55 1234 5678",
  number: "0",
  date: "",
  time: "",
  url: "https://empresa.com",
};

const FIELD_LOCKS = {
  email: "Este campo solo acepta un correo.",
  phone: "Este campo solo acepta números de teléfono.",
  number: "Este campo solo acepta números.",
  date: "Este campo solo acepta una fecha.",
  time: "Este campo solo acepta una hora.",
  url: "Este campo solo acepta un enlace.",
};

function Brand({ color = "#315ce8", logo = "" }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Logo del formulario" className="h-10 max-w-[140px] object-contain" />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-[12px] text-lg font-black text-white" style={{ background: color }}>M</span>
      )}
      <span>
        <span className="block text-lg font-black tracking-[0.14em] text-[#16315f]">MAPLASA</span>
        <span className="block text-[10px] tracking-[0.16em] text-[#7d8eab]">TALENTO Y CULTURA</span>
      </span>
    </div>
  );
}

function Shell({ embedded, color = "#315ce8", logo = "", cover = "", children }) {
  const body = (
    <>
      <Brand color={color} logo={logo} />
      <div className="overflow-hidden rounded-[22px] border border-white bg-white shadow-[0_10px_40px_rgba(38,61,100,0.06)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-36 w-full object-cover" />
        ) : null}
        <div className="px-5 py-7 md:px-8 md:py-8">{children}</div>
      </div>
    </>
  );
  if (embedded) return <div className="mx-auto max-w-3xl">{body}</div>;
  return <main className="mx-auto min-h-screen max-w-3xl bg-canvas px-4 py-8 md:py-12">{body}</main>;
}
