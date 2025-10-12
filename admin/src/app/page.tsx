import UploadPanel from "../components/UploadPanel";
import ImageLibrary from "../components/ImageLibrary";
import ProxyUploadPanel from "../components/ProxyUploadPanel";

export default function HomePage() {
  return (
    <main>
      <h1>imgbase 管理UI</h1>

      <ImageLibrary />

      <UploadPanel />

      <ProxyUploadPanel />
    </main>
  );
}
