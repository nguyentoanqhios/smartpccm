/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Data Models & TypeScript Types
 */

export type UserRole = 'admin' | 'principal' | 'dean' | 'teacher' | 'staff';

export type UserPermission = 'edit' | 'view';

export interface UserPermissionsMap {
  canEditAssignments: boolean;
  canEditTeachers: boolean;
  canEditClasses: boolean;
  canEditCurriculum: boolean;
  canEditDuties: boolean;
  canEditVersions: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
}

export type LicensePlanType =
  | 'trial'
  | 'standard'
  | 'annual'
  | 'unlimited'
  | '1_year'
  | '2_years'
  | '3_years'
  | '4_years'
  | '5_years';
export type LicenseStatus = 'active' | 'locked' | 'expired';

export interface SchoolTenantLicense {
  id: string; // schoolId e.g. "school_thongke"
  schoolName: string; // Tên trường học, e.g. "TRƯỜNG THCS THỐNG KÊ"
  adminEmail: string; // Email đăng nhập được cấp, e.g. "thongke.qh@gmail.com"
  adminName?: string; // Tên người phụ trách, e.g. "Thầy Nguyễn Văn A"
  assignedPasswordHint?: string; // Mật khẩu ban đầu được cấp để tiện nhắc lại khi chia sẻ
  status: 'active' | 'locked';
  planType: LicensePlanType;
  expiresAt: string | null; // ISO string, null = vĩnh viễn
  lockedReason?: string; // Lý do khóa hiển thị cho người dùng khi bị khóa
  contactPhone?: string; // SĐT người liên hệ của trường
  notes?: string; // Ghi chú nội bộ của chủ sở hữu
  signature?: string; // Chữ ký số toàn vẹn chống can thiệp F12/DevTools
  maxTeachers?: number; // Giới hạn số lượng giáo viên tối đa theo bản quyền (chống 1 trường làm cho 2 trường)
  maxClasses?: number; // Giới hạn số lượng lớp tối đa theo bản quyền
  createdAt: string;
  updatedAt: string;
}

export interface LicenseCheckResult {
  isValid: boolean;
  status: LicenseStatus;
  daysRemaining: number | null; // null = không giới hạn, số âm = đã quá hạn
  message: string;
  schoolName: string;
  expiresAt: string | null;
  lockedReason?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string; // Mật khẩu đăng nhập cá nhân
  authUid?: string;
  schoolId?: string;
  role: UserRole;
  roleTitle: string;
  permission: UserPermission; // 'edit' = Quyền chỉnh sửa | 'view' = Chỉ xem
  customPermissions?: Partial<UserPermissionsMap>;
  departmentId?: string;
  teacherId?: string;
  avatar?: string;
  phone?: string;
  status?: 'active' | 'locked';
  expiresAt?: string | null; // Hạn dùng riêng của tài khoản nếu có
  lockedReason?: string;
  isSuperAdmin?: boolean; // Quyền quản trị tối cao (chủ sở hữu hệ thống)
  createdAt?: string;
}

export type SemesterId = 'HK1' | 'HK2' | 'ALL_YEAR';

export type VersionStatus = 'draft' | 'pending' | 'approved' | 'locked';

export interface SchoolInfo {
  schoolName: string;         // e.g. "TRƯỜNG THCS THỐNG KÊ"
  branchName: string;         // e.g. "PHÂN HIỆU"
  authorityName: string;      // e.g. "PHÒNG GIÁO DỤC VÀ ĐÀO TẠO"
  provinceName?: string;      // e.g. "Nghệ An"
  schoolYear: string;         // e.g. "2026-2027"
  principalName?: string;     // e.g. "Hiệu trưởng"
  deanName?: string;          // e.g. "Phó Hiệu trưởng"
  notes?: string;
  province?: string;
  district?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface SemesterConfig {
  id: SemesterId;
  name: string;
  weeks: number;
  startDate: string;
  endDate: string;
}

export interface SchoolYear {
  id: string;
  name: string; // e.g. '2026-2027'
  isDefault: boolean;
  semesters: SemesterConfig[];
}

export interface AssignmentVersion {
  id: string;
  schoolId?: string;
  schoolYearId: string;
  semesterId: SemesterId;
  name: string; // 'Lần 1' | 'Lần 2' | 'Điều chỉnh lần 1' | 'Điều chỉnh lần 2' | 'Phiên bản chính thức'
  isOfficial: boolean;
  status: VersionStatus;
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  lockedAt?: string;
  lockedBy?: string;
  lockReason?: string;
  notes?: string;
}

export interface Department {
  id: string;
  schoolId?: string;
  code: string;
  name: string;
  fullName?: string; // Tên đầy đủ của tổ (không dùng viết tắt, dùng để đưa vào biểu mẫu và báo cáo)
  headTeacherId?: string;
  deputyTeacherId?: string; // Tổ phó (duy trì tương thích ngược)
  deputyTeacherIds?: string[]; // Danh sách các tổ phó (mỗi tổ có thể có 1, 2, 3... tổ phó)
  teacherIds: string[];
  active: boolean;
}

export type TeacherStatus =
  | 'ACTIVE'           // Đang công tác
  | 'PRINCIPAL'        // Hiệu trưởng
  | 'VICE_PRINCIPAL'   // Phó hiệu trưởng
  | 'MATERNITY'        // Nghỉ sinh
  | 'SICK_LEAVE'       // Nghỉ ốm dài hạn
  | 'SECONDMENT'       // Biệt phái
  | 'UNPAID_LEAVE'     // Nghỉ không lương
  | 'SUSPENDED'        // Tạm nghỉ
  | 'TRANSFERRED'      // Chuyển công tác
  | 'CUSTOM';          // Khác

export interface WorkplaceCategory {
  id: string;
  code: string;         // e.g. "DC", "PH", "TT"
  name: string;         // e.g. "Điểm chính", "Phân hiệu", "Toàn trường"
  description?: string;
  color?: string;       // e.g. "blue", "amber", "emerald", "purple", "rose", "cyan"
  isDefault?: boolean;
  active: boolean;
  order?: number;
}

export interface Teacher {
  id: string;
  schoolId?: string;
  code: string;
  fullName: string;
  timetableName?: string; // Tên giáo viên hiển thị trong Thời khóa biểu (Tên TKB, ví dụ: "Toàn", "Thành-Toán", "HươngT")
  shortName?: string;     // Tên viết tắt định nghĩa trong hệ thống
  birthDate?: string;
  gender?: 'Nam' | 'Nữ';
  startYear?: number;
  departmentId: string;
  workplaceId?: string; // ID của nơi làm việc (vd: wp_main, wp_sub, wp_all)
  workplace?: string;   // Tên nơi làm việc (vd: Điểm chính, Phân hiệu, Toàn trường)
  positions?: string[]; // Vị trí công việc / kiêm nhiệm (vd: ['Hiệu trưởng', 'Tổ trưởng', 'Chủ tịch Công đoàn'])
  initialDegree?: string; // Đại học, Cao đẳng, Thạc sĩ...
  higherDegree?: string;
  major?: string; // Chuyên ngành đào tạo (Toán, Lý, Hóa, Văn...)
  subjectsCanTeach: string[]; // Subject IDs or codes
  offDay?: string; // Ngày nghỉ chuyên môn (Thứ 2 - Thứ 7)
  phone?: string;
  email?: string;
  status: TeacherStatus;
  statusLabel?: string;
  interSchoolPeriods?: number; // Tiết dạy liên trường / ngoài trường
  standardQuota: number; // Định mức chuẩn (mặc định 19 hoặc cấu hình)
  notes?: string;
  isDeleted?: boolean;
  tutoringInfo?: string; // Dạy ôn thi 9, Phụ đạo HS yếu
  bdHsgInfo?: string;    // Bồi dưỡng học sinh giỏi (BD HSG)
}

export type SchoolSession = 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'TWO_SESSIONS_PER_DAY';

export interface SchoolBranch {
  id: string;
  code: string;         // e.g. "DC", "PH", "DL"
  name: string;         // e.g. "Điểm chính", "Phân hiệu"
  isMain: boolean;      // true = Điểm chính, false = Phân hiệu
  address?: string;
  managerName?: string;
  phone?: string;
  notes?: string;
  active: boolean;
  order?: number;
}

export interface SchoolClass {
  id: string;
  schoolId?: string;
  code: string; // 6A9, 7A8, 8A9, 9A12
  name: string;
  grade: 6 | 7 | 8 | 9;
  studentCount: number;
  homeroomTeacherId?: string;
  session: SchoolSession;
  branchId?: string; // Phân hiệu / Điểm trường (mặc định: Điểm chính)
  room?: string;
  active: boolean;
  isDeleted?: boolean;
}

export interface GradeSession2Config {
  hasSession2?: boolean;
  bdClasses?: number;
  bdPeriods?: number;
  pdClasses?: number;
  pdPeriods?: number;
  examClasses?: number;
  examPeriods?: number;
  notes?: string;
}

export interface SubjectSession2Config {
  hasSession2?: boolean;
  session2Type?: 'BD' | 'PD' | 'EXAM' | 'ALL';
  bdClasses?: number;
  bdPeriods?: number;
  pdClasses?: number;
  pdPeriods?: number;
  examClasses?: number;
  examPeriods?: number;
  notes?: string;
  // Cấu hình gán môn Buổi 2 theo từng khối (6, 7, 8, 9)
  applicableGrades?: number[]; // Các khối áp dụng Buổi 2 cho môn này
  gradeConfigs?: Record<number, GradeSession2Config>; // Chi tiết lớp & số tiết Buổi 2 cho từng khối 6, 7, 8, 9
}


export interface Subject {
  id: string;
  schoolId?: string;
  code: string;
  name: string;
  shortName: string;
  group: string; // Tự nhiên, Xã hội, Nghệ thuật, Thể chất, Hoạt động trải nghiệm
  applicableGrades: number[]; // [6, 7, 8, 9]
  departmentId: string;
  allowsMultipleTeachers: boolean; // Cho phép nhiều GV cùng dạy
  isIntegrated: boolean; // Môn tích hợp (Khoa học tự nhiên, Lịch sử & Địa lý)
  active: boolean;
  color?: string;
  periodsPerWeek?: number;
  isSession2?: boolean;
  session2Config?: SubjectSession2Config;
}

export interface CurriculumDistribution {
  id: string;
  schoolYearId: string;
  semesterId: SemesterId;
  versionId?: string;
  grade: 6 | 7 | 8 | 9;
  subjectId: string;
  periodsPerWeek: number; // Số tiết/tuần
  weeks: number;          // Số tuần
  totalPeriods: number;   // = periodsPerWeek * weeks
  effectiveDate: string;
  status: 'approved' | 'draft';
}

export type DutyType = 'CONCURRENT' | 'EXEMPTION' | 'SPECIAL_STATUS';

export interface SpecialDuty {
  id: string;
  code: string;
  name: string;
  type: DutyType;
  periodsPerWeekCalculated: number; // Số tiết được tính/tuần
  periodsPerWeekExempted: number;   // Số tiết được miễn/giảm/tuần
  applicationMode: 'FIXED' | 'BY_CLASS' | 'BY_TERM';
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export type AssignmentType = 'TEACHING' | 'CONCURRENT' | 'CONCURRENT_DUTY' | 'ACTIVITY' | 'EXEMPTION' | 'OTHER';
export type AssignmentSession = 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'TWO_SESSIONS_PER_DAY' | 'ACTIVITY' | 'OTHER';

export interface TeachingAssignment {
  id: string;
  schoolId?: string;
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
  teacherId: string;
  departmentId: string;
  type: AssignmentType;
  subjectId?: string;
  classId?: string;
  branchId?: string; // Phân hiệu / Điểm trường
  isInterSchool?: boolean; // Dạy liên trường / trường khác
  interSchoolName?: string; // Tên trường liên trường (VD: THCS Châu Quang)
  dutyId?: string;
  dutyName?: string;
  session: AssignmentSession;
  periodsPerWeek: number;
  weeks: number;
  totalPeriods: number; // = periodsPerWeek * weeks
  status: 'approved' | 'draft';
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  notes?: string;
  isDeleted?: boolean;
}

export type ResultStatus = 'EXACT' | 'EXACT_EXEMPT' | 'DEFICIT' | 'SURPLUS' | 'UNASSIGNED';

export interface TeacherCalculationResult {
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  departmentId: string;
  departmentName: string;
  status: TeacherStatus;
  statusLabel: string;
  morningPeriods: number;      // 1. Buổi 1
  afternoonPeriods: number;    // 2. Buổi 2
  interSchoolPeriods?: number; // 2.1 Tiết dạy liên trường
  activityPeriods: number;     // 3. Hoạt động hoặc khác
  concurrentPeriods: number;   // 4. Kiêm nhiệm
  exemptionPeriods: number;    // 5. Miễn/giảm
  actualTotalAssigned: number; // 6. Tổng phân công thực tế = 1+2+3+4
  totalCalculated: number;     // 7. Tổng được tính = 6+5
  quota: number;               // 8. Định mức
  standardQuota?: number;      // Định mức chuẩn alias (tương thích cả quota & standardQuota)
  difference: number;          // 9. Chênh lệch = 7 - 8
  resultStatus: ResultStatus;  // 10. Kết quả
  deficitAmount: number;
  surplusAmount: number;
  assignments: TeachingAssignment[];
  notes?: string;
  recommendation?: string;
  dutyLines?: string[];
  dutyText?: string;
}

export type ClassSubjectStatus = 'OK' | 'DEFICIT' | 'SURPLUS' | 'DUPLICATE' | 'UNASSIGNED';

export interface ClassSubjectCheckResult {
  classId: string;
  className: string;
  grade: number;
  subjectId: string;
  subjectName: string;
  standardPeriodsPerWeek: number;
  standardTotalPeriods: number;
  assignedPeriodsPerWeek: number;
  assignedTotalPeriods: number;
  difference: number;
  status: ClassSubjectStatus;
  isIntegrated: boolean;
  assignedTeachers: {
    teacherId: string;
    teacherName: string;
    periodsPerWeek: number;
    assignmentId: string;
  }[];
  errorMessage?: string;
}

export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO' | 'VALID'; // Đỏ, Cam, Vàng, Xanh

export interface AssignmentConflict {
  id: string;
  severity: ConflictSeverity;
  type: 'DUPLICATE_ASSIGNMENT' | 'INTEGRATED_MISMATCH' | 'CLASS_SUBJECT_DEFICIT' | 'CLASS_SUBJECT_SURPLUS' | 'TEACHER_DEFICIT' | 'TEACHER_SURPLUS' | 'UNASSIGNED_CLASS_SUBJECT' | 'ZERO_CURRICULUM_WARNING';
  title: string;
  message: string;
  targetType: 'ASSIGNMENT' | 'TEACHER' | 'CLASS' | 'SUBJECT' | 'CURRICULUM';
  targetId?: string;
  relatedIds?: string[];
  suggestedAction?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'LOCK' | 'UNLOCK' | 'RESTORE' | 'IMPORT' | 'SEED_RESET' | 'BLANK_RESET';
  entityType: 'ASSIGNMENT' | 'TEACHER' | 'CLASS' | 'SUBJECT' | 'CURRICULUM' | 'VERSION' | 'DUTY';
  entityId: string;
  entityDescription: string;
  beforeData?: any;
  afterData?: any;
  reason?: string;
}

export interface FeedbackRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  departmentName?: string;
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
  title: string;
  content: string;
  suggestedChanges?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  adminReply?: string;
  repliedAt?: string;
}

export interface ValidationOutput {
  conflicts: AssignmentConflict[];
  classSubjectChecks: ClassSubjectCheckResult[];
  criticalErrorsCount: number;
  warningsCount: number;
  infoCount: number;
  isValidForApproval: boolean;
  isValid?: boolean;
}

export interface SystemBackup {
  id: string;
  title: string;
  createdAt: string;
  createdBy: string;
  versionCount: number;
  teacherCount: number;
  assignmentCount: number;
  tenantId?: string; // Mã trường sở hữu bản sao lưu (Chống nạp chéo giữa các trường)
  schoolId?: string; // Mã trường sở hữu bản sao lưu (hỗ trợ cả schoolId và tenantId)
  schoolName?: string; // Tên trường sở hữu bản sao lưu
  signature?: string; // Chữ ký số bảo mật chống giả mạo file backup
  dataJson: string;
}

export type AbbreviationCategory = 'DUTY' | 'SUBJECT' | 'EXEMPTION' | 'GENERAL';

export interface AbbreviationRule {
  id: string;
  originalText: string;      // Cụm từ gốc đại diện (vd: "Tổ trưởng chuyên môn", "Tiếng Anh", "Nghỉ thai sản")
  abbreviatedText: string;   // Ký hiệu viết tắt (vd: "TT", "T.Anh", "Nghỉ sinh")
  category: AbbreviationCategory;
  aliases?: string[];        // Các biến thể tham chiếu áp dụng (vd: ["Tổ trưởng", "TTCM", "Tổ trưởng tổ CM"])
  description?: string;      // Ghi chú giải thích ý nghĩa tham chiếu
  isSystem?: boolean;        // Quy tắc mặc định hệ thống
  isActive: boolean;         // Có hiệu lực áp dụng
  order?: number;            // Thứ tự ưu tiên
}
