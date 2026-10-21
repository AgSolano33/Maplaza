import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-sm text-muted">Cargando acceso…</main>}>
      <LoginForm />
    </Suspense>
  );
}
