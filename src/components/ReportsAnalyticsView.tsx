/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * 15 Official Reports & Statistical Analytics Engine (Section VIII)
 * Supports dynamic configuration:
 *  - Filter by branch: Toàn trường, Điểm chính, Phân hiệu...
 *  - Filter by time cycle: Tuần (1 tuần), Tháng (4 tuần), Học kỳ (18/17 tuần), Cả năm (35 tuần)
 *  - Header derived dynamically from software configuration (schoolInfo & branches)
 *  - Teacher search in teacher-related reports
 *  - Verified mathematical formulas and balance summaries
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PrintPreviewModal } from './PrintPreviewModal';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Filter,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
  Building2,
  School,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Check,
  Sun,
  Moon,
  SunMoon,
  Award,
  Sparkles,
  TrendingUp,
  BarChart3,
  Info,
  MapPin,
  X,
  UserCheck,
  Percent,
  CheckSquare,
  FileText,
} from 'lucide-react';
import { OfficialAssignmentReportView } from './OfficialAssignmentReportView';
import { SearchableTeacherSelect } from './SearchableTeacherSelect';
import { TeachingPlanFrameworkModal } from './TeachingPlanFrameworkModal';
import {
  Teacher,
  SchoolClass,
  Subject,
  Department,
  SpecialDuty,
  TeachingAssignment,
  TeacherCalculationResult,
  CurriculumDistribution,
  ValidationOutput,
  AuditLog,
  SemesterId,
  AssignmentVersion,
  SchoolInfo,
  SchoolBranch,
} from '../types';
import {
  generateReportByDepartment,
  generateReportByClass,
  generateReportBySubjectGrade,
  generateReportByDuties,
  generateReportBySubject,
  generateReportBySession,
  generateReportByGrade,
  generateReportTeacherStructure,
} from '../reports/reportGenerator';
import { calculateTeacherWorkload } from '../calculation-engine/workloadCalculator';
import { dataStore } from '../repositories/dataStore';

interface ReportsAnalyticsViewProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  departments: Department[];
  duties: SpecialDuty[];
  curriculums: CurriculumDistribution[];
  assignments: TeachingAssignment[];
  calculations: TeacherCalculationResult[];
  validation: ValidationOutput;
  auditLogs: AuditLog[];
  schoolYearId: string;
  semesterId: SemesterId;
  currentVersion?: AssignmentVersion;
  onExportExcel?: (params?: {
    branchScopeName?: string;
    departmentScopeName?: string;
    timeCycleName?: string;
    periodMultiplier?: number;
    filteredCalculations?: TeacherCalculationResult[];
    filteredAssignments?: TeachingAssignment[];
    filteredClasses?: SchoolClass[];
    filteredTeachers?: Teacher[];
  }) => void;
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  teachers,
  classes,
  subjects,
  departments,
  duties,
  curriculums,
  assignments,
  calculations: propCalculations,
  validation,
  auditLogs,
  schoolYearId,
  semesterId,
  currentVersion,
  onExportExcel,
}) => {
  // Navigation & Control States
  const [selectedReportId, setSelectedReportId] = useState<number>(1);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL'); // 'ALL' | branch_id | 'ALL_SUB'
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL'); // 'ALL' | department_id
  const [groupByDepartment, setGroupByDepartment] = useState<boolean>(false);
  const [selectedSemester, setSelectedSemester] = useState<SemesterId | 'ALL_YEAR'>(semesterId || 'HK1');
  const [selectedTimeCycle, setSelectedTimeCycle] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'YEAR'>('WEEK');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [isTeachingPlanModalOpen, setIsTeachingPlanModalOpen] = useState<boolean>(false);
  
  // Specific report filter states
  const [report1Template, setReport1Template] = useState<'OFFICIAL' | 'STANDARD'>('OFFICIAL');
  const [localTeachers, setLocalTeachers] = useState<Teacher[]>(teachers);
  const [selectedTeacherForReport2, setSelectedTeacherForReport2] = useState<string>('');
  const [teacherSearchForReport2, setTeacherSearchForReport2] = useState<string>('');
  const [statusFilterForReport10, setStatusFilterForReport10] = useState<'ALL' | 'UNBALANCED' | 'DEFICIT' | 'SURPLUS' | 'EXACT'>('ALL');
  const [classSubjectFilter, setClassSubjectFilter] = useState<'ALL' | 'DEFICIT' | 'SURPLUS' | 'OK' | 'MISSING'>('ALL');
  
  // Specific filter and expansion states for Report 7 (By Session)
  const [sessionFilterForReport7, setSessionFilterForReport7] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'ACTIVITY'>('ALL');
  const [sessionSearchForReport7, setSessionSearchForReport7] = useState<string>('');
  const [expandedSessionKeys, setExpandedSessionKeys] = useState<Set<string>>(new Set(['FULL_DAY']));

  const toggleExpandSession = (key: string) => {
    setExpandedSessionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  React.useEffect(() => {
    setLocalTeachers(teachers);
  }, [teachers]);

  const handleUpdateTeacher = (updated: Teacher) => {
    dataStore.updateTeacher(updated.id, updated);
    setLocalTeachers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // Dynamic School & Branch Configurations
  const [currentSchool, setCurrentSchool] = useState<SchoolInfo>(() => dataStore.getSchoolInfo());
  const [branches, setBranches] = useState<SchoolBranch[]>(() => dataStore.getBranches(true));

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setCurrentSchool(dataStore.getSchoolInfo());
      setBranches(dataStore.getBranches(true));
    });
    return () => unsub();
  }, []);

  const mainBranch = useMemo(() => branches.find((b) => b.isMain) || branches[0], [branches]);
  const subBranches = useMemo(() => branches.filter((b) => !b.isMain), [branches]);
  const currentBranch = useMemo(() => {
    if (selectedBranchId === 'ALL' || selectedBranchId === 'ALL_SUB') return null;
    return branches.find((b) => b.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  // Counts of teachers & classes for interactive badges
  const counts = useMemo(() => {
    const totalTeachers = teachers.filter((t) => !t.isDeleted).length;
    const totalClasses = classes.filter((c) => !c.isDeleted).length;

    const mainClassesCount = classes.filter(
      (c) => !c.isDeleted && (!c.branchId || c.branchId === (mainBranch?.id || 'branch_main'))
    ).length;
    const subClassesCount = classes.filter(
      (c) => !c.isDeleted && (c.branchId === 'branch_sub' || subBranches.some((sb) => sb.id === c.branchId))
    ).length;

    const mainTeachersCount = teachers.filter((t) => {
      if (t.isDeleted) return false;
      return (
        t.workplaceId === (mainBranch?.id || 'branch_main') ||
        t.workplace === 'Điểm chính' ||
        t.workplace === 'Toàn trường' ||
        (!t.workplaceId && !t.workplace?.includes('Phân hiệu'))
      );
    }).length;

    const subTeachersCount = teachers.filter((t) => {
      if (t.isDeleted) return false;
      return (
        t.workplaceId === 'branch_sub' ||
        t.workplace === 'Phân hiệu' ||
        t.workplace?.includes('Phân hiệu') ||
        subBranches.some((sb) => sb.id === t.workplaceId)
      );
    }).length;

    return {
      totalTeachers,
      totalClasses,
      mainClassesCount,
      subClassesCount,
      mainTeachersCount,
      subTeachersCount,
    };
  }, [teachers, classes, mainBranch, subBranches]);

  const reportList = [
    { id: 1, name: '1. Báo cáo phân công chuyên môn TỔNG HỢP' },
    { id: 2, name: '2. Báo cáo định mức chi tiết từng Giáo viên' },
    { id: 3, name: '3. Báo cáo theo Tổ chuyên môn' },
    { id: 4, name: '4. Báo cáo theo từng Lớp học' },
    { id: 5, name: '5. Báo cáo theo Khối (Khối 6, 7, 8, 9)' },
    { id: 6, name: '6. Báo cáo theo Môn học' },
    { id: 7, name: '7. Báo cáo theo Buổi học (Sáng / Chiều / 2 buổi/ngày)' },
    { id: 8, name: '8. Báo cáo Nhiệm vụ kiêm nhiệm' },
    { id: 9, name: '9. Báo cáo Miễn giảm tiết dạy' },
    { id: 10, name: '10. Báo cáo Giáo viên Thiếu, Đủ hoặc Thừa định mức' },
    { id: 11, name: '11. Báo cáo Môn – Lớp thiếu, đủ, thừa hoặc trùng' },
    { id: 12, name: '12. Báo cáo Tổng số tiết & Cân đối định mức' },
    { id: 13, name: '13. Báo cáo Tổng số tiết từng môn theo từng khối' },
    { id: 14, name: '14. Báo cáo Số giáo viên và Cơ cấu chuyên môn' },
    { id: 15, name: '15. Báo cáo Lịch sử điều chỉnh phân công' },
  ];

  // Time Cycle & Semester Calculation
  const selectedSemesterWeeks = useMemo(() => {
    if (selectedSemester === 'HK1') return 18;
    if (selectedSemester === 'HK2') return 17;
    return 35;
  }, [selectedSemester]);

  const timeCycleConfig = useMemo(() => {
    switch (selectedTimeCycle) {
      case 'MONTH':
        return { multiplier: 4, name: 'Theo tháng (4 tuần)', unit: 'tiết/tháng', shortLabel: 'Tháng (4t)' };
      case 'SEMESTER':
        return {
          multiplier: selectedSemesterWeeks,
          name: `Theo ${selectedSemester === 'ALL_YEAR' ? 'năm học' : 'học kỳ'} (${selectedSemesterWeeks} tuần)`,
          unit: selectedSemester === 'ALL_YEAR' ? 'tiết/năm' : 'tiết/kỳ',
          shortLabel: selectedSemester === 'ALL_YEAR' ? 'Năm (35t)' : `Kỳ (${selectedSemesterWeeks}t)`,
        };
      case 'YEAR':
        return { multiplier: 35, name: 'Cả năm học (35 tuần)', unit: 'tiết/năm', shortLabel: 'Cả năm (35t)' };
      case 'WEEK':
      default:
        return { multiplier: 1, name: 'Theo tuần (1 tuần)', unit: 'tiết/tuần', shortLabel: 'Tuần (1t)' };
    }
  }, [selectedTimeCycle, selectedSemesterWeeks, selectedSemester]);

  // Assignments filtered by selected semester
  const effectiveAssignments = useMemo(() => {
    if (selectedSemester === 'ALL_YEAR') {
      const allYear = dataStore.getAssignments(schoolYearId);
      return allYear.length > 0 ? allYear : assignments;
    }
    if (selectedSemester === semesterId) {
      return assignments;
    }
    const semAssignments = dataStore.getAssignments(schoolYearId, selectedSemester as SemesterId);
    return semAssignments.length > 0 ? semAssignments : assignments;
  }, [selectedSemester, semesterId, schoolYearId, assignments]);

  // Branch Scope Label Text
  const branchScopeName = useMemo(() => {
    if (selectedBranchId === 'ALL') {
      return branches.length > 1
        ? `Toàn trường (Điểm chính & Phân hiệu)`
        : 'Toàn trường';
    }
    if (selectedBranchId === 'ALL_SUB') {
      return 'Phân hiệu (Tất cả các điểm lẻ)';
    }
    if (currentBranch) {
      return currentBranch.isMain ? `${currentBranch.name} (Cơ sở chính)` : `${currentBranch.name}`;
    }
    return 'Toàn trường';
  }, [selectedBranchId, branches, currentBranch]);

  const branchDisplayName = useMemo(() => {
    if (selectedBranchId === 'ALL') return 'TOÀN TRƯỜNG';
    if (selectedBranchId === 'ALL_SUB') return 'PHÂN HIỆU';
    if (currentBranch) return currentBranch.name.toUpperCase();
    return 'TOÀN TRƯỜNG';
  }, [selectedBranchId, currentBranch]);

  // Scoped Classes based on Branch
  const scopedClasses = useMemo(() => {
    if (selectedBranchId === 'ALL') return classes.filter((c) => !c.isDeleted);
    if (selectedBranchId === 'ALL_SUB') {
      return classes.filter((c) => {
        if (c.isDeleted) return false;
        const b = branches.find((br) => br.id === c.branchId);
        return b ? !b.isMain : c.branchId === 'branch_sub';
      });
    }
    return classes.filter((c) => {
      if (c.isDeleted) return false;
      if (c.branchId) return c.branchId === selectedBranchId;
      // If class has no explicit branchId, treat as main branch
      return currentBranch?.isMain;
    });
  }, [classes, selectedBranchId, currentBranch, branches]);

  const scopedClassIdSet = useMemo(() => {
    const set = new Set<string>();
    scopedClasses.forEach((c) => {
      set.add(c.id);
      if (c.code) set.add(c.code);
    });
    return set;
  }, [scopedClasses]);

  // Scoped Assignments based on Branch and Effective Semester
  const scopedAssignments = useMemo(() => {
    if (selectedBranchId === 'ALL') return effectiveAssignments.filter((a) => !a.isDeleted);
    return effectiveAssignments.filter((a) => {
      if (a.isDeleted) return false;
      if (a.type === 'TEACHING') {
        return a.classId ? scopedClassIdSet.has(a.classId) : false;
      }
      // For duties: check if teacher is stationed in this branch
      const t = localTeachers.find((tch) => tch.id === a.teacherId);
      if (!t) return false;
      if (selectedBranchId === 'ALL_SUB') {
        const b = branches.find((br) => br.id === t.workplaceId);
        return (b && !b.isMain) || t.workplace === 'Phân hiệu' || t.workplaceId === 'branch_sub';
      }
      if (t.workplaceId === selectedBranchId) return true;
      if (t.workplace === currentBranch?.name) return true;
      return currentBranch?.isMain && (!t.workplaceId || t.workplace === 'Điểm chính' || t.workplace === 'Toàn trường');
    });
  }, [effectiveAssignments, selectedBranchId, scopedClassIdSet, localTeachers, currentBranch, branches]);

  // Scoped Teachers based on Branch
  const scopedTeachers = useMemo(() => {
    if (selectedBranchId === 'ALL') return localTeachers.filter((t) => !t.isDeleted);
    const activeTchs = localTeachers.filter((t) => !t.isDeleted);
    const teacherIdsTeachingInBranch = new Set(
      effectiveAssignments
        .filter((a) => !a.isDeleted && a.type === 'TEACHING' && a.classId && scopedClassIdSet.has(a.classId))
        .map((a) => a.teacherId)
    );

    if (selectedBranchId === 'ALL_SUB') {
      return activeTchs.filter((t) => {
        const b = branches.find((br) => br.id === t.workplaceId);
        return (
          (b && !b.isMain) ||
          t.workplace === 'Phân hiệu' ||
          t.workplaceId === 'branch_sub' ||
          teacherIdsTeachingInBranch.has(t.id)
        );
      });
    }

    return activeTchs.filter((t) => {
      return (
        t.workplaceId === selectedBranchId ||
        t.workplace === currentBranch?.name ||
        teacherIdsTeachingInBranch.has(t.id) ||
        (currentBranch?.isMain && (!t.workplaceId || t.workplace === 'Toàn trường' || t.workplace === 'Điểm chính'))
      );
    });
  }, [localTeachers, selectedBranchId, effectiveAssignments, scopedClassIdSet, currentBranch, branches]);

  // Teacher Map
  const teacherMap = useMemo(() => new Map(localTeachers.map((t) => [t.id, t])), [localTeachers]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // Department & Abbreviation Maps
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const [activeAbbrRules, setActiveAbbrRules] = useState(() => dataStore.getAbbreviationRules());

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setActiveAbbrRules(dataStore.getAbbreviationRules());
    });
    return () => unsub();
  }, []);

  // Recalculate teacher workload calculations strictly respecting assigned standardQuota and cycle multiplier
  const scopedCalculations: TeacherCalculationResult[] = useMemo(() => {
    const mult = timeCycleConfig.multiplier;
    const semWeeks = semesterId === 'HK1' ? 18 : 17;
    return scopedTeachers.map((t) => {
      const baseCalc = calculateTeacherWorkload(
        t,
        scopedAssignments,
        duties,
        deptMap,
        semWeeks,
        activeAbbrRules
      );

      const morningScaled = baseCalc.morningPeriods * mult;
      const afternoonScaled = baseCalc.afternoonPeriods * mult;
      const activityScaled = baseCalc.activityPeriods * mult;
      const concurrentScaled = baseCalc.concurrentPeriods * mult;
      const exemptionScaled = baseCalc.exemptionPeriods * mult;
      const actualTotalScaled = baseCalc.actualTotalAssigned * mult;
      const totalCalculatedScaled = baseCalc.totalCalculated * mult;
      const quotaScaled = baseCalc.quota * mult;
      const diff = totalCalculatedScaled - quotaScaled;

      let resultStatus: 'EXACT' | 'EXACT_EXEMPT' | 'SURPLUS' | 'DEFICIT' | 'UNASSIGNED' = baseCalc.resultStatus;
      if (actualTotalScaled === 0 && exemptionScaled === 0) {
        resultStatus = 'UNASSIGNED';
      } else if (t.status === 'MATERNITY' || (actualTotalScaled === 0 && exemptionScaled >= quotaScaled)) {
        resultStatus = 'EXACT_EXEMPT';
      } else if (diff === 0) {
        resultStatus = exemptionScaled > 0 ? 'EXACT_EXEMPT' : 'EXACT';
      } else if (diff > 0) {
        resultStatus = 'SURPLUS';
      } else {
        resultStatus = 'DEFICIT';
      }

      const statusLabel =
        resultStatus === 'EXACT'
          ? 'ĐỦ ĐỊNH MỨC'
          : resultStatus === 'EXACT_EXEMPT'
          ? 'ĐỦ (MIỄN)'
          : resultStatus === 'DEFICIT'
          ? `THIẾU ${Math.abs(diff)} TIẾT`
          : resultStatus === 'SURPLUS'
          ? `THỪA +${diff} TIẾT`
          : 'CHƯA PHÂN CÔNG';

      const dept = departments.find((d) => d.id === t.departmentId);

      return {
        ...baseCalc,
        teacherId: t.id,
        teacherCode: t.code,
        teacherName: t.fullName,
        departmentId: t.departmentId || '',
        departmentName: dept?.name || dept?.fullName || baseCalc.departmentName || 'Chuyên môn',
        status: t.status,
        statusLabel,
        morningPeriods: morningScaled,
        afternoonPeriods: afternoonScaled,
        activityPeriods: activityScaled,
        concurrentPeriods: concurrentScaled,
        exemptionPeriods: exemptionScaled,
        actualTotalAssigned: actualTotalScaled,
        totalCalculated: totalCalculatedScaled,
        quota: quotaScaled,
        standardQuota: quotaScaled,
        difference: diff,
        resultStatus,
        surplusAmount: diff > 0 ? diff : 0,
        deficitAmount: diff < 0 ? Math.abs(diff) : 0,
        dutyLines: baseCalc.dutyLines,
        dutyText: baseCalc.dutyText,
        recommendation:
          diff === 0
            ? 'Đạt định mức cân đối hoàn hảo.'
            : diff > 0
            ? `Thừa ${diff} ${timeCycleConfig.unit}. Đề xuất chuyển bớt tiết hoặc tính vượt giờ.`
            : `Thiếu ${Math.abs(diff)} ${timeCycleConfig.unit}. Đề xuất bổ sung môn kiêm nhiệm hoặc lớp trống.`,
      };
    });
  }, [scopedTeachers, scopedAssignments, duties, deptMap, semesterId, activeAbbrRules, timeCycleConfig, departments]);

  // Department Scoping Logic
  const currentDepartment = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return null;
    return departments.find((d) => d.id === selectedDepartmentId) || null;
  }, [departments, selectedDepartmentId]);

  const departmentScopeName = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return 'Tất cả các Tổ';
    return currentDepartment?.fullName || currentDepartment?.name || 'Tổ chuyên môn';
  }, [selectedDepartmentId, currentDepartment]);

  // Count teachers per department within the currently selected branch scope
  const departmentTeacherCounts = useMemo(() => {
    const map = new Map<string, number>();
    departments.forEach((dept) => {
      const count = scopedTeachers.filter((t) => t.departmentId === dept.id).length;
      map.set(dept.id, count);
    });
    return map;
  }, [departments, scopedTeachers]);

  // Teachers filtered by selected Department
  const deptScopedTeachers = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return scopedTeachers;
    return scopedTeachers.filter((t) => t.departmentId === selectedDepartmentId);
  }, [scopedTeachers, selectedDepartmentId]);

  const deptTeacherIdSet = useMemo(() => {
    return new Set(deptScopedTeachers.map((t) => t.id));
  }, [deptScopedTeachers]);

  // Workload calculations filtered by Department
  const deptScopedCalculations = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return scopedCalculations;
    return scopedCalculations.filter(
      (c) => c.departmentId === selectedDepartmentId || deptTeacherIdSet.has(c.teacherId)
    );
  }, [scopedCalculations, selectedDepartmentId, deptTeacherIdSet]);

  // Assignments filtered by Department
  const deptScopedAssignments = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return scopedAssignments;
    return scopedAssignments.filter((a) => deptTeacherIdSet.has(a.teacherId));
  }, [scopedAssignments, selectedDepartmentId, deptTeacherIdSet]);

  // Subjects belonging to Department
  const deptScopedSubjects = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return subjects;
    return subjects.filter((s) => s.departmentId === selectedDepartmentId);
  }, [subjects, selectedDepartmentId]);

  // Overall KPI calculation for the selected scope, department & time cycle
  const schoolKpi = useMemo(() => {
    const activeCalcs = selectedDepartmentId === 'ALL' ? scopedCalculations : deptScopedCalculations;
    const activeTchs = selectedDepartmentId === 'ALL' ? scopedTeachers : deptScopedTeachers;
    const totalTeachers = activeTchs.length;
    const totalClasses = scopedClasses.length;
    const totalStudents = scopedClasses.reduce((s, c) => s + (c.studentCount || 0), 0);
    const totalQuota = activeCalcs.reduce((s, c) => s + (c.quota || 0), 0);
    const totalMorningPeriods = activeCalcs.reduce((s, c) => s + (c.morningPeriods || 0), 0);
    const totalAfternoonPeriods = activeCalcs.reduce((s, c) => s + (c.afternoonPeriods || 0), 0);
    const totalConcurrentPeriods = activeCalcs.reduce((s, c) => s + (c.concurrentPeriods || 0), 0);
    const totalExemptionPeriods = activeCalcs.reduce((s, c) => s + (c.exemptionPeriods || 0), 0);
    const totalActualAssignedPeriods = activeCalcs.reduce((s, c) => s + (c.actualTotalAssigned || 0), 0);
    const totalCalculatedPeriods = activeCalcs.reduce((s, c) => s + (c.totalCalculated || 0), 0);
    const difference = totalCalculatedPeriods - totalQuota;

    return {
      totalTeachers,
      totalClasses,
      totalStudents,
      totalQuota,
      totalMorningPeriods,
      totalAfternoonPeriods,
      totalConcurrentPeriods,
      totalExemptionPeriods,
      totalActualAssignedPeriods,
      totalCalculatedPeriods,
      difference,
    };
  }, [scopedTeachers, scopedClasses, scopedCalculations, selectedDepartmentId, deptScopedCalculations, deptScopedTeachers]);

  // Map Data for all Specialized Reports
  // Notice: scopedCalculations are already multiplied by timeCycleConfig.multiplier, so we pass multiplier = 1 to generators that accept calculations
  const deptReports = useMemo(
    () =>
      generateReportByDepartment(
        selectedDepartmentId === 'ALL' ? departments : departments.filter((d) => d.id === selectedDepartmentId),
        scopedCalculations,
        1
      ),
    [departments, scopedCalculations, selectedDepartmentId]
  );

  const classReports = useMemo(
    () => generateReportByClass(scopedClasses, scopedAssignments, subjects, scopedTeachers, timeCycleConfig.multiplier),
    [scopedClasses, scopedAssignments, subjects, scopedTeachers, timeCycleConfig.multiplier]
  );

  const subjectGradeReports = useMemo(
    () =>
      generateReportBySubjectGrade(
        selectedDepartmentId === 'ALL' ? subjects : deptScopedSubjects,
        curriculums,
        scopedAssignments,
        scopedClasses,
        timeCycleConfig.multiplier
      ),
    [subjects, deptScopedSubjects, curriculums, scopedAssignments, scopedClasses, timeCycleConfig.multiplier, selectedDepartmentId]
  );

  const dutyReports = useMemo(
    () =>
      generateReportByDuties(
        duties,
        scopedAssignments,
        deptScopedTeachers,
        timeCycleConfig.multiplier
      ),
    [duties, scopedAssignments, deptScopedTeachers, timeCycleConfig.multiplier]
  );

  const subjectReports = useMemo(
    () =>
      generateReportBySubject(
        selectedDepartmentId === 'ALL' ? subjects : deptScopedSubjects,
        curriculums,
        scopedAssignments,
        scopedClasses,
        scopedTeachers,
        timeCycleConfig.multiplier
      ),
    [subjects, deptScopedSubjects, curriculums, scopedAssignments, scopedClasses, scopedTeachers, timeCycleConfig.multiplier, selectedDepartmentId]
  );

  const sessionReports = useMemo(
    () => generateReportBySession(scopedClasses, scopedAssignments, scopedTeachers, timeCycleConfig.multiplier),
    [scopedClasses, scopedAssignments, scopedTeachers, timeCycleConfig.multiplier]
  );

  const gradeReports = useMemo(
    () => generateReportByGrade(scopedClasses, scopedAssignments, curriculums, subjects, timeCycleConfig.multiplier),
    [scopedClasses, scopedAssignments, curriculums, subjects, timeCycleConfig.multiplier]
  );

  const teacherStructureReports = useMemo(
    () =>
      generateReportTeacherStructure(
        deptScopedTeachers,
        selectedDepartmentId === 'ALL' ? departments : departments.filter((d) => d.id === selectedDepartmentId),
        deptScopedCalculations,
        1
      ),
    [deptScopedTeachers, departments, deptScopedCalculations, selectedDepartmentId]
  );

  // Check results for Report 11
  const classSubjectResults = useMemo(() => {
    const mult = timeCycleConfig.multiplier;
    const results: any[] = [];
    const activeSubjects = selectedDepartmentId === 'ALL' ? subjects : deptScopedSubjects;

    scopedClasses.forEach((cls) => {
      activeSubjects.forEach((subj) => {
        if (!subj.applicableGrades.includes(cls.grade)) return;
        const curr = curriculums.find(
          (c) => c.grade === cls.grade && (c.subjectId === subj.id || c.subjectId === subj.code)
        );
        const standard = (curr ? curr.periodsPerWeek : 0) * mult;
        if (standard === 0) return;

        const classSubjAssignments = scopedAssignments.filter(
          (a) =>
            !a.isDeleted &&
            a.type === 'TEACHING' &&
            (a.classId === cls.id || a.classId === cls.code) &&
            (a.subjectId === subj.id || a.subjectId === subj.code)
        );
        const assignedPeriods = classSubjAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * mult;
        const diff = assignedPeriods - standard;

        let status = 'OK';
        if (assignedPeriods === 0) status = 'MISSING';
        else if (diff < 0) status = 'DEFICIT';
        else if (diff > 0) status = 'SURPLUS';

        results.push({
          classId: cls.id,
          className: cls.name,
          grade: cls.grade,
          subjectId: subj.id,
          subjectName: subj.name,
          standardPeriodsPerWeek: standard,
          assignedPeriodsPerWeek: assignedPeriods,
          difference: diff,
          status,
          assignedTeachers: classSubjAssignments.map((a) => {
            const t = teacherMap.get(a.teacherId);
            return {
              teacherName: t ? t.fullName : 'N/A',
              periodsPerWeek: (a.periodsPerWeek || 0) * mult,
            };
          }),
        });
      });
    });

    return results;
  }, [scopedClasses, subjects, deptScopedSubjects, selectedDepartmentId, curriculums, scopedAssignments, timeCycleConfig.multiplier, teacherMap]);

  // Selected teacher for Report 2
  const activeReport2Teacher = useMemo(() => {
    const list = deptScopedTeachers.length > 0 ? deptScopedTeachers : scopedTeachers;
    if (selectedTeacherForReport2) {
      const found = list.find((t) => t.id === selectedTeacherForReport2);
      if (found) return found;
    }
    return list[0] || null;
  }, [deptScopedTeachers, scopedTeachers, selectedTeacherForReport2]);

  const activeReport2Calc = useMemo(() => {
    if (!activeReport2Teacher) return null;
    return deptScopedCalculations.find((c) => c.teacherId === activeReport2Teacher.id) || null;
  }, [activeReport2Teacher, deptScopedCalculations]);

  const activeReport2Assignments = useMemo(() => {
    if (!activeReport2Teacher) return [];
    return deptScopedAssignments.filter((a) => a.teacherId === activeReport2Teacher.id);
  }, [activeReport2Teacher, deptScopedAssignments]);

  // Report 4: Expand/Collapse states for Class Reports
  const [report4ViewMode, setReport4ViewMode] = useState<'COMPACT' | 'EXPANDED'>('COMPACT');
  const [report4ExpandedClassIds, setReport4ExpandedClassIds] = useState<Set<string>>(new Set());
  const [report4SearchTerm, setReport4SearchTerm] = useState<string>('');
  const [report4SelectedGrade, setReport4SelectedGrade] = useState<'ALL' | 6 | 7 | 8 | 9>('ALL');

  const toggleExpandClass = (classId: string) => {
    setReport4ExpandedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  };

  const handleExpandAllClasses = () => {
    setReport4ViewMode('EXPANDED');
    setReport4ExpandedClassIds(new Set(filteredClassReports.map((c) => c.id)));
  };

  const handleCollapseAllClasses = () => {
    setReport4ViewMode('COMPACT');
    setReport4ExpandedClassIds(new Set());
  };

  // Grade counts for Report 4 navigation filter
  const report4GradeCounts = useMemo(() => {
    const counts: { ALL: number; 6: number; 7: number; 8: number; 9: number } = {
      ALL: classReports.length,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
    };
    classReports.forEach((c) => {
      let g = c.grade;
      if (!g) {
        if (c.group?.includes('6') || c.name?.startsWith('6')) g = 6;
        else if (c.group?.includes('7') || c.name?.startsWith('7')) g = 7;
        else if (c.group?.includes('8') || c.name?.startsWith('8')) g = 8;
        else if (c.group?.includes('9') || c.name?.startsWith('9')) g = 9;
      }
      if (g === 6 || g === 7 || g === 8 || g === 9) {
        counts[g]++;
      }
    });
    return counts;
  }, [classReports]);

  const filteredClassReports = useMemo(() => {
    return classReports.filter((c) => {
      // 1. Lọc theo khối (Khối 6, 7, 8, 9)
      if (report4SelectedGrade !== 'ALL') {
        let g = c.grade;
        if (!g) {
          if (c.group?.includes('6') || c.name?.startsWith('6')) g = 6;
          else if (c.group?.includes('7') || c.name?.startsWith('7')) g = 7;
          else if (c.group?.includes('8') || c.name?.startsWith('8')) g = 8;
          else if (c.group?.includes('9') || c.name?.startsWith('9')) g = 9;
        }
        if (g !== report4SelectedGrade) return false;
      }

      // 2. Tìm kiếm từ khóa
      if (!report4SearchTerm.trim()) return true;
      const term = report4SearchTerm.trim().toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.secondaryName && c.secondaryName.toLowerCase().includes(term)) ||
        (c.details &&
          c.details.some(
            (d: any) =>
              d.subjectName?.toLowerCase().includes(term) ||
              d.teacherName?.toLowerCase().includes(term)
          ))
      );
    });
  }, [classReports, report4SelectedGrade, report4SearchTerm]);

  // Totals for Report 4 (By Class) - helping cross-check assigned periods with standard curriculum quota
  const classReportTotals = useMemo(() => {
    const list = filteredClassReports;
    const mult = timeCycleConfig.multiplier;
    const totalAssignments = list.reduce((sum, c) => sum + (c.count || 0), 0);
    const totalMorning = list.reduce((sum, c) => sum + (c.morningPeriods || 0), 0);
    const totalAfternoon = list.reduce((sum, c) => sum + (c.afternoonPeriods || 0), 0);
    const totalActual = list.reduce((sum, c) => sum + (c.totalPeriods || 0), 0);

    // Calculate total standard curriculum quota required for the filtered classes
    let totalStandardQuota = 0;
    list.forEach((cls) => {
      const classGradeCurriculums = curriculums.filter((curr) => curr.grade === (cls as any).grade);
      if (classGradeCurriculums.length > 0) {
        const gradeStandard = classGradeCurriculums.reduce((s, curr) => s + (curr.periodsPerWeek || 0), 0) * mult;
        totalStandardQuota += gradeStandard;
      } else {
        // Fallback if class grade not directly on cls object: find from scopedClasses
        const origCls = scopedClasses.find((sc) => sc.id === cls.id || sc.code === cls.id);
        if (origCls) {
          const gCurrs = curriculums.filter((curr) => curr.grade === origCls.grade);
          const gStandard = gCurrs.reduce((s, curr) => s + (curr.periodsPerWeek || 0), 0) * mult;
          totalStandardQuota += gStandard;
        }
      }
    });

    const diff = totalActual - totalStandardQuota;

    return {
      classesCount: list.length,
      totalAssignments,
      totalMorning,
      totalAfternoon,
      totalActual,
      totalStandardQuota,
      diff,
    };
  }, [filteredClassReports, curriculums, scopedClasses, timeCycleConfig.multiplier]);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const analyticsReportContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const getAnalyticsReportContentHtml = () => {
    const el = analyticsReportContainerRef.current || document.getElementById('analytics-printable-report');
    if (!el) return '';

    // Khi in Báo cáo 4 (hoặc xem trước trong PrintPreviewModal), bung ra 100% tất cả môn học của mọi lớp
    if (selectedReportId === 4) {
      const clone = el.cloneNode(true) as HTMLElement;
      // Bung toàn bộ các môn học đang bị ẩn ở dạng rút gọn với display: block / inline-block
      clone.querySelectorAll('.report4-extra-subject').forEach((node) => {
        (node as HTMLElement).style.display = 'block';
        node.classList.remove('hidden');
      });
      // Loại bỏ các nút tương tác "+X môn khác" và "Thu gọn" trong bản in
      clone.querySelectorAll('.report4-toggle-btn').forEach((node) => {
        node.remove();
      });
      return clone.innerHTML;
    }

    return el.innerHTML;
  };

  const handleExcelExport = () => {
    if (onExportExcel) {
      onExportExcel({
        branchScopeName,
        departmentScopeName: selectedDepartmentId === 'ALL' ? undefined : departmentScopeName,
        timeCycleName: timeCycleConfig.name,
        periodMultiplier: timeCycleConfig.multiplier,
        filteredCalculations: deptScopedCalculations,
        filteredAssignments: deptScopedAssignments,
        filteredClasses: scopedClasses,
        filteredTeachers: deptScopedTeachers,
      });
    }
  };

  // Header Titles & Authorities from Software Configuration
  const authorityText = currentSchool.authorityName ? currentSchool.authorityName.toUpperCase() : 'CƠ QUAN QUẢN LÝ';
  const schoolText = currentSchool.schoolName ? currentSchool.schoolName.toUpperCase() : 'TRƯỜNG THCS';

  return (
    <div className="space-y-4 pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP TOOLBAR: REPORT SELECTOR, BRANCH SCOPING & TIME CYCLE */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 print:hidden">
        {/* Row 1: Report Selection & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <label htmlFor="report-select-dropdown" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Chọn biểu mẫu báo cáo (15 Mẫu chuyên biệt):
            </label>
            <div className="relative">
              <select
                id="report-select-dropdown"
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 text-xs sm:text-sm rounded-2xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
              >
                {reportList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={() => setIsTeachingPlanModalOpen(true)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 text-xs font-bold px-3.5 py-2.5 rounded-2xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Xem Khung Kế hoạch Dạy học & Tổng hợp số tiết toàn trường"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              <span>Khung KH Dạy học</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-2xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>In báo cáo</span>
            </button>
            <button
              id="btn-report-export-excel"
              onClick={handleExcelExport}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-100" />
              <span>Xuất file Excel</span>
            </button>
          </div>
        </div>

        {/* Row 2: BỘ LỌC TUẦN TỰ THEO QUY CHUẨN:
            Bước 1: Chọn Điểm trường (Toàn trường, Điểm chính, Phân hiệu)
            Bước 2: Chọn Tổ chuyên môn (Tất cả hoặc từng Tổ)
            Bước 3: Chọn Thời gian (Học kỳ & Chu kỳ tính định mức) */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3.5 items-start">
          {/* CỘT 1: BƯỚC 1 - CHỌN ĐIỂM TRƯỜNG */}
          <div className="xl:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center text-[11px] font-black">
                  1
                </span>
                Điểm trường:
              </span>
              <span className="text-[10.5px] font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {selectedBranchId === 'ALL'
                  ? 'Toàn trường'
                  : selectedBranchId === (mainBranch?.id || 'branch_main')
                  ? 'Điểm chính'
                  : 'Phân hiệu'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Nút 1: Toàn trường */}
              <button
                type="button"
                onClick={() => setSelectedBranchId('ALL')}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedBranchId === 'ALL'
                    ? 'bg-blue-900 border-blue-950 text-white shadow-xs ring-2 ring-blue-600/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 font-black text-[11px]">
                  <School className={`w-3.5 h-3.5 ${selectedBranchId === 'ALL' ? 'text-blue-300' : 'text-blue-700'}`} />
                  <span>Toàn trường</span>
                </div>
                <div
                  className={`text-[10px] mt-1 font-medium ${
                    selectedBranchId === 'ALL' ? 'text-blue-200' : 'text-slate-500'
                  }`}
                >
                  {counts.totalTeachers} GV
                </div>
              </button>

              {/* Nút 2: Điểm chính */}
              <button
                type="button"
                onClick={() => setSelectedBranchId(mainBranch?.id || 'branch_main')}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedBranchId === (mainBranch?.id || 'branch_main')
                    ? 'bg-blue-900 border-blue-950 text-white shadow-xs ring-2 ring-blue-600/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 font-black text-[11px]">
                  <Building2
                    className={`w-3.5 h-3.5 ${
                      selectedBranchId === (mainBranch?.id || 'branch_main') ? 'text-indigo-300' : 'text-indigo-700'
                    }`}
                  />
                  <span>Điểm chính</span>
                </div>
                <div
                  className={`text-[10px] mt-1 font-medium ${
                    selectedBranchId === (mainBranch?.id || 'branch_main') ? 'text-blue-200' : 'text-slate-500'
                  }`}
                >
                  {counts.mainTeachersCount} GV
                </div>
              </button>

              {/* Nút 3: Phân hiệu */}
              <button
                type="button"
                onClick={() => {
                  if (subBranches.length === 1) {
                    setSelectedBranchId(subBranches[0].id);
                  } else if (subBranches.length > 1) {
                    setSelectedBranchId('ALL_SUB');
                  } else {
                    setSelectedBranchId('branch_sub');
                  }
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedBranchId === 'ALL_SUB' ||
                  selectedBranchId === 'branch_sub' ||
                  subBranches.some((b) => b.id === selectedBranchId)
                    ? 'bg-blue-900 border-blue-950 text-white shadow-xs ring-2 ring-blue-600/30'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 font-black text-[11px]">
                  <MapPin
                    className={`w-3.5 h-3.5 ${
                      selectedBranchId === 'ALL_SUB' ||
                      selectedBranchId === 'branch_sub' ||
                      subBranches.some((b) => b.id === selectedBranchId)
                        ? 'text-emerald-300'
                        : 'text-emerald-700'
                    }`}
                  />
                  <span>Phân hiệu</span>
                </div>
                <div
                  className={`text-[10px] mt-1 font-medium ${
                    selectedBranchId === 'ALL_SUB' ||
                    selectedBranchId === 'branch_sub' ||
                    subBranches.some((b) => b.id === selectedBranchId)
                      ? 'text-blue-200'
                      : 'text-slate-500'
                  }`}
                >
                  {counts.subTeachersCount} GV
                </div>
              </button>
            </div>

            {/* Sub-branch selector if there are multiple sub-branches */}
            {subBranches.length > 1 && (
              <div className="pt-0.5 flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-semibold">Chi tiết:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-xs rounded-lg px-2 py-0.5 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="ALL_SUB">Tất cả các Phân hiệu ({counts.subTeachersCount} GV)</option>
                  {subBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* CỘT 2: BƯỚC 2 - CHỌN TỔ CHUYÊN MÔN */}
          <div className="xl:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-black">
                  2
                </span>
                Tổ chuyên môn:
              </span>
              <span className="text-[10.5px] font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 truncate max-w-[130px]">
                {departmentScopeName}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Users className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700" />
                <select
                  id="department-select-filter"
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-900 text-xs rounded-xl pl-8 pr-3 py-2 focus:ring-2 focus:ring-emerald-600 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Tất cả các Tổ ({scopedTeachers.length} GV)</option>
                  {departments.map((d) => {
                    const count = departmentTeacherCounts.get(d.id) || 0;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name || d.fullName} ({count} GV)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quick toggle chips */}
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedDepartmentId('ALL')}
                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedDepartmentId === 'ALL'
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả
                </button>
                {departments.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDepartmentId(d.id)}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedDepartmentId === d.id
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {(d.name || d.code || 'Tổ').replace('Tổ ', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT 3: BƯỚC 3 - CHỌN THỜI GIAN & CHU KỲ */}
          <div className="xl:col-span-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px] font-black">
                  3
                </span>
                Thời gian & Chu kỳ:
              </span>
              <span className="text-[10.5px] font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {selectedSemester === 'HK1' ? 'HK I' : selectedSemester === 'HK2' ? 'HK II' : 'Cả năm'} • {timeCycleConfig.shortLabel}
              </span>
            </div>

            <div className="space-y-1.5">
              {/* Lựa chọn Học kỳ */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedSemester('HK1')}
                  className={`py-1 px-1 rounded-lg font-bold text-[10.5px] transition text-center cursor-pointer ${
                    selectedSemester === 'HK1'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  HK I (18t)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSemester('HK2')}
                  className={`py-1 px-1 rounded-lg font-bold text-[10.5px] transition text-center cursor-pointer ${
                    selectedSemester === 'HK2'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  HK II (17t)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSemester('ALL_YEAR')}
                  className={`py-1 px-1 rounded-lg font-bold text-[10.5px] transition text-center cursor-pointer ${
                    selectedSemester === 'ALL_YEAR'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  Cả năm (35t)
                </button>
              </div>

              {/* Lựa chọn Chu kỳ tính định mức (Theo tuần, Theo tháng, Cả năm) */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {(
                  [
                    { id: 'WEEK', label: 'Theo tuần (1t)' },
                    { id: 'MONTH', label: 'Theo tháng (4t)' },
                    { id: 'YEAR', label: 'Cả năm (35t)' },
                  ] as const
                ).map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setSelectedTimeCycle(tc.id)}
                    className={`py-1 px-1 rounded-lg font-bold text-[10.5px] transition text-center cursor-pointer ${
                      selectedTimeCycle === tc.id
                        ? 'bg-amber-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Dòng tóm tắt trạng thái bộ lọc đang áp dụng */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium text-[11px]">Đang áp dụng:</span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold flex items-center gap-1.5 text-[11px]">
              <Building2 className="w-3.5 h-3.5 text-blue-700" />
              {branchScopeName}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold flex items-center gap-1.5 text-[11px]">
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              {departmentScopeName}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold flex items-center gap-1.5 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              {selectedSemester === 'HK1' ? 'Học kỳ I' : selectedSemester === 'HK2' ? 'Học kỳ II' : 'Cả năm'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-indigo-700" />
              {timeCycleConfig.name} ({timeCycleConfig.unit})
            </span>
          </div>

          <div className="text-slate-500 text-[11px] font-medium">
            Phạm vi báo cáo: <strong className="text-slate-800">{deptScopedTeachers.length}</strong> giáo viên •{' '}
            <strong className="text-slate-800">{scopedClasses.length}</strong> lớp học •{' '}
            <strong className="text-slate-800">{deptScopedAssignments.length}</strong> phân công
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REPORT VIEW / PRINTABLE CANVAS */}
      {/* ========================================================================= */}
      <div
        id="analytics-printable-report"
        ref={analyticsReportContainerRef}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-4 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0"
      >
        {/* OFFICIAL INSTITUTIONAL HEADER (Derived dynamically from School & Branch Configuration) */}
        <div className="border-b-2 border-slate-900 pb-5">
          <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-800">
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">{authorityText}</div>
              <div className="text-sm font-black text-slate-900 uppercase mt-0.5">{schoolText}</div>
              <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Phạm vi: <strong className="text-slate-900">{branchScopeName}</strong>
                </span>
              </div>
            </div>

            <div className="text-right space-y-0.5">
              <div className="font-bold text-slate-900 uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="text-[11px] text-slate-600 italic">Độc lập – Tự do – Hạnh phúc</div>
              <div className="text-[11px] text-slate-500 pt-1">
                Năm học {currentSchool.schoolYear || '2026–2027'} • {selectedSemester === 'HK1' ? 'Học kỳ I' : selectedSemester === 'HK2' ? 'Học kỳ II' : 'Cả năm học'}
              </div>
            </div>
          </div>

          <div className="text-center mt-6">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
              {reportList.find((r) => r.id === selectedReportId)?.name}
            </h3>
            <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-2 px-3.5 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-700 border border-slate-200">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                Điểm trường: <strong className="text-slate-900">{branchScopeName}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                Tổ CM: <strong className="text-slate-900">{departmentScopeName}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                Thời gian: <strong className="text-slate-900">{selectedSemester === 'HK1' ? 'Học kỳ I' : selectedSemester === 'HK2' ? 'Học kỳ II' : 'Cả năm học'}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-700" />
                Chu kỳ: <strong className="text-slate-900">{timeCycleConfig.name}</strong>
              </span>
              <span>•</span>
              <span>Định mức: <strong className="text-blue-900">{timeCycleConfig.unit}</strong></span>
              <span>•</span>
              <span>Ngày lập: <strong>{new Date().toLocaleDateString('vi-VN')}</strong></span>
            </div>
          </div>
        </div>

        {/* DYNAMIC CONTENT AREA BASED ON SELECTED REPORT */}
        <div className="overflow-x-auto">
          {/* ========================================================================= */}
          {/* REPORT 1: Comprehensive School / Branch Workload Assignment Table */}
          {/* ========================================================================= */}
          {selectedReportId === 1 && (
            <div className="space-y-4">
              {/* Template Mode Switcher for Report 1 */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap items-center gap-2 max-w-2xl border border-slate-200 print:hidden">
                <button
                  type="button"
                  onClick={() => setReport1Template('OFFICIAL')}
                  className={`flex-1 min-w-[240px] py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    report1Template === 'OFFICIAL'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Báo cáo phân công chuyên môn TỔNG HỢP</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReport1Template('STANDARD')}
                  className={`flex-1 min-w-[220px] py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    report1Template === 'STANDARD'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Bảng phân tích Buổi & Cân đối định mức</span>
                </button>
              </div>

              {report1Template === 'OFFICIAL' ? (
                <OfficialAssignmentReportView
                  schoolInfo={currentSchool}
                  teachers={localTeachers}
                  departments={departments}
                  classes={classes}
                  subjects={subjects}
                  calculations={scopedCalculations}
                  assignments={assignments}
                  duties={duties}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  setSelectedBranchId={setSelectedBranchId}
                  selectedDepartmentId={selectedDepartmentId}
                  setSelectedDepartmentId={setSelectedDepartmentId}
                  selectedSemester={selectedSemester as 'HK1' | 'HK2' | 'ALL_YEAR'}
                  setSelectedSemester={(sem) => setSelectedSemester(sem)}
                  schoolYear={schoolYearId || currentSchool.schoolYear}
                  onUpdateTeacher={handleUpdateTeacher}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
                    <div className="flex items-center gap-2.5">
                      <span>
                        Hiển thị <strong className="text-slate-900">{deptScopedCalculations.length}</strong> giáo viên thuộc phạm vi{' '}
                        <strong className="text-slate-900">{branchScopeName}</strong> • <strong className="text-emerald-900">{departmentScopeName}</strong>
                      </span>
                      {selectedDepartmentId === 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setGroupByDepartment(!groupByDepartment)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition flex items-center gap-1 ${
                            groupByDepartment
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 shadow-xs'
                              : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Users className="w-3 h-3 text-emerald-700" />
                          <span>{groupByDepartment ? '✓ Đang gom theo Tổ' : 'Gom nhóm theo Tổ'}</span>
                        </button>
                      )}
                    </div>
                    <span className="font-mono text-blue-900 font-bold">
                      Đơn vị tính: {timeCycleConfig.unit}
                    </span>
                  </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                    <tr>
                    <th className="py-2.5 px-2 text-center w-10">STT</th>
                    <th className="py-2.5 px-3">Mã GV</th>
                    <th className="py-2.5 px-4">Họ và tên</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Điểm trường</th>
                    <th className="py-2.5 px-3">Tổ CM</th>
                    <th className="py-2.5 px-2 text-center">Buổi 1 (Sáng)</th>
                    <th className="py-2.5 px-2 text-center">Buổi 2 (Chiều)</th>
                    <th className="py-2.5 px-2 text-center">Kiêm nhiệm</th>
                    <th className="py-2.5 px-2 text-center">Miễn giảm</th>
                    <th className="py-2.5 px-2 text-center font-bold">Thực dạy</th>
                    <th className="py-2.5 px-2 text-center font-black text-blue-900">Tổng tính</th>
                    <th className="py-2.5 px-2 text-center">Định mức</th>
                    <th className="py-2.5 px-2 text-center font-bold">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-center">Kết luận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* If Grouped by Department when ALL departments are selected */}
                  {groupByDepartment && selectedDepartmentId === 'ALL' ? (
                    departments.map((dept) => {
                      const deptCalcs = deptScopedCalculations
                        .filter((c) => {
                          const t = teacherMap.get(c.teacherId);
                          return t?.departmentId === dept.id;
                        })
                        .filter((c) => {
                          if (!reportSearch.trim()) return true;
                          const q = reportSearch.toLowerCase().trim();
                          return (
                            c.teacherName.toLowerCase().includes(q) ||
                            c.teacherCode.toLowerCase().includes(q) ||
                            c.departmentName.toLowerCase().includes(q)
                          );
                        });

                      if (deptCalcs.length === 0) return null;

                      const deptMorning = deptCalcs.reduce((s, c) => s + c.morningPeriods, 0);
                      const deptAfternoon = deptCalcs.reduce((s, c) => s + c.afternoonPeriods, 0);
                      const deptConcurrent = deptCalcs.reduce((s, c) => s + c.concurrentPeriods, 0);
                      const deptExemption = deptCalcs.reduce((s, c) => s + c.exemptionPeriods, 0);
                      const deptActualAssigned = deptCalcs.reduce((s, c) => s + c.actualTotalAssigned, 0);
                      const deptTotalCalc = deptCalcs.reduce((s, c) => s + c.totalCalculated, 0);
                      const deptQuota = deptCalcs.reduce((s, c) => s + c.quota, 0);
                      const deptDiff = deptTotalCalc - deptQuota;

                      return (
                        <React.Fragment key={dept.id}>
                          {/* Department Section Header */}
                          <tr className="bg-emerald-50/80 border-t-2 border-emerald-200">
                            <td colSpan={15} className="py-2 px-3">
                              <div className="flex items-center justify-between font-bold text-emerald-950">
                                <span className="flex items-center gap-2 text-xs uppercase tracking-wide">
                                  <Users className="w-4 h-4 text-emerald-800" />
                                  <span>{dept.name || dept.fullName}</span>
                                  <span className="text-[11px] font-normal text-emerald-700">({deptCalcs.length} giáo viên)</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedDepartmentId(dept.id)}
                                  className="text-[10px] text-emerald-800 hover:text-emerald-950 underline font-semibold cursor-pointer"
                                >
                                  Lọc chỉ xem Tổ này →
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Teachers in this Department */}
                          {deptCalcs.map((c, i) => {
                            const tObj = teacherMap.get(c.teacherId);
                            return (
                              <tr key={c.teacherId} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-2 text-center text-slate-400 font-medium">{i + 1}</td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-600">{c.teacherCode}</td>
                                <td className="py-2 px-4 font-bold text-slate-900">{c.teacherName}</td>
                                <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{tObj?.email || '-'}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-700">
                                    <Building2 className="w-2.5 h-2.5" />
                                    <span>{tObj?.workplace || 'Điểm chính'}</span>
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 font-medium">{c.departmentName}</td>
                                <td className="py-2 px-2 text-center font-medium">{c.morningPeriods}</td>
                                <td className="py-2 px-2 text-center font-medium">{c.afternoonPeriods}</td>
                                <td className="py-2 px-2 text-center font-medium">{c.concurrentPeriods}</td>
                                <td className="py-2 px-2 text-center font-medium">{c.exemptionPeriods}</td>
                                <td className="py-2 px-2 text-center font-bold text-slate-900">{c.actualTotalAssigned}</td>
                                <td className="py-2 px-2 text-center font-black text-blue-900 bg-blue-50/40">{c.totalCalculated}</td>
                                <td className="py-2 px-2 text-center text-slate-600 font-bold">{c.quota}</td>
                                <td
                                  className={`py-2 px-2 text-center font-black ${
                                    c.difference > 0
                                      ? 'text-orange-700'
                                      : c.difference < 0
                                      ? 'text-red-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {c.difference > 0 ? `+${c.difference}` : c.difference}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block min-w-[70px] ${
                                      c.resultStatus === 'EXACT'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : c.resultStatus === 'EXACT_EXEMPT'
                                        ? 'bg-blue-100 text-blue-800'
                                        : c.resultStatus === 'DEFICIT'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-orange-100 text-orange-800'
                                    }`}
                                  >
                                    {c.resultStatus === 'EXACT'
                                      ? 'ĐỦ'
                                      : c.resultStatus === 'EXACT_EXEMPT'
                                      ? 'ĐỦ (MIỄN)'
                                      : c.resultStatus === 'DEFICIT'
                                      ? `THIẾU ${c.deficitAmount}`
                                      : `THỪA +${c.surplusAmount}`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}

                          {/* Subtotal row for this department */}
                          <tr className="bg-emerald-50/40 font-bold text-slate-800 border-b border-emerald-200 text-[11px]">
                            <td colSpan={6} className="py-2 px-3 text-right text-emerald-900 uppercase font-black">
                              Cộng {dept.name || dept.fullName}:
                            </td>
                            <td className="py-2 px-2 text-center">{deptMorning}</td>
                            <td className="py-2 px-2 text-center">{deptAfternoon}</td>
                            <td className="py-2 px-2 text-center">{deptConcurrent}</td>
                            <td className="py-2 px-2 text-center">{deptExemption}</td>
                            <td className="py-2 px-2 text-center">{deptActualAssigned}</td>
                            <td className="py-2 px-2 text-center font-black text-blue-900">{deptTotalCalc}</td>
                            <td className="py-2 px-2 text-center font-bold text-slate-700">{deptQuota}</td>
                            <td className="py-2 px-2 text-center font-black text-purple-900">
                              {deptDiff > 0 ? `+${deptDiff}` : deptDiff}
                            </td>
                            <td className="py-2 px-3 text-center text-[10px] font-bold">
                              {deptDiff === 0 ? 'Cân đối' : deptDiff > 0 ? `Dư +${deptDiff}` : `Thiếu ${Math.abs(deptDiff)}`}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  ) : (
                    /* Flat list (when specific department selected or grouping turned off) */
                    deptScopedCalculations
                      .filter((c) => {
                        if (!reportSearch.trim()) return true;
                        const q = reportSearch.toLowerCase().trim();
                        return (
                          c.teacherName.toLowerCase().includes(q) ||
                          c.teacherCode.toLowerCase().includes(q) ||
                          c.departmentName.toLowerCase().includes(q)
                        );
                      })
                      .map((c, i) => {
                        const tObj = teacherMap.get(c.teacherId);
                        return (
                          <tr key={c.teacherId} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-2 text-center text-slate-400 font-medium">{i + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{c.teacherCode}</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">{c.teacherName}</td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{tObj?.email || '-'}</td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-700">
                                <Building2 className="w-2.5 h-2.5" />
                                <span>{tObj?.workplace || 'Điểm chính'}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">{c.departmentName}</td>
                            <td className="py-2.5 px-2 text-center font-medium">{c.morningPeriods}</td>
                            <td className="py-2.5 px-2 text-center font-medium">{c.afternoonPeriods}</td>
                            <td className="py-2.5 px-2 text-center font-medium">{c.concurrentPeriods}</td>
                            <td className="py-2.5 px-2 text-center font-medium">{c.exemptionPeriods}</td>
                            <td className="py-2.5 px-2 text-center font-bold text-slate-900">{c.actualTotalAssigned}</td>
                            <td className="py-2.5 px-2 text-center font-black text-blue-900 bg-blue-50/40">{c.totalCalculated}</td>
                            <td className="py-2.5 px-2 text-center text-slate-600 font-bold">{c.quota}</td>
                            <td
                              className={`py-2.5 px-2 text-center font-black ${
                                c.difference > 0
                                  ? 'text-orange-700'
                                  : c.difference < 0
                                  ? 'text-red-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {c.difference > 0 ? `+${c.difference}` : c.difference}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block min-w-[70px] ${
                                  c.resultStatus === 'EXACT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : c.resultStatus === 'EXACT_EXEMPT'
                                    ? 'bg-blue-100 text-blue-800'
                                    : c.resultStatus === 'DEFICIT'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-orange-100 text-orange-800'
                                }`}
                              >
                                {c.resultStatus === 'EXACT'
                                  ? 'ĐỦ'
                                  : c.resultStatus === 'EXACT_EXEMPT'
                                  ? 'ĐỦ (MIỄN)'
                                  : c.resultStatus === 'DEFICIT'
                                  ? `THIẾU ${c.deficitAmount}`
                                  : `THỪA +${c.surplusAmount}`}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                  {/* Summary row */}
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={6} className="py-3 px-3 text-center uppercase tracking-wider">
                      TỔNG CỘNG ({selectedDepartmentId === 'ALL' ? branchDisplayName : `${departmentScopeName.toUpperCase()} – ${branchDisplayName}`})
                    </td>
                    <td className="py-3 px-2 text-center">{schoolKpi.totalMorningPeriods}</td>
                    <td className="py-3 px-2 text-center">{schoolKpi.totalAfternoonPeriods}</td>
                    <td className="py-3 px-2 text-center">{schoolKpi.totalConcurrentPeriods}</td>
                    <td className="py-3 px-2 text-center">{schoolKpi.totalExemptionPeriods}</td>
                    <td className="py-3 px-2 text-center font-black">{schoolKpi.totalActualAssignedPeriods}</td>
                    <td className="py-3 px-2 text-center text-blue-900 font-black">{schoolKpi.totalCalculatedPeriods}</td>
                    <td className="py-3 px-2 text-center text-slate-700 font-black">{schoolKpi.totalQuota}</td>
                    <td className="py-3 px-2 text-center font-black text-purple-900">
                      {schoolKpi.difference > 0 ? `+${schoolKpi.difference}` : schoolKpi.difference}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] font-bold text-slate-700">
                        {schoolKpi.difference === 0
                          ? 'CÂN ĐỐI'
                          : schoolKpi.difference > 0
                          ? `DƯ +${schoolKpi.difference}`
                          : `THIẾU ${Math.abs(schoolKpi.difference)}`}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

          {/* ========================================================================= */}
          {/* REPORT 2: Individual Teacher Workload & Quota Detail Slip */}
          {/* ========================================================================= */}
          {selectedReportId === 2 && (
            <div className="space-y-5">
              {/* Teacher Selector with Search */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 print:hidden space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 w-full sm:w-auto">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Chọn giáo viên để lập phiếu phân công chi tiết:
                      </label>
                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Phạm vi: {departmentScopeName} ({deptScopedTeachers.length} GV)
                      </span>
                    </div>
                    <div className="w-full">
                      <SearchableTeacherSelect
                        teachers={deptScopedTeachers}
                        value={activeReport2Teacher?.id || ''}
                        onChange={(id) => setSelectedTeacherForReport2(id)}
                        placeholder="-- Gõ tên hoặc mã GV để tìm nhanh... --"
                        allowClear={false}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Teacher Assignment Sheet Card */}
              {activeReport2Teacher && activeReport2Calc && (
                <div className="space-y-4">
                  {/* Teacher Profile Card */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Họ và tên giáo viên:</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">{activeReport2Teacher.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Mã GV: {activeReport2Teacher.code}
                        {activeReport2Teacher.email && (
                          <span className="ml-2 font-normal text-blue-700 font-mono">
                            • {activeReport2Teacher.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Chuyên môn & Đơn vị:</div>
                      <div className="font-bold text-slate-800 mt-0.5">
                        {(() => {
                          const dept = departments.find((d) => d.id === activeReport2Teacher.departmentId);
                          const name = dept?.name || dept?.fullName || 'Chuyên môn';
                          return name.startsWith('Tổ') ? name : `Tổ ${name}`;
                        })()}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Điểm trường: <strong>{activeReport2Teacher.workplace || 'Điểm trường chính'}</strong>
                        {activeReport2Teacher.major && ` • Chuyên ngành: ${activeReport2Teacher.major}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Định mức quy định & Trạng thái:</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        Định mức chuẩn: <span className="text-blue-900 font-black">{activeReport2Teacher.standardQuota || (activeReport2Teacher.workplace === 'Phân hiệu' ? 18 : 19)} tiết/tuần</span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            activeReport2Calc.resultStatus === 'EXACT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : activeReport2Calc.resultStatus === 'EXACT_EXEMPT'
                              ? 'bg-blue-100 text-blue-800'
                              : activeReport2Calc.resultStatus === 'DEFICIT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {activeReport2Calc.statusLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 6 Key Performance Indicators for This Teacher */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-blue-700 uppercase">Buổi 1 (Sáng)</div>
                      <div className="text-lg font-black text-blue-950 mt-0.5">{activeReport2Calc.morningPeriods}</div>
                      <div className="text-[10px] text-blue-600">{timeCycleConfig.unit}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-amber-700 uppercase">Buổi 2 (Chiều)</div>
                      <div className="text-lg font-black text-amber-950 mt-0.5">{activeReport2Calc.afternoonPeriods}</div>
                      <div className="text-[10px] text-amber-600">{timeCycleConfig.unit}</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-purple-700 uppercase">Kiêm nhiệm</div>
                      <div className="text-lg font-black text-purple-950 mt-0.5">{activeReport2Calc.concurrentPeriods}</div>
                      <div className="text-[10px] text-purple-600">{timeCycleConfig.unit}</div>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-teal-700 uppercase">Miễn giảm</div>
                      <div className="text-lg font-black text-teal-950 mt-0.5">{activeReport2Calc.exemptionPeriods}</div>
                      <div className="text-[10px] text-teal-600">{timeCycleConfig.unit}</div>
                    </div>
                    <div className="bg-blue-900 border border-blue-900 text-white rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-slate-300 uppercase">Tổng tính</div>
                      <div className="text-lg font-black text-white mt-0.5">{activeReport2Calc.totalCalculated}</div>
                      <div className="text-[10px] text-slate-300">{timeCycleConfig.unit}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase">Định mức kỳ này</div>
                      <div className="text-lg font-black text-emerald-950 mt-0.5">{activeReport2Calc.quota}</div>
                      <div className="text-[10px] font-bold text-emerald-700">
                        {activeReport2Calc.difference > 0
                          ? `Thừa +${activeReport2Calc.difference}`
                          : activeReport2Calc.difference < 0
                          ? `Thiếu ${activeReport2Calc.difference}`
                          : 'Đạt chuẩn 100%'}
                      </div>
                    </div>
                  </div>

                  {/* Table of Teaching Assignments */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-900" />
                      <span>1. Chi tiết phân công giảng dạy các lớp ({timeCycleConfig.name}):</span>
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                      <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                        <tr>
                          <th className="py-2 px-3 text-center w-10">STT</th>
                          <th className="py-2 px-3">Lớp học</th>
                          <th className="py-2 px-3">Khối</th>
                          <th className="py-2 px-3">Môn học</th>
                          <th className="py-2 px-3 text-center">Buổi học</th>
                          <th className="py-2 px-3 text-center">Tiết/tuần</th>
                          <th className="py-2 px-3 text-center font-bold text-blue-900">
                            Quy đổi ({timeCycleConfig.shortLabel})
                          </th>
                          <th className="py-2 px-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeReport2Assignments
                          .filter((a) => a.type === 'TEACHING')
                          .map((a, idx) => {
                            const cls = classes.find((c) => c.id === a.classId || c.code === a.classId);
                            const subj = subjects.find((s) => s.id === a.subjectId || s.code === a.subjectId);
                            const scaled = (a.periodsPerWeek || 0) * timeCycleConfig.multiplier;
                            return (
                              <tr key={a.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{cls?.name || a.classId}</td>
                                <td className="py-2.5 px-3 font-medium">Khối {cls?.grade || '-'}</td>
                                <td className="py-2.5 px-3 font-bold text-blue-900">{subj?.name || a.subjectId}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {cls?.session === 'AFTERNOON' ? 'Buổi Chiều' : 'Buổi Sáng'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium">{a.periodsPerWeek}</td>
                                <td className="py-2.5 px-3 text-center font-black text-blue-900">{scaled}</td>
                                <td className="py-2.5 px-3 text-slate-500">{a.notes || '-'}</td>
                              </tr>
                            );
                          })}
                        {activeReport2Assignments.filter((a) => a.type === 'TEACHING').length === 0 && (
                          <tr>
                            <td colSpan={8} className="py-4 text-center text-slate-400 italic">
                              Chưa có phân công giảng dạy văn hóa
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>

                  {/* Table of Concurrent Duties & Exemptions */}
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-purple-900" />
                      <span>2. Nhiệm vụ kiêm nhiệm & Miễn giảm tiết dạy:</span>
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                      <table className="w-full text-left text-xs text-slate-700 border-collapse">
                      <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                        <tr>
                          <th className="py-2 px-3 text-center w-10">STT</th>
                          <th className="py-2 px-4">Tên nhiệm vụ / Miễn giảm</th>
                          <th className="py-2 px-3">Phân loại</th>
                          <th className="py-2 px-3 text-center">Tiết/tuần</th>
                          <th className="py-2 px-3 text-center font-bold text-purple-900">
                            Quy đổi ({timeCycleConfig.shortLabel})
                          </th>
                          <th className="py-2 px-4">Căn cứ / Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const dutyRows: Array<{
                            id: string;
                            name: string;
                            isExemption: boolean;
                            weeklyPeriods: number;
                            notes: string;
                          }> = [];

                          activeReport2Assignments
                            .filter((a) => a.type === 'CONCURRENT_DUTY' || a.type === 'CONCURRENT' || a.type === 'EXEMPTION')
                            .forEach((a) => {
                              const dObj = duties.find((d) => d.id === a.dutyId || d.code === a.dutyId);
                              const isExemption =
                                a.type === 'EXEMPTION' ||
                                dObj?.type === 'EXEMPTION' ||
                                (dObj?.periodsPerWeekExempted !== undefined && dObj.periodsPerWeekExempted > 0);
                              const weeklyPeriods =
                                a.periodsPerWeek > 0
                                  ? a.periodsPerWeek
                                  : isExemption
                                  ? dObj?.periodsPerWeekExempted || 0
                                  : dObj?.periodsPerWeekCalculated || 0;

                              dutyRows.push({
                                id: a.id,
                                name: dObj?.name || a.dutyName || (isExemption ? 'Miễn giảm tiết dạy' : 'Nhiệm vụ kiêm nhiệm'),
                                isExemption,
                                weeklyPeriods,
                                notes: dObj?.notes || a.notes || (isExemption ? 'Quy định định mức miễn giảm' : 'Phân công kiêm nhiệm'),
                              });
                            });

                          // If teacher has status exemption and no explicit duty row was added
                          if (activeReport2Teacher?.status === 'MATERNITY' && !dutyRows.some((r) => r.isExemption)) {
                            const q = activeReport2Teacher.standardQuota || 19;
                            dutyRows.push({
                              id: 'status_maternity',
                              name: 'Nghỉ chế độ thai sản (Miễn 100% định mức)',
                              isExemption: true,
                              weeklyPeriods: q,
                              notes: 'Chế độ thai sản theo quy định hiện hành (Bộ luật Lao động & Thông tư 28/2009/TT-BGDĐT)',
                            });
                          } else if (activeReport2Teacher?.status === 'PRINCIPAL' && !dutyRows.some((r) => r.isExemption)) {
                            const q = activeReport2Teacher.standardQuota || 19;
                            dutyRows.push({
                              id: 'status_principal',
                              name: 'Hiệu trưởng (Định mức giảng dạy 2 tiết/tuần)',
                              isExemption: true,
                              weeklyPeriods: Math.max(0, q - 2),
                              notes: 'Định mức lãnh đạo theo Thông tư 28/2009/TT-BGDĐT & Thông tư 15/2020/TT-BGDĐT',
                            });
                          } else if (activeReport2Teacher?.status === 'VICE_PRINCIPAL' && !dutyRows.some((r) => r.isExemption)) {
                            const q = activeReport2Teacher.standardQuota || 19;
                            dutyRows.push({
                              id: 'status_vice_principal',
                              name: 'Phó Hiệu trưởng (Định mức giảng dạy 4 tiết/tuần)',
                              isExemption: true,
                              weeklyPeriods: Math.max(0, q - 4),
                              notes: 'Định mức lãnh đạo theo Thông tư 28/2009/TT-BGDĐT & Thông tư 15/2020/TT-BGDĐT',
                            });
                          }

                          if (dutyRows.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                                  Không có nhiệm vụ kiêm nhiệm hoặc miễn giảm tiết
                                </td>
                              </tr>
                            );
                          }

                          return dutyRows.map((r, idx) => {
                            const scaled = r.weeklyPeriods * timeCycleConfig.multiplier;
                            return (
                              <tr key={r.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                <td className="py-2.5 px-4 font-bold text-slate-900">{r.name}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      r.isExemption ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'
                                    }`}
                                  >
                                    {r.isExemption ? 'Miễn giảm' : 'Kiêm nhiệm'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium">{r.weeklyPeriods}</td>
                                <td className="py-2.5 px-3 text-center font-black text-purple-900 bg-purple-50/50">{scaled}</td>
                                <td className="py-2.5 px-4 text-slate-500">{r.notes}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 3: By Department */}
          {/* ========================================================================= */}
          {selectedReportId === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Phạm vi: <strong className="text-slate-900">{departmentScopeName}</strong> •{' '}
                  <strong className="text-slate-900">{branchScopeName}</strong>
                </span>
                {selectedDepartmentId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedDepartmentId('ALL')}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                  >
                    ← Xem tổng hợp tất cả các Tổ
                  </button>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-4">Tổ chuyên môn</th>
                    <th className="py-2.5 px-3 text-center">Số GV</th>
                    <th className="py-2.5 px-3 text-center">Buổi 1 (Sáng)</th>
                    <th className="py-2.5 px-3 text-center">Buổi 2 (Chiều)</th>
                    <th className="py-2.5 px-3 text-center">Kiêm nhiệm</th>
                    <th className="py-2.5 px-3 text-center">Miễn giảm</th>
                    <th className="py-2.5 px-3 text-center font-black text-blue-900">Tổng tính ({timeCycleConfig.shortLabel})</th>
                    <th className="py-2.5 px-3 text-center">Tổng ĐM</th>
                    <th className="py-2.5 px-3 text-center font-bold">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-center w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptReports.map((d, i) => (
                    <tr key={d.id} className="hover:bg-slate-50 font-medium">
                      <td className="py-3 px-3 text-center text-slate-400">{i + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedDepartmentId(d.id)}
                          className="hover:text-blue-700 hover:underline text-left cursor-pointer font-bold"
                          title="Bấm để lọc theo tổ này"
                        >
                          {d.name}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{d.count} GV</td>
                      <td className="py-3 px-3 text-center">{d.morningPeriods}</td>
                      <td className="py-3 px-3 text-center">{d.afternoonPeriods}</td>
                      <td className="py-3 px-3 text-center">{d.concurrentPeriods}</td>
                      <td className="py-3 px-3 text-center">{d.exemptionPeriods}</td>
                      <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{d.totalPeriods}</td>
                      <td className="py-3 px-3 text-center text-slate-600 font-bold">{d.quota}</td>
                      <td
                        className={`py-3 px-3 text-center font-bold ${
                          (d.difference || 0) > 0
                            ? 'text-orange-700'
                            : (d.difference || 0) < 0
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {(d.difference || 0) > 0 ? `+${d.difference}` : d.difference}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDepartmentId(d.id)}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200 transition cursor-pointer"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Summary row */}
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={2} className="py-3 px-4 text-center uppercase tracking-wider">
                      TỔNG CỘNG ({selectedDepartmentId === 'ALL' ? branchDisplayName : `${departmentScopeName.toUpperCase()} – ${branchDisplayName}`})
                    </td>
                    <td className="py-3 px-3 text-center">{schoolKpi.totalTeachers} GV</td>
                    <td className="py-3 px-3 text-center">{schoolKpi.totalMorningPeriods}</td>
                    <td className="py-3 px-3 text-center">{schoolKpi.totalAfternoonPeriods}</td>
                    <td className="py-3 px-3 text-center">{schoolKpi.totalConcurrentPeriods}</td>
                    <td className="py-3 px-3 text-center">{schoolKpi.totalExemptionPeriods}</td>
                    <td className="py-3 px-3 text-center font-black text-blue-900 text-sm">{schoolKpi.totalCalculatedPeriods}</td>
                    <td className="py-3 px-3 text-center text-slate-700 font-black">{schoolKpi.totalQuota}</td>
                    <td className="py-3 px-3 text-center font-black text-purple-900 text-sm">
                      {schoolKpi.difference > 0 ? `+${schoolKpi.difference}` : schoolKpi.difference}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] font-bold text-slate-600">
                        {schoolKpi.difference === 0 ? 'Cân đối' : schoolKpi.difference > 0 ? `Dư +${schoolKpi.difference}` : `Thiếu ${Math.abs(schoolKpi.difference)}`}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              {/* Detailed Teacher Roster for this Department or all departments */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-700" />
                    <span>
                      Danh sách chi tiết định mức giáo viên {selectedDepartmentId === 'ALL' ? 'toàn trường' : `thuộc ${departmentScopeName}`} ({deptScopedCalculations.length} giáo viên):
                    </span>
                  </h4>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-10">STT</th>
                      <th className="py-2.5 px-3">Mã GV</th>
                      <th className="py-2.5 px-4">Họ và tên</th>
                      <th className="py-2.5 px-3">Tổ CM</th>
                      <th className="py-2.5 px-2 text-center">Buổi 1 (Sáng)</th>
                      <th className="py-2.5 px-2 text-center">Buổi 2 (Chiều)</th>
                      <th className="py-2.5 px-2 text-center">Kiêm nhiệm</th>
                      <th className="py-2.5 px-2 text-center">Miễn giảm</th>
                      <th className="py-2.5 px-2 text-center font-black text-blue-900">Tổng tính</th>
                      <th className="py-2.5 px-2 text-center">Định mức</th>
                      <th className="py-2.5 px-2 text-center font-bold">Chênh lệch</th>
                      <th className="py-2.5 px-3 text-center">Kết luận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deptScopedCalculations.map((c, i) => (
                      <tr key={c.teacherId} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-2 text-center text-slate-400 font-medium">{i + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-600">{c.teacherCode}</td>
                        <td className="py-2 px-4 font-bold text-slate-900">{c.teacherName}</td>
                        <td className="py-2 px-3 text-slate-600">{c.departmentName}</td>
                        <td className="py-2 px-2 text-center">{c.morningPeriods}</td>
                        <td className="py-2 px-2 text-center">{c.afternoonPeriods}</td>
                        <td className="py-2 px-2 text-center">{c.concurrentPeriods}</td>
                        <td className="py-2 px-2 text-center">{c.exemptionPeriods}</td>
                        <td className="py-2 px-2 text-center font-black text-blue-900 bg-blue-50/40">{c.totalCalculated}</td>
                        <td className="py-2 px-2 text-center text-slate-600 font-bold">{c.quota}</td>
                        <td
                          className={`py-2 px-2 text-center font-black ${
                            c.difference > 0
                              ? 'text-orange-700'
                              : c.difference < 0
                              ? 'text-red-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {c.difference > 0 ? `+${c.difference}` : c.difference}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block min-w-[65px] ${
                              c.resultStatus === 'EXACT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.resultStatus === 'EXACT_EXEMPT'
                                ? 'bg-blue-100 text-blue-800'
                                : c.resultStatus === 'DEFICIT'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {c.resultStatus === 'EXACT'
                              ? 'ĐỦ'
                              : c.resultStatus === 'EXACT_EXEMPT'
                              ? 'ĐỦ (MIỄN)'
                              : c.resultStatus === 'DEFICIT'
                              ? `THIẾU ${c.deficitAmount}`
                              : `THỪA +${c.surplusAmount}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 4: By Class */}
          {/* ========================================================================= */}
          {selectedReportId === 4 && (
            <div className="space-y-3.5">
              {/* Thanh điều hướng lọc danh sách lớp học theo khối (Khối 6, 7, 8, 9) */}
              <div className="bg-white border border-slate-200 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 print:hidden shadow-2xs">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1 pl-1">
                    <GraduationCap className="w-4 h-4 text-blue-700" />
                    Lọc theo khối:
                  </span>
                  <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200/80 gap-1">
                    {[
                      { id: 'ALL' as const, label: 'Tất cả khối', count: report4GradeCounts.ALL },
                      { id: 6 as const, label: 'Khối 6', count: report4GradeCounts[6] },
                      { id: 7 as const, label: 'Khối 7', count: report4GradeCounts[7] },
                      { id: 8 as const, label: 'Khối 8', count: report4GradeCounts[8] },
                      { id: 9 as const, label: 'Khối 9', count: report4GradeCounts[9] },
                    ].map((tab) => {
                      const isActive = report4SelectedGrade === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setReport4SelectedGrade(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-blue-900 text-white shadow-xs'
                              : 'text-slate-600 hover:text-blue-900 hover:bg-slate-200/70'
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                              isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Trạng thái hiển thị */}
                <div className="flex items-center gap-2 text-xs text-slate-600 pr-1">
                  <span>Đang xem:</span>
                  <span className="font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                    {report4SelectedGrade === 'ALL' ? 'Toàn trường' : `Khối ${report4SelectedGrade}`} ({filteredClassReports.length}/{classReports.length} lớp)
                  </span>
                  {report4SelectedGrade !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setReport4SelectedGrade('ALL')}
                      className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                    >
                      Bỏ lọc khối
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Toolbar for Report 4 (hidden on print) */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden shadow-2xs">
                {/* Left: View Mode Switches */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
                    <BookOpen className="w-4 h-4 text-blue-700" />
                    Chế độ xem môn học:
                  </span>
                  <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 border border-slate-300/70">
                    <button
                      type="button"
                      onClick={handleCollapseAllClasses}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        report4ViewMode === 'COMPACT' && report4ExpandedClassIds.size === 0
                          ? 'bg-white text-blue-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Hiển thị dạng rút gọn (mỗi lớp 6 môn đầu, bấm '+X môn khác' để bung ra từng lớp)"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Dạng rút gọn</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExpandAllClasses}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        report4ViewMode === 'EXPANDED' || report4ExpandedClassIds.size === filteredClassReports.length
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Bung ra xem toàn bộ tất cả các môn học của các lớp đang hiển thị"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Bung ra toàn bộ</span>
                    </button>
                  </div>

                  {/* Quick Expand / Collapse All Buttons */}
                  <button
                    type="button"
                    onClick={handleExpandAllClasses}
                    className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    title="Bung ra toàn bộ danh sách môn của tất cả các lớp đang chọn"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-blue-700" />
                    <span>Bung tất cả ({filteredClassReports.length} lớp)</span>
                  </button>

                  {(report4ExpandedClassIds.size > 0 || report4ViewMode === 'EXPANDED') && (
                    <button
                      type="button"
                      onClick={handleCollapseAllClasses}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      title="Thu gọn lại tất cả các lớp về dạng rút gọn"
                    >
                      <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      <span>Thu gọn tất cả</span>
                    </button>
                  )}
                </div>

                {/* Right: Search Filter & Notice */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={report4SearchTerm}
                      onChange={(e) => setReport4SearchTerm(e.target.value)}
                      placeholder="Tìm lớp, môn, giáo viên..."
                      className="pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 w-52"
                    />
                    {report4SearchTerm && (
                      <button
                        type="button"
                        onClick={() => setReport4SearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 hidden xl:flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bản in / Xuất báo cáo tự động bung ra <strong>100% môn học</strong></span>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center align-middle w-12 border border-slate-200">TT</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[80px]">Lớp học</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[140px]">Điểm trường & Ca học</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[90px]">Số phân công</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[70px]">Buổi 1 (Sáng)</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[70px]">Buổi 2 (Chiều)</th>
                      <th className="py-2.5 px-3 text-center align-middle font-bold text-blue-900 border border-slate-200 min-w-[80px]">
                        Tổng tiết ({timeCycleConfig.shortLabel})
                      </th>
                      <th className="py-2.5 px-4 text-center align-middle border border-slate-200 min-w-[360px]">
                        <div className="flex items-center justify-center relative">
                          <span>Môn & Giáo viên phân công</span>
                          <span className="text-[10px] font-normal lowercase text-slate-500 normal-case absolute right-0 print:hidden hidden sm:inline">
                            (Bấm '+X môn khác' để bung ra)
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClassReports.map((c, i) => {
                      const isExpanded = report4ViewMode === 'EXPANDED' || report4ExpandedClassIds.has(c.id);
                      const details = c.details || [];
                      const hasMany = details.length > 6;

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-medium border border-slate-200">{i + 1}</td>
                          <td className="py-3 px-3 font-bold text-slate-900 border border-slate-200 text-sm">{c.name}</td>
                          <td className="py-3 px-3 text-slate-600 border border-slate-200">{c.secondaryName}</td>
                          <td className="py-3 px-3 text-center font-medium border border-slate-200">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold text-[11px]">
                              {c.count} môn
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center border border-slate-200">{c.morningPeriods}</td>
                          <td className="py-3 px-3 text-center border border-slate-200">{c.afternoonPeriods}</td>
                          <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40 border border-slate-200 text-sm">
                            {c.totalPeriods}
                          </td>
                          <td className="py-3 px-4 text-slate-700 border border-slate-200">
                            {details.length === 0 ? (
                              <span className="text-slate-400 italic text-xs">Chưa có phân công môn học</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {details.map((d: any, idx: number) => {
                                  const isExtra = idx >= 6;
                                  const isShown = !isExtra || isExpanded;
                                  return (
                                    <span
                                      key={idx}
                                      className={`${
                                        isExtra
                                          ? 'report4-extra-subject bg-blue-50/70 border-blue-200 text-slate-800'
                                          : 'bg-slate-100 border-slate-200 text-slate-800'
                                      } text-[11px] px-2 py-0.5 rounded-md font-medium items-center gap-1 border transition-colors ${
                                        isShown ? 'inline-flex print:inline-block' : 'hidden print:block'
                                      }`}
                                    >
                                      <span className="text-slate-600 font-semibold">{d.subjectName}:</span>
                                      <strong className="text-blue-950 font-bold">{d.teacherName}</strong>
                                      <span className="text-slate-500 font-mono text-[10px]">({d.periodsPerWeek}t)</span>
                                    </span>
                                  );
                                })}

                                {hasMany && !isExpanded && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandClass(c.id);
                                    }}
                                    className="report4-toggle-btn inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 hover:text-amber-950 text-[11px] font-bold px-2.5 py-0.5 rounded-md border border-amber-300 cursor-pointer transition shadow-2xs print:hidden no-print"
                                    title={`Bấm để bung ra xem toàn bộ ${details.length} môn học của lớp ${c.name}`}
                                  >
                                    <span>+{details.length - 6} môn khác (Bấm xem tất cả {details.length} môn)</span>
                                    <ChevronDown className="w-3.5 h-3.5 text-amber-700" />
                                  </button>
                                )}

                                {hasMany && isExpanded && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandClass(c.id);
                                    }}
                                    className="report4-toggle-btn inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-300 cursor-pointer transition shadow-2xs print:hidden no-print"
                                    title={`Thu gọn danh sách môn học của lớp ${c.name}`}
                                  >
                                    <span>Thu gọn</span>
                                    <ChevronUp className="w-3 h-3 text-slate-500" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Hàng Tổng số tiết cuối bảng để đối soát với định mức */}
                  <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <tr className="border-b border-slate-300 text-xs">
                      <td colSpan={3} className="py-3 px-3 text-center uppercase tracking-wider font-black text-slate-900 border border-slate-300">
                        TỔNG CỘNG ({classReportTotals.classesCount} LỚP{report4SelectedGrade !== 'ALL' ? ` - KHỐI ${report4SelectedGrade}` : ''})
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black">
                        {classReportTotals.totalAssignments} lượt
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-bold">
                        {classReportTotals.totalMorning}
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-bold">
                        {classReportTotals.totalAfternoon}
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black text-blue-900 text-sm bg-blue-100/60">
                        {classReportTotals.totalActual}
                      </td>
                      <td className="py-3 px-4 border border-slate-300 text-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-medium">Định mức khung CT:</span>
                            <strong className="text-slate-900 font-bold">{classReportTotals.totalStandardQuota} tiết</strong>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-600 font-medium">Chênh lệch:</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black ${
                                classReportTotals.diff === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : classReportTotals.diff > 0
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {classReportTotals.diff === 0
                                ? '✓ CÂN ĐỐI (100%)'
                                : classReportTotals.diff > 0
                                ? `+${classReportTotals.diff} tiết (DƯ)`
                                : `${classReportTotals.diff} tiết (THIẾU)`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 italic hidden lg:inline">
                            Tổng số tiết dạy của {report4SelectedGrade !== 'ALL' ? `khối ${report4SelectedGrade}` : 'cả'} {classReportTotals.classesCount} lớp
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 5: By Grade (Khối 6, 7, 8, 9) */}
          {/* ========================================================================= */}
          {selectedReportId === 5 && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-4">Khối lớp</th>
                  <th className="py-2.5 px-4">Danh sách lớp</th>
                  <th className="py-2.5 px-3 text-center">Số lớp</th>
                  <th className="py-2.5 px-3 text-center">Tổng học sinh</th>
                  <th className="py-2.5 px-3 text-center">Khung CT ({timeCycleConfig.shortLabel}/lớp)</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tổng tiết cần</th>
                  <th className="py-2.5 px-3 text-center font-bold text-blue-900">Tổng tiết đã gán</th>
                  <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                  <th className="py-2.5 px-3 text-center">Tỷ lệ đáp ứng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeReports.map((g, i) => (
                  <tr key={g.grade} className="hover:bg-slate-50 font-medium">
                    <td className="py-3 px-3 text-center text-slate-400">{i + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">{g.gradeName}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">{g.classesList}</td>
                    <td className="py-3 px-3 text-center font-bold">{g.classesCount} lớp</td>
                    <td className="py-3 px-3 text-center">{g.studentCount} HS</td>
                    <td className="py-3 px-3 text-center">{g.standardPerWeekPerClass} {timeCycleConfig.unit}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{g.totalRequiredPeriods}</td>
                    <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{g.totalAssignedPeriods}</td>
                    <td className="py-3 px-3 text-center font-bold">
                      {g.difference > 0 ? `+${g.difference}` : g.difference}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          g.completionRate >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {g.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ========================================================================= */}
          {/* REPORT 6: By Subject */}
          {/* ========================================================================= */}
          {selectedReportId === 6 && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-3">Mã môn</th>
                  <th className="py-2.5 px-4">Tên môn học</th>
                  <th className="py-2.5 px-3">Nhóm môn</th>
                  <th className="py-2.5 px-3 text-center">Khối áp dụng</th>
                  <th className="py-2.5 px-3 text-center">Số lớp có tiết</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tiết cần ({timeCycleConfig.shortLabel})</th>
                  <th className="py-2.5 px-3 text-center font-bold text-blue-900">Đã gán ({timeCycleConfig.shortLabel})</th>
                  <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-4">Giáo viên phụ trách giảng dạy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectReports.map((s, i) => (
                  <tr key={s.subjectId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-600">{s.code}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 px-3 text-slate-500">{s.group}</td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      {s.applicableGrades.map((g: number) => `K${g}`).join(', ')}
                    </td>
                    <td className="py-3 px-3 text-center font-medium">{s.assignedClasses} lớp</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{s.totalRequired}</td>
                    <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{s.totalAssigned}</td>
                    <td className="py-3 px-3 text-center font-bold">
                      {s.difference > 0 ? `+${s.difference}` : s.difference}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          s.status === 'OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'SURPLUS'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.status === 'OK' ? 'ĐỦ TIẾT' : s.status === 'SURPLUS' ? 'THỪA TIẾT' : 'THIẾU TIẾT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {s.teachers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.teachers.map((t: any, idx: number) => (
                            <span key={idx} className="bg-blue-50 text-blue-900 text-[10px] px-2 py-0.5 rounded border border-blue-200">
                              {t.teacherName}: <strong>{t.periods}t</strong> ({t.classCount} lớp)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-red-500 italic text-[11px]">Chưa phân công giáo viên</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ========================================================================= */}
          {/* REPORT 7: By Session */}
          {/* ========================================================================= */}
          {selectedReportId === 7 && (
            <div className="space-y-4">
              {/* Highlight callout for 2 buổi / ngày (Cả ngày) */}
              {(() => {
                const fullDayReport = sessionReports.find((r) => r.sessionKey === 'FULL_DAY');
                const fullDayTeachers = fullDayReport?.teachers || [];
                const mainFullDayTeacher = fullDayTeachers[0];

                if (fullDayTeachers.length > 0 && mainFullDayTeacher) {
                  return (
                    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-200/90 text-amber-900 flex items-center justify-center flex-shrink-0 font-black text-lg shadow-2xs">
                            <SunMoon className="w-5 h-5 text-amber-900" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-amber-200 text-amber-950 font-black text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                                💡 Phát hiện {fullDayTeachers.length} Giáo viên dạy 2 buổi / ngày (Cả ngày)
                              </span>
                              <span className="text-xs text-amber-800 font-semibold">
                                Vừa dạy ca Sáng (Khối 6, 7) vừa dạy ca Chiều (Khối 8, 9)
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-amber-900 bg-white border border-amber-300 px-2 py-0.5 rounded text-xs">
                                {mainFullDayTeacher.code}
                              </span>
                              <strong className="text-slate-900 text-base font-bold">
                                {mainFullDayTeacher.fullName}
                              </strong>
                              <span className="text-slate-600 text-xs">
                                ({mainFullDayTeacher.departmentName || 'Tổ Ngoại ngữ'})
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-amber-900 text-xs font-bold bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded">
                                {mainFullDayTeacher.notes || `Sáng: ${mainFullDayTeacher.morningPeriods}t + Chiều: ${mainFullDayTeacher.afternoonPeriods}t`}
                              </span>
                              <span className="text-slate-500 text-xs">
                                (Lớp: {mainFullDayTeacher.classNames.join(', ') || '7A9, 7A10, 8A7, 8A8'})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReportId(2);
                              setSelectedTeacherForReport2(mainFullDayTeacher.id);
                            }}
                            className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
                            title={`Chuyển đến Báo cáo 2 để xem toàn bộ định mức và thời khóa biểu của ${mainFullDayTeacher.fullName}`}
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Tìm nhanh: Xem chi tiết {mainFullDayTeacher.fullName}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Quick Filter Bar and Search */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" />
                    Lọc ca:
                  </span>
                  {[
                    { id: 'ALL', label: `Tất cả (${sessionReports.length} ca)` },
                    { id: 'MORNING', label: `Ca Sáng (${sessionReports.find((r) => r.sessionKey === 'MORNING')?.teacherCount || 0} GV)` },
                    { id: 'AFTERNOON', label: `Ca Chiều (${sessionReports.find((r) => r.sessionKey === 'AFTERNOON')?.teacherCount || 0} GV)` },
                    {
                      id: 'FULL_DAY',
                      label: `⭐ 2 buổi/ngày (${sessionReports.find((r) => r.sessionKey === 'FULL_DAY')?.teacherCount || 0} GV)`,
                    },
                    { id: 'ACTIVITY', label: `Hoạt động & Kiêm nhiệm (${sessionReports.find((r) => r.sessionKey === 'ACTIVITY')?.teacherCount || 0} GV)` },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setSessionFilterForReport7(btn.id as any)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        sessionFilterForReport7 === btn.id
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={sessionSearchForReport7}
                      onChange={(e) => setSessionSearchForReport7(e.target.value)}
                      placeholder="Tìm nhanh GV (vd: Hạnh, GV005...)"
                      className="w-full pl-8 pr-7 py-1 text-xs rounded-xl bg-white border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-800"
                    />
                    {sessionSearchForReport7 && (
                      <button
                        type="button"
                        onClick={() => setSessionSearchForReport7('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (expandedSessionKeys.size >= sessionReports.length) {
                        setExpandedSessionKeys(new Set());
                      } else {
                        setExpandedSessionKeys(new Set(sessionReports.map((r) => r.sessionKey)));
                      }
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-slate-300 px-2.5 py-1 rounded-xl cursor-pointer hover:bg-slate-100 flex-shrink-0"
                  >
                    {expandedSessionKeys.size >= sessionReports.length ? 'Thu gọn tất cả' : 'Bung tất cả'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center align-middle w-12 border border-slate-200">TT</th>
                      <th className="py-2.5 px-4 text-center align-middle border border-slate-200 min-w-[170px]">Buổi học / Ca tổ chức</th>
                      <th className="py-2.5 px-4 text-center align-middle border border-slate-200 min-w-[180px]">Mô tả đối tượng</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[80px]">Số lớp</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[80px]">Tổng HS</th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[80px]">Số lượt PC</th>
                      <th className="py-2.5 px-3 text-center align-middle font-bold text-blue-900 border border-slate-200 min-w-[90px]">
                        Tổng tiết ({timeCycleConfig.shortLabel})
                      </th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[90px]">Số GV</th>
                      <th className="py-2.5 px-4 text-center align-middle border border-slate-200 min-w-[340px]">
                        Giáo viên phân công & Tìm kiếm
                      </th>
                      <th className="py-2.5 px-3 text-center align-middle border border-slate-200 min-w-[110px] print:hidden">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const filteredReports = sessionReports
                        .filter((sess) => {
                          if (sessionFilterForReport7 !== 'ALL') {
                            return sess.sessionKey === sessionFilterForReport7;
                          }
                          return true;
                        })
                        .filter((sess) => {
                          if (!sessionSearchForReport7.trim()) return true;
                          const q = sessionSearchForReport7.toLowerCase().trim();
                          const matchName = sess.sessionName.toLowerCase().includes(q);
                          const matchTeacher = sess.teachers?.some(
                            (t) =>
                              t.fullName.toLowerCase().includes(q) ||
                              t.code.toLowerCase().includes(q) ||
                              t.classNames.some((c) => c.toLowerCase().includes(q))
                          );
                          return matchName || matchTeacher;
                        });

                      if (filteredReports.length === 0) {
                        return (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                              Không tìm thấy buổi học hoặc giáo viên nào phù hợp với từ khóa tìm kiếm "{sessionSearchForReport7}"
                            </td>
                          </tr>
                        );
                      }

                      return filteredReports.map((sess, i) => {
                        const isExpanded = expandedSessionKeys.has(sess.sessionKey);
                        const isFullDay = sess.sessionKey === 'FULL_DAY';
                        const teachersList = sess.teachers || [];

                        return (
                          <React.Fragment key={sess.sessionKey}>
                            <tr
                              className={`transition-colors ${
                                isFullDay
                                  ? 'bg-amber-50/50 hover:bg-amber-50/80 font-medium'
                                  : 'hover:bg-slate-50 font-medium'
                              }`}
                            >
                              <td className="py-3.5 px-3 text-center text-slate-400 border border-slate-200">{i + 1}</td>
                              <td className="py-3.5 px-4 border border-slate-200">
                                <div className="flex items-center gap-1.5">
                                  {isFullDay ? (
                                    <SunMoon className="w-4 h-4 text-amber-700 flex-shrink-0" />
                                  ) : sess.sessionKey === 'MORNING' ? (
                                    <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                  ) : sess.sessionKey === 'AFTERNOON' ? (
                                    <Moon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                  ) : (
                                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  )}
                                  <span className={`text-sm font-bold ${isFullDay ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                                    {sess.sessionName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 border border-slate-200 text-xs">
                                {sess.description}
                              </td>
                              <td className="py-3.5 px-3 text-center font-bold border border-slate-200">
                                {sess.classesCount} lớp
                              </td>
                              <td className="py-3.5 px-3 text-center border border-slate-200">
                                {sess.totalStudents} HS
                              </td>
                              <td className="py-3.5 px-3 text-center border border-slate-200">
                                {sess.assignmentsCount} lượt
                              </td>
                              <td className="py-3.5 px-3 text-center font-black text-blue-900 text-sm bg-blue-50/40 border border-slate-200">
                                {sess.totalPeriods}
                              </td>
                              <td className="py-3.5 px-3 text-center border border-slate-200">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-xs inline-flex items-center gap-1 ${
                                    isFullDay
                                      ? 'bg-amber-200 text-amber-950 border border-amber-300'
                                      : 'bg-purple-100 text-purple-900'
                                  }`}
                                >
                                  <Users className="w-3 h-3" />
                                  {sess.teacherCount} GV
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 border border-slate-200">
                                {teachersList.length === 0 ? (
                                  <span className="text-slate-400 italic text-xs">Chưa có giáo viên</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {teachersList.slice(0, 5).map((t) => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedReportId(2);
                                          setSelectedTeacherForReport2(t.id);
                                        }}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition cursor-pointer ${
                                          isFullDay
                                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
                                            : 'bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-950 border-slate-200'
                                        }`}
                                        title={`Bấm để xem Báo cáo định mức chi tiết của ${t.fullName}`}
                                      >
                                        <span className="font-mono text-[10px] text-slate-500">{t.code}</span>
                                        <span>{t.fullName}</span>
                                        <span className="text-[10px] text-blue-800 font-mono">({t.periods}t)</span>
                                      </button>
                                    ))}

                                    {teachersList.length > 5 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandSession(sess.sessionKey)}
                                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 cursor-pointer"
                                      >
                                        +{teachersList.length - 5} GV khác
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-3 text-center border border-slate-200 print:hidden">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandSession(sess.sessionKey)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    isExpanded
                                      ? 'bg-slate-200 text-slate-800'
                                      : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200'
                                  }`}
                                >
                                  <span>{isExpanded ? 'Thu gọn' : 'Bung ra'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>

                            {/* Sub-Table when row is expanded */}
                            {isExpanded && teachersList.length > 0 && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={10} className="p-3 sm:p-4 border border-slate-200">
                                  <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                                    <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                                      <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-700" />
                                        <h4 className="text-xs font-bold text-slate-900">
                                          Danh sách {teachersList.length} Giáo viên tham gia {sess.sessionName}
                                        </h4>
                                        {isFullDay && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                                            Dạy cả 2 buổi (Sáng & Chiều)
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-slate-500 italic">
                                        Bấm vào tên giáo viên để mở Báo cáo định mức chi tiết (Mục 2)
                                      </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs border border-slate-200">
                                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase">
                                          <tr>
                                            <th className="py-2 px-2.5 text-center w-10">TT</th>
                                            <th className="py-2 px-2.5 w-20">Mã GV</th>
                                            <th className="py-2 px-3">Họ và tên</th>
                                            <th className="py-2 px-3">Email</th>
                                            <th className="py-2 px-3">Tổ chuyên môn</th>
                                            <th className="py-2 px-2.5 text-center">Tiết Sáng</th>
                                            <th className="py-2 px-2.5 text-center">Tiết Chiều</th>
                                            <th className="py-2 px-2.5 text-center font-bold text-blue-900">Tổng tiết</th>
                                            <th className="py-2 px-3">Các lớp phụ trách</th>
                                            <th className="py-2 px-3 text-right">Tìm kiếm / Chi tiết</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {teachersList.map((t, idx) => (
                                            <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                                              <td className="py-2 px-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                                              <td className="py-2 px-2.5 font-mono font-bold text-slate-600">{t.code}</td>
                                              <td className="py-2 px-3 font-bold text-slate-900">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedReportId(2);
                                                    setSelectedTeacherForReport2(t.id);
                                                  }}
                                                  className="hover:text-blue-700 hover:underline cursor-pointer text-left"
                                                >
                                                  {t.fullName}
                                                </button>
                                              </td>
                                              <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{t.email || '-'}</td>
                                              <td className="py-2 px-3 text-slate-600">{t.departmentName || 'Chưa xếp tổ'}</td>
                                              <td className="py-2 px-2.5 text-center font-semibold text-amber-800">
                                                {t.morningPeriods}t
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-semibold text-indigo-800">
                                                {t.afternoonPeriods}t
                                              </td>
                                              <td className="py-2 px-2.5 text-center font-black text-blue-900 bg-blue-50/40">
                                                {t.periods}t
                                              </td>
                                              <td className="py-2 px-3 text-slate-700">
                                                <div className="flex flex-wrap gap-1">
                                                  {t.classNames.length > 0 ? (
                                                    t.classNames.map((cn, cIdx) => (
                                                      <span key={cIdx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">
                                                        {cn}
                                                      </span>
                                                    ))
                                                  ) : (
                                                    <span className="text-slate-400 italic text-[11px]">Nhiệm vụ chung</span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedReportId(2);
                                                    setSelectedTeacherForReport2(t.id);
                                                  }}
                                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition cursor-pointer"
                                                >
                                                  <Search className="w-3 h-3" />
                                                  <span>Xem Báo cáo GV</span>
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                  {/* Footer Totals */}
                  <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-center uppercase tracking-wider font-black text-slate-900 border border-slate-300">
                        TỔNG CỘNG THEO CÁC CA BUỔI HỌC
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black">
                        {scopedClasses.length} lớp
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black">
                        {scopedClasses.reduce((s, c) => s + (c.studentCount || 0), 0)} HS
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black">
                        {sessionReports.reduce((s, r) => s + r.assignmentsCount, 0)} lượt
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black text-blue-900 text-sm bg-blue-100/60">
                        {sessionReports.reduce((s, r) => s + r.totalPeriods, 0)}
                      </td>
                      <td className="py-3 px-3 text-center border border-slate-300 font-black text-purple-900">
                        {scopedTeachers.length} GV
                      </td>
                      <td colSpan={2} className="py-3 px-4 border border-slate-300 text-slate-600 text-xs italic font-normal">
                        Bao gồm các ca học chính khóa (Sáng, Chiều, 2 buổi/ngày) và hoạt động kiêm nhiệm toàn trường
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 8 & 9: Special Duties & Exemptions */}
          {/* ========================================================================= */}
          {(selectedReportId === 8 || selectedReportId === 9) && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-4">Nhiệm vụ / Miễn giảm</th>
                  <th className="py-2.5 px-3">Phân loại</th>
                  <th className="py-2.5 px-3 text-center">Số lượt phân công</th>
                  <th className="py-2.5 px-3 text-center font-bold text-blue-900">
                    Tổng số tiết quy đổi ({timeCycleConfig.shortLabel})
                  </th>
                  <th className="py-2.5 px-4">Giáo viên đảm nhiệm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const filtered = dutyReports.filter((d) => (selectedReportId === 8 ? d.group === 'Kiêm nhiệm' : d.group === 'Miễn giảm'));
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Không có dữ liệu {selectedReportId === 8 ? 'nhiệm vụ kiêm nhiệm' : 'miễn giảm tiết dạy'} cho phạm vi này
                        </td>
                      </tr>
                    );
                  }

                  const totalCount = filtered.reduce((s, d) => s + (d.count || 0), 0);
                  const totalPeriods = filtered.reduce((s, d) => s + (d.totalPeriods || 0), 0);

                  return (
                    <>
                      {filtered.map((d, i) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                          <td className="py-3 px-3 text-slate-500">{d.secondaryName}</td>
                          <td className="py-3 px-3 text-center font-semibold">{d.count}</td>
                          <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{d.totalPeriods}</td>
                          <td className="py-3 px-4 text-slate-700">
                            {d.details?.map((item: any) => `${item.teacherName} (${item.classOrScope})`).join(', ') || 'Chưa gán'}
                          </td>
                        </tr>
                      ))}
                      {/* Summary Row for Report 8/9 */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={3} className="py-3 px-4 text-center uppercase tracking-wider">
                          TỔNG CỘNG ({selectedReportId === 8 ? 'KIÊM NHIỆM' : 'MIỄN GIẢM TIẾT'})
                        </td>
                        <td className="py-3 px-3 text-center font-black">{totalCount} lượt</td>
                        <td className="py-3 px-3 text-center font-black text-blue-900 text-sm bg-blue-50/60">{totalPeriods}</td>
                        <td className="py-3 px-4 text-slate-600 text-xs italic font-medium">
                          {selectedReportId === 8 ? 'Các nhiệm vụ kiêm nhiệm được phê duyệt' : 'Đã tính đủ theo quy định và tình trạng giáo viên'}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          )}

          {/* ========================================================================= */}
          {/* REPORT 10: Teacher Balance Analysis (Surplus, Deficit, Exact) */}
          {/* ========================================================================= */}
          {selectedReportId === 10 && (
            <div className="space-y-4">
              {/* Scope & Department Filter Indicator */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
                <span>
                  Phạm vi: <strong className="text-slate-900">{branchScopeName}</strong> •{' '}
                  <strong className="text-emerald-900">{departmentScopeName}</strong> (Tổng cộng{' '}
                  <strong className="text-blue-900">{deptScopedCalculations.length}</strong> giáo viên)
                </span>
                {selectedDepartmentId !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedDepartmentId('ALL')}
                    className="text-xs text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                  >
                    ← Xem toàn trường (Tất cả các Tổ)
                  </button>
                )}
              </div>

              {/* Filter Pills & Quick Metrics */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 mr-1">Bộ lọc cân đối:</span>
                  {(
                    [
                      { id: 'ALL', label: `Tất cả (${deptScopedCalculations.length})` },
                      {
                        id: 'UNBALANCED',
                        label: `Chưa cân đối (${deptScopedCalculations.filter((c) => c.resultStatus !== 'EXACT' && c.resultStatus !== 'EXACT_EXEMPT').length})`,
                      },
                      {
                        id: 'DEFICIT',
                        label: `Thiếu định mức (${deptScopedCalculations.filter((c) => c.resultStatus === 'DEFICIT').length})`,
                      },
                      {
                        id: 'SURPLUS',
                        label: `Thừa định mức (${deptScopedCalculations.filter((c) => c.resultStatus === 'SURPLUS').length})`,
                      },
                      {
                        id: 'EXACT',
                        label: `Đủ định mức (${deptScopedCalculations.filter((c) => c.resultStatus === 'EXACT' || c.resultStatus === 'EXACT_EXEMPT').length})`,
                      },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      onClick={() => setStatusFilterForReport10(st.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        statusFilterForReport10 === st.id
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="text-xs font-mono text-slate-500 font-bold">
                  Quy chuẩn: {timeCycleConfig.unit}
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
                <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3">Mã GV</th>
                    <th className="py-2.5 px-4">Họ và tên</th>
                    <th className="py-2.5 px-3">Điểm trường</th>
                    <th className="py-2.5 px-3">Tổ CM</th>
                    <th className="py-2.5 px-3 text-center">Thực dạy</th>
                    <th className="py-2.5 px-3 text-center">Kiêm nhiệm</th>
                    <th className="py-2.5 px-3 text-center">Miễn giảm</th>
                    <th className="py-2.5 px-3 text-center font-black text-blue-900">Tổng tính</th>
                    <th className="py-2.5 px-3 text-center font-bold">Định mức</th>
                    <th className="py-2.5 px-3 text-center font-bold">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-center">Trạng thái</th>
                    <th className="py-2.5 px-4">Đề xuất cân đối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filteredCalcs = deptScopedCalculations
                      .filter((c) => {
                        if (statusFilterForReport10 === 'UNBALANCED') {
                          return c.resultStatus !== 'EXACT' && c.resultStatus !== 'EXACT_EXEMPT';
                        }
                        if (statusFilterForReport10 === 'DEFICIT') return c.resultStatus === 'DEFICIT';
                        if (statusFilterForReport10 === 'SURPLUS') return c.resultStatus === 'SURPLUS';
                        if (statusFilterForReport10 === 'EXACT') {
                          return c.resultStatus === 'EXACT' || c.resultStatus === 'EXACT_EXEMPT';
                        }
                        return true;
                      })
                      .filter((c) => {
                        if (!reportSearch.trim()) return true;
                        const q = reportSearch.toLowerCase().trim();
                        return c.teacherName.toLowerCase().includes(q) || c.teacherCode.toLowerCase().includes(q);
                      });

                    if (filteredCalcs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={13} className="py-8 text-center text-slate-400 italic font-medium">
                            Không tìm thấy giáo viên nào trong phạm vi {departmentScopeName} phù hợp với tiêu chí lọc
                          </td>
                        </tr>
                      );
                    }

                    const sumTeaching = filteredCalcs.reduce((s, c) => s + (c.morningPeriods + c.afternoonPeriods), 0);
                    const sumConcurrent = filteredCalcs.reduce((s, c) => s + c.concurrentPeriods, 0);
                    const sumExemption = filteredCalcs.reduce((s, c) => s + c.exemptionPeriods, 0);
                    const sumTotalCalc = filteredCalcs.reduce((s, c) => s + c.totalCalculated, 0);
                    const sumQuota = filteredCalcs.reduce((s, c) => s + c.quota, 0);
                    const sumDiff = sumTotalCalc - sumQuota;

                    return (
                      <>
                        {filteredCalcs.map((c, i) => {
                          const tObj = teacherMap.get(c.teacherId);
                          return (
                            <tr key={c.teacherId} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{c.teacherCode}</td>
                              <td className="py-2.5 px-4 font-bold text-slate-900">{c.teacherName}</td>
                              <td className="py-2.5 px-3 text-slate-600">{tObj?.workplace || 'Điểm chính'}</td>
                              <td className="py-2.5 px-3 text-slate-600">{c.departmentName}</td>
                              <td className="py-2.5 px-3 text-center font-medium">
                                {c.morningPeriods + c.afternoonPeriods}
                              </td>
                              <td className="py-2.5 px-3 text-center font-medium">{c.concurrentPeriods}</td>
                              <td className="py-2.5 px-3 text-center font-medium">{c.exemptionPeriods}</td>
                              <td className="py-2.5 px-3 text-center font-black text-blue-900 bg-blue-50/40">
                                {c.totalCalculated}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-700 font-bold">{c.quota}</td>
                              <td
                                className={`py-2.5 px-3 text-center font-black ${
                                  c.difference > 0
                                    ? 'text-orange-700'
                                    : c.difference < 0
                                    ? 'text-red-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {c.difference > 0 ? `+${c.difference}` : c.difference}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block min-w-[70px] ${
                                    c.resultStatus === 'EXACT'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : c.resultStatus === 'EXACT_EXEMPT'
                                      ? 'bg-blue-100 text-blue-800'
                                      : c.resultStatus === 'DEFICIT'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-orange-100 text-orange-800'
                                  }`}
                                >
                                  {c.resultStatus === 'EXACT'
                                    ? 'ĐỦ'
                                    : c.resultStatus === 'EXACT_EXEMPT'
                                    ? 'ĐỦ (MIỄN)'
                                    : c.resultStatus === 'DEFICIT'
                                    ? `THIẾU ${c.deficitAmount}`
                                    : `THỪA +${c.surplusAmount}`}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-[11px] text-slate-600 font-medium">
                                {c.recommendation}
                              </td>
                            </tr>
                          );
                        })}

                        {/* Summary Footer Row */}
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                          <td colSpan={5} className="py-3 px-4 text-center uppercase tracking-wider">
                            TỔNG CỘNG ({filteredCalcs.length} GV - {departmentScopeName.toUpperCase()})
                          </td>
                          <td className="py-3 px-3 text-center">{sumTeaching}</td>
                          <td className="py-3 px-3 text-center">{sumConcurrent}</td>
                          <td className="py-3 px-3 text-center">{sumExemption}</td>
                          <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/60">{sumTotalCalc}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-700">{sumQuota}</td>
                          <td
                            className={`py-3 px-3 text-center font-black ${
                              sumDiff > 0
                                ? 'text-orange-700'
                                : sumDiff < 0
                                ? 'text-red-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {sumDiff > 0 ? `+${sumDiff}` : sumDiff}
                          </td>
                          <td colSpan={2} className="py-3 px-4 text-slate-600 text-xs italic font-medium">
                            {sumDiff === 0
                              ? 'Cân đối chuẩn định mức'
                              : sumDiff > 0
                              ? `Thừa ${sumDiff} tiết toàn phạm vi`
                              : `Thiếu ${Math.abs(sumDiff)} tiết toàn phạm vi`}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 11: Class - Subject Discrepancy */}
          {/* ========================================================================= */}
          {selectedReportId === 11 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Lọc trạng thái:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {(['ALL', 'MISSING', 'DEFICIT', 'SURPLUS', 'OK'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setClassSubjectFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        classSubjectFilter === st
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {st === 'ALL'
                        ? `Tất cả (${classSubjectResults.length})`
                        : st === 'MISSING'
                        ? `Chưa phân công (${classSubjectResults.filter((r: any) => r.status === 'MISSING').length})`
                        : st === 'DEFICIT'
                        ? `Thiếu tiết (${classSubjectResults.filter((r: any) => r.status === 'DEFICIT').length})`
                        : st === 'SURPLUS'
                        ? `Thừa tiết (${classSubjectResults.filter((r: any) => r.status === 'SURPLUS').length})`
                        : `Đã đủ (${classSubjectResults.filter((r: any) => r.status === 'OK').length})`}
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
                <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3">Khối</th>
                    <th className="py-2.5 px-3 font-bold">Lớp</th>
                    <th className="py-2.5 px-4">Môn học</th>
                    <th className="py-2.5 px-3 text-center">Định mức chuẩn</th>
                    <th className="py-2.5 px-3 text-center font-bold text-blue-900">Đã phân công</th>
                    <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-center">Tình trạng</th>
                    <th className="py-2.5 px-4">Giáo viên phụ trách</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classSubjectResults
                    .filter((r: any) => {
                      if (classSubjectFilter === 'ALL') return true;
                      return r.status === classSubjectFilter;
                    })
                    .map((r: any, i: number) => (
                      <tr key={`${r.classId}-${r.subjectId}-${i}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                        <td className="py-2.5 px-3 font-semibold">Khối {r.grade}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.className}</td>
                        <td className="py-2.5 px-4 font-semibold text-blue-900">{r.subjectName}</td>
                        <td className="py-2.5 px-3 text-center">{r.standardPeriodsPerWeek} {timeCycleConfig.unit}</td>
                        <td className="py-2.5 px-3 text-center font-black text-slate-900 bg-blue-50/40">
                          {r.assignedPeriodsPerWeek}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {r.difference > 0 ? `+${r.difference}` : r.difference}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              r.status === 'OK'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'MISSING'
                                ? 'bg-red-100 text-red-800 font-black animate-pulse'
                                : r.status === 'DEFICIT'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {r.status === 'OK'
                              ? 'ĐỦ'
                              : r.status === 'MISSING'
                              ? 'CHƯA GÁN'
                              : r.status === 'DEFICIT'
                              ? `THIẾU ${Math.abs(r.difference)}`
                              : `THỪA +${r.difference}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {r.assignedTeachers && r.assignedTeachers.length > 0 ? (
                            r.assignedTeachers.map((t: any) => `${t.teacherName} (${t.periodsPerWeek}t)`).join(', ')
                          ) : (
                            <span className="text-red-500 italic text-[11px]">Chưa phân công giáo viên</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 12: School / Branch Wide Workload Balance & Period Summary */}
          {/* ========================================================================= */}
          {selectedReportId === 12 && (
            <div className="space-y-6">
              {/* 4 Summary Cards strictly verified */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng GV & Lớp học</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {schoolKpi.totalTeachers} <span className="text-xs font-normal text-slate-500">GV</span> • {schoolKpi.totalClasses} <span className="text-xs font-normal text-slate-500">Lớp</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Sĩ số: {schoolKpi.totalStudents} học sinh</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                    Tổng định mức ({timeCycleConfig.shortLabel})
                  </div>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {schoolKpi.totalQuota} <span className="text-xs font-normal text-blue-700">{timeCycleConfig.unit}</span>
                  </div>
                  <div className="text-[11px] text-blue-600 mt-0.5">Theo định mức đã gán cho từng GV</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Tổng số tiết đã xếp
                  </div>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    {schoolKpi.totalCalculatedPeriods} <span className="text-xs font-normal text-emerald-700">{timeCycleConfig.unit}</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">Gồm giảng dạy, kiêm nhiệm, miễn giảm</div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Cân đối phạm vi</div>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    {schoolKpi.difference > 0 ? `+${schoolKpi.difference}` : schoolKpi.difference}{' '}
                    <span className="text-xs font-normal text-purple-700">{timeCycleConfig.unit}</span>
                  </div>
                  <div className="text-[11px] text-purple-600 mt-0.5">
                    {schoolKpi.difference === 0
                      ? 'Cân đối hoàn hảo'
                      : schoolKpi.difference > 0
                      ? 'Thừa định mức'
                      : 'Thiếu định mức'}
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Bảng tổng hợp chi tiết phân bổ tiết theo Tổ chuyên môn ({branchScopeName}):
                </h4>
                <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
                  <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">STT</th>
                      <th className="py-2.5 px-4">Tổ chuyên môn</th>
                      <th className="py-2.5 px-3 text-center">Buổi 1 (Sáng)</th>
                      <th className="py-2.5 px-3 text-center">Buổi 2 (Chiều)</th>
                      <th className="py-2.5 px-3 text-center">Kiêm nhiệm</th>
                      <th className="py-2.5 px-3 text-center">Miễn giảm</th>
                      <th className="py-2.5 px-3 text-center font-black text-blue-900">Tổng số tiết</th>
                      <th className="py-2.5 px-3 text-center">Tổng ĐM</th>
                      <th className="py-2.5 px-3 text-center">Cân đối</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deptReports.map((d, i) => (
                      <tr key={d.id} className="hover:bg-slate-50 font-medium">
                        <td className="py-3 px-3 text-center text-slate-400">{i + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {d.name.startsWith('Tổ') ? d.name : `Tổ ${d.name}`} ({d.count} GV)
                        </td>
                        <td className="py-3 px-3 text-center">{d.morningPeriods}</td>
                        <td className="py-3 px-3 text-center">{d.afternoonPeriods}</td>
                        <td className="py-3 px-3 text-center">{d.concurrentPeriods}</td>
                        <td className="py-3 px-3 text-center">{d.exemptionPeriods}</td>
                        <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{d.totalPeriods}</td>
                        <td className="py-3 px-3 text-center text-slate-600 font-bold">{d.quota}</td>
                        <td
                          className={`py-3 px-3 text-center font-bold ${
                            (d.difference || 0) > 0
                              ? 'text-orange-700'
                              : (d.difference || 0) < 0
                              ? 'text-red-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {(d.difference || 0) > 0 ? `+${d.difference}` : d.difference}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={2} className="py-3 px-4 uppercase text-center font-black">
                        TỔNG CỘNG ({branchDisplayName})
                      </td>
                      <td className="py-3 px-3 text-center">{schoolKpi.totalMorningPeriods}</td>
                      <td className="py-3 px-3 text-center">{schoolKpi.totalAfternoonPeriods}</td>
                      <td className="py-3 px-3 text-center">{schoolKpi.totalConcurrentPeriods}</td>
                      <td className="py-3 px-3 text-center">{schoolKpi.totalExemptionPeriods}</td>
                      <td className="py-3 px-3 text-center text-blue-900 font-black text-sm">{schoolKpi.totalCalculatedPeriods}</td>
                      <td className="py-3 px-3 text-center text-slate-700 font-black">{schoolKpi.totalQuota}</td>
                      <td className="py-3 px-3 text-center text-purple-900 font-black text-sm">
                        {schoolKpi.difference > 0 ? `+${schoolKpi.difference}` : schoolKpi.difference}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* REPORT 13: Subject by Grade */}
          {/* ========================================================================= */}
          {selectedReportId === 13 && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-4">Môn học</th>
                  <th className="py-2.5 px-3">Nhóm môn</th>
                  <th className="py-2.5 px-3 text-center">Khối 6 (Cần/Gán)</th>
                  <th className="py-2.5 px-3 text-center">Khối 7 (Cần/Gán)</th>
                  <th className="py-2.5 px-3 text-center">Khối 8 (Cần/Gán)</th>
                  <th className="py-2.5 px-3 text-center">Khối 9 (Cần/Gán)</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tổng cần</th>
                  <th className="py-2.5 px-3 text-center font-bold text-blue-900">Tổng gán ({timeCycleConfig.shortLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectGradeReports.map((s, i) => (
                  <tr key={s.subjectId} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{s.subjectName}</td>
                    <td className="py-3 px-3 text-slate-500">{s.group}</td>
                    <td className="py-3 px-3 text-center font-mono">
                      {s.grades[6]?.required} / <strong className="text-blue-900">{s.grades[6]?.assigned}</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {s.grades[7]?.required} / <strong className="text-blue-900">{s.grades[7]?.assigned}</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {s.grades[8]?.required} / <strong className="text-blue-900">{s.grades[8]?.assigned}</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {s.grades[9]?.required} / <strong className="text-blue-900">{s.grades[9]?.assigned}</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-600">{s.totalRequired}</td>
                    <td className="py-3 px-3 text-center font-black text-emerald-800 bg-emerald-50/40">{s.totalAssigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ========================================================================= */}
          {/* REPORT 14: Faculty Structure */}
          {/* ========================================================================= */}
          {selectedReportId === 14 && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-4">Tổ chuyên môn</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tổng số GV</th>
                  <th className="py-2.5 px-3 text-center">Biên chế</th>
                  <th className="py-2.5 px-3 text-center">Hợp đồng</th>
                  <th className="py-2.5 px-3 text-center font-bold text-emerald-800">Đủ ĐM</th>
                  <th className="py-2.5 px-3 text-center font-bold text-orange-800">Thừa ĐM</th>
                  <th className="py-2.5 px-3 text-center font-bold text-red-800">Thiếu ĐM</th>
                  <th className="py-2.5 px-3 text-center font-bold text-blue-900">Tổng tiết xếp</th>
                  <th className="py-2.5 px-3 text-center">Tổng ĐM</th>
                  <th className="py-2.5 px-3 text-center font-bold">Tỷ lệ hoàn thành</th>
                  <th className="py-2.5 px-4">Chuyên ngành đào tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teacherStructureReports.map((ts, i) => (
                  <tr key={ts.departmentId} className="hover:bg-slate-50 font-medium">
                    <td className="py-3 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-sm">{ts.departmentName}</td>
                    <td className="py-3 px-3 text-center font-black text-blue-900 text-sm">{ts.totalTeachers} GV</td>
                    <td className="py-3 px-3 text-center">{ts.fulltimeCount}</td>
                    <td className="py-3 px-3 text-center">{ts.contractCount}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-800">{ts.exactCount}</td>
                    <td className="py-3 px-3 text-center font-bold text-orange-800">{ts.surplusCount}</td>
                    <td className="py-3 px-3 text-center font-bold text-red-800">{ts.deficitCount}</td>
                    <td className="py-3 px-3 text-center font-black text-slate-900 bg-blue-50/40">{ts.totalCalculated}</td>
                    <td className="py-3 px-3 text-center text-slate-600 font-bold">{ts.totalQuota}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          ts.completionRate >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {ts.completionRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">{ts.majors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ========================================================================= */}
          {/* REPORT 15: Audit Logs */}
          {/* ========================================================================= */}
          {selectedReportId === 15 && (
            <table className="w-full text-left text-xs text-slate-700 border border-slate-200">
              <thead className="bg-gradient-to-r from-sky-100 via-blue-100 to-sky-100 text-blue-950 uppercase text-[10px] font-bold border-b border-blue-200">
                <tr>
                  <th className="py-2.5 px-3 text-center w-12">STT</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Người thực hiện</th>
                  <th className="py-2.5 px-2 text-center">Hành động</th>
                  <th className="py-2.5 px-3">Đối tượng</th>
                  <th className="py-2.5 px-4">Mô tả chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs
                  .filter((log) => {
                    if (!reportSearch.trim()) return true;
                    const q = reportSearch.toLowerCase().trim();
                    return (
                      log.userName.toLowerCase().includes(q) ||
                      log.action.toLowerCase().includes(q) ||
                      log.entityDescription.toLowerCase().includes(q)
                    );
                  })
                  .map((log, i) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">{i + 1}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{log.userName}</td>
                      <td className="py-3 px-2 text-center">
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">{log.entityType}</td>
                      <td className="py-3 px-4 text-slate-900 font-medium">{log.entityDescription}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* OFFICIAL SIGNATURE BLOCK FOR OFFICIAL PRINTS */}
        <div className="pt-10 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
          <div className="space-y-1">
            <div className="font-bold text-slate-800 uppercase">NGƯỜI LẬP BIỂU</div>
            <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
            <div className="h-16"></div>
            <div className="font-bold text-slate-900">{dataStore.getCurrentUser()?.name || 'Người lập biểu'}</div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800 uppercase">TỔ TRƯỞNG CHUYÊN MÔN</div>
            <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
            <div className="h-16"></div>
            <div className="font-bold text-slate-400">................................................</div>
          </div>

          <div className="space-y-1">
            <div className="font-bold text-slate-800 uppercase">HIỆU TRƯỞNG</div>
            <div className="text-[11px] text-slate-500 italic">(Ký tên và đóng dấu)</div>
            <div className="h-16"></div>
            <div className="font-bold text-slate-900">
              {teachers.find((t) => t.status === 'PRINCIPAL')?.fullName || 'Ban Giám Hiệu'}
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview & Export Modal */}
      <PrintPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={reportList.find((r) => r.id === selectedReportId)?.name || 'Báo cáo Thống kê Phân công'}
        schoolName={schoolText}
        getContentHtml={getAnalyticsReportContentHtml}
        getRawElement={() => analyticsReportContainerRef.current}
        orientation="landscape"
        onExportExcel={handleExcelExport}
      />

      {/* Teaching Plan Framework Modal */}
      <TeachingPlanFrameworkModal
        isOpen={isTeachingPlanModalOpen}
        onClose={() => setIsTeachingPlanModalOpen(false)}
        schoolInfo={currentSchool}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
      />
    </div>
  );
};
