import { prisma } from "@/lib/db";
import { apiConfigured } from "@/lib/channels/cardmarket";
import { locationLabel } from "@/lib/core/chaos";
import InventoryTable, { type InvRow } from "@/components/InventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const items = await prisma.inventoryItem.findMany({
    where: { status: { not: "REMOVED" } },
    include: { card: true, box: true, listings: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const rows: InvRow[] = items.map((i) => ({
    id: i.id,
    location: i.box && i.slot ? locationLabel(i.box.code, i.slot) : "—",
    name: i.card.name,
    set: i.card.setCode.toUpperCase(),
    number: i.card.collectorNumber,
    condition: i.condition,
    language: i.language,
    foil: i.foil,
    askPrice: i.askPrice,
    trend: i.foil ? (i.card.priceEurFoil ?? i.card.priceEur) : i.card.priceEur,
    costBasis: i.costBasis,
    status: i.status,
    hasProduct: i.card.cardmarketId != null,
    lastListing: i.listings[0] ? `${i.listings[0].method} ${i.listings[0].status}${i.listings[0].error ? ": " + i.listings[0].error : ""}` : null,
  }));
  return (
    <>
      <h1>Inventory</h1>
      <InventoryTable rows={rows} apiEnabled={apiConfigured()} />
    </>
  );
}
