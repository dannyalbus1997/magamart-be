import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/magamart';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true },
);

const UserModel = mongoose.model('User', UserSchema);

async function seedAdmin() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const adminEmail = 'admin@magamart.com';
  const existing = await UserModel.findOne({ email: adminEmail });

  if (existing) {
    console.log('Admin account already exists. Skipping.');
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  await UserModel.create({
    email: adminEmail,
    password: hashedPassword,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'admin',
  });

  console.log('Admin user created:');
  console.log('  Email:    admin@magamart.com');
  console.log('  Password: Admin@123');

  await mongoose.disconnect();
  console.log('Done.');
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
