import Link from "next/link";
import { bulkGroups } from "@/lib/channels/cardmarket";
import { cards, eur } from "@/lib/format";
import ListingSet from "@/components/ListingSet";

export const dynamic = "force-dynamic";

// Step-by-step listing through Cardmarket's Bulk listing page, one expansion at a time.
export default async function Listing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ids = sp.ids ? sp.ids.split(",").map(Number).filter((n) => n > 0) : undefined;
  const groups = await bulkGroups(ids);
  const total = groups.reduce((n, g) => n + g.copies, 0);
  const value = groups.reduce((n, g) => n + g.value, 0);

  return (
    <>
      <div className="head">
        <div>
          <p className="small" style={{ margin: "0 0 6px" }}><Link href="/inventory">Inventory</Link></p>
          <h1>List on Cardmarket</h1>
          <p>
            {total ? `${cards(total)} worth ${eur(value)} in ${groups.length} ${groups.length === 1 ? "set" : "sets"}.` : "Nothing to list."}{" "}
            Cardmarket&apos;s Bulk listing works one set at a time, so each set below has its own file.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="panel empty">
          <p>None of the selected cards can be listed. Only cards that are in stock and have a price can be listed.</p>
          <Link className="btn" href="/inventory?status=IN_STOCK">Back to inventory</Link>
        </div>
      ) : (
        <>
          <details className="panel" style={{ marginBottom: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>How it works (first time: install the extension)</summary>
            <ol style={{ margin: "12px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Install <a href="https://chromewebstore.google.com/detail/cardmarket-bulk-import/lbjpmgmfhmgaenclkmfjfompieopaimb" target="_blank" rel="noreferrer">Cardmarket Bulk Import</a> in Chrome (or Firefox) and log in to Cardmarket.</li>
              <li>For each set: <b>Download CSV</b>, then <b>Open on Cardmarket</b>. If the page doesn&apos;t open on the right set, pick the set shown here in its expansion filter.</li>
              <li>Click <b>Import CSV…</b> (added by the extension) and choose the file. Leave <b>Set</b> and <b>Signed</b> unmapped; the other columns match by name.</li>
              <li>Click <b>Select rows</b>, then <b>Fill page</b>. Check prices and conditions, then put them up for sale on Cardmarket.</li>
              <li>Back here, click <b>Mark as listed</b> so CardOps knows they&apos;re for sale.</li>
            </ol>
            <p className="hint" style={{ marginBottom: 0 }}>A card missing after Fill page? It isn&apos;t on the open page. Check the rarity filter on Cardmarket, or the card&apos;s set.</p>
          </details>
          {groups.map((g) => <ListingSet key={g.setCode} group={g} />)}
        </>
      )}
    </>
  );
}
