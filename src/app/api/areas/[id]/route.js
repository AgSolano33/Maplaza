import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { areas } from "@/controllers/catalogs";

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await areas.update(id, await readJson(request)));
});
