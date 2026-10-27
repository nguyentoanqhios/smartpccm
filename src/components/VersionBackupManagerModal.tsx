/**
 * QUẢN LÝ PHIÊN BẢN & SAO LƯU DỮ LIỆU TOÀN DIỆN (VERSION HISTORY & BACKUP HUB)
 * - Hiển thị danh sách các phiên bản / bản sao lưu (snapshots).
 * - Bấm 1 click là khôi phục ngay 100% dữ liệu phiên bản đó (lớp học, giáo viên, phân công, kiêm nhiệm, PPCT).
 * - Tải file sao lưu (.json) về máy tính để lưu trữ offline an toàn.
 * - Phục hồi từ file sao lưu trên máy tính.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  History,
  X,
  Plus,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileJson,
  Trash2,
  Sparkles,
  Layers,
  Calendar,
  Users,
  Building2,
  HardDrive,
  Copy,
  FolderArchive,
  RefreshCw,
} from 'lucide-react';
import { dataStore, isSuperAdminEmail } from '../repositories/dataStore';
import { SystemBackup, AssignmentVersion } from '../types';
import { toastService } from '../services/toastService';

interface VersionBackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored?: () => void;
}

export const VersionBackupManagerModal: React.FC<VersionBackupManagerModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'EXPORT_FILE' | 'IMPORT_FILE'>('LIST');
  const [backups, setBackups] = useState<SystemBackup[]>(() => dataStore.getBackups());
  const [versions, setVersions] = useState<AssignmentVersion[]>(() => dataStore.getVersions());
  const [newBackupTitle, setNewBackupTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [restoreInProgress, setRestoreInProgress] = useState(false);

  // Import file state
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schoolInfo = dataStore.getSchoolInfo();
  const currentSchoolId = dataStore.getSchoolId();
  const currentUser = dataStore.getCurrentUser();
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email) || Boolean(currentUser?.isSuperAdmin);
  // Khôi phục dữ liệu gốc THCS Quỳ Hợp trong quản lý phiên bản và lịch sử sao lưu (chỉ hiển thị khi đang làm việc tại trường Quỳ Hợp)
  const isQuyHopBenchmarkVisible = currentSchoolId === 'school_quyhop' || currentSchoolId === 'school_admin';

  useEffect(() => {
    if (!isOpen) return;
    setBackups(dataStore.getBackups());
    setVersions(dataStore.getVersions());
    const unsub = dataStore.subscribe(() => {
      setBackups(dataStore.getBackups());
      setVersions(dataStore.getVersions());
    });
    return unsub;
  }, [isOpen]);

  // Tạo bản sao lưu mới ngay lập tức
  const handleCreateSnapshot = () => {
    setIsCreating(true);
    try {
      const now = new Date();
      const defaultTitle = `Bản sao lưu ngày ${now.toLocaleDateString('vi-VN')} lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      const title = newBackupTitle.trim() || defaultTitle;
      const backup = dataStore.createBackup(title);
      setNewBackupTitle('');
      toastService.success(`Đã lưu phiên bản snapshot mới: "${backup.title}"!`);
      setBackups(dataStore.getBackups());
    } catch (err: any) {
      toastService.error(err?.message || 'Lỗi khi tạo bản sao lưu');
    } finally {
      setIsCreating(false);
    }
  };

  // Khôi phục 100% dữ liệu từ một bản sao lưu trong danh sách
  const handleExecuteRestore = (backupId: string) => {
    setRestoreInProgress(true);
    try {
      const res = dataStore.restoreBackup(backupId);
      if (res.success) {
        toastService.success(res.message || 'Khôi phục 100% dữ liệu thành công!');
        setConfirmRestoreId(null);
        onRestored?.();
      } else {
        toastService.error(res.message || 'Không thể khôi phục dữ liệu');
      }
    } catch (err: any) {
      toastService.error(err?.message || 'Lỗi trong quá trình khôi phục dữ liệu');
    } finally {
      setRestoreInProgress(false);
    }
  };

  // Khôi phục nhanh dữ liệu gốc THCS Quỳ Hợp (42 lớp)
  const handleRestoreQuyHopBenchmark = () => {
    setRestoreInProgress(true);
    try {
      dataStore.restoreQuyHopData();
      toastService.success('Đã khôi phục hoàn chỉnh 100% dữ liệu TRƯỜNG THCS ADMIN (42 lớp - 74 giáo viên)!');
      setConfirmRestoreId(null);
      onRestored?.();
    } catch (err: any) {
      toastService.error(err?.message || 'Lỗi khi khôi phục dữ liệu THCS ADMIN');
    } finally {
      setRestoreInProgress(false);
    }
  };

  // Xóa bản sao lưu
  const handleDeleteBackup = (backupId: string, title: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa bản sao lưu "${title}"?`)) {
      dataStore.deleteBackup(backupId);
      setBackups(dataStore.getBackups());
      toastService.success('Đã xóa bản sao lưu thành công.');
    }
  };

  // Tải 1 bản sao lưu về máy dưới dạng file .json
  const handleDownloadBackupJson = (backup: SystemBackup) => {
    try {
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanSchool = (backup.schoolName || schoolInfo.schoolName || 'truong_hoc')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toLowerCase();
      link.href = url;
      link.download = `pccm_saoluu_${cleanSchool}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toastService.success(`Đã tải file sao lưu "${backup.title}" về máy tính!`);
    } catch (e: any) {
      toastService.error('Lỗi khi tải file: ' + e?.message);
    }
  };

  // Tải toàn bộ dữ liệu hiện tại về máy tính (Export Complete Backup File)
  const handleDownloadFullSystemBackup = () => {
    try {
      const tempBackup = dataStore.createBackup(`Xuất sao lưu toàn bộ ngày ${new Date().toLocaleDateString('vi-VN')}`);
      handleDownloadBackupJson(tempBackup);
    } catch (e: any) {
      toastService.error('Lỗi khi xuất sao lưu: ' + e?.message);
    }
  };

  // Đọc file sao lưu được upload từ máy tính
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Kiểm tra xem là đối tượng SystemBackup hay dataJson trực tiếp
        let payload: any = parsed;
        if (parsed.dataJson && typeof parsed.dataJson === 'string') {
          payload = JSON.parse(parsed.dataJson);
        }

        if (!payload.teachers && !payload.classes && !payload.assignments) {
          throw new Error('File không chứa cấu trúc dữ liệu phân công chuyên môn hợp lệ.');
        }

        setSelectedFileContent(text);
        setParsedBackupData({
          title: parsed.title || file.name,
          schoolName: payload.schoolName || payload.schoolInfo?.schoolName || 'Chưa xác định',
          teachersCount: Array.isArray(payload.teachers) ? payload.teachers.length : 0,
          classesCount: Array.isArray(payload.classes) ? payload.classes.length : 0,
          assignmentsCount: Array.isArray(payload.assignments) ? payload.assignments.length : 0,
          schoolYear: payload.schoolInfo?.schoolYear || '2026-2027',
          rawBackup: parsed,
        });
      } catch (err: any) {
        setImportError(err?.message || 'File JSON không đúng định dạng sao lưu của hệ thống.');
        setSelectedFileContent(null);
        setParsedBackupData(null);
      }
    };
    reader.readAsText(file);
  };

  // Tiến hành phục hồi từ file đã chọn
  const handleApplyFileImport = () => {
    if (!selectedFileContent || !parsedBackupData) return;
    setRestoreInProgress(true);
    try {
      const raw = parsedBackupData.rawBackup;
      if (raw.dataJson) {
        // Là format SystemBackup
        const res = dataStore.importBackupFile(raw);
        if (res.success) {
          const restoreRes = dataStore.restoreBackup(raw.id);
          if (restoreRes.success) {
            toastService.success(`Đã phục hồi 100% dữ liệu từ file "${importFileName}" thành công!`);
            onRestored?.();
            onClose();
          } else {
            toastService.error(restoreRes.message || 'Lỗi khi khôi phục bản sao lưu');
          }
        } else {
          toastService.error(res.message || 'Không thể nạp file sao lưu');
        }
      } else {
        // Là format JSON dump
        const success = dataStore.importSystemData(selectedFileContent, 'REPLACE');
        if (success) {
          toastService.success(`Đã nạp và thay thế 100% dữ liệu từ file "${importFileName}"!`);
          onRestored?.();
          onClose();
        } else {
          toastService.error('Không thể phục hồi dữ liệu từ file.');
        }
      }
    } catch (e: any) {
      toastService.error('Lỗi phục hồi: ' + e?.message);
    } finally {
      setRestoreInProgress(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[88vh] min-h-[580px] max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
              <History className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                Quản lý Phiên bản & Lịch sử Sao lưu
                <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Khôi phục 100%
                </span>
              </h2>
              <p className="text-xs text-blue-200">
                Lưu giữ mọi mốc phân công, tải file backup về máy và khôi phục ngay tức khắc khi cần
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-3 shrink-0 text-xs font-bold">
          <button
            onClick={() => setActiveTab('LIST')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'LIST'
                ? 'bg-white border-slate-200 text-blue-900 shadow-2xs font-bold -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-blue-600" />
            <span>Danh sách Phiên bản & Bản sao lưu ({backups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('EXPORT_FILE')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'EXPORT_FILE'
                ? 'bg-white border-slate-200 text-blue-900 shadow-2xs font-bold -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Tải file sao lưu về máy (.JSON)</span>
          </button>

          <button
            onClick={() => setActiveTab('IMPORT_FILE')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl border-t border-x transition cursor-pointer ${
              activeTab === 'IMPORT_FILE'
                ? 'bg-white border-slate-200 text-blue-900 shadow-2xs font-bold -mb-px'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-purple-600" />
            <span>Phục hồi từ File trên máy tính</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* TAB 1: DANH SÁCH BẢN SAO LƯU */}
          {activeTab === 'LIST' && (
            <div className="space-y-6">
              {/* Box Tạo bản sao lưu mới */}
              <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-700" />
                      Tạo bản sao lưu / Lưu phiên bản mới ngay bây giờ
                    </h3>
                    <p className="text-xs text-blue-800/80">
                      Chụp lại toàn bộ trạng thái hiện tại (giáo viên, lớp, phân công, kiêm nhiệm) để bạn có thể quay lại bất cứ lúc nào.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Tên gợi nhớ (VD: Sau khi phân công Toán 9...)"
                      value={newBackupTitle}
                      onChange={(e) => setNewBackupTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
                      className="bg-white border border-blue-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 flex-1 sm:w-64"
                    />
                    <button
                      onClick={handleCreateSnapshot}
                      disabled={isCreating}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isCreating ? 'Đang lưu...' : 'Lưu bản sao lưu'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Nút khôi phục nhanh chuẩn THCS Quỳ Hợp (42 lớp) - Chỉ hiển thị cho trường Quỳ Hợp / Super Admin */}
              {isQuyHopBenchmarkVisible && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-900 flex items-center justify-center font-bold">
                      🏫
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        Bản dữ liệu chuẩn TRƯỜNG THCS ADMIN (42 Lớp - 74 Giáo viên)
                      </h4>
                      <p className="text-[11px] text-amber-900/80">
                        Chứa đủ 11 lớp K6, 10 lớp K7, 9 lớp K8, 12 lớp K9 cùng phân công chuyên môn và kiêm nhiệm chuẩn xác.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmRestoreId('__QUYHOP_BENCHMARK__')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục dữ liệu gốc THCS ADMIN</span>
                  </button>
                </div>
              )}

              {/* Danh sách các bản sao lưu đã lưu */}
              {(() => {
                const schoolBackups = backups.filter((b) => {
                  if (currentSchoolId === 'school_quyhop' || currentSchoolId === 'school_admin') return true;
                  return b.schoolId === currentSchoolId;
                });

                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Các phiên bản đã lưu trong hệ thống ({schoolBackups.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">Bấm "Khôi phục ngay" để nạp 100% dữ liệu</span>
                    </h4>

                    {schoolBackups.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 space-y-2">
                        <History className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-medium">Chưa có bản sao lưu nào được tạo cho trường này.</p>
                        <p className="text-[11px] text-slate-400">
                          Hãy bấm <strong>"Lưu bản sao lưu"</strong> ở trên để tạo một bản snapshot dữ liệu đầu tiên.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs">
                        {schoolBackups.map((b) => {
                          const isConfirming = confirmRestoreId === b.id;
                          return (
                            <div
                              key={b.id}
                              className={`p-4 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                                isConfirming ? 'bg-amber-50/80 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'
                              }`}
                            >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-900">{b.title}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                                {b.schoolName || schoolInfo.schoolName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(b.createdAt).toLocaleString('vi-VN')}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                <strong>{b.teacherCount ?? '—'}</strong> giáo viên
                              </span>
                              <span>•</span>
                              <span>
                                <strong>{b.assignmentCount ?? '—'}</strong> phân công
                              </span>
                              <span>•</span>
                              <span>Tạo bởi: {b.createdBy || 'Quản trị viên'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                            {isConfirming ? (
                              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-amber-300 shadow-sm animate-in fade-in">
                                <span className="text-xs font-bold text-amber-900 pl-2">Khôi phục ngay?</span>
                                <button
                                  onClick={() => handleExecuteRestore(b.id)}
                                  disabled={restoreInProgress}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                                >
                                  {restoreInProgress ? 'Đang nạp...' : 'Xác nhận 100%'}
                                </button>
                                <button
                                  onClick={() => setConfirmRestoreId(null)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setConfirmRestoreId(b.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
                                  title="Khôi phục toàn bộ 100% dữ liệu giáo viên, lớp, phân công tại thời điểm này"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Khôi phục ngay 100%</span>
                                </button>

                                <button
                                  onClick={() => handleDownloadBackupJson(b)}
                                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                                  title="Tải file sao lưu này về máy tính (.JSON)"
                                >
                                  <Download className="w-4 h-4 text-emerald-600" />
                                </button>

                                <button
                                  onClick={() => handleDeleteBackup(b.id, b.title)}
                                  className="p-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                  title="Xóa bản sao lưu này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: TẢI FILE SAO LƯU VỀ MÁY TÍNH */}
          {activeTab === 'EXPORT_FILE' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Tải file sao lưu toàn bộ dữ liệu về lưu trên máy tính
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      File sao lưu (.json) lưu trữ đầy đủ 100% cấu hình trường học, danh sách giáo viên, lớp học, định mức, phân phối chương trình và toàn bộ phân công chuyên môn.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FileJson className="w-4 h-4 text-emerald-600" />
                        File sao lưu định dạng JSON
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                        Chuẩn nhất
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Chứa 1 file duy nhất với toàn bộ dữ liệu máy chủ và cục bộ. Bạn có thể mở bằng Notepad hoặc nạp lại trên bất kỳ máy tính nào.
                    </p>
                    <button
                      onClick={handleDownloadFullSystemBackup}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải file sao lưu đầy đủ (.JSON)</span>
                    </button>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderArchive className="w-4 h-4 text-blue-600" />
                        Gói sao lưu an toàn toàn trường
                      </span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                        Đầy đủ
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tự động đóng gói thông tin trường, 42 lớp, 74 giáo viên và toàn bộ nhiệm vụ kiêm nhiệm kèm chữ ký kiểm tra tính toàn vẹn.
                    </p>
                    <button
                      onClick={() => {
                        const b = dataStore.createBackup(`Bản lưu trữ offline_${schoolInfo.schoolName || 'truong'}`);
                        handleDownloadBackupJson(b);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <HardDrive className="w-4 h-4" />
                      <span>Đóng gói & Tải về máy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Hướng dẫn an toàn */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 space-y-1">
                  <p className="font-bold">Khuyến nghị an toàn dữ liệu:</p>
                  <p className="text-blue-900/80 leading-relaxed">
                    Nên tải file sao lưu về máy tính sau mỗi lần hoàn thành đợt phân công lớn hoặc trước khi thực hiện điều chỉnh phiên bản mới. File sao lưu độc lập, không sợ mất dữ liệu ngay cả khi cài lại máy tính hoặc xóa lịch sử duyệt web.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PHỤC HỒI TỪ FILE TRÊN MÁY TÍNH */}
          {activeTab === 'IMPORT_FILE' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Chọn file sao lưu (.json) từ máy tính để phục hồi 100%
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Hệ thống sẽ phân tích file sao lưu và khôi phục toàn bộ danh sách giáo viên, lớp học và phân công tương ứng.
                    </p>
                  </div>
                </div>

                {/* Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-purple-500 bg-white rounded-2xl p-6 text-center cursor-pointer transition space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileJson className="w-10 h-10 text-purple-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    {importFileName ? `Đã chọn: ${importFileName}` : 'Bấm để duyệt file sao lưu .JSON từ máy tính'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Hỗ trợ tất cả các file sao lưu .json được xuất từ phần mềm
                  </p>
                </div>

                {importError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{importError}</span>
                  </div>
                )}

                {/* Bản xem trước thông tin file */}
                {parsedBackupData && (
                  <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-2xs space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Xác nhận thông tin bản sao lưu
                      </span>
                      <span className="text-[11px] bg-purple-50 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                        Hợp lệ
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Đơn vị trường:</span>
                        <span className="font-bold text-slate-800">{parsedBackupData.schoolName}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Năm học:</span>
                        <span className="font-bold text-slate-800">{parsedBackupData.schoolYear}</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Giáo viên:</span>
                        <span className="font-bold text-blue-700">{parsedBackupData.teachersCount} GV</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-400 block font-semibold">Lớp học:</span>
                        <span className="font-bold text-purple-700">{parsedBackupData.classesCount} Lớp</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleApplyFileImport}
                        disabled={restoreInProgress}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-900 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>
                          {restoreInProgress
                            ? 'Đang phục hồi toàn bộ dữ liệu...'
                            : `Phục hồi 100% dữ liệu từ file này (${parsedBackupData.assignmentsCount} phân công)`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Confirm Dialog Khôi phục benchmark THCS Quỳ Hợp */}
        {confirmRestoreId === '__QUYHOP_BENCHMARK__' && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-amber-300 space-y-4 animate-in zoom-in-95">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Xác nhận khôi phục dữ liệu gốc THCS ADMIN?
                </h3>
                <p className="text-xs text-slate-600">
                  Hệ thống sẽ thiết lập lại toàn diện <strong>42 lớp học</strong> (K6: 11 lớp, K7: 10 lớp, K8: 9 lớp, K9: 12 lớp), <strong>74 giáo viên</strong> và các chức vụ kiêm nhiệm, phân công chuyên môn chuẩn xác.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRestoreId(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleRestoreQuyHopBenchmark}
                  disabled={restoreInProgress}
                  className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {restoreInProgress ? 'Đang khôi phục...' : 'Đồng ý khôi phục 100%'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Dữ liệu được lưu trữ an toàn trong LocalStorage & Cloud Firestore</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
