import type { ManifestFile } from "@share/protocol";

export type BundleTreeNode = BundleDirectoryNode | BundleFileNode;

export interface BundleDirectoryNode {
  kind: "directory";
  name: string;
  path: string;
  children: BundleTreeNode[];
}

export interface BundleFileNode {
  kind: "file";
  name: string;
  path: string;
  file: ManifestFile;
}

export function buildFileTree(files: ManifestFile[]): BundleTreeNode[] {
  const root: BundleTreeNode[] = [];
  const directories = new Map<string, BundleDirectoryNode>();

  for (const file of files) {
    const segments = file.path.split("/");
    let children = root;
    let parentPath = "";

    for (const segment of segments.slice(0, -1)) {
      const path = parentPath ? `${parentPath}/${segment}` : segment;
      let directory = directories.get(path);
      if (!directory) {
        directory = { kind: "directory", name: segment, path, children: [] };
        directories.set(path, directory);
        children.push(directory);
      }
      children = directory.children;
      parentPath = path;
    }

    children.push({
      kind: "file",
      name: segments.at(-1) ?? file.path,
      path: file.path,
      file,
    });
  }

  sortNodes(root);
  return root;
}

export function directoryPaths(nodes: BundleTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "directory" ? [node.path, ...directoryPaths(node.children)] : [],
  );
}

function sortNodes(nodes: BundleTreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
  for (const node of nodes) {
    if (node.kind === "directory") sortNodes(node.children);
  }
}
