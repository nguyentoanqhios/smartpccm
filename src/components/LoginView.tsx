/**
 * Phân công chuyên môn thông minh - Hỗ trợ Firebase Auth & Multi-tenant
 * LoginView Component: Đăng nhập Email/Mật khẩu với Firebase Auth
 */

import React, { useState, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  School,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  UserPlus,
  CheckCircle2,
  Building2,
  Globe,
  Copy,
  KeyRound,
} from 'lucide-react';
import { dataStore, isSameEmail, isSuperAdminEmail, isThongKeSchool, isSystemSyncEmail, isAdminSchool } from '../repositories/dataStore';
import { UserProfile, SchoolTenantLicense } from '../types';

interface LoginViewProps {
  onLoginSuccess?: (user: UserProfile) => void;
  onContinueOfflineDemo?: (user?: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onContinueOfflineDemo,
}) => {
  const urlParams = useMemo(() => dataStore.detectUrlSchoolParams(), []);
  const detectedUrlSchoolId = urlParams.schoolId || dataStore.detectUrlSchoolId();
  const rawSchoolId = detectedUrlSchoolId || dataStore.getSchoolId() || 'school_admin';
  const initialSchoolId = isAdminSchool(rawSchoolId) ? 'school_admin' : rawSchoolId;
  const initialLicense = dataStore.getSchoolLicenseById(initialSchoolId);
  const isDedicatedSchoolLink = Boolean(
    (detectedUrlSchoolId && !isAdminSchool(detectedUrlSchoolId)) ||
    (initialSchoolId && !isAdminSchool(initialSchoolId))
  );
  const initialSchoolName =
    urlParams.schoolName ||
    (isAdminSchool(initialSchoolId) ? 'TRƯỜNG THCS ADMIN' : initialLicense?.schoolName) ||
    'TRƯỜNG THCS ADMIN';
  const initialEmail =
    (urlParams.adminEmail && !isSystemSyncEmail(urlParams.adminEmail))
      ? urlParams.adminEmail
      : (initialLicense?.adminEmail && !isSystemSyncEmail(initialLicense.adminEmail))
      ? initialLicense.adminEmail
      : (isAdminSchool(initialSchoolId)
        ? 'nguyentoanqh@gmail.com'
        : '');
  const initialPass = urlParams.pass || '';

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(initialPass);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(urlParams.adminName || initialLicense?.adminName || '');
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'INVALID_CREDENTIAL' | 'EMAIL_IN_USE' | 'UNAUTHORIZED_DOMAIN' | 'GENERAL' | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lắng nghe dữ liệu trường & tải license từ Firestore nếu cần
  React.useEffect(() => {
    // Luôn tải danh sách bản quyền mới nhất từ Cloud Firestore khi mở trang đăng nhập
    dataStore.loadLicensesFromCloud().catch(() => {});

    if (initialSchoolId && !isAdminSchool(initialSchoolId)) {
      dataStore.ensureSchoolLicenseLoaded(initialSchoolId).then((loadedLic) => {
        if (loadedLic) {
          if ((!urlParams.schoolName || urlParams.schoolName === 'TRƯỜNG THCS MỚI') && loadedLic.schoolName && loadedLic.schoolName !== 'TRƯỜNG THCS MỚI') {
            setSchoolName(loadedLic.schoolName);
          }
          if (!urlParams.adminEmail && loadedLic.adminEmail && !email) {
            setEmail(loadedLic.adminEmail);
          }
        }
      }).catch(() => {});
    }

    const unsub = dataStore.subscribe(() => {
      const curLic = dataStore.getSchoolLicenseById(schoolId || initialSchoolId);
      if (curLic) {
        if ((!urlParams.schoolName || urlParams.schoolName === 'TRƯỜNG THCS MỚI') && curLic.schoolName && curLic.schoolName !== 'TRƯỜNG THCS MỚI') {
          const finalName = isAdminSchool(schoolId || initialSchoolId) ? 'TRƯỜNG THCS ADMIN' : curLic.schoolName;
          setSchoolName(finalName);
        }
        if (curLic.adminEmail && !email && !urlParams.adminEmail) {
          setEmail(curLic.adminEmail);
        }
      }
    });

    return () => unsub();
  }, [initialSchoolId, schoolId, urlParams, email]);

  // Trạng thái chờ xác thực mật khẩu cấp phép khi dùng Google Sign-In chưa liên kết
  const [pendingGoogleAuth, setPendingGoogleAuth] = useState<{ user: any; targetSchool: string } | null>(null);
  const [activationPass, setActivationPass] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);

  // Danh sách trường học & bản quyền từ dataStore
  const schoolLicensesList = dataStore.getSchoolLicenses();

  const getFriendlyErrorMessage = (err: any): string => {
    const code = err?.code || '';
    if (code === 'auth/unauthorized-domain') {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'smartpccm.vercel.app';
      return `Tên miền website này (${hostname}) chưa được thêm vào mục "Authorized domains" trong Firebase Console (Authentication > Settings > Authorized domains). Quý Thầy/Cô vui lòng đăng nhập trực tiếp bằng Email & Mật khẩu do Ban Quản trị cấp để vào hệ thống ngay!`;
    }
    if (code === 'auth/popup-blocked') {
      return 'Trình duyệt đã chặn cửa sổ pop-up đăng nhập Google. Quý Thầy/Cô vui lòng bấm cho phép mở pop-up trên thanh địa chỉ hoặc đăng nhập bằng Email và Mật khẩu do Ban Quản trị cấp.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại Email và Mật khẩu do Ban Quản trị cấp.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Email này đã được đăng ký tài khoản. Vui lòng chuyển sang tab Đăng nhập.';
    }
    if (code === 'auth/weak-password') {
      return 'Mật khẩu quá ngắn, yêu cầu tối thiểu 6 ký tự.';
    }
    if (code === 'auth/invalid-email') {
      return 'Địa chỉ email không đúng định dạng.';
    }
    if (code === 'auth/user-disabled') {
      return 'Tài khoản này đã bị tạm khóa bởi quản trị viên.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Quá nhiều lần thử thất bại. Vui lòng thử lại sau ít phút.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Lỗi kết nối mạng đến Firebase. Vui lòng kiểm tra lại đường truyền internet.';
    }
    return err?.message || 'Đã xảy ra lỗi trong quá trình xác thực.';
  };

  // Đăng nhập nhanh bằng tài khoản Google (Google Sign-In)
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const fbUser = cred.user;
      const gEmail = fbUser.email || '';

      if (isSystemSyncEmail(gEmail)) {
        setErrorMessage('Tài khoản này là tài khoản dịch vụ đồng bộ ngầm của hệ thống, không dùng để đăng nhập.');
        setIsLoading(false);
        return;
      }

      // Luôn đồng bộ danh sách license từ Cloud
      await dataStore.loadLicensesFromCloud().catch(() => {});
      const allLicenses = dataStore.getSchoolLicenses();

      const isThongKe = isSameEmail(gEmail, 'thongke.qh@gmail.com');
      const isSuper = isSuperAdminEmail(gEmail);

      // 1. Kiểm tra email xem có khớp với adminEmail của bản quyền trường nào không
      const matchingLic = allLicenses.find((l) => isSameEmail(l.adminEmail, gEmail));

      // 2. Kiểm tra email có trong danh sách tài khoản người dùng đã tạo của trường
      let profile = dataStore.getUsers().find((u) => isSameEmail(u.email, gEmail));

      // 3. Kiểm tra email có trong danh bạ giáo viên của trường
      const teacherMatch = dataStore.getTeachers().find((t) => isSameEmail(t.email, gEmail));

      // Xác định trường mục tiêu
      const targetSchool = matchingLic?.id || profile?.schoolId || schoolId || urlParams.schoolId || (isThongKe ? 'school_thongke' : 'school_admin');
      const targetLic = matchingLic || dataStore.getSchoolLicenseById(targetSchool);

      // KIỂM TRA BẢO MẬT BẮT BUỘC:
      // Chỉ cho phép đăng nhập nếu tài khoản thuộc 1 trong các nhóm hợp lệ:
      // - Super Admin (Thầy Toàn)
      // - Quản trị viên được cấp phép của trường (matchingLic)
      // - Tài khoản người dùng đã được tạo trong hệ thống (profile)
      // - Giáo viên có trong danh bạ trường (teacherMatch)
      const isAuthorized = isSuper || Boolean(matchingLic) || Boolean(profile) || Boolean(teacherMatch);

      if (!isAuthorized) {
        await signOut(auth).catch(() => {});
        if (typeof window !== 'undefined') {
          sessionStorage.clear();
        }
        setErrorMessage(
          `Tài khoản Google (${gEmail}) chưa được cấp quyền truy cập vào ${targetLic?.schoolName || 'hệ thống'}. Quý Thầy/Cô vui lòng liên hệ Ban Giám hiệu / Quản trị viên để được thêm vào danh sách người dùng, hoặc đăng nhập bằng Email & Mật khẩu do Ban Quản trị cấp.`
        );
        setIsLoading(false);
        return;
      }

      // Tự động kiểm tra bản quyền trường nếu cần
      if (targetLic && targetLic.status === 'locked' && !isSuper) {
        await signOut(auth).catch(() => {});
        setErrorMessage(`Trường [${targetLic.schoolName}] đã bị tạm khóa: ${targetLic.lockedReason || 'Liên hệ quản trị viên'}.`);
        setIsLoading(false);
        return;
      }

      if (!profile) {
        const assignedRole = isSuper ? 'admin' : (matchingLic ? 'admin' : 'teacher');
        const assignedPerm = (isSuper || matchingLic) ? 'edit' : 'view';
        const assignedTitle = isSuper
          ? 'Chủ sở hữu & Quản trị viên Tối cao'
          : (matchingLic ? 'Quản trị viên trường' : 'Giáo viên bộ môn');

        profile = dataStore.addUser({
          name: fbUser.displayName || (isSuper ? 'Thầy Nguyễn Văn Toàn' : targetLic?.adminName || gEmail.split('@')[0]),
          email: gEmail,
          authUid: fbUser.uid,
          schoolId: targetSchool,
          role: assignedRole,
          roleTitle: assignedTitle,
          permission: assignedPerm,
          isSuperAdmin: isSuper,
          status: 'active',
        });
      } else {
        dataStore.updateUser(profile.id, {
          authUid: fbUser.uid,
          schoolId: targetSchool,
          status: 'active',
          ...(isSuper ? { isSuperAdmin: true, roleTitle: 'Chủ sở hữu & Quản trị viên Tối cao', permission: 'edit', role: 'admin' } : {}),
        });
        profile = dataStore.getUserById(profile.id)!;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pccm_authenticated_session', 'true');
        sessionStorage.setItem(`pccm_session_auth_${targetSchool}`, 'true');
        sessionStorage.setItem('pccm_session_school_id', targetSchool);
        sessionStorage.setItem('pccm_session_user_email', gEmail);
        if (isSuper) {
          sessionStorage.setItem('pccm_is_super_admin', 'true');
        } else {
          sessionStorage.removeItem('pccm_is_super_admin');
        }
      }
      dataStore.setSchoolId(targetSchool);
      dataStore.setCurrentUser(profile);
      setSuccessMessage('Đăng nhập Google thành công!');
      if (onLoginSuccess) {
        onLoginSuccess(profile);
      } else if (onContinueOfflineDemo) {
        onContinueOfflineDemo(profile);
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        setErrorType('UNAUTHORIZED_DOMAIN');
      }
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Đã đóng cửa sổ đăng nhập Google. Bạn có thể thử lại hoặc đăng nhập bằng Email/Mật khẩu.');
      } else {
        setErrorMessage(getFriendlyErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorType(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (isSystemSyncEmail(trimmedEmail)) {
      setErrorMessage('Tài khoản này là tài khoản dịch vụ đồng bộ ngầm của hệ thống, không dùng để đăng nhập. Vui lòng đăng nhập bằng tài khoản Quản trị viên Tối cao (nguyentoanqh@gmail.com / nguyentoanqhios@gmail.com) hoặc tài khoản trường học.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Luôn đồng bộ toàn bộ licenses từ Cloud Firestore về trước
    await dataStore.loadLicensesFromCloud().catch(() => {});

    // 2. Xác định chính xác tenant và license của trường
    const allLicenses = dataStore.getSchoolLicenses();
    let matchingLicense = allLicenses.find((l) => isSameEmail(l.adminEmail, trimmedEmail));

    // Nếu chưa thấy trong bộ nhớ, tìm thêm trong danh sách backup đã lưu của browser
    if (!matchingLicense && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('pccm_all_registered_school_licenses');
        if (raw) {
          const backupLics = JSON.parse(raw) as SchoolTenantLicense[];
          matchingLicense = backupLics.find((l) => isSameEmail(l.adminEmail, trimmedEmail));
          if (matchingLicense) {
            dataStore.saveSchoolLicense(matchingLicense);
          }
        }
      } catch {}
    }

    // Xác định mã trường mục tiêu: Ưu tiên license khớp email -> detectedUrlSchoolId -> schoolId đã chọn
    let targetSchoolId = matchingLicense?.id;
    if (!targetSchoolId) {
      if (detectedUrlSchoolId && !isAdminSchool(detectedUrlSchoolId)) {
        targetSchoolId = detectedUrlSchoolId;
      } else if (schoolId && !isAdminSchool(schoolId)) {
        targetSchoolId = schoolId;
      } else {
        targetSchoolId = 'school_admin';
      }
    }

    let targetLic = matchingLicense || dataStore.getSchoolLicenseById(targetSchoolId);
    if (!targetLic || !targetLic.assignedPasswordHint) {
      targetLic = (await dataStore.ensureSchoolLicenseLoaded(targetSchoolId)) || targetLic;
    }

    const isSuperAdmin = isSuperAdminEmail(trimmedEmail);

    // BẢO MẬT MULTI-TENANT CÁCH LY CHẶT CHẼ:
    // Ngăn chặn tài khoản Super Admin đăng nhập tại đường link riêng của trường bất kỳ
    if (isSuperAdmin && isDedicatedSchoolLink && !isAdminSchool(targetSchoolId)) {
      setIsLoading(false);
      setErrorType('INVALID_CREDENTIAL');
      setErrorMessage(
        `BẢO MẬT MULTI-TENANT: Tài khoản Quản trị viên Tối cao (${trimmedEmail}) chỉ được phép đăng nhập tại Cổng Quản trị Trung tâm (school_admin) để bảo đảm cách ly dữ liệu giữa các trường. Tại liên kết riêng của trường [${targetLic?.schoolName || 'đơn vị'}], vui lòng đăng nhập bằng tài khoản quản trị trường hoặc tài khoản cán bộ giáo viên được cấp phép!`
      );
      return;
    }

    // Ngăn chặn tài khoản trường ngoài đăng nhập nhầm vào trường admin
    if (!isSuperAdmin && isAdminSchool(targetSchoolId)) {
      const isQuyHopTeacher = dataStore.getUsers().some((u) => (isAdminSchool(u.schoolId) || !u.schoolId) && isSameEmail(u.email, trimmedEmail));
      if (!isQuyHopTeacher) {
        setIsLoading(false);
        setErrorType('INVALID_CREDENTIAL');
        setErrorMessage('Tài khoản không thuộc quyền quản lý của đơn vị TRƯỜNG THCS ADMIN. Vui lòng truy cập theo liên kết riêng của trường đã được Ban Quản trị cấp phép.');
        return;
      }
    }

    // Kiểm tra bản quyền trường học (ngoại trừ tài khoản Chủ sở hữu nguyentoanqh@gmail.com / nguyentoanqhios@gmail.com)
    if (!isSuperAdmin) {
      const licCheck = dataStore.checkSchoolLicense(targetSchoolId);
      if (!licCheck.isValid) {
        setIsLoading(false);
        setErrorMessage(
          `Bản quyền của trường [${licCheck.schoolName}] đã bị khóa hoặc hết hạn: ${licCheck.lockedReason || licCheck.message}. Vui lòng liên hệ Nguyễn Văn Toàn (nguyentoanqh@gmail.com - 0961 285 888) để gia hạn.`
        );
        return;
      }
    }

    // XÁC THỰC MẬT KHẨU VÀ ĐĂNG NHẬP
    const assignedPass = targetLic?.assignedPasswordHint?.trim() || (urlParams.schoolId === targetSchoolId ? urlParams.pass?.trim() : undefined);
    const existingUser = dataStore.getUsers().find((u) => isSameEmail(u.email, trimmedEmail));

    let isValidPass = false;
    if (existingUser?.password) {
      // Ưu tiên mật khẩu cá nhân do người dùng hoặc quản trị viên thiết lập riêng
      isValidPass = password === existingUser.password;
    } else if (isSuperAdmin) {
      isValidPass = password === '123456' || (assignedPass ? password === assignedPass : false);
    } else if (!isAdminSchool(targetSchoolId)) {
      // Trường được cấp quyền riêng: BẮT BUỘC ĐÚNG MẬT KHẨU ĐƯỢC CẤP
      if (assignedPass) {
        isValidPass = password === assignedPass;
      } else if (urlParams.pass) {
        isValidPass = password === urlParams.pass.trim();
      } else {
        isValidPass = password === '123456';
      }
      if (!isValidPass) {
        setIsLoading(false);
        setErrorType('INVALID_CREDENTIAL');
        setErrorMessage('Mật khẩu không chính xác! Vui lòng nhập đúng mật khẩu được Ban Quản trị cấp cho trường học của bạn.');
        return;
      }
    } else {
      isValidPass = password === '123456' || (assignedPass ? password === assignedPass : false);
    }

    if (!isValidPass) {
      setErrorType('INVALID_CREDENTIAL');
      setErrorMessage('Mật khẩu không chính xác. Vui lòng nhập đúng email và mật khẩu do Ban Quản trị cấp.');
      setIsLoading(false);
      return;
    }

      // Mật khẩu chính xác -> Cấp quyền đăng nhập vào trường
      let profile = dataStore.getUsers().find((u) => isSameEmail(u.email, trimmedEmail));
      if (!profile) {
        profile = dataStore.addUser({
          name: isSuperAdmin
            ? 'Thầy Nguyễn Văn Toàn'
            : targetLic?.adminName || urlParams.adminName || 'Quản trị viên trường',
          email: trimmedEmail,
          schoolId: targetSchoolId,
          role: 'admin',
          roleTitle: isSuperAdmin ? 'Chủ sở hữu & Quản trị viên Tối cao' : 'Quản trị viên trường',
          permission: 'edit',
          isSuperAdmin: isSuperAdmin,
          status: 'active',
        });
      } else {
        dataStore.updateUser(profile.id, {
          schoolId: targetSchoolId,
          status: 'active',
          permission: 'edit',
          isSuperAdmin: isSuperAdmin,
          roleTitle: isSuperAdmin ? 'Chủ sở hữu & Quản trị viên Tối cao' : (profile.roleTitle && !profile.roleTitle.includes('Tối cao') ? profile.roleTitle : 'Quản trị viên trường'),
        });
        profile = dataStore.getUserById(profile.id)!;
      }

      // Lưu trạng thái phiên làm việc vào sessionStorage (tự động xóa khi đóng tab/cửa sổ)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pccm_authenticated_session', 'true');
        sessionStorage.setItem(`pccm_session_auth_${targetSchoolId}`, 'true');
        sessionStorage.setItem('pccm_session_school_id', targetSchoolId);
        sessionStorage.setItem('pccm_session_user_email', trimmedEmail);
        if (isSuperAdmin) {
          sessionStorage.setItem('pccm_is_super_admin', 'true');
        } else {
          sessionStorage.removeItem('pccm_is_super_admin');
        }
      }

      // Đảm bảo cơ sở dữ liệu trường học được tải về đầy đủ từ Cloud Firestore (tránh mất trắng dữ liệu khi deploy code mới)
      await dataStore.ensureSchoolDataLoaded(targetSchoolId);
      dataStore.setCurrentUser(profile);
      setSuccessMessage(isSuperAdmin ? 'Đăng nhập thành công với quyền Chủ sở hữu hệ thống (Super Admin)!' : 'Đăng nhập thành công với tài khoản quản trị trường!');
      
      // Đồng bộ ngầm với Firebase nếu có
      signInWithEmailAndPassword(auth, trimmedEmail, password).catch(() => {});

      if (onLoginSuccess) {
        onLoginSuccess(profile);
      } else if (onContinueOfflineDemo) {
        onContinueOfflineDemo(profile);
      }
      return;
    } catch (err: any) {
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-800 selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Logo & School Badge */}
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-white/10">
            <School className="w-9 h-9 text-white" />
          </div>
        </div>

        <h1 className="text-center text-xl sm:text-2xl font-black text-white tracking-tight">
          HỆ THỐNG PHÂN CÔNG CHUYÊN MÔN
        </h1>
        <p className="mt-1 text-center text-xs sm:text-sm text-blue-200/80 font-medium">
          Hỗ trợ kiến trúc Multi-tenant & Xác thực Firebase
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-slate-100 relative overflow-hidden">
          {/* Top Decorative accent bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />

          {/* Target School Portal Banner */}
          <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md border border-blue-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0 font-bold text-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200">
                  Cổng đăng nhập đơn vị trường học
                </div>
                <div className="text-sm sm:text-base font-black text-white truncate">
                  {schoolName}
                </div>
                <div className="text-[11px] text-blue-200 flex items-center gap-1.5 flex-wrap">
                  <span>Email quản trị được cấp:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {urlParams.adminEmail || initialLicense?.adminEmail || (schoolId === 'school_thongke' ? 'thongke.qh@gmail.com' : isAdminSchool(schoolId) ? 'nguyentoanqh@gmail.com' : '(Liên hệ quản trị viên)')}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-blue-200 truncate max-w-[200px] sm:max-w-xs font-mono text-[10px]">
                Mã trường: {schoolId}
              </span>
              <button
                type="button"
                onClick={() => {
                  let base = '';
                  if (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') {
                    const origin = window.location.origin;
                    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
                      base = `${origin.replace('ais-dev-', 'ais-pre-')}${window.location.pathname.replace(/\/$/, '')}`;
                    } else {
                      base = `${origin}${window.location.pathname.replace(/\/$/, '')}`;
                    }
                  }
                  const params = new URLSearchParams();
                  params.set('schoolId', schoolId);
                  if (schoolName) params.set('schoolName', schoolName);
                  const admEmail = urlParams.adminEmail || initialLicense?.adminEmail;
                  if (admEmail) params.set('adminEmail', admEmail);
                  const passHint = urlParams.pass || initialLicense?.assignedPasswordHint;
                  if (passHint) params.set('pass', passHint);
                  const fullUrl = `${base}?${params.toString()}`;
                  navigator.clipboard.writeText(fullUrl);
                  setSuccessMessage('Đã sao chép link đăng nhập của trường này!');
                  setTimeout(() => setSuccessMessage(null), 3000);
                }}
                className="text-[10px] text-amber-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/20 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Sao chép link trường</span>
              </button>
            </div>
          </div>

          {/* Tiêu đề Đăng nhập hệ thống bảo mật (Đã ẩn đăng ký công khai) */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-5 pb-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-900">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Đăng nhập tài khoản trường</div>
              <div className="text-[11px] text-slate-500 font-medium">Sử dụng Email & Mật khẩu do Ban Quản trị cấp phép</div>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col gap-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">{errorMessage}</div>
              </div>
              {errorType === 'EMAIL_IN_USE' && (
                <div className="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-rose-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setErrorMessage(null);
                      setErrorType(null);
                    }}
                    className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] transition cursor-pointer shadow-xs"
                  >
                    👉 Chuyển sang Đăng nhập với email này
                  </button>
                </div>
              )}
              {errorType === 'INVALID_CREDENTIAL' && (
                <div className="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-rose-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setErrorMessage(null);
                      setErrorType(null);
                    }}
                    className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] transition cursor-pointer shadow-xs"
                  >
                    👉 Đăng ký tài khoản mới với email này
                  </button>
                </div>
              )}
              {errorType === 'UNAUTHORIZED_DOMAIN' && (
                <div className="flex flex-col gap-2 mt-1 pt-2 border-t border-rose-200/70">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const host = typeof window !== 'undefined' ? window.location.hostname : 'run.app';
                        navigator.clipboard.writeText(host);
                        setSuccessMessage(`Đã sao chép tên miền: ${host}`);
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }}
                      className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Sao chép tên miền ({typeof window !== 'undefined' ? window.location.hostname : 'run.app'})
                    </button>
                    <a
                      href="https://console.firebase.google.com/project/smartpccm/authentication/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Mở Firebase Console (Authorized domains) ↗
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                    💡 <b>Cách nhanh nhất:</b> Quý Thầy/Cô đăng nhập trực tiếp bằng <b>Email & Mật khẩu</b> do Ban Quản trị cấp ở khung bên dưới để vào hệ thống ngay lập tức mà không cần cấu hình tên miền.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trường học / Multi-tenant School selection */}
            {/* Trường học / Multi-tenant School selection hoặc cổng trường riêng cố định */}
            {isDedicatedSchoolLink ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Đơn vị trường học
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã cấp bản quyền
                  </span>
                </div>
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl shadow-2xs text-xs font-bold text-slate-800 select-none">
                  <Building2 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="truncate font-black">{schoolName}</span>
                  <span className="text-slate-400 font-mono text-[11px] shrink-0">({schoolId})</span>
                  <span className="ml-auto text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md font-semibold shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cổng trường riêng
                  </span>
                </div>
              </div>
            ) : isRegisterMode ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tên đơn vị trường học (Nhận phần mềm dữ liệu trắng riêng biệt)
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4 text-blue-700" />
                  </div>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ví dụ: TRƯỜNG THCS BÌNH MINH"
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Đơn vị trường học (Tenant cơ sở dữ liệu)
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <select
                    value={isAdminSchool(schoolId) ? 'school_admin' : schoolId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setSchoolId(selId);
                      const found = schoolLicensesList.find((l) => (isAdminSchool(selId) ? isAdminSchool(l.id) : l.id === selId));
                      if (found) {
                        setSchoolName(isAdminSchool(selId) ? 'TRƯỜNG THCS ADMIN' : found.schoolName);
                        if (!email || email.includes('admin.')) {
                          setEmail(found.adminEmail);
                          setPassword(found.assignedPasswordHint || '');
                        }
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  >
                    {schoolLicensesList
                      .filter((lic) => !isThongKeSchool(lic.id, lic.schoolName) && lic.id !== 'school_thongke')
                      .map((lic) => {
                        const isAdm = isAdminSchool(lic.id);
                        const optId = isAdm ? 'school_admin' : lic.id;
                        const optName = isAdm ? 'TRƯỜNG THCS ADMIN' : lic.schoolName;
                        return (
                          <option key={optId} value={optId}>
                            {optName} ({optId}) {lic.status === 'locked' ? '🔒 Đã khóa' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>
              </div>
            )}

            {/* Họ và tên (nếu đăng ký mới) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Họ và tên cán bộ quản trị / phụ trách
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Thầy Nguyễn Văn Toàn"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  required
                />
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Địa chỉ Email
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    const clean = val.trim().toLowerCase();
                    const found = schoolLicensesList.find((l) => isSameEmail(l.adminEmail, clean));
                    if (found) {
                      setSchoolId(found.id);
                      setSchoolName(found.schoolName);
                    }
                  }}
                  placeholder="admin@truong.edu.vn"
                  autoComplete="username"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mật khẩu
              </label>
              <div className="relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  required
                  className="w-full pl-9 pr-10 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isRegisterMode && (
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <span>🔑 Mật khẩu do Ban Quản trị cấp</span>
                </p>
              )}
            </div>

            {/* Confirm Password (nếu đăng ký mới) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Xác nhận lại mật khẩu
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl shadow-md text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 transition disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>Đăng nhập hệ thống</span>
            </button>

            {/* Note about Email/Password login */}
            <p className="text-[11px] text-slate-500 text-center leading-relaxed px-1 mt-2">
              🔒 Đăng nhập bảo mật bằng Email & Mật khẩu do Ban Quản trị cấp phép.
            </p>
          </form>



          {/* Security & Multi-tenant note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dữ liệu phân quyền được lưu trữ theo từng School ID</span>
          </div>
        </div>

        {/* Footer Copyright */}
        <div className="mt-6 text-center text-xs text-blue-200/60 font-medium">
          Copyright ©2026 Nguyentoanqh - Phân công chuyên môn THCS
        </div>
      </div>
    </div>
  );
};
