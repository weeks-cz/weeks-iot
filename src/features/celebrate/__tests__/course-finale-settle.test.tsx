import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSettled } from "../components/CourseFinale";

/** Slib, který se vyřeší až na pokyn testu. */
function deferred() {
  let resolve!: (ok: boolean) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSettled — stav ukládání postupu ve finále", () => {
  it("boolean projde beze změny, bez čekání", () => {
    expect(renderHook(() => useSettled(true)).result.current).toBe(true);
    expect(renderHook(() => useSettled(false)).result.current).toBe(false);
  });

  it("běžící zápis = null (tlačítko čeká), po vyřešení výsledek", async () => {
    const d = deferred();
    const { result } = renderHook(() => useSettled(d.promise));
    expect(result.current).toBeNull();
    await act(async () => d.resolve(true));
    expect(result.current).toBe(true);
  });

  it("odmítnutý zápis = neuložený postup", async () => {
    const d = deferred();
    const { result } = renderHook(() => useSettled(d.promise));
    await act(async () => d.reject(new Error("síť")));
    expect(result.current).toBe(false);
  });

  it("nový slib začne znovu od „ještě běží“", async () => {
    const first = deferred();
    const { result, rerender } = renderHook(({ value }) => useSettled(value), {
      initialProps: { value: first.promise as Promise<boolean> | boolean },
    });
    await act(async () => first.resolve(true));
    expect(result.current).toBe(true);

    const second = deferred();
    rerender({ value: second.promise });
    expect(result.current).toBeNull();
    await act(async () => second.resolve(false));
    expect(result.current).toBe(false);
  });
});
