import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { competencies } from "@/controllers/catalogs";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await competencies.list());
});

export const POST = api(async (request) => {
  await requireAdmin(request);
  return json(await competencies.create(await readJson(request)), 201);
});
