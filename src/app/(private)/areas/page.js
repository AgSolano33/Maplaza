import CatalogManager from "@/components/CatalogManager";

export default function AreasPage() {
  return (
    <CatalogManager
      endpoint="/api/areas"
      eyebrow="Catálogo"
      title="Áreas"
      subtitle="Cada área puede recibir su propio enlace y código QR de clima laboral."
      placeholder="Ej. Producción"
    />
  );
}
