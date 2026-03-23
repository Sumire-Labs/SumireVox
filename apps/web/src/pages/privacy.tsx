import { Divider } from '@heroui/react';

const SECTIONS = [
  {
    title: '1. 収集する情報',
    content:
      '当サービスでは、Discord OAuth2 認証を通じてユーザー ID、ユーザー名、参加サーバー一覧などの情報を取得します。また、サービス改善のためにアクセスログを収集する場合があります。',
  },
  {
    title: '2. 情報の利用目的',
    content: '準備中',
  },
  {
    title: '3. 情報の第三者提供',
    content: '準備中',
  },
  {
    title: '4. Cookie について',
    content: '準備中',
  },
  {
    title: '5. 情報の保管',
    content: '準備中',
  },
  {
    title: '6. お問い合わせ',
    content: '準備中',
  },
];

export function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">プライバシーポリシー</h1>
        <p className="text-default-500">最終更新日: 2025年1月1日</p>
      </div>

      <p className="text-default-600">
        当サービスは、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
        本ポリシーでは、収集する情報の種類、利用方法、保護方法について説明します。
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
