import FormDetail from "@/components/FormDetail";

export default async function FormDetailPage({ params }) {
  const { id } = await params;
  return <FormDetail formId={id} />;
}
