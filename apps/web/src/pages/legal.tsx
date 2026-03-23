import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';

const ITEMS = [
  { label: '販売業者', value: '準備中' },
  { label: '運営責任者', value: '準備中' },
  { label: '所在地', value: '準備中' },
  { label: 'メールアドレス', value: '準備中' },
  { label: '販売価格', value: 'ブースト: 月額300円（税込）' },
  { label: '支払い方法', value: 'クレジットカード（Stripe 経由）' },
  { label: '支払い時期', value: '月次自動更新' },
  { label: '役務の提供時期', value: '決済完了後、即時' },
  { label: 'キャンセル・解約について', value: 'ダッシュボードよりいつでも解約可能。解約後も当月末まで有効。' },
  { label: '返金について', value: '準備中' },
  { label: '動作環境', value: 'Discord クライアント（PC・モバイル）' },
];

export function LegalPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">特定商取引法に基づく表記</h1>
      </div>

      <Table aria-label="特定商取引法に基づく表記" removeWrapper>
        <TableHeader>
          <TableColumn>項目</TableColumn>
          <TableColumn>内容</TableColumn>
        </TableHeader>
        <TableBody>
          {ITEMS.map((item) => (
            <TableRow key={item.label}>
              <TableCell className="font-medium whitespace-nowrap">{item.label}</TableCell>
              <TableCell className="text-default-600">{item.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
