declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  interface Frame {
    is_primary(): boolean;
    get_width(): number;
    get_height(): number;
    display(target: ImageData, callback: (image: ImageData | null) => void): void;
    free(): void;
  }
  interface Codec {
    HeifDecoder: new () => { decode(data: Uint8Array): Frame[] };
  }
  const codec: () => Promise<Codec>;
  export default codec;
}
