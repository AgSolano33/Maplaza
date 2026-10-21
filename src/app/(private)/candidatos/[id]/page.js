import CandidateProfile from "@/components/CandidateProfile";

export default async function CandidatePage({ params }) {
  const { id } = await params;
  return <CandidateProfile candidateId={id} />;
}
