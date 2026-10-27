/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Main Application Orchestrator & State Container
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, ActiveTab } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { AssignmentTableView } from './components/AssignmentTableView';
import { TeacherManagementView } from './components/TeacherManagementView';
import { ClassCurriculumView } from './components/ClassCurriculumView';
import { ValidationConflictView } from './components/ValidationConflictView';
import { ReportsAnalyticsView } from './components/ReportsAnalyticsView';
import { VersionComparisonView } from './components/VersionComparisonView';
import { AuditLogFeedbackView } from './components/AuditLogFeedbackView';
import { SystemTestRunnerView } from './components/SystemTestRunnerView';
import { BulkManagementView } from './components/BulkManagementView';
import { UserManagementView } from './components/UserManagementView';
import { AbbreviationManagementView } from './components/AbbreviationManagementView';
import { ImportExportModal } from './components/ImportExportModal';
import { NewVersionModal } from './components/NewVersionModal';
import { SchoolBranchSetupModal } from './components/SchoolBranchSetupModal';
import { GlobalSearchModal, GlobalSearchNavTarget } from './components/GlobalSearchModal';
import { LoginView } from './components/LoginView';
import { LicenseLockoutOverlay } from './components/LicenseLockoutOverlay';
import { auth, isSystemSyncEmail } from './firebase/config';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { dataStore, INITIAL_USER_PROFILES, DEFAULT_GUEST_PROFILE, isSameEmail, isSuperAdminEmail, isAdminSchool } from './repositories/dataStore';
import { UserProfile } from './types';
import { calculateAllTeachersWorkload } from './calculation-engine/workloadCalculator';
import { runFullValidation } from './validation/assignmentValidator';
import { exportWorkloadExcel } from './import-export/excelService';
import { toastService } from './services/toastService';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(() => !dataStore.isInitialSetupCompleted());
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => {
    if (auth.currentUser && !isSystemSyncEmail(auth.currentUser.email)) {
      return auth.currentUser;
    }
    return null;
  });
  const [isExplicitLoggedOut, setIsExplicitLoggedOut] = useState<boolean>(false);
  const isExplicitLoggedOutRef = useRef<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDemoBypass, setIsDemoBypass] = useState(false);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);
  const [isResettingConfig, setIsResettingConfig] = useState(false);
  const [isAuthenticatedSession, setIsAuthenticatedSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;

    // Tự động dọn sạch session nếu lỡ dính tài khoản pccm_system_sync
    const sessionEmail = sessionStorage.getItem('pccm_session_user_email');
    if (sessionEmail && isSystemSyncEmail(sessionEmail)) {
      sessionStorage.removeItem('pccm_session_user_email');
      sessionStorage.removeItem('pccm_authenticated_session');
      sessionStorage.removeItem('pccm_is_super_admin');
      return false;
    }

    const urlSchoolId = dataStore.detectUrlSchoolId();
    const targetSchool = urlSchoolId || dataStore.getSchoolId() || 'school_admin';
    const isAuthedForThisSchool = sessionStorage.getItem(`pccm_session_auth_${targetSchool}`) === 'true';
    const authedSchoolId = sessionStorage.getItem('pccm_session_school_id');
    const isGeneralAuthed = sessionStorage.getItem('pccm_authenticated_session') === 'true';
    const isSuper = sessionStorage.getItem('pccm_is_super_admin') === 'true';

    // Khi mở qua liên kết chia sẻ trường học (?schoolId=...), bắt buộc phải xác thực mật khẩu cho đúng trường này
    if (urlSchoolId && !isAdminSchool(urlSchoolId)) {
      return isAuthedForThisSchool && authedSchoolId === urlSchoolId;
    }

    if (isSuper && (!urlSchoolId || isAdminSchool(urlSchoolId))) return true;
    return isGeneralAuthed && (isAuthedForThisSchool || authedSchoolId === targetSchool || !urlSchoolId);
  });

  useEffect(() => {
    // Nếu mở qua liên kết chia sẻ của trường học (?schoolId=...)
    // Kiểm tra xem tab này đã xác thực mật khẩu cho đúng trường này chưa.
    // Nếu chưa, xóa sạch các cờ session kế thừa để bắt buộc hiển thị màn hình đăng nhập.
    const urlSchoolId = dataStore.detectUrlSchoolId();
    if (urlSchoolId && !isAdminSchool(urlSchoolId) && typeof window !== 'undefined') {
      const isAuthedForUrlSchool = sessionStorage.getItem(`pccm_session_auth_${urlSchoolId}`) === 'true';
      const authedSchoolId = sessionStorage.getItem('pccm_session_school_id');
      if (!isAuthedForUrlSchool || authedSchoolId !== urlSchoolId) {
        sessionStorage.removeItem('pccm_is_super_admin');
        sessionStorage.removeItem('pccm_authenticated_session');
        sessionStorage.removeItem('pccm_session_school_id');
        sessionStorage.removeItem('pccm_session_user_email');
        setIsAuthenticatedSession(false);
      }
    }

    // Timeout dự phòng: Đảm bảo app không bao giờ bị treo màn hình chờ nếu Firebase Auth phản hồi chậm hoặc bị chặn mạng
    const authTimeoutTimer = setTimeout(() => {
      setIsAuthLoading(false);
    }, 1500);

    const unsubAuth = onAuthStateChanged(
      auth,
      (user) => {
        clearTimeout(authTimeoutTimer);
        if (isExplicitLoggedOutRef.current) {
          setFirebaseUser(null);
        } else if (user && isSystemSyncEmail(user.email)) {
          // BỎ QUA HOÀN TOÀN TÀI KHOẢN ĐỒNG BỘ NGẦM: Không gán làm người dùng giao diện
          setFirebaseUser(null);
        } else {
          setFirebaseUser(user);
        }
        setIsAuthLoading(false);
      },
      (err) => {
        clearTimeout(authTimeoutTimer);
        console.warn('onAuthStateChanged error, falling back to local session:', err);
        setIsAuthLoading(false);
      }
    );
    return () => {
      clearTimeout(authTimeoutTimer);
      unsubAuth();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      isExplicitLoggedOutRef.current = true;
      setIsExplicitLoggedOut(true);
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        localStorage.removeItem('pccm_active_session_v1');
        localStorage.removeItem('pccm_authenticated_session');
      }
      setIsAuthenticatedSession(false);
      setIsDemoBypass(false);
      setAuthSyncError(null);
      setFirebaseUser(null);
      dataStore.setCurrentUser(DEFAULT_GUEST_PROFILE);
      setCurrentUser(DEFAULT_GUEST_PROFILE);

      try {
        await signOut(auth);
      } catch (e) {
        console.warn('Sign out Firebase warning', e);
      }
      toastService.info('Đã đăng xuất tài khoản thành công!');
    } catch (e) {
      console.warn('Sign out error', e);
      setIsAuthenticatedSession(false);
      setFirebaseUser(null);
    }
  }, []);

  // Tự động khôi phục / đồng bộ cấu hình dữ liệu cục bộ khi người dùng Google đăng nhập thành công
  useEffect(() => {
    if (!firebaseUser || isSystemSyncEmail(firebaseUser.email)) return;

    try {
      const email = firebaseUser.email || '';
      const isSuper = isSuperAdminEmail(email);
      const urlSchoolId = dataStore.detectUrlSchoolId();
      const targetSchool = (urlSchoolId && !isAdminSchool(urlSchoolId))
        ? urlSchoolId
        : (dataStore.getSchoolId() || 'school_admin');

      // Tự động kiểm tra và phục hồi bản quyền của trường nếu là school_admin
      const currentLic = dataStore.getSchoolLicenseById(targetSchool);
      if (!currentLic && isAdminSchool(targetSchool)) {
        dataStore.saveSchoolLicense({
          id: 'school_admin',
          schoolName: 'TRƯỜNG THCS ADMIN',
          adminEmail: 'nguyentoanqh@gmail.com',
          adminName: 'Thầy Nguyễn Văn Toàn',
          assignedPasswordHint: '123456',
          status: 'active',
          planType: 'annual',
          expiresAt: '2027-08-31T23:59:59.000Z',
          contactPhone: '0961 285 888',
          notes: 'Tự động kích hoạt & khôi phục bản quyền hợp lệ',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (dataStore.getSchoolId() !== targetSchool) {
        dataStore.setSchoolId(targetSchool);
      }
      setCurrentSchoolId(targetSchool);

      // Kiểm tra tính hợp lệ & cấp phép của tài khoản Google
      const allLics = dataStore.getSchoolLicenses();
      const matchingLic = allLics.find((l) => isSameEmail(l.adminEmail, email));
      let profile = dataStore.getUsers().find((u) => isSameEmail(u.email, email));
      const teacherMatch = dataStore.getTeachers().find((t) => isSameEmail(t.email, email));
      const isAuthorized = isSuper || Boolean(matchingLic) || Boolean(profile) || Boolean(teacherMatch);

      if (!isAuthorized) {
        console.warn('Từ chối tài khoản Google chưa cấp quyền:', email);
        signOut(auth).catch(() => {});
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pccm_authenticated_session');
          sessionStorage.removeItem(`pccm_session_auth_${targetSchool}`);
          sessionStorage.removeItem('pccm_session_school_id');
          sessionStorage.removeItem('pccm_session_user_email');
          sessionStorage.removeItem('pccm_is_super_admin');
        }
        setFirebaseUser(null);
        setIsAuthenticatedSession(false);
        return;
      }

      // Tìm hoặc khởi tạo UserProfile khớp với tài khoản Google đang đăng nhập
      if (!profile) {
        const assignedRole = isSuper ? 'admin' : (matchingLic ? 'admin' : 'teacher');
        const assignedPerm = (isSuper || matchingLic) ? 'edit' : 'view';
        const assignedTitle = isSuper
          ? 'Chủ sở hữu & Quản trị viên Tối cao'
          : (matchingLic ? 'Quản trị viên trường' : 'Giáo viên bộ môn');

        profile = dataStore.addUser({
          name: firebaseUser.displayName || (isSuper ? 'Thầy Nguyễn Văn Toàn' : currentLic?.adminName || email.split('@')[0]),
          email: email,
          authUid: firebaseUser.uid,
          schoolId: targetSchool,
          role: assignedRole,
          roleTitle: assignedTitle,
          permission: assignedPerm,
          isSuperAdmin: isSuper,
          status: 'active',
        });
      } else {
        const needsUpdate =
          profile.authUid !== firebaseUser.uid ||
          profile.schoolId !== targetSchool ||
          profile.status === 'locked' ||
          (isSuper && !profile.isSuperAdmin);

        if (needsUpdate) {
          dataStore.updateUser(profile.id, {
            authUid: firebaseUser.uid,
            schoolId: targetSchool,
            status: 'active',
            isSuperAdmin: isSuper ? true : profile.isSuperAdmin,
            ...(isSuper ? { permission: 'edit', role: 'admin', roleTitle: 'Chủ sở hữu & Quản trị viên Tối cao' } : {}),
          });
          profile = dataStore.getUserById(profile.id) || profile;
        }
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pccm_authenticated_session', 'true');
        sessionStorage.setItem(`pccm_session_auth_${targetSchool}`, 'true');
        sessionStorage.setItem('pccm_session_school_id', targetSchool);
        sessionStorage.setItem('pccm_session_user_email', email);
        if (isSuper) {
          sessionStorage.setItem('pccm_is_super_admin', 'true');
        } else {
          sessionStorage.removeItem('pccm_is_super_admin');
        }
      }

      dataStore.setCurrentUser(profile);
      setCurrentUser(profile);
      setIsAuthenticatedSession(true);
      setAuthSyncError(null);
    } catch (err: any) {
      console.warn('Firebase user auto-reconciliation error:', err);
      setAuthSyncError(err?.message || 'Lỗi đồng bộ cấu hình dữ liệu người dùng Google');
    }
  }, [firebaseUser]);

  // Hàm khôi phục & đặt lại cấu hình cục bộ (Local Storage Reset & Resync)
  const handleResetLocalConfig = useCallback(() => {
    setIsResettingConfig(true);
    try {
      if (typeof window !== 'undefined') {
        const keysToRemove = [
          'pccm_school_id_v1',
          'pccm_school_info_v1',
          'pccm_school_licenses_v1',
          'pccm_active_session_v1',
          'pccm_initial_setup_completed_v1',
          'pccm_school_info_tenants_v1',
          'pccm_users_v1',
        ];
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }

      dataStore.restoreQuyHopData();
      dataStore.setSchoolId('school_admin');

      if (auth.currentUser) {
        const email = auth.currentUser.email || '';
        const isSuper = isSuperAdminEmail(email);
        const prof = dataStore.addUser({
          name: auth.currentUser.displayName || (isSuper ? 'Thầy Nguyễn Văn Toàn' : 'Quản trị viên trường'),
          email: email,
          authUid: auth.currentUser.uid,
          schoolId: 'school_admin',
          role: 'admin',
          roleTitle: isSuper ? 'Chủ sở hữu & Quản trị viên Tối cao' : 'Quản trị viên trường',
          permission: 'edit',
          isSuperAdmin: isSuper,
          status: 'active',
        });
        dataStore.setCurrentUser(prof);
        setCurrentUser(prof);
      }

      dataStore.loadLicensesFromCloud().catch(() => {});
      dataStore.initFirestoreRealtimeSync('school_admin');

      setAuthSyncError(null);
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } catch (err) {
      console.error('Reset local config error:', err);
      window.location.reload();
    } finally {
      setIsResettingConfig(false);
    }
  }, []);

  // Global Search Navigation Filters
  const [assignmentNavFilter, setAssignmentNavFilter] = useState<{
    searchTerm?: string;
    selectedClass?: string;
    token: number;
  }>({ token: 0 });

  const [teacherNavFilter, setTeacherNavFilter] = useState<{
    searchTerm?: string;
    token: number;
  }>({ token: 0 });

  const [classCurriculumNavFilter, setClassCurriculumNavFilter] = useState<{
    initialTab?: 'CURRICULUM' | 'CLASSES' | 'SUBJECTS';
    searchTerm?: string;
    token: number;
  }>({ token: 0 });

  // Core Data Store States
  const [teachers, setTeachers] = useState(dataStore.getTeachers(true));
  const [classes, setClasses] = useState(dataStore.getClasses(true));
  const [subjects, setSubjects] = useState(dataStore.getSubjects());
  const [departments, setDepartments] = useState(dataStore.getDepartments());
  const [duties, setDuties] = useState(dataStore.getDuties());
  const [curriculums, setCurriculums] = useState(dataStore.getCurriculum());
  const [assignments, setAssignments] = useState(dataStore.getAssignments(undefined, undefined, undefined, true));
  const [versions, setVersions] = useState(dataStore.getVersions());
  const [auditLogs, setAuditLogs] = useState(dataStore.getAuditLogs());
  const [feedbacks, setFeedbacks] = useState(dataStore.getFeedbacks());
  const [users, setUsers] = useState(dataStore.getUsers());
  const [context, setContext] = useState(dataStore.getSelectedContext());
  const [currentUser, setCurrentUser] = useState(dataStore.getCurrentUser());
  const [currentSchoolId, setCurrentSchoolId] = useState(dataStore.getSchoolId());

  // Subscription to store updates
  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setTeachers(dataStore.getTeachers(true));
      setClasses(dataStore.getClasses(true));
      setSubjects(dataStore.getSubjects());
      setDepartments(dataStore.getDepartments());
      setDuties(dataStore.getDuties());
      setCurriculums(dataStore.getCurriculum());
      setAssignments(dataStore.getAssignments(undefined, undefined, undefined, true));
      setVersions(dataStore.getVersions());
      setAuditLogs(dataStore.getAuditLogs());
      setFeedbacks(dataStore.getFeedbacks());
      setUsers(dataStore.getUsers());
      setContext(dataStore.getSelectedContext());
      setCurrentUser(dataStore.getCurrentUser());
      setCurrentSchoolId(dataStore.getSchoolId());
      if (!dataStore.isInitialSetupCompleted()) {
        setIsInitialSetupOpen(true);
      }
    });
    return unsub;
  }, []);

  const currentVersion = useMemo(() => {
    return (
      versions.find((v) => v.id === context.versionId) ||
      versions.find((v) => v.semesterId === context.semesterId) ||
      versions[0]
    );
  }, [versions, context]);

  const activeAssignmentsForVersion = useMemo(() => {
    return assignments.filter(
      (a) =>
        !a.isDeleted &&
        a.schoolYearId === context.schoolYearId &&
        a.semesterId === context.semesterId &&
        a.versionId === context.versionId
    );
  }, [assignments, context]);

  // Weeks for current semester (18 for HK1, 17 for HK2)
  const semesterWeeks = context.semesterId === 'HK1' ? 18 : 17;

  // Real-time Teacher Workload Calculations
  const calculations = useMemo(() => {
    const rules = dataStore.getAbbreviationRules();
    return calculateAllTeachersWorkload(
      teachers,
      activeAssignmentsForVersion,
      duties,
      departments,
      semesterWeeks,
      rules
    );
  }, [teachers, activeAssignmentsForVersion, duties, departments, semesterWeeks]);

  // Real-time Full Validation (Conflicts, Discrepancies, Quota checks)
  const validation = useMemo(() => {
    return runFullValidation({
      schoolYearId: context.schoolYearId,
      semesterId: context.semesterId,
      versionId: context.versionId,
      teachers,
      classes,
      subjects,
      curriculums,
      assignments: activeAssignmentsForVersion,
      teacherCalculations: calculations,
    });
  }, [context, teachers, classes, subjects, curriculums, activeAssignmentsForVersion, calculations]);

  // Excel Export Handler
  const handleExportExcel = useCallback(async (exportParams?: {
    branchScopeName?: string;
    departmentScopeName?: string;
    timeCycleName?: string;
    periodMultiplier?: number;
    filteredCalculations?: typeof calculations;
    filteredAssignments?: typeof activeAssignmentsForVersion;
    filteredClasses?: typeof classes;
    filteredTeachers?: typeof teachers;
  }) => {
    try {
      const currentSchoolInfo = dataStore.getSchoolInfo();
      await exportWorkloadExcel({
        schoolYear: currentSchoolInfo.schoolYear || '2026-2027',
        semesterName: context.semesterId === 'HK1' ? 'Học kỳ I' : 'Học kỳ II',
        versionName: currentVersion?.name || 'Chính thức',
        exporterName: currentUser.name,
        schoolInfo: currentSchoolInfo,
        teachers: exportParams?.filteredTeachers || teachers,
        calculations: exportParams?.filteredCalculations || calculations,
        assignments: exportParams?.filteredAssignments || activeAssignmentsForVersion,
        classes: exportParams?.filteredClasses || classes,
        subjects,
        duties,
        departments,
        branchScopeName: exportParams?.branchScopeName,
        departmentScopeName: exportParams?.departmentScopeName,
        timeCycleName: exportParams?.timeCycleName,
        periodMultiplier: exportParams?.periodMultiplier,
      });
    } catch (e) {
      console.error('Failed to export Excel', e);
      alert('Đã xảy ra lỗi khi tạo file Excel.');
    }
  }, [
    context,
    currentVersion,
    currentUser,
    teachers,
    calculations,
    activeAssignmentsForVersion,
    classes,
    subjects,
    duties,
    departments,
  ]);

  // Global Search Navigate Handler
  const handleGlobalSearchNavigate = useCallback((target: GlobalSearchNavTarget) => {
    if (target.tab === 'assignments') {
      if (target.filterType === 'teacher') {
        setAssignmentNavFilter({
          searchTerm: target.teacherName,
          selectedClass: 'ALL',
          token: Date.now(),
        });
      } else if (target.filterType === 'class') {
        setAssignmentNavFilter({
          searchTerm: '',
          selectedClass: target.classId,
          token: Date.now(),
        });
      } else if (target.filterType === 'subject') {
        setAssignmentNavFilter({
          searchTerm: target.subjectName,
          selectedClass: 'ALL',
          token: Date.now(),
        });
      }
      setActiveTab('assignments');
    } else if (target.tab === 'teachers') {
      setTeacherNavFilter({
        searchTerm: target.teacherName,
        token: Date.now(),
      });
      setActiveTab('teachers');
    } else if (target.tab === 'classes-curriculum') {
      setClassCurriculumNavFilter({
        initialTab: target.classCurriculumTab || 'CLASSES',
        searchTerm: target.className || target.subjectName,
        token: Date.now(),
      });
      setActiveTab('classes-curriculum');
    }
  }, []);

  // Xác định trường học mục tiêu cần kiểm tra quyền truy cập
  const currentActiveSchoolId = currentSchoolId || dataStore.getSchoolId() || 'school_admin';

  // Kiểm tra phiên làm việc: Bắt buộc đã xác thực bảo mật cho đúng trường currentActiveSchoolId
  const isSchoolSessionActive = useMemo(() => {
    if (typeof window === 'undefined' || isExplicitLoggedOut) return false;

    const urlSchoolId = dataStore.detectUrlSchoolId();

    // Nếu mở qua liên kết chia sẻ của trường học riêng (?schoolId=school_xyz...):
    // BẮT BUỘC người dùng phải đăng nhập đúng vào trường này!
    if (urlSchoolId && !isAdminSchool(urlSchoolId)) {
      const isAuthedForUrlSchool = sessionStorage.getItem(`pccm_session_auth_${urlSchoolId}`) === 'true';
      const authedSchoolId = sessionStorage.getItem('pccm_session_school_id');
      const isAuthed = (isAuthedForUrlSchool || authedSchoolId === urlSchoolId) && isAuthenticatedSession;
      if (isAuthed) return true;

      // Nếu đang đăng nhập Google và email trùng với adminEmail của trường này:
      const targetLic = dataStore.getSchoolLicenseById(urlSchoolId);
      if (firebaseUser?.email && targetLic?.adminEmail && isSameEmail(firebaseUser.email, targetLic.adminEmail)) {
        return true;
      }
      return false;
    }

    // 1. Nếu đang có Google Firebase User: Bắt buộc phải là tài khoản đã được cấp phép
    if (firebaseUser?.email) {
      const email = firebaseUser.email;
      const isSuper = isSuperAdminEmail(email);
      const allLics = dataStore.getSchoolLicenses();
      const matchingLic = allLics.find((l) => isSameEmail(l.adminEmail, email));
      const hasUser = dataStore.getUsers().some((u) => isSameEmail(u.email, email));
      const isTeacher = dataStore.getTeachers().some((t) => isSameEmail(t.email, email));
      if (isSuper || matchingLic || hasUser || isTeacher) {
        return true;
      }
      return false;
    }

    // 2. Nếu đã kích hoạt phiên xác thực thành công trong state
    if (isAuthenticatedSession) {
      return true;
    }

    // 3. Nếu đã đăng nhập bằng tài khoản Super Admin (Chủ sở hữu hệ thống):
    if (sessionStorage.getItem('pccm_is_super_admin') === 'true' && (!urlSchoolId || isAdminSchool(urlSchoolId))) {
      return true;
    }

    // 4. Nếu đăng nhập bằng mật khẩu trường học (School Password / PIN):
    const isAuthedForThisSchool = sessionStorage.getItem(`pccm_session_auth_${currentActiveSchoolId}`) === 'true';
    const authedSchoolId = sessionStorage.getItem('pccm_session_school_id');
    const isGeneralAuthed = sessionStorage.getItem('pccm_authenticated_session') === 'true';

    if (isGeneralAuthed && (isAuthedForThisSchool || authedSchoolId === currentActiveSchoolId || !urlSchoolId)) {
      return true;
    }

    return false;
  }, [currentActiveSchoolId, firebaseUser, isAuthenticatedSession, isExplicitLoggedOut]);

  const handleLoginSuccess = useCallback((profile: UserProfile) => {
    isExplicitLoggedOutRef.current = false;
    setIsExplicitLoggedOut(false);
    const sId = profile.schoolId || currentActiveSchoolId || dataStore.getSchoolId() || 'school_admin';
    const isSuper = isSuperAdminEmail(profile.email);
    const sanitizedProfile: UserProfile = {
      ...profile,
      schoolId: sId,
      role: isSuper ? 'admin' : (profile.role || 'admin'),
      permission: 'edit', // Luôn cấp quyền sửa cho quản trị viên trường khi đăng nhập
      isSuperAdmin: isSuper,
      roleTitle: isSuper ? 'Chủ sở hữu & Quản trị viên Tối cao' : (profile.roleTitle && !profile.roleTitle.includes('Tối cao') ? profile.roleTitle : 'Quản trị viên trường'),
    };
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pccm_authenticated_session', 'true');
      sessionStorage.setItem(`pccm_session_auth_${sId}`, 'true');
      sessionStorage.setItem('pccm_session_school_id', sId);
      sessionStorage.setItem('pccm_session_user_email', profile.email);
      if (isSuper) {
        sessionStorage.setItem('pccm_is_super_admin', 'true');
      } else {
        sessionStorage.removeItem('pccm_is_super_admin');
      }
    }
    if (auth.currentUser) {
      setFirebaseUser(auth.currentUser);
    }
    dataStore.setSchoolId(sId);
    dataStore.setCurrentUser(sanitizedProfile);
    setCurrentSchoolId(sId);
    setCurrentUser(sanitizedProfile);
    setIsAuthenticatedSession(true);
    setAuthSyncError(null);
    // Đánh dấu hoàn tất setup cho trường được cấp phép để không bị chặn popup
    dataStore.setInitialSetupCompleted(true);
    setIsInitialSetupOpen(false);

    // Kéo dữ liệu ngầm từ Cloud Firestore nếu cần và cập nhật lại state
    dataStore.ensureSchoolDataLoaded(sId).then(() => {
      setTeachers(dataStore.getTeachers(true));
      setClasses(dataStore.getClasses(true));
      setAssignments(dataStore.getAssignments(undefined, undefined, undefined, true));
      setSubjects(dataStore.getSubjects());
      setDepartments(dataStore.getDepartments());
    }).catch(() => {});
  }, [currentActiveSchoolId]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-4">
        <div className="w-12 h-12 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Đang khởi tạo kết nối & Xác thực trường học...</p>
      </div>
    );
  }

  if (!isSchoolSessionActive) {
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onContinueOfflineDemo={handleLoginSuccess}
      />
    );
  }

  // 1.5. License & Subscription Validity Gating
  let licenseCheck = dataStore.checkSchoolLicense();

  // Tự động khôi phục nếu là tài khoản quản trị trường THCS Thống Kê hoặc Super Admin
  if (!licenseCheck.isValid && firebaseUser) {
    const email = firebaseUser.email || '';
    if (isSameEmail(email, 'thongke.qh@gmail.com') || isSuperAdminEmail(email)) {
      const activeSchool = dataStore.getSchoolId() || 'school_admin';
      const existing = dataStore.getSchoolLicenseById(activeSchool);
      const name = existing?.schoolName || (isAdminSchool(activeSchool) ? 'TRƯỜNG THCS ADMIN' : activeSchool);
      dataStore.saveSchoolLicense({
        id: activeSchool,
        schoolName: name,
        adminEmail: existing?.adminEmail || (isSameEmail(email, 'thongke.qh@gmail.com') ? 'thongke.qh@gmail.com' : 'nguyentoanqh@gmail.com'),
        adminName: existing?.adminName || (isSameEmail(email, 'thongke.qh@gmail.com') ? 'Quản trị viên THCS Thống Kê' : 'Thầy Nguyễn Văn Toàn'),
        assignedPasswordHint: existing?.assignedPasswordHint || '123456',
        status: 'active',
        planType: existing?.planType || 'annual',
        expiresAt: existing?.expiresAt || '2027-08-31T23:59:59.000Z',
        contactPhone: existing?.contactPhone || (isAdminSchool(activeSchool) ? '0961 285 888' : '0961234567'),
        notes: existing?.notes || `Tự động kích hoạt bản quyền hợp lệ ${activeSchool}`,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      licenseCheck = dataStore.checkSchoolLicense(activeSchool);
    }
  }

  // Khôi phục khi dữ liệu cấu hình cục bộ bị lỗi hoặc tài khoản chưa được cấp quyền
  if (authSyncError) {
    return (
      <div className="min-h-screen bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-amber-200 p-6 sm:p-8 text-center space-y-4 animate-in fade-in">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {authSyncError.includes('quyền') ? 'Chưa được cấp quyền truy cập' : 'Dữ liệu cấu hình cục bộ không đồng bộ'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {authSyncError.includes('quyền')
              ? 'Tài khoản của bạn chưa được cấp phép truy cập vào không gian dữ liệu của trường học này.'
              : 'Dữ liệu bộ nhớ trình duyệt (localStorage) bị lỗi hoặc không khớp với máy chủ.'}
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-left text-xs text-amber-900 font-medium break-words">
            {authSyncError}
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setAuthSyncError(null);
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem(`pccm_session_auth_${currentActiveSchoolId}`);
                  sessionStorage.removeItem('pccm_authenticated_session');
                }
                signOut(auth).catch(() => {});
                setFirebaseUser(null);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <span>Đăng nhập tài khoản khác hoặc Nhập Mật khẩu trường</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs border border-slate-300 transition cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!licenseCheck.isValid) {
    return (
      <LicenseLockoutOverlay
        licenseCheck={licenseCheck}
        onRefresh={() => {
          setCurrentUser({ ...dataStore.getCurrentUser() });
        }}
        onResetLocalConfig={handleResetLocalConfig}
        onSignOut={handleSignOut}
        onLoginAsSuperAdmin={() => {
          const superAdmin =
            dataStore.getUsers().find((u) => u.isSuperAdmin || isSuperAdminEmail(u.email)) ||
            INITIAL_USER_PROFILES[0];
          dataStore.setSchoolId('school_admin');
          dataStore.setCurrentUser(superAdmin);
          setCurrentUser(superAdmin);
        }}
      />
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onOpenImportExport={() => setIsImportExportOpen(true)}
      onOpenNewVersionModal={() => setIsNewVersionModalOpen(true)}
      onOpenSchoolSetup={() => setIsInitialSetupOpen(true)}
      onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
      onSignOut={handleSignOut}
    >
      {/* 1. Executive Dashboard */}
      {activeTab === 'dashboard' && (
        <DashboardView
          teachers={teachers}
          classes={classes}
          departments={departments}
          subjects={subjects}
          curriculums={curriculums}
          assignments={activeAssignmentsForVersion}
          calculations={calculations}
          validation={validation}
          currentVersion={currentVersion}
          auditLogs={auditLogs}
          onNavigate={(tab) => setActiveTab(tab)}
          onQuickAssign={() => setActiveTab('assignments')}
          onExportExcel={handleExportExcel}
        />
      )}

      {/* 2. Assignment Table & Matrix */}
      {activeTab === 'assignments' && (
        <AssignmentTableView
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          departments={departments}
          duties={duties}
          curriculums={curriculums}
          assignments={assignments}
          calculations={calculations}
          currentVersion={currentVersion}
          schoolYearId={context.schoolYearId}
          semesterId={context.semesterId}
          versionId={context.versionId}
          initialSearchTerm={assignmentNavFilter.searchTerm}
          initialSelectedClass={assignmentNavFilter.selectedClass}
          searchFilterToken={assignmentNavFilter.token}
        />
      )}

      {/* 3. Teacher Management & Quotas */}
      {activeTab === 'teachers' && (
        <TeacherManagementView
          teachers={teachers}
          departments={departments}
          duties={duties}
          subjects={subjects}
          calculations={calculations}
          initialSearchTerm={teacherNavFilter.searchTerm}
          searchFilterToken={teacherNavFilter.token}
        />
      )}

      {/* 4. Classes, Subjects & Curriculum Distribution */}
      {activeTab === 'classes-curriculum' && (
        <ClassCurriculumView
          classes={classes}
          subjects={subjects}
          curriculums={curriculums}
          teachers={teachers}
          departments={departments}
          assignments={assignments}
          semesterId={context.semesterId}
          schoolYearId={context.schoolYearId}
          initialTab={classCurriculumNavFilter.initialTab || 'CLASSES'}
          initialSearchTerm={classCurriculumNavFilter.searchTerm}
          searchFilterToken={classCurriculumNavFilter.token}
        />
      )}

      {/* 4.5. Bulk Management & Multi-Version Operations */}
      {activeTab === 'bulk-management' && (
        <BulkManagementView
          classes={classes}
          teachers={teachers}
          subjects={subjects}
          departments={departments}
          duties={duties}
          curriculums={curriculums}
          versions={versions}
          assignments={assignments}
          currentVersion={currentVersion}
          schoolYearId={context.schoolYearId}
          semesterId={context.semesterId}
          versionId={context.versionId}
          onNavigateToAssignments={() => setActiveTab('assignments')}
        />
      )}

      {/* 4.8. User Management & Permissions (Danh sách người dùng & Phân quyền) */}
      {activeTab === 'users-management' && (
        <ErrorBoundary fallbackTitle="Quản lý người dùng & Cấp quyền trường học">
          <UserManagementView
            users={users}
            currentUser={currentUser}
            departments={departments}
            teachers={teachers}
            onOpenSchoolSetup={() => setIsInitialSetupOpen(true)}
          />
        </ErrorBoundary>
      )}

      {/* 5. Conflict Validation & Diagnostics */}
      {activeTab === 'validation' && (
        <ValidationConflictView
          validation={validation}
          calculations={calculations}
          onNavigateToAssignments={() => setActiveTab('assignments')}
          onRefreshValidation={() => {
            // Re-trigger calculation
            setAssignments([...dataStore.getAssignments(undefined, undefined, undefined, true)]);
          }}
        />
      )}

      {/* 6. 15 Specialized Reports & Analytics */}
      {activeTab === 'reports' && (
        <ReportsAnalyticsView
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          departments={departments}
          duties={duties}
          curriculums={curriculums}
          assignments={activeAssignmentsForVersion}
          calculations={calculations}
          validation={validation}
          auditLogs={auditLogs}
          schoolYearId={context.schoolYearId}
          semesterId={context.semesterId}
          currentVersion={currentVersion}
          onExportExcel={handleExportExcel}
        />
      )}

      {/* 6.1 Abbreviation Directory Management */}
      {activeTab === 'abbreviations' && (
        <AbbreviationManagementView onNavigate={(tab) => setActiveTab(tab as ActiveTab)} />
      )}

      {/* 7. Version & Semester Comparison */}
      {activeTab === 'compare' && (
        <VersionComparisonView
          versions={versions}
          assignments={assignments}
          calculations={calculations}
          teachers={teachers}
          subjects={subjects}
          classes={classes}
          departments={departments}
        />
      )}

      {/* 8. Audit Log & Teacher Feedback */}
      {activeTab === 'audit-feedback' && (
        <AuditLogFeedbackView
          auditLogs={auditLogs}
          feedbacks={feedbacks}
          currentUser={currentUser}
        />
      )}

      {/* 9. Section XV System Tests */}
      {activeTab === 'system-tests' && <SystemTestRunnerView />}

      {/* Modals */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onExportExcel={handleExportExcel}
      />

      <NewVersionModal
        isOpen={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        versions={versions}
        schoolYearId={context.schoolYearId}
        semesterId={context.semesterId}
      />

      <SchoolBranchSetupModal
        isOpen={isInitialSetupOpen}
        onClose={() => setIsInitialSetupOpen(false)}
        onComplete={() => setIsInitialSetupOpen(false)}
      />

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
        departments={departments}
        calculations={calculations}
        assignments={assignments}
        curriculums={curriculums}
        currentVersion={currentVersion}
        semesterId={context.semesterId}
        onNavigate={handleGlobalSearchNavigate}
      />
    </Layout>
  );
}
