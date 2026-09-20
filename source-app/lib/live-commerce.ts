import { headers } from "next/headers";
import { db, identity, setting, storeSettings, rate } from "./server";
import { check, quantity } from "./commerce.mjs";
import {
  shopifyClient,
  catalogQuery,
  cartFields,
  normalizeProduct,
  normalizeCart,
  minor,
  safeCheckout,
} from "./shopify.mjs";
export const isLiveCommerce = () => setting("COMMERCE_MODE") === "shopify";
function client(buyerIp?:string) {
  return shopifyClient({
    domain: setting("SHOPIFY_STORE_DOMAIN"),
    token: setting("SHOPIFY_STOREFRONT_TOKEN"),
    version: setting("SHOPIFY_API_VERSION") || "2026-07",
    buyerIp,
  });
}
async function currentCart(owner: string, query: any) {
  const row = await db()
    .prepare("SELECT cart_id FROM provider_carts WHERE owner=?")
    .bind(owner)
    .first<{ cart_id: string }>();
  return row
    ? (
        await query(`query($id:ID!){cart(id:$id){${cartFields}}}`, {
          id: row.cart_id,
        })
      ).cart
    : null;
}
export async function liveBootstrap() {
  const who = await identity(),
    query = client((await headers()).get('cf-connecting-ip')??undefined);
  const records: any[] = [];
  let cursor = null;
  do {
    const response = await query(catalogQuery, { cursor });
    records.push(
      ...response.products.nodes.filter(
        (p: any) =>
          !p.tags.some((t: string) =>
            ["demo", "sample"].includes(t.toLowerCase()),
          ),
      ),
    );
    cursor = response.products.pageInfo.hasNextPage
      ? response.products.pageInfo.endCursor
      : null;
    check(
      records.length <= 1000,
      "This storefront supports up to 1,000 connected products. Add server pagination before expanding.",
      503,
    );
  } while (cursor);
  const remoteCart = await currentCart(who.guest, query);
  return {
    mode: "shopify",
    products: records.map(normalizeProduct),
    cart: normalizeCart(remoteCart),
    wishlist: (
      await db()
        .prepare("SELECT product_id FROM live_wishlists WHERE owner=?")
        .bind(who.guest)
        .all()
    ).results.map((x) => x.product_id),
    settings: await storeSettings(),
    user: null,
    admin: who.admin,
    support: who.support,
    accountUrl: setting("SHOPIFY_ACCOUNT_URL")
      ? safeCheckout(
          setting("SHOPIFY_ACCOUNT_URL"),
          setting("SHOPIFY_STORE_DOMAIN"),
          setting("SHOPIFY_CHECKOUT_DOMAIN"),
        )
      : "",
    adminUrl: "https://admin.shopify.com/",
    checkoutEnabled: setting("LIVE_CHECKOUT_ENABLED") === "true",
  };
}
export async function liveAction(request: Request) {
  try {
    check(
      request.headers.get("origin") === new URL(request.url).origin,
      "Request origin rejected.",
      403,
    );
    const raw = await request.text();
    check(raw.length < 10000, "Request too large.", 413);
    const b = JSON.parse(raw);
    const who = await identity();
    await rate("shopify:" + who.guest, 150);
    const query = client(request.headers.get('cf-connecting-ip')??undefined);
    let cart = await currentCart(who.guest, query);
    if (b.action === "wishlist") {
      check(/^[a-z0-9-]{1,100}$/.test(b.productId), "Invalid product.");
      await db()
        .prepare(
          b.saved
            ? "INSERT OR IGNORE INTO live_wishlists(owner,product_id) VALUES(?,?)"
            : "DELETE FROM live_wishlists WHERE owner=? AND product_id=?",
        )
        .bind(who.guest, b.productId)
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "cart") {
      quantity(b.quantity);
      check(
        /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(b.variantId),
        "Invalid product variant.",
      );
      if (b.quantity > 0) {
        const item = await query(
          `query($id:ID!){node(id:$id){... on ProductVariant{availableForSale product{tags}}}}`,
          { id: b.variantId },
        );
        check(
          item.node?.availableForSale &&
            !item.node.product.tags.some((t: string) =>
              ["demo", "sample"].includes(t.toLowerCase()),
            ),
          "This product cannot be ordered.",
        );
      }
      if (!cart) {
        check(b.quantity > 0, "Your bag is empty.");
        cart = (
          await query(
            `mutation($input:CartInput!){cartCreate(input:$input){cart{${cartFields}} userErrors{field message}}}`,
            {
              input: {
                buyerIdentity: { countryCode: "IN" },
                lines: [{ merchandiseId: b.variantId, quantity: b.quantity }],
              },
            },
          )
        ).cartCreate.cart;
        await db()
          .prepare(
            "INSERT INTO provider_carts(owner,cart_id) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET cart_id=excluded.cart_id",
          )
          .bind(who.guest, cart.id)
          .run();
      } else {
        const line = cart.lines.nodes.find(
          (l: any) => l.merchandise.id === b.variantId,
        );
        if (!b.quantity && line)
          cart = (
            await query(
              `mutation($id:ID!,$lines:[ID!]!){cartLinesRemove(cartId:$id,lineIds:$lines){cart{${cartFields}} userErrors{field message}}}`,
              { id: cart.id, lines: [line.id] },
            )
          ).cartLinesRemove.cart;
        else if (b.quantity && line)
          cart = (
            await query(
              `mutation($id:ID!,$lines:[CartLineUpdateInput!]!){cartLinesUpdate(cartId:$id,lines:$lines){cart{${cartFields}} userErrors{field message}}}`,
              { id: cart.id, lines: [{ id: line.id, quantity: b.quantity }] },
            )
          ).cartLinesUpdate.cart;
        else if (b.quantity)
          cart = (
            await query(
              `mutation($id:ID!,$lines:[CartLineInput!]!){cartLinesAdd(cartId:$id,lines:$lines){cart{${cartFields}} userErrors{field message}}}`,
              {
                id: cart.id,
                lines: [{ merchandiseId: b.variantId, quantity: b.quantity }],
              },
            )
          ).cartLinesAdd.cart;
      }
      return Response.json({ cart: normalizeCart(cart) });
    }
    if (b.action === "quote") {
      check(cart && cart.lines.nodes.length, "Your bag is empty.");
      if (b.code) {
        cart = (
          await query(
            `mutation($id:ID!,$codes:[String!]!){cartDiscountCodesUpdate(cartId:$id,discountCodes:$codes){cart{${cartFields}} userErrors{field message}}}`,
            { id: cart.id, codes: [String(b.code).toUpperCase()] },
          )
        ).cartDiscountCodesUpdate.cart;
        check(
          cart.discountCodes.every((d: any) => d.applicable),
          "This discount is not applicable.",
        );
      }
      const subtotal = minor(cart.cost.subtotalAmount.amount),
        total = minor(cart.cost.totalAmount.amount),
        tax = cart.cost.totalTaxAmount
          ? minor(cart.cost.totalTaxAmount.amount)
          : null;
      return Response.json({
        subtotal,
        discount: Math.max(0, subtotal - total + (tax ?? 0)),
        shipping: null,
        tax,
        total,
        estimated: true,
      });
    }
    if (b.action === "hostedCheckout") {
      const settings = await storeSettings();
      check(
        [
          "contactEmail",
          "phone",
          "shippingPolicy",
          "returnsPolicy",
          "privacyPolicy",
          "termsPolicy",
        ].every(
          (k) =>
            typeof settings[k] === "string" && settings[k].trim().length > 0,
        ),
        "Complete the store contact details and approved policies before enabling checkout.",
        503,
      );
      check(
        setting("LIVE_CHECKOUT_ENABLED") === "true",
        "Live checkout is disabled pending owner approval and provider verification.",
        503,
      );
      check(cart && cart.lines.nodes.length, "Your bag is empty.");
      check(
        cart.lines.nodes.every(
          (l: any) =>
            !l.merchandise.product.tags.some((t: string) =>
              ["demo", "sample"].includes(t.toLowerCase()),
            ),
        ),
        "Sample items cannot be ordered.",
      );
      return Response.json({
        url: safeCheckout(
          cart.checkoutUrl,
          setting("SHOPIFY_STORE_DOMAIN"),
          setting("SHOPIFY_CHECKOUT_DOMAIN"),
        ),
      });
    }
    check(
      false,
      "Use the connected commerce account or administration for this action.",
      400,
    );
  } catch (e) {
    const error = e as { status?: number; message?: string };
    return Response.json(
      {
        error: error.status
          ? error.message
          : "The commerce service is unavailable. Try again shortly.",
      },
      { status: error.status ?? 503 },
    );
  }
}
