/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Unified Data Store & Repository with Persistence, Audit Logging, and Undo
 */

import {
  SchoolYear,
  AssignmentVersion,
  Department,
  Teacher,
  SchoolClass,
  Subject,
  CurriculumDistribution,
  SpecialDuty,
  TeachingAssignment,
  AuditLog,
  FeedbackRequest,
  SystemBackup,
  UserProfile,
  UserRole,
  SemesterId,
  SchoolInfo,
  SchoolBranch,
  WorkplaceCategory,
  AbbreviationRule,
  AbbreviationCategory,
  SchoolTenantLicense,
  LicenseCheckResult,
  LicensePlanType,
  LicenseStatus,
} from '../types';
import { auth, ensureFirebaseAuth, isSystemSyncEmail } from '../firebase/config';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { firestoreRepository, FirestoreSubCollection, isQuotaExhaustedError } from './firestoreRepository';
import { INITIAL_ABBREVIATION_RULES } from './seedAbbreviations';
import { normalizePositionName, getDefaultDutyPeriodsAndType } from '../utils/teacherPositions';
import { removeVietnameseTones } from '../utils/searchUtils';
import type { ComprehensiveSetupPayload } from '../import-export/excelImportService';
import {
  generateLicenseSignature,
  verifyLicenseSignature,
  checkSchoolQuota,
  generateBackupDataSignature,
  verifyImportTenantIntegrity,
  systemTimeGuardian,
  DEFAULT_LICENSE_QUOTAS,
} from '../services/licenseSecurityService';
import {
  DEFAULT_SCHOOL_INFO,
  INITIAL_SCHOOL_YEARS,
  INITIAL_VERSIONS,
  INITIAL_DEPARTMENTS,
  INITIAL_DUTIES,
  INITIAL_CLASSES,
  INITIAL_SUBJECTS,
  INITIAL_CURRICULUM,
  INITIAL_TEACHERS,
  INITIAL_ASSIGNMENTS,
  INITIAL_BRANCHES,
  INITIAL_WORKPLACES,
} from './seedData';
import {
  QUYHOP_SCHOOL_INFO,
  QUYHOP_BRANCHES,
  QUYHOP_DEPARTMENTS,
  QUYHOP_TEACHERS,
  QUYHOP_CLASSES,
  generateQuyHopAssignments,
} from '../data/quyhopBenchmarkData';

const STORAGE_KEYS = {
  SCHOOL_INFO: 'pccm_school_info_v1',
  SCHOOL_ID: 'pccm_school_id_v1',
  SCHOOL_YEARS: 'pccm_school_years_v1',
  VERSIONS: 'pccm_versions_v1',
  BRANCHES: 'pccm_branches_v1',
  WORKPLACES: 'pccm_workplaces_v1',
  DEPARTMENTS: 'pccm_departments_v1',
  DUTIES: 'pccm_duties_v1',
  CLASSES: 'pccm_classes_v1',
  SUBJECTS: 'pccm_subjects_v1',
  CURRICULUM: 'pccm_curriculum_v1',
  TEACHERS: 'pccm_teachers_v1',
  ASSIGNMENTS: 'pccm_assignments_v1',
  AUDIT_LOGS: 'pccm_audit_logs_v1',
  FEEDBACKS: 'pccm_feedbacks_v1',
  BACKUPS: 'pccm_backups_v1',
  USERS: 'pccm_users_v1',
  SCHOOL_LICENSES: 'pccm_school_licenses_v1',
  ABBREVIATION_RULES: 'pccm_abbreviation_rules_v1',
  ACTIVE_SESSION: 'pccm_active_session_v1',
  INITIAL_SETUP_COMPLETED: 'pccm_initial_setup_completed_v1',
};

export const normalizeEmail = (email?: string): string => {
  if (!email) return '';
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf('@');
  if (atIdx === -1) return trimmed;
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.replace(/\./g, '')}@gmail.com`;
  }
  return trimmed;
};

export const isSameEmail = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  return normalizeEmail(a) === normalizeEmail(b);
};

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return isSameEmail(email, 'nguyentoanqh@gmail.com') || isSameEmail(email, 'nguyentoanqhios@gmail.com') || isSameEmail(email, 'nguyentoanqhai@gmail.com');
};

export const isForbiddenDutyOrExemption = (d?: { code?: string; name?: string; id?: string; type?: string; dutyName?: string; dutyId?: string } | null): boolean => {
  if (!d) return false;
  const rawName = d.name || d.dutyName || '';
  const normName = rawName.toLowerCase().trim();
  const rawCode = d.code || d.dutyId || '';
  const code = rawCode.toUpperCase().trim();
  const id = (d.id || d.dutyId || '').toLowerCase().trim();

  if (
    code === 'HIEU_TRUONG' ||
    code === 'PHO_HIEU_TRUONG' ||
    code === 'PHO_HT' ||
    code === 'HT' ||
    code === 'NGHI_SINH' ||
    code === 'THAI_SAN' ||
    code === 'MATERNITY' ||
    id.startsWith('duty_hieu_truong') ||
    id.startsWith('duty_pho_hieu_truong') ||
    id.startsWith('duty_pho_ht') ||
    id.startsWith('duty_nghi_sinh') ||
    id.startsWith('duty_thai_san') ||
    id.startsWith('duty_ht')
  ) {
    return true;
  }

  if (
    normName.includes('hiệu trưởng') ||
    normName.includes('phó hiệu') ||
    normName.includes('nghỉ sinh') ||
    normName.includes('thai sản')
  ) {
    return true;
  }

  return false;
};

export { isSystemSyncEmail };

export const isBlacklistedSchool = (id?: string | null, _name?: string | null): boolean => {
  if (!id) return false;
  const normId = id.trim().toLowerCase();
  // Only blacklist obsolete fixed legacy seed IDs from early dev prototyping
  return normId === 'school_thcs_thu_nghiem_seed_legacy';
};

export const isThongKeSchool = (id?: string | null, name?: string | null): boolean => {
  return isBlacklistedSchool(id, name);
};

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: 'user_super_admin',
    name: 'Thầy Nguyễn Văn Toàn (Chủ sở hữu)',
    email: 'nguyentoanqh@gmail.com',
    schoolId: 'school_quyhop',
    role: 'admin',
    roleTitle: 'Chủ sở hữu & Quản trị viên Tối cao',
    permission: 'edit',
    isSuperAdmin: true,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'user_super_admin_alt',
    name: 'Thầy Nguyễn Văn Toàn (Dự phòng)',
    email: 'nguyentoanqhios@gmail.com',
    schoolId: 'school_quyhop',
    role: 'admin',
    roleTitle: 'Chủ sở hữu & Quản trị viên Tối cao',
    permission: 'edit',
    isSuperAdmin: true,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

export const INITIAL_SCHOOL_LICENSES: SchoolTenantLicense[] = [
  {
    id: 'school_quyhop',
    schoolName: 'TRƯỜNG THCS QUỲ HỢP',
    adminEmail: 'nguyentoanqh@gmail.com',
    adminName: 'Thầy Nguyễn Văn Toàn',
    assignedPasswordHint: '123456',
    status: 'active',
    planType: 'annual',
    expiresAt: '2027-08-31T23:59:59.000Z',
    contactPhone: '0961 285 888',
    notes: 'Cơ sở dữ liệu chính thức TRƯỜNG THCS QUỲ HỢP (Chủ sở hữu: Thầy Nguyễn Văn Toàn)',
    maxTeachers: 9999,
    maxClasses: 9999,
    signature: generateLicenseSignature({
      id: 'school_quyhop',
      schoolName: 'TRƯỜNG THCS QUỲ HỢP',
      expiresAt: '2027-08-31T23:59:59.000Z',
      planType: 'annual',
      maxTeachers: 9999,
      maxClasses: 9999,
    }),
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  },
];

export const DEFAULT_GUEST_PROFILE: UserProfile = {
  id: 'guest_user',
  name: 'Chưa đăng nhập',
  email: '',
  schoolId: 'school_quyhop',
  role: 'staff',
  roleTitle: 'Chưa xác thực',
  permission: 'view',
  isSuperAdmin: false,
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
};

class DataStore {
  private schoolInfo: SchoolInfo = { ...DEFAULT_SCHOOL_INFO };
  private schoolInfoByTenant: Record<string, SchoolInfo> = {};
  private currentSchoolId: string = 'school_quyhop';
  private isTenantDataLoaded: boolean = false;
  private schoolLicenses: SchoolTenantLicense[] = [];
  private authUid?: string;
  private authUnsubscribe?: () => void;
  private schoolYears: SchoolYear[] = [];
  private versions: AssignmentVersion[] = [];
  private branches: SchoolBranch[] = [];
  private workplaces: WorkplaceCategory[] = [];
  private departments: Department[] = [];
  private duties: SpecialDuty[] = [];
  private classes: SchoolClass[] = [];
  private subjects: Subject[] = [];
  private curriculum: CurriculumDistribution[] = [];
  private teachers: Teacher[] = [];
  private assignments: TeachingAssignment[] = [];
  private auditLogs: AuditLog[] = [];
  private feedbacks: FeedbackRequest[] = [];
  private backups: SystemBackup[] = [];
  private users: UserProfile[] = [];
  private abbreviationRules: AbbreviationRule[] = [];
  private currentUser: UserProfile = DEFAULT_GUEST_PROFILE;
  private currentSchoolYearId: string = 'sy_2026_2027';
  private currentSemesterId: SemesterId = 'HK1';
  private currentVersionId: string = 'ver_hk1_official';

  private isSyncingDepartmentDuties: boolean = false;
  private isInitializing: boolean = true;
  private hasUnsavedChangesFlag: boolean = false;
  private listeners: (() => void)[] = [];

  /**
   * Tự động phát hiện mã trường từ URL param (?schoolId=... hoặc ?school=... hoặc trong hash #/?schoolId=...)
   */
  public detectUrlSchoolId(): string | null {
    if (typeof window === 'undefined' || !window.location) {
      return null;
    }
    try {
      let schoolIdParam: string | null = null;
      if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        schoolIdParam = params.get('schoolId') || params.get('school') || params.get('tenant') || params.get('s');
      }
      if (!schoolIdParam && window.location.hash) {
        const hashIdx = window.location.hash.indexOf('?');
        if (hashIdx !== -1) {
          const hashParams = new URLSearchParams(window.location.hash.substring(hashIdx));
          schoolIdParam = hashParams.get('schoolId') || hashParams.get('school') || hashParams.get('tenant') || hashParams.get('s');
        }
      }
      if (!schoolIdParam && window.location.href) {
        const match = window.location.href.match(/[?&](?:schoolId|school|tenant|s)=([^&#]+)/i);
        if (match && match[1]) {
          schoolIdParam = decodeURIComponent(match[1]);
        }
      }

      // 1. Nhận diện từ Subdomain: ví dụ pccm-quyhop.pages.dev hoặc smartpccm-quyhop.pages.dev
      if (!schoolIdParam && window.location.hostname) {
        const host = window.location.hostname.toLowerCase();
        const pccmMatch = host.match(/^(?:pccm|smartpccm)-([a-z0-9_-]+)\./i);
        if (pccmMatch && pccmMatch[1] && pccmMatch[1] !== 'dev' && pccmMatch[1] !== 'pre' && pccmMatch[1] !== 'main') {
          const subSlug = pccmMatch[1];
          schoolIdParam = subSlug.startsWith('school_') ? subSlug : `school_${subSlug}`;
        }
      }

      // 2. Nhận diện từ Pathname: ví dụ https://pccm.pages.dev/quyhop hoặc /school_quyhop hoặc /s/quyhop
      if (!schoolIdParam && window.location.pathname) {
        const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
        if (path && path !== 'index.html' && !path.includes('.') && path !== 'login' && path !== 'admin') {
          const cleanSub = path.replace(/^s\//, '');
          if (cleanSub) {
            schoolIdParam = cleanSub.startsWith('school_') ? cleanSub : `school_${cleanSub}`;
          }
        }
      }

      if (schoolIdParam && schoolIdParam.trim()) {
        let cleaned = schoolIdParam.trim();
        if (cleaned.toLowerCase() === 'quyhop') {
          cleaned = 'school_quyhop';
        } else if (!cleaned.startsWith('school_')) {
          cleaned = `school_${cleaned}`;
        }
        // Không nhận mã trường THỐNG KÊ đã xóa
        if (!isThongKeSchool(cleaned, '')) {
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('detectUrlSchoolId error:', e);
    }
    return null;
  }

  /**
   * Tự động phát hiện toàn bộ thông tin bản quyền và trường học từ URL params
   * (?schoolId=...&schoolName=...&adminEmail=...&adminName=...&pass=...)
   * Hỗ trợ tìm trong cả search query, hash query, full href, pathname và subdomain
   */
  public detectUrlSchoolParams(): {
    schoolId: string | null;
    schoolName: string | null;
    adminEmail: string | null;
    adminName: string | null;
    pass: string | null;
  } {
    if (typeof window === 'undefined' || !window.location) {
      return { schoolId: null, schoolName: null, adminEmail: null, adminName: null, pass: null };
    }
    try {
      let searchStr = window.location.search || '';
      if (!searchStr && window.location.hash) {
        const hashIdx = window.location.hash.indexOf('?');
        if (hashIdx !== -1) {
          searchStr = window.location.hash.substring(hashIdx);
        }
      }

      const params = new URLSearchParams(searchStr);
      let schoolId = params.get('schoolId') || params.get('school') || params.get('tenant') || params.get('s');
      let schoolName = params.get('schoolName') || params.get('name') || params.get('school_name');
      let adminEmail = params.get('adminEmail') || params.get('email') || params.get('mail');
      let adminName = params.get('adminName') || params.get('admin') || params.get('manager');
      let pass = params.get('pass') || params.get('password') || params.get('pwd');

      // Fallback regex trực tiếp trên window.location.href nếu search rỗng
      if (!schoolId && window.location.href) {
        const mId = window.location.href.match(/[?&](?:schoolId|school|tenant|s)=([^&#]+)/i);
        if (mId && mId[1]) schoolId = decodeURIComponent(mId[1]);
        const mName = window.location.href.match(/[?&](?:schoolName|name|school_name)=([^&#]+)/i);
        if (mName && mName[1]) schoolName = decodeURIComponent(mName[1]);
        const mEmail = window.location.href.match(/[?&](?:adminEmail|email|mail)=([^&#]+)/i);
        if (mEmail && mEmail[1]) adminEmail = decodeURIComponent(mEmail[1]);
        const mAdmin = window.location.href.match(/[?&](?:adminName|admin|manager)=([^&#]+)/i);
        if (mAdmin && mAdmin[1]) adminName = decodeURIComponent(mAdmin[1]);
        const mPass = window.location.href.match(/[?&](?:pass|password|pwd)=([^&#]+)/i);
        if (mPass && mPass[1]) pass = decodeURIComponent(mPass[1]);
      }

      // Tự động nhận diện trường qua Subdomain hoặc Pathname nếu chưa có trong query
      if (!schoolId) {
        schoolId = this.detectUrlSchoolId();
      }

      let normalizedSchoolId = schoolId?.trim() || null;
      if (normalizedSchoolId) {
        normalizedSchoolId = normalizedSchoolId.toLowerCase();
        if (normalizedSchoolId === 'quyhop') {
          normalizedSchoolId = 'school_quyhop';
        } else if (!normalizedSchoolId.startsWith('school_')) {
          normalizedSchoolId = `school_${normalizedSchoolId}`;
        }
      }

      if (normalizedSchoolId && isThongKeSchool(normalizedSchoolId, schoolName || '')) {
        normalizedSchoolId = null;
      }

      // Tự động khôi phục tên trường, email và mật khẩu từ bản lưu nếu URL ngắn không truyền đủ tham số
      if (normalizedSchoolId && (!schoolName || schoolName === 'TRƯỜNG THCS MỚI')) {
        try {
          const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
          const matched = backupLicenses.find(
            (l) => l.id.toLowerCase() === normalizedSchoolId || l.id.replace(/^school_/, '').toLowerCase() === normalizedSchoolId?.replace(/^school_/, '')
          );
          if (matched && matched.schoolName && matched.schoolName !== 'TRƯỜNG THCS MỚI') {
            schoolName = matched.schoolName;
          }
          if (!adminEmail && matched?.adminEmail) {
            adminEmail = matched.adminEmail;
          }
          if (!adminName && matched?.adminName) {
            adminName = matched.adminName;
          }
          if (!pass && matched?.assignedPasswordHint) {
            pass = matched.assignedPasswordHint;
          }
        } catch {}
      }

      return {
        schoolId: normalizedSchoolId,
        schoolName: schoolName?.trim() || null,
        adminEmail: adminEmail?.trim().toLowerCase() || null,
        adminName: adminName?.trim() || null,
        pass: pass?.trim() || null,
      };
    } catch (e) {
      console.warn('detectUrlSchoolParams error:', e);
    }
    return { schoolId: null, schoolName: null, adminEmail: null, adminName: null, pass: null };
  }

  constructor() {
    this.isInitializing = true;
    this.hasUnsavedChangesFlag = false;
    this.loadFromStorage();

    // THỰC HIỆN LỆNH CỦA NGƯỜI DÙNG: Xóa sạch dữ liệu mẫu giáo viên, kiêm nhiệm, lớp trên app, đám mây
    // Sau đây mở phần mềm chỉ có sẵn danh mục kiêm nhiệm, môn học và khung tiết mặc định, danh mục viết tắt
    if (typeof window !== 'undefined') {
      try {
        const orderExecuted = localStorage.getItem('pccm_clean_slate_order_executed_v4');
        if (!orderExecuted) {
          this.clearAllOperationalData(this.currentSchoolId, true);
          localStorage.setItem('pccm_clean_slate_order_executed_v4', 'true');
        }
      } catch {}
    }

    firestoreRepository.addQuotaListener(() => {
      this.stopFirestoreRealtimeSync();
      this.cloudSyncStatus = 'idle';
      this.notify();
    });

    this.loadLicensesFromCloud().catch(() => {});
    this.initAuthListener();
    if (!firestoreRepository.hasQuotaExhausted()) {
      this.initFirestoreRealtimeSync(this.currentSchoolId);
    }
    this.isInitializing = false;
    this.hasUnsavedChangesFlag = false;
  }

  private loadFromStorage() {
    try {
      const urlParams = this.detectUrlSchoolParams();
      const urlSchoolId = urlParams.schoolId;
      if (urlSchoolId) {
        this.currentSchoolId = urlSchoolId;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_KEYS.SCHOOL_ID, JSON.stringify(urlSchoolId));
          } catch {}
        }
      } else {
        this.currentSchoolId = this.getItem(STORAGE_KEYS.SCHOOL_ID, 'school_quyhop');
      }
      this.schoolInfoByTenant = this.getItem('pccm_school_info_tenants_v1', {});
      this.schoolInfo = this.getItem(STORAGE_KEYS.SCHOOL_INFO, DEFAULT_SCHOOL_INFO);
      if (!this.schoolInfo || !this.schoolInfo.schoolName) {
        this.schoolInfo = { ...DEFAULT_SCHOOL_INFO };
      }
      this.schoolYears = this.getItem(STORAGE_KEYS.SCHOOL_YEARS, INITIAL_SCHOOL_YEARS);
      const loadedVersions = this.getItem(STORAGE_KEYS.VERSIONS, INITIAL_VERSIONS);
      // Remove any draft 'Lần 1' for HK1, keeping only official version
      this.versions = loadedVersions.filter((v: AssignmentVersion) => !(v.semesterId === 'HK1' && (v.id === 'ver_hk1_v1' || v.name === 'Lần 1')));
      if (this.versions.length === 0) {
        this.versions = [...INITIAL_VERSIONS];
      }

      this.branches = this.getItem(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
      if (!this.branches || this.branches.length === 0) {
        this.branches = [...INITIAL_BRANCHES];
      }

      // Deduplicate and normalize branches: Ensure strictly ONE main branch (Điểm chính) exists
      const uniqueBranchMap = new Map<string, SchoolBranch>();
      let foundMainBranch = false;

      for (const b of this.branches) {
        const normName = (b.name || '').trim().normalize('NFC').toLowerCase();
        const isMain =
          Boolean(b.isMain) ||
          b.id === 'branch_main' ||
          normName === 'điểm chính' ||
          normName === 'điểm trường chính' ||
          normName.includes('chính');

        if (isMain) {
          if (!foundMainBranch) {
            uniqueBranchMap.set('diem_chinh', {
              ...b,
              id: b.id || 'branch_main',
              code: b.code || 'DC',
              name: 'Điểm chính',
              isMain: true,
              order: 1,
              active: b.active !== false,
            });
            foundMainBranch = true;
          }
        } else if (normName && normName !== 'toàn trường' && normName !== 'toan truong') {
          if (!uniqueBranchMap.has(normName)) {
            uniqueBranchMap.set(normName, {
              ...b,
              name: (b.name || 'Điểm lẻ').trim(),
              isMain: false,
              order: uniqueBranchMap.size + 1,
              active: b.active !== false,
            });
          }
        }
      }

      if (!foundMainBranch) {
        uniqueBranchMap.set('diem_chinh', {
          id: 'branch_main',
          code: 'DC',
          name: 'Điểm chính',
          isMain: true,
          order: 1,
          active: true,
        });
      }

      this.branches = Array.from(uniqueBranchMap.values());

      this.workplaces = this.getItem(STORAGE_KEYS.WORKPLACES, INITIAL_WORKPLACES);
      if (!this.workplaces || this.workplaces.length === 0) {
        this.workplaces = [...INITIAL_WORKPLACES];
      }

      // Synchronize workplaces with school branches (initial setup)
      const initialAllWp: WorkplaceCategory = {
        id: 'wp_all',
        code: 'TT',
        name: 'Toàn trường',
        description: 'Công tác hoặc phụ trách chung toàn trường',
        color: 'indigo',
        isDefault: false,
        active: true,
        order: 0,
      };

      // Deduplicate: merge any duplicate "Điểm chính" or "Toàn trường"
      const uniqueWpMap = new Map<string, WorkplaceCategory>();
      uniqueWpMap.set('toan_truong', initialAllWp);

      // Điểm chính từ school branches
      const mainB = this.branches.find((b) => b.isMain) || this.branches[0];
      uniqueWpMap.set('diem_chinh', {
        id: mainB.id,
        code: mainB.code || 'DC',
        name: 'Điểm chính',
        description: 'Điểm chính của trường',
        color: 'blue',
        isDefault: true,
        active: true,
        order: 1,
      });

      // Các phân hiệu từ school branches
      this.branches
        .filter((b) => b && !b.isMain)
        .forEach((b, idx) => {
          const key = (b.name || '').trim().normalize('NFC').toLowerCase();
          if (!uniqueWpMap.has(key)) {
            uniqueWpMap.set(key, {
              id: b.id,
              code: b.code || `PH${idx + 1}`,
              name: (b.name || `Phân hiệu ${idx + 1}`).trim(),
              description: b.notes || `Phân hiệu ${b.name || idx + 1}`,
              color: idx === 0 ? 'amber' : idx === 1 ? 'emerald' : 'purple',
              isDefault: false,
              active: b.active !== false,
              order: idx + 2,
            });
          }
        });

      for (const w of this.workplaces) {
        if (!w) continue;
        const norm = (w.name || '').trim().normalize('NFC').toLowerCase();
        let key = norm;
        if (norm.includes('chính') || norm === 'điểm trường chính' || w.isDefault) {
          key = 'diem_chinh';
        } else if (norm === 'toàn trường' || w.code === 'TT') {
          key = 'toan_truong';
        }
        if (!uniqueWpMap.has(key)) {
          uniqueWpMap.set(key, {
            ...w,
            name: (w.name || 'Nơi làm việc').trim(),
            isDefault: false,
            order: uniqueWpMap.size + 1,
          });
        }
      }
      this.workplaces = Array.from(uniqueWpMap.values());

      const rawDepts = this.getItem(STORAGE_KEYS.DEPARTMENTS, INITIAL_DEPARTMENTS);
      this.departments = (rawDepts || []).filter(Boolean).map((d: Department) => {
        const initMatch = INITIAL_DEPARTMENTS.find((id) => id.id === d.id || id.code === d.code);
        const dName = d.name || d.code || 'Tổ CM';
        const fullName = d.fullName || initMatch?.fullName || (dName.startsWith('Tổ ') ? dName : `Tổ ${dName}`);
        return { ...d, name: dName, fullName, schoolId: d.schoolId || 'school_quyhop' };
      });
      this.duties = this.getItem(STORAGE_KEYS.DUTIES, INITIAL_DUTIES).filter((d: SpecialDuty) => !isForbiddenDutyOrExemption(d));
      this.setItem(STORAGE_KEYS.DUTIES, this.duties);

      // Quét dọn triệt để mọi key pccm_duties trong localStorage của mọi trường / tenant
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && (k === STORAGE_KEYS.DUTIES || k.includes('pccm_duties'))) {
              const raw = window.localStorage.getItem(k);
              if (raw) {
                try {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed)) {
                    const cleaned = parsed.filter((d: any) => !isForbiddenDutyOrExemption(d));
                    if (cleaned.length !== parsed.length) {
                      window.localStorage.setItem(k, JSON.stringify(cleaned));
                    }
                  }
                } catch {
                  // ignore
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
      const rawClasses = this.getItem<SchoolClass[]>(STORAGE_KEYS.CLASSES, []);
      this.classes = Array.isArray(rawClasses) ? rawClasses : [];
      this.subjects = this.getItem(STORAGE_KEYS.SUBJECTS, INITIAL_SUBJECTS);
      // Chuẩn hóa tên môn: Nghệ thuật - MT và Nghệ thuật - AN
      this.subjects = this.subjects.map((s) => {
        if (s.code === 'MY_THUAT' || s.id === 'sub_my_thuat' || s.name === 'Mĩ thuật' || s.name === 'Mỹ thuật') {
          return { ...s, name: 'Nghệ thuật - MT', shortName: s.shortName === 'M.Thuật' || s.shortName === 'MT' ? 'MT' : s.shortName };
        }
        if (s.code === 'AM_NHAC' || s.id === 'sub_am_nhac' || s.name === 'Âm nhạc') {
          return { ...s, name: 'Nghệ thuật - AN', shortName: s.shortName === 'Nhạc' || s.shortName === 'AN' ? 'AN' : s.shortName };
        }
        return s;
      });
      // Tự động bổ sung môn LS&ĐL - Sử và LS&ĐL - Địa nếu chưa có
      if (!this.subjects.some((s) => s.code === 'LS_DL_SU' || s.id === 'sub_ls_dl_su')) {
        const lsDlSub = this.subjects.find((s) => s.code === 'LICH_SU_DIA_LI' || s.id === 'sub_ls_dl');
        const deptId = lsDlSub?.departmentId || 'dept_van_su_dia';
        this.subjects.push({
          id: 'sub_ls_dl_su',
          code: 'LS_DL_SU',
          name: 'LS&ĐL - Sử',
          shortName: 'Sử',
          group: 'Xã hội',
          applicableGrades: [6, 7, 8, 9],
          departmentId: deptId,
          allowsMultipleTeachers: false,
          isIntegrated: false,
          active: true,
          color: '#f59e0b',
        });
      }
      if (!this.subjects.some((s) => s.code === 'LS_DL_DIA' || s.id === 'sub_ls_dl_dia')) {
        const lsDlSub = this.subjects.find((s) => s.code === 'LICH_SU_DIA_LI' || s.id === 'sub_ls_dl');
        const deptId = lsDlSub?.departmentId || 'dept_van_su_dia';
        this.subjects.push({
          id: 'sub_ls_dl_dia',
          code: 'LS_DL_DIA',
          name: 'LS&ĐL - Địa',
          shortName: 'Địa',
          group: 'Xã hội',
          applicableGrades: [6, 7, 8, 9],
          departmentId: deptId,
          allowsMultipleTeachers: false,
          isIntegrated: false,
          active: true,
          color: '#b45309',
        });
      }
      // Đảm bảo mọi môn học đều có applicableGrades hợp lệ
      this.subjects = this.subjects.map((s) => ({
        ...s,
        applicableGrades: s.applicableGrades && s.applicableGrades.length > 0 ? s.applicableGrades : [6, 7, 8, 9],
      }));
      // Tự động đồng bộ các phân môn KHTN (Lý 8-9, Hóa 8-9, Sinh 8-9) nếu chưa có
      if (!this.subjects.some((s) => s.code === 'KHTN_LY')) {
        const khtnSub = this.subjects.find((s) => s.code === 'KHTN');
        if (khtnSub && (!khtnSub.applicableGrades || khtnSub.applicableGrades.length === 4)) {
          khtnSub.applicableGrades = [6, 7];
        }
        const deptId = khtnSub?.departmentId || 'dept_khtn';
        this.subjects.push(
          { id: 'sub_khtn_ly', code: 'KHTN_LY', name: 'KHTN - Vật lí', shortName: 'Lý 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: deptId, allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0284c7', periodsPerWeek: 1.5 },
          { id: 'sub_khtn_hoa', code: 'KHTN_HOA', name: 'KHTN - Hóa học', shortName: 'Hóa 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: deptId, allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0d9488', periodsPerWeek: 1.5 },
          { id: 'sub_khtn_sinh', code: 'KHTN_SINH', name: 'KHTN - Sinh học', shortName: 'Sinh 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: deptId, allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#16a34a', periodsPerWeek: 1 }
        );
      }
      this.subjects = this.deduplicateSubjectsList(this.subjects);
      this.curriculum = this.getItem(STORAGE_KEYS.CURRICULUM, INITIAL_CURRICULUM);
      // Đảm bảo curriculum của phân môn KHTN cho khối 8 & 9 nếu chưa có
      if (!this.curriculum.some((c) => c.subjectId === 'sub_khtn_ly')) {
        const todayStr = new Date().toISOString().split('T')[0];
        ['HK1', 'HK2'].forEach((sem) => {
          const weeks = sem === 'HK1' ? 18 : 17;
          [8, 9].forEach((g) => {
            const khtnItem = this.curriculum.find((c) => c.grade === g && (c.subjectId === 'sub_khtn' || c.subjectId === 'KHTN') && c.semesterId === sem);
            if (khtnItem) khtnItem.periodsPerWeek = 0;
            this.curriculum.push(
              { id: `curr_${g}_khtn_ly_${sem.toLowerCase()}`, schoolYearId: 'sy_2026_2027', semesterId: sem as any, grade: g as any, subjectId: 'sub_khtn_ly', periodsPerWeek: 1.5, weeks, totalPeriods: 1.5 * weeks, effectiveDate: todayStr, status: 'approved' },
              { id: `curr_${g}_khtn_hoa_${sem.toLowerCase()}`, schoolYearId: 'sy_2026_2027', semesterId: sem as any, grade: g as any, subjectId: 'sub_khtn_hoa', periodsPerWeek: 1.5, weeks, totalPeriods: 1.5 * weeks, effectiveDate: todayStr, status: 'approved' },
              { id: `curr_${g}_khtn_sinh_${sem.toLowerCase()}`, schoolYearId: 'sy_2026_2027', semesterId: sem as any, grade: g as any, subjectId: 'sub_khtn_sinh', periodsPerWeek: 1, weeks, totalPeriods: 1 * weeks, effectiveDate: todayStr, status: 'approved' }
            );
          });
        });
      }
      const rawTeachers = this.getItem<Teacher[]>(STORAGE_KEYS.TEACHERS, []);
      this.teachers = Array.isArray(rawTeachers) ? rawTeachers : [];

      const rawAssignments = this.getItem<TeachingAssignment[]>(STORAGE_KEYS.ASSIGNMENTS, []);
      this.assignments = Array.isArray(rawAssignments) ? rawAssignments : [];

      this.auditLogs = this.getItem(STORAGE_KEYS.AUDIT_LOGS, []);
      this.feedbacks = this.getItem(STORAGE_KEYS.FEEDBACKS, []);
      this.backups = this.getItem(STORAGE_KEYS.BACKUPS, []);
      this.users = this.getItem(STORAGE_KEYS.USERS, INITIAL_USER_PROFILES);

      // Khắc phục ID và tự động chuyển đổi nếu tài khoản nguyentoanqhai@gmail.com sang nguyentoanqhios@gmail.com
      this.users = this.users.map((u) => {
        if ((isSameEmail(u.email, 'nguyentoanqhios@gmail.com') || isSameEmail(u.email, 'nguyentoanqhai@gmail.com')) && u.id === 'user_super_admin') {
          return { ...u, id: 'user_super_admin_alt', email: 'nguyentoanqhios@gmail.com' };
        }
        if (isSameEmail(u.email, 'nguyentoanqhai@gmail.com')) {
          return { ...u, email: 'nguyentoanqhios@gmail.com', isSuperAdmin: true, role: 'admin' };
        }
        return u;
      });

      // Giữ lại các quản trị viên chính thức và các tài khoản người dùng hợp lệ
      if (!this.users.some((u) => isSameEmail(u.email, 'nguyentoanqh@gmail.com'))) {
        this.users.unshift(INITIAL_USER_PROFILES[0]);
      }
      if (!this.users.some((u) => isSameEmail(u.email, 'nguyentoanqhios@gmail.com'))) {
        this.users.push(INITIAL_USER_PROFILES[1]);
      }
      this.users = this.users.filter(
        (u) => u.schoolId !== 'school_thongke' && !isSameEmail(u.email, 'thongke.qh@gmail.com') && !isSystemSyncEmail(u.email)
      );

      // Khử trùng lặp ID triệt để cho toàn bộ danh sách users để không bao giờ bị duplicate key
      const seenUserIds = new Set<string>();
      const sanitizedUsers: UserProfile[] = [];
      for (const u of this.users) {
        if (!u) continue;
        let finalId = u.id;
        if (!finalId) {
          finalId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        }
        if (seenUserIds.has(finalId)) {
          if (finalId === 'user_super_admin' && (isSameEmail(u.email, 'nguyentoanqhios@gmail.com') || isSameEmail(u.email, 'nguyentoanqhai@gmail.com'))) {
            finalId = 'user_super_admin_alt';
          } else {
            finalId = `${finalId}_${u.email ? u.email.split('@')[0].replace(/[^a-z0-9]/gi, '') : Math.random().toString(36).substring(2, 6)}`;
          }
        }
        if (seenUserIds.has(finalId)) {
          finalId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        }
        seenUserIds.add(finalId);
        sanitizedUsers.push({ ...u, id: finalId });
      }
      this.users = sanitizedUsers;
      this.saveLocalCacheOnly();

      const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);

      const cachedLicenses = (this.getItem(STORAGE_KEYS.SCHOOL_LICENSES, INITIAL_SCHOOL_LICENSES) as SchoolTenantLicense[]);
      const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
      const mergedMap = new Map<string, SchoolTenantLicense>();
      INITIAL_SCHOOL_LICENSES.forEach((l) => mergedMap.set(l.id, l));
      cachedLicenses.forEach((l) => mergedMap.set(l.id, l));
      backupLicenses.forEach((l) => mergedMap.set(l.id, l));
      this.schoolLicenses = Array.from(mergedMap.values()).filter(
        (l) => !isThongKeSchool(l.id, l.schoolName) && !deletedSchoolIds.includes(l.id)
      );
      if (!this.schoolLicenses.some((l) => l.id === 'school_quyhop') && !deletedSchoolIds.includes('school_quyhop')) {
        this.schoolLicenses.unshift(INITIAL_SCHOOL_LICENSES[0]);
      }

      // Tự động nhận diện & nạp thông tin trường học từ URL params nếu mở qua liên kết chia sẻ
      if (urlSchoolId && urlSchoolId !== 'school_quyhop') {
        const existingLicIndex = this.schoolLicenses.findIndex((l) => l.id === urlSchoolId);
        if (existingLicIndex >= 0) {
          if (urlParams.schoolName && urlParams.schoolName !== 'TRƯỜNG THCS MỚI') {
            this.schoolLicenses[existingLicIndex].schoolName = urlParams.schoolName;
          }
          if (urlParams.adminEmail) this.schoolLicenses[existingLicIndex].adminEmail = urlParams.adminEmail;
          if (urlParams.adminName) this.schoolLicenses[existingLicIndex].adminName = urlParams.adminName;
          if (urlParams.pass) this.schoolLicenses[existingLicIndex].assignedPasswordHint = urlParams.pass;
        } else {
          // Tìm trong backupLicenses trước để lấy tên chính xác
          const foundBackup = backupLicenses.find((b) => b.id === urlSchoolId || b.id.replace(/^school_/, '') === urlSchoolId.replace(/^school_/, ''));
          const targetName = (urlParams.schoolName && urlParams.schoolName !== 'TRƯỜNG THCS MỚI')
            ? urlParams.schoolName
            : (foundBackup?.schoolName || 'TRƯỜNG THCS MỚI');
          const autoLic: SchoolTenantLicense = {
            id: urlSchoolId,
            schoolName: targetName,
            adminEmail: urlParams.adminEmail || foundBackup?.adminEmail || '',
            adminName: urlParams.adminName || foundBackup?.adminName || `Quản trị viên ${targetName}`.trim(),
            assignedPasswordHint: urlParams.pass || foundBackup?.assignedPasswordHint || undefined,
            status: foundBackup?.status || 'active',
            planType: foundBackup?.planType || 'annual',
            expiresAt: foundBackup?.expiresAt || '2027-08-31T23:59:59.000Z',
            contactPhone: foundBackup?.contactPhone || '',
            notes: foundBackup?.notes || 'Được tự động nạp từ liên kết chia sẻ trực tiếp',
            createdAt: foundBackup?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.schoolLicenses.push(autoLic);
        }
        this.saveLocalCacheOnly();

        // Đảm bảo tài khoản quản trị trường học tồn tại trong users để xác thực phân quyền
        const targetAdminEmail = urlParams.adminEmail || this.getSchoolLicenseById(urlSchoolId)?.adminEmail;
        if (targetAdminEmail) {
          const hasUser = this.users.some((u) => isSameEmail(u.email, targetAdminEmail) && u.schoolId === urlSchoolId);
          if (!hasUser) {
            this.users.push({
              id: `usr_admin_${urlSchoolId}`,
              name: urlParams.adminName || this.getSchoolLicenseById(urlSchoolId)?.adminName || 'Quản trị viên trường',
              email: targetAdminEmail,
              schoolId: urlSchoolId,
              role: 'admin',
              roleTitle: 'Quản trị viên trường',
              permission: 'edit',
              status: 'active',
            });
          }
        }
      }

      this.abbreviationRules = this.getItem(STORAGE_KEYS.ABBREVIATION_RULES, INITIAL_ABBREVIATION_RULES);
      if (!this.abbreviationRules || this.abbreviationRules.length === 0) {
        this.abbreviationRules = [...INITIAL_ABBREVIATION_RULES];
        this.saveLocalCacheOnly();
      } else {
        // Tự động khử trùng lặp và đồng bộ các quy tắc chuẩn mới nhất (mỗi nhiệm vụ 1 định nghĩa duy nhất + biến thể tham chiếu)
        this.deduplicateAbbreviationRules();
      }

      // NORMALIZE DEPARTMENTS: Support multiple vice leaders (1, 2, 3... tổ phó)
      this.departments = this.departments.map((d) => {
        const cleanMembers = (d.teacherIds || []).filter((tid) => tid !== 'tc_hoang_lan');
        const head = d.headTeacherId === 'tc_hoang_lan' ? undefined : d.headTeacherId;

        let deputyIds: string[] = [];
        if (Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.length > 0) {
          deputyIds = d.deputyTeacherIds.filter((tid) => tid && tid !== 'tc_hoang_lan');
        } else if (d.deputyTeacherId && d.deputyTeacherId !== 'tc_hoang_lan') {
          deputyIds = [d.deputyTeacherId];
        }

        deputyIds = Array.from(new Set(deputyIds));

        return {
          ...d,
          teacherIds: cleanMembers,
          headTeacherId: head,
          deputyTeacherId: deputyIds[0] || undefined,
          deputyTeacherIds: deputyIds,
        };
      });

      // Nạp dữ liệu riêng biệt của tenant hiện tại TRƯỚC KHI đồng bộ & lưu cache
      if (this.currentSchoolId) {
        this.loadTenantData(this.currentSchoolId);
      }

      // Tự động đồng bộ số tiết phân công theo định mức (Excel-like) và chức vụ kiêm nhiệm Tổ trưởng & Tổ phó
      this.syncAllAssignmentsWithQuotas();
      this.syncAllDepartmentDutiesAndAssignments();

      // Persist the clean state
      this.saveLocalCacheOnly();

      const session = this.getItem(STORAGE_KEYS.ACTIVE_SESSION, null);
      if (session && !urlSchoolId) {
        if (session.userId) {
          const user = this.users.find((u) => u.id === session.userId) || INITIAL_USER_PROFILES.find((u) => u.id === session.userId);
          if (user) {
            const isGenuineSuper = isSuperAdminEmail(user.email);
            this.currentUser = {
              ...user,
              isSuperAdmin: isGenuineSuper,
            };
          }
        }
        if (session.schoolYearId) this.currentSchoolYearId = session.schoolYearId;
        if (session.semesterId) this.currentSemesterId = session.semesterId;
        if (session.versionId && session.versionId !== 'ver_hk1_v1') {
          this.currentVersionId = session.versionId;
        } else {
          this.currentVersionId = 'ver_hk1_official';
        }
      } else if (urlSchoolId) {
        // Khi mở qua link chia sẻ trường học chuyên dụng (?schoolId=...):
        const isAuthedForThisSchool = typeof window !== 'undefined' && sessionStorage.getItem(`pccm_session_auth_${urlSchoolId}`) === 'true';
        const authedEmail = typeof window !== 'undefined' ? sessionStorage.getItem('pccm_session_user_email') : null;
        if (isAuthedForThisSchool) {
          const matchedUser = this.users.find((u) => u.schoolId === urlSchoolId && (authedEmail ? isSameEmail(u.email, authedEmail) : u.role === 'admin'));
          if (matchedUser) {
            this.currentUser = { ...matchedUser, permission: 'edit' };
          } else {
            this.currentUser = {
              id: `usr_admin_${urlSchoolId}`,
              name: this.schoolInfo.schoolName || 'Quản trị viên trường',
              email: authedEmail || 'admin@truong.edu.vn',
              schoolId: urlSchoolId,
              role: 'admin',
              roleTitle: 'Quản trị viên trường',
              permission: 'edit',
              status: 'active',
            };
          }
        } else {
          this.currentUser = DEFAULT_GUEST_PROFILE;
        }
      }

      // Đảm bảo không bao giờ tồn đọng tài khoản sync làm currentUser
      if (isSystemSyncEmail(this.currentUser?.email)) {
        this.currentUser = DEFAULT_GUEST_PROFILE;
      }

      this.hasUnsavedChangesFlag = false;
    } catch (e) {
      console.warn('Fallback to initial seed data due to store error', e);
      this.resetToDefaultSeed();
    }
  }

  private getItem<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Lỗi ghi localStorage:', e);
    }
  }

  /**
   * Tự động nâng cấp danh mục chuẩn (Môn học split KHTN/LS&ĐL, Khung PPCT chuẩn, Nhiệm vụ chuẩn)
   * cho bất kỳ trường học (tenant) nào để bảo đảm bản quyền của trường luôn có đầy đủ tính năng mới nhất
   */
  public upgradeTenantStandardCatalog(schoolId: string = this.currentSchoolId): void {
    if (!schoolId) return;

    // 1. Đồng bộ môn học chuẩn (Đặc biệt: KHTN Lý/Hóa/Sinh, LS&ĐL Sử/Địa, GDQP, Âm nhạc, Mỹ thuật)
    const existingSubjectCodes = new Set(this.subjects.map((s) => s.code));
    const existingSubjectIds = new Set(this.subjects.map((s) => s.id));

    INITIAL_SUBJECTS.forEach((initSub) => {
      if (!existingSubjectCodes.has(initSub.code) && !existingSubjectIds.has(initSub.id)) {
        this.subjects.push({ ...initSub });
        existingSubjectCodes.add(initSub.code);
        existingSubjectIds.add(initSub.id);
      }
    });

    // Chuẩn hóa applicableGrades cho các môn học
    this.subjects = this.subjects.map((s) => {
      let grades = s.applicableGrades;
      if (!grades || grades.length === 0) {
        if (s.code === 'KHTN_LY' || s.code === 'KHTN_HOA' || s.code === 'KHTN_SINH') {
          grades = [8, 9];
        } else if (s.code === 'KHTN') {
          grades = [6, 7];
        } else {
          grades = [6, 7, 8, 9];
        }
      }
      return {
        ...s,
        applicableGrades: grades,
      };
    });

    // 2. Đồng bộ Khung phân phối chương trình chuẩn (INITIAL_CURRICULUM)
    if (!this.curriculum || this.curriculum.length === 0) {
      this.curriculum = [...INITIAL_CURRICULUM];
    } else {
      const currKey = (c: CurriculumDistribution) => `${c.schoolYearId || 'sy_2026_2027'}_${c.semesterId}_${c.grade}_${c.subjectId}`;
      const existingCurrKeys = new Set(this.curriculum.map(currKey));

      INITIAL_CURRICULUM.forEach((initCurr) => {
        const k = currKey(initCurr);
        if (!existingCurrKeys.has(k)) {
          this.curriculum.push({ ...initCurr });
          existingCurrKeys.add(k);
        }
      });
    }

    // 3. Đồng bộ Danh mục nhiệm vụ kiêm nhiệm chuẩn (INITIAL_DUTIES)
    if (!this.duties || this.duties.length === 0) {
      this.duties = [...INITIAL_DUTIES];
    } else {
      const dutyNameMap = new Map(this.duties.map((d) => [d.name.toLowerCase().trim(), d]));
      const dutyCodeMap = new Map(this.duties.map((d) => [d.code.toLowerCase().trim(), d]));

      INITIAL_DUTIES.forEach((initDuty) => {
        const normName = initDuty.name.toLowerCase().trim();
        const normCode = initDuty.code.toLowerCase().trim();
        if (!dutyNameMap.has(normName) && !dutyCodeMap.has(normCode)) {
          this.duties.push({ ...initDuty });
          dutyNameMap.set(normName, initDuty);
          dutyCodeMap.set(normCode, initDuty);
        }
      });
    }

    // Bỏ hoàn toàn nhiệm vụ miễn tiết mặc định cho Hiệu trưởng, Phó hiệu trưởng và Nghỉ sinh theo yêu cầu
    this.duties = this.duties.filter((d) => !isForbiddenDutyOrExemption(d));

    // 4. Đồng bộ Năm học & Phiên bản
    if (!this.schoolYears || this.schoolYears.length === 0) {
      this.schoolYears = [...INITIAL_SCHOOL_YEARS];
    }
    if (!this.versions || this.versions.length === 0) {
      this.versions = [...INITIAL_VERSIONS];
    }

    // 5. Triệt tiêu phân công kiêm nhiệm trùng lặp
    this.deduplicateDutyAssignments();
  }

  /**
   * Helper tạo scoped key cho localStorage theo từng trường/tenant
   * Trường gốc 'school_quyhop' dùng key mặc định để duy trì tính tương thích
   */
  public getScopedKey(baseKey: string, schoolId: string = this.currentSchoolId): string {
    if (!schoolId) {
      return baseKey;
    }
    return `${baseKey}_${schoolId}`;
  }

  /**
   * Nạp dữ liệu riêng biệt cho từng trường học (Tenant data isolation)
   * Nếu là trường mới chưa có dữ liệu: Khởi tạo DỮ LIỆU TRẮNG (Clean slate) hoàn toàn
   */
  public loadTenantData(schoolId: string): void {
    if (!schoolId) return;

    const isQuyHop = schoolId === 'school_quyhop';
    const scopedInfoKey = this.getScopedKey(STORAGE_KEYS.SCHOOL_INFO, schoolId);
    let existingSavedInfo = this.getItem<SchoolInfo | null>(scopedInfoKey, null);
    if (!existingSavedInfo && isQuyHop) {
      const baseInfo = this.getItem<SchoolInfo | null>(STORAGE_KEYS.SCHOOL_INFO, null);
      if (baseInfo && baseInfo.schoolName && baseInfo.schoolName.toUpperCase().includes('QUỲ HỢP')) {
        existingSavedInfo = baseInfo;
      }
    }

    const license = this.getSchoolLicenseById(schoolId);
    const urlParams = this.detectUrlSchoolParams();
    const targetSchoolName = license?.schoolName || (urlParams.schoolId === schoolId ? urlParams.schoolName : null);
    const targetEmail = license?.adminEmail || (urlParams.schoolId === schoolId ? urlParams.adminEmail : null);

    if (existingSavedInfo && existingSavedInfo.schoolName) {
      let cleanSchoolName = targetSchoolName || existingSavedInfo.schoolName;
      let cleanAuthority = existingSavedInfo.authorityName || '';
      let cleanPrincipal = existingSavedInfo.principalName || '';
      let cleanDean = existingSavedInfo.deanName || '';
      let cleanProvince = existingSavedInfo.provinceName || '';

      if (!isQuyHop) {
        if (!targetSchoolName && cleanSchoolName.toUpperCase().includes('HIM LAM')) {
          cleanSchoolName = 'TRƯỜNG THCS MỚI';
        }
        if (!cleanAuthority || cleanAuthority.toUpperCase().includes('QUỲ HỢP') || cleanAuthority.toUpperCase().includes('PHÒNG GIÁO DỤC') || cleanAuthority.toUpperCase().includes('PHÒNG GD') || cleanAuthority.toUpperCase().includes('NGHỆ AN')) {
          cleanAuthority = 'ỦY BAN NHÂN DÂN XÃ';
        }
        if (!cleanPrincipal || cleanPrincipal.includes('Nguyễn Văn Toàn')) {
          cleanPrincipal = 'Nguyễn Văn A';
        }
        if (!cleanDean || cleanDean.includes('Trần Văn Minh')) {
          cleanDean = 'Trần Văn B';
        }
        if (cleanProvince.toUpperCase().includes('NGHỆ AN') || cleanProvince.toUpperCase().includes('QUỲ HỢP')) {
          cleanProvince = '';
        }
      }

      let cleanEmail = !isQuyHop && targetEmail ? targetEmail : (existingSavedInfo.email || '');
      if (!isQuyHop && (!cleanEmail || cleanEmail === 'nguyentoanqh@gmail.com' || cleanEmail.includes('nguyentoanqhios') || cleanEmail.includes('nguyentoanqhai'))) {
        cleanEmail = targetEmail || 'c2truong@edu.vn';
      }
      let cleanPhone = !isQuyHop && license?.contactPhone ? license.contactPhone : (existingSavedInfo.phone || '');
      if (!isQuyHop && (!cleanPhone || cleanPhone === '0961 285 888' || cleanPhone === '0961285888' || cleanPhone === '0961234567')) {
        cleanPhone = license?.contactPhone || '0987654321';
      }

      this.schoolInfo = {
        ...existingSavedInfo,
        schoolName: cleanSchoolName,
        authorityName: cleanAuthority,
        principalName: cleanPrincipal,
        deanName: cleanDean,
        provinceName: cleanProvince,
        email: cleanEmail,
        phone: cleanPhone,
      };

      const loadedTeachers = this.getItem<Teacher[] | null>(this.getScopedKey(STORAGE_KEYS.TEACHERS, schoolId), null);
      this.teachers = Array.isArray(loadedTeachers)
        ? loadedTeachers
            .filter((t) => (t.schoolId === schoolId || !t.schoolId) && !/^tc_gv\d+$/.test(t.id))
            .map((t) => ({ ...t, schoolId }))
        : [];

      const loadedClasses = this.getItem<SchoolClass[] | null>(this.getScopedKey(STORAGE_KEYS.CLASSES, schoolId), null);
      this.classes = Array.isArray(loadedClasses)
        ? loadedClasses.map((c) => ({ ...c, schoolId: c.schoolId || schoolId }))
        : [];

      const loadedAssignments = this.getItem<TeachingAssignment[] | null>(this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, schoolId), null);
      const validTeacherIds = new Set(this.teachers.filter((t) => !t.isDeleted).map((t) => t.id));
      this.assignments = Array.isArray(loadedAssignments)
        ? loadedAssignments
            .filter((a) => (a.schoolId === schoolId || !a.schoolId) && validTeacherIds.has(a.teacherId) && !/^tc_gv\d+$/.test(a.teacherId))
            .map((a) => ({ ...a, schoolId }))
        : [];

      this.branches = this.getItem(this.getScopedKey(STORAGE_KEYS.BRANCHES, schoolId), [...INITIAL_BRANCHES]);
      this.departments = this.getItem(this.getScopedKey(STORAGE_KEYS.DEPARTMENTS, schoolId), INITIAL_DEPARTMENTS.map((d) => ({
        ...d,
        schoolId,
        teacherIds: [],
        headTeacherId: undefined,
        deputyTeacherId: undefined,
        deputyTeacherIds: [],
      })));
      this.workplaces = this.getItem(this.getScopedKey(STORAGE_KEYS.WORKPLACES, schoolId), INITIAL_WORKPLACES);
      this.subjects = this.deduplicateSubjectsList(this.getItem(this.getScopedKey(STORAGE_KEYS.SUBJECTS, schoolId), [...INITIAL_SUBJECTS]));
      this.schoolYears = this.getItem(this.getScopedKey(STORAGE_KEYS.SCHOOL_YEARS, schoolId), [...INITIAL_SCHOOL_YEARS]);
      const loadedCurriculum = this.getItem<CurriculumDistribution[] | null>(this.getScopedKey(STORAGE_KEYS.CURRICULUM, schoolId), null);
      this.curriculum = (loadedCurriculum && loadedCurriculum.length > 0)
        ? loadedCurriculum
        : [...INITIAL_CURRICULUM];
      const loadedDuties = this.getItem(this.getScopedKey(STORAGE_KEYS.DUTIES, schoolId), INITIAL_DUTIES);
      this.duties = (Array.isArray(loadedDuties) ? loadedDuties : [...INITIAL_DUTIES]).filter((d: SpecialDuty) => !isForbiddenDutyOrExemption(d));
      this.setItem(this.getScopedKey(STORAGE_KEYS.DUTIES, schoolId), this.duties);
      this.assignments = this.assignments.filter((a) => !isForbiddenDutyOrExemption(a));
      this.versions = this.getItem(this.getScopedKey(STORAGE_KEYS.VERSIONS, schoolId), INITIAL_VERSIONS);
      this.cleanOrphanedAssignments();
      this.isTenantDataLoaded = true;
      this.saveLocalCacheOnly();
    } else if (isQuyHop) {
      // DỮ LIỆU SẠCH BAN ĐẦU TRƯỜNG THCS QUỲ HỢP (Chỉ có sẵn môn, khung tiết, chức danh kiêm nhiệm, viết tắt)
      const qLicense = this.getSchoolLicenseById('school_quyhop');
      this.schoolInfo = {
        ...DEFAULT_SCHOOL_INFO,
        schoolName: qLicense?.schoolName || DEFAULT_SCHOOL_INFO.schoolName,
        phone: qLicense?.contactPhone || DEFAULT_SCHOOL_INFO.phone,
        email: qLicense?.adminEmail || DEFAULT_SCHOOL_INFO.email,
      };
      this.teachers = [];
      this.classes = [];
      this.assignments = [];
      this.branches = [...INITIAL_BRANCHES];
      this.departments = INITIAL_DEPARTMENTS.map((d) => ({
        ...d,
        schoolId: 'school_quyhop',
        teacherIds: [],
        headTeacherId: undefined,
        deputyTeacherId: undefined,
        deputyTeacherIds: [],
      }));
      this.workplaces = [...INITIAL_WORKPLACES];
      this.curriculum = [...INITIAL_CURRICULUM];
      this.duties = [...INITIAL_DUTIES];
      this.upgradeTenantStandardCatalog(schoolId);
      this.cleanOrphanedAssignments();
      this.isTenantDataLoaded = true;
      this.saveLocalCacheOnly();

    } else {
      // DỮ LIỆU TRẮNG CHO TRƯỜNG MỚI / TENANT MỚI (TRẮNG HOÀN TOÀN)
      const freshSchoolName = targetSchoolName || 'TRƯỜNG THCS MỚI';
      const freshEmail = targetEmail || '';
      this.schoolInfo = {
        ...DEFAULT_SCHOOL_INFO,
        schoolName: freshSchoolName,
        authorityName: '',
        provinceName: '',
        principalName: license?.adminName || '',
        deanName: '',
        phone: license?.contactPhone || '',
        email: freshEmail || license?.adminEmail || '',
        schoolYear: '2026-2027',
        branchName: '',
      };
      this.teachers = []; // TRẮNG: 0 Giáo viên
      this.classes = []; // TRẮNG: 0 Lớp học
      this.assignments = []; // TRẮNG: 0 Phân công
      this.curriculum = [...INITIAL_CURRICULUM]; // Phân phối chuẩn GDPT của Bộ GD&ĐT
      this.branches = [...INITIAL_BRANCHES];
      this.departments = INITIAL_DEPARTMENTS.map((d) => ({
        ...d,
        schoolId,
        teacherIds: [],
        headTeacherId: undefined,
        deputyTeacherId: undefined,
        deputyTeacherIds: [],
      }));
      this.workplaces = [...INITIAL_WORKPLACES];
      this.duties = [...INITIAL_DUTIES];
      this.subjects = this.deduplicateSubjectsList([...INITIAL_SUBJECTS]);
      this.schoolYears = [...INITIAL_SCHOOL_YEARS];
      this.versions = [...INITIAL_VERSIONS];
      if (license && license.schoolName) {
        this.setInitialSetupCompleted(true);
      } else {
        this.setInitialSetupCompleted(false);
      }
      this.upgradeTenantStandardCatalog(schoolId);
      this.cleanOrphanedAssignments();
      this.isTenantDataLoaded = true;
      this.saveLocalCacheOnly();
    }
  }

  private saveLocalCacheOnly() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.SCHOOL_ID, JSON.stringify(this.currentSchoolId));
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users.filter((u) => !isSystemSyncEmail(u.email))));
      localStorage.setItem(STORAGE_KEYS.SCHOOL_LICENSES, JSON.stringify(this.schoolLicenses));
      localStorage.setItem(STORAGE_KEYS.ABBREVIATION_RULES, JSON.stringify(this.abbreviationRules));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
      localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(this.feedbacks));
      localStorage.setItem(STORAGE_KEYS.BACKUPS, JSON.stringify(this.backups));

      const sId = this.currentSchoolId || 'school_quyhop';
      if (!this.isTenantDataLoaded && sId !== 'school_quyhop') {
        // Prevent writing un-scoped global state to tenant scoped cache before loadTenantData completes
        return;
      }
      localStorage.setItem(STORAGE_KEYS.SCHOOL_ID, JSON.stringify(sId));
      const scopedKey = (base: string) => this.getScopedKey(base, sId);

      localStorage.setItem(scopedKey(STORAGE_KEYS.SCHOOL_INFO), JSON.stringify(this.schoolInfo));
      localStorage.setItem(scopedKey(STORAGE_KEYS.SCHOOL_YEARS), JSON.stringify(this.schoolYears));
      localStorage.setItem(scopedKey(STORAGE_KEYS.VERSIONS), JSON.stringify(this.versions));
      localStorage.setItem(scopedKey(STORAGE_KEYS.BRANCHES), JSON.stringify(this.branches));
      localStorage.setItem(scopedKey(STORAGE_KEYS.WORKPLACES), JSON.stringify(this.workplaces));
      localStorage.setItem(scopedKey(STORAGE_KEYS.DEPARTMENTS), JSON.stringify(this.departments));
      localStorage.setItem(scopedKey(STORAGE_KEYS.DUTIES), JSON.stringify(this.duties));
      localStorage.setItem(scopedKey(STORAGE_KEYS.CLASSES), JSON.stringify(this.classes));
      localStorage.setItem(scopedKey(STORAGE_KEYS.SUBJECTS), JSON.stringify(this.subjects));
      localStorage.setItem(scopedKey(STORAGE_KEYS.CURRICULUM), JSON.stringify(this.curriculum));
      localStorage.setItem(scopedKey(STORAGE_KEYS.TEACHERS), JSON.stringify(this.teachers));
      localStorage.setItem(scopedKey(STORAGE_KEYS.ASSIGNMENTS), JSON.stringify(this.assignments));

      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_SESSION,
        JSON.stringify({
          userId: this.currentUser?.id,
          schoolYearId: this.currentSchoolYearId,
          semesterId: this.currentSemesterId,
          versionId: this.currentVersionId,
        })
      );
    } catch (e) {
      console.error('Error saving local cache', e);
    }
  }

  private saveDebounceTimer: any = null;

  public hasUnsavedChanges(): boolean {
    return this.hasUnsavedChangesFlag;
  }

  public setHasUnsavedChanges(val: boolean) {
    this.hasUnsavedChangesFlag = val;
    if (typeof window !== 'undefined') {
      try {
        const sId = this.currentSchoolId || 'school_quyhop';
        localStorage.setItem(this.getScopedKey('pccm_has_unsaved_changes', sId), val ? 'true' : 'false');
      } catch {}
    }
    this.notify();
  }

  public saveLocalNow(): void {
    this.flushStorage();
    this.setHasUnsavedChanges(false);
  }

  /**
   * Hủy bỏ toàn bộ các thay đổi chưa lưu: Khôi phục lại trạng thái đã lưu trước đó từ bộ nhớ
   */
  public discardUnsavedChanges(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    const sId = this.currentSchoolId || 'school_quyhop';
    this.loadTenantData(sId);
    this.hasUnsavedChangesFlag = false;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.getScopedKey('pccm_has_unsaved_changes', sId), 'false');
      } catch {}
    }
    this.notify();
  }

  public flushStorage() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.saveLocalCacheOnly();
  }

  private saveToStorage(immediate = false) {
    if (!this.isInitializing) {
      this.hasUnsavedChangesFlag = true;
      if (typeof window !== 'undefined') {
        try {
          const sId = this.currentSchoolId || 'school_quyhop';
          localStorage.setItem(this.getScopedKey('pccm_has_unsaved_changes', sId), 'true');
        } catch {}
      }
    }
    if (immediate) {
      this.flushStorage();
    } else {
      if (!this.saveDebounceTimer) {
        this.saveDebounceTimer = setTimeout(() => {
          this.saveDebounceTimer = null;
          this.saveLocalCacheOnly();
        }, 100);
      }
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // School Information
  public getSchoolInfo(): SchoolInfo {
    const isQuyHop = this.currentSchoolId === 'school_quyhop';
    const lic = this.getSchoolLicenseById(this.currentSchoolId);
    const urlParams = this.detectUrlSchoolParams();

    let name = this.schoolInfo.schoolName;
    if (!name || name === 'TRƯỜNG THCS MỚI') {
      if (lic && lic.schoolName && lic.schoolName !== 'TRƯỜNG THCS MỚI') {
        name = lic.schoolName;
      } else if (urlParams.schoolId === this.currentSchoolId && urlParams.schoolName && urlParams.schoolName !== 'TRƯỜNG THCS MỚI') {
        name = urlParams.schoolName;
      } else if (isQuyHop) {
        name = 'TRƯỜNG THCS QUỲ HỢP';
      }
    }

    return {
      ...this.schoolInfo,
      schoolName: name,
    };
  }

  public setSchoolInfo(info: Partial<SchoolInfo>) {
    this.schoolInfo = { ...this.schoolInfo, ...info };

    // Cập nhật license tương ứng nếu có đổi tên trường, email, số điện thoại hoặc tên hiệu trưởng
    const lic = this.getSchoolLicenseById(this.currentSchoolId);
    if (lic) {
      if (info.schoolName && info.schoolName !== lic.schoolName) {
        lic.schoolName = info.schoolName;
      }
      if (info.email && info.email !== lic.adminEmail) {
        lic.adminEmail = info.email;
      }
      if (info.phone && info.phone !== lic.contactPhone) {
        lic.contactPhone = info.phone;
      }
      if (info.principalName && info.principalName !== lic.adminName) {
        lic.adminName = info.principalName;
      }
      this.saveSchoolLicense(lic).catch(() => {});
    }

    // Cập nhật registry scoped schoolInfo
    const scopedKey = this.getScopedKey(STORAGE_KEYS.SCHOOL_INFO, this.currentSchoolId);
    this.setItem(scopedKey, this.schoolInfo);
    if (this.currentSchoolId === 'school_quyhop') {
      this.setItem(STORAGE_KEYS.SCHOOL_INFO, this.schoolInfo);
    }
    this.schoolInfoByTenant[this.currentSchoolId] = { ...this.schoolInfo };
    this.setItem('pccm_school_info_tenants_v1', this.schoolInfoByTenant);

    this.saveLocalCacheOnly();
    this.saveToStorage();
    if (this.currentSchoolId) {
      firestoreRepository.setSchoolInfo(this.currentSchoolId, this.schoolInfo).catch((err) => {
        console.warn('Firestore setSchoolInfo error:', err);
      });
    }
    this.notify();
  }

  public setSchoolInfoForSchool(schoolId: string, info: Partial<SchoolInfo>) {
    if (!schoolId) return;
    const scopedKey = this.getScopedKey(STORAGE_KEYS.SCHOOL_INFO, schoolId);
    const existing = this.getItem<SchoolInfo>(scopedKey, DEFAULT_SCHOOL_INFO);
    const updated = { ...existing, ...info };
    this.setItem(scopedKey, updated);
    this.schoolInfoByTenant[schoolId] = updated;
    this.setItem('pccm_school_info_tenants_v1', this.schoolInfoByTenant);
    if (schoolId === this.currentSchoolId) {
      this.schoolInfo = updated;
      this.notify();
    }
    firestoreRepository.setSchoolInfo(schoolId, updated).catch(() => {});
  }

  public isInitialSetupCompleted(): boolean {
    if (this.currentSchoolId === 'school_quyhop') return true;
    const lic = this.getSchoolLicenseById(this.currentSchoolId);
    if (lic && lic.schoolName) return true;
    const key = `${STORAGE_KEYS.INITIAL_SETUP_COMPLETED}_${this.currentSchoolId || 'school_quyhop'}`;
    return this.getItem(key, false);
  }

  public setInitialSetupCompleted(completed: boolean): void {
    if (typeof window !== 'undefined') {
      const key = `${STORAGE_KEYS.INITIAL_SETUP_COMPLETED}_${this.currentSchoolId || 'school_quyhop'}`;
      localStorage.setItem(key, JSON.stringify(completed));
    }
    this.listeners.forEach((l) => l());
  }

  /**
   * Khai báo thông tin trường và danh mục các điểm trường
   * Tự động đồng bộ sang Workplaces và bảo đảm các lớp học, giáo viên liên kết đúng.
   */
  public setupSchoolAndBranches(
    schoolData: Partial<SchoolInfo>,
    branchesList: SchoolBranch[],
    options?: { cleanSlate?: boolean }
  ): void {
    // 1. Cập nhật thông tin trường (Khóa tên trường với tài khoản không phải Chủ sở hữu)
    const isSuper = isSuperAdminEmail(this.currentUser.email) || Boolean(this.currentUser.isSuperAdmin);
    const lic = this.getSchoolLicenseById(this.currentSchoolId);
    let finalSchoolName = schoolData.schoolName;
    if (!isSuper && lic && lic.schoolName) {
      finalSchoolName = lic.schoolName;
    }

    this.schoolInfo = {
      ...this.schoolInfo,
      ...schoolData,
      ...(finalSchoolName ? { schoolName: finalSchoolName } : {}),
    };

    // 2. Cập nhật danh sách điểm trường
    const hasMain = branchesList.some((b) => b.isMain);
    const sanitizedBranches: SchoolBranch[] = branchesList.map((b, idx) => {
      const isMain = hasMain ? Boolean(b.isMain) : idx === 0;
      let name = (b.name || '').trim();
      if (!name) {
        name = isMain ? 'Điểm chính' : `Điểm lẻ ${idx + 1}`;
      } else if (isMain && (name.toLowerCase() === 'điểm trường chính' || name.toLowerCase() === 'điểm chính')) {
        name = 'Điểm chính';
      }
      return {
        ...b,
        name,
        order: idx + 1,
        isMain,
        active: b.active !== false,
      };
    });
    this.branches = sanitizedBranches;

    // 3. Đồng bộ danh mục Nơi làm việc (Workplaces)
    const allWp = this.workplaces.find((w) => w.id === 'wp_all' || w.name === 'Toàn trường') || {
      id: 'wp_all',
      code: 'TT',
      name: 'Toàn trường',
      description: 'Công tác hoặc phụ trách chung toàn trường',
      color: 'indigo',
      isDefault: false,
      active: true,
      order: 0,
    };

    const newWorkplaces: WorkplaceCategory[] = [allWp];
    sanitizedBranches.forEach((b, idx) => {
      newWorkplaces.push({
        id: b.id,
        code: b.code || (b.isMain ? 'DC' : `PH${idx}`),
        name: b.name,
        description: b.notes || (b.isMain ? 'Điểm chính của trường' : `Phân hiệu / Điểm trường ${b.name}`),
        color: b.isMain ? 'blue' : idx === 1 ? 'amber' : idx === 2 ? 'emerald' : 'purple',
        isDefault: b.isMain,
        active: b.active !== false,
        order: idx + 1,
      });
    });
    this.workplaces = newWorkplaces;

    // 4. Nếu yêu cầu bắt đầu dữ liệu trống cho trường mới
    if (options?.cleanSlate) {
      this.teachers = [];
      this.classes = [];
      this.assignments = [];
    } else {
      // Tự động map lại các lớp học hiện có vào điểm trường hợp lệ
      const validBranchIds = new Set(this.branches.map((b) => b.id));
      const mainBranchId = this.branches.find((b) => b.isMain)?.id || this.branches[0]?.id || 'branch_main';
      this.classes = this.classes.map((c) => ({
        ...c,
        branchId: c.branchId && validBranchIds.has(c.branchId) ? c.branchId : mainBranchId,
      }));
    }

    this.setInitialSetupCompleted(true);

    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: 'school_setup',
      entityDescription: `Thiết lập trường học "${this.schoolInfo.schoolName}" với ${this.branches.length} điểm trường`,
      afterData: { school: this.schoolInfo, branches: this.branches },
    });

    this.saveToStorage();
  }

  /**
   * Reset the entire system to a completely empty/clean slate (dữ liệu trống)
   * with custom school info, ready for a fresh start or new school setup.
   */
  public resetToBlank(customSchoolInfo?: Partial<SchoolInfo>) {
    if (customSchoolInfo) {
      this.schoolInfo = { ...this.schoolInfo, ...customSchoolInfo };
    }
    this.teachers = [];
    this.classes = [];
    this.assignments = [];
    this.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        userRole: this.currentUser.role,
        action: 'BLANK_RESET',
        entityType: 'VERSION',
        entityId: 'root',
        entityDescription: `Đã reset hệ thống về trạng thái dữ liệu trống cho: ${this.schoolInfo.schoolName} (${this.schoolInfo.schoolYear})`,
      },
    ];
    this.feedbacks = [];
    this.currentSchoolYearId = 'sy_2026_2027';
    this.currentSemesterId = 'HK1';
    this.currentVersionId = 'ver_hk1_official';
    this.saveToStorage();
  }

  public resetToDefaultSeed() {
    this.restoreQuyHopData();
  }

  /**
   * Mở lại và khôi phục toàn diện dữ liệu chính thức TRƯỜNG THCS QUỲ HỢP
   */
  public restoreQuyHopData(): void {
    this.currentSchoolId = 'school_quyhop';
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.SCHOOL_ID, JSON.stringify('school_quyhop'));
        const isSuper = this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email);
        if (isSuper) {
          sessionStorage.setItem('pccm_session_auth_school_quyhop', 'true');
          sessionStorage.setItem('pccm_session_school_id', 'school_quyhop');
          sessionStorage.setItem('pccm_authenticated_session', 'true');
        }
        const url = new URL(window.location.href);
        url.searchParams.set('schoolId', 'school_quyhop');
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }

    const license = this.getSchoolLicenseById('school_quyhop');
    this.schoolInfo = {
      ...QUYHOP_SCHOOL_INFO,
      schoolName: license?.schoolName || QUYHOP_SCHOOL_INFO.schoolName,
      phone: license?.contactPhone || QUYHOP_SCHOOL_INFO.phone,
      email: license?.adminEmail || QUYHOP_SCHOOL_INFO.email,
    };
    this.teachers = [...QUYHOP_TEACHERS];
    this.classes = [...QUYHOP_CLASSES];
    this.assignments = generateQuyHopAssignments();
    this.departments = [...QUYHOP_DEPARTMENTS];
    this.branches = [...QUYHOP_BRANCHES];
    this.schoolYears = [...INITIAL_SCHOOL_YEARS];
    this.versions = [...INITIAL_VERSIONS];
    this.workplaces = [...INITIAL_WORKPLACES];
    this.duties = [...INITIAL_DUTIES];
    this.subjects = [...INITIAL_SUBJECTS];
    this.curriculum = [...INITIAL_CURRICULUM];

    this.auditLogs = [
      {
        id: `audit_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: this.currentUser.id,
        userName: this.currentUser.name,
        userRole: this.currentUser.role,
        action: 'SEED_RESET',
        entityType: 'VERSION',
        entityId: 'root',
        entityDescription: 'Đã mở lại và khôi phục toàn bộ cơ sở dữ liệu chính thức TRƯỜNG THCS QUỲ HỢP (42 lớp - 74 giáo viên)',
      },
    ];

    this.currentSchoolYearId = 'sy_2026_2027';
    this.currentSemesterId = 'HK1';
    this.currentVersionId = 'ver_hk1_official';

    // Tạo bản snapshot chuẩn trong danh sách backups nếu chưa có
    if (!this.backups.some((b) => b.id === 'backup_quyhop_benchmark')) {
      const nowIso = new Date().toISOString();
      this.backups.unshift({
        id: 'backup_quyhop_benchmark',
        title: 'Bản gốc TRƯỜNG THCS QUỲ HỢP (42 lớp - 74 GV)',
        createdAt: nowIso,
        createdBy: 'Hệ thống Quản trị',
        versionCount: 2,
        teacherCount: this.teachers.length,
        assignmentCount: this.assignments.length,
        tenantId: 'school_quyhop',
        schoolName: 'TRƯỜNG THCS QUỲ HỢP',
        dataJson: JSON.stringify({
          tenantId: 'school_quyhop',
          schoolName: 'TRƯỜNG THCS QUỲ HỢP',
          schoolInfo: this.schoolInfo,
          schoolYears: this.schoolYears,
          versions: this.versions,
          branches: this.branches,
          workplaces: this.workplaces,
          departments: this.departments,
          duties: this.duties,
          classes: this.classes,
          subjects: this.subjects,
          curriculum: this.curriculum,
          teachers: this.teachers,
          assignments: this.assignments,
          feedbacks: this.feedbacks,
          abbreviationRules: this.abbreviationRules,
          currentSchoolYearId: this.currentSchoolYearId,
          currentSemesterId: this.currentSemesterId,
          currentVersionId: this.currentVersionId,
        }),
      });
    }

    // Lưu cache dùng chung và scoped cho school_quyhop
    this.saveToStorage();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.SCHOOL_INFO, 'school_quyhop'), JSON.stringify(this.schoolInfo));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.TEACHERS, 'school_quyhop'), JSON.stringify(this.teachers));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.CLASSES, 'school_quyhop'), JSON.stringify(this.classes));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, 'school_quyhop'), JSON.stringify(this.assignments));
      } catch {}
    }

    this.initFirestoreRealtimeSync('school_quyhop');
    this.notify();
  }

  // Session, Users & Role management
  public getCurrentUser(): UserProfile {
    if (typeof window !== 'undefined') {
      const isAuthed = sessionStorage.getItem('pccm_authenticated_session') === 'true';
      const isSuper = sessionStorage.getItem('pccm_is_super_admin') === 'true' ||
                      isSuperAdminEmail(this.currentUser?.email) ||
                      Boolean(this.currentUser?.isSuperAdmin);
      const isSchoolAuthed = sessionStorage.getItem(`pccm_session_auth_${this.currentSchoolId}`) === 'true';
      if (isAuthed || isSuper || isSchoolAuthed) {
        if (this.currentUser.permission !== 'edit') {
          return {
            ...this.currentUser,
            permission: 'edit',
            role: this.currentUser.role === 'teacher' ? 'admin' : (this.currentUser.role || 'admin'),
          };
        }
      }
    }
    return this.currentUser;
  }

  public isCurrentUserSuperAdmin(): boolean {
    return Boolean(isSuperAdminEmail(this.currentUser?.email));
  }

  public setCurrentUser(user: UserProfile) {
    if (isSystemSyncEmail(user?.email)) {
      console.warn('Blocked attempt to set system sync account as currentUser');
      return;
    }
    this.currentUser = user;
    if (user.schoolId && user.schoolId !== this.currentSchoolId) {
      this.setSchoolId(user.schoolId);
    } else {
      this.saveLocalCacheOnly();
      this.notify();
    }
  }

  // Multi-tenant School & Auth Management
  public getSchoolId(): string {
    return this.currentSchoolId || 'school_quyhop';
  }

  public setSchoolId(schoolId: string): void {
    if (!schoolId) return;

    // 1. Lưu lại trạng thái của trường hiện tại
    this.saveLocalCacheOnly();

    // 2. Chuyển sang schoolId mới
    this.currentSchoolId = schoolId;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.SCHOOL_ID, JSON.stringify(schoolId));
        const isAuthed = sessionStorage.getItem('pccm_authenticated_session') === 'true';
        const isSuper = this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email);
        if (isSuper || isAuthed) {
          sessionStorage.setItem(`pccm_session_auth_${schoolId}`, 'true');
          sessionStorage.setItem('pccm_session_school_id', schoolId);
          sessionStorage.setItem('pccm_authenticated_session', 'true');
        }

        // Luôn đồng bộ tham số URL query để chuyển trường mượt mà và bền vững
        const url = new URL(window.location.href);
        url.searchParams.set('schoolId', schoolId);
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }

    // 3. Nạp dữ liệu độc lập của trường mới
    this.loadTenantData(schoolId);

    // 4. Khởi động lắng nghe realtime Firestore cho trường mới
    this.initFirestoreRealtimeSync(schoolId);

    // 5. Đồng bộ hồ sơ tài khoản hiện tại với trường mới
    if (this.currentUser) {
      this.currentUser.schoolId = schoolId;
    }

    // Tự động tải snapshot mới nhất từ Cloud Firestore cho trường này
    if (schoolId !== 'school_quyhop') {
      this.pullDataFromFirestore(schoolId).catch(() => {});
    }

    // 6. Thông báo cập nhật toàn bộ giao diện
    this.notify();
  }

  /**
   * Áp dụng toàn diện dữ liệu khởi tạo định nghĩa ban đầu từ Excel cho trường học
   */
  public async applyComprehensiveInitialSetup(
    payload: ComprehensiveSetupPayload,
    targetSchoolId?: string
  ): Promise<void> {
    const sId = targetSchoolId || this.currentSchoolId || 'school_quyhop';
    this.currentSchoolId = sId;

    if (payload.schoolInfo) {
      const isSuper = isSuperAdminEmail(this.currentUser?.email) || Boolean(this.currentUser?.isSuperAdmin);
      const lic = this.getSchoolLicenseById(sId);
      const lockedSchoolName = (!isSuper && lic && lic.schoolName)
        ? lic.schoolName
        : (payload.schoolInfo.schoolName || this.schoolInfo.schoolName);
      this.schoolInfo = {
        ...this.schoolInfo,
        ...payload.schoolInfo,
        schoolName: lockedSchoolName,
      };
    }

    if (payload.branches && payload.branches.length > 0) {
      this.branches = payload.branches;
    }

    if (payload.departments && payload.departments.length > 0) {
      this.departments = payload.departments.map((d) => ({
        ...d,
        schoolId: sId,
      }));
    }

    if (payload.classes && payload.classes.length > 0) {
      const prevClassIds = this.classes.map((c) => c.id);
      const newClassIdSet = new Set(payload.classes.map((c) => c.id));
      prevClassIds.forEach((cid) => {
        if (!newClassIdSet.has(cid)) {
          firestoreRepository.deleteDocData(sId, 'classes', cid).catch(() => {});
        }
      });
      this.classes = payload.classes.map((c) => ({
        ...c,
        schoolId: sId,
        isDeleted: false,
      }));
    }

    if (payload.teachers && payload.teachers.length > 0) {
      const prevTeacherIds = this.teachers.map((t) => t.id);
      const newTeacherIdSet = new Set(payload.teachers.map((t) => t.id));
      prevTeacherIds.forEach((tid) => {
        if (!newTeacherIdSet.has(tid)) {
          firestoreRepository.deleteDocData(sId, 'teachers', tid).catch(() => {});
        }
      });
      this.teachers = payload.teachers.map((t) => ({
        ...t,
        schoolId: sId,
        isDeleted: false,
      }));
    }

    if (payload.duties && payload.duties.length > 0) {
      this.duties = payload.duties;
    }

    // Đặt lại các phân công chuyên môn về trắng để nhà trường bắt đầu phân công
    this.assignments = [];

    this.setInitialSetupCompleted(true);
    this.saveToStorage();
    this.syncAllDepartmentDutiesAndAssignments();
    this.notify();

    // Đồng bộ lên Cloud Firestore nếu có mạng
    try {
      await firestoreRepository.setSchoolInfo(sId, this.schoolInfo);
      await firestoreRepository.batchSetDocuments(sId, 'departments', this.departments);
      await firestoreRepository.batchSetDocuments(sId, 'classes', this.classes);
      await firestoreRepository.batchSetDocuments(sId, 'teachers', this.teachers);
      if (payload.branches && payload.branches.length > 0) {
        await firestoreRepository.batchSetDocuments(sId, 'branches', this.branches);
      }
      if (payload.duties && payload.duties.length > 0) {
        await firestoreRepository.batchSetDocuments(sId, 'duties', this.duties);
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ lên cloud khi khởi tạo định nghĩa ban đầu:', e);
    }
  }

  /**
   * Phục hồi toàn bộ dữ liệu từ Cloudflare KV Tenant về máy
   */
  public restoreFromCloudflarePayload(remoteData: any, schoolId: string): void {
    if (!remoteData) return;
    this.currentSchoolId = schoolId || this.currentSchoolId || 'school_quyhop';
    if (remoteData.schoolInfo) {
      this.schoolInfo = {
        ...this.schoolInfo,
        ...remoteData.schoolInfo,
      };
    }
    if (Array.isArray(remoteData.teachers)) this.teachers = remoteData.teachers;
    if (Array.isArray(remoteData.classes)) this.classes = remoteData.classes;
    if (Array.isArray(remoteData.assignments)) this.assignments = remoteData.assignments;
    if (Array.isArray(remoteData.departments)) this.departments = remoteData.departments;
    if (Array.isArray(remoteData.subjects)) this.subjects = remoteData.subjects;
    if (Array.isArray(remoteData.duties)) this.duties = remoteData.duties;
    if (Array.isArray(remoteData.branches)) this.branches = remoteData.branches;
    if (Array.isArray(remoteData.versions)) this.versions = remoteData.versions;

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    this.notify();
  }

  // ===================== QUẢN LÝ BẢN QUYỀN TRƯỜNG HỌC (SCHOOL TENANTS & LICENSES) =====================
  public async loadLicensesFromCloud(): Promise<void> {
    try {
      const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);
      const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
      const map = new Map<string, SchoolTenantLicense>();

      // 1. Nạp các trường hệ thống
      INITIAL_SCHOOL_LICENSES.forEach((l) => map.set(l.id, l));

      // 2. Nạp bản sao lưu local bền vững
      backupLicenses.forEach((l) => {
        if (!deletedSchoolIds.includes(l.id) && !isThongKeSchool(l.id, l.schoolName)) {
          map.set(l.id, l);
        }
      });

      // 3. Nạp danh sách bộ nhớ hiện tại
      this.schoolLicenses.forEach((l) => {
        if (!deletedSchoolIds.includes(l.id) && !isThongKeSchool(l.id, l.schoolName)) {
          map.set(l.id, l);
        }
      });

      // 4. Đồng bộ thêm từ Cloud Firestore nếu chưa bị cạn kiệt quota
      let cloudLicenses: SchoolTenantLicense[] = [];
      if (!firestoreRepository.hasQuotaExhausted()) {
        cloudLicenses = await firestoreRepository.getAllSchoolLicenses();
        firestoreRepository.deleteSchoolLicense('school_thcs_thu_nghiem').catch(() => {});
        firestoreRepository.deleteSchoolLicense('thcs_thu_nghiem').catch(() => {});
        firestoreRepository.deleteSchoolLicense('school_thu_nghiem').catch(() => {});
        firestoreRepository.deleteSchoolLicense('school_thongke').catch(() => {});
      }

      if (cloudLicenses && cloudLicenses.length > 0) {
        cloudLicenses.forEach((cl) => {
          if (isThongKeSchool(cl.id, cl.schoolName) || deletedSchoolIds.includes(cl.id)) {
            // Xóa triệt để khỏi Cloud nếu còn tồn tại
            firestoreRepository.deleteSchoolLicense(cl.id).catch(() => {});
            return;
          }
          const existing = map.get(cl.id);
          const effectiveName = (cl.schoolName && cl.schoolName !== 'TRƯỜNG THCS MỚI')
            ? cl.schoolName
            : (existing?.schoolName || cl.schoolName || 'TRƯỜNG THCS MỚI');
          map.set(cl.id, {
            ...existing,
            ...cl,
            schoolName: effectiveName,
            assignedPasswordHint: cl.assignedPasswordHint || existing?.assignedPasswordHint || '',
          });
        });
      }

      this.schoolLicenses = Array.from(map.values()).filter(
        (l) => !isThongKeSchool(l.id, l.schoolName) && !deletedSchoolIds.includes(l.id)
      );

      // Cập nhật lại bản sao lưu bền vững
      this.setItem('pccm_all_registered_school_licenses', this.schoolLicenses);

      // Đồng bộ ngay tên trường từ license hiện hành
      const curLic = this.getSchoolLicenseById(this.currentSchoolId);
      if (curLic && curLic.schoolName && curLic.schoolName !== 'TRƯỜNG THCS MỚI') {
        this.schoolInfo = {
          ...this.schoolInfo,
          schoolName: curLic.schoolName,
          email: curLic.adminEmail || this.schoolInfo.email,
          phone: curLic.contactPhone || this.schoolInfo.phone,
        };
      }

      this.saveLocalCacheOnly();
      this.notify();
    } catch (e) {
      console.warn('Lỗi tải licenses từ cloud:', e);
    }
  }

  /**
   * Đảm bảo thông tin bản quyền của trường được nạp đầy đủ (từ bộ nhớ hoặc từ Cloud Firestore)
   */
  public async ensureSchoolLicenseLoaded(schoolId: string): Promise<SchoolTenantLicense | null> {
    if (!schoolId) return null;
    const normId = schoolId.startsWith('school_') ? schoolId : `school_${schoolId}`;
    const existing = this.getSchoolLicenseById(schoolId) || this.getSchoolLicenseById(normId);
    if (existing && existing.assignedPasswordHint && existing.schoolName !== 'TRƯỜNG THCS MỚI') return existing;

    try {
      let cloudLic = await firestoreRepository.getSchoolLicense(normId);
      if (!cloudLic && normId !== schoolId) {
        cloudLic = await firestoreRepository.getSchoolLicense(schoolId);
      }
      if (cloudLic) {
        const idx = this.schoolLicenses.findIndex((l) => l.id === cloudLic!.id);
        if (idx >= 0) {
          this.schoolLicenses[idx] = cloudLic;
        } else {
          this.schoolLicenses.push(cloudLic);
        }

        try {
          const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
          const bIdx = backupLicenses.findIndex((l) => l.id === cloudLic!.id);
          if (bIdx >= 0) {
            backupLicenses[bIdx] = cloudLic;
          } else {
            backupLicenses.push(cloudLic);
          }
          this.setItem('pccm_all_registered_school_licenses', backupLicenses);
        } catch {}

        const curClean = (this.currentSchoolId || '').toLowerCase().replace(/^school_/, '');
        const normClean = normId.toLowerCase().replace(/^school_/, '');
        if (curClean === normClean || this.currentSchoolId === schoolId || this.currentSchoolId === normId) {
          if (cloudLic.schoolName && cloudLic.schoolName !== 'TRƯỜNG THCS MỚI') {
            this.schoolInfo = {
              ...this.schoolInfo,
              schoolName: cloudLic.schoolName,
              email: cloudLic.adminEmail || this.schoolInfo.email,
              phone: cloudLic.contactPhone || this.schoolInfo.phone,
            };
          }
        }

        this.saveLocalCacheOnly();
        this.notify();
        return cloudLic;
      }
    } catch (err) {
      console.warn(`Lỗi nạp license trực tiếp cho [${schoolId}]:`, err);
    }
    return existing || null;
  }

  public getSchoolLicenses(): SchoolTenantLicense[] {
    const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);
    return this.schoolLicenses.filter((l) => !isThongKeSchool(l.id, l.schoolName) && !deletedSchoolIds.includes(l.id));
  }

  public getSchoolLicenseById(id: string): SchoolTenantLicense | undefined {
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();
    const withPrefix = clean.startsWith('school_') ? clean : `school_${clean}`;
    const withoutPrefix = clean.replace(/^school_/, '');
    return this.schoolLicenses.find(
      (l) => {
        const licId = (l.id || '').toLowerCase();
        return licId === clean || licId === withPrefix || licId.replace(/^school_/, '') === withoutPrefix;
      }
    );
  }

  /**
   * Kiểm tra bản quyền sử dụng của một trường học
   * - Nếu tài khoản là Chủ sở hữu (Super Admin / nguyentoanqhios@gmail.com): Luôn hợp lệ (Không giới hạn)
   * - Kiểm tra khóa thủ công: status === 'locked' -> Chặn sử dụng ngay lập tức
   * - Kiểm tra hẹn giờ khóa / ngày hết hạn: expiresAt < now -> Chặn sử dụng do hết hạn
   * - Tính số ngày còn lại (daysRemaining)
   */
  public checkSchoolLicense(schoolId?: string): LicenseCheckResult {
    const targetId = schoolId || this.currentSchoolId || 'school_quyhop';

    // 1. Tài khoản Chủ sở hữu / Quản trị viên tối cao: Toàn quyền truy cập mọi trường
    if (this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email)) {
      const currentLic = this.getSchoolLicenseById(targetId);
      return {
        isValid: true,
        status: 'active',
        daysRemaining: null,
        message: 'Tài khoản Chủ sở hữu / Quản trị viên tối cao (Toàn quyền quản trị)',
        schoolName: currentLic?.schoolName || this.schoolInfo.schoolName || 'TRƯỜNG THCS MỚI',
        expiresAt: null,
      };
    }

    let lic = this.schoolLicenses.find((l) => l.id === targetId);
    if (!lic) {
      if (targetId === 'school_quyhop') {
        return {
          isValid: true,
          status: 'active',
          daysRemaining: null,
          message: 'Bản quyền trường học chính thức hợp lệ',
          schoolName: 'TRƯỜNG THCS QUỲ HỢP',
          expiresAt: null,
        };
      }

      // Tự động kiểm tra và khởi tạo bản quyền nếu liên kết chứa thông số trường hợp lệ (?schoolId=...&schoolName=...)
      const urlParams = this.detectUrlSchoolParams();
      if (urlParams.schoolId === targetId && urlParams.schoolName) {
        let assignedPass = urlParams.pass || '';
        if (!assignedPass) {
          try {
            const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
            const bLic = backupLicenses.find((l) => l.id.toLowerCase() === targetId.toLowerCase() || l.id.replace(/^school_/, '').toLowerCase() === targetId.replace(/^school_/, '').toLowerCase());
            if (bLic?.assignedPasswordHint) {
              assignedPass = bLic.assignedPasswordHint;
            }
          } catch {}
        }
        const autoLic: SchoolTenantLicense = {
          id: targetId,
          schoolName: urlParams.schoolName,
          adminEmail: urlParams.adminEmail || 'admin@truong.edu.vn',
          adminName: urlParams.adminName || 'Quản trị viên trường',
          assignedPasswordHint: assignedPass,
          status: 'active',
          planType: 'annual',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          maxTeachers: 300,
          maxClasses: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.schoolLicenses.push(autoLic);
        this.saveLocalCacheOnly();
        lic = autoLic;
      } else {
        return {
          isValid: false,
          status: 'locked',
          daysRemaining: 0,
          message: `Trường [${targetId}] chưa được kích hoạt bản quyền trong hệ thống.`,
          schoolName: targetId,
          expiresAt: null,
          lockedReason: 'Chưa được cấp phép bản quyền trong hệ thống.',
        };
      }
    }

    // 2. Kiểm tra KHÓA THỦ CÔNG bởi Ban Quản trị (Khóa bất cứ lúc nào)
    if (lic.status === 'locked') {
      return {
        isValid: false,
        status: 'locked',
        daysRemaining: 0,
        message: 'Bản quyền trường học này đã bị tạm khóa bởi Ban Quản trị hệ thống.',
        schoolName: lic.schoolName,
        expiresAt: lic.expiresAt,
        lockedReason: lic.lockedReason || 'Tạm khóa quyền truy cập theo yêu cầu quản trị viên.',
      };
    }

    // 2.1 KIỂM TRA CHỮ KÝ SỐ TOÀN VẸN (Chống sửa LocalStorage / F12 / can thiệp trái phép)
    const sigCheck = verifyLicenseSignature(lic);
    if (!sigCheck.isValid) {
      return {
        isValid: false,
        status: 'locked',
        daysRemaining: 0,
        message: 'Phát hiện dữ liệu bản quyền bị can thiệp hoặc sửa đổi trái phép.',
        schoolName: lic.schoolName,
        expiresAt: lic.expiresAt,
        lockedReason: sigCheck.reason || 'Chữ ký số bản quyền không khớp. Hệ thống đã tự động khóa để bảo vệ bản quyền.',
      };
    }

    // 2.2 KIỂM TRA CHỐNG LÙI ĐỒNG HỒ MÁY TÍNH (Anti-Clock Rollback)
    if (systemTimeGuardian.isTamperedClock()) {
      return {
        isValid: false,
        status: 'locked',
        daysRemaining: 0,
        message: 'Phát hiện đồng hồ máy tính bị lùi về quá khứ.',
        schoolName: lic.schoolName,
        expiresAt: lic.expiresAt,
        lockedReason: 'Vi phạm bảo mật: Đồng hồ máy tính bị chỉnh lùi về quá khứ để lách hạn sử dụng bản quyền.',
      };
    }

    // 3. Kiểm tra HẸN THỜI GIAN KHÓA (Ngày hết hạn - expiresAt) với thời gian đáng tin cậy
    if (lic.expiresAt) {
      const expireTime = new Date(lic.expiresAt).getTime();
      const nowTime = systemTimeGuardian.getReliableTime();
      const diffMs = expireTime - nowTime;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) {
        return {
          isValid: false,
          status: 'expired',
          daysRemaining,
          message: `Bản quyền đã hết hạn sử dụng vào ngày ${new Date(lic.expiresAt).toLocaleDateString('vi-VN')}.`,
          schoolName: lic.schoolName,
          expiresAt: lic.expiresAt,
          lockedReason: lic.lockedReason || 'Đã hết thời hạn sử dụng bản quyền được cấp.',
        };
      }

      return {
        isValid: true,
        status: 'active',
        daysRemaining,
        message: `Bản quyền đang hoạt động (còn ${daysRemaining} ngày sử dụng).`,
        schoolName: lic.schoolName,
        expiresAt: lic.expiresAt,
      };
    }

    // 4. Vĩnh viễn (unlimited)
    return {
      isValid: true,
      status: 'active',
      daysRemaining: null,
      message: 'Bản quyền hoạt động vĩnh viễn không giới hạn thời gian.',
      schoolName: lic.schoolName,
      expiresAt: null,
    };
  }

  /**
   * MỤC 2: Kiểm tra hạn mức quy mô trường học (Quota Limiter)
   * Chống hành vi 1 trường nhận làm dịch vụ gom nhiều trường vào phân công chung
   */
  public checkCurrentSchoolQuota(addingTeachers: number = 0, addingClasses: number = 0) {
    // Super Admin Thầy Toàn có toàn quyền
    if (this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email)) {
      return {
        allowed: true,
        maxTeachers: 9999,
        maxClasses: 9999,
        currentTeachers: this.teachers.length + addingTeachers,
        currentClasses: this.classes.length + addingClasses,
        exceededTeachers: false,
        exceededClasses: false,
      };
    }

    const currentLic = this.getCurrentSchoolLicense();
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    // Đếm chính xác số giáo viên và lớp học thuộc về trường hiện tại (không tính trường khác)
    const schoolTeachersCount = this.teachers.filter(
      (t) => !t.isDeleted && (isQuyHop ? (!t.schoolId || t.schoolId === 'school_quyhop') : t.schoolId === this.currentSchoolId)
    ).length;
    const schoolClassesCount = this.classes.filter(
      (c) => !c.isDeleted && (isQuyHop ? (!c.schoolId || c.schoolId === 'school_quyhop') : c.schoolId === this.currentSchoolId)
    ).length;

    return checkSchoolQuota({
      license: currentLic,
      currentTeachersCount: schoolTeachersCount,
      currentClassesCount: schoolClassesCount,
      addingTeachersCount: addingTeachers,
      addingClassesCount: addingClasses,
    });
  }

  public canAddTeacher(count: number = 1): { allowed: boolean; message?: string } {
    const quota = this.checkCurrentSchoolQuota(count, 0);
    return {
      allowed: quota.allowed,
      message: quota.message,
    };
  }

  public canAddClass(count: number = 1): { allowed: boolean; message?: string } {
    const quota = this.checkCurrentSchoolQuota(0, count);
    return {
      allowed: quota.allowed,
      message: quota.message,
    };
  }

  /**
   * Lấy bản quyền của trường học đang active
   */
  public getCurrentSchoolLicense(): SchoolTenantLicense | undefined {
    return this.getSchoolLicenseById(this.currentSchoolId);
  }

  /**
   * Kiểm tra xem địa chỉ email có quyền truy cập vào trường học được chỉ định hay không.
   * Chỉ cho phép:
   * 1. Chủ sở hữu / Super Admin
   * 2. Quản trị viên được cấp phép của trường (license.adminEmail)
   * 3. Người dùng đã được phân quyền trong danh mục Người dùng của trường đó
   */
  public isEmailAuthorizedForSchool(
    email?: string | null,
    targetSchoolId?: string
  ): {
    authorized: boolean;
    reason?: string;
    userProfile?: UserProfile;
  } {
    const sId = targetSchoolId || this.currentSchoolId;
    if (!email || !email.trim()) {
      return { authorized: false, reason: 'Vui lòng nhập địa chỉ email hợp lệ.' };
    }
    const trimmed = email.trim().toLowerCase();

    // 1. Super Admin is always authorized everywhere
    if (isSuperAdminEmail(trimmed)) {
      return { authorized: true };
    }

    // 2. School License Admin
    const license = this.getSchoolLicenseById(sId);
    const urlParams = this.detectUrlSchoolParams();
    const urlAdminEmail = (urlParams.schoolId === sId || !sId) ? urlParams.adminEmail : null;
    const effectiveAdminEmail = license?.adminEmail || urlAdminEmail;

    if (effectiveAdminEmail && isSameEmail(trimmed, effectiveAdminEmail)) {
      if (license && license.status === 'locked') {
        return {
          authorized: false,
          reason: `Trường [${license.schoolName}] đã bị tạm khóa bản quyền: ${license.lockedReason || 'Liên hệ quản trị viên để mở khóa'}.`,
        };
      }
      return { authorized: true };
    }

    // Special check for school_quyhop default admin
    if (sId === 'school_quyhop' && isSameEmail(trimmed, 'nguyentoanqh@gmail.com')) {
      return { authorized: true };
    }

    // 3. User explicitly added in UserManagement for this school
    const existingUser = this.users.find(
      (u) => isSameEmail(u.email, trimmed) && u.schoolId === sId
    );
    if (existingUser) {
      if (existingUser.status === 'locked') {
        return {
          authorized: false,
          reason: 'Tài khoản người dùng này đã bị tạm khóa quyền truy cập.',
        };
      }
      return { authorized: true, userProfile: existingUser };
    }

    // 4. Teacher in the school's teacher list
    const teacher = this.teachers.find((t) => isSameEmail(t.email, trimmed));
    if (teacher) {
      return { authorized: true };
    }

    // 5. Denied!
    const targetSchoolName = license?.schoolName || (urlParams.schoolId === sId && urlParams.schoolName ? urlParams.schoolName : null) || (sId === 'school_thongke' ? 'TRƯỜNG THCS THỐNG KÊ' : sId === 'school_quyhop' ? 'TRƯỜNG THCS QUỲ HỢP' : 'trường học');
    const hint = effectiveAdminEmail ? ` (${effectiveAdminEmail})` : '';
    return {
      authorized: false,
      reason: `Tài khoản Google/Email [${trimmed}] chưa được gán quyền truy cập vào [${targetSchoolName}]. Vui lòng đăng nhập đúng email quản trị được cấp${hint} hoặc liên hệ Ban Quản trị hệ thống.`,
    };
  }

  /**
   * Lưu hoặc cập nhật thông tin bản quyền trường học
   * Đồng thời tự động cập nhật tài khoản quản trị trường trong users
   */
  public async saveSchoolLicense(license: SchoolTenantLicense): Promise<void> {
    const existingIndex = this.schoolLicenses.findIndex((l) => l.id === license.id);
    const now = new Date().toISOString();

    const defaultQuota = DEFAULT_LICENSE_QUOTAS[license.planType || 'annual'] || DEFAULT_LICENSE_QUOTAS.annual;
    const maxTeachers = license.maxTeachers && license.maxTeachers > 0 ? license.maxTeachers : defaultQuota.maxTeachers;
    const maxClasses = license.maxClasses && license.maxClasses > 0 ? license.maxClasses : defaultQuota.maxClasses;

    const signature = generateLicenseSignature({
      id: license.id,
      schoolName: license.schoolName,
      expiresAt: license.expiresAt,
      planType: license.planType,
      maxTeachers,
      maxClasses,
    });

    const cleanLicense: SchoolTenantLicense = {
      ...license,
      assignedPasswordHint: license.assignedPasswordHint?.trim() || (license.id === 'school_quyhop' ? '123456' : ''),
      maxTeachers,
      maxClasses,
      signature,
      updatedAt: now,
      createdAt: license.createdAt || now,
    };

    if (existingIndex >= 0) {
      this.schoolLicenses[existingIndex] = cleanLicense;
    } else {
      this.schoolLicenses.push(cleanLicense);
    }

    // Nếu trường này từng bị xóa trước đó, gỡ khỏi danh sách đen
    const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);
    if (deletedSchoolIds.includes(cleanLicense.id)) {
      this.setItem(
        'pccm_deleted_school_ids',
        deletedSchoolIds.filter((id) => id !== cleanLicense.id)
      );
    }

    // Đồng bộ ngay lập tức sang schoolInfo của app nếu đang ở trường này
    if (cleanLicense.id === this.currentSchoolId) {
      this.schoolInfo = {
        ...this.schoolInfo,
        schoolName: cleanLicense.schoolName,
        email: cleanLicense.adminEmail || this.schoolInfo.email,
        phone: cleanLicense.contactPhone || this.schoolInfo.phone,
        principalName: cleanLicense.adminName || this.schoolInfo.principalName,
      };
      this.saveLocalCacheOnly();
    }

    // Cập nhật lưu trữ scoped schoolInfo trong localStorage của trường này
    try {
      const targetScopedKey = this.getScopedKey(STORAGE_KEYS.SCHOOL_INFO, cleanLicense.id);
      const existingInfo = this.getItem<SchoolInfo | null>(targetScopedKey, null);
      if (existingInfo) {
        this.setItem(targetScopedKey, {
          ...existingInfo,
          schoolName: cleanLicense.schoolName,
          email: cleanLicense.adminEmail || existingInfo.email,
          phone: cleanLicense.contactPhone || existingInfo.phone,
          principalName: cleanLicense.adminName || existingInfo.principalName,
        });
      }
      if (cleanLicense.id === 'school_quyhop') {
        const baseInfo = this.getItem<SchoolInfo | null>(STORAGE_KEYS.SCHOOL_INFO, null);
        if (baseInfo) {
          this.setItem(STORAGE_KEYS.SCHOOL_INFO, {
            ...baseInfo,
            schoolName: cleanLicense.schoolName,
          });
        }
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ schoolInfo khi lưu bản quyền:', e);
    }

    // Tự động tạo hoặc cập nhật tài khoản quản trị trường học trong users
    if (cleanLicense.adminEmail) {
      const emailLower = cleanLicense.adminEmail.toLowerCase();
      const existingUser = this.users.find((u) => u.email.toLowerCase() === emailLower);
      if (!existingUser) {
        this.addUser({
          name: cleanLicense.adminName || `Quản trị viên ${cleanLicense.schoolName}`,
          email: cleanLicense.adminEmail,
          schoolId: cleanLicense.id,
          role: 'admin',
          roleTitle: 'Quản trị viên Trường học',
          permission: 'edit',
          phone: cleanLicense.contactPhone,
          status: cleanLicense.status,
        });
      } else {
        this.updateUser(existingUser.id, {
          schoolId: cleanLicense.id,
          status: cleanLicense.status,
          phone: cleanLicense.contactPhone || existingUser.phone,
        });
      }
    }

    this.saveToStorage(true);
    this.saveLocalCacheOnly();

    // Lưu bản sao lưu an toàn thứ hai để chống mất dữ liệu khi trình duyệt xóa cache cục bộ
    try {
      const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
      const bIdx = backupLicenses.findIndex((l) => l.id === cleanLicense.id);
      if (bIdx >= 0) {
        backupLicenses[bIdx] = cleanLicense;
      } else {
        backupLicenses.push(cleanLicense);
      }
      this.setItem('pccm_all_registered_school_licenses', backupLicenses);
    } catch {}

    // Lưu registry thông tin trường theo tenant
    try {
      this.schoolInfoByTenant[cleanLicense.id] = {
        ...(this.schoolInfoByTenant[cleanLicense.id] || DEFAULT_SCHOOL_INFO),
        schoolName: cleanLicense.schoolName,
        email: cleanLicense.adminEmail || '',
        phone: cleanLicense.contactPhone || '',
        principalName: cleanLicense.adminName || '',
      };
      this.setItem('pccm_school_info_tenants_v1', this.schoolInfoByTenant);
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEYS.INITIAL_SETUP_COMPLETED}_${cleanLicense.id}`, JSON.stringify(true));
      } catch {}
    }

    try {
      await firestoreRepository.saveSchoolLicense(cleanLicense);
    } catch (e) {
      console.warn('Lỗi lưu license lên Firestore:', e);
    }
    this.notify();
  }

  /**
   * Khóa ngay lập tức bản quyền trường học bất cứ lúc nào
   */
  public async lockSchoolLicense(schoolId: string, reason?: string): Promise<void> {
    const lic = this.schoolLicenses.find((l) => l.id === schoolId);
    if (!lic) return;
    lic.status = 'locked';
    lic.lockedReason = reason || 'Đã bị tạm khóa bởi Ban Quản trị hệ thống.';
    await this.saveSchoolLicense(lic);
  }

  /**
   * Mở khóa bản quyền trường học ngay lập tức
   */
  public async unlockSchoolLicense(schoolId: string): Promise<void> {
    const lic = this.schoolLicenses.find((l) => l.id === schoolId);
    if (!lic) return;
    lic.status = 'active';
    lic.lockedReason = undefined;
    // Nếu ngày hết hạn cũ đã qua, tự động gia hạn thêm 30 ngày
    if (lic.expiresAt && new Date(lic.expiresAt).getTime() <= Date.now()) {
      lic.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    await this.saveSchoolLicense(lic);
  }

  /**
   * Đặt hoặc hẹn thời gian khóa tự động (ngày hết hạn)
   */
  public async setSchoolLicenseExpiry(schoolId: string, expiresAt: string | null): Promise<void> {
    const lic = this.schoolLicenses.find((l) => l.id === schoolId);
    if (!lic) return;
    lic.expiresAt = expiresAt;
    if (expiresAt && new Date(expiresAt).getTime() > Date.now() && lic.status === 'locked' && lic.lockedReason?.includes('hết hạn')) {
      lic.status = 'active';
      lic.lockedReason = undefined;
    }
    await this.saveSchoolLicense(lic);
  }

  /**
   * Xóa bản quyền trường học khỏi danh sách
   */
  public async deleteSchoolLicense(schoolId: string): Promise<void> {
    if (schoolId === 'school_quyhop') {
      throw new Error('Không thể xóa trường mặc định của hệ thống (TRƯỜNG THCS QUỲ HỢP).');
    }
    this.schoolLicenses = this.schoolLicenses.filter((l) => l.id !== schoolId);

    // Ghi nhớ mã trường đã xóa để không bị cache hay cloud đồng bộ ngược trở lại
    const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);
    if (!deletedSchoolIds.includes(schoolId)) {
      deletedSchoolIds.push(schoolId);
      this.setItem('pccm_deleted_school_ids', deletedSchoolIds);
    }

    try {
      const backupLicenses = this.getItem<SchoolTenantLicense[]>('pccm_all_registered_school_licenses', []);
      this.setItem(
        'pccm_all_registered_school_licenses',
        backupLicenses.filter((l) => l.id !== schoolId)
      );
    } catch {}
    
    // Nếu trường đang được kích hoạt làm việc bị xóa -> chuyển về trường chính
    if (this.currentSchoolId === schoolId) {
      this.currentSchoolId = 'school_quyhop';
      this.loadTenantData('school_quyhop');
    }

    // Dọn dẹp các scoped key trong localStorage của trường bị xóa
    if (typeof window !== 'undefined') {
      try {
        const scopedSuffix = `_${schoolId}`;
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.endsWith(scopedSuffix) || k.includes(scopedSuffix))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        console.warn('Lỗi dọn dẹp localStorage khi xóa trường:', e);
      }
    }
    delete this.schoolInfoByTenant[schoolId];
    this.setItem('pccm_school_info_tenants_v1', this.schoolInfoByTenant);
    this.clearAllOperationalData(schoolId, true);

    this.saveToStorage();
    firestoreRepository.deleteSchoolLicense(schoolId).catch(() => {});
    this.notify();
  }

  /**
   * Đồng bộ toàn bộ danh sách bản quyền các trường học lên Cloud Firestore
   */
  public async syncAllLicensesToCloud(): Promise<{ success: boolean; count: number; message: string }> {
    try {
      await ensureFirebaseAuth();
      let count = 0;
      for (const lic of this.schoolLicenses) {
        if (!lic || isThongKeSchool(lic.id, lic.schoolName)) continue;
        await firestoreRepository.saveSchoolLicense(lic);
        count++;
      }
      return {
        success: true,
        count,
        message: `Đã đẩy thành công ${count} bản quyền trường học lên Cloud Firestore!`,
      };
    } catch (err: any) {
      console.warn('Lỗi đồng bộ bản quyền lên Cloud:', err);
      return {
        success: false,
        count: 0,
        message: err?.message || 'Có lỗi xảy ra khi đẩy bản quyền lên Cloud Firestore.',
      };
    }
  }

  /**
   * Lấy danh sách giáo viên của một trường học cụ thể
   */
  public getTeachersForSchool(schoolId: string): Teacher[] {
    if (!schoolId) return [];
    if (schoolId === this.currentSchoolId) {
      return this.teachers.filter((t) => !t.isDeleted);
    }
    const scopedKey = this.getScopedKey(STORAGE_KEYS.TEACHERS, schoolId);
    const loaded = this.getItem<Teacher[]>(scopedKey, []);
    return Array.isArray(loaded) ? loaded.filter((t) => !t.isDeleted) : [];
  }

  /**
   * Lấy danh sách lớp học của một trường học cụ thể
   */
  public getClassesForSchool(schoolId: string): SchoolClass[] {
    if (!schoolId) return [];
    const isTargetQuyHop = schoolId === 'school_quyhop';
    if (schoolId === this.currentSchoolId) {
      return this.classes.filter(
        (c) => !c.isDeleted && (isTargetQuyHop ? (!c.schoolId || c.schoolId === 'school_quyhop') : c.schoolId === schoolId)
      );
    }
    const scopedKey = this.getScopedKey(STORAGE_KEYS.CLASSES, schoolId);
    const loaded = this.getItem<SchoolClass[]>(scopedKey, []);
    return Array.isArray(loaded)
      ? loaded.filter(
          (c) => !c.isDeleted && (isTargetQuyHop ? (!c.schoolId || c.schoolId === 'school_quyhop') : c.schoolId === schoolId)
        )
      : [];
  }

  /**
   * Thêm một lớp học trực tiếp cho một trường học (hỗ trợ cả khi chưa switch active)
   */
  public addClassForSchool(schoolId: string, item: Omit<SchoolClass, 'id'>): SchoolClass {
    if (schoolId === this.currentSchoolId) {
      return this.addClass(item);
    }
    const scopedClassesKey = this.getScopedKey(STORAGE_KEYS.CLASSES, schoolId);
    const currentClasses = this.getItem<SchoolClass[]>(scopedClassesKey, []);
    const newClass: SchoolClass = {
      id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
      schoolId,
      branchId: item.branchId || 'branch_main',
      studentCount: item.studentCount && item.studentCount > 0 ? item.studentCount : 35,
      active: item.active !== false,
      isDeleted: false,
    };
    currentClasses.push(newClass);
    this.setItem(scopedClassesKey, currentClasses);
    try {
      firestoreRepository.setDocData(schoolId, 'classes', newClass.id, newClass).catch(() => {});
    } catch {}
    this.notify();
    return newClass;
  }

  /**
   * Thêm một giáo viên trực tiếp cho một trường học (hỗ trợ cả khi chưa switch active)
   */
  public addTeacherForSchool(schoolId: string, teacher: Omit<Teacher, 'id'>): Teacher {
    if (schoolId === this.currentSchoolId) {
      return this.addTeacher(teacher);
    }
    const scopedTeachersKey = this.getScopedKey(STORAGE_KEYS.TEACHERS, schoolId);
    const currentTeachers = this.getItem<Teacher[]>(scopedTeachersKey, []);
    const newTeacher: Teacher = {
      id: `tc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...teacher,
      schoolId,
      departmentId: teacher.departmentId || 'dept_toan_tin',
      workplaceId: teacher.workplaceId || 'wp_main',
      workplace: teacher.workplace || 'Điểm chính',
      isDeleted: false,
    };
    currentTeachers.push(newTeacher);
    this.setItem(scopedTeachersKey, currentTeachers);
    try {
      firestoreRepository.setDocData(schoolId, 'teachers', newTeacher.id, newTeacher).catch(() => {});
    } catch {}
    this.notify();
    return newTeacher;
  }

  // ===================== FIRESTORE REALTIME SYNC =====================
  private firestoreUnsubscribers: (() => void)[] = [];
  private isFirestoreSyncEnabled: boolean = true;
  private cloudSyncStatus: 'idle' | 'syncing' | 'connected' | 'error' = 'idle';
  private cloudLastSyncTime?: string;

  public getCloudSyncStatus(): 'idle' | 'syncing' | 'connected' | 'error' {
    return this.cloudSyncStatus;
  }

  public getCloudLastSyncTime(): string | undefined {
    return this.cloudLastSyncTime;
  }

  /**
   * Khởi tạo lắng nghe thay đổi dữ liệu thời gian thực (onSnapshot) từ Cloud Firestore
   * Đảm bảo cập nhật tức thời khi có thay đổi mà không bị giật lag
   */
  public initFirestoreRealtimeSync(targetSchoolId?: string) {
    if (firestoreRepository.hasQuotaExhausted()) {
      this.stopFirestoreRealtimeSync();
      this.cloudSyncStatus = 'idle';
      return;
    }

    const sId = targetSchoolId || this.currentSchoolId || 'school_quyhop';
    this.stopFirestoreRealtimeSync();

    this.cloudSyncStatus = 'syncing';
    this.notify();

    ensureFirebaseAuth().catch(() => {});

    const handleSyncError = (err: any) => {
      if (isQuotaExhaustedError(err) || firestoreRepository.hasQuotaExhausted()) {
        firestoreRepository.markQuotaStatus();
        this.stopFirestoreRealtimeSync();
        this.cloudSyncStatus = 'idle';
        this.notify();
      }
    };

    try {
      // 1. School Info
      const unsubInfo = firestoreRepository.subscribeSchoolInfo(
        sId,
        (cloudInfo) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (cloudInfo && cloudInfo.schoolName) {
            this.schoolInfo = { ...this.schoolInfo, ...cloudInfo };
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubInfo);

      // 2. Teachers
      const unsubTeachers = firestoreRepository.subscribeCollection<Teacher>(
        sId,
        'teachers',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            const deduped: Teacher[] = [];
            const seenIds = new Set<string>();
            const seenKeys = new Set<string>();
            for (const item of items) {
              if (!item || !item.fullName) continue;
              if (seenIds.has(item.id)) continue;
              const codeKey = (item.code || '').trim().toUpperCase();
              const nameKey = removeVietnameseTones(item.fullName.trim());
              const uniqueKey = codeKey ? `${codeKey}_${nameKey}` : nameKey;
              if (seenKeys.has(uniqueKey)) continue;
              seenIds.add(item.id);
              seenKeys.add(uniqueKey);
              deduped.push(item);
            }
            this.teachers = deduped;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubTeachers);

      // 3. Classes
      const unsubClasses = firestoreRepository.subscribeCollection<SchoolClass>(
        sId,
        'classes',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            const deduped: SchoolClass[] = [];
            const seenIds = new Set<string>();
            const seenKeys = new Set<string>();
            for (const item of items) {
              if (!item || (!item.code && !item.name)) continue;
              if (seenIds.has(item.id)) continue;
              const key = (item.code || item.name || '').trim().toUpperCase();
              if (seenKeys.has(key)) continue;
              seenIds.add(item.id);
              seenKeys.add(key);
              deduped.push(item);
            }
            this.classes = deduped;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubClasses);

      // 4. Subjects
      const unsubSubjects = firestoreRepository.subscribeCollection<Subject>(
        sId,
        'subjects',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.subjects = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubSubjects);

      // 5. Departments
      const unsubDepts = firestoreRepository.subscribeCollection<Department>(
        sId,
        'departments',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.departments = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubDepts);

      // 6. Assignments
      const unsubAssignments = firestoreRepository.subscribeCollection<TeachingAssignment>(
        sId,
        'assignments',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.assignments = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubAssignments);

      // 7. Versions
      const unsubVersions = firestoreRepository.subscribeCollection<AssignmentVersion>(
        sId,
        'versions',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.versions = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubVersions);

      // 8. Curriculum
      const unsubCurriculum = firestoreRepository.subscribeCollection<CurriculumDistribution>(
        sId,
        'curriculum',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.curriculum = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubCurriculum);

      // 9. Duties
      const unsubDuties = firestoreRepository.subscribeCollection<SpecialDuty>(
        sId,
        'duties',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.duties = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubDuties);

      // 10. Branches
      const unsubBranches = firestoreRepository.subscribeCollection<SchoolBranch>(
        sId,
        'branches',
        (items) => {
          if (sId !== this.currentSchoolId) return;
          if (this.hasUnsavedChangesFlag) return;
          if (items && items.length > 0) {
            this.branches = items;
            this.saveLocalCacheOnly();
            this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubBranches);

      // 11. School Licenses Realtime Subscription
      const unsubLicenses = firestoreRepository.subscribeAllSchoolLicenses(
        (cloudLicenses) => {
          if (cloudLicenses && cloudLicenses.length > 0) {
            const deletedSchoolIds: string[] = this.getItem('pccm_deleted_school_ids', []);
            const map = new Map<string, SchoolTenantLicense>();
            this.schoolLicenses
              .filter((l) => !deletedSchoolIds.includes(l.id))
              .forEach((l) => map.set(l.id, l));
            cloudLicenses
              .filter((cl) => !deletedSchoolIds.includes(cl.id))
              .forEach((cl) => map.set(cl.id, cl));
            this.schoolLicenses = Array.from(map.values());
            this.saveLocalCacheOnly();
            this.notify();
          }
        },
        handleSyncError
      );
      this.firestoreUnsubscribers.push(unsubLicenses);

      this.cloudSyncStatus = 'connected';
      this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
      this.notify();
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        firestoreRepository.markQuotaStatus();
        this.stopFirestoreRealtimeSync();
        this.cloudSyncStatus = 'idle';
      } else {
        console.warn('Firestore realtime sync notice:', err?.message || err);
        this.cloudSyncStatus = 'error';
      }
      this.notify();
    }
  }

  public stopFirestoreRealtimeSync() {
    this.firestoreUnsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        // Safe tear down
      }
    });
    this.firestoreUnsubscribers = [];
  }

  /**
   * Helper đồng bộ một tài liệu đơn lẻ lên Firestore trong nền (Background async)
   */
  public syncDocToFirestore(subCollection: FirestoreSubCollection, docId: string, data: any) {
    if (!this.isFirestoreSyncEnabled || !this.currentSchoolId || firestoreRepository.hasQuotaExhausted()) return;
    if (subCollection === 'users' && (docId === 'user_super_admin' || docId === 'user_super_admin_alt' || docId === 'guest_user')) {
      return;
    }
    firestoreRepository.setDocData(this.currentSchoolId, subCollection, docId, data).catch((err) => {
      if (isQuotaExhaustedError(err)) {
        firestoreRepository.markQuotaStatus();
        this.stopFirestoreRealtimeSync();
        this.cloudSyncStatus = 'idle';
        return;
      }
      console.warn(`Firestore sync notice [${subCollection}/${docId}]:`, err?.message || err);
    });
  }

  /**
   * Helper xóa một tài liệu khỏi Firestore trong nền (Background async)
   */
  public deleteDocFromFirestore(subCollection: FirestoreSubCollection, docId: string) {
    if (!this.isFirestoreSyncEnabled || !this.currentSchoolId || firestoreRepository.hasQuotaExhausted()) return;
    firestoreRepository.deleteDocData(this.currentSchoolId, subCollection, docId).catch((err) => {
      if (isQuotaExhaustedError(err)) {
        firestoreRepository.markQuotaStatus();
        this.stopFirestoreRealtimeSync();
        this.cloudSyncStatus = 'idle';
        return;
      }
      console.warn(`Firestore delete notice [${subCollection}/${docId}]:`, err?.message || err);
    });
  }

  /**
   * Đẩy toàn bộ dữ liệu mẫu / dữ liệu local lên Cloud Firestore
   */
  public async syncCurrentDataToFirestore(onProgress?: (step: string, percent: number) => void) {
    this.cloudSyncStatus = 'syncing';
    this.notify();

    try {
      await ensureFirebaseAuth();
    } catch {}

    const result = await firestoreRepository.syncAllDataToFirestore(
      this.currentSchoolId || 'school_quyhop',
      {
        schoolInfo: this.schoolInfo,
        teachers: this.teachers,
        classes: this.classes,
        subjects: this.subjects,
        departments: this.departments,
        assignments: this.assignments,
        versions: this.versions,
        curriculum: this.curriculum,
        duties: this.duties,
        branches: this.branches,
        workplaces: this.workplaces,
        abbreviations: this.abbreviationRules,
        users: this.users,
        schoolYears: this.schoolYears,
      },
      onProgress
    );

    if (result.success) {
      this.cloudSyncStatus = 'connected';
      this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
      this.setHasUnsavedChanges(false);
    } else {
      this.cloudSyncStatus = 'error';
    }
    this.notify();
    return result;
  }

  /**
   * Tải toàn bộ dữ liệu từ Cloud Firestore về máy cho trường hiện tại (hoặc schoolId chỉ định)
   */
  public async pullDataFromFirestore(
    targetSchoolId: string = this.currentSchoolId || 'school_quyhop',
    onProgress?: (step: string, percent: number) => void
  ): Promise<{ success: boolean; totalCount: number; message: string }> {
    if (firestoreRepository.hasQuotaExhausted()) {
      this.cloudSyncStatus = 'idle';
      this.notify();
      return {
        success: false,
        totalCount: 0,
        message: 'Dung lượng miễn phí Cloud Firestore tạm thời đạt giới hạn hôm nay. Hệ thống đang sử dụng dữ liệu cục bộ (Offline-first) đảm bảo hoạt động bình thường 100%.',
      };
    }

    this.cloudSyncStatus = 'syncing';
    this.notify();

    try {
      onProgress?.('Đang kết nối Cloud Firestore...', 10);
      await ensureFirebaseAuth();

      // 1. Tải thông tin trường
      onProgress?.('Đang tải thông tin trường học...', 20);
      const cloudSchoolInfo = await firestoreRepository.getSchoolInfo(targetSchoolId);
      if (cloudSchoolInfo && cloudSchoolInfo.schoolName) {
        this.schoolInfo = { ...DEFAULT_SCHOOL_INFO, ...cloudSchoolInfo };
      }

      // 2. Tải giáo viên
      onProgress?.('Đang tải danh sách giáo viên...', 35);
      const cloudTeachers = await firestoreRepository.getCollectionData<Teacher>(targetSchoolId, 'teachers');
      if (cloudTeachers && cloudTeachers.length > 0) {
        this.teachers = cloudTeachers;
      }

      // 3. Tải lớp học
      onProgress?.('Đang tải danh sách lớp học...', 50);
      const cloudClasses = await firestoreRepository.getCollectionData<SchoolClass>(targetSchoolId, 'classes');
      if (cloudClasses && cloudClasses.length > 0) {
        this.classes = cloudClasses;
      }

      // 4. Tải phân công chuyên môn
      onProgress?.('Đang tải bảng phân công chuyên môn...', 65);
      const cloudAssignments = await firestoreRepository.getCollectionData<TeachingAssignment>(targetSchoolId, 'assignments');
      if (cloudAssignments && cloudAssignments.length > 0) {
        this.assignments = cloudAssignments;
      }

      // 5. Tải tổ chuyên môn, điểm trường, phiên bản, nhiệm vụ, môn học & PPCT
      onProgress?.('Đang tải tổ chuyên môn & điểm trường...', 75);
      const cloudDepartments = await firestoreRepository.getCollectionData<Department>(targetSchoolId, 'departments');
      if (cloudDepartments && cloudDepartments.length > 0) {
        this.departments = cloudDepartments;
      }

      const cloudBranches = await firestoreRepository.getCollectionData<SchoolBranch>(targetSchoolId, 'branches');
      if (cloudBranches && cloudBranches.length > 0) {
        this.branches = cloudBranches;
      }

      const cloudVersions = await firestoreRepository.getCollectionData<AssignmentVersion>(targetSchoolId, 'versions');
      if (cloudVersions && cloudVersions.length > 0) {
        this.versions = cloudVersions;
      }

      const cloudDuties = await firestoreRepository.getCollectionData<SpecialDuty>(targetSchoolId, 'duties');
      if (cloudDuties && cloudDuties.length > 0) {
        this.duties = cloudDuties;
      }

      onProgress?.('Đang tải môn học & phân phối chương trình...', 85);
      const cloudSubjects = await firestoreRepository.getCollectionData<Subject>(targetSchoolId, 'subjects');
      if (cloudSubjects && cloudSubjects.length > 0) {
        this.subjects = cloudSubjects;
      }

      const cloudCurriculum = await firestoreRepository.getCollectionData<CurriculumDistribution>(targetSchoolId, 'curriculum');
      if (cloudCurriculum && cloudCurriculum.length > 0) {
        this.curriculum = cloudCurriculum;
      }

      // Tự động nâng cấp danh mục chuẩn (KHTN split Lý/Hóa/Sinh, LS&ĐL Sử/Địa, PPCT chuẩn, Nhiệm vụ kiêm nhiệm)
      this.upgradeTenantStandardCatalog(targetSchoolId);

      onProgress?.('Hoàn tất lưu dữ liệu...', 95);
      this.currentSchoolId = targetSchoolId;
      this.saveLocalCacheOnly();
      this.setHasUnsavedChanges(false);
      this.cloudSyncStatus = 'connected';
      this.cloudLastSyncTime = new Date().toLocaleTimeString('vi-VN');
      this.notify();

      const totalCount =
        (cloudTeachers?.length || 0) +
        (cloudClasses?.length || 0) +
        (cloudAssignments?.length || 0);

      onProgress?.('Hoàn tất!', 100);

      return {
        success: true,
        totalCount,
        message: `Đã tải thành công ${totalCount} bản ghi từ Cloud Firestore về máy cho trường [${this.schoolInfo.schoolName || targetSchoolId}].`,
      };
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        this.stopFirestoreRealtimeSync();
        this.cloudSyncStatus = 'idle';
        this.notify();
        return {
          success: false,
          totalCount: 0,
          message: 'Dung lượng miễn phí Cloud Firestore tạm thời đạt giới hạn hôm nay. Hệ thống đang sử dụng dữ liệu cục bộ (Offline-first) đảm bảo hoạt động bình thường 100%.',
        };
      }
      this.cloudSyncStatus = 'error';
      this.notify();
      return {
        success: false,
        totalCount: 0,
        message: err?.message || 'Có lỗi xảy ra khi tải dữ liệu từ Cloud Firestore.',
      };
    }
  }

  public getAuthUid(): string | undefined {
    return this.authUid;
  }

  public setAuthUid(uid?: string): void {
    this.authUid = uid;
    this.notify();
  }

  /**
   * Lắng nghe trạng thái đăng nhập từ Firebase Auth (onAuthStateChanged)
   * Tự động đồng bộ hồ sơ người dùng và nạp dữ liệu theo schoolId
   */
  public initAuthListener(callback?: (user: UserProfile | null) => void): () => void {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }

    this.authUnsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const email = firebaseUser.email?.toLowerCase() || '';

        // BỎ QUA HOÀN TOÀN TÀI KHOẢN ĐỒNG BỘ NGẦM: Không gán làm người dùng hệ thống
        if (isSystemSyncEmail(email)) {
          return;
        }

        this.authUid = firebaseUser.uid;

        // Tìm user profile tương ứng theo authUid hoặc email
        let profile = this.users.find(
          (u) => u.authUid === firebaseUser.uid || (email && isSameEmail(u.email, email))
        );

        if (!profile) {
          const matchingLicense = this.schoolLicenses.find((l) => isSameEmail(l.adminEmail, email));
          let targetSchool = matchingLicense ? matchingLicense.id : undefined;
          if (!targetSchool) {
            targetSchool = isSuperAdminEmail(email)
              ? (this.currentSchoolId || 'school_quyhop')
              : isSameEmail(email, 'thongke.qh@gmail.com')
              ? 'school_thongke'
              : `school_${email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
          }

          // Tạo user profile mới gắn đúng tenant
          profile = this.addUser({
            name: firebaseUser.displayName || matchingLicense?.adminName || email.split('@')[0] || 'Cán bộ giáo viên',
            email: email,
            authUid: firebaseUser.uid,
            schoolId: targetSchool,
            role: 'admin',
            roleTitle: isSuperAdminEmail(email) ? 'Chủ sở hữu & Quản trị viên Tối cao' : 'Quản trị viên trường',
            permission: 'edit',
            isSuperAdmin: isSuperAdminEmail(email),
            status: 'active',
          });
        } else {
          // Cập nhật authUid nếu chưa có
          if (profile.authUid !== firebaseUser.uid) {
            this.updateUser(profile.id, { authUid: firebaseUser.uid });
            profile = this.getUserById(profile.id)!;
          }
        }

        if (this.currentSchoolId) {
          profile.schoolId = this.currentSchoolId;
        } else if (profile.schoolId) {
          this.setSchoolId(profile.schoolId);
        }
        this.currentUser = profile;
        this.saveLocalCacheOnly();
        this.notify();
        callback?.(profile);
      } else {
        this.authUid = undefined;
        callback?.(null);
        this.notify();
      }
    });

    return () => {
      if (this.authUnsubscribe) {
        this.authUnsubscribe();
        this.authUnsubscribe = undefined;
      }
    };
  }

  public canCurrentUserEdit(): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin' || this.currentUser.role === 'principal') return true;
    return this.currentUser.permission === 'edit';
  }

  public canUserEditEntity(entityType?: 'assignments' | 'teachers' | 'classes' | 'curriculum' | 'duties' | 'versions' | 'users'): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin') return true;
    if (this.currentUser.permission === 'view') return false;

    if (this.currentUser.customPermissions && entityType) {
      if (entityType === 'assignments' && this.currentUser.customPermissions.canEditAssignments !== undefined) {
        return this.currentUser.customPermissions.canEditAssignments;
      }
      if (entityType === 'teachers' && this.currentUser.customPermissions.canEditTeachers !== undefined) {
        return this.currentUser.customPermissions.canEditTeachers;
      }
      if (entityType === 'classes' && this.currentUser.customPermissions.canEditClasses !== undefined) {
        return this.currentUser.customPermissions.canEditClasses;
      }
      if (entityType === 'curriculum' && this.currentUser.customPermissions.canEditCurriculum !== undefined) {
        return this.currentUser.customPermissions.canEditCurriculum;
      }
      if (entityType === 'duties' && this.currentUser.customPermissions.canEditDuties !== undefined) {
        return this.currentUser.customPermissions.canEditDuties;
      }
      if (entityType === 'versions' && this.currentUser.customPermissions.canEditVersions !== undefined) {
        return this.currentUser.customPermissions.canEditVersions;
      }
      if (entityType === 'users' && this.currentUser.customPermissions.canManageUsers !== undefined) {
        return this.currentUser.customPermissions.canManageUsers;
      }
    }

    return this.currentUser.permission === 'edit';
  }

  // Users Management Methods
  public getUsers(filterSchoolId?: string): UserProfile[] {
    if (!this.users || this.users.length === 0) {
      this.users = [...INITIAL_USER_PROFILES];
    }

    // Bảo đảm ID luôn duy nhất 100% trong runtime
    const seenIds = new Set<string>();
    const cleanUsers: UserProfile[] = [];
    for (const u of this.users) {
      if (!u || isSystemSyncEmail(u.email)) continue;
      let finalId = u.id;
      if (finalId === 'user_super_admin' && (isSameEmail(u.email, 'nguyentoanqhios@gmail.com') || isSameEmail(u.email, 'nguyentoanqhai@gmail.com'))) {
        finalId = 'user_super_admin_alt';
        u.id = finalId;
      }
      if (seenIds.has(finalId)) {
        finalId = `${finalId}_${u.email ? u.email.split('@')[0].replace(/[^a-z0-9]/gi, '') : Math.random().toString(36).substring(2, 6)}`;
        u.id = finalId;
      }
      seenIds.add(finalId);
      cleanUsers.push(u);
    }
    this.users = cleanUsers;

    // Nếu có bộ lọc trường cụ thể
    if (filterSchoolId) {
      return this.users.filter((u) => (u.schoolId || 'school_quyhop') === filterSchoolId);
    }
    // Nếu là Super Admin (Thầy Toàn / nguyentoanqh@gmail.com): có thể xem toàn bộ hoặc theo trường
    if (isSuperAdminEmail(this.currentUser?.email)) {
      return [...this.users];
    }
    // Đối với người dùng/quản trị viên của từng trường: CHỈ xem danh sách người dùng thuộc trường của mình (không hiển thị tài khoản Super Admin)
    const currentSchool = this.currentSchoolId || this.currentUser?.schoolId || 'school_quyhop';
    return this.users.filter((u) => (u.schoolId || 'school_quyhop') === currentSchool && !isSuperAdminEmail(u.email));
  }

  public getUserById(id: string): UserProfile | undefined {
    return this.users.find((u) => u.id === id);
  }

  public addUser(user: Omit<UserProfile, 'id' | 'createdAt'>): UserProfile {
    // Không bao giờ tạo người dùng cho tài khoản đồng bộ ngầm hệ thống
    if (isSystemSyncEmail(user.email)) {
      return { ...DEFAULT_GUEST_PROFILE, id: 'sys_sync', email: user.email || '' };
    }

    // Nếu email này đã tồn tại trong danh sách, cập nhật thay vì tạo bản ghi trùng lặp
    if (user.email) {
      const existingUser = this.users.find((u) => u.email && isSameEmail(u.email, user.email));
      if (existingUser) {
        this.updateUser(existingUser.id, user);
        return this.getUserById(existingUser.id) || existingUser;
      }
    }

    const targetSchoolId = user.schoolId || this.currentSchoolId || 'school_quyhop';
    let newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    while (this.users.some((u) => u.id === newId)) {
      newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    const newUser: UserProfile = {
      id: newId,
      ...user,
      schoolId: targetSchoolId,
      status: user.status || 'active',
      permission: user.permission || 'view',
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);

    this.logAction({
      action: 'CREATE',
      entityType: 'VERSION',
      entityId: newUser.id,
      entityDescription: `Thêm người dùng mới: ${newUser.name} (${newUser.roleTitle}) - Trường: ${targetSchoolId} - Quyền: ${newUser.permission === 'edit' ? 'Chỉnh sửa' : 'Chỉ xem'}`,
      afterData: newUser,
    });

    this.syncDocToFirestore('users', newUser.id, newUser);
    this.saveToStorage();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<UserProfile>): boolean {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const beforeData = { ...this.users[index] };
    this.users[index] = { ...this.users[index], ...updates };

    // If current logged-in user is updated, update currentUser as well
    if (this.currentUser.id === id) {
      this.currentUser = { ...this.users[index] };
    }

    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Cập nhật thông tin/phân quyền người dùng: ${this.users[index].name} (Quyền: ${this.users[index].permission === 'edit' ? 'Chỉnh sửa' : 'Chỉ xem'})`,
      beforeData,
      afterData: this.users[index],
    });

    this.syncDocToFirestore('users', id, this.users[index]);
    this.saveToStorage();
    return true;
  }

  public deleteUser(id: string): boolean {
    if (this.currentUser.id === id) {
      return false;
    }
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return false;

    const removed = this.users[index];
    this.users.splice(index, 1);

    this.logAction({
      action: 'DELETE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Xóa người dùng: ${removed.name} (${removed.email})`,
      beforeData: removed,
    });

    this.deleteDocFromFirestore('users', id);
    this.saveToStorage();
    return true;
  }

  public setUserPermission(id: string, permission: 'edit' | 'view'): boolean {
    return this.updateUser(id, { permission });
  }

  public getSelectedContext() {
    return {
      schoolYearId: this.currentSchoolYearId,
      semesterId: this.currentSemesterId,
      versionId: this.currentVersionId,
    };
  }

  public setSelectedContext(schoolYearId: string, semesterId: SemesterId, versionId: string) {
    this.currentSchoolYearId = schoolYearId;
    this.currentSemesterId = semesterId;
    this.currentVersionId = versionId;
    this.saveLocalCacheOnly();
    this.notify();
  }

  // Getters
  public getSchoolYears(): SchoolYear[] {
    return [...this.schoolYears];
  }

  public getVersions(schoolYearId?: string, semesterId?: SemesterId): AssignmentVersion[] {
    return this.versions.filter(
      (v) =>
        (!this.currentSchoolId || !v.schoolId || v.schoolId === this.currentSchoolId) &&
        (!schoolYearId || v.schoolYearId === schoolYearId) &&
        (!semesterId || v.semesterId === semesterId)
    );
  }

  public getBranches(includeInactive = false): SchoolBranch[] {
    const rawList = includeInactive ? [...this.branches] : this.branches.filter((b) => b && b.active !== false);
    const list = rawList.filter((b): b is SchoolBranch => Boolean(b && typeof b === 'object'));
    const seen = new Set<string>();
    const result: SchoolBranch[] = [];

    // Luôn luôn chỉ có đúng 1 Điểm chính duy nhất đứng đầu danh sách
    const mainBranch = list.find((b) => b && b.isMain) || list[0];
    if (mainBranch) {
      result.push({
        ...mainBranch,
        name: (mainBranch.name || 'Điểm chính').trim(),
        isMain: true,
      });
      seen.add('diem_chinh');
    }

    for (const b of list) {
      if (!b) continue;
      const safeName = (b.name || '').trim();
      const norm = safeName.normalize('NFC').toLowerCase();
      if (!norm || b.isMain || norm.includes('chính') || norm === 'điểm chính' || norm === 'điểm trường chính') {
        continue;
      }
      if (norm === 'toàn trường' || norm === 'toan truong') {
        continue;
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push({
          ...b,
          name: safeName || 'Điểm lẻ',
          isMain: false,
        });
      }
    }

    // Đối với TRƯỜNG THCS QUỲ HỢP: Luôn đảm bảo đủ 2 điểm trường chuẩn gốc (Điểm chính 28 lớp + Điểm lẻ 14 lớp)
    if ((!this.currentSchoolId || this.currentSchoolId === 'school_quyhop') && result.length < 2) {
      this.branches = [...QUYHOP_BRANCHES];
      return [...QUYHOP_BRANCHES];
    }
    return result;
  }

  public getBranchById(id: string): SchoolBranch | undefined {
    return this.branches.find((b) => b.id === id);
  }

  public addBranch(branchData: Omit<SchoolBranch, 'id'>): SchoolBranch {
    const id = `branch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBranch: SchoolBranch = {
      ...branchData,
      id,
      active: branchData.active !== undefined ? branchData.active : true,
      order: branchData.order || this.branches.length + 1,
    };
    // If this branch is set as main, make all others non-main
    if (newBranch.isMain) {
      this.branches = this.branches.map((b) => ({ ...b, isMain: false }));
    }
    this.branches.push(newBranch);
    this.logAction({
      action: 'CREATE',
      entityType: 'VERSION',
      entityId: newBranch.id,
      entityDescription: `Thêm phân hiệu / điểm trường "${newBranch.name}" (${newBranch.code})`,
      afterData: newBranch,
    });
    this.saveToStorage();
    return newBranch;
  }

  public updateBranch(id: string, updates: Partial<SchoolBranch>): void {
    const idx = this.branches.findIndex((b) => b.id === id);
    if (idx === -1) return;
    if (updates.isMain) {
      this.branches = this.branches.map((b) => (b.id === id ? b : { ...b, isMain: false }));
    }
    const beforeData = { ...this.branches[idx] };
    this.branches[idx] = { ...this.branches[idx], ...updates };
    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Cập nhật phân hiệu "${this.branches[idx].name}"`,
      beforeData,
      afterData: this.branches[idx],
    });
    this.saveToStorage();
  }

  public deleteBranch(id: string): boolean {
    const branch = this.branches.find((b) => b.id === id);
    if (!branch) return false;
    // If this was the main branch and there are other branches, set the first one as main
    if (branch.isMain && this.branches.length > 1) {
      const nextMain = this.branches.find((b) => b.id !== id);
      if (nextMain) nextMain.isMain = true;
    }
    // Reassign any classes assigned to this branch back to the main branch
    const mainBranch =
      this.branches.find((b) => b.id !== id && b.isMain) || this.branches.find((b) => b.id !== id);
    if (mainBranch) {
      this.classes = this.classes.map((c) => (c.branchId === id ? { ...c, branchId: mainBranch.id } : c));
    }
    this.branches = this.branches.filter((b) => b.id !== id);
    if (this.branches.length === 0) {
      this.branches = [...INITIAL_BRANCHES];
    }
    this.logAction({
      action: 'DELETE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Xóa phân hiệu "${branch.name}"`,
      beforeData: branch,
    });
    this.saveToStorage();
    return true;
  }

  // =========================================================================
  // WORKPLACES CATALOG MANAGEMENT (DANH MỤC NƠI LÀM VIỆC)
  // Gồm: Điểm chính, Phân hiệu, Toàn trường & các nơi làm việc người dùng tự thêm
  // =========================================================================
  public getWorkplaces(includeInactive = false): WorkplaceCategory[] {
    const rawList = includeInactive ? [...this.workplaces] : this.workplaces.filter((w) => w && w.active !== false);
    const list = rawList.filter((w): w is WorkplaceCategory => Boolean(w && typeof w === 'object'));
    const seen = new Set<string>();
    const result: WorkplaceCategory[] = [];

    // 1. Toàn trường
    const allWp = list.find((w) => w.code === 'TT' || (w.name || '').trim().normalize('NFC').toLowerCase() === 'toàn trường');
    if (allWp) {
      result.push({ ...allWp, name: (allWp.name || 'Toàn trường').trim() });
      seen.add('toan_truong');
    }

    // 2. Điểm chính duy nhất
    const mainWp =
      list.find((w) => w.isDefault || (w.name || '').trim().normalize('NFC').toLowerCase().includes('chính')) || list[0];
    if (mainWp) {
      result.push({ ...mainWp, name: (mainWp.name || 'Điểm chính').trim(), isDefault: true });
      seen.add('diem_chinh');
    }

    // 3. Các phân hiệu / nơi làm việc khác
    for (const w of list) {
      if (!w) continue;
      const safeName = (w.name || '').trim();
      const norm = safeName.normalize('NFC').toLowerCase();
      if (!norm || norm.includes('chính') || norm === 'điểm chính' || norm === 'điểm trường chính' || w.isDefault) {
        continue;
      }
      if (norm === 'toàn trường' || norm === 'toan truong' || w.code === 'TT') {
        continue;
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push({ ...w, name: safeName, isDefault: false });
      }
    }
    return result;
  }

  public getWorkplaceById(id: string): WorkplaceCategory | undefined {
    return this.workplaces.find((w) => w.id === id);
  }

  public addWorkplace(data: Partial<Omit<WorkplaceCategory, 'id'>> & { name: string }): WorkplaceCategory {
    const id = `wp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newWp: WorkplaceCategory = {
      ...data,
      id,
      code: data.code ? data.code.trim().toUpperCase() : `CS${this.workplaces.length + 1}`,
      name: data.name.trim(),
      active: data.active !== undefined ? data.active : true,
      order: data.order || this.workplaces.length + 1,
    };
    if (newWp.isDefault) {
      this.workplaces = this.workplaces.map((w) => ({ ...w, isDefault: false }));
    }
    this.workplaces.push(newWp);
    this.saveToStorage();
    this.logAction({
      action: 'CREATE',
      entityType: 'VERSION',
      entityId: newWp.id,
      entityDescription: `Thêm danh mục nơi làm việc: "${newWp.name}" (${newWp.code})`,
      afterData: newWp,
    });
    return newWp;
  }

  public updateWorkplace(id: string, updates: Partial<WorkplaceCategory>): boolean {
    const idx = this.workplaces.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    const oldItem = { ...this.workplaces[idx] };
    const oldName = oldItem.name;

    if (updates.isDefault) {
      this.workplaces = this.workplaces.map((w) => (w.id === id ? w : { ...w, isDefault: false }));
    }
    this.workplaces[idx] = {
      ...this.workplaces[idx],
      ...updates,
      ...(updates.code ? { code: updates.code.trim().toUpperCase() } : {}),
      ...(updates.name ? { name: updates.name.trim() } : {}),
    };
    const newName = this.workplaces[idx].name;

    // If workplace name changed, sync all teachers belonging to this workplace
    if (newName !== oldName) {
      this.teachers = this.teachers.map((t) => {
        if (t.workplaceId === id || t.workplace === oldName) {
          return { ...t, workplaceId: id, workplace: newName };
        }
        return t;
      });
    }

    this.saveToStorage();
    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Cập nhật danh mục nơi làm việc: "${newName}"`,
      beforeData: oldItem,
      afterData: this.workplaces[idx],
    });
    return true;
  }

  public deleteWorkplace(id: string, reassignToId?: string): { success: boolean; reassignedCount: number; message?: string } {
    const wp = this.workplaces.find((w) => w.id === id);
    if (!wp) return { success: false, reassignedCount: 0, message: 'Không tìm thấy danh mục nơi làm việc cần xóa.' };
    if (this.workplaces.length <= 1) {
      return { success: false, reassignedCount: 0, message: 'Hệ thống phải có tối thiểu 1 danh mục nơi làm việc.' };
    }

    // Determine target workplace for reassignment
    let fallback = this.workplaces.find((w) => w.id !== id && (reassignToId ? w.id === reassignToId : w.isDefault));
    if (!fallback) {
      fallback = this.workplaces.find((w) => w.id !== id)!;
    }

    let reassignedCount = 0;
    this.teachers = this.teachers.map((t) => {
      if (t.workplaceId === id || t.workplace === wp.name) {
        reassignedCount++;
        return { ...t, workplaceId: fallback.id, workplace: fallback.name };
      }
      return t;
    });

    this.workplaces = this.workplaces.filter((w) => w.id !== id);
    // Ensure at least one is default
    if (!this.workplaces.some((w) => w.isDefault) && this.workplaces.length > 0) {
      this.workplaces[0].isDefault = true;
    }

    this.saveToStorage();
    this.logAction({
      action: 'DELETE',
      entityType: 'VERSION',
      entityId: id,
      entityDescription: `Xóa danh mục nơi làm việc "${wp.name}", đã chuyển ${reassignedCount} GV sang "${fallback.name}"`,
      beforeData: wp,
    });
    return { success: true, reassignedCount };
  }

  public restoreDefaultWorkplaces(): void {
    this.workplaces = [...INITIAL_WORKPLACES];
    const defaultWp = this.workplaces.find((w) => w.isDefault) || this.workplaces[0];
    this.teachers = this.teachers.map((t) => {
      const match = this.workplaces.find((w) => w.id === t.workplaceId || w.name === t.workplace);
      if (match) {
        return { ...t, workplaceId: match.id, workplace: match.name };
      }
      return { ...t, workplaceId: defaultWp.id, workplace: defaultWp.name };
    });
    this.saveToStorage();
    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: 'workplaces_root',
      entityDescription: 'Khôi phục danh mục nơi làm việc mặc định (Điểm chính, Phân hiệu, Toàn trường)',
    });
  }

  public batchUpdateTeacherWorkplace(teacherIds: string[], workplaceId: string): number {
    const targetWp = this.workplaces.find((w) => w.id === workplaceId);
    if (!targetWp) return 0;
    const idSet = new Set(teacherIds);
    let count = 0;
    this.teachers = this.teachers.map((t) => {
      if (idSet.has(t.id)) {
        count++;
        return { ...t, workplaceId: targetWp.id, workplace: targetWp.name };
      }
      return t;
    });
    if (count > 0) {
      this.saveToStorage();
      this.logAction({
        action: 'UPDATE',
        entityType: 'TEACHER',
        entityId: teacherIds.join(','),
        entityDescription: `Gán nơi làm việc "${targetWp.name}" cho ${count} giáo viên`,
      });
    }
    return count;
  }

  public batchUpdateTeacherQuota(teacherIds: string[], standardQuota: number, reason?: string): number {
    if (teacherIds.length === 0 || isNaN(standardQuota) || standardQuota < 0) return 0;
    const idSet = new Set(teacherIds);
    let count = 0;
    this.teachers = this.teachers.map((t) => {
      if (idSet.has(t.id)) {
        count++;
        return { ...t, standardQuota };
      }
      return t;
    });
    if (count > 0) {
      this.saveToStorage();
      this.logAction({
        action: 'UPDATE',
        entityType: 'TEACHER',
        entityId: teacherIds.join(','),
        entityDescription: `Cập nhật định mức ${standardQuota} tiết/tuần cho ${count} giáo viên`,
        reason: reason || 'Cập nhật định mức tiết dạy hàng loạt',
      });
    }
    return count;
  }

  public batchUpdateTeacherQuotaMultiple(
    updates: { teacherId: string; standardQuota: number }[],
    reason?: string
  ): number {
    if (updates.length === 0) return 0;
    const quotaMap = new Map(updates.map((u) => [u.teacherId, u.standardQuota]));
    let count = 0;
    this.teachers = this.teachers.map((t) => {
      if (quotaMap.has(t.id)) {
        const newQuota = quotaMap.get(t.id)!;
        if (!isNaN(newQuota) && newQuota >= 0 && newQuota !== t.standardQuota) {
          count++;
          return { ...t, standardQuota: newQuota };
        }
      }
      return t;
    });
    if (count > 0) {
      this.saveToStorage();
      this.logAction({
        action: 'UPDATE',
        entityType: 'TEACHER',
        entityId: updates.map((u) => u.teacherId).join(','),
        entityDescription: `Cập nhật định mức tiết dạy cho ${count} giáo viên`,
        reason: reason || 'Điều chỉnh định mức theo danh sách',
      });
    }
    return count;
  }

  public getDepartments(): Department[] {
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    if (isQuyHop) {
      return this.departments.filter((d) => !d.schoolId || d.schoolId === 'school_quyhop');
    }
    return this.departments.filter((d) => !d.schoolId || d.schoolId === this.currentSchoolId);
  }

  public getDuties(): SpecialDuty[] {
    return this.duties.filter((d) => !isForbiddenDutyOrExemption(d));
  }

  public getClasses(includeDeleted = false): SchoolClass[] {
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    let list = includeDeleted ? this.classes : this.classes.filter((c) => !c.isDeleted);
    if (!isQuyHop) {
      list = list.filter((c) => c.schoolId === this.currentSchoolId);
    } else {
      list = list.filter((c) => !c.schoolId || c.schoolId === 'school_quyhop');
    }
    return [...list];
  }

  public getSubjects(): Subject[] {
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    const list = isQuyHop
      ? this.subjects.filter((s) => !s.schoolId || s.schoolId === 'school_quyhop')
      : this.subjects.filter((s) => !s.schoolId || s.schoolId === this.currentSchoolId);

    return this.deduplicateSubjectsList(list);
  }

  public getCurriculum(schoolYearId?: string, semesterId?: SemesterId): CurriculumDistribution[] {
    return this.curriculum.filter(
      (c) =>
        (!schoolYearId || c.schoolYearId === schoolYearId) &&
        (!semesterId || c.semesterId === semesterId)
    );
  }

  public getTeachers(includeDeleted = false): Teacher[] {
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    let list = includeDeleted ? this.teachers : this.teachers.filter((t) => !t.isDeleted);
    if (!isQuyHop) {
      list = list.filter((t) => t.schoolId === this.currentSchoolId);
    } else {
      list = list.filter((t) => !t.schoolId || t.schoolId === 'school_quyhop');
    }
    return [...list];
  }

  /**
   * Khử triệt để mọi phân công mồ côi (không thuộc giáo viên của trường hoặc thuộc giáo viên đã xóa / trường khác)
   */
  public cleanOrphanedAssignments(): void {
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    const validTeacherIds = new Set(this.teachers.filter((t) => !t.isDeleted).map((t) => t.id));
    this.assignments = this.assignments.filter((a) => {
      if (a.isDeleted) return false;
      if (!isQuyHop) {
        if (a.schoolId && a.schoolId !== this.currentSchoolId) return false;
        if (!validTeacherIds.has(a.teacherId)) return false;
        if (/^tc_gv\d+$/.test(a.teacherId)) return false;
      }
      return true;
    });
    this.deduplicateDutyAssignments();
  }

  /**
   * Khử trùng lặp triệt để các nhiệm vụ kiêm nhiệm / miễn giảm:
   * Tuyệt đối không cho phép 1 người được giao 2 lần cùng một nhiệm vụ trong cùng một phiên bản phân công.
   * Đồng thời đồng bộ và làm sạch danh sách teacher.positions của từng giáo viên.
   */
  public deduplicateDutyAssignments(): number {
    let removedCount = 0;
    const isDutyAsg = (a: TeachingAssignment) =>
      !a.isDeleted &&
      (a.type === 'CONCURRENT' ||
        a.type === 'EXEMPTION' ||
        a.type === 'CONCURRENT_DUTY' ||
        Boolean(a.dutyId) ||
        Boolean(a.dutyName));

    // Nhóm các phân công kiêm nhiệm theo (versionId + teacherId)
    const grouped = new Map<string, TeachingAssignment[]>();

    for (const a of this.assignments) {
      if (!isDutyAsg(a)) continue;
      const groupKey = `${a.schoolYearId || this.currentSchoolYearId}_${a.semesterId || this.currentSemesterId}_${a.versionId || this.currentVersionId}_${a.teacherId}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(a);
    }

    const idsToDelete = new Set<string>();

    for (const [, asgList] of grouped.entries()) {
      if (asgList.length <= 1) continue;

      // Nhóm theo canonical duty identity
      const dutyBuckets = new Map<string, TeachingAssignment[]>();

      for (const a of asgList) {
        let canonicalKey = '';
        const rawName = (a.dutyName || '').trim();
        const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
        const normName = normalizePositionName(cleanName).toLowerCase();

        // 1. Tổ trưởng chuyên môn
        if (this.isHeadDepartmentDuty(a.dutyId, a.dutyName)) {
          canonicalKey = 'head_dept';
        }
        // 2. Tổ phó chuyên môn
        else if (this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)) {
          canonicalKey = 'deputy_dept';
        }
        // 3. Chủ nhiệm lớp cụ thể
        else if (a.classId || normName.startsWith('chủ nhiệm lớp ') || cleanName.toLowerCase().startsWith('chủ nhiệm lớp ')) {
          const cls = this.classes.find((c) => c.id === a.classId || (a.dutyName && a.dutyName.includes(c.name)));
          canonicalKey = `homeroom_${cls ? cls.name.toLowerCase() : cleanName.toLowerCase()}`;
        }
        // 4. Các nhiệm vụ khác: dựa trên normName hoặc cleanName
        else if (normName) {
          canonicalKey = `duty_${normName}`;
        } else if (a.dutyId) {
          canonicalKey = `duty_id_${a.dutyId.toLowerCase()}`;
        } else {
          canonicalKey = `duty_raw_${cleanName.toLowerCase()}`;
        }

        if (!dutyBuckets.has(canonicalKey)) {
          dutyBuckets.set(canonicalKey, []);
        }
        dutyBuckets.get(canonicalKey)!.push(a);
      }

      // Với mỗi canonical duty, nếu có từ 2 phân công trở lên -> giữ 1, xóa các bản sao trùng lặp
      for (const [, bucket] of dutyBuckets.entries()) {
        if (bucket.length <= 1) continue;

        bucket.sort((x, y) => {
          const xPeriods = x.periodsPerWeek || 0;
          const yPeriods = y.periodsPerWeek || 0;
          if (xPeriods !== yPeriods) return yPeriods - xPeriods;
          if (x.status === 'approved' && y.status !== 'approved') return -1;
          if (y.status === 'approved' && x.status !== 'approved') return 1;
          const xIsSync = x.id.startsWith('as_sync_pos_');
          const yIsSync = y.id.startsWith('as_sync_pos_');
          if (!xIsSync && yIsSync) return -1;
          if (xIsSync && !yIsSync) return 1;
          return 0;
        });

        const duplicates = bucket.slice(1);

        for (const dup of duplicates) {
          idsToDelete.add(dup.id);
          dup.isDeleted = true;
          removedCount++;
          // Xóa đồng bộ trên Cloud Firestore
          const safeDocId = dup.id.replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
          firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
        }
      }
    }

    if (idsToDelete.size > 0) {
      this.assignments = this.assignments.filter((a) => !idsToDelete.has(a.id));
    }

    // Đồng thời làm sạch và khử trùng lặp teacher.positions cho tất cả giáo viên
    for (const teacher of this.teachers) {
      if (!Array.isArray(teacher.positions) || teacher.positions.length <= 1) continue;
      const seenPosNorm = new Set<string>();
      const dedupedPositions: string[] = [];
      for (const pos of teacher.positions) {
        const clean = pos.replace(/\s*\([^)]*\)/g, '').trim();
        const norm = normalizePositionName(clean);
        const normKey = (norm || clean).toLowerCase();
        if (!seenPosNorm.has(normKey)) {
          seenPosNorm.add(normKey);
          dedupedPositions.push(pos);
        }
      }
      if (dedupedPositions.length !== teacher.positions.length) {
        teacher.positions = dedupedPositions;
        firestoreRepository.setDocData(this.currentSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
      }
    }

    return removedCount;
  }

  public getAssignments(
    schoolYearId?: string,
    semesterId?: SemesterId,
    versionId?: string,
    includeDeleted = false
  ): TeachingAssignment[] {
    if ((!this.currentSchoolId || this.currentSchoolId === 'school_quyhop') && (!this.assignments || this.assignments.length < 50)) {
      this.assignments = generateQuyHopAssignments();
    }
    const isQuyHop = !this.currentSchoolId || this.currentSchoolId === 'school_quyhop';
    if (!isQuyHop && this.teachers.length === 0) {
      return [];
    }
    const validTeacherIds = new Set(this.teachers.filter((t) => !t.isDeleted).map((t) => t.id));

    return this.assignments.filter(
      (a) =>
        (includeDeleted || !a.isDeleted) &&
        (isQuyHop ? (!a.schoolId || a.schoolId === 'school_quyhop') : (a.schoolId === this.currentSchoolId)) &&
        validTeacherIds.has(a.teacherId) &&
        (!schoolYearId || a.schoolYearId === schoolYearId) &&
        (!semesterId || a.semesterId === semesterId) &&
        (!versionId || a.versionId === versionId)
    );
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public getFeedbacks(): FeedbackRequest[] {
    return [...this.feedbacks];
  }

  public getBackups(): SystemBackup[] {
    return [...this.backups];
  }

  // Audit Log recording
  public logAction(log: Omit<AuditLog, 'id' | 'timestamp' | 'userId' | 'userName' | 'userRole'>) {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      userRole: this.currentUser.role,
      ...log,
    };
    this.auditLogs.unshift(newLog);
    // Keep max 500 logs
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
  }

  // ASSIGNMENTS MUTATIONS
  public addAssignments(newAssignments: Omit<TeachingAssignment, 'id' | 'createdAt' | 'createdBy'>[]): TeachingAssignment[] {
    const createdList: TeachingAssignment[] = [];
    const timestamp = new Date().toISOString();

    for (const item of newAssignments) {
      const assignment: TeachingAssignment = {
        id: `as_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        schoolId: item.schoolId || this.currentSchoolId,
        ...item,
        createdAt: timestamp,
        createdBy: this.currentUser.name,
        status: item.status || 'draft',
      };
      this.assignments.push(assignment);
      createdList.push(assignment);
    }

    this.logAction({
      action: 'CREATE',
      entityType: 'ASSIGNMENT',
      entityId: createdList.map((c) => c.id).join(','),
      entityDescription: `Thêm ${createdList.length} dòng phân công chuyên môn`,
      afterData: createdList,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return createdList;
  }

  public replaceAssignmentsForVersion(
    schoolYearId: string,
    semesterId: SemesterId,
    versionId: string,
    newAssignments: TeachingAssignment[]
  ): void {
    const kept = this.assignments.filter(
      (a) =>
        a.schoolYearId !== schoolYearId ||
        a.semesterId !== semesterId ||
        a.versionId !== versionId
    );
    const fixedNewAssignments = newAssignments.map((a) => ({
      ...a,
      schoolId: a.schoolId || this.currentSchoolId,
    }));
    this.assignments = [...kept, ...fixedNewAssignments];
    this.logAction({
      action: 'UPDATE',
      entityType: 'ASSIGNMENT',
      entityId: versionId,
      entityDescription: `Cập nhật toàn bộ phân công qua Phân công thông minh (${newAssignments.length} dòng)`,
    });
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
  }

  public updateAssignment(id: string, updates: Partial<TeachingAssignment>, reason?: string): boolean {
    const index = this.assignments.findIndex((a) => a.id === id);
    if (index === -1) return false;

    const beforeData = { ...this.assignments[index] };
    this.assignments[index] = {
      ...this.assignments[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: this.currentUser.name,
    };

    this.logAction({
      action: 'UPDATE',
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityDescription: `Cập nhật phân công ${this.assignments[index].id}`,
      beforeData,
      afterData: this.assignments[index],
      reason,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return true;
  }

  public deleteAssignment(id: string, permanent = false, reason?: string): boolean {
    const cleanId = id.replace(/[\/\\]+/g, '_');
    const index = this.assignments.findIndex((a) => a.id === id || a.id === cleanId);
    if (index === -1) return false;

    const beforeData = { ...this.assignments[index] };
    if (permanent) {
      this.assignments.splice(index, 1);
    } else {
      this.assignments[index].isDeleted = true;
      this.assignments[index].updatedAt = new Date().toISOString();
      this.assignments[index].updatedBy = this.currentUser.name;
    }

    this.logAction({
      action: 'DELETE',
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityDescription: permanent ? `Xóa vĩnh viễn phân công ${id}` : `Chuyển vào thùng rác phân công ${id}`,
      beforeData,
      reason,
    });

    const deletedItem = beforeData;
    if (deletedItem) {
      const isConcurrent = deletedItem.type === 'CONCURRENT' || deletedItem.type === 'EXEMPTION' || deletedItem.type === 'CONCURRENT_DUTY' || Boolean(deletedItem.dutyId);
      if (isConcurrent) {
        // 1. Tổ trưởng / Tổ phó
        const isHead = this.isHeadDepartmentDuty(deletedItem.dutyId, deletedItem.dutyName);
        const isDep = this.isDeputyDepartmentDuty(deletedItem.dutyId, deletedItem.dutyName);
        if (isHead) {
          const otherHead = this.assignments.some(
            (a) => !a.isDeleted && a.id !== id && a.id !== cleanId && a.teacherId === deletedItem.teacherId && a.type === 'CONCURRENT' && this.isHeadDepartmentDuty(a.dutyId, a.dutyName)
          );
          if (!otherHead) {
            const dept = this.departments.find((d) => d.id === deletedItem.departmentId || d.headTeacherId === deletedItem.teacherId);
            if (dept && dept.headTeacherId === deletedItem.teacherId) {
              dept.headTeacherId = undefined;
            }
          }
        }
        if (isDep) {
          const otherDep = this.assignments.some(
            (a) => !a.isDeleted && a.id !== id && a.id !== cleanId && a.teacherId === deletedItem.teacherId && a.type === 'CONCURRENT' && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)
          );
          if (!otherDep) {
            const dept = this.departments.find(
              (d) => d.id === deletedItem.departmentId || (Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.includes(deletedItem.teacherId))
            );
            if (dept) {
              if (Array.isArray(dept.deputyTeacherIds)) {
                dept.deputyTeacherIds = dept.deputyTeacherIds.filter((tId) => tId !== deletedItem.teacherId);
              }
              dept.deputyTeacherId = dept.deputyTeacherIds?.[0] || undefined;
            }
          }
        }

        // 2. Xóa khỏi teacher.positions để syncAllDepartmentDutiesAndAssignments không tự động hồi sinh
        if (deletedItem.teacherId) {
          const t = this.teachers.find((tc) => tc.id === deletedItem.teacherId);
          if (t && Array.isArray(t.positions) && t.positions.length > 0) {
            const rawClean = (deletedItem.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
            const normClean = normalizePositionName(rawClean).toLowerCase();
            const dId = (deletedItem.dutyId || '').trim().toLowerCase();
            t.positions = t.positions.filter((pos) => {
              const cleanPos = pos.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
              const normPos = normalizePositionName(cleanPos).toLowerCase();
              if (normClean && (normPos === normClean || cleanPos === normClean || cleanPos === rawClean)) {
                return false;
              }
              if (rawClean && (cleanPos.includes(rawClean) || rawClean.includes(cleanPos))) {
                return false;
              }
              const slug = cleanPos.replace(/[^a-z0-9_-]+/g, '_');
              if (dId && (dId.includes(slug) || slug.includes(dId.replace('duty_custom_', '')))) {
                return false;
              }
              return true;
            });
            firestoreRepository.setDocData(this.currentSchoolId, 'teachers', t.id, t).catch(() => {});
          }
        }

        // 3. Phân công chủ nhiệm: xóa homeroomTeacherId của lớp tương ứng
        if (deletedItem.classId || (deletedItem.dutyName && deletedItem.dutyName.toLowerCase().includes('chủ nhiệm'))) {
          const cls = this.classes.find(
            (c) => c.id === deletedItem.classId || (deletedItem.dutyName && deletedItem.dutyName.includes(c.name))
          );
          if (cls && cls.homeroomTeacherId === deletedItem.teacherId) {
            cls.homeroomTeacherId = undefined;
            firestoreRepository.setDocData(this.currentSchoolId, 'classes', cls.id, cls).catch(() => {});
          }
        }
      }

      // 4. Đồng bộ xóa lên Cloud Firestore ngay lập tức
      const safeDocId = (id || '').replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
      if (permanent) {
        firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
      } else {
        firestoreRepository.setDocData(this.currentSchoolId, 'assignments', safeDocId, { isDeleted: true, updatedAt: new Date().toISOString() }, true).catch(() => {});
      }
    }

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage(true);
    return true;
  }

  public restoreAssignment(id: string): boolean {
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return false;

    item.isDeleted = false;
    item.updatedAt = new Date().toISOString();
    item.updatedBy = this.currentUser.name;

    this.logAction({
      action: 'RESTORE',
      entityType: 'ASSIGNMENT',
      entityId: id,
      entityDescription: `Khôi phục phân công ${id} từ thùng rác`,
      afterData: item,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return true;
  }

  // VERSION MUTATIONS
  public createVersion(params: {
    schoolYearId: string;
    semesterId: SemesterId;
    name: string;
    cloneFromVersionId?: string;
    notes?: string;
  }): AssignmentVersion {
    const newVersion: AssignmentVersion = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      schoolYearId: params.schoolYearId,
      semesterId: params.semesterId,
      name: params.name,
      isOfficial: false,
      status: 'draft',
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser.name,
      notes: params.notes,
    };

    this.versions.push(newVersion);

    // If cloning from existing version
    if (params.cloneFromVersionId) {
      const sourceAssignments = this.assignments.filter(
        (a) => a.versionId === params.cloneFromVersionId && !a.isDeleted
      );
      const timestamp = new Date().toISOString();
      for (const a of sourceAssignments) {
        this.assignments.push({
          ...a,
          id: `as_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          schoolYearId: params.schoolYearId,
          semesterId: params.semesterId,
          versionId: newVersion.id,
          createdAt: timestamp,
          createdBy: this.currentUser.name,
          status: 'draft',
        });
      }
    }

    this.logAction({
      action: 'CREATE',
      entityType: 'VERSION',
      entityId: newVersion.id,
      entityDescription: `Tạo phiên bản phân công mới "${newVersion.name}" (${newVersion.semesterId})`,
      afterData: newVersion,
    });

    this.currentVersionId = newVersion.id;
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return newVersion;
  }

  public updateVersion(versionId: string, updates: Partial<AssignmentVersion>): boolean {
    const index = this.versions.findIndex((v) => v.id === versionId);
    if (index === -1) return false;

    const beforeData = { ...this.versions[index] };
    this.versions[index] = { ...this.versions[index], ...updates };

    this.logAction({
      action: 'UPDATE',
      entityType: 'VERSION',
      entityId: versionId,
      entityDescription: `Cập nhật thông tin phiên bản "${this.versions[index].name}"`,
      beforeData,
      afterData: this.versions[index],
    });

    this.saveToStorage();
    return true;
  }

  public duplicateVersion(
    sourceVersionId: string,
    newName: string,
    targetSemesterId?: SemesterId,
    notes?: string
  ): AssignmentVersion | null {
    const sourceVer = this.versions.find((v) => v.id === sourceVersionId);
    if (!sourceVer) return null;

    const semId = targetSemesterId || sourceVer.semesterId;
    return this.createVersion({
      schoolYearId: sourceVer.schoolYearId,
      semesterId: semId,
      name: newName,
      cloneFromVersionId: sourceVersionId,
      notes: notes || `Nhân bản từ ${sourceVer.name} (${new Date().toLocaleDateString('vi-VN')})`,
    });
  }

  public deleteVersion(versionId: string): boolean {
    const index = this.versions.findIndex((v) => v.id === versionId);
    if (index === -1) return false;

    // Do not delete if only 1 version exists for that semester
    const sameSemesterVersions = this.versions.filter((v) => v.semesterId === this.versions[index].semesterId);
    if (sameSemesterVersions.length <= 1) {
      return false;
    }

    const removedVer = this.versions[index];
    this.versions.splice(index, 1);

    // Also remove or soft-delete assignments associated with this version
    this.assignments = this.assignments.filter((a) => a.versionId !== versionId);

    // If current selected version was deleted, switch to another
    if (this.currentVersionId === versionId) {
      const fallback = this.versions.find((v) => v.semesterId === removedVer.semesterId) || this.versions[0];
      if (fallback) {
        this.currentVersionId = fallback.id;
        this.currentSemesterId = fallback.semesterId;
      }
    }

    this.logAction({
      action: 'DELETE',
      entityType: 'VERSION',
      entityId: versionId,
      entityDescription: `Xóa phiên bản phân công: "${removedVer.name}"`,
      beforeData: removedVer,
    });

    this.saveToStorage();
    return true;
  }

  public setVersionStatus(versionId: string, status: AssignmentVersion['status'], lockReason?: string): boolean {
    const version = this.versions.find((v) => v.id === versionId);
    if (!version) return false;

    const beforeData = { ...version };
    version.status = status;

    if (status === 'approved') {
      version.approvedAt = new Date().toISOString();
      version.approvedBy = this.currentUser.name;
      // Đồng bộ trạng thái toàn bộ phân công của phiên bản này sang 'approved'
      this.assignments = this.assignments.map((a) => {
        if (a.versionId === versionId && !a.isDeleted) {
          return { ...a, status: 'approved' };
        }
        return a;
      });
    } else if (status === 'draft') {
      version.approvedAt = undefined;
      version.approvedBy = undefined;
      version.lockedAt = undefined;
      version.lockedBy = undefined;
      // Đồng bộ trạng thái phân công về 'draft'
      this.assignments = this.assignments.map((a) => {
        if (a.versionId === versionId && !a.isDeleted) {
          return { ...a, status: 'draft' };
        }
        return a;
      });
    } else if (status === 'locked') {
      version.lockedAt = new Date().toISOString();
      version.lockedBy = this.currentUser.name;
      version.lockReason = lockReason || 'Khóa sau khi hoàn tất kiểm tra chuyên môn';
    }

    this.logAction({
      action: status === 'locked' ? 'LOCK' : status === 'approved' ? 'APPROVE' : 'UPDATE',
      entityType: 'VERSION',
      entityId: versionId,
      entityDescription: `Thay đổi trạng thái phiên bản "${version.name}" sang [${status.toUpperCase()}]`,
      beforeData,
      afterData: version,
      reason: lockReason,
    });

    this.saveToStorage();
    return true;
  }

  /**
   * Chuyển một phiên bản phân công và toàn bộ dòng phân công của phiên bản sang BẢN DUYỆT chính thức
   */
  public approveVersion(versionId: string, approverName?: string): boolean {
    const version = this.versions.find((v) => v.id === versionId);
    if (!version) return false;

    return this.setVersionStatus(versionId, 'approved');
  }

  /**
   * Chuyển phiên bản phân công về BẢN NHÁP để tiếp tục chỉnh sửa
   */
  public unapproveVersion(versionId: string): boolean {
    const version = this.versions.find((v) => v.id === versionId);
    if (!version) return false;

    return this.setVersionStatus(versionId, 'draft');
  }

  /**
   * Thay đổi trạng thái hàng loạt phân công (chuyển thành 'approved' hoặc 'draft')
   */
  public bulkSetAssignmentStatus(assignmentIds: string[], status: 'approved' | 'draft'): number {
    const idSet = new Set(assignmentIds);
    let count = 0;
    this.assignments = this.assignments.map((a) => {
      if (idSet.has(a.id) && !a.isDeleted) {
        count++;
        return { ...a, status };
      }
      return a;
    });

    if (count > 0) {
      this.logAction({
        action: status === 'approved' ? 'APPROVE' : 'UPDATE',
        entityType: 'ASSIGNMENT',
        entityId: 'bulk',
        entityDescription: `Chuyển trạng thái ${count} phân công sang [${status === 'approved' ? 'BẢN DUYỆT' : 'BẢN NHÁP'}]`,
      });
      this.saveToStorage();
    }
    return count;
  }

  // BULK ASSIGNMENTS MUTATIONS
  public bulkDeleteAssignments(assignmentIds: string[], permanent = false, reason?: string): number {
    let count = 0;
    for (const id of assignmentIds) {
      if (this.deleteAssignment(id, permanent, reason || 'Xóa hàng loạt')) {
        count++;
      }
    }
    return count;
  }

  // TEACHER MUTATIONS
  public addTeacher(teacher: Omit<Teacher, 'id'>): Teacher {
    // MỤC 2: Kiểm tra hạn mức giáo viên bản quyền
    const quota = this.canAddTeacher(1);
    if (!quota.allowed) {
      console.warn('Vượt quá hạn mức giáo viên:', quota.message);
      throw new Error(quota.message || 'Đã đạt giới hạn giáo viên tối đa theo bản quyền!');
    }

    if (!this.workplaces || this.workplaces.length === 0) {
      this.workplaces = [...INITIAL_WORKPLACES];
    }
    if (!this.departments || this.departments.length === 0) {
      this.departments = INITIAL_DEPARTMENTS.map((d) => ({
        ...d,
        schoolId: this.currentSchoolId,
        teacherIds: [],
        headTeacherId: undefined,
        deputyTeacherId: undefined,
        deputyTeacherIds: [],
      }));
    }

    const defaultWp = this.workplaces.find((w) => w.isDefault) || this.workplaces[0] || INITIAL_WORKPLACES[0];
    let wpId = teacher.workplaceId;
    let wpName = teacher.workplace;
    if (wpId && !wpName) {
      wpName = this.workplaces.find((w) => w.id === wpId)?.name || defaultWp?.name;
    } else if (!wpId && wpName) {
      wpId = this.workplaces.find((w) => (w.name || '').trim().toLowerCase() === (wpName || '').trim().toLowerCase())?.id || defaultWp?.id;
    } else if (!wpId && !wpName) {
      wpId = defaultWp?.id;
      wpName = defaultWp?.name;
    }

    const defaultDeptId = this.departments[0]?.id || 'dept_toan_tin';
    const finalDeptId = teacher.departmentId || defaultDeptId;

    const newTeacher: Teacher = {
      id: `tc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...teacher,
      schoolId: teacher.schoolId || this.currentSchoolId,
      departmentId: finalDeptId,
      workplaceId: wpId,
      workplace: wpName,
      isDeleted: false,
    };
    if (newTeacher.positions) {
      newTeacher.positions = Array.from(
        new Set(newTeacher.positions.map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p)))
      );
    }
    if (newTeacher.subjectsCanTeach) {
      newTeacher.subjectsCanTeach = Array.from(
        new Set(newTeacher.subjectsCanTeach.map((s) => s.trim()).filter((s): s is string => Boolean(s)))
      );
    }
    this.teachers.push(newTeacher);

    if (newTeacher.departmentId) {
      const dept = this.departments.find((d) => d.id === newTeacher.departmentId);
      if (dept) {
        if (!Array.isArray(dept.teacherIds)) dept.teacherIds = [];
        if (!dept.teacherIds.includes(newTeacher.id)) {
          dept.teacherIds.push(newTeacher.id);
        }
        dept.teacherIds = Array.from(new Set(dept.teacherIds.filter(Boolean)));
      }
    }

    // Đồng bộ chức vụ kiêm nhiệm, danh mục duties và bảng phân công assignments ngay lập tức
    if (newTeacher.positions && newTeacher.positions.length > 0) {
      this.syncTeacherPositions(newTeacher.id, newTeacher.positions, newTeacher.departmentId);
    }

    this.logAction({
      action: 'CREATE',
      entityType: 'TEACHER',
      entityId: newTeacher.id,
      entityDescription: `Thêm giáo viên mới: ${newTeacher.fullName} (${newTeacher.code}) - Nơi làm việc: ${newTeacher.workplace}`,
      afterData: newTeacher,
    });

    this.saveToStorage();
    try {
      const targetSId = newTeacher.schoolId || this.currentSchoolId || 'school_quyhop';
      firestoreRepository.setDocData(targetSId, 'teachers', newTeacher.id, newTeacher).catch(() => {});
    } catch {}
    return newTeacher;
  }

  public bulkAddTeachers(teachersData: Omit<Teacher, 'id'>[]): Teacher[] {
    // MỤC 2: Kiểm tra hạn mức giáo viên bản quyền khi thêm hàng loạt
    if (teachersData.length > 0) {
      const quota = this.canAddTeacher(teachersData.length);
      if (!quota.allowed) {
        console.warn('Vượt quá hạn mức giáo viên hàng loạt:', quota.message);
        throw new Error(quota.message || 'Đã đạt giới hạn giáo viên tối đa theo bản quyền!');
      }
    }

    const created: Teacher[] = [];
    const timestamp = Date.now();
    const defaultWp = this.workplaces.find((w) => w.isDefault) || this.workplaces[0];
    const defaultDeptId = this.departments[0]?.id || 'dept_toan_tin';

    teachersData.forEach((t, i) => {
      let wpId = t.workplaceId;
      let wpName = t.workplace;
      if (wpId && !wpName) {
        wpName = this.workplaces.find((w) => w.id === wpId)?.name || defaultWp?.name;
      } else if (!wpId && wpName) {
        wpId = this.workplaces.find((w) => (w.name || '').trim().toLowerCase() === (wpName || '').trim().toLowerCase())?.id || defaultWp?.id;
      } else if (!wpId && !wpName) {
        wpId = defaultWp?.id;
        wpName = defaultWp?.name;
      }

      const finalDeptId = t.departmentId || defaultDeptId;
      const newTeacher: Teacher = {
        id: `tc_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        ...t,
        schoolId: t.schoolId || this.currentSchoolId,
        departmentId: finalDeptId,
        workplaceId: wpId,
        workplace: wpName,
        isDeleted: false,
      };
      this.teachers.push(newTeacher);
      created.push(newTeacher);

      // Đồng bộ vào tổ chuyên môn
      const dept = this.departments.find((d) => d.id === finalDeptId);
      if (dept) {
        if (!Array.isArray(dept.teacherIds)) dept.teacherIds = [];
        dept.teacherIds.push(newTeacher.id);
        dept.teacherIds = Array.from(new Set(dept.teacherIds.filter(Boolean)));
      }
    });

    // Đồng bộ chức vụ kiêm nhiệm, danh mục duties và bảng phân công cho các giáo viên vừa tạo
    created.forEach((t) => {
      if (t.positions && t.positions.length > 0) {
        this.syncTeacherPositions(t.id, t.positions, t.departmentId);
      }
    });

    this.logAction({
      action: 'CREATE',
      entityType: 'TEACHER',
      entityId: created.map((t) => t.id).join(','),
      entityDescription: `Thêm hàng loạt ${created.length} giáo viên vào hệ thống`,
      afterData: created,
    });

    this.saveToStorage();
    try {
      const targetSId = this.currentSchoolId || 'school_quyhop';
      firestoreRepository.batchSetDocuments(targetSId, 'teachers', created).catch(() => {});
    } catch {}
    return created;
  }

  /**
   * Căn cứ gốc đồng bộ giáo viên: Nhập & cập nhật hàng loạt hồ sơ giáo viên đầy đủ nhất.
   * Mode 'UPSERT': Nếu trùng Mã GV hoặc Tên GV thì cập nhật các trường mới, chưa có thì thêm mới.
   * Mode 'ADD_ONLY': Chỉ thêm các giáo viên chưa từng tồn tại trong hệ thống.
   */
  public bulkUpsertTeachers(
    teachersData: Partial<Teacher>[],
    mode: 'UPSERT' | 'ADD_ONLY' = 'UPSERT'
  ): { addedCount: number; updatedCount: number; totalProcessed: number; teachers: Teacher[] } {
    let addedCount = 0;
    let updatedCount = 0;
    const newlyAddedTeachers: Teacher[] = [];
    const defaultWp = this.workplaces.find((w) => w.isDefault) || this.workplaces[0];
    const timestamp = Date.now();

    teachersData.forEach((tData, i) => {
      if (!tData.fullName?.trim()) return;

      const normName = removeVietnameseTones(tData.fullName);
      const codeTrim = (tData.code || '').trim().toUpperCase();

      // Tìm kiếm giáo viên đã tồn tại theo Mã GV hoặc Tên
      const existingIndex = this.teachers.findIndex((t) => {
        if (codeTrim && t.code && t.code.trim().toUpperCase() === codeTrim) return true;
        if (normName && removeVietnameseTones(t.fullName) === normName) return true;
        return false;
      });

      // Xác định Nơi làm việc chuẩn hóa
      let resolvedWpId = tData.workplaceId;
      let resolvedWpName = tData.workplace;
      if (resolvedWpId && !resolvedWpName) {
        resolvedWpName = this.workplaces.find((w) => w.id === resolvedWpId)?.name || defaultWp?.name;
      } else if (!resolvedWpId && resolvedWpName) {
        resolvedWpId =
          this.workplaces.find((w) => removeVietnameseTones(w.name) === removeVietnameseTones(resolvedWpName || ''))?.id ||
          defaultWp?.id;
      } else if (!resolvedWpId && !resolvedWpName) {
        resolvedWpId = defaultWp?.id;
        resolvedWpName = defaultWp?.name;
      }

      // Xác định Tổ chuyên môn chuẩn hóa
      let resolvedDeptId = tData.departmentId;
      if (!resolvedDeptId && (tData as any).departmentName) {
        const normDept = removeVietnameseTones((tData as any).departmentName);
        const matchDept = this.departments.find(
          (d) => removeVietnameseTones(d.name).includes(normDept) || normDept.includes(removeVietnameseTones(d.name))
        );
        if (matchDept) resolvedDeptId = matchDept.id;
      }
      if (!resolvedDeptId) {
        resolvedDeptId = this.departments[0]?.id || 'dept_toan_tin';
      }

      const cleanPositions = tData.positions
        ? Array.from(new Set(tData.positions.map((p) => normalizePositionName(p)).filter(Boolean)))
        : undefined;

      const cleanSubjects = tData.subjectsCanTeach
        ? Array.from(new Set(tData.subjectsCanTeach.map((s) => s.trim()).filter(Boolean)))
        : undefined;

      if (existingIndex !== -1 && mode === 'UPSERT') {
        const existing = this.teachers[existingIndex];
        const updates: Partial<Teacher> = {};
        // Khôi phục giáo viên nếu trước đó từng bị xóa
        updates.isDeleted = false;
        if (tData.fullName) updates.fullName = tData.fullName.trim();
        if (tData.code && !tData.code.startsWith('STT')) updates.code = tData.code.trim();
        if (tData.gender) updates.gender = tData.gender;
        if (tData.birthDate !== undefined) updates.birthDate = tData.birthDate;
        if (tData.startYear) updates.startYear = tData.startYear;
        if (tData.initialDegree) updates.initialDegree = tData.initialDegree;
        if (tData.higherDegree !== undefined) updates.higherDegree = tData.higherDegree;
        if (tData.major) updates.major = tData.major;
        if (resolvedDeptId) updates.departmentId = resolvedDeptId;
        if (resolvedWpId) updates.workplaceId = resolvedWpId;
        if (resolvedWpName) updates.workplace = resolvedWpName;
        if (cleanPositions && cleanPositions.length > 0) {
          const combined = Array.from(new Set([...(existing.positions || []), ...cleanPositions]));
          updates.positions = combined;
        }
        if (cleanSubjects && cleanSubjects.length > 0) {
          const combined = Array.from(new Set([...(existing.subjectsCanTeach || []), ...cleanSubjects]));
          updates.subjectsCanTeach = combined;
        }
        if (tData.standardQuota !== undefined) updates.standardQuota = tData.standardQuota;
        if (tData.status) updates.status = tData.status;
        if (tData.statusLabel) updates.statusLabel = tData.statusLabel;
        if (tData.phone) updates.phone = tData.phone;
        if (tData.email) updates.email = tData.email;
        if (tData.offDay) updates.offDay = tData.offDay;
        if (tData.bdHsgInfo) updates.bdHsgInfo = tData.bdHsgInfo;
        if (tData.notes) {
          updates.notes = existing.notes ? `${existing.notes} • ${tData.notes}` : tData.notes;
        }

        this.updateTeacher(existing.id, updates, 'Đồng bộ hồ sơ từ file Excel');
        updatedCount++;
      } else if (existingIndex === -1) {
        let assignedCode = tData.code?.trim();
        if (!assignedCode || assignedCode.startsWith('STT')) {
          assignedCode = `GV${String(this.teachers.length + 1).padStart(2, '0')}`;
        }

        const safeId = tData.id || `tc_${this.currentSchoolId}_${assignedCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const newTeacher: Teacher = {
          id: safeId,
          code: assignedCode,
          fullName: tData.fullName.trim(),
          gender: tData.gender || 'Nữ',
          birthDate: tData.birthDate || '',
          isDeleted: false,
          startYear: tData.startYear,
          initialDegree: tData.initialDegree || 'Đại học Sư phạm',
          higherDegree: tData.higherDegree || '',
          major: tData.major || 'Sư phạm',
          departmentId: resolvedDeptId,
          workplaceId: resolvedWpId || defaultWp?.id,
          workplace: resolvedWpName || defaultWp?.name || 'Điểm chính',
          positions: cleanPositions || [],
          subjectsCanTeach: cleanSubjects || [],
          standardQuota: tData.standardQuota !== undefined ? tData.standardQuota : 19,
          status: tData.status || 'ACTIVE',
          statusLabel: tData.statusLabel,
          phone: tData.phone || '',
          email: tData.email || '',
          offDay: tData.offDay || '',
          bdHsgInfo: tData.bdHsgInfo || '',
          notes: tData.notes || '',
        };

        this.teachers.push(newTeacher);
        newlyAddedTeachers.push(newTeacher);

        const dept = this.departments.find((d) => d.id === newTeacher.departmentId);
        if (dept) {
          if (!Array.isArray(dept.teacherIds)) dept.teacherIds = [];
          if (!dept.teacherIds.includes(newTeacher.id)) {
            dept.teacherIds.push(newTeacher.id);
          }
        }

        addedCount++;
      }
    });

    // Đồng bộ chức vụ kiêm nhiệm, danh mục duties và bảng phân công cho các giáo viên mới thêm
    newlyAddedTeachers.forEach((t) => {
      if (t.positions && t.positions.length > 0) {
        this.syncTeacherPositions(t.id, t.positions, t.departmentId);
      }
    });

    this.logAction({
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: 'all',
      entityDescription: `Đồng bộ hồ sơ giáo viên gốc: thêm mới ${addedCount}, cập nhật ${updatedCount}`,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    this.notify();
    return {
      addedCount,
      updatedCount,
      totalProcessed: addedCount + updatedCount,
      teachers: [...this.teachers],
    };
  }

  public updateTeacher(id: string, updates: Partial<Teacher>, reason?: string): boolean {
    const index = this.teachers.findIndex((t) => t.id === id);
    if (index === -1) return false;

    const beforeData = { ...this.teachers[index] };
    const resolvedUpdates: Partial<Teacher> = { ...updates };

    if (updates.workplaceId && !updates.workplace) {
      const match = this.workplaces.find((w) => w.id === updates.workplaceId);
      if (match) resolvedUpdates.workplace = match.name;
    } else if (!updates.workplaceId && updates.workplace) {
      const match = this.workplaces.find((w) => (w.name || '').trim().toLowerCase() === (updates.workplace || '').trim().toLowerCase());
      if (match) resolvedUpdates.workplaceId = match.id;
    }

    if (resolvedUpdates.positions) {
      resolvedUpdates.positions = Array.from(
        new Set(
          resolvedUpdates.positions
            .map((p) => normalizePositionName(p))
            .filter((p): p is string => Boolean(p))
        )
      );
    }
    if (resolvedUpdates.subjectsCanTeach) {
      resolvedUpdates.subjectsCanTeach = Array.from(
        new Set(
          resolvedUpdates.subjectsCanTeach
            .map((s) => s.trim())
            .filter((s): s is string => Boolean(s))
        )
      );
    }

    const oldDeptId = this.teachers[index].departmentId;
    const newDeptId = resolvedUpdates.departmentId !== undefined ? resolvedUpdates.departmentId : oldDeptId;

    this.teachers[index] = { ...this.teachers[index], ...resolvedUpdates };

    // Synchronize department teacherIds and prevent duplicates
    if (oldDeptId && oldDeptId !== newDeptId) {
      const oldDept = this.departments.find((d) => d.id === oldDeptId);
      if (oldDept && Array.isArray(oldDept.teacherIds)) {
        oldDept.teacherIds = oldDept.teacherIds.filter((tid) => tid !== id);
      }
    }
    if (newDeptId) {
      const newDept = this.departments.find((d) => d.id === newDeptId);
      if (newDept) {
        if (!Array.isArray(newDept.teacherIds)) newDept.teacherIds = [];
        if (!newDept.teacherIds.includes(id)) {
          newDept.teacherIds.push(id);
        }
        newDept.teacherIds = Array.from(new Set(newDept.teacherIds.filter(Boolean)));
      }
    }

    this.logAction({
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: id,
      entityDescription: `Cập nhật hồ sơ giáo viên: ${this.teachers[index].fullName}`,
      beforeData,
      afterData: this.teachers[index],
      reason,
    });

    if (resolvedUpdates.positions) {
      this.syncTeacherPositions(id, resolvedUpdates.positions, newDeptId);
    } else if (resolvedUpdates.departmentId && oldDeptId !== newDeptId) {
      this.syncTeacherPositions(id, this.teachers[index].positions || [], newDeptId);
    } else {
      this.syncAllDepartmentDutiesAndAssignments();
    }

    try {
      const targetSId = this.teachers[index].schoolId || this.currentSchoolId || 'school_quyhop';
      firestoreRepository.setDocData(targetSId, 'teachers', id, this.teachers[index]).catch(() => {});
    } catch {}

    this.saveToStorage();
    this.notify();
    return true;
  }

  public syncTeacherPositions(
    teacherId: string,
    positions: string[],
    departmentId?: string
  ): boolean {
    const teacher = this.teachers.find((t) => t.id === teacherId);
    if (!teacher) return false;

    // Chuẩn hóa và loại bỏ trùng lặp chức vụ
    const normalizedPositions: string[] = Array.from(
      new Set((positions || []).map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p)))
    );
    const deptId = departmentId || teacher.departmentId;

    // 1. Đồng bộ trạng thái BGH (Hiệu trưởng / Phó hiệu trưởng)
    const isPrincipal = normalizedPositions.some(
      (p) => p.toLowerCase() === 'hiệu trưởng' || (p.toLowerCase().includes('hiệu trưởng') && !p.toLowerCase().includes('phó'))
    );
    const isVicePrincipal = normalizedPositions.some((p) => p.toLowerCase().includes('phó hiệu trưởng'));

    if (isPrincipal) {
      teacher.status = 'PRINCIPAL';
      teacher.statusLabel = 'Hiệu trưởng';
      if (!teacher.standardQuota || teacher.standardQuota === 19) teacher.standardQuota = 2;
    } else if (isVicePrincipal) {
      teacher.status = 'VICE_PRINCIPAL';
      teacher.statusLabel = 'Phó hiệu trưởng';
      if (!teacher.standardQuota || teacher.standardQuota === 19) teacher.standardQuota = 4;
    } else if (teacher.status === 'PRINCIPAL' || teacher.status === 'VICE_PRINCIPAL') {
      teacher.status = 'ACTIVE';
      teacher.statusLabel = 'Đang giảng dạy';
      if (teacher.standardQuota === 2 || teacher.standardQuota === 4) teacher.standardQuota = 19;
    }

    // 2. Đồng bộ vai trò Tổ trưởng / Tổ phó trong Department
    const isHead = normalizedPositions.some((p) => p.toLowerCase().includes('tổ trưởng') || p.toLowerCase().includes('to truong'));
    const isDeputy = normalizedPositions.some((p) => p.toLowerCase().includes('tổ phó') || p.toLowerCase().includes('to pho'));

    this.departments.forEach((dept) => {
      // 2.1 Xử lý Tổ trưởng
      if (!isHead && dept.headTeacherId === teacherId) {
        dept.headTeacherId = undefined;
      } else if (isHead && dept.id === deptId) {
        dept.headTeacherId = teacherId;
      } else if (isHead && dept.id !== deptId && dept.headTeacherId === teacherId) {
        dept.headTeacherId = undefined;
      }

      // 2.2 Xử lý Tổ phó
      if (!Array.isArray(dept.deputyTeacherIds)) {
        dept.deputyTeacherIds = dept.deputyTeacherId ? [dept.deputyTeacherId] : [];
      }
      if (!isDeputy) {
        dept.deputyTeacherIds = dept.deputyTeacherIds.filter((id) => id !== teacherId);
        dept.deputyTeacherId = dept.deputyTeacherIds[0] || undefined;
      } else if (isDeputy && dept.id === deptId) {
        if (!dept.deputyTeacherIds.includes(teacherId)) {
          dept.deputyTeacherIds.push(teacherId);
        }
        dept.deputyTeacherId = dept.deputyTeacherIds[0];
      } else if (isDeputy && dept.id !== deptId) {
        dept.deputyTeacherIds = dept.deputyTeacherIds.filter((id) => id !== teacherId);
        dept.deputyTeacherId = dept.deputyTeacherIds[0] || undefined;
      }
    });

    // 3. Phân tích các nhiệm vụ kiêm nhiệm / miễn giảm đang được gán
    const activeVersionId = this.currentVersionId || this.versions[0]?.id || 'ver_hk1_official';
    const activeSchoolYearId = this.currentSchoolYearId || 'sy_2026_2027';
    const activeSemesterId = this.currentSemesterId || 'HK1';
    const weeks = activeSemesterId === 'HK1' ? 18 : 17;

    const normalizedPosLowerSet = new Set(normalizedPositions.map((p) => p.toLowerCase()));

    // 3.1 Dọn dẹp phân công kiêm nhiệm cũ nếu không còn trong danh sách vị trí đã chọn
    // - Tổ trưởng:
    if (!isHead) {
      const removedHead = this.assignments.filter(
        (a) => a.teacherId === teacherId && a.type === 'CONCURRENT' && this.isHeadDepartmentDuty(a.dutyId, a.dutyName)
      );
      removedHead.forEach((a) => {
        const safeDocId = a.id.replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
        firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
      });
      this.assignments = this.assignments.filter(
        (a) => !(a.teacherId === teacherId && a.type === 'CONCURRENT' && this.isHeadDepartmentDuty(a.dutyId, a.dutyName))
      );
    }
    // - Tổ phó:
    if (!isDeputy) {
      const removedDep = this.assignments.filter(
        (a) => a.teacherId === teacherId && a.type === 'CONCURRENT' && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)
      );
      removedDep.forEach((a) => {
        const safeDocId = a.id.replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
        firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
      });
      this.assignments = this.assignments.filter(
        (a) => !(a.teacherId === teacherId && a.type === 'CONCURRENT' && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName))
      );
    }
    // - Chủ nhiệm lớp:
    const activeHomeroomPositions = normalizedPositions.filter(
      (p) => p.startsWith('Chủ nhiệm lớp ') || p.toLowerCase().startsWith('chủ nhiệm')
    );
    const activeHomeroomLowerSet = new Set(activeHomeroomPositions.map((p) => p.toLowerCase()));
    this.classes.forEach((cls) => {
      if (cls.homeroomTeacherId === teacherId) {
        const clsNorm = `chủ nhiệm lớp ${cls.name.toLowerCase()}`;
        if (!activeHomeroomLowerSet.has(clsNorm) && !activeHomeroomPositions.some((p) => p.toLowerCase().includes(cls.name.toLowerCase()))) {
          cls.homeroomTeacherId = undefined;
          firestoreRepository.setDocData(this.currentSchoolId, 'classes', cls.id, cls).catch(() => {});
          // Xóa phân công chủ nhiệm của lớp này
          const removedHr = this.assignments.filter(
            (a) => a.teacherId === teacherId && (a.classId === cls.id || (a.dutyName && a.dutyName.toLowerCase().includes(cls.name.toLowerCase())))
          );
          removedHr.forEach((a) => {
            const safeDocId = a.id.replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
            firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
          });
          this.assignments = this.assignments.filter(
            (a) => !(a.teacherId === teacherId && (a.classId === cls.id || (a.dutyName && a.dutyName.toLowerCase().includes(cls.name.toLowerCase()))))
          );
        }
      }
    });

    // - Các nhiệm vụ kiêm nhiệm / miễn giảm khác:
    this.assignments = this.assignments.filter((a) => {
      if (a.teacherId !== teacherId || a.isDeleted) return true;
      if (a.type !== 'CONCURRENT' && a.type !== 'EXEMPTION' && a.type !== 'CONCURRENT_DUTY' && !a.dutyId) {
        return true;
      }
      if (this.isHeadDepartmentDuty(a.dutyId, a.dutyName) || this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)) {
        return true; // Đã xử lý ở trên
      }
      if (a.classId || (a.dutyName && a.dutyName.toLowerCase().includes('chủ nhiệm'))) {
        return true; // Đã xử lý ở trên
      }
      const rawDutyName = (a.dutyName || this.duties.find((d) => d.id === a.dutyId)?.name || '').replace(/\s*\([^)]*\)/g, '').trim();
      const normDutyName = normalizePositionName(rawDutyName).toLowerCase();
      if (normDutyName && !normalizedPosLowerSet.has(normDutyName) && !normalizedPosLowerSet.has(rawDutyName.toLowerCase())) {
        const safeDocId = a.id.replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
        firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
        return false;
      }
      return true;
    });

    // 4. Đồng bộ vào duties và sinh/cập nhật assignments cho TẤT CẢ các vị trí kiêm nhiệm được chọn
    for (const pos of normalizedPositions) {
      if (pos === 'Hiệu trưởng' || pos === 'Phó hiệu trưởng') {
        continue;
      }

      // 4.1 Xử lý Tổ trưởng chuyên môn
      if (pos === 'Tổ trưởng chuyên môn' || pos.toLowerCase().includes('tổ trưởng')) {
        const headDuty = this.getHeadDepartmentDuty();
        const existingHead = this.assignments.find(
          (a) => !a.isDeleted && a.teacherId === teacherId && a.versionId === activeVersionId && this.isHeadDepartmentDuty(a.dutyId, a.dutyName)
        );
        const periods = headDuty.periodsPerWeekCalculated || 3;
        if (!existingHead) {
          const asg: TeachingAssignment = {
            id: `asg_duty_head_${teacherId}_${activeVersionId}`,
            schoolId: this.currentSchoolId,
            schoolYearId: activeSchoolYearId,
            semesterId: activeSemesterId,
            versionId: activeVersionId,
            teacherId,
            departmentId: deptId || '',
            type: 'CONCURRENT',
            dutyId: headDuty.id,
            dutyName: headDuty.name,
            session: 'ACTIVITY',
            periodsPerWeek: periods,
            weeks,
            totalPeriods: periods * weeks,
            status: 'approved',
            notes: `Đồng bộ kiêm nhiệm: ${headDuty.name}`,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.email || 'admin',
          };
          this.assignments.push(asg);
          firestoreRepository.setDocData(this.currentSchoolId, 'assignments', asg.id, asg).catch(() => {});
        } else {
          existingHead.periodsPerWeek = periods;
          existingHead.totalPeriods = periods * weeks;
          existingHead.dutyId = headDuty.id;
          existingHead.dutyName = headDuty.name;
          firestoreRepository.setDocData(this.currentSchoolId, 'assignments', existingHead.id, existingHead).catch(() => {});
        }
        continue;
      }

      // 4.2 Xử lý Tổ phó chuyên môn
      if (pos === 'Tổ phó chuyên môn' || pos.toLowerCase().includes('tổ phó')) {
        const depDuty = this.getDeputyDepartmentDuty();
        const existingDep = this.assignments.find(
          (a) => !a.isDeleted && a.teacherId === teacherId && a.versionId === activeVersionId && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)
        );
        const periods = depDuty.periodsPerWeekCalculated || 1;
        if (!existingDep) {
          const asg: TeachingAssignment = {
            id: `asg_duty_dep_${teacherId}_${activeVersionId}`,
            schoolId: this.currentSchoolId,
            schoolYearId: activeSchoolYearId,
            semesterId: activeSemesterId,
            versionId: activeVersionId,
            teacherId,
            departmentId: deptId || '',
            type: 'CONCURRENT',
            dutyId: depDuty.id,
            dutyName: depDuty.name,
            session: 'ACTIVITY',
            periodsPerWeek: periods,
            weeks,
            totalPeriods: periods * weeks,
            status: 'approved',
            notes: `Đồng bộ kiêm nhiệm: ${depDuty.name}`,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.email || 'admin',
          };
          this.assignments.push(asg);
          firestoreRepository.setDocData(this.currentSchoolId, 'assignments', asg.id, asg).catch(() => {});
        } else {
          existingDep.periodsPerWeek = periods;
          existingDep.totalPeriods = periods * weeks;
          existingDep.dutyId = depDuty.id;
          existingDep.dutyName = depDuty.name;
          firestoreRepository.setDocData(this.currentSchoolId, 'assignments', existingDep.id, existingDep).catch(() => {});
        }
        continue;
      }

      // 4.3 Xử lý Chủ nhiệm lớp
      if (pos.startsWith('Chủ nhiệm lớp ') || pos.toLowerCase().startsWith('chủ nhiệm')) {
        const classNamePart = pos.replace(/^(Chủ nhiệm lớp|Chủ nhiệm|GVCN)\s*/i, '').trim();
        const matchedClass = this.classes.find(
          (c) => !c.isDeleted && (c.name.toLowerCase() === classNamePart.toLowerCase() || c.code?.toLowerCase() === classNamePart.toLowerCase())
        );
        const homeroomDuty = this.duties.find((d) => d.code === 'CHU_NHIEM' || d.id === 'duty_chu_nhiem') || {
          id: 'duty_chu_nhiem',
          code: 'CHU_NHIEM',
          name: 'Chủ nhiệm lớp',
          type: 'CONCURRENT' as const,
          periodsPerWeekCalculated: 4,
          periodsPerWeekExempted: 0,
          applicationMode: 'BY_CLASS' as const,
        };
        if (!this.duties.some((d) => d.code === 'CHU_NHIEM' || d.id === homeroomDuty.id)) {
          this.duties.push(homeroomDuty);
        }
        if (matchedClass) {
          matchedClass.homeroomTeacherId = teacherId;
          firestoreRepository.setDocData(this.currentSchoolId, 'classes', matchedClass.id, matchedClass).catch(() => {});
        }
        const existingHr = this.assignments.find(
          (a) => !a.isDeleted && a.teacherId === teacherId && a.versionId === activeVersionId &&
            (a.classId === matchedClass?.id || (a.dutyName && a.dutyName.toLowerCase().includes(classNamePart.toLowerCase())))
        );
        if (!existingHr) {
          const asg: TeachingAssignment = {
            id: `asg_duty_cn_${teacherId}_${matchedClass?.id || 'class'}_${activeVersionId}`,
            schoolId: this.currentSchoolId,
            schoolYearId: activeSchoolYearId,
            semesterId: activeSemesterId,
            versionId: activeVersionId,
            teacherId,
            departmentId: deptId || '',
            classId: matchedClass?.id,
            type: 'CONCURRENT',
            dutyId: homeroomDuty.id,
            dutyName: matchedClass ? `Chủ nhiệm lớp ${matchedClass.name}` : pos,
            session: 'ACTIVITY',
            periodsPerWeek: 4,
            weeks,
            totalPeriods: 4 * weeks,
            status: 'approved',
            notes: `Đồng bộ kiêm nhiệm: Chủ nhiệm lớp ${matchedClass?.name || classNamePart}`,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.email || 'admin',
          };
          this.assignments.push(asg);
          firestoreRepository.setDocData(this.currentSchoolId, 'assignments', asg.id, asg).catch(() => {});
        }
        continue;
      }

      // 4.4 Xử lý các nhiệm vụ kiêm nhiệm / miễn giảm khác
      const cleanPos = pos.replace(/\s*\([^)]*\)/g, '').trim();
      const normPos = normalizePositionName(cleanPos).toLowerCase();
      const defaultStatutory = getDefaultDutyPeriodsAndType(cleanPos);

      // Trích xuất số tiết từ ngoặc nếu có: ví dụ "Bí thư Chi đoàn (2 tiết/tuần)"
      const pMatch =
        pos.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) ||
        pos.match(/\((\d+)[^)]*\)/i) ||
        pos.match(/(\d+)\s*(?:tiết|t)\b/i);
      const pFromPos = pMatch ? parseInt(pMatch[1], 10) : 0;

      let matchingDuty = this.duties.find((d) => {
        const normD = normalizePositionName(d.name.replace(/\s*\([^)]*\)/g, '').trim()).toLowerCase();
        return (
          normD === normPos ||
          d.name.toLowerCase() === cleanPos.toLowerCase() ||
          normPos.includes(normD) ||
          normD.includes(normPos)
        );
      });

      const isExempt = matchingDuty?.type === 'EXEMPTION' || defaultStatutory?.type === 'EXEMPTION' || cleanPos.toLowerCase().includes('miễn') || cleanPos.toLowerCase().includes('con nhỏ');
      let periods = matchingDuty
        ? (matchingDuty.periodsPerWeekCalculated || matchingDuty.periodsPerWeekExempted || pFromPos || defaultStatutory?.periods || 2)
        : (pFromPos || defaultStatutory?.periods || 2);

      // NẾU CHƯA CÓ TRONG DUTIES -> TỰ ĐỘNG THÊM VÀO DUTIES ĐỂ ĐỒNG BỘ
      if (!matchingDuty) {
        const codeBase = cleanPos
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 15) || `DUTY_${Date.now().toString(36).toUpperCase()}`;
        const newDuty: SpecialDuty = {
          id: `duty_${codeBase.toLowerCase()}`,
          code: codeBase,
          name: normalizePositionName(cleanPos) || cleanPos,
          type: isExempt ? 'EXEMPTION' : 'CONCURRENT',
          periodsPerWeekCalculated: isExempt ? 0 : periods,
          periodsPerWeekExempted: isExempt ? periods : 0,
          applicationMode: 'FIXED',
          notes: 'Tự động thêm vào danh mục khi gán chức vụ cho giáo viên',
        };
        this.duties.push(newDuty);
        matchingDuty = newDuty;
        firestoreRepository.setDocData(this.currentSchoolId, 'duties', newDuty.id, newDuty).catch(() => {});
      }

      // Kiểm tra và sinh/cập nhật phân công trong assignments
      const existingAsg = this.assignments.find((a) => {
        if (a.teacherId !== teacherId || a.isDeleted || a.versionId !== activeVersionId) return false;
        if (a.dutyId && (a.dutyId === matchingDuty?.id || a.dutyId === matchingDuty?.code)) return true;
        const aNorm = normalizePositionName((a.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim()).toLowerCase();
        return aNorm === normPos || (a.dutyName || '').toLowerCase().includes(cleanPos.toLowerCase());
      });

      if (!existingAsg) {
        const asgId = `asg_duty_${teacherId}_${matchingDuty.id.replace(/[^a-z0-9_-]/gi, '_')}_${activeVersionId}`;
        const newAsg: TeachingAssignment = {
          id: asgId,
          schoolId: this.currentSchoolId,
          schoolYearId: activeSchoolYearId,
          semesterId: activeSemesterId,
          versionId: activeVersionId,
          teacherId,
          departmentId: deptId || '',
          type: isExempt ? 'EXEMPTION' : 'CONCURRENT',
          dutyId: matchingDuty.id,
          dutyName: matchingDuty.name || cleanPos,
          session: 'ACTIVITY',
          periodsPerWeek: periods,
          weeks,
          totalPeriods: periods * weeks,
          status: 'approved',
          notes: `Đồng bộ kiêm nhiệm: ${matchingDuty.name || cleanPos}`,
          createdAt: new Date().toISOString(),
          createdBy: this.currentUser?.email || 'admin',
        };
        this.assignments.push(newAsg);
        firestoreRepository.setDocData(this.currentSchoolId, 'assignments', newAsg.id, newAsg).catch(() => {});
      } else {
        existingAsg.periodsPerWeek = periods;
        existingAsg.weeks = weeks;
        existingAsg.totalPeriods = periods * weeks;
        existingAsg.dutyId = matchingDuty.id;
        existingAsg.dutyName = matchingDuty.name || cleanPos;
        existingAsg.type = isExempt ? 'EXEMPTION' : 'CONCURRENT';
        existingAsg.isDeleted = false;
        existingAsg.status = 'approved';
        firestoreRepository.setDocData(this.currentSchoolId, 'assignments', existingAsg.id, existingAsg).catch(() => {});
      }
    }

    // 5. Cập nhật teacher.positions với định dạng hiển thị đẹp (có số tiết)
    const formattedPositions: string[] = [];
    for (const p of normalizedPositions) {
      if (p === 'Hiệu trưởng' || p === 'Phó hiệu trưởng') {
        formattedPositions.push(p);
      } else {
        const defaultStat = getDefaultDutyPeriodsAndType(p);
        const matched = this.duties.find(
          (d) => normalizePositionName(d.name).toLowerCase() === p.toLowerCase() || d.name.toLowerCase() === p.toLowerCase()
        );
        const periods = matched
          ? (matched.periodsPerWeekCalculated || matched.periodsPerWeekExempted || defaultStat?.periods || 0)
          : (defaultStat?.periods || 0);
        if (periods > 0 && !p.includes('(')) {
          formattedPositions.push(`${p} (${periods} tiết/tuần)`);
        } else {
          formattedPositions.push(p);
        }
      }
    }
    teacher.positions = formattedPositions;

    // 6. Lưu giáo viên lên Firestore
    firestoreRepository.setDocData(this.currentSchoolId, 'teachers', teacher.id, teacher).catch(() => {});

    this.deduplicateDutyAssignments();
    this.saveToStorage();
    this.notify();
    return true;
  }

  public deleteTeacher(id: string, permanent = false): boolean {
    const index = this.teachers.findIndex((t) => t.id === id);
    if (index === -1) return false;

    const beforeData = { ...this.teachers[index] };
    if (permanent) {
      this.teachers.splice(index, 1);
      // Clean up assignments if permanently deleted
      this.assignments = this.assignments.filter((a) => a.teacherId !== id);
    } else {
      this.teachers[index] = { ...this.teachers[index], isDeleted: true };
      this.assignments = this.assignments.map((a) => (a.teacherId === id ? { ...a, isDeleted: true } : a));
    }

    // Clean up departments
    this.departments.forEach((d) => {
      if (d.teacherIds) {
        d.teacherIds = d.teacherIds.filter((tid) => tid !== id);
      }
      if (d.headTeacherId === id) d.headTeacherId = undefined;
      if (d.deputyTeacherId === id) d.deputyTeacherId = undefined;
      if (d.deputyTeacherIds) {
        d.deputyTeacherIds = d.deputyTeacherIds.filter((tid) => tid !== id);
        d.deputyTeacherId = d.deputyTeacherIds[0] || undefined;
      }
    });

    // Clean up homeroom in classes
    this.classes.forEach((c) => {
      if (c.homeroomTeacherId === id) c.homeroomTeacherId = undefined;
    });

    const targetSId = this.currentSchoolId || 'school_quyhop';
    if (permanent) {
      firestoreRepository.deleteDocData(targetSId, 'teachers', id).catch(() => {});
    } else {
      firestoreRepository.setDocData(targetSId, 'teachers', id, { isDeleted: true }, true).catch(() => {});
    }

    this.logAction({
      action: 'DELETE',
      entityType: 'TEACHER',
      entityId: id,
      entityDescription: `Xóa giáo viên ${beforeData.fullName}${permanent ? ' (vĩnh viễn)' : ''}`,
      beforeData,
    });

    this.saveToStorage();
    return true;
  }

  public bulkDeleteTeachers(teacherIds: string[], permanent = false): number {
    const idSet = new Set(teacherIds);
    let count = 0;

    if (permanent) {
      const beforeLen = this.teachers.length;
      this.teachers = this.teachers.filter((t) => !idSet.has(t.id));
      count = beforeLen - this.teachers.length;
      // Clean up assignments
      this.assignments = this.assignments.filter((a) => !idSet.has(a.teacherId));
    } else {
      this.teachers = this.teachers.map((t) => {
        if (idSet.has(t.id) && !t.isDeleted) {
          count++;
          return { ...t, isDeleted: true };
        }
        return t;
      });
      this.assignments = this.assignments.map((a) => (idSet.has(a.teacherId) ? { ...a, isDeleted: true } : a));
    }

    if (count > 0) {
      const targetSId = this.currentSchoolId || 'school_quyhop';
      teacherIds.forEach((tid) => {
        if (permanent) {
          firestoreRepository.deleteDocData(targetSId, 'teachers', tid).catch(() => {});
        } else {
          firestoreRepository.setDocData(targetSId, 'teachers', tid, { isDeleted: true }, true).catch(() => {});
        }
      });

      // Clean up departments
      this.departments.forEach((d) => {
        if (d.teacherIds) {
          d.teacherIds = d.teacherIds.filter((tid) => !idSet.has(tid));
        }
        if (d.headTeacherId && idSet.has(d.headTeacherId)) d.headTeacherId = undefined;
        if (d.deputyTeacherId && idSet.has(d.deputyTeacherId)) d.deputyTeacherId = undefined;
        if (d.deputyTeacherIds) {
          d.deputyTeacherIds = d.deputyTeacherIds.filter((tid) => !idSet.has(tid));
          d.deputyTeacherId = d.deputyTeacherIds[0] || undefined;
        }
      });

      // Clean up homeroom in classes
      this.classes.forEach((c) => {
        if (c.homeroomTeacherId && idSet.has(c.homeroomTeacherId)) {
          c.homeroomTeacherId = undefined;
        }
      });

      this.logAction({
        action: 'DELETE',
        entityType: 'TEACHER',
        entityId: teacherIds.join(','),
        entityDescription: `Xóa hàng loạt ${count} giáo viên${permanent ? ' (vĩnh viễn)' : ''}`,
      });
      this.saveToStorage();
    }
    return count;
  }

  public restoreTeacher(id: string): boolean {
    const item = this.teachers.find((t) => t.id === id);
    if (!item) return false;

    item.isDeleted = false;
    const targetSId = this.currentSchoolId || 'school_quyhop';
    firestoreRepository.setDocData(targetSId, 'teachers', id, { isDeleted: false }, true).catch(() => {});

    this.logAction({
      action: 'RESTORE',
      entityType: 'TEACHER',
      entityId: id,
      entityDescription: `Khôi phục giáo viên: ${item.fullName} (${item.code})`,
      afterData: item,
    });

    this.saveToStorage();
    return true;
  }

  public bulkRestoreTeachers(teacherIds: string[]): number {
    const idSet = new Set(teacherIds);
    let count = 0;

    for (const t of this.teachers) {
      if (idSet.has(t.id) && t.isDeleted) {
        t.isDeleted = false;
        count++;
      }
    }

    if (count > 0) {
      const targetSId = this.currentSchoolId || 'school_quyhop';
      teacherIds.forEach((tid) => {
        firestoreRepository.setDocData(targetSId, 'teachers', tid, { isDeleted: false }, true).catch(() => {});
      });

      this.logAction({
        action: 'RESTORE',
        entityType: 'TEACHER',
        entityId: teacherIds.join(','),
        entityDescription: `Khôi phục hàng loạt ${count} giáo viên từ thùng rác`,
      });
      this.saveToStorage();
    }
    return count;
  }

  // CLASS MUTATIONS
  public addClass(item: Omit<SchoolClass, 'id'>): SchoolClass {
    // MỤC 2: Kiểm tra hạn mức lớp học bản quyền
    const quota = this.canAddClass(1);
    if (!quota.allowed) {
      console.warn('Vượt quá hạn mức lớp học:', quota.message);
      throw new Error(quota.message || 'Đã đạt giới hạn số lớp tối đa theo bản quyền!');
    }

    if (!this.branches || this.branches.length === 0) {
      this.branches = [...INITIAL_BRANCHES];
    }
    const defaultBranchId = this.branches.find((b) => b.isMain)?.id || this.branches[0]?.id || 'branch_main';
    const newClass: SchoolClass = {
      id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
      schoolId: item.schoolId || this.currentSchoolId,
      branchId: item.branchId || defaultBranchId,
      studentCount: item.studentCount && item.studentCount > 0 ? item.studentCount : 35,
      active: item.active !== false,
      isDeleted: false,
    };
    this.classes.push(newClass);

    // Tự động đồng bộ phân công GVCN và vị trí công tác nếu lớp mới có gán GVCN
    if (newClass.homeroomTeacherId) {
      this.syncHomeroomTeacherAssignment(newClass.id, undefined, newClass.homeroomTeacherId, newClass.name);
    }

    this.logAction({
      action: 'CREATE',
      entityType: 'CLASS',
      entityId: newClass.id,
      entityDescription: `Thêm lớp học: ${newClass.name}${newClass.homeroomTeacherId ? ` (GVCN: ${newClass.homeroomTeacherId})` : ''}`,
      afterData: newClass,
    });
    this.saveToStorage();
    try {
      const targetSId = newClass.schoolId || this.currentSchoolId || 'school_quyhop';
      firestoreRepository.setDocData(targetSId, 'classes', newClass.id, newClass).catch(() => {});
    } catch {}
    this.notify();
    return newClass;
  }

  public bulkAddClasses(items: Omit<SchoolClass, 'id'>[]): SchoolClass[] {
    // MỤC 2: Kiểm tra hạn mức lớp học bản quyền khi thêm hàng loạt
    if (items.length > 0) {
      const quota = this.canAddClass(items.length);
      if (!quota.allowed) {
        console.warn('Vượt quá hạn mức lớp học hàng loạt:', quota.message);
        throw new Error(quota.message || 'Đã đạt giới hạn số lớp tối đa theo bản quyền!');
      }
    }

    const defaultBranchId = this.branches.find((b) => b.isMain)?.id || this.branches[0]?.id || 'branch_main';
    const created: SchoolClass[] = [];
    const timestamp = Date.now();

    items.forEach((item, i) => {
      const newClass: SchoolClass = {
        id: `cls_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        ...item,
        schoolId: item.schoolId || this.currentSchoolId,
        branchId: item.branchId || defaultBranchId,
        studentCount: item.studentCount && item.studentCount > 0 ? item.studentCount : 35,
        active: item.active !== false,
        isDeleted: false,
      };
      this.classes.push(newClass);
      created.push(newClass);
    });

    this.logAction({
      action: 'CREATE',
      entityType: 'CLASS',
      entityId: created.map((c) => c.id).join(','),
      entityDescription: `Thêm hàng loạt ${created.length} lớp học`,
      afterData: created,
    });

    this.saveToStorage();
    try {
      const targetSId = this.currentSchoolId || 'school_quyhop';
      firestoreRepository.batchSetDocuments(targetSId, 'classes', created).catch(() => {});
    } catch {}
    return created;
  }

  public bulkImportData(payload: {
    teachersToImport: Partial<Teacher>[];
    classesToImport: Partial<SchoolClass>[];
    assignmentsToImport: Partial<TeachingAssignment>[];
    schoolInfoDetected?: Partial<SchoolInfo>;
    mode: 'MERGE' | 'REPLACE';
  }) {
    const { teachersToImport, classesToImport, assignmentsToImport, schoolInfoDetected, mode } = payload;

    // MỤC 2: Kiểm tra hạn mức đơn vị khi nạp dữ liệu (chống gom nhiều trường vào 1)
    const newTeachersCount = mode === 'REPLACE'
      ? teachersToImport.length
      : teachersToImport.filter(t => !this.teachers.some(curr => (t.code && curr.code?.toLowerCase() === t.code?.toLowerCase()) || (t.fullName && curr.fullName?.toLowerCase() === t.fullName?.toLowerCase()))).length;

    const newClassesCount = mode === 'REPLACE'
      ? classesToImport.length
      : classesToImport.filter(c => !this.classes.some(curr => curr.name?.toLowerCase() === c.name?.toLowerCase())).length;

    const quota = this.checkCurrentSchoolQuota(newTeachersCount, newClassesCount);
    if (!quota.allowed) {
      throw new Error(quota.message || 'Dữ liệu nạp vào vượt quá hạn mức bản quyền của đơn vị!');
    }

    if (schoolInfoDetected && (schoolInfoDetected.schoolName || schoolInfoDetected.branchName || schoolInfoDetected.schoolYear)) {
      // Chỉ cho phép cập nhật thông tin phụ (năm học, điểm trường) - KHÔNG cho phép đổi tên trường
      const activeLic = this.getCurrentSchoolLicense();
      const safeSchoolName = activeLic?.schoolName || this.schoolInfo.schoolName;
      this.schoolInfo = {
        ...this.schoolInfo,
        ...schoolInfoDetected,
        schoolName: safeSchoolName, // Khóa cứng tên trường đã cấp phép, tuyệt đối không cho phép đổi tên trường làm hộ đơn vị khác
      };
    }

    if (mode === 'REPLACE') {
      const targetSId = this.currentSchoolId || 'school_quyhop';
      if (teachersToImport.length > 0) {
        this.teachers.forEach((t) => {
          firestoreRepository.deleteDocData(targetSId, 'teachers', t.id).catch(() => {});
        });
        this.teachers = [];
      }
      if (classesToImport.length > 0) {
        this.classes.forEach((c) => {
          firestoreRepository.deleteDocData(targetSId, 'classes', c.id).catch(() => {});
        });
        this.classes = [];
      }
      if (assignmentsToImport.length > 0) this.assignments = [];
    }

    // 1. Process Teachers
    if (teachersToImport.length > 0) {
      teachersToImport.forEach((t, idx) => {
        const existingIdx = this.teachers.findIndex(
          (curr) =>
            (t.code && curr.code?.toLowerCase() === t.code?.toLowerCase()) ||
            (t.fullName && curr.fullName?.toLowerCase() === t.fullName?.toLowerCase())
        );
        if (existingIdx !== -1 && mode === 'MERGE') {
          this.teachers[existingIdx] = {
            ...this.teachers[existingIdx],
            isDeleted: false,
            fullName: t.fullName || this.teachers[existingIdx].fullName,
            birthDate: t.birthDate !== undefined ? t.birthDate : this.teachers[existingIdx].birthDate,
            departmentId: t.departmentId || this.teachers[existingIdx].departmentId,
            major: t.major || this.teachers[existingIdx].major,
            standardQuota: t.standardQuota || this.teachers[existingIdx].standardQuota,
            phone: t.phone || this.teachers[existingIdx].phone,
            email: t.email || this.teachers[existingIdx].email,
          };
        } else {
          const assignedCode = t.code || `GV${(this.teachers.length + 1).toString().padStart(2, '0')}`;
          const safeId = t.id || `tc_${this.currentSchoolId}_${assignedCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          this.teachers.push({
            id: safeId,
            code: assignedCode,
            fullName: t.fullName || 'Giáo viên',
            birthDate: t.birthDate || '',
            isDeleted: false,
            departmentId: t.departmentId || 'dept_toan_tin',
            status: t.status || 'ACTIVE',
            standardQuota: t.standardQuota || 19,
            major: t.major || 'Sư phạm',
            subjectsCanTeach: t.subjectsCanTeach || [],
            phone: t.phone || '',
            email: t.email || '',
          });
        }
      });
    }

    // 2. Process Classes
    if (classesToImport.length > 0) {
      classesToImport.forEach((c, idx) => {
        const rawCode = (c.code || c.name || '').replace(/^(Lớp|Lop|Khối|Khoi)\s*[-:]?\s*/i, '').trim().toUpperCase();
        const gradeMatch = rawCode.match(/^([6789])/);
        const grade = (c.grade && [6, 7, 8, 9].includes(c.grade) ? c.grade : (gradeMatch ? Number(gradeMatch[1]) : 6)) as 6 | 7 | 8 | 9;
        const code = rawCode || `6A${idx + 1}`;
        const name = c.name?.startsWith('Lớp') ? c.name : `Lớp ${code}`;
        const session = c.session || (grade >= 8 ? 'AFTERNOON' : 'MORNING');

        const existingIdx = this.classes.findIndex(
          (curr) => curr.code?.toLowerCase() === code.toLowerCase() || curr.name?.toLowerCase() === name.toLowerCase()
        );
        if (existingIdx !== -1 && mode === 'MERGE') {
          this.classes[existingIdx] = {
            ...this.classes[existingIdx],
            isDeleted: false,
            studentCount: c.studentCount || this.classes[existingIdx].studentCount,
            session: c.session || this.classes[existingIdx].session,
            grade: grade || this.classes[existingIdx].grade,
          };
        } else {
          const safeClassId = c.id || `cls_${this.currentSchoolId}_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          this.classes.push({
            id: safeClassId,
            code,
            name,
            grade,
            studentCount: c.studentCount || 35,
            session,
            active: true,
            isDeleted: false,
          });
        }
      });
    }

    // 3. Process Assignments
    if (assignmentsToImport.length > 0) {
      const currentVer = this.currentVersionId;
      const currentSem = this.currentSemesterId;
      const currentSy = this.currentSchoolYearId;

      if (mode === 'REPLACE') {
        // Clear previous assignments for this version
        this.assignments = this.assignments.filter(
          (a) => !(a.schoolYearId === currentSy && a.semesterId === currentSem && a.versionId === currentVer)
        );
      }

      const existingAsgKeys = new Set(
        this.assignments.map(
          (a) => `${a.schoolYearId}_${a.semesterId}_${a.versionId}_${a.teacherId}_${a.classId || 'noclass'}_${a.subjectId || 'nosub'}_${a.dutyName || 'noduty'}`
        )
      );

      assignmentsToImport.forEach((a, idx) => {
        // Intelligently find teacher
        let teacher = this.teachers.find((t) => t.id === a.teacherId);
        if (!teacher && a.notes) {
          teacher = this.teachers.find((t) => a.notes?.includes(t.fullName) || (t.code && a.notes?.includes(t.code)));
        }
        if (!teacher) {
          // Strictly avoid auto-inferring or randomly assigning to another teacher
          return;
        }

        const teacherId = teacher.id;
        const teacherDept = teacher.departmentId || 'dept_toan_tin';

        // Intelligently find class
        let classObj = this.classes.find((c) => c.id === a.classId || c.code === a.classId);
        if (!classObj && a.notes) {
          classObj = this.classes.find((c) => a.notes?.includes(c.code) || a.notes?.includes(c.name));
        }

        const classId = a.type === 'CONCURRENT' ? undefined : (classObj ? classObj.id : undefined);

        // Intelligently find subject
        let subject = this.subjects.find((s) => s.id === a.subjectId || s.code === a.subjectId);
        if (!subject && a.notes) {
          subject = this.subjects.find((s) => a.notes?.includes(s.name) || a.notes?.includes(s.code));
        }
        const subjectId = a.type === 'CONCURRENT' ? undefined : (subject ? subject.id : (teacher.subjectsCanTeach?.[0] || undefined));

        if (a.type !== 'CONCURRENT' && !classId && !subjectId) {
          return;
        }

        const periods = a.periodsPerWeek && a.periodsPerWeek > 0 ? a.periodsPerWeek : 1;
        const weeks = a.weeks && a.weeks > 0 ? a.weeks : 18;

        const dedupeKey = `${currentSy}_${currentSem}_${currentVer}_${teacherId}_${classId || 'noclass'}_${subjectId || 'nosub'}_${a.dutyName || 'noduty'}`;

        if (!existingAsgKeys.has(dedupeKey)) {
          existingAsgKeys.add(dedupeKey);
          this.assignments.push({
            id: a.id || `asg_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
            schoolYearId: currentSy,
            semesterId: currentSem,
            versionId: currentVer,
            teacherId,
            departmentId: a.departmentId || teacherDept,
            subjectId,
            classId,
            type: a.type || 'TEACHING',
            periodsPerWeek: periods,
            weeks: weeks,
            totalPeriods: a.totalPeriods || periods * weeks,
            dutyName: a.dutyName,
            notes: a.notes,
            session: (a.session === 'MORNING' || a.session === 'AFTERNOON' || a.session === 'ACTIVITY' || a.session === 'OTHER') ? a.session : (classObj?.session === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING'),
            status: 'draft',
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser.name,
          });
        }
      });
    }

    this.logAction({
      action: 'CREATE',
      entityType: 'VERSION',
      entityId: 'import',
      entityDescription: `Nhập dữ liệu Excel: ${teachersToImport.length} GV, ${classesToImport.length} Lớp, ${assignmentsToImport.length} Phân công (${mode === 'REPLACE' ? 'Ghi đè' : 'Cập nhật'})`,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
  }

  /**
   * Đồng bộ hai chiều giữa Danh mục lớp học và Phân công chuyên môn (Nhiệm vụ GVCN).
   * Đảm bảo khi gán hoặc đổi GVCN ở danh sách lớp:
   * 1. Tự động cập nhật bảng phân công nhiệm vụ kiêm nhiệm (duty_chu_nhiem, 4 tiết/tuần)
   * 2. Tự động cập nhật vị trí công tác (teacher.positions) của giáo viên mới và thu hồi của giáo viên cũ
   * 3. Đồng bộ ngay lập tức lên Cloud Firestore và Local Storage
   */
  public syncHomeroomTeacherAssignment(
    classId: string,
    oldTeacherId: string | undefined,
    newTeacherId: string | undefined,
    className: string
  ): void {
    const activeVerId = this.currentVersionId || this.versions[0]?.id || 'ver_hk1_official';
    const activeSyId = this.currentSchoolYearId || this.schoolYears[0]?.id || 'sy_2024_2025';
    const activeSemId = this.currentSemesterId || 'HK1';
    const targetSId = this.currentSchoolId || 'school_quyhop';

    const hrDuty = this.duties.find((d) => d.code === 'CHU_NHIEM' || d.id === 'duty_chu_nhiem') || {
      id: 'duty_chu_nhiem',
      code: 'CHU_NHIEM',
      name: 'Chủ nhiệm lớp',
      type: 'CONCURRENT' as const,
      periodsPerWeekCalculated: 4,
      periodsPerWeekExempted: 0,
      applicationMode: 'BY_CLASS' as const,
    };
    if (!this.duties.some((d) => d.code === 'CHU_NHIEM' || d.id === hrDuty.id)) {
      this.duties.push(hrDuty);
      firestoreRepository.setDocData(targetSId, 'duties', hrDuty.id, hrDuty).catch(() => {});
    }

    const periods = hrDuty.periodsPerWeekCalculated || 4;
    const weeks = activeSemId === 'HK1' ? 18 : 17;
    const cleanClassName = className.trim();
    const dutyTitle = cleanClassName.toLowerCase().startsWith('lớp') ? `Chủ nhiệm ${cleanClassName}` : `Chủ nhiệm lớp ${cleanClassName}`;

    // 1. Nếu có giáo viên cũ và khác giáo viên mới: thu hồi phân công GVCN của lớp này
    if (oldTeacherId && oldTeacherId !== newTeacherId) {
      this.assignments = this.assignments.filter((a) => {
        const isHr = (a.dutyId === 'duty_chu_nhiem' || a.dutyId === hrDuty.id || (a.dutyName && a.dutyName.toLowerCase().includes('chủ nhiệm')));
        const matchesClass = a.classId === classId || (a.dutyName && a.dutyName.toLowerCase().includes(cleanClassName.toLowerCase()));
        if (a.teacherId === oldTeacherId && isHr && matchesClass) {
          const safeDocId = (a.id || '').replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
          firestoreRepository.deleteDocData(targetSId, 'assignments', safeDocId).catch(() => {});
          return false;
        }
        return true;
      });

      const oldTeacher = this.teachers.find((t) => t.id === oldTeacherId);
      if (oldTeacher && Array.isArray(oldTeacher.positions)) {
        oldTeacher.positions = oldTeacher.positions.filter((p) => {
          const pLower = p.toLowerCase();
          return !(pLower.includes('chủ nhiệm') && pLower.includes(cleanClassName.toLowerCase()));
        });
        firestoreRepository.setDocData(targetSId, 'teachers', oldTeacher.id, oldTeacher).catch(() => {});
      }
    }

    // 2. Nếu có giáo viên mới: tạo hoặc cập nhật phân công GVCN
    if (newTeacherId) {
      const newTeacher = this.teachers.find((t) => t.id === newTeacherId);
      if (newTeacher) {
        const existingHr = this.assignments.find(
          (a) =>
            !a.isDeleted &&
            a.teacherId === newTeacherId &&
            a.versionId === activeVerId &&
            (a.classId === classId || (a.dutyName && a.dutyName.toLowerCase().includes(cleanClassName.toLowerCase())))
        );

        if (existingHr) {
          existingHr.classId = classId;
          existingHr.dutyId = hrDuty.id;
          existingHr.dutyName = dutyTitle;
          existingHr.periodsPerWeek = periods;
          existingHr.weeks = weeks;
          existingHr.totalPeriods = periods * weeks;
          existingHr.status = 'approved';
          existingHr.isDeleted = false;
          firestoreRepository.setDocData(targetSId, 'assignments', existingHr.id, existingHr).catch(() => {});
        } else {
          const newAsg: TeachingAssignment = {
            id: `asg_cn_${newTeacherId}_${classId.replace(/[^a-z0-9_-]/gi, '_')}_${activeVerId}`,
            schoolId: targetSId,
            schoolYearId: activeSyId,
            semesterId: activeSemId,
            versionId: activeVerId,
            teacherId: newTeacherId,
            departmentId: newTeacher.departmentId || '',
            classId,
            type: 'CONCURRENT',
            dutyId: hrDuty.id,
            dutyName: dutyTitle,
            session: 'ACTIVITY',
            periodsPerWeek: periods,
            weeks,
            totalPeriods: periods * weeks,
            status: 'approved',
            notes: `Phân công GVCN ${cleanClassName}`,
            createdAt: new Date().toISOString(),
            createdBy: this.currentUser?.email || 'admin',
          };
          this.assignments.push(newAsg);
          firestoreRepository.setDocData(targetSId, 'assignments', newAsg.id, newAsg).catch(() => {});
        }

        // Cập nhật teacher.positions
        if (!Array.isArray(newTeacher.positions)) newTeacher.positions = [];
        newTeacher.positions = newTeacher.positions.filter((p) => {
          const pLower = p.toLowerCase();
          return !(pLower.includes('chủ nhiệm') && pLower.includes(cleanClassName.toLowerCase()));
        });
        newTeacher.positions.push(`${dutyTitle} (${periods} tiết/tuần)`);
        firestoreRepository.setDocData(targetSId, 'teachers', newTeacher.id, newTeacher).catch(() => {});
      }
    }
  }

  public updateClass(id: string, updates: Partial<SchoolClass>): boolean {
    const index = this.classes.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const oldClass = { ...this.classes[index] };
    const oldHr = oldClass.homeroomTeacherId;
    const newHr = updates.homeroomTeacherId;

    this.classes[index] = { ...this.classes[index], ...updates };
    const currentClass = this.classes[index];

    // Đồng bộ tức thời GVCN sang Phân công chuyên môn và Hồ sơ giáo viên
    if (updates.homeroomTeacherId !== undefined && newHr !== oldHr) {
      this.syncHomeroomTeacherAssignment(id, oldHr, newHr, currentClass.name);
    }

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    try {
      const targetSId = currentClass.schoolId || this.currentSchoolId || 'school_quyhop';
      firestoreRepository.setDocData(targetSId, 'classes', id, currentClass).catch(() => {});
    } catch {}
    this.notify();
    return true;
  }

  public deleteClass(id: string, permanent = false): boolean {
    const index = this.classes.findIndex((c) => c.id === id);
    if (index === -1) return false;

    const beforeData = { ...this.classes[index] };
    if (permanent) {
      this.classes.splice(index, 1);
      this.assignments = this.assignments.filter((a) => a.classId !== id);
    } else {
      this.classes[index] = { ...this.classes[index], isDeleted: true };
    }

    this.logAction({
      action: 'DELETE',
      entityType: 'CLASS',
      entityId: id,
      entityDescription: `Xóa lớp học ${beforeData.name}${permanent ? ' (vĩnh viễn)' : ''}`,
      beforeData,
    });

    this.saveToStorage();
    return true;
  }

  public bulkDeleteClasses(classIds: string[], permanent = false): number {
    const idSet = new Set(classIds);
    let count = 0;

    if (permanent) {
      const beforeLen = this.classes.length;
      this.classes = this.classes.filter((c) => !idSet.has(c.id));
      count = beforeLen - this.classes.length;
      this.assignments = this.assignments.filter((a) => !idSet.has(a.classId));
    } else {
      this.classes = this.classes.map((c) => {
        if (idSet.has(c.id) && !c.isDeleted) {
          count++;
          return { ...c, isDeleted: true };
        }
        return c;
      });
    }

    if (count > 0) {
      this.logAction({
        action: 'DELETE',
        entityType: 'CLASS',
        entityId: classIds.join(','),
        entityDescription: `Xóa hàng loạt ${count} lớp học${permanent ? ' (vĩnh viễn)' : ''}`,
      });
      this.saveToStorage();
    }
    return count;
  }

  // SUBJECT MUTATIONS
  public addSubject(item: Omit<Subject, 'id'>): Subject {
    const newSubject: Subject = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
    };
    this.subjects.push(newSubject);
    this.logAction({
      action: 'CREATE',
      entityType: 'SUBJECT',
      entityId: newSubject.id,
      entityDescription: `Thêm môn học: ${newSubject.name} (${newSubject.code})`,
      afterData: newSubject,
    });
    this.saveToStorage();
    return newSubject;
  }

  public bulkAddSubjects(items: Omit<Subject, 'id'>[]): Subject[] {
    const created: Subject[] = [];
    const timestamp = Date.now();

    items.forEach((item, i) => {
      const newSubject: Subject = {
        id: `sub_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        ...item,
      };
      this.subjects.push(newSubject);
      created.push(newSubject);
    });

    this.logAction({
      action: 'CREATE',
      entityType: 'SUBJECT',
      entityId: created.map((s) => s.id).join(','),
      entityDescription: `Thêm hàng loạt ${created.length} môn học`,
      afterData: created,
    });

    this.saveToStorage();
    return created;
  }

  public updateSubject(id: string, updates: Partial<Subject>): boolean {
    const index = this.subjects.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const beforeData = { ...this.subjects[index] };
    this.subjects[index] = { ...this.subjects[index], ...updates };
    this.logAction({
      action: 'UPDATE',
      entityType: 'SUBJECT',
      entityId: id,
      entityDescription: `Cập nhật môn học: ${this.subjects[index].name} (${this.subjects[index].code})`,
      beforeData,
      afterData: this.subjects[index],
    });
    this.saveToStorage();
    return true;
  }

  public toggleSubjectApplicableGrade(subjectId: string, grade: number): boolean {
    const index = this.subjects.findIndex((s) => s.id === subjectId);
    if (index === -1) return false;
    const current = this.subjects[index].applicableGrades && this.subjects[index].applicableGrades.length > 0
      ? [...this.subjects[index].applicableGrades]
      : [6, 7, 8, 9];

    let next: number[];
    if (current.includes(grade)) {
      if (current.length <= 1) {
        return false;
      }
      next = current.filter((g) => g !== grade).sort();
    } else {
      next = [...current, grade].sort();
    }

    const beforeData = { ...this.subjects[index] };
    this.subjects[index] = {
      ...this.subjects[index],
      applicableGrades: next,
    };

    if (!next.includes(grade)) {
      // Đặt số tiết của môn này ở khối vừa bỏ về 0
      this.curriculum.forEach((c) => {
        if (c.subjectId === subjectId && c.grade === grade) {
          c.periodsPerWeek = 0;
          c.totalPeriods = 0;
        }
      });
    }

    this.logAction({
      action: 'UPDATE',
      entityType: 'SUBJECT',
      entityId: subjectId,
      entityDescription: `Cập nhật khối áp dụng môn học: ${this.subjects[index].name} [${next.join(', ')}]`,
      beforeData,
      afterData: this.subjects[index],
    });

    this.saveToStorage();
    return true;
  }

  public updateSubjectSession2ForGrade(
    subjectId: string,
    grade: number,
    gradeConfig: Partial<import('../types').GradeSession2Config>
  ): boolean {
    const index = this.subjects.findIndex((s) => s.id === subjectId);
    if (index === -1) return false;

    const sub = this.subjects[index];
    const s2 = sub.session2Config || {};
    const existingGradeConfigs = { ...(s2.gradeConfigs || {}) };
    const prevGConfig = existingGradeConfigs[grade] || {};

    const mergedGConfig: import('../types').GradeSession2Config = {
      ...prevGConfig,
      ...gradeConfig,
    };

    const hasS2ForThisGrade =
      mergedGConfig.hasSession2 !== false &&
      ((mergedGConfig.bdClasses || 0) > 0 ||
        (mergedGConfig.pdClasses || 0) > 0 ||
        (mergedGConfig.examClasses || 0) > 0);

    mergedGConfig.hasSession2 = hasS2ForThisGrade;
    existingGradeConfigs[grade] = mergedGConfig;

    // Cập nhật danh sách các khối có Buổi 2
    const currentAppGrades = s2.applicableGrades && s2.applicableGrades.length > 0
      ? [...s2.applicableGrades]
      : (sub.applicableGrades || [6, 7, 8, 9]);

    const nextAppGrades = hasS2ForThisGrade
      ? Array.from(new Set([...currentAppGrades, grade])).sort()
      : currentAppGrades.filter((g) => g !== grade);

    const overallHasSession2 = Object.values(existingGradeConfigs).some(
      (cfg) => cfg && cfg.hasSession2 !== false && ((cfg.bdClasses || 0) > 0 || (cfg.pdClasses || 0) > 0 || (cfg.examClasses || 0) > 0)
    );

    const updatedS2Config: import('../types').SubjectSession2Config = {
      ...s2,
      hasSession2: overallHasSession2,
      applicableGrades: nextAppGrades,
      gradeConfigs: existingGradeConfigs,
      bdClasses: mergedGConfig.bdClasses,
      bdPeriods: mergedGConfig.bdPeriods,
      pdClasses: mergedGConfig.pdClasses,
      pdPeriods: mergedGConfig.pdPeriods,
      examClasses: mergedGConfig.examClasses,
      examPeriods: mergedGConfig.examPeriods,
    };

    return this.updateSubject(subjectId, {
      isSession2: overallHasSession2,
      session2Config: updatedS2Config,
    });
  }

  public applyStandardKhtnSplit(schoolYearId: string, semesterId: SemesterId): { success: boolean; message: string } {
    try {
      // 1. Cập nhật môn KHTN chung áp dụng khối 6, 7
      let khtnSub = this.subjects.find((s) => s.code === 'KHTN' || s.id === 'sub_khtn');
      if (khtnSub) {
        this.updateSubject(khtnSub.id, {
          applicableGrades: [6, 7],
          periodsPerWeek: 4,
          name: 'Khoa học tự nhiên (K6,7)',
        });
      }

      const deptId = khtnSub?.departmentId || 'dept_khtn';

      // 2. Tạo hoặc cập nhật phân môn Vật lí (K8, 9)
      let lySub = this.subjects.find((s) => s.code === 'KHTN_LY' || s.id === 'sub_khtn_ly');
      if (!lySub) {
        lySub = this.addSubject({
          code: 'KHTN_LY',
          name: 'KHTN - Vật lí',
          shortName: 'Lý 8-9',
          group: 'Tự nhiên',
          applicableGrades: [8, 9],
          departmentId: deptId,
          allowsMultipleTeachers: false,
          isIntegrated: false,
          active: true,
          color: '#0284c7',
          periodsPerWeek: 1.5,
        });
      } else {
        this.updateSubject(lySub.id, { applicableGrades: [8, 9], periodsPerWeek: 1.5, active: true });
      }

      // 3. Tạo hoặc cập nhật phân môn Hóa học (K8, 9)
      let hoaSub = this.subjects.find((s) => s.code === 'KHTN_HOA' || s.id === 'sub_khtn_hoa');
      if (!hoaSub) {
        hoaSub = this.addSubject({
          code: 'KHTN_HOA',
          name: 'KHTN - Hóa học',
          shortName: 'Hóa 8-9',
          group: 'Tự nhiên',
          applicableGrades: [8, 9],
          departmentId: deptId,
          allowsMultipleTeachers: false,
          isIntegrated: false,
          active: true,
          color: '#0d9488',
          periodsPerWeek: 1.5,
        });
      } else {
        this.updateSubject(hoaSub.id, { applicableGrades: [8, 9], periodsPerWeek: 1.5, active: true });
      }

      // 4. Tạo hoặc cập nhật phân môn Sinh học (K8, 9)
      let sinhSub = this.subjects.find((s) => s.code === 'KHTN_SINH' || s.id === 'sub_khtn_sinh');
      if (!sinhSub) {
        sinhSub = this.addSubject({
          code: 'KHTN_SINH',
          name: 'KHTN - Sinh học',
          shortName: 'Sinh 8-9',
          group: 'Tự nhiên',
          applicableGrades: [8, 9],
          departmentId: deptId,
          allowsMultipleTeachers: false,
          isIntegrated: false,
          active: true,
          color: '#16a34a',
          periodsPerWeek: 1,
        });
      } else {
        this.updateSubject(sinhSub.id, { applicableGrades: [8, 9], periodsPerWeek: 1, active: true });
      }

      // 5. Cập nhật phân phối số tiết (Curriculum)
      const weeks = semesterId === 'HK1' ? 18 : 17;
      const todayStr = new Date().toISOString().split('T')[0];

      // K6 & K7: KHTN = 4
      if (khtnSub) {
        [6, 7].forEach((g) => {
          const item = this.curriculum.find((c) => c.grade === g && c.subjectId === khtnSub!.id && c.semesterId === semesterId);
          if (item) {
            item.periodsPerWeek = 4;
            item.totalPeriods = 4 * weeks;
          } else {
            this.curriculum.push({
              id: `curr_${g}_khtn_${semesterId.toLowerCase()}`,
              schoolYearId,
              semesterId,
              grade: g as any,
              subjectId: khtnSub!.id,
              periodsPerWeek: 4,
              weeks,
              totalPeriods: 4 * weeks,
              effectiveDate: todayStr,
              status: 'approved',
            });
          }
        });

        // K8 & K9: KHTN = 0 (vì đã tách phân môn)
        [8, 9].forEach((g) => {
          const item = this.curriculum.find((c) => c.grade === g && c.subjectId === khtnSub!.id && c.semesterId === semesterId);
          if (item) {
            item.periodsPerWeek = 0;
            item.totalPeriods = 0;
          }
        });
      }

      // K8 & K9: Lý = 1.5, Hóa = 1.5, Sinh = 1.0 (Tổng = 4.0 tiết)
      const subItems = [
        { sub: lySub, p: 1.5 },
        { sub: hoaSub, p: 1.5 },
        { sub: sinhSub, p: 1.0 },
      ];

      [8, 9].forEach((g) => {
        subItems.forEach(({ sub, p }) => {
          if (!sub) return;
          const item = this.curriculum.find((c) => c.grade === g && c.subjectId === sub.id && c.semesterId === semesterId);
          if (item) {
            item.periodsPerWeek = p;
            item.totalPeriods = p * weeks;
          } else {
            this.curriculum.push({
              id: `curr_${g}_${sub.code.toLowerCase()}_${semesterId.toLowerCase()}`,
              schoolYearId,
              semesterId,
              grade: g as any,
              subjectId: sub.id,
              periodsPerWeek: p,
              weeks,
              totalPeriods: p * weeks,
              effectiveDate: todayStr,
              status: 'approved',
            });
          }
        });
      });

      // 6. Cập nhật môn có thể dạy cho giáo viên tổ KHTN
      const khtnTeachers = this.teachers.filter((t) => t.departmentId === deptId);
      khtnTeachers.forEach((t) => {
        const canTeach = new Set(t.subjectsCanTeach || []);
        if (khtnSub) canTeach.add(khtnSub.id);
        if (lySub && (t.major?.toLowerCase().includes('vật lý') || t.major?.toLowerCase().includes('lý') || t.initialDegree?.toLowerCase().includes('vật lý') || t.major?.toLowerCase().includes('khoa học tự nhiên'))) {
          canTeach.add(lySub.id);
        }
        if (hoaSub && (t.major?.toLowerCase().includes('hóa') || t.initialDegree?.toLowerCase().includes('hóa') || t.major?.toLowerCase().includes('khoa học tự nhiên'))) {
          canTeach.add(hoaSub.id);
        }
        if (sinhSub && (t.major?.toLowerCase().includes('sinh') || t.initialDegree?.toLowerCase().includes('sinh') || t.major?.toLowerCase().includes('khoa học tự nhiên'))) {
          canTeach.add(sinhSub.id);
        }
        t.subjectsCanTeach = Array.from(canTeach);
      });

      this.saveToStorage();
      this.notify();
      return {
        success: true,
        message: 'Đã hoàn tất cấu hình chuẩn: K6,7 áp dụng KHTN chung (4 tiết); K8,9 tách phân môn Lý (1.5 tiết), Hóa (1.5 tiết), Sinh (1.0 tiết)!',
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Có lỗi xảy ra khi cấu hình' };
    }
  }

  public getSubjectUsage(subjectId: string): { assignmentCount: number; curriculumCount: number } {
    const assignmentCount = this.assignments.filter((a) => !a.isDeleted && a.subjectId === subjectId).length;
    const curriculumCount = this.curriculum.filter((c) => c.subjectId === subjectId).length;
    return { assignmentCount, curriculumCount };
  }

  public deleteSubject(id: string, cascade = true): boolean {
    const index = this.subjects.findIndex((s) => s.id === id);
    if (index === -1) return false;
    const deleted = this.subjects[index];
    this.subjects.splice(index, 1);

    if (cascade) {
      // Clean up curriculum items for this subject
      this.curriculum = this.curriculum.filter((c) => c.subjectId !== id);
      // Soft delete assignments for this subject
      this.assignments.forEach((a) => {
        if (a.subjectId === id) {
          a.isDeleted = true;
          a.updatedAt = new Date().toISOString();
        }
      });
    }

    this.logAction({
      action: 'DELETE',
      entityType: 'SUBJECT',
      entityId: id,
      entityDescription: `Xóa môn học: ${deleted.name} (${deleted.code})`,
      beforeData: deleted,
    });
    this.saveToStorage();
    return true;
  }

  public bulkDeleteSubjects(subjectIds: string[], cascade = true): number {
    const idSet = new Set(subjectIds);
    const beforeLen = this.subjects.length;
    this.subjects = this.subjects.filter((s) => !idSet.has(s.id));
    const count = beforeLen - this.subjects.length;
    if (count > 0) {
      if (cascade) {
        this.curriculum = this.curriculum.filter((c) => !idSet.has(c.subjectId));
        this.assignments.forEach((a) => {
          if (a.subjectId && idSet.has(a.subjectId)) {
            a.isDeleted = true;
            a.updatedAt = new Date().toISOString();
          }
        });
      }
      this.logAction({
        action: 'DELETE',
        entityType: 'SUBJECT',
        entityId: subjectIds.join(','),
        entityDescription: `Xóa hàng loạt ${count} môn học`,
      });
      this.saveToStorage();
    }
    return count;
  }

  // DEPARTMENT MUTATIONS
  public addDepartment(item: Omit<Department, 'id'>): Department {
    const rawDeputies = Array.isArray(item.deputyTeacherIds)
      ? item.deputyTeacherIds
      : item.deputyTeacherId
      ? [item.deputyTeacherId]
      : [];
    const uniqueDeputyIds = Array.from(new Set(rawDeputies.filter(Boolean)));

    const newDept: Department = {
      id: `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
      deputyTeacherId: uniqueDeputyIds[0] || undefined,
      deputyTeacherIds: uniqueDeputyIds,
    };
    this.departments.push(newDept);
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return newDept;
  }

  public bulkAddDepartments(items: Omit<Department, 'id'>[]): Department[] {
    const created: Department[] = [];
    const timestamp = Date.now();
    items.forEach((item, i) => {
      const rawDeputies = Array.isArray(item.deputyTeacherIds)
        ? item.deputyTeacherIds
        : item.deputyTeacherId
        ? [item.deputyTeacherId]
        : [];
      const uniqueDeputyIds = Array.from(new Set(rawDeputies.filter(Boolean)));

      const newDept: Department = {
        id: `dept_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        ...item,
        deputyTeacherId: uniqueDeputyIds[0] || undefined,
        deputyTeacherIds: uniqueDeputyIds,
      };
      this.departments.push(newDept);
      created.push(newDept);
    });
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return created;
  }

  public updateDepartment(id: string, updates: Partial<Department>): boolean {
    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) return false;

    const oldDept = { ...this.departments[index] };

    let updatedDeputies = updates.deputyTeacherIds;
    if (updatedDeputies !== undefined) {
      updatedDeputies = Array.from(new Set(updatedDeputies.filter(Boolean)));
    } else if (updates.deputyTeacherId !== undefined) {
      updatedDeputies = updates.deputyTeacherId ? [updates.deputyTeacherId] : [];
    }

    const merged = { ...this.departments[index], ...updates };
    if (updatedDeputies !== undefined) {
      merged.deputyTeacherIds = updatedDeputies;
      merged.deputyTeacherId = updatedDeputies[0] || undefined;
    }

    this.departments[index] = merged;

    // 1. Nếu thay đổi Tổ trưởng: thu hồi của tổ trưởng cũ và gán cho tổ trưởng mới
    if (updates.headTeacherId !== undefined && updates.headTeacherId !== oldDept.headTeacherId) {
      if (oldDept.headTeacherId) {
        this.assignments = this.assignments.filter(
          (a) => !(a.departmentId === id && a.teacherId === oldDept.headTeacherId && a.type === 'CONCURRENT' && this.isHeadDepartmentDuty(a.dutyId, a.dutyName))
        );
        const oldHead = this.teachers.find((t) => t.id === oldDept.headTeacherId);
        if (oldHead && Array.isArray(oldHead.positions)) {
          oldHead.positions = oldHead.positions.filter((p) => !p.toLowerCase().includes('tổ trưởng'));
          firestoreRepository.setDocData(this.currentSchoolId, 'teachers', oldHead.id, oldHead).catch(() => {});
        }
      }
      if (updates.headTeacherId) {
        const newHead = this.teachers.find((t) => t.id === updates.headTeacherId);
        if (newHead) {
          const headDuty = this.getHeadDepartmentDuty();
          const periods = headDuty.periodsPerWeekCalculated || 3;
          if (!Array.isArray(newHead.positions)) newHead.positions = [];
          newHead.positions = newHead.positions.filter((p) => !p.toLowerCase().includes('tổ trưởng'));
          newHead.positions.push(`Tổ trưởng chuyên môn (${periods} tiết/tuần)`);
          firestoreRepository.setDocData(this.currentSchoolId, 'teachers', newHead.id, newHead).catch(() => {});
        }
      }
    }

    // 2. Nếu thay đổi Tổ phó: thu hồi của tổ phó bị loại bỏ và gán cho tổ phó mới
    if (updatedDeputies !== undefined) {
      const oldDeputies = Array.isArray(oldDept.deputyTeacherIds) && oldDept.deputyTeacherIds.length > 0
        ? oldDept.deputyTeacherIds
        : oldDept.deputyTeacherId
        ? [oldDept.deputyTeacherId]
        : [];
      const removedDeputies = oldDeputies.filter((dId) => !updatedDeputies!.includes(dId));
      for (const rId of removedDeputies) {
        this.assignments = this.assignments.filter(
          (a) => !(a.departmentId === id && a.teacherId === rId && a.type === 'CONCURRENT' && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName))
        );
        const depT = this.teachers.find((t) => t.id === rId);
        if (depT && Array.isArray(depT.positions)) {
          depT.positions = depT.positions.filter((p) => !p.toLowerCase().includes('tổ phó'));
          firestoreRepository.setDocData(this.currentSchoolId, 'teachers', depT.id, depT).catch(() => {});
        }
      }
      const addedDeputies = updatedDeputies.filter((dId) => !oldDeputies.includes(dId));
      for (const aId of addedDeputies) {
        const depT = this.teachers.find((t) => t.id === aId);
        if (depT) {
          const depDuty = this.getDeputyDepartmentDuty();
          const periods = depDuty.periodsPerWeekCalculated || 1;
          if (!Array.isArray(depT.positions)) depT.positions = [];
          depT.positions = depT.positions.filter((p) => !p.toLowerCase().includes('tổ phó'));
          depT.positions.push(`Tổ phó chuyên môn (${periods} tiết/tuần)`);
          firestoreRepository.setDocData(this.currentSchoolId, 'teachers', depT.id, depT).catch(() => {});
        }
      }
    }

    try {
      firestoreRepository.setDocData(this.currentSchoolId, 'departments', id, this.departments[index]).catch(() => {});
    } catch {}

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    this.notify();
    return true;
  }

  public deleteDepartment(id: string): boolean {
    const index = this.departments.findIndex((d) => d.id === id);
    if (index === -1) return false;

    // 1. Xóa các phân công kiêm nhiệm liên quan đến tổ bị xóa
    this.assignments = this.assignments.filter(
      (a) =>
        !(
          (a.departmentId === id || (!a.departmentId && this.teachers.some((t) => t.id === a.teacherId && t.departmentId === id))) &&
          a.type === 'CONCURRENT' &&
          (this.isHeadDepartmentDuty(a.dutyId, a.dutyName) || this.isDeputyDepartmentDuty(a.dutyId, a.dutyName))
        )
    );

    // 2. Dọn dẹp departmentId trên các phân công còn lại liên quan đến tổ này
    for (const a of this.assignments) {
      if (a.departmentId === id) {
        a.departmentId = '';
      }
    }

    // 3. Xóa tổ khỏi danh sách
    this.departments.splice(index, 1);

    // 4. Cập nhật hồ sơ các giáo viên thuộc tổ này:
    // Đặt departmentId về rỗng ('') để người dùng phân tổ lại, và loại bỏ vai trò Tổ trưởng/Tổ phó nếu không còn phụ trách tổ nào khác
    for (const t of this.teachers) {
      if (t.departmentId === id) {
        t.departmentId = '';
      }
      if (Array.isArray(t.positions) && t.positions.length > 0) {
        const stillHead = this.departments.some((d) => d.headTeacherId === t.id);
        const stillDeputy = this.departments.some(
          (d) => d.deputyTeacherId === t.id || (Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.includes(t.id))
        );
        let updatedPositions = t.positions.map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p));
        if (!stillHead) {
          updatedPositions = updatedPositions.filter(
            (p) => !p.toLowerCase().includes('tổ trưởng') && !p.toLowerCase().includes('to truong')
          );
        }
        if (!stillDeputy) {
          updatedPositions = updatedPositions.filter(
            (p) => !p.toLowerCase().includes('tổ phó') && !p.toLowerCase().includes('to pho')
          );
        }
        t.positions = Array.from(new Set(updatedPositions));
      }
    }

    // 5. Cập nhật các môn học thuộc tổ này
    for (const s of this.subjects) {
      if (s.departmentId === id) {
        s.departmentId = '';
      }
    }

    // 6. Làm sạch và loại bỏ trùng lặp teacherIds ở tất cả các tổ còn lại
    for (const d of this.departments) {
      if (Array.isArray(d.teacherIds)) {
        d.teacherIds = Array.from(
          new Set(
            d.teacherIds.filter((tid) =>
              this.teachers.some((t) => t.id === tid && !t.isDeleted && t.departmentId === d.id)
            )
          )
        );
      }
      if (d.headTeacherId && !this.teachers.some((t) => t.id === d.headTeacherId && !t.isDeleted)) {
        d.headTeacherId = undefined;
      }
      if (Array.isArray(d.deputyTeacherIds)) {
        d.deputyTeacherIds = Array.from(
          new Set(d.deputyTeacherIds.filter((tid) => this.teachers.some((t) => t.id === tid && !t.isDeleted)))
        );
        d.deputyTeacherId = d.deputyTeacherIds[0] || undefined;
      }
    }

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return true;
  }

  public bulkDeleteDepartments(deptIds: string[]): number {
    const idSet = new Set(deptIds);
    const beforeLen = this.departments.length;
    if (beforeLen === 0 || idSet.size === 0) return 0;

    // 1. Xóa các phân công kiêm nhiệm liên quan đến các tổ bị xóa
    this.assignments = this.assignments.filter(
      (a) =>
        !(
          (idSet.has(a.departmentId || '') || (!a.departmentId && this.teachers.some((t) => t.id === a.teacherId && idSet.has(t.departmentId)))) &&
          a.type === 'CONCURRENT' &&
          (this.isHeadDepartmentDuty(a.dutyId, a.dutyName) || this.isDeputyDepartmentDuty(a.dutyId, a.dutyName))
        )
    );

    // 2. Dọn dẹp departmentId trên các phân công còn lại
    for (const a of this.assignments) {
      if (a.departmentId && idSet.has(a.departmentId)) {
        a.departmentId = '';
      }
    }

    // 3. Xóa các tổ khỏi danh mục
    this.departments = this.departments.filter((d) => !idSet.has(d.id));
    const count = beforeLen - this.departments.length;

    if (count > 0) {
      // 4. Cập nhật hồ sơ các giáo viên thuộc các tổ bị xóa
      for (const t of this.teachers) {
        if (t.departmentId && idSet.has(t.departmentId)) {
          t.departmentId = '';
        }
        if (Array.isArray(t.positions) && t.positions.length > 0) {
          const stillHead = this.departments.some((d) => d.headTeacherId === t.id);
          const stillDeputy = this.departments.some(
            (d) => d.deputyTeacherId === t.id || (Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.includes(t.id))
          );
          let updatedPositions = t.positions.map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p));
          if (!stillHead) {
            updatedPositions = updatedPositions.filter(
              (p) => !p.toLowerCase().includes('tổ trưởng') && !p.toLowerCase().includes('to truong')
            );
          }
          if (!stillDeputy) {
            updatedPositions = updatedPositions.filter(
              (p) => !p.toLowerCase().includes('tổ phó') && !p.toLowerCase().includes('to pho')
            );
          }
          t.positions = Array.from(new Set(updatedPositions));
        }
      }

      // 5. Cập nhật môn học
      for (const s of this.subjects) {
        if (s.departmentId && idSet.has(s.departmentId)) {
          s.departmentId = '';
        }
      }

      // 6. Làm sạch teacherIds ở các tổ còn lại
      for (const d of this.departments) {
        if (Array.isArray(d.teacherIds)) {
          d.teacherIds = Array.from(
            new Set(
              d.teacherIds.filter((tid) =>
                this.teachers.some((t) => t.id === tid && !t.isDeleted && t.departmentId === d.id)
              )
            )
          );
        }
        if (d.headTeacherId && !this.teachers.some((t) => t.id === d.headTeacherId && !t.isDeleted)) {
          d.headTeacherId = undefined;
        }
        if (Array.isArray(d.deputyTeacherIds)) {
          d.deputyTeacherIds = Array.from(
            new Set(d.deputyTeacherIds.filter((tid) => this.teachers.some((t) => t.id === tid && !t.isDeleted)))
          );
          d.deputyTeacherId = d.deputyTeacherIds[0] || undefined;
        }
      }

      this.syncAllDepartmentDutiesAndAssignments();
      this.saveToStorage();
    }
    return count;
  }

  public setDepartmentTeachers(departmentId: string, teacherIds: string[]): boolean {
    const dept = this.departments.find((d) => d.id === departmentId);
    if (!dept) return false;

    const targetSet = new Set(teacherIds);

    // 1. Assign all teachers in targetSet to this department
    this.teachers.forEach((teacher) => {
      if (targetSet.has(teacher.id)) {
        // If teacher was in another department, clean up old department's teacherIds
        if (teacher.departmentId && teacher.departmentId !== departmentId) {
          const oldDept = this.departments.find((d) => d.id === teacher.departmentId);
          if (oldDept && oldDept.teacherIds) {
            oldDept.teacherIds = oldDept.teacherIds.filter((id) => id !== teacher.id);
          }
        }
        teacher.departmentId = departmentId;
      } else if (teacher.departmentId === departmentId) {
        // Teacher was previously in this department, but is no longer in targetSet
        teacher.departmentId = '';
      }
    });

    // 2. Synchronize dept.teacherIds
    dept.teacherIds = this.teachers
      .filter((t) => t.departmentId === departmentId && !t.isDeleted)
      .map((t) => t.id);

    this.logAction({
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: departmentId,
      entityDescription: `Cập nhật phân công giáo viên tổ chuyên môn "${dept.name}" (${dept.teacherIds.length} giáo viên)`,
    });

    this.saveToStorage();
    return true;
  }

  public assignTeachersToDepartment(
    departmentId: string,
    teacherIdsToAdd: string[],
    teacherIdsToRemove: string[] = []
  ): boolean {
    const dept = this.departments.find((d) => d.id === departmentId);
    if (!dept) return false;

    // 1. Assign selected teachers to this department
    teacherIdsToAdd.forEach((tId) => {
      const teacher = this.teachers.find((t) => t.id === tId);
      if (teacher) {
        // Remove from previous department's teacherIds list if any
        if (teacher.departmentId && teacher.departmentId !== departmentId) {
          const oldDept = this.departments.find((d) => d.id === teacher.departmentId);
          if (oldDept && oldDept.teacherIds) {
            oldDept.teacherIds = oldDept.teacherIds.filter((id) => id !== tId);
          }
        }
        teacher.departmentId = departmentId;
      }
    });

    // 2. Remove specified teachers from this department
    teacherIdsToRemove.forEach((tId) => {
      const teacher = this.teachers.find((t) => t.id === tId);
      if (teacher && teacher.departmentId === departmentId) {
        teacher.departmentId = '';
      }
    });

    // 3. Keep dept.teacherIds in sync
    dept.teacherIds = this.teachers
      .filter((t) => t.departmentId === departmentId && !t.isDeleted)
      .map((t) => t.id);

    this.logAction({
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: departmentId,
      entityDescription: `Cập nhật danh sách giáo viên tổ chuyên môn "${dept.name}" (${dept.teacherIds.length} giáo viên)`,
    });

    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return true;
  }

  public moveTeacherToDepartment(teacherId: string, targetDepartmentId: string): boolean {
    return this.assignTeachersToDepartment(targetDepartmentId, [teacherId]);
  }

  // =========================================================================
  // ĐỒNG BỘ HAI CHIỀU GIỮA MỤC 5. TỔ CHUYÊN MÔN & PHÂN CÔNG CHUYÊN MÔN
  // =========================================================================

  public isHeadDepartmentDuty(dutyId?: string, dutyName?: string, dutyCode?: string): boolean {
    if (dutyId === 'duty_to_truong') return true;
    if (dutyCode === 'TO_TRUONG') return true;
    const d = dutyId ? this.duties.find((item) => item.id === dutyId) : undefined;
    if (d && (d.code === 'TO_TRUONG' || d.id === 'duty_to_truong')) return true;

    const raw = `${dutyName || ''} ${d?.name || ''} ${d?.code || ''}`.toLowerCase();
    // Không được là phó
    if (raw.includes('tổ phó') || raw.includes('to pho') || raw.includes('phó tổ') || raw.includes('pho to')) {
      return false;
    }
    if (
      raw.includes('tổ trưởng') ||
      raw.includes('to truong') ||
      raw.startsWith('tt ') ||
      raw.includes(' tt ') ||
      raw.endsWith(' tt') ||
      raw === 'tt'
    ) {
      return true;
    }
    return false;
  }

  public isDeputyDepartmentDuty(dutyId?: string, dutyName?: string, dutyCode?: string): boolean {
    if (dutyId === 'duty_to_pho') return true;
    if (dutyCode === 'TO_PHO') return true;
    const d = dutyId ? this.duties.find((item) => item.id === dutyId) : undefined;
    if (d && (d.code === 'TO_PHO' || d.id === 'duty_to_pho')) return true;

    const raw = `${dutyName || ''} ${d?.name || ''} ${d?.code || ''}`.toLowerCase();
    if (
      raw.includes('tổ phó') ||
      raw.includes('to pho') ||
      raw.includes('phó tổ') ||
      raw.includes('pho to') ||
      raw.startsWith('tp ') ||
      raw.includes(' tp ') ||
      raw.endsWith(' tp') ||
      raw === 'tp'
    ) {
      return true;
    }
    return false;
  }

  public getHeadDepartmentDuty(): SpecialDuty {
    const found = this.duties.find((d) => this.isHeadDepartmentDuty(d.id, d.name, d.code));
    if (found) return found;
    const fallback: SpecialDuty = {
      id: 'duty_to_truong',
      code: 'TO_TRUONG',
      name: 'Tổ trưởng chuyên môn',
      type: 'CONCURRENT',
      periodsPerWeekCalculated: 3,
      periodsPerWeekExempted: 0,
      applicationMode: 'FIXED',
      notes: 'Quy định định mức giảm 3 tiết/tuần (tính vào kiêm nhiệm)',
    };
    this.duties.push(fallback);
    return fallback;
  }

  public getDeputyDepartmentDuty(): SpecialDuty {
    const found = this.duties.find((d) => this.isDeputyDepartmentDuty(d.id, d.name, d.code));
    if (found) return found;
    const fallback: SpecialDuty = {
      id: 'duty_to_pho',
      code: 'TO_PHO',
      name: 'Tổ phó chuyên môn',
      type: 'CONCURRENT',
      periodsPerWeekCalculated: 1,
      periodsPerWeekExempted: 0,
      applicationMode: 'FIXED',
      notes: 'Quy định định mức giảm 1 tiết/tuần (tính vào kiêm nhiệm)',
    };
    this.duties.push(fallback);
    return fallback;
  }

  /**
   * ĐỒNG BỘ TẤT CẢ VỊ TRÍ, CHỨC VỤ VÀ TỔ CHUYÊN MÔN TỪ GỐC (PHÂN CÔNG KIÊM NHIỆM).
   * Nguyên tắc nền tảng:
   * 1. Mục Kiêm nhiệm (Assignments of type CONCURRENT/EXEMPTION/CONCURRENT_DUTY) LÀ GỐC (Single Source of Truth).
   * 2. Đồng bộ XUỐI sang:
   *    - teacher.positions (vị trí công tác của từng giáo viên)
   *    - departments.headTeacherId / deputyTeacherIds (Tổ trưởng / Tổ phó chuyên môn)
   *    - classes.homeroomTeacherId (Giáo viên chủ nhiệm lớp)
   * 3. Tuyệt đối KHÔNG tự động đẩy ngược (auto-push) từ departments, classes hay positions vào assignments để tránh sinh trùng lặp.
   */
  public syncDutyAssignmentsToAllModules(schoolId: string = this.currentSchoolId, targetVersionId?: string): void {
    if (this.isSyncingDepartmentDuties) return;
    this.isSyncingDepartmentDuties = true;

    try {
      // 1. Triệt tiêu triệt để mọi phân công kiêm nhiệm trùng lặp (cùng giáo viên + cùng nhiệm vụ + cùng version)
      this.deduplicateDutyAssignments();

      const activeVerId = targetVersionId || this.currentVersionId || this.versions[0]?.id || 'ver_hk1_official';
      const isQuyHop = !schoolId || schoolId === 'school_quyhop';

      // 2. Lấy tất cả phân công kiêm nhiệm hợp lệ của phiên bản hiện tại (hoặc tất cả phiên bản)
      const activeDutyAssignments = this.assignments.filter(
        (a) =>
          !a.isDeleted &&
          (isQuyHop ? (!a.schoolId || a.schoolId === 'school_quyhop') : (a.schoolId === schoolId)) &&
          (a.versionId === activeVerId || !a.versionId) &&
          (a.type === 'CONCURRENT' ||
            a.type === 'EXEMPTION' ||
            a.type === 'CONCURRENT_DUTY' ||
            Boolean(a.dutyId) ||
            Boolean(a.dutyName))
      );

      // Nhóm theo giáo viên
      const dutyByTeacher = new Map<string, TeachingAssignment[]>();
      for (const a of activeDutyAssignments) {
        if (!dutyByTeacher.has(a.teacherId)) {
          dutyByTeacher.set(a.teacherId, []);
        }
        dutyByTeacher.get(a.teacherId)!.push(a);
      }

      // 3. ĐỒNG BỘ SANG teacher.positions CHO TẤT CẢ GIÁO VIÊN
      for (const teacher of this.teachers) {
        if (teacher.isDeleted) continue;
        if (!isQuyHop && teacher.schoolId && teacher.schoolId !== schoolId) continue;

        // Giữ lại các chức vụ hành chính đặc thù (Ban giám hiệu, Cấp ủy) nếu không nằm trong danh mục kiêm nhiệm
        const preservedAdminRoles: string[] = [];
        if (Array.isArray(teacher.positions)) {
          for (const pos of teacher.positions) {
            const cleanPos = pos.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
            if (
              cleanPos === 'hiệu trưởng' ||
              cleanPos === 'phó hiệu trưởng' ||
              cleanPos === 'bí thư chi bộ' ||
              cleanPos === 'phó bí thư chi bộ'
            ) {
              if (!preservedAdminRoles.includes(pos)) {
                preservedAdminRoles.push(pos);
              }
            }
          }
        }

        const teacherDuties = dutyByTeacher.get(teacher.id) || [];
        const newPositionsSet = new Set<string>(preservedAdminRoles);

        for (const asg of teacherDuties) {
          let posTitle = '';
          const cleanName = (asg.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim();
          const canonical = normalizePositionName(cleanName) || cleanName;

          if (this.isHeadDepartmentDuty(asg.dutyId, asg.dutyName)) {
            posTitle = 'Tổ trưởng chuyên môn';
          } else if (this.isDeputyDepartmentDuty(asg.dutyId, asg.dutyName)) {
            posTitle = 'Tổ phó chuyên môn';
          } else if (asg.classId || canonical.toLowerCase().includes('chủ nhiệm')) {
            const cls = this.classes.find((c) => c.id === asg.classId || (asg.dutyName && asg.dutyName.includes(c.name)));
            posTitle = cls ? `Chủ nhiệm lớp ${cls.name}` : canonical;
          } else {
            posTitle = canonical;
          }

          if (posTitle) {
            const periods = asg.periodsPerWeek || 0;
            const formatted = periods > 0 ? `${posTitle} (${periods} tiết/tuần)` : posTitle;
            newPositionsSet.add(formatted);
          }
        }

        const finalPositions = Array.from(newPositionsSet);
        const prevJoined = (teacher.positions || []).join(';');
        const newJoined = finalPositions.join(';');
        if (prevJoined !== newJoined) {
          teacher.positions = finalPositions;
          firestoreRepository.setDocData(this.currentSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
        }
      }


      // 4. ĐỒNG BỘ SANG departments (TỔ TRƯỞNG & TỔ PHÓ CHUYÊN MÔN) - ĐỒNG BỘ HAI CHIỀU
      const headTeachersFromDuties = new Set<string>();
      const deputyTeachersFromDuties = new Set<string>();

      for (const asg of activeDutyAssignments) {
        if (this.isHeadDepartmentDuty(asg.dutyId, asg.dutyName)) {
          headTeachersFromDuties.add(asg.teacherId);
        }
        if (this.isDeputyDepartmentDuty(asg.dutyId, asg.dutyName)) {
          deputyTeachersFromDuties.add(asg.teacherId);
        }
      }

      for (const dept of this.departments) {
        if (!isQuyHop && dept.schoolId && dept.schoolId !== schoolId) continue;
        const prevHead = dept.headTeacherId;
        const prevDeputies = (dept.deputyTeacherIds || []).join(',');

        // Cập nhật Tổ trưởng:
        if (dept.headTeacherId) {
          const headTeacher = this.teachers.find((tc) => tc.id === dept.headTeacherId && !tc.isDeleted);
          if (headTeacher) {
            // Đảm bảo giáo viên này có phân công Tổ trưởng
            if (!headTeachersFromDuties.has(dept.headTeacherId)) {
              const headDuty = this.getHeadDepartmentDuty();
              const periods = headDuty.periodsPerWeekCalculated || 3;
              const weeks = this.currentSemesterId === 'HK1' ? 18 : 17;
              const newHeadAsg: TeachingAssignment = {
                id: `asg_duty_head_${dept.headTeacherId}_${activeVerId}`,
                schoolId: this.currentSchoolId,
                schoolYearId: this.currentSchoolYearId || 'sy_2024_2025',
                semesterId: this.currentSemesterId || 'HK1',
                versionId: activeVerId,
                teacherId: dept.headTeacherId,
                departmentId: dept.id,
                type: 'CONCURRENT',
                dutyId: headDuty.id,
                dutyName: 'Tổ trưởng chuyên môn',
                session: 'ACTIVITY',
                periodsPerWeek: periods,
                weeks,
                totalPeriods: periods * weeks,
                status: 'approved',
                notes: `Tổ trưởng tổ ${dept.name}`,
                createdAt: new Date().toISOString(),
                createdBy: this.currentUser?.email || 'admin',
              };
              this.assignments.push(newHeadAsg);
              headTeachersFromDuties.add(dept.headTeacherId);
              firestoreRepository.setDocData(this.currentSchoolId, 'assignments', newHeadAsg.id, newHeadAsg).catch(() => {});
            }
          } else {
            dept.headTeacherId = undefined;
          }
        } else {
          // Chưa có tổ trưởng: tìm từ active duty assignments
          for (const tId of headTeachersFromDuties) {
            const t = this.teachers.find((tc) => tc.id === tId && !tc.isDeleted);
            if (t && (t.departmentId === dept.id || (Array.isArray(dept.teacherIds) && dept.teacherIds.includes(tId)))) {
              dept.headTeacherId = tId;
              break;
            }
          }
        }

        // Cập nhật Tổ phó:
        const currentDeputies = Array.isArray(dept.deputyTeacherIds)
          ? dept.deputyTeacherIds
          : dept.deputyTeacherId
          ? [dept.deputyTeacherId]
          : [];
        let nextDeputies = [...currentDeputies];

        // Nếu đã gán tổ phó ở danh mục tổ nhưng chưa có phân công -> tự động tạo phân công
        for (const depId of currentDeputies) {
          const depTeacher = this.teachers.find((tc) => tc.id === depId && !tc.isDeleted);
          if (depTeacher && !deputyTeachersFromDuties.has(depId)) {
            const depDuty = this.getDeputyDepartmentDuty();
            const periods = depDuty.periodsPerWeekCalculated || 1;
            const weeks = this.currentSemesterId === 'HK1' ? 18 : 17;
            const newDepAsg: TeachingAssignment = {
              id: `asg_duty_dep_${depId}_${activeVerId}`,
              schoolId: this.currentSchoolId,
              schoolYearId: this.currentSchoolYearId || 'sy_2024_2025',
              semesterId: this.currentSemesterId || 'HK1',
              versionId: activeVerId,
              teacherId: depId,
              departmentId: dept.id,
              type: 'CONCURRENT',
              dutyId: depDuty.id,
              dutyName: 'Tổ phó chuyên môn',
              session: 'ACTIVITY',
              periodsPerWeek: periods,
              weeks,
              totalPeriods: periods * weeks,
              status: 'approved',
              notes: `Tổ phó tổ ${dept.name}`,
              createdAt: new Date().toISOString(),
              createdBy: this.currentUser?.email || 'admin',
            };
            this.assignments.push(newDepAsg);
            deputyTeachersFromDuties.add(depId);
            firestoreRepository.setDocData(this.currentSchoolId, 'assignments', newDepAsg.id, newDepAsg).catch(() => {});
          }
        }

        for (const tId of deputyTeachersFromDuties) {
          const t = this.teachers.find((tc) => tc.id === tId && !tc.isDeleted);
          if (t && (t.departmentId === dept.id || (Array.isArray(dept.teacherIds) && dept.teacherIds.includes(tId)))) {
            if (!nextDeputies.includes(tId)) {
              nextDeputies.push(tId);
            }
          }
        }
        dept.deputyTeacherIds = nextDeputies.filter((tid) => this.teachers.some((tc) => tc.id === tid && !tc.isDeleted));
        dept.deputyTeacherId = dept.deputyTeacherIds[0] || undefined;

        if (prevHead !== dept.headTeacherId || prevDeputies !== (dept.deputyTeacherIds || []).join(',')) {
          firestoreRepository.setDocData(this.currentSchoolId, 'departments', dept.id, dept).catch(() => {});
        }
      }

      // 5. ĐỒNG BỘ SANG classes (GIÁO VIÊN CHỦ NHIỆM) - ĐỒNG BỘ HAI CHIỀU TUYỆT ĐỐI KHÔNG MẤT DỮ LIỆU
      const homeroomAssignments = activeDutyAssignments.filter(
        (a) => a.classId || (a.dutyName && a.dutyName.toLowerCase().includes('chủ nhiệm'))
      );

      for (const cls of this.classes) {
        if (cls.isDeleted) continue;
        if (!isQuyHop && cls.schoolId && cls.schoolId !== schoolId) continue;
        const prevHomeroom = cls.homeroomTeacherId;
        const clsCleanName = cls.name.toLowerCase().replace(/^(lớp|lop)\s*/i, '').trim();

        // Tìm phân công kiêm nhiệm GVCN tương ứng của lớp này
        let hrAsg = homeroomAssignments.find(
          (a) =>
            a.classId === cls.id ||
            (cls.code && a.classId === cls.code) ||
            (a.dutyName &&
              (a.dutyName.toLowerCase().includes(cls.name.toLowerCase()) ||
                (clsCleanName && a.dutyName.toLowerCase().includes(clsCleanName))))
        );

        if (hrAsg) {
          cls.homeroomTeacherId = hrAsg.teacherId;
          if (!hrAsg.classId) {
            hrAsg.classId = cls.id;
          }
        } else if (cls.homeroomTeacherId) {
          // Lớp có gán GVCN trong danh mục lớp nhưng chưa có phân công trong assignments:
          // KIỂM TRA: Giáo viên này còn tồn tại và không bị xóa?
          const assignedTeacher = this.teachers.find((t) => t.id === cls.homeroomTeacherId && !t.isDeleted);
          if (assignedTeacher) {
            // TỰ ĐỘNG TẠO PHÂN CÔNG GVCN CHO GIÁO VIÊN NÀY ĐỂ BẢNG KIÊM NHIỆM VÀ DS LỚP ĐỒNG NHẤT 100%
            this.syncHomeroomTeacherAssignment(cls.id, undefined, cls.homeroomTeacherId, cls.name);
          } else {
            cls.homeroomTeacherId = undefined;
          }
        }

        if (prevHomeroom !== cls.homeroomTeacherId) {
          firestoreRepository.setDocData(this.currentSchoolId, 'classes', cls.id, cls).catch(() => {});
        }
      }
    } finally {
      this.isSyncingDepartmentDuties = false;
    }
  }

  public syncAllDepartmentDutiesAndAssignments(): void {
    this.syncDutyAssignmentsToAllModules();
    this.deduplicateDutyAssignments();
    this.cleanOrphanedAssignments();
  }

  /**
   * Tự động đồng bộ số tiết cho tất cả phân công giảng dạy và nhiệm vụ kiêm nhiệm
   * theo đúng định mức Khung PPCT và Nhiệm vụ kiêm nhiệm mới nhất (giống công thức trong Excel).
   * Giữ nguyên 100% dữ liệu đã nhập (giáo viên, lớp, môn, buổi, điểm trường, ghi chú, trạng thái).
   */
  public syncAllAssignmentsWithQuotas(): number {
    const classMap = new Map(this.classes.map((c) => [c.id, c]));
    const subjectMap = new Map(this.subjects.map((s) => [s.id, s]));
    const subjectByCode = new Map(this.subjects.map((s) => [s.code, s]));
    const dutyMap = new Map(this.duties.map((d) => [d.id, d]));
    const dutyByCode = new Map(this.duties.map((d) => [d.code, d]));

    const headDuty = this.getHeadDepartmentDuty();
    const depDuty = this.getDeputyDepartmentDuty();

    let updatedCount = 0;

    for (const a of this.assignments) {
      if (a.isDeleted) continue;

      // 1. Phân công giảng dạy văn hóa / môn học
      if (a.type === 'TEACHING' && a.subjectId && a.classId) {
        const cls = classMap.get(a.classId);
        if (cls) {
          const subObj = subjectMap.get(a.subjectId) || subjectByCode.get(a.subjectId);
          const subId = subObj ? subObj.id : a.subjectId;
          const subCode = subObj ? subObj.code : undefined;

          // Tìm định mức khung PPCT
          const curr =
            this.curriculum.find(
              (c) =>
                (c.subjectId === subId || (subCode && c.subjectId === subCode)) &&
                c.grade === cls.grade &&
                c.semesterId === a.semesterId &&
                c.schoolYearId === a.schoolYearId
            ) ||
            this.curriculum.find(
              (c) =>
                (c.subjectId === subId || (subCode && c.subjectId === subCode)) &&
                c.grade === cls.grade &&
                c.semesterId === a.semesterId
            ) ||
            this.curriculum.find(
              (c) =>
                (c.subjectId === subId || (subCode && c.subjectId === subCode)) &&
                c.grade === cls.grade
            );

          if (curr && typeof curr.periodsPerWeek === 'number' && !isNaN(curr.periodsPerWeek)) {
            const newPeriods = curr.periodsPerWeek;
            const weeks = a.weeks || curr.weeks || (a.semesterId === 'HK1' ? 18 : 17);
            const newTotal = newPeriods * weeks;

            if (a.periodsPerWeek !== newPeriods || a.totalPeriods !== newTotal || a.weeks !== weeks) {
              a.periodsPerWeek = newPeriods;
              a.weeks = weeks;
              a.totalPeriods = newTotal;
              updatedCount++;
            }
          }
        }
      } else if (
        a.type === 'CONCURRENT' ||
        a.type === 'CONCURRENT_DUTY' ||
        a.type === 'EXEMPTION' ||
        Boolean(a.dutyId) ||
        Boolean(a.dutyName)
      ) {
        // 2. Phân công kiêm nhiệm hoặc miễn giảm
        let d: SpecialDuty | undefined = a.dutyId
          ? (dutyMap.get(a.dutyId) || dutyByCode.get(a.dutyId))
          : undefined;

        if (!d && a.dutyName) {
          const rawName = a.dutyName.toLowerCase();
          d = this.duties.find(
            (duty) =>
              rawName.includes(duty.name.toLowerCase()) ||
              duty.name.toLowerCase().includes(rawName)
          );
        }

        if (!d) {
          if (this.isHeadDepartmentDuty(a.dutyId, a.dutyName)) {
            d = headDuty;
          } else if (this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)) {
            d = depDuty;
          }
        }

        if (d) {
          const isExempt = a.type === 'EXEMPTION' || d.type === 'EXEMPTION';
          const targetPeriods = isExempt
            ? (d.periodsPerWeekExempted ?? d.periodsPerWeekCalculated ?? 0)
            : (d.periodsPerWeekCalculated ?? d.periodsPerWeekExempted ?? 0);

          if (typeof targetPeriods === 'number' && !isNaN(targetPeriods)) {
            const weeks = a.weeks || (a.semesterId === 'HK1' ? 18 : 17);
            const newTotal = targetPeriods * weeks;

            if (a.periodsPerWeek !== targetPeriods || a.totalPeriods !== newTotal || a.weeks !== weeks || a.dutyId !== d.id) {
              a.periodsPerWeek = targetPeriods;
              a.weeks = weeks;
              a.totalPeriods = newTotal;
              a.dutyId = d.id;
              if (d.name && (!a.dutyName || !a.dutyName.includes(d.name))) {
                a.dutyName = d.name;
              }
              updatedCount++;
            }
          }
        }
      }
    }

    // 3. Đồng bộ lại các chuỗi số tiết kiêm nhiệm trong teacher.positions
    for (const teacher of this.teachers) {
      if (!Array.isArray(teacher.positions) || teacher.isDeleted) continue;
      let changedPos = false;
      const updatedPositions = teacher.positions.map((pos) => {
        const clean = pos.replace(/\s*\([^)]*\)/g, '').trim();
        const matched = this.duties.find(
          (d) =>
            d.name.toLowerCase() === pos.toLowerCase() ||
            d.name.toLowerCase() === clean.toLowerCase() ||
            clean.toLowerCase().includes(d.name.toLowerCase()) ||
            d.name.toLowerCase().includes(clean.toLowerCase())
        );
        if (matched) {
          const p = matched.periodsPerWeekCalculated || matched.periodsPerWeekExempted || 0;
          if (p > 0) {
            const formatted = `${matched.name} (${p} tiết/tuần)`;
            if (formatted !== pos) {
              changedPos = true;
              return formatted;
            }
          }
        }
        return pos;
      });
      if (changedPos) {
        teacher.positions = updatedPositions;
      }
    }

    return updatedCount;
  }

  // CURRICULUM MUTATIONS
  public updateCurriculum(id: string, updates: Partial<CurriculumDistribution>): boolean {
    const index = this.curriculum.findIndex((c) => c.id === id);
    if (index === -1) return false;
    const item = { ...this.curriculum[index], ...updates };
    item.totalPeriods = item.periodsPerWeek * item.weeks;
    this.curriculum[index] = item;
    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    return true;
  }

  public addCurriculum(item: Omit<CurriculumDistribution, 'id' | 'totalPeriods'>): CurriculumDistribution {
    const newCurr: CurriculumDistribution = {
      id: `curr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
      totalPeriods: item.periodsPerWeek * item.weeks,
    };
    this.curriculum.push(newCurr);
    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    return newCurr;
  }

  public bulkUpsertCurriculum(
    items: (Omit<CurriculumDistribution, 'id' | 'totalPeriods'> | {
      schoolYearId: string;
      semesterId: SemesterId;
      versionId?: string;
      grade: 6 | 7 | 8 | 9;
      subjectId: string;
      periodsPerWeek: number;
      weeks: number;
      effectiveDate?: string;
      status?: 'approved' | 'draft';
    })[]
  ): void {
    const timestamp = Date.now();
    items.forEach((item, i) => {
      // Find existing
      const existing = this.curriculum.find(
        (c) =>
          c.schoolYearId === item.schoolYearId &&
          c.semesterId === item.semesterId &&
          c.grade === item.grade &&
          c.subjectId === item.subjectId
      );

      if (existing) {
        existing.periodsPerWeek = item.periodsPerWeek;
        existing.weeks = item.weeks;
        existing.totalPeriods = item.periodsPerWeek * item.weeks;
        if (item.status) existing.status = item.status;
        if (item.effectiveDate) existing.effectiveDate = item.effectiveDate;
      } else {
        this.curriculum.push({
          id: `curr_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          effectiveDate: item.effectiveDate || new Date().toISOString().split('T')[0],
          status: item.status || 'approved',
          ...item,
          totalPeriods: item.periodsPerWeek * item.weeks,
        });
      }
    });

    this.syncAllAssignmentsWithQuotas();
    this.logAction({
      action: 'UPDATE',
      entityType: 'CURRICULUM',
      entityId: 'bulk',
      entityDescription: `Cập nhật hàng loạt khung số tiết cho ${items.length} môn/khối`,
    });
    this.saveToStorage();
  }

  public copyCurriculumAcrossGrades(
    sourceGrade: number,
    targetGrades: number[],
    schoolYearId: string,
    semesterId: SemesterId
  ): number {
    const sourceItems = this.curriculum.filter(
      (c) => c.grade === sourceGrade && c.schoolYearId === schoolYearId && c.semesterId === semesterId
    );

    let count = 0;
    const timestamp = Date.now();

    targetGrades.forEach((tg) => {
      sourceItems.forEach((si, i) => {
        const existing = this.curriculum.find(
          (c) =>
            c.grade === tg &&
            c.schoolYearId === schoolYearId &&
            c.semesterId === semesterId &&
            c.subjectId === si.subjectId
        );

        if (existing) {
          existing.periodsPerWeek = si.periodsPerWeek;
          existing.weeks = si.weeks;
          existing.totalPeriods = si.periodsPerWeek * si.weeks;
        } else {
          this.curriculum.push({
            id: `curr_${timestamp}_${tg}_${i}_${Math.random().toString(36).substring(2, 5)}`,
            schoolYearId,
            semesterId,
            grade: tg as any,
            subjectId: si.subjectId,
            periodsPerWeek: si.periodsPerWeek,
            weeks: si.weeks,
            totalPeriods: si.periodsPerWeek * si.weeks,
            effectiveDate: si.effectiveDate,
            status: 'approved',
          });
        }
        count++;
      });
    });

    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    return count;
  }

  public copyCurriculumAcrossSemesters(
    sourceSemesterId: SemesterId,
    targetSemesterId: SemesterId,
    schoolYearId: string
  ): number {
    const sourceItems = this.curriculum.filter(
      (c) => c.schoolYearId === schoolYearId && c.semesterId === sourceSemesterId
    );

    const targetWeeks = targetSemesterId === 'HK1' ? 18 : 17;
    let count = 0;
    const timestamp = Date.now();

    sourceItems.forEach((si, i) => {
      const existing = this.curriculum.find(
        (c) =>
          c.grade === si.grade &&
          c.schoolYearId === schoolYearId &&
          c.semesterId === targetSemesterId &&
          c.subjectId === si.subjectId
      );

      if (existing) {
        existing.periodsPerWeek = si.periodsPerWeek;
        existing.weeks = targetWeeks;
        existing.totalPeriods = si.periodsPerWeek * targetWeeks;
      } else {
        this.curriculum.push({
          id: `curr_${timestamp}_${targetSemesterId}_${i}_${Math.random().toString(36).substring(2, 5)}`,
          schoolYearId,
          semesterId: targetSemesterId,
          grade: si.grade,
          subjectId: si.subjectId,
          periodsPerWeek: si.periodsPerWeek,
          weeks: targetWeeks,
          totalPeriods: si.periodsPerWeek * targetWeeks,
          effectiveDate: new Date().toISOString().split('T')[0],
          status: 'approved',
        });
      }
      count++;
    });

    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    return count;
  }

  public bulkDeleteCurriculum(currIds: string[]): number {
    const idSet = new Set(currIds);
    const beforeLen = this.curriculum.length;
    this.curriculum = this.curriculum.filter((c) => !idSet.has(c.id));
    const count = beforeLen - this.curriculum.length;
    if (count > 0) {
      this.syncAllAssignmentsWithQuotas();
      this.saveToStorage();
    }
    return count;
  }

  // DUTY MUTATIONS
  public updateDuty(id: string, updates: Partial<SpecialDuty>): boolean {
    const index = this.duties.findIndex((d) => d.id === id);
    if (index === -1) return false;
    this.duties[index] = { ...this.duties[index], ...updates };
    this.syncAllAssignmentsWithQuotas();
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    try {
      firestoreRepository.setDocData(this.currentSchoolId, 'duties', id, this.duties[index]).catch(() => {});
    } catch {}
    this.notify();
    return true;
  }

  public addDuty(item: Omit<SpecialDuty, 'id'>): SpecialDuty {
    if (isForbiddenDutyOrExemption(item)) {
      throw new Error('Nhiệm vụ này đã được cấu hình cố định trong hồ sơ nhân sự, không dùng kiêm nhiệm / miễn giảm.');
    }
    const newDuty: SpecialDuty = {
      id: `duty_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item,
    };
    this.duties.push(newDuty);
    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    try {
      firestoreRepository.setDocData(this.currentSchoolId, 'duties', newDuty.id, newDuty).catch(() => {});
    } catch {}
    this.notify();
    return newDuty;
  }

  public bulkAddDuties(items: Omit<SpecialDuty, 'id'>[]): SpecialDuty[] {
    const validItems = items.filter((item) => !isForbiddenDutyOrExemption(item));
    const created: SpecialDuty[] = [];
    const timestamp = Date.now();
    validItems.forEach((item, i) => {
      const newDuty: SpecialDuty = {
        id: `duty_${timestamp}_${i}_${Math.random().toString(36).substring(2, 5)}`,
        ...item,
      };
      this.duties.push(newDuty);
      created.push(newDuty);
    });
    this.syncAllAssignmentsWithQuotas();
    this.saveToStorage();
    try {
      firestoreRepository.batchSetDocuments(this.currentSchoolId, 'duties', created).catch(() => {});
    } catch {}
    this.notify();
    return created;
  }

  public deleteDuty(id: string): boolean {
    const index = this.duties.findIndex((d) => d.id === id);
    if (index === -1) return false;
    const dutyName = this.duties[index]?.name?.toLowerCase();
    this.duties.splice(index, 1);
    // Also remove assignments referencing this duty
    this.assignments = this.assignments.filter(
      (a) => a.dutyId !== id && (!a.dutyName || a.dutyName.toLowerCase() !== dutyName)
    );
    if (dutyName) {
      for (const t of this.teachers) {
        if (Array.isArray(t.positions)) {
          t.positions = t.positions.filter((p) => !p.toLowerCase().includes(dutyName));
        }
      }
    }
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    try {
      firestoreRepository.deleteDocData(this.currentSchoolId, 'duties', id).catch(() => {});
    } catch {}
    this.notify();
    return true;
  }

  public bulkDeleteDuties(dutyIds: string[]): number {
    const idSet = new Set(dutyIds);
    const targetNames = new Set(
      this.duties.filter((d) => idSet.has(d.id)).map((d) => d.name.toLowerCase())
    );
    const beforeLen = this.duties.length;
    this.duties = this.duties.filter((d) => !idSet.has(d.id));
    const count = beforeLen - this.duties.length;
    if (count > 0) {
      this.assignments = this.assignments.filter(
        (a) => (!a.dutyId || !idSet.has(a.dutyId)) && (!a.dutyName || !targetNames.has(a.dutyName.toLowerCase()))
      );
      for (const t of this.teachers) {
        if (Array.isArray(t.positions)) {
          t.positions = t.positions.filter((p) => {
            const clean = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
            return !targetNames.has(clean) && !Array.from(targetNames).some((tn) => clean.includes(tn));
          });
        }
      }
      this.syncAllDepartmentDutiesAndAssignments();
      this.saveToStorage();
      try {
        dutyIds.forEach((dId) => {
          firestoreRepository.deleteDocData(this.currentSchoolId, 'duties', dId).catch(() => {});
        });
      } catch {}
      this.notify();
    }
    return count;
  }

  public bulkDeleteDutyAssignments(assignmentIds: string[]): number {
    const idSet = new Set(assignmentIds);
    const beforeLen = this.assignments.length;
    const deletedItems = this.assignments.filter((a) => idSet.has(a.id));
    this.assignments = this.assignments.filter((a) => !idSet.has(a.id));
    const count = beforeLen - this.assignments.length;
    if (count > 0) {
      for (const item of deletedItems) {
        const isDuty =
          item.type === 'CONCURRENT' ||
          item.type === 'EXEMPTION' ||
          item.type === 'CONCURRENT_DUTY' ||
          Boolean(item.dutyId) ||
          Boolean(item.dutyName);

        if (isDuty) {
          const isHead = this.isHeadDepartmentDuty(item.dutyId, item.dutyName);
          const isDep = this.isDeputyDepartmentDuty(item.dutyId, item.dutyName);
          if (isHead) {
            const hasOther = this.assignments.some(
              (a) => !a.isDeleted && a.teacherId === item.teacherId && a.type === 'CONCURRENT' && this.isHeadDepartmentDuty(a.dutyId, a.dutyName)
            );
            if (!hasOther) {
              const dept = this.departments.find((d) => d.id === item.departmentId || d.headTeacherId === item.teacherId);
              if (dept && dept.headTeacherId === item.teacherId) {
                dept.headTeacherId = undefined;
                firestoreRepository.setDocData(this.currentSchoolId, 'departments', dept.id, dept).catch(() => {});
              }
            }
          }
          if (isDep) {
            const hasOther = this.assignments.some(
              (a) => !a.isDeleted && a.teacherId === item.teacherId && a.type === 'CONCURRENT' && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)
            );
            if (!hasOther) {
              const dept = this.departments.find(
                (d) => d.id === item.departmentId || (Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.includes(item.teacherId))
              );
              if (dept) {
                if (Array.isArray(dept.deputyTeacherIds)) {
                  dept.deputyTeacherIds = dept.deputyTeacherIds.filter((tId) => tId !== item.teacherId);
                }
                dept.deputyTeacherId = dept.deputyTeacherIds?.[0] || undefined;
                firestoreRepository.setDocData(this.currentSchoolId, 'departments', dept.id, dept).catch(() => {});
              }
            }
          }

          // Xử lý GVCN nếu là chủ nhiệm lớp
          if (item.classId || (item.dutyName && item.dutyName.toLowerCase().includes('chủ nhiệm'))) {
            const cls = this.classes.find(
              (c) => c.id === item.classId || (item.dutyName && item.dutyName.includes(c.name))
            );
            if (cls && cls.homeroomTeacherId === item.teacherId) {
              cls.homeroomTeacherId = undefined;
              firestoreRepository.setDocData(this.currentSchoolId, 'classes', cls.id, cls).catch(() => {});
            }
          }

          // Đồng bộ gỡ bỏ nhiệm vụ khỏi teacher.positions triệt để (xóa cả dạng có định mức trong ngoặc)
          const teacher = this.teachers.find((t) => t.id === item.teacherId);
          if (teacher && Array.isArray(teacher.positions)) {
            const rawClean = (item.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
            const normClean = normalizePositionName(rawClean).toLowerCase();
            const dId = (item.dutyId || '').trim().toLowerCase();

            const hasOtherSameDuty = this.assignments.some(
              (a) =>
                !a.isDeleted &&
                a.teacherId === item.teacherId &&
                (a.type === 'CONCURRENT' || a.type === 'EXEMPTION' || a.type === 'CONCURRENT_DUTY' || Boolean(a.dutyId)) &&
                normalizePositionName((a.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim()).toLowerCase() === normClean
            );
            if (!hasOtherSameDuty) {
              teacher.positions = teacher.positions.filter((p) => {
                const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
                const normP = normalizePositionName(cleanP).toLowerCase();
                if (normClean && (normP === normClean || cleanP === normClean || cleanP === rawClean)) {
                  return false;
                }
                if (rawClean && (cleanP.includes(rawClean) || rawClean.includes(cleanP))) {
                  return false;
                }
                const slug = cleanP.replace(/[^a-z0-9_-]+/g, '_');
                if (dId && (dId.includes(slug) || slug.includes(dId.replace('duty_custom_', '')))) {
                  return false;
                }
                return true;
              });
              firestoreRepository.setDocData(this.currentSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
            }
          }

          // Xóa đồng bộ trên Cloud Firestore
          const safeDocId = (item.id || '').replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
          firestoreRepository.deleteDocData(this.currentSchoolId, 'assignments', safeDocId).catch(() => {});
        }
      }
      this.syncAllDepartmentDutiesAndAssignments();
      this.saveToStorage(true);
      this.setHasUnsavedChanges(true);

      const targetSchoolId = this.currentSchoolId || 'school_quyhop';
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(this.getScopedKey(STORAGE_KEYS.TEACHERS, targetSchoolId), JSON.stringify(this.teachers));
          localStorage.setItem(this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, targetSchoolId), JSON.stringify(this.assignments));
          localStorage.setItem(this.getScopedKey(STORAGE_KEYS.DEPARTMENTS, targetSchoolId), JSON.stringify(this.departments));
          localStorage.setItem(this.getScopedKey(STORAGE_KEYS.CLASSES, targetSchoolId), JSON.stringify(this.classes));
        } catch {}
      }
    }
    return count;
  }

  public bulkClearDutiesForTeachers(teacherIds?: string[]): number {
    const targetSchoolId = this.currentSchoolId || 'school_quyhop';
    const isAll = !teacherIds || teacherIds.length === 0 || teacherIds.includes('ALL');
    const targetTeacherList = isAll ? this.teachers : this.teachers.filter((t) => teacherIds.includes(t.id));
    const tSet = new Set(targetTeacherList.map((t) => t.id));

    // 1. Tìm tất cả phân công kiêm nhiệm / miễn giảm của các giáo viên này trên MỌI phiên bản
    const targetDutyAssignments = this.assignments.filter(
      (a) =>
        (isAll || tSet.has(a.teacherId)) &&
        !a.isDeleted &&
        (!a.type ||
          a.type === 'CONCURRENT' ||
          a.type === 'EXEMPTION' ||
          a.type === 'CONCURRENT_DUTY' ||
          Boolean(a.dutyId) ||
          Boolean(a.dutyName) ||
          a.session === 'ACTIVITY' ||
          (a.classId && this.classes.some((c) => c.id === a.classId && c.homeroomTeacherId === a.teacherId)))
    );

    const asgIds = new Set(targetDutyAssignments.map((a) => a.id));

    // 2. Xóa khỏi this.assignments
    this.assignments = this.assignments.filter((a) => !asgIds.has(a.id));

    // 3. Xóa các phân công này trên Cloud Firestore
    targetDutyAssignments.forEach((a) => {
      const safeDocId = (a.id || '').replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
      firestoreRepository.deleteDocData(targetSchoolId, 'assignments', safeDocId).catch(() => {});
    });

    // 4. Xóa sạch positions của các giáo viên này và cập nhật trên Firestore
    for (const teacher of targetTeacherList) {
      teacher.positions = [];
      if (teacher.status === 'PRINCIPAL' || teacher.status === 'VICE_PRINCIPAL') {
        teacher.status = 'ACTIVE';
        teacher.statusLabel = 'Đang giảng dạy';
        teacher.standardQuota = 19;
      }
      firestoreRepository.setDocData(targetSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
    }

    // 5. Thu hồi vai trò Tổ trưởng / Tổ phó trong Departments và lưu lên Firestore
    this.departments.forEach((dept) => {
      let deptChanged = false;
      if (dept.headTeacherId && (isAll || tSet.has(dept.headTeacherId))) {
        dept.headTeacherId = undefined;
        deptChanged = true;
      }
      if (dept.deputyTeacherId && (isAll || tSet.has(dept.deputyTeacherId))) {
        dept.deputyTeacherId = undefined;
        deptChanged = true;
      }
      if (Array.isArray(dept.deputyTeacherIds)) {
        const prevLen = dept.deputyTeacherIds.length;
        dept.deputyTeacherIds = isAll ? [] : dept.deputyTeacherIds.filter((id) => !tSet.has(id));
        if (dept.deputyTeacherIds.length !== prevLen) {
          dept.deputyTeacherId = dept.deputyTeacherIds[0] || undefined;
          deptChanged = true;
        }
      }
      if (deptChanged) {
        firestoreRepository.setDocData(targetSchoolId, 'departments', dept.id, dept).catch(() => {});
      }
    });

    // 6. Thu hồi vai trò Chủ nhiệm trong Classes và lưu lên Firestore
    this.classes.forEach((cls) => {
      if (cls.homeroomTeacherId && (isAll || tSet.has(cls.homeroomTeacherId))) {
        cls.homeroomTeacherId = undefined;
        firestoreRepository.setDocData(targetSchoolId, 'classes', cls.id, cls).catch(() => {});
      }
    });

    // 7. Ghi nhận nhật ký kiểm toán
    this.logAction({
      action: 'UPDATE',
      entityType: 'TEACHER',
      entityId: isAll ? 'ALL' : (teacherIds || []).join(','),
      entityDescription: `Xóa toàn bộ kiêm nhiệm của ${targetTeacherList.length} giáo viên (${targetDutyAssignments.length} phân công)`,
    });

    // 8. Đồng bộ và lưu ngay lập tức vào scoped localStorage
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage(true);
    this.setHasUnsavedChanges(true);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.TEACHERS, targetSchoolId), JSON.stringify(this.teachers));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, targetSchoolId), JSON.stringify(this.assignments));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.DEPARTMENTS, targetSchoolId), JSON.stringify(this.departments));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.CLASSES, targetSchoolId), JSON.stringify(this.classes));
      } catch {}
    }

    this.notify();
    return targetDutyAssignments.length;
  }

  /**
   * LỆNH XÓA SẠCH DỮ LIỆU VẬN HÀNH (GIÁO VIÊN, LỚP, PHÂN CÔNG, KIÊM NHIỆM) TRÊN CẢ LOCAL VÀ CLOUD
   * Sau khi xóa, mở phần mềm chỉ có sẵn:
   * - Danh mục kiêm nhiệm chuẩn (SpecialDuty)
   * - Danh mục môn học chuẩn (Subject)
   * - Khung phân phối tiết mặc định (Curriculum)
   * - Danh mục viết tắt (AbbreviationRule)
   * - Cơ cấu tổ chuyên môn và điểm trường sạch sẽ
   */
  public clearAllOperationalData(
    schoolId: string = this.currentSchoolId,
    clearCloud: boolean = true
  ): { success: boolean; message: string } {
    const sId = schoolId || this.currentSchoolId || 'school_quyhop';

    // 1. Làm sạch bộ nhớ
    this.teachers = [];
    this.classes = [];
    this.assignments = [];

    // Làm sạch chức vụ trong tổ chuyên môn
    this.departments.forEach((d) => {
      d.teacherIds = [];
      d.headTeacherId = undefined;
      d.deputyTeacherId = undefined;
      d.deputyTeacherIds = [];
    });

    // 2. Lưu trạng thái trắng vào scoped localStorage
    const scopedTeachersKey = this.getScopedKey(STORAGE_KEYS.TEACHERS, sId);
    const scopedClassesKey = this.getScopedKey(STORAGE_KEYS.CLASSES, sId);
    const scopedAssignmentsKey = this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, sId);
    const scopedDeptsKey = this.getScopedKey(STORAGE_KEYS.DEPARTMENTS, sId);

    this.setItem(scopedTeachersKey, []);
    this.setItem(scopedClassesKey, []);
    this.setItem(scopedAssignmentsKey, []);
    this.setItem(scopedDeptsKey, this.departments);

    if (sId === 'school_quyhop') {
      this.setItem(STORAGE_KEYS.TEACHERS, []);
      this.setItem(STORAGE_KEYS.CLASSES, []);
      this.setItem(STORAGE_KEYS.ASSIGNMENTS, []);
      this.setItem(STORAGE_KEYS.DEPARTMENTS, this.departments);
    }

    // Đánh dấu cờ dữ liệu đã xóa để không bao giờ tự động nạp lại demo
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pccm_data_cleared_${sId}`, 'true');
        localStorage.setItem('pccm_clean_slate_active', 'true');
      } catch {}
    }

    // 3. Xóa trên Cloud Firestore
    if (clearCloud) {
      firestoreRepository.clearSubCollection(sId, 'teachers').catch(() => {});
      firestoreRepository.clearSubCollection(sId, 'classes').catch(() => {});
      firestoreRepository.clearSubCollection(sId, 'assignments').catch(() => {});
      this.departments.forEach((d) => {
        firestoreRepository.setDocData(sId, 'departments', d.id, d).catch(() => {});
      });
    }

    this.saveLocalCacheOnly();
    this.notify();

    return {
      success: true,
      message: 'Đã xóa sạch toàn bộ dữ liệu Giáo viên, Lớp học và Phân công (cả kiêm nhiệm) trên máy và đám mây! Hệ thống đã về trạng thái ban đầu sạch sẽ, sẵn sàng sử dụng.',
    };
  }

  /**
   * ĐẨY CẤU TRÚC HỆ THỐNG LÊN CLOUD (Dành cho Quản trị viên tối cao)
   * Chỉ đồng bộ danh mục chuẩn (môn học, khung tiết, danh mục kiêm nhiệm, danh mục viết tắt)
   * KHÔNG đụng đến dữ liệu giáo viên, lớp, phân công của bất kỳ trường nào!
   */
  public async publishSystemSchemaToCloud(): Promise<{ success: boolean; message: string }> {
    try {
      const catalog = {
        schemaVersion: `v2026.10.24_${Date.now()}`,
        subjects: this.subjects,
        curriculum: this.curriculum,
        duties: this.duties,
        abbreviationRules: this.abbreviationRules,
        publishedAt: new Date().toISOString(),
        publishedBy: this.currentUser?.email || 'super_admin',
        notes: 'Cấu trúc hệ thống chuẩn: Môn học, Khung tiết GDPT 2018, Danh mục kiêm nhiệm và Quy tắc viết tắt',
      };
      await firestoreRepository.saveSystemCatalogTemplate(catalog);
      return {
        success: true,
        message: 'Đã đẩy Phiên bản Cấu trúc Hệ thống mới nhất lên Cloud thành công! Các trường được cấp quyền có thể bấm "Cập nhật hệ thống" để tải về.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Lỗi khi đẩy cấu trúc hệ thống lên Cloud',
      };
    }
  }

  /**
   * CẬP NHẬT HỆ THỐNG / PHIÊN BẢN MỚI (Dành cho trường được cấp quyền & tất cả các trường)
   * Tải về các thay đổi cấu trúc mới nhất (môn học mới, khung số tiết chuẩn, chức danh kiêm nhiệm, viết tắt)
   * TUYỆT ĐỐI KHÔNG GHI ĐÈ dữ liệu giáo viên, lớp học và phân công cá nhân của trường!
   */
  public async pullSystemSchemaFromCloud(): Promise<{ success: boolean; message: string; updatedItemsCount: number }> {
    let updatedCount = 0;
    try {
      const template = await firestoreRepository.getSystemCatalogTemplate();
      const targetSubjects = template?.subjects && template.subjects.length > 0 ? template.subjects : INITIAL_SUBJECTS;
      const targetCurriculum = template?.curriculum && template.curriculum.length > 0 ? template.curriculum : INITIAL_CURRICULUM;
      const targetDuties = template?.duties && template.duties.length > 0 ? template.duties : INITIAL_DUTIES;
      const targetAbbr = template?.abbreviationRules && template.abbreviationRules.length > 0 ? template.abbreviationRules : INITIAL_ABBREVIATION_RULES;

      // 1. Cập nhật / Bổ sung môn học mới mà trường chưa có
      const existingCodes = new Set(this.subjects.map((s) => this.canonicalSubjectCode(s.code || '')));
      const existingIds = new Set(this.subjects.map((s) => s.id));
      for (const sub of targetSubjects) {
        const canCode = this.canonicalSubjectCode(sub.code || '');
        if (!existingCodes.has(canCode) && !existingIds.has(sub.id)) {
          this.subjects.push({ ...sub });
          existingCodes.add(canCode);
          existingIds.add(sub.id);
          updatedCount++;
        }
      }
      this.subjects = this.deduplicateSubjectsList(this.subjects);

      // 2. Cập nhật / Bổ sung khung tiết chuẩn cho các môn chưa có
      for (const curr of targetCurriculum) {
        const hasCurr = this.curriculum.some(
          (c) => c.grade === curr.grade && c.subjectId === curr.subjectId && c.semesterId === curr.semesterId
        );
        if (!hasCurr) {
          this.curriculum.push({ ...curr });
          updatedCount++;
        }
      }

      // 3. Cập nhật / Bổ sung danh mục chức danh kiêm nhiệm chuẩn
      const existingDutyCodes = new Set(this.duties.map((d) => d.code));
      for (const duty of targetDuties) {
        if (!existingDutyCodes.has(duty.code)) {
          this.duties.push({ ...duty });
          existingDutyCodes.add(duty.code);
          updatedCount++;
        }
      }

      // 4. Bổ sung các quy tắc viết tắt mới
      const existingAbbrKeywords = new Set(this.abbreviationRules.map((a) => a.originalText.toLowerCase()));
      for (const rule of targetAbbr) {
        if (!existingAbbrKeywords.has(rule.originalText.toLowerCase())) {
          this.abbreviationRules.push({ ...rule });
          existingAbbrKeywords.add(rule.originalText.toLowerCase());
          updatedCount++;
        }
      }

      // 5. Lưu lại cho trường hiện tại
      this.saveToStorage(true);
      this.notify();

      return {
        success: true,
        updatedItemsCount: updatedCount,
        message: `Đã cập nhật cấu trúc hệ thống thành công (${updatedCount} danh mục mới được bổ sung)! Toàn bộ dữ liệu Giáo viên, Lớp học và Phân công của trường được bảo lưu trọn vẹn 100%.`,
      };
    } catch (err: any) {
      // Fallback: update from code standard
      this.upgradeTenantStandardCatalog(this.currentSchoolId);
      this.saveToStorage(true);
      this.notify();
      return {
        success: true,
        updatedItemsCount: 1,
        message: 'Đã nâng cấp cấu trúc môn học và danh mục chuẩn từ phiên bản mã nguồn mới nhất! Dữ liệu của trường an toàn 100%.',
      };
    }
  }

  /**
   * HỦY GÁN NHIỆM VỤ KIÊM NHIỆM CHO GIÁO VIÊN (TỪ GỐC KIÊM NHIỆM).
   * Xóa triệt để TẤT CẢ các bản ghi phân công của nhiệm vụ này đối với giáo viên (bao gồm cả các bản sao trùng lặp),
   * đồng thời tự động đồng bộ gỡ bỏ khỏi teacher.positions, departments và classes cả trên Firestore và Storage.
   */
  public unassignDutyFromTeacher(
    dutyIdOrCodeOrName: string,
    teacherId: string,
    versionId?: string
  ): number {
    if (!dutyIdOrCodeOrName || !teacherId) return 0;

    const targetSchoolId = this.currentSchoolId || 'school_quyhop';
    const targetVerId = versionId || this.currentVersionId || this.versions[0]?.id;
    const targetClean = dutyIdOrCodeOrName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const targetNorm = normalizePositionName(targetClean).toLowerCase();

    const isHead = this.isHeadDepartmentDuty(dutyIdOrCodeOrName, dutyIdOrCodeOrName);
    const isDep = this.isDeputyDepartmentDuty(dutyIdOrCodeOrName, dutyIdOrCodeOrName);

    const matchesDuty = (a: TeachingAssignment) => {
      if (a.teacherId !== teacherId) return false;
      if (versionId && a.versionId && a.versionId !== targetVerId) return false;
      if (isHead && this.isHeadDepartmentDuty(a.dutyId, a.dutyName)) return true;
      if (isDep && this.isDeputyDepartmentDuty(a.dutyId, a.dutyName)) return true;
      if (a.dutyId && (a.dutyId.toLowerCase() === targetClean || a.dutyId.toLowerCase() === targetNorm)) return true;
      const aClean = (a.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const aNorm = normalizePositionName(aClean).toLowerCase();
      if (aNorm && (aNorm === targetNorm || aClean === targetClean)) return true;
      if (targetClean && (aClean.includes(targetClean) || targetClean.includes(aClean))) return true;
      return false;
    };

    const toDelete = this.assignments.filter(matchesDuty);
    const count = toDelete.length;

    const toDeleteIds = new Set(toDelete.map((a) => a.id));
    this.assignments = this.assignments.filter((a) => !toDeleteIds.has(a.id));

    // Xóa trên Cloud Firestore
    for (const a of toDelete) {
      const safeDocId = (a.id || '').replace(/[\/\\]+/g, '_').replace(/[:\s]+/g, '_');
      firestoreRepository.deleteDocData(targetSchoolId, 'assignments', safeDocId).catch(() => {});
    }

    // Xóa vị trí trong teacher.positions
    const teacher = this.teachers.find((t) => t.id === teacherId);
    if (teacher && Array.isArray(teacher.positions)) {
      teacher.positions = teacher.positions.filter((p) => {
        const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const normP = normalizePositionName(cleanP).toLowerCase();
        if (normP === targetNorm || cleanP === targetClean || cleanP.includes(targetClean) || targetClean.includes(cleanP)) {
          return false;
        }
        return true;
      });
      firestoreRepository.setDocData(targetSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
    }

    // Nếu là Tổ trưởng / Tổ phó, dọn sạch trong departments
    if (isHead) {
      this.departments.forEach((dept) => {
        if (dept.headTeacherId === teacherId) {
          dept.headTeacherId = undefined;
          firestoreRepository.setDocData(targetSchoolId, 'departments', dept.id, dept).catch(() => {});
        }
      });
    }
    if (isDep) {
      this.departments.forEach((dept) => {
        if (dept.deputyTeacherId === teacherId || (Array.isArray(dept.deputyTeacherIds) && dept.deputyTeacherIds.includes(teacherId))) {
          dept.deputyTeacherIds = (dept.deputyTeacherIds || []).filter((id) => id !== teacherId);
          dept.deputyTeacherId = dept.deputyTeacherIds[0] || undefined;
          firestoreRepository.setDocData(targetSchoolId, 'departments', dept.id, dept).catch(() => {});
        }
      });
    }

    // Nếu là Chủ nhiệm lớp, dọn sạch trong classes
    if (targetClean.includes('chủ nhiệm') || targetClean === 'chu_nhiem' || dutyIdOrCodeOrName.toLowerCase().includes('chủ nhiệm')) {
      this.classes.forEach((cls) => {
        if (cls.homeroomTeacherId === teacherId) {
          if (targetClean.includes(cls.name.toLowerCase()) || targetClean.includes('chủ nhiệm')) {
            cls.homeroomTeacherId = undefined;
            firestoreRepository.setDocData(targetSchoolId, 'classes', cls.id, cls).catch(() => {});
          }
        }
      });
    }

    // Đồng bộ lại tất cả modules từ gốc Kiêm nhiệm
    this.syncDutyAssignmentsToAllModules(targetSchoolId, targetVerId);

    this.logAction({
      action: 'DELETE',
      entityType: 'ASSIGNMENT',
      entityId: Array.from(toDeleteIds).join(',') || `duty_${dutyIdOrCodeOrName}_${teacherId}`,
      entityDescription: `Hủy gán nhiệm vụ kiêm nhiệm "${dutyIdOrCodeOrName}" của giáo viên ${teacher?.fullName || teacherId}`,
    });

    this.saveToStorage(true);
    this.setHasUnsavedChanges(true);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.TEACHERS, targetSchoolId), JSON.stringify(this.teachers));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.ASSIGNMENTS, targetSchoolId), JSON.stringify(this.assignments));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.DEPARTMENTS, targetSchoolId), JSON.stringify(this.departments));
        localStorage.setItem(this.getScopedKey(STORAGE_KEYS.CLASSES, targetSchoolId), JSON.stringify(this.classes));
      } catch {}
    }

    this.notify();
    return count > 0 ? count : 1;
  }

  public bulkAssignDutiesToTeachers(
    teacherIds: string[],
    dutyId: string,
    dutyName: string,
    periods: number,
    type: 'CONCURRENT' | 'EXEMPTION',
    schoolYearId: string,
    semesterId: SemesterId,
    versionId: string,
    notes?: string
  ): number {
    const weeks = semesterId === 'HK1' ? 18 : 17;
    const cleanDutyName = dutyName.replace(/\s*\([^)]*\)/g, '').trim();
    const canonicalPos = normalizePositionName(cleanDutyName);
    const normCanonical = canonicalPos.toLowerCase();

    // Tìm duty định nghĩa chuẩn để lấy id và tên chuẩn
    const matchedDuty = this.duties.find(
      (d) =>
        d.id === dutyId ||
        d.code === dutyId ||
        normalizePositionName(d.name).toLowerCase() === normCanonical ||
        d.name.toLowerCase() === cleanDutyName.toLowerCase()
    );
    const finalDutyId = matchedDuty?.id || dutyId;
    const finalDutyName = matchedDuty?.name || cleanDutyName;

    let assignedOrUpdatedCount = 0;
    const assignmentsToAdd: Omit<TeachingAssignment, 'id' | 'createdAt' | 'createdBy'>[] = [];

    teacherIds.forEach((tId) => {
      const teacher = this.teachers.find((t) => t.id === tId);
      if (teacher) {
        if (!Array.isArray(teacher.positions)) teacher.positions = [];
        // Xóa mọi biến thể cũ của cùng nhiệm vụ này trong teacher.positions để tránh lặp
        teacher.positions = teacher.positions.filter((p) => {
          const pNorm = normalizePositionName(p.replace(/\s*\([^)]*\)/g, '').trim()).toLowerCase();
          return pNorm !== normCanonical && !pNorm.includes(normCanonical) && !normCanonical.includes(pNorm);
        });
        const formattedPos = periods > 0 ? `${canonicalPos} (${periods} tiết/tuần)` : canonicalPos;
        teacher.positions.push(formattedPos);
        firestoreRepository.setDocData(this.currentSchoolId, 'teachers', teacher.id, teacher).catch(() => {});
      }

      // Kiểm tra xem giáo viên này ĐÃ CÓ phân công nhiệm vụ này trong versionId chưa
      const existing = this.assignments.find((a) => {
        if (a.isDeleted || a.versionId !== versionId || a.teacherId !== tId) return false;
        if (a.dutyId && (a.dutyId === dutyId || a.dutyId === finalDutyId)) return true;
        const aNorm = normalizePositionName((a.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim()).toLowerCase();
        if (aNorm && (aNorm === normCanonical || aNorm === normalizePositionName(finalDutyName).toLowerCase())) return true;
        const aRaw = (a.dutyName || '').toLowerCase();
        if (aRaw.includes(cleanDutyName.toLowerCase()) || cleanDutyName.toLowerCase().includes(aRaw)) return true;
        return false;
      });

      if (existing) {
        // Cập nhật bản ghi hiện tại - TUYỆT ĐỐI KHÔNG TẠO DÒNG TRÙNG LẶP
        existing.periodsPerWeek = periods;
        existing.weeks = weeks;
        existing.totalPeriods = periods * weeks;
        existing.dutyId = finalDutyId;
        existing.dutyName = finalDutyName;
        existing.type = type === 'EXEMPTION' ? 'EXEMPTION' : 'CONCURRENT';
        existing.session = 'ACTIVITY';
        existing.status = 'approved';
        existing.isDeleted = false;
        if (notes) existing.notes = notes;
        assignedOrUpdatedCount++;
      } else {
        assignmentsToAdd.push({
          schoolId: this.currentSchoolId,
          schoolYearId,
          semesterId,
          versionId,
          teacherId: tId,
          departmentId: teacher?.departmentId || '',
          type: type === 'EXEMPTION' ? 'EXEMPTION' : 'CONCURRENT',
          dutyId: finalDutyId,
          dutyName: finalDutyName,
          session: 'ACTIVITY',
          periodsPerWeek: periods,
          weeks,
          totalPeriods: periods * weeks,
          status: 'approved',
          notes: notes || `Gán kiêm nhiệm: ${finalDutyName}`,
        });
      }

      // Tự động đồng bộ sang Danh mục lớp nếu nhiệm vụ là GVCN
      if (finalDutyId === 'duty_chu_nhiem' || normCanonical.includes('chủ nhiệm') || cleanDutyName.toLowerCase().includes('chủ nhiệm')) {
        const textToScan = `${cleanDutyName} ${notes || ''}`.toLowerCase();
        for (const cls of this.classes) {
          if (cls.isDeleted) continue;
          const cleanCls = cls.name.toLowerCase().replace(/^(lớp|lop)\s*/i, '').trim();
          if (textToScan.includes(cls.name.toLowerCase()) || (cleanCls && textToScan.includes(cleanCls))) {
            cls.homeroomTeacherId = tId;
            firestoreRepository.setDocData(this.currentSchoolId, 'classes', cls.id, cls).catch(() => {});
            break;
          }
        }
      }

      // Tự động đồng bộ sang Tổ chuyên môn nếu là Tổ trưởng
      if (this.isHeadDepartmentDuty(finalDutyId, finalDutyName)) {
        if (teacher?.departmentId) {
          const dept = this.departments.find((d) => d.id === teacher.departmentId);
          if (dept) {
            dept.headTeacherId = tId;
            firestoreRepository.setDocData(this.currentSchoolId, 'departments', dept.id, dept).catch(() => {});
          }
        }
      }

      // Tự động đồng bộ sang Tổ chuyên môn nếu là Tổ phó
      if (this.isDeputyDepartmentDuty(finalDutyId, finalDutyName)) {
        if (teacher?.departmentId) {
          const dept = this.departments.find((d) => d.id === teacher.departmentId);
          if (dept) {
            if (!Array.isArray(dept.deputyTeacherIds)) dept.deputyTeacherIds = [];
            if (!dept.deputyTeacherIds.includes(tId)) {
              dept.deputyTeacherIds.push(tId);
              dept.deputyTeacherId = dept.deputyTeacherIds[0];
            }
            firestoreRepository.setDocData(this.currentSchoolId, 'departments', dept.id, dept).catch(() => {});
          }
        }
      }
    });

    if (assignmentsToAdd.length > 0) {
      this.addAssignments(assignmentsToAdd);
      assignedOrUpdatedCount += assignmentsToAdd.length;
    }

    this.deduplicateDutyAssignments();
    this.syncAllDepartmentDutiesAndAssignments();
    this.saveToStorage();
    return assignedOrUpdatedCount;
  }

  // FEEDBACK
  public submitFeedback(feedback: Omit<FeedbackRequest, 'id' | 'createdAt' | 'status'>): FeedbackRequest {
    const newFeedback: FeedbackRequest = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...feedback,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    };
    this.feedbacks.unshift(newFeedback);
    this.saveToStorage();
    return newFeedback;
  }

  public replyFeedback(id: string, reply: string, status: 'ACCEPTED' | 'REJECTED'): boolean {
    const item = this.feedbacks.find((f) => f.id === id);
    if (!item) return false;
    item.adminReply = reply;
    item.status = status;
    item.repliedAt = new Date().toISOString();
    this.saveToStorage();
    return true;
  }

  // BACKUP & RESTORE
  public createBackup(title?: string): SystemBackup {
    const nowIso = new Date().toISOString();
    const currentSchoolId = this.currentSchoolId || 'school_quyhop';
    const currentSchoolName = this.getCurrentSchoolLicense()?.schoolName || this.schoolInfo.schoolName || 'TRƯỜNG HỌC';
    const signature = generateBackupDataSignature(currentSchoolId, currentSchoolName, nowIso);

    const backup: SystemBackup = {
      id: `backup_${Date.now()}`,
      title: title || `Bản sao lưu ${new Date().toLocaleString('vi-VN')}`,
      createdAt: nowIso,
      createdBy: this.currentUser?.name || 'Quản trị viên',
      versionCount: this.versions.length,
      teacherCount: this.teachers.length,
      assignmentCount: this.assignments.length,
      tenantId: currentSchoolId,
      schoolName: currentSchoolName,
      signature,
      dataJson: JSON.stringify({
        tenantId: currentSchoolId,
        schoolName: currentSchoolName,
        signature,
        schoolInfo: this.schoolInfo,
        schoolYears: this.schoolYears,
        versions: this.versions,
        branches: this.branches,
        workplaces: this.workplaces,
        departments: this.departments,
        duties: this.duties,
        classes: this.classes,
        subjects: this.subjects,
        curriculum: this.curriculum,
        teachers: this.teachers,
        assignments: this.assignments,
        feedbacks: this.feedbacks,
        abbreviationRules: this.abbreviationRules,
        currentSchoolYearId: this.currentSchoolYearId,
        currentSemesterId: this.currentSemesterId,
        currentVersionId: this.currentVersionId,
      }),
    };
    this.backups.unshift(backup);
    this.saveToStorage();
    return backup;
  }

  public restoreBackup(backupId: string): { success: boolean; message?: string } {
    const backup = this.backups.find((b) => b.id === backupId);
    if (!backup) return { success: false, message: 'Không tìm thấy bản sao lưu.' };

    const currentSchoolId = this.currentSchoolId || 'school_quyhop';
    const currentSchoolName = this.getCurrentSchoolLicense()?.schoolName || this.schoolInfo.schoolName || 'TRƯỜNG HỌC';
    const isSuperAdmin = this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email);

    let backupSchoolId = backup.tenantId;
    let backupSchoolName = backup.schoolName;

    try {
      const data = JSON.parse(backup.dataJson);
      if (!backupSchoolId && data.tenantId) backupSchoolId = data.tenantId;
      if (!backupSchoolName && data.schoolName) backupSchoolName = data.schoolName;
      if (!backupSchoolName && data.schoolInfo?.schoolName) backupSchoolName = data.schoolInfo.schoolName;

      // MỤC 3: KIỂM TRA CHỐNG NẠP CHÉO GIỮA CÁC TRƯỜNG (ANTI CROSS-IMPORT)
      const integrity = verifyImportTenantIntegrity({
        currentActiveSchoolId: currentSchoolId,
        currentActiveSchoolName: currentSchoolName,
        backupSchoolId,
        backupSchoolName,
        isSuperAdmin,
      });

      if (!integrity.allowed) {
        return { success: false, message: integrity.reason };
      }

      // MỤC 2: KIỂM TRA HẠN MỨC QUY MÔ TRƯỜNG HỌC KHI PHỤC HỒI
      const currentLic = this.getCurrentSchoolLicense();
      if (!isSuperAdmin && currentLic) {
        const teachersInBackup = Array.isArray(data.teachers) ? data.teachers.length : 0;
        const classesInBackup = Array.isArray(data.classes) ? data.classes.length : 0;
        const quota = checkSchoolQuota({
          license: currentLic,
          currentTeachersCount: teachersInBackup,
          currentClassesCount: classesInBackup,
        });
        if (!quota.allowed) {
          return { success: false, message: quota.message };
        }
      }

      if (data.schoolInfo) {
        this.schoolInfo = {
          ...data.schoolInfo,
          schoolName: currentSchoolName, // Khóa cứng tên trường đã cấp phép
        };
      }
      if (data.schoolYears) this.schoolYears = data.schoolYears;
      if (data.versions) this.versions = data.versions;
      if (data.branches) this.branches = data.branches;
      if (data.workplaces) this.workplaces = data.workplaces;
      if (data.departments) this.departments = data.departments;
      if (data.duties) this.duties = data.duties;
      if (data.classes) this.classes = data.classes;
      if (data.subjects) this.subjects = data.subjects;
      if (data.curriculum) this.curriculum = data.curriculum;
      if (data.teachers) this.teachers = data.teachers;
      if (data.assignments) this.assignments = data.assignments;
      if (data.feedbacks) this.feedbacks = data.feedbacks;
      if (data.abbreviationRules) this.abbreviationRules = data.abbreviationRules;
      if (data.currentSchoolYearId) this.currentSchoolYearId = data.currentSchoolYearId;
      if (data.currentSemesterId) this.currentSemesterId = data.currentSemesterId;
      if (data.currentVersionId) this.currentVersionId = data.currentVersionId;

      this.syncAllDepartmentDutiesAndAssignments();

      this.logAction({
        action: 'RESTORE',
        entityType: 'VERSION',
        entityId: backupId,
        entityDescription: `Phục hồi toàn bộ hệ thống từ bản sao lưu: ${backup.title}`,
      });

      this.saveToStorage();
      return { success: true, message: `Phục hồi dữ liệu thành công từ bản sao lưu: ${backup.title}` };
    } catch (e: any) {
      console.error('Failed to restore backup', e);
      return { success: false, message: e?.message || 'Lỗi khi phục hồi bản sao lưu' };
    }
  }

  public deleteBackup(backupId: string): boolean {
    const index = this.backups.findIndex((b) => b.id === backupId);
    if (index === -1) return false;
    const deleted = this.backups.splice(index, 1)[0];
    this.logAction({
      action: 'DELETE',
      entityType: 'VERSION',
      entityId: backupId,
      entityDescription: `Xóa bản sao lưu: ${deleted.title}`,
    });
    this.saveToStorage();
    return true;
  }

  public importBackupFile(backup: SystemBackup): { success: boolean; message?: string } {
    if (!backup || !backup.dataJson) return { success: false, message: 'Dữ liệu file sao lưu không hợp lệ.' };

    const currentSchoolId = this.currentSchoolId || 'school_quyhop';
    const currentSchoolName = this.getCurrentSchoolLicense()?.schoolName || this.schoolInfo.schoolName || 'TRƯỜNG HỌC';
    const isSuperAdmin = this.currentUser?.isSuperAdmin || isSuperAdminEmail(this.currentUser?.email);

    let backupSchoolId = backup.tenantId;
    let backupSchoolName = backup.schoolName;

    try {
      const data = JSON.parse(backup.dataJson);
      if (!backupSchoolId && data.tenantId) backupSchoolId = data.tenantId;
      if (!backupSchoolName && data.schoolName) backupSchoolName = data.schoolName;
      if (!backupSchoolName && data.schoolInfo?.schoolName) backupSchoolName = data.schoolInfo.schoolName;
    } catch {}

    // MỤC 3: KIỂM TRA CHỐNG NẠP CHÉO
    const integrity = verifyImportTenantIntegrity({
      currentActiveSchoolId: currentSchoolId,
      currentActiveSchoolName: currentSchoolName,
      backupSchoolId,
      backupSchoolName,
      isSuperAdmin,
    });

    if (!integrity.allowed) {
      return { success: false, message: integrity.reason };
    }

    backup.tenantId = backupSchoolId || currentSchoolId;
    backup.schoolName = backupSchoolName || currentSchoolName;

    const existing = this.backups.findIndex((b) => b.id === backup.id);
    if (existing >= 0) {
      this.backups[existing] = backup;
    } else {
      this.backups.unshift(backup);
    }
    this.saveToStorage();
    return { success: true };
  }

  public importSystemData(jsonString: string, mode: 'REPLACE' | 'MERGE'): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (mode === 'REPLACE') {
        if (data.schoolYears) this.schoolYears = data.schoolYears;
        if (data.versions) this.versions = data.versions;
        if (data.departments) this.departments = data.departments;
        if (data.duties) this.duties = data.duties;
        if (data.classes) this.classes = data.classes;
        if (data.subjects) this.subjects = data.subjects;
        if (data.curriculum) this.curriculum = data.curriculum;
        if (data.teachers) this.teachers = data.teachers;
        if (data.assignments) this.assignments = data.assignments;
        if (data.abbreviationRules) this.abbreviationRules = data.abbreviationRules;
      }
      this.syncAllDepartmentDutiesAndAssignments();
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // DANH MỤC VIẾT TẮT (ABBREVIATION RULES)
  // =========================================================================
  public getAbbreviationRules(onlyActive = false): AbbreviationRule[] {
    const list = [...this.abbreviationRules];
    if (onlyActive) {
      return list.filter((r) => r.isActive !== false);
    }
    return list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  public getAbbreviationRuleById(id: string): AbbreviationRule | undefined {
    return this.abbreviationRules.find((r) => r.id === id);
  }

  public saveAbbreviationRule(
    ruleData: Partial<AbbreviationRule> & {
      originalText: string;
      abbreviatedText: string;
      category: AbbreviationCategory;
    }
  ): AbbreviationRule {
    const trimmedOriginal = ruleData.originalText.trim();
    const trimmedAbbr = ruleData.abbreviatedText.trim();

    // Chuẩn hóa danh sách biến thể tham chiếu (aliases)
    const rawAliases = Array.isArray(ruleData.aliases) ? ruleData.aliases : [];
    const cleanAliases = Array.from(
      new Set(
        rawAliases
          .map((a) => (typeof a === 'string' ? a.trim() : ''))
          .filter((a) => a && a.toLowerCase() !== trimmedOriginal.toLowerCase())
      )
    );

    if (ruleData.id) {
      const idx = this.abbreviationRules.findIndex((r) => r.id === ruleData.id);
      if (idx !== -1) {
        const existing = this.abbreviationRules[idx];
        const updated: AbbreviationRule = {
          ...existing,
          ...ruleData,
          originalText: trimmedOriginal,
          abbreviatedText: trimmedAbbr,
          aliases: cleanAliases.length > 0 ? cleanAliases : existing.aliases || [],
          isActive: ruleData.isActive !== undefined ? ruleData.isActive : existing.isActive,
        };
        this.abbreviationRules[idx] = updated;
        this.logAction({
          action: 'UPDATE',
          entityType: 'DUTY',
          entityId: updated.id,
          entityDescription: `Cập nhật từ viết tắt: "${trimmedOriginal}" -> "${trimmedAbbr}"`,
          beforeData: existing,
          afterData: updated,
        });
        this.saveToStorage();
        return updated;
      }
    }

    // New rule
    const newRule: AbbreviationRule = {
      id: `abbr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      originalText: trimmedOriginal,
      abbreviatedText: trimmedAbbr,
      category: ruleData.category,
      aliases: cleanAliases,
      description: ruleData.description?.trim(),
      isSystem: false,
      isActive: ruleData.isActive !== false,
      order: this.abbreviationRules.length + 1,
    };
    this.abbreviationRules.push(newRule);
    this.logAction({
      action: 'CREATE',
      entityType: 'DUTY',
      entityId: newRule.id,
      entityDescription: `Thêm từ viết tắt mới: "${trimmedOriginal}" -> "${trimmedAbbr}" (${newRule.category})`,
      afterData: newRule,
    });
    this.saveToStorage();
    return newRule;
  }

  public deleteAbbreviationRule(id: string): boolean {
    const idx = this.abbreviationRules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    const removed = this.abbreviationRules[idx];
    this.abbreviationRules.splice(idx, 1);
    this.logAction({
      action: 'DELETE',
      entityType: 'DUTY',
      entityId: id,
      entityDescription: `Xóa quy tắc viết tắt: "${removed.originalText}" -> "${removed.abbreviatedText}"`,
      beforeData: removed,
    });
    this.saveToStorage();
    return true;
  }

  public deleteMultipleAbbreviationRules(ids: string[]): number {
    const idSet = new Set(ids);
    const beforeCount = this.abbreviationRules.length;
    this.abbreviationRules = this.abbreviationRules.filter((r) => !idSet.has(r.id));
    const deletedCount = beforeCount - this.abbreviationRules.length;
    if (deletedCount > 0) {
      this.logAction({
        action: 'DELETE',
        entityType: 'DUTY',
        entityId: 'batch_delete_abbr',
        entityDescription: `Xóa hàng loạt ${deletedCount} quy tắc viết tắt`,
      });
      this.saveToStorage();
    }
    return deletedCount;
  }

  public toggleAbbreviationRule(id: string): boolean {
    const rule = this.abbreviationRules.find((r) => r.id === id);
    if (!rule) return false;
    rule.isActive = !rule.isActive;
    this.saveToStorage();
    return true;
  }

  public resetAbbreviationRulesToDefault(): void {
    this.abbreviationRules = [...INITIAL_ABBREVIATION_RULES];
    this.logAction({
      action: 'SEED_RESET',
      entityType: 'DUTY',
      entityId: 'abbr_rules_reset',
      entityDescription: 'Khôi phục danh mục từ viết tắt về mặc định',
    });
  }

  /**
   * Chuẩn hóa mã môn học về mã chuẩn hệ thống (tránh xung đột LS_DL với LICH_SU_DIA_LI, KHTN, v.v.)
   */
  public canonicalSubjectCode(rawCode: string): string {
    const c = (rawCode || '').trim().toUpperCase();
    if (c === 'LS_DL' || c === 'SU_DIA' || c === 'LICH_SU_VA_DIA_LY' || c === 'LICH_SU_DIA_LY') return 'LICH_SU_DIA_LI';
    if (c === 'KHOA_HOC_TU_NHIEN') return 'KHTN';
    if (c === 'NGHE_THUAT_AN' || c === 'NHAC') return 'AM_NHAC';
    if (c === 'NGHE_THUAT_MT' || c === 'MI_THUAT' || c === 'VE') return 'MY_THUAT';
    if (c === 'HDTN' || c === 'HDTN_HN' || c === 'HOAT_DONG_TRAI_NGHIEM') return 'HDKT_HN';
    if (c === 'GDDP') return 'NOI_DUNG_GDDP';
    return c;
  }

  /**
   * Khử trùng lặp danh mục môn học: Đảm bảo mỗi môn học có ID duy nhất, mã môn duy nhất,
   * loại bỏ triệt để tình trạng hai phần tử con có cùng key (ví dụ: sub_ls_dl).
   */
  public deduplicateSubjectsList(subjectsList: Subject[]): Subject[] {
    if (!Array.isArray(subjectsList) || subjectsList.length === 0) return [];

    const seenIds = new Set<string>();
    const seenCodes = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueList: Subject[] = [];

    for (const sub of subjectsList) {
      if (!sub) continue;
      const id = String(sub.id || '').trim();
      if (!id) continue;
      const canCode = this.canonicalSubjectCode(sub.code || '');
      const normName = String(sub.name || '').trim().toLowerCase();

      // Kiểm tra trùng ID
      if (seenIds.has(id)) {
        continue;
      }

      // Kiểm tra trùng Mã môn chuẩn
      if (canCode && seenCodes.has(canCode)) {
        continue;
      }

      // Kiểm tra trùng tên đối với các môn tích hợp gốc (Lịch sử và Địa lí, Khoa học tự nhiên)
      if (normName === 'lịch sử và địa lí' || normName === 'khoa học tự nhiên') {
        if (seenNames.has(normName)) {
          continue;
        }
      }

      seenIds.add(id);
      if (canCode) seenCodes.add(canCode);
      if (normName) seenNames.add(normName);
      uniqueList.push(sub);
    }

    return uniqueList;
  }

  public deduplicateSubjects(): number {
    const beforeCount = this.subjects.length;
    this.subjects = this.deduplicateSubjectsList(this.subjects);
    const removedCount = beforeCount - this.subjects.length;
    if (removedCount > 0) {
      this.saveLocalCacheOnly();
      this.notify();
    }
    return removedCount;
  }

  /**
   * Khử trùng lặp danh mục viết tắt: Mỗi nhiệm vụ chỉ định nghĩa 1 lần duy nhất,
   * tự động gộp các biến thể trùng lặp vào trường `aliases` áp dụng cho tất cả tham chiếu.
   */
  public deduplicateAbbreviationRules(): { beforeCount: number; afterCount: number; mergedCount: number } {
    const beforeCount = this.abbreviationRules.length;
    if (beforeCount === 0) {
      return { beforeCount: 0, afterCount: 0, mergedCount: 0 };
    }

    // Gộp và khử trùng lặp CHỈ trên danh sách quy tắc hiện có (không hồi sinh quy tắc mà người dùng đã xóa)
    const canonicalList: AbbreviationRule[] = [];

    for (const rule of this.abbreviationRules) {
      if (!rule || !rule.originalText || !rule.abbreviatedText) continue;
      const normOrig = rule.originalText.trim().toLowerCase();
      const normAbbr = rule.abbreviatedText.trim().toUpperCase();

      // Tìm xem đã có quy tắc nào trong canonicalList đại diện cho cùng nhiệm vụ/khái niệm này chưa
      const existingCanon = canonicalList.find((c) => {
        if (c.id === rule.id) return true;
        if (c.category !== rule.category && c.category !== 'GENERAL' && rule.category !== 'GENERAL') {
          return false;
        }
        // Trùng cụm từ gốc
        if (c.originalText.trim().toLowerCase() === normOrig) return true;
        // Cụm từ gốc trùng với bất kỳ alias nào của c
        if (c.aliases && c.aliases.some((al) => al.trim().toLowerCase() === normOrig)) return true;
        // Bất kỳ alias nào của rule trùng với cụm từ gốc của c
        if (rule.aliases && rule.aliases.some((al) => al.trim().toLowerCase() === c.originalText.trim().toLowerCase())) return true;
        // Cùng phân loại và cùng ký hiệu viết tắt
        if (c.category === rule.category && c.abbreviatedText.trim().toUpperCase() === normAbbr) return true;
        return false;
      });

      if (existingCanon) {
        // Gộp vào existingCanon: gộp các biến thể tham chiếu
        const aliasSet = new Set<string>((existingCanon.aliases || []).map((a) => a.trim()));
        if (rule.originalText.trim().toLowerCase() !== existingCanon.originalText.trim().toLowerCase()) {
          aliasSet.add(rule.originalText.trim());
        }
        if (rule.aliases && Array.isArray(rule.aliases)) {
          rule.aliases.forEach((a) => {
            if (a && a.trim() && a.trim().toLowerCase() !== existingCanon.originalText.trim().toLowerCase()) {
              aliasSet.add(a.trim());
            }
          });
        }
        existingCanon.aliases = Array.from(aliasSet);
        if (rule.isActive === false && !existingCanon.isSystem) {
          existingCanon.isActive = false;
        }
        if (rule.description && !existingCanon.description) {
          existingCanon.description = rule.description;
        }
      } else {
        // Thêm mới vào danh sách canonical
        canonicalList.push({
          ...rule,
          originalText: rule.originalText.trim(),
          abbreviatedText: rule.abbreviatedText.trim(),
          aliases: rule.aliases ? Array.from(new Set(rule.aliases.map((a) => a.trim()).filter(Boolean))) : [],
        });
      }
    }

    // Bổ sung alias mới nhất từ INITIAL_ABBREVIATION_RULES cho các quy tắc chuẩn hệ thống
    INITIAL_ABBREVIATION_RULES.forEach((initRule) => {
      const matched = canonicalList.find(
        (c) =>
          c.id === initRule.id ||
          (c.category === initRule.category && c.abbreviatedText.trim().toUpperCase() === initRule.abbreviatedText.trim().toUpperCase()) ||
          c.originalText.trim().toLowerCase() === initRule.originalText.trim().toLowerCase()
      );
      if (matched && initRule.aliases && Array.isArray(initRule.aliases)) {
        const aliasSet = new Set<string>((matched.aliases || []).map((a) => a.trim()));
        initRule.aliases.forEach((a) => {
          if (a && a.trim() && a.trim().toLowerCase() !== matched.originalText.trim().toLowerCase()) {
            aliasSet.add(a.trim());
          }
        });
        matched.aliases = Array.from(aliasSet);
      }
    });

    canonicalList.forEach((r, idx) => {
      r.order = idx + 1;
    });

    this.abbreviationRules = canonicalList;
    const afterCount = this.abbreviationRules.length;
    const mergedCount = Math.max(0, beforeCount - afterCount);

    this.saveToStorage();
    return { beforeCount, afterCount, mergedCount };
  }

  /**
   * Tự động quét từ danh sách Giáo viên, Nhiệm vụ kiêm nhiệm, và Môn học hiện có.
   * Nếu đã có quy tắc tương ứng (kể cả biến thể tham chiếu), không tạo trùng lặp mà cập nhật vào aliases.
   */
  public autoDiscoverAbbreviationRules(): { discoveredCount: number; addedRules: AbbreviationRule[] } {
    const isAlreadyDefined = (text: string): AbbreviationRule | undefined => {
      const norm = text.trim().toLowerCase();
      for (const r of this.abbreviationRules) {
        if (r.originalText.trim().toLowerCase() === norm) return r;
        if (r.aliases && r.aliases.some((a) => a.trim().toLowerCase() === norm)) return r;
      }
      return undefined;
    };

    const added: AbbreviationRule[] = [];

    // 1. Quét từ teacher.positions
    this.teachers.forEach((t) => {
      if (t.positions && Array.isArray(t.positions)) {
        t.positions.forEach((pos) => {
          const cleanPos = pos.replace(/\s*\([^)]*\)/g, '').trim();
          const trimmed = cleanPos || pos.trim();
          if (!trimmed) return;

          const existing = isAlreadyDefined(trimmed);
          if (existing) {
            // Đã có định nghĩa, bổ sung vào aliases nếu chưa có
            if (existing.originalText.toLowerCase() !== trimmed.toLowerCase()) {
              const aliases = existing.aliases || [];
              if (!aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
                existing.aliases = [...aliases, trimmed];
              }
            }
          } else {
            const words = trimmed.split(/\s+/).filter(Boolean);
            let suggestedAbbr = words.map((w) => w[0]?.toUpperCase()).join('');
            if (words.length === 1 && trimmed.length <= 4) suggestedAbbr = trimmed;
            const newRule: AbbreviationRule = {
              id: `abbr_disc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              originalText: trimmed,
              abbreviatedText: suggestedAbbr,
              category: 'DUTY',
              aliases: [],
              description: `Tự động trích xuất từ hồ sơ GV (${t.fullName})`,
              isSystem: false,
              isActive: true,
              order: this.abbreviationRules.length + added.length + 1,
            };
            this.abbreviationRules.push(newRule);
            added.push(newRule);
          }
        });
      }
    });

    // 2. Quét từ duties
    this.duties.forEach((d) => {
      const trimmed = (d?.name || '').trim();
      if (!trimmed) return;

      const existing = isAlreadyDefined(trimmed);
      if (existing) {
        if (existing.originalText.toLowerCase() !== trimmed.toLowerCase()) {
          const aliases = existing.aliases || [];
          if (!aliases.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
            existing.aliases = [...aliases, trimmed];
          }
        }
      } else {
        const words = trimmed.split(/\s+/).filter(Boolean);
        const suggestedAbbr = words.map((w) => w[0]?.toUpperCase()).join('');
        const newRule: AbbreviationRule = {
          id: `abbr_disc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          originalText: trimmed,
          abbreviatedText: suggestedAbbr,
          category: 'DUTY',
          aliases: [],
          description: `Tự động trích xuất từ bảng Định mức kiêm nhiệm`,
          isSystem: false,
          isActive: true,
          order: this.abbreviationRules.length + added.length + 1,
        };
        this.abbreviationRules.push(newRule);
        added.push(newRule);
      }
    });

    // 3. Quét từ subjects
    this.subjects.forEach((s) => {
      const trimmed = (s?.name || '').trim();
      if (!trimmed) return;

      const existing = isAlreadyDefined(trimmed);
      if (!existing) {
        const newRule: AbbreviationRule = {
          id: `abbr_disc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          originalText: trimmed,
          abbreviatedText: s.code || trimmed,
          category: 'SUBJECT',
          aliases: [],
          description: `Tự động trích xuất từ danh mục Môn học (${s.code || ''})`,
          isSystem: false,
          isActive: true,
          order: this.abbreviationRules.length + added.length + 1,
        };
        this.abbreviationRules.push(newRule);
        added.push(newRule);
      }
    });

    this.deduplicateAbbreviationRules();
    return { discoveredCount: added.length, addedRules: added };
  }

  public importAbbreviationRules(rules: AbbreviationRule[], mode: 'REPLACE' | 'MERGE'): boolean {
    if (!Array.isArray(rules)) return false;
    if (mode === 'REPLACE') {
      this.abbreviationRules = rules;
    } else {
      const map = new Map<string, AbbreviationRule>();
      this.abbreviationRules.forEach((r) => map.set(r.originalText.trim().toLowerCase(), r));
      rules.forEach((r) => {
        const key = r.originalText.trim().toLowerCase();
        const existing = map.get(key);
        const combinedAliases = Array.from(
          new Set([...(existing?.aliases || []), ...(r.aliases || [])])
        );
        map.set(key, { ...r, id: existing?.id || r.id, aliases: combinedAliases });
      });
      this.abbreviationRules = Array.from(map.values());
    }
    this.deduplicateAbbreviationRules();
    return true;
  }
}

export const dataStore = new DataStore();
