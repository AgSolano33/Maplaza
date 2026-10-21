"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◫" },
  { href: "/formularios", label: "Formularios", icon: "▤" },
  { href: "/candidatos", label: "Candidatos", icon: "♙" },
  { href: "/clima", label: "Clima laboral", icon: "♡" },
  { href: "/seguimiento", label: "Seguimiento", icon: "▥" },
  { href: "/competencias", label: "Competencias", icon: "✦" },
  { href: "/areas", label: "Áreas", icon: "▣" },
];

const UnsavedContext = createContext({ setDirty: () => {} });

export function useUnsaved() {
  return useContext(UnsavedContext);
}

export default function AppShell({ user, children }) {
  const pathname = usePathname();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event) => {
      if (!dirty) return;
      const anchor = event.target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!window.confirm("Hay cambios sin guardar. ¿Quieres salir de esta página?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <UnsavedContext.Provider value={{ setDirty }}>
      <div className="min-h-screen bg-canvas">
        <aside className="fixed inset-y-0 left-0 z-20 flex w-[72px] flex-col bg-nav px-2 py-5 text-[#c1cadd] md:w-[254px] md:px-4">
          <div className="mb-8 flex items-center gap-3 px-1 md:px-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#6a86ff] to-[#2c4bd6] text-xl font-black text-white">
              M
            </div>
            <div className="hidden md:block">
              <strong className="block text-[17px] tracking-[0.18em] text-white">MAPLASA</strong>
              <small className="text-[10px] tracking-[0.12em] text-[#8292ad]">TALENTO Y CULTURA</small>
            </div>
          </div>
          <p className="hidden px-3 pb-2 text-[10px] tracking-[0.2em] text-[#687996] md:block">PLATAFORMA</p>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center justify-center gap-3 rounded-[10px] px-2 py-3 text-sm md:justify-start md:px-3.5 ${active ? "bg-[#263755] text-white" : "text-[#9faec7] hover:bg-[#263755] hover:text-white"}`}
                >
                  <span className="w-5 text-center text-lg">{item.icon}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-[#2d3950] pt-4">
            <div className="flex items-center gap-3 px-1 md:px-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#3552a1] text-xs font-bold text-white">
                RH
              </div>
              <div className="hidden min-w-0 md:block">
                <b className="block truncate text-sm text-white">{user?.name || "Administración"}</b>
                <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="text-xs text-[#aab6ca] hover:text-white">
                  Cerrar sesión
                </button>
              </div>
            </div>
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="mt-3 w-full text-xs text-[#aab6ca] md:hidden">
              Salir
            </button>
          </div>
        </aside>
        <main className="ml-[72px] min-h-screen w-[calc(100%-72px)] px-4 py-6 md:ml-[254px] md:w-[calc(100%-254px)] md:px-10 md:py-8">
          <div className="mx-auto max-w-[1500px]">{children}</div>
        </main>
      </div>
    </UnsavedContext.Provider>
  );
}
