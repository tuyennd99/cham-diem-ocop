export const ADMIN_GROUP_CODE = 'ADMIN';
// Loại tài khoản (role user). CHU_TRI/PHOI_HOP KHÔNG thuộc đây — đó là trách
// nhiệm theo từng nhiệm vụ, BE xét trực tiếp qua leadOrganizationId/collaborators.
export type Roles = 'ADMIN' | 'THUONG_TRUC' | 'DON_VI' | 'VIEWER';
export const ROLE = {
    ADMIN: 'ADMIN',
    THUONG_TRUC: 'THUONG_TRUC',
    DON_VI: 'DON_VI',
    VIEWER: 'VIEWER',
} as const satisfies Record<string, Roles>;