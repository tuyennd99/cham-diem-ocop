export type DocumentType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'unknown';

export interface UploadedPrivateFile {
  originalname: string;
  mimetype: string;
  filename: string;
  path: string;
  size: number;
}
