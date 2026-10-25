/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Main Responsive Layout (Desktop Sidebar + Mobile Drawer & Bottom Bar)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  TableProperties,
  Users,
  GraduationCap,
  AlertTriangle,
  FileSpreadsheet,
  GitCompare,
  History,
  CheckCircle2,
  Download,
  Upload,
  Settings,
  Menu,
  X,
  ChevronDown,
  Shield,
  ShieldAlert,
  Bell,
  Sparkles,
  Lock,
  Unlock,
  Building2,
  Calendar,
  Layers,
  HelpCircle,
  Maximize,
  Minimize,
  UserCheck,
  ShieldCheck,
  Edit3,
  Eye,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Search,
  LogOut,
  Cloud,
  CloudUpload,
  UploadCloud,
  Plus,
  Save,
  RotateCcw,
} from 'lucide-react';
import { dataStore, isSuperAdminEmail, isThongKeSchool } from '../repositories/dataStore';
import { auth } from '../firebase/config';
import { UserProfile, SemesterId, AssignmentVersion } from '../types';
import { toastService, ToastSettings } from '../services/toastService';
import { ToastContainer } from './ToastContainer';
import { ToastSettingsModal } from './ToastSettingsModal';
import { CloudSyncModal } from './CloudSyncModal';
import { TeachingPlanFrameworkModal } from './TeachingPlanFrameworkModal';
import { VersionBackupManagerModal } from './VersionBackupManagerModal';

export type ActiveTab =
  | 'dashboard'
  | 'assignments'
  | 'teachers'
  | 'classes-curriculum'
  | 'bulk-management'
  | 'users-management'
  | 'validation'
  | 'reports'
  | 'abbreviations'
  | 'compare'
  | 'audit-feedback'
  | 'system-tests';

interface LayoutProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children: React.ReactNode;
  onOpenImportExport: () => void;
  onOpenNewVersionModal: () => void;
  onOpenSchoolSetup?: () => void;
  onOpenGlobalSearch?: () => void;
  onSignOut?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  setActiveTab,
  children,
  onOpenImportExport,
  onOpenNewVersionModal,
  onOpenSchoolSetup,
  onOpenGlobalSearch,
  onSignOut,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(dataStore.getCurrentUser());
  const [schoolInfo, setSchoolInfo] = useState(dataStore.getSchoolInfo());
  const [schoolYears, setSchoolYears] = useState(dataStore.getSchoolYears());
  const [versions, setVersions] = useState(dataStore.getVersions());
  const [context, setContext] = useState(dataStore.getSelectedContext());
  const [usersList, setUsersList] = useState<UserProfile[]>(dataStore.getUsers());
  const uniqueUsersList = useMemo(() => {
    const seen = new Set<string>();
    return usersList.filter((p) => {
      if (!p) return false;
      const key = p.id || p.email;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [usersList]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installable, setInstallable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isToastSettingsOpen, setIsToastSettingsOpen] = useState(false);
  const [toastSettings, setToastSettings] = useState<ToastSettings>(toastService.getSettings());
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'syncing' | 'connected' | 'error'>(() => dataStore.getCloudSyncStatus());
  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => dataStore.getSchoolId());
  const [isTeachingPlanModalOpen, setIsTeachingPlanModalOpen] = useState(false);
  const [isVersionBackupModalOpen, setIsVersionBackupModalOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(() => dataStore.hasUnsavedChanges());
  const [isExitPromptOpen, setIsExitPromptOpen] = useState(false);
  const [pendingNavTab, setPendingNavTab] = useState<ActiveTab | null>(null);
  const [isTabSwitchPromptOpen, setIsTabSwitchPromptOpen] = useState(false);

  const handleNavTabClick = (targetTab: string) => {
    if (targetTab === 'version-backups') {
      setIsVersionBackupModalOpen(true);
      return;
    }
    if (targetTab === 'school-info') {
      onOpenSchoolSetup?.();
      return;
    }
    if (hasUnsavedChanges && targetTab !== activeTab) {
      setPendingNavTab(targetTab as ActiveTab);
      setIsTabSwitchPromptOpen(true);
    } else {
      setActiveTab(targetTab as ActiveTab);
    }
  };

  // Ref & click-outside listener to auto-collapse user profile and SAVE dropdowns
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setIsSaveMenuOpen(false);
      }
    };
    if (isUserMenuOpen || isSaveMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isUserMenuOpen, isSaveMenuOpen]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('app_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setCurrentUser(dataStore.getCurrentUser());
      setSchoolInfo(dataStore.getSchoolInfo());
      setSchoolYears(dataStore.getSchoolYears());
      setVersions(dataStore.getVersions());
      setContext(dataStore.getSelectedContext());
      setUsersList(dataStore.getUsers());
      setCloudStatus(dataStore.getCloudSyncStatus());
      setCurrentSchoolId(dataStore.getSchoolId());
      setHasUnsavedChanges(dataStore.hasUnsavedChanges());
    });

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // PWA Install prompt listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const unsubToast = toastService.subscribeSettings((newSettings) => {
      setToastSettings(newSettings);
    });

    // Global shortcut listener for search (Ctrl+K or /)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenGlobalSearch?.();
        return;
      }
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        onOpenGlobalSearch?.();
        return;
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    // Cảnh báo người dùng khi thoát hoặc đóng tab nếu còn dữ liệu mới chưa đẩy lên Cloud
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dataStore.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'Dữ liệu mới chỉnh sửa chưa được đẩy lên Cloud! Bạn có muốn lưu trước khi thoát không?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsub();
      unsubToast();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onOpenGlobalSearch]);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch((err) => {
          console.warn('Fullscreen request error:', err);
          // Fallback to full width layout mode
          setIsFullWidth((prev) => !prev);
        });
      } else {
        document.exitFullscreen?.().catch((err) => {
          console.warn('Exit fullscreen error:', err);
        });
      }
    } catch (e) {
      setIsFullWidth((prev) => !prev);
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleContextChange = (schoolYearId: string, semesterId: SemesterId, versionId: string) => {
    dataStore.setSelectedContext(schoolYearId, semesterId, versionId);
  };

  const currentVersion = versions.find((v) => v.id === context.versionId) || versions[0];
  const isLocked = currentVersion?.status === 'locked';
  const detectedUrlId = dataStore.detectUrlSchoolId();
  // CHỦ SỞ HỮU / QUẢN TRỊ VIÊN TỐI CAO: Chỉ cấp quyền tối cao khi email tài khoản hiện tại khớp chính xác email Super Admin
  const isMasterSuperAdmin = Boolean(isSuperAdminEmail(currentUser?.email));
  const isTenant = Boolean(detectedUrlId && detectedUrlId !== 'school_quyhop') || currentSchoolId !== 'school_quyhop' || (Boolean(currentUser.schoolId) && currentUser.schoolId !== 'school_quyhop');
  const licenseCheck = dataStore.checkSchoolLicense();

  // Menu bên trái viết chữ in và sắp xếp:
  // THÔNG TIN TRƯỜNG, TỔNG QUAN, NHẬP DỮ LIỆU, PHÂN CÔNG CM, LỚP & MÔN, GIÁO VIÊN, BÁO CÁO...
  const navItems = [
    { id: 'school-info', label: 'THÔNG TIN TRƯỜNG', icon: Building2, badge: null },
    { id: 'dashboard', label: 'TỔNG QUAN', icon: LayoutDashboard, badge: null },
    { id: 'bulk-management', label: 'NHẬP DỮ LIỆU', icon: Layers, badge: null },
    { id: 'assignments', label: 'PHÂN CÔNG CM', icon: TableProperties, badge: null },
    { id: 'classes-curriculum', label: 'LỚP & MÔN', icon: GraduationCap, badge: null },
    { id: 'teachers', label: 'GIÁO VIÊN', icon: Users, badge: null },
    { id: 'reports', label: 'BÁO CÁO', icon: FileSpreadsheet, badge: '15 Mẫu' },
    { id: 'validation', label: 'KIỂM TRA LỖI', icon: AlertTriangle, badge: 'Cảnh báo' },
    { id: 'compare', label: 'SO SÁNH', icon: GitCompare, badge: null },
    { id: 'version-backups', label: 'LƯU PHIÊN BẢN', icon: History, badge: 'Lưu' },
    { id: 'audit-feedback', label: 'LỊCH SỬ', icon: History, badge: null },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans">
      {/* TOP HEADER */}
      <header className="bg-white/95 backdrop-blur-md text-slate-800 sticky top-0 z-40 shadow-2xs border-b border-slate-200/90">
        <div className={`${isFullWidth || isFullscreen ? 'w-full px-4' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8'} transition-all duration-200`}>
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Left: Branding & Mobile Menu Toggle */}
            <div className="flex items-center gap-3">
              <button
                id="mobile-menu-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none"
                aria-label="Toggle Menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>

              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white font-black text-sm shadow-xs flex-shrink-0 tracking-wider">
                  PC
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wider text-blue-950 font-black flex items-center gap-1.5 truncate">
                    <span>PHÂN CÔNG CHUYÊN MÔN</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {isMasterSuperAdmin ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-bold px-2 py-0.5 rounded-lg shadow-2xs transition">
                        <Building2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <select
                          id="header-school-selector"
                          value={currentSchoolId}
                          onChange={(e) => {
                            const val = e.target.value;
                            dataStore.setSchoolId(val);
                            setCurrentSchoolId(val);
                            const targetLic = dataStore.getSchoolLicenseById(val);
                            const cleanName = (targetLic?.schoolName || val)
                              .replace(/\s*\([^)]*\)/g, '')
                              .replace(/khôi phục/gi, '')
                              .trim();
                            toastService.success(`Đã chuyển không gian làm việc: ${cleanName}`);
                          }}
                          className="bg-transparent text-purple-950 font-bold focus:outline-none cursor-pointer max-w-[280px] truncate"
                          title="Chuyển đổi trường học được cấp quyền"
                        >
                          {dataStore
                            .getSchoolLicenses()
                            .filter((lic) => !isThongKeSchool(lic.id, lic.schoolName) && lic.id !== 'school_thongke' && lic.status !== 'locked')
                            .map((lic) => {
                              const cleanName = (lic.schoolName || '')
                                .replace(/\s*\([^)]*\)/g, '')
                                .replace(/khôi phục/gi, '')
                                .trim();
                              return (
                                <option key={lic.id} value={lic.id}>
                                  {cleanName}
                                </option>
                              );
                            })}
                        </select>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-800 border border-slate-300 font-bold px-2.5 py-0.5 rounded-lg shadow-2xs">
                        <Building2 className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                        <span className="max-w-[280px] truncate">
                          {(schoolInfo.schoolName || 'TRƯỜNG HỌC')
                            .replace(/\s*\([^)]*\)/g, '')
                            .replace(/khôi phục/gi, '')
                            .trim()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Quick Context Selector (Year, Semester, Version) */}
            <div className="hidden md:flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/80 text-xs">
              {/* Semester Selector */}
              <div className="flex items-center rounded-lg bg-white p-0.5 mr-2 shadow-2xs border border-slate-200/60">
                <button
                  id="select-hk1-btn"
                  onClick={() => handleContextChange(context.schoolYearId, 'HK1', context.versionId)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    context.semesterId === 'HK1'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Học kỳ I
                </button>
                <button
                  id="select-hk2-btn"
                  onClick={() => handleContextChange(context.schoolYearId, 'HK2', context.versionId)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    context.semesterId === 'HK2'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Học kỳ II
                </button>
              </div>

              {/* Version Selector */}
              <div className="flex items-center gap-1.5 px-2 text-slate-700">
                <Layers className="w-3.5 h-3.5 text-blue-700" />
                <select
                  id="version-quick-select"
                  value={context.versionId}
                  onChange={(e) => handleContextChange(context.schoolYearId, context.semesterId, e.target.value)}
                  className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer pr-1"
                >
                  {versions
                    .filter((v) => v.semesterId === context.semesterId)
                    .map((v) => (
                      <option key={v.id} value={v.id} className="bg-white text-slate-900">
                        {v.name} {v.status === 'locked' ? '🔒' : v.status === 'approved' ? '✓' : '📝'}
                      </option>
                    ))}
                </select>
                {isLocked ? (
                  <span className="flex items-center gap-1 text-[11px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-md font-bold">
                    <Lock className="w-3 h-3 text-red-600" /> Đã khóa
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">
                    <Unlock className="w-3 h-3 text-emerald-600" /> Mở sửa
                  </span>
                )}
                
                <button
                  type="button"
                  onClick={onOpenNewVersionModal}
                  title="Quản lý & Lưu các đợt phân công thành phiên bản"
                  className="flex items-center gap-1 text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-md font-bold transition cursor-pointer ml-1"
                >
                  <Plus className="w-3 h-3 text-blue-700" />
                  <span>Bản mới</span>
                </button>
              </div>
            </div>

            {/* Right: Actions, Fullscreen Button & User Role Switcher */}
            <div className="flex items-center gap-2">
              {/* Global Search Button (No Ctrl+K label) */}
              <button
                id="global-search-trigger-btn"
                type="button"
                onClick={onOpenGlobalSearch}
                className="flex items-center gap-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200/90 hover:border-blue-300 text-xs font-medium shadow-2xs transition cursor-pointer group"
                title="Tìm kiếm: Giáo viên, Lớp học, Môn học"
              >
                <Search className="w-3.5 h-3.5 text-blue-900 group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden sm:inline font-semibold">Tìm kiếm</span>
              </button>

              {/* Fullscreen & Fullwidth Toggle Button */}
              <button
                id="global-fullscreen-btn"
                onClick={toggleFullscreen}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isFullscreen || isFullWidth
                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                    : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 shadow-2xs'
                }`}
                title={isFullscreen || isFullWidth ? 'Thu nhỏ giao diện' : 'Chuyển sang chế độ Full view'}
              >
                {isFullscreen || isFullWidth ? <Minimize className="w-3.5 h-3.5 text-blue-700" /> : <Maximize className="w-3.5 h-3.5 text-slate-500" />}
                <span className="hidden sm:inline">{isFullscreen || isFullWidth ? 'Thu nhỏ' : 'Full view'}</span>
              </button>

              {installable && (
                <button
                  id="pwa-install-btn"
                  onClick={handleInstallPWA}
                  className="hidden xl:flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Cài App
                </button>
              )}

              {/* Notification & Toast Settings Button */}
              <button
                id="header-toast-settings-btn"
                onClick={() => setIsToastSettingsOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  toastSettings.enabled
                    ? 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-400 border-slate-200'
                }`}
                title="Cài đặt thông báo thao tác Toast"
              >
                <div className="relative flex items-center justify-center">
                  <Bell className={`w-4 h-4 ${toastSettings.enabled ? 'text-blue-700' : 'text-slate-400'}`} />
                  {toastSettings.enabled && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                  )}
                </div>
                <span className="hidden sm:inline">Thông báo</span>
              </button>

              {/* NÚT SAVE & DROPDOWN 2 LỰA CHỌN GỌN GÀNG */}
              <div className="relative" ref={saveMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsSaveMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border active:scale-95 ${
                    hasUnsavedChanges
                      ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-md animate-pulse'
                      : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 shadow-2xs'
                  }`}
                  title="Lưu dữ liệu trên máy hoặc đẩy lên Cloud"
                >
                  <Save className={`w-4 h-4 ${hasUnsavedChanges ? 'text-white' : 'text-blue-700'}`} />
                  <span>SAVE</span>
                  {hasUnsavedChanges && (
                    <span className="w-2 h-2 rounded-full bg-amber-300 ring-2 ring-amber-500 animate-ping" />
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 ${hasUnsavedChanges ? 'text-white/80' : 'text-slate-400'}`} />
                </button>

                {isSaveMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tùy chọn lưu dữ liệu
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        dataStore.saveLocalNow();
                        toastService.success('Đã lưu tất cả thay đổi thành công vào máy!');
                        setIsSaveMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-emerald-50 text-slate-800 hover:text-emerald-950 transition flex items-center gap-2.5 font-bold cursor-pointer group"
                    >
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg group-hover:scale-105 transition-transform">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold">1. Lưu tạm trên máy này</div>
                        <div className="text-[10px] text-slate-500 font-normal">Lưu nhanh vào bộ nhớ trình duyệt</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSaveMenuOpen(false);
                        setIsCloudSyncOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-blue-50 text-slate-800 hover:text-blue-950 transition flex items-center gap-2.5 font-bold cursor-pointer group"
                    >
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                        <CloudUpload className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold">2. Lưu lên Cloud ngay</div>
                        <div className="text-[10px] text-slate-500 font-normal">Đẩy dữ liệu lên Cloud Firestore</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                id="header-import-export-btn"
                onClick={onOpenImportExport}
                className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs transition cursor-pointer"
                title="Xuất nhập Excel & Sao lưu dữ liệu"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel</span>
              </button>

              {/* User Profile / Quản trị button (auto collapses when clicking outside) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-profile-btn"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition text-left cursor-pointer"
                  title="Menu Quản trị hệ thống, dữ liệu Cloud và phân quyền"
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 text-xs">Quản trị</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cloudStatus === 'connected'
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : cloudStatus === 'syncing'
                          ? 'bg-amber-500 animate-ping ring-2 ring-amber-200'
                          : 'bg-slate-400'
                      }`}
                      title={`Trạng thái Cloud: ${cloudStatus}`}
                    />
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Đăng nhập & Phân quyền
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Kiểm thử phân quyền Sửa / Xem
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('users-management');
                          setIsUserMenuOpen(false);
                        }}
                        className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                      >
                        Quản trị
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {uniqueUsersList
                        .filter((p) => {
                          if (isMasterSuperAdmin) return true;
                          return (p.schoolId || 'school_quyhop') === currentSchoolId && !p.isSuperAdmin && !isSuperAdminEmail(p.email);
                        })
                        .map((profile, idx) => (
                        <button
                          key={`usr_layout_${profile.id}_${idx}`}
                          onClick={() => {
                            if ((profile.isSuperAdmin || isSuperAdminEmail(profile.email)) && !isMasterSuperAdmin) {
                              toastService.error('Chỉ Chủ sở hữu hệ thống mới có quyền truy cập tài khoản này!');
                              return;
                            }
                            dataStore.setCurrentUser(profile);
                            setIsUserMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                            currentUser.id === profile.id ? 'bg-blue-50/80 text-blue-950 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {profile.name}
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                  profile.permission === 'edit'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-sky-50 text-sky-700 border border-sky-200'
                                }`}
                              >
                                {profile.permission === 'edit' ? 'Sửa' : 'Xem'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">{profile.roleTitle}</div>
                          </div>
                          {currentUser.id === profile.id && <CheckCircle2 className="w-4 h-4 text-blue-700" />}
                        </button>
                      ))}
                    </div>
                    {/* Menu Cấp Quyền Trường Học (Chỉ hiển thị cho Chủ sở hữu phần mềm khi không ở link trường riêng) */}
                    {isMasterSuperAdmin && (
                      <div className="px-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            try {
                              sessionStorage.setItem('pccm_user_management_tab', 'LICENSES');
                              window.dispatchEvent(new CustomEvent('pccm-switch-subtab', { detail: 'LICENSES' }));
                            } catch {}
                            setActiveTab('users-management');
                          }}
                          className="w-full text-left px-3 py-2.5 text-xs flex items-center justify-between text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-xl transition cursor-pointer font-bold border border-amber-300 shadow-2xs mb-1"
                          title="Cấp quyền, quản lý bản quyền, mật khẩu và phân phối cho các trường học khác (Multi-tenant)"
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-[12px] text-amber-950">CẤP QUYỀN TRƯỜNG</span>
                              <span className="text-[10px] text-amber-700 font-medium">Bản quyền đơn vị khác (Multi-tenant)</span>
                            </div>
                          </div>
                          <span className="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-md uppercase shrink-0">
                            Cấp quyền
                          </span>
                        </button>
                      </div>
                    )}

                    {isMasterSuperAdmin && (
                      <div className="px-2 pt-1 border-t border-slate-100 space-y-1">
                        <button
                          type="button"
                          id="menu-cloudflare-sync-btn"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setIsCloudSyncOpen(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center justify-between text-blue-950 bg-blue-50/90 hover:bg-blue-100 rounded-xl transition cursor-pointer font-black border border-blue-200/90 shadow-2xs"
                          title="Quản lý và lưu trữ dữ liệu trường học trên Cloud (Dành riêng cho Chủ sở hữu)"
                        >
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="font-extrabold text-xs tracking-wider text-blue-950">
                              LƯU CLOUD
                            </span>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              cloudStatus === 'connected'
                                ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                : cloudStatus === 'syncing'
                                ? 'bg-amber-500 animate-ping ring-2 ring-amber-200'
                                : 'bg-orange-500'
                            }`}
                            title={`Trạng thái: ${cloudStatus}`}
                          />
                        </button>
                      </div>
                    )}

                    <div className="px-3 py-2 text-[11px] text-slate-500">
                      Đang dùng: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.permission === 'edit' ? 'Có quyền sửa' : 'Chỉ xem'})
                    </div>

                    {onSignOut && (
                      <div className="px-2 pt-2 mt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            if (hasUnsavedChanges) {
                              setIsExitPromptOpen(true);
                            } else {
                              onSignOut();
                            }
                          }}
                          className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer font-bold"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          <span>Đăng xuất tài khoản</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* FLOATING EXPAND BUTTON WHEN MENU IS COLLAPSED */}
      {isSidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden lg:flex fixed left-3 top-20 z-40 items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3 py-2 rounded-xl shadow-lg border border-blue-700 text-xs font-bold transition cursor-pointer active:scale-95 group"
          title="Mở lại cột menu danh mục chức năng"
        >
          <PanelLeftOpen className="w-4 h-4 text-blue-300 group-hover:scale-110 transition-transform" />
          <span>Hiện Menu</span>
        </button>
      )}



      {/* BODY CONTAINER: SIDEBAR + MAIN CONTENT */}
      <div className={`flex-1 flex ${isFullWidth || isFullscreen || isSidebarCollapsed || activeTab === 'bulk-management' ? 'w-full px-2 sm:px-4 lg:px-6' : 'max-w-7xl w-full mx-auto px-2 sm:px-6 lg:px-8'} py-4 gap-4 sm:gap-6 transition-all duration-200`}>
        {/* DESKTOP LEFT SIDEBAR */}
        <aside className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:flex'} flex-col w-64 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 h-[calc(100vh-6.5rem)] sticky top-20`}>
          <div className="p-2 border-b border-slate-100 mb-2 flex items-center justify-between">
            <div className="w-6 shrink-0" />
            <div className="flex-1 text-center">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">DANH MỤC CHỨC NĂNG</div>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0 ml-1"
              title="Ẩn cột menu để mở rộng màn hình"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => handleNavTabClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition text-left group border-l-4 cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-950 font-bold border-blue-700 shadow-2xs'
                      : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        isActive
                          ? 'bg-blue-200/80 text-blue-900'
                          : item.id === 'validation'
                          ? 'bg-red-50 text-red-700 border border-red-200/70'
                          : item.id === 'users-management'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/70'
                          : 'bg-slate-100 text-slate-600 border border-slate-200/70'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Version Management Card in Sidebar */}
          <div className="mt-auto pt-3 border-t border-slate-100">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700">Phiên bản đang chọn</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    currentVersion?.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : currentVersion?.status === 'locked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {currentVersion?.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 font-medium">{currentVersion?.name}</p>
              <button
                id="sidebar-new-version-btn"
                onClick={onOpenNewVersionModal}
                className="w-full bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs py-1.5 rounded-lg border border-slate-300 shadow-2xs transition flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                Tạo / Nhân bản bản mới
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER MODAL */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative flex flex-col w-4/5 max-w-sm bg-white h-full shadow-2xl p-4 overflow-y-auto z-10">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-sm">
                    {schoolInfo.schoolName?.substring(0, 2).toUpperCase() || 'PCCM'}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">PHÂN CÔNG CHUYÊN MÔN</h2>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Global Search Button (No Ctrl K) */}
              <button
                id="mobile-drawer-search-btn"
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenGlobalSearch?.();
                }}
                className="w-full mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Search className="w-4 h-4 text-blue-900" />
                <span>Tìm kiếm</span>
              </button>

              {/* Mobile School Info / Selector */}
              <div className="bg-purple-50 p-2.5 rounded-xl mb-3 border border-purple-200">
                <div className="text-[11px] font-bold text-purple-900 uppercase mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-700" />
                  <span>Trường học</span>
                </div>
                {isMasterSuperAdmin ? (
                  <select
                    value={currentSchoolId}
                    onChange={(e) => {
                      const val = e.target.value;
                      dataStore.setSchoolId(val);
                      setCurrentSchoolId(val);
                      const targetLic = dataStore.getSchoolLicenseById(val);
                      const cleanName = (targetLic?.schoolName || val)
                        .replace(/\s*\([^)]*\)/g, '')
                        .replace(/khôi phục/gi, '')
                        .trim();
                      toastService.success(`Đã chuyển không gian làm việc: ${cleanName}`);
                    }}
                    className="w-full bg-white border border-purple-300 text-xs p-1.5 rounded-lg font-bold text-purple-950 focus:outline-none"
                  >
                    {dataStore
                      .getSchoolLicenses()
                      .filter((lic) => !isThongKeSchool(lic.id, lic.schoolName) && lic.id !== 'school_thongke' && lic.status !== 'locked')
                      .map((lic) => {
                        const cleanName = (lic.schoolName || '')
                          .replace(/\s*\([^)]*\)/g, '')
                          .replace(/khôi phục/gi, '')
                          .trim();
                        return (
                          <option key={lic.id} value={lic.id}>
                            {cleanName}
                          </option>
                        );
                      })}
                  </select>
                ) : (
                  <div className="w-full bg-white border border-purple-300 text-xs p-2 rounded-lg font-bold text-purple-950">
                    {(schoolInfo.schoolName || 'TRƯỜNG HỌC')
                      .replace(/\s*\([^)]*\)/g, '')
                      .replace(/khôi phục/gi, '')
                      .trim()}
                  </div>
                )}
              </div>

              {/* Mobile Semester & Version picker */}
              <div className="bg-slate-100 p-2.5 rounded-xl mb-3">
                <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Học kỳ & Phiên bản</div>
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => handleContextChange(context.schoolYearId, 'HK1', context.versionId)}
                    className={`flex-1 py-1 text-xs rounded-lg font-medium transition ${
                      context.semesterId === 'HK1' ? 'bg-blue-900 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    Học kỳ I
                  </button>
                  <button
                    onClick={() => handleContextChange(context.schoolYearId, 'HK2', context.versionId)}
                    className={`flex-1 py-1 text-xs rounded-lg font-medium transition ${
                      context.semesterId === 'HK2' ? 'bg-blue-900 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    Học kỳ II
                  </button>
                </div>
                <select
                  value={context.versionId}
                  onChange={(e) => handleContextChange(context.schoolYearId, context.semesterId, e.target.value)}
                  className="w-full bg-white border border-slate-300 text-xs p-1.5 rounded-lg font-medium text-slate-800"
                >
                  {versions
                    .filter((v) => v.semesterId === context.semesterId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.status})
                      </option>
                    ))}
                </select>
              </div>

              {/* Mobile Nav Links */}
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleNavTabClick(item.id);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-left border-l-4 transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-950 font-bold border-blue-700 shadow-2xs'
                          : 'border-transparent text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            isActive ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {onSignOut && (
                <div className="pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer font-bold bg-rose-50/50 border border-rose-200/60 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Đăng xuất tài khoản</span>
                    </div>
                    <span className="text-[10px] text-rose-400 font-normal">Thoát</span>
                  </button>
                </div>
              )}

              {/* Mobile Drawer Footer Copyright */}
              <div className="mt-auto pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                <p className="text-[11px] font-semibold text-slate-700">Copyright ©2026 Nguyentoanqh</p>
              </div>
            </div>
          </div>
        )}

        {/* MAIN APPLICATION CONTENT VIEW */}
        <main className="flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden">
          <div className="flex-1">{children}</div>

          {/* APP FOOTER WITH COPYRIGHT */}
          <footer className="mt-8 py-3.5 border-t border-slate-200/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 px-3 pb-20 lg:pb-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-semibold text-slate-700">{schoolInfo.schoolName || 'TRƯỜNG THCS'}</span>
              {schoolInfo.authorityName && (
                <>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="text-slate-500 hidden sm:inline">{schoolInfo.authorityName}</span>
                </>
              )}
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="hidden sm:inline">Phần mềm Quản lý Phân công chuyên môn</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="font-semibold text-slate-800">Copyright ©2026 Nguyentoanqh</span>
            </div>
          </footer>
        </main>
      </div>

      {/* MOBILE BOTTOM QUICK NAVIGATION BAR (For Phone Users) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1.5 z-40 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium ${
            activeTab === 'dashboard' ? 'text-blue-900 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setActiveTab('bulk-management')}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium ${
            activeTab === 'bulk-management' ? 'text-blue-900 font-bold' : 'text-slate-500'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>Nhập liệu</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium ${
            activeTab === 'assignments' ? 'text-blue-900 font-bold' : 'text-slate-500'
          }`}
        >
          <TableProperties className="w-5 h-5" />
          <span>Phân công CM</span>
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium ${
            activeTab === 'validation' ? 'text-blue-900 font-bold' : 'text-slate-500'
          }`}
        >
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span>Kiểm lỗi</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 p-1 text-[10px] font-medium text-slate-500"
        >
          <Menu className="w-5 h-5" />
          <span>Thêm nữa</span>
        </button>
      </nav>

      {/* Floating Real-time Toast Notifications Container */}
      <ToastContainer onOpenSettings={() => setIsToastSettingsOpen(true)} />

      {/* Toast Notification Settings & Filter Modal */}
      <ToastSettingsModal
        isOpen={isToastSettingsOpen}
        onClose={() => setIsToastSettingsOpen(false)}
      />

      {/* Cloud Firestore Multi-tenant Sync Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
      />

      {/* Teaching Plan Framework Modal */}
      <TeachingPlanFrameworkModal
        isOpen={isTeachingPlanModalOpen}
        onClose={() => setIsTeachingPlanModalOpen(false)}
        schoolInfo={schoolInfo}
        teachers={dataStore.getTeachers()}
        classes={dataStore.getClasses()}
        subjects={dataStore.getSubjects()}
      />

      {/* Version History & Backup Hub Modal (100% Instant Restore, Export File, Import File) */}
      <VersionBackupManagerModal
        isOpen={isVersionBackupModalOpen}
        onClose={() => setIsVersionBackupModalOpen(false)}
      />

      {/* MODAL HỎI LƯU DỮ LIỆU KHI THOÁT / ĐĂNG XUẤT */}
      {isExitPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Dữ liệu mới chưa đẩy lên Cloud!</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bạn có các thay đổi vừa nhập chưa được đồng bộ</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có muốn lưu tạm trên máy này hoặc đẩy dữ liệu lên Cloud trước khi đăng xuất / thoát phần mềm không?
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsExitPromptOpen(false);
                  setIsCloudSyncOpen(true);
                }}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-amber-300" />
                <span>Lưu lên Cloud ngay (Khuyên dùng)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  dataStore.saveLocalNow();
                  setIsExitPromptOpen(false);
                  toastService.success('Đã lưu tạm vào máy thành công!');
                  if (onSignOut) onSignOut();
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Lưu tạm trên máy rồi thoát</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsExitPromptOpen(false);
                  dataStore.discardUnsavedChanges();
                  if (onSignOut) onSignOut();
                }}
                className="w-full py-2 px-4 text-slate-400 hover:text-slate-600 text-xs font-semibold transition cursor-pointer text-center"
              >
                Không lưu & Thoát luôn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỎI LƯU DỮ LIỆU KHI CHUYỂN PHÂN HỆ / TAB */}
      {isTabSwitchPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Dữ liệu có thay đổi chưa lưu!</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bạn đang có dữ liệu vừa chỉnh sửa chưa được lưu</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
              Bạn có muốn lưu các thay đổi này vào bộ nhớ máy hoặc đẩy lên Cloud trước khi chuyển sang mục khác không?
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  dataStore.saveLocalNow();
                  setHasUnsavedChanges(false);
                  toastService.success('Đã lưu dữ liệu thành công!');
                  if (pendingNavTab) {
                    setActiveTab(pendingNavTab);
                  }
                  setIsTabSwitchPromptOpen(false);
                  setPendingNavTab(null);
                }}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-200" />
                <span>Lưu thay đổi & Chuyển tiếp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsTabSwitchPromptOpen(false);
                  setIsCloudSyncOpen(true);
                }}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <CloudUpload className="w-4 h-4 text-amber-300" />
                <span>Lưu lên Cloud ngay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  dataStore.discardUnsavedChanges();
                  setHasUnsavedChanges(false);
                  toastService.info('Đã bỏ qua các thay đổi chưa lưu.');
                  if (pendingNavTab) {
                    setActiveTab(pendingNavTab);
                  }
                  setIsTabSwitchPromptOpen(false);
                  setPendingNavTab(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Bỏ qua thay đổi & Chuyển tiếp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsTabSwitchPromptOpen(false);
                  setPendingNavTab(null);
                }}
                className="w-full py-2 px-4 text-slate-400 hover:text-slate-600 text-xs font-semibold transition cursor-pointer text-center"
              >
                Ở lại trang hiện tại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

