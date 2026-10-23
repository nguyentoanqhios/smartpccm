/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * User Directory & Permission Management (Danh sách người dùng & Phân quyền Xem/Sửa)
 */

import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  UserX,
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Edit,
  Edit2,
  Edit3,
  Eye,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Building2,
  UserPlus,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  Sliders,
  Check,
  X,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Info,
  Layers,
  GraduationCap,
  Copy,
} from 'lucide-react';
import { UserProfile, UserRole, UserPermission, Department, Teacher } from '../types';
import { dataStore, isSuperAdminEmail } from '../repositories/dataStore';
import { SchoolLicenseManager } from './SchoolLicenseManager';
import { ErrorBoundary } from './ErrorBoundary';

interface UserManagementViewProps {
  users: UserProfile[];
  currentUser: UserProfile;
  departments: Department[];
  teachers: Teacher[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenSchoolSetup?: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  departments,
  teachers,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenSchoolSetup,
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedPermission, setSelectedPermission] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const detectedUrlId = dataStore.detectUrlSchoolId();
  const isSuper = Boolean(
    isSuperAdminEmail(currentUser?.email) ||
    currentUser?.isSuperAdmin ||
    dataStore.isCurrentUserSuperAdmin()
  );

  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'LICENSES'>(() => {
    try {
      const saved = sessionStorage.getItem('pccm_user_management_tab');
      if (saved === 'LICENSES') {
        sessionStorage.removeItem('pccm_user_management_tab');
        return 'LICENSES';
      }
    } catch {}
    return 'USERS';
  });

  React.useEffect(() => {
    const handleSwitch = (e: any) => {
      if (e.detail === 'LICENSES' || e.detail === 'USERS') {
        setActiveSubTab(e.detail);
      }
    };
    window.addEventListener('pccm-switch-subtab', handleSwitch);
    return () => window.removeEventListener('pccm-switch-subtab', handleSwitch);
  }, []);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [permissionMatrixUser, setPermissionMatrixUser] = useState<UserProfile | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('teacher');
  const [formRoleTitle, setFormRoleTitle] = useState('');
  const [formPermission, setFormPermission] = useState<UserPermission>('view');
  const [formDeptId, setFormDeptId] = useState('');
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'locked'>('active');

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  // Statistics
  const totalUsers = users.length;
  const editUsersCount = users.filter((u) => u.permission === 'edit').length;
  const viewOnlyUsersCount = users.filter((u) => u.permission === 'view').length;
  const activeUsersCount = users.filter((u) => u.status !== 'locked').length;

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (searchTerm) {
        const text = `${u.name} ${u.email} ${u.roleTitle || ''} ${u.phone || ''}`.toLowerCase();
        if (!text.includes(searchTerm.toLowerCase())) return false;
      }
      if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
      if (selectedPermission !== 'ALL' && u.permission !== selectedPermission) return false;
      if (selectedDept !== 'ALL' && u.departmentId !== selectedDept) return false;
      return true;
    });
  }, [users, searchTerm, selectedRole, selectedPermission, selectedDept]);

  // Handlers
  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('teacher');
    setFormRoleTitle('Giáo viên bộ môn');
    setFormPermission('view');
    setFormDeptId(departments[0]?.id || '');
    setFormTeacherId('');
    setFormStatus('active');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormRoleTitle(user.roleTitle || '');
    setFormPermission(user.permission || 'view');
    setFormDeptId(user.departmentId || '');
    setFormTeacherId(user.teacherId || '');
    setFormStatus(user.status || 'active');
    setIsAddModalOpen(true);
  };

  const handleDuplicateUser = (user: UserProfile) => {
    setEditingUser(null);
    setFormName(`${user.name} (Bản sao)`);
    const emailParts = user.email.split('@');
    setFormEmail(`${emailParts[0]}.copy@${emailParts[1] || 'nghean.edu.vn'}`);
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormRoleTitle(user.roleTitle || getDefaultRoleTitle(user.role));
    setFormPermission(user.permission || 'view');
    setFormDeptId(user.departmentId || '');
    setFormTeacherId('');
    setFormStatus('active');
    setIsAddModalOpen(true);
    showToast(`Đã tạo bản sao từ người dùng "${user.name}". Vui lòng kiểm tra và lưu!`);
  };

  const handleConfirmBulkDeleteUsers = () => {
    const toDelete = selectedUserIds.filter((id) => id !== currentUser.id);
    if (toDelete.length === 0) {
      showToast('Không có tài khoản nào hợp lệ để xóa (không thể xóa tài khoản của chính bạn).', 'error');
      setIsBulkDeleteModalOpen(false);
      return;
    }
    toDelete.forEach((id) => {
      dataStore.deleteUser(id);
    });
    showToast(`Đã xóa thành công ${toDelete.length} tài khoản người dùng!`);
    setSelectedUserIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleBulkSetPermission = (perm: UserPermission) => {
    if (selectedUserIds.length === 0) return;
    selectedUserIds.forEach((id) => {
      dataStore.setUserPermission(id, perm);
    });
    showToast(`Đã cập nhật quyền ${perm === 'edit' ? 'Chỉnh sửa' : 'Chỉ xem'} cho ${selectedUserIds.length} người dùng!`);
    setSelectedUserIds([]);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      showToast('Vui lòng nhập họ tên và email người dùng.', 'error');
      return;
    }

    if (editingUser) {
      dataStore.updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        role: formRole,
        roleTitle: formRoleTitle.trim() || getDefaultRoleTitle(formRole),
        permission: formPermission,
        departmentId: formDeptId || undefined,
        teacherId: formTeacherId || undefined,
        status: formStatus,
      });
      showToast(`Đã cập nhật người dùng "${formName.trim()}"`);
    } else {
      // MỤC 2: Kiểm tra hạn mức quy mô đơn vị theo bản quyền
      const quotaCheck = dataStore.canAddTeacher(1);
      if (!quotaCheck.allowed) {
        showToast(quotaCheck.message || 'Đã đạt giới hạn tài khoản tối đa theo gói bản quyền!', 'error');
        return;
      }

      dataStore.addUser({
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        schoolId: dataStore.getSchoolId(),
        role: formRole,
        roleTitle: formRoleTitle.trim() || getDefaultRoleTitle(formRole),
        permission: formPermission,
        departmentId: formDeptId || undefined,
        teacherId: formTeacherId || undefined,
        status: formStatus,
      });
      showToast(`Đã thêm mới người dùng "${formName.trim()}"`);
    }

    setIsAddModalOpen(false);
  };

  const handleDeleteUser = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      showToast('Bạn không thể xóa tài khoản của chính mình.', 'error');
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      const userName = userToDelete.name;
      dataStore.deleteUser(userToDelete.id);
      showToast(`Đã xóa tài khoản "${userName}"`);
      setSelectedUserIds((prev) => prev.filter((id) => id !== userToDelete.id));
      setUserToDelete(null);
    }
  };

  const handleTogglePermission = (user: UserProfile) => {
    const nextPerm: UserPermission = user.permission === 'edit' ? 'view' : 'edit';
    dataStore.setUserPermission(user.id, nextPerm);
  };

  const handleToggleStatus = (user: UserProfile) => {
    const nextStatus = user.status === 'locked' ? 'active' : 'locked';
    dataStore.updateUser(user.id, { status: nextStatus });
  };

  const handleSwitchUser = (user: UserProfile) => {
    const isSuper = isSuperAdminEmail(currentUser.email) || Boolean(currentUser.isSuperAdmin);
    if ((user.isSuperAdmin || isSuperAdminEmail(user.email)) && !isSuper) {
      showToast('Chỉ Chủ sở hữu hệ thống mới có thể truy cập tài khoản này.', 'error');
      return;
    }
    dataStore.setCurrentUser(user);
  };

  const getDefaultRoleTitle = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Quản trị viên Hệ thống';
      case 'principal':
        return 'Ban Giám hiệu (Hiệu trưởng / Phó HT)';
      case 'dean':
        return 'Tổ trưởng Chuyên môn';
      case 'staff':
        return 'Cán bộ giám sát / Văn phòng';
      case 'teacher':
      default:
        return 'Giáo viên bộ môn';
    }
  };

  const handleTeacherSelectChange = (teacherId: string) => {
    setFormTeacherId(teacherId);
    if (teacherId) {
      const t = teacherMap.get(teacherId);
      if (t) {
        if (!formName) setFormName(t.fullName);
        if (!formEmail && t.email) setFormEmail(t.email);
        if (!formPhone && t.phone) setFormPhone(t.phone);
        if (t.departmentId) setFormDeptId(t.departmentId);
      }
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* SUB-TABS: Chỉ hiển thị tab Cấp quyền trường cho Chủ sở hữu / Super Admin */}
      {isSuper && (
        <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-2 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('USERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'USERS'
                ? 'bg-white text-blue-900 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4 text-blue-700" />
            <span>Tài khoản & Phân quyền cán bộ GV</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeSubTab === 'USERS' ? 'bg-blue-100 text-blue-900' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('LICENSES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'LICENSES'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-500" />
            <span>CẤP QUYỀN TRƯỜNG</span>
            <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Quản lý hạn dùng & Khóa
            </span>
          </button>
        </div>
      )}

      {activeSubTab === 'LICENSES' && (
        <ErrorBoundary fallbackTitle="Không thể tải phân hệ Cấp quyền trường học">
          <SchoolLicenseManager currentUser={currentUser} />
        </ErrorBoundary>
      )}

      {activeSubTab === 'USERS' && (
        <>
          {/* HEADER SECTION DÀNH RIÊNG CHO NGƯỜI DÙNG */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Danh sách người dùng & Phân quyền hệ thống
                  </h2>
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                    Phân quyền RBAC
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quản lý tài khoản cán bộ giáo viên, phân quyền Chỉnh sửa hoặc Chỉ xem đối với tất cả dữ liệu phân công
                </p>
              </div>
            </div>

            {/* TOP ACTION BUTTONS */}
            <div className="flex items-center gap-2 flex-wrap">
              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                    isFullscreen
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  }`}
                  title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to Full view'}
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{isFullscreen ? 'Thu nhỏ' : 'Full view'}</span>
                </button>
              )}

              {onOpenSchoolSetup && (
                <button
                  id="edit-school-info-btn"
                  type="button"
                  onClick={onOpenSchoolSetup}
                  className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-blue-900 border border-blue-200 hover:border-blue-300 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                  title="Điều chỉnh thông tin chung của trường (Tên trường, Cơ quan quản lý, địa chỉ, hiệu trưởng, điểm trường)"
                >
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <span>Thông tin trường</span>
                </button>
              )}

              <button
                id="add-new-user-btn"
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>Thêm người dùng</span>
              </button>
            </div>
          </div>

          {/* KHỐI ĐIỀU CHỈNH THÔNG TIN CHUNG CỦA TRƯỜNG */}
          <div className="bg-gradient-to-r from-blue-50/90 via-white to-indigo-50/70 p-4 rounded-2xl border border-blue-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900">
                    {dataStore.getSchoolInfo().schoolName || 'ĐƠN VỊ TRƯỜNG HỌC'}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                    {dataStore.getSchoolInfo().authorityName || 'UBND xã'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Năm học: <strong>{dataStore.getSchoolInfo().schoolYear || '2026-2027'}</strong>
                  {dataStore.getSchoolInfo().principalName && ` • Hiệu trưởng: ${dataStore.getSchoolInfo().principalName}`}
                  {dataStore.getSchoolInfo().email && ` • Email: ${dataStore.getSchoolInfo().email}`}
                </p>
              </div>
            </div>
            {onOpenSchoolSetup && (
              <button
                type="button"
                onClick={onOpenSchoolSetup}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 shadow-sm transition cursor-pointer shrink-0"
                title="Bấm để chỉnh sửa thông tin trường, cơ quan quản lý (UBND xã), địa chỉ, hiệu trưởng..."
              >
                <Sliders className="w-4 h-4" />
                <span>Điều chỉnh thông tin trường</span>
              </button>
            )}
          </div>
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Tổng tài khoản</div>
            <div className="text-base font-black text-slate-900">{totalUsers}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-emerald-700 font-medium">Quyền Chỉnh sửa</div>
            <div className="text-base font-black text-emerald-900">{editUsersCount} tài khoản</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-sky-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-sky-700 font-medium">Chế độ Chỉ xem</div>
            <div className="text-base font-black text-sky-900">{viewOnlyUsersCount} tài khoản</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-indigo-700 font-medium">Đang hoạt động</div>
            <div className="text-base font-black text-indigo-900">{activeUsersCount} tài khoản</div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-2.5 items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email, chức vụ, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Permission Filter */}
          <select
            value={selectedPermission}
            onChange={(e) => setSelectedPermission(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="ALL">Tất cả quyền hạn (Sửa & Xem)</option>
            <option value="edit">✍️ Có quyền chỉnh sửa (Edit)</option>
            <option value="view">👁️ Chế độ chỉ xem (View-only)</option>
          </select>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="principal">Ban Giám hiệu</option>
            <option value="dean">Tổ trưởng Chuyên môn</option>
            <option value="teacher">Giáo viên</option>
            <option value="staff">Cán bộ khác</option>
          </select>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="ALL">Tất cả tổ bộ môn</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
          <input
            type="checkbox"
            checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
            onChange={() => {
              if (selectedUserIds.length === filteredUsers.length) {
                setSelectedUserIds([]);
              } else {
                setSelectedUserIds(filteredUsers.map((u) => u.id));
              }
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span>Chọn tất cả ({selectedUserIds.length}/{filteredUsers.length} người dùng)</span>
        </label>

        {selectedUserIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 animate-in fade-in">
            <button
              onClick={() => handleBulkSetPermission('edit')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Gán quyền Sửa ({selectedUserIds.length})</span>
            </button>
            <button
              onClick={() => handleBulkSetPermission('view')}
              className="bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Gán Chỉ xem ({selectedUserIds.length})</span>
            </button>
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa ({selectedUserIds.length}) người dùng</span>
            </button>
          </div>
        )}
      </div>

      {/* USERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
              <tr>
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={() => {
                      if (selectedUserIds.length === filteredUsers.length) {
                        setSelectedUserIds([]);
                      } else {
                        setSelectedUserIds(filteredUsers.map((u) => u.id));
                      }
                    }}
                    className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-2 text-center w-12">STT</th>
                <th className="py-3 px-4">Họ và tên & Email</th>
                <th className="py-3 px-3 text-center">Vai trò chức vụ</th>
                <th className="py-3 px-3">Tổ chuyên môn</th>
                <th className="py-3 px-3 text-center">Phân quyền</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Không tìm thấy người dùng phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const isCurrent = user.id === currentUser.id;
                  const dept = user.departmentId ? deptMap.get(user.departmentId) : null;
                  const isEdit = user.permission === 'edit';
                  const isLocked = user.status === 'locked';
                  const isSelected = selectedUserIds.includes(user.id);

                  return (
                    <tr
                      key={`user_row_${user.id || 'u'}_${user.email || 'e'}_${idx}`}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-blue-50/70' : isCurrent ? 'bg-blue-50/30' : isLocked ? 'bg-slate-50/50 opacity-60' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedUserIds((prev) =>
                              prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-2 text-center text-slate-400 font-mono">{idx + 1}</td>

                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${
                              user.role === 'admin'
                                ? 'bg-purple-700'
                                : user.role === 'principal'
                                ? 'bg-red-700'
                                : user.role === 'dean'
                                ? 'bg-blue-700'
                                : 'bg-slate-600'
                            }`}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {user.name}
                              {isCurrent && (
                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                  Bạn đang đăng nhập
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : user.role === 'principal'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : user.role === 'dean'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {user.roleTitle || getDefaultRoleTitle(user.role)}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {dept ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            {dept.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Toàn trường / Khác</span>
                        )}
                      </td>

                      {/* Permission toggle switch */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleTogglePermission(user)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-2xs transition cursor-pointer ${
                            isEdit
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300'
                              : 'bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-300'
                          }`}
                          title="Bấm để chuyển đổi giữa Quyền Chỉnh Sửa và Chỉ Xem"
                        >
                          {isEdit ? (
                            <>
                              <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Chỉnh sửa</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-sky-700" />
                              <span>Chỉ xem</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                            isLocked
                              ? 'bg-red-100 hover:bg-red-200 text-red-700'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                          }`}
                          title="Bấm để Khóa / Mở khóa tài khoản"
                        >
                          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          <span>{isLocked ? 'Đã khóa' : 'Hoạt động'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Switch Identity for test */}
                          {!isCurrent && (
                            <button
                              onClick={() => handleSwitchUser(user)}
                              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 transition flex items-center gap-1"
                              title="Chuyển sang góc nhìn người dùng này để kiểm thử phân quyền"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Đăng nhập thử</span>
                            </button>
                          )}

                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Duplicate User */}
                          <button
                            onClick={() => handleDuplicateUser(user)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                            title="Nhân bản tài khoản người dùng"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg transition ${
                              isCurrent
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:text-red-700 hover:bg-red-50'
                            }`}
                            title={isCurrent ? 'Không thể xóa tài khoản hiện tại' : 'Xóa người dùng'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER EXPLANATION BANNER */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              <strong>Lưu ý:</strong> Người dùng có <strong>Quyền Chỉnh sửa</strong> được phép thêm, sửa, xóa tất cả dữ liệu phân công, giáo viên, lớp học, khung tiết và chức vụ. Tài khoản <strong>Chỉ xem</strong> chỉ được tra cứu và tải báo cáo.
            </span>
          </div>
          <div className="font-semibold text-slate-700 whitespace-nowrap">
            Hiển thị {filteredUsers.length} / {totalUsers} tài khoản
          </div>
        </div>
      </div>

      {/* ADD / EDIT USER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-blue-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingUser ? 'Chỉnh sửa người dùng & Phân quyền' : 'Thêm người dùng mới vào hệ thống'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {/* Optional: Link with existing Teacher profile */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Liên kết với Hồ sơ Giáo viên trong trường (Tùy chọn)
                </label>
                <select
                  value={formTeacherId}
                  onChange={(e) => handleTeacherSelectChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Không liên kết / Tạo tài khoản mới độc lập --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.code}) – {deptMap.get(t.departmentId)?.name || 'Chuyên môn'}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Khi chọn giáo viên, họ tên, email và tổ sẽ được tự động điền.
                </span>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Toàn"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="toannv.qh@nghean.edu.vn"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Role & Role Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vai trò hệ thống</label>
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const r = e.target.value as UserRole;
                      setFormRole(r);
                      setFormRoleTitle(getDefaultRoleTitle(r));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="admin">Quản trị viên (Admin)</option>
                    <option value="principal">Ban Giám hiệu (Hiệu trưởng / Phó HT)</option>
                    <option value="dean">Tổ trưởng Chuyên môn</option>
                    <option value="teacher">Giáo viên bộ môn</option>
                    <option value="staff">Cán bộ văn phòng / Giám sát</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chức danh hiển thị</label>
                  <input
                    type="text"
                    value={formRoleTitle}
                    onChange={(e) => setFormRoleTitle(e.target.value)}
                    placeholder="VD: Tổ trưởng Tổ Ngoại ngữ"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Permission & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phân quyền thao tác dữ liệu <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formPermission}
                    onChange={(e) => setFormPermission(e.target.value as UserPermission)}
                    className="w-full bg-blue-50 border border-blue-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="edit">✍️ Quyền Chỉnh sửa (Toàn quyền Thêm/Sửa/Xóa)</option>
                    <option value="view">👁️ Chỉ xem (Chỉ tra cứu & Xem báo cáo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tổ chuyên môn</label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Toàn trường / Không trực thuộc --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="VD: 0912345678"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tài khoản</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'locked')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">🟢 Đang hoạt động</option>
                    <option value="locked">🔴 Đang khóa</option>
                  </select>
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-800 hover:bg-blue-900 text-white shadow-sm transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingUser ? 'Lưu cập nhật' : 'Tạo tài khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Xác nhận xóa người dùng</h3>
                  <p className="text-[11px] text-slate-500">Hành động này sẽ xóa vĩnh viễn tài khoản</p>
                </div>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                Bạn có chắc chắn muốn xóa người dùng <strong className="text-slate-900 font-bold">{userToDelete.name}</strong>?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1">
                <div><span className="text-slate-500">Email:</span> <strong className="text-slate-800">{userToDelete.email}</strong></div>
                <div><span className="text-slate-500">Vai trò:</span> <strong className="text-slate-800">{userToDelete.roleTitle || userToDelete.role}</strong></div>
                <div><span className="text-slate-500">Quyền hạn:</span> <strong className="text-slate-800">{userToDelete.permission === 'edit' ? 'Chỉnh sửa' : 'Chỉ xem'}</strong></div>
              </div>
              <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg text-[11px] border border-amber-200">
                Lưu ý: Dữ liệu phân công chuyên môn đã tạo trước đây vẫn được lưu trữ, chỉ tài khoản đăng nhập của người này bị hủy bỏ.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/70">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Xóa hàng loạt người dùng</h3>
                  <p className="text-[11px] text-slate-500">Thao tác xóa vĩnh viễn các tài khoản được chọn</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p>
                Bạn đang yêu cầu xóa đồng thời <strong className="text-rose-700 font-black">{selectedUserIds.length}</strong> tài khoản người dùng đã chọn.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] space-y-1 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Quy tắc an toàn hệ thống:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800/90 pl-1">
                  <li>Tài khoản cá nhân của bạn sẽ tự động được giữ lại (không thể tự xóa).</li>
                  <li>Dữ liệu phân công lịch sử của các giáo viên này vẫn được bảo lưu an toàn.</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteUsers}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa {selectedUserIds.length} người dùng</span>
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border animate-in slide-in-from-bottom duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-300 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ERROR TOAST MESSAGE (LEGACY) */}
      {deleteErrorMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium border border-rose-700 animate-in slide-in-from-bottom">
          <AlertTriangle className="w-4 h-4 text-rose-300 flex-shrink-0" />
          <span>{deleteErrorMessage}</span>
          <button onClick={() => setDeleteErrorMessage(null)} className="ml-2 text-rose-300 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
