import type { AutoJoinChannelPair } from '@sumirevox/shared';

/** 自動接続候補に含める、実行時に取得した情報。 */
export interface AutoJoinCandidate {
  pair: AutoJoinChannelPair;
  order: number;
  humanMemberCount: number;
}

/** Bot を除いた参加者数を数える。 */
export function countHumanMembers(
  members: Iterable<{ user: { bot: boolean } }>,
): number {
  let count = 0;
  for (const member of members) {
    if (!member.user.bot) count += 1;
  }
  return count;
}

/** 人数の多い順、同数なら設定順で候補を並べる。 */
export function rankAutoJoinCandidates<T extends AutoJoinCandidate>(
  candidates: readonly T[],
): T[] {
  return [...candidates].sort((left, right) => {
    const countDifference = right.humanMemberCount - left.humanMemberCount;
    return countDifference !== 0 ? countDifference : left.order - right.order;
  });
}
