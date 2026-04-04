import { z } from 'zod';

export const discordSnowflakeSchema = z.string().regex(/^\d+$/, '数字文字列の Discord Snowflake を指定してください。');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。').default(1),
  perPage: z.coerce
    .number()
    .int('整数で指定してください。')
    .min(1, '1以上で指定してください。')
    .max(100, '100以下で指定してください。')
    .default(20),
});

export const guildSettingsUpdateSchema = z
  .object({
    maxReadLength: z
      .number()
      .int('整数で指定してください。')
      .min(1, '1以上で指定してください。')
      .max(500, '500以下で指定してください。')
      .optional(),
    readUsername: z.boolean().optional(),
    addSanSuffix: z.boolean().optional(),
    romajiReading: z.boolean().optional(),
    uppercaseReading: z.boolean().optional(),
    joinLeaveNotification: z.boolean().optional(),
    greetingOnJoin: z.boolean().optional(),
    customEmojiHandling: z.enum(['read_name', 'remove']).optional(),
    readTargetType: z.enum(['text_only', 'text_and_sticker', 'text_sticker_and_attachment']).optional(),
    defaultTextChannelId: discordSnowflakeSchema.nullable().optional(),
    defaultSpeakerId: z.number().int('整数で指定してください。').min(0, '0以上で指定してください。').nullable().optional(),
    adminRoleId: discordSnowflakeSchema.nullable().optional(),
    dictionaryPermission: z.enum(['everyone', 'admin_only']).optional(),
  })
  .strict();

export const instanceParamsSchema = z.object({
  guildId: discordSnowflakeSchema,
  instanceId: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。'),
});

export const guildBotInstanceSettingsBodySchema = z
  .object({
    autoJoin: z.boolean().optional(),
    textChannelId: z.string().nullable().optional(),
    voiceChannelId: z.string().nullable().optional(),
  })
  .strict();
