export function LegalPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">特定商取引法に基づく表記</h1>
        <p className="text-gray-500 mb-10">最終更新日: 2026年3月26日</p>
        <div className="space-y-6">
          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-white/10">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">販売事業者</th>
                  <td className="px-6 py-4 text-sm text-gray-300">SumireVox</td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">代表者</th>
                  <td className="px-6 py-4 text-sm text-gray-300">深見 把矢人</td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">所在地</th>
                  <td className="px-6 py-4 text-sm text-gray-400">請求があった場合に遅滞なく開示いたします。</td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">電話番号</th>
                  <td className="px-6 py-4 text-sm text-gray-400">請求があった場合に遅滞なく開示いたします。</td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">メールアドレス</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    <a href="mailto:sumirevox@gmail.com" className="text-purple-400 hover:text-purple-300 underline">
                      sumirevox@gmail.com
                    </a>
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">販売価格</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    各プランの価格はサービス内の料金ページに表示された金額（税込）に従います。
                    <br />
                    <span className="text-gray-400">※ 現在の価格: プレミアムプラン 月額300円（税込）/ ブースト</span>
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">販売価格以外の必要料金</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    インターネット接続に必要な通信料はお客様のご負担となります。
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">支払方法</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    クレジットカード、デビットカード、その他Stripeが対応する決済方法
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">支払時期</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    購入手続き完了時に即時課金されます。サブスクリプションの場合、以降毎月同日に自動更新・課金されます。
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">サービス提供時期</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    決済完了後、即時ご利用いただけます。
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">返品・返金について</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    デジタルサービスの性質上、購入完了後の返金は原則として行いません。
                    <br />
                    <span className="text-gray-400">
                      ただし、当方の責に帰すべき事由によりサービスが提供されなかった場合、二重課金等の決済上の明らかな誤りがあった場合、
                      および法令により返金が義務付けられる場合は返金を検討いたします。
                      返金を希望される場合は、購入日から14日以内にメールにてお問い合わせください。
                      詳細は利用規約第7条をご確認ください。
                    </span>
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">解約方法</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    Stripeカスタマーポータルから解約が可能です。解約後も当該請求期間の終了時まで引き続きサービスをご利用いただけます。
                  </td>
                </tr>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 bg-white/5 w-1/3 align-top">動作環境</th>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    Discordアカウントおよびインターネット接続環境が必要です。Webダッシュボードの利用には最新のWebブラウザが必要です。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
