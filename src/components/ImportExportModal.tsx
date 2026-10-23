/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Excel Import / Export & System Backup / Reset & School Configuration Modal
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Save,
  RotateCcw,
  Building2,
  Trash2,
  Users,
  GraduationCap,
  Layers,
  ArrowRight,
  Info,
  Sparkles,
  HelpCircle,
  Eye,
  Sliders,
  Cloud,
  CloudDownload,
  CloudUpload,
  Loader2,
  Lock,
} from 'lucide-react';
import {
  parseUploadedExcel,
  ImportPreviewResult,
  importComprehensiveInitialSetupWorkbook,
} from '../import-export/excelImportService';
import {
  exportExcelTemplate,
  exportComprehensiveInitialSetupTemplate,
} from '../import-export/excelService';
import { dataStore, isThongKeSchool } from '../repositories/dataStore';
import { ensureFirebaseAuth } from '../firebase/config';
import { SystemBackup, SchoolInfo, Teacher, SchoolClass, TeachingAssignment } from '../types';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportExcel: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onExportExcel,
}) => {
  const [activeTab, setActiveTab] = useState<'EXCEL' | 'BACKUP'>('EXCEL');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importMode, setImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [previewSubTab, setPreviewSubTab] = useState<'TEACHERS' | 'CLASSES' | 'ASSIGNMENTS'>('TEACHERS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [backupTitle, setBackupTitle] = useState('');
  const [backups, setBackups] = useState<SystemBackup[]>(dataStore.getBackups());
  const [comprehensivePayload, setComprehensivePayload] = useState<any | null>(null);

  // School Config State (School Name is permanently locked to current School License)
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(dataStore.getSchoolInfo());
  const lockedSchoolName = dataStore.getSchoolInfo().schoolName;
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importSuccessInfo, setImportSuccessInfo] = useState<{
    teachersCount: number;
    classesCount: number;
    assignmentsCount: number;
    schoolName: string;
    schoolYear: string;
    mode: 'MERGE' | 'REPLACE';
    timestamp: string;
  } | null>(null);

  // Cloud & Quy Hop restore states
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [cloudPullProgress, setCloudPullProgress] = useState('');
  const [isPushingCloud, setIsPushingCloud] = useState(false);
  const [cloudPushProgress, setCloudPushProgress] = useState('');
  const [cloudTargetSchool, setCloudTargetSchool] = useState<string>(() => dataStore.getSchoolId() || 'school_quyhop');
  const currentSchoolId = dataStore.getSchoolId() || 'school_quyhop';

  const handlePushToCloud = async () => {
    setIsPushingCloud(true);
    setCloudPushProgress('Đang xác thực kết nối bảo mật Cloud Firestore...');
    try {
      await ensureFirebaseAuth();
      const res = await dataStore.syncCurrentDataToFirestore((step) => {
        setCloudPushProgress(step);
      });
      if (res.success) {
        showModalStatus('✓ Đã đẩy và lưu trữ dữ liệu lên Cloud Firestore thành công!', 'success');
      } else {
        // Nếu gặp vấn đề về phiên, thử làm mới lại xác thực và thử lại 1 lần
        if (res.message?.includes('quyền') || res.message?.includes('permissions')) {
          setCloudPushProgress('Đang làm mới phiên xác thực bảo mật...');
          await ensureFirebaseAuth();
          const retryRes = await dataStore.syncCurrentDataToFirestore((step) => setCloudPushProgress(step));
          if (retryRes.success) {
            showModalStatus('✓ Đã đẩy và lưu trữ dữ liệu lên Cloud Firestore thành công!', 'success');
            return;
          }
        }
        showModalStatus(res.message || 'Lỗi khi đẩy dữ liệu lên Cloud Firestore', 'error');
      }
    } catch (err: any) {
      showModalStatus(err?.message || 'Có lỗi xảy ra khi đẩy lên Cloud', 'error');
    } finally {
      setIsPushingCloud(false);
      setCloudPushProgress('');
    }
  };

  const handlePullFromCloud = async (targetId?: string) => {
    const sId = targetId || cloudTargetSchool || dataStore.getSchoolId() || 'school_quyhop';
    setIsPullingCloud(true);
    setCloudPullProgress('Đang xác thực kết nối Cloud Firestore...');
    try {
      await ensureFirebaseAuth();
      const res = await dataStore.pullDataFromFirestore(sId, (step) => {
        setCloudPullProgress(step);
      });
      if (res.success) {
        showModalStatus(`✓ ${res.message}`, 'success');
        setSchoolInfo(dataStore.getSchoolInfo());
        setBackups(dataStore.getBackups());
      } else {
        if (res.message?.includes('quyền') || res.message?.includes('permissions')) {
          setCloudPullProgress('Đang làm mới phiên xác thực bảo mật...');
          await ensureFirebaseAuth();
          const retryRes = await dataStore.pullDataFromFirestore(sId, (step) => setCloudPullProgress(step));
          if (retryRes.success) {
            showModalStatus(`✓ ${retryRes.message}`, 'success');
            setSchoolInfo(dataStore.getSchoolInfo());
            setBackups(dataStore.getBackups());
            return;
          }
        }
        showModalStatus(res.message || 'Lỗi khi tải dữ liệu từ Cloud Firestore', 'error');
      }
    } catch (err: any) {
      showModalStatus(err?.message || 'Có lỗi xảy ra khi tải từ Cloud', 'error');
    } finally {
      setIsPullingCloud(false);
      setCloudPullProgress('');
    }
  };

  const handleRestoreQuyHop = () => {
    try {
      dataStore.restoreQuyHopData();
      setSchoolInfo(dataStore.getSchoolInfo());
      setBackups(dataStore.getBackups());
      showModalStatus('✓ Đã mở lại và khôi phục thành công toàn bộ dữ liệu TRƯỜNG THCS QUỲ HỢP (20 GV, 16 Lớp, BGH Thầy Nguyễn Văn Toàn)!', 'success');
    } catch (err: any) {
      showModalStatus(err?.message || 'Lỗi khi mở lại dữ liệu THCS Quỳ Hợp', 'error');
    }
  };

  const showModalStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  useEffect(() => {
    if (isOpen) {
      setSchoolInfo(dataStore.getSchoolInfo());
      setBackups(dataStore.getBackups());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      setIsProcessing(true);
      try {
        const buffer = await file.arrayBuffer();

        // 1. Kiểm tra nếu là file mẫu khởi tạo ban đầu (7 sheet)
        let compResult: any = null;
        try {
          const comp = await importComprehensiveInitialSetupWorkbook(buffer, dataStore.getSchoolId());
          if (comp && (comp.departments.length > 0 || comp.classes.length > 0 || comp.teachers.length > 0)) {
            compResult = comp;
            setComprehensivePayload(comp);
            if (comp.schoolInfo?.schoolYear) {
              setSchoolInfo((prev) => ({
                ...prev,
                schoolYear: comp.schoolInfo?.schoolYear || prev.schoolYear,
              }));
            }
          } else {
            setComprehensivePayload(null);
          }
        } catch {
          setComprehensivePayload(null);
        }

        // 2. Parse preview thông thường
        const preview = await parseUploadedExcel(file);

        // Đồng bộ toàn bộ giáo viên từ file mẫu 7 sheet nếu có nhiều hơn để đảm bảo không bỏ sót bất kỳ GV nào
        if (compResult?.teachers && compResult.teachers.length > preview.teachersToImport.length) {
          preview.teachersToImport = compResult.teachers;
          preview.totalRows = preview.teachersToImport.length + preview.classesToImport.length + preview.assignmentsToImport.length;
        }

        setImportPreview(preview);
        // Cố định tên trường theo bản quyền đơn vị, chỉ cập nhật năm học nếu có
        if (preview.schoolInfoDetected?.schoolYear) {
          setSchoolInfo((prev) => ({
            ...prev,
            schoolYear: preview.schoolInfoDetected?.schoolYear || prev.schoolYear,
          }));
        }
        if (preview.teachersToImport.length > 0) {
          setPreviewSubTab('TEACHERS');
        } else if (preview.classesToImport.length > 0) {
          setPreviewSubTab('CLASSES');
        } else if (preview.assignmentsToImport.length > 0) {
          setPreviewSubTab('ASSIGNMENTS');
        }
        showModalStatus(`Đã nhận diện thành công file Excel: ${file.name} (${preview.teachersToImport.length} GV, ${preview.classesToImport.length} lớp, ${preview.assignmentsToImport.length} phân công)`);
      } catch (err) {
        showModalStatus('Lỗi đọc file Excel. Vui lòng kiểm tra file có đúng định dạng .xlsx', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleExecuteImport = async () => {
    if (!importPreview || importPreview.totalRows === 0) {
      showModalStatus('Chưa có dữ liệu từ file Excel. Vui lòng tải lên file Excel (.xlsx) trước khi cập nhật.', 'error');
      return;
    }

    if (
      importPreview.teachersToImport.length === 0 &&
      importPreview.classesToImport.length === 0 &&
      importPreview.assignmentsToImport.length === 0 &&
      !comprehensivePayload
    ) {
      showModalStatus('Không có dữ liệu hợp lệ nào được nhận diện từ file để cập nhật.', 'error');
      return;
    }

    try {
      if (comprehensivePayload) {
        try {
          await dataStore.applyComprehensiveInitialSetup(comprehensivePayload, dataStore.getSchoolId());
        } catch (e) {
          console.warn('Comprehensive apply fallback to bulkImportData', e);
        }
      }

      // Đảm bảo tên trường luôn cố định theo Bản quyền đơn vị, không bao giờ bị ghi đè thành trường khác
      const guaranteedSchoolName = dataStore.getSchoolInfo().schoolName;
      const safeSchoolInfo: SchoolInfo = {
        ...schoolInfo,
        schoolName: guaranteedSchoolName,
      };

      dataStore.bulkImportData({
        teachersToImport: importPreview.teachersToImport,
        classesToImport: importPreview.classesToImport,
        assignmentsToImport: importPreview.assignmentsToImport,
        schoolInfoDetected: safeSchoolInfo,
        mode: importMode,
      });

      const successData = {
        teachersCount: importPreview.teachersToImport.length,
        classesCount: importPreview.classesToImport.length,
        assignmentsCount: importPreview.assignmentsToImport.length,
        schoolName: dataStore.getSchoolInfo().schoolName,
        schoolYear: schoolInfo.schoolYear,
        mode: importMode,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      };

      setImportSuccessInfo(successData);
      showModalStatus(
        `✅ CẬP NHẬT THÀNH CÔNG! Đã nạp ${successData.teachersCount} Giáo viên, ${successData.classesCount} Lớp học, ${successData.assignmentsCount} Phân công từ file vào hệ thống!`
      );
    } catch (err: any) {
      showModalStatus(err?.message || 'Có lỗi xảy ra khi cập nhật dữ liệu. Vui lòng kiểm tra lại!', 'error');
    }
  };

  const handleCreateBackup = () => {
    const backup = dataStore.createBackup(backupTitle || undefined);
    setBackups(dataStore.getBackups());
    setBackupTitle('');
    showModalStatus(`Đã tạo bản sao lưu an toàn: ${backup.title}`);
  };

  const handleRestoreBackup = (id: string, title?: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn phục hồi toàn bộ dữ liệu hệ thống về bản sao lưu "${title || id}"?\n\nToàn bộ thông tin trường, danh sách giáo viên, lớp học và phân công sẽ được khôi phục chính xác về thời điểm đó.`)) {
      return;
    }
    const result = dataStore.restoreBackup(id);
    if (result.success) {
      setBackups(dataStore.getBackups());
      setSchoolInfo(dataStore.getSchoolInfo());
      showModalStatus(`✅ ${result.message || 'Phục hồi dữ liệu thành công!'}`);
    } else {
      showModalStatus(result.message || 'Lỗi khi phục hồi bản sao lưu!', 'error');
    }
  };

  const handleDeleteBackup = (id: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản sao lưu "${title}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }
    dataStore.deleteBackup(id);
    setBackups(dataStore.getBackups());
    showModalStatus(`Đã xóa bản sao lưu: ${title}`);
  };

  const handleDownloadBackup = (backup: SystemBackup) => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const sanitizedTitle = backup.title.replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ_ -]/gi, '_');
      downloadAnchor.setAttribute('download', `SaoLuu_PCCM_${sanitizedTitle}_${backup.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showModalStatus(`✅ Đã tải file sao lưu "${backup.title}" về máy tính.`);
    } catch {
      showModalStatus('Lỗi khi tải file sao lưu về máy!', 'error');
    }
  };

  const handleUploadBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (!parsed.dataJson || !parsed.id) {
          showModalStatus('File không đúng định dạng bản sao lưu hệ thống (thiếu dataJson)!', 'error');
          return;
        }
        const importRes = dataStore.importBackupFile(parsed);
        if (!importRes.success) {
          showModalStatus(importRes.message || 'Tệp sao lưu bị từ chối do vi phạm quy tắc bản quyền!', 'error');
          return;
        }
        setBackups(dataStore.getBackups());
        showModalStatus(`✅ Đã nhập bản sao lưu "${parsed.title || file.name}" từ máy tính vào danh sách! Bạn có thể bấm "Khôi phục" để áp dụng.`);
      } catch (err: any) {
        showModalStatus(err?.message || 'Lỗi khi đọc file sao lưu JSON!', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 max-h-[94vh] overflow-y-auto animate-in fade-in zoom-in-95">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-900 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Xuất nhập Excel & Quản lý Dữ liệu Hệ thống
              </h3>
              <p className="text-xs text-slate-500">
                Nhận diện tự động, xem trước bảng dữ liệu, cập nhật và thiết lập trường học
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS / TOAST MESSAGE */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl font-bold text-xs flex items-center justify-between shadow-xs transition-all animate-in fade-in ${
              statusMessage.type === 'error'
                ? 'bg-red-900 text-red-100 border border-red-700'
                : 'bg-emerald-900 text-emerald-100 border border-emerald-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-300" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* SUB TABS */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
          <button
            onClick={() => setActiveTab('EXCEL')}
            className={`flex-1 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'EXCEL'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất / Nhập Excel</span>
          </button>
          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`flex-1 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'BACKUP'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Bản sao lưu ({backups.length})</span>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: EXCEL IMPORT / EXPORT & STAGING PREVIEW */}
        {/* ------------------------------------------------------------- */}
        {/* TAB 1: EXCEL IMPORT / EXPORT & STAGING PREVIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'EXCEL' && (
          <div className="space-y-4 text-xs">
            {/* EXPORT SECTION */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-emerald-50/90 rounded-2xl border border-emerald-200/80 p-5 space-y-4 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-emerald-200/60">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white font-extrabold px-2.5 py-0.5 rounded-full text-[10px] tracking-wide uppercase shadow-2xs">
                      Xuất dữ liệu chuẩn
                    </span>
                    <h4 className="font-bold text-emerald-950 text-sm sm:text-base">
                      Xuất Sổ Phân Công Chuyên Môn & Mẫu Nhập Liệu (.xlsx)
                    </h4>
                  </div>
                  <p className="text-emerald-900/90 text-xs">
                    Đơn vị xuất: <strong className="text-emerald-950">{schoolInfo.schoolName}</strong> ({schoolInfo.schoolYear || '2026-2027'}). File Excel gồm 4 Sheet chuẩn hóa ngành giáo dục:
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-white/90 text-emerald-900 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    1. Tổng hợp định mức
                  </span>
                  <span className="bg-white/90 text-emerald-900 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    2. Chi tiết phân công
                  </span>
                  <span className="bg-white/90 text-emerald-900 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    3. Danh sách giáo viên
                  </span>
                  <span className="bg-white/90 text-emerald-900 font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                    4. Danh sách lớp học
                  </span>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* Button 1: Tải Mẫu Khởi tạo ban đầu */}
                <button
                  type="button"
                  onClick={async () => {
                    await exportComprehensiveInitialSetupTemplate(schoolInfo);
                  }}
                  className="p-3.5 bg-white hover:bg-blue-50/80 border border-blue-200 hover:border-blue-400 rounded-xl flex items-start gap-3 transition-all duration-150 group text-left cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  title="Tải file Mẫu Excel Khởi tạo ban đầu (7 sheet: Thông tin trường, Tổ CM, Môn học, Lớp học, Danh sách Giáo viên chi tiết, Kiêm nhiệm, Hướng dẫn)"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-100 group-hover:bg-blue-600 text-blue-700 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <Sparkles className="w-5 h-5 text-amber-500 group-hover:text-amber-300" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span>Mẫu Khởi tạo ban đầu</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                        7 Sheet
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Đầy đủ mẫu GV, Tổ chuyên môn, Môn học, Điểm trường
                    </p>
                  </div>
                </button>

                {/* Button 2: Mẫu PCCM cơ bản */}
                <button
                  type="button"
                  onClick={async () => {
                    await exportExcelTemplate(schoolInfo);
                  }}
                  className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl flex items-start gap-3 transition-all duration-150 group text-left cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98]"
                  title="Tải file mẫu phân công chuyên môn cơ bản"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-emerald-600 text-slate-700 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-slate-900 text-xs">
                      Mẫu PCCM cơ bản
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Mẫu khung chuẩn 3 sheet nhập liệu nhanh
                    </p>
                  </div>
                </button>

                {/* Button 3: Tải Sổ PCCM đầy đủ */}
                <button
                  id="modal-export-excel-btn"
                  type="button"
                  onClick={() => {
                    onExportExcel();
                    onClose();
                  }}
                  className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl flex items-start gap-3 transition-all duration-150 group text-left cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98]"
                  title="Xuất file Excel chính thức với toàn bộ phân công của trường"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>Tải Sổ PCCM đầy đủ</span>
                      <span className="text-[9px] bg-white/20 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                        Thực tế
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-100 leading-snug">
                      Xuất toàn bộ phân công hiện tại ra file .xlsx
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* IMPORT & PREVIEW SECTION */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px] uppercase">
                      Tải lên & Nhận diện
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">Nhập dữ liệu từ file Excel (.xlsx)</h4>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Hệ thống tự động nhận diện các sheet: <code className="font-mono font-bold text-blue-700">DỮ LIỆU GV</code>, <code className="font-mono font-bold text-emerald-700">LỚP HỌC</code>, <code className="font-mono font-bold text-amber-700">PHÂN CÔNG</code>.
                  </p>
                </div>

                <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Dữ liệu thực tế 100% từ file</span>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-blue-200 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/40 rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-file-upload-input"
                />
                <label htmlFor="excel-file-upload-input" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 group-hover:bg-blue-600 text-blue-600 group-hover:text-white mx-auto flex items-center justify-center transition-all duration-200 shadow-2xs">
                    <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 text-sm block">
                      {uploadFile ? uploadFile.name : 'Bấm vào đây để chọn file Excel hoặc kéo thả file'}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Hỗ trợ định dạng Microsoft Excel (.xlsx, .xls) • Tự động đối soát và khớp thông tin
                    </span>
                  </div>
                </label>
              </div>

              {isProcessing && (
                <div className="text-center py-3 text-blue-700 font-bold flex items-center justify-center gap-2 bg-blue-50/60 rounded-xl">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang phân tích và nhận diện cấu trúc file Excel...
                </div>
              )}

              {/* PREVIEW & UPDATE ACTION PANEL */}
              {importPreview && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 animate-in fade-in">
                  {/* SCHOOL IDENTITY (LOCKED TO TENANT LICENSE) & YEAR */}
                  <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                          <span>Đơn vị trường học:</span>
                          <span className="text-blue-900 font-black">{lockedSchoolName}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          🔒 Cố định theo Bản quyền đơn vị • Không cho phép đổi trường làm hộ đơn vị khác
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <span className="text-xs text-slate-600 font-semibold shrink-0">Năm học:</span>
                      <input
                        type="text"
                        value={schoolInfo.schoolYear || '2026-2027'}
                        onChange={(e) => setSchoolInfo({ ...schoolInfo, schoolYear: e.target.value })}
                        placeholder="Năm học (VD: 2026-2027)"
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-900 focus:ring-1 focus:ring-blue-500 w-28 text-center"
                        title="Năm học áp dụng"
                      />
                    </div>
                  </div>

                  {/* 3 PREVIEW TABS STATISTIC CARDS */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPreviewSubTab('TEACHERS')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        previewSubTab === 'TEACHERS'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-700" />
                        <span>Danh sách GV nhận diện</span>
                      </div>
                      <div className="text-base font-black text-blue-900 mt-1">
                        {importPreview.teachersToImport.length}{' '}
                        <span className="text-[11px] font-normal text-slate-600">hồ sơ</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setPreviewSubTab('CLASSES')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        previewSubTab === 'CLASSES'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <GraduationCap className="w-3 h-3 text-blue-700" />
                        <span>Danh sách Lớp nhận diện</span>
                      </div>
                      <div className="text-base font-black text-blue-900 mt-1">
                        {importPreview.classesToImport.length}{' '}
                        <span className="text-[11px] font-normal text-slate-600">lớp</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setPreviewSubTab('ASSIGNMENTS')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        previewSubTab === 'ASSIGNMENTS'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <Layers className="w-3 h-3 text-blue-700" />
                        <span>DS Phân công nhận diện</span>
                      </div>
                      <div className="text-base font-black text-blue-900 mt-1">
                        {importPreview.assignmentsToImport.length}{' '}
                        <span className="text-[11px] font-normal text-slate-600">tiết/nhiệm vụ</span>
                      </div>
                    </button>
                  </div>

                  {/* PREVIEW TABLE CONTENT */}
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
                    {previewSubTab === 'TEACHERS' && (
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold z-10">
                          <tr>
                            <th className="p-2 w-10 text-center">STT</th>
                            <th className="p-2 w-20">Mã GV</th>
                            <th className="p-2">Họ và tên</th>
                            <th className="p-2">Môn / Chuyên môn từ file</th>
                            <th className="p-2">Tổ chuyên môn</th>
                            <th className="p-2 text-center">Định mức</th>
                            <th className="p-2">Điện thoại / Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {importPreview.teachersToImport.map((t, idx) => {
                            const raw = importPreview.rawTeachers?.[idx];
                            const deptName =
                              raw?.departmentRaw ||
                              (t.departmentId === 'dept_toan_tin'
                                ? 'Toán - Tin'
                                : t.departmentId === 'dept_khtn'
                                ? 'Khoa học tự nhiên'
                                : t.departmentId === 'dept_van_su'
                                ? 'Văn - Sử'
                                : t.departmentId === 'dept_ngoai_ngu'
                                ? 'Ngoại ngữ'
                                : t.departmentId === 'dept_nang_khieu'
                                ? 'Nghệ thuật - GDTC'
                                : 'Tổ chuyên môn');

                            return (
                              <tr key={idx} className="hover:bg-blue-50/40">
                                <td className="p-2 text-center font-mono text-slate-400">
                                  {raw?.sttRaw || idx + 1}
                                </td>
                                <td className="p-2 font-mono font-bold text-blue-800">{t.code}</td>
                                <td className="p-2 font-semibold text-slate-900">{t.fullName}</td>
                                <td className="p-2">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium text-slate-800">
                                      {raw?.subjectRaw || t.major || '—'}
                                    </span>
                                    {t.subjectsCanTeach && t.subjectsCanTeach.length > 0 && (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        Môn chuẩn
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-slate-600">{deptName}</td>
                                <td className="p-2 text-center font-bold text-blue-900">
                                  {raw?.quotaRaw !== undefined ? `${raw.quotaRaw} tiết` : `${t.standardQuota} tiết`}
                                </td>
                                <td className="p-2 text-slate-500">{t.phone || t.email || '—'}</td>
                              </tr>
                            );
                          })}
                          {importPreview.teachersToImport.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-400">
                                Không tìm thấy dòng dữ liệu giáo viên hợp lệ trong tệp
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}

                    {previewSubTab === 'CLASSES' && (
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold">
                          <tr>
                            <th className="p-2">Mã/Tên lớp</th>
                            <th className="p-2 text-center">Khối</th>
                            <th className="p-2 text-center">Sĩ số</th>
                            <th className="p-2">Buổi học</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {importPreview.classesToImport.map((c, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40">
                              <td className="p-2 font-bold text-blue-800">{c.code}</td>
                              <td className="p-2 text-center font-semibold text-slate-700">{c.grade}</td>
                              <td className="p-2 text-center font-bold">{c.studentCount} HS</td>
                              <td className="p-2 text-slate-600">
                                {c.session === 'AFTERNOON'
                                  ? 'Buổi Chiều'
                                  : c.session === 'FULL_DAY' || (c.session as any) === 'TWO_SESSIONS_PER_DAY'
                                  ? '2 buổi/ngày'
                                  : 'Buổi Sáng'}
                              </td>
                            </tr>
                          ))}
                          {importPreview.classesToImport.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                Chưa có dòng dữ liệu lớp học nào trong tệp
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}

                    {previewSubTab === 'ASSIGNMENTS' && (
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold">
                          <tr>
                            <th className="p-2">Thông tin phân công</th>
                            <th className="p-2">Loại phân công</th>
                            <th className="p-2 text-center">Số tiết/tuần</th>
                            <th className="p-2">Buổi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {importPreview.assignmentsToImport.map((a, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/40">
                              <td className="p-2 font-medium text-slate-800">{a.notes || 'Phân công môn học'}</td>
                              <td className="p-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    a.type === 'CONCURRENT'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-blue-100 text-blue-900'
                                  }`}
                                >
                                  {a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Giảng dạy'}
                                </span>
                              </td>
                              <td className="p-2 text-center font-bold text-blue-900">{a.periodsPerWeek} tiết</td>
                              <td className="p-2 text-slate-500">
                                {a.session === 'AFTERNOON'
                                  ? 'Chiều'
                                  : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                  ? '2 buổi/ngày'
                                  : 'Sáng'}
                              </td>
                            </tr>
                          ))}
                          {importPreview.assignmentsToImport.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                Chưa có dòng dữ liệu phân công nào trong tệp
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* IMPORT MODE SELECTOR */}
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-blue-700" />
                      <span>Tùy chọn chế độ nạp dữ liệu:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <label
                        className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition ${
                          importMode === 'MERGE'
                            ? 'bg-blue-50 border-blue-400 text-blue-950 font-semibold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="MERGE"
                          checked={importMode === 'MERGE'}
                          onChange={() => setImportMode('MERGE')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-blue-900">Cập nhật & Thêm mới (Merge)</div>
                          <div className="text-[10px] text-slate-500">
                            Nạp thêm giáo viên, lớp học mới và cập nhật thông tin mà không làm mất dữ liệu hiện tại.
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-2.5 rounded-lg border flex items-start gap-2 cursor-pointer transition ${
                          importMode === 'REPLACE'
                            ? 'bg-red-50 border-red-400 text-red-950 font-semibold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="importMode"
                          value="REPLACE"
                          checked={importMode === 'REPLACE'}
                          onChange={() => setImportMode('REPLACE')}
                          className="mt-0.5 text-red-600 focus:ring-red-500"
                        />
                        <div>
                          <div className="font-bold text-red-700">Ghi đè hoàn toàn (Replace)</div>
                          <div className="text-[10px] text-slate-500">
                            Thay thế toàn bộ dữ liệu cũ bằng dữ liệu mới từ file Excel.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* SUCCESS NOTIFICATION BANNER IF IMPORTED */}
                  {importSuccessInfo && (
                    <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-emerald-900 font-black text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>ĐÃ NẠP DỮ LIỆU THÀNH CÔNG VÀO HỆ THỐNG!</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {importSuccessInfo.timestamp}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                        <div className="bg-white p-1.5 rounded-lg border border-emerald-200">
                          <div className="font-black text-emerald-700">{importSuccessInfo.teachersCount}</div>
                          <div className="text-[10px] text-slate-500">Giáo viên</div>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-emerald-200">
                          <div className="font-black text-emerald-700">{importSuccessInfo.classesCount}</div>
                          <div className="text-[10px] text-slate-500">Lớp học</div>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-emerald-200">
                          <div className="font-black text-emerald-700">{importSuccessInfo.assignmentsCount}</div>
                          <div className="text-[10px] text-slate-500">Phân công</div>
                        </div>
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Đơn vị: <strong>{importSuccessInfo.schoolName}</strong> ({importSuccessInfo.schoolYear}) • Chế độ:{' '}
                        <strong>{importSuccessInfo.mode === 'REPLACE' ? 'Ghi đè hoàn toàn' : 'Cập nhật & Thêm mới'}</strong>
                      </div>
                    </div>
                  )}

                  {/* WARNINGS & CLEANING LOG */}
                  {importPreview.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-950 text-[11px] space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-900">
                        <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Hệ thống đã tự động lọc sạch các dòng không phải dữ liệu:</span>
                      </div>
                      <p className="text-slate-600">
                        Đã loại trừ tự động các dòng tiêu đề, số thứ tự phụ, dòng tổng cộng và phần bổ sung/ký duyệt ở cuối trang để đảm bảo danh sách chuẩn xác 100%.
                      </p>
                    </div>
                  )}

                  {/* PROMINENT PRIMARY ACTION BUTTON */}
                  <div className="pt-2 flex justify-end">
                    <button
                      id="execute-import-excel-btn"
                      onClick={handleExecuteImport}
                      disabled={importPreview.totalRows === 0}
                      className={`w-full font-black px-6 py-3.5 rounded-xl flex items-center justify-center gap-2.5 text-sm sm:text-base shadow-lg transition active:scale-[0.98] ${
                        importPreview.totalRows > 0
                          ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white hover:shadow-xl cursor-pointer'
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>CẬP NHẬT DỮ LIỆU VÀO HỆ THỐNG</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs font-bold ml-1">
                        ({importPreview.teachersToImport.length} GV • {importPreview.classesToImport.length} Lớp)
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* EMPTY PLACEHOLDER WHEN NO FILE PARSED YET */}
              {!importPreview && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-3 animate-in fade-in">
                  <div className="w-12 h-12 bg-blue-50 text-blue-900 rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
                    <FileSpreadsheet className="w-6 h-6 text-blue-700" />
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Chưa có tệp Excel nào được tải lên</h5>
                    <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                      Vui lòng chọn hoặc kéo thả tệp Excel phân công của trường học vào ô tải lên phía trên để xem trước danh sách thực tế.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 max-w-lg mx-auto text-left text-xs space-y-2 text-slate-700">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Cam kết xử lý dữ liệu chuẩn xác 100%:</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] space-y-1.5 pl-1 text-slate-600">
                      <li>Tự động loại bỏ dòng tiêu đề, số thứ tự phụ (1, 2, 3...) và dòng tổng cộng.</li>
                      <li>Tự động loại trừ phần bổ sung, ghi chú và chữ ký của ban giám hiệu ở cuối danh sách.</li>
                      <li>Nhận diện chính xác từng môn học THCS chuẩn hóa (Toán, Ngữ văn, KHTN, Lịch sử - Địa lí, Tin học, Công nghệ, GDCD, Âm nhạc, Mĩ thuật, GDTC, HĐTN...).</li>
                      <li><strong>Tuyệt đối không tự suy luận</strong> dữ liệu hoặc gán dữ liệu mẫu khi không có trong file.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: SYSTEM BACKUPS */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'BACKUP' && (
          <div className="space-y-4 text-xs">
            {/* CÁCH 3: TẢI DỮ LIỆU TỪ CLOUD FIRESTORE & MỞ LẠI THCS QUỲ HỢP */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-blue-800 shadow-md space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-blue-200 ring-1 ring-white/20">
                    <Cloud className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-white">Cách 3: Tải dữ liệu từ Cloud Firestore & Khôi phục</h4>
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                        Google Cloud
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-200/90 mt-0.5">
                      Đồng bộ dữ liệu trực tuyến từ Google Cloud Firestore hoặc mở lại cơ sở dữ liệu gốc TRƯỜNG THCS QUỲ HỢP
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={cloudTargetSchool}
                    onChange={(e) => setCloudTargetSchool(e.target.value)}
                    className="bg-slate-800 border border-blue-400/40 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {dataStore
                      .getSchoolLicenses()
                      .filter((l) => !isThongKeSchool(l.id, l.schoolName))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.schoolName} ({l.id})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Progress if loading */}
              {isPullingCloud && (
                <div className="p-3 bg-white/10 rounded-xl border border-white/20 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-blue-200 font-semibold">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-300 animate-spin" />
                      <span>{cloudPullProgress || 'Đang tải dữ liệu từ Cloud Firestore...'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Đẩy Cloud & Tải Cloud */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="button"
                  id="push-to-cloud-btn"
                  onClick={handlePushToCloud}
                  disabled={isPushingCloud || isPullingCloud}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Đẩy toàn bộ dữ liệu trường học hiện tại lên Cloud Firestore"
                >
                  <CloudUpload className="w-4 h-4 text-white" />
                  <span>{isPushingCloud ? 'Đang đẩy lên Cloud...' : 'Đẩy dữ liệu lên Cloud Firestore'}</span>
                </button>

                <button
                  type="button"
                  id="pull-from-cloud-btn"
                  onClick={() => handlePullFromCloud()}
                  disabled={isPullingCloud || isPushingCloud}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Tải toàn bộ giáo viên, lớp học, phân công từ Cloud Firestore về máy"
                >
                  <CloudDownload className="w-4 h-4 text-white" />
                  <span>{isPullingCloud ? 'Đang tải từ Cloud...' : 'Tải dữ liệu từ Cloud Firestore về máy'}</span>
                </button>

                {currentSchoolId === 'school_quyhop' && (
                  <button
                    type="button"
                    id="restore-quy-hop-btn"
                    onClick={handleRestoreQuyHop}
                    disabled={isPullingCloud || isPushingCloud}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                    title="Mở lại toàn bộ danh sách giáo viên, lớp học và phân công chuẩn TRƯỜNG THCS QUỲ HỢP"
                  >
                    <Building2 className="w-4 h-4 text-emerald-200" />
                    <span>Mở lại dữ liệu THCS Quỳ Hợp</span>
                  </button>
                )}
              </div>
            </div>

            {/* Create backup */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Tạo bản sao lưu tức thời</h4>
              <p className="text-slate-500 text-[11px]">
                Lưu lại toàn bộ dữ liệu gồm giáo viên, phân công, phiên bản và cấu hình để có thể phục hồi bất kỳ lúc nào.
              </p>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Ghi chú bản sao lưu (VD: Trước khi thay đổi phân công HK2)..."
                  value={backupTitle}
                  onChange={(e) => setBackupTitle(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleCreateBackup}
                  className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-4 py-2 rounded-xl shadow-xs flex-shrink-0 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Tạo bản sao lưu ngay</span>
                </button>
              </div>
            </div>

            {/* Backups list header & upload from file */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
              <h5 className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                Danh sách bản sao lưu đã tạo ({backups.length})
              </h5>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition border border-slate-300">
                <Upload className="w-3.5 h-3.5 text-blue-800" />
                <span>Nạp file sao lưu từ máy tính (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleUploadBackupFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Backups list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {backups.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-slate-900 text-xs">{b.title}</h5>
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        Đầy đủ hệ thống
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(b.createdAt).toLocaleString('vi-VN')} • Tạo bởi: <strong>{b.createdBy}</strong> • {b.teacherCount} GV • {b.assignmentCount} phân công • {b.versionCount || 1} phương án
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(b)}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      title="Tải file sao lưu JSON về lưu trữ trên máy tính hoặc USB"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Tải về</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreBackup(b.id, b.title)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      title="Phục hồi toàn bộ hệ thống về thời điểm này"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-blue-700" />
                      <span>Khôi phục</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBackup(b.id, b.title)}
                      className="bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-700 border border-slate-200 hover:border-red-200 p-1.5 rounded-lg text-xs transition cursor-pointer"
                      title="Xóa bản sao lưu này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {backups.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Chưa có bản sao lưu nào được tạo. Hãy nhập ghi chú ở trên và bấm "Tạo bản sao lưu ngay" để lưu lại trạng thái hệ thống.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

