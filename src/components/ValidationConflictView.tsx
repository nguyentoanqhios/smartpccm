/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Conflict & Validation Diagnostic View (Section VI & XV)
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { ValidationOutput, TeacherCalculationResult } from '../types';

interface ValidationConflictViewProps {
  validation: ValidationOutput;
  calculations: TeacherCalculationResult[];
  onNavigateToAssignments: () => void;
  onRefreshValidation: () => void;
}

export const ValidationConflictView: React.FC<ValidationConflictViewProps> = ({
  validation,
  calculations,
  onNavigateToAssignments,
  onRefreshValidation,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL');

  const conflicts = validation.conflicts.filter((c) => {
    if (filterSeverity === 'ALL') return true;
    return c.severity === filterSeverity;
  });

  const deficitTeachers = calculations.filter((c) => c.resultStatus === 'DEFICIT');
  const surplusTeachers = calculations.filter((c) => c.resultStatus === 'SURPLUS');
  const unassignedClasses = validation.classSubjectChecks.filter((c) => c.status !== 'OK');

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Kiểm tra lỗi, xung đột & Cân đối số tiết
            </h2>
            {validation.isValid ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hệ thống hợp lệ 100%
              </span>
            ) : (
              <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-red-200">
                <AlertCircle className="w-3.5 h-3.5" /> Có {validation.conflicts.length} lỗi cần xử lý
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quét toàn diện xung đột trùng lịch, lệch khung số tiết môn, và thừa/thiếu định mức giáo viên
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-validation"
            onClick={onRefreshValidation}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Quét lại toàn bộ
          </button>
          <button
            onClick={onNavigateToAssignments}
            className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
          >
            Đến bảng phân công <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SUMMARY STATUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Box 1: Hard Conflicts */}
        <div className={`p-4 rounded-2xl border shadow-2xs ${conflicts.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600">Lỗi phân công (Xung đột)</span>
            <AlertCircle className={`w-4 h-4 ${conflicts.length > 0 ? 'text-red-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${conflicts.length > 0 ? 'text-red-800' : 'text-emerald-700'}`}>
            {conflicts.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Trùng giáo viên, lệch tiết môn tích hợp</div>
        </div>

        {/* Box 2: Deficit Teachers */}
        <div className={`p-4 rounded-2xl border shadow-2xs ${deficitTeachers.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600">Giáo viên thiếu định mức</span>
            <Users className={`w-4 h-4 ${deficitTeachers.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${deficitTeachers.length > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
            {deficitTeachers.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Cần bổ sung tiết hoặc nhiệm vụ kiêm nhiệm</div>
        </div>

        {/* Box 3: Surplus Teachers */}
        <div className={`p-4 rounded-2xl border shadow-2xs ${surplusTeachers.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600">Giáo viên thừa định mức</span>
            <Users className={`w-4 h-4 ${surplusTeachers.length > 0 ? 'text-orange-600' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-black mt-1 ${surplusTeachers.length > 0 ? 'text-orange-800' : 'text-emerald-700'}`}>
            {surplusTeachers.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Vượt quá định mức quy định/tuần</div>
        </div>
      </div>

      {/* CONFLICT DETAILS LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Danh sách cảnh báo & Xung đột chi tiết</h3>
          <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setFilterSeverity('ALL')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded ${filterSeverity === 'ALL' ? 'bg-blue-900 text-white' : 'text-slate-600'}`}
            >
              Tất cả ({validation.conflicts.length})
            </button>
            <button
              onClick={() => setFilterSeverity('ERROR')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded ${filterSeverity === 'ERROR' ? 'bg-red-700 text-white' : 'text-slate-600'}`}
            >
              Lỗi nghiêm trọng
            </button>
            <button
              onClick={() => setFilterSeverity('WARNING')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded ${filterSeverity === 'WARNING' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
            >
              Cảnh báo lệch
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {conflicts.map((c) => (
            <div key={c.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 transition">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
                  c.severity === 'ERROR' ? 'bg-red-600' : 'bg-amber-500'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      c.severity === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {c.type}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Mã lỗi: {c.id}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mt-1">{c.message}</h4>
                {c.suggestedAction && (
                  <p className="text-xs text-blue-800 font-medium mt-1 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    💡 <strong>Gợi ý khắc phục:</strong> {c.suggestedAction}
                  </p>
                )}
              </div>
            </div>
          ))}

          {conflicts.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
              <div className="font-bold text-slate-700 text-sm">Không phát hiện xung đột nào</div>
              <p className="mt-1">Tất cả các dòng phân công và khung tiết đều ăn khớp hoàn toàn.</p>
            </div>
          )}
        </div>
      </div>

      {/* TEACHERS DEFICIT / SURPLUS TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deficit Teachers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2 text-amber-800">
            <Users className="w-4 h-4" /> Giáo viên thiếu định mức ({deficitTeachers.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {deficitTeachers.map((t) => (
              <div key={t.teacherId} className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 border border-amber-100 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{t.teacherName}</div>
                  <div className="text-[10px] text-slate-500">{t.departmentName}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-amber-800">{t.totalCalculated} / {t.quota} tiết</div>
                  <div className="text-[10px] text-red-700 font-bold">Thiếu {t.deficitAmount} tiết</div>
                </div>
              </div>
            ))}
            {deficitTeachers.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6">Tất cả giáo viên đã đủ hoặc vượt định mức.</div>
            )}
          </div>
        </div>

        {/* Surplus Teachers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2 text-orange-800">
            <Users className="w-4 h-4" /> Giáo viên thừa định mức ({surplusTeachers.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {surplusTeachers.map((t) => (
              <div key={t.teacherId} className="flex items-center justify-between p-2 rounded-xl bg-orange-50/50 border border-orange-100 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{t.teacherName}</div>
                  <div className="text-[10px] text-slate-500">{t.departmentName}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-orange-800">{t.totalCalculated} / {t.quota} tiết</div>
                  <div className="text-[10px] text-orange-700 font-bold">Thừa +{t.surplusAmount} tiết</div>
                </div>
              </div>
            ))}
            {surplusTeachers.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6">Không có giáo viên nào bị thừa tiết.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
