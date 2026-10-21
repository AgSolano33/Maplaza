import FormEditor from "@/components/FormEditor";

export default async function EditFormPage({ params }) {
  const { id } = await params;
  return <FormEditor formId={id} />;
}
