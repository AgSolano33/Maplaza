import { api, json, publicOrigin, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { getForm, updateForm } from "@/controllers/forms";

export const GET = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await getForm(id, publicOrigin(request)));
});

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await updateForm(id, await readJson(request)));
});
