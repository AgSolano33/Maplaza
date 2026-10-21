import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { areas } from "@/controllers/catalogs";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await areas.list());
});

export const POST = api(async (request) => {
  await requireAdmin(request);
  return json(await areas.create(await readJson(request)), 201);
});
