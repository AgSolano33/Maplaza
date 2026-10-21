import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { duplicateForm } from "@/controllers/forms";

export const POST = api(async (request, context) => {
  const user = await requireAdmin(request);
  const { id } = await context.params;
  return json(await duplicateForm(user, id), 201);
});
