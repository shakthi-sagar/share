import type { SelectedFile } from "./format";

export function selectedFromFileList(files: FileList): SelectedFile[] {
  return [...files].map((file) => ({
    file,
    path: file.webkitRelativePath || file.name,
  }));
}

export async function selectedFromDrop(dataTransfer: DataTransfer): Promise<SelectedFile[]> {
  const entries = [...dataTransfer.items].map((item) => item.webkitGetAsEntry()).filter(isEntry);
  if (entries.length === 0) {
    return selectedFromFileList(dataTransfer.files);
  }

  const collected = await Promise.all(entries.map((entry) => walkEntry(entry, "")));
  return collected.flat();
}

export function mergeSelected(current: SelectedFile[], incoming: SelectedFile[]): SelectedFile[] {
  const byPath = new Map(current.map((selected) => [selected.path, selected]));
  for (const selected of incoming) {
    byPath.set(selected.path, selected);
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

async function walkEntry(entry: FileSystemEntry, parentPath: string): Promise<SelectedFile[]> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await readFile(entry as FileSystemFileEntry);
    return [{ file, path }];
  }
  if (!entry.isDirectory) {
    return [];
  }

  const entries = await readAllDirectoryEntries(entry as FileSystemDirectoryEntry);
  const children = await Promise.all(entries.map((child) => walkEntry(child, path)));
  return children.flat();
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readAllDirectoryEntries(
  entry: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const result: FileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) {
      return result;
    }
    result.push(...batch);
  }
}

function isEntry(entry: FileSystemEntry | null): entry is FileSystemEntry {
  return entry !== null;
}
