import Link from "next/link";
import UploadPanel from "../components/UploadPanel";
import ImageLibrary from "../components/ImageLibrary";
import ProxyUploadPanel from "../components/ProxyUploadPanel";

const checklist = [
  "Cloudflare R2 バケットとアクセスキーを用意",
  "Workers に署名付き URL 発行エンドポイントを実装",
  "D1 データベースにメタ情報を書き込むサービスを作成",
  "Basic 認証用の ID/PASS を環境変数に投入"
];

export default function HomePage() {
  return (
    <main>
      <h1>imgbase 管理UI</h1>
      <p>アップロードとメタ情報管理の MVP をここで動かします。まずは署名付き URL 経由のアップロードから。</p>

      <section className="converter-home-link">
        <Link href="/converter" className="converter-summary__link">ローカル画像変換ツールを開く</Link>
      </section>

      <UploadPanel />

      <ProxyUploadPanel />

      <section>
        <h2>初期セットアップ</h2>
        <ul>
          {checklist.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <ImageLibrary />
    </main>
  );
}
