export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[exponent]}`;
}

export function bundleNameFromFiles(files: SelectedFile[]): string {
  const firstPath = files[0]?.path;
  if (!firstPath) {
    return "Encrypted share";
  }
  const topLevel = firstPath.split("/").at(0) ?? firstPath;
  if (files.length > 1 && files.every((file) => file.path.startsWith(`${topLevel}/`))) {
    return topLevel;
  }
  return files.length === 1 ? firstPath : "Shared files";
}

export interface SelectedFile {
  file: File;
  path: string;
}
