import { useEffect, useState } from "react";
import { extensionOf } from "./kinds";
import { ImageView } from "./MediaViews";

export function RasterView({
  blob,
  path,
  name,
}: {
  blob: Blob;
  path: string;
  name: string;
}): React.JSX.Element {
  const [image, setImage] = useState<Blob | null | undefined>();
  useEffect(() => {
    const worker = new Worker(new URL("./raster-worker.ts", import.meta.url), { type: "module" });
    const timeout = window.setTimeout(() => finish(null), 20_000);
    function finish(result: Blob | null) {
      clearTimeout(timeout);
      worker.terminate();
      setImage(result);
    }
    worker.onmessage = (event) => finish(event.data instanceof Blob ? event.data : null);
    worker.onerror = () => finish(null);
    worker.postMessage({ blob, format: extensionOf(path) });
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  }, [blob, path]);

  if (image) return <ImageView blob={image} type="image/png" name={name} />;
  if (image === null)
    return (
      <div className="content-state error-state">
        This image could not be decoded. Download the original.
      </div>
    );
  return (
    <div className="content-state" role="status">
      Decoding {name}…
    </div>
  );
}
