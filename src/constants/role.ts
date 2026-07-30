/**
 * Vai trò người dùng — enum cố định, khớp với Prisma `enum Role` ở backend.
 *  - ADMIN  : toàn quyền trên mọi đơn vị.
 *  - DON_VI : nhập/sửa dữ liệu, chỉ trong đơn vị của mình.
 *  - VIEWER : xem mọi đơn vị, không nhập liệu.
 */
export type Role = 'ADMIN' | 'THUONG_TRUC' | 'DON_VI' | 'VIEWER';
export const ADMIN_USERNAME = 'admin';

export const ROLE = {
    ADMIN: 'ADMIN',
    THUONG_TRUC: 'THUONG_TRUC',
    DON_VI: 'DON_VI',
    VIEWER: 'VIEWER',
} as const satisfies Record<string, Role>;

export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: 'Quản trị viên',
    THUONG_TRUC: 'Thường trực nghiệp vụ',
    DON_VI: 'Đơn vị nhập liệu',
    VIEWER: 'Người xem',
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
    { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
    { value: 'THUONG_TRUC', label: ROLE_LABELS.THUONG_TRUC },
    { value: 'DON_VI', label: ROLE_LABELS.DON_VI },
    { value: 'VIEWER', label: ROLE_LABELS.VIEWER },
];

type RoleHolder = { role?: Role | null; username?: string } | null | undefined;

/** Quản trị viên: toàn quyền. (Fallback theo username để không khóa tài khoản
 *  admin mặc định nếu role chưa kịp đồng bộ.) */
export const isAdminRole = (user: RoleHolder): boolean =>
    user?.role === 'ADMIN' || (!!user?.username && user.username === ADMIN_USERNAME);

/** Người xem: chỉ đọc. */
export const isViewerRole = (user: RoleHolder): boolean => user?.role === 'VIEWER';

/** Thấy được mọi đơn vị (admin & người xem) — dùng cho bộ chọn đơn vị + phạm vi đọc. */
export const canSeeAllUnits = (user: RoleHolder): boolean =>
    isAdminRole(user) || user?.role === 'THUONG_TRUC' || isViewerRole(user);

/** Được phép nhập/sửa dữ liệu (admin & đơn vị; người xem thì không). */
export const canWrite = (user: RoleHolder): boolean => !isViewerRole(user);
