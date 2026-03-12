import dotenv from 'dotenv';
import fs from 'node:fs';
import mongoose from 'mongoose';
import path from 'node:path';

import Transaction from '../src/models/Transaction';
import Settings from '../src/models/Settings';

const appEnv = process.env.APP_ENV ?? 'development';
const configPath = path.resolve(process.cwd(), 'configs', 'envs', `.env.${appEnv}.config`);
const legacyPath = path.resolve(process.cwd(), `.env.${appEnv}`);

if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
} else if (fs.existsSync(legacyPath)) {
  dotenv.config({ path: legacyPath });
} else {
  dotenv.config();
}

type SeedTransaction = {
  date: Date;
  particulars: string;
  amount: number;
  category:
    | 'Rapido'
    | 'Bus/GSRTC'
    | 'Food & Drinks'
    | 'Shopping'
    | 'Social'
    | 'Recharge/Bills'
    | 'Self Care'
    | 'Transfer/Sent'
    | 'Other';
  mode: 'Online' | 'Cash';
  notes?: string;
};

const seedTransactions: SeedTransaction[] = [
  {
    date: new Date('2025-12-30'),
    particulars: 'Rajkot to Ahmedabad - GSRTC Volvo',
    amount: 0,
    category: 'Bus/GSRTC',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-01'),
    particulars: 'iPhone Case',
    amount: 161,
    category: 'Shopping',
    mode: 'Online',
    notes: 'Paid to Flipkart',
  },
  {
    date: new Date('2026-03-02'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 41,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-02'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 59,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-03'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 34,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-03'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 59,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-05'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 41,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-05'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 50,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-05'),
    particulars: 'Soap + Bhakarvadi snack',
    amount: 85,
    category: 'Self Care',
    mode: 'Online',
    notes: 'Self care? Hell na',
  },
  {
    date: new Date('2026-03-06'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 34,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-06'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 41,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-07'),
    particulars: 'Sugar Cane Juice',
    amount: 160,
    category: 'Food & Drinks',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-07'),
    particulars: 'Bus: Ahmedabad to Rajkot',
    amount: 208,
    category: 'Bus/GSRTC',
    mode: 'Online',
    notes: 'Paid to Umang',
  },
  {
    date: new Date('2026-03-07'),
    particulars: 'Rapido: Home to Marwadi',
    amount: 116,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-07'),
    particulars: 'Lunch: 2 Dhokla + Hide n Seek',
    amount: 90,
    category: 'Food & Drinks',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-07'),
    particulars: 'Farewell',
    amount: 580,
    category: 'Social',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-08'),
    particulars: 'Recharge 49',
    amount: 49,
    category: 'Recharge/Bills',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-08'),
    particulars: 'Bus: Rajkot to Ahmedabad',
    amount: 208,
    category: 'Bus/GSRTC',
    mode: 'Online',
    notes: 'Paid to Ritesh',
  },
  {
    date: new Date('2026-03-24'),
    particulars: 'Flipkart: DualShock Controller',
    amount: 895,
    category: 'Shopping',
    mode: 'Online',
    notes: 'ETA 24-Mar',
  },
  {
    date: new Date('2026-03-09'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 41,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-09'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 67,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-09'),
    particulars: 'Xerox + Glue + Nail Cutter',
    amount: 92,
    category: 'Shopping',
    mode: 'Cash',
  },
  {
    date: new Date('2026-03-08'),
    particulars: 'Sprite + Fanta',
    amount: 80,
    category: 'Food & Drinks',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-10'),
    particulars: 'Rapido: Home Haven to KP Epitome',
    amount: 34,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-10'),
    particulars: 'Rapido: KP Epitome to Home Haven',
    amount: 41,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-10'),
    particulars: 'Send to Adii',
    amount: 100,
    category: 'Transfer/Sent',
    mode: 'Online',
  },
    {
    date: new Date('2026-03-11'),
    particulars: 'Rapido: Home Haven to K P Epitome',
    amount: 34,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-11'),
    particulars: 'Rapido: K P Epitome to Home Haven',
    amount: 59,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-11'),
    particulars: 'Ice cream:chocolate 120Ml',
    amount: 70,
    category: 'Food & Drinks',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-12'),
    particulars: 'Rapido: Home Haven to K P Epitome',
    amount: 40,
    category: 'Rapido',
    mode: 'Online',
  },
  {
    date: new Date('2026-03-12'),
    particulars: 'Rapido: K P Epitome to Home Haven',
    amount: 40,
    category: 'Rapido',
    mode: 'Online',
  }
];

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  await Transaction.collection.drop().catch(() => undefined);
  await Settings.collection.drop().catch(() => undefined);

  await Settings.create({ _id: 'default', stipend: 12000, extra: 0 });
  await Transaction.insertMany(seedTransactions);

  console.log('Seed completed');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
