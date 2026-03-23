import { Link } from 'react-router';
import { Button, Card, CardBody, CardHeader, Chip, Divider, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';

export function HomePage() {
  return (
    <div className="flex flex-col gap-20">
      {/* Hero Section */}
      <section className="flex flex-col items-center text-center gap-6 py-16">
        <Chip color="primary" variant="flat" size="sm">Discord 読み上げBot</Chip>
        <h1 className="text-5xl font-bold tracking-tight">
          Discord のテキストを<br />
          <span className="text-primary">高品質な音声</span>に
        </h1>
        <p className="text-xl text-default-500 max-w-2xl">
          SumireVox は VOICEVOX エンジンを使った Discord 読み上げ Bot です。
          サーバーのテキストチャンネルのメッセージをリアルタイムで音声合成し、VC に流します。
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Button
            as="a"
            href="#"
            color="primary"
            size="lg"
            className="font-semibold"
          >
            Bot を導入する
          </Button>
          <Button
            as={Link}
            to="/dashboard"
            variant="bordered"
            size="lg"
          >
            ダッシュボード
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="flex flex-col gap-8">
        <h2 className="text-3xl font-bold text-center">特徴</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-2">
            <CardHeader className="flex gap-3">
              <div className="text-3xl">🎙️</div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold">高品質な音声合成</p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">
                VOICEVOX エンジンによる自然な日本語音声。複数の話者から好みの声を選べます。速度やピッチも細かく調整可能です。
              </p>
            </CardBody>
          </Card>

          <Card className="p-2">
            <CardHeader className="flex gap-3">
              <div className="text-3xl">📖</div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold">サーバー辞書でカスタマイズ</p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">
                サーバー専用の読み方辞書を登録できます。独特の用語や固有名詞も正しく読み上げます。グローバル辞書への申請機能も搭載。
              </p>
            </CardBody>
          </Card>

          <Card className="p-2">
            <CardHeader className="flex gap-3">
              <div className="text-3xl">⚡</div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold">直感的なコマンド操作</p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">
                スラッシュコマンドで簡単操作。/join で読み上げ開始、/leave で終了。設定は UI でインタラクティブに変更できます。
              </p>
            </CardBody>
          </Card>

          <Card className="p-2">
            <CardHeader className="flex gap-3">
              <div className="text-3xl">✨</div>
              <div className="flex flex-col">
                <p className="text-lg font-semibold">PREMIUM でさらに拡張</p>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-default-500">
                月額300円のブーストでサーバーを PREMIUM に。読み上げ最大文字数が50→200文字に拡張、ユーザーごとの音声設定が適用されます。
              </p>
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="flex flex-col gap-8">
        <h2 className="text-3xl font-bold text-center">料金プラン</h2>
        <Table aria-label="料金プラン比較" removeWrapper>
          <TableHeader>
            <TableColumn>機能</TableColumn>
            <TableColumn className="text-center">FREE</TableColumn>
            <TableColumn className="text-center text-primary">PREMIUM</TableColumn>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>月額料金</TableCell>
              <TableCell className="text-center">無料</TableCell>
              <TableCell className="text-center text-primary font-semibold">300円 / ブースト</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>読み上げ最大文字数</TableCell>
              <TableCell className="text-center">50文字</TableCell>
              <TableCell className="text-center">200文字</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>ユーザー音声設定（話者・速度・ピッチ）の適用</TableCell>
              <TableCell className="text-center">✗</TableCell>
              <TableCell className="text-center">✓</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>サーバー辞書エントリ上限</TableCell>
              <TableCell className="text-center">10件</TableCell>
              <TableCell className="text-center">100件</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex justify-center">
          <Button
            as="a"
            href="/auth/login"
            color="primary"
            variant="flat"
            size="lg"
          >
            ログインしてブーストを購入
          </Button>
        </div>
      </section>

      <Divider />

      {/* Footer Links */}
      <section className="flex flex-col items-center gap-2 pb-4">
        <p className="text-default-400 text-sm">
          ご利用にあたっては
          <Link to="/terms" className="text-primary hover:underline mx-1">利用規約</Link>
          および
          <Link to="/privacy" className="text-primary hover:underline mx-1">プライバシーポリシー</Link>
          をご確認ください。
        </p>
        <p className="text-default-400 text-sm">
          音声合成には
          <a href="https://voicevox.hiroshiba.jp/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">VOICEVOX</a>
          を使用しています。
        </p>
      </section>
    </div>
  );
}
