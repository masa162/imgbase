export interface LibraryImage {
  id: string;
  original_filename: string | null;
  short_id: string | null;
  mime: string;
  bytes: number;
  status: string;
  hash_sha256: string | null;
  created_at: string;
  updated_at: string;
}

export type LibraryViewMode = "list" | "gallery";
