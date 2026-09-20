// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  collection: text("collection").notNull(),
  description: text("description").notNull(),
  material: text("material").notNull(),
  care: text("care").notNull(),
  fit: text("fit").notNull(),
  image: text("image").notNull(),
  status: text("status").notNull().default("draft"),
  demo: integer("demo").notNull().default(1),
  created: integer("created").notNull(),
});
export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku").notNull().unique(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    price: integer("price").notNull(),
    stock: integer("stock").notNull(),
  },
  (t) => [index("variants_product").on(t.productId)],
);
export const carts = sqliteTable("carts", {
  id: text("id").primaryKey(),
  created: integer("created").notNull(),
});
export const cartItems = sqliteTable(
  "cart_items",
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.variantId] })],
);
export const wishlists = sqliteTable(
  "wishlists",
  {
    owner: text("owner").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
  },
  (t) => [primaryKey({ columns: [t.owner, t.productId] })],
);
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull().default("{}"),
});
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    requestKey: text("request_key").notNull(),
    email: text("email").notNull(),
    address: text("address").notNull(),
    items: text("items").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull(),
    shipping: integer("shipping").notNull(),
    tax: integer("tax").notNull(),
    total: integer("total").notNull(),
    code: text("code"),
    payment: text("payment").notNull().default("pending"),
    fulfillment: text("fulfillment").notNull().default("unfulfilled"),
    cancellation: text("cancellation").notNull().default("none"),
    refund: text("refund").notNull().default("none"),
    tracking: text("tracking").notNull().default(""),
    demo: integer("demo").notNull().default(1),
    created: integer("created").notNull(),
  },
  (t) => [
    index("orders_owner").on(t.owner),
    index("orders_created").on(t.created),
  ],
);
export const events = sqliteTable("payment_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  status: text("status").notNull(),
  created: integer("created").notNull(),
});
export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  type: text("type").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  created: integer("created").notNull(),
});
export const discounts = sqliteTable("discounts", {
  code: text("code").primaryKey(),
  percent: integer("percent").notNull(),
  minimum: integer("minimum").notNull(),
  expires: integer("expires").notNull(),
  limit: integer("usage_limit").notNull(),
  used: integer("used").notNull().default(0),
  active: integer("active").notNull().default(1),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const inquiries = sqliteTable("inquiries", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  created: integer("created").notNull(),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detail: text("detail").notNull(),
  created: integer("created").notNull(),
});
export const outbox = sqliteTable("outbox", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("sandbox"),
  created: integer("created").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
export const providerCarts = sqliteTable("provider_carts", {
  owner: text("owner").primaryKey(),
  cartId: text("cart_id").notNull(),
});
export const liveWishlists = sqliteTable(
  "live_wishlists",
  { owner: text("owner").notNull(), productId: text("product_id").notNull() },
  (t) => [primaryKey({ columns: [t.owner, t.productId] })],
);
