import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activatePremium } from "@/lib/payments/activate";
import * as plans from "@/lib/payments/plans";

describe("activatePremium", () => {
  it("activates premium and returns new expiry ISO", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { plan_expires_at: null } }),
      }),
    });

    const mockUpsert = vi.fn().mockReturnValue({});

    const mockSvc = {
      from: vi.fn((table: string) => {
        if (table === "learning_accounts") {
          return { select: mockSelect, upsert: mockUpsert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const result = await activatePremium(mockSvc, "user-123", "monthly", new Date("2026-01-01"));

    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockSelect).toHaveBeenCalledWith("plan_expires_at");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-123",
        plan: "student",
        plan_expires_at: expect.any(String),
      })
    );
  });

  it("extends existing expiry when renewing", async () => {
    const currentExpiry = "2026-02-01T00:00:00Z";

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { plan_expires_at: currentExpiry } }),
      }),
    });

    const mockUpsert = vi.fn().mockReturnValue({});

    const mockSvc = {
      from: vi.fn((table: string) => {
        if (table === "learning_accounts") {
          return { select: mockSelect, upsert: mockUpsert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    await activatePremium(mockSvc, "user-456", "yearly", new Date("2026-01-01"));

    const callArg = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg?.plan_expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Expiry should be extended from current expiry, not from now
    const newExp = new Date(callArg?.plan_expires_at as string);
    const originalExp = new Date(currentExpiry);
    expect(newExp.getTime()).toBeGreaterThan(originalExp.getTime());
  });

  it("throws on upsert error", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: { plan_expires_at: null } }),
      }),
    });

    const mockUpsert = vi.fn().mockReturnValue({
      error: new Error("DB error"),
    });

    const mockSvc = {
      from: vi.fn((table: string) => {
        if (table === "learning_accounts") {
          return { select: mockSelect, upsert: mockUpsert };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    await expect(activatePremium(mockSvc, "user-789", "monthly")).rejects.toThrow(
      /activatePremium failed/
    );
  });
});
