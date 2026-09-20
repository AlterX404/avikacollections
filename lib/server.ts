import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { check } from "./commerce.mjs";
export function db() {
  if (!env.DB) throw new Error("Store database unavailable");
  return env.DB;
}
export function setting(name: string) {
  return String(
    (env as unknown as Record<string, unknown>)[name] ??
      process.env[name] ??
      "",
  );
}
export async function identity() {
  const user = await getChatGPTUser();
  const jar = await cookies();
  let guest = jar.get("avika_bag")?.value;
  if (!guest || !/^[a-f0-9-]{36}$/.test(guest)) {
    guest = crypto.randomUUID();
    jar.set("avika_bag", guest, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  const owner = user?.userId ?? guest;
  if (user) {
    await db().batch([
      db()
        .prepare("INSERT OR IGNORE INTO carts(id,created) VALUES(?,?)")
        .bind(owner, Date.now()),
      db()
        .prepare(
          "INSERT INTO cart_items(cart_id,variant_id,quantity) SELECT ?,variant_id,quantity FROM cart_items WHERE cart_id=? ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=min(20,cart_items.quantity+excluded.quantity)",
        )
        .bind(owner, guest),
      db().prepare("DELETE FROM cart_items WHERE cart_id=?").bind(guest),
      db()
        .prepare(
          "INSERT OR IGNORE INTO wishlists(owner,product_id) SELECT ?,product_id FROM wishlists WHERE owner=?",
        )
        .bind(owner, guest),
      db().prepare("DELETE FROM wishlists WHERE owner=?").bind(guest),
      db()
        .prepare("UPDATE orders SET owner=? WHERE owner=?")
        .bind(owner, guest),
    ]);
  }
  const admin =
    !!user &&
    setting("STAFF_USER_IDS")
      .split(",")
      .map((x) => x.trim())
      .includes(user.userId);
  const support =
    admin ||
    (!!user &&
      setting("SUPPORT_USER_IDS")
        .split(",")
        .map((x) => x.trim())
        .includes(user.userId));
  return { owner, guest, user, admin, support };
}
export async function storeSettings() {
  const row = await db()
    .prepare("SELECT value FROM settings WHERE key='store'")
    .first<{ value: string }>();
  check(row, "The store needs its initial database setup.", 503);
  return JSON.parse(row!.value);
}
export async function cart(owner: string) {
  await db()
    .prepare("INSERT OR IGNORE INTO carts(id,created) VALUES(?,?)")
    .bind(owner, Date.now())
    .run();
  return (
    await db()
      .prepare(
        "SELECT c.quantity,v.*,p.name,p.brand,p.image,p.status,p.demo FROM cart_items c JOIN variants v ON v.id=c.variant_id JOIN products p ON p.id=v.product_id WHERE c.cart_id=?",
      )
      .bind(owner)
      .all()
  ).results;
}
export async function audit(
  actor: string,
  action: string,
  target: string,
  detail: unknown,
) {
  return db()
    .prepare(
      "INSERT INTO audit(id,actor,action,target,detail,created) VALUES(?,?,?,?,?,?)",
    )
    .bind(
      crypto.randomUUID(),
      actor,
      action,
      target,
      JSON.stringify(detail),
      Date.now(),
    );
}
export async function rate(key: string, limit = 30) {
  const now = Date.now();
  await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END",
    )
    .bind(key, now + 3600000, now, now, now + 3600000)
    .run();
  const r = await db()
    .prepare("SELECT count FROM rate_limits WHERE key=?")
    .bind(key)
    .first<{ count: number }>();
  check(r!.count <= limit, "Too many requests. Please try again later.", 429);
}
