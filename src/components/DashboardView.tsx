/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Executive Dashboard & Visual Analytics View with Multi-Branch Support
 * & Department / Subject Deep Drilldown Filter (Tổ chuyên môn & Bộ môn)
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Building2,
  MapPin,
  School,
  Landmark,
  Compass,
  Check,
  ChevronRight,
  Filter,
  BookOpen,
  RotateCcw,
  Search,
  Sparkles,
  Layers,
  ArrowUpRight,
  UserCheck,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Teacher,
  SchoolClass,
  Department,
  TeachingAssignment,
  TeacherCalculationResult,
  ValidationOutput,
  AssignmentVersion,
  AuditLog,
  SchoolBranch,
  SchoolInfo,
  Subject,
  CurriculumDistribution,
} from '../types';
import { dataStore } from '../repositories/dataStore';

interface DashboardViewProps {
  teachers: Teacher[];
  classes: SchoolClass[];
  departments: Department[];
  subjects?: Subject[];
  curriculums?: CurriculumDistribution[];
  assignments: TeachingAssignment[];
  calculations: TeacherCalculationResult[];
  validation: ValidationOutput;
  currentVersion?: AssignmentVersion;
  auditLogs: AuditLog[];
  onNavigate: (tab: any) => void;
  onQuickAssign: () => void;
  onExportExcel: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  teachers,
  classes,
  departments,
  subjects: propSubjects,
  curriculums: propCurriculums,
  assignments,
  calculations,
  validation,
  currentVersion,
  auditLogs,
  onNavigate,
  onQuickAssign,
  onExportExcel,
}) => {
  // Live branches & school info from dataStore
  const [branches, setBranches] = useState<SchoolBranch[]>(() => dataStore.getBranches());
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => dataStore.getSchoolInfo());

  // 1. Campus / Branch Selector: 'ALL' | branch.id
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [showComparison, setShowComparison] = useState<boolean>(true);

  // 2. Department & Subject Deep Filters
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');

  // 3. Detail Section View Mode: 'CLASSES' | 'TEACHERS'
  const [activeViewMode, setActiveViewMode] = useState<'CLASSES' | 'TEACHERS'>('CLASSES');
  const [detailSearchTerm, setDetailSearchTerm] = useState<string>('');

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setBranches(dataStore.getBranches());
      setSchoolInfo(dataStore.getSchoolInfo());
    });
    return () => unsub();
  }, []);

  const currentSchool = schoolInfo;
  const context = dataStore.getSelectedContext();
  const semesterTitle = context?.semesterId === 'HK2' ? 'Học kỳ II' : 'Học kỳ I';
  const mainBranch = useMemo(() => branches.find((b) => b.isMain) || branches[0], [branches]);
  const subBranch = useMemo(() => branches.find((b) => !b.isMain) || branches[1], [branches]);

  // Selected Branch object (if not ALL)
  const currentSelectedBranch = useMemo(() => {
    if (selectedBranchId === 'ALL') return null;
    return branches.find((b) => b.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  // Subjects & Curriculums source
  const availableSubjects = useMemo(() => {
    return propSubjects && propSubjects.length > 0 ? propSubjects : dataStore.getSubjects();
  }, [propSubjects]);

  const availableCurriculums = useMemo(() => {
    return propCurriculums && propCurriculums.length > 0 ? propCurriculums : dataStore.getCurriculum();
  }, [propCurriculums]);

  // Subject quick lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    availableSubjects.forEach((s) => {
      map.set(s.id, s);
      map.set(s.code, s);
    });
    return map;
  }, [availableSubjects]);

  // Department quick lookup map
  const departmentMap = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach((d) => {
      map.set(d.id, d);
      map.set(d.code, d);
    });
    return map;
  }, [departments]);

  // Teacher quick lookup map
  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    teachers.forEach((t) => {
      map.set(t.id, t);
      map.set(t.code, t);
    });
    return map;
  }, [teachers]);

  // Calculation quick lookup map
  const calculationMap = useMemo(() => {
    const map = new Map<string, TeacherCalculationResult>();
    calculations.forEach((c) => {
      map.set(c.teacherId, c);
    });
    return map;
  }, [calculations]);

  // =========================================================================
  // 1. SCOPED BY CAMPUS / BRANCH
  // =========================================================================
  const activeClasses = useMemo(() => classes.filter((c) => !c.isDeleted), [classes]);
  const scopedClasses = useMemo(() => {
    if (selectedBranchId === 'ALL') return activeClasses;
    return activeClasses.filter((c) => {
      if (selectedBranchId === 'branch_main') {
        return !c.branchId || c.branchId === 'branch_main';
      }
      return c.branchId === selectedBranchId;
    });
  }, [activeClasses, selectedBranchId]);

  const scopedClassIds = useMemo(() => {
    return new Set(scopedClasses.map((c) => c.id).concat(scopedClasses.map((c) => c.code)));
  }, [scopedClasses]);

  const activeAssignments = useMemo(() => assignments.filter((a) => !a.isDeleted), [assignments]);
  const scopedAssignments = useMemo(() => {
    if (selectedBranchId === 'ALL') return activeAssignments;
    return activeAssignments.filter((a) => a.classId && scopedClassIds.has(a.classId));
  }, [activeAssignments, scopedClassIds, selectedBranchId]);

  const allValidTeachers = useMemo(() => teachers.filter((t) => !t.isDeleted), [teachers]);

  // Teachers stationed or teaching in this campus
  const scopedTeachers = useMemo(() => {
    if (selectedBranchId === 'ALL') return allValidTeachers;

    const teacherIdsWithTeachingHere = new Set(
      scopedAssignments.map((a) => a.teacherId).filter(Boolean) as string[]
    );

    return allValidTeachers.filter((t) => {
      if (t.workplaceId === selectedBranchId) return true;
      if (selectedBranchId === 'branch_main' && (t.workplaceId === 'wp_main' || (!t.workplaceId && !t.workplace))) return true;
      if (selectedBranchId === 'branch_sub' && t.workplaceId === 'wp_sub') return true;
      if (teacherIdsWithTeachingHere.has(t.id)) return true;
      if (t.workplaceId === 'wp_all' || t.workplace === 'Toàn trường' || t.status === 'PRINCIPAL' || t.status === 'VICE_PRINCIPAL') {
        return true;
      }
      return false;
    });
  }, [allValidTeachers, selectedBranchId, scopedAssignments]);

  const scopedActiveTeachers = useMemo(() => {
    return scopedTeachers.filter((t) => t.status === 'ACTIVE');
  }, [scopedTeachers]);

  const scopedTeacherIdSet = useMemo(() => new Set(scopedTeachers.map((t) => t.id)), [scopedTeachers]);

  const scopedCalculations = useMemo(() => {
    if (selectedBranchId === 'ALL') return calculations;
    return calculations.filter((c) => scopedTeacherIdSet.has(c.teacherId));
  }, [calculations, scopedTeacherIdSet, selectedBranchId]);

  // =========================================================================
  // 2. DEPARTMENT & SUBJECT FILTER STATS & CALCULATIONS
  // =========================================================================

  // Helper: map each subject ID to its total assigned periods in the scoped campus
  const subjectPeriodsMap = useMemo(() => {
    const map = new Map<string, number>();
    scopedAssignments.forEach((a) => {
      if (a.subjectId) {
        map.set(a.subjectId, (map.get(a.subjectId) || 0) + (a.periodsPerWeek || 0));
      }
    });
    return map;
  }, [scopedAssignments]);

  // Helper: compute expected PPCT periods for a subject across all scoped classes
  const getSubjectExpectedPeriods = (subId: string): number => {
    let total = 0;
    scopedClasses.forEach((cls) => {
      const match = availableCurriculums.find(
        (c) => c.grade === cls.grade && c.subjectId === subId
      );
      if (match) {
        total += match.periodsPerWeek || 0;
      }
    });
    return total;
  };

  // Helper: compute expected PPCT periods for a department across all scoped classes
  const getDepartmentExpectedPeriods = (deptId: string): number => {
    const deptSubjects = availableSubjects.filter((s) => s.departmentId === deptId);
    let total = 0;
    deptSubjects.forEach((sub) => {
      total += getSubjectExpectedPeriods(sub.id);
    });
    return total;
  };

  // Department Stats for Pill Buttons
  const departmentsWithStats = useMemo(() => {
    return departments.map((dept) => {
      const deptTeachers = scopedTeachers.filter((t) => t.departmentId === dept.id);
      const deptSubjects = availableSubjects.filter((s) => s.departmentId === dept.id);
      const deptSubjectIds = new Set(deptSubjects.map((s) => s.id));
      const deptTeacherIds = new Set(deptTeachers.map((t) => t.id));

      const deptAssignments = scopedAssignments.filter(
        (a) => (a.subjectId && deptSubjectIds.has(a.subjectId)) || (a.teacherId && deptTeacherIds.has(a.teacherId))
      );
      const periodCount = deptAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
      const expectedPeriods = getDepartmentExpectedPeriods(dept.id);

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        teacherCount: deptTeachers.length,
        periodCount,
        expectedPeriods,
      };
    });
  }, [departments, scopedTeachers, availableSubjects, scopedAssignments, scopedClasses, availableCurriculums]);

  // Subjects available for selection (optionally filtered by currently selected department)
  const selectableSubjects = useMemo(() => {
    if (selectedDepartmentId === 'ALL') {
      return availableSubjects;
    }
    const filtered = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
    return filtered.length > 0 ? filtered : availableSubjects;
  }, [availableSubjects, selectedDepartmentId]);

  // Current selected entities
  const currentDepartment = useMemo(() => {
    if (selectedDepartmentId === 'ALL') return null;
    return departments.find((d) => d.id === selectedDepartmentId) || null;
  }, [departments, selectedDepartmentId]);

  const currentSubject = useMemo(() => {
    if (selectedSubjectId === 'ALL') return null;
    return availableSubjects.find((s) => s.id === selectedSubjectId) || null;
  }, [availableSubjects, selectedSubjectId]);

  // Human-readable title of current tracking scope
  const trackingTitle = useMemo(() => {
    if (currentSubject) {
      return `Môn ${currentSubject.name}`;
    }
    if (currentDepartment) {
      return currentDepartment.name;
    }
    return currentSelectedBranch ? currentSelectedBranch.name : 'Toàn trường';
  }, [currentSubject, currentDepartment, currentSelectedBranch]);

  // Filtered teachers based on active Department & Subject
  const filteredTeachers = useMemo(() => {
    if (selectedSubjectId !== 'ALL') {
      const targetSub = availableSubjects.find((s) => s.id === selectedSubjectId);
      const subCode = targetSub?.code?.toLowerCase();
      const teacherIdsAssignedToSubject = new Set(
        scopedAssignments.filter((a) => a.subjectId === selectedSubjectId).map((a) => a.teacherId).filter(Boolean) as string[]
      );

      return scopedTeachers.filter((t) => {
        if (teacherIdsAssignedToSubject.has(t.id)) return true;
        if (t.major && subCode && t.major.toLowerCase().includes(subCode)) return true;
        if (t.subjectsCanTeach && subCode && t.subjectsCanTeach.some((s) => s.toLowerCase() === subCode)) return true;
        if (targetSub?.departmentId && t.departmentId === targetSub.departmentId) return true;
        return false;
      });
    }

    if (selectedDepartmentId !== 'ALL') {
      return scopedTeachers.filter((t) => t.departmentId === selectedDepartmentId);
    }

    return scopedTeachers;
  }, [scopedTeachers, selectedDepartmentId, selectedSubjectId, availableSubjects, scopedAssignments]);

  const filteredTeacherIdSet = useMemo(() => new Set(filteredTeachers.map((t) => t.id)), [filteredTeachers]);

  // Filtered assignments based on active Department & Subject
  const filteredAssignments = useMemo(() => {
    if (selectedSubjectId !== 'ALL') {
      return scopedAssignments.filter((a) => a.subjectId === selectedSubjectId);
    }

    if (selectedDepartmentId !== 'ALL') {
      const deptSubjects = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
      const deptSubjectIds = new Set(deptSubjects.map((s) => s.id));
      return scopedAssignments.filter(
        (a) => (a.subjectId && deptSubjectIds.has(a.subjectId)) || (a.teacherId && filteredTeacherIdSet.has(a.teacherId))
      );
    }

    return scopedAssignments;
  }, [scopedAssignments, selectedDepartmentId, selectedSubjectId, availableSubjects, filteredTeacherIdSet]);

  // Filtered classes based on active Department & Subject
  const filteredClasses = useMemo(() => {
    if (selectedSubjectId !== 'ALL') {
      const assignedClassIds = new Set(
        filteredAssignments.map((a) => a.classId).filter(Boolean) as string[]
      );
      // Include classes taking this subject in curriculum OR assigned
      return scopedClasses.filter((cls) => {
        if (assignedClassIds.has(cls.id) || assignedClassIds.has(cls.code)) return true;
        const cur = availableCurriculums.find(
          (c) => c.grade === cls.grade && c.subjectId === selectedSubjectId
        );
        return cur && cur.periodsPerWeek > 0;
      });
    }

    if (selectedDepartmentId !== 'ALL') {
      const deptSubjects = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
      const deptSubjectIds = new Set(deptSubjects.map((s) => s.id));
      const assignedClassIds = new Set(
        filteredAssignments.map((a) => a.classId).filter(Boolean) as string[]
      );
      return scopedClasses.filter((cls) => {
        if (assignedClassIds.has(cls.id) || assignedClassIds.has(cls.code)) return true;
        const hasCur = availableCurriculums.some(
          (c) => c.grade === cls.grade && deptSubjectIds.has(c.subjectId) && c.periodsPerWeek > 0
        );
        return hasCur;
      });
    }

    return scopedClasses;
  }, [scopedClasses, selectedDepartmentId, selectedSubjectId, filteredAssignments, availableCurriculums, availableSubjects]);

  // Periods calculation for the active filter
  const filterAssignedPeriods = useMemo(() => {
    return filteredAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
  }, [filteredAssignments]);

  const filterMorningPeriods = useMemo(() => {
    return filteredAssignments
      .filter((a) => a.session === 'MORNING')
      .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
  }, [filteredAssignments]);

  const filterAfternoonPeriods = useMemo(() => {
    return filteredAssignments
      .filter((a) => a.session === 'AFTERNOON')
      .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
  }, [filteredAssignments]);

  const filterExpectedPeriods = useMemo(() => {
    if (selectedSubjectId !== 'ALL') {
      return getSubjectExpectedPeriods(selectedSubjectId);
    }
    if (selectedDepartmentId !== 'ALL') {
      return getDepartmentExpectedPeriods(selectedDepartmentId);
    }
    return scopedClasses.length * 29;
  }, [selectedSubjectId, selectedDepartmentId, scopedClasses, availableCurriculums, availableSubjects]);

  const filterCoveragePercent = useMemo(() => {
    if (filterExpectedPeriods <= 0) return 0;
    return Math.min(100, Math.round((filterAssignedPeriods / filterExpectedPeriods) * 100));
  }, [filterAssignedPeriods, filterExpectedPeriods]);

  // Filtered Quota & Balance Calculations
  const filteredCalculations = useMemo(() => {
    return calculations.filter((c) => filteredTeacherIdSet.has(c.teacherId));
  }, [calculations, filteredTeacherIdSet]);

  const filterExactCount = useMemo(() => {
    return filteredCalculations.filter(
      (c) => c.resultStatus === 'EXACT' || c.resultStatus === 'EXACT_EXEMPT'
    ).length;
  }, [filteredCalculations]);

  const filterDeficitCount = useMemo(() => {
    return filteredCalculations.filter((c) => c.resultStatus === 'DEFICIT').length;
  }, [filteredCalculations]);

  const filterSurplusCount = useMemo(() => {
    return filteredCalculations.filter((c) => c.resultStatus === 'SURPLUS').length;
  }, [filteredCalculations]);

  const filterUnassignedCount = useMemo(() => {
    return filteredCalculations.filter((c) => c.resultStatus === 'UNASSIGNED').length;
  }, [filteredCalculations]);

  // Filtered Conflicts
  const filteredConflicts = useMemo(() => {
    const classIdSet = new Set(filteredClasses.map((c) => c.id).concat(filteredClasses.map((c) => c.code)));
    return validation.conflicts.filter((conf) => {
      if (conf.teacherId && filteredTeacherIdSet.has(conf.teacherId)) return true;
      if (conf.classId && classIdSet.has(conf.classId)) {
        if (selectedSubjectId !== 'ALL' && conf.subjectId && conf.subjectId !== selectedSubjectId) {
          return false;
        }
        return true;
      }
      return false;
    });
  }, [validation.conflicts, filteredTeacherIdSet, filteredClasses, selectedSubjectId]);

  // Teachers stats in this department/subject: Active, Stationed, Concurrent
  const filterActiveTeachingTeachersCount = useMemo(() => {
    const assignedTeacherIds = new Set(filteredAssignments.map((a) => a.teacherId).filter(Boolean) as string[]);
    return filteredTeachers.filter((t) => assignedTeacherIds.has(t.id)).length;
  }, [filteredTeachers, filteredAssignments]);

  const filterPermanentTeachersCount = useMemo(() => {
    return filteredTeachers.filter((t) => {
      if (selectedBranchId === 'branch_sub') {
        return t.workplaceId === 'wp_sub' || t.workplaceId === 'branch_sub';
      }
      return t.workplaceId === 'wp_main' || t.workplaceId === 'branch_main' || (!t.workplaceId && !t.workplace);
    }).length;
  }, [filteredTeachers, selectedBranchId]);

  const filterConcurrentTeachersCount = useMemo(() => {
    return Math.max(0, filteredTeachers.length - filterPermanentTeachersCount);
  }, [filteredTeachers.length, filterPermanentTeachersCount]);

  // Multi-Branch Comparative Statistics (Matrix)
  const branchComparisonData = useMemo(() => {
    return branches.map((b) => {
      const bClasses = activeClasses.filter(
        (c) => c.branchId === b.id || (b.isMain && (!c.branchId || c.branchId === 'branch_main'))
      );
      const clsIds = new Set(bClasses.map((c) => c.id).concat(bClasses.map((c) => c.code)));
      const bAssignments = activeAssignments.filter((a) => a.classId && clsIds.has(a.classId));
      const bPeriods = bAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
      const bMorning = bAssignments.filter((a) => a.session === 'MORNING').reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
      const bAfternoon = bAssignments.filter((a) => a.session === 'AFTERNOON').reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
      const bStudents = bClasses.reduce((s, c) => s + (c.studentCount || 0), 0);
      const bTeachersSet = new Set(bAssignments.map((a) => a.teacherId).filter(Boolean) as string[]);
      const bExpected = bClasses.length * 29;
      const bCoverage = bExpected > 0 ? Math.min(100, Math.round((bPeriods / bExpected) * 100)) : 0;

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        isMain: b.isMain,
        address: b.address || '',
        classes: bClasses,
        classCount: bClasses.length,
        studentCount: bStudents,
        totalPeriods: bPeriods,
        morningPeriods: bMorning,
        afternoonPeriods: bAfternoon,
        teacherCount: bTeachersSet.size,
        coveragePercent: bCoverage,
        expectedPeriods: bExpected,
      };
    });
  }, [branches, activeClasses, activeAssignments]);

  // =========================================================================
  // 3. CHARTS DATA (DYNAMICALLY ADAPTED)
  // =========================================================================

  // Chart 1: If Department is chosen -> Compare each Subject in that Department vs PPCT
  // If All Departments -> Compare all Departments vs Quota
  const primaryChartData = useMemo(() => {
    if (selectedDepartmentId !== 'ALL') {
      const deptSubjects = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
      return deptSubjects.map((sub) => {
        const assigned = scopedAssignments
          .filter((a) => a.subjectId === sub.id)
          .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
        const expected = getSubjectExpectedPeriods(sub.id);

        return {
          name: sub.name,
          code: sub.code,
          'Đã phân công': assigned,
          'Khung PPCT': expected,
        };
      });
    }

    if (selectedSubjectId !== 'ALL' && currentSubject) {
      return [6, 7, 8, 9].map((g) => {
        const gClasses = scopedClasses.filter((c) => c.grade === g);
        const gClassIds = new Set(gClasses.map((c) => c.id).concat(gClasses.map((c) => c.code)));
        const assigned = scopedAssignments
          .filter((a) => a.subjectId === currentSubject.id && a.classId && gClassIds.has(a.classId))
          .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
        const cur = availableCurriculums.find((c) => c.grade === g && c.subjectId === currentSubject.id);
        const expected = (cur?.periodsPerWeek || 0) * gClasses.length;

        return {
          name: `Khối ${g}`,
          'Đã phân công': assigned,
          'Khung PPCT': expected,
        };
      });
    }

    // Default: By Department
    return (departments || []).filter(Boolean).map((d) => {
      const deptCalculations = scopedCalculations.filter((c) => c.departmentId === d.id);
      const deptTeacherIds = new Set(deptCalculations.map((c) => c.teacherId));

      const teachingPeriods = scopedAssignments
        .filter((a) => a.teacherId && deptTeacherIds.has(a.teacherId))
        .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);

      const concurrentPeriods = deptCalculations.reduce((s, c) => s + c.concurrentPeriods, 0);
      const exemptionPeriods = deptCalculations.reduce((s, c) => s + c.exemptionPeriods, 0);
      const totalQuota = deptCalculations.reduce((s, c) => s + c.quota, 0);

      const codeStr = d.code || d.name || d.id || '';
      return {
        name: codeStr.replace('TO_', ''),
        fullName: d.fullName || d.name || 'Tổ chuyên môn',
        'Giảng dạy': teachingPeriods,
        'Kiêm nhiệm': concurrentPeriods,
        'Miễn giảm': exemptionPeriods,
        'Định mức chuẩn': totalQuota,
      };
    });
  }, [
    selectedDepartmentId,
    selectedSubjectId,
    currentSubject,
    availableSubjects,
    scopedAssignments,
    scopedClasses,
    availableCurriculums,
    departments,
    scopedCalculations,
  ]);

  // Chart 2: Status Distribution Pie (for filtered teachers)
  const statusPieData = useMemo(() => {
    return [
      { name: 'Đủ định mức', value: filterExactCount, color: '#16a34a' },
      { name: 'Thiếu tiết', value: filterDeficitCount, color: '#dc2626' },
      { name: 'Thừa tiết', value: filterSurplusCount, color: '#ea580c' },
      { name: 'Chưa phân công', value: filterUnassignedCount, color: '#94a3b8' },
    ].filter((item) => item.value > 0);
  }, [filterExactCount, filterDeficitCount, filterSurplusCount, filterUnassignedCount]);

  // Chart 3: Workload by Grade for this Scope & Dept/Subject
  const gradeData = useMemo(() => {
    return [6, 7, 8, 9].map((grade) => {
      const gradeClasses = filteredClasses.filter((c) => c.grade === grade);
      const gradeClassIds = new Set(gradeClasses.map((c) => c.id).concat(gradeClasses.map((c) => c.code)));
      const gradeAssignments = filteredAssignments.filter((a) => a.classId && gradeClassIds.has(a.classId));
      const periods = gradeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);

      let expected = 0;
      if (selectedSubjectId !== 'ALL') {
        const cur = availableCurriculums.find((c) => c.grade === grade && c.subjectId === selectedSubjectId);
        expected = (cur?.periodsPerWeek || 0) * gradeClasses.length;
      } else if (selectedDepartmentId !== 'ALL') {
        const deptSubjects = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
        deptSubjects.forEach((sub) => {
          const cur = availableCurriculums.find((c) => c.grade === grade && c.subjectId === sub.id);
          expected += (cur?.periodsPerWeek || 0) * gradeClasses.length;
        });
      } else {
        expected = gradeClasses.length * 29;
      }

      const percent = expected > 0 ? Math.min(100, Math.round((periods / expected) * 100)) : 0;

      return {
        grade: `Khối ${grade}`,
        classes: gradeClasses.length,
        periods,
        expected,
        percent,
      };
    });
  }, [filteredClasses, filteredAssignments, selectedSubjectId, selectedDepartmentId, availableCurriculums, availableSubjects]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedDepartmentId('ALL');
    setSelectedSubjectId('ALL');
    setDetailSearchTerm('');
  };

  // =========================================================================
  // 4. DETAILED DATA: CLASSES MODE & TEACHERS MODE
  // =========================================================================

  // Mode 1: Detailed Class Progress
  const detailedClassRows = useMemo(() => {
    const term = detailSearchTerm.trim().toLowerCase();

    return filteredClasses
      .filter((cls) => {
        if (!term) return true;
        const homeroom = cls.homeroomTeacherId ? teacherMap.get(cls.homeroomTeacherId) : null;
        return (
          cls.name.toLowerCase().includes(term) ||
          cls.code.toLowerCase().includes(term) ||
          (homeroom && homeroom.fullName.toLowerCase().includes(term))
        );
      })
      .map((cls) => {
        const clsAssignments = filteredAssignments.filter(
          (a) => a.classId === cls.id || a.classId === cls.code
        );
        const assignedPeriods = clsAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);

        let expectedPeriods = 29;
        if (selectedSubjectId !== 'ALL') {
          const cur = availableCurriculums.find((c) => c.grade === cls.grade && c.subjectId === selectedSubjectId);
          expectedPeriods = cur?.periodsPerWeek || 0;
        } else if (selectedDepartmentId !== 'ALL') {
          const deptSubjects = availableSubjects.filter((s) => s.departmentId === selectedDepartmentId);
          let sum = 0;
          deptSubjects.forEach((sub) => {
            const cur = availableCurriculums.find((c) => c.grade === cls.grade && c.subjectId === sub.id);
            sum += cur?.periodsPerWeek || 0;
          });
          expectedPeriods = sum;
        }

        const percent = expectedPeriods > 0 ? Math.min(100, Math.round((assignedPeriods / expectedPeriods) * 100)) : 100;
        const homeroomTeacher = cls.homeroomTeacherId ? teacherMap.get(cls.homeroomTeacherId) : null;
        const branchObj = branches.find((b) => b.id === cls.branchId) || (cls.branchId === 'branch_sub' ? subBranch : mainBranch);

        // Group teachers assigned to this class for this subject/dept
        const assignedTeachersMap = new Map<string, number>();
        clsAssignments.forEach((a) => {
          if (a.teacherId) {
            assignedTeachersMap.set(
              a.teacherId,
              (assignedTeachersMap.get(a.teacherId) || 0) + (a.periodsPerWeek || 0)
            );
          }
        });

        const assignedTeachersList = Array.from(assignedTeachersMap.entries()).map(([tId, p]) => {
          const t = teacherMap.get(tId);
          return {
            teacher: t,
            periods: p,
          };
        });

        return {
          class: cls,
          assignedPeriods,
          expectedPeriods,
          percent,
          homeroomTeacher,
          branchName: branchObj?.name || (cls.branchId === 'branch_sub' ? 'Phân hiệu' : 'Điểm chính'),
          assignedTeachersList,
        };
      });
  }, [
    filteredClasses,
    filteredAssignments,
    detailSearchTerm,
    teacherMap,
    branches,
    mainBranch,
    subBranch,
    selectedSubjectId,
    selectedDepartmentId,
    availableCurriculums,
    availableSubjects,
  ]);

  // Mode 2: Detailed Teacher Progress
  const detailedTeacherRows = useMemo(() => {
    const term = detailSearchTerm.trim().toLowerCase();

    return filteredTeachers
      .filter((t) => {
        if (!term) return true;
        return (
          t.fullName.toLowerCase().includes(term) ||
          t.code.toLowerCase().includes(term) ||
          (t.major && t.major.toLowerCase().includes(term))
        );
      })
      .map((t) => {
        const tAssignments = scopedAssignments.filter((a) => a.teacherId === t.id);
        const teachingPeriods = tAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
        const calc = calculationMap.get(t.id);
        const dept = departmentMap.get(t.departmentId);

        // Classes taught by this teacher
        const classesTaughtMap = new Map<string, number>();
        tAssignments.forEach((a) => {
          if (a.classId) {
            classesTaughtMap.set(a.classId, (classesTaughtMap.get(a.classId) || 0) + (a.periodsPerWeek || 0));
          }
        });

        const classesTaughtList = Array.from(classesTaughtMap.entries()).map(([clsId, p]) => {
          const cls = activeClasses.find((c) => c.id === clsId || c.code === clsId);
          return {
            classCode: cls?.code || clsId,
            periods: p,
          };
        });

        return {
          teacher: t,
          department: dept,
          classesTaughtList,
          teachingPeriods,
          concurrentPeriods: calc?.concurrentPeriods || 0,
          exemptionPeriods: calc?.exemptionPeriods || 0,
          totalAssigned: calc?.totalAssigned || teachingPeriods,
          standardQuota: calc?.quota || t.standardQuota || 19,
          difference: calc?.difference || 0,
          resultStatus: calc?.resultStatus || (teachingPeriods === (t.standardQuota || 19) ? 'EXACT' : 'DEFICIT'),
        };
      });
  }, [
    filteredTeachers,
    detailSearchTerm,
    scopedAssignments,
    calculationMap,
    departmentMap,
    activeClasses,
  ]);

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* BANNER / WELCOME & QUICK ACTIONS */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md text-blue-200 text-xs font-semibold px-3 py-1 rounded-full mb-3 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Năm học {currentSchool.schoolYear || '2026–2027'} • {semesterTitle}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5 flex-wrap">
              <span>{currentSchool.schoolName || 'TRƯỜNG THCS'}</span>
              {currentSelectedBranch && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 px-3 py-1 rounded-xl">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {currentSelectedBranch.name}
                </span>
              )}
            </h2>
            <div className="mt-2.5 space-y-1.5 text-xs sm:text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Thống kê điều hành phân công chuyên môn</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Tự động rà soát định mức & tiến độ phân công giảng dạy</span>
              </div>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="dashboard-quick-assign-btn"
              onClick={onQuickAssign}
              className="bg-white text-blue-950 hover:bg-blue-50 font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-blue-900" />
              Phân công nhanh
            </button>
            <button
              id="dashboard-export-excel-btn"
              onClick={onExportExcel}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-white/25 backdrop-blur-xs transition flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CAMPUS / BRANCH SELECTOR TABS (BỘ LỌC ĐIỂM TRƯỜNG TRỰC TIẾP) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Segmented campus tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-2 px-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5 text-blue-700" />
              <span>Phạm vi thống kê:</span>
            </div>

            {/* Tab: TOÀN TRƯỜNG */}
            <button
              id="branch-filter-all-btn"
              onClick={() => setSelectedBranchId('ALL')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                selectedBranchId === 'ALL'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <School className="w-4 h-4" />
              <span>Toàn trường</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                  selectedBranchId === 'ALL' ? 'bg-blue-800 text-blue-200' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {activeClasses.length} lớp • {activeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0)}t
              </span>
            </button>

            {/* Dynamic tabs for each branch */}
            {branches.map((branch) => {
              const bClasses = activeClasses.filter(
                (c) => c.branchId === branch.id || (branch.isMain && !c.branchId)
              );
              const bClsIds = new Set(bClasses.map((c) => c.id).concat(bClasses.map((c) => c.code)));
              const bPeriods = activeAssignments
                .filter((a) => a.classId && bClsIds.has(a.classId))
                .reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
              const isSelected = selectedBranchId === branch.id;

              return (
                <button
                  key={branch.id}
                  id={`branch-filter-${branch.id}-btn`}
                  onClick={() => setSelectedBranchId(branch.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                    isSelected
                      ? branch.isMain
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {branch.isMain ? <Building2 className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                  <span>{branch.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {bClasses.length} lớp • {bPeriods}t
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick toggle comparison table */}
          <div className="flex items-center gap-2 justify-end">
            <button
              id="dashboard-toggle-compare-btn"
              onClick={() => setShowComparison(!showComparison)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                showComparison
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-700" />
              <span>{showComparison ? 'Ẩn bảng đối chiếu điểm trường' : 'Bảng đối chiếu các điểm trường'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEDICATED DEPARTMENT & SUBJECT FILTER BAR (THANH BỘ LỌC TỔ & BỘ MÔN) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold shadow-2xs">
              <Layers className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                LỌC THEO DÕI: TỔ CHUYÊN MÔN & BỘ MÔN
              </h3>
              <p className="text-xs text-slate-500">
                Tập trung theo dõi tiến độ, khối lượng và định mức của từng bộ phận cụ thể
              </p>
            </div>
          </div>

          {/* Nút Bỏ lọc (Xem toàn bộ) */}
          {(selectedDepartmentId !== 'ALL' || selectedSubjectId !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer shadow-2xs self-start sm:self-auto active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Bỏ lọc (Xem toàn bộ)</span>
            </button>
          )}
        </div>

        {/* Pill buttons for Tổ chuyên môn */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
          {/* Nút: Tất cả các tổ */}
          <button
            onClick={() => {
              setSelectedDepartmentId('ALL');
              setSelectedSubjectId('ALL');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
              selectedDepartmentId === 'ALL' && selectedSubjectId === 'ALL'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Tất cả các tổ</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                selectedDepartmentId === 'ALL' && selectedSubjectId === 'ALL'
                  ? 'bg-blue-800 text-blue-200'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {scopedTeachers.length} GV
            </span>
          </button>

          {/* Dynamic buttons for each Department */}
          {departmentsWithStats.map((dept) => {
            const isSelected = selectedDepartmentId === dept.id;
            return (
              <button
                key={dept.id}
                onClick={() => {
                  setSelectedDepartmentId(dept.id);
                  setSelectedSubjectId('ALL');
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{dept.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {dept.teacherCount} GV • {dept.periodCount}t
                </span>
              </button>
            );
          })}
        </div>

        {/* Row for Bộ môn cụ thể dropdown and Active Tracking Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <span>Bộ môn cụ thể:</span>
            </div>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                const sId = e.target.value;
                setSelectedSubjectId(sId);
                if (sId !== 'ALL') {
                  const targetSub = availableSubjects.find((s) => s.id === sId);
                  if (targetSub?.departmentId) {
                    setSelectedDepartmentId(targetSub.departmentId);
                  }
                }
              }}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">
                -- {selectedDepartmentId === 'ALL' ? 'Tất cả các môn' : `Tất cả môn trong ${currentDepartment?.name || 'tổ'}`} ({selectableSubjects.length} môn) --
              </option>
              {selectableSubjects.map((sub) => {
                const assigned = subjectPeriodsMap.get(sub.id) || 0;
                return (
                  <option key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code}) • {assigned} tiết
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Badge: Đang theo dõi */}
          {(selectedDepartmentId !== 'ALL' || selectedSubjectId !== 'ALL') && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              <span>Đang theo dõi: {trackingTitle}</span>
              <span className="text-[11px] font-extrabold bg-white px-2 py-0.5 rounded-md text-indigo-800 border border-indigo-200">
                {filteredTeachers.length} GV • {filterAssignedPeriods}/{filterExpectedPeriods}t ({filterCoveragePercent}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPARISON MATRIX SECTION (ĐỐI CHIẾU ĐIỂM CHÍNH & PHÂN HIỆU) */}
      {/* ========================================================================= */}
      {showComparison && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-700" />
                Bảng so sánh khối lượng & tình hình giữa các Điểm trường
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhấp vào từng cơ sở để lọc tức thì các biểu đồ và chỉ số phân công chuyên môn chi tiết
              </p>
            </div>
            {selectedBranchId !== 'ALL' && (
              <button
                onClick={() => setSelectedBranchId('ALL')}
                className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem toàn trường</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Campus comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchComparisonData.map((item) => {
              const isCurrent = selectedBranchId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedBranchId(item.id)}
                  className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                    isCurrent
                      ? 'border-blue-700 bg-blue-50/40 ring-2 ring-blue-700/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-2xs ${
                            item.isMain ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {item.code || (item.isMain ? 'DC' : 'PH')}
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">{item.name}</h4>
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {item.address || (item.isMain ? 'Cơ sở chính của trường' : 'Khu vực phân hiệu')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.isMain ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.isMain ? 'Điểm chính' : 'Phân hiệu'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-slate-200/80">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Số lớp</div>
                        <div className="text-xl font-black text-slate-900 mt-1 tracking-tight">{item.classCount}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{item.studentCount} HS</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tổng số tiết</div>
                        <div className="text-xl font-black text-blue-900 mt-1 tracking-tight">
                          {item.totalPeriods}<span className="text-xs font-semibold text-blue-700 ml-0.5">t</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">S:{item.morningPeriods} • C:{item.afternoonPeriods}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tiến độ PPCT</div>
                        <div className="text-xl font-black text-emerald-700 mt-1 tracking-tight">{item.coveragePercent}%</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{item.teacherCount} GV dạy</div>
                      </div>
                    </div>

                    <div className="mt-3 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                        <span>Mức độ đáp ứng khung tiết:</span>
                        <strong className="text-slate-800 font-bold">{item.totalPeriods}/{item.expectedPeriods} tiết</strong>
                      </div>
                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.coveragePercent >= 95 ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${item.coveragePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total School Aggregation Card */}
            <div
              onClick={() => setSelectedBranchId('ALL')}
              className={`p-4 sm:p-5 rounded-2xl border transition cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                selectedBranchId === 'ALL'
                  ? 'border-indigo-700 bg-indigo-50/40 ring-2 ring-indigo-700/20 shadow-xs'
                  : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-black text-xs shadow-2xs">
                      TT
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">Tổng hợp Toàn trường</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Bao gồm Điểm chính & Phân hiệu</p>
                    </div>
                  </div>
                  {selectedBranchId === 'ALL' && (
                    <span className="bg-indigo-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Đang chọn
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-slate-200/80">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tổng lớp</div>
                    <div className="text-xl font-black text-slate-900 mt-1 tracking-tight">{activeClasses.length}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">{activeClasses.reduce((s, c) => s + c.studentCount, 0)} HS</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tổng tiết/tuần</div>
                    <div className="text-xl font-black text-indigo-900 mt-1 tracking-tight">
                      {activeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0)}<span className="text-xs font-semibold text-indigo-700 ml-0.5">t</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">{allValidTeachers.length} GV</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 text-left flex flex-col justify-between">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cân đối</div>
                    <div className="text-xl font-black text-emerald-700 mt-1 tracking-tight">
                      {filterExactCount}<span className="text-xs font-bold ml-0.5">ĐỦ</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {filterDeficitCount > 0 ? `-${filterDeficitCount} thiếu` : 'Không thiếu'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1 font-medium">
                    <span>Tiến độ toàn trường:</span>
                    <strong className="text-slate-800 font-bold">
                      {activeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0)}/{activeClasses.length * 29} tiết
                    </strong>
                  </div>
                  <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (activeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0) /
                              (activeClasses.length * 29)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP KPI METRICS (4 CARDS ADAPTING TO BRANCH, DEPARTMENT & SUBJECT) */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2 flex-wrap">
            <span>Số liệu chỉ số:</span>
            <span className="text-blue-900 bg-blue-50 border border-blue-200/80 font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-700" />
              <span>{currentSelectedBranch ? currentSelectedBranch.name : 'Toàn trường'}</span>
            </span>

            {currentDepartment && (
              <span className="text-indigo-900 bg-indigo-50 border border-indigo-200/80 font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-700" />
                <span>Tổ: {currentDepartment.name}</span>
              </span>
            )}

            {currentSubject && (
              <span className="text-emerald-900 bg-emerald-50 border border-emerald-200/80 font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-emerald-700" />
                <span>Môn: {currentSubject.name}</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Dữ liệu tính toán thời gian thực</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Teachers in department / subject */}
          <div
            onClick={() => {
              setActiveViewMode('TEACHERS');
              const el = document.getElementById('dashboard-detailed-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>{selectedDepartmentId !== 'ALL' || selectedSubjectId !== 'ALL' ? 'Giáo viên bộ phận' : 'Đội ngũ giáo viên'}</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center group-hover:bg-blue-900 group-hover:text-white transition shadow-2xs">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 tracking-tight">
                {filteredTeachers.length}{' '}
                <span className="text-sm font-semibold text-slate-400">/ {scopedTeachers.length} GV</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between font-medium">
              <span>
                Đang dạy: <strong className="text-slate-800">{filterActiveTeachingTeachersCount}</strong>
                {selectedBranchId !== 'ALL' && (
                  <> • Cơ hữu: <strong className="text-slate-800">{filterPermanentTeachersCount}</strong></>
                )}
              </span>
              <span className="text-blue-700 font-bold group-hover:underline flex items-center gap-0.5">
                Xem DS <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 2: Classes taking this department / subject */}
          <div
            onClick={() => {
              setActiveViewMode('CLASSES');
              const el = document.getElementById('dashboard-detailed-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Số lớp phụ trách</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-900 flex items-center justify-center group-hover:bg-indigo-900 group-hover:text-white transition shadow-2xs">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 mt-3 tracking-tight">
                {filteredClasses.length} <span className="text-base font-semibold text-slate-400">lớp</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between font-medium">
              <span>Sĩ số: <strong className="text-slate-800">{filteredClasses.reduce((s, c) => s + c.studentCount, 0)} HS</strong></span>
              <span className="text-indigo-700 font-bold group-hover:underline flex items-center gap-0.5">
                Xem lớp <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 3: Total Periods for this department / subject */}
          <div
            onClick={() => onNavigate('assignments')}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Số tiết bộ môn/tổ</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-900 flex items-center justify-center group-hover:bg-emerald-900 group-hover:text-white transition shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-800 mt-3 tracking-tight">
                {filterAssignedPeriods}{' '}
                <span className="text-sm font-medium text-slate-400">
                  / {filterExpectedPeriods}t ({filterCoveragePercent}%)
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between font-medium">
              <span>
                Sáng: <strong className="text-slate-800">{filterMorningPeriods}</strong> • Chiều:{' '}
                <strong className="text-slate-800">{filterAfternoonPeriods}</strong>
              </span>
              <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-0.5">
                Bảng biểu <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Card 4: Quota Status */}
          <div
            onClick={() => onNavigate('validation')}
            className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Cân đối định mức tổ</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-900 flex items-center justify-center group-hover:bg-amber-900 group-hover:text-white transition shadow-2xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 flex items-center gap-2 tracking-tight">
                <span className="text-emerald-700">{filterExactCount} ĐỦ</span>
                {filterDeficitCount > 0 && (
                  <span className="text-red-700 text-xs sm:text-sm font-bold bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-lg">
                    -{filterDeficitCount} Thiếu
                  </span>
                )}
                {filterSurplusCount > 0 && (
                  <span className="text-amber-700 text-xs sm:text-sm font-bold bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg">
                    +{filterSurplusCount} Thừa
                  </span>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between font-medium">
              <span>
                Xung đột:{' '}
                <strong className={filteredConflicts.length > 0 ? 'text-red-700' : 'text-emerald-700'}>
                  {filteredConflicts.length}
                </strong>
              </span>
              <span className="text-amber-700 font-bold group-hover:underline flex items-center gap-0.5">
                Kiểm tra <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ALERT SECTION IF CONFLICTS EXIST IN THIS SCOPE */}
      {filteredConflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900">
                Phát hiện {filteredConflicts.length} lỗi / xung đột liên quan đến {trackingTitle}
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                {filteredConflicts[0]?.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('validation')}
            className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex-shrink-0 cursor-pointer"
          >
            Xem và sửa lỗi ngay
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHARTS ROW (ADAPTIVE DRILLDOWN) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Progress comparison (Span 2) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                {selectedDepartmentId !== 'ALL'
                  ? `Tiến độ các Môn học trong ${currentDepartment?.name || 'Tổ chuyên môn'}`
                  : selectedSubjectId !== 'ALL'
                  ? `Tiến độ môn ${currentSubject?.name || 'môn học'} theo từng Khối lớp`
                  : `Số tiết theo Tổ chuyên môn (${currentSelectedBranch ? currentSelectedBranch.name : 'Toàn trường'})`}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedDepartmentId !== 'ALL' || selectedSubjectId !== 'ALL'
                  ? 'Đối chiếu số tiết đã phân công với Khung phân phối chương trình (PPCT) từng môn'
                  : 'So sánh số tiết thực dạy, kiêm nhiệm, miễn giảm so với định mức'}
              </p>
            </div>

            {selectedDepartmentId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedDepartmentId('ALL')}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả tổ</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedDepartmentId !== 'ALL' || selectedSubjectId !== 'ALL' ? (
                <BarChart data={primaryChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Đã phân công" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Khung PPCT" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={primaryChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Giảng dạy" stackId="a" fill="#1e3a8a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Kiêm nhiệm" stackId="a" fill="#0d9488" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Miễn giảm" stackId="a" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Định mức chuẩn" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Quota Status Distribution (Span 1) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              Tỷ lệ định mức giáo viên
            </h3>
            <p className="text-xs text-slate-500">
              Đội ngũ {filteredTeachers.length} GV thuộc {trackingTitle}
            </p>
          </div>
          <div className="flex-1 flex items-center justify-center h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}:</span>
                <strong className="text-slate-900">{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOWER SECTION: GRADE SUMMARY + RECENT AUDIT LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade Breakdown Cards */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-700" />
                Khối lượng số tiết theo từng Khối lớp ({trackingTitle})
              </h3>
              <p className="text-xs text-slate-500">Phân bố số tiết thực tế đã gán theo từng khối tại cơ sở</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gradeData.map((g) => (
              <div key={g.grade} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">{g.grade}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                      {g.percent}%
                    </span>
                  </div>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {g.periods} <span className="text-xs font-normal text-slate-500">/ {g.expected}t</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{g.classes} lớp học</div>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${g.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Nhật ký điều chỉnh gần đây</h3>
            <button
              onClick={() => onNavigate('audit-feedback')}
              className="text-xs text-blue-700 font-semibold hover:underline cursor-pointer"
            >
              Tất cả
            </button>
          </div>
          <div className="space-y-2.5 overflow-y-auto max-h-48 pr-1 flex-1">
            {auditLogs.slice(0, 4).map((log) => (
              <div key={log.id} className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="font-bold text-slate-700">{log.userName}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                </div>
                <div className="text-slate-800 font-medium mt-0.5 line-clamp-1">{log.entityDescription}</div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="text-xs text-slate-400 text-center py-6">Chưa có thay đổi nào được ghi nhận</div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED TRACKING SECTION: TWO MODES (LỚP HỌC vs ĐỘI NGŨ GIÁO VIÊN) */}
      {/* ========================================================================= */}
      <div id="dashboard-detailed-section" className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        {/* Header with Mode Switcher & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              Chi tiết theo dõi: <span className="text-blue-900">{trackingTitle}</span>
              <span className="text-xs font-normal text-slate-500">
                ({currentSelectedBranch ? currentSelectedBranch.name : 'Toàn trường'})
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeViewMode === 'CLASSES'
                ? 'Xem chi tiết từng lớp học đã được phân công bao nhiêu tiết môn/tổ, giáo viên phụ trách và tỷ lệ đạt chuẩn'
                : 'Danh sách đầy đủ giáo viên trong tổ/bộ môn với các lớp phụ trách, số tiết giảng dạy, kiêm nhiệm, định mức và cân đối'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={detailSearchTerm}
                onChange={(e) => setDetailSearchTerm(e.target.value)}
                placeholder={activeViewMode === 'CLASSES' ? 'Tìm lớp, khối, GVCN...' : 'Tìm họ tên GV, mã, môn...'}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Segmented Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveViewMode('CLASSES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeViewMode === 'CLASSES'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Theo Lớp học ({detailedClassRows.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewMode('TEACHERS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeViewMode === 'TEACHERS'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Đội ngũ Giáo viên ({detailedTeacherRows.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================= MODE 1: THEO LỚP HỌC ======================= */}
        {activeViewMode === 'CLASSES' && (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Mã lớp</th>
                  <th className="py-2.5 px-3">Tên lớp</th>
                  <th className="py-2.5 px-3">Khối</th>
                  <th className="py-2.5 px-3">Điểm trường</th>
                  <th className="py-2.5 px-3">Sĩ số & Buổi</th>
                  <th className="py-2.5 px-3">GV Chủ nhiệm</th>
                  <th className="py-2.5 px-3">Tiết phân công ({trackingTitle})</th>
                  <th className="py-2.5 px-3">Tỷ lệ</th>
                  <th className="py-2.5 px-3">Giáo viên phụ trách môn tại lớp</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedClassRows.map((item) => (
                  <tr key={item.class.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{item.class.code}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.class.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-1.5 py-0.5 rounded">
                        Khối {item.class.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          item.class.branchId === 'branch_sub' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-900'
                        }`}
                      >
                        <MapPin className="w-2.5 h-2.5" />
                        {item.branchName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      <div>{item.class.studentCount} HS</div>
                      <div className="text-[10px] text-slate-400">
                        {item.class.session === 'MORNING' ? 'Sáng (B1)' : 'Chiều (B2)'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {item.homeroomTeacher ? (
                        <span className="font-semibold text-slate-800">{item.homeroomTeacher.fullName}</span>
                      ) : (
                        <span className="text-amber-600 italic">Chưa phân công</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <strong className="text-slate-800">
                        {item.assignedPeriods}/{item.expectedPeriods} tiết
                      </strong>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="w-28">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span
                            className={`font-bold ${
                              item.percent >= 100 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {item.percent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.percent >= 100 ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {item.assignedTeachersList.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.assignedTeachersList.map((at, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-200/60 rounded text-[10px] font-semibold"
                            >
                              <span>{at.teacher?.fullName || 'GV'}</span>
                              <strong className="text-blue-700">({at.periods}t)</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-red-600 italic text-[11px]">Chưa gán giáo viên</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onNavigate('assignments')}
                        className="text-blue-700 hover:text-blue-900 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Phân công</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {detailedClassRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Không tìm thấy lớp học nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ======================= MODE 2: THEO ĐỘI NGŨ GIÁO VIÊN ======================= */}
        {activeViewMode === 'TEACHERS' && (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Mã GV</th>
                  <th className="py-2.5 px-3">Họ và tên</th>
                  <th className="py-2.5 px-3">Tổ chuyên môn & Cơ sở</th>
                  <th className="py-2.5 px-3">Các lớp phụ trách</th>
                  <th className="py-2.5 px-3 text-center">Giảng dạy</th>
                  <th className="py-2.5 px-3 text-center">Kiêm nhiệm</th>
                  <th className="py-2.5 px-3 text-center">Miễn giảm</th>
                  <th className="py-2.5 px-3 text-center">Tổng nhận</th>
                  <th className="py-2.5 px-3 text-center">Định mức</th>
                  <th className="py-2.5 px-3 text-center">Tình trạng cân đối</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedTeacherRows.map((item) => (
                  <tr key={item.teacher.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{item.teacher.code}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.teacher.fullName}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.teacher.major || (item.teacher.subjectsCanTeach || []).join(', ') || 'Chuyên môn'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800">{item.department?.name || 'Chưa gán tổ'}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.teacher.workplace || (item.teacher.workplaceId === 'wp_sub' ? 'Phân hiệu' : 'Điểm chính')}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 max-w-[220px]">
                      {item.classesTaughtList.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.classesTaughtList.map((c, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-medium border border-slate-200"
                            >
                              {c.classCode} <strong className="text-blue-700 font-bold">({c.periods}t)</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chưa nhận lớp nào</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">{item.teachingPeriods}</td>
                    <td className="py-2.5 px-3 text-center text-teal-700 font-semibold">{item.concurrentPeriods}</td>
                    <td className="py-2.5 px-3 text-center text-amber-700 font-semibold">{item.exemptionPeriods}</td>
                    <td className="py-2.5 px-3 text-center font-black text-indigo-900 text-sm">
                      {item.totalAssigned}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">{item.standardQuota}</td>
                    <td className="py-2.5 px-3 text-center">
                      {item.resultStatus === 'EXACT' || item.resultStatus === 'EXACT_EXEMPT' ? (
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Đủ (0t)
                        </span>
                      ) : item.resultStatus === 'DEFICIT' ? (
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-red-100 text-red-800 border border-red-300">
                          Thiếu ({item.difference}t)
                        </span>
                      ) : item.resultStatus === 'SURPLUS' ? (
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                          Thừa (+{item.difference}t)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-600">
                          Chưa phân công
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onNavigate('assignments')}
                        className="text-blue-700 hover:text-blue-900 font-semibold text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {detailedTeacherRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      Không tìm thấy giáo viên nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
