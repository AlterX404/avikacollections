import { check } from "./commerce.mjs";
// The hosted commerce service remains authoritative for inventory, tax, orders,
// payment verification, customer accounts, fulfillment and refunds.
export function shopifyClient(config, transport = fetch) {
  check(
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.domain),
    "Configure a valid Shopify store domain.",
    503,
  );
  check(
    config.token && /^20\d{2}-(01|04|07|10)$/.test(config.version),
    "Configure Shopify credentials and an API version.",
    503,
  );
  return async (query, variables = {}) => {
    const response = await transport(
      `https://${config.domain}/api/${config.version}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Shopify-Storefront-Private-Token": config.token,
          ...(config.buyerIp&&/^[0-9a-fA-F:.]{3,45}$/.test(config.buyerIp)?{'Shopify-Storefront-Buyer-IP':config.buyerIp}:{}),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000),
      },
    );
    check(response.ok, "The commerce service is temporarily unavailable.", 503);
    const result = await response.json();
    check(
      !result.errors,
      "The commerce service could not process this request. Check store configuration.",
      502,
    );
    for (const value of Object.values(result.data ?? {})) {
      if (
        value &&
        typeof value === "object" &&
        "userErrors" in value &&
        value.userErrors?.length
      )
        check(false, value.userErrors.map((e) => e.message).join(" "));
    }
    return result.data;
  };
}
export function minor(amount) {
  check(
    /^\d+(\.\d{1,2})?$/.test(String(amount)),
    "Unsupported provider amount.",
    502,
  );
  const [whole, fraction = ""] = String(amount).split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  check(Number.isSafeInteger(value), "Amount too large.", 502);
  return value;
}
export function safeCheckout(url, domain, customDomain = "") {
  const u = new URL(url);
  check(
    u.protocol === "https:" &&
      (u.hostname === domain ||
        (customDomain && u.hostname === customDomain) ||
        u.hostname.endsWith(".shopify.com") ||
        u.hostname.endsWith(".myshopify.com")),
    "Unexpected checkout host.",
    502,
  );
  return u.toString();
}
export const cartFields = `id checkoutUrl totalQuantity discountCodes { code applicable } cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } totalTaxAmount { amount currencyCode } } lines(first:100) { nodes { id quantity cost { totalAmount { amount currencyCode } } merchandise { ... on ProductVariant { id title sku availableForSale price { amount currencyCode } selectedOptions { name value } product { handle title vendor tags featuredImage { url altText } } } } } }`;
export const catalogQuery = `query Catalog($cursor:String) @inContext(country:IN) { products(first:100,after:$cursor,sortKey:CREATED_AT,reverse:true) { pageInfo { hasNextPage endCursor } nodes { id handle title vendor productType description tags createdAt featuredImage { url altText } collections(first:5){nodes{title}} variants(first:100){nodes{id sku availableForSale price{amount currencyCode} selectedOptions{name value}}} } } }`;
export function normalizeProduct(p) {
  check(
    p.variants.nodes.every((v) => v.price.currencyCode === "INR"),
    "Configure INR for the connected Indian storefront.",
    503,
  );
  const option = (v, name, fallback) =>
    v.selectedOptions.find((o) => o.name.toLowerCase() === name)?.value ??
    fallback;
  return {
    id: p.handle,
    name: p.title,
    brand: p.vendor || "Brand information pending",
    category: p.productType || "Clothing",
    collection: p.collections.nodes[0]?.title ?? "All pieces",
    description: p.description,
    material: "See product description",
    care: "See product description",
    fit: "See product description",
    image: p.featuredImage?.url ?? "",
    demo: 0,
    status: "published",
    created: Date.parse(p.createdAt),
    variants: p.variants.nodes.map((v) => ({
      id: v.id,
      product_id: p.handle,
      sku: v.sku,
      size: option(v, "size", "One size"),
      color: option(v, "color", option(v, "colour", "As shown")),
      price: minor(v.price.amount),
      stock: v.availableForSale ? 20 : 0,
    })),
  };
}
export function normalizeCart(cart) {
  if (!cart) return [];
  return cart.lines.nodes.map((line) => {
    const v = line.merchandise;
    return {
      id: v.id,
      lineId: line.id,
      product_id: v.product.handle,
      quantity: line.quantity,
      name: v.product.title,
      brand: v.product.vendor,
      image: v.product.featuredImage?.url ?? "",
      size:
        v.selectedOptions.find((o) => o.name.toLowerCase() === "size")?.value ??
        "One size",
      color:
        v.selectedOptions.find((o) =>
          ["colour", "color"].includes(o.name.toLowerCase()),
        )?.value ?? "As shown",
      price: minor(v.price.amount),
      stock: v.availableForSale ? 20 : 0,
      status: "published",
      demo: 0,
    };
  });
}
