import { FilesRepository } from '../repositories/files.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { MAX_DRAFT_BYTES } from '../utils/private-storage';
export { MAX_DRAFT_BYTES };
export type DocumentType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'unknown';
export interface UploadedPrivateFile {
    originalname: string;
    mimetype: string;
    filename: string;
    path: string;
    size: number;
}
export declare function assertDraftSize(sizeBytes: number): void;
export declare function assertAllowedDocument(originalName: string, declaredMime: string, detectedType: DocumentType): void;
export declare class FilesService {
    private readonly repository;
    private readonly root;
    constructor(repository: FilesRepository, root?: string);
    uploadDraftFile(workspaceId: number, file: UploadedPrivateFile | undefined, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
        id: number;
        createdAt: Date;
        sizeBytes: number;
        originalName: string;
        mimeType: string;
        checksum: string;
    }>;
    removeDraftFile(workspaceId: number, storedFileId: number, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
        id: number;
    }>;
    downloadWorkspaceFile(workspaceId: number, storedFileId: number, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
        stream: import("fs").ReadStream;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
    }>;
    downloadVersionFile(versionId: number, storedFileId: number, principal: AccessTokenPayload, meta?: RequestMeta): Promise<{
        stream: import("fs").ReadStream;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
    }>;
    private download;
    private requireEditable;
    private assertReadScope;
    private assertStoredUpload;
    private pathFor;
    private safeUnlink;
}
