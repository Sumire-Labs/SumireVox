import { GuildSettings } from '@sumirevox/shared';
import { Guild } from 'discord.js';
import { TrieNode } from './trie.js';

/**
 * パイプラインステップに渡されるコンテキスト
 */
export interface PipelineContext {
  /** サーバー設定 */
  guildSettings: GuildSettings;
  /** Discord ギルド（メンション解決用） */
  guild: Guild;
  /** 元のメッセージの reference（リプライ判定用） */
  hasReference: boolean;
  /** 元のメッセージの mentions（リプライメンション除去用） */
  repliedUserId: string | null;
  /** 辞書変換用のトライ木（マージ済み） */
  dictionaryTrie: TrieNode | null;
}

/**
 * パイプラインステップの関数型
 * テキストを受け取り、変換後のテキストを返す
 */
export type PipelineStep = (text: string, context: PipelineContext) => string;
