import { getDesign } from "@/designs/registry";
import { loadShop } from "@/lib/shop";
import { NotConfigured } from "@/components/shop/States";
import { ListPanel } from "@/components/shop/Lists";

export const metadata = { title: "My wishlist" };

export default async function WishlistPage() {
  const shop = await loadShop();
  if (!shop) return <NotConfigured />;
  const design = getDesign(shop.client.activeDesign);
  return (
    <design.Shell client={shop.client} categories={shop.categories}>
      <h1 className="mb-4 text-xl font-semibold">My wishlist</h1>
      <p className="mb-4 text-sm text-neutral-500">Saved on this device. Select products to send ONE WhatsApp enquiry.</p>
      <div className="max-w-xl"><ListPanel mode="wishlist" number={shop.client.whatsappNumber} /></div>
    </design.Shell>
  );
}
