import { NextResponse } from "next/server";
import {
  db,
  identity,
  cart,
  storeSettings,
  audit,
  rate,
  setting,
} from "../../../lib/server";
import {
  check,
  quantity,
  address,
  totals,
  transition,
} from "../../../lib/commerce.mjs";
import { z } from "zod";
import {
  isLiveCommerce,
  liveBootstrap,
  liveAction,
} from "../../../lib/live-commerce";
export const dynamic = "force-dynamic";
const reply = (v: unknown, status = 200) =>
  NextResponse.json(v, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function failure(e: unknown) {
  const err = e as { status?: number; message?: string };
  if (!err.status) console.error("store_request_failed", err.message);
  return reply(
    {
      error: err.status
        ? err.message
        : "The store could not complete that action. Please try again.",
    },
    err.status ?? 500,
  );
}
export async function GET(request: Request) {
  try {
    const who = await identity();
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "bootstrap";
    if (action === "bootstrap") {
      if (isLiveCommerce()) return reply(await liveBootstrap());
      const products = (
        await db()
          .prepare(
            "SELECT * FROM products WHERE status='published' ORDER BY created DESC,id",
          )
          .all()
      ).results;
      const variants = (
        await db()
          .prepare(
            "SELECT v.* FROM variants v JOIN products p ON p.id=v.product_id WHERE p.status='published'",
          )
          .all()
      ).results;
      return reply({
        products: products.map((p) => ({
          ...p,
          variants: variants.filter((v) => v.product_id === p.id),
        })),
        cart: await cart(who.owner),
        wishlist: (
          await db()
            .prepare("SELECT product_id FROM wishlists WHERE owner=?")
            .bind(who.owner)
            .all()
        ).results.map((x) => x.product_id),
        settings: await storeSettings(),
        user: who.user,
        admin: who.admin,
        support: who.support,
        mode: "sandbox",
      });
    }
    if (action === "account") {
      const orders = (
        await db()
          .prepare("SELECT * FROM orders WHERE owner=? ORDER BY created DESC")
          .bind(who.owner)
          .all()
      ).results;
      const profile = who.user
        ? await db()
            .prepare("SELECT * FROM customers WHERE id=?")
            .bind(who.owner)
            .first()
        : null;
      const requests = (
        await db()
          .prepare(
            "SELECT r.* FROM requests r JOIN orders o ON o.id=r.order_id WHERE o.owner=?",
          )
          .bind(who.owner)
          .all()
      ).results;
      return reply({ orders, profile, requests });
    }
    if (action === "admin") {
      check(who.support, "Staff access is required.", 403);
      const orders = (
        await db()
          .prepare("SELECT * FROM orders ORDER BY created DESC LIMIT 200")
          .all()
      ).results;
      const products = (
        await db().prepare("SELECT * FROM products ORDER BY created DESC").all()
      ).results;
      return reply({
        orders,
        products,
        variants: (await db().prepare("SELECT * FROM variants").all()).results,
        inquiries: (
          await db()
            .prepare("SELECT * FROM inquiries ORDER BY created DESC LIMIT 100")
            .all()
        ).results,
        requests: (
          await db()
            .prepare("SELECT * FROM requests ORDER BY created DESC LIMIT 100")
            .all()
        ).results,
        discounts: who.admin
          ? (await db().prepare("SELECT * FROM discounts").all()).results
          : [],
        audit: who.admin
          ? (
              await db()
                .prepare("SELECT * FROM audit ORDER BY created DESC LIMIT 100")
                .all()
            ).results
          : [],
        outbox: who.admin
          ? (
              await db()
                .prepare("SELECT * FROM outbox ORDER BY created DESC LIMIT 100")
                .all()
            ).results
          : [],
        settings: await storeSettings(),
      });
    }
    if (action === "order") {
      const id = url.searchParams.get("id");
      const order = await db()
        .prepare("SELECT * FROM orders WHERE id=? AND owner=?")
        .bind(id, who.owner)
        .first();
      check(order, "Order not found.", 404);
      return reply({ order });
    }
    return reply({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  if (isLiveCommerce()) {
    const copy = request.clone();
    try {
      const body = (await copy.json()) as { action?: string };
      if (
        ["cart", "wishlist", "quote", "hostedCheckout", "checkout"].includes(
          body.action ?? "",
        )
      )
        return liveAction(request);
    } catch {
      return reply({ error: "Invalid request." }, 400);
    }
  }
  try {
    check(
      request.headers.get("origin") === new URL(request.url).origin,
      "Request origin rejected.",
      403,
    );
    check(
      Number(request.headers.get("content-length") ?? 0) < 65536,
      "Request too large.",
      413,
    );
    const raw = await request.text();
    check(raw.length < 65536, "Request too large.", 413);
    let b;
    try {
      b = JSON.parse(raw);
    } catch {
      check(false, "Invalid JSON.");
    }
    const who = await identity();
    const action = String(b.action ?? "");
    await rate("write:" + who.owner, 300);
    if (action === "cart") {
      quantity(b.quantity);
      if (b.quantity === 0) {
        await db()
          .prepare("DELETE FROM cart_items WHERE cart_id=? AND variant_id=?")
          .bind(who.owner, String(b.variantId))
          .run();
        return reply({ cart: await cart(who.owner) });
      }
      const v = await db()
        .prepare(
          "SELECT v.*,p.status FROM variants v JOIN products p ON p.id=v.product_id WHERE v.id=?",
        )
        .bind(String(b.variantId))
        .first();
      check(v && v.status === "published", "Product unavailable.");
      check(b.quantity <= Number(v!.stock), "That quantity is not available.");
      await cart(who.owner);
      if (b.quantity === 0)
        await db()
          .prepare("DELETE FROM cart_items WHERE cart_id=? AND variant_id=?")
          .bind(who.owner, b.variantId)
          .run();
      else
        await db()
          .prepare(
            "INSERT INTO cart_items(cart_id,variant_id,quantity) VALUES(?,?,?) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=excluded.quantity",
          )
          .bind(who.owner, b.variantId, b.quantity)
          .run();
      return reply({ cart: await cart(who.owner) });
    }
    if (action === "wishlist") {
      const p = await db()
        .prepare("SELECT id FROM products WHERE id=? AND status='published'")
        .bind(String(b.productId))
        .first();
      check(p, "Product not found.", 404);
      if (b.saved)
        await db()
          .prepare(
            "INSERT OR IGNORE INTO wishlists(owner,product_id) VALUES(?,?)",
          )
          .bind(who.owner, b.productId)
          .run();
      else
        await db()
          .prepare("DELETE FROM wishlists WHERE owner=? AND product_id=?")
          .bind(who.owner, b.productId)
          .run();
      return reply({ ok: true });
    }
    if (action === "quote" || action === "checkout") {
      if (action === "checkout" && typeof b.requestKey === "string") {
        const prior = await db()
          .prepare("SELECT id FROM orders WHERE owner=? AND request_key=?")
          .bind(who.owner, b.requestKey)
          .first();
        if (prior) return reply({ id: prior.id });
      }
      const items = await cart(who.owner);
      const settings = await storeSettings();
      const code = String(b.code ?? "")
        .trim()
        .toUpperCase();
      const discount = code
        ? await db()
            .prepare("SELECT * FROM discounts WHERE code=?")
            .bind(code)
            .first()
        : null;
      check(!code || discount, "Discount code not found.");
      const sum = totals(items, discount, settings);
      if (action === "quote") return reply(sum);
      check(
        items.every((x) => x.demo === 1),
        "Live ordering is disabled.",
      );
      check(b.demoConsent === true, "Confirm that this is a simulated order.");
      const shippingAddress: any = address(b.address ?? {});
      check(
        typeof b.requestKey === "string" &&
          /^[a-f0-9-]{36}$/.test(b.requestKey),
        "Invalid checkout request.",
      );
      const id =
        "DEMO-" +
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(who.owner + b.requestKey),
            ),
          ),
        )
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")
          .slice(0, 24);
      const existing = await db()
        .prepare("SELECT id FROM orders WHERE id=? AND owner=?")
        .bind(id, who.owner)
        .first();
      if (existing) return reply({ id });
      await rate("checkout:" + who.owner, 20);
      const snapshots = items.map((x) => ({
        variantId: x.id,
        name: x.name,
        brand: x.brand,
        sku: x.sku,
        size: x.size,
        color: x.color,
        price: x.price,
        quantity: x.quantity,
        image: x.image,
      }));
      const insert = db()
        .prepare(
          "INSERT INTO orders(id,owner,request_key,email,address,items,subtotal,discount,shipping,tax,total,code,payment,fulfillment,cancellation,refund,tracking,demo,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          who.owner,
          b.requestKey,
          shippingAddress.email,
          JSON.stringify(shippingAddress),
          JSON.stringify(snapshots),
          sum.subtotal,
          sum.discount,
          sum.shipping,
          sum.tax,
          sum.total,
          code || null,
          "pending",
          "unfulfilled",
          "none",
          "none",
          "",
          1,
          Date.now(),
        );
      try {
        await db().batch([
          insert,
          db()
            .prepare("DELETE FROM cart_items WHERE cart_id=?")
            .bind(who.owner),
        ]);
      } catch (e) {
        const duplicate = await db()
          .prepare("SELECT id FROM orders WHERE id=? AND owner=?")
          .bind(id, who.owner)
          .first();
        if (duplicate) return reply({ id });
        check(
          false,
          "Stock or discount availability changed. Refresh your bag and try again.",
          409,
        );
      }
      return reply({ id });
    }
    if (action === "simulatePayment") {
      const order = await db()
        .prepare("SELECT * FROM orders WHERE id=? AND owner=? AND demo=1")
        .bind(String(b.id), who.owner)
        .first();
      check(order, "Sample order not found.", 404);
      const outcome = transition(order!.payment, b.outcome);
      const eventId = String(b.eventId ?? "");
      check(/^[a-f0-9-]{36}$/.test(eventId), "Invalid payment event.");
      const old = await db()
        .prepare("SELECT * FROM payment_events WHERE id=?")
        .bind(eventId)
        .first();
      if (old) {
        check(
          old.order_id === b.id && old.status === outcome,
          "Event conflict.",
          409,
        );
        return reply({ ok: true, duplicate: true });
      }
      await db().batch([
        db()
          .prepare(
            "INSERT INTO payment_events(id,order_id,status,created) VALUES(?,?,?,?)",
          )
          .bind(eventId, b.id, outcome, Date.now()),
        db()
          .prepare(
            "UPDATE orders SET payment=? WHERE id=? AND payment='pending'",
          )
          .bind(outcome, b.id),
        db()
          .prepare(
            "INSERT OR IGNORE INTO outbox(id,order_id,recipient,subject,body,status,created) VALUES(?,?,?,?,?,?,?)",
          )
          .bind(
            b.id + "-" + outcome,
            b.id,
            order!.email,
            "Avika Collection — sample order " + outcome,
            "DEMONSTRATION ONLY. Order " +
              b.id +
              " is " +
              outcome +
              ". No payment was collected and no goods will ship.",
            "sandbox",
            Date.now(),
          ),
      ]);
      return reply({ ok: true });
    }
    if (action === "request") {
      check(
        ["cancellation", "return"].includes(b.type),
        "Invalid request type.",
      );
      const order = await db()
        .prepare("SELECT * FROM orders WHERE id=? AND owner=?")
        .bind(String(b.id), who.owner)
        .first();
      check(order, "Order not found.", 404);
      const reason = z.string().trim().min(5).max(1000).parse(b.reason);
      if (b.type === "cancellation")
        check(
          order!.fulfillment === "unfulfilled" &&
            order!.cancellation === "none" &&
            ["paid", "pending"].includes(String(order!.payment)),
          "This order cannot be canceled.",
        );
      else {
        const settings = await storeSettings();
        check(
          order!.fulfillment === "delivered" &&
            order!.payment === "paid" &&
            order!.refund === "none" &&
            Date.now() - Number(order!.created) <=
              settings.returnDays * 86400000,
          "This sample order is not eligible for a return.",
        );
      }
      check(
        !(await db()
          .prepare(
            "SELECT id FROM requests WHERE order_id=? AND type=? AND status!='rejected'",
          )
          .bind(b.id, b.type)
          .first()),
        "A request already exists.",
        409,
      );
      await db().batch([
        db()
          .prepare(
            "INSERT INTO requests(id,order_id,type,reason,status,created) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            b.id,
            b.type,
            reason,
            "requested",
            Date.now(),
          ),
        db()
          .prepare(
            b.type === "cancellation"
              ? "UPDATE orders SET cancellation='requested' WHERE id=?"
              : "UPDATE orders SET refund='requested' WHERE id=?",
          )
          .bind(b.id),
      ]);
      return reply({ ok: true });
    }
    if (action === "profile") {
      check(who.user, "Please sign in first.", 401);
      const a: any = address(b.address ?? {});
      await db()
        .prepare(
          "INSERT INTO customers(id,name,email,address) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,address=excluded.address",
        )
        .bind(who.owner, a.name, a.email, JSON.stringify(a))
        .run();
      return reply({ ok: true });
    }
    if (action === "inquiry") {
      await rate(
        "contact:" + request.headers.get("cf-connecting-ip") + ":" + who.guest,
        5,
      );
      check(!b.website, "Unable to submit.");
      const inquiry = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.string().email().max(254),
          message: z.string().trim().min(10).max(3000),
          consent: z.literal(true),
        })
        .safeParse(b);
      check(
        inquiry.success,
        "Enter your name, email, a message of at least 10 characters, and consent.",
      );
      await db()
        .prepare(
          "INSERT INTO inquiries(id,name,email,message,status,created) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          inquiry.data!.name,
          inquiry.data!.email,
          inquiry.data!.message,
          "new",
          Date.now(),
        )
        .run();
      return reply({ ok: true });
    }
    check(who.support, "Staff access is required.", 403);
    if (action === "fulfill") {
      check(
        ["unfulfilled", "shipped", "delivered"].includes(b.status),
        "Invalid fulfillment status.",
      );
      const row = await db()
        .prepare("SELECT * FROM orders WHERE id=?")
        .bind(String(b.id))
        .first();
      check(
        row &&
          row.payment === "paid" &&
          row.cancellation === "none" &&
          row.refund === "none",
        "Only paid, active orders can be fulfilled.",
      );
      const rank = { unfulfilled: 0, shipped: 1, delivered: 2 };
      check(
        rank[b.status as keyof typeof rank] >=
          rank[row!.fulfillment as keyof typeof rank],
        "Fulfillment cannot move backward.",
      );
      const tracking = String(b.tracking ?? "").trim();
      check(
        tracking.length <= 500 &&
          (!tracking || /^https:\/\/[^\s]+$/.test(tracking)),
        "Use a valid HTTPS tracking URL.",
      );
      await db().batch([
        db()
          .prepare("UPDATE orders SET fulfillment=?,tracking=? WHERE id=?")
          .bind(b.status, tracking, b.id),
        await audit(who.owner, "fulfillment", b.id, {
          status: b.status,
          tracking,
        }),
      ]);
      return reply({ ok: true });
    }
    if (action === "inquiryStatus") {
      check(["new", "resolved"].includes(b.status), "Invalid status.");
      await db().batch([
        db()
          .prepare("UPDATE inquiries SET status=? WHERE id=?")
          .bind(b.status, String(b.id)),
        await audit(who.owner, "inquiry", b.id, b.status),
      ]);
      return reply({ ok: true });
    }
    check(who.admin, "Owner access is required.", 403);
    if (action === "product") {
      const p = z
        .object({
          id: z.string().regex(/^[a-z0-9-]{3,70}$/),
          name: z.string().min(3).max(150),
          brand: z.string().min(2).max(100),
          category: z.string().min(2).max(70),
          collection: z.string().min(2).max(100),
          description: z.string().min(5).max(3000),
          material: z.string().min(2).max(200),
          care: z.string().min(2).max(400),
          fit: z.string().min(2).max(100),
          image: z
            .string()
            .regex(
              /^\/(?:images\/[a-zA-Z0-9._-]+|media\/[a-f0-9-]{36})\.(webp|png|jpg)$/,
            ),
          status: z.enum(["draft", "published", "archived"]),
        })
        .safeParse(b.product);
      check(p.success, "Check all product fields. Use a local image asset.");
      const v = p.data!;
      await db().batch([
        db()
          .prepare(
            "INSERT INTO products(id,name,brand,category,collection,description,material,care,fit,image,status,demo,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,collection=excluded.collection,description=excluded.description,material=excluded.material,care=excluded.care,fit=excluded.fit,image=excluded.image,status=excluded.status",
          )
          .bind(
            v.id,
            v.name,
            v.brand,
            v.category,
            v.collection,
            v.description,
            v.material,
            v.care,
            v.fit,
            v.image,
            v.status,
            1,
            Date.now(),
          ),
        await audit(who.owner, "product", v.id, v),
      ]);
      return reply({ ok: true });
    }
    if (action === "variant") {
      const v = z
        .object({
          id: z.string().min(2).max(100),
          product_id: z.string().min(2).max(100),
          sku: z.string().min(2).max(100),
          size: z.string().min(1).max(30),
          color: z.string().min(1).max(40),
          price: z.number().int().min(0).max(100000000),
          stock: z.number().int().min(0).max(100000),
        })
        .safeParse(b.variant);
      check(
        v.success,
        "Check variant fields. Price is in paise and stock must be a whole number.",
      );
      const x = v.data!;
      const prev = await db()
        .prepare("SELECT * FROM variants WHERE id=?")
        .bind(x.id)
        .first();
      await db().batch([
        db()
          .prepare(
            "INSERT INTO variants(id,product_id,sku,size,color,price,stock) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,size=excluded.size,color=excluded.color,price=excluded.price,stock=excluded.stock",
          )
          .bind(x.id, x.product_id, x.sku, x.size, x.color, x.price, x.stock),
        await audit(who.owner, "variant_stock_price", x.id, {
          before: prev,
          after: x,
        }),
      ]);
      return reply({ ok: true });
    }
    if (action === "discount") {
      const v = z
        .object({
          code: z.string().regex(/^[A-Z0-9-]{3,30}$/),
          percent: z.number().int().min(1).max(100),
          minimum: z.number().int().min(0).max(100000000),
          expires: z.number().int().positive(),
          usage_limit: z.number().int().positive().max(100000),
          active: z.number().int().min(0).max(1),
        })
        .safeParse(b.discount);
      check(v.success, "Check discount values.");
      const x = v.data!;
      await db().batch([
        db()
          .prepare(
            "INSERT INTO discounts(code,percent,minimum,expires,usage_limit,used,active) VALUES(?,?,?,?,?,0,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,minimum=excluded.minimum,expires=excluded.expires,usage_limit=excluded.usage_limit,active=excluded.active",
          )
          .bind(
            x.code,
            x.percent,
            x.minimum,
            x.expires,
            x.usage_limit,
            x.active,
          ),
        await audit(who.owner, "discount", x.code, x),
      ]);
      return reply({ ok: true });
    }
    if (action === "settings") {
      const v = z
        .object({
          shipping: z.number().int().min(0).max(100000),
          freeShipping: z.number().int().min(0).max(10000000),
          taxBps: z.number().int().min(0).max(5000),
          returnDays: z.number().int().min(1).max(90),
          announcement: z.string().max(200),
          featuredCollection: z.string().max(100),
          contactEmail: z.union([z.string().email(), z.literal("")]),
          phone: z.string().max(30),
          location: z.string().max(250),
          deliveryNote: z.string().max(1000),
          aboutText: z.string().max(12000).optional(),
          shippingPolicy: z.string().max(12000).optional(),
          returnsPolicy: z.string().max(12000).optional(),
          privacyPolicy: z.string().max(12000).optional(),
          termsPolicy: z.string().max(12000).optional(),
        })
        .safeParse(b.settings);
      check(v.success, "Check store settings.");
      await db().batch([
        db()
          .prepare("UPDATE settings SET value=? WHERE key='store'")
          .bind(JSON.stringify(v.data)),
        await audit(who.owner, "settings", "store", v.data),
      ]);
      return reply({ ok: true });
    }
    if (action === "reviewRequest") {
      check(
        ["approved", "rejected"].includes(b.status),
        "Invalid request decision.",
      );
      const r = await db()
        .prepare(
          "SELECT r.*,o.payment,o.fulfillment,o.refund,o.cancellation FROM requests r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND r.status='requested'",
        )
        .bind(String(b.id))
        .first();
      check(r, "Request is no longer pending.", 409);
      const approve = b.status === "approved";
      if (approve && r!.type === "cancellation")
        check(
          r!.fulfillment === "unfulfilled",
          "This order has already shipped.",
        );
      await db().batch([
        db()
          .prepare(
            "UPDATE requests SET status=? WHERE id=? AND status='requested'",
          )
          .bind(b.status, b.id),
        db()
          .prepare(
            r!.type === "cancellation"
              ? "UPDATE orders SET cancellation=?,refund=?,payment=CASE WHEN payment='pending' AND ?='approved' THEN 'canceled' ELSE payment END WHERE id=?"
              : "UPDATE orders SET refund=? WHERE id=?",
          )
          .bind(
            ...(r!.type === "cancellation"
              ? [
                  approve ? "approved" : "none",
                  approve && r!.payment === "paid" ? "refunded" : "none",
                  b.status,
                  r!.order_id,
                ]
              : [approve ? "refunded" : "none", r!.order_id]),
          ),
        await audit(who.owner, "request_" + b.status, String(r!.order_id), {
          request: b.id,
          type: r!.type,
          sandbox: true,
        }),
      ]);
      return reply({ ok: true });
    }
    return reply({ error: "Unknown action" }, 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return reply({ error: "Please check the entered values." }, 400);
    return failure(e);
  }
}
