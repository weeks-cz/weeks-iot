"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { clientIp } from "@/lib/rate-limit";
import type { ActionState } from "@/features/actions";
import { markOpened, type OpenResult } from "./open";
import { unsubscribe } from "./unsubscribe";
import {
  INVALID_LINK_MESSAGE,
  UNSUBSCRIBED_MESSAGE,
  UNSUBSCRIBE_FAILED_MESSAGE,
} from "./messages";

/**
 * Tenká vrstva nad `open.ts` a `unsubscribe.ts`: validace vstupu a čtení
 * hlaviček. Logika i zápis do databáze jsou tam.
 */

/* Token je `<uuid>.<base64url hmac>`; strop jen proti zbytečně dlouhému vstupu. */
const tokenSchema = z.string().trim().min(1).max(200);

const openSchema = z.object({
  token: tokenSchema,
  device: z.enum(["computer", "phone"]),
  env: z.enum(["browser", "facebook", "instagram"]),
});

/** Volá klient po otevření odkazu z e-mailu; výsledek rodiči nic neukazuje. */
export async function markDeviceLinkOpened(
  token: string,
  device: "computer" | "phone",
  env: string,
): Promise<OpenResult> {
  const parsed = openSchema.safeParse({ token, device, env });
  if (!parsed.success) return "invalid";
  return markOpened(parsed.data.token, parsed.data.device, parsed.data.env);
}

export async function unsubscribeDeviceLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = tokenSchema.safeParse(formData.get("t"));
  if (!parsed.success) return { error: INVALID_LINK_MESSAGE };

  const requestHeaders = await headers();
  const result = await unsubscribe(parsed.data, {
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 500) ?? null,
  });

  if (result === "invalid") return { error: INVALID_LINK_MESSAGE };
  if (result === "error") return { error: UNSUBSCRIBE_FAILED_MESSAGE };
  return { success: UNSUBSCRIBED_MESSAGE };
}
