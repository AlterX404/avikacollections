import { writeFileSync } from "node:fs";
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const products = [
  [
    "ivory-linen-shirt",
    "The easy linen shirt",
    "Studio North (demo)",
    "Men",
    "Everyday essentials",
    "A relaxed shirt for unhurried mornings and everyday plans.",
    "Linen blend",
    "Cold gentle wash; dry in shade.",
    "Relaxed",
    "shirt",
    "Ivory",
    169900,
  ],
  [
    "rust-kurta",
    "The sunlit kurta",
    "Rang Studio (demo)",
    "Women",
    "The colour edit",
    "A warm rust kurta with understated detailing and an easy silhouette.",
    "Cotton blend",
    "Gentle wash separately; iron on reverse.",
    "Regular",
    "kurta",
    "Rust",
    229900,
  ],
  [
    "indigo-overshirt",
    "The weekend overshirt",
    "Studio North (demo)",
    "Men",
    "Everyday essentials",
    "An indigo layer to wear open over a favourite tee or buttoned up.",
    "Cotton denim",
    "Wash inside out with similar colours.",
    "Relaxed",
    "overshirt",
    "Indigo",
    249900,
  ],
  [
    "everyday-tote",
    "The everyday carryall",
    "Mysa Goods (demo)",
    "Accessories",
    "Everyday essentials",
    "A roomy tote for the things that make up your day.",
    "Synthetic leather",
    "Wipe clean with a soft damp cloth.",
    "One size",
    "bag",
    "Tan",
    189900,
  ],
];
let sql =
  "-- DEMONSTRATION CONTENT ONLY. Never part of production migrations.\n";
for (const [
  id,
  name,
  brand,
  category,
  collection,
  description,
  material,
  care,
  fit,
  image,
  color,
  price,
] of products) {
  sql += `INSERT OR IGNORE INTO products(id,name,brand,category,collection,description,material,care,fit,image,status,demo,created) VALUES(${[id, name, brand, category, collection, description, material, care, fit, "/images/" + image + ".webp", "published"].map(q).join(",")},1,${Date.now()});\n`;
  for (const [i, size] of (category === "Accessories"
    ? ["One size"]
    : ["S", "M", "L", "XL"]
  ).entries())
    sql += `INSERT OR IGNORE INTO variants(id,product_id,sku,size,color,price,stock) VALUES(${[id + "-" + size, id, "DEMO-" + id.toUpperCase() + "-" + size, size, color].map(q).join(",")},${price},${size === "XL" ? 0 : 12 + i});\n`;
}
const settings = {
  shipping: 9900,
  freeShipping: 299900,
  taxBps: 0,
  announcement: "A wardrobe of possibilities. A collection of brands.",
  featuredCollection: "Everyday essentials",
  returnDays: 7,
  contactEmail: "",
  phone: "",
  location: "Lajpat Nagar, New Delhi, India",
  deliveryNote:
    "Sample delivery: 3–7 business days within India. Actual service areas and timings need owner confirmation.",
};
sql += `INSERT OR IGNORE INTO settings(key,value) VALUES('store',${q(JSON.stringify(settings))});\n`;
writeFileSync('db/store-settings.sql',`-- Empty owner-review settings only. No products, discounts or orders.\nINSERT OR IGNORE INTO settings(key,value) VALUES('store',${q(JSON.stringify(settings))});\n`);
sql += `INSERT OR IGNORE INTO discounts(code,percent,minimum,expires,usage_limit,used,active) VALUES('DEMO10',10,100000,4102444800000,100,0,1);\nINSERT OR IGNORE INTO discounts(code,percent,minimum,expires,usage_limit,used,active) VALUES('EXPIRED',10,0,1,100,0,1);\n`;
writeFileSync("db/demo-seed.sql", sql);
console.log("Wrote separate demonstration seed: db/demo-seed.sql");
