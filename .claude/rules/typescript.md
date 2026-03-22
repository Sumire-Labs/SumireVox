---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript コーディング規約

- strict mode 必須
- `any` 禁止。型は `packages/shared/` に集約
- default export 禁止。named export のみ
- `console.log` / `console.error` 禁止。`logger.ts` の pino ロガーを使う
- `process.env` の直接参照禁止。`config.ts` で一元管理
- エラーは `AppError` カスタムエラークラスを使用
- ファイル名は kebab-case (例: `create-audio-resource.ts`)
- クラスは PascalCase、関数・変数は camelCase
- `index.ts` は re-export のみ。ロジック禁止
- 1ファイル1エクスポートが原則。密接に関連するヘルパーはプライベート関数として同一ファイル内に定義可。複数ファイルから参照されるなら独立ファイルに切り出す
- 型定義ファイルは1ドメイン領域1ファイル。複数の型・インターフェースをエクスポートしてよい
