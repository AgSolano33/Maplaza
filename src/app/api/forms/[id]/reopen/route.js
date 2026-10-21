import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { reopenForm } from "@/controllers/forms";

export const POST = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await reopenForm(id));
});
