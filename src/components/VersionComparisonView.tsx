/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Multi-dimensional Version & Semester Comparison View
 */

import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  Layers,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  AssignmentVersion,
  TeachingAssignment,
  TeacherCalculationResult,
  Teacher,
  Subject,
  SchoolClass,
  Department,
} from '../types';
import { compareAssignmentVersions } from '../reports/versionComparator';

interface VersionComparisonViewProps {
  versions: AssignmentVersion[];
  assignments: TeachingAssignment[];
  calculations: TeacherCalculationResult[];
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  departments: Department[];
}

export const VersionComparisonView: React.FC<VersionComparisonViewProps> = ({
  versions,
  assignments,
  calculations,
  teachers,
  subjects,
  classes,
  departments,
}) => {
  const [sourceVersionId, setSourceVersionId] = useState<string>(versions[0]?.id || '');
  const [targetVersionId, setTargetVersionId] = useState<string>(versions[1]?.id || versions[0]?.id || '');

  const sourceVersion = versions.find((v) => v.id === sourceVersionId) || versions[0];
  const targetVersion = versions.find((v) => v.id === targetVersionId) || versions[1] || versions[0];

  const sourceAssignments = useMemo(
    () => assignments.filter((a) => a.versionId === sourceVersion?.id),
    [assignments, sourceVersion]
  );
  const targetAssignments = useMemo(
    () => assignments.filter((a) => a.versionId === targetVersion?.id),
    [assignments, targetVersion]
  );

  const diffResult = useMemo(() => {
    return compareAssignmentVersions({
      sourceVersionName: sourceVersion?.name || 'Phiên bản A',
      targetVersionName: targetVersion?.name || 'Phiên bản B',
      sourceAssignments,
      targetAssignments,
      sourceCalculations: calculations,
      targetCalculations: calculations,
      teachers,
      subjects,
      classes,
    });
  }, [
    sourceVersion,
    targetVersion,
    sourceAssignments,
    targetAssignments,
    calculations,
    teachers,
    subjects,
    classes,
  ]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  return (
    <div className="space-y-4 pb-12">
      {/* VERSION SELECTORS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-700" />
              So sánh đa chiều: Phiên bản & Học kỳ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đối chiếu chi tiết thay đổi giữa hai phương án phân công (Trước/Sau điều chỉnh, HK1/HK2, Lần 1/Lần 2)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          {/* Source Version */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
              Phương án gốc (Nguồn)
            </label>
            <select
              value={sourceVersionId}
              onChange={(e) => setSourceVersionId(e.target.value)}
              className="w-full bg-white border border-slate-300 font-bold text-xs sm:text-sm rounded-lg p-2 text-slate-900"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.semesterId} – {v.status})
                </option>
              ))}
            </select>
          </div>

          {/* Target Version */}
          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
            <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">
              Phương án so sánh (Đích)
            </label>
            <select
              value={targetVersionId}
              onChange={(e) => setTargetVersionId(e.target.value)}
              className="w-full bg-white border border-blue-300 font-bold text-xs sm:text-sm rounded-lg p-2 text-slate-900"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.semesterId} – {v.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* COMPARISON METRICS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Tổng số tiết gốc</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{diffResult.totalPeriodsBefore}</div>
          <div className="text-[11px] text-slate-400">{sourceVersion?.name}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Tổng số tiết mới</div>
          <div className="text-2xl font-black text-blue-900 mt-1">{diffResult.totalPeriodsAfter}</div>
          <div className="text-[11px] text-slate-400">{targetVersion?.name}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Chênh lệch số tiết</div>
          <div
            className={`text-2xl font-black mt-1 ${
              diffResult.deltaPeriods > 0
                ? 'text-emerald-700'
                : diffResult.deltaPeriods < 0
                ? 'text-red-700'
                : 'text-slate-800'
            }`}
          >
            {diffResult.deltaPeriods > 0 ? `+${diffResult.deltaPeriods}` : diffResult.deltaPeriods}
          </div>
          <div className="text-[11px] text-slate-400">Tỷ lệ thay đổi: {diffResult.changeRate}%</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Số dòng phân công thay đổi</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            +{diffResult.addedAssignments.length} / -{diffResult.removedAssignments.length}
          </div>
          <div className="text-[11px] text-slate-400">Điều chỉnh: {diffResult.modifiedAssignments.length}</div>
        </div>
      </div>

      {/* DIFF CARDS: ADDED & REMOVED & MODIFIED */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Added Assignments */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-2">
          <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Các phân công mới thêm vào ({diffResult.addedAssignments.length})
          </h3>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {diffResult.addedAssignments.map((a) => {
              const t = teacherMap.get(a.teacherId);
              const s = a.subjectId ? subjectMap.get(a.subjectId) : null;
              const c = a.classId ? classMap.get(a.classId) : null;
              return (
                <div key={a.id} className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs flex justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{t?.fullName}</span>
                    <span className="text-slate-500 text-[10px] ml-1.5">({s?.name || a.dutyName} – {c?.name || 'Toàn trường'})</span>
                  </div>
                  <strong className="text-emerald-800 font-black">+{a.periodsPerWeek} tiết</strong>
                </div>
              );
            })}
            {diffResult.addedAssignments.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6">Không có dòng phân công nào được thêm mới.</div>
            )}
          </div>
        </div>

        {/* Removed Assignments */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-2">
          <h3 className="text-sm font-bold text-red-800 flex items-center gap-1.5">
            <Trash2 className="w-4 h-4" /> Các phân công bị loại bỏ / thay thế ({diffResult.removedAssignments.length})
          </h3>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {diffResult.removedAssignments.map((a) => {
              const t = teacherMap.get(a.teacherId);
              const s = a.subjectId ? subjectMap.get(a.subjectId) : null;
              const c = a.classId ? classMap.get(a.classId) : null;
              return (
                <div key={a.id} className="p-2 rounded-xl bg-red-50/60 border border-red-100 text-xs flex justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{t?.fullName}</span>
                    <span className="text-slate-500 text-[10px] ml-1.5">({s?.name || a.dutyName} – {c?.name || 'Toàn trường'})</span>
                  </div>
                  <strong className="text-red-800 font-black">-{a.periodsPerWeek} tiết</strong>
                </div>
              );
            })}
            {diffResult.removedAssignments.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6">Không có dòng phân công nào bị loại bỏ.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
