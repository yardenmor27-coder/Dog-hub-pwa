// Real, sourced dog-food data (Israeli retail, average market prices, NIS).
// Prices are approximate averages gathered from Israeli pet retailers and
// move with promotions — treat pricePerKg as a guide, not a live price feed.
//
// This is a curated set spanning every major tier (budget/mid/premium/
// ultra-premium) and every dog size sold in Israel — not a literal catalog
// of every SKU in the country (that's thousands of products across dozens
// of brands and would need a live supplier-feed integration to maintain).

const FOODS = [
  {
    id: "acana-adult",
    brand: "אקאנה",
    line: "Adult Dog (עוף)",
    size: "all",
    tier: "פרימיום",
    bagKg: 11.4,
    bagPrice: 330,
    fact: "כ-60% תכולת בשר, שליש ממנו טרי. נטול דגנים.",
  },
  {
    id: "acana-large",
    brand: "אקאנה",
    line: "Large Breed Adult",
    size: "large",
    tier: "פרימיום",
    bagKg: 11.4,
    bagPrice: 345,
    fact: "מותאם למפרקים של כלבים גדולים, בשר כמרכיב ראשון.",
  },
  {
    id: "rc-mini",
    brand: "רויאל קנין",
    line: "Mini Adult",
    size: "small",
    tier: "בינוני-פרימיום",
    bagKg: 8,
    bagPrice: 200,
    fact: "נוסחה ייעודית לגזעים קטנים, גרגר מותאם ללסת קטנה.",
  },
  {
    id: "rc-medium",
    brand: "רויאל קנין",
    line: "Medium Adult",
    size: "medium",
    tier: "בינוני-פרימיום",
    bagKg: 15,
    bagPrice: 345,
    fact: "תמיכה בעיכול ובריאות העור, מותאם לגזע בינוני.",
  },
  {
    id: "proplan-medium",
    brand: "פרו פלאן",
    line: "Adult Medium עוף",
    size: "medium",
    tier: "בינוני-פרימיום",
    bagKg: 14,
    bagPrice: 290,
    fact: "25% חלבון גולמי, תומך במפרקים ובבריאות המעיים.",
  },
  {
    id: "hills-large",
    brand: "הילס סיינס פלאן",
    line: "Adult עוף (גזע גדול)",
    size: "large",
    tier: "בינוני-פרימיום",
    bagKg: 14,
    bagPrice: 315,
    fact: "פורמולה קלינית, מיועדת לגזעים גדולים.",
  },
  {
    id: "totw-lamb",
    brand: "טייסט אוף דה ווילד",
    line: "Sierra Mountain כבש",
    size: "all",
    tier: "פרימיום",
    bagKg: 12.2,
    bagPrice: 309,
    fact: "נטול דגנים, עשיר בחלבון ובאומגה 3-6.",
  },
  {
    id: "monge-senior",
    brand: "מונג'",
    line: "Senior עוף",
    size: "all",
    tier: "בינוני",
    bagKg: 12,
    bagPrice: 269,
    fact: "תוצרת איטליה, פרוביוטיקה לעיכול, מתאים לכלבים מבוגרים.",
  },
  {
    id: "orijen-original",
    brand: "אוריג'ן",
    line: "Original (עוף והודו)",
    size: "all",
    tier: "אולטרה-פרימיום",
    bagKg: 11.4,
    bagPrice: 430,
    fact: "אולטרה-פרימיום, 38% חלבון מן החי, ייצור קנדי, ללא דגנים.",
  },
  {
    id: "orijen-senior",
    brand: "אוריג'ן",
    line: "Senior",
    size: "all",
    tier: "אולטרה-פרימיום",
    bagKg: 11.4,
    bagPrice: 429,
    fact: "אולטרה-פרימיום לכלבים מבוגרים, גלוקוזאמין וכונדרואיטין למפרקים.",
  },
];

const REGIONS = ["מרכז", "ירושלים והסביבה", "חיפה והצפון", "באר שבע והדרום", "יהודה ושומרון"];

function withPricingAndShipping(weightKg, region) {
  const freeThreshold = 150;
  const days = region === "מרכז" ? "1–2 ימי עסקים" : "2–4 ימי עסקים";
  return FOODS.map((f) => {
    const pricePerKg = f.bagPrice / f.bagKg;
    const dailyKg = weightKg * 0.025; // feeding guideline: ~2.5% of body weight/day
    const monthlyCost = dailyKg * 30 * pricePerKg;
    return {
      ...f,
      pricePerKg: Number(pricePerKg.toFixed(2)),
      monthlyCost: Math.round(monthlyCost),
      // modeled as nationwide — real per-brand delivery-zone exclusions
      // aren't reliably published, so this reflects the general market
      // pattern rather than a verified per-brand map.
      shipping: { free: f.bagPrice >= freeThreshold, days, region, coverage: "כל הארץ, כולל יהודה ושומרון" },
    };
  });
}

module.exports = { FOODS, REGIONS, withPricingAndShipping };
