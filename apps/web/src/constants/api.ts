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
  localities: '/localities',
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
    registrationPrintData: (id: string) => `/my/products/${seg(id)}/registration-print-data`,
    resultsPrintData: (id: string) => `/my/products/${seg(id)}/results/print-data`,
    attachments: (id: string) => `/my/products/${seg(id)}/attachments`,
    attachment: (id: string, attachmentId: string) =>
      `/my/products/${seg(id)}/attachments/${seg(attachmentId)}`,
  },
  judge: {
    products: '/judge/products',
    evaluation: (id: string) => `/judge/products/${seg(id)}/evaluation`,
    evaluationPrintData: (id: string) => `/judge/products/${seg(id)}/evaluation/print-data`,
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
    productGroups: '/admin/product-groups',
    productGroup: (id: string) => `/admin/product-groups/${seg(id)}`,
    categories: '/admin/categories',
    category: (id: string) => `/admin/categories/${seg(id)}`,
    localities: '/admin/localities',
    locality: (id: string) => `/admin/localities/${seg(id)}`,
    criteriaSets: '/admin/criteria-sets',
    criteriaSet: (id: string) => `/admin/criteria-sets/${seg(id)}`,
    criteriaSetPrintData: (id: string) => `/admin/criteria-sets/${seg(id)}/print-data`,
    evaluations: '/admin/evaluations',
    evaluationPrintData: (id: string) => `/admin/evaluations/${seg(id)}/print-data`,
    assignments: '/admin/assignments',
    products: '/admin/products',
    product: (id: string) => `/admin/products/${seg(id)}`,
    productSubmit: (id: string) => `/admin/products/${seg(id)}/submit`,
    productRegistrationPrintData: (id: string) =>
      `/admin/products/${seg(id)}/registration-print-data`,
    productResultsPrintData: (id: string) => `/admin/products/${seg(id)}/results/print-data`,
    productAttachments: (id: string) => `/admin/products/${seg(id)}/attachments`,
    productAttachment: (id: string, attachmentId: string) =>
      `/admin/products/${seg(id)}/attachments/${seg(attachmentId)}`,
    productResults: (id: string) => `/admin/products/${seg(id)}/results`,
  },
} as const;

/** Public image URL for `<img src>`; browser fetches it directly, without the API client. */
export function publicAttachmentUrl(productId: string, attachmentId: string): string {
  return `${API_BASE}${API.products.attachment(productId, attachmentId)}`;
}
