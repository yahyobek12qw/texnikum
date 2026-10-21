// Foydalanuvchi rollari va ruxsatlari. Tekshiruv SERVER tomonida bajariladi; client faqat interfeysni moslaydi.

export const ROLES = ['ADMIN', 'PUBLISHER', 'EDITOR'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  PUBLISHER: 'Bosh muharrir (nashr qiluvchi)',
  EDITOR: 'Muharrir',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Hamma narsa: kontent, menyu, sozlamalar, modullar, foydalanuvchilar, audit.',
  PUBLISHER: 'Kontentni yaratish, tahrirlash, nashr qilish, arxivlash va o‘chirish; media; statistika va hisobotlar.',
  EDITOR: 'Kontentni yaratish va tahrirlash (qoralama), media yuklash. Nashr qilish va o‘chirish mumkin emas.',
};

export const PERMISSIONS = [
  'content.read',
  'content.write',
  'content.publish',
  'content.delete',
  'media.write',
  'media.delete',
  'navigation.manage',
  'settings.manage',
  'modules.manage',
  'users.manage',
  'audit.view',
  'stats.view',
  'reports.export',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'content.read': 'Kontentni ko‘rish',
  'content.write': 'Kontent yaratish va tahrirlash',
  'content.publish': 'Nashr qilish, nashrdan qaytarish, arxivlash',
  'content.delete': 'Kontentni o‘chirish',
  'media.write': 'Fayl yuklash va tahrirlash',
  'media.delete': 'Faylni o‘chirish',
  'navigation.manage': 'Menyuni boshqarish',
  'settings.manage': 'Sayt sozlamalari',
  'modules.manage': 'Modullarni yoqish/o‘chirish',
  'users.manage': 'Foydalanuvchilar va rollar',
  'audit.view': 'Audit jurnali',
  'stats.view': 'Statistikani ko‘rish',
  'reports.export': 'Hisobotlarni yuklab olish',
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  PUBLISHER: ['content.read', 'content.write', 'content.publish', 'content.delete', 'media.write', 'media.delete', 'stats.view', 'reports.export'],
  EDITOR: ['content.read', 'content.write', 'media.write', 'stats.view'],
};

export const hasPermission = (role: Role, permission: Permission): boolean =>
  (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
