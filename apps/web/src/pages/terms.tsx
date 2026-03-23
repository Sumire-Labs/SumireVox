import { Divider } from '@heroui/react';

const SECTIONS = [
  {
    title: '第1条（適用）',
    content:
      '本規約は、SumireVox（以下「当サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で当サービスを利用するものとします。',
  },
  {
    title: '第2条（利用登録）',
    content: '準備中',
  },
  {
    title: '第3条（禁止事項）',
    content: '準備中',
  },
  {
    title: '第4条（サービスの提供の停止等）',
    content: '準備中',
  },
  {
    title: '第5条（免責事項）',
    content: '準備中',
  },
  {
    title: '第6条（利用規約の変更）',
    content: '準備中',
  },
];

export function TermsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">利用規約</h1>
        <p className="text-default-500">最終更新日: 2025年1月1日</p>
      </div>

      <p className="text-default-600">
        SumireVox（以下「当サービス」）をご利用いただく前に、以下の利用規約をよくお読みください。
      </p>

      <div className="flex flex-col gap-6">
        {SECTIONS.map((section, i) => (
          <div key={i} className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="text-default-600">{section.content}</p>
            {i < SECTIONS.length - 1 && <Divider className="mt-4" />}
          </div>
        ))}
      </div>
    </div>
  );
}
