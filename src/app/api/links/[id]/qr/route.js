import { api, publicOrigin } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { qrForLink } from "@/controllers/links";

export const GET = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const { png, filename } = await qrForLink(id, publicOrigin(request));
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
