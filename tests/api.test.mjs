import assert from "node:assert/strict";
const origin = process.env.TEST_ORIGIN ?? "http://localhost:5173";
assert.match(
  origin,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
  "Integration tests must target a local demo server.",
);
const cookies = new Map();
async function request(action, body, extra = {}) {
  const r = await fetch(
    origin + "/api/store" + (body ? "" : "?action=" + action),
    {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
        ...extra,
      },
      body: body ? JSON.stringify({ action, ...body }) : undefined,
    },
  );
  for (const c of r.headers.getSetCookie()) {
    const [n, v] = c.split(";")[0].split("=");
    cookies.set(n, v);
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: r.status, data };
}
let r = await request("bootstrap");
assert.equal(r.status, 200);
assert.equal(r.data.products.length >= 4, true);
assert.equal((await request("admin")).status, 403);
assert.equal((await request("settings", { settings: {} })).status, 403);
assert.equal(
  (
    await request(
      "cart",
      { variantId: "ivory-linen-shirt-M", quantity: 1 },
      { Origin: "https://evil.example" },
    )
  ).status,
  403,
);
assert.equal(
  (await request("cart", { variantId: "ivory-linen-shirt-XL", quantity: 1 }))
    .status,
  400,
);
assert.equal(
  (await request("cart", { variantId: "ivory-linen-shirt-M", quantity: 1 }))
    .status,
  200,
);
assert.equal((await request("bootstrap")).data.cart[0].quantity, 1);
assert.equal((await request("quote", { code: "INVALID" })).status, 400);
assert.equal((await request("quote", { code: "EXPIRED" })).status, 400);
assert.equal((await request("quote", { code: "DEMO10" })).data.discount, 16990);
const key = crypto.randomUUID();
const checkout = {
  requestKey: key,
  address: {
    name: "Sample Buyer",
    email: "sample@example.test",
    phone: "9000000000",
    line1: "Fictional test address",
    line2: "",
    city: "New Delhi",
    state: "Delhi",
    postcode: "110024",
  },
  code: "DEMO10",
  demoConsent: true,
};
assert.equal(
  (
    await request("checkout", {
      ...checkout,
      address: { ...checkout.address, postcode: "123" },
    })
  ).status,
  400,
);
r = await request("checkout", checkout);
assert.equal(r.status, 200, JSON.stringify(r.data));
const id = r.data.id;
assert.equal((await request("checkout", checkout)).data.id, id);
let eventId = crypto.randomUUID();
assert.equal(
  (await request("simulatePayment", { id, outcome: "pending", eventId }))
    .status,
  200,
);
eventId = crypto.randomUUID();
assert.equal(
  (await request("simulatePayment", { id, outcome: "paid", eventId })).status,
  200,
);
assert.equal(
  (await request("simulatePayment", { id, outcome: "paid", eventId })).data
    .duplicate,
  true,
);
assert.equal(
  (
    await request("simulatePayment", {
      id,
      outcome: "failed",
      eventId: crypto.randomUUID(),
    })
  ).status,
  409,
);
assert.equal(
  (
    await request("request", {
      id,
      type: "cancellation",
      reason: "Testing the sample cancellation workflow",
    })
  ).status,
  200,
);
assert.equal(
  (
    await request("request", {
      id,
      type: "cancellation",
      reason: "Duplicate test request",
    })
  ).status,
  400,
);
assert.equal(
  (await request("wishlist", { productId: "rust-kurta", saved: true })).status,
  200,
);
assert.equal(
  (await request("bootstrap")).data.wishlist.includes("rust-kurta"),
  true,
);
assert.equal(
  (
    await request("inquiry", {
      name: "Sample Buyer",
      email: "sample@example.test",
      message: "This is an automated local store test inquiry.",
      consent: true,
      website: "",
    })
  ).status,
  200,
);
const session = await fetch(origin + "/signin-with-chatgpt?return_to=/admin", {
  redirect: "manual",
});
for (const c of session.headers.getSetCookie()) {
  const [n, v] = c.split(";")[0].split("=");
  cookies.set(n, v);
}
r = await request("bootstrap");
assert.equal(r.data.admin, true, "Local staff identity should be authorized");
r = await request("admin");
assert.equal(r.status, 200);
const cancellation = r.data.requests.find((x) => x.order_id === id);
assert.ok(cancellation);
assert.equal(
  (await request("reviewRequest", { id: cancellation.id, status: "approved" }))
    .status,
  200,
);
const stored = (await request("admin")).data.orders.find((x) => x.id === id);
assert.equal(stored.refund, "refunded");
const v = (await request("admin")).data.variants.find(
  (v) => v.id === "rust-kurta-M",
);
assert.equal(
  (await request("variant", { variant: { ...v, stock: v.stock + 1 } })).status,
  200,
);
assert.equal((await request("variant", { variant: v })).status, 200);
// Signed-in checkout, fulfillment, return and profile management.
assert.equal(
  (await request("cart", { variantId: "rust-kurta-M", quantity: 1 })).status,
  200,
);
const signed = await request("checkout", {
  ...checkout,
  requestKey: crypto.randomUUID(),
  code: "",
});
assert.equal(signed.status, 200);
assert.equal(
  (
    await request("simulatePayment", {
      id: signed.data.id,
      outcome: "paid",
      eventId: crypto.randomUUID(),
    })
  ).status,
  200,
);
assert.equal(
  (
    await request("fulfill", {
      id: signed.data.id,
      status: "shipped",
      tracking: "https://example.test/tracking/sample",
    })
  ).status,
  200,
);
assert.equal(
  (
    await request("fulfill", {
      id: signed.data.id,
      status: "delivered",
      tracking: "https://example.test/tracking/sample",
    })
  ).status,
  200,
);
assert.equal(
  (
    await request("request", {
      id: signed.data.id,
      type: "return",
      reason: "Testing the delivered sample return workflow",
    })
  ).status,
  200,
);
const returnRequest = (await request("admin")).data.requests.find(
  (x) => x.order_id === signed.data.id,
);
assert.equal(
  (await request("reviewRequest", { id: returnRequest.id, status: "approved" }))
    .status,
  200,
);
assert.equal(
  (await request("reviewRequest", { id: returnRequest.id, status: "approved" }))
    .status,
  409,
);
assert.equal(
  (await request("profile", { address: checkout.address })).status,
  200,
);
assert.equal((await request("account")).data.profile.name, "Sample Buyer");
assert.equal(
  (await request("account")).data.orders.some((o) => o.id === id),
  true,
  "Guest orders transfer to the signed-in account",
);
const uploadHeaders = {
  Origin: origin,
  Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
};
const svg = await fetch(origin + "/api/upload", {
  method: "POST",
  headers: { ...uploadHeaders, "Content-Type": "image/svg+xml" },
  body: '<svg xmlns="http://www.w3.org/2000/svg" />',
});
assert.equal(svg.status, 400);
const { readFileSync } = await import("node:fs");
const uploaded = await fetch(origin + "/api/upload", {
  method: "POST",
  headers: { ...uploadHeaders, "Content-Type": "image/webp" },
  body: readFileSync("public/images/shirt.webp"),
});
assert.equal(uploaded.status, 200);
const media = await uploaded.json();
const imageResponse = await fetch(origin + media.url);
assert.equal(imageResponse.status, 200);
assert.equal(imageResponse.headers.get("content-type"), "image/webp");
assert.equal(imageResponse.headers.get("x-content-type-options"), "nosniff");
console.log(
  "API checks passed: catalog, authorization, CSRF, stock, bag persistence, discounts, address validation, idempotent guest checkout, pending/paid/conflicting payments, duplicate events, wishlist, inquiry, staff access, cancellation/refund and stock audit.",
);
