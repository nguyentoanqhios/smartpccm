/**
 * CLOUD SYNC & MULTI-TENANT STORAGE MODAL
 * Hệ thống đồng bộ và lưu trữ đám mây đa trường học toàn diện (Cloudflare Pages + KV / Worker + Firestore)
 * Dành riêng cho Chủ sở hữu hệ thống (Super Admin Thầy Nguyễn Văn Toàn)
 */

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Users,
  GraduationCap,
  Layers,
  Building2,
  Clock,
  ShieldCheck,
  Check,
  Settings,
  Code2,
  Copy,
  Download,
  RefreshCw,
  Database,
  ExternalLink,
  History,
  FileSpreadsheet,
  Globe,
  Sliders,
  CheckSquare,
} from 'lucide-react';
import { dataStore, isSuperAdminEmail } from '../repositories/dataStore';
import { firestoreRepository } from '../repositories/firestoreRepository';
import { cloudflareTenantService, CloudflareTenantSyncPayload } from '../services/cloudflareTenantService';
import { CLOUDFLARE_WORKER_CODE } from '../services/cloudflareWorkerCode';
import { auth, ensureFirebaseAuth } from '../firebase/config';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'SYNC' | 'CONFIG' | 'CODE' | 'TENANTS' | 'HISTORY';
}

type ModalTab = 'SYNC' | 'CONFIG' | 'CODE' | 'TENANTS' | 'HISTORY';

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'SYNC',
}) => {
  const currentUser = dataStore.getCurrentUser();
  const schoolId = dataStore.getSchoolId() || 'school_quyhop';
  const schoolInfo = dataStore.getSchoolInfo();
  const teachers = dataStore.getTeachers();
  const classes = dataStore.getClasses();
  const assignments = dataStore.getAssignments(undefined, undefined, undefined, true);
  const departments = dataStore.getDepartments();
  const subjects = dataStore.getSubjects();
  const duties = dataStore.getDuties();
  const branches = dataStore.getBranches();
  const versions = dataStore.getVersions();

  const isMasterSuperAdmin = Boolean(
    isSuperAdminEmail(currentUser.email) ||
    currentUser.isSuperAdmin ||
    isSuperAdminEmail(auth.currentUser?.email)
  );

  // State Tabs
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  // Sync states
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pushProgressStep, setPushProgressStep] = useState<string>('');
  const [pushProgressPercent, setPushProgressPercent] = useState<number>(0);
  const [pullProgressStep, setPullProgressStep] = useState<string>('');
  const [pullProgressPercent, setPullProgressPercent] = useState<number>(0);

  const [operationResult, setOperationResult] = useState<{
    type: 'push' | 'pull';
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  const [isPushingLicenses, setIsPushingLicenses] = useState(false);

  // Cloudflare Config State
  const [cfWorkerUrl, setCfWorkerUrl] = useState(() => cloudflareTenantService.getConfig()?.workerUrl || '');
  const [cfApiKey, setCfApiKey] = useState(() => cloudflareTenantService.getConfig()?.apiKey || '');
  const [autoSync, setAutoSync] = useState(() => cloudflareTenantService.getConfig()?.autoSync || false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Code tab state
  const [copiedCode, setCopiedCode] = useState(false);

  // Tenants list state
  const [tenantsList, setTenantsList] = useState<{ id: string; schoolName: string; updatedAt?: string; teacherCount?: number; classCount?: number }[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [inspectingTenantId, setInspectingTenantId] = useState<string | null>(null);

  const lastSyncTime = dataStore.getCloudLastSyncTime();
  const cloudStatus = dataStore.getCloudSyncStatus();

  useEffect(() => {
    if (isOpen) {
      setOperationResult(null);
      setPushProgressStep('');
      setPushProgressPercent(0);
      setPullProgressStep('');
      setPullProgressPercent(0);
      setConnectionTestResult(null);
      setIsSavedNotice(false);
      setCopiedCode(false);

      if (activeTab === 'TENANTS') {
        loadTenantsList();
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // 1. PUSH TO CLOUD (Đẩy lên đám mây)
  const handlePushToCloud = async () => {
    if (isPushing || isPulling) return;
    setIsPushing(true);
    setOperationResult(null);
    setPushProgressPercent(10);
    setPushProgressStep('Đang khởi tạo kết nối Cloud Firestore & Cloudflare an toàn...');

    try {
      // 1. Đồng bộ Firestore
      const firestoreRes = await dataStore.syncCurrentDataToFirestore((step, percent) => {
        setPushProgressStep(step);
        setPushProgressPercent(Math.min(85, percent));
      });

      // 2. Nếu cấu hình Cloudflare Worker tồn tại, đẩy bản sao lưu multi-tenant lên KV
      if (cfWorkerUrl.trim()) {
        setPushProgressStep('Đang lưu trữ bản sao lưu đa tầng lên Cloudflare KV...');
        setPushProgressPercent(90);
        try {
          const payload: CloudflareTenantSyncPayload = {
            schoolId,
            schoolInfo,
            teachers,
            classes,
            assignments,
            departments,
            subjects,
            duties,
            branches,
            versions,
            updatedAt: new Date().toISOString(),
          };
          await cloudflareTenantService.syncTenantToCloudflare(payload);
        } catch (cfErr: any) {
          console.warn('Lưu Cloudflare bổ sung thông báo:', cfErr?.message);
        }
      }

      setPushProgressPercent(100);
      setPushProgressStep('Hoàn tất lưu trữ đám mây!');

      if (firestoreRes.success) {
        setOperationResult({
          type: 'push',
          success: true,
          message: `Đã đẩy và lưu trữ an toàn toàn bộ dữ liệu của trường [${schoolInfo.schoolName || schoolId}] lên Đám mây! (${teachers.length} Giáo viên, ${classes.length} Lớp học, ${assignments.length} Tiết phân công)`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      } else {
        setOperationResult({
          type: 'push',
          success: false,
          message: firestoreRes.message || 'Không thể đồng bộ toàn bộ dữ liệu lên Đám mây.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (err: any) {
      setOperationResult({
        type: 'push',
        success: false,
        message: err?.message || 'Có lỗi xảy ra khi kết nối máy chủ Đám mây.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setIsPushing(false);
    }
  };

  // 2. PULL FROM CLOUD (Tải về từ đám mây)
  const handlePullFromCloud = async (targetId?: string) => {
    if (isPushing || isPulling) return;
    const targetSchoolId = targetId || schoolId;
    setIsPulling(true);
    setOperationResult(null);
    setPullProgressPercent(15);
    setPullProgressStep(`Đang kết nối và kiểm tra bản lưu trường [${targetSchoolId}] trên Đám mây...`);

    try {
      // 1. Ưu tiên kéo từ Cloud Firestore
      const pullRes = await dataStore.pullDataFromFirestore(targetSchoolId, (step, percent) => {
        setPullProgressStep(step);
        setPullProgressPercent(percent);
      });

      // 2. Nếu Firestore chưa có và Worker có cấu hình, kéo từ Cloudflare KV
      if (!pullRes.success && cfWorkerUrl.trim()) {
        setPullProgressStep('Kiểm tra dữ liệu dự phòng trên Cloudflare KV...');
        const cfData = await cloudflareTenantService.pullTenantFromCloudflare(targetSchoolId);
        if (cfData) {
          dataStore.restoreFromCloudflarePayload(cfData, targetSchoolId);
          pullRes.success = true;
          pullRes.message = `Đã khôi phục thành công từ bản sao lưu Cloudflare KV!`;
        }
      }

      setPullProgressPercent(100);
      setPullProgressStep('Hoàn tất tải về từ đám mây!');

      if (pullRes.success) {
        setOperationResult({
          type: 'pull',
          success: true,
          message: `Đã tải về và cập nhật thành công dữ liệu mới nhất từ Đám mây! (${dataStore.getTeachers().length} Giáo viên, ${dataStore.getClasses().length} Lớp học, ${dataStore.getAssignments(undefined, undefined, undefined, true).length} Tiết phân công)`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      } else {
        setOperationResult({
          type: 'pull',
          success: false,
          message: pullRes.message || 'Không tìm thấy bản lưu trữ phù hợp của trường trên Cloud.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (err: any) {
      setOperationResult({
        type: 'pull',
        success: false,
        message: err?.message || 'Có lỗi xảy ra khi tải dữ liệu từ Đám mây.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setIsPulling(false);
    }
  };

  // 3. PUSH ALL LICENSES / CONFIGS TO CLOUD (Đẩy đồng bộ cấu hình & bản quyền cho các trường)
  const handlePushAllLicensesToCloud = async () => {
    if (isPushingLicenses || isPushing || isPulling) return;
    setIsPushingLicenses(true);
    setOperationResult(null);

    try {
      await ensureFirebaseAuth();
      const res = await dataStore.syncAllLicensesToCloud();
      if (res.success) {
        setOperationResult({
          type: 'push',
          success: true,
          message: `ĐÃ ĐỒNG BỘ THÀNH CÔNG CẤU HÌNH CHO CÁC TRƯỜNG: Đã đẩy ${res.count} trường bản quyền lên Cloud Firestore (Vercel). Các trường đối tác có thể truy cập hệ thống ngay lập tức với phiên bản mới nhất! (Dữ liệu nội bộ riêng của từng trường được bảo vệ 100%, không bị ghi đè).`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        await loadTenantsList();
      } else {
        setOperationResult({
          type: 'push',
          success: false,
          message: res.message || 'Lỗi khi đẩy đồng bộ cấu hình bản quyền lên Cloud.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (err: any) {
      setOperationResult({
        type: 'push',
        success: false,
        message: err?.message || 'Có lỗi xảy ra khi đẩy cấu hình bản quyền lên Cloud Firestore.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setIsPushingLicenses(false);
    }
  };

  // 4. PUSH SINGLE LICENSE TO CLOUD
  const handlePushSingleLicenseToCloud = async (targetTenantId: string) => {
    const lic = dataStore.getSchoolLicenseById(targetTenantId);
    if (!lic) return;
    try {
      await ensureFirebaseAuth();
      await firestoreRepository.saveSchoolLicense(lic);
      setOperationResult({
        type: 'push',
        success: true,
        message: `Đã đẩy thành công cấu hình & bản quyền của trường [${lic.schoolName}] lên Cloud Firestore!`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      await loadTenantsList();
    } catch (err: any) {
      setOperationResult({
        type: 'push',
        success: false,
        message: `Lỗi khi đẩy cấu hình trường [${lic.schoolName}]: ${err?.message}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  // Test Cloudflare Worker Connection
  const handleTestConnection = async () => {
    if (!cfWorkerUrl.trim()) {
      setConnectionTestResult({
        success: false,
        message: 'Vui lòng nhập URL của Cloudflare Worker trước khi kiểm tra.',
      });
      return;
    }
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const res = await cloudflareTenantService.testConnection(cfWorkerUrl, cfApiKey);
      setConnectionTestResult(res);
    } catch (err: any) {
      setConnectionTestResult({
        success: false,
        message: err?.message || 'Không thể kết nối tới Cloudflare Worker.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save Cloudflare Worker Config
  const handleSaveConfig = () => {
    cloudflareTenantService.saveConfig({
      workerUrl: cfWorkerUrl.trim(),
      apiKey: cfApiKey.trim(),
      autoSync: autoSync,
    });
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  // Copy Worker Code
  const handleCopyWorkerCode = () => {
    navigator.clipboard.writeText(CLOUDFLARE_WORKER_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // Download worker.js file
  const handleDownloadWorkerJs = () => {
    const blob = new Blob([CLOUDFLARE_WORKER_CODE], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pccm-cloudflare-worker.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load Tenants List from Cloud
  const loadTenantsList = async () => {
    setIsLoadingTenants(true);
    try {
      const licenses = dataStore.getSchoolLicenses();
      const list = licenses.map((lic) => ({
        id: lic.id,
        schoolName: lic.schoolName,
        updatedAt: lic.updatedAt || lic.createdAt,
        teacherCount: lic.id === schoolId ? teachers.length : undefined,
        classCount: lic.id === schoolId ? classes.length : undefined,
      }));
      setTenantsList(list);
    } catch {
      // fallback
    } finally {
      setIsLoadingTenants(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-blue-300 shrink-0 border border-white/20">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight uppercase">
                  LƯU TRỮ & ĐỒNG BỘ ĐÁM MÂY (CLOUD SYNC)
                </h2>
                <span className="bg-blue-600/30 text-blue-200 text-[10px] px-2 py-0.5 rounded-full border border-blue-400/30 font-bold">
                  Multi-tenant Infrastructure
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Hạ tầng đồng bộ dữ liệu đám mây Google Firestore & Cloudflare Serverless KV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Dành riêng cho Chủ sở hữu phần mềm) */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 pt-2 flex items-center gap-1 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('SYNC')}
            className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'SYNC'
                ? 'bg-white text-blue-900 border-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
            }`}
          >
            <Cloud className="w-4 h-4 text-blue-600" />
            <span>Đồng bộ Đám mây</span>
          </button>

          {isMasterSuperAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('CONFIG')}
                className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'CONFIG'
                    ? 'bg-white text-blue-900 border-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
                }`}
              >
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>Cấu hình Cloudflare Worker</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('CODE')}
                className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'CODE'
                    ? 'bg-white text-blue-900 border-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
                }`}
              >
                <Code2 className="w-4 h-4 text-amber-600" />
                <span>Mã nguồn Worker</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('TENANTS');
                  loadTenantsList();
                }}
                className={`px-4 py-2.5 font-bold rounded-t-xl transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'TENANTS'
                    ? 'bg-white text-blue-900 border-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Quản lý Đa trường (Multi-tenant)</span>
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800">
          {/* TAB 1: SYNC (ĐỒNG BỘ ĐÁM MÂY) */}
          {activeTab === 'SYNC' && (
            <div className="space-y-5">
              {/* Status Header */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      cloudStatus === 'connected'
                        ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                        : cloudStatus === 'syncing'
                        ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300 animate-pulse'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      <span>Đơn vị: {schoolInfo.schoolName || schoolId}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.2 rounded-md font-mono">
                        {schoolId}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Đồng bộ gần nhất: <strong>{lastSyncTime || 'Chưa thực hiện'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 self-start sm:self-auto shadow-2xs">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      cloudStatus === 'connected'
                        ? 'bg-emerald-500 ring-2 ring-emerald-200'
                        : cloudStatus === 'syncing'
                        ? 'bg-amber-500 animate-ping ring-2 ring-amber-200'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span className="font-bold text-[11px] text-slate-700 uppercase tracking-wide">
                    {cloudStatus === 'connected'
                      ? 'Cloud Sẵn sàng'
                      : cloudStatus === 'syncing'
                      ? 'Đang đồng bộ...'
                      : 'Ngoại tuyến (Offline)'}
                  </span>
                </div>
              </div>

              {/* Data Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
                  <div className="flex justify-center text-blue-700 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-base font-black text-blue-950">{teachers.length}</div>
                  <div className="text-[10px] text-blue-700 font-bold uppercase">Giáo viên</div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                  <div className="flex justify-center text-emerald-700 mb-1">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div className="text-base font-black text-emerald-950">{classes.length}</div>
                  <div className="text-[10px] text-emerald-700 font-bold uppercase">Lớp học</div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
                  <div className="flex justify-center text-amber-700 mb-1">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="text-base font-black text-amber-950">{assignments.length}</div>
                  <div className="text-[10px] text-amber-700 font-bold uppercase">Tiết phân công</div>
                </div>

                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-center">
                  <div className="flex justify-center text-purple-700 mb-1">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="text-base font-black text-purple-950">{versions.length}</div>
                  <div className="text-[10px] text-purple-700 font-bold uppercase">Phiên bản</div>
                </div>
              </div>

              {/* TWO PRIMARY ACTION BUTTONS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* 1. NÚT ĐẨY LÊN ĐÁM MÂY */}
                <button
                  id="btn-cloud-push"
                  type="button"
                  disabled={isPushing || isPulling}
                  onClick={handlePushToCloud}
                  className={`p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2.5 font-bold transition shadow-sm border cursor-pointer ${
                    isPushing
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-gradient-to-br from-blue-900 to-indigo-950 hover:from-blue-800 hover:to-indigo-900 text-white border-blue-900 shadow-blue-950/20 hover:shadow-lg hover:scale-[1.01]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-inner">
                    {isPushing ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <CloudUpload className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-black uppercase tracking-wide">
                      ĐẨY LÊN ĐÁM MÂY (LƯU CLOUD)
                    </div>
                    <div className="text-xs font-normal text-blue-200/90 mt-1 max-w-xs">
                      Lưu trữ trực tuyến toàn diện: GV, Lớp, Phân công, Nhiệm vụ & Phiên bản
                    </div>
                  </div>
                </button>

                {/* 2. NÚT TẢI VỀ TỪ ĐÁM MÂY */}
                <button
                  id="btn-cloud-pull"
                  type="button"
                  disabled={isPushing || isPulling}
                  onClick={() => handlePullFromCloud()}
                  className={`p-5 rounded-2xl flex flex-col items-center justify-center text-center gap-2.5 font-bold transition shadow-sm border cursor-pointer ${
                    isPulling
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-gradient-to-br from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white border-emerald-800 shadow-emerald-950/20 hover:shadow-lg hover:scale-[1.01]'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-white shrink-0 shadow-inner">
                    {isPulling ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <CloudDownload className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-black uppercase tracking-wide">
                      TẢI VỀ TỪ ĐÁM MÂY (PHỤC HỒI)
                    </div>
                    <div className="text-xs font-normal text-emerald-100/90 mt-1 max-w-xs">
                      Khôi phục dữ liệu phân công mới nhất từ Cloud về máy tính hiện tại
                    </div>
                  </div>
                </button>
              </div>

              {/* DÀNH CHO SUPER ADMIN: NÚT ĐẨY ĐỒNG BỘ CẤU HÌNH & BẢN QUYỀN CHO CÁC TRƯỜNG */}
              {isMasterSuperAdmin && (
                <div className="p-4 bg-gradient-to-r from-amber-50/90 via-indigo-50/70 to-blue-50/90 border-2 border-indigo-300/80 rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-900 to-blue-950 text-white flex items-center justify-center shrink-0 shadow-md">
                        <ShieldCheck className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-indigo-950 uppercase flex items-center gap-2 flex-wrap">
                          <span>ĐỒNG BỘ CẤU HÌNH & BẢN QUYỀN CHO CÁC TRƯỜNG</span>
                          <span className="text-[10px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                            Vercel / Firebase Cloud
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">
                          Đẩy danh sách bản quyền, mật khẩu đăng nhập và quyền hạn của các trường lên Cloud Firestore.
                          <br />
                          <span className="text-emerald-800 font-bold">
                            ✓ Dữ liệu nội bộ (giáo viên, lớp học, phân công) của từng trường được cách ly an toàn 100%, không bị ảnh hưởng hay ghi đè.
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      id="btn-sync-all-licenses-to-cloud"
                      type="button"
                      disabled={isPushingLicenses || isPushing || isPulling}
                      onClick={handlePushAllLicensesToCloud}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 hover:from-indigo-800 hover:to-blue-800 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-indigo-700 hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                      title="Đẩy đồng bộ cấu hình bản quyền và thông tin truy cập cho tất cả các trường lên Firebase Cloud"
                    >
                      {isPushingLicenses ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      ) : (
                        <UploadCloud className="w-4 h-4 text-amber-300" />
                      )}
                      <span>{isPushingLicenses ? 'Đang đẩy cấu hình...' : 'ĐẨY ĐỒNG BỘ CẤU HÌNH CHO CÁC TRƯỜNG'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Indicator */}
              {(isPushing || isPulling) && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{isPushing ? pushProgressStep : pullProgressStep}</span>
                    </span>
                    <span className="text-blue-900 font-mono">
                      {isPushing ? pushProgressPercent : pullProgressPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        isPushing ? 'bg-blue-600' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${isPushing ? pushProgressPercent : pullProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Operation Result Alert */}
              {operationResult && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in ${
                    operationResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {operationResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 text-xs">
                    <div className="font-black text-sm">
                      {operationResult.success
                        ? operationResult.type === 'push'
                          ? 'Đã đẩy dữ liệu lên Đám mây thành công!'
                          : 'Đã tải dữ liệu từ Đám mây thành công!'
                        : 'Thao tác không hoàn tất'}
                    </div>
                    <div className="leading-relaxed">{operationResult.message}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Thời điểm thực hiện: {operationResult.timestamp}
                    </div>
                  </div>
                </div>
              )}

              {/* Short guidance */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-[11px] text-blue-950 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Bảo vệ dữ liệu đa tầng:</strong> Khi chọn <strong>Đẩy lên đám mây</strong>, dữ liệu được mã hóa và lưu trữ an toàn theo School ID riêng biệt. Trên thiết bị khác hoặc khi làm việc trực tuyến, chỉ cần chọn <strong>Tải về từ đám mây</strong> để làm việc tiếp tục mà không lo mất mát dữ liệu.
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG (CẤU HÌNH CLOUDFLARE WORKER) */}
          {activeTab === 'CONFIG' && isMasterSuperAdmin && (
            <div className="space-y-4">
              {/* THÔNG BÁO VỀ VERCEL VÀ BACKEND */}
              <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-2.5">
                <div className="font-black flex items-center gap-2 text-amber-950 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>LƯU Ý QUAN TRỌNG: ỨNG DỤNG ĐANG CHẠY TRÊN VERCEL (KHÔNG CẦN BACKEND)</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-700">
                  Phần mềm triển khai trên <strong>Vercel</strong> hoạt động theo kiến trúc Frontend tĩnh trực tiếp kết nối với <strong>Google Firebase Firestore</strong>. Hệ thống <strong>hoàn toàn không cần máy chủ backend hay Cloudflare Worker</strong> để hoạt động hay đồng bộ dữ liệu.
                </p>
                <div className="p-2.5 bg-white rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-1">
                  <span className="font-bold text-amber-900 block">
                    ⚡ Vì sao bạn thấy thông báo "Không thể kết nối tới Cloudflare Worker: Failed to fetch"?
                  </span>
                  <span>
                    Thông báo này xuất hiện khi URL Worker bên dưới chưa được triển khai hoặc không tồn tại. Điều này <strong>HOÀN TOÀN BÌNH THƯỜNG</strong> và <strong>KHÔNG ẢNH HƯỞNG GÌ</strong> đến việc lưu trữ và đồng bộ của các trường học qua Google Firebase!
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCfWorkerUrl('');
                      setConnectionTestResult(null);
                      cloudflareTenantService.saveConfig({ workerUrl: '', apiKey: '', autoSync: false });
                    }}
                    className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-[11px] transition cursor-pointer"
                  >
                    Bỏ trống URL Worker (Xóa thông báo đỏ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('SYNC')}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-[11px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-200" />
                    <span>Sang Tab Đồng bộ Đám mây (Firebase)</span>
                  </button>
                </div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-2 text-indigo-950">
                  <Globe className="w-4 h-4 text-indigo-700" />
                  <span>TÙY CHỌN BỔ SUNG: HẠ TẦNG CLOUDFLARE SERVERLESS (KV / WORKERS)</span>
                </div>
                <p className="leading-relaxed">
                  (Tùy chọn phụ) Nếu muốn thiết lập thêm 1 lớp sao lưu thứ hai trên Cloudflare KV dự phòng ngoài Firebase Firestore, hãy triển khai mã nguồn ở tab bên cạnh và dán URL vào đây:
                </p>
              </div>

              <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Cloudflare Worker URL *
                  </label>
                  <input
                    type="text"
                    value={cfWorkerUrl}
                    onChange={(e) => setCfWorkerUrl(e.target.value)}
                    placeholder="https://pccm-api.yourname.workers.dev"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Đường dẫn máy chủ Cloudflare Worker đã triển khai
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    X-API-KEY / Secret Key (Tùy chọn)
                  </label>
                  <input
                    type="password"
                    value={cfApiKey}
                    onChange={(e) => setCfApiKey(e.target.value)}
                    placeholder="Nhập khóa bảo mật nếu có thiết lập SECRET_API_KEY"
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nếu bạn đã thiết lập biến bí mật SECRET_API_KEY trong Worker Settings
                  </p>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-auto-sync"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="chk-auto-sync" className="font-bold text-xs text-slate-700 cursor-pointer">
                    Tự động sao lưu lên Cloudflare KV khi có thay đổi phân công
                  </label>
                </div>

                {/* Connection Test Result */}
                {connectionTestResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                      connectionTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {connectionTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-bold">
                        {connectionTestResult.success ? 'Kết nối thành công!' : 'Kết nối thất bại'}
                      </div>
                      <div className="mt-0.5 leading-relaxed">{connectionTestResult.message}</div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isTestingConnection ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    )}
                    <span>Kiểm tra kết nối (Healthcheck)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isSavedNotice && (
                      <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã lưu cấu hình!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Lưu cấu hình Worker</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CODE (MÃ NGUỒN WORKER) */}
          {activeTab === 'CODE' && isMasterSuperAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                    MÃ NGUỒN CLOUDFLARE WORKER MULTI-TENANT
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mã TypeScript/JavaScript hoàn chỉnh được tối ưu hóa cho KV Namespace
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWorkerCode}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{copiedCode ? 'Đã sao chép!' : 'Sao chép mã'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadWorkerJs}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file worker.js</span>
                  </button>
                </div>
              </div>

              {/* Code viewer */}
              <div className="bg-slate-950 text-slate-100 p-4 rounded-2xl border border-slate-800 font-mono text-[11px] max-h-96 overflow-y-auto leading-relaxed shadow-inner">
                <pre>{CLOUDFLARE_WORKER_CODE}</pre>
              </div>

              {/* Step-by-step setup guide */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="font-extrabold text-slate-900 uppercase text-[11px]">
                  3 BƯỚC TRIỂN KHAI LÊN CLOUDFLARE WORKERS (HOÀN TOÀN MIỄN PHÍ)
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 leading-relaxed">
                  <li>
                    Đăng nhập vào <strong>Cloudflare Dashboard</strong> -&gt; chọn <strong>Workers & Pages</strong> -&gt; bấm <strong>Create Application</strong> -&gt; <strong>Create Worker</strong>.
                  </li>
                  <li>
                    Dán toàn bộ mã nguồn ở trên vào trình soạn thảo Worker -&gt; bấm <strong>Deploy</strong>.
                  </li>
                  <li>
                    Vào Worker vừa tạo -&gt; mục <strong>Settings</strong> -&gt; <strong>Variables and Secrets</strong> -&gt; tại <strong>KV Namespace Bindings</strong>, tạo và liên kết KV Namespace với biến tên: <code>SCHOOL_TENANTS</code>.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 4: TENANTS (QUẢN LÝ ĐA TRƯỜNG) */}
          {activeTab === 'TENANTS' && isMasterSuperAdmin && (
            <div className="space-y-4">
              {/* TOP ACTION BANNER FOR ALL SCHOOLS */}
              <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <div className="font-black text-sm flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                    <span>ĐỒNG BỘ CẤU HÌNH & BẢN QUYỀN LÊN CLOUD</span>
                    <span className="text-[10px] bg-amber-400 text-amber-950 font-bold px-2 py-0.5 rounded-full">
                      Vercel / Firebase
                    </span>
                  </div>
                  <div className="text-xs text-blue-200 mt-1 leading-relaxed">
                    Đẩy đồng bộ danh sách bản quyền, thông tin đăng nhập và quyền hạn của tất cả {tenantsList.length} trường lên Cloud Firestore.
                    <br />
                    <span className="text-emerald-300 font-semibold">
                      ✓ Dữ liệu riêng của từng trường không bị ảnh hưởng hay ghi đè.
                    </span>
                  </div>
                </div>
                <button
                  id="btn-sync-tenants-to-cloud"
                  type="button"
                  disabled={isPushingLicenses}
                  onClick={handlePushAllLicensesToCloud}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
                  title="Đẩy đồng bộ cấu hình bản quyền cho các trường lên Cloud Firestore"
                >
                  {isPushingLicenses ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-950" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-amber-950" />
                  )}
                  <span>{isPushingLicenses ? 'Đang đẩy lên Cloud...' : 'ĐẨY ĐỒNG BỘ CẤU HÌNH CHO CÁC TRƯỜNG'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                    DANH SÁCH CÁC TRƯỜNG HỌC TRÊN ĐÁM MÂY (MULTI-TENANT)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Phân vùng dữ liệu độc lập theo từng đơn vị trường học
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTenantsList}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTenants ? 'animate-spin' : ''}`} />
                  <span>Làm mới danh sách</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">STT</th>
                      <th className="py-2.5 px-3">Tên trường học</th>
                      <th className="py-2.5 px-3">Mã trường (Tenant ID)</th>
                      <th className="py-2.5 px-3 text-center">Cập nhật</th>
                      <th className="py-2.5 px-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tenantsList.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {t.schoolName}
                          {t.id === schoolId && (
                            <span className="ml-2 text-[9px] bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-bold">
                              Hiện tại
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 font-semibold">{t.id}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                          {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handlePushSingleLicenseToCloud(t.id)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Đẩy cấu hình và bản quyền trường này lên Cloud Firestore"
                            >
                              <UploadCloud className="w-3.5 h-3.5 text-blue-700" />
                              <span>Đẩy cấu hình</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePullFromCloud(t.id)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Tải dữ liệu của trường này về máy"
                            >
                              <CloudDownload className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Tải về</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-[11px] text-slate-500 font-medium">
            Hạ tầng Cloudflare Serverless & Google Firestore Đa trường học
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
