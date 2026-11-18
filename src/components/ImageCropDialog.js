"use client";

import { useState } from "react";
import Cropper from "react-easy-crop";
import { btn, btnPrimary } from "./styles";

export default function ImageCropDialog({ src, title, aspect, maxEdge, onCancel, onConfirm }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!area || pending) return;
    setPending(true);
    setError("");
    try {
      const blob = await cropToJpeg(src, area, maxEdge);
      await onConfirm(blob);
    } catch (cropError) {
      setError(cropError.message || "No se pudo recortar la imagen.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172338]/50 px-4 py-6">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[16px] bg-white shadow-[0_20px_60px_rgba(23,35,56,0.25)]" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="crop-title" className="text-base font-semibold">{title}</h2>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-lg text-muted hover:bg-[#f4f7fb]" onClick={onCancel} aria-label="Cerrar recorte" disabled={pending}>×</button>
        </div>
        <div className="relative h-72 bg-[#111827] sm:h-80">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>
        <label className="block px-5 py-4">
          <span className="text-sm font-semibold">Zoom</span>
          <input className="mt-2 w-full accent-brand" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        {error ? <p className="px-5 pb-2 text-sm text-[#c44545]">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" className={btn} onClick={onCancel} disabled={pending}>Cancelar</button>
          <button type="button" className={btnPrimary} onClick={confirm} disabled={pending || !area}>{pending ? "Guardando…" : "Confirmar recorte"}</button>
        </div>
      </div>
    </div>
  );
}

function cropToJpeg(src, pixelCrop, maxEdge) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(pixelCrop.width, pixelCrop.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
      canvas.height = Math.max(1, Math.round(pixelCrop.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo recortar la imagen."));
        return;
      }
      context.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("No se pudo recortar la imagen."));
        else resolve(blob);
      }, "image/jpeg", 0.85);
    };
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = src;
  });
}
