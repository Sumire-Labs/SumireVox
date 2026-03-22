import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings } from './guild-settings-service.js';

/**
 * ユーザーがサーバーの管理者権限を持っているかを判定する
 * ManageGuild 権限、または adminRoleId に設定されたロールを持っている場合 true
 */
export async function hasAdminPermission(member: GuildMember, guildId: string): Promise<boolean> {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const settings = await getGuildSettings(guildId);
  if (settings.adminRoleId && member.roles.cache.has(settings.adminRoleId)) {
    return true;
  }

  return false;
}

/**
 * ユーザーがサーバー辞書の追加権限を持っているかを判定する
 */
export async function hasDictionaryAddPermission(
  member: GuildMember,
  guildId: string,
): Promise<boolean> {
  const settings = await getGuildSettings(guildId);
  if (settings.dictionaryPermission === 'everyone') {
    return true;
  }
  return hasAdminPermission(member, guildId);
}
