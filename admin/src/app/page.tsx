import ImageLibrary from "../components/ImageLibrary";

export default function HomePage() {
  return (
    <main>
      <h1>画像ライブラリ</h1>
      <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
        アップロード済みの画像を管理できます。
      </p>

      <ImageLibrary />
    </main>
  );
}
