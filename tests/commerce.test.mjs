import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { totals, quantity, address, transition } from "../lib/commerce.mjs";
const settings = { shipping: 9900, freeShipping: 299900, taxBps: 500 };
const item = { price: 169900, quantity: 1, stock: 2, status: "published" };
const discount = {
  active: 1,
  expires: 4102444800000,
  used: 0,
  usage_limit: 1,
  minimum: 100000,
  percent: 10,
};
test("money uses integer paise with consistent discount, shipping and tax", () =>
  assert.deepEqual(totals([item], discount, settings), {
    subtotal: 169900,
    discount: 16990,
    shipping: 9900,
    tax: 7645,
    total: 170455,
  }));
test("free shipping uses discounted subtotal", () =>
  assert.equal(totals([{ ...item, quantity: 2 }], null, settings).shipping, 0));
test("invalid quantities, empty bag and insufficient stock are rejected", () => {
  for (const q of [-1, 1.2, 21, NaN]) assert.throws(() => quantity(q));
  assert.throws(() => totals([], null, settings));
  assert.throws(() => totals([{ ...item, quantity: 3 }], null, settings));
});
test("expired, exhausted, inactive and minimum-spend discounts fail", () => {
  for (const d of [
    { ...discount, expires: 1 },
    { ...discount, used: 1 },
    { ...discount, active: 0 },
    { ...discount, minimum: 999999 },
  ])
    assert.throws(() => totals([item], d, settings));
});
test("Indian address validation rejects malformed PIN and phone", () => {
  const a = {
    name: "Test Customer",
    email: "customer@example.test",
    phone: "9000000000",
    line1: "Sample address only",
    line2: "",
    city: "New Delhi",
    state: "Delhi",
    postcode: "110024",
  };
  assert.equal(address(a).postcode, "110024");
  assert.throws(() => address({ ...a, postcode: "123" }));
  assert.throws(() => address({ ...a, phone: "1" }));
});
test("payment transitions cannot overwrite a final outcome", () => {
  assert.equal(transition("pending", "paid"), "paid");
  assert.equal(transition("paid", "paid"), "paid");
  assert.throws(() => transition("paid", "failed"));
});
function setup() {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys=ON");
  for (const f of [
    "drizzle/0000_familiar_hairball.sql",
    "drizzle/0001_commerce_guards.sql",
    "db/demo-seed.sql",
  ])
    d.exec(readFileSync(f, "utf8"));
  return d;
}
function insert(d, id = "test", qty = 1, overrides = {}) {
  const p = d
    .prepare("SELECT price,stock FROM variants WHERE id='ivory-linen-shirt-M'")
    .get();
  const value = {
    id,
    owner: "test-owner",
    request_key: id,
    email: "customer@example.test",
    address: "{}",
    items: JSON.stringify([
      { variantId: "ivory-linen-shirt-M", price: p.price, quantity: qty },
    ]),
    subtotal: p.price * qty,
    discount: 0,
    shipping: 9900,
    tax: 0,
    total: p.price * qty + 9900,
    code: null,
    payment: "pending",
    fulfillment: "unfulfilled",
    cancellation: "none",
    refund: "none",
    tracking: "",
    demo: 1,
    created: Date.now(),
    ...overrides,
  };
  d.prepare(
    `INSERT INTO orders(${Object.keys(value).join(",")}) VALUES(${Object.keys(
      value,
    )
      .map(() => "?")
      .join(",")})`,
  ).run(...Object.values(value));
}
test("atomic reservations prevent overselling and duplicate orders", () => {
  const d = setup();
  const before = d
    .prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'")
    .get().stock;
  insert(d, "one", before);
  assert.equal(
    d.prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'").get()
      .stock,
    0,
  );
  assert.throws(() => insert(d, "two"));
  assert.throws(() => insert(d, "one"));
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM orders").get().n, 1);
  d.close();
});
test("stock and price changes after quote are rejected in database", () => {
  const d = setup();
  assert.throws(() =>
    insert(d, "bad-price", 1, {
      items: JSON.stringify([
        { variantId: "ivory-linen-shirt-M", price: 1, quantity: 1 },
      ]),
    }),
  );
  d.prepare(
    "UPDATE products SET status='archived' WHERE id='ivory-linen-shirt'",
  ).run();
  assert.throws(() => insert(d));
  d.close();
});
test("failed and canceled payments restore stock exactly once", () => {
  for (const state of ["failed", "canceled"]) {
    const d = setup();
    const before = d
      .prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'")
      .get().stock;
    insert(d);
    d.prepare("UPDATE orders SET payment=? WHERE id=?").run(state, "test");
    d.prepare("UPDATE orders SET payment=? WHERE id=?").run(state, "test");
    assert.equal(
      d
        .prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'")
        .get().stock,
      before,
    );
    d.close();
  }
});
test("sample refund restores inventory once and retains paid state", () => {
  const d = setup();
  insert(d);
  d.prepare("UPDATE orders SET payment='paid' WHERE id='test'").run();
  const before = d
    .prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'")
    .get().stock;
  d.prepare("UPDATE orders SET refund='refunded' WHERE id='test'").run();
  d.prepare("UPDATE orders SET refund='refunded' WHERE id='test'").run();
  assert.equal(
    d.prepare("SELECT stock FROM variants WHERE id='ivory-linen-shirt-M'").get()
      .stock,
    before + 1,
  );
  assert.equal(
    d.prepare("SELECT payment FROM orders WHERE id='test'").get().payment,
    "paid",
  );
  d.close();
});
test("payment events reject duplicates and conflicting outcomes", () => {
  const d = setup();
  insert(d);
  const event = d.prepare(
    "INSERT INTO payment_events(id,order_id,status,created) VALUES(?,?,?,?)",
  );
  event.run("event", "test", "paid", Date.now());
  d.prepare("UPDATE orders SET payment='paid' WHERE id='test'").run();
  assert.throws(() => event.run("event", "test", "paid", Date.now()));
  assert.throws(() => event.run("other", "test", "failed", Date.now()));
  d.close();
});
test("live products cannot enter sample orders", () => {
  const d = setup();
  assert.throws(() => insert(d, "live", 1, { demo: 0 }));
  d.prepare("UPDATE products SET demo=0 WHERE id='ivory-linen-shirt'").run();
  assert.throws(() => insert(d));
  d.close();
});
test("discount usage is atomic and purchase snapshots survive catalog edits", () => {
  const d = setup();
  d.prepare("UPDATE discounts SET usage_limit=1 WHERE code='DEMO10'").run();
  insert(d, "one", 1, { code: "DEMO10", discount: 16990 });
  assert.throws(() => insert(d, "two", 1, { code: "DEMO10", discount: 16990 }));
  d.prepare(
    "UPDATE variants SET price=999999 WHERE id='ivory-linen-shirt-M'",
  ).run();
  assert.equal(
    JSON.parse(
      d.prepare("SELECT items FROM orders WHERE id='one'").get().items,
    )[0].price,
    169900,
  );
  d.close();
});
