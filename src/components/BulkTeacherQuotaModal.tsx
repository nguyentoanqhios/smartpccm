import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Sliders,
  Users,
  Building2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Search,
  Check,
} from 'lucide-react';
import { Teacher, Department, WorkplaceCategory, SchoolBranch } from '../types';
import { dataStore } from '../repositories/dataStore';
import { toastService } from '../services/toastService';

interface BulkTeacherQuotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  departments: Department[];
  workplaces?: WorkplaceCategory[];
  branches?: SchoolBranch[];
  preSelectedTeacherIds?: string[];
  onSuccess?: (count: number, message: string) => void;
}

type ModeType = 'BATCH_ASSIGN' | 'TABLE_EDITOR';

export const BulkTeacherQuotaModal: React.FC<BulkTeacherQuotaModalProps> = ({
  isOpen,
  onClose,
  teachers,
  departments,
  workplaces = [],
  branches = [],
  preSelectedTeacherIds = [],
  onSuccess,
}) => {
  const activeTeachers = useMemo(() => teachers.filter((t) => !t.isDeleted), [teachers]);

  // Danh sách Điểm trường liên kết trực tiếp với cấu hình thiết lập ban đầu của nhà trường
  // và loại bỏ triệt để việc lặp lại "Điểm chính"
  const schoolBranches = useMemo(() => {
    const rawBranches = (branches && branches.length > 0 ? branches : dataStore.getBranches(false)).filter(
      (b) => b.active !== false
    );

    const result: Array<{ id: string; code: string; name: string; isMain: boolean }> = [];
    const seenNames = new Set<string>();

    // 1. Điểm chính luôn là điểm trường hàng đầu duy nhất (đúng 1 mục duy nhất)
    const mainBranch = rawBranches.find((b) => b.isMain) || rawBranches[0];
    const mainId = mainBranch?.id || 'branch_main';
    result.push({
      id: mainId,
      code: mainBranch?.code || 'DC',
      name: 'Điểm chính',
      isMain: true,
    });
    seenNames.add('diem_chinh');

    // 2. Thêm các phân hiệu / điểm trường khác từ cấu hình ban đầu của nhà trường
    rawBranches.forEach((b, idx) => {
      const norm = (b.name || '').trim().normalize('NFC').toLowerCase();
      // Nếu là điểm chính hoặc có tên liên quan đến chính/toàn trường thì bỏ qua vì đã thêm ở trên
      if (
        b.isMain ||
        norm.includes('chính') ||
        norm === 'điểm chính' ||
        norm === 'điểm trường chính' ||
        norm === 'toàn trường' ||
        norm === 'toan truong'
      ) {
        return;
      }

      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        result.push({
          id: b.id,
          code: b.code || `PH${idx + 1}`,
          name: b.name.trim(),
          isMain: false,
        });
      }
    });

    return result;
  }, [branches]);

  // Kiểm tra giáo viên có thuộc điểm trường / nơi làm việc được chọn hay không
  const isTeacherInBranch = useCallback(
    (t: Teacher, branchId: string) => {
      if (branchId === 'ALL') return true;
      const targetBranch = schoolBranches.find((b) => b.id === branchId);
      if (!targetBranch) return true;

      const tWpId = (t.workplaceId || '').trim();
      const tWpName = (t.workplace || '').trim().normalize('NFC').toLowerCase();

      if (targetBranch.isMain) {
        // Giáo viên thuộc Điểm chính:
        // Không thuộc bất kỳ phân hiệu phụ nào trong danh sách điểm trường
        const isAssignedToOther = schoolBranches.some(
          (other) =>
            !other.isMain &&
            (tWpId === other.id ||
              tWpId === 'wp_sub' ||
              tWpId === 'branch_sub' ||
              tWpName === other.name.trim().normalize('NFC').toLowerCase() ||
              tWpName.includes(other.name.trim().normalize('NFC').toLowerCase()) ||
              (other.code && (t.workplace || '').toUpperCase().includes(other.code.toUpperCase())))
        );
        if (isAssignedToOther) return false;
        return true;
      }

      // Các phân hiệu / điểm trường phụ
      const bName = targetBranch.name.trim().normalize('NFC').toLowerCase();
      const bCode = (targetBranch.code || '').trim().toUpperCase();
      return (
        tWpId === targetBranch.id ||
        tWpId === 'wp_sub' ||
        tWpId === 'branch_sub' ||
        tWpName === bName ||
        (bName && tWpName.includes(bName)) ||
        (bCode && (t.workplace || '').toUpperCase().includes(bCode))
      );
    },
    [schoolBranches]
  );

  // Scope: 'SELECTED' (if pre-selected teachers) or 'FILTER' (by Workplace -> Dept)
  const [scopeMode, setScopeMode] = useState<'SELECTED' | 'FILTER'>(() => {
    return preSelectedTeacherIds.length > 0 ? 'SELECTED' : 'FILTER';
  });

  // Workplace filter: 'ALL' (Toàn trường), or specific workplace ID
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState<string>('ALL');
  // Department filter: 'ALL' (Tất cả các tổ), or specific dept ID
  const [selectedDeptId, setSelectedDeptId] = useState<string>('ALL');

  // Mode: Single Quota Assignment vs Detailed Table Editor
  const [activeMode, setActiveMode] = useState<ModeType>('BATCH_ASSIGN');

  // Single Quota Input State (Only 1 input field to assign quota as requested)
  const [targetQuota, setTargetQuota] = useState<number>(19);
  const [reason, setReason] = useState<string>('');

  // Table Editor State: Map of teacherId -> new quota
  const [editedQuotas, setEditedQuotas] = useState<Record<string, number>>({});
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableQuickQuota, setTableQuickQuota] = useState<number>(19);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preSelectedTeacherIds.length > 0) {
        setScopeMode('SELECTED');
      } else {
        setScopeMode('FILTER');
      }
      setSelectedWorkplaceId('ALL');
      setSelectedDeptId('ALL');
      setTargetQuota(19);
      setReason('');
      setTableSearch('');
      setTableQuickQuota(19);

      // Initialize table editor values
      const initialMap: Record<string, number> = {};
      activeTeachers.forEach((t) => {
        initialMap[t.id] = t.standardQuota ?? 19;
      });
      setEditedQuotas(initialMap);
    }
  }, [isOpen, preSelectedTeacherIds, activeTeachers]);

  // Compute targeted teachers based on Workplace -> Department hierarchy
  const scopedTeachers = useMemo(() => {
    return activeTeachers.filter((t) => {
      if (scopeMode === 'SELECTED') {
        return preSelectedTeacherIds.includes(t.id);
      }

      // 1. Lọc theo Điểm trường liên kết với cấu hình ban đầu
      if (selectedWorkplaceId !== 'ALL' && !isTeacherInBranch(t, selectedWorkplaceId)) {
        return false;
      }

      // 2. Tiếp sau đó lọc theo Tổ chuyên môn (Tất cả hoặc theo tổ cụ thể)
      if (selectedDeptId !== 'ALL' && t.departmentId !== selectedDeptId) {
        return false;
      }

      return true;
    });
  }, [activeTeachers, scopeMode, preSelectedTeacherIds, selectedWorkplaceId, selectedDeptId, isTeacherInBranch]);

  // Teachers filtered in table view by search term
  const tableDisplayTeachers = useMemo(() => {
    if (!tableSearch.trim()) return scopedTeachers;
    const s = tableSearch.toLowerCase().trim();
    return scopedTeachers.filter(
      (t) =>
        t.fullName.toLowerCase().includes(s) ||
        t.code.toLowerCase().includes(s) ||
        (t.major && t.major.toLowerCase().includes(s))
    );
  }, [scopedTeachers, tableSearch]);

  // Count changed teachers in table editor mode
  const changedCountInTable = useMemo(() => {
    return scopedTeachers.filter((t) => {
      const edited = editedQuotas[t.id];
      const orig = t.standardQuota ?? 19;
      return edited !== undefined && edited !== orig;
    }).length;
  }, [scopedTeachers, editedQuotas]);

  if (!isOpen) return null;

  // Handler: Apply single quota to scoped teachers
  const handleApplyBatchAssign = () => {
    if (scopedTeachers.length === 0) return;
    const teacherIds = scopedTeachers.map((t) => t.id);
    const count = dataStore.batchUpdateTeacherQuota(
      teacherIds,
      targetQuota,
      reason.trim() || `Cập nhật định mức ${targetQuota} tiết/tuần`
    );

    if (count === 1) {
      const t = scopedTeachers[0];
      toastService.notifyQuotaChange(t.fullName, t.standardQuota ?? 19, targetQuota);
    } else {
      toastService.notifyBulk(
        'Cập nhật định mức hàng loạt',
        `Đã cập nhật định mức ${targetQuota} tiết/tuần cho ${count} giáo viên`
      );
    }

    const msg = `✅ Đã cập nhật định mức ${targetQuota} tiết/tuần cho ${count} giáo viên thành công!`;
    if (onSuccess) {
      onSuccess(count, msg);
    }
    onClose();
  };

  // Handler: Save table edits
  const handleSaveTableEdits = () => {
    const updates = scopedTeachers
      .filter((t) => {
        const edited = editedQuotas[t.id];
        const orig = t.standardQuota ?? 19;
        return edited !== undefined && edited !== orig;
      })
      .map((t) => ({
        teacherId: t.id,
        standardQuota: editedQuotas[t.id],
      }));

    if (updates.length === 0) {
      onClose();
      return;
    }

    const count = dataStore.batchUpdateTeacherQuotaMultiple(
      updates,
      'Điều chỉnh định mức tiết dạy theo bảng giáo viên'
    );

    if (updates.length === 1) {
      const t = scopedTeachers.find((tch) => tch.id === updates[0].teacherId);
      const orig = t?.standardQuota ?? 19;
      toastService.notifyQuotaChange(t?.fullName || 'Giáo viên', orig, updates[0].standardQuota);
    } else {
      const firstT = scopedTeachers.find((tch) => tch.id === updates[0].teacherId);
      toastService.notifyBulk(
        'Cập nhật bảng định mức giáo viên',
        `Đã lưu định mức mới cho ${count} giáo viên (Ví dụ: ${firstT?.fullName || 'GV'}: sửa định mức từ ${firstT?.standardQuota ?? 19} thành ${updates[0].standardQuota} tiết/tuần)`
      );
    }

    const msg = `✅ Đã lưu định mức mới cho ${count} giáo viên thành công!`;
    if (onSuccess) {
      onSuccess(count, msg);
    }
    onClose();
  };

  // Quick set all in table
  const handleQuickSetAllTable = (quotaVal: number) => {
    setEditedQuotas((prev) => {
      const next = { ...prev };
      scopedTeachers.forEach((t) => {
        next[t.id] = quotaVal;
      });
      return next;
    });
  };

  // Reset table to original values
  const handleResetTable = () => {
    const resetMap: Record<string, number> = {};
    activeTeachers.forEach((t) => {
      resetMap[t.id] = t.standardQuota ?? 19;
    });
    setEditedQuotas(resetMap);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* HEADER */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 border border-white/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Nhập & Sửa Định Mức Tiết Dạy Hàng Loạt</span>
                <span className="text-[11px] bg-amber-400 text-blue-950 px-2.5 py-0.5 rounded-full font-bold">
                  {scopedTeachers.length} GV áp dụng
                </span>
              </h2>
              <p className="text-xs text-blue-200/90">
                Hiển thị theo Điểm trường (Toàn trường, Điểm chính, Phân hiệu...) sau đó chọn Tổ chuyên môn hoặc Tất cả
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCOPE SELECTION BAR (Workplace -> Department) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex-shrink-0 space-y-3">
          {preSelectedTeacherIds.length > 0 && (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200/80">
              <span className="text-xs font-bold text-slate-700">Phạm vi:</span>
              <button
                type="button"
                onClick={() => setScopeMode('SELECTED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  scopeMode === 'SELECTED'
                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>Theo {preSelectedTeacherIds.length} giáo viên đã tích chọn</span>
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('FILTER')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  scopeMode === 'FILTER'
                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Chọn theo Điểm trường & Tổ chuyên môn</span>
              </button>
            </div>
          )}

          {/* 2-LEVEL CASCADING SELECTORS: 1. ĐIỂM TRƯỜNG -> 2. TỔ CHUYÊN MÔN */}
          {scopeMode === 'FILTER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-2xl border border-slate-200">
              {/* Mục 1: Điểm trường (Toàn trường, Điểm chính, Phân hiệu...) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>1. Điểm trường / Nơi làm việc:</span>
                </label>
                <select
                  id="bulk-quota-workplace-select"
                  value={selectedWorkplaceId}
                  onChange={(e) => setSelectedWorkplaceId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs font-bold rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="ALL">Toàn trường ({activeTeachers.length} GV)</option>
                  {schoolBranches.map((b) => {
                    const count = activeTeachers.filter((t) => isTeacherInBranch(t, b.id)).length;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({count} GV)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Mục 2: Tổ chuyên môn (Tất cả các tổ hoặc từng tổ) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-700" />
                  <span>2. Tổ chuyên môn:</span>
                </label>
                <select
                  id="bulk-quota-department-select"
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs font-bold rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="ALL">
                    Tất cả các tổ ({activeTeachers.filter((t) => isTeacherInBranch(t, selectedWorkplaceId)).length} GV)
                  </option>
                  {departments.map((d) => {
                    const count = activeTeachers.filter((t) => {
                      if (t.departmentId !== d.id) return false;
                      return isTeacherInBranch(t, selectedWorkplaceId);
                    }).length;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({count} GV)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}

          {scopeMode === 'SELECTED' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900 font-medium flex items-center justify-between">
              <span>
                Đang áp dụng cho <strong>{scopedTeachers.length} giáo viên</strong> đã được tích chọn ở màn hình danh sách.
              </span>
              <button
                type="button"
                onClick={() => setScopeMode('FILTER')}
                className="text-blue-700 underline font-bold hover:text-blue-900 cursor-pointer"
              >
                Đổi sang lọc theo Điểm trường & Tổ
              </button>
            </div>
          )}
        </div>

        {/* WORKFLOW MODE TABS */}
        <div className="px-6 pt-3 bg-white border-b border-slate-200 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveMode('BATCH_ASSIGN')}
            className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'BATCH_ASSIGN'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Gán định mức đồng loạt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('TABLE_EDITOR')}
            className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'TABLE_EDITOR'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Bảng sửa chi tiết từng giáo viên ({scopedTeachers.length} GV)</span>
            {changedCountInTable > 0 && (
              <span className="bg-amber-400 text-blue-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {changedCountInTable} thay đổi
              </span>
            )}
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: BATCH ASSIGN (GÁN ĐỊNH MỨC ĐỒNG LOẠT - CHỈ 1 Ô NHẬP THEO YÊU CẦU)  */}
          {/* ========================================================================= */}
          {activeMode === 'BATCH_ASSIGN' && (
            <div className="space-y-5">
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs space-y-1 text-blue-950">
                <div className="font-bold text-sm flex items-center gap-2 text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-700" />
                  <span>Gán định mức tiết dạy cho {scopedTeachers.length} giáo viên</span>
                </div>
                <p className="text-slate-600">
                  Tất cả các giáo viên thuộc phạm vi đã chọn ở trên sẽ được cập nhật định mức này. 
                  Các thông tin kiêm nhiệm và giảm trừ tiết dạy vẫn được bảo lưu đầy đủ.
                </p>
              </div>

              {/* Ô NHẬP SỐ TIẾT ĐỂ GÁN (Chỉ có một ô nhập số tiết để gán) */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <label htmlFor="target-quota-input" className="block text-sm font-black text-slate-800">
                      Nhập số tiết định mức cần gán:
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Áp dụng cho <strong>{scopedTeachers.length} giáo viên</strong> trong phạm vi đã chọn
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetQuota((prev) => Math.max(0, prev - 1))}
                      className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-black text-base cursor-pointer shadow-2xs transition"
                      title="Giảm 1 tiết"
                    >
                      -
                    </button>
                    <input
                      id="target-quota-input"
                      type="number"
                      min={0}
                      max={40}
                      value={targetQuota}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setTargetQuota(isNaN(val) ? 0 : Math.max(0, Math.min(40, val)));
                      }}
                      className="w-24 text-center bg-white border border-slate-300 rounded-xl py-2 text-lg font-black text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-inner"
                      placeholder="19"
                    />
                    <button
                      type="button"
                      onClick={() => setTargetQuota((prev) => Math.min(40, prev + 1))}
                      className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-black text-base cursor-pointer shadow-2xs transition"
                      title="Tăng 1 tiết"
                    >
                      +
                    </button>
                    <span className="text-xs font-bold text-slate-700 ml-1">tiết / tuần</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi chú / Lý do điều chỉnh (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Cập nhật định mức giảng dạy học kỳ mới..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Preview of Affected Teachers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Danh sách giáo viên sẽ được áp dụng ({scopedTeachers.length} GV):
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Hiển thị tối đa 12 người xem trước
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                  {scopedTeachers.slice(0, 12).map((t) => {
                    const dept = departments.find((d) => d.id === t.departmentId);
                    const currentQuota = t.standardQuota ?? 19;
                    const isDifferent = currentQuota !== targetQuota;
                    return (
                      <div
                        key={t.id}
                        className={`p-2 rounded-xl border text-xs flex items-center justify-between ${
                          isDifferent
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="font-bold truncate">{t.fullName}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {dept?.name || 'Chưa gán tổ'} • {t.workplace || 'Điểm chính'}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[10px] text-slate-400 line-through">{currentQuota}t</div>
                          <div className="font-black text-blue-900 text-xs">{targetQuota}t</div>
                        </div>
                      </div>
                    );
                  })}
                  {scopedTeachers.length > 12 && (
                    <div className="bg-slate-50 p-2 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 flex items-center justify-center font-semibold">
                      + và {scopedTeachers.length - 12} giáo viên khác...
                    </div>
                  )}
                  {scopedTeachers.length === 0 && (
                    <div className="col-span-full p-6 text-center text-slate-400 text-xs">
                      Không có giáo viên nào phù hợp với phạm vi đã chọn.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TABLE EDITOR (BẢNG NHẬP & SỬA CHI TIẾT TỪNG NGƯỜI)                  */}
          {/* ========================================================================= */}
          {activeMode === 'TABLE_EDITOR' && (
            <div className="space-y-4">
              {/* Table Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm tên hoặc mã giáo viên..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Batch assign input for all in table */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600">Gán số tiết cho tất cả:</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={tableQuickQuota}
                    onChange={(e) => setTableQuickQuota(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 text-center bg-white border border-slate-300 rounded-lg py-1 text-xs font-black text-blue-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickSetAllTable(tableQuickQuota)}
                    className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    Áp dụng
                  </button>
                  <button
                    type="button"
                    onClick={handleResetTable}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                    title="Khôi phục lại giá trị ban đầu"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider sticky top-0 z-10 font-bold border-b-2 border-blue-200/80 shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 w-20">Mã GV</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3">Tổ chuyên môn</th>
                      <th className="py-2.5 px-3">Nơi làm việc</th>
                      <th className="py-2.5 px-3 text-center w-24">Hiện tại</th>
                      <th className="py-2.5 px-4 text-center w-40">Định mức mới</th>
                      <th className="py-2.5 px-3 text-center w-24">Thay đổi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {tableDisplayTeachers.map((t, idx) => {
                      const dept = departments.find((d) => d.id === t.departmentId);
                      const currentQuota = t.standardQuota ?? 19;
                      const edited = editedQuotas[t.id] ?? currentQuota;
                      const isChanged = edited !== currentQuota;

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-blue-50/40 transition ${
                            isChanged ? 'bg-amber-50/50 font-medium' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{t.code}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {t.fullName}
                            {t.major && <span className="block text-[10px] font-normal text-slate-400">{t.major}</span>}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{dept?.name || 'Chưa gán'}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              <Building2 className="w-2.5 h-2.5 text-slate-500" />
                              {t.workplace || 'Điểm chính'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-600">
                            {currentQuota} tiết
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditedQuotas((prev) => ({
                                    ...prev,
                                    [t.id]: Math.max(0, (prev[t.id] ?? currentQuota) - 1),
                                  }));
                                }}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={40}
                                value={edited}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setEditedQuotas((prev) => ({
                                    ...prev,
                                    [t.id]: val,
                                  }));
                                }}
                                className={`w-14 py-1 text-center font-black text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                  isChanged
                                    ? 'bg-amber-100/80 border-amber-400 text-amber-950 shadow-2xs'
                                    : 'bg-white border-slate-300 text-slate-900'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditedQuotas((prev) => ({
                                    ...prev,
                                    [t.id]: Math.min(40, (prev[t.id] ?? currentQuota) + 1),
                                  }));
                                }}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isChanged ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  edited > currentQuota
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {edited > currentQuota ? `+${edited - currentQuota}` : `${edited - currentQuota}`}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {tableDisplayTeachers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Không có giáo viên nào trong danh sách.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            {activeMode === 'BATCH_ASSIGN' ? (
              <span>
                Sẽ gán định mức <strong>{targetQuota} tiết/tuần</strong> cho{' '}
                <strong>{scopedTeachers.length} giáo viên</strong>.
              </span>
            ) : (
              <span>
                Đã chỉnh sửa <strong>{changedCountInTable} giáo viên</strong> so với định mức hiện tại.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            {activeMode === 'BATCH_ASSIGN' ? (
              <button
                type="button"
                onClick={handleApplyBatchAssign}
                disabled={scopedTeachers.length === 0}
                className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Áp dụng cho {scopedTeachers.length} giáo viên</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveTableEdits}
                disabled={changedCountInTable === 0}
                className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thay đổi ({changedCountInTable} giáo viên)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
