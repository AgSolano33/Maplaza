import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { getCandidate } from "@/controllers/applications";

export const GET = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await getCandidate(id));
});
