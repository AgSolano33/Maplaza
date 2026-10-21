import PublicSurvey from "@/components/PublicSurvey";
import { ApiError } from "@/lib/errors";
import { getPublicForm } from "@/services/submissions";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }) {
  const { token } = await params;
  let initial = { available: false, message: "Este enlace no está disponible." };
  try {
    initial = await getPublicForm(token);
  } catch (error) {
    if (error instanceof ApiError) initial = { available: false, message: error.message };
  }
  return <PublicSurvey token={token} initial={initial} />;
}
