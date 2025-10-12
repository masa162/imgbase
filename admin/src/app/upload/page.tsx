import UploadPanel from "../../components/UploadPanel";
import ProxyUploadPanel from "../../components/ProxyUploadPanel";

export default function UploadPage() {
  return (
    <main>
      <h1>画像アップロード</h1>
      <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
        直接アップロードまたはプロキシ経由でアップロードできます。
      </p>

      <UploadPanel />

      <ProxyUploadPanel />
    </main>
  );
}
