import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { listFormResponses } from "@/controllers/form-responses";

export const GET = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await listFormResponses(id));
});
