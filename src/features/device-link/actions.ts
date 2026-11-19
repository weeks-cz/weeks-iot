"use server";

import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { clientIp } from "@/lib/rate-limit";
import { fieldErrorsFrom, type ActionState } from "@/features/actions";
import { deviceLinkFormSchema } from "./schema";
import { handleDeviceLinkRequest } from "./request";

const FIELDS = [
  "email",
  "marketingConsent",
  "hp_field_x",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "referrer",
  "env",
  "fbclid",
  "eventId",
] as const;

export async function requestDeviceLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw: Record<string, FormDataEntryValue | undefined> = {};
  for (const f of FIELDS) raw[f] = formData.get(f) ?? undefined;

  const parsed = deviceLinkFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }

  const requestHeaders = await headers();
  const jar = await cookies();

  const result = await handleDeviceLinkRequest(parsed.data, {
    ip: clientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
    fbp: jar.get("_fbp")?.value,
    deps: { defer: (fn) => after(fn) },
  });

  if (!result.ok) return { error: result.error };
  return {
    success: `Hotovo. Odkaz je na cestě na ${result.email}. Otevřete ho na počítači.`,
  };
}
