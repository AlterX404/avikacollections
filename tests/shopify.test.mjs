import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shopifyClient,
  minor,
  safeCheckout,
  normalizeProduct,
} from "../lib/shopify.mjs";
test("provider money parses exact paise without floating-point rounding", () => {
  assert.equal(minor("1699.90"), 169990);
  assert.equal(minor("0.01"), 1);
  assert.throws(() => minor("1.005"));
  assert.throws(() => minor("-1"));
});
test("credentials can only be sent to the configured Shopify store", () => {
  assert.throws(() =>
    shopifyClient({
      domain: "evil.example",
      token: "test",
      version: "2026-07",
    }),
  );
  assert.throws(() =>
    shopifyClient({
      domain: "store.myshopify.com",
      token: "",
      version: "2026-07",
    }),
  );
  assert.throws(() =>
    safeCheckout("https://evil.example/checkout", "store.myshopify.com"),
  );
  assert.throws(() =>
    safeCheckout("javascript:alert(1)", "store.myshopify.com"),
  );
  assert.equal(
    safeCheckout(
      "https://store.myshopify.com/checkouts/test",
      "store.myshopify.com",
    ),
    "https://store.myshopify.com/checkouts/test",
  );
});
test("provider request uses a server token and surfaces checkout errors", async () => {
  let sent;
  const client = shopifyClient(
    {
      domain: "example.myshopify.com",
      token: "test-not-a-secret",
      version: "2026-07",
    },
    async (url, init) => {
      sent = { url, init };
      return Response.json({
        data: {
          cartCreate: { userErrors: [{ message: "Not enough inventory" }] },
        },
      });
    },
  );
  await assert.rejects(
    () => client("mutation { cartCreate { cart { id } } }"),
    /Not enough inventory/,
  );
  assert.equal(
    sent.init.headers["Shopify-Storefront-Private-Token"],
    "test-not-a-secret",
  );
  assert.match(sent.url, /^https:\/\/example\.myshopify\.com/);
});
test("provider failures do not silently fall back to demonstration catalog", async () => {
  const client = shopifyClient(
    { domain: "example.myshopify.com", token: "test", version: "2026-07" },
    async () => new Response("unavailable", { status: 503 }),
  );
  await assert.rejects(() => client("query { shop { name } }"), /unavailable/);
});
test("real product vendor is preserved independently of retailer identity", () => {
  const p = {
    handle: "real-shirt",
    title: "Shirt",
    vendor: "Actual maker",
    productType: "Men",
    description: "Description",
    createdAt: "2026-01-01",
    collections: { nodes: [] },
    featuredImage: { url: "https://cdn.shopify.com/test.jpg" },
    variants: {
      nodes: [
        {
          id: "gid://shopify/ProductVariant/1",
          sku: "ABC",
          availableForSale: true,
          price: { amount: "1000.00", currencyCode: "INR" },
          selectedOptions: [
            { name: "Size", value: "M" },
            { name: "Colour", value: "Blue" },
          ],
        },
      ],
    },
  };
  const result = normalizeProduct(p);
  assert.equal(result.brand, "Actual maker");
  assert.equal(result.demo, 0);
  assert.equal(result.variants[0].color, "Blue");
  p.variants.nodes[0].price.currencyCode = "USD";
  assert.throws(() => normalizeProduct(p));
});
