import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { competencies } from "@/controllers/catalogs";

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await competencies.update(id, await readJson(request)));
});
