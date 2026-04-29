import mongoose from 'mongoose';
import Settings from '../models/Settings';
import SavingsGoal from '../models/SavingsGoal';
import SavingsContribution from '../models/SavingsContribution';

export async function applyRapidoTaxContribution(input: {
  userId: string;
  amount: number;
  transactionId: string;
}): Promise<void> {
  const userObjId = new mongoose.Types.ObjectId(input.userId);

  const settings = await Settings.findOne({ userId: userObjId }).lean();
  if (!settings?.rapidoTaxEnabled) return;

  const pct = typeof settings.rapidoTaxPercent === 'number' ? settings.rapidoTaxPercent : 10;
  const taxAmount = Math.round((input.amount * pct) / 100);
  if (taxAmount <= 0) return;

  const goalId = settings.primarySavingsGoalId
    ? new mongoose.Types.ObjectId(settings.primarySavingsGoalId)
    : (await SavingsGoal.findOne({ userId: userObjId, status: 'active' }).select('_id').lean())?._id;

  if (!goalId) return;

  const goal = await SavingsGoal.findOne({ _id: goalId, userId: userObjId, status: { $ne: 'ended' } });
  if (!goal) return;

  goal.savedAmount += taxAmount;
  if (goal.savedAmount >= goal.targetAmount) {
    goal.status = 'completed';
  }

  await Promise.all([
    goal.save(),
    SavingsContribution.create({
      userId: userObjId,
      goalId: goal._id,
      amount: taxAmount,
      type: 'rapido_tax',
      transactionId: new mongoose.Types.ObjectId(input.transactionId),
    }),
  ]);
}
