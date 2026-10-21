import { api, json, publicOrigin, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { createForm, listForms } from "@/controllers/forms";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await listForms(new URL(request.url), publicOrigin(request)));
});

export const POST = api(async (request) => {
  const user = await requireAdmin(request);
  return json(await createForm(user, await readJson(request)), 201);
});
