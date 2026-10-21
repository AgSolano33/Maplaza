"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { api } from "@/lib/client";
import { btnPrimary, card, fieldClass, labelClass } from "@/components/styles";
import { FieldError } from "@/components/ui";

function safeCallback(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api("/api/setup").then((data) => setNeedsSetup(data.needsSetup)).catch(() => {});
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    if (result?.error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push(safeCallback(params.get("callbackUrl")));
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <p className="text-sm font-black tracking-[0.18em] text-brand">MAPLASA</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-muted">Acceso para el equipo de RH. Quien responde un formulario no necesita cuenta.</p>
      <form onSubmit={onSubmit} className={`${card} mt-6 space-y-4`}>
        <label className="block space-y-1.5">
          <span className={labelClass}>Correo</span>
          <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label className="block space-y-1.5">
          <span className={labelClass}>Contraseña</span>
          <input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>
        <FieldError>{error}</FieldError>
        <button className={`${btnPrimary} w-full`} disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      </form>
      {needsSetup ? <Link href="/setup" className="mt-4 text-sm font-bold text-brand">Crear el primer administrador</Link> : null}
    </main>
  );
}
