import { headers } from "next/headers";
import { ApiError } from "./api";
import { resolveClient } from "./catalog/queries";

/** Resolves the Client for this request (custom domain, else DEFAULT_CLIENT_SLUG). Throws a friendly 503 if none exists yet. */
export async function getClient() {
  const client = await resolveClient((await headers()).get("host"));
  if (!client) throw new ApiError(503, "not_configured", "Catalog is not set up yet.");
  return client;
}
