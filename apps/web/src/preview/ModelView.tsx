import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Sphere,
  Texture,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { extensionOf } from "./kinds";

const GLTF_DATA =
  /^data:(?:image\/(?:png|jpeg|webp|avif)|application\/(?:octet-stream|gltf-buffer));base64,/iu;

async function readModel(blob: Blob, kind: string): Promise<Object3D> {
  if (kind === "obj") return new OBJLoader().parse(await blob.text());
  if (kind === "stl") {
    return new Mesh(
      new STLLoader().parse(await blob.arrayBuffer()),
      new MeshStandardMaterial({ color: "#96a8c4", roughness: 0.75 }),
    );
  }
  const bytes = await blob.arrayBuffer();
  const decoder = new TextDecoder();
  let json: string;
  if (kind === "glb") {
    if (bytes.byteLength < 20) throw new Error("Invalid GLB file");
    const length = new DataView(bytes).getUint32(12, true);
    json = decoder.decode(new Uint8Array(bytes, 20, length));
  } else {
    json = decoder.decode(bytes);
  }
  const manifest = JSON.parse(json) as {
    images?: { uri?: string }[];
    buffers?: { uri?: string }[];
  };
  for (const resource of [...(manifest.images ?? []), ...(manifest.buffers ?? [])]) {
    if (resource.uri && !GLTF_DATA.test(resource.uri)) {
      throw new Error("Preview requires a model with embedded textures and buffers");
    }
  }
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (GLTF_DATA.test(url) || url.startsWith("blob:")) return url;
    throw new Error("Model resources must be embedded");
  });
  return (await new GLTFLoader(manager).parseAsync(kind === "glb" ? bytes : json, "")).scene;
}

function releaseModel(model: Object3D): void {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) {
          if (value.image instanceof ImageBitmap) value.image.close();
          value.dispose();
        }
      }
      material.dispose();
    }
  });
}

export default function ModelView({ blob, path }: { blob: Blob; path: string }): React.JSX.Element {
  const holder = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [status, setStatus] = useState("Loading 3D model…");

  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    let alive = true;
    let dispose = () => {};
    void readModel(blob, extensionOf(path))
      .then((model) => {
        if (!alive) {
          releaseModel(model);
          return;
        }
        dispose = () => releaseModel(model);
        const bounds = new Box3().setFromObject(model);
        const sphere = bounds.getBoundingSphere(new Sphere());
        if (bounds.isEmpty() || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
          throw new Error("Model has no displayable geometry");
        }
        model.position.sub(sphere.center);
        const scene = new Scene();
        scene.background = new Color("#18202c");
        scene.add(model, new AmbientLight("#ffffff", 1.6));
        const light = new DirectionalLight("#ffffff", 2.1);
        light.position.set(4, 7, 5);
        scene.add(light);

        const camera = new PerspectiveCamera(42, 1, sphere.radius / 1000, sphere.radius * 150);
        camera.position.set(1.8, 1.2, 2.4).multiplyScalar(sphere.radius);
        const renderer = new WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.setAttribute("aria-label", "Interactive 3D model");
        element.append(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = sphere.radius * 0.05;
        controls.maxDistance = sphere.radius * 45;
        controls.update();
        controls.saveState();
        const render = () => renderer.render(scene, camera);
        controls.addEventListener("change", render);
        reset.current = () => {
          controls.reset();
          render();
        };
        const resize = () => {
          const width = Math.max(1, element.clientWidth);
          const height = Math.max(1, element.clientHeight);
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          render();
        };
        const sizes = new ResizeObserver(resize);
        sizes.observe(element);
        dispose = () => {
          sizes.disconnect();
          controls.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          renderer.domElement.remove();
          releaseModel(model);
        };
        resize();
        setStatus("");
      })
      .catch((cause: unknown) => {
        if (alive)
          setStatus(cause instanceof Error ? cause.message : "Could not render this model");
      });
    return () => {
      alive = false;
      reset.current = () => {};
      dispose();
    };
  }, [blob, path]);

  return (
    <section>
      {status ? (
        <p className="preview-notice" role="status">
          {status}
        </p>
      ) : (
        <p className="preview-notice">
          Drag to orbit and scroll to zoom.{" "}
          <button type="button" onClick={() => reset.current()}>
            Reset view
          </button>
        </p>
      )}
      <div ref={holder} style={{ width: "100%", height: "min(65vh, 720px)" }} />
    </section>
  );
}
