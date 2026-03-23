import { getPrisma } from '../infrastructure/database.js';
import { getGuildSettings } from './guild-settings-service.js';

/**
 * サーバーが PREMIUM かどうかを判定する
 * manualPremium が true、または有効なブーストが1つ以上ある場合に PREMIUM
 */
export async function isGuildPremium(guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);

  if (settings.manualPremium) return true;

  const prisma = getPrisma();
  const activeBoost = await prisma.boost.findFirst({
    where: {
      guildId,
      subscription: {
        status: 'ACTIVE',
      },
    },
  });

  return activeBoost !== null;
}
