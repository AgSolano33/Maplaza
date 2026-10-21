import { api, json, publicOrigin, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { createLink } from "@/controllers/links";

export const POST = api(async (request, context) => {
  const user = await requireAdmin(request);
  const { id } = await context.params;
  return json(await createLink(user, id, await readJson(request), publicOrigin(request)), 201);
});
