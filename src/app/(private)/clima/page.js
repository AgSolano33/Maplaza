import ClimateView from "@/components/ClimateView";

export default async function ClimatePage({ searchParams }) {
  const params = await searchParams;
  return <ClimateView initialFormId={typeof params.formId === "string" ? params.formId : ""} />;
}
