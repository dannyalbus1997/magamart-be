/**
 * seed-products.ts
 * Fetches real product thumbnails from the DummyJSON API and stores
 * the absolute URL directly in MongoDB (no local download needed).
 * getImageUrl() in the FE already handles absolute http/https URLs.
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as https from 'https';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/magamart';

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

// ── DummyJSON fetcher ─────────────────────────────────────────────────────────

function fetchJSON<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15_000 }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    })
    .on('timeout', () => reject(new Error('timeout')))
    .on('error', reject);
  });
}

// Cache thumbnails per DummyJSON slug so we don't re-fetch
const cache: Record<string, string[]> = {};

async function thumbsFor(slug: string): Promise<string[]> {
  if (cache[slug]) return cache[slug];
  try {
    const { products } = await fetchJSON<{ products: { thumbnail: string }[] }>(
      `https://dummyjson.com/products/category/${slug}?limit=30&select=thumbnail`,
    );
    const urls = products.map((p) => p.thumbnail).filter(Boolean);
    cache[slug] = urls;
    console.log(`  [DummyJSON] ${slug}: ${urls.length} thumbnails`);
    return urls;
  } catch (err) {
    console.warn(`  [DummyJSON] failed to fetch ${slug}: ${(err as Error).message}`);
    return [];
  }
}

// Map our categories → one or more DummyJSON category slugs
const SLUG_MAP: Record<string, string[]> = {
  'Electronics':      ['laptops', 'tablets'],
  'Smartphones':      ['smartphones', 'mobile-accessories'],
  'Fashion':          ['mens-shirts', 'womens-dresses', 'tops', 'womens-shoes', 'mens-shoes'],
  'Furniture':        ['furniture', 'home-decoration'],
  'Cosmetics':        ['beauty', 'fragrances'],
  'Watches':          ['mens-watches', 'womens-watches'],
  'Accessories':      ['sunglasses', 'womens-bags', 'womens-jewellery'],
  'Daily Essentials': ['groceries'],
  'Home & Kitchen':   ['kitchen-accessories'],
  'Sports':           ['sports-accessories'],
  'Beauty':           ['skin-care', 'beauty'],
  'Groceries':        ['groceries'],
};

const catPointer: Record<string, number> = {};

async function pickThumbnail(category: string): Promise<string | null> {
  const slugs = SLUG_MAP[category] ?? ['groceries'];
  const allThumbs: string[] = [];
  for (const slug of slugs) {
    allThumbs.push(...(await thumbsFor(slug)));
  }
  if (allThumbs.length === 0) return null;
  const idx = catPointer[category] ?? 0;
  catPointer[category] = idx + 1;
  return allThumbs[idx % allThumbs.length];
}

// ── product list ──────────────────────────────────────────────────────────────

const PRODUCTS = [
  // ── Electronics ──────────────────────────────────────────────────────────
  {
    name: 'Sony 65" 4K OLED TV',
    description: `Experience breathtaking picture quality with Sony's 65-inch 4K OLED display. Powered by the Cognitive Processor XR, it replicates how humans see and hear to deliver incredibly realistic images. Key features include: XR OLED Contrast PRO for perfect blacks, Dolby Vision & HDR10 support, Dolby Atmos & DTS:X audio, Android TV with Google Assistant built-in, 4× HDMI 2.1 ports (48Gbps) for 4K@120fps gaming, ALLM & VRR for low-latency gaming, and a sleek frameless design. Dimensions: 144.5 × 83.3 × 5.1 cm. Weight: 22 kg. Energy rating: A.`,
    price: 1299.99, category: 'Electronics', stock: 15,
  },
  {
    name: 'Sony WH-1000XM5 Headphones',
    description: `Sony's flagship over-ear headphones set the industry standard for noise cancellation. Featuring 8 microphones and two processors working in harmony to block out more noise than ever before. Highlights: up to 30-hour battery life (3-hour quick charge gives 3 hrs playback), 40mm drivers with improved diaphragm for richer sound, Hi-Res Audio & LDAC support, multipoint Bluetooth connection to 2 devices simultaneously, speak-to-chat auto-pause, touch sensor controls, and foldable design with carry case. Frequency response: 4 Hz – 40,000 Hz. Weight: 250 g. Connectivity: Bluetooth 5.2, 3.5mm jack.`,
    price: 349.99, category: 'Electronics', stock: 40,
  },
  {
    name: 'Logitech MX Master 3S Mouse',
    description: `The Logitech MX Master 3S is engineered for creators and professionals who demand precision. The 8,000 DPI high-precision sensor works on virtually any surface including glass. Features: MagSpeed electromagnetic scroll wheel (1,000 lines/second), quiet clicks (90% quieter), ergonomic right-hand design, customisable 7 buttons via Logi Options+, Bluetooth & USB receiver (Logi Bolt), connects to 3 devices, 70-day battery life on full charge, USB-C charging. Dimensions: 124.9 × 84.3 × 51 mm. Weight: 141 g. Compatible with Windows, macOS, Linux, iPadOS.`,
    price: 99.99, category: 'Electronics', stock: 60,
  },
  {
    name: 'Apple AirPods Pro (2nd Gen)',
    description: `Apple AirPods Pro 2nd generation deliver a transformative listening experience. The H2 chip enables next-level Active Noise Cancellation (2× more effective than 1st gen), Transparency mode, and the new Adaptive Audio that blends ANC and Transparency dynamically. Key specs: custom Apple driver + amplifier for richer bass, Personalised Spatial Audio with dynamic head tracking, up to 6 hrs listening (30 hrs with MagSafe case), sweat & water resistant (IP54), touch control on stem, Conversation Awareness, and Find My support. Includes 4 ear tip sizes (XS, S, M, L). Weight per bud: 5.3 g.`,
    price: 249.99, category: 'Electronics', stock: 80,
  },
  {
    name: 'Dell UltraSharp 27" 4K Monitor',
    description: `The Dell UltraSharp U2723QE is a 27-inch 4K IPS Black monitor built for colour-critical work. Panel: IPS Black technology with 2000:1 contrast ratio. Resolution: 3840×2160 (4K UHD). Colour: 100% sRGB, 98% DCI-P3, factory-calibrated to ΔE < 2. Connectivity: Thunderbolt 4 (90W charging), USB-C, 4× USB-A 3.2, HDMI 2.0, DisplayPort 1.4. Refresh rate: 60Hz. Response time: 5ms (GtG). Brightness: 400 cd/m². Features: ComfortView Plus (always-on blue light reduction), height/tilt/swivel/pivot stand, VESA 100×100. Dimensions: 612 × 185 × 525 mm.`,
    price: 599.99, category: 'Electronics', stock: 20,
  },

  // ── Smartphones ──────────────────────────────────────────────────────────
  {
    name: 'iPhone 15 Pro Max 256GB',
    description: `Apple's most advanced iPhone features the groundbreaking A17 Pro chip built on 3-nanometer technology, delivering console-quality gaming and pro-level performance. The aerospace-grade titanium frame is lighter yet stronger than stainless steel. Camera system: 48MP main (f/1.78, second-gen sensor-shift OIS), 12MP ultra-wide (f/2.2, 120° FOV), 12MP 5× tetraprism telephoto (f/2.8, up to 25× digital zoom). Display: 6.7" Super Retina XDR OLED, ProMotion 1–120Hz, 2796×1290 at 460ppi, Always-On. Battery: up to 29 hrs video. Storage options: 256GB / 512GB / 1TB. iOS 17. USB 3 speeds via USB-C.`,
    price: 1199.99, category: 'Smartphones', stock: 50,
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: `The Galaxy S24 Ultra is Samsung's most powerful phone ever, built for those who demand the absolute best. Processor: Snapdragon 8 Gen 3 for Galaxy. Camera quad system: 200MP main (f/1.7, OIS), 12MP ultra-wide (f/2.2), 10MP 3× telephoto (f/2.4), 50MP 5× telephoto (f/3.4) — up to 100× Space Zoom. Built-in titanium-framed S Pen with AI-powered note assistance. Display: 6.8" Dynamic AMOLED 2X, 1–120Hz, 3088×1440, 2600 nits peak brightness. Battery: 5000 mAh with 45W wired / 15W wireless. RAM: 12GB. Storage: 256GB / 512GB / 1TB.`,
    price: 1099.99, category: 'Smartphones', stock: 45,
  },
  {
    name: 'Google Pixel 8 Pro',
    description: `The Pixel 8 Pro is Google's most capable phone, powered by the Google Tensor G3 chip with integrated Titan M2 security co-processor. Camera: 50MP main (f/1.68, PDAF, OIS), 48MP ultra-wide (f/1.95, autofocus), 48MP 5× telephoto (f/2.8, OIS). AI features: Magic Eraser, Photo Unblur, Best Take, Audio Magic Eraser, Video Boost (8K). Display: 6.7" LTPO OLED, 1–120Hz, 2992×1344, 1600 nits (2400 peak). Battery: 5050 mAh, 30W wired / 23W wireless / 12W reverse wireless. 7 years of OS and security updates guaranteed. RAM: 12GB. Storage: 128GB / 256GB / 1TB.`,
    price: 799.99, category: 'Smartphones', stock: 35,
  },
  {
    name: 'OnePlus 12 256GB',
    description: `OnePlus 12 blends flagship performance with class-leading charging speed. Processor: Snapdragon 8 Gen 3 with up to 16GB LPDDR5X RAM. Charging: 100W SUPERVOOC wired (0–100% in 26 mins), 50W AIRVOOC wireless. Hasselblad-tuned triple camera: 50MP main (f/1.6, Sony LYT-808 sensor, OIS), 48MP ultra-wide (f/2.2, 114° FOV), 64MP 3× periscope telephoto (f/2.6). Display: 6.82" QHD+ LTPO AMOLED, 1–120Hz, 4500 nits peak, LTPO 4.0. Battery: 5400 mAh. Storage: 256GB / 512GB UFS 4.0. IP65 rated. OxygenOS 14 based on Android 14.`,
    price: 699.99, category: 'Smartphones', stock: 30,
  },
  {
    name: 'Xiaomi 14 Ultra',
    description: `The Xiaomi 14 Ultra is a photography powerhouse co-engineered with Leica. It features a professional quad-camera system: 50MP main with 1-inch Sony LYT-900 sensor (f/1.63–4.0 variable aperture, OIS), 50MP ultra-wide (f/1.8, 122° FOV), 50MP 3.2× mid-telephoto (f/1.8, OIS), 50MP 5× periscope telephoto (f/2.5, OIS). Processor: Snapdragon 8 Gen 3, 16GB LPDDR5X RAM, 512GB UFS 4.0. Charging: 90W HyperCharge wired, 80W wireless. Display: 6.73" AMOLED, 120Hz LTPO, 3200×1440. Battery: 5000 mAh. IP68 rated.`,
    price: 899.99, category: 'Smartphones', stock: 25,
  },

  // ── Fashion ──────────────────────────────────────────────────────────────
  {
    name: 'Classic Slim-Fit Chinos',
    description: `Crafted from 97% premium cotton and 3% elastane for the perfect blend of structure and comfort. These slim-fit chinos sit just below the natural waist with a tapered leg that ends cleanly at the ankle. Features: flat-front design, zip fly with single button fastening, two side pockets, two rear welt pockets, and belt loops. The mid-weight fabric (220gsm) resists creasing and holds its shape throughout the day. Available in Khaki, Navy, Olive, Stone, and Charcoal. Machine washable at 30°C. Inseam: 30" / 32". Size range: 28–40 waist.`,
    price: 59.99, category: 'Fashion', stock: 120,
  },
  {
    name: 'Oversized Graphic Hoodie',
    description: `Made from 380gsm 100% ring-spun cotton French terry fleece for a premium, heavyweight feel that softens with every wash. The relaxed oversized silhouette features dropped shoulders, a double-lined hood with flat drawcord, ribbed cuffs and hem, and a front kangaroo pocket. The vintage wash finish gives each piece a unique lived-in character. Unisex sizing — size down for a regular fit. Print: screen-printed with water-based inks for a soft, fade-resistant graphic. Care: machine wash cold, tumble dry low. Available in sizes XS–3XL.`,
    price: 49.99, category: 'Fashion', stock: 90,
  },
  {
    name: "Women's Wrap Midi Dress",
    description: `This elegant wrap midi dress is crafted from 100% LENZING™ ECOVERO™ viscose — a sustainably sourced fabric that is silky-soft, breathable, and drapes beautifully. The adjustable wrap front creates a flattering V-neckline and ties at the waist to define the silhouette. Design details: flutter sleeves, A-line midi skirt (falls mid-calf), side seam pockets, and an asymmetric hem. Available in Floral Print, Cobalt Blue, Burnt Terracotta, and Classic Black. Dry clean or gentle machine wash at 30°C. Sizes: XS–XL. Model height: 5'9", wearing size S.`,
    price: 64.99, category: 'Fashion', stock: 75,
  },
  {
    name: 'Linen Blazer (Unisex)',
    description: `A wardrobe staple reimagined in a premium 55% linen / 45% cotton blend that is lightweight, breathable, and gets better with age. The single-breasted silhouette features notched lapels, two front welt pockets, one chest pocket, a single back vent, and a partial canvas chest for shape retention without stiffness. Fully unlined for maximum breathability in warm weather. Available in Natural Beige, Slate Grey, Navy, and Sage Green. Dry clean or hand wash cold. Unisex cut — women's sizing runs one size smaller. Sizes: XS–XXL.`,
    price: 89.99, category: 'Fashion', stock: 55,
  },
  {
    name: 'Running Jogger Pants',
    description: `Engineered for performance, these joggers are made from 88% polyester / 12% elastane four-way stretch fabric with DryMove™ moisture-wicking technology that pulls sweat away from the skin during high-intensity workouts. Features: elasticated waistband with internal drawcord, two zippered side pockets, one zippered back pocket, tapered leg with ribbed cuffs, and reflective logo for low-light visibility. UPF 50+ sun protection. Machine washable at 40°C. Available in Black, Charcoal, Navy, and Forest Green. Sizes: XS–3XL. Inseam: 28" / 30" / 32".`,
    price: 44.99, category: 'Fashion', stock: 100,
  },

  // ── Furniture ────────────────────────────────────────────────────────────
  {
    name: 'Ergonomic Office Chair',
    description: `Designed with input from ergonomics specialists, this chair provides full-body support for long working sessions. Frame: heavy-duty aluminium base with 360° swivel and smooth-rolling PU casters suitable for hard floors and carpet. Seat: high-density moulded foam (4" thick), waterfall edge to reduce pressure on thighs. Back: breathable mesh with integrated lumbar support (height and firmness adjustable). Adjustments: seat height (45–57cm), 4D armrests (height, width, depth, angle), headrest (height and angle), recline tension, and forward tilt. Weight capacity: 150kg. Assembly time: ~20 mins. 5-year warranty on frame, 2-year on fabric.`,
    price: 349.99, category: 'Furniture', stock: 20,
  },
  {
    name: 'Solid Oak Dining Table',
    description: `Handcrafted from FSC-certified sustainably sourced solid European oak, this dining table is built to last generations. The natural variation in grain, knots, and colour makes each table unique. Construction: solid oak top (40mm thick) with mortise-and-tenon joinery for exceptional strength; four tapered solid oak legs with levelling glides for uneven floors. Finish: natural hard-wax oil that is food-safe, water-resistant, and easy to maintain. Dimensions: 180cm × 90cm × 76cm (seats 6–8). Weight: 65kg. Assembly required (20–30 mins). Matching bench available separately.`,
    price: 899.99, category: 'Furniture', stock: 8,
  },
  {
    name: 'L-Shaped Corner Desk',
    description: `This versatile L-shaped corner desk is ideal for home offices, gaming setups, or creative workspaces. Total workspace: 160cm × 120cm with a corner cutout. Features: 25mm thick engineered wood surface with scratch and water-resistant PVC edge banding, steel frame with adjustable levelling feet, built-in cable management tray underneath, 3-tier monitor riser shelf, and a mobile pedestal with one lockable drawer included. Height: 75cm (fixed). Colour: White with Chrome legs or Walnut with Black legs. Max load: 80kg. Flat-pack assembly — all tools included; assembly time approx. 40 mins.`,
    price: 249.99, category: 'Furniture', stock: 18,
  },
  {
    name: 'Velvet 3-Seater Sofa',
    description: `A statement piece for modern living rooms. The frame is constructed from kiln-dried solid hardwood with eight-way hand-tied spring suspension for lasting support and comfort. Upholstery: 100% polyester velvet in a 510gsm weight — sumptuous to the touch and highly durable (35,000 Martindale rub test). Features: deep button-tufted back cushions, high-density foam seat cushions (D28 density) with fibre topping, solid oak tapered legs in a natural finish, and removable/washable cushion covers. Available in: Emerald Green, Dusty Pink, Midnight Blue, Charcoal, Burnt Orange, and Cream. Dimensions: W220 × D90 × H85cm. Max load: 280kg.`,
    price: 699.99, category: 'Furniture', stock: 10,
  },
  {
    name: 'Floating Wall Shelves (5 pcs)',
    description: `Transform bare walls into stylish, functional displays with this set of 5 floating shelves in graduated lengths (20cm, 30cm, 40cm, 50cm, 60cm). Each shelf is crafted from 18mm MDF with a printed reclaimed-wood effect finish, protected by a hard lacquer top coat. Mounting: each shelf comes with concealed steel bracket(s) and all necessary fixings (wall plugs and screws for both plasterboard and masonry). Weight capacity: 15kg per shelf. Depth: 20cm. Thickness: 3cm. Installation marks are pre-drilled for perfect alignment. Available in 4 finishes: Rustic Oak, Light Walnut, Grey Wash, and White. Ships flat-packed.`,
    price: 79.99, category: 'Furniture', stock: 40,
  },

  // ── Cosmetics ────────────────────────────────────────────────────────────
  {
    name: 'Charlotte Tilbury Pillow Talk Lipstick',
    description: `Pillow Talk is Charlotte Tilbury's best-selling, universally flattering shade — a dreamy soft pink-nude with warm rose undertones that suits every skin tone. The Matte Revolution formula is enriched with Hyaluronic Acid Blur Complex for a plumping, blurring effect, and Pigment Intense Colour Deposit for rich, opaque colour in one swipe. Key benefits: weightless comfort, up to 8-hour wear, non-drying satin-matte finish, subtle rose-vanilla scent. Net weight: 3.5g. Free from: parabens, SLS, phthalates. Cruelty-free. Tip: line lips with Pillow Talk Lip Liner for a longer-lasting finish.`,
    price: 34.99, category: 'Cosmetics', stock: 150,
  },
  {
    name: 'NARS Radiant Creamy Concealer',
    description: `NARS Radiant Creamy Concealer is a cult-favourite multi-tasking formula that covers, corrects, and brightens in a single step. The buttery, blendable texture provides buildable medium-to-full coverage while the light-reflecting pigments create a naturally radiant finish — never cakey or creasing. Formulated with Vitamin C to brighten dark circles, hyaluronic acid to hydrate, and caffeine to reduce puffiness. Available in 30+ shades across fair, light, medium, and deep categories. Wear time: 16 hours. Free from: parabens, fragrance, alcohol. Dermatologist tested. Volume: 6ml. Apply with fingertip, sponge, or brush.`,
    price: 29.99, category: 'Cosmetics', stock: 130,
  },
  {
    name: 'Urban Decay Naked Eyeshadow Palette',
    description: `The original Naked palette — the one that started the neutral revolution. This iconic 12-pan palette contains a curated range of wearable, universally flattering shades that take you from a natural daytime look to a full-on smoky eye. Shades (left to right): Virgin (sheer champagne), Sin (rose shimmer), Naked (soft nude), Sidecar (taupe shimmer), Buck (warm brown matte), Half Baked (golden bronze), Smog (copper), Darkhorse (plum shimmer), Toasted (deep amber), Hustle (matte brown), Creep (matte black), Midnight Cowboy (black holo glitter). Formula: ultra-blendable, richly pigmented with a mix of matte, shimmer, and glitter finishes. Includes mini double-ended brush.`,
    price: 54.99, category: 'Cosmetics', stock: 70,
  },
  {
    name: 'Fenty Beauty Pro Filt\'r Foundation',
    description: `Rihanna's groundbreaking foundation launched with 40 shades and revolutionised the industry's approach to inclusivity. The soft-matte, skin-perfecting formula delivers buildable medium-to-full coverage that controls oil for up to 24 hours without settling into pores or fine lines. The lightweight, water-based formula contains hyaluronic acid for hydration and dimethicone for a smooth, poreless finish. Transfer-resistant. SPF 15 (US formula). Available in 50 shades across 6 undertone families (Y = yellow, N = neutral, W = warm, C = cool, R = red, P = peach). Volume: 32ml. Oil-free, non-comedogenic, fragrance-free.`,
    price: 39.99, category: 'Cosmetics', stock: 110,
  },
  {
    name: 'MAC Studio Fix Powder Plus Foundation',
    description: `MAC Studio Fix Powder Plus Foundation is a pressed powder and foundation in one — perfect for controlling shine and setting makeup for a smooth, matte finish that lasts all day. The finely milled formula blends seamlessly to provide medium-to-full buildable coverage. Enriched with SPF 15 and kaolin clay to absorb excess oil. Available in 40+ shades with warm, cool, and neutral undertones. Net weight: 15g. Includes applicator sponge. Suitable for all skin types, particularly ideal for oily and combination skin. Refillable compact. Free from: mineral oil, lanolin. Cruelty-free certified.`,
    price: 32.99, category: 'Cosmetics', stock: 90,
  },

  // ── Watches ──────────────────────────────────────────────────────────────
  {
    name: 'Seiko Presage Automatic',
    description: `The Seiko Presage line celebrates Japanese craftsmanship and artistry. This model is powered by the in-house Seiko 4R35 automatic movement (23 jewels, 21,600 vph, ±15 sec/day accuracy, 41-hour power reserve). Case: 40.5mm stainless steel with brushed and polished finishing. Crystal: domed Hardlex (mineral glass). Dial: hand-lacquered enamel with applied hour indices and Seiko's signature sword hands. Water resistance: 50m (5 ATM). Strap: genuine leather with deployment clasp. Lug width: 20mm. Features: date display at 3 o'clock, display case back to admire the movement. Certificate of guarantee included.`,
    price: 449.99, category: 'Watches', stock: 20,
  },
  {
    name: 'Casio G-Shock GA-2100',
    description: `The GA-2100 "CasiOak" combines G-Shock's legendary toughness with an octagonal bezel design inspired by luxury sports watches. Construction: Carbon Core Guard structure — a carbon fibre reinforced resin case that is both tough and lightweight. Shock resistant to MIL-STD-810G standard. Water resistant to 200m (20 ATM). Module: analogue-digital display with world time (31 time zones), stopwatch (1/100 sec, up to 24 hrs), countdown timer (24 hrs), 5 daily alarms, LED backlight with afterglow. Battery: CR2016 (approx. 3-year life). Case size: 48.5mm × 45.4mm × 11.8mm. Weight: 51g. Resin strap with standard buckle.`,
    price: 109.99, category: 'Watches', stock: 60,
  },
  {
    name: 'Apple Watch Series 9 (45mm)',
    description: `Apple Watch Series 9 is the most capable Apple Watch yet. Chip: all-new S9 SiP with 4-core Neural Engine for on-device Siri and faster performance. Display: Always-On Retina LTPO OLED, 2000 nits (2× brighter than Series 8). New: Double Tap gesture — pinch index finger and thumb to control the watch hands-free. Health sensors: electrical heart sensor (ECG), blood oxygen, temperature, crash detection, fall detection. Fitness: 80+ workout types, Advanced workout metrics. Navigation: GPS + GNSS. Water resistance: 50m. Battery: 18 hrs (up to 36 hrs in Low Power Mode). Connectivity: LTE & UMTS (GPS+Cellular model), Wi-Fi 6, Bluetooth 5.3, Ultra Wideband. Case: 45mm Starlight aluminium. Strap: Sport Band.`,
    price: 429.99, category: 'Watches', stock: 55,
  },
  {
    name: 'Fossil Gen 6 Smartwatch',
    description: `Fossil Gen 6 runs Wear OS 3 powered by Qualcomm Snapdragon Wear 4100+ — making it one of the fastest and most responsive smartwatches available. Specs: 44mm stainless steel case, 1.28" AMOLED display (326ppi, always-on), 8GB internal storage, 1GB RAM, heart rate monitor, SpO2 blood oxygen sensor, multi-day extended battery mode. Health features: 24/7 heart rate, sleep tracking, activity tracking (20+ modes), stress tracking via Heart Rate Variability. Connectivity: GPS, NFC for Google Pay, Bluetooth 5.0, Wi-Fi. Charge: proprietary magnetic charger (80% in 30 mins). Water resistant to 3 ATM. Works with Android & iOS.`,
    price: 199.99, category: 'Watches', stock: 35,
  },
  {
    name: 'Orient Bambino Open Heart',
    description: `The Orient Bambino Open Heart combines the elegance of a dress watch with the intrigue of a skeleton aperture that reveals the beating balance wheel of the movement. Movement: Orient F6724 calibre — 21-jewel Japanese automatic with manual winding and hacking, 40-hour power reserve, 21,600 vph frequency, ±10–15 sec/day accuracy. Case: 40.5mm stainless steel with brushed and polished facets. Crystal: Mineral glass. Dial: Open heart at 9 o'clock, Arabic numerals, dauphine hands in gold tone. Water resistance: 30m (3 ATM). Strap: genuine leather (20mm lug width) with deployant clasp. A refined choice for the entry-level mechanical watch enthusiast.`,
    price: 179.99, category: 'Watches', stock: 25,
  },

  // ── Accessories ──────────────────────────────────────────────────────────
  {
    name: 'Leather Bifold Wallet',
    description: `Handcrafted from full-grain vegetable-tanned leather sourced from tanneries in Leon, Mexico. Unlike chrome-tanned leather, vegetable tanning uses natural plant tannins that develop a rich patina over time — making this wallet uniquely yours the longer you use it. Construction: strong saddle-stitched seams (not glued), double-stitched edges for durability. Capacity: 8 card slots (4 per side), 2 full-length bill compartments, 1 ID window. RFID blocking lining (13.56 MHz) protects contactless cards. Slim profile: 3mm (empty), 8mm (loaded). Dimensions: 11.5 × 9 cm folded. Available in: Dark Brown, Tan, Black, and Cognac. Includes branded cotton dust bag.`,
    price: 49.99, category: 'Accessories', stock: 100,
  },
  {
    name: 'Canvas Backpack 25L',
    description: `A modern take on the classic rucksack, made from 18oz waxed cotton canvas that is water-resistant, rugged, and develops character over time. The wax coating can be re-applied to refresh water repellency. Features: padded laptop sleeve (fits up to 16" laptop), main compartment (25L capacity), front organiser pocket with key clip and card slots, two water bottle side pockets, padded back panel with air channels, ergonomic shoulder straps with sternum clip, solid brass YKK zippers throughout, and a top carry handle. Internal dimensions: 45 × 30 × 18cm. Weight: 900g. Available in: Waxed Olive, Waxed Tan, Waxed Navy, and Waxed Black.`,
    price: 89.99, category: 'Accessories', stock: 60,
  },
  {
    name: 'Polarised Aviator Sunglasses',
    description: `Classic aviator styling updated with modern optics and materials. Frame: lightweight, corrosion-resistant monel alloy with adjustable silicone nose pads for a secure, comfortable fit. Lenses: CR-39 optical-grade resin with TAC (Tri-Acetate Cellulose) polarising film — eliminates 99.9% of reflected glare from roads and water surfaces. UV protection: UV400 (blocks 100% of UVA and UVB up to 400nm wavelength). Lens size: 58mm. Bridge: 16mm. Temple: 135mm. Lens options: Classic G-15 Green, Blue Mirror, Brown, or Smoke. Includes: rigid clamshell case, microfibre cleaning cloth, lens cloth pouch, and authenticity card.`,
    price: 34.99, category: 'Accessories', stock: 80,
  },
  {
    name: 'Silk Pocket Square Set (3 pcs)',
    description: `Elevate any suit or blazer with this curated set of three handmade pocket squares in 100% Mulberry silk (19 momme weight). Momme weight refers to the density of the silk fabric — at 19mm, these squares have a satisfying weight and drape beautifully in any fold. Each square is hand-rolled and hand-stitched at the edges by artisans in Como, Italy. Set contents: (1) Classic White, (2) Navy with White Pin-dot, (3) Burgundy Paisley. Dimensions: 30 × 30cm each. Packaging: presented in an elegant gift box — ideal as a gift. Care: dry clean or hand wash in cold water, iron on low heat on reverse.`,
    price: 24.99, category: 'Accessories', stock: 120,
  },
  {
    name: 'Stainless Steel Ratchet Belt',
    description: `Say goodbye to holes with this precision ratchet belt system. The micro-adjustable zinc-alloy buckle clicks in 1/4-inch increments for a perfect fit every time — no more choosing between too tight or too loose. Strap: 35mm wide PU leather with a smooth matte finish and reinforced stitched edges. The strap can be cut to your exact waist size with scissors; instructions included. Buckle: brushed silver-tone finish, quick-release mechanism allows easy strap replacement. Total strap length: 130cm (fits waist sizes 28"–46"). Available in: Black, Dark Brown, and Tan strap with matching or contrasting buckle. Compatible with most 35mm belt loops.`,
    price: 29.99, category: 'Accessories', stock: 90,
  },

  // ── Daily Essentials ─────────────────────────────────────────────────────
  {
    name: 'Gillette Fusion5 Razor',
    description: `The Gillette Fusion5 delivers an exceptionally close, comfortable shave engineered with 5 anti-friction blades spaced closer together (vs. Mach3) to cut hair below the skin's surface with minimal pressure. Features: FlexBall technology — the handle pivots in response to facial contours so every blade stays in contact for a thorough shave; Precision Trimmer on back for styling sideburns, moustaches, and goatees; Lubrastrip with lubricants for skin comfort. This bundle includes: 1 Fusion5 FlexBall razor handle (weighted, balanced) + 8 Fusion5 replacement cartridges (4-week supply each). Cartridges are compatible with all Fusion5, ProGlide, and ProShield handles.`,
    price: 19.99, category: 'Daily Essentials', stock: 200,
  },
  {
    name: 'Colgate Max Fresh (3 Pack)',
    description: `Colgate Max Fresh toothpaste provides a triple-action fresh breath experience that lasts up to 5× longer than regular toothpaste (vs. fluoride toothpaste without breath-freshening technology). Formula: Sodium Fluoride 0.32% (w/w) for cavity protection and enamel strengthening; embedded micro-Active Fresh mini breath strips that dissolve on your tongue for intense freshness. Benefits: fights cavities, strengthens enamel, whitens teeth (removes surface stains), freshens breath 5× longer. Pack: 3 × 100ml tubes. Flavour: Cool Mint. Free from: SLS-free (no sulphates). Suitable for adults and children over 12. Use twice daily.`,
    price: 9.99, category: 'Daily Essentials', stock: 300,
  },
  {
    name: 'Dove Deep Moisture Body Wash',
    description: `Dove Deep Moisture is formulated with Dove's signature NutriumMoisture technology — a skin-natural nutrient blend that works with water to nourish skin during every shower, unlike soap which can strip natural moisture. The creamy, sulfate-free lather is gentle enough for daily use on sensitive skin. Key ingredients: glycerin, petrolatum, stearic acid, and dimethicone to lock in moisture for 24 hours after showering. Dermatologist recommended. Hypoallergenic and pH-balanced. 0% parabens, dyes, and phthalates. Volume: 500ml pump bottle. Suitable for face and body. Works with any shower tool or hands. Available in fragrance-free, cucumber, and shea butter variants.`,
    price: 7.99, category: 'Daily Essentials', stock: 250,
  },
  {
    name: 'Microfibre Bath Towel Set (4 pcs)',
    description: `This premium set includes 4 ultra-plush microfibre towels (2 bath towels + 2 hand towels) crafted from 600 GSM (grams per square metre) split microfibre yarn — making them significantly more absorbent and quicker-drying than conventional cotton towels. Key benefits: absorbs up to 7× its weight in water; dries 3× faster than cotton, preventing mildew; naturally anti-bacterial (tested to ISO 20743); ultra-soft and lint-free. Dimensions: Bath towels 70×140cm; Hand towels 40×70cm. Machine washable at 60°C. Tumble dry on low. Do not use fabric softener (reduces absorbency). Available in 8 colours. Weight per bath towel: 420g.`,
    price: 29.99, category: 'Daily Essentials', stock: 80,
  },
  {
    name: 'Reusable Grocery Bags (10 pk)',
    description: `This set of 10 eco-friendly reusable tote bags is the practical, planet-friendly alternative to single-use plastic bags. Each bag is made from 80gsm non-woven polypropylene — a recyclable material that is lightweight, durable, and water-resistant. Reinforced stitched handles (48cm long) comfortably fit over the shoulder. Dimensions: 38 × 42 × 10cm (flat) / 50L capacity. Weight per bag: 40g. Folds flat into itself for compact storage. Max load: 20kg per bag. 10-bag pack replaces hundreds of plastic bags per year. Machine washable. BPA-free, food-safe. Available in Mixed Colours or single colour packs (Red, Navy, Green, Black).`,
    price: 14.99, category: 'Daily Essentials', stock: 180,
  },

  // ── Home & Kitchen ────────────────────────────────────────────────────────
  {
    name: 'Instant Pot Duo 7-in-1 (6 Qt)',
    description: `The Instant Pot Duo 7-in-1 is the world's best-selling multi-cooker — replacing 7 kitchen appliances in one compact unit. Functions: pressure cooker (up to 70% faster cooking), slow cooker (3 heat settings), rice cooker, steamer, sauté/browning pan, yoghurt maker, and keep warm. Capacity: 6 quart (5.7L), suitable for 6–8 people. Safety: 10 safety features including lid lock detection, anti-blockage vent, steam release valve. Features: 13 one-touch smart programs (soup, meat, bean, poultry, egg, cake, rice, multigrain, steam, slow cook, sauté, yoghurt, sterilise), delay start, keep warm up to 99 hours. Stainless steel inner pot (dishwasher-safe). Power: 1000W. Weight: 5.4kg.`,
    price: 89.99, category: 'Home & Kitchen', stock: 40,
  },
  {
    name: 'Ninja Air Fryer XL (5.5L)',
    description: `The Ninja Air Fryer XL uses Max Crisp Technology — a 215°C (420°F) super-heated air system with a high-density mesh basket that circulates air around food for an even, golden crisp with up to 75% less fat than traditional frying. Functions: Air Fry, Max Crisp (frozen foods), Roast, Reheat, and Dehydrate. Capacity: 5.5L basket (serves 4–6 people). Power: 2500W for rapid preheating (no preheat required in most cases). Basket and crisper plate are dishwasher-safe, non-stick, and PTFE/PFOA-free. Digital display with time and temperature controls. Temperature range: 40–215°C. Timer: up to 60 minutes. Dimensions: 35 × 27 × 31cm. Weight: 4.8kg.`,
    price: 119.99, category: 'Home & Kitchen', stock: 35,
  },
  {
    name: 'KitchenAid Stand Mixer (5 Qt)',
    description: `The iconic KitchenAid Artisan Stand Mixer has been a kitchen mainstay since 1937 and remains the gold standard for home bakers. Motor: 325W DC motor with electronic speed control maintains optimal mixing speed regardless of load. Bowl: 4.8L (5 Qt) stainless steel tilt-head bowl with handle. Mixing action: 59-point planetary mixing ensures the attachment reaches every part of the bowl. Speeds: 10 settings from stir to high. Attachments included: flat beater, dough hook, wire whip, and pouring shield. Hub: power hub for 15+ optional attachments (pasta maker, grain mill, blender, ice cream maker — sold separately). Height: 36cm. Weight: 10kg. Available in 20+ colours.`,
    price: 349.99, category: 'Home & Kitchen', stock: 15,
  },
  {
    name: 'Non-Stick Cookware Set (10 pc)',
    description: `This professional-grade 10-piece cookware set is constructed from hard-anodised aluminium — a process that makes the aluminium twice as hard as stainless steel and completely non-reactive. The multi-layer PTFE non-stick coating is 100% PFOA-free and has been tested to 100,000 abrasion cycles for exceptional durability. Set includes: 16cm saucepan with lid, 20cm saucepan with lid, 28cm frying pan, 30cm sauté pan with lid, 28cm wok, 20cm steamer insert, and a silicone trivet. Oven-safe to 260°C (without lid). Compatible with gas, electric, ceramic, and induction hobs. Rivetless, smooth interior for easy cleaning. Dishwasher-safe. Tempered glass lids for visibility. Stay-cool silicone handles.`,
    price: 149.99, category: 'Home & Kitchen', stock: 25,
  },
  {
    name: 'Nespresso Vertuo Next Coffee Machine',
    description: `The Nespresso Vertuo Next is designed to brew barista-quality coffee at home across 5 cup sizes at the touch of a button. Centrifusion technology: each pod spins at up to 7,000 RPM while hot water is infused through it — the barcode on every pod is read by the machine to automatically set the exact brewing parameters (size, temperature, intensity) for a perfect result every time. Cup sizes: Espresso (40ml), Double Espresso (80ml), Gran Lungo (150ml), Coffee (230ml), Alto (414ml). Milk frother: Aeroccino 3 electric frother included (creates cold or hot froth). Water tank: 1.1L. Power: 1500W. Heat up time: 25 sec. Energy saving mode: auto off after 2 mins.`,
    price: 159.99, category: 'Home & Kitchen', stock: 30,
  },

  // ── Sports ────────────────────────────────────────────────────────────────
  {
    name: 'Adjustable Dumbbell Set',
    description: `Replace an entire rack of weights with a single pair of Bowflex SelectTech-style adjustable dumbbells. The innovative dial system lets you select your weight in seconds — simply turn the dial at each end of the dumbbell to choose from 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 40, 45, or 52.5 lbs. The weight increments allow progressive overloading for strength training, HIIT, and rehabilitation exercises. Construction: durable ABS plastic housing around steel weight plates with a solid metal handle (27mm diameter, medium knurling). Dimensions per dumbbell: 43cm × 20cm × 20cm. Weight range per dumbbell: 2.3–23.8kg. Storage trays included.`,
    price: 299.99, category: 'Sports', stock: 20,
  },
  {
    name: 'Yoga Mat with Alignment Lines',
    description: `Designed for practitioners of all levels, this premium yoga mat is made from eco-friendly TPE (Thermoplastic Elastomer) — a recyclable, non-toxic alternative to PVC that is free from latex, PVC, and heavy metals. Features: printed alignment lines and pose guides for correct body positioning, dual-layer non-slip texture (top: open-cell grip surface; bottom: closed-cell anti-slip base), 6mm thickness for ideal joint cushioning and stability balance. Dimensions: 183 × 61cm. Weight: 1.1kg. Moisture-resistant and easy to wipe clean with a damp cloth. Includes carry strap with secure buckle. Available in 8 colours. Rolled dimensions: 61cm × 15cm diameter.`,
    price: 39.99, category: 'Sports', stock: 70,
  },
  {
    name: 'Resistance Bands Set (5 levels)',
    description: `A complete resistance training system that fits in a gym bag. The set of 5 premium natural latex bands provides progressive resistance for strength training, physiotherapy, yoga, pilates, and warm-ups. Band resistances: Yellow (2–4.5kg / 10lb light), Red (4.5–9kg / 20lb medium), Black (9–18kg / 30lb heavy), Purple (18–27kg / 40lb extra heavy), Green (27–36kg / 50lb super heavy). Features: non-snap anti-snap double-latex construction, odour-resistant, anti-slip texture. Each band: 208cm × 4.5cm loop. Included: 2 foam-padded door anchors, 2 foam handles, 2 ankle straps, and a zippered carry bag. Suitable for: pull-up assist, deadlifts, squats, chest press, rows, stretching.`,
    price: 24.99, category: 'Sports', stock: 100,
  },
  {
    name: 'Nike Air Zoom Pegasus 40',
    description: `The Nike Air Zoom Pegasus 40 is the 40th iteration of Nike's iconic everyday trainer — trusted by millions of runners worldwide for its reliable cushioning and versatility. Upper: engineered mesh with targeted support zones for a breathable, sock-like fit. Midsole: full-length Nike React foam for a soft landing with snappy energy return, plus a forefoot Air Zoom unit for responsive toe-off. Outsole: durable rubber with waffle pattern for multi-surface traction. Drop: 10mm. Stack height: 28mm (heel) / 18mm (forefoot). Weight: 283g (US M9). Recommended for: daily training runs, easy recovery runs, 5K–marathon racing for non-elite runners. Available in Unisex, Men's, and Women's sizing.`,
    price: 129.99, category: 'Sports', stock: 55,
  },

  // ── Beauty ────────────────────────────────────────────────────────────────
  {
    name: 'CeraVe Moisturising Cream',
    description: `Developed with dermatologists, CeraVe Moisturising Cream is the #1 dermatologist-recommended moisturiser brand in the US. The formula contains three essential ceramides (1, 3, 6-II) which are naturally occurring lipids that make up 50% of the skin's barrier — replenishing these helps restore and maintain the skin's protective function. Also contains hyaluronic acid (draws moisture into the skin), niacinamide (soothes skin), and petrolatum (seals in moisture). Key features: MVE (MultiVesicular Emulsion) Delivery Technology releases moisturising ingredients throughout the day. Non-comedogenic (won't clog pores). Fragrance-free, paraben-free, allergy-tested. Volume: 250ml. Suitable for dry to very dry skin, eczema-prone skin. Face and body use.`,
    price: 16.99, category: 'Beauty', stock: 180,
  },
  {
    name: 'The Ordinary Niacinamide 10% + Zinc 1%',
    description: `The Ordinary Niacinamide 10% + Zinc 1% is one of the brand's most popular formulas — a concentrated serum targeting blemishes, enlarged pores, and excess oil production. Niacinamide (Vitamin B3) at 10% concentration reduces the appearance of skin blemishes and congestion, regulates sebum (oil) production, brightens skin tone, and strengthens the skin barrier over time. Zinc PCA at 1% works synergistically with niacinamide to balance sebum and reduce inflammation. Water-based formula suitable for layering with most other serums and moisturisers. Apply morning and evening before heavier creams. Volume: 30ml. Free from: alcohol, silicone, nut oils, vegan, cruelty-free. Suitable for oily and acne-prone skin.`,
    price: 8.99, category: 'Beauty', stock: 200,
  },
  {
    name: 'Dyson Airwrap Styler (Complete)',
    description: `The Dyson Airwrap is a revolutionary hair styling tool that styles without extreme heat — protecting hair from heat damage while delivering salon-quality results. The Coanda effect (the same aerodynamic principle used in aviation) attracts and wraps hair around the barrel automatically, eliminating the need for clumsy wrapping techniques. The intelligent heat control measures air temperature over 40 times per second to ensure it never exceeds 150°C. Complete set includes: 2× 40mm auto-wrap curl barrels (clockwise and counter-clockwise), 2× 30mm Coanda smoothing dryer, firm smoothing brush, soft smoothing brush, pre-styling dryer, round volumising brush, flyaway attachment, and storage case. Suitable for: all hair types from fine to thick. Motor: Dyson digital motor V9. Voltage: 220–240V.`,
    price: 549.99, category: 'Beauty', stock: 18,
  },
  {
    name: 'Neutrogena Hydro Boost Water Gel',
    description: `Neutrogena Hydro Boost Water Gel is an oil-free, non-comedogenic moisturiser clinically proven to provide 72-hour hydration. Formulated with hyaluronic acid — a molecule that holds up to 1,000× its weight in water — in a unique triple-action formula: (1) attracts water from the environment into the skin, (2) holds it there throughout the day, (3) prevents it from evaporating (moisture reservoir). The ultra-light gel texture absorbs instantly without leaving a greasy residue, making it ideal as a base under makeup. Fragrance-free, dye-free, non-acnegenic. Dermatologist-tested. Volume: 50ml. Suitable for all skin types; especially ideal for oily and combination skin. Use morning and evening on clean skin.`,
    price: 18.99, category: 'Beauty', stock: 140,
  },

  // ── Groceries ─────────────────────────────────────────────────────────────
  {
    name: 'Organic Extra Virgin Olive Oil',
    description: `Single-origin, cold-pressed extra virgin olive oil from organic Picual and Arbequina olive groves in Andalucía, Spain. Cold-pressed means the oil is extracted at below 27°C without heat or chemicals, preserving maximum polyphenols, antioxidants, and the characteristic fruity, peppery flavour. Certified organic (EU Organic certification), PDO (Protected Designation of Origin), and Non-GMO. Acidity: < 0.3% (well below the 0.8% maximum for EVOO classification). Polyphenol content: > 500mg/kg (high polyphenol, associated with numerous health benefits). Best uses: salad dressings, dipping, drizzling over finished dishes, and low-heat sautéing. Harvest: October. Best before: 24 months from bottling. Volume: 1L dark glass bottle (preserves freshness).`,
    price: 14.99, category: 'Groceries', stock: 150,
  },
  {
    name: 'Manuka Honey MGO 400+ (500g)',
    description: `Genuine New Zealand Manuka honey certified to MGO 400+ (Methylglyoxal — the unique compound responsible for Manuka's antibacterial properties). MGO 400+ is the threshold recommended for daily wellness use. Sourced exclusively from the remote wilderness of New Zealand's South Island where Leptospermum scoparium (Manuka) shrubs grow wild and free from agricultural pollution. Independently lab-tested by AsureQuality NZ for MGO content, purity, and absence of antibiotic residues. UMF (Unique Manuka Factor) certified: UMF 13+. Raw and unfiltered (not heated above 40°C to preserve enzymes, pollen, and propolis). Kosher and Halal certified. Volume: 500g glass jar. Best before: 2 years from packaging date.`,
    price: 39.99, category: 'Groceries', stock: 80,
  },
  {
    name: 'Organic Quinoa Grain (2kg)',
    description: `Organic white quinoa (Chenopodium quinoa) sourced directly from smallholder farming cooperatives in the Bolivian Altiplano — the ancestral home of quinoa cultivation. Pre-washed to remove natural saponins (the bitter coating) so no further rinsing is required before cooking. Nutritional profile per 100g dry: 14.1g protein (a complete protein containing all 9 essential amino acids), 6.1g fat, 64.2g carbohydrates, 7g dietary fibre, 64mg magnesium, 457mg phosphorus. Certified organic (EU and USDA), non-GMO, gluten-free (tested to < 20ppm), and vegan. Cook ratio: 1 part quinoa to 2 parts water; simmer 15 mins. Weight: 2kg resealable kraft bag. Store in a cool, dry place.`,
    price: 12.99, category: 'Groceries', stock: 120,
  },
  {
    name: 'Mixed Nuts & Dried Fruits 1kg',
    description: `A premium blend of 6 whole, natural nuts and 2 dried fruits — no added salt, sugar, oil, or preservatives. Blend composition: Whole Almonds (25%), Cashew Halves & Pieces (20%), Walnut Halves (20%), Brazil Nuts (10%), Pecans (10%), Macadamia Nuts (5%), Raisins (5%), Cranberries (5%). Sourced from certified farms: California almonds, Vietnamese cashews, Chilean walnuts, Bolivian Brazil nuts. Nutritional highlights per 30g serving: 180 kcal, 5g protein, 15g healthy fats (80% unsaturated), 2g fibre. Allergen: Contains tree nuts. May contain traces of peanuts. Suitable for: keto, paleo, vegan, and gluten-free diets. Packaging: 1kg resealable ziplock bag. Best before: 6 months.`,
    price: 19.99, category: 'Groceries', stock: 100,
  },
  {
    name: 'Arabica Ground Coffee (500g)',
    description: `100% single-origin Colombian Arabica coffee, sourced from the Huila and Nariño regions — recognised globally for producing some of the world's finest coffee due to their high altitude (1,500–2,200m above sea level), volcanic soil, and ideal climate. Roast: medium (City+ roast) to preserve the origin's natural sweetness while developing depth. Flavour notes: dark chocolate, caramel, brown sugar, and a bright citrus finish. Grind: medium (suitable for drip, Aeropress, Chemex, and Moka pot). Processing: washed (wet-processed) for clarity and consistency. Roast date: printed on bag — roasted fresh before shipping. Packaging: 500g resealable valve bag (one-way degassing valve keeps coffee fresh). Best within 3 months of roast date.`,
    price: 13.99, category: 'Groceries', stock: 160,
  },
];

// ── main ──────────────────────────────────────────────────────────────────────

async function seedProducts() {
  await mongoose.connect(MONGODB_URI);
  console.log('✔  Connected to MongoDB\n');

  // Pre-fetch all thumbnails grouped by category to avoid per-product delays
  console.log('Fetching product thumbnails from DummyJSON...\n');
  const uniqueCategories = [...new Set(PRODUCTS.map((p) => p.category))];
  for (const cat of uniqueCategories) {
    await pickThumbnail(cat); // warms the cache
  }
  console.log('');

  let created = 0, skipped = 0;

  for (const p of PRODUCTS) {
    const exists = await ProductModel.findOne({ name: p.name });
    if (exists) {
      console.log(`  ⏭  ${p.name}`);
      skipped++;
      continue;
    }

    const image = await pickThumbnail(p.category);
    await ProductModel.create({ ...p, image });
    console.log(`  ✓  ${p.name}  →  ${image ?? 'no image'}`);
    created++;
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`✔  Done — ${created} created, ${skipped} skipped`);
  await mongoose.disconnect();
}

seedProducts().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
