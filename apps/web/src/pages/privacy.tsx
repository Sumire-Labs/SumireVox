const DISCORD_SUPPORT_URL = import.meta.env.VITE_DISCORD_SUPPORT_URL || '#';

interface SubSection {
  title: string;
  content: string;
  subContent?: string;
  externalServices?: { name: string; description: string; url: string | null }[];
}
interface Section {
  id: string;
  title: string;
  content: string;
  subContent?: string;
  subSections?: SubSection[];
  purposeItems?: string[];
  disclaimerItems?: string[];
  operatorInfo?: string;
  contactInfo?: { email: string; discord: string };
}
const sections: Section[] = [
  {
    id: "section-1",
    title: "1. はじめに",
    content: "Sumire-Labs（以下「当方」といいます）は、SumireVoxサービス（Discord読み上げBot「SumireVox」および関連Webサービス全般、以下「本サービス」といいます）を提供するにあたり、ユーザーの個人情報の保護を重要な責務と認識しています。",
    subContent: "本個人情報保護方針（以下「本ポリシー」といいます）は、当方が収集する情報の種類、利用目的、管理方法、およびユーザーの権利について説明するものです。本サービスをご利用いただくことで、ユーザーは本ポリシーに同意したものとみなされます。"
  },
  {
    id: "section-2",
    title: "2. 収集する情報",
    content: "当方は、本サービスの提供および改善のために、以下の情報を収集することがあります。",
    subSections: [
      {
        title: "2.1 Discordアカウント情報",
        content: "本サービスの利用に際して、DiscordユーザーID、ユーザー名、およびアバター画像を取得します。これらの情報は、Discord OAuthを通じてユーザーの同意のもと取得されます。"
      },
      {
        title: "2.2 サーバーおよびチャンネル情報",
        content: "本サービスが導入されたDiscordサーバーのサーバーID、サーバー名、およびボイスチャンネル・テキストチャンネルのIDを取得します。"
      },
      {
        title: "2.3 ユーザー設定情報",
        content: "ユーザーが本サービス内で設定した情報を保存します。具体的には、読み上げ音声の設定（スピーカーID、速度、ピッチ）、辞書に登録した単語および読み方、Bot設定（自動接続、通知設定等）が含まれます。"
      },
      {
        title: "2.4 決済情報",
        content: "プレミアムプランをご購入いただく場合、決済に必要な情報はStripeを通じて処理されます。当方がクレジットカード番号、セキュリティコード等の機密性の高い決済情報を直接保存することはありません。当方が保存するのは、StripeカスタマーID、購入履歴（購入日、プラン名、金額）、およびサブスクリプションの状態に限られます。"
      },
      {
        title: "2.5 ログ情報",
        content: "本サービスの運用およびトラブルシューティングのために、アクセスログ、エラーログ、およびコマンド実行ログを収集することがあります。これらのログには、実行日時、実行されたコマンド、およびサーバーID・チャンネルIDが含まれる場合があります。"
      },
      {
        title: "2.6 読み上げテキスト",
        content: "ボイスチャンネルで読み上げられるテキストメッセージは、音声合成処理のために一時的に処理されますが、当方のサーバーに永続的に保存されることはありません。"
      },
      {
        title: "2.7 サポート対応に伴い収集する情報",
        content: "ユーザーからの払い戻し申請、サポート依頼、お問い合わせ、その他の要望に対応するため、本ポリシーの他の条項に定める情報以外の情報を収集することがあります。これには、ユーザーが任意に提供する氏名、メールアドレス、電話番号、決済明細やレシートの画像、問題の状況を示すスクリーンショット、その他対応に必要と判断される情報が含まれます。",
        subContent: "これらの情報は、ユーザーの要望への対応、問題の調査・解決、および関連する記録の保持のために利用されます。当方からこれらの情報の提供を求めた場合であっても、ユーザーは自己の判断により提供の可否を決定することができます。ただし、必要な情報が提供されない場合、要望に対応できないことがあります。"
      }
    ]
  },
  {
    id: "section-3",
    title: "3. 情報の利用目的",
    content: "当方は、収集した情報を以下の目的のために利用します。",
    purposeItems: [
      "本サービスの提供、運営、および維持のため",
      "ユーザーの設定に基づいた読み上げ機能の提供のため",
      "プレミアムプランの課金処理および管理のため",
      "本サービスの改善、新機能の開発のため",
      "システムの安全性確保、不正利用の防止のため",
      "ユーザーからのお問い合わせへの対応のため",
      "利用規約違反の調査および対応のため",
      "法令に基づく義務の履行のため"
    ]
  },
  {
    id: "section-4",
    title: "4. 情報の共有および第三者提供",
    content: "当方は、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。",
    subSections: [
      {
        title: "4.1 ユーザーの同意がある場合",
        content: "ユーザーから明示的な同意を得た場合、その範囲内で第三者に情報を提供することがあります。"
      },
      {
        title: "4.2 サービス提供に必要な外部サービス",
        content: "本サービスの提供にあたり、以下の外部サービスを利用しています。",
        externalServices: [
          {
            name: "Discord",
            description: "本サービスはDiscordプラットフォーム上で動作するため、Discordのプライバシーポリシーが適用されます。",
            url: "https://discord.com/privacy"
          },
          {
            name: "Stripe",
            description: "決済処理のためにStripeを利用しています。決済情報はStripeのセキュリティ基準に従って処理されます。",
            url: "https://stripe.com/privacy"
          },
          {
            name: "VOICEVOX",
            description: "音声合成のためにVOICEVOXエンジンを利用しています。読み上げテキストは音声合成処理のためにVOICEVOXエンジンに送信されますが、当方が運用するVOICEVOXエンジンは当方のサーバー内で稼働しており、外部に送信されることはありません。",
            url: null
          }
        ]
      },
      {
        title: "4.3 法令に基づく場合",
        content: "法令に基づく開示請求があった場合、裁判所、警察、その他の公的機関からの要請に応じて情報を開示することがあります。"
      },
      {
        title: "4.4 権利保護のために必要な場合",
        content: "当方、ユーザー、または第三者の権利、財産、安全を保護するために必要と判断した場合、情報を開示することがあります。"
      },
      {
        title: "4.5 事業譲渡の場合",
        content: "合併、買収、事業譲渡等により本サービスの運営主体が変更される場合、それに伴い個人情報が移転されることがあります。この場合、移転先においても本ポリシーと同等の保護が維持されるよう努めます。"
      }
    ]
  },
  {
    id: "section-5",
    title: "5. 情報の保管と安全管理",
    content: "",
    subSections: [
      {
        title: "5.1 保管場所",
        content: "収集した情報は、当方が管理するサーバー上のデータベース（PostgreSQL）に保管されます。"
      },
      {
        title: "5.2 安全管理措置",
        content: "当方は、収集した情報を適切に管理するために、以下の安全管理措置を講じています。データベースへのアクセス制限、通信の暗号化（HTTPS/TLS）、定期的なセキュリティアップデートの実施、および管理者アクセスの制限と監視を行っています。"
      },
      {
        title: "5.3 保管期間",
        content: "収集した情報は、本サービスの提供に必要な期間、または法令で定められた期間保管します。ユーザーがアカウントを削除した場合、または本サービスからBotが削除された場合、関連する情報は合理的な期間内に削除されます。ただし、法令上の義務を履行するために必要な情報、および不正利用の防止のために必要な情報は、一定期間保持することがあります。",
        subContent: "サポート対応に伴い収集した情報（第2.7項）については、当該対応が完了した後も、将来の問い合わせへの対応、紛争解決、および法的義務の履行のために合理的な期間保持することがあります。"
      }
    ]
  },
  {
    id: "section-6",
    title: "6. ユーザーの権利",
    content: "ユーザーは、自己の個人情報に関して以下の権利を有します。",
    subSections: [
      {
        title: "6.1 アクセス権",
        content: "ユーザーは、当方が保有する自己の個人情報の開示を請求することができます。"
      },
      {
        title: "6.2 訂正権",
        content: "ユーザーは、自己の個人情報に誤りがある場合、訂正を請求することができます。本サービス内の設定については、Webダッシュボードまたはコマンドを通じてユーザー自身で変更することも可能です。"
      },
      {
        title: "6.3 削除権",
        content: "ユーザーは、自己の個人情報の削除を請求することができます。ただし、法令上の義務の履行に必要な情報、または正当な事業目的のために必要な情報については、削除できない場合があります。"
      },
      {
        title: "6.4 処理の制限権",
        content: "ユーザーは、一定の条件のもと、自己の個人情報の処理の制限を請求することができます。"
      },
      {
        title: "6.5 データポータビリティ権",
        content: "ユーザーは、自己の個人情報を構造化された一般的に使用される機械可読形式で受け取ることを請求することができます。"
      },
      {
        title: "6.6 権利行使の方法",
        content: "上記の権利を行使される場合は、「13. お問い合わせ」に記載のお問い合わせ先までご連絡ください。本人確認のため、DiscordアカウントのユーザーIDその他の情報をお伺いする場合があります。"
      }
    ]
  },
  {
    id: "section-7",
    title: "7. Cookieおよび類似技術",
    content: "",
    subSections: [
      {
        title: "7.1 Webダッシュボードにおける使用",
        content: "本サービスのWebダッシュボード（SumireVoxFrontend）では、ユーザー認証およびセッション管理のためにCookieを使用することがあります。"
      },
      {
        title: "7.2 使用するCookieの種類",
        content: "必須Cookieとして、サービスの基本機能を提供するために必要なCookieがあります。これにはセッション管理、認証状態の維持等が含まれます。"
      },
      {
        title: "7.3 Cookieの管理",
        content: "ユーザーは、ブラウザの設定によりCookieを無効にすることができます。ただし、Cookieを無効にした場合、Webダッシュボードの一部機能が正常に動作しない場合があります。"
      }
    ]
  },
  {
    id: "section-8",
    title: "8. 未成年者の個人情報",
    content: "本サービスは、原則として年齢制限を設けていませんが、未成年の方が本サービスを利用する場合は、保護者の同意を得たうえでご利用ください。",
    subContent: "当方は、意図的に13歳未満の児童から個人情報を収集することはありません。13歳未満の児童の個人情報が収集されたことが判明した場合、当方は当該情報を速やかに削除する措置を講じます。"
  },
  {
    id: "section-9",
    title: "9. 国際的なデータ移転",
    content: "本サービスは日本国内で運営されていますが、利用する外部サービス（Discord、Stripe等）の性質上、ユーザーの情報が日本国外に移転される場合があります。その場合、当該サービス提供者のプライバシーポリシーおよび適用法令に従って情報が取り扱われます。"
  },
  {
    id: "section-10",
    title: "10. サポート対応に伴う情報収集に関する免責",
    content: "ユーザーからの払い戻し申請、サポート依頼、その他の要望に対応するために収集・管理する情報（本ポリシーの他の条項に定める情報以外の情報を含む）に関連して、以下の事項について当方は責任を負いません。",
    disclaimerItems: [
      "ユーザーが自己の判断により提供した情報の内容の正確性または完全性",
      "ユーザーが提供した情報に起因して生じた損害（誤った情報の提供による対応の遅延、第三者の権利侵害等を含む）",
      "当方が合理的な安全管理措置を講じていたにもかかわらず発生した情報の漏洩、紛失、または毀損",
      "サポート対応の過程で当方が行った判断または助言に起因して生じた損害"
    ],
    subContent: "ユーザーは、当方に情報を提供する際、当該情報の提供が自己の責任において行われるものであること、および当該情報が第三者の権利を侵害しないことを確認し、保証するものとします。"
  },
  {
    id: "section-11",
    title: "11. 本ポリシーの変更",
    content: "当方は、法令の変更、本サービスの変更、またはその他の理由により、本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上での告知、またはその他適切な方法によりユーザーに通知します。",
    subContent: "変更後の本ポリシーは、本サービス上に掲載された時点で効力を生じます。変更後も本サービスを継続して利用された場合、ユーザーは変更後のポリシーに同意したものとみなされます。"
  },
  {
    id: "section-12",
    title: "12. 準拠法",
    content: "本ポリシーは日本法に準拠し、日本法に従って解釈されるものとします。"
  },
  {
    id: "section-13",
    title: "13. お問い合わせ",
    content: "本ポリシーに関するご質問、個人情報の開示・訂正・削除の請求、その他のお問い合わせは、以下までご連絡ください。",
    operatorInfo: "運営者: Sumire-Labs",
    contactInfo: {
      email: "sumirevox@gmail.com",
      discord: ""
    }
  }
];

function SubSectionContent({ sub }: { sub: SubSection }) {
  return (
    <div className="ml-4 mb-4">
      <h4 className="text-base font-semibold text-gray-200 mb-2">{sub.title}</h4>
      <p className="text-gray-300 leading-relaxed mb-2">{sub.content}</p>
      {sub.externalServices && (
        <div className="ml-4 space-y-3 mt-2">
          {sub.externalServices.map((service, i) => (
            <div key={i}>
              <p className="text-gray-300">
                <span className="font-semibold text-gray-200">{service.name}</span>
                {' — '}{service.description}
              </p>
              {service.url && (
                <a href={service.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm underline">
                  {service.url}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {sub.subContent && (
        <p className="text-gray-400 leading-relaxed mt-2">{sub.subContent}</p>
      )}
    </div>
  );
}

function SectionContent({ section }: { section: Section }) {
  return (
    <section id={section.id} className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3">{section.title}</h2>
      {section.content && (
        <p className="text-gray-300 leading-relaxed mb-3">{section.content}</p>
      )}
      {section.purposeItems && (
        <ul className="list-disc list-inside text-gray-300 leading-relaxed mb-3 ml-4 space-y-1">
          {section.purposeItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {section.disclaimerItems && (
        <ul className="list-disc list-inside text-gray-300 leading-relaxed mb-3 ml-4 space-y-1">
          {section.disclaimerItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      {section.subSections && (
        <div className="mt-4">
          {section.subSections.map((sub, i) => (
            <SubSectionContent key={i} sub={sub} />
          ))}
        </div>
      )}
      {section.subContent && (
        <p className="text-gray-400 leading-relaxed mb-3">{section.subContent}</p>
      )}
      {section.operatorInfo && (
        <p className="text-gray-300 font-semibold mt-4 mb-2">{section.operatorInfo}</p>
      )}
      {section.contactInfo && (
        <div className="mt-2 space-y-2">
          <p className="text-gray-300">
            メール：
            <a href={`mailto:${section.contactInfo.email}`} className="text-purple-400 hover:text-purple-300 underline">
              {section.contactInfo.email}
            </a>
          </p>
          <p className="text-gray-300">
            Discord サポートサーバー：
            <a href={DISCORD_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
              {DISCORD_SUPPORT_URL}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">個人情報保護方針（プライバシーポリシー）</h1>
        <p className="text-gray-500 mb-10">最終更新日: 2026年3月26日</p>
        <nav className="mb-10 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">目次</h3>
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-sm text-purple-400 hover:text-purple-300 hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {sections.map((section) => (
          <SectionContent key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
