export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  entries: WorkspaceEntry[];
}

export type WorkspaceEntry = WorkspaceFile | WorkspaceFolder;

interface WorkspaceEntryBase {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceFile extends WorkspaceEntryBase {
  type: "file";
  mimeType: string;
  blob: Blob;
}

export interface WorkspaceFolder extends WorkspaceEntryBase {
  type: "folder";
}

export interface WorkspaceImportFile {
  path: string;
  file: File;
}
