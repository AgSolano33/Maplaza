import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-xs font-bold tracking-[0.2em] text-brand uppercase">MAPLASA</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">No encontramos esta página</h1>
      <Link href="/" className="mt-6 font-bold text-brand">
        Volver al inicio
      </Link>
    </main>
  );
}
