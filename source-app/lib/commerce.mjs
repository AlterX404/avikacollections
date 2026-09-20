export class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function check(condition, message, status = 400) {
  if (!condition) throw new StoreError(message, status);
}
export function quantity(value) {
  check(
    Number.isInteger(value) && value >= 0 && value <= 20,
    "Quantity must be a whole number between 0 and 20.",
  );
  return value;
}
export function address(input) {
  const a = {};
  for (const key of [
    "name",
    "email",
    "phone",
    "line1",
    "line2",
    "city",
    "state",
    "postcode",
  ])
    a[key] = String(input[key] ?? "").trim();
  check(a.name.length >= 2 && a.name.length <= 100, "Enter your full name.");
  check(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) && a.email.length <= 254,
    "Enter a valid email.",
  );
  check(
    /^(?:\+91[ -]?)?[6-9]\d{9}$/.test(a.phone),
    "Enter a valid 10-digit Indian mobile number.",
  );
  check(/^[1-9]\d{5}$/.test(a.postcode), "Enter a valid 6-digit PIN code.");
  check(
    a.line1.length >= 5 &&
      a.line1.length <= 200 &&
      a.line2.length <= 200 &&
      a.city.length >= 2 &&
      a.city.length <= 100 &&
      a.state.length >= 2 &&
      a.state.length <= 100,
    "Enter a complete Indian delivery address.",
  );
  return a;
}
export function totals(items, discount, settings, now = Date.now()) {
  check(
    items.length > 0 && items.length <= 30,
    "Your bag is empty or has too many items.",
  );
  let subtotal = 0;
  for (const item of items) {
    quantity(item.quantity);
    check(item.quantity > 0, "Choose at least one item.");
    check(item.status === "published", "A product is no longer available.");
    check(
      Number.isSafeInteger(item.price) && item.price >= 0,
      "Invalid product price.",
    );
    check(
      item.stock >= item.quantity,
      "Stock changed. Please update your bag.",
    );
    subtotal += item.price * item.quantity;
  }
  check(
    Number.isSafeInteger(subtotal),
    "Order total exceeds supported limits.",
  );
  let saving = 0;
  if (discount) {
    check(
      discount.active === 1 && discount.expires > now,
      "This discount has expired or is inactive.",
    );
    check(
      discount.used < discount.usage_limit,
      "This discount has reached its usage limit.",
    );
    check(
      subtotal >= discount.minimum,
      "The bag does not meet this discount’s minimum spend.",
    );
    saving = Math.floor((subtotal * discount.percent) / 100);
  }
  const shipping =
    subtotal - saving >= settings.freeShipping ? 0 : settings.shipping;
  const tax = Math.floor(((subtotal - saving) * settings.taxBps) / 10000);
  return {
    subtotal,
    discount: saving,
    shipping,
    tax,
    total: subtotal - saving + shipping + tax,
  };
}
export function transition(current, next) {
  check(
    ["paid", "failed", "canceled", "pending"].includes(next),
    "Unknown payment outcome.",
  );
  check(
    current === "pending" || current === next,
    "This payment already has a final outcome.",
    409,
  );
  return next;
}
export function money(v) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(v / 100);
}
