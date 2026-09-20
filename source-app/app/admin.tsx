"use client";
import { useEffect, useState, FormEvent } from "react";
import {
  ArrowUpRight,
  Package,
  ShoppingBag,
  MessageSquare,
  Settings,
  Tag,
  ClipboardList,
  Plus,
} from "lucide-react";
import { money } from "../lib/commerce.mjs";
type Any = Record<string, any>;
const read = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
};
const blank = {
  id: "",
  name: "",
  brand: "",
  category: "Women",
  collection: "Everyday essentials",
  description: "",
  material: "",
  care: "",
  fit: "Regular",
  image: "/images/kurta.webp",
  status: "draft",
};
export default function Admin({ data, api, run, busy }: Any) {
  const [tab, setTab] = useState(
      data.mode === "shopify" ? "Inquiries" : "Overview",
    ),
    [state, setState] = useState<Any | null>(null),
    [error, setError] = useState(""),
    [edit, setEdit] = useState<Any | null>(null),
    [search, setSearch] = useState("");
  const load = () =>
    api("admin")
      .then(setState)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    if (data.support) load();
  }, [data.support]);
  const act = async (a: string, b: Any) => {
    const r = await run(a, b, "Store changes saved.");
    if (r) {
      await load();
      return true;
    }
    return false;
  };
  if (!data.support)
    return (
      <section className="section narrow">
        <p className="eyebrow">STORE MANAGEMENT</p>
        <h1 className="page-title">A space for your store team.</h1>
        <div className="callout">
          Staff access is protected on the server. Sign in with an explicitly
          allowed staff identity.
        </div>
        <a
          className="button"
          href="/signin-with-chatgpt?return_to=/operations"
          target="_top"
        >
          Staff sign in
        </a>
        <p className="small muted">
          The local preview has one test owner. Production staff access requires
          secure allowlist configuration.
        </p>
      </section>
    );
  if (!state)
    return (
      <section className="section">
        <p role={error ? "alert" : "status"}>
          {error || "Loading store records…"}
        </p>
        <button className="button" onClick={load}>
          Retry
        </button>
      </section>
    );
  const orders = state.orders.filter((o: Any) =>
    (o.id + " " + o.email + " " + o.payment)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const sales = state.orders
    .filter((o: Any) => o.payment === "paid" && o.refund !== "refunded")
    .reduce((s: number, o: Any) => s + o.total, 0);
  const pending = state.orders.filter(
    (o: Any) =>
      o.payment === "paid" &&
      o.fulfillment === "unfulfilled" &&
      o.cancellation === "none",
  ).length;
  return (
    <section className="section admin">
      <div className="section-title">
        <div>
          <p className="eyebrow">AVIKA COLLECTION / STORE MANAGEMENT</p>
          <h1 className="page-title">Your store, at a glance.</h1>
        </div>
        <a href="/">
          View storefront <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="callout small">
        {data.mode === "shopify"
          ? "Local store content and inquiries. Manage live products and orders in Shopify."
          : "Sandbox records only. Money is simulated. Confirmation emails appear in the outbox; no email is sent."}{" "}
        {data.admin ? "Owner access" : "Support staff access"}
      </div>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Management sections">
          {[
            "Overview",
            "Products",
            "Orders",
            "Returns",
            "Discounts",
            "Inquiries",
            "Settings",
            "Audit trail",
            "Email outbox",
          ]
            .filter(
              (t) =>
                data.admin ||
                ["Overview", "Orders", "Returns", "Inquiries"].includes(t),
            )
            .filter(
              (t) =>
                data.mode !== "shopify" ||
                ["Inquiries", "Settings", "Audit trail"].includes(t),
            )
            .map((t, i) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => {
                  setTab(t);
                  setEdit(null);
                }}
              >
                {
                  [
                    <Package key="p" />,
                    <ShoppingBag key="s" />,
                    <ClipboardList key="c" />,
                    <ClipboardList key="r" />,
                    <Tag key="t" />,
                    <MessageSquare key="m" />,
                    <Settings key="e" />,
                    <ClipboardList key="a" />,
                    <MessageSquare key="o" />,
                  ][i]
                }
                {t}
              </button>
            ))}
        </nav>
        <div className="admin-content">
          {tab === "Overview" && (
            <>
              <div className="stat-grid">
                {[
                  ["Sample net sales", money(sales)],
                  ["Sample orders", state.orders.length],
                  ["Awaiting fulfillment", pending],
                  [
                    "Low-stock variants",
                    state.variants.filter((v: Any) => v.stock < 5).length,
                  ],
                ].map(([label, value]) => (
                  <div className="stat" key={label}>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <h2>Recent orders</h2>
              <p className="muted small">
                Calculated from stored records, up to the most recent 200
                orders. Refunded sample orders are excluded from sample net
                sales.
              </p>
              {state.orders.length ? (
                <OrderTable
                  orders={state.orders.slice(0, 5)}
                  onSelect={() => setTab("Orders")}
                />
              ) : (
                <div className="empty">
                  <h3>Your first order will appear here.</h3>
                  <p>Try the sample checkout from the storefront.</p>
                  <a className="button" href="/shop">
                    Explore your store
                  </a>
                </div>
              )}
              <h3>Before you open the doors</h3>
              <ul>
                <li>
                  Replace sample labels, images and prices with the actual
                  catalog.
                </li>
                <li>
                  Confirm business contacts, tax, shipping and return policy.
                </li>
                <li>
                  Connect hosted commerce, payment, email and delivery services.
                </li>
                <li>Complete sandbox checks and approve launch.</li>
              </ul>
            </>
          )}
          {tab === "Products" && (
            <>
              <div className="section-title">
                <h2>Products & variants</h2>
                <button
                  className="button"
                  onClick={() => setEdit({ ...blank })}
                >
                  <Plus size={18} /> Add product
                </button>
              </div>
              <p className="small muted">
                Brand, category and collection fields organise the catalog. All
                products in this environment remain demonstration products.
              </p>
              {edit ? (
                <div className="panel">
                  {error && (
                    <p className="error-text" role="alert">
                      {error}
                    </p>
                  )}
                  <label>
                    Upload product photograph (PNG, JPEG, WebP; maximum 5 MB)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const response = await fetch("/api/upload", {
                            method: "POST",
                            headers: { "Content-Type": file.type },
                            body: file,
                          });
                          const result: any = await response.json();
                          if (!response.ok) throw new Error(result.error);
                          setEdit({ ...edit, image: result.url });
                          setError("");
                        } catch (err) {
                          setError((err as Error).message);
                        }
                      }}
                    />
                  </label>
                  <form
                    key={edit.id}
                    onSubmit={async (e) => {
                      const f = read(e);
                      if (await act("product", { product: f }))
                        setEdit({ ...edit, ...f });
                    }}
                  >
                    <h3>{edit.id || "New product"}</h3>
                    <div className="form-grid">
                      {[
                        "id",
                        "name",
                        "brand",
                        "category",
                        "collection",
                        "material",
                        "care",
                        "fit",
                      ].map((k) => (
                        <label key={k}>
                          {k === "id" ? "Product URL identifier" : k}
                          <input
                            name={k}
                            defaultValue={edit[k]}
                            required
                            readOnly={
                              k === "id" &&
                              state.products.some((p: Any) => p.id === edit.id)
                            }
                          />
                        </label>
                      ))}
                      <label className="wide">
                        Description
                        <textarea
                          name="description"
                          defaultValue={edit.description}
                          required
                        />
                      </label>
                      <label>
                        Product image
                        <select
                          name="image"
                          value={edit.image}
                          onChange={(e) =>
                            setEdit({ ...edit, image: e.target.value })
                          }
                        >
                          {edit.image.startsWith("/media/") && (
                            <option value={edit.image}>
                              Uploaded product image
                            </option>
                          )}
                          {["shirt", "kurta", "overshirt", "bag"].map((x) => (
                            <option value={"/images/" + x + ".webp"} key={x}>
                              {x} — illustrative
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={edit.status}>
                          {["draft", "published", "archived"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="button-row">
                      <button className="button" disabled={busy}>
                        Save product
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => setEdit(null)}
                      >
                        Back to products
                      </button>
                    </div>
                  </form>
                  {state.products.some((p: Any) => p.id === edit.id) && (
                    <>
                      <h3 className="mt">
                        Sizes, colours, pricing & inventory
                      </h3>
                      {state.variants
                        .filter((v: Any) => v.product_id === edit.id)
                        .map((v: Any) => (
                          <Variant
                            key={v.id + "-" + v.stock + "-" + v.price}
                            value={v}
                            act={act}
                            busy={busy}
                          />
                        ))}
                      <details>
                        <summary>Add a variant</summary>
                        <Variant
                          value={{
                            id: edit.id + "-new",
                            product_id: edit.id,
                            sku: "DEMO-" + edit.id + "-NEW",
                            size: "M",
                            color: "Ivory",
                            price: 100000,
                            stock: 0,
                          }}
                          act={act}
                          busy={busy}
                        />
                      </details>
                    </>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Piece</th>
                        <th>Brand</th>
                        <th>Status</th>
                        <th>Variants</th>
                        <th>Manage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.products.map((p: Any) => (
                        <tr key={p.id}>
                          <td>
                            <img className="table-img" src={p.image} alt="" />
                            {p.name}
                          </td>
                          <td>{p.brand}</td>
                          <td>
                            <span className="badge">{p.status}</span>
                          </td>
                          <td>
                            {
                              state.variants.filter(
                                (v: Any) => v.product_id === p.id,
                              ).length
                            }
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => setEdit(p)}
                            >
                              Edit product
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="small muted">
                Upload only photographs you own or have permission to use.
                Uploaded images are stored separately from product records;
                select Save product to attach the image.
              </p>
            </>
          )}
          {tab === "Orders" && (
            <>
              <h2>Orders & fulfillment</h2>
              <label>
                Search orders
                <input
                  placeholder="Order ID, email or payment status"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <OrderTable orders={orders} onSelect={setEdit} />
              {edit && (
                <div className="panel">
                  <h3>{edit.id}</h3>
                  <p>{edit.email}</p>
                  <p>
                    {Object.values(JSON.parse(edit.address))
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {JSON.parse(edit.items).map((i: Any) => (
                    <p key={i.variantId}>
                      {i.quantity} × {i.name} · {i.brand} · {i.size} / {i.color}{" "}
                      — {money(i.price * i.quantity)}
                    </p>
                  ))}
                  <p>
                    Total {money(edit.total)} · Payment {edit.payment} · Refund{" "}
                    {edit.refund} · Cancellation {edit.cancellation}
                  </p>
                  <form
                    onSubmit={async (e) => {
                      const f = read(e);
                      if (await act("fulfill", { id: edit.id, ...f }))
                        setEdit({
                          ...edit,
                          fulfillment: f.status,
                          tracking: f.tracking,
                        });
                    }}
                  >
                    <label>
                      Fulfillment status
                      <select name="status" defaultValue={edit.fulfillment}>
                        <option>unfulfilled</option>
                        <option>shipped</option>
                        <option>delivered</option>
                      </select>
                    </label>
                    <label>
                      Tracking URL (optional)
                      <input
                        name="tracking"
                        type="url"
                        defaultValue={edit.tracking}
                        placeholder="https://courier.example/track/…"
                      />
                    </label>
                    <button
                      className="button"
                      disabled={busy || edit.payment !== "paid"}
                    >
                      Update sample fulfillment
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
          {tab === "Returns" && (
            <>
              <h2>Cancellations & returns</h2>
              {state.requests.length ? (
                state.requests.map((r: Any) => (
                  <article className="panel" key={r.id}>
                    <p className="eyebrow">
                      {r.type} · {r.status}
                    </p>
                    <h3>{r.order_id}</h3>
                    <p>{r.reason}</p>
                    {r.status === "requested" && data.admin && (
                      <div className="button-row">
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() =>
                            act("reviewRequest", {
                              id: r.id,
                              status: "approved",
                            })
                          }
                        >
                          Approve & simulate refund
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            act("reviewRequest", {
                              id: r.id,
                              status: "rejected",
                            })
                          }
                        >
                          Reject request
                        </button>
                      </div>
                    )}
                    <p className="small muted">
                      Approval restores sample stock. Any refund is simulated
                      and logged; no money moves.
                    </p>
                  </article>
                ))
              ) : (
                <p>No requests yet.</p>
              )}
            </>
          )}
          {tab === "Discounts" && (
            <>
              <h2>Discount codes</h2>
              {state.discounts.map((d: Any) => (
                <div className="order-history" key={d.code}>
                  <span>
                    <b>{d.code}</b> · {d.percent}%
                    <small>
                      Minimum {money(d.minimum)} · Used {d.used}/{d.usage_limit}{" "}
                      · Expires{" "}
                      {new Date(d.expires).toLocaleDateString("en-IN")} ·{" "}
                      {d.active ? "active" : "inactive"}
                    </small>
                  </span>
                  <button className="text-button" onClick={() => setEdit(d)}>
                    Edit
                  </button>
                </div>
              ))}
              <button
                className="button secondary mt"
                onClick={() =>
                  setEdit({
                    code: "",
                    percent: 10,
                    minimum: 0,
                    expires: Date.now() + 30 * 86400000,
                    usage_limit: 100,
                    active: 1,
                  })
                }
              >
                Add discount
              </button>
              {edit && (
                <form
                  className="panel"
                  key={edit.code}
                  onSubmit={(e) => {
                    const f = read(e);
                    act("discount", {
                      discount: {
                        ...f,
                        code: String(f.code).toUpperCase(),
                        percent: Number(f.percent),
                        minimum: Math.round(Number(f.minimum) * 100),
                        expires: new Date(String(f.expires)).getTime(),
                        usage_limit: Number(f.usage_limit),
                        active: Number(f.active),
                      },
                    });
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Code
                      <input name="code" defaultValue={edit.code} required />
                    </label>
                    <label>
                      Percent off
                      <input
                        name="percent"
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={edit.percent}
                        required
                      />
                    </label>
                    <label>
                      Minimum spend (₹)
                      <input
                        name="minimum"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={edit.minimum / 100}
                        required
                      />
                    </label>
                    <label>
                      Expires
                      <input
                        name="expires"
                        type="datetime-local"
                        defaultValue={new Date(
                          edit.expires - new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)}
                        required
                      />
                    </label>
                    <label>
                      Usage limit
                      <input
                        name="usage_limit"
                        type="number"
                        min="1"
                        defaultValue={edit.usage_limit}
                        required
                      />
                    </label>
                    <label>
                      Status
                      <select name="active" defaultValue={edit.active}>
                        <option value="1">Active</option>
                        <option value="0">Inactive</option>
                      </select>
                    </label>
                  </div>
                  <button className="button" disabled={busy}>
                    Save discount
                  </button>
                </form>
              )}
            </>
          )}
          {tab === "Inquiries" && (
            <>
              <h2>Customer inquiries</h2>
              {state.inquiries.map((i: Any) => (
                <article className="panel" key={i.id}>
                  <p className="eyebrow">
                    {i.status} · {new Date(i.created).toLocaleString("en-IN")}
                  </p>
                  <h3>{i.name}</h3>
                  <p>{i.email}</p>
                  <p className="preserve">{i.message}</p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      act("inquiryStatus", {
                        id: i.id,
                        status: i.status === "new" ? "resolved" : "new",
                      })
                    }
                  >
                    Mark {i.status === "new" ? "resolved" : "new"}
                  </button>
                </article>
              ))}
              {!state.inquiries.length && <p>Your inbox is clear.</p>}
            </>
          )}
          {tab === "Settings" && (
            <form
              className="panel"
              onSubmit={(e) => {
                const f = read(e);
                act("settings", {
                  settings: {
                    ...f,
                    shipping: Math.round(Number(f.shipping) * 100),
                    freeShipping: Math.round(Number(f.freeShipping) * 100),
                    taxBps: Math.round(Number(f.taxBps) * 100),
                    returnDays: Number(f.returnDays),
                  },
                });
              }}
            >
              <h2>Store settings</h2>
              <details>
                <summary>About and policy content</summary>
                <p>
                  Replace drafts only with owner-approved business practices.
                  Policy text is rendered as plain text.
                </p>
                {[
                  ["aboutText", "About the store"],
                  ["shippingPolicy", "Shipping policy"],
                  ["returnsPolicy", "Returns and refunds"],
                  ["privacyPolicy", "Privacy policy"],
                  ["termsPolicy", "Terms and conditions"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <textarea
                      name={key}
                      maxLength={12000}
                      defaultValue={state.settings[key] ?? ""}
                    />
                  </label>
                ))}
              </details>
              <p className="small muted">
                India-only sample shipping zone. Replace these defaults with
                approved business policies before launch.
              </p>
              <div className="form-grid">
                {[
                  "announcement",
                  "featuredCollection",
                  "location",
                  "contactEmail",
                  "phone",
                  "deliveryNote",
                ].map((k) => (
                  <label className="wide" key={k}>
                    {
                      (
                        {
                          announcement: "Homepage announcement",
                          featuredCollection: "Featured collection",
                          location: "Store location",
                          contactEmail: "Contact email",
                          phone: "Phone",
                          deliveryNote: "Delivery information",
                        } as Any
                      )[k]
                    }
                    <input
                      name={k}
                      defaultValue={state.settings[k]}
                      type={k === "contactEmail" ? "email" : "text"}
                    />
                  </label>
                ))}
                {[
                  ["shipping", "Sample shipping charge (₹)", 100],
                  ["freeShipping", "Free shipping threshold (₹)", 100],
                  ["taxBps", "Sample tax rate (%)", 100],
                  [
                    "returnDays",
                    "Return window from order placement (days)",
                    1,
                  ],
                ].map(([key, label, div]: any) => (
                  <label key={key}>
                    {label}
                    <input
                      name={key}
                      type="number"
                      step={div === 100 ? "0.01" : "1"}
                      min="0"
                      defaultValue={state.settings[key] / div}
                      required
                    />
                  </label>
                ))}
              </div>
              <button className="button" disabled={busy}>
                Save store settings
              </button>
            </form>
          )}
          {tab === "Audit trail" && (
            <>
              <h2>Audit trail</h2>
              <p className="small muted">
                Sensitive changes record the actor, time, target and changed
                values.
              </p>
              {state.audit.map((a: Any) => (
                <details key={a.id}>
                  <summary>
                    {new Date(a.created).toLocaleString("en-IN")} · {a.action} ·{" "}
                    {a.target}
                  </summary>
                  <p>Actor: {a.actor}</p>
                  <pre>{JSON.stringify(JSON.parse(a.detail), null, 2)}</pre>
                </details>
              ))}
              {!state.audit.length && <p>No staff changes recorded yet.</p>}
            </>
          )}
          {tab === "Email outbox" && (
            <>
              <h2>Sample confirmation messages</h2>
              <div className="callout">
                These messages are stored for review. They have not been
                emailed. Delivery is an external integration required for
                launch.
              </div>
              {state.outbox.map((m: Any) => (
                <details key={m.id}>
                  <summary>
                    {m.subject} · {m.recipient}
                  </summary>
                  <p className="preserve">{m.body}</p>
                  <p>Status: {m.status}</p>
                </details>
              ))}
              {!state.outbox.length && (
                <p>No sample payment confirmations yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
function OrderTable({ orders, onSelect }: Any) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Payment</th>
            <th>Fulfillment</th>
            <th>Total</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o: Any) => (
            <tr key={o.id}>
              <td>
                <span className="order-id">{o.id}</span>
                <small>{o.email}</small>
              </td>
              <td>
                <span className="badge">{o.payment}</span>
              </td>
              <td>{o.fulfillment}</td>
              <td>{money(o.total)}</td>
              <td>
                <button className="text-button" onClick={() => onSelect(o)}>
                  View order
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <p>No matching orders.</p>}
    </div>
  );
}
function Variant({ value: v, act, busy }: Any) {
  return (
    <form
      className="variant-form"
      onSubmit={(e) => {
        const f = read(e);
        act("variant", {
          variant: {
            ...f,
            product_id: v.product_id,
            price: Math.round(Number(f.price) * 100),
            stock: Number(f.stock),
          },
        });
      }}
    >
      {["id", "sku", "size", "color", "price", "stock"].map((k) => (
        <label key={k}>
          {k === "price" ? "Price (₹)" : k}
          <input
            name={k}
            defaultValue={k === "price" ? v[k] / 100 : v[k]}
            type={k === "price" || k === "stock" ? "number" : "text"}
            step={k === "price" ? "0.01" : "1"}
            min="0"
            required
          />
        </label>
      ))}
      <button className="button secondary" disabled={busy}>
        Save variant
      </button>
    </form>
  );
}
