import { describe, expect, it } from "vitest";
import { resequence } from "./resequence.ts";

const stored = (...pairs: [number, number | null][]) => pairs.map(([platformId, travelOffset]) => ({ platformId, travelOffset }));

describe("resequence", () => {
  it("keeps the offsets of retained platforms", () => {
    expect(resequence(stored([1, 0], [2, 5], [3, 9]), [1, 3])).toEqual([0, 9]);
  });

  it("gives an inserted platform the rounded midpoint of its neighbours", () => {
    expect(resequence(stored([1, 0], [2, 5], [3, 10]), [1, 2, 7, 3])).toEqual([0, 5, 8, 10]);
  });

  it("leaves an inserted platform empty without offsets on both sides", () => {
    expect(resequence(stored([1, 0], [2, null]), [1, 2, 7])).toEqual([0, null, null]);
  });

  it("matches a platform the sequence visits twice by its place", () => {
    expect(resequence(stored([1, 0], [2, 4], [1, 9]), [1, 2, 3, 1])).toEqual([0, 4, 7, 9]);
  });
});
