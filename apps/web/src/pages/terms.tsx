const DISCORD_SUPPORT_URL = import.meta.env.VITE_DISCORD_SUPPORT_URL || '#';

interface Article {
  id: string;
  title: string;
  content: string;
  subContent?: string;
  additionalContent?: string;
  asIsNote?: string;
  prohibitedItems?: string[];
  serviceChangeItems?: string[];
  contactInfo?: { email: string; discord: string };
}

const articles: Article[] = [
  {
    id: "article-1",
    title: "第1条（はじめに）",
    content: "この利用規約（以下「本規約」といいます）は、Sumire-Labs（以下「当方」といいます）が提供するSumireVoxサービス（Discord読み上げBot「SumireVoxBot」、Webダッシュボード「SumireVoxFrontend」、およびバックエンドAPI「SumireVoxBackend」を含む、以下「本サービス」といいます）の利用条件を定めるものです。本サービスをご利用いただくユーザー（以下「ユーザー」といいます）は、本規約に同意したものとみなされます。"
  },
  {
    id: "article-2",
    title: "第2条（サービスの概要）",
    content: "本サービスは、Discordのボイスチャンネルにおいてテキストメッセージを音声で読み上げる機能を提供します。音声合成にはVOICEVOXエンジンを使用しており、複数のキャラクター音声による高品質な読み上げが可能です。",
    subContent: "本サービスが提供する主な機能は以下のとおりです。ボイスチャンネルへの自動接続・切断機能、複数のキャラクター音声による読み上げ、読み上げ速度やピッチの調整、サーバー固有の辞書登録機能、およびWebダッシュボードによる設定管理となります。"
  },
  {
    id: "article-3",
    title: "第3条（利用資格）",
    content: "本サービスは、Discordアカウントを保有し、Discord利用規約を遵守するすべての方がご利用いただけます。ただし、未成年の方が本サービスを利用する場合は、保護者の同意を得たうえでご利用ください。",
    subContent: "有料プランの購入にあたっては、決済手段を適法に利用できる方に限ります。"
  },
  {
    id: "article-4",
    title: "第4条（サービスプランと料金）",
    content: "本サービスには、無料プランと有料プラン（以下「プレミアムプラン」といいます）があります。各プランの内容、機能、料金については、本サービスのWebサイトまたはアプリケーション内に掲示するものとし、当方は事前の告知により変更することができます。",
    subContent: "プレミアムプランでは、無料プランでは利用できない追加機能や拡張された利用枠が提供されます。具体的な内容は、購入時点で提示される説明に従います。"
  },
  {
    id: "article-5",
    title: "第5条（購入と支払い）",
    content: "プレミアムプランの購入を希望するユーザーは、当方が指定する方法により申込みを行い、所定の料金を支払うものとします。",
    subContent: "支払い方法は、クレジットカード、デビットカード、その他当方が指定する決済手段によるものとします。支払いに関する処理は、Stripeを通じて行われます。料金は、購入時に表示された金額（税込）とします。購入手続きが完了した時点で、売買契約が成立するものとします。ユーザーは、決済に使用するクレジットカードその他の支払い手段について、正当な利用権限を有していることを保証するものとします。"
  },
  {
    id: "article-6",
    title: "第6条（サブスクリプション）",
    content: "プレミアムプランがサブスクリプション形式で提供される場合、ユーザーが解約手続きを行わない限り、契約は自動的に更新され、所定の料金が自動的に課金されます。",
    subContent: "サブスクリプションの解約は、ユーザー自身がStripeの顧客ポータルまたは当方が案内する手続き方法により行うものとします。当方は解約手続きに関するサポートを提供しますが、Stripeのシステムに起因する解約手続きの遅延、不具合、課金の継続その他の問題について、当方は一切の責任を負わないものとします。解約手続き完了後も、当該契約期間の終了時まではプレミアムプランの機能を引き続き利用できます。ユーザーは、解約手続きを行う際、次回更新日までに十分な余裕をもって手続きを完了する責任を負います。更新日直前の解約手続きにより次回課金が発生した場合でも、当方は返金の義務を負いません。"
  },
  {
    id: "article-7",
    title: "第7条（返金・キャンセルポリシー）",
    content: "デジタルコンテンツおよびサービスの性質上、購入完了後の返金は原則として行いません。",
    subContent: "ただし、以下の場合には返金を検討します。当方の責に帰すべき事由により本サービスが全く提供されなかった場合、二重課金など決済上の明らかな誤りがあった場合、および法令により返金が義務付けられる場合がこれに該当します。返金を希望する場合は、購入日から14日以内に当方までお問い合わせください。返金の可否および方法については、当方の判断により決定します。"
  },
  {
    id: "article-8",
    title: "第8条（価格変更）",
    content: "当方は、プレミアムプランの価格を変更することがあります。価格変更を行う場合は、変更の30日前までに本サービス上で告知します。",
    subContent: "サブスクリプション契約中のユーザーに対する価格変更は、次回更新時から適用されます。価格変更に同意しない場合、ユーザーは次回更新日前に解約することができます。"
  },
  {
    id: "article-9",
    title: "第9条（禁止事項）",
    content: "ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。",
    prohibitedItems: [
      "法令または公序良俗に違反する行為",
      "犯罪行為に関連する行為",
      "本サービスのサーバーやネットワークシステムに過度な負荷をかける行為",
      "本サービスの運営を妨害する行為",
      "他のユーザーに対する嫌がらせや迷惑行為",
      "他人の名誉・信用・プライバシーを侵害する行為",
      "第三者の知的財産権や著作権を侵害する行為",
      "本サービスを利用したスパム行為や商業目的の宣伝活動",
      "本サービスの不正利用やリバースエンジニアリング（ただしLGPL-3.0ライセンスで許可される範囲を除く）",
      "VOICEVOXの利用規約に違反する音声の使用",
      "不正な手段による料金の支払い回避や有料機能の不正利用",
      "購入したプランやライセンスの第三者への譲渡・転売",
      "その他当方が不適切と判断する行為"
    ]
  },
  {
    id: "article-10",
    title: "第10条（音声合成エンジンについて）",
    content: "本サービスはVOICEVOXエンジンを使用して音声合成を行っています。VOICEVOXおよび各キャラクター音声の利用にあたっては、VOICEVOXの利用規約および各キャラクターの利用規約が適用されます。ユーザーは、これらの規約を遵守する責任を負います。"
  },
  {
    id: "article-11",
    title: "第11条（データの取り扱い）",
    content: "本サービスは、サービス提供のために必要最小限のデータを収集・保存します。収集するデータには、DiscordサーバーID、チャンネルID、ユーザーが設定した音声設定（スピーカーID、速度、ピッチ）、辞書に登録された単語、Bot設定（自動接続設定など）、および購入履歴・課金情報が含まれます。",
    subContent: "当方は、収集したデータを本サービスの提供および改善以外の目的で使用することはありません。また、法令に基づく場合を除き、ユーザーの同意なく第三者にデータを提供することはありません。決済情報は、Stripeにより安全に処理され、当方がクレジットカード番号等の機密情報を直接保存することはありません。",
    additionalContent: "ユーザーからの払い戻し申請、サポート依頼、その他の要望に対応するため、当方は本規約および個人情報保護方針に定める情報以外の情報（氏名、メールアドレス、決済明細、スクリーンショット、その他ユーザーが任意に提供する情報を含む）を収集・管理することがあります。これらの情報は、当該要望への対応および関連する調査のために利用されます。ユーザーは、これらの情報を当方に提供することにより、当該目的での利用に同意したものとみなされます。"
  },
  {
    id: "article-12",
    title: "第12条（サービスの変更・中断・終了）",
    content: "当方は、以下の場合に本サービスの全部または一部を変更、中断、または終了することができます。事前に通知することが望ましいですが、緊急の場合は事後の通知となる場合があります。",
    serviceChangeItems: [
      "本サービスのシステム保守・点検を行う場合",
      "天災、停電、通信障害などの不可抗力により本サービスの提供が困難な場合",
      "VOICEVOXエンジンやDiscordプラットフォームの仕様変更・サービス終了があった場合",
      "その他当方が必要と判断した場合"
    ],
    subContent: "本サービスが終了する場合、有効なサブスクリプション契約を有するユーザーに対しては、未使用期間に相当する料金の返金など、合理的な対応を検討します。"
  },
  {
    id: "article-13",
    title: "第13条（免責事項）",
    content: "当方は、本サービスの完全性、正確性、有用性、特定目的への適合性について、明示的または黙示的を問わず、いかなる保証も行いません。",
    subContent: "本サービスの利用により生じたいかなる損害（直接的損害、間接的損害、派生的損害、特別損害、逸失利益を含む）についても、当方の故意または重大な過失による場合を除き、当方は責任を負いません。当方が責任を負う場合であっても、その賠償額は、当該ユーザーが過去12ヶ月間に本サービスに対して支払った金額を上限とします。",
    additionalContent: "Stripeが提供する決済サービスの利用に起因して生じた損害（解約手続きの不備、課金エラー、システム障害等を含む）について、当方は一切の責任を負いません。これらの問題については、ユーザーが直接Stripeに問い合わせるものとします。ユーザーからの払い戻し申請、サポート依頼、その他の要望に対応するために収集・管理する情報（本規約および個人情報保護方針に定める情報以外の情報を含む）に関連して生じた損害について、当方の故意または重大な過失による場合を除き、当方は一切の責任を負いません。ユーザーは、自己の判断と責任において当方に情報を提供するものとし、当該情報の提供に伴うリスクを理解し承諾したものとみなされます。",
    asIsNote: "本サービスは「現状有姿」で提供されます。"
  },
  {
    id: "article-14",
    title: "第14条（オープンソースライセンス）",
    content: "本サービスのソースコードはGNU Lesser General Public License v3.0（LGPL-3.0）のもとで公開されています。ユーザーは、同ライセンスの条件に従い、ソースコードを閲覧、複製、改変、再配布することができます。",
    subContent: "ただし、本規約は本サービスを利用する際の条件を定めるものであり、ソースコードのライセンスとは別に適用されます。"
  },
  {
    id: "article-15",
    title: "第15条（知的財産権）",
    content: "本サービスに関する著作権、商標権その他の知的財産権は、当方または正当な権利者に帰属します。本規約に基づく本サービスの利用許諾は、これらの知的財産権の譲渡を意味するものではありません。"
  },
  {
    id: "article-16",
    title: "第16条（規約の変更）",
    content: "当方は、必要に応じて本規約を変更することができます。規約を変更した場合は、本サービス上で告知します。変更後も本サービスを継続して利用された場合、ユーザーは変更後の規約に同意したものとみなされます。",
    subContent: "料金やサブスクリプションに関する重要な変更については、変更の30日前までに通知します。"
  },
  {
    id: "article-17",
    title: "第17条（準拠法および管轄裁判所）",
    content: "本規約は日本法に準拠し、日本法に従って解釈されるものとします。本サービスに関連して生じた紛争については、名古屋地方裁判所を第一審の専属的合意管轄裁判所とします。"
  },
  {
    id: "article-18",
    title: "第18条（お問い合わせ）",
    content: "本規約または本サービスに関するお問い合わせは、以下の方法でご連絡ください。",
    contactInfo: {
      email: "sumirevox@gmail.com",
      discord: DISCORD_SUPPORT_URL
    }
  }
];

function ArticleSection({ article }: { article: Article }) {
  return (
    <section id={article.id} className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3">{article.title}</h2>
      <p className="text-gray-300 leading-relaxed mb-3">{article.content}</p>
      {article.prohibitedItems && (
        <ul className="list-disc list-inside text-gray-300 leading-relaxed mb-3 ml-4 space-y-1">
          {article.prohibitedItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {article.serviceChangeItems && (
        <ul className="list-disc list-inside text-gray-300 leading-relaxed mb-3 ml-4 space-y-1">
          {article.serviceChangeItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {article.subContent && (
        <p className="text-gray-400 leading-relaxed mb-3">{article.subContent}</p>
      )}
      {article.additionalContent && (
        <p className="text-gray-400 leading-relaxed mb-3">{article.additionalContent}</p>
      )}
      {article.asIsNote && (
        <p className="text-gray-500 italic mt-2">{article.asIsNote}</p>
      )}
      {article.contactInfo && (
        <div className="mt-4 space-y-2">
          <p className="text-gray-300">
            メール：
            <a href={`mailto:${article.contactInfo.email}`} className="text-purple-400 hover:text-purple-300 underline">
              {article.contactInfo.email}
            </a>
          </p>
          <p className="text-gray-300">
            Discord サポートサーバー：
            <a href={article.contactInfo.discord} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
              {article.contactInfo.discord}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

export function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">利用規約</h1>
        <p className="text-gray-500 mb-10">最終更新日: 2026年3月26日</p>
        <nav className="mb-10 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">目次</h3>
          <ul className="space-y-1">
            {articles.map((article) => (
              <li key={article.id}>
                <a href={`#${article.id}`} className="text-sm text-purple-400 hover:text-purple-300 hover:underline">
                  {article.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {articles.map((article) => (
          <ArticleSection key={article.id} article={article} />
        ))}
      </div>
    </div>
  );
}
