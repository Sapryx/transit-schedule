export interface StoredPlatform {
  platformId: number;
  travelOffset: number | null;
}

export function resequence(previous: StoredPlatform[], platformIds: number[]): (number | null)[] {
  const commonLength = previous.map(() => Array<number>(platformIds.length + 1).fill(0));
  commonLength.push(Array<number>(platformIds.length + 1).fill(0));
  for (let i = previous.length - 1; i >= 0; i--) {
    for (let j = platformIds.length - 1; j >= 0; j--) {
      commonLength[i][j] = previous[i].platformId === platformIds[j] ? commonLength[i + 1][j + 1] + 1 : Math.max(commonLength[i + 1][j], commonLength[i][j + 1]);
    }
  }

  const keptOffsets: (number | null | undefined)[] = Array(platformIds.length).fill(undefined);
  for (let i = 0, j = 0; i < previous.length && j < platformIds.length; ) {
    if (previous[i].platformId === platformIds[j]) {
      keptOffsets[j++] = previous[i++].travelOffset;
    } else if (commonLength[i + 1][j] >= commonLength[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return keptOffsets.map((offset, index) => {
    if (offset !== undefined) {
      return offset;
    }
    const before = keptOffsets.slice(0, index).findLast((candidate) => candidate !== undefined);
    const after = keptOffsets.slice(index + 1).find((candidate) => candidate !== undefined);
    return typeof before === "number" && typeof after === "number" ? Math.round((before + after) / 2) : null;
  });
}
