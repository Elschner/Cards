import { prisma } from "@/lib/db";
import { apiConfigured } from "@/lib/channels/cardmarket";
import { locationLabel } from "@/lib/core/chaos";
import { ensureSkus } from "@/lib/purchases";
import InventoryTable, { type InvRow } from "@/components/InventoryTable";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ensureSkus();
  const [items, lots] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { status: { not: "REMOVED" } },
      include: { card: true, box: true, purchase: { select: { id: true, name: true } }, listings: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.purchase.findMany({ select: { id: true, name: true }, orderBy: { purchasedAt: "desc" } }),
  ]);
  const rows: InvRow[] = items.map((i) => ({
    id: i.id,
    sku: i.sku ?? "",
    location: i.box && i.slot ? locationLabel(i.box.code, i.slot) : null,
    name: i.card.name,
    setName: i.card.setName,
    set: i.card.setCode.toUpperCase(),
    number: i.card.collectorNumber,
    condition: i.condition,
    language: i.language,
    foil: i.foil,
    askPrice: i.askPrice,
    soldPrice: i.soldPrice,
    trend: i.foil ? (i.card.priceEurFoil ?? i.card.priceEur) : i.card.priceEur,
    costBasis: i.costBasis,
    status: i.status,
    lotId: i.purchase?.id ?? null,
    lotName: i.purchase?.name ?? null,
    hasProduct: i.card.cardmarketId != null,
    lastListing: i.listings[0] ? `${i.listings[0].method} ${i.listings[0].status}${i.listings[0].error ? ": " + i.listings[0].error : ""}` : null,
  }));
  return (
    <>
      <div className="head">
        <div>
          <h1>Lager</h1>
          <p>Vælg kort og sæt dem til salg. Når et kort er solgt, markér det som solgt, så pladsen bliver ledig.</p>
        </div>
      </div>
      <InventoryTable
        rows={rows}
        lots={lots}
        apiEnabled={apiConfigured()}
        initialStatus={sp.status ?? "IN_STOCK"}
        initialLot={sp.lot ?? ""}
      />
    </>
  );
}
