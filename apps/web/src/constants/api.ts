export const API_BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

const seg = encodeURIComponent;

export const API = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    verifyOtp: '/auth/verify-otp',
    resendOtp: '/auth/resend-otp',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
    changePassword: '/auth/change-password',
    me: '/auth/me',
  },
  categories: '/categories',
  products: {
    list: '/products',
    detail: (id: string) => `/products/${seg(id)}`,
    attachment: (id: string, attachmentId: string) =>
      `/products/${seg(id)}/attachments/${seg(attachmentId)}`,
  },
  my: {
    products: '/my/products',
    product: (id: string) => `/my/products/${seg(id)}`,
    submit: (id: string) => `/my/products/${seg(id)}/submit`,
    attachments: (id: string) => `/my/products/${seg(id)}/attachments`,
    attachment: (id: string, attachmentId: string) =>
      `/my/products/${seg(id)}/attachments/${seg(attachmentId)}`,
  },
  judge: {
    products: '/judge/products',
    evaluation: (id: string) => `/judge/products/${seg(id)}/evaluation`,
    submitEvaluation: (id: string) => `/judge/products/${seg(id)}/evaluation/submit`,
    attachment: (id: string, attachmentId: string) =>
      `/judge/products/${seg(id)}/attachments/${seg(attachmentId)}`,
  },
  admin: {
    dashboard: '/admin/dashboard',
    judges: '/admin/judges',
    judge: (id: string) => `/admin/judges/${seg(id)}`,
    judgeResetPassword: (id: string) => `/admin/judges/${seg(id)}/reset-password`,
    users: '/admin/users',
    user: (id: string) => `/admin/users/${seg(id)}`,
    userStaffAccess: (id: string) => `/admin/users/${seg(id)}/staff-access`,
    userStatus: (id: string) => `/admin/users/${seg(id)}/status`,
    userResetPassword: (id: string) => `/admin/users/${seg(id)}/reset-password`,
    organizationUnits: '/admin/organization-units',
    organizationUnit: (id: string) => `/admin/organization-units/${seg(id)}`,
    assignments: '/admin/assignments',
    products: '/admin/products',
    productResults: (id: string) => `/admin/products/${seg(id)}/results`,
  },
} as const;

/** Public image URL for `<img src>`; browser fetches it directly, without the API client. */
export function publicAttachmentUrl(productId: string, attachmentId: string): string {
  return `${API_BASE}${API.products.attachment(productId, attachmentId)}`;
}
