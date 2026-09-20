"use client";
import { useEffect, useState, useRef, FormEvent } from "react";
import {
  Search,
  Heart,
  ShoppingBag,
  User,
  ArrowRight,
  ArrowUpRight,
  X,
  Check,
  Minus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import Admin from "./admin";
import { money } from "../lib/commerce.mjs";
type Any = Record<string, any>;
export async function api(action: string, data?: Any): Promise<any> {
  const r = await fetch(
    "/api/store" + (data ? "" : "?action=" + action),
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...data }),
        }
      : { cache: "no-store" },
  );
  const result: any = await r.json();
  if (!r.ok)
    throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result;
}
const form = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget));
};
export default function Store({ initialPath = "/" }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath),
    [params, setParams] = useState(new URLSearchParams()),
    [data, setData] = useState<Any | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    const d = await api("bootstrap");
    setData(d);
    return d;
  };
  useEffect(() => {
    setPath(location.pathname);
    setParams(new URLSearchParams(location.search));
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const titles: Any = {
      "/": "Multi-brand fashion, New Delhi",
      "/shop": "The collection",
      "/cart": "Your shopping bag",
      "/checkout": "Sample checkout",
      "/admin": "Store management",
      "/account": "Your account",
    };
    document.title =
      "Avika Collection | " +
      (titles[path] ??
        path.split("/").filter(Boolean).join(" · ").replaceAll("-", " "));
  }, [path]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "search_avika_catalog",
          description:
            "Navigate to the Avika Collection catalog with a search query. Does not buy or add items.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", maxLength: 100 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: Any) => {
            if (typeof input.query !== "string" || input.query.length > 100)
              throw new Error("Invalid query");
            location.assign("/shop?q=" + encodeURIComponent(input.query));
            return { navigating: true };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  async function run(action: string, body: Any, success?: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const value = await api(action, body);
      await refresh();
      if (success) setNotice(success);
      return value;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const wish = async (p: Any) =>
    run(
      "wishlist",
      { productId: p.id, saved: !data?.wishlist.includes(p.id) },
      data?.wishlist.includes(p.id)
        ? "Removed from saved pieces."
        : "Saved to your wishlist.",
    );
  const card = (p: Any) => (
    <article className="product-card" key={p.id}>
      <div className="product-photo">
        <a href={"/product/" + p.id}>
          <img
            loading="lazy"
            width="700"
            height="700"
            src={p.image}
            alt={(p.demo ? "Illustrative " : "") + p.name}
          />
        </a>
        <button
          className="heart"
          aria-label={
            (data?.wishlist.includes(p.id) ? "Remove " : "Save ") + p.name
          }
          aria-pressed={data?.wishlist.includes(p.id) ?? false}
          disabled={busy}
          onClick={() => wish(p)}
        >
          <Heart
            size={18}
            fill={data?.wishlist.includes(p.id) ? "currentColor" : "none"}
          />
        </button>
        {!!p.demo && <span className="sample-tag">SAMPLE</span>}
      </div>
      <div className="product-meta">
        <p>{p.brand}</p>
        <a href={"/product/" + p.id}>
          <h3>{p.name}</h3>
        </a>
        <div>
          <b>
            {p.variants.length
              ? money(Math.min(...p.variants.map((v: Any) => v.price)))
              : "Price pending"}
          </b>
          <span>
            {p.variants.some((v: Any) => v.stock > 0)
              ? p.variants[0]?.color
              : "Unavailable"}
          </span>
        </div>
      </div>
    </article>
  );
  function catalog() {
    let products = data?.products ?? [];
    const value = (n: string) => params.get(n) ?? "";
    const change = (name: string, v: string) => {
      const next = new URLSearchParams(params);
      v ? next.set(name, v) : next.delete(name);
      next.delete("page");
      history.replaceState(null, "", "/shop?" + next.toString());
      setParams(next);
    };
    const brands = [...new Set(products.map((p: Any) => p.brand))] as string[];
    const categories = [
      ...new Set(products.map((p: Any) => p.category)),
    ] as string[];
    const collection = path.startsWith("/brand/")
      ? decodeURIComponent(path.slice(7))
      : value("brand");
    products = products
      .filter(
        (p: Any) =>
          !value("q") ||
          [
            p.name,
            p.brand,
            p.category,
            p.material,
            p.description,
            ...p.variants.map((v: Any) => v.color + " " + v.size),
          ]
            .join(" ")
            .toLowerCase()
            .includes(value("q").toLowerCase()),
      )
      .filter(
        (p: Any) =>
          (!value("category") || p.category === value("category")) &&
          (!collection || p.brand === collection) &&
          (!value("collection") || p.collection === value("collection")) &&
          p.variants.some(
            (v: Any) =>
              (!value("size") || v.size === value("size")) &&
              (!value("color") || v.color === value("color")) &&
              (!value("max") || v.price <= Number(value("max")) * 100) &&
              (!value("available") || v.stock > 0),
          ),
      );
    if (value("sort"))
      products.sort(
        (a: Any, b: Any) =>
          (Math.min(...a.variants.map((v: Any) => v.price)) -
            Math.min(...b.variants.map((v: Any) => v.price))) *
          (value("sort") === "price-desc" ? -1 : 1),
      );
    const page = Math.max(1, Number(value("page")) || 1);
    return (
      <section className="section">
        <p className="eyebrow">EXPLORE AVIKA COLLECTION</p>
        <h1 className="page-title">
          {value("category") || collection || "The collection"}
        </h1>
        <p className="muted">
          Pieces for your everyday. Brands with their own point of view.
        </p>
        <form className="search-box" onSubmit={(e) => e.preventDefault()}>
          <Search size={20} />
          <input
            aria-label="Search the collection"
            placeholder="Search pieces, brands, colours…"
            value={value("q")}
            onChange={(e) => change("q", e.target.value)}
          />
          {value("q") && (
            <button
              aria-label="Clear search"
              onClick={() => change("q", "")}
              type="button"
            >
              <X size={18} />
            </button>
          )}
        </form>
        <div className="shop-layout">
          <aside className="filters">
            <h3>
              <SlidersHorizontal size={18} /> Refine your edit
            </h3>
            {[
              ["category", "Category", categories],
              ["brand", "Brand", brands],
              ["size", "Size", ["S", "M", "L", "XL", "One size"]],
              ["color", "Colour", ["Ivory", "Rust", "Indigo", "Tan"]],
            ].map(([name, label, options]: any) => (
              <label key={name}>
                {label}
                <select
                  value={value(name)}
                  onChange={(e) => change(name, e.target.value)}
                >
                  <option value="">
                    All{" "}
                    {label === "Category"
                      ? "categories"
                      : label.toLowerCase() + "s"}
                  </option>
                  {options.map((x: string) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Maximum price (₹)
              <input
                type="number"
                min="0"
                value={value("max")}
                placeholder="Any price"
                onChange={(e) => change("max", e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={!!value("available")}
                onChange={(e) =>
                  change("available", e.target.checked ? "1" : "")
                }
              />{" "}
              In stock only
            </label>
            <a className="text-link" href="/shop">
              Clear filters
            </a>
          </aside>
          <div>
            <div className="results-bar">
              <span aria-live="polite">
                {products.length} {products.length === 1 ? "piece" : "pieces"}
              </span>
              <label>
                Sort by{" "}
                <select
                  value={value("sort")}
                  onChange={(e) => change("sort", e.target.value)}
                >
                  <option value="">Newest first</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </label>
            </div>
            <div className="product-grid shop-grid">
              {products.slice((page - 1) * 8, page * 8).map(card)}
            </div>
            {!products.length && (
              <Empty
                title="Nothing in this edit yet"
                text="Try another search or loosen your filters."
                href="/shop"
                action="See all pieces"
              />
            )}
            {products.length > 8 && (
              <div className="pagination">
                {Array.from(
                  { length: Math.ceil(products.length / 8) },
                  (_, i) => (
                    <button
                      className="button secondary"
                      key={i}
                      aria-current={page === i + 1 ? "page" : undefined}
                      onClick={() => {
                        const n = new URLSearchParams(params);
                        n.set("page", String(i + 1));
                        history.replaceState(null, "", "/shop?" + n);
                        setParams(n);
                      }}
                    >
                      {i + 1}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        {data?.settings.announcement ??
          "A wardrobe of possibilities. A collection of brands."}
      </div>
      <header className="header">
        <a className="logo" href="/">
          AVIKA<span>COLLECTION</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/shop?category=Women">Women</a>
          <a href="/shop?category=Men">Men</a>
          <a href="/shop?category=Accessories">Accessories</a>
          <a href="/shop">The collection</a>
          <a href="/about">Our story</a>
        </nav>
        <div className="header-actions">
          <a aria-label="Search" href="/shop">
            <Search />
          </a>
          <a aria-label="My account" href="/account">
            <User />
          </a>
          <a aria-label="Wishlist" href="/wishlist">
            <Heart />
          </a>
          <a
            aria-label={
              "Shopping bag, " +
              (data?.cart.reduce((n: number, x: Any) => n + x.quantity, 0) ??
                0) +
              " items"
            }
            href="/cart"
          >
            <ShoppingBag />
            {data?.cart.length > 0 && (
              <span className="bag-count">
                {data?.cart.reduce((n: number, x: Any) => n + x.quantity, 0)}
              </span>
            )}
          </a>
        </div>
      </header>
      <main id="main">
        <div className="demo-note">
          {data?.mode === "shopify" ? "AVIKA COLLECTION" : "PREVIEW COLLECTION"}{" "}
          <span>
            {data?.mode === "shopify"
              ? data.checkoutEnabled
                ? "Multi-brand clothing & accessories · India"
                : "Connected catalog preview · Live checkout disabled"
              : "Illustrative products & prices. Sample orders only. No real payments."}
          </span>
        </div>
        {error && (
          <div className="feedback error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {notice && (
          <div className="feedback success" role="status">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {path === "/" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <p className="eyebrow">THE EVERYDAY, REIMAGINED</p>
                <h1>
                  Many brands.
                  <br />
                  One beautiful
                  <br />
                  <em>collection.</em>
                </h1>
                <p>
                  Find pieces that feel like you. Discover clothing and
                  accessories, thoughtfully brought together at Avika
                  Collection.
                </p>
                <a className="button" href="/shop">
                  Explore the collection <ArrowRight size={18} />
                </a>
                <div className="hero-foot">
                  YOUR NEIGHBOURHOOD FASHION DESTINATION
                  <br />
                  <b>Lajpat Nagar, New Delhi</b>
                </div>
              </div>
              <div className="hero-image">
                <img
                  src="/images/editorial.webp"
                  alt="Illustrative fashion editorial: rust kurta and relaxed teal shirt"
                  width="1400"
                  height="933"
                  fetchPriority="high"
                />
                <span className="image-caption">
                  A fresh perspective on everyday dressing · Illustrative
                  imagery
                </span>
              </div>
            </section>
            <section className="section">
              <div className="section-title">
                <div>
                  <p className="eyebrow">FIND YOUR NEXT FAVOURITE</p>
                  <h2>Good style. Your way.</h2>
                </div>
                <a href="/shop">
                  View the collection <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="category-grid">
                {["Women", "Men", "Accessories"].map((x, i) => (
                  <a
                    className={"category cat-" + i}
                    key={x}
                    href={"/shop?category=" + x}
                  >
                    <span>0{i + 1}</span>
                    <h3>{x}</h3>
                    <ArrowUpRight />
                  </a>
                ))}
              </div>
            </section>
            <section className="section arrivals">
              <div className="section-title">
                <div>
                  <p className="eyebrow">A LITTLE WARDROBE INSPIRATION</p>
                  <h2>Meet your everyday favourites.</h2>
                </div>
                <a href="/shop">
                  Shop all <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="product-grid">
                {data?.products.slice(0, 4).map(card)}
              </div>
              {!data && <p role="status">Loading the collection…</p>}
            </section>
            <section className="edit-banner">
              <div>
                <p className="eyebrow">THE AVIKA EDIT</p>
                <h2>
                  {data?.settings.featuredCollection || "Everyday essentials"}
                </h2>
                <p>
                  Easy silhouettes. Considered details. Pieces to make your own.
                </p>
                <a
                  className="button light"
                  href={
                    "/shop?collection=" +
                    encodeURIComponent(
                      data?.settings.featuredCollection ??
                        "Everyday essentials",
                    )
                  }
                >
                  Discover the edit <ArrowRight size={18} />
                </a>
              </div>
              <img
                loading="lazy"
                src="/images/shirt.webp"
                width="700"
                height="700"
                alt="Illustrative ivory shirt from the everyday edit"
              />
            </section>
            <section className="section brand-section">
              <p className="eyebrow">
                DIFFERENT LABELS. ONE PLACE TO DISCOVER THEM.
              </p>
              <h2>Get to know the brands.</h2>
              <div className="brand-row">
                {[
                  ...new Set((data?.products ?? []).map((p: Any) => p.brand)),
                ].map((b: any) => (
                  <a key={b} href={"/brand/" + encodeURIComponent(b)}>
                    {b}
                  </a>
                ))}
              </div>
              {data?.mode !== "shopify" && (
                <p className="muted small">
                  Fictional sample labels for this preview. Actual manufacturer
                  brands will appear with the real catalog.
                </p>
              )}
            </section>
          </>
        ) : !data ? (
          <section className="section">
            <h1 className="page-title">
              {error
                ? "Store temporarily unavailable"
                : "Opening your collection…"}
            </h1>
            <button
              className="button"
              onClick={() =>
                refresh()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              Reload store
            </button>
          </section>
        ) : path === "/shop" || path.startsWith("/brand/") ? (
          catalog()
        ) : path.startsWith("/product/") ? (
          <Product
            product={data.products.find((p: Any) => p.id === path.slice(9))}
            data={data}
            run={run}
            busy={busy}
            wish={wish}
            card={card}
          />
        ) : path === "/wishlist" ? (
          <section className="section">
            <p className="eyebrow">KEEP THE GOOD FINDS CLOSE</p>
            <h1 className="page-title">Your saved pieces</h1>
            <div className="product-grid">
              {data.products
                .filter((p: Any) => data.wishlist.includes(p.id))
                .map(card)}
            </div>
            {!data.wishlist.length && (
              <Empty
                title="A little inspiration for later"
                text="Tap the heart on any piece to save it here."
                href="/shop"
                action="Explore the collection"
              />
            )}
          </section>
        ) : path === "/cart" ? (
          <Cart data={data} run={run} busy={busy} />
        ) : data.mode === "shopify" &&
          ["/checkout", "/account", "/admin"].includes(path) ? (
          <Connected path={path} data={data} run={run} busy={busy} />
        ) : path === "/checkout" ? (
          <Checkout data={data} run={run} busy={busy} />
        ) : path.startsWith("/order/") ? (
          <Order id={path.slice(7)} run={run} busy={busy} />
        ) : path === "/account" ? (
          <Account data={data} run={run} busy={busy} />
        ) : path === "/admin" || path === "/operations" ? (
          <Admin data={data} api={api} run={run} busy={busy} />
        ) : (
          <Info
            path={path}
            settings={data.settings}
            run={run}
            busy={busy}
            mode={data.mode}
          />
        )}
      </main>
      <footer>
        <a className="logo" href="/">
          AVIKA<span>COLLECTION</span>
        </a>
        <p>
          Many brands. Thoughtfully brought together.
          <br />
          Lajpat Nagar, New Delhi, India
        </p>
        <div>
          <a href="/about">Our story</a>
          <a href="/contact">Contact</a>
          <a href="/faq">FAQs</a>
          <a href="/shipping">Delivery</a>
          <a href="/returns">Returns</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/admin">Store management</a>
        </div>
        <small>
          © {new Date().getFullYear()} Avika Collection · Multi-brand clothing
          retailer {data?.mode !== "shopify" ? "· Demo store" : ""}
        </small>
      </footer>
    </>
  );
}
function Empty({ title, text, href, action }: Any) {
  return (
    <div className="empty">
      <ShoppingBag size={34} />
      <h2>{title}</h2>
      <p>{text}</p>
      <a className="button" href={href}>
        {action}
      </a>
    </div>
  );
}
function Connected({ path, data, run, busy }: Any) {
  const checkout = path === "/checkout";
  const account = path === "/account";
  return (
    <section className="section narrow">
      <p className="eyebrow">AVIKA COLLECTION</p>
      <h1 className="page-title">
        {checkout
          ? "Secure checkout"
          : account
            ? "Your customer account"
            : "Manage your store"}
      </h1>
      <p>
        {checkout
          ? "Complete your address, choose delivery and pay through the connected store’s hosted checkout."
          : "Continue to the connected commerce service to " +
            (account
              ? "sign in, manage addresses, view orders and request eligible returns."
              : "manage real products, stock, payments, orders, returns, shipping and staff access.")}
      </p>
      {checkout ? (
        <>
          <button
            className="button"
            disabled={busy || !data.checkoutEnabled}
            onClick={async () => {
              const result = await run("hostedCheckout", {});
              if (result) location.assign(result.url);
            }}
          >
            Continue to secure checkout <ArrowRight size={18} />
          </button>
          {!data.checkoutEnabled && (
            <div className="callout">
              Live checkout is disabled until the owner approves launch and the
              payment setup is verified.
            </div>
          )}
        </>
      ) : data.accountUrl || !account ? (
        <a
          className="button"
          href={account ? data.accountUrl : data.adminUrl}
          target="_top"
        >
          {account ? "Open customer account" : "Open Shopify administration"}{" "}
          <ArrowUpRight size={18} />
        </a>
      ) : (
        <p role="status">Customer accounts need configuration before launch.</p>
      )}
      {!checkout && !account && (
        <p>
          <a className="text-link" href="/operations">
            Store content & customer inquiries
          </a>
        </p>
      )}
      <p className="small muted">
        {checkout
          ? "Order confirmation and payment status are handled by the commerce provider. Returning to this site never marks a payment successful."
          : "Live records are managed by the connected commerce provider. Local demonstration records stay separate."}
      </p>
    </section>
  );
}
function Product({ product: p, data, run, busy, wish, card }: Any) {
  const [selected, setSelected] = useState(""),
    [count, setCount] = useState(1),
    [zoom, setZoom] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (zoom) dialogRef.current?.showModal();
  }, [zoom]);
  if (!p)
    return (
      <Empty
        title="That piece isn’t here"
        text="It may have been archived or is not yet available."
        href="/shop"
        action="Back to the collection"
      />
    );
  const v = p.variants.find((x: Any) => x.id === selected);
  return (
    <>
      <section className="section">
        <div className="breadcrumbs">
          <a href="/shop">The collection</a> / {p.category} / {p.name}
        </div>
        <div className="detail-grid">
          <div>
            <button
              className="zoom-trigger"
              aria-label="Enlarge product image"
              onClick={() => setZoom(true)}
            >
              <img
                src={p.image}
                alt={(p.demo ? "Illustrative " : "") + p.name}
                width="700"
                height="700"
              />
              <span>
                View larger{p.demo ? " · Illustrative product image" : ""}
              </span>
            </button>
          </div>
          <div className="detail-copy">
            <a
              className="eyebrow"
              href={"/brand/" + encodeURIComponent(p.brand)}
            >
              {p.brand}
            </a>
            <h1 className="page-title">{p.name}</h1>
            <p className="price">
              {money(v?.price ?? p.variants[0]?.price ?? 0)}
            </p>
            <p>{p.description}</p>
            <p className="muted small">
              Sold by Avika Collection
              {p.demo ? " · Fictional demonstration product" : ""}
            </p>
            <fieldset>
              <legend>Choose your size & colour</legend>
              <div className="variant-options">
                {p.variants.map((x: Any) => (
                  <button
                    key={x.id}
                    className={selected === x.id ? "selected" : ""}
                    aria-pressed={selected === x.id}
                    disabled={!x.stock}
                    onClick={() => setSelected(x.id)}
                  >
                    {x.size} · {x.color}
                    {!x.stock ? " — unavailable" : ""}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="small muted">
              {v
                ? "SKU " + v.sku + " · Available"
                : "Select an available option to add this piece."}
            </p>
            <div className="buy-row">
              <label>
                Quantity
                <input
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  max={Math.min(v?.stock ?? 1, 20)}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <button
                className="button"
                disabled={busy || !v || count < 1}
                onClick={() =>
                  run(
                    "cart",
                    {
                      variantId: v.id,
                      quantity:
                        count +
                        (data.cart.find((x: Any) => x.id === v.id)?.quantity ??
                          0),
                    },
                    "Added to your bag.",
                  )
                }
              >
                <ShoppingBag size={18} /> Add to bag
              </button>
              <button
                className="icon-button"
                aria-label="Save product"
                disabled={busy}
                onClick={() => wish(p)}
              >
                <Heart
                  fill={data.wishlist.includes(p.id) ? "currentColor" : "none"}
                />
              </button>
            </div>
            <details open>
              <summary>Details & care</summary>
              <p>
                Material: {p.material}
                <br />
                Fit: {p.fit}
                <br />
                Care: {p.care}
              </p>
            </details>
            <details>
              <summary>Size guide</summary>
              <p>
                {p.demo
                  ? "Sample garment measurements only; replace with the manufacturer’s guide before launch."
                  : "Check the manufacturer’s measurements in the product description. Contact us if your size guide is missing."}
              </p>
              {!!p.demo && (
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Chest (cm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["S", "92–97"],
                      ["M", "98–103"],
                      ["L", "104–109"],
                      ["XL", "110–115"],
                    ].map((x) => (
                      <tr key={x[0]}>
                        <td>{x[0]}</td>
                        <td>{x[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </details>
            <details>
              <summary>Delivery & returns</summary>
              <p>{data.settings.deliveryNote}</p>
              {!!p.demo && (
                <p>
                  Sample return window: {data.settings.returnDays} days from
                  order placement. This is a demo rule, pending owner review.
                </p>
              )}
              <a href="/returns">Read the draft returns policy</a>
            </details>
          </div>
        </div>
      </section>
      <section className="section">
        <h2>A few more good finds.</h2>
        <div className="product-grid">
          {data.products
            .filter((x: Any) => x.id !== p.id)
            .slice(0, 4)
            .map(card)}
        </div>
      </section>
      {zoom && (
        <dialog
          ref={dialogRef}
          onCancel={() => setZoom(false)}
          className="zoom"
          aria-label="Enlarged product image"
          onKeyDown={(e) => {
            if (e.key === "Escape") setZoom(false);
          }}
        >
          <button
            autoFocus
            className="icon-button"
            onClick={() => setZoom(false)}
            aria-label="Close image"
          >
            <X />
          </button>
          <img src={p.image} alt={(p.demo ? "Illustrative " : "") + p.name} />
        </dialog>
      )}
    </>
  );
}
function Summary({ quote }: Any) {
  return (
    <dl className="summary">
      {[
        ["Subtotal", quote.subtotal],
        ["Discount", -quote.discount],
        [quote.estimated ? "Delivery" : "Sample delivery", quote.shipping],
        [quote.estimated ? "Tax" : "Sample tax", quote.tax],
        [quote.estimated ? "Estimated total" : "Total", quote.total],
      ].map(([label, v]: any) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{v === null ? "At checkout" : money(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
function Cart({ data, run, busy }: Any) {
  const [code, setCode] = useState(""),
    [quote, setQuote] = useState<Any | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setQuote(null);
    if (data.cart.length)
      api("quote", { code })
        .then((q) => {
          if (!active) return;
          setQuote(q);
          setError("");
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [data.cart, code]);
  return (
    <section className="section">
      <p className="eyebrow">THE START OF SOMETHING GOOD</p>
      <h1 className="page-title">Your shopping bag</h1>
      {!data.cart.length ? (
        <Empty
          title="Your bag is waiting"
          text="Explore the collection and find a piece you love."
          href="/shop"
          action="Find your favourites"
        />
      ) : (
        <div className="checkout-grid">
          <div>
            {data.cart.map((x: Any) => (
              <article className="cart-line" key={x.id}>
                <img
                  src={x.image}
                  alt={(x.demo ? "Illustrative " : "") + x.name}
                  width="130"
                  height="150"
                />
                <div>
                  <p className="eyebrow">{x.brand}</p>
                  <a href={"/product/" + x.product_id}>
                    <h3>{x.name}</h3>
                  </a>
                  <p>
                    {x.size} / {x.color}
                  </p>
                  <div className="quantity">
                    <button
                      aria-label={"Decrease " + x.name}
                      disabled={busy}
                      onClick={() =>
                        run("cart", {
                          variantId: x.id,
                          quantity: x.quantity - 1,
                        })
                      }
                    >
                      <Minus size={16} />
                    </button>
                    <span>{x.quantity}</span>
                    <button
                      aria-label={"Increase " + x.name}
                      disabled={
                        busy || x.quantity >= x.stock || x.quantity >= 20
                      }
                      onClick={() =>
                        run("cart", {
                          variantId: x.id,
                          quantity: x.quantity + 1,
                        })
                      }
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="remove"
                      disabled={busy}
                      onClick={() =>
                        run("cart", { variantId: x.id, quantity: 0 })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <b>{money(x.price * x.quantity)}</b>
              </article>
            ))}
            <a className="text-link" href="/shop">
              Continue exploring
            </a>
          </div>
          <aside className="panel">
            <h2>Your order</h2>
            <form
              onSubmit={(e) => {
                const f = form(e);
                setCode(String(f.code).toUpperCase());
              }}
            >
              <label>
                {data.mode === "shopify"
                  ? "Discount code"
                  : "Sample discount code"}
                <div className="inline-form">
                  <input
                    name="code"
                    placeholder={
                      data.mode === "shopify" ? "Enter a code" : "Try DEMO10"
                    }
                  />
                  <button className="button" disabled={busy}>
                    Apply
                  </button>
                </div>
              </label>
            </form>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            {quote && <Summary quote={quote} />}
            {data.mode !== "shopify" && (
              <p className="small muted">
                Sample shipping: {money(data.settings.shipping)}; free from{" "}
                {money(data.settings.freeShipping)} after discounts. Sample tax
                rate: {data.settings.taxBps / 100}%.
              </p>
            )}
            <a
              className="button full"
              href={
                "/checkout" + (code ? "?code=" + encodeURIComponent(code) : "")
              }
            >
              {data.mode === "shopify"
                ? "Continue to checkout"
                : "Try sample checkout"}{" "}
              <ArrowRight size={18} />
            </a>
            <p className="small muted">
              {data.mode === "shopify"
                ? "Final prices, discounts, delivery and taxes are confirmed at secure hosted checkout."
                : "No real payment. No delivery. Prices and availability are checked again when placing a sample order."}
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
export function AddressFields({ defaults = {} }: Any) {
  return (
    <div className="form-grid">
      {[
        ["name", "Full name", "text", "name"],
        ["email", "Email address", "email", "email"],
        ["phone", "Mobile number", "tel", "tel"],
        ["line1", "Address line 1", "text", "address-line1"],
        ["line2", "Address line 2 (optional)", "text", "address-line2"],
        ["city", "City", "text", "address-level2"],
        ["state", "State / union territory", "text", "address-level1"],
        ["postcode", "PIN code", "text", "postal-code"],
      ].map(([name, label, type, auto]) => (
        <label
          className={name === "line1" || name === "line2" ? "wide" : ""}
          key={name}
        >
          {label}
          <input
            name={name}
            type={type}
            autoComplete={auto}
            defaultValue={defaults[name] ?? ""}
            required={name !== "line2"}
            maxLength={name === "postcode" ? 6 : name === "phone" ? 15 : 200}
            pattern={name === "postcode" ? "[1-9][0-9]{5}" : undefined}
          />
        </label>
      ))}
      <label>
        Country
        <input readOnly value="India" />
      </label>
    </div>
  );
}
function Checkout({ data, run, busy }: Any) {
  const [quote, setQuote] = useState<Any | null>(null),
    [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [defaults, setDefaults] = useState<Any | null>(null);
  useEffect(() => {
    api("quote", {
      code: new URLSearchParams(location.search).get("code") ?? "",
    })
      .then(setQuote)
      .catch((e) => setError(e.message));
    api("account")
      .then((r) => setDefaults(r.profile ? JSON.parse(r.profile.address) : {}))
      .catch(() => setDefaults({}));
  }, []);
  return (
    <section className="section">
      <p className="eyebrow">A PRACTICE RUN, FROM BAG TO ORDER</p>
      <h1 className="page-title">Sample checkout</h1>
      <div className="callout">
        This checkout creates a demonstration order only. Use fictional contact
        details. No card details, payment, email delivery, or shipping are
        involved.
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error} <a href="/cart">Return to bag</a>
        </p>
      ) : (
        <div className="checkout-grid">
          <form
            onSubmit={async (e) => {
              const f = form(e);
              const r = await run("checkout", {
                address: f,
                code: new URLSearchParams(location.search).get("code") ?? "",
                requestKey: key,
                demoConsent: f.consent === "on",
              });
              if (r) location.assign("/order/" + r.id);
            }}
          >
            <h2>Delivery details</h2>
            <p className="small">
              {data.user ? (
                "Signed in as " + data.user.email
              ) : (
                <>
                  <a
                    className="text-link"
                    href="/signin-with-chatgpt?return_to=/checkout"
                    target="_top"
                  >
                    Sign in to the sample account
                  </a>{" "}
                  or continue as a guest.
                </>
              )}
            </p>
            {defaults && <AddressFields defaults={defaults} />}
            <label className="check">
              <input type="checkbox" name="consent" required /> I understand
              this is a simulated order and no goods will ship.
            </label>
            <button className="button" disabled={busy || !quote}>
              Place sample order <ArrowRight size={18} />
            </button>
          </form>
          <aside className="panel">
            <h2>In your bag</h2>
            {data.cart.map((x: Any) => (
              <p key={x.id}>
                {x.quantity} × {x.name}
                <br />
                <span className="small muted">
                  {x.brand} · {x.size} / {x.color}
                </span>
              </p>
            ))}
            {quote && <Summary quote={quote} />}
            <p className="small">
              Live checkout will use a hosted payment provider after
              configuration and approval.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
function Order({ id, run, busy }: Any) {
  const [order, setOrder] = useState<Any | null>(null),
    [error, setError] = useState("");
  const load = () =>
    fetch("/api/store?action=order&id=" + encodeURIComponent(id))
      .then((r) => r.json())
      .then((r: any) => {
        if (r.error) throw new Error(r.error);
        setOrder(r.order);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [id]);
  if (error)
    return (
      <p className="section" role="alert">
        {error}
      </p>
    );
  if (!order)
    return (
      <p className="section" role="status">
        Loading your sample order…
      </p>
    );
  const items = JSON.parse(order.items);
  return (
    <section className="section narrow">
      <p className="eyebrow">DEMONSTRATION ORDER</p>
      <h1 className="page-title">
        {order.payment === "paid"
          ? "Your sample order is confirmed."
          : order.payment === "pending"
            ? "Choose a test payment outcome."
            : "Sample payment " + order.payment + "."}
      </h1>
      <p className="order-id">{order.id}</p>
      <div className="callout">
        No real payment was collected. Confirmation messages are saved in the
        sandbox outbox and are not sent.
      </div>
      <div className="status-row">
        <span>Payment: {order.payment}</span>
        <span>Delivery: {order.fulfillment}</span>
        <span>Cancellation: {order.cancellation}</span>
        <span>Refund: {order.refund}</span>
      </div>
      {order.payment === "pending" && (
        <div className="panel">
          <h3>Payment simulator</h3>
          <p>
            Exercise the server’s order states without entering payment details.
          </p>
          <div className="button-row">
            {["paid", "pending", "failed", "canceled"].map((x) => (
              <button
                key={x}
                className={"button " + (x === "paid" ? "" : "secondary")}
                disabled={busy}
                onClick={async () => {
                  await run(
                    "simulatePayment",
                    { id, outcome: x, eventId: crypto.randomUUID() },
                    "Sample payment event recorded.",
                  );
                  load();
                }}
              >
                {x === "paid"
                  ? "Successful payment"
                  : x === "pending"
                    ? "Keep pending"
                    : x === "failed"
                      ? "Failed payment"
                      : "Cancel payment"}
              </button>
            ))}
          </div>
        </div>
      )}
      {items.map((x: Any) => (
        <div className="order-item" key={x.variantId}>
          <img src={x.image} width="85" height="85" alt={x.name} />
          <div>
            <b>{x.name}</b>
            <p className="small">
              {x.brand} · {x.size} / {x.color} · Qty {x.quantity}
            </p>
          </div>
          <b>{money(x.price * x.quantity)}</b>
        </div>
      ))}
      <Summary quote={order} />
      {order.tracking && (
        <a
          className="button secondary"
          href={order.tracking}
          target="_blank"
          rel="noreferrer"
        >
          Track shipment
        </a>
      )}
      <h3>Request help with this sample order</h3>
      <form
        onSubmit={async (e) => {
          const f = form(e);
          const r = await run(
            "request",
            { id, ...f },
            "Request saved for store review.",
          );
          if (r) load();
        }}
      >
        <label>
          Request type
          <select name="type">
            <option value="cancellation">Cancellation (before shipment)</option>
            <option value="return">Return (after delivery)</option>
          </select>
        </label>
        <label>
          Reason
          <textarea name="reason" required minLength={5} maxLength={1000} />
        </label>
        <button className="button secondary" disabled={busy}>
          Submit sample request
        </button>
      </form>
      <a className="text-link" href="/account">
        View all your orders
      </a>
    </section>
  );
}
function Account({ data, run, busy }: Any) {
  const [account, setAccount] = useState<Any | null>(null);
  useEffect(() => {
    api("account").then(setAccount);
  }, []);
  return (
    <section className="section">
      <p className="eyebrow">YOUR AVIKA COLLECTION</p>
      <h1 className="page-title">
        {data.user
          ? "Hello, " + data.user.displayName
          : "Your orders & account"}
      </h1>
      {!data.user ? (
        <div className="callout">
          <p>
            Guest orders stay available in this browser. The sample account uses
            ChatGPT sign-in; local preview uses a test identity.
          </p>
          <a
            className="button"
            href="/signin-with-chatgpt?return_to=/account"
            target="_top"
          >
            Sign in to sample account
          </a>
          <p className="small">
            Production registration, recovery, and customer accounts will use
            the connected commerce provider.
          </p>
        </div>
      ) : (
        <p>
          <a
            className="text-link"
            href="/signout-with-chatgpt?return_to=/"
            target="_top"
          >
            Sign out
          </a>{" "}
          ·{" "}
          <a className="text-link" href="/wishlist">
            Your wishlist
          </a>
        </p>
      )}
      <h2>Order history</h2>
      {account?.orders.map((o: Any) => (
        <a className="order-history" href={"/order/" + o.id} key={o.id}>
          <span>
            {o.id}
            <small>
              {new Date(o.created).toLocaleDateString("en-IN")} · {o.payment} ·{" "}
              {o.fulfillment}
            </small>
          </span>
          <b>
            {money(o.total)} <ArrowUpRight size={18} />
          </b>
        </a>
      ))}
      {account && !account.orders.length && (
        <p>
          You haven’t placed any sample orders yet.{" "}
          <a className="text-link" href="/shop">
            Find your first piece
          </a>
          .
        </p>
      )}
      {data.user && account && (
        <form
          className="panel address-panel"
          onSubmit={(e) => {
            const f = form(e);
            run(
              "profile",
              { address: f },
              "Your profile and address are saved.",
            );
          }}
        >
          <h2>Profile & saved address</h2>
          <p className="small muted">Use fictional details while testing.</p>
          <AddressFields
            defaults={
              account.profile
                ? JSON.parse(account.profile.address)
                : { email: data.user.email, name: data.user.displayName }
            }
          />
          <button className="button" disabled={busy}>
            Save profile & address
          </button>
        </form>
      )}
    </section>
  );
}
function Info({ path, settings, run, busy, mode }: Any) {
  const topics: Any = {
    "/about": [
      "Our story",
      "Many brands. One thoughtfully gathered collection.",
      `Avika Collection is a multi-brand clothing and accessories retailer based in Lajpat Nagar, New Delhi. We bring together products from other manufacturers, with the actual brand clearly shown on each product.`,
      `We are a retailer, not a clothing manufacturer. This preview uses fictional product labels and original illustrative photography. Our real catalog, brand details and product photographs will replace these samples before launch.`,
    ],
    "/shipping": [
      "Shipping & delivery",
      "Draft — owner confirmation required",
      settings.deliveryNote,
      `The preview supports Indian addresses and six-digit PIN codes. Sample delivery is ${money(settings.shipping)}, or free on orders of ${money(settings.freeShipping)} or more after discounts. These are test settings, not a live delivery promise. Shipping zones, courier, charges and tax treatment must be confirmed before accepting orders.`,
    ],
    "/returns": [
      "Returns, exchanges & refunds",
      "Draft — owner confirmation required",
      `The sample workflow allows cancellation before shipment and return requests for delivered sample orders within ${settings.returnDays} days of order placement. Staff review requests in store management. These rules exist for testing and are not final customer policy.`,
      `Before launch, the owner must confirm the return window, its start date, condition requirements, exclusions, exchange process, return shipping costs and refund timing. No real refunds are performed in this preview.`,
    ],
    "/privacy": [
      "Privacy",
      "Draft — owner and legal review required",
      "This preview stores cart contents, saved products, submitted inquiries, sample addresses and sample orders. A necessary session cookie links guest records to this browser. Signed-in sample records are linked to the platform user ID. No analytics, advertising trackers or newsletter signup are enabled.",
      "Only enter fictional personal details during testing. The owner must confirm the legal business identity, privacy contact, retention periods, processors, data-rights request process and applicable requirements before launch. Contact details are not yet configured.",
    ],
    "/terms": [
      "Terms & conditions",
      "Draft — owner and legal review required",
      "Avika Collection is a multi-brand retailer in Lajpat Nagar, New Delhi, India. The current website is a demonstration store. Product names, fictional brands, imagery, prices and availability are samples. Sample orders are not contracts to buy goods.",
      "Before live trading, the owner must confirm business identity and contact information, pricing and tax disclosures, order acceptance, delivery responsibilities, cancellation rights, complaints handling and applicable terms. These draft terms are not a claim of legal compliance.",
    ],
  };
  const contentKey: Any = {
    "/about": "aboutText",
    "/shipping": "shippingPolicy",
    "/returns": "returnsPolicy",
    "/privacy": "privacyPolicy",
    "/terms": "termsPolicy",
  };
  if (settings[contentKey[path]]?.trim())
    return (
      <section className="section narrow prose">
        <p className="eyebrow">AVIKA COLLECTION</p>
        <h1 className="page-title">{topics[path][0]}</h1>
        <div className="preserve">{settings[contentKey[path]]}</div>
        <a className="text-link" href="/contact">
          Contact the store
        </a>
      </section>
    );
  if (path === "/contact")
    return (
      <section className="section narrow">
        <p className="eyebrow">LET’S TALK</p>
        <h1 className="page-title">We’re here to help.</h1>
        <p>{settings.location}</p>
        {(!settings.contactEmail || !settings.phone) && (
          <p className="muted">
            The exact shop address, opening hours, phone number and support
            email await owner confirmation.
          </p>
        )}
        {settings.phone && <p>{settings.phone}</p>}
        {settings.contactEmail && (
          <a className="text-link" href={"mailto:" + settings.contactEmail}>
            {settings.contactEmail}
          </a>
        )}
        <form
          className="panel"
          onSubmit={async (e) => {
            const el = e.currentTarget;
            const f = form(e);
            const result = await run(
              "inquiry",
              { ...f, consent: f.consent === "on" },
              "Your inquiry was saved in the store inbox. Email delivery is not configured.",
            );
            if (result) el.reset();
          }}
        >
          <label>
            Your name
            <input name="name" required minLength={2} maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" required type="email" maxLength={254} />
          </label>
          <label>
            Your message
            <textarea name="message" required minLength={10} maxLength={3000} />
          </label>
          <div className="honeypot" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="check">
            <input name="consent" type="checkbox" required /> I agree to these
            details being stored to handle my inquiry.{" "}
            <a href="/privacy">Privacy</a>
          </label>
          <button className="button" disabled={busy}>
            Send inquiry <ArrowRight size={18} />
          </button>
        </form>
      </section>
    );
  if (path === "/faq")
    return (
      <section className="section narrow">
        <p className="eyebrow">GOOD TO KNOW</p>
        <h1 className="page-title">A few common questions.</h1>
        {[
          [
            "Is Avika a clothing brand?",
            "Avika Collection is a retailer. Each product’s manufacturer brand is listed separately.",
          ],
          [
            "Can I place a real order?",
            mode === "shopify"
              ? "You can order when secure checkout is enabled. Final stock, delivery and payment options are shown at checkout."
              : "Not yet. You can test the bag and sample checkout; no payments are collected or goods shipped.",
          ],
          ["Where are you based?", settings.location],
          [
            "Which payment methods are available?",
            mode === "shopify"
              ? "Available payment methods are shown by the secure checkout provider."
              : "The preview has a payment simulator. Live payment methods will be shown only after a provider is configured and verified.",
          ],
          [
            "Can I return an item?",
            mode === "shopify"
              ? "Read the store returns policy, then use your customer account to request an eligible return."
              : "The preview has a sample return-request workflow. Read the draft returns page; the live policy awaits owner confirmation.",
          ],
          [
            "Are the photographs actual products?",
            mode === "shopify"
              ? "Product photographs and brands come from the connected catalog. Editorial banners are illustrative and labeled as such."
              : "No. All current imagery is AI-generated illustrative content, and the manufacturer labels are fictional demo names.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    );
  const content = topics[path];
  return content ? (
    <section className="section narrow prose">
      <p className="eyebrow">AVIKA COLLECTION</p>
      <h1 className="page-title">{content[0]}</h1>
      <h3>{content[1]}</h3>
      {content.slice(2).map((p: string) => (
        <p key={p}>{p}</p>
      ))}
      <a className="text-link" href="/contact">
        Contact the store
      </a>
    </section>
  ) : (
    <Empty
      title="A little off the beaten path"
      text="We couldn’t find this page."
      href="/shop"
      action="Back to the collection"
    />
  );
}
