import type { NavGroup, NavItem } from '@/types';
import {
  BarChart3,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Globe,
  LayoutDashboard,
  Package,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';

export const registrantNavItems: NavItem[] = [
  {
    title: 'Hồ sơ của tôi',
    href: '/my/products',
    icon: Package,
  },
  {
    title: 'Tạo hồ sơ',
    href: '/my/products/new',
    icon: FileText,
  },
];

export const mainNavItems: NavItem[] = [
  {
    title: 'Tổng quan',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Sản phẩm',
    href: '/admin/products',
    icon: Package,
  },
  {
    title: 'Phiếu đăng ký',
    href: '/admin/registrations',
    icon: FileText,
  },
];

export const evaluationNavItems: NavItem[] = [
  {
    title: 'Phân công',
    href: '/admin/assignments',
    icon: UserCheck,
  },
  {
    title: 'Phiếu chấm OCOP',
    href: '/admin/scoring-forms',
    icon: ClipboardCheck,
  },
  {
    title: 'Báo cáo thống kê',
    href: '/admin/reports',
    icon: BarChart3,
  },
];

export const judgeNavItem: NavItem = {
  title: 'Hồ sơ được phân công',
  href: '/judge',
  icon: FileSpreadsheet,
};

export const adminGroup: NavGroup = {
  title: 'Quản trị danh mục & tài khoản',
  icon: ShieldCheck,
  items: [
    {
      title: 'Danh mục sản phẩm',
      href: '/admin/product-groups',
      icon: FolderTree,
    },
    {
      title: 'Người dùng & đơn vị',
      href: '/admin/users',
      icon: Users,
    },
  ],
};

export const accountNavItems: NavItem[] = [
  {
    title: 'Tài khoản',
    href: '/account',
    icon: UserCog,
  },
  {
    title: 'Trang công khai',
    href: '/',
    icon: Globe,
  },
];
