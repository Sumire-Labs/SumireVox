export interface TrieNode {
  children: Map<string, TrieNode>;
  /** このノードで終端する場合の読み（変換先） */
  output: string | null;
}

/**
 * 空のトライ木を作成する
 */
export function createTrieNode(): TrieNode {
  return { children: new Map(), output: null };
}

/**
 * トライ木に単語を追加する
 * @param root ルートノード
 * @param word 変換元の文字列
 * @param reading 変換先の文字列
 */
export function trieInsert(root: TrieNode, word: string, reading: string): void {
  let node = root;
  for (const char of word) {
    let child = node.children.get(char);
    if (!child) {
      child = createTrieNode();
      node.children.set(char, child);
    }
    node = child;
  }
  node.output = reading;
}

/**
 * トライ木を使って最長一致で辞書変換を行う
 * テキストを1文字ずつ走査し、マッチした場合は最長一致の読みに置換する
 * マッチしなかった場合はその文字をそのまま出力する
 * @param root ルートノード
 * @param text 入力テキスト
 * @returns 変換後のテキスト
 */
export function trieReplace(root: TrieNode, text: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    let node = root;
    let lastMatchEnd = -1;
    let lastMatchReading = '';
    // i の位置から最長一致を探す
    for (let j = i; j < text.length; j++) {
      const child = node.children.get(text[j]);
      if (!child) break;
      node = child;
      if (node.output !== null) {
        lastMatchEnd = j + 1;
        lastMatchReading = node.output;
      }
    }
    if (lastMatchEnd !== -1) {
      // マッチした → 読みを出力し、マッチ末尾の次へ進む
      result.push(lastMatchReading);
      i = lastMatchEnd;
    } else {
      // マッチしなかった → 1文字をそのまま出力
      result.push(text[i]);
      i++;
    }
  }
  return result.join('');
}

/**
 * サーバー辞書とグローバル辞書をマージしてトライ木を構築する
 * 同一単語はサーバー辞書が優先
 */
export function buildMergedTrie(
  serverEntries: Array<{ word: string; reading: string }>,
  globalEntries: Array<{ word: string; reading: string }>,
): TrieNode {
  const root = createTrieNode();
  // グローバル辞書を先に挿入
  for (const entry of globalEntries) {
    trieInsert(root, entry.word, entry.reading);
  }
  // サーバー辞書で上書き（同一単語はサーバー辞書が優先）
  for (const entry of serverEntries) {
    trieInsert(root, entry.word, entry.reading);
  }
  return root;
}
