import { TrieNode, buildMergedTrie } from './trie.js';
import { getPrisma } from '../../infrastructure/database.js';
import { logger } from '../../infrastructure/logger.js';

interface TrieState {
  trie: TrieNode | null;
  /** true の場合、次回アクセス時に再構築が必要 */
  invalidated: boolean;
  /** トライ木の最終構築時刻（epoch ms） */
  builtAt: number | null;
}

// guildId → TrieState
const trieCache = new Map<string, TrieState>();

// 将来的に環境変数化しやすいよう定数化しておく
const TRIE_TTL_MS = 60_000;

/**
 * ギルドのトライ木を取得する（遅延構築）
 * 初回アクセス時または無効化後の再アクセス時に DB から辞書を読み込んで構築する
 */
export async function getDictionaryTrie(guildId: string): Promise<TrieNode | null> {
  const state = trieCache.get(guildId);
  if (!state) {
    // VC 接続されていないギルドの可能性 → null を返す
    return null;
  }

  if (
    state.trie &&
    !state.invalidated &&
    state.builtAt !== null &&
    Date.now() - state.builtAt < TRIE_TTL_MS
  ) {
    return state.trie;
  }

  // 構築が必要
  try {
    const prisma = getPrisma();
    const [serverEntries, globalEntries] = await Promise.all([
      prisma.serverDictionary.findMany({
        where: { guildId },
        select: { word: true, reading: true },
      }),
      prisma.globalDictionary.findMany({
        select: { word: true, reading: true },
      }),
    ]);

    const trie = buildMergedTrie(serverEntries, globalEntries);
    state.trie = trie;
    state.invalidated = false;
    state.builtAt = Date.now();

    logger.debug(
      { guildId, serverCount: serverEntries.length, globalCount: globalEntries.length },
      'Dictionary trie built',
    );

    return trie;
  } catch (error) {
    logger.error({ err: error, guildId }, 'Failed to build dictionary trie');
    return state.trie; // 既存のトライ木があればそれを返す
  }
}

/**
 * ギルドのトライ木スロットを初期化する（VC 接続時に呼ぶ）
 */
export function initTrieSlot(guildId: string): void {
  trieCache.set(guildId, { trie: null, invalidated: true, builtAt: null });
}

/**
 * ギルドのトライ木を破棄する（VC 切断時に呼ぶ）
 */
export function destroyTrieSlot(guildId: string): void {
  trieCache.delete(guildId);
}

/**
 * 特定ギルドのトライ木を無効化する（サーバー辞書変更時）
 */
export function invalidateGuildTrie(guildId: string): void {
  const state = trieCache.get(guildId);
  if (state) {
    state.invalidated = true;
    logger.debug({ guildId }, 'Dictionary trie invalidated');
  }
}

/**
 * 全ギルドのトライ木を無効化する（グローバル辞書変更時）
 */
export function invalidateAllTries(): void {
  for (const state of trieCache.values()) {
    state.invalidated = true;
  }
  logger.debug('All dictionary tries invalidated');
}
