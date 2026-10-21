"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { btn, btnPrimary, card, fieldClass } from "./styles";
import { Empty, ErrorNote, PageHeader, Pill } from "./ui";

export default function CatalogManager({ endpoint, eyebrow, title, subtitle, placeholder }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;
    api(endpoint)
      .then((data) => {
        if (!ignore) setItems(data.items);
      })
      .catch((loadError) => {
        if (!ignore) setError(loadError.message);
      });
    return () => {
      ignore = true;
    };
  }, [endpoint]);

  async function create(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify({ name }) });
      setName("");
      const data = await api(endpoint);
      setItems(data.items);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setPending(false);
    }
  }

  async function update(item, patch) {
    setError("");
    try {
      await api(`${endpoint}/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      const data = await api(endpoint);
      setItems(data.items);
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
      <ErrorNote>{error}</ErrorNote>
      <form onSubmit={create} className={`${card} mb-4 flex flex-col gap-2 sm:flex-row`}>
        <input className={fieldClass} value={name} placeholder={placeholder} onChange={(event) => setName(event.target.value)} />
        <button className={btnPrimary} disabled={pending}>{pending ? "Guardando…" : "Agregar"}</button>
      </form>
      <div className={`${card} divide-y divide-[#f0f2f6]`}>
        {items.length === 0 ? <Empty>Todavía no hay elementos.</Empty> : items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <strong>{item.name}</strong>
              <Pill tone={item.active ? "green" : "gray"}>{item.active ? "Activo" : "Inactivo"}</Pill>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => {
                const next = window.prompt("Nuevo nombre", item.name);
                if (next && next.trim() && next.trim() !== item.name) update(item, { name: next.trim() });
              }}>Editar</button>
              <button type="button" className={btn} onClick={() => update(item, { active: !item.active })}>{item.active ? "Desactivar" : "Activar"}</button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Desactivar un elemento no modifica las respuestas ni las versiones ya publicadas.</p>
    </div>
  );
}
