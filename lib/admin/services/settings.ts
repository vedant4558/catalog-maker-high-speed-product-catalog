import { db } from "../../db";
import { ValidationError } from "../results";
import type { SettingsInput } from "../validators";

export async function updateSettings(clientId: string, input: SettingsInput) {
  if (input.domain && (await db.client.findFirst({ where: { domain: input.domain, id: { not: clientId } }, select: { id: true } }))) {
    throw new ValidationError({ domain: "This domain is already used by another catalog" });
  }
  await db.client.update({ where: { id: clientId }, data: { name: input.name, whatsappNumber: input.whatsappNumber, activeDesign: input.activeDesign, domain: input.domain } });
}
