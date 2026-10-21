import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { publishForm } from "@/controllers/forms";

export const POST = api(async (request, context) => {
  const user = await requireAdmin(request);
  const { id } = await context.params;
  return json(await publishForm(user, id));
});
