import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  RefreshCw,
  UserCheck,
  UserPlus,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Teacher, Department, SchoolInfo } from '../types';
import { dataStore } from '../repositories/dataStore';
import { parseUploadedExcel, RawDetectedTeacher } from '../import-export/excelImportService';
import { exportTeacherMasterProfileTemplate } from '../import-export/excelService';
import { removeVietnameseTones } from '../utils/searchUtils';

interface TeacherExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: { addedCount: number; updatedCount: number; totalProcessed: number }) => void;
  schoolInfo?: SchoolInfo;
  existingTeachers?: Teacher[];
  departments?: Department[];
}

export const TeacherExcelImportModal: React.FC<TeacherExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  schoolInfo,
  existingTeachers = [],
  departments = [],
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedTeachers, setParsedTeachers] = useState<Partial<Teacher>[]>([]);
  const [rawPreview, setRawPreview] = useState<RawDetectedTeacher[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'UPSERT' | 'ADD_ONLY'>('UPSERT');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const currentTeachers = existingTeachers.length > 0 ? existingTeachers : dataStore.getTeachers();

  const handleDownloadTemplate = async () => {
    try {
      await exportTeacherMasterProfileTemplate(schoolInfo);
    } catch (err: any) {
      setErrorMsg(`Lỗi tải mẫu: ${err.message || 'Không thể tạo file mẫu'}`);
    }
  };

  const processFile = async (selectedFile: File) => {
    setErrorMsg(null);
    setFile(selectedFile);
    setIsParsing(true);

    try {
      const result = await parseUploadedExcel(selectedFile);

      if (!result.teachersToImport || result.teachersToImport.length === 0) {
        setErrorMsg('Không tìm thấy danh sách giáo viên hợp lệ trong file Excel. Vui lòng kiểm tra lại cấu trúc cột hoặc tải file mẫu chuẩn.');
        setParsedTeachers([]);
        setRawPreview([]);
        setIsParsing(false);
        return;
      }

      setParsedTeachers(result.teachersToImport);
      setRawPreview(result.rawTeachers || []);
      setDetectedColumns(result.detectedColumns?.teacherColumns || []);
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(`Lỗi khi đọc file Excel: ${err.message || 'File không hợp lệ hoặc bị lỗi định dạng'}`);
      setParsedTeachers([]);
      setRawPreview([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Analyze matching with existing teachers
  const matchAnalysis = parsedTeachers.map((t) => {
    const codeTrim = (t.code || '').trim().toUpperCase();
    const normName = removeVietnameseTones(t.fullName || '');

    const existing = currentTeachers.find((cur) => {
      if (codeTrim && cur.code && cur.code.trim().toUpperCase() === codeTrim) return true;
      if (normName && removeVietnameseTones(cur.fullName) === normName) return true;
      return false;
    });

    return {
      teacher: t,
      isExisting: Boolean(existing),
      matchedTeacher: existing,
    };
  });

  const existingCount = matchAnalysis.filter((m) => m.isExisting).length;
  const newCount = matchAnalysis.filter((m) => !m.isExisting).length;

  const handleConfirmImport = () => {
    if (parsedTeachers.length === 0) return;
    setIsSaving(true);

    try {
      const result = dataStore.bulkUpsertTeachers(parsedTeachers, importMode);
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Lỗi khi lưu dữ liệu: ${err.message || 'Không thể đồng bộ vào hệ thống'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Nhập Hồ Sơ Giáo Viên Từ Excel</h2>
                <span className="bg-emerald-500/20 text-emerald-200 text-[11px] px-2 py-0.5 rounded-full border border-emerald-400/30 font-medium">
                  Cơ sở dữ liệu gốc toàn App
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-0.5">
                Nhập đầy đủ thông tin cá nhân, chuyên ngành, bằng cấp, nơi làm việc và nhiệm vụ kiêm nhiệm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800">
          {/* Top Action Bar: Template download & quick instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                <span className="font-bold">Mẹo chuẩn hóa:</span> Bạn có thể sử dụng file Excel danh sách cán bộ giáo viên của nhà trường (hệ thống tự nhận diện các cột Tên, Mã, Ngày sinh, Giới tính, Trình độ, Nơi làm việc, Chức vụ...). Để đạt chuẩn 100%, hãy tải file mẫu đầy đủ bên dưới.
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-xs px-3.5 py-2 rounded-lg shadow-xs transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-600" />
              Tải file mẫu Excel chuẩn (19 cột)
            </button>
          </div>

          {/* Upload Area */}
          {!parsedTeachers.length && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 transition rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3 bg-slate-50/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner">
                {isParsing ? <RefreshCw className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isParsing ? 'Đang phân tích file Excel...' : 'Nhấp để chọn file Excel hoặc kéo thả vào đây'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Hỗ trợ định dạng .xlsx, .xls (Microsoft Excel)</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Preview & Sync Settings */}
          {parsedTeachers.length > 0 && (
            <div className="space-y-4">
              {/* File Info & Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">
                      File: <span className="text-blue-700">{file?.name}</span> ({parsedTeachers.length} hồ sơ giáo viên)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Các cột nhận diện: {detectedColumns.slice(0, 6).join(', ')}
                      {detectedColumns.length > 6 ? ` và ${detectedColumns.length - 6} cột khác...` : ''}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedTeachers([]);
                    setRawPreview([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-600 hover:text-rose-600 flex items-center gap-1 font-semibold self-end sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Chọn file khác
                </button>
              </div>

              {/* Mode Selection Badges */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-2">
                  <span>Cơ chế đồng bộ hồ sơ giáo viên:</span>
                  <span className="text-slate-600 font-normal">
                    (Phát hiện <span className="font-bold text-blue-700">{existingCount}</span> hồ sơ đã có trong hệ thống,{' '}
                    <span className="font-bold text-emerald-700">{newCount}</span> hồ sơ mới hoàn toàn)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                      importMode === 'UPSERT'
                        ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="UPSERT"
                      checked={importMode === 'UPSERT'}
                      onChange={() => setImportMode('UPSERT')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        Đồng bộ & Cập nhật (Khuyên dùng)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Cập nhật các thông tin cá nhân/chuyên môn mới cho {existingCount} GV đã có (giữ nguyên phân công), và thêm mới {newCount} GV.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                      importMode === 'ADD_ONLY'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="ADD_ONLY"
                      checked={importMode === 'ADD_ONLY'}
                      onChange={() => setImportMode('ADD_ONLY')}
                      className="mt-0.5 text-emerald-600"
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-emerald-600" />
                        Chỉ thêm giáo viên mới
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Chỉ thêm {newCount} giáo viên chưa từng có trong hệ thống, bỏ qua {existingCount} giáo viên đã tồn tại.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Bản xem trước dữ liệu trích xuất ({parsedTeachers.length} giáo viên)</span>
                  <span className="text-[11px] text-slate-500 font-normal">Cuộn ngang để xem tất cả các cột</span>
                </div>
                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">STT</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3">Mã GV</th>
                        <th className="py-2.5 px-3">Họ và tên</th>
                        <th className="py-2.5 px-3 text-center">Giới tính</th>
                        <th className="py-2.5 px-3 text-center">Ngày sinh</th>
                        <th className="py-2.5 px-3 text-center">Năm vào ngành</th>
                        <th className="py-2.5 px-3">Trình độ</th>
                        <th className="py-2.5 px-3">Chuyên ngành</th>
                        <th className="py-2.5 px-3">Tổ chuyên môn</th>
                        <th className="py-2.5 px-3">Nơi làm việc</th>
                        <th className="py-2.5 px-3">Chức vụ / Kiêm nhiệm</th>
                        <th className="py-2.5 px-3 text-center">Định mức</th>
                        <th className="py-2.5 px-3">Điện thoại</th>
                        <th className="py-2.5 px-3">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matchAnalysis.map((item, idx) => {
                        const t = item.teacher;
                        const isMatch = item.isExisting;

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-blue-50/50 transition ${
                              isMatch ? 'bg-blue-50/20' : 'bg-emerald-50/20'
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {isMatch ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Cập nhật
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Thêm mới
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">
                              {t.code || '-'}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                              {t.fullName}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  t.gender === 'Nam'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {t.gender || 'Nữ'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                              {t.birthDate || '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-600">
                              {t.startYear || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {t.initialDegree || t.higherDegree || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {t.major || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {(t as any).departmentName || t.departmentId || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {t.workplace || 'Điểm chính'}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {t.positions && t.positions.length > 0 ? t.positions.join(', ') : '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-blue-700">
                              {t.standardQuota ?? 19}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {t.phone || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {t.email || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition"
          >
            Hủy bỏ
          </button>

          {parsedTeachers.length > 0 && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmImport}
              className="bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Xác nhận đồng bộ {parsedTeachers.length} hồ sơ giáo viên
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default TeacherExcelImportModal;
