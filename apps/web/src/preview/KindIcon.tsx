import {
  File,
  FileAudio,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
  type LucideIcon,
} from "lucide-react";
import type { PreviewKind } from "./kinds";

const icons: Record<PreviewKind, LucideIcon> = {
  markdown: FileText,
  csv: FileSpreadsheet,
  json: FileJson,
  svg: FileImage,
  html: FileCode2,
  code: FileCode2,
  text: FileText,
  image: FileImage,
  pdf: FileText,
  audio: FileAudio,
  video: FileVideo,
  font: FileType,
  binary: File,
};

export function KindIcon({
  kind,
  size = 15,
}: {
  kind: PreviewKind;
  size?: number;
}): React.JSX.Element {
  const Icon = icons[kind];
  return <Icon size={size} aria-hidden="true" />;
}
