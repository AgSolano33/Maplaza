import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { createFollowUp, listFollowUps } from "@/controllers/followups";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await listFollowUps());
});

export const POST = api(async (request) => {
  await requireAdmin(request);
  return json(await createFollowUp(await readJson(request)), 201);
});
