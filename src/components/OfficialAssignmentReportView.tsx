import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Printer,
  FileSpreadsheet,
  Edit3,
  Check,
  X,
  Filter,
  Calendar,
  Building,
  School,
  Layers,
  ChevronDown,
  ChevronRight,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import {
  Teacher,
  SchoolClass,
  Subject,
  TeachingAssignment,
  TeacherCalculationResult,
  Department,
  SchoolInfo,
  SchoolBranch,
  SpecialDuty,
  AbbreviationRule,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { exportOfficialAssignmentReportExcel } from '../import-export/excelService';
import { PrintPreviewModal } from './PrintPreviewModal';
import {
  abbreviateDutyName,
  applyAbbreviationRules,
  groupTeachingAssignmentsBySubject,
  cleanSchoolYear,
  getCanonicalDutyKey,
} from '../utils/abbreviationUtils';

interface OfficialAssignmentReportViewProps {
  schoolInfo: SchoolInfo;
  teachers: Teacher[];
  departments: Department[];
  classes: SchoolClass[];
  subjects: Subject[];
  calculations: TeacherCalculationResult[];
  assignments: TeachingAssignment[];
  duties: SpecialDuty[];
  branches: SchoolBranch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedDepartmentId: string;
  setSelectedDepartmentId: (id: string) => void;
  selectedSemester: 'HK1' | 'HK2' | 'ALL_YEAR';
  setSelectedSemester: (sem: 'HK1' | 'HK2' | 'ALL_YEAR') => void;
  schoolYear: string;
  onUpdateTeacher?: (teacher: Teacher) => void;
}

export const OfficialAssignmentReportView: React.FC<OfficialAssignmentReportViewProps> = ({
  schoolInfo,
  teachers,
  departments,
  classes,
  subjects,
  calculations,
  assignments,
  duties,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  selectedDepartmentId,
  setSelectedDepartmentId,
  selectedSemester,
  setSelectedSemester,
  schoolYear,
  onUpdateTeacher,
}) => {
  // Local state for configuration
  const [assignmentRound, setAssignmentRound] = useState<string>('LẦN I');
  const [governingAuthority, setGoverningAuthority] = useState<string>(
    schoolInfo.authorityName || 'ỦY BAN NHÂN DÂN'
  );
  const [selectedBranchUnit, setSelectedBranchUnit] = useState<string>(() => {
    return schoolInfo.schoolName ? schoolInfo.schoolName.toUpperCase() : 'TRƯỜNG THCS';
  });
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [groupByDepartmentInSchool, setGroupByDepartmentInSchool] = useState<boolean>(true);
  const [collapsedDepartmentIds, setCollapsedDepartmentIds] = useState<Set<string>>(new Set());
  const [showAbbreviationLegend, setShowAbbreviationLegend] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const [abbreviationRules, setAbbreviationRules] = useState<AbbreviationRule[]>(() =>
    dataStore.getAbbreviationRules(true)
  );

  useEffect(() => {
    if (schoolInfo.authorityName) {
      setGoverningAuthority(schoolInfo.authorityName);
    }
    if (schoolInfo.schoolName && selectedBranchId === 'ALL') {
      setSelectedBranchUnit(schoolInfo.schoolName.toUpperCase());
    }
  }, [schoolInfo, selectedBranchId]);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setAbbreviationRules(dataStore.getAbbreviationRules(true));
    });
    return () => unsub();
  }, []);

  // Toggle department collapsing
  const toggleDepartmentCollapse = (deptId: string) => {
    setCollapsedDepartmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  // Edit Teacher Form State
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editStartYear, setEditStartYear] = useState<number | ''>('');
  const [editInitialDegree, setEditInitialDegree] = useState('');
  const [editHigherDegree, setEditHigherDegree] = useState('');
  const [editOffDay, setEditOffDay] = useState('');
  const [editTutoringInfo, setEditTutoringInfo] = useState('');
  const [editBdHsgInfo, setEditBdHsgInfo] = useState('');

  // Cleaned school year to avoid 'sy_' error (e.g. sy_2026_2027 -> 2026–2027)
  const formattedSchoolYear = useMemo(() => cleanSchoolYear(schoolYear), [schoolYear]);

  // Semester weeks
  const semesterWeeks = useMemo(() => {
    if (selectedSemester === 'HK1') return 18;
    if (selectedSemester === 'HK2') return 17;
    return 35;
  }, [selectedSemester]);

  const semesterDisplayTitle = useMemo(() => {
    if (selectedSemester === 'HK1') return 'HỌC KỲ I';
    if (selectedSemester === 'HK2') return 'HỌC KỲ II';
    return 'CẢ NĂM';
  }, [selectedSemester]);

  const semesterColTitle = useMemo(() => {
    if (selectedSemester === 'HK1') return 'học kỳ 1';
    if (selectedSemester === 'HK2') return 'học kỳ 2';
    return 'cả năm';
  }, [selectedSemester]);

  // Maps
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const departmentMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const calcMap = useMemo(() => new Map(calculations.map((c) => [c.teacherId, c])), [calculations]);

  // Branch Scoping
  const scopedTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (t.isDeleted) return false;
      if (selectedBranchId === 'ALL') return true;
      const branch = branches.find((b) => b.id === selectedBranchId);
      if (!branch) return true;
      if (branch.isMain) {
        return !t.workplace || t.workplace.includes('chính') || t.workplaceId === 'wp_main' || t.workplace === 'Toàn trường';
      }
      return (
        (t.workplace && t.workplace.toLowerCase().includes('phân hiệu')) ||
        t.workplaceId === 'wp_sub' ||
        t.workplace === 'Toàn trường'
      );
    });
  }, [teachers, selectedBranchId, branches]);

  // Department Scoping
  const displayedTeachers = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return scopedTeachers;
    return scopedTeachers.filter((t) => t.departmentId === selectedDepartmentId);
  }, [scopedTeachers, selectedDepartmentId]);

  // Dynamic Subtitle
  const currentDepartmentName = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return 'TOÀN TRƯỜNG';
    const dept = departmentMap.get(selectedDepartmentId);
    return dept ? (dept.name || dept.fullName).toUpperCase() : 'TỔ CHUYÊN MÔN';
  }, [selectedDepartmentId, departmentMap]);

  // Handle Opening Edit Modal for Teacher
  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setEditBirthDate(t.birthDate || '');
    setEditStartYear(t.startYear || '');
    setEditInitialDegree(t.initialDegree || '');
    setEditHigherDegree(t.higherDegree || '');
    setEditOffDay(t.offDay || '');
    setEditTutoringInfo(t.tutoringInfo || '');
    setEditBdHsgInfo(t.bdHsgInfo || '');
  };

  const handleSaveEditTeacher = () => {
    if (!editingTeacher || !onUpdateTeacher) return;
    const updated: Teacher = {
      ...editingTeacher,
      birthDate: editBirthDate.trim() || undefined,
      startYear: editStartYear === '' ? undefined : Number(editStartYear),
      initialDegree: editInitialDegree.trim() || undefined,
      higherDegree: editHigherDegree.trim() || undefined,
      offDay: editOffDay.trim() || undefined,
      tutoringInfo: editTutoringInfo.trim() || undefined,
      bdHsgInfo: editBdHsgInfo.trim() || undefined,
    };
    onUpdateTeacher(updated);
    setEditingTeacher(null);
  };

  // Excel Export Handler
  const handleExportExcel = async () => {
    await exportOfficialAssignmentReportExcel({
      authorityName: governingAuthority,
      schoolName: schoolInfo.schoolName || 'TRƯỜNG THCS',
      branchName: selectedBranchUnit,
      schoolYear: formattedSchoolYear,
      semesterName: semesterDisplayTitle,
      semesterWeeks,
      assignmentRound,
      departmentScopeName: currentDepartmentName,
      isAllSchool: selectedDepartmentId === 'ALL',
      teachers: displayedTeachers,
      calculations,
      assignments,
      classes,
      subjects,
      departments,
      duties,
    });
  };

  // Helper for rendering teacher row
  const renderTeacherRow = (teacher: Teacher, index: number) => {
    const calc = calcMap.get(teacher.id);
    const tAssignments = assignments.filter(
      (a) =>
        a.teacherId === teacher.id &&
        !a.isDeleted &&
        (selectedSemester === 'ALL_YEAR' || a.semesterId === selectedSemester)
    );

    // Birth year
    let birthYearStr = '-';
    if (teacher.birthDate) {
      const match = teacher.birthDate.match(/\d{4}/);
      birthYearStr = match ? match[0] : teacher.birthDate;
    }

    // Start year
    const startYearStr = teacher.startYear ? String(teacher.startYear) : '-';

    // Degrees
    const initialDegreeStr = teacher.initialDegree || '-';
    const higherDegreeStr = teacher.higherDegree || '-';

    // Concurrent duties & exemptions (Abbreviated, each duty on its own line)
    // Ưu tiên sử dụng danh sách nhiệm vụ đã được hàm tính toán workload (calculateTeacherWorkload) khử trùng lặp tuyệt đối
    const dutyLines: string[] = calc?.dutyLines && calc.dutyLines.length > 0 ? [...calc.dutyLines] : [];
    const addedDutyKeys = new Set<string>();
    dutyLines.forEach((l) => addedDutyKeys.add(getCanonicalDutyKey(l)));

    const formatDutyPeriodsStr = (p: number, isExempt: boolean = false) => {
      if (p <= 0) return '';
      const raw = isExempt
        ? `(miễn ${p} tiết/tuần = ${p * semesterWeeks} tiết)`
        : `(${p} tiết/tuần = ${p * semesterWeeks} tiết)`;
      return applyAbbreviationRules(raw, abbreviationRules);
    };

    // 1. Quét từ phân công kiêm nhiệm / miễn giảm trong assignments (chỉ bổ sung nếu chưa có trong dutyLines)
    const dutyAssignments = tAssignments.filter(
      (a) =>
        a.type === 'CONCURRENT_DUTY' ||
        a.type === 'CONCURRENT' ||
        a.type === 'EXEMPTION' ||
        Boolean(a.dutyName)
    );

    dutyAssignments.forEach((ca) => {
      const isExempt = ca.type === 'EXEMPTION';
      const matchedDuty = ca.dutyId
        ? duties.find((d) => d.id === ca.dutyId || d.code === ca.dutyId)
        : duties.find((d) => (ca.dutyName || '').toLowerCase().includes(d.name.toLowerCase()));

      let p = matchedDuty
        ? (isExempt
            ? (matchedDuty.periodsPerWeekExempted ?? matchedDuty.periodsPerWeekCalculated ?? ca.periodsPerWeek ?? 0)
            : (matchedDuty.periodsPerWeekCalculated ?? matchedDuty.periodsPerWeekExempted ?? ca.periodsPerWeek ?? 0))
        : (ca.periodsPerWeek || 0);
      if (p === 0 && (ca.periodsPerWeek || 0) > 0) {
        p = ca.periodsPerWeek || 0;
      }

      let rawName = ca.dutyName || matchedDuty?.name || (isExempt ? 'Miễn giảm' : 'Kiêm nhiệm');
      const pMatch = rawName.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) || rawName.match(/\((\d+)[^)]*\)/i);
      if (pMatch && p === 0) {
        p = parseInt(pMatch[1], 10);
      }
      rawName = rawName.replace(/\s*\([^)]*\)/gi, '').trim();

      const abbrName = abbreviateDutyName(rawName, abbreviationRules);
      const isActuallyExempt = isExempt || matchedDuty?.type === 'EXEMPTION' || rawName.toLowerCase().includes('miễn') || rawName.toLowerCase().includes('sinh');
      const periodStr = p > 0 ? formatDutyPeriodsStr(p, isActuallyExempt) : '';
      const fullLine = periodStr ? `${abbrName} ${periodStr}` : abbrName;

      const dedupeKey = getCanonicalDutyKey(abbrName || rawName);
      if (!addedDutyKeys.has(dedupeKey)) {
        addedDutyKeys.add(dedupeKey);
        dutyLines.push(fullLine);
      }
    });

    // 2. Bổ sung từ teacher.positions nếu chưa có trong dutyAssignments
    if (teacher.positions && teacher.positions.length > 0) {
      teacher.positions.forEach((pos) => {
        const pMatch = pos.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) || pos.match(/\((\d+)[^)]*\)/i);
        const pFromPos = pMatch ? parseInt(pMatch[1], 10) : 0;
        let cleanPos = pos.replace(/\s*\([^)]*\)/gi, '').trim();
        const abbrPos = abbreviateDutyName(cleanPos, abbreviationRules);
        const dedupeKey = getCanonicalDutyKey(abbrPos || cleanPos);

        if (!addedDutyKeys.has(dedupeKey)) {
          const matchedDuty = duties.find(
            (d) =>
              d.name.toLowerCase() === pos.toLowerCase() ||
              d.name.toLowerCase() === cleanPos.toLowerCase() ||
              cleanPos.toLowerCase().includes(d.name.toLowerCase()) ||
              d.name.toLowerCase().includes(cleanPos.toLowerCase())
          );

          let p = matchedDuty
            ? (matchedDuty.periodsPerWeekCalculated || matchedDuty.periodsPerWeekExempted || 0)
            : pFromPos;

          if (p === 0 && pFromPos > 0) {
            p = pFromPos;
          }

          const isExempt = matchedDuty?.type === 'EXEMPTION' || pos.toLowerCase().includes('miễn') || pos.toLowerCase().includes('sinh') || cleanPos.toLowerCase().includes('miễn') || cleanPos.toLowerCase().includes('sinh');
          const periodStr = p > 0 ? formatDutyPeriodsStr(p, isExempt) : '';
          const fullLine = periodStr ? `${abbrPos} ${periodStr}` : abbrPos;

          addedDutyKeys.add(dedupeKey);
          dutyLines.push(fullLine);
        }
      });
    }

    // 3. Kiểm tra số tiết miễn giảm từ calc (nếu chưa được thể hiện ở các dòng nhiệm vụ trên)
    if (calc && calc.exemptionPeriods > 0) {
      const alreadyHasExemptionLine = dutyLines.some((l) =>
        l.toLowerCase().includes('miễn') ||
        l.toLowerCase().includes('sinh') ||
        l.toLowerCase().includes('con nhỏ') ||
        l.toLowerCase().includes('con mọn') ||
        l.toLowerCase().includes('nuôi con') ||
        l.toLowerCase().includes('ốm')
      );

      if (!alreadyHasExemptionLine) {
        let exemptLabel = 'Miễn giảm';
        if (teacher.status === 'MATERNITY') exemptLabel = 'Nghỉ sinh';
        else if (teacher.status === 'VICE_PRINCIPAL') exemptLabel = 'PHT';
        else if (teacher.status === 'PRINCIPAL') exemptLabel = 'HTr';
        else if (teacher.status === 'SICK_LEAVE') exemptLabel = 'Nghỉ ốm';
        else if (teacher.status === 'UNPAID_LEAVE') exemptLabel = 'Nghỉ K.Lương';

        const abbrLabel = abbreviateDutyName(exemptLabel, abbreviationRules);
        const periodStr = formatDutyPeriodsStr(calc.exemptionPeriods, true);
        dutyLines.push(`${abbrLabel} ${periodStr}`);
      }
    }

    // Mỗi nhiệm vụ liệt kê theo từng hàng
    const dutyContent =
      dutyLines.length > 0 ? (
        <div className="space-y-1 text-[11px]">
          {dutyLines.map((line, lIdx) => (
            <div key={lIdx} className="text-slate-800 flex items-start gap-1 leading-snug">
              <span className="text-amber-600 font-bold mt-0.5">•</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-slate-400">-</span>
      );

    // Teaching Assignments: Mỗi môn dạy liệt kê theo từng hàng, gom các lớp cùng môn cùng số tiết
    // Ví dụ: T.Anh: 6A9, 6A10, 6A11 (3t) [9t/tuần]
    const subjectSummaries = groupTeachingAssignmentsBySubject(
      tAssignments,
      subjectMap,
      classMap,
      abbreviationRules
    );

    const teachingContent =
      subjectSummaries.length > 0 ? (
        <div className="space-y-1.5 text-[11px]">
          {subjectSummaries.map((item, sIdx) => {
            const prefix = `${item.abbreviatedSubjectName}: `;
            const detailText = item.lineText.startsWith(prefix) ? item.lineText.slice(prefix.length) : item.lineText;

            return (
              <div key={sIdx} className="leading-snug">
                <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200/80 rounded font-bold text-[11px] mr-1">
                  {item.abbreviatedSubjectName}:
                </span>{' '}
                <span className="text-slate-800 font-medium">{detailText}</span>
              </div>
            );
          })}
        </div>
      ) : calc && (calc.resultStatus === 'EXACT_EXEMPT' || calc.exemptionPeriods >= calc.quota) ? (
        <span className="italic text-blue-800 font-medium">(Nghỉ sinh / Miễn dạy toàn phần)</span>
      ) : (
        <span className="text-slate-400 italic">Chưa phân công môn</span>
      );

    const weeklyCalculated = calc ? calc.totalCalculated : 0;
    const totalSemesterPeriods = weeklyCalculated * semesterWeeks;

    return (
      <tr key={teacher.id} className="hover:bg-slate-50/80 transition group border-b border-slate-200">
        <td className="py-2.5 px-2 text-center text-slate-500 font-medium border-r border-slate-200">{index + 1}</td>
        <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-200">
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => handleOpenEditTeacher(teacher)}
              className="font-bold text-slate-900 hover:text-blue-700 hover:underline cursor-pointer text-left transition"
              title="Bấm để xem / chỉnh sửa hồ sơ & phụ đạo của giáo viên"
            >
              {teacher.fullName}
            </button>
            {onUpdateTeacher && (
              <button
                type="button"
                onClick={() => handleOpenEditTeacher(teacher)}
                title="Chỉnh sửa thông tin hồ sơ & phụ đạo"
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition print:hidden cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
        <td className="py-2.5 px-2 text-center text-slate-700 border-r border-slate-200 font-medium">{birthYearStr}</td>
        <td className="py-2.5 px-2 text-center text-slate-700 border-r border-slate-200 font-medium">{startYearStr}</td>
        <td className="py-2.5 px-2 text-left text-slate-700 border-r border-slate-200 text-[11px]">{initialDegreeStr}</td>
        <td className="py-2.5 px-2 text-left text-slate-700 border-r border-slate-200 text-[11px]">{higherDegreeStr}</td>
        <td className="py-2.5 px-3 text-left border-r border-slate-200 text-[11px] leading-relaxed">{dutyContent}</td>
        <td className="py-2.5 px-3 text-left border-r border-slate-200 text-[11px] leading-relaxed">{teachingContent}</td>
        <td className="py-2.5 px-2 text-center font-black text-slate-900 border-r border-slate-200 bg-slate-50">
          {totalSemesterPeriods}
        </td>
        <td className="py-2.5 px-2 text-center font-black text-blue-900 border-r border-slate-200 bg-blue-50/50">
          {weeklyCalculated}
        </td>
        <td className="py-2.5 px-2 text-left text-[11px] text-slate-700 border-r border-slate-200">
          {teacher.bdHsgInfo || teacher.tutoringInfo ? (
            <div className="space-y-1">
              {teacher.bdHsgInfo && (
                <div className="text-purple-900 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 leading-tight">
                  <span className="text-[10px] text-purple-700 block font-bold">BD HSG:</span>
                  {applyAbbreviationRules(teacher.bdHsgInfo, abbreviationRules)}
                </div>
              )}
              {teacher.tutoringInfo && (
                <div className="text-emerald-900 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 leading-tight">
                  {applyAbbreviationRules(teacher.tutoringInfo, abbreviationRules)}
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="py-2.5 px-2 text-center text-slate-700 font-medium">
          {teacher.offDay ? (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-800 text-[11px] border border-slate-200 inline-block">
              {teacher.offDay}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
      </tr>
    );
  };

  // Total summary calculations
  const totalSummary = useMemo(() => {
    let totalSemesterPeriods = 0;
    let totalWeeklyPeriods = 0;
    displayedTeachers.forEach((t) => {
      const calc = calcMap.get(t.id);
      if (calc) {
        totalWeeklyPeriods += calc.totalCalculated;
        totalSemesterPeriods += calc.totalCalculated * semesterWeeks;
      }
    });
    const avgWeekly =
      displayedTeachers.length > 0 ? (totalWeeklyPeriods / displayedTeachers.length).toFixed(1) : '0';
    return { totalSemesterPeriods, totalWeeklyPeriods, avgWeekly };
  }, [displayedTeachers, calcMap, semesterWeeks]);

  const getReportContentHtml = () => {
    if (reportContainerRef.current) {
      return reportContainerRef.current.innerHTML;
    }
    const el = document.getElementById('official-printable-report');
    return el ? el.innerHTML : '';
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. INTERACTIVE CONTROL BAR (HIDDEN IN PRINT) */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-blue-700" />
              Tùy chỉnh số liệu báo cáo:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingInfo(!isEditingInfo)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>{isEditingInfo ? 'Đóng tùy chỉnh tiêu đề' : 'Sửa tiêu đề & Đơn vị'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel chuẩn mẫu</span>
            </button>
            <button
              type="button"
              id="btn-open-official-print-modal"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs group"
              title="Xem trước bản in, in trực tiếp hoặc mở trang in khổ A4 ngang"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300 group-hover:scale-110 transition-transform" />
              <span>In biểu mẫu (A4)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls: Scope (Whole School / By Department), Time Point (Semester / Round), Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
          {/* 1. Scope: Department or Whole School */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-700" />
              Phạm vi (Toàn trường / Theo Tổ):
            </label>
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="w-full bg-white border border-slate-300 font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Toàn trường (Tất cả các Tổ)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Semester */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-700" />
              Thời điểm (Học kỳ):
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value as 'HK1' | 'HK2' | 'ALL_YEAR')}
              className="w-full bg-white border border-slate-300 font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="HK1">Học kỳ I (18 tuần)</option>
              <option value="HK2">Học kỳ II (17 tuần)</option>
              <option value="ALL_YEAR">Cả năm học (35 tuần)</option>
            </select>
          </div>

          {/* 3. Assignment Round */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Building className="w-3 h-3 text-blue-700" />
              Lần phân công:
            </label>
            <div className="flex gap-1">
              <select
                value={['LẦN I', 'LẦN II', 'LẦN III', 'ĐIỀU CHỈNH'].includes(assignmentRound) ? assignmentRound : 'CUSTOM'}
                onChange={(e) => {
                  if (e.target.value !== 'CUSTOM') setAssignmentRound(e.target.value);
                }}
                className="bg-white border border-slate-300 font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer flex-1"
              >
                <option value="LẦN I">LẦN I</option>
                <option value="LẦN II">LẦN II</option>
                <option value="LẦN III">LẦN III</option>
                <option value="ĐIỀU CHỈNH">ĐIỀU CHỈNH</option>
                <option value="CUSTOM">Khác...</option>
              </select>
              {!['LẦN I', 'LẦN II', 'LẦN III', 'ĐIỀU CHỈNH'].includes(assignmentRound) && (
                <input
                  type="text"
                  value={assignmentRound}
                  onChange={(e) => setAssignmentRound(e.target.value)}
                  className="bg-white border border-slate-300 font-bold text-slate-800 rounded-xl px-2 py-1 w-24 text-xs"
                  placeholder="Tự nhập..."
                />
              )}
            </div>
          </div>

          {/* 4. Branch / Điểm trường */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
              <School className="w-3 h-3 text-blue-700" />
              Điểm trường / Phân hiệu:
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                const b = branches.find((br) => br.id === e.target.value);
                const sName = schoolInfo.schoolName ? schoolInfo.schoolName.toUpperCase() : 'TRƯỜNG THCS';
                if (b) {
                  if (b.isMain) {
                    setSelectedBranchUnit(sName);
                  } else {
                    setSelectedBranchUnit(`${b.name.toUpperCase()} - ${sName}`);
                  }
                } else {
                  setSelectedBranchUnit(sName);
                }
              }}
              className="w-full bg-white border border-slate-300 font-bold text-slate-800 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả điểm trường</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Collapsible Info Customizer */}
        {isEditingInfo && (
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-blue-900 mb-1">
                Tên cơ quan quản lý cấp trên (Dòng trên cùng bên trái):
              </label>
              <input
                type="text"
                value={governingAuthority}
                onChange={(e) => setGoverningAuthority(e.target.value)}
                className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
                placeholder={schoolInfo.authorityName || 'Nhập UBND... hoặc SỞ... (để trống nếu không dùng)'}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-blue-900 mb-1">
                Tên đơn vị trường / phân hiệu (Dòng dưới bên trái):
              </label>
              <input
                type="text"
                value={selectedBranchUnit}
                onChange={(e) => setSelectedBranchUnit(e.target.value)}
                className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
                placeholder={schoolInfo.schoolName || 'VD: TRƯỜNG THCS'}
              />
            </div>
          </div>
        )}

        {/* Quick Scope Indicator & Department Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-500 font-medium mr-1">Chuyển nhanh theo Tổ:</span>
          <button
            type="button"
            onClick={() => setSelectedDepartmentId('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              selectedDepartmentId === 'ALL'
                ? 'bg-blue-900 text-white shadow-2xs'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Toàn trường ({scopedTeachers.length})
          </button>
          {departments.map((d) => {
            const count = scopedTeachers.filter((t) => t.departmentId === d.id).length;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDepartmentId(d.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedDepartmentId === d.id
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {d.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OFFICIAL ADMINISTRATIVE REPORT SHEET (UNIFIED WITH OTHER REPORTS) */}
      {/* ========================================================================= */}
      <div
        id="official-printable-report"
        ref={reportContainerRef}
        className="space-y-4 font-sans bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-200"
      >
        {/* Document Header (Standard official administrative format) */}
        <div className="grid grid-cols-2 gap-4 pb-3.5 border-b border-slate-200">
          {/* Left Column: Cơ quan chủ quản & Tên đơn vị */}
          <div className="text-center space-y-0.5">
            <div className="text-xs sm:text-sm font-semibold uppercase tracking-tight text-slate-600">
              {governingAuthority}
            </div>
            <div className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900">
              <span className="border-b-2 border-slate-800 pb-0.5 inline-block">
                {selectedBranchUnit}
              </span>
            </div>
          </div>

          {/* Right Column: Quốc hiệu & Tiêu ngữ */}
          <div className="text-center space-y-0.5">
            <div className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              <span className="border-b-2 border-slate-800 pb-0.5 inline-block">
                Độc lập - Tự do - Hạnh phúc
              </span>
            </div>
          </div>
        </div>

        {/* Main Document Title */}
        <div className="text-center my-3 space-y-1">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
            BÁO CÁO PHÂN CÔNG CHUYÊN MÔN TỔNG HỢP
          </h2>
          <div className="text-xs font-bold text-slate-600 uppercase">
            {assignmentRound.toUpperCase()} – {semesterDisplayTitle.toUpperCase()}, NĂM HỌC {formattedSchoolYear}
          </div>
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-blue-900 bg-blue-50 px-3.5 py-0.5 rounded-full border border-blue-200">
              {currentDepartmentName}
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] tracking-wider border-b-2 border-blue-300">
              {/* Row 1 Header */}
              <tr className="text-blue-950 font-black text-[10px] text-center">
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-2 w-10">
                  TT
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-3 min-w-[140px]">
                  Họ và tên
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-2 w-14 leading-tight">
                  Năm<br />sinh
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-2 w-16 leading-tight">
                  Năm<br />vào<br />ngành
                </th>
                <th colSpan={2} className="border-r border-b border-blue-300/80 py-1.5 px-3">
                  Trình độ chuyên môn
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-3 min-w-[170px] leading-tight">
                  Chức vụ, kiêm nhiệm,<br />số tiết {semesterColTitle}
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-3 min-w-[220px] leading-tight">
                  Phân công giảng dạy môn, lớp, tiết của {semesterColTitle}
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-2 w-18 leading-tight">
                  Tổng số<br />tiết {semesterColTitle}
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-2 w-18 leading-tight">
                  Số tiết<br />trung<br />bình/tuần
                </th>
                <th rowSpan={2} className="border-r border-b border-blue-300/80 py-2.5 px-3 w-32 leading-tight">
                  BD HSG, Ôn thi 9,<br />Phụ đạo HS yếu
                </th>
                <th rowSpan={2} className="border-b border-blue-300/80 py-2.5 px-2 w-20 leading-tight">
                  Nghỉ<br />chuyên<br />môn
                </th>
              </tr>

              {/* Row 2 Sub-columns for Trình độ chuyên môn */}
              <tr className="bg-sky-200/70 text-blue-950 font-bold text-[9px] text-center">
                <th className="border-r border-b border-blue-300/80 py-1.5 px-2 w-24 leading-tight">
                  Trình độ<br />ban đầu
                </th>
                <th className="border-r border-b border-blue-300/80 py-1.5 px-2 w-24 leading-tight">
                  Trình độ<br />nâng cao
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {/* If viewing All School and grouped by Department */}
              {selectedDepartmentId === 'ALL' && groupByDepartmentInSchool ? (
                departments.map((dept, dIdx) => {
                  const deptTeachers = displayedTeachers.filter((t) => t.departmentId === dept.id);
                  if (deptTeachers.length === 0) return null;
                  const isDeptCollapsed = collapsedDepartmentIds.has(dept.id);

                  return (
                    <React.Fragment key={dept.id}>
                      {/* Department Section Row (Collapsible) */}
                      <tr
                        onClick={() => toggleDepartmentCollapse(dept.id)}
                        className="bg-slate-100 hover:bg-slate-200/80 font-bold border-b border-slate-200 text-slate-900 cursor-pointer transition select-none"
                        title="Bấm để thu ẩn / sổ ra danh sách giáo viên của tổ này"
                      >
                        <td colSpan={12} className="py-2.5 px-3 uppercase tracking-wider text-xs font-black text-slate-900 bg-slate-100">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="p-0.5 rounded bg-white border border-slate-300 text-blue-700">
                                {isDeptCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </span>
                              <span>
                                {dIdx + 1}. {(dept.name || dept.fullName).toUpperCase()} ({deptTeachers.length} giáo viên)
                              </span>
                            </div>
                            {isDeptCollapsed && (
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                Đang thu ẩn {deptTeachers.length} GV • Bấm để sổ ra
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {!isDeptCollapsed && deptTeachers.map((teacher, tIdx) => renderTeacherRow(teacher, tIdx))}
                    </React.Fragment>
                  );
                })
              ) : displayedTeachers.length > 0 ? (
                displayedTeachers.map((teacher, idx) => renderTeacherRow(teacher, idx))
              ) : (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 italic font-medium">
                    Không tìm thấy giáo viên nào trong phạm vi được chọn.
                  </td>
                </tr>
              )}

              {/* TOTAL SUMMARY FOOTER ROW */}
              {displayedTeachers.length > 0 && (
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                  <td colSpan={8} className="py-3 px-4 text-center uppercase tracking-wider font-black text-slate-900">
                    TỔNG CỘNG ({displayedTeachers.length} GIÁO VIÊN - {currentDepartmentName})
                  </td>
                  <td className="py-3 px-2 text-center font-black text-slate-950 border-r border-slate-200 bg-slate-200/70">
                    {totalSummary.totalSemesterPeriods}
                  </td>
                  <td className="py-3 px-2 text-center font-black text-blue-950 border-r border-slate-200 bg-blue-100/50">
                    {totalSummary.avgWeekly}
                  </td>
                  <td colSpan={2} className="py-3 px-3 text-slate-600 font-medium text-[11px]">
                    Bình quân <strong className="text-slate-900">{totalSummary.avgWeekly}</strong> tiết/tuần/GV
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* COMPACT ABBREVIATION LEGEND FOOTNOTE FOR PRINT & REVIEW */}
        <div className="mt-4 pt-2.5 border-t border-slate-200 text-[10.5px] text-slate-600 leading-relaxed font-sans">
          <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wide">
            * Ký hiệu viết tắt trong biểu:
          </span>{' '}
          {abbreviationRules
            .slice(0, 16)
            .map((r) => `${r.abbreviatedText}: ${r.originalText}`)
            .join(' • ')}
          {abbreviationRules.length > 16 && ' ...'}
        </div>

        {/* SIGNATURE BLOCK */}
        <div className="grid grid-cols-3 gap-4 pt-8 mt-6 text-center text-slate-800">
          <div>
            <div className="font-bold text-xs sm:text-sm uppercase text-slate-900">NGƯỜI LẬP BIỂU</div>
            <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div className="h-16"></div>
          </div>

          <div>
            <div className="font-bold text-xs sm:text-sm uppercase text-slate-900">TỔ TRƯỞNG CHUYÊN MÔN</div>
            <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</div>
            <div className="h-16"></div>
          </div>

          <div>
            <div className="font-bold text-xs sm:text-sm uppercase text-slate-900">HIỆU TRƯỞNG / PHÓ HIỆU TRƯỞNG</div>
            <div className="text-[11px] italic text-slate-500 mt-0.5">(Ký tên, đóng dấu)</div>
            <div className="h-16"></div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: QUICK TEACHER PROFILE & TUTORING INFORMATION EDITOR */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Cập nhật hồ sơ & Phụ đạo: {editingTeacher.fullName}
                </h3>
                <p className="text-xs text-slate-500">Mã GV: {editingTeacher.code}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Năm sinh (hoặc Ngày sinh):</label>
                <input
                  type="text"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: 1986 hoặc 1986-09-02"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Năm vào ngành:</label>
                <input
                  type="number"
                  value={editStartYear}
                  onChange={(e) => setEditStartYear(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: 2009"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Trình độ chuyên môn ban đầu:</label>
                <input
                  type="text"
                  value={editInitialDegree}
                  onChange={(e) => setEditInitialDegree(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: Đại học Sư phạm Ngoại ngữ"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Trình độ chuyên môn nâng cao:</label>
                <input
                  type="text"
                  value={editHigherDegree}
                  onChange={(e) => setEditHigherDegree(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: Thạc sĩ Ngôn ngữ Anh (hoặc để trống)"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Bồi dưỡng học sinh giỏi (BD HSG):
                </label>
                <input
                  type="text"
                  value={editBdHsgInfo}
                  onChange={(e) => setEditBdHsgInfo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: BD HSG Toán 9 (2 tiết/tuần), Đội tuyển HSG KHTN"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Dạy ôn thi 9, Phụ đạo HS yếu (Cột 11):
                </label>
                <input
                  type="text"
                  value={editTutoringInfo}
                  onChange={(e) => setEditTutoringInfo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: Ôn thi vào 10 (2 tiết/tuần), Phụ đạo HS yếu Toán 6"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Ngày nghỉ chuyên môn hàng tuần (Cột 12):
                </label>
                <select
                  value={editOffDay}
                  onChange={(e) => setEditOffDay(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chưa thiết lập --</option>
                  <option value="Thứ Hai">Thứ Hai</option>
                  <option value="Thứ Ba">Thứ Ba</option>
                  <option value="Thứ Tư">Thứ Tư</option>
                  <option value="Thứ Năm">Thứ Năm</option>
                  <option value="Thứ Sáu">Thứ Sáu</option>
                  <option value="Thứ Bảy">Thứ Bảy</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditTeacher}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: PRINT PREVIEW & ADVANCED A4 EXPORT */}
      {/* ========================================================================= */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`BÁO CÁO PHÂN CÔNG CHUYÊN MÔN - ${currentDepartmentName}`}
        schoolName={selectedBranchUnit || schoolInfo.schoolName || 'TRƯỜNG THCS'}
        getContentHtml={getReportContentHtml}
        getRawElement={() => reportContainerRef.current}
        orientation="landscape"
        onExportExcel={handleExportExcel}
      />
    </div>
  );
};
