import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/magamart';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const CategoryModel = mongoose.model('Category', CategorySchema);

const CATEGORIES = [
  { name: 'Electronics', description: 'Electronic devices and gadgets' },
  { name: 'Smartphones', description: 'Mobile phones and accessories' },
  { name: 'Fashion', description: 'Clothing, footwear and apparel' },
  { name: 'Furniture', description: 'Home and office furniture' },
  { name: 'Cosmetics', description: 'Beauty and personal care products' },
  { name: 'Watches', description: 'Wrist watches and timepieces' },
  { name: 'Accessories', description: 'Fashion and lifestyle accessories' },
  { name: 'Daily Essentials', description: 'Everyday household essentials' },
  { name: 'Home & Kitchen', description: 'Home appliances and kitchenware' },
  { name: 'Sports', description: 'Sports equipment and activewear' },
  { name: 'Beauty', description: 'Skincare, haircare and beauty tools' },
  { name: 'Groceries', description: 'Fresh produce and packaged food' },
];

async function seedCategories() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  let created = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const exists = await CategoryModel.findOne({ name: cat.name });
    if (exists) {
      console.log(`  Skipped (exists): ${cat.name}`);
      skipped++;
    } else {
      await CategoryModel.create(cat);
      console.log(`  Created: ${cat.name}`);
      created++;
    }
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seedCategories().catch((err) => {
  console.error(err);
  process.exit(1);
});
