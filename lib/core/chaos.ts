// Chaos storage: cards are not sorted by set/name. Each copy goes into the first free
// slot (lowest box, lowest slot), freed slots are reused, and the system remembers where
// everything is. Picking a sale = look up box + slot.

export interface BoxOccupancy {
  boxId: number;
  code: string;
  capacity: number;
  occupiedSlots: number[];
}

export interface SlotAssignment {
  boxId: number | null; // null = a new box must be created
  boxCode: string;
  slot: number;
}

export function boxCode(n: number): string {
  return `B${String(n).padStart(3, "0")}`;
}

export function locationLabel(code: string, slot: number): string {
  return `${code}-${String(slot).padStart(4, "0")}`;
}

/** Returns the first free slot across boxes (ordered by code), or a slot in a new box. */
export function findFreeSlot(boxes: BoxOccupancy[], newBoxCapacity: number): SlotAssignment {
  const sorted = [...boxes].sort((a, b) => a.code.localeCompare(b.code));
  for (const box of sorted) {
    const taken = new Set(box.occupiedSlots);
    for (let s = 1; s <= box.capacity; s++) {
      if (!taken.has(s)) return { boxId: box.boxId, boxCode: box.code, slot: s };
    }
  }
  return { boxId: null, boxCode: boxCode(sorted.length + 1), slot: 1 };
}

/**
 * Bulk version for imports: N free slots in order (gaps first, then new boxes).
 * New boxes come back with boxId null; callers create them by boxCode.
 */
export function findFreeSlots(boxes: BoxOccupancy[], newBoxCapacity: number, count: number): SlotAssignment[] {
  const sorted = [...boxes].sort((a, b) => a.code.localeCompare(b.code));
  const out: SlotAssignment[] = [];
  for (const box of sorted) {
    const taken = new Set(box.occupiedSlots);
    for (let s = 1; s <= box.capacity && out.length < count; s++) {
      if (!taken.has(s)) out.push({ boxId: box.boxId, boxCode: box.code, slot: s });
    }
    if (out.length >= count) return out;
  }
  let n = sorted.length;
  while (out.length < count) {
    n++;
    for (let s = 1; s <= newBoxCapacity && out.length < count; s++) {
      out.push({ boxId: null, boxCode: boxCode(n), slot: s });
    }
  }
  return out;
}

/** Sort items into a walking order for picking orders: box, then slot. */
export function pickOrder<T extends { boxCode: string | null; slot: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const bc = (a.boxCode ?? "").localeCompare(b.boxCode ?? "");
    return bc !== 0 ? bc : (a.slot ?? 0) - (b.slot ?? 0);
  });
}
