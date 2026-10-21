import CatalogManager from "@/components/CatalogManager";

export default function CompetenciesPage() {
  return (
    <CatalogManager
      endpoint="/api/competencies"
      eyebrow="Catálogo"
      title="Competencias"
      subtitle="Asocia estas competencias a las preguntas puntuables de reclutamiento."
      placeholder="Ej. Trabajo en equipo"
    />
  );
}
