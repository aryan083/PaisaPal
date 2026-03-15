import mongoose from 'mongoose';
import Envelope from '../models/Envelope';
import Transaction from '../models/Transaction';

function getMonthKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
}

function toIstDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getEnvelopeStatus(spent: number, limit: number, threshold: number): 'under' | 'warning' | 'over' {
  if (limit <= 0) return 'under';
  const pct = (spent / limit) * 100;
  if (pct > 100) return 'over';
  if (pct >= threshold) return 'warning';
  return 'under';
}

export async function syncEnvelopeForTransaction(
  userId: string,
  date: Date,
  category: string,
  warningThreshold: number,
): Promise<void> {
  const month = getMonthKey(date);
  const userObjId = new mongoose.Types.ObjectId(userId);

  const envelope = await Envelope.findOne({ userId: userObjId, month });
  if (!envelope) return;

  const startKey = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0, 0, 0, 0));
  const endKey = toIstDateKey(end);

  const [agg] = await Transaction.aggregate<{ total: number }>([
    {
      $match: {
        userId: userObjId,
        category,
        dateKey: { $gte: startKey, $lte: endKey },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
    { $project: { _id: 0, total: 1 } },
  ]);

  const spent = agg?.total ?? 0;

  const idx = envelope.envelopes.findIndex((e) => e.category === category);
  if (idx < 0) return;

  const limit = envelope.envelopes[idx]!.limit;
  envelope.envelopes[idx]!.spent = spent;
  envelope.envelopes[idx]!.status = getEnvelopeStatus(spent, limit, warningThreshold);

  await envelope.save();
}
