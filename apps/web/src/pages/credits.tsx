import { Card, CardBody, CardHeader, Divider, Link } from '@heroui/react';

export function CreditsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">クレジット</h1>
        <p className="text-default-500">SumireVox で使用している音声合成エンジンのクレジット表記です。</p>
      </div>

      <Card className="p-2">
        <CardHeader className="flex flex-col items-start gap-1">
          <h2 className="text-2xl font-bold">VOICEVOX</h2>
          <Link
            href="https://voicevox.hiroshiba.jp/"
            isExternal
            showAnchorIcon
            color="primary"
          >
            https://voicevox.hiroshiba.jp/
          </Link>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <p className="text-default-600">
            SumireVox は音声合成に
            <Link href="https://voicevox.hiroshiba.jp/" isExternal color="primary" className="mx-1">
              VOICEVOX
            </Link>
            を使用しています。
          </p>
          <p className="text-default-600">
            VOICEVOX は無料で使える中品質なテキスト読み上げソフトウェアです。
            商用・非商用問わず無料で利用でき、各キャラクターの利用規約の範囲内で使用しています。
          </p>

          <Divider />

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">使用キャラクター</h3>
            <p className="text-default-500 text-sm">
              ※ 具体的な話者のクレジットは順次追加予定です。各キャラクターの利用規約については
              VOICEVOX 公式サイトをご確認ください。
            </p>
          </div>

          <Divider />

          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">ライセンスについて</h3>
            <p className="text-default-600 text-sm">
              VOICEVOX の音声ライブラリは各キャラクターごとに利用規約が定められています。
              SumireVox での使用にあたっては、各キャラクターの利用規約を遵守しています。
              詳細は
              <Link href="https://voicevox.hiroshiba.jp/" isExternal color="primary" className="mx-1" size="sm">
                VOICEVOX 公式サイト
              </Link>
              をご参照ください。
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
