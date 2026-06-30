import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/magamart';
const UPLOAD_DIR  = path.join(process.cwd(), 'uploads', 'products');

// ── schema ────────────────────────────────────────────────────────────────────

const ProductSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price:       { type: Number, required: true, min: 0 },
    category:    { type: String, required: true, trim: true },
    stock:       { type: Number, default: 0, min: 0 },
    image:       { type: String, default: null },
  },
  { timestamps: true },
);

const ProductModel = mongoose.model('Product', ProductSchema);

// ── helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Download a URL to a file, following up to 5 redirects.
 * Uses picsum.photos/seed/{seed}/W/H which is a stable, no-redirect URL.
 */
function downloadFile(url: string, dest: string, redirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));

    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 15000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode!)) {
        const location = res.headers.location!;
        res.resume(); // drain
        return downloadFile(location, dest, redirects - 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
  });
}

/**
 * Build a deterministic, redirect-free Picsum URL using a text seed.
 * https://picsum.photos/seed/{text}/600/600 → always resolves directly.
 */
function imageUrl(slug: string): string {
  return `https://picsum.photos/seed/${slug}/600/600`;
}

async function fetchImage(slug: string): Promise<string | null> {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const filename = `${slug}.jpg`;
  const dest     = path.join(UPLOAD_DIR, filename);
  const relative = `/uploads/products/${filename}`;

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    process.stdout.write(`    ↩  reused  ${filename}\n`);
    return relative;
  }

  const url = imageUrl(slug);
  try {
    await downloadFile(url, dest);
    process.stdout.write(`    ↓  saved   ${filename}\n`);
    return relative;
  } catch (err) {
    process.stdout.write(`    ✗  failed  ${filename}: ${(err as Error).message}\n`);
    if (fs.existsSync(dest)) fs.unlinkSync(dest); // remove partial file
    return null;
  }
}

// ── product data ──────────────────────────────────────────────────────────────

const PRODUCTS = [
  // Electronics
  { name: 'Sony 65" 4K OLED TV',             description: 'Stunning 4K OLED display with Dolby Vision, HDR10, and Android TV built-in.',                        price: 1299.99, category: 'Electronics',      stock: 15  },
  { name: 'Sony WH-1000XM5 Headphones',      description: 'Industry-leading noise cancellation with 30-hour battery life and Hi-Res Audio.',                     price:  349.99, category: 'Electronics',      stock: 40  },
  { name: 'Logitech MX Master 3S Mouse',     description: 'Advanced wireless mouse with 8K DPI sensor and MagSpeed scroll wheel.',                               price:   99.99, category: 'Electronics',      stock: 60  },
  { name: 'Apple AirPods Pro (2nd Gen)',      description: 'Active noise cancellation, Transparency mode, Adaptive Audio, MagSafe charging case.',                price:  249.99, category: 'Electronics',      stock: 80  },
  { name: 'Dell UltraSharp 27" 4K Monitor',  description: 'IPS panel with 99% sRGB, USB-C 90W charging, factory-calibrated colour accuracy.',                   price:  599.99, category: 'Electronics',      stock: 20  },
  // Smartphones
  { name: 'iPhone 15 Pro Max 256GB',         description: 'A17 Pro chip, titanium design, 48MP camera system with 5× optical zoom.',                            price: 1199.99, category: 'Smartphones',      stock: 50  },
  { name: 'Samsung Galaxy S24 Ultra',        description: 'Snapdragon 8 Gen 3, 200MP camera, built-in S Pen, 5000 mAh battery.',                                price: 1099.99, category: 'Smartphones',      stock: 45  },
  { name: 'Google Pixel 8 Pro',              description: 'Google Tensor G3 chip, 7 years of OS updates, advanced AI photography features.',                     price:  799.99, category: 'Smartphones',      stock: 35  },
  { name: 'OnePlus 12 256GB',                description: 'Snapdragon 8 Gen 3, 100W SUPERVOOC charging, Hasselblad-tuned triple camera.',                       price:  699.99, category: 'Smartphones',      stock: 30  },
  { name: 'Xiaomi 14 Ultra',                 description: 'Leica Summilux lenses, 1-inch Sony sensor, 90W HyperCharge, Snapdragon 8 Gen 3.',                    price:  899.99, category: 'Smartphones',      stock: 25  },
  // Fashion
  { name: 'Classic Slim-Fit Chinos',         description: 'Premium stretch cotton chinos in a modern slim fit — available in multiple colours.',                 price:   59.99, category: 'Fashion',           stock: 120 },
  { name: 'Oversized Graphic Hoodie',        description: '380gsm fleece, dropped shoulders, kangaroo pocket, washed vintage finish.',                           price:   49.99, category: 'Fashion',           stock: 90  },
  { name: "Women's Wrap Midi Dress",         description: 'Flowy viscose wrap dress with adjustable tie waist — perfect for all seasons.',                       price:   64.99, category: 'Fashion',           stock: 75  },
  { name: 'Linen Blazer (Unisex)',           description: 'Breathable linen-blend blazer with notched lapels and two front pockets.',                            price:   89.99, category: 'Fashion',           stock: 55  },
  { name: 'Running Jogger Pants',            description: 'Lightweight 4-way stretch fabric, moisture-wicking, tapered fit with zip pockets.',                   price:   44.99, category: 'Fashion',           stock: 100 },
  // Furniture
  { name: 'Ergonomic Office Chair',          description: 'Lumbar support, adjustable armrests, breathable mesh back, 5-year warranty.',                         price:  349.99, category: 'Furniture',         stock: 20  },
  { name: 'Solid Oak Dining Table',          description: 'Sustainably sourced solid oak, natural oil finish, seats 6 comfortably.',                             price:  899.99, category: 'Furniture',         stock: 8   },
  { name: 'L-Shaped Corner Desk',           description: '160×120cm surface, cable management tray, drawer unit, easy assembly.',                               price:  249.99, category: 'Furniture',         stock: 18  },
  { name: 'Velvet 3-Seater Sofa',           description: 'Deep button-tufted velvet upholstery, solid wood legs, available in 6 colours.',                      price:  699.99, category: 'Furniture',         stock: 10  },
  { name: 'Floating Wall Shelves (5 pcs)',  description: 'Rustic reclaimed-wood effect shelves with invisible steel brackets — max 15 kg each.',                price:   79.99, category: 'Furniture',         stock: 40  },
  // Cosmetics
  { name: 'Charlotte Tilbury Pillow Talk',   description: 'Iconic soft-pink-nude shade in a creamy, long-lasting satin finish.',                                 price:   34.99, category: 'Cosmetics',         stock: 150 },
  { name: 'NARS Radiant Creamy Concealer',  description: 'Full coverage, skin-perfecting concealer with a natural, radiant finish.',                             price:   29.99, category: 'Cosmetics',         stock: 130 },
  { name: 'Urban Decay Naked Palette',       description: '12 neutral to smoky shades with both matte and shimmer finishes.',                                    price:   54.99, category: 'Cosmetics',         stock: 70  },
  { name: 'Fenty Beauty Pro Foundation',    description: '40+ inclusive shades, soft-matte finish, oil-free, long-wearing up to 24 hrs.',                       price:   39.99, category: 'Cosmetics',         stock: 110 },
  { name: 'MAC Studio Fix Powder',           description: 'Matte pressed powder with SPF 15 that controls shine and sets makeup.',                               price:   32.99, category: 'Cosmetics',         stock: 90  },
  // Watches
  { name: 'Seiko Presage Automatic',         description: 'Japanese automatic movement, sapphire crystal, 50m water resistance.',                                price:  449.99, category: 'Watches',           stock: 20  },
  { name: 'Casio G-Shock GA-2100',           description: 'Carbon Core Guard, 200m water resistance, world time, shock resistant.',                              price:  109.99, category: 'Watches',           stock: 60  },
  { name: 'Apple Watch Series 9 (45mm)',     description: 'S9 chip, Always-On Retina display, crash detection, ECG, blood oxygen sensor.',                       price:  429.99, category: 'Watches',           stock: 55  },
  { name: 'Fossil Gen 6 Smartwatch',         description: 'Wear OS, heart rate, SpO2, sleep tracking, 1.28" AMOLED display.',                                   price:  199.99, category: 'Watches',           stock: 35  },
  { name: 'Orient Bambino Open Heart',       description: 'Japanese automatic movement, open-heart dial, dress-style case, leather strap.',                      price:  179.99, category: 'Watches',           stock: 25  },
  // Accessories
  { name: 'Leather Bifold Wallet',           description: 'Full-grain vegetable-tanned leather, 8 card slots, RFID blocking, slim profile.',                     price:   49.99, category: 'Accessories',       stock: 100 },
  { name: 'Canvas Backpack 25L',             description: 'Waxed canvas, padded laptop sleeve (up to 16"), brass hardware, water-resistant.',                   price:   89.99, category: 'Accessories',       stock: 60  },
  { name: 'Polarised Aviator Sunglasses',    description: 'UV400 polarised lenses, lightweight metal frame, spring hinges, microfibre pouch.',                   price:   34.99, category: 'Accessories',       stock: 80  },
  { name: 'Silk Pocket Square Set (3 pcs)', description: '100% pure silk pocket squares in classic patterns — white, navy, and burgundy.',                      price:   24.99, category: 'Accessories',       stock: 120 },
  { name: 'Stainless Steel Belt',            description: 'Sliding ratchet buckle, no holes needed, 35mm PU leather strap, adjustable up to 47".',              price:   29.99, category: 'Accessories',       stock: 90  },
  // Daily Essentials
  { name: 'Gillette Fusion5 Razor',          description: '5-blade precision razor with FlexBall technology and Precision Trimmer, includes 8 blades.',          price:   19.99, category: 'Daily Essentials',  stock: 200 },
  { name: 'Colgate Max Fresh (3 Pack)',      description: 'Whitening + fresh breath formula with mini breath strips, fluoride protection.',                       price:    9.99, category: 'Daily Essentials',  stock: 300 },
  { name: 'Dove Deep Moisture Body Wash',   description: 'Nourishing formula with NutriumMoisture technology, 500ml.',                                           price:    7.99, category: 'Daily Essentials',  stock: 250 },
  { name: 'Microfibre Bath Towel Set',      description: 'Ultra-soft 600 GSM microfibre, quick-dry, anti-bacterial, machine washable, 4 pcs.',                  price:   29.99, category: 'Daily Essentials',  stock: 80  },
  { name: 'Reusable Grocery Bags (10 pk)',  description: 'Heavy-duty 50L tote bags, machine washable, supports 20 kg each.',                                    price:   14.99, category: 'Daily Essentials',  stock: 180 },
  // Home & Kitchen
  { name: 'Instant Pot Duo 7-in-1 (6 Qt)', description: 'Pressure cooker, slow cooker, rice cooker, steamer, sauté, yoghurt maker, warmer.',                  price:   89.99, category: 'Home & Kitchen',    stock: 40  },
  { name: 'Ninja Air Fryer XL (5.5L)',      description: '4 cooking functions, Max Crisp technology, dishwasher-safe basket, 2500W.',                           price:  119.99, category: 'Home & Kitchen',    stock: 35  },
  { name: 'KitchenAid Stand Mixer (5 Qt)', description: '10-speed tilt-head stand mixer with 59-point planetary mixing action.',                               price:  349.99, category: 'Home & Kitchen',    stock: 15  },
  { name: 'Non-Stick Cookware Set (10 pc)',description: 'Hard-anodised aluminium, PFOA-free coating, oven-safe to 260°C, induction compatible.',               price:  149.99, category: 'Home & Kitchen',    stock: 25  },
  { name: 'Nespresso Vertuo Next',           description: 'One-touch brewing, 5 cup sizes, centrifusion extraction, 1500W, 1.1L water tank.',                   price:  159.99, category: 'Home & Kitchen',    stock: 30  },
  // Sports
  { name: 'Adjustable Dumbbell Set',        description: 'Replaces 15 sets of weights, quick-adjust dial system, 5–52.5 lbs, steel and ABS.',                  price:  299.99, category: 'Sports',             stock: 20  },
  { name: 'Yoga Mat with Alignment Lines',  description: '6mm TPE non-slip mat, 183×61cm, moisture-resistant, includes carry strap.',                           price:   39.99, category: 'Sports',             stock: 70  },
  { name: 'Resistance Bands Set (5 lvls)', description: 'Natural latex, 10–50 lbs resistance, door anchor and handles included.',                              price:   24.99, category: 'Sports',             stock: 100 },
  { name: 'Nike Air Zoom Pegasus 40',       description: 'Responsive React foam, Air Zoom unit in the forefoot, engineered mesh upper.',                        price:  129.99, category: 'Sports',             stock: 55  },
  // Beauty
  { name: 'CeraVe Moisturising Cream',      description: '3 essential ceramides + hyaluronic acid, fragrance-free, non-comedogenic, 250ml.',                    price:   16.99, category: 'Beauty',             stock: 180 },
  { name: 'The Ordinary Niacinamide 10%',   description: 'High-strength vitamin B3 serum to reduce blemishes, balance sebum, and minimise pores.',             price:    8.99, category: 'Beauty',             stock: 200 },
  { name: 'Dyson Airwrap Styler Complete',  description: 'Coanda airflow technology, styles without extreme heat, 6 attachments included.',                     price:  549.99, category: 'Beauty',             stock: 18  },
  { name: 'Neutrogena Hydro Boost Gel',     description: 'Water-gel moisturiser with hyaluronic acid — oil-free, non-comedogenic, fragrance-free.',             price:   18.99, category: 'Beauty',             stock: 140 },
  // Groceries
  { name: 'Organic Extra Virgin Olive Oil', description: 'Cold-pressed, single origin, PDO certified, ideal for dressings and low-heat cooking, 1L.',           price:   14.99, category: 'Groceries',          stock: 150 },
  { name: 'Manuka Honey MGO 400+ (500g)',  description: 'Genuine New Zealand Manuka honey, independently lab-tested, UMF certified.',                           price:   39.99, category: 'Groceries',          stock: 80  },
  { name: 'Organic Quinoa Grain (2kg)',     description: 'Pre-washed organic white quinoa, high protein, gluten-free, non-GMO.',                                price:   12.99, category: 'Groceries',          stock: 120 },
  { name: 'Mixed Nuts & Dried Fruits 1kg', description: 'Almonds, cashews, walnuts, raisins and cranberries — no added salt or sugar.',                        price:   19.99, category: 'Groceries',          stock: 100 },
  { name: 'Arabica Ground Coffee (500g)',  description: '100% Colombian Arabica, medium roast, notes of chocolate and caramel, freshness seal.',               price:   13.99, category: 'Groceries',          stock: 160 },
];

// ── main ──────────────────────────────────────────────────────────────────────

async function seedProducts() {
  await mongoose.connect(MONGODB_URI);
  console.log('✔  Connected to MongoDB\n');

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log(`✔  Created uploads dir: ${UPLOAD_DIR}\n`);
  }

  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const exists = await ProductModel.findOne({ name: p.name });
    if (exists) {
      console.log(`  ⏭  ${p.name} — already exists`);
      skipped++;
      continue;
    }

    console.log(`  ➤  ${p.name}`);
    const slug  = slugify(p.name);
    const image = await fetchImage(slug);

    await ProductModel.create({ ...p, image });
    console.log(`  ✓  saved to DB\n`);
    created++;
  }

  console.log(`\n────────────────────────────`);
  console.log(`✔  Done: ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
}

seedProducts().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
