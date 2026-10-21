"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { btnPrimary, card, fieldClass, labelClass } from "@/components/styles";
import { FieldError } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api("/api/setup").then((data) => setNeedsSetup(data.needsSetup)).catch((loadError) => setError(loadError.message));
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFields({});
    try {
      await api("/api/setup", { method: "POST", body: JSON.stringify(form) });
      router.push("/login");
    } catch (submitError) {
      setError(submitError.message);
      setFields(submitError.fields || {});
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm font-black tracking-[0.18em] text-brand">MAPLASA</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Primer administrador</h1>
      <p className="mt-2 text-sm text-muted">Este paso solo está disponible mientras no exista ninguna cuenta. No hay una contraseña predeterminada.</p>
      {needsSetup === false ? (
        <div className={`${card} mt-6`}>
          <p>El administrador inicial ya fue creado.</p>
          <Link href="/login" className="mt-3 inline-block font-bold text-brand">Ir a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className={`${card} mt-6 space-y-4`}>
          <label className="block space-y-1.5"><span className={labelClass}>Nombre</span><input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><FieldError>{fields.name}</FieldError></label>
          <label className="block space-y-1.5"><span className={labelClass}>Correo</span><input className={fieldClass} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /><FieldError>{fields.email}</FieldError></label>
          <label className="block space-y-1.5"><span className={labelClass}>Contraseña</span><input className={fieldClass} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><FieldError>{fields.password}</FieldError></label>
          <FieldError>{error}</FieldError>
          <button className={`${btnPrimary} w-full`} disabled={pending || needsSetup === null}>{pending ? "Creando…" : "Crear administrador"}</button>
        </form>
      )}
    </main>
  );
}
