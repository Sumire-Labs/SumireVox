import { Prisma } from '@prisma/client';
import { logger } from '../infrastructure/logger.js';

interface BoostRecord {
  id: string;
  guildId: string | null;
  assignedAt: Date | null;
}

/**
 * サブスクリプションの boost 枠数を targetCount に合わせて減らす。
 * 優先順:
 *   1. 未割り当て (guildId = null) を削除
 *   2. それでも超過する場合、assignedAt が古い順に強制解除してから削除
 *
 * 増加処理はこの関数の責務外（呼び出し元で createMany する）。
 */
export async function adjustBoostSlots(
  tx: Prisma.TransactionClient,
  subscriptionId: string,
  targetCount: number,
  currentBoosts: BoostRecord[],
): Promise<void> {
  const currentCount = currentBoosts.length;
  if (targetCount >= currentCount) return;

  const toRemove = currentCount - targetCount;
  const unassigned = currentBoosts.filter((b) => !b.guildId);

  // Step 1: 未割り当て boost を削除
  const unassignedToDelete = unassigned.slice(0, toRemove);
  if (unassignedToDelete.length > 0) {
    await tx.boost.deleteMany({ where: { id: { in: unassignedToDelete.map((b) => b.id) } } });
  }

  const stillToRemove = toRemove - unassignedToDelete.length;
  if (stillToRemove <= 0) return;

  // Step 2: 割り当て済み boost を assignedAt 昇順（古い順）で強制解除して削除
  const assigned = currentBoosts
    .filter((b) => b.guildId !== null)
    .sort((a, b) => (a.assignedAt?.getTime() ?? 0) - (b.assignedAt?.getTime() ?? 0));

  const assignedToRemove = assigned.slice(0, stillToRemove);

  // ギルドごとに何件解除するかをログ出力
  const byGuild = new Map<string, number>();
  for (const b of assignedToRemove) {
    if (b.guildId) byGuild.set(b.guildId, (byGuild.get(b.guildId) ?? 0) + 1);
  }
  for (const [guildId, count] of byGuild) {
    logger.info(
      { subscriptionId, guildId, count },
      'Boost slots force-unassigned due to subscription quantity decrease',
    );
  }

  const revokedAt = new Date();
  if (assignedToRemove.length > 0) {
    await tx.boostRevocation.createMany({
      data: assignedToRemove.map((boost) => ({
        boostId: boost.id,
        subscriptionId,
        guildId: boost.guildId,
        assignedAt: boost.assignedAt,
        revokedAt,
        reason: 'SUBSCRIPTION_QUANTITY_DECREASE',
      })),
    });
  }

  await tx.boost.deleteMany({ where: { id: { in: assignedToRemove.map((b) => b.id) } } });
}
