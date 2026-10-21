import CandidatesView from "@/components/CandidatesView";

export default async function FormResultsPage({ params }) {
  const { id } = await params;
  return <CandidatesView initialFormId={id} />;
}
