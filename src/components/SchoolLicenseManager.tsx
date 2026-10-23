import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Lock,
  Unlock,
  Calendar,
  Clock,
  KeyRound,
  Mail,
  Phone,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  Info,
  Check,
  UserCheck,
  ArrowRightLeft,
  Users,
  Globe,
  UploadCloud,
  DownloadCloud,
  Cloud,
  GraduationCap,
  UserPlus,
  Eye,
  BookOpen,
} from 'lucide-react';
import { SchoolTenantLicense, LicensePlanType, UserProfile, SchoolClass, Teacher } from '../types';
import { dataStore } from '../repositories/dataStore';
import { firestoreRepository } from '../repositories/firestoreRepository';
import { ensureFirebaseAuth } from '../firebase/config';

interface SchoolLicenseManagerProps {
  currentUser: UserProfile;
}

export const SchoolLicenseManager: React.FC<SchoolLicenseManagerProps> = ({ currentUser }) => {
  const [licenses, setLicenses] = useState<SchoolTenantLicense[]>(() => dataStore.getSchoolLicenses());
  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => dataStore.getSchoolId());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'locked' | 'expired'>('ALL');

  // Cloud Sync States
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isCloudPulling, setIsCloudPulling] = useState(false);

  // Quick Class modal states
  const [quickClassSchool, setQuickClassSchool] = useState<SchoolTenantLicense | null>(null);
  const [qcName, setQcName] = useState('');
  const [qcGrade, setQcGrade] = useState<number>(6);
  const [qcSession, setQcSession] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [qcStudentCount, setQcStudentCount] = useState<number>(38);

  // Quick Teacher modal states
  const [quickTeacherSchool, setQuickTeacherSchool] = useState<SchoolTenantLicense | null>(null);
  const [qtCode, setQtCode] = useState('');
  const [qtName, setQtName] = useState('');
  const [qtGender, setQtGender] = useState<'Nam' | 'Nữ'>('Nữ');
  const [qtDeptId, setQtDeptId] = useState('dept_toan_tin');
  const [qtQuota, setQtQuota] = useState(19);
  const [qtSubjects, setQtSubjects] = useState('Toán');

  // Quick Manage & View Modal state
  const [quickManageSchool, setQuickManageSchool] = useState<SchoolTenantLicense | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SchoolTenantLicense | null>(null);
  const [lockModalLicense, setLockModalLicense] = useState<SchoolTenantLicense | null>(null);
  const [lockReasonInput, setLockReasonInput] = useState('');
  const [expiryModalLicense, setExpiryModalLicense] = useState<SchoolTenantLicense | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [handoverModalLicense, setHandoverModalLicense] = useState<SchoolTenantLicense | null>(null);
  const [deleteConfirmLicense, setDeleteConfirmLicense] = useState<SchoolTenantLicense | null>(null);
  const [isCloudflareGuideOpen, setIsCloudflareGuideOpen] = useState(false);
  const [handoverDomainMode, setHandoverDomainMode] = useState<'CURRENT' | 'PREVIEW' | 'CUSTOM'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pccm_handover_domain_mode');
      if (saved === 'CURRENT' || saved === 'PREVIEW' || saved === 'CUSTOM') return saved;
    }
    return 'CURRENT';
  });
  const [handoverCustomDomain, setHandoverCustomDomain] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pccm_handover_custom_domain') || '';
    }
    return '';
  });

  const updateDomainMode = (mode: 'CURRENT' | 'PREVIEW' | 'CUSTOM') => {
    setHandoverDomainMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pccm_handover_domain_mode', mode);
      } catch {}
    }
  };

  const updateCustomDomain = (val: string) => {
    setHandoverCustomDomain(val);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pccm_handover_custom_domain', val);
      } catch {}
    }
  };

  // Form states
  const [formSchoolName, setFormSchoolName] = useState('');
  const [formSchoolId, setFormSchoolId] = useState('');
  const [formAdminEmail, setFormAdminEmail] = useState('');
  const [formPasswordHint, setFormPasswordHint] = useState('');
  const [formAdminName, setFormAdminName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPlanType, setFormPlanType] = useState<LicensePlanType>('trial');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMaxTeachers, setFormMaxTeachers] = useState<number>(150);
  const [formMaxClasses, setFormMaxClasses] = useState<number>(60);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Re-sync listener & auto-load cloud licenses on mount
  React.useEffect(() => {
    dataStore.loadLicensesFromCloud().then(() => {
      setLicenses(dataStore.getSchoolLicenses());
    }).catch(() => {});

    const unsubscribe = dataStore.subscribe(() => {
      setLicenses(dataStore.getSchoolLicenses());
      setCurrentSchoolId(dataStore.getSchoolId());
    });
    return () => unsubscribe();
  }, []);

  // BẢN CẤP QUYỀN CHO TRƯỜNG HỌC: Chỉ hiển thị các trường đối tác được cấp quyền, KHÔNG hiển thị trường gốc Quỳ Hợp
  const partnerLicenses = useMemo(() => {
    return licenses.filter((l) => l.id !== 'school_quyhop');
  }, [licenses]);

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    const now = Date.now();
    return partnerLicenses.filter((lic) => {
      if (searchTerm) {
        const text = `${lic.schoolName} ${lic.adminEmail} ${lic.id} ${lic.adminName || ''} ${lic.contactPhone || ''}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }

      const isExpired = lic.expiresAt && new Date(lic.expiresAt).getTime() <= now;
      if (statusFilter === 'active') {
        if (lic.status !== 'active' || isExpired) return false;
      } else if (statusFilter === 'locked') {
        if (lic.status !== 'locked') return false;
      } else if (statusFilter === 'expired') {
        if (!isExpired) return false;
      }

      return true;
    });
  }, [partnerLicenses, searchTerm, statusFilter]);

  // Statistics (Chỉ tính cho các trường đối tác được cấp quyền)
  const now = Date.now();
  const totalCount = partnerLicenses.length;
  const activeCount = partnerLicenses.filter(
    (l) => l.status === 'active' && (!l.expiresAt || new Date(l.expiresAt).getTime() > now)
  ).length;
  const lockedCount = partnerLicenses.filter((l) => l.status === 'locked').length;
  const expiredCount = partnerLicenses.filter(
    (l) => l.status !== 'locked' && l.expiresAt && new Date(l.expiresAt).getTime() <= now
  ).length;

  // Cloud Actions: Đẩy lên Cloud & Tải về từ Cloud
  const handlePushAllToCloud = async () => {
    setIsCloudSyncing(true);
    try {
      await ensureFirebaseAuth();
      const res = await dataStore.syncAllLicensesToCloud();
      if (res.success) {
        showToast(res.message || 'Đã đẩy toàn bộ bản quyền trường học lên Cloud Firestore!', 'success');
      } else {
        showToast(res.message || 'Lỗi khi đẩy lên Cloud Firestore', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi khi đẩy dữ liệu lên Cloud Firestore', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handlePullAllFromCloud = async () => {
    setIsCloudPulling(true);
    try {
      showToast('Đang tải bản quyền và đồng bộ dữ liệu các trường từ Cloud Firestore...', 'warning');
      await ensureFirebaseAuth();
      await dataStore.loadLicensesFromCloud();
      const lics = dataStore.getSchoolLicenses();
      for (const lic of lics) {
        if (lic.id !== 'school_quyhop') {
          await dataStore.pullDataFromFirestore(lic.id).catch(() => {});
        }
      }
      setLicenses([...dataStore.getSchoolLicenses()]);
      showToast('Đã tải và cập nhật toàn bộ bản quyền & dữ liệu trường từ Cloud Firestore thành công!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi tải bản quyền từ Cloud Firestore', 'error');
    } finally {
      setIsCloudPulling(false);
    }
  };

  const handlePushSchoolDataToCloud = async (lic: SchoolTenantLicense) => {
    try {
      showToast(`Đang đẩy dữ liệu [${lic.schoolName}] lên Cloud Firestore...`, 'warning');
      await ensureFirebaseAuth();
      await firestoreRepository.saveSchoolLicense(lic);
      if (dataStore.getSchoolId() === lic.id) {
        await dataStore.syncCurrentDataToFirestore();
      }
      showToast(`Đã đẩy dữ liệu trường [${lic.schoolName}] lên Cloud Firestore thành công!`, 'success');
    } catch (err: any) {
      showToast(`Lỗi đẩy dữ liệu trường [${lic.schoolName}]: ${err?.message}`, 'error');
    }
  };

  const handlePullSchoolDataFromCloud = async (lic: SchoolTenantLicense) => {
    try {
      showToast(`Đang tải dữ liệu [${lic.schoolName}] từ Cloud Firestore...`, 'warning');
      await ensureFirebaseAuth();
      const res = await dataStore.pullDataFromFirestore(lic.id);
      showToast(res.message, res.success ? 'success' : 'error');
      setLicenses([...dataStore.getSchoolLicenses()]);
    } catch (err: any) {
      showToast(`Lỗi tải dữ liệu trường [${lic.schoolName}]: ${err?.message}`, 'error');
    }
  };

  // Quick Add Class Handlers
  const handleOpenQuickClassModal = (lic: SchoolTenantLicense) => {
    setQuickClassSchool(lic);
    const existingClasses = dataStore.getClassesForSchool(lic.id);
    const k6Count = existingClasses.filter((c) => c.grade === 6).length;
    setQcName(`6A${k6Count + 1}`);
    setQcGrade(6);
    setQcSession('MORNING');
    setQcStudentCount(38);
  };

  const handleSaveQuickClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClassSchool) return;
    const name = qcName.trim();
    if (!name) {
      showToast('Vui lòng nhập tên lớp học!', 'error');
      return;
    }
    try {
      dataStore.addClassForSchool(quickClassSchool.id, {
        code: name,
        name,
        grade: qcGrade as 6 | 7 | 8 | 9,
        session: qcSession,
        studentCount: qcStudentCount || 35,
        active: true,
      });
      showToast(`Đã thêm mới lớp "${name}" cho trường "${quickClassSchool.schoolName}" thành công!`, 'success');
      setQuickClassSchool(null);
      setLicenses([...dataStore.getSchoolLicenses()]);
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu lớp học. Vui lòng kiểm tra lại.', 'error');
    }
  };

  // Quick Add Teacher Handlers
  const handleOpenQuickTeacherModal = (lic: SchoolTenantLicense) => {
    setQuickTeacherSchool(lic);
    const existingTeachers = dataStore.getTeachersForSchool(lic.id);
    const nextNum = existingTeachers.length + 1;
    setQtCode(`GV${String(nextNum).padStart(2, '0')}`);
    setQtName('');
    setQtGender('Nữ');
    setQtDeptId('dept_toan_tin');
    setQtQuota(19);
    setQtSubjects('Toán');
  };

  const handleSaveQuickTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTeacherSchool) return;
    const name = qtName.trim();
    const code = qtCode.trim();
    if (!name || !code) {
      showToast('Vui lòng nhập đầy đủ Họ tên và Mã giáo viên!', 'error');
      return;
    }
    try {
      dataStore.addTeacherForSchool(quickTeacherSchool.id, {
        code,
        fullName: name,
        gender: qtGender,
        departmentId: qtDeptId,
        standardQuota: qtQuota,
        status: 'ACTIVE',
        subjectsCanTeach: qtSubjects.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
      });
      showToast(`Đã thêm mới giáo viên "${name}" cho trường "${quickTeacherSchool.schoolName}" thành công!`, 'success');
      setQuickTeacherSchool(null);
      setLicenses([...dataStore.getSchoolLicenses()]);
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu giáo viên. Vui lòng kiểm tra lại.', 'error');
    }
  };

  // Slugify helper for schoolId with collision avoidance
  const generateSchoolId = (name: string): string => {
    const clean = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    let baseId = `school_${clean || 'moi'}`;
    const allLics = dataStore.getSchoolLicenses();
    if (allLics.some((l) => l.id === baseId && l.id !== editingLicense?.id)) {
      baseId = `${baseId}_${Math.random().toString(36).substring(2, 6)}`;
    }
    return baseId;
  };

  const handleOpenAddModal = (licToEdit?: SchoolTenantLicense) => {
    if (licToEdit) {
      setEditingLicense(licToEdit);
      setFormSchoolName(licToEdit.schoolName);
      setFormSchoolId(licToEdit.id);
      setFormAdminEmail(licToEdit.adminEmail);
      setFormPasswordHint(licToEdit.assignedPasswordHint || '');
      setFormAdminName(licToEdit.adminName || '');
      setFormPhone(licToEdit.contactPhone || '');
      setFormPlanType(licToEdit.planType);
      setFormExpiryDate(licToEdit.expiresAt ? licToEdit.expiresAt.split('T')[0] : '');
      setFormNotes(licToEdit.notes || '');
      setFormMaxTeachers(licToEdit.maxTeachers && licToEdit.maxTeachers > 0 ? licToEdit.maxTeachers : 45);
      setFormMaxClasses(licToEdit.maxClasses && licToEdit.maxClasses > 0 ? licToEdit.maxClasses : 25);
    } else {
      setEditingLicense(null);
      setFormSchoolName('');
      setFormSchoolId('');
      setFormAdminEmail('');
      setFormPasswordHint(generateRandomPassword());
      setFormAdminName('');
      setFormPhone('');
      setFormPlanType('trial');
      // Default 30 days trial
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFormExpiryDate(in30Days);
      setFormNotes('');
      setFormMaxTeachers(45);
      setFormMaxClasses(25);
    }
    setIsAddModalOpen(true);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let res = 'App@';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res + '2026';
  };

  const handleSaveLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSchoolName.trim() || !formAdminEmail.trim()) {
      showToast('Vui lòng nhập tên trường và email quản trị.', 'error');
      return;
    }

    // Always generate complete school ID from full school name if not editing
    const rawId = formSchoolId.trim() || generateSchoolId(formSchoolName);
    const sId = editingLicense ? editingLicense.id : (rawId === 'school_quyhop' ? `school_quyhop_${Math.random().toString(36).substring(2, 6)}` : rawId);

    const newLicense: SchoolTenantLicense = {
      id: sId,
      schoolName: formSchoolName.trim(),
      adminEmail: formAdminEmail.trim().toLowerCase(),
      adminName: formAdminName.trim() || undefined,
      assignedPasswordHint: formPasswordHint.trim() || '123456789',
      status: editingLicense ? editingLicense.status : 'active',
      planType: formPlanType,
      expiresAt: formExpiryDate ? new Date(`${formExpiryDate}T23:59:59.000Z`).toISOString() : null,
      contactPhone: formPhone.trim() || undefined,
      notes: formNotes.trim() || undefined,
      maxTeachers: Number(formMaxTeachers) > 0 ? Number(formMaxTeachers) : 200,
      maxClasses: Number(formMaxClasses) > 0 ? Number(formMaxClasses) : 80,
      createdAt: editingLicense ? editingLicense.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dataStore.saveSchoolLicense(newLicense);
    setLicenses([...dataStore.getSchoolLicenses()]);
    setIsAddModalOpen(false);
    showToast(`Đã lưu và cấp quyền cho trường "${formSchoolName.trim()}"!`);

    // Show handover preview for newly added license
    if (!editingLicense) {
      setHandoverModalLicense(newLicense);
    }
  };

  // Lock / Unlock actions
  const handleOpenLockModal = (lic: SchoolTenantLicense) => {
    setLockModalLicense(lic);
    setLockReasonInput('Tạm khóa sử dụng bản quyền theo yêu cầu của Ban Quản trị.');
  };

  const handleConfirmLock = async () => {
    if (!lockModalLicense) return;
    await dataStore.lockSchoolLicense(lockModalLicense.id, lockReasonInput.trim());
    setLicenses(dataStore.getSchoolLicenses());
    showToast(`Đã khóa ngay lập tức quyền sử dụng của trường "${lockModalLicense.schoolName}"`);
    setLockModalLicense(null);
  };

  const handleUnlock = async (lic: SchoolTenantLicense) => {
    await dataStore.unlockSchoolLicense(lic.id);
    setLicenses(dataStore.getSchoolLicenses());
    showToast(`Đã mở khóa thành công cho "${lic.schoolName}"`);
  };

  // Expiry schedule actions
  const handleOpenExpiryModal = (lic: SchoolTenantLicense) => {
    setExpiryModalLicense(lic);
    setNewExpiryDate(lic.expiresAt ? lic.expiresAt.split('T')[0] : '');
  };

  const handleConfirmSetExpiry = async () => {
    if (!expiryModalLicense) return;
    const finalDate = newExpiryDate ? new Date(`${newExpiryDate}T23:59:59.000Z`).toISOString() : null;
    await dataStore.setSchoolLicenseExpiry(expiryModalLicense.id, finalDate);
    setLicenses(dataStore.getSchoolLicenses());
    showToast(`Đã cập nhật hạn sử dụng cho "${expiryModalLicense.schoolName}"`);
    setExpiryModalLicense(null);
  };

  const handleQuickAddDays = (days: number | null) => {
    if (days === null) {
      setNewExpiryDate('');
    } else {
      const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      setNewExpiryDate(d.toISOString().split('T')[0]);
    }
  };

  const getSchoolSlug = (schoolId: string): string => {
    return schoolId.replace(/^school_/, '').toLowerCase();
  };

  // Lấy đường link công khai cho các trường đối tác kèm tham số mã trường (schoolId) & thông tin trường
  const getPublicSharedUrl = (lic?: SchoolTenantLicense | string, modeOverride?: 'CURRENT' | 'PREVIEW' | 'CUSTOM'): string => {
    const licenseObj =
      typeof lic === 'object' && lic !== null
        ? lic
        : typeof lic === 'string'
        ? dataStore.getSchoolLicenseById(lic)
        : undefined;
    const sId = typeof lic === 'string' ? lic : lic?.id;
    const sSlug = sId ? getSchoolSlug(sId) : '';
    
    const mode = modeOverride || handoverDomainMode;
    // Mặc định luôn sử dụng URL đang chạy thực tế trên trình duyệt để 100% người nhận mở được ngay, không bị lỗi 404
    let baseOrigin = 'https://ais-dev-hlghi3ofwxo7bobx6qx5ka-681486933126.asia-east1.run.app';
    if (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') {
      baseOrigin = window.location.origin;
    }

    const sName = licenseObj?.schoolName;
    const sEmail = licenseObj?.adminEmail;

    if (mode === 'PREVIEW') {
      baseOrigin = 'https://ais-pre-hlghi3ofwxo7bobx6qx5ka-681486933126.asia-east1.run.app';
    } else if (mode === 'CUSTOM' && handoverCustomDomain.trim()) {
      let custom = handoverCustomDomain.trim();
      if (!custom.startsWith('http://') && !custom.startsWith('https://')) {
        custom = `https://${custom}`;
      }
      custom = custom.replace(/\/$/, '');

      // 1. Nếu cấu hình mẫu subdomain có placeholder {school} (VD: https://pccm-{school}.pages.dev)
      if (custom.includes('{school}')) {
        return custom.replace('{school}', sSlug || 'main');
      }

      // 2. Nếu người dùng nhập mẫu dạng https://pccm-tentruong.pages.dev
      if (custom.match(/^https?:\/\/pccm-[a-z0-9_-]+\.pages\.dev$/i)) {
        return custom.replace(/^https?:\/\/pccm-[a-z0-9_-]+/i, `https://pccm-${sSlug || 'main'}`);
      }

      // 3. Nếu là domain gốc: truyền đầy đủ tham số để bất kỳ máy nào mở cũng nhận diện đúng tên trường
      if (sId) {
        const params = new URLSearchParams();
        params.set('schoolId', sId);
        if (sName && sName !== 'TRƯỜNG THCS MỚI') params.set('schoolName', sName);
        if (sEmail) params.set('adminEmail', sEmail);
        return `${custom}/?${params.toString()}`;
      }
      return custom;
    }

    const cleanPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
    const fullBase = `${baseOrigin}${cleanPath}`;

    if (sId) {
      // Truyền tham số schoolId và schoolName rõ ràng để thiết bị đối tác luôn nhận diện 100% tên trường chính xác
      const params = new URLSearchParams();
      params.set('schoolId', sId);
      if (sName && sName !== 'TRƯỜNG THCS MỚI') {
        params.set('schoolName', sName);
      }
      if (sEmail) {
        params.set('adminEmail', sEmail);
      }
      return `${baseOrigin}/?${params.toString()}`;
    }
    return fullBase;
  };

  // Handover Text Generator
  const getHandoverText = (lic: SchoolTenantLicense): string => {
    let expiryStr = 'Vĩnh viễn';
    if (lic.expiresAt) {
      const d = new Date(lic.expiresAt);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      expiryStr = `${day}/${month}/${year}`;
    }

    const publicUrl = getPublicSharedUrl(lic);
    const adminEmail = lic.adminEmail || 'admin@truong.edu.vn';
    const initialPass = lic.assignedPasswordHint || '123456789';

    return `THÔNG TIN BÀN GIAO PHẦN MỀM PHÂN CÔNG CHUYÊN MÔN
🏫 Đơn vị trường học: ${lic.schoolName}
📧 Email đăng nhập: ${adminEmail}
🔑 Mật khẩu ban đầu: ${initialPass}
⏱️ Hạn sử dụng: ${expiryStr}
🌐 Link sử dụng công khai: ${publicUrl}
---------------------------------------------
👤 Quản trị viên cấp phép: Nguyễn Văn Toàn
📧 Email hỗ trợ: nguyentoanqh@gmail.com
📞 Hotline / Zalo: 0961 285 888`;
  };

  const handleCopyHandover = (lic: SchoolTenantLicense) => {
    const text = getHandoverText(lic);
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép toàn bộ thông tin bàn giao vào Clipboard!');
    setHandoverModalLicense(lic);
  };

  // Switch Active School Context
  const handleSwitchSchool = async (schoolId: string) => {
    dataStore.setSchoolId(schoolId);
    showToast(`Đã chuyển sang trường: [${schoolId}]. Đang kiểm tra dữ liệu Cloud...`);
    try {
      const res = await dataStore.pullDataFromFirestore(schoolId);
      if (res.success && res.totalCount > 0) {
        showToast(`Đã đồng bộ ${res.totalCount} bản ghi từ Cloud của trường [${schoolId}]!`, 'success');
        setLicenses([...dataStore.getSchoolLicenses()]);
      }
    } catch {}
  };

  const [isPullingDrawerCloud, setIsPullingDrawerCloud] = useState<boolean>(false);
  const handlePullDrawerSchoolData = async (schoolId: string) => {
    setIsPullingDrawerCloud(true);
    try {
      showToast(`Đang tải dữ liệu trường [${schoolId}] từ Cloud Firestore...`, 'warning');
      const res = await dataStore.pullDataFromFirestore(schoolId);
      showToast(res.message, res.success ? 'success' : 'error');
      setLicenses([...dataStore.getSchoolLicenses()]);
    } catch (err: any) {
      showToast(`Lỗi tải dữ liệu Cloud: ${err?.message}`, 'error');
    } finally {
      setIsPullingDrawerCloud(false);
    }
  };

  // Tự động đồng bộ dữ liệu Cloud mới nhất khi Super Admin bấm xem chi tiết trường
  useEffect(() => {
    if (quickManageSchool) {
      dataStore.pullDataFromFirestore(quickManageSchool.id).then((res) => {
        if (res.success && res.totalCount > 0) {
          setLicenses([...dataStore.getSchoolLicenses()]);
        }
      }).catch(() => {});
    }
  }, [quickManageSchool?.id]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900 text-white border-amber-600'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* TOP HEADER SECTION */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-sm border border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white">
                Quản lý Bản quyền & Phân phối cho Trường khác
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 uppercase tracking-wider">
                Chủ sở hữu hệ thống
              </span>
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              Cấp tài khoản, gán email & mật khẩu cho trường bạn, quản lý hạn sử dụng, hẹn giờ khóa tự động hoặc khóa ngay lập tức bất cứ lúc nào.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePushAllToCloud}
            disabled={isCloudSyncing}
            className="flex items-center gap-1.5 bg-blue-700/80 hover:bg-blue-600 text-white border border-blue-400/40 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
            title="Đẩy toàn bộ danh sách bản quyền các trường học lên Cloud Firestore"
          >
            <UploadCloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span>{isCloudSyncing ? 'Đang đẩy Cloud...' : 'Đẩy lên Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={handlePullAllFromCloud}
            disabled={isCloudPulling}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-600 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
            title="Tải và đồng bộ các bản quyền mới nhất từ Cloud Firestore về máy"
          >
            <DownloadCloud className={`w-4 h-4 ${isCloudPulling ? 'animate-spin' : ''}`} />
            <span>{isCloudPulling ? 'Đang tải Cloud...' : 'Tải về từ Cloud'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2.5 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cấp bản quyền trường mới</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Tổng trường đối tác</div>
            <div className="text-base font-black text-slate-900">{totalCount} trường</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-emerald-700 font-medium">Đang hoạt động</div>
            <div className="text-base font-black text-emerald-900">{activeCount} trường</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-rose-700 font-medium">Đang bị khóa</div>
            <div className="text-base font-black text-rose-900">{lockedCount} trường</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-amber-700 font-medium">Đã hết hạn</div>
            <div className="text-base font-black text-amber-900">{expiredCount} trường</div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap gap-2.5 items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên trường, email quản trị, mã trường, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="active">🟢 Đang hoạt động</option>
            <option value="locked">🔴 Đã khóa (Locked)</option>
            <option value="expired">🟠 Đã hết hạn (Expired)</option>
          </select>
        </div>
      </div>

      {/* CẤU HÌNH TÊN MIỀN PHÁT HÀNH LIÊN KẾT & XỬ LÝ LỖI 403 */}
      <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-extrabold text-xs text-amber-950 uppercase tracking-wide">
                Tên miền phát hành liên kết cấp quyền (Tránh lỗi 403)
              </span>
              <p className="text-[11px] text-amber-800">
                Chọn địa chỉ web mà các trường đối tác sẽ mở để sử dụng phần mềm
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
            handoverDomainMode === 'CUSTOM'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : handoverDomainMode === 'PREVIEW'
              ? 'bg-blue-100 text-blue-800 border border-blue-300'
              : 'bg-rose-100 text-rose-800 border border-rose-300'
          }`}>
            {handoverDomainMode === 'CUSTOM'
              ? '🟢 Domain riêng (Khuyên dùng)'
              : handoverDomainMode === 'PREVIEW'
              ? '🌐 Google Cloud Run (ais-pre)'
              : '⚠️ Dev nội bộ (Máy khác bị lỗi 403)'}
          </span>
        </div>

        {/* 3 Buttons lựa chọn */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => updateDomainMode('CUSTOM')}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              handoverDomainMode === 'CUSTOM'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>✏️ Tự nhập Domain riêng (Cloudflare Pages / Vercel / .edu.vn)</span>
          </button>
          <button
            type="button"
            onClick={() => updateDomainMode('PREVIEW')}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              handoverDomainMode === 'PREVIEW'
                ? 'bg-blue-900 text-white border-blue-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>🌐 Link Google AI Studio (ais-pre)</span>
          </button>
          <button
            type="button"
            onClick={() => updateDomainMode('CURRENT')}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              handoverDomainMode === 'CURRENT'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span>💻 Link Dev hiện tại (ais-dev)</span>
          </button>
        </div>

        {/* Ô nhập domain riêng */}
        {/* Ô nhập domain riêng */}
        {handoverDomainMode === 'CUSTOM' && (
          <div className="p-3.5 bg-white rounded-xl border border-amber-300 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 flex-wrap">
              <label className="text-xs font-bold text-slate-800">
                Nhập địa chỉ Web công khai của trường:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href="/pccm_cloudflare_build.zip"
                  download="pccm_cloudflare_build.zip"
                  className="text-[11px] text-blue-900 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition shadow-2xs"
                  title="Tải file nén mã nguồn đã đóng gói sẵn để kéo thả lên Cloudflare Pages"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-blue-700" />
                  <span>⬇️ Tải bản Deploy (Cloudflare)</span>
                </a>
                <a
                  href="/pccm_source_code.zip"
                  download="pccm_source_code.zip"
                  className="text-[11px] text-purple-900 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition shadow-2xs"
                  title="Tải toàn bộ mã nguồn để đẩy lên kho lưu trữ GitHub"
                >
                  <DownloadCloud className="w-3.5 h-3.5 text-purple-700" />
                  <span>📦 Tải mã nguồn gốc (GitHub)</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsCloudflareGuideOpen(true)}
                  className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline flex items-center gap-1 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                  <span>📖 Hướng dẫn chi tiết</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={handoverCustomDomain}
                onChange={(e) => updateCustomDomain(e.target.value)}
                placeholder="https://smartpccm.pages.dev hoặc domain của trường"
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-medium"
              />
              {handoverCustomDomain && (
                <>
                  <a
                    href={handoverCustomDomain.startsWith('http') ? handoverCustomDomain : `https://${handoverCustomDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold transition flex items-center gap-1 shrink-0"
                    title="Mở thử trong tab mới để kiểm tra trang web đã hoạt động chưa"
                  >
                    <span>Mở thử web</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => updateCustomDomain('')}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                  >
                    Xóa
                  </button>
                </>
              )}
            </div>

            {/* Cảnh báo tránh hiểu lầm DNS NXDOMAIN */}
            <div className="text-[11.5px] p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Vì sao nhập tên web bị báo lỗi "Hmm... can't reach this page / DNS NXDOMAIN"?</span>
              </div>
              <p>
                Ô này chỉ là nơi <strong>khai báo địa chỉ web mà trường đã có sẵn hoặc đã tải lên mạng</strong>. Việc gõ một tên bất kỳ (như <code>pccm-quyhop.pages.dev</code>) vào đây <strong>không thể tự động tạo ra trang web trên Internet</strong> nếu Thầy/Trường chưa đưa mã nguồn lên Cloudflare Pages hay máy chủ.
              </p>
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="font-bold text-blue-900">👉 Khuyên dùng nhanh nhất:</span>
                <button
                  type="button"
                  onClick={() => updateDomainMode('PREVIEW')}
                  className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  <span>Dùng ngay Link Google AI Studio có sẵn (ais-pre)</span>
                </button>
              </div>
            </div>

            {handoverCustomDomain.trim() && (
              <div className="text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                ✓ Nếu trang web này đã hoạt động, tất cả link bàn giao và link sao chép sẽ tự động sử dụng tên miền này.
              </div>
            )}
          </div>
        )}

        {/* Hướng dẫn khi chọn link ais-pre */}
        {handoverDomainMode === 'PREVIEW' && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-blue-900">
              <Globe className="w-4 h-4 text-blue-700 shrink-0" />
              <span>Cách kích hoạt link công khai ais-pre (Chỉ 15 giây trên Google AI Studio):</span>
            </div>
            <div className="leading-relaxed text-blue-900 space-y-0.5">
              <div>1. Nhìn lên <strong>góc trên bên phải màn hình Google AI Studio</strong> (cạnh avatar Gmail của Thầy), bấm nút <strong>Share</strong>.</div>
              <div>2. Chọn chế độ: <strong>Anyone with the link</strong> (Bất kỳ ai có liên kết) rồi bấm <strong>Save</strong>.</div>
              <div>3. Sau đó Thầy bấm <strong>Sao chép Link</strong> hoặc <strong>Sao chép bàn giao</strong> ở danh sách bên dưới là đối tác mở được ngay 100%!</div>
            </div>
          </div>
        )}

        {/* Hộp giải thích Lỗi 403 & hướng dẫn xử lý */}
        {handoverDomainMode === 'CURRENT' && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-950">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>CẢNH BÁO: Vì sao link ais-dev bị lỗi 403 khi gửi cho người khác?</span>
            </div>
            <p className="leading-relaxed">
              Link <code>ais-dev</code> là môi trường phát triển cục bộ của Google AI Studio chỉ dành riêng cho tài khoản Google của thầy. Khi người khác hoặc thiết bị khác mở, Google Cloud sẽ từ chối truy cập và báo <strong>403 Forbidden</strong>.
            </p>
            <p className="font-semibold text-rose-950 pt-0.5">
              👉 Cách giải quyết: Hãy bấm vào nút <strong>"Tự nhập Domain riêng"</strong> ở trên (dán link Cloudflare Pages / Vercel), hoặc bấm nút <strong>Share</strong> ở góc trên bên phải Google AI Studio để mở quyền công khai!
            </p>
          </div>
        )}
      </div>

      {/* LICENSES LIST CARDS */}
      <div className="space-y-3">
        {filteredLicenses.map((lic) => {
          const isCurrentActiveSchool = lic.id === currentSchoolId;
          const isLocked = lic.status === 'locked';
          const isExpired = lic.expiresAt && new Date(lic.expiresAt).getTime() <= now;

          let daysLeft: number | null = null;
          if (lic.expiresAt) {
            daysLeft = Math.ceil((new Date(lic.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24));
          }

          const curClasses = dataStore.getClassesForSchool(lic.id);
          const curTeachers = dataStore.getTeachersForSchool(lic.id);

          return (
            <div
              key={lic.id}
              className={`rounded-2xl border transition shadow-xs overflow-hidden ${
                isCurrentActiveSchool
                  ? 'bg-blue-50/30 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* CARD TOP HEADER: School title, Badges & Quick status */}
              <div className="p-4 sm:p-5 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold shadow-xs ${
                        isLocked
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : isCurrentActiveSchool
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-slate-900 tracking-tight">
                          {lic.schoolName}
                        </h4>

                        {/* Status Badge */}
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                            <Lock className="w-3 h-3 text-rose-600" />
                            <span>ĐÃ KHÓA</span>
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>HẾT HẠN</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>HOẠT ĐỘNG</span>
                          </span>
                        )}

                        {/* Plan Badge */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase shrink-0">
                          {lic.planType === 'unlimited'
                            ? 'Vĩnh viễn'
                            : lic.planType === '5_years'
                            ? 'Gói 5 năm'
                            : lic.planType === '4_years'
                            ? 'Gói 4 năm'
                            : lic.planType === '3_years'
                            ? 'Gói 3 năm'
                            : lic.planType === '2_years'
                            ? 'Gói 2 năm'
                            : lic.planType === '1_year' || lic.planType === 'standard' || lic.planType === 'annual'
                            ? 'Gói 1 năm'
                            : 'Dùng thử (Trial)'}
                        </span>

                        {isCurrentActiveSchool && (
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-700 text-white shadow-2xs shrink-0">
                            Trường đang mở làm việc
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Mã trường: <code className="font-mono text-slate-700 font-bold bg-slate-100 px-1 py-0.2 rounded">{lic.id}</code></span>
                        <span className="font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-md">
                          Dữ liệu hiện có: {curClasses.length} Lớp • {curTeachers.length} Giáo viên
                        </span>
                        {lic.notes && <span className="italic text-slate-400">• {lic.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side quick action / active status */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {!isCurrentActiveSchool && (
                      <button
                        type="button"
                        onClick={() => handleSwitchSchool(lic.id)}
                        className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                        title="Chuyển không gian làm việc sang trường này để kiểm tra dữ liệu"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-blue-700" />
                        <span>Mở làm việc</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* DETAILS GRID: 3 Clean, Spacious Info Cards across full width */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-100">
                  {/* Cột 1: Tài khoản đăng nhập */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Tài khoản Quản trị</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(lic.adminEmail);
                          showToast('Đã sao chép email quản trị!');
                        }}
                        className="text-slate-400 hover:text-slate-700 transition cursor-pointer"
                        title="Sao chép email"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-900 truncate" title={lic.adminEmail}>
                        {lic.adminEmail}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-slate-500">Mật khẩu:</span>
                      <code className="bg-amber-100/80 text-amber-950 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-300 text-[11px]">
                        {lic.assignedPasswordHint || '******'}
                      </code>
                    </div>
                  </div>

                  {/* Cột 2: Thời hạn & Bản quyền */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>Thời hạn sử dụng</span>
                      {lic.expiresAt && (
                        <span className={`text-[10px] font-bold ${daysLeft !== null && daysLeft <= 5 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {daysLeft !== null ? (daysLeft <= 0 ? 'Đã quá hạn' : `Còn ${daysLeft} ngày`) : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-500">Hạn dùng:</span>
                      {lic.expiresAt ? (
                        <strong className={isExpired ? 'text-rose-600 font-bold' : 'text-slate-900 font-bold'}>
                          {new Date(lic.expiresAt).toLocaleDateString('vi-VN')}
                        </strong>
                      ) : (
                        <strong className="text-emerald-700 font-bold">Vĩnh viễn</strong>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Ngày cấp: {lic.createdAt ? new Date(lic.createdAt).toLocaleDateString('vi-VN') : 'Mặc định'}</span>
                    </div>
                  </div>

                  {/* Cột 3: Người phụ trách & Liên hệ */}
                  <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 text-xs space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Người phụ trách & Liên hệ
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-slate-500">Cán bộ:</span>
                      <strong className="text-slate-800 truncate">
                        {lic.adminName || 'Chưa cập nhật'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-500">SĐT:</span>
                      <strong className="text-slate-800">
                        {lic.contactPhone || 'Chưa cập nhật'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* BẢN QUYỀN & HẠN MỨC QUY MÔ (MỤC 2 & MỤC 3: Chống 1 trường làm 2 trường) */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <Users className="w-3 h-3 text-blue-600" />
                      Quy mô tối đa: <strong>{lic.maxTeachers || 45} GV</strong> • <strong>{lic.maxClasses || 25} Lớp</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-medium">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Chống 1 trường làm 2 trường: BẬT
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 font-medium">
                      <Lock className="w-3 h-3 text-indigo-600" />
                      Khóa nạp dữ liệu chéo: BẬT
                    </span>
                  </div>
                  {lic.signature && (
                    <span className="text-[10px] font-mono text-slate-400 truncate" title={`Chữ ký số: ${lic.signature}`}>
                      SIG: {lic.signature.substring(0, 16)}...
                    </span>
                  )}
                </div>

                {/* Locked reason banner */}
                {lic.lockedReason && (
                  <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mt-2.5 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Lý do khóa: <strong>{lic.lockedReason}</strong></span>
                  </div>
                )}
              </div>

              {/* CARD FOOTER: Full-width action toolbar */}
              <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 py-2.5 sm:px-5 flex flex-wrap items-center justify-between gap-2.5">
                {/* Left Action Group: Sharing & Links */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const url = getPublicSharedUrl(lic);
                      navigator.clipboard.writeText(url);
                      if (url.includes('ais-dev-')) {
                        showToast(`⚠️ Đã sao chép link. Lưu ý: Link ais-dev mở trên máy khác sẽ bị lỗi 403. Thầy hãy chọn 'Tự nhập Domain riêng' ở trên để gửi đối tác!`, 'warning');
                      } else {
                        showToast(`Đã sao chép link truy cập của ${lic.schoolName}!`);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                    title="Sao chép link truy cập chuyên dụng cho trường này"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Sao chép Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyHandover(lic)}
                    className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 font-semibold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
                    title="Sao chép toàn bộ thông tin đăng nhập và hướng dẫn bàn giao"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-700" />
                    <span>Sao chép bàn giao</span>
                  </button>
                </div>

                {/* Mid Action Group: Quick Add Classes, Teachers & Cloud Sync for this School */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickClassModal(lic)}
                    className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                    title="Thêm từng lớp học cho trường này"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm lớp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenQuickTeacherModal(lic)}
                    className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                    title="Thêm từng giáo viên cho trường này"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Thêm GV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickManageSchool(lic)}
                    className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    title="Xem và quản lý danh sách lớp học và giáo viên của trường này"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-600" />
                    <span>Xem DS ({curClasses.length} Lớp, {curTeachers.length} GV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePushSchoolDataToCloud(lic)}
                    className="flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-semibold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    title="Đẩy dữ liệu trường này lên Cloud Firestore"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-sky-700" />
                    <span>Đẩy Cloud</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePullSchoolDataFromCloud(lic)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    title="Tải dữ liệu trường này từ Cloud Firestore"
                  >
                    <DownloadCloud className="w-3.5 h-3.5 text-slate-600" />
                    <span>Tải Cloud</span>
                  </button>
                </div>

                {/* Right Action Group: Controls & Editing */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Lock / Unlock Toggle Button */}
                  {isLocked ? (
                    <button
                      type="button"
                      onClick={() => handleUnlock(lic)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
                      title="Mở khóa quyền sử dụng lại ngay lập tức"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Mở khóa ngay</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenLockModal(lic)}
                      className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer"
                      title="Khóa ngay lập tức bất cứ lúc nào"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Khóa ngay</span>
                    </button>
                  )}

                  {/* Set Expiry Schedule Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenExpiryModal(lic)}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs px-3 py-1.5 rounded-xl border border-slate-300 transition cursor-pointer"
                    title="Hẹn ngày khóa hoặc gia hạn thêm thời gian sử dụng"
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hẹn ngày khóa</span>
                  </button>

                  {/* Edit Info */}
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(lic)}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    title="Chỉnh sửa thông tin trường & tài khoản"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sửa</span>
                  </button>

                  {/* Delete (Cannot delete master default school) */}
                  {lic.id !== 'school_quyhop' && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmLicense(lic)}
                      className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                      title="Xóa bản quyền và toàn bộ dữ liệu của trường này"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: ADD / EDIT LICENSE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingLicense ? 'Chỉnh sửa thông tin bản quyền trường' : 'Cấp quyền & Khởi tạo trường học mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLicense} className="p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Tên trường học cấp quyền *</label>
                  <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-600" /> Tên cố định (Người dùng không sửa được)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: TRƯỜNG THCS CHÂU BÌNH"
                  value={formSchoolName}
                  onChange={(e) => setFormSchoolName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <p className="text-[11px] text-slate-500">
                  🔒 Thầy gõ tên trường tại đây. Tên này sẽ <strong>cố định tuyệt đối</strong> trong toàn bộ hệ thống, người dùng và giáo viên của trường sẽ không thể tự ý sửa đổi tên trường.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Email đăng nhập cấp cho trường *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin.chaubinh@nghean.edu.vn"
                    value={formAdminEmail}
                    onChange={(e) => setFormAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Mật khẩu cấp ban đầu</label>
                    <button
                      type="button"
                      onClick={() => setFormPasswordHint(generateRandomPassword())}
                      className="text-[10px] text-blue-700 hover:underline font-bold"
                    >
                      Tạo ngẫu nhiên
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Chaubinh@2026"
                    value={formPasswordHint}
                    onChange={(e) => setFormPasswordHint(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Người phụ trách / Bàn giao</label>
                  <input
                    type="text"
                    placeholder="Thầy Lê Văn C (PHT)"
                    value={formAdminName}
                    onChange={(e) => setFormAdminName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    placeholder="0987.654.321"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Tiêu chuẩn cấp quyền</label>
                  <select
                    value={formPlanType}
                    onChange={(e) => {
                      const val = e.target.value as LicensePlanType;
                      setFormPlanType(val);
                      if (val === 'trial') {
                        const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(25);
                        setFormMaxClasses(12);
                      } else if (val === '1_year' || val === 'standard' || val === 'annual') {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 1);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(45);
                        setFormMaxClasses(25);
                      } else if (val === '2_years') {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 2);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(65);
                        setFormMaxClasses(35);
                      } else if (val === '3_years') {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 3);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(85);
                        setFormMaxClasses(45);
                      } else if (val === '4_years') {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 4);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(95);
                        setFormMaxClasses(50);
                      } else if (val === '5_years') {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + 5);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(120);
                        setFormMaxClasses(60);
                      } else if (val === 'unlimited') {
                        setFormExpiryDate('');
                        setFormMaxTeachers(9999);
                        setFormMaxClasses(9999);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="trial">Dùng thử (30 ngày)</option>
                    <option value="1_year">Cấp quyền 1 năm</option>
                    <option value="2_years">Cấp quyền 2 năm</option>
                    <option value="3_years">Cấp quyền 3 năm</option>
                    <option value="4_years">Cấp quyền 4 năm</option>
                    <option value="5_years">Cấp quyền 5 năm</option>
                    <option value="unlimited">Cấp quyền Vĩnh viễn (Trọn đời)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Hẹn ngày khóa (Hết hạn)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormExpiryDate('');
                        setFormPlanType('unlimited');
                      }}
                      className="text-[10px] text-blue-700 font-bold hover:underline"
                    >
                      Cấp Vĩnh viễn (Bỏ ngày)
                    </button>
                  </div>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-500 font-bold">Chọn thời hạn:</span>
                {[
                  { label: '30 ngày', years: 0, days: 30, plan: 'trial' as LicensePlanType },
                  { label: '1 năm', years: 1, plan: '1_year' as LicensePlanType },
                  { label: '2 năm', years: 2, plan: '2_years' as LicensePlanType },
                  { label: '3 năm', years: 3, plan: '3_years' as LicensePlanType },
                  { label: '4 năm', years: 4, plan: '4_years' as LicensePlanType },
                  { label: '5 năm', years: 5, plan: '5_years' as LicensePlanType },
                  { label: 'Vĩnh viễn', years: null, plan: 'unlimited' as LicensePlanType },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormPlanType(p.plan);
                      if (p.years === null) {
                        setFormExpiryDate('');
                        setFormMaxTeachers(9999);
                        setFormMaxClasses(9999);
                      } else if (p.years === 0 && p.days) {
                        const d = new Date(Date.now() + p.days * 24 * 60 * 60 * 1000);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        setFormMaxTeachers(25);
                        setFormMaxClasses(12);
                      } else {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + p.years);
                        setFormExpiryDate(d.toISOString().split('T')[0]);
                        if (p.years === 1) { setFormMaxTeachers(45); setFormMaxClasses(25); }
                        else if (p.years === 2) { setFormMaxTeachers(65); setFormMaxClasses(35); }
                        else if (p.years === 3) { setFormMaxTeachers(85); setFormMaxClasses(45); }
                        else if (p.years === 4) { setFormMaxTeachers(95); setFormMaxClasses(50); }
                        else if (p.years === 5) { setFormMaxTeachers(120); setFormMaxClasses(60); }
                      }
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition border cursor-pointer ${
                      formPlanType === p.plan
                        ? 'bg-blue-900 text-white border-blue-900 shadow-2xs'
                        : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* MỤC 2: Hạn mức quy mô đơn vị (Chống 1 trường làm cho 2 trường) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Hạn mức quy mô đơn vị (Chống 1 trường làm cho 2 trường)
                  </span>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                    Bảo vệ bản quyền
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Thiết lập số giáo viên & lớp học tối đa để ngăn chặn việc gom 2-3 trường vào cùng tài khoản:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Số giáo viên tối đa cho phép</label>
                    <input
                      type="number"
                      min="5"
                      max="9999"
                      value={formMaxTeachers}
                      onChange={(e) => setFormMaxTeachers(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Số lớp học tối đa cho phép</label>
                    <input
                      type="number"
                      min="2"
                      max="9999"
                      value={formMaxClasses}
                      onChange={(e) => setFormMaxClasses(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium">Mẫu quy mô:</span>
                  {[
                    { label: 'Trường nhỏ (25 GV / 12 Lớp)', gv: 25, lop: 12 },
                    { label: 'Trường chuẩn (45 GV / 25 Lớp)', gv: 45, lop: 25 },
                    { label: 'Trường lớn (65 GV / 35 Lớp)', gv: 65, lop: 35 },
                    { label: 'Không giới hạn', gv: 9999, lop: 9999 },
                  ].map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormMaxTeachers(m.gv);
                        setFormMaxClasses(m.lop);
                      }}
                      className="text-[10px] bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-2 py-0.5 rounded transition cursor-pointer"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Ghi chú nội bộ</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về hợp đồng, thanh toán, liên hệ..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition cursor-pointer"
                >
                  {editingLicense ? 'Lưu cập nhật' : 'Kích hoạt bản quyền trường'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: LOCK NOW CONFIRMATION */}
      {lockModalLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-50 p-5 border-b border-rose-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-rose-950 text-base">Khóa ngay quyền sử dụng</h3>
                <p className="text-xs text-rose-700 font-medium">{lockModalLicense.schoolName}</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Khi bị khóa, toàn bộ cán bộ giáo viên và quản trị viên của trường này sẽ lập tức bị chặn truy cập và nhìn thấy màn hình khóa bản quyền kèm thông báo liên hệ bạn.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Lý do khóa hiển thị cho trường:</label>
                <textarea
                  rows={2}
                  value={lockReasonInput}
                  onChange={(e) => setLockReasonInput(e.target.value)}
                  placeholder="Ví dụ: Tạm khóa để đối soát thông tin..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLockModalLicense(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLock}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  Xác nhận khóa ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SCHEDULE / EXTEND EXPIRY */}
      {expiryModalLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Hẹn ngày khóa / Gia hạn</h3>
                <p className="text-xs text-slate-500 font-medium">{expiryModalLicense.schoolName}</p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Chọn ngày hệ thống sẽ tự động khóa quyền truy cập của trường này. Khi đến ngày hẹn, ứng dụng sẽ tự động chuyển sang trạng thái hết hạn.
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Ngày hết hạn mới:</label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold">Hạn dùng nhanh:</span>
                {[
                  { label: '+30 ngày', days: 30, years: null },
                  { label: '1 năm', days: null, years: 1 },
                  { label: '2 năm', days: null, years: 2 },
                  { label: '3 năm', days: null, years: 3 },
                  { label: '4 năm', days: null, years: 4 },
                  { label: '5 năm', days: null, years: 5 },
                  { label: 'Vĩnh viễn', days: null, years: 0 },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (p.years === 0) {
                        setNewExpiryDate('');
                      } else if (p.years) {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() + p.years);
                        setNewExpiryDate(d.toISOString().split('T')[0]);
                      } else if (p.days) {
                        handleQuickAddDays(p.days);
                      }
                    }}
                    className="text-[10px] bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 px-2.5 py-1 rounded-md font-bold transition cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExpiryModalLicense(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSetExpiry}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-sm cursor-pointer"
                >
                  Lưu hạn sử dụng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: HANDOVER PREVIEW */}
      {handoverModalLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-amber-200 overflow-hidden">
            <div className="bg-amber-50 p-5 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-amber-950 text-base">Thông tin bàn giao bản quyền</h3>
              </div>
              <button
                type="button"
                onClick={() => setHandoverModalLicense(null)}
                className="text-amber-700 hover:text-amber-900 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-600">
                Bạn có thể sao chép toàn bộ nội dung bên dưới và gửi qua <strong>Zalo hoặc Email</strong> cho đại diện trường đối tác để họ đăng nhập sử dụng ngay:
              </p>

              {/* Chọn kiểu tên miền / URL chia sẻ */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-amber-700" />
                    <span>Máy chủ phát hành liên kết:</span>
                  </span>
                  <span className="text-[10px] text-amber-800 font-medium">
                    (Chọn URL phù hợp để người nhận mở không bị lỗi 404)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => updateDomainMode('PREVIEW')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      handoverDomainMode === 'PREVIEW'
                        ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="Link công khai chính thức gửi đối tác - không bao giờ bị lỗi 403"
                  >
                    <span>🌐 Link Công khai chính thức (ais-pre)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDomainMode('CURRENT')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      handoverDomainMode === 'CURRENT'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                    title="Link đang chạy trong phiên làm việc của thầy"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Link Dev nội bộ (ais-dev)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDomainMode('CUSTOM')}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      handoverDomainMode === 'CUSTOM'
                        ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>✏️ Tự nhập Domain riêng</span>
                  </button>
                </div>
                <div className="text-[11px] p-3 rounded-xl border space-y-1.5 bg-amber-50/90 border-amber-300 text-amber-950">
                  <p className="font-bold flex items-center gap-1.5 text-xs text-amber-900">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>Giải thích vì sao mở trên máy khác bị lỗi 403 / 404:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 leading-relaxed text-[11px]">
                    <li><strong>Lỗi 403 (Forbidden):</strong> Link <code>ais-dev</code> là môi trường lập trình nội bộ của tài khoản thầy. Google chặn không cho máy khác/người khác mở nếu chưa đăng nhập đúng Gmail của thầy.</li>
                    <li><strong>Lỗi 404 (Not Found):</strong> Link <code>ais-pre</code> là link dự kiến trên Cloud Run nhưng nền tảng AI Studio chưa cấp phát máy chủ preview này ra ngoài (chưa bấm Share).</li>
                    <li><strong>Cách gửi cho trường khác dùng được ngay 100%:</strong> Khi trường thầy hoặc trường đối tác triển khai lên Web Hosting công khai (như Netlify, Vercel, Cloudflare Pages hoặc tên miền riêng của trường <code>.edu.vn</code>), thầy chỉ cần bấm vào <strong>"Tự nhập Domain riêng"</strong> ở trên và điền link trang web đó vào. Phần mềm sẽ tự động sinh liên kết kèm bản quyền để gửi cho trường họ mở được ngay trên mọi thiết bị!</li>
                  </ul>
                </div>
                {handoverDomainMode === 'CUSTOM' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-bold text-slate-700">Nhập địa chỉ Web / Tên miền công khai:</label>
                    <input
                      type="text"
                      value={handoverCustomDomain}
                      onChange={(e) => updateCustomDomain(e.target.value)}
                      placeholder="VD: https://phancongchuyenmon.vercel.app hoặc https://pccm.pages.dev"
                      className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                )}
              </div>

              <pre className="p-4 bg-slate-900 text-amber-300 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto shadow-inner">
                {getHandoverText(handoverModalLicense)}
              </pre>

              <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                <a
                  href={getPublicSharedUrl(handoverModalLicense)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-blue-200 transition"
                  title="Mở thử link công khai trong tab mới để kiểm tra"
                >
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                  <span>Mở thử link công khai</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHandoverModalLicense(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getHandoverText(handoverModalLicense));
                      showToast('Đã sao chép toàn bộ thông tin bàn giao vào Clipboard!');
                    }}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Sao chép vào Clipboard</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DELETE CONFIRM */}
      {deleteConfirmLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-rose-200 p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Xóa bản quyền trường học?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa bản quyền của <strong>{deleteConfirmLicense.schoolName}</strong>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmLicense(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  await dataStore.deleteSchoolLicense(deleteConfirmLicense.id);
                  setLicenses(dataStore.getSchoolLicenses());
                  showToast(`Đã xóa bản quyền trường "${deleteConfirmLicense.schoolName}"`);
                  setDeleteConfirmLicense(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: QUICK ADD CLASS FOR LICENSED SCHOOL */}
      {quickClassSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Thêm lớp học mới</h3>
                  <p className="text-[11px] text-blue-200 font-medium truncate max-w-[240px]">
                    {quickClassSchool.schoolName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickClassSchool(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickClass} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tên lớp học *</label>
                <input
                  type="text"
                  required
                  value={qcName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQcName(val);
                    const match = val.trim().match(/^([6789])/);
                    if (match) {
                      const g = Number(match[1]);
                      setQcGrade(g);
                      setQcSession(g === 6 || g === 9 ? 'MORNING' : 'AFTERNOON');
                    }
                  }}
                  placeholder="Ví dụ: 6A1, 7A1, 8A2, 9A3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Khối lớp *</label>
                  <select
                    value={qcGrade}
                    onChange={(e) => {
                      const g = Number(e.target.value);
                      setQcGrade(g);
                      setQcSession(g === 6 || g === 9 ? 'MORNING' : 'AFTERNOON');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={6}>Khối 6</option>
                    <option value={7}>Khối 7</option>
                    <option value={8}>Khối 8</option>
                    <option value={9}>Khối 9</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Buổi học *</label>
                  <select
                    value={qcSession}
                    onChange={(e) => setQcSession(e.target.value as 'MORNING' | 'AFTERNOON')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MORNING">Buổi Sáng</option>
                    <option value="AFTERNOON">Buổi Chiều</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Số học sinh dự kiến</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={qcStudentCount}
                  onChange={(e) => setQcStudentCount(Number(e.target.value) || 35)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickClassSchool(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu lớp học</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: QUICK ADD TEACHER FOR LICENSED SCHOOL */}
      {quickTeacherSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Thêm giáo viên mới</h3>
                  <p className="text-[11px] text-emerald-200 font-medium truncate max-w-[240px]">
                    {quickTeacherSchool.schoolName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickTeacherSchool(null)}
                className="text-white/60 hover:text-white p-1 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickTeacher} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-1 space-y-1">
                  <label className="font-bold text-slate-700">Mã GV *</label>
                  <input
                    type="text"
                    required
                    value={qtCode}
                    onChange={(e) => setQtCode(e.target.value)}
                    placeholder="GV01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">Họ và tên giáo viên *</label>
                  <input
                    type="text"
                    required
                    value={qtName}
                    onChange={(e) => setQtName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Giới tính</label>
                  <select
                    value={qtGender}
                    onChange={(e) => setQtGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Nữ">Nữ</option>
                    <option value="Nam">Nam</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Định mức tiết/tuần</label>
                  <input
                    type="number"
                    min={1}
                    max={35}
                    value={qtQuota}
                    onChange={(e) => setQtQuota(Number(e.target.value) || 19)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tổ chuyên môn</label>
                <select
                  value={qtDeptId}
                  onChange={(e) => setQtDeptId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="dept_toan_tin">Tổ Toán - Tin học</option>
                  <option value="dept_khtn">Tổ Khoa học tự nhiên (Lý - Hóa - Sinh)</option>
                  <option value="dept_van_khxh">Tổ Ngữ văn - Lịch sử & Địa lí</option>
                  <option value="dept_tieng_anh">Tổ Tiếng Anh - Ngoại ngữ</option>
                  <option value="dept_nghe_thuat">Tổ GDTC - Âm nhạc - Mỹ thuật - GDCD</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Môn giảng dạy (ngăn cách dấu phẩy)</label>
                <input
                  type="text"
                  value={qtSubjects}
                  onChange={(e) => setQtSubjects(e.target.value)}
                  placeholder="Ví dụ: Toán, Tin học"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickTeacherSchool(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Lưu hồ sơ giáo viên</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: QUICK MANAGE & VIEW CLASSES / TEACHERS FOR SCHOOL */}
      {quickManageSchool && (() => {
        const schClasses = dataStore.getClassesForSchool(quickManageSchool.id);
        const schTeachers = dataStore.getTeachersForSchool(quickManageSchool.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">{quickManageSchool.schoolName}</h3>
                    <p className="text-xs text-blue-200 font-medium">
                      Danh sách dữ liệu: {schClasses.length} lớp học • {schTeachers.length} giáo viên
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPullingDrawerCloud}
                    onClick={() => handlePullDrawerSchoolData(quickManageSchool.id)}
                    className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black px-3 py-1.5 rounded-xl transition text-xs shadow-sm cursor-pointer disabled:opacity-60"
                    title="Tải và đồng bộ toàn bộ dữ liệu mới nhất mà trường này đã nhập từ Cloud Firestore"
                  >
                    <DownloadCloud className={`w-3.5 h-3.5 ${isPullingDrawerCloud ? 'animate-spin' : ''}`} />
                    <span>{isPullingDrawerCloud ? 'Đang tải...' : 'Tải dữ liệu Cloud'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuickManageSchool(null)}
                    className="text-white/60 hover:text-white p-1 rounded-lg text-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
                {/* Section 1: Lớp học */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-blue-700" />
                      <span>Danh sách Lớp học ({schClasses.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenQuickClassModal(quickManageSchool);
                      }}
                      className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm lớp</span>
                    </button>
                  </div>

                  {schClasses.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500">
                      Chưa có lớp học nào. Hãy bấm "Thêm lớp" ở trên để tạo lớp cho trường này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {schClasses.map((cls) => (
                        <div
                          key={cls.id}
                          className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{cls.name}</div>
                            <div className="text-[10px] text-slate-500">
                              Khối {cls.grade} • {cls.session === 'MORNING' ? 'Sáng' : 'Chiều'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Giáo viên */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      <span>Danh sách Giáo viên ({schTeachers.length})</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenQuickTeacherModal(quickManageSchool);
                      }}
                      className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Thêm GV</span>
                    </button>
                  </div>

                  {schTeachers.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500">
                      Chưa có giáo viên nào. Hãy bấm "Thêm GV" ở trên để bổ sung hồ sơ giáo viên cho trường này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {schTeachers.map((t) => (
                        <div
                          key={t.id}
                          className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{t.fullName}</span>
                              <span className="font-mono text-[10px] bg-slate-200 px-1 rounded text-slate-700">
                                {t.code}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Định mức: {t.standardQuota || 19} tiết • {(t.subjectsCanTeach || []).join(', ') || 'Chưa gán môn'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleSwitchSchool(quickManageSchool.id);
                    setQuickManageSchool(null);
                  }}
                  className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Mở làm việc tại trường này</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuickManageSchool(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL HƯỚNG DẪN TẠO LINK NGẮN HTTPS://PCCM-TENTRUONG... DO THẦY QUẢN LÝ */}
      {isCloudflareGuideOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cách tạo Link ngắn dạng https://pccm-tentruong... do Thầy quản lý
                  </h3>
                  <p className="text-xs text-slate-500">
                    Triển khai trên Cloudflare Pages / Workers (Miễn phí 100% & Bền vững)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudflareGuideOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* NGUYÊN LÝ HOẠT ĐỘNG */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-xs text-blue-950 space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Nguyên lý: Tên miền .pages.dev là gì và vì sao cần tải code lên Cloudflare?</span>
              </div>
              <p>
                Đuôi <code>.pages.dev</code> là dịch vụ lưu trữ Web miễn phí của tập đoàn <strong>Cloudflare</strong>. Để có địa chỉ web chạy được (như <code>https://pccm-quyhop.pages.dev</code>), Thầy chỉ cần đưa mã nguồn của phần mềm này lên Cloudflare Pages <strong>đúng 1 lần</strong>.
              </p>
            </div>

            {/* PHƯƠNG ÁN 1: KHUYÊN DÙNG NHẤT */}
            <div className="border border-emerald-300 bg-emerald-50/60 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Cách 1 (Khuyên dùng số 1): 1 Tên miền mẹ duy nhất dùng chung cho tất cả các trường</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  Dễ nhất • Làm 1 lần dùng mãi mãi
                </span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                Thầy đăng ký 1 tên miền Cloudflare Pages duy nhất (ví dụ: <code>https://pccm.pages.dev</code> hoặc tên miền riêng của trường Thầy <code>https://phancong.edu.vn</code>).
              </p>
              <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs space-y-2">
                <div className="font-bold text-slate-800">Khi đó phần mềm sẽ tự động sinh link cho từng trường:</div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-blue-900">
                    🏫 THCS Quỳ Hợp: <strong>https://pccm.pages.dev/quyhop</strong>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-purple-900">
                    🏫 THCS Châu Đình: <strong>https://pccm.pages.dev/chaudinh</strong>
                  </div>
                  <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-indigo-900">
                    🏫 THCS Đồng Hợp: <strong>https://pccm.pages.dev/donghop</strong>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600">
                  💡 <strong>Ưu điểm vượt trội:</strong> Thầy chỉ cần tải code lên Cloudflare đúng 1 lần. Sau này Thầy tạo thêm 50 hay 100 trường mới trong phần mềm, link của từng trường sẽ <strong>tự động chạy ngay lập tức</strong> mà Thầy không cần phải cài đặt lại trên Cloudflare!
                </div>
              </div>
            </div>

            {/* PHƯƠNG ÁN 2: TÊN MIỀN RIÊNG DẠNG PCCM-TENTRUONG.PAGES.DEV */}
            <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 space-y-2.5">
              <span className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-orange-600" />
                <span>Cách 2: Mỗi trường sở hữu 1 tên miền phụ riêng dạng https://pccm-tentruong.pages.dev</span>
              </span>
              <p className="text-xs text-slate-700 leading-relaxed">
                Cloudflare cho phép tạo tới <strong>100 dự án Pages miễn phí</strong> trên 1 tài khoản.
              </p>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="space-y-1 text-[11.5px] text-slate-700 leading-relaxed">
                  <div>1. Truy cập <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline">dash.cloudflare.com</a>, vào <strong>Workers & Pages</strong>.</div>
                  <div>2. Bấm <strong>Create application</strong> ➔ Chọn tab <strong>Pages</strong>.</div>
                  <div>3. Đặt tên Project là: <code>pccm-quyhop</code> (khi đó Cloudflare sẽ chính thức cấp địa chỉ <code>https://pccm-quyhop.pages.dev</code>).</div>
                  <div>4. Tải thư mục mã nguồn bản dựng (dist) lên và bấm Deploy.</div>
                  <div>5. Khi cấp cho trường Châu Đình, tạo project tên: <code>pccm-chaudinh</code> (sẽ có <code>https://pccm-chaudinh.pages.dev</code>).</div>
                </div>
              </div>
            </div>

            {/* HƯỚNG DẪN ĐIỀN VÀO PHẦN MỀM */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1.5">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Sau khi Thầy đã có tên miền trên Cloudflare, làm gì trong phần mềm?</span>
              </div>
              <p className="leading-relaxed">
                Thầy chỉ cần điền tên miền vào ô <em>"Nhập địa chỉ Web công khai của trường"</em>:
              </p>
              <div className="font-mono text-[11px] p-2 bg-white rounded-lg border border-amber-300 text-slate-800">
                - Nếu dùng Cách 1: điền <strong>https://pccm.pages.dev</strong><br/>
                - Nếu dùng Cách 2: điền <strong>https://pccm-{'{'}school{'}'}.pages.dev</strong>
              </div>
              <p className="text-[11px] text-amber-800">
                Hệ thống sẽ tự động ghép tên trường vào link bàn giao cho Thầy gửi đối tác!
              </p>
            </div>

            {/* NÚT ĐÓNG */}
            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCloudflareGuideOpen(false)}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
