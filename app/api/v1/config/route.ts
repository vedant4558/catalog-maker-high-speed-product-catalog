import { getClient } from "@/lib/tenant";
import { handler, json, CACHE_CONFIG } from "@/lib/api";

export const GET = handler(async () => {
  const c = await getClient();
  return json(
    { name: c.name, whatsappNumber: c.whatsappNumber, activeDesign: c.activeDesign, currency: c.currency },
    CACHE_CONFIG
  );
});
