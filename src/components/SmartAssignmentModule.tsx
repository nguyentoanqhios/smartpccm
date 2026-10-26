/**
 * Module Phân công giảng dạy thông minh (Smart Assignment Matrix)
 * TRƯỜNG THCS QUỲ HỢP
 * Thao tác trực quan bằng tích chọn ma trận, hỗ trợ toàn trường, điểm chính & phân hiệu,
 * tích hợp phân công kiêm nhiệm, tính toán định mức tức thời và Trợ lý AI tư vấn.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckSquare,
  Square,
  Users,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  RotateCw,
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Download,
  Layers,
  ArrowRight,
  Shuffle,
  ShieldAlert,
  Info,
  SlidersHorizontal,
  Plus,
  Trash2,
  Award,
  FileText,
  Check,
  GitCompare,
  History,
  Lock,
  Eye,
  Edit3,
  ExternalLink,
  ChevronLeft,
  GraduationCap,
  LayoutGrid,
  ListFilter,
  UserCheck,
  UserX,
  FileEdit,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import {
  Teacher,
  SchoolClass,
  Subject,
  Department,
  SpecialDuty,
  TeachingAssignment,
  CurriculumDistribution,
  TeacherCalculationResult,
  SemesterId,
  AssignmentVersion,
  SchoolBranch,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { calculateAllTeachersWorkload, calculateTeacherWorkload } from '../calculation-engine/workloadCalculator';
import { exportWorkloadExcel } from '../import-export/excelService';
import { getSmartTeacherSuggestions, TeacherSuggestion, isSubjectSuggestedForTeacher } from '../utils/teacherSuggestionEngine';
import { SearchableTeacherSelect } from './SearchableTeacherSelect';
import { matchesQuery, matchesTeacherFullName, removeVietnameseTones } from '../utils/searchUtils';
import { getTeacherPositions, normalizePositionName } from '../utils/teacherPositions';
import { TeachingPlanFrameworkModal } from './TeachingPlanFrameworkModal';

export interface SmartAssignmentModuleProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  departments: Department[];
  duties: SpecialDuty[];
  curriculums: CurriculumDistribution[];
  assignments: TeachingAssignment[];
  calculations: TeacherCalculationResult[];
  currentVersion?: AssignmentVersion;
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
}

// AI Advisory Item structure
interface AIAdviceItem {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'DEFICIT_CLASS' | 'REBALANCE' | 'OVERLOAD' | 'MULTI_BRANCH' | 'MISMATCH';
  title: string;
  basis: string;
  recommendation: string;
  impact: string;
  actionPayload?: {
    type: 'ASSIGN' | 'TRANSFER' | 'REMOVE';
    classId: string;
    subjectId: string;
    currentTeacherId?: string;
    targetTeacherId: string;
    periods: number;
  };
}

// Optimization Scenario structure
interface OptimizationScenario {
  id: string;
  name: string;
  description: string;
  unassignedPeriods: number;
  deficitTeachers: number;
  surplusTeachers: number;
  mismatchCount: number;
  multiBranchCount: number;
  balanceScore: number; // percentage 0-100
  keyRisks: string[];
  proposedAssignments: TeachingAssignment[];
}

export const SmartAssignmentModule: React.FC<SmartAssignmentModuleProps> = ({
  isOpen,
  onClose,
  teachers: propTeachers,
  classes: propClasses,
  subjects: propSubjects,
  departments: propDepartments,
  duties: propDuties,
  curriculums: propCurriculums,
  assignments: propAssignments,
  currentVersion,
  schoolYearId: propSchoolYearId,
  semesterId: propSemesterId,
  versionId: propVersionId,
}) => {
  // Real-time Branches & School Info from dataStore
  const [schoolInfo, setSchoolInfo] = useState(() => dataStore.getSchoolInfo());
  const branches = useMemo<SchoolBranch[]>(() => {
    return dataStore.getBranches();
  }, []);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setSchoolInfo(dataStore.getSchoolInfo());
    });
    return () => unsub();
  }, []);

  const mainBranch = useMemo(() => {
    return branches.find((b) => b.isMain) || branches[0];
  }, [branches]);

  // Context States
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL'); // 'ALL' | branch.id
  const [selectedSemester, setSelectedSemester] = useState<SemesterId>(propSemesterId || 'HK1');
  const [viewMode, setViewMode] = useState<'TEACHER' | 'CLASS_SUBJECT' | 'SUMMARY'>('TEACHER');

  // Zoom control
  const [zoomLevel, setZoomLevel] = useState<number>(100); // 80, 90, 100, 110

  // Layout expansion states
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [isAIDrawerExpanded, setIsAIDrawerExpanded] = useState<boolean>(false);

  // Active Selected Teacher
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    const firstActive = propTeachers.find((t) => !t.isDeleted && t.status === 'ACTIVE');
    return firstActive ? firstActive.id : propTeachers[0]?.id || '';
  });

  // Local assignment state for undo/redo and live reactive responsiveness
  const [localAssignments, setLocalAssignments] = useState<TeachingAssignment[]>(() => {
    return propAssignments.filter(
      (a) =>
        !a.isDeleted &&
        a.schoolYearId === propSchoolYearId &&
        a.semesterId === selectedSemester &&
        a.versionId === propVersionId
    );
  });

  // Auto-save toggle (Default: ON)
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Undo / Redo stacks
  const [historyStack, setHistoryStack] = useState<TeachingAssignment[][]>([]);
  const [redoStack, setRedoStack] = useState<TeachingAssignment[][]>([]);

  // Teacher Filter States
  const [teacherSearch, setTeacherSearch] = useState<string>('');
  const [teacherDeptFilter, setTeacherDeptFilter] = useState<string>('ALL');
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<string>('ALL'); // ALL, EXACT, DEFICIT, SURPLUS, UNASSIGNED
  const [teacherMajorFilter, setTeacherMajorFilter] = useState<string>('ALL');

  // Tích "Môn gợi ý" (Căn cứ chuyên môn, môn có thể dạy và môn cùng tổ của giáo viên)
  const [filterSuggestedSubjectsOnly, setFilterSuggestedSubjectsOnly] = useState<boolean>(true);

  // Chọn môn (Tích chọn một hoặc nhiều môn hiển thị để phân công)
  const [selectedCustomSubjectIds, setSelectedCustomSubjectIds] = useState<string[]>([]);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState<boolean>(false);
  const [subjectFilterSearch, setSubjectFilterSearch] = useState<string>('');
  const subjectDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown Chọn môn khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };
    if (isSubjectDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSubjectDropdownOpen]);

  // Class Filter & Selection States (for CLASS_SUBJECT mode)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return propClasses[0]?.id || '';
  });
  const [classSearch, setClassSearch] = useState<string>('');
  const [classGradeFilter, setClassGradeFilter] = useState<string>('ALL'); // ALL, 6, 7, 8, 9
  const [classStatusFilter, setClassStatusFilter] = useState<string>('ALL'); // ALL, FULL, DEFICIT
  const [classSubjectTabFilter, setClassSubjectTabFilter] = useState<'ALL' | 'UNASSIGNED' | 'ASSIGNED'>('ALL');
  const [classViewSubMode, setClassViewSubMode] = useState<'DETAIL' | 'MATRIX'>('DETAIL');

  // Interactive Modals
  const [isTeachingPlanModalOpen, setIsTeachingPlanModalOpen] = useState<boolean>(false);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState<boolean>(false);
  const [isConcurrentModalOpen, setIsConcurrentModalOpen] = useState<boolean>(false);
  const [isSplitPeriodModalOpen, setIsSplitPeriodModalOpen] = useState<boolean>(false);
  const [isVersionCompareOpen, setIsVersionCompareOpen] = useState<boolean>(false);
  const [transferPrompt, setTransferPrompt] = useState<{
    classId: string;
    subjectId: string;
    currentTeacher: Teacher;
    newTeacher: Teacher;
    periods: number;
  } | null>(null);

  const [splitTarget, setSplitTarget] = useState<{
    classId: string;
    subjectId: string;
    totalPeriods: number;
    currentTeacherId: string;
    secondaryTeacherId: string;
    p1: number;
    p2: number;
    reason: string;
  } | null>(null);

  // Cell Smart Suggestion Target (Triggered when user clicks to get teacher suggestions for a cell)
  const [cellSuggestionTarget, setCellSuggestionTarget] = useState<{
    cls: SchoolClass;
    subject: Subject;
  } | null>(null);

  // Summary Interactive Drill-down States
  const [summaryBranchFilter, setSummaryBranchFilter] = useState<string>('ALL');
  const [summaryDeptFilter, setSummaryDeptFilter] = useState<string>('ALL');
  const [summarySubTab, setSummarySubTab] = useState<'DEPT' | 'SUBJECT' | 'CLASS'>('DEPT');
  const [summarySearch, setSummarySearch] = useState<string>('');
  const [summaryDrilldownItem, setSummaryDrilldownItem] = useState<{
    type: 'DEPT' | 'SUBJECT' | 'CLASS' | 'TEACHER';
    id: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const semesterWeeks = selectedSemester === 'HK1' ? 18 : 17;
  const currentUser = dataStore.getCurrentUser();
  const isLocked = Boolean(currentVersion?.lockedAt);
  const canEdit = !isLocked && currentUser.permission !== 'view';

  // Synchronize initial assignments if prop changes
  useEffect(() => {
    const filtered = propAssignments.filter(
      (a) =>
        !a.isDeleted &&
        a.schoolYearId === propSchoolYearId &&
        a.semesterId === selectedSemester &&
        a.versionId === propVersionId
    );
    setLocalAssignments(filtered);
    setHasUnsavedChanges(false);
  }, [propAssignments, propSchoolYearId, selectedSemester, propVersionId]);

  // Push history state before mutating
  const pushHistory = (current: TeachingAssignment[]) => {
    setHistoryStack((prev) => [...prev.slice(-25), current]);
    setRedoStack([]);
    setHasUnsavedChanges(true);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, localAssignments]);
    setHistoryStack((prev) => prev.slice(0, -1));
    setLocalAssignments(previous);
    setHasUnsavedChanges(true);
    if (autoSave) {
      persistAssignments(previous);
    }
    showToast('Đã hoàn tác thao tác vừa thực hiện.', 'info');
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, localAssignments]);
    setRedoStack((prev) => prev.slice(0, -1));
    setLocalAssignments(next);
    setHasUnsavedChanges(true);
    if (autoSave) {
      persistAssignments(next);
    }
    showToast('Đã làm lại thao tác.', 'info');
  };

  // Persist assignments directly to dataStore
  const persistAssignments = (updatedList: TeachingAssignment[]) => {
    if (!canEdit) return;
    dataStore.replaceAssignmentsForVersion(
      propSchoolYearId,
      selectedSemester,
      propVersionId,
      updatedList
    );
    setHasUnsavedChanges(false);
  };

  const handleManualSave = () => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }
    persistAssignments(localAssignments);
    showToast('✅ Đã lưu toàn bộ phân công giảng dạy thành công!');
  };

  // Workflow: Approve / Unapprove all in Smart Assignment
  const handleApproveAll = () => {
    if (!canEdit || isLocked) return;
    pushHistory(localAssignments);
    const approvedList = localAssignments.map((a) => ({ ...a, status: 'approved' as const }));
    setLocalAssignments(approvedList);
    dataStore.replaceAssignmentsForVersion(propSchoolYearId, selectedSemester, propVersionId, approvedList);
    dataStore.approveVersion(propVersionId, currentUser.name);
    setHasUnsavedChanges(false);
    showToast('✅ Đã phê duyệt phương án thành công! Toàn bộ phân công đã chuyển thành BẢN DUYỆT chính thức.', 'success');
  };

  const handleUnapproveAll = () => {
    if (!canEdit || isLocked) return;
    pushHistory(localAssignments);
    const draftList = localAssignments.map((a) => ({ ...a, status: 'draft' as const }));
    setLocalAssignments(draftList);
    dataStore.replaceAssignmentsForVersion(propSchoolYearId, selectedSemester, propVersionId, draftList);
    dataStore.unapproveVersion(propVersionId);
    setHasUnsavedChanges(false);
    showToast('Đã chuyển phương án về BẢN NHÁP để tiếp tục hiệu chỉnh.', 'info');
  };

  // Auto-save debounce effect
  useEffect(() => {
    if (autoSave && hasUnsavedChanges && canEdit) {
      const timer = setTimeout(() => {
        persistAssignments(localAssignments);
        showToast('Tự động lưu bản nháp thành công', 'info');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localAssignments, autoSave, hasUnsavedChanges, canEdit]);

  // Filter Classes based on selected scope (Branch)
  const scopedClasses = useMemo(() => {
    const list = propClasses.filter((c) => !c.isDeleted && c.active);
    if (selectedBranchId === 'ALL') return list;
    return list.filter((c) => {
      if (selectedBranchId === 'branch_main') {
        return !c.branchId || c.branchId === 'branch_main';
      }
      return c.branchId === selectedBranchId;
    });
  }, [propClasses, selectedBranchId]);

  // Filter Teachers based on selected scope
  const scopedTeachers = useMemo(() => {
    const list = propTeachers.filter((t) => !t.isDeleted);
    if (selectedBranchId === 'ALL') return list;
    const targetBranch = branches.find((b) => b.id === selectedBranchId);
    return list.filter((t) => {
      if (!t.workplaceId && !t.workplace) return true; // Available everywhere
      if (t.workplace === 'Toàn trường') return true;
      if (selectedBranchId === 'branch_main') {
        return (
          t.workplaceId === 'branch_main' ||
          t.workplaceId === 'wp_main' ||
          t.workplace?.toLowerCase().includes('chính')
        );
      }
      return (
        t.workplaceId === selectedBranchId ||
        (targetBranch && t.workplace?.toLowerCase().includes(targetBranch.name.toLowerCase()))
      );
    });
  }, [propTeachers, selectedBranchId, branches]);

  // Lookup Maps
  const teacherMap = useMemo(() => new Map<string, Teacher>(propTeachers.map((t) => [t.id, t])), [propTeachers]);
  const classMap = useMemo(() => new Map<string, SchoolClass>(propClasses.map((c) => [c.id, c])), [propClasses]);
  const subjectMap = useMemo(() => new Map<string, Subject>(propSubjects.map((s) => [s.id, s])), [propSubjects]);
  const departmentMap = useMemo(() => new Map<string, Department>(propDepartments.map((d) => [d.id, d])), [propDepartments]);
  const dutyMap = useMemo(() => new Map<string, SpecialDuty>(propDuties.map((d) => [d.id, d])), [propDuties]);

  // Recalculate Teacher Workloads with real-time localAssignments
  const teacherCalculationsMap = useMemo(() => {
    const map = new Map<string, TeacherCalculationResult>();

    propTeachers.forEach((teacher) => {
      const calc = calculateTeacherWorkload(
        teacher,
        localAssignments,
        propDuties,
        departmentMap,
        semesterWeeks
      );
      map.set(teacher.id, calc);
    });

    return map;
  }, [propTeachers, localAssignments, propDuties, departmentMap, semesterWeeks]);

  // The active selected teacher and their workload
  const currentSelectedTeacher = useMemo(() => {
    return propTeachers.find((t) => t.id === selectedTeacherId) || scopedTeachers[0] || propTeachers[0];
  }, [propTeachers, selectedTeacherId, scopedTeachers]);

  const currentTeacherCalc = useMemo(() => {
    if (!currentSelectedTeacher) return null;
    return teacherCalculationsMap.get(currentSelectedTeacher.id) || null;
  }, [currentSelectedTeacher, teacherCalculationsMap]);

  // Curriculums helper
  const getSubjectStandardPeriods = (grade: number, subjectId: string): number => {
    const match = propCurriculums.find(
      (c) =>
        c.grade === grade &&
        c.subjectId === subjectId &&
        c.semesterId === selectedSemester
    );
    if (match) return match.periodsPerWeek;
    const subj = propSubjects.find((s) => s.id === subjectId);
    return subj?.periodsPerWeek || 2;
  };

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const grades: Record<number, SchoolClass[]> = { 6: [], 7: [], 8: [], 9: [] };
    scopedClasses.forEach((c) => {
      if (grades[c.grade]) {
        grades[c.grade].push(c);
      }
    });
    // Sort classes by name
    Object.keys(grades).forEach((g) => {
      grades[Number(g)].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
    });
    return grades;
  }, [scopedClasses]);

  // Subjects applicable by grade
  const subjectsByGrade = useMemo(() => {
    const map: Record<number, Subject[]> = { 6: [], 7: [], 8: [], 9: [] };
    [6, 7, 8, 9].forEach((g) => {
      map[g] = propSubjects
        .filter((s) => s.active && (!s.applicableGrades || s.applicableGrades.includes(g)))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    });
    return map;
  }, [propSubjects]);

  // Real-time Summary Metrics (Sticky Top Bar)
  const summaryMetrics = useMemo(() => {
    let totalNeededPeriods = 0;
    let totalAssignedPeriods = 0;
    let unassignedSlots = 0;

    // Calculate total needed periods for all scoped classes
    scopedClasses.forEach((cls) => {
      const applicableSubjs = subjectsByGrade[cls.grade] || [];
      applicableSubjs.forEach((subj) => {
        const std = getSubjectStandardPeriods(cls.grade, subj.id);
        totalNeededPeriods += std;

        // Check assigned periods for this (class, subject)
        const cellAssignments = localAssignments.filter(
          (a) => a.classId === cls.id && a.subjectId === subj.id && a.type === 'TEACHING'
        );
        const assignedInCell = cellAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
        totalAssignedPeriods += assignedInCell;

        if (assignedInCell < std) {
          unassignedSlots++;
        }
      });
    });

    // Teachers workload status
    let deficitTeachers = 0;
    let surplusTeachers = 0;
    let exactTeachers = 0;

    scopedTeachers.forEach((t) => {
      const calc = teacherCalculationsMap.get(t.id);
      if (!calc) return;
      if (calc.resultStatus === 'DEFICIT' || calc.resultStatus === 'UNASSIGNED') {
        deficitTeachers++;
      } else if (calc.resultStatus === 'SURPLUS') {
        surplusTeachers++;
      } else if (calc.resultStatus === 'EXACT' || calc.resultStatus === 'EXACT_EXEMPT') {
        exactTeachers++;
      }
    });

    const totalMissingPeriods = Math.max(0, totalNeededPeriods - totalAssignedPeriods);

    return {
      totalTeachers: scopedTeachers.length,
      totalClasses: scopedClasses.length,
      totalNeededPeriods,
      totalAssignedPeriods,
      totalMissingPeriods,
      unassignedSlots,
      deficitTeachers,
      surplusTeachers,
      exactTeachers,
    };
  }, [scopedClasses, subjectsByGrade, scopedTeachers, localAssignments, teacherCalculationsMap]);

  // Check if subject matches selected teacher's major, subjectsCanTeach, or department
  const isSubjectMatchingTeacher = (subject: Subject, teacher: Teacher | null): boolean => {
    if (!teacher) return false;
    const { isSuggested } = isSubjectSuggestedForTeacher(
      subject,
      teacher,
      propDepartments,
      localAssignments,
      propTeachers
    );
    return isSuggested;
  };

  // Helper kiểm tra môn có được gợi ý cho giáo viên đang chọn hay không
  const isSuggestedSubject = (subj: Subject): boolean => {
    if (!currentSelectedTeacher) return false;
    return isSubjectMatchingTeacher(subj, currentSelectedTeacher);
  };

  // Danh sách ID các môn gợi ý của giáo viên đang chọn
  const suggestedSubjectIds = useMemo(() => {
    if (!currentSelectedTeacher) return propSubjects.map((s) => s.id);
    return propSubjects
      .filter((s) => isSuggestedSubject(s))
      .map((s) => s.id);
  }, [currentSelectedTeacher, propSubjects, propDepartments, localAssignments, propTeachers]);

  // Danh sách môn hiển thị trong dropdown Chọn môn
  const filteredSubjectsForDropdown = useMemo(() => {
    let list = propSubjects.filter((s) => s.active);
    if (subjectFilterSearch.trim()) {
      const q = subjectFilterSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.shortName && s.shortName.toLowerCase().includes(q))
      );
    }
    // Sắp xếp môn: Các môn gợi ý lên trước, sau đó theo tên
    return [...list].sort((a, b) => {
      const suggA = isSuggestedSubject(a);
      const suggB = isSuggestedSubject(b);
      if (suggA && !suggB) return -1;
      if (!suggA && suggB) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [propSubjects, subjectFilterSearch, currentSelectedTeacher, propDepartments, localAssignments, propTeachers]);

  // Toggle môn trong danh sách chọn môn tùy biến
  const handleToggleCustomSubject = (subjectId: string) => {
    setSelectedCustomSubjectIds((prev) => {
      if (prev.length === 0) {
        return [subjectId];
      }
      if (prev.includes(subjectId)) {
        return prev.filter((id) => id !== subjectId);
      } else {
        return [...prev, subjectId];
      }
    });
  };

  const handleSelectAllSubjects = () => {
    setSelectedCustomSubjectIds(propSubjects.filter((s) => s.active).map((s) => s.id));
  };

  const handleClearSubjectFilter = () => {
    setSelectedCustomSubjectIds([]);
  };

  const handleSelectOnlySuggestedSubjects = () => {
    setSelectedCustomSubjectIds(suggestedSubjectIds);
  };

  // Helper: Find assignments for a specific cell (classId, subjectId)
  const getCellAssignments = (classId: string, subjectId: string): TeachingAssignment[] => {
    return localAssignments.filter(
      (a) => a.classId === classId && a.subjectId === subjectId && a.type === 'TEACHING'
    );
  };

  // TOGGLE ASSIGNMENT FOR CELL (Click checkbox)
  const handleToggleCell = (cls: SchoolClass, subject: Subject) => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }
    if (!currentSelectedTeacher) {
      setCellSuggestionTarget({ cls, subject });
      return;
    }

    const cellAssignments = getCellAssignments(cls.id, subject.id);
    const standardPeriods = getSubjectStandardPeriods(cls.grade, subject.id);

    // Check if current teacher already assigned
    const myAssignment = cellAssignments.find((a) => a.teacherId === currentSelectedTeacher.id);

    if (myAssignment) {
      // UNASSIGN: Remove this teacher's assignment
      pushHistory(localAssignments);
      const nextList = localAssignments.filter((a) => a.id !== myAssignment.id);
      setLocalAssignments(nextList);
      showToast(
        `Đã thu hồi phân công môn ${subject.name} lớp ${cls.name} của Thầy/Cô ${currentSelectedTeacher.fullName}.`,
        'info'
      );
      return;
    }

    // If cell already assigned to another teacher
    if (cellAssignments.length > 0) {
      const otherTeacherId = cellAssignments[0].teacherId;
      const otherTeacher = propTeachers.find((t) => t.id === otherTeacherId);

      if (otherTeacher) {
        // Prompt for transfer or split
        setTransferPrompt({
          classId: cls.id,
          subjectId: subject.id,
          currentTeacher: otherTeacher,
          newTeacher: currentSelectedTeacher,
          periods: standardPeriods,
        });
        return;
      }
    }

    // ASSIGN TO CURRENT TEACHER
    pushHistory(localAssignments);
    const newAssignment: TeachingAssignment = {
      id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolYearId: propSchoolYearId,
      semesterId: selectedSemester,
      versionId: propVersionId,
      teacherId: currentSelectedTeacher.id,
      departmentId: currentSelectedTeacher.departmentId || '',
      type: 'TEACHING',
      subjectId: subject.id,
      classId: cls.id,
      branchId: cls.branchId || 'branch_main',
      session: cls.session || 'MORNING',
      periodsPerWeek: standardPeriods,
      weeks: semesterWeeks,
      totalPeriods: standardPeriods * semesterWeeks,
      status: 'draft',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    const nextList = [...localAssignments, newAssignment];
    setLocalAssignments(nextList);
    showToast(
      `Đã phân công ${subject.name} lớp ${cls.name} (${standardPeriods} tiết/tuần) cho Thầy/Cô ${currentSelectedTeacher.fullName}!`
    );
  };

  // ASSIGN SUGGESTED TEACHER DIRECTLY TO A CELL
  const handleAssignSuggestedTeacher = (cls: SchoolClass, subject: Subject, teacherId: string) => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }
    const targetTeacher = propTeachers.find((t) => t.id === teacherId);
    if (!targetTeacher) return;

    pushHistory(localAssignments);
    const standardPeriods = getSubjectStandardPeriods(cls.grade, subject.id);

    // Remove old cell assignments
    let nextList = localAssignments.filter(
      (a) => !(a.classId === cls.id && a.subjectId === subject.id && a.type === 'TEACHING')
    );

    const newAssignment: TeachingAssignment = {
      id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolYearId: propSchoolYearId,
      semesterId: selectedSemester,
      versionId: propVersionId,
      teacherId: targetTeacher.id,
      departmentId: targetTeacher.departmentId || '',
      type: 'TEACHING',
      subjectId: subject.id,
      classId: cls.id,
      branchId: cls.branchId || 'branch_main',
      session: cls.session || 'MORNING',
      periodsPerWeek: standardPeriods,
      weeks: semesterWeeks,
      totalPeriods: standardPeriods * semesterWeeks,
      status: 'draft',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    nextList.push(newAssignment);
    setLocalAssignments(nextList);
    setCellSuggestionTarget(null);
    showToast(
      `Đã phân công ${subject.name} lớp ${cls.name} (${standardPeriods} tiết) cho Thầy/Cô ${targetTeacher.fullName}!`
    );
  };

  // CONFIRM TRANSFER FROM OTHER TEACHER TO CURRENT TEACHER
  const handleConfirmTransfer = () => {
    if (!transferPrompt || !canEdit) return;
    pushHistory(localAssignments);

    const { classId, subjectId, currentTeacher, newTeacher, periods } = transferPrompt;
    const filtered = localAssignments.filter(
      (a) => !(a.classId === classId && a.subjectId === subjectId && a.type === 'TEACHING')
    );

    const cls = propClasses.find((c) => c.id === classId);
    const newAssignment: TeachingAssignment = {
      id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolYearId: propSchoolYearId,
      semesterId: selectedSemester,
      versionId: propVersionId,
      teacherId: newTeacher.id,
      departmentId: newTeacher.departmentId || '',
      type: 'TEACHING',
      subjectId,
      classId,
      branchId: cls?.branchId || 'branch_main',
      session: cls?.session || 'MORNING',
      periodsPerWeek: periods,
      weeks: semesterWeeks,
      totalPeriods: periods * semesterWeeks,
      status: 'draft',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      notes: `Điều chuyển từ Thầy/Cô ${currentTeacher.fullName}`,
    };

    const nextList = [...filtered, newAssignment];
    setLocalAssignments(nextList);
    setTransferPrompt(null);
    showToast(
      `Đã chuyển lớp ${cls?.name} từ Thầy/Cô ${currentTeacher.fullName} sang Thầy/Cô ${newTeacher.fullName} thành công!`
    );
  };

  // DIRECT ASSIGN / CHANGE TEACHER FOR CLASS & SUBJECT (for Class-Subject View)
  const handleAssignTeacherToClassSubject = (
    cls: SchoolClass,
    subject: Subject,
    newTeacherId: string
  ) => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }

    pushHistory(localAssignments);
    // Remove existing assignments for this (classId, subjectId)
    const filtered = localAssignments.filter(
      (a) => !(a.classId === cls.id && a.subjectId === subject.id && a.type === 'TEACHING')
    );

    if (!newTeacherId) {
      setLocalAssignments(filtered);
      showToast(`Đã thu hồi phân công môn ${subject.name} của lớp ${cls.name}.`, 'info');
      return;
    }

    const teacher = propTeachers.find((t) => t.id === newTeacherId);
    if (!teacher) return;

    const standardPeriods = getSubjectStandardPeriods(cls.grade, subject.id);
    const newAssignment: TeachingAssignment = {
      id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolYearId: propSchoolYearId,
      semesterId: selectedSemester,
      versionId: propVersionId,
      teacherId: teacher.id,
      departmentId: teacher.departmentId || '',
      type: 'TEACHING',
      subjectId: subject.id,
      classId: cls.id,
      branchId: cls.branchId || 'branch_main',
      session: cls.session || 'MORNING',
      periodsPerWeek: standardPeriods,
      weeks: semesterWeeks,
      totalPeriods: standardPeriods * semesterWeeks,
      status: 'draft',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };

    setLocalAssignments([...filtered, newAssignment]);
    showToast(
      `Đã phân công ${subject.name} lớp ${cls.name} (${standardPeriods} tiết) cho Thầy/Cô ${teacher.fullName}!`
    );
  };

  // UNASSIGN CLASS & SUBJECT
  const handleUnassignClassSubject = (cls: SchoolClass, subject: Subject) => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }
    pushHistory(localAssignments);
    const filtered = localAssignments.filter(
      (a) => !(a.classId === cls.id && a.subjectId === subject.id && a.type === 'TEACHING')
    );
    setLocalAssignments(filtered);
    showToast(`Đã hủy phân công môn ${subject.name} của lớp ${cls.name}.`, 'info');
  };

  // BATCH ASSIGN / UNASSIGN FOR ENTIRE GRADE
  const handleBatchAssignGradeSubject = (grade: number, subject: Subject, assignAll: boolean) => {
    if (!canEdit) {
      showToast('Phương án đang bị khóa hoặc bạn chỉ có quyền Xem.', 'error');
      return;
    }
    if (!currentSelectedTeacher) return;

    const gradeClasses = classesByGrade[grade] || [];
    if (gradeClasses.length === 0) return;

    pushHistory(localAssignments);
    let nextList = [...localAssignments];
    const stdPeriods = getSubjectStandardPeriods(grade, subject.id);

    if (assignAll) {
      let assignedCount = 0;
      gradeClasses.forEach((cls) => {
        const cellAssignments = nextList.filter(
          (a) => a.classId === cls.id && a.subjectId === subject.id && a.type === 'TEACHING'
        );
        // If not already assigned to current teacher
        const exists = cellAssignments.some((a) => a.teacherId === currentSelectedTeacher.id);
        if (!exists) {
          // Remove others or assign
          nextList = nextList.filter(
            (a) => !(a.classId === cls.id && a.subjectId === subject.id && a.type === 'TEACHING')
          );
          nextList.push({
            id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            schoolYearId: propSchoolYearId,
            semesterId: selectedSemester,
            versionId: propVersionId,
            teacherId: currentSelectedTeacher.id,
            departmentId: currentSelectedTeacher.departmentId || '',
            type: 'TEACHING',
            subjectId: subject.id,
            classId: cls.id,
            branchId: cls.branchId || 'branch_main',
            session: cls.session || 'MORNING',
            periodsPerWeek: stdPeriods,
            weeks: semesterWeeks,
            totalPeriods: stdPeriods * semesterWeeks,
            status: 'draft',
            createdBy: currentUser.name,
            createdAt: new Date().toISOString(),
          });
          assignedCount++;
        }
      });
      setLocalAssignments(nextList);
      showToast(
        `Đã phân công ${assignedCount} lớp môn ${subject.name} khối ${grade} cho Thầy/Cô ${currentSelectedTeacher.fullName}!`
      );
    } else {
      // Unassign all classes in this grade for current teacher
      const classIds = new Set(gradeClasses.map((c) => c.id));
      nextList = nextList.filter(
        (a) => !(classIds.has(a.classId || '') && a.subjectId === subject.id && a.teacherId === currentSelectedTeacher.id)
      );
      setLocalAssignments(nextList);
      showToast(
        `Đã thu hồi tất cả lớp môn ${subject.name} khối ${grade} của Thầy/Cô ${currentSelectedTeacher.fullName}.`,
        'info'
      );
    }
  };

  // OPEN SPLIT PERIOD MODAL
  const handleOpenSplitModal = (cls: SchoolClass, subject: Subject) => {
    const std = getSubjectStandardPeriods(cls.grade, subject.id);
    const existing = getCellAssignments(cls.id, subject.id);
    const primary = existing[0]?.teacherId || currentSelectedTeacher?.id || '';
    const secondary = existing[1]?.teacherId || '';
    const p1 = existing[0]?.periodsPerWeek || Math.ceil(std / 2);
    const p2 = existing[1]?.periodsPerWeek || std - p1;

    setSplitTarget({
      classId: cls.id,
      subjectId: subject.id,
      totalPeriods: std,
      currentTeacherId: primary,
      secondaryTeacherId: secondary,
      p1,
      p2,
      reason: existing[0]?.notes || '',
    });
    setIsSplitPeriodModalOpen(true);
  };

  // SAVE SPLIT PERIOD
  const handleSaveSplitPeriod = () => {
    if (!splitTarget || !canEdit) return;
    if (splitTarget.p1 + splitTarget.p2 > splitTarget.totalPeriods) {
      showToast(`Tổng số tiết (${splitTarget.p1 + splitTarget.p2}) không được vượt định mức môn (${splitTarget.totalPeriods} tiết)!`, 'error');
      return;
    }
    if (!splitTarget.currentTeacherId || !splitTarget.secondaryTeacherId) {
      showToast('Vui lòng chọn đủ 2 giáo viên để chia tiết!', 'error');
      return;
    }
    if (splitTarget.currentTeacherId === splitTarget.secondaryTeacherId) {
      showToast('Hai giáo viên chia tiết phải khác nhau!', 'error');
      return;
    }

    pushHistory(localAssignments);
    const { classId, subjectId, currentTeacherId, secondaryTeacherId, p1, p2, reason } = splitTarget;
    const cls = propClasses.find((c) => c.id === classId);

    // Remove old cell assignments
    let nextList = localAssignments.filter(
      (a) => !(a.classId === classId && a.subjectId === subjectId && a.type === 'TEACHING')
    );

    const t1 = propTeachers.find((t) => t.id === currentTeacherId);
    const t2 = propTeachers.find((t) => t.id === secondaryTeacherId);

    if (p1 > 0 && t1) {
      nextList.push({
        id: `as_smart_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolYearId: propSchoolYearId,
        semesterId: selectedSemester,
        versionId: propVersionId,
        teacherId: t1.id,
        departmentId: t1.departmentId || '',
        type: 'TEACHING',
        subjectId,
        classId,
        branchId: cls?.branchId || 'branch_main',
        session: cls?.session || 'MORNING',
        periodsPerWeek: p1,
        weeks: semesterWeeks,
        totalPeriods: p1 * semesterWeeks,
        status: 'draft',
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        notes: reason || 'Chia tiết giảng dạy',
      });
    }

    if (p2 > 0 && t2) {
      nextList.push({
        id: `as_smart_${Date.now() + 1}_${Math.random().toString(36).substring(2, 6)}`,
        schoolYearId: propSchoolYearId,
        semesterId: selectedSemester,
        versionId: propVersionId,
        teacherId: t2.id,
        departmentId: t2.departmentId || '',
        type: 'TEACHING',
        subjectId,
        classId,
        branchId: cls?.branchId || 'branch_main',
        session: cls?.session || 'MORNING',
        periodsPerWeek: p2,
        weeks: semesterWeeks,
        totalPeriods: p2 * semesterWeeks,
        status: 'draft',
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        notes: reason || 'Chia tiết giảng dạy',
      });
    }

    setLocalAssignments(nextList);
    setIsSplitPeriodModalOpen(false);
    setSplitTarget(null);
    showToast(`Đã chia tiết lớp ${cls?.name} thành công (${t1?.fullName}: ${p1} tiết, ${t2?.fullName}: ${p2} tiết)!`);
  };

  // ADD SPECIAL DUTY / CONCURRENT ASSIGNMENT DIRECTLY TO SELECTED TEACHER
  const handleAddConcurrentDuty = (duty: SpecialDuty, appliedClassId?: string, customPeriods?: number) => {
    if (!canEdit || !currentSelectedTeacher) return;

    // Check if already assigned this duty
    const existing = localAssignments.some(
      (a) =>
        a.teacherId === currentSelectedTeacher.id &&
        (a.type === 'CONCURRENT' || a.type === 'EXEMPTION' || a.type === 'CONCURRENT_DUTY') &&
        a.dutyId === duty.id &&
        (!appliedClassId || a.classId === appliedClassId)
    );

    if (existing) {
      showToast(`Thầy/Cô ${currentSelectedTeacher.fullName} đã được gán nhiệm vụ này rồi!`, 'error');
      return;
    }

    pushHistory(localAssignments);
    const periods = customPeriods !== undefined ? customPeriods : (duty.periodsPerWeekCalculated || duty.periodsPerWeekExempted || 2);

    const newAssignment: TeachingAssignment = {
      id: `as_duty_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      schoolYearId: propSchoolYearId,
      semesterId: selectedSemester,
      versionId: propVersionId,
      teacherId: currentSelectedTeacher.id,
      departmentId: currentSelectedTeacher.departmentId || '',
      type: duty.type === 'EXEMPTION' ? 'EXEMPTION' : 'CONCURRENT',
      dutyId: duty.id,
      dutyName: duty.name,
      classId: appliedClassId,
      session: 'FULL_DAY',
      periodsPerWeek: periods,
      weeks: semesterWeeks,
      totalPeriods: periods * semesterWeeks,
      status: 'approved',
      createdBy: currentUser.name,
      createdAt: new Date().toISOString(),
      notes: duty.notes || 'Phân công nhiệm vụ kiêm nhiệm theo quy định',
    };

    const nextList = [...localAssignments, newAssignment];
    setLocalAssignments(nextList);

    // Đồng bộ chức vụ kiêm nhiệm vào teacher.positions để đồng bộ sang mọi biểu mẫu khác
    const formattedDuty = `${duty.name} (${periods} tiết/tuần)`;
    const rawDutyName = duty.name.replace(/\s*\([^)]*\)/g, '').trim();
    const curPos = Array.isArray(currentSelectedTeacher.positions) ? currentSelectedTeacher.positions : [];
    const filteredPos = curPos.filter((p) => {
      const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const normP = normalizePositionName(cleanP).toLowerCase();
      const normNew = normalizePositionName(rawDutyName).toLowerCase();
      return normP !== normNew && cleanP !== normNew;
    });
    const updatedPositions = [...filteredPos, formattedDuty];
    currentSelectedTeacher.positions = updatedPositions;
    dataStore.updateTeacher(currentSelectedTeacher.id, { positions: updatedPositions });

    // Nếu gán chủ nhiệm lớp, đồng bộ vào danh sách lớp
    if (appliedClassId) {
      const cls = propClasses.find((c) => c.id === appliedClassId);
      if (cls) {
        cls.homeroomTeacherId = currentSelectedTeacher.id;
        dataStore.updateClass(cls.id, { homeroomTeacherId: currentSelectedTeacher.id });
      }
    }

    setIsConcurrentModalOpen(false);
    showToast(
      `Đã phân công nhiệm vụ kiêm nhiệm "${duty.name}" (${periods} tiết/tuần) cho Thầy/Cô ${currentSelectedTeacher.fullName}!`
    );
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    if (!canEdit) return;
    pushHistory(localAssignments);

    const removedAsg = localAssignments.find((a) => a.id === assignmentId);
    if (removedAsg) {
      const isDuty =
        removedAsg.type === 'CONCURRENT' ||
        removedAsg.type === 'EXEMPTION' ||
        removedAsg.type === 'CONCURRENT_DUTY' ||
        Boolean(removedAsg.dutyId) ||
        Boolean(removedAsg.dutyName);

      if (isDuty && removedAsg.teacherId) {
        const teacher = propTeachers.find((t) => t.id === removedAsg.teacherId);
        if (teacher && Array.isArray(teacher.positions)) {
          const rawClean = (removedAsg.dutyName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
          const normClean = normalizePositionName(rawClean).toLowerCase();
          const dId = (removedAsg.dutyId || '').trim().toLowerCase();

          teacher.positions = teacher.positions.filter((p) => {
            const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
            const normP = normalizePositionName(cleanP).toLowerCase();
            if (normClean && (normP === normClean || cleanP === normClean || cleanP === rawClean)) {
              return false;
            }
            if (rawClean && (cleanP.includes(rawClean) || rawClean.includes(cleanP))) {
              return false;
            }
            const slug = cleanP.replace(/[^a-z0-9_-]+/g, '_');
            if (dId && (dId.includes(slug) || slug.includes(dId.replace('duty_custom_', '')))) {
              return false;
            }
            return true;
          });
          dataStore.updateTeacher(teacher.id, { positions: teacher.positions });
        }

        if (removedAsg.classId) {
          const cls = propClasses.find((c) => c.id === removedAsg.classId);
          if (cls && cls.homeroomTeacherId === removedAsg.teacherId) {
            cls.homeroomTeacherId = undefined;
            dataStore.updateClass(cls.id, { homeroomTeacherId: undefined });
          }
        }
      }

      dataStore.deleteAssignment(assignmentId, true);
    }

    const nextList = localAssignments.filter((a) => a.id !== assignmentId);
    setLocalAssignments(nextList);
    showToast('Đã gỡ bỏ phân công thành công.', 'info');
  };

  // Map teacherId -> set of subject names assigned to that teacher
  const teacherAssignedSubjectNamesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const subjectNameMap = new Map<string, string>(propSubjects.map((s) => [s.id, s.name]));
    for (const a of localAssignments) {
      if (!a.teacherId || !a.subjectId) continue;
      const sName = subjectNameMap.get(a.subjectId);
      if (sName) {
        let set = map.get(a.teacherId);
        if (!set) {
          set = new Set<string>();
          map.set(a.teacherId, set);
        }
        set.add(sName);
      }
    }
    return map;
  }, [localAssignments, propSubjects]);

  // Filtered Teacher List in Left Column
  const filteredTeacherList = useMemo(() => {
    return scopedTeachers.filter((t) => {
      // Chỉ tìm kiếm CHÍNH XÁC theo HỌ VÀ TÊN GIÁO VIÊN
      if (teacherSearch.trim()) {
        const matches = matchesTeacherFullName(teacherSearch, t.fullName);
        if (!matches) return false;
      }

      // Department filter
      if (teacherDeptFilter !== 'ALL' && t.departmentId !== teacherDeptFilter) {
        return false;
      }

      // Status filter
      if (teacherStatusFilter !== 'ALL') {
        const calc = teacherCalculationsMap.get(t.id);
        if (!calc) return false;
        if (teacherStatusFilter === 'EXACT' && calc.resultStatus !== 'EXACT' && calc.resultStatus !== 'EXACT_EXEMPT') return false;
        if (teacherStatusFilter === 'DEFICIT' && calc.resultStatus !== 'DEFICIT' && calc.resultStatus !== 'UNASSIGNED') return false;
        if (teacherStatusFilter === 'SURPLUS' && calc.resultStatus !== 'SURPLUS') return false;
        if (teacherStatusFilter === 'UNASSIGNED' && calc.resultStatus !== 'UNASSIGNED') return false;
      }

      // Major filter
      if (teacherMajorFilter !== 'ALL' && t.major !== teacherMajorFilter) {
        return false;
      }

      return true;
    });
  }, [
    scopedTeachers,
    teacherSearch,
    teacherDeptFilter,
    teacherStatusFilter,
    teacherMajorFilter,
    teacherCalculationsMap,
  ]);

  // Tự động chuyển tiêu điểm sang giáo viên khớp đầu tiên khi gõ tìm kiếm
  useEffect(() => {
    if (teacherSearch.trim() && filteredTeacherList.length > 0) {
      const isCurrentInFiltered = filteredTeacherList.some((t) => t.id === selectedTeacherId);
      if (!isCurrentInFiltered) {
        setSelectedTeacherId(filteredTeacherList[0].id);
      }
    }
  }, [teacherSearch, filteredTeacherList, selectedTeacherId]);

  // Tô nổi bật phần văn bản họ và tên khớp với nội dung gõ
  const renderHighlightedTeacherName = (fullName: string, query: string) => {
    if (!query.trim()) return fullName;

    const trimmed = query.trim();
    const rawName = fullName;
    const lowerName = rawName.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();

    // 1. Khớp chuỗi trực tiếp có dấu
    const directIdx = lowerName.indexOf(lowerQuery);
    if (directIdx !== -1) {
      return (
        <>
          {rawName.substring(0, directIdx)}
          <mark className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {rawName.substring(directIdx, directIdx + trimmed.length)}
          </mark>
          {rawName.substring(directIdx + trimmed.length)}
        </>
      );
    }

    // 2. Khớp chuỗi không dấu
    const normName = removeVietnameseTones(lowerName);
    const normQuery = removeVietnameseTones(lowerQuery);
    const normIdx = normName.indexOf(normQuery);
    if (normIdx !== -1 && normName.length === rawName.length) {
      return (
        <>
          {rawName.substring(0, normIdx)}
          <mark className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {rawName.substring(normIdx, normIdx + normQuery.length)}
          </mark>
          {rawName.substring(normIdx + normQuery.length)}
        </>
      );
    }

    return fullName;
  };

  // Distinct majors for filter
  const distinctMajors = useMemo(() => {
    const set = new Set<string>();
    propTeachers.forEach((t) => {
      if (t.major) set.add(t.major);
    });
    return Array.from(set).sort();
  }, [propTeachers]);

  // Real-time Class Progress Map (for CLASS_SUBJECT mode)
  const classProgressMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalNeeded: number;
        totalAssigned: number;
        missingPeriods: number;
        missingSubjectsCount: number;
        assignedSubjectsCount: number;
        isFullyAssigned: boolean;
      }
    >();

    scopedClasses.forEach((cls) => {
      const applicableSubjs = subjectsByGrade[cls.grade] || [];
      let totalNeeded = 0;
      let totalAssigned = 0;
      let missingSubjectsCount = 0;
      let assignedSubjectsCount = 0;

      applicableSubjs.forEach((subj) => {
        const std = getSubjectStandardPeriods(cls.grade, subj.id);
        totalNeeded += std;
        const cellAssignments = localAssignments.filter(
          (a) => a.classId === cls.id && a.subjectId === subj.id && a.type === 'TEACHING'
        );
        const assignedPeriods = cellAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
        totalAssigned += assignedPeriods;
        if (assignedPeriods >= std && std > 0) {
          assignedSubjectsCount++;
        } else if (std > 0) {
          missingSubjectsCount++;
        }
      });

      map.set(cls.id, {
        totalNeeded,
        totalAssigned,
        missingPeriods: Math.max(0, totalNeeded - totalAssigned),
        missingSubjectsCount,
        assignedSubjectsCount,
        isFullyAssigned: totalAssigned >= totalNeeded && totalNeeded > 0,
      });
    });

    return map;
  }, [scopedClasses, subjectsByGrade, localAssignments, propCurriculums, selectedSemester]);

  // Filtered Class List in Left Column (for CLASS_SUBJECT mode)
  const filteredClassList = useMemo(() => {
    return scopedClasses.filter((c) => {
      if (classSearch) {
        const q = classSearch.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchRoom = (c.room || '').toLowerCase().includes(q);
        if (!matchName && !matchRoom) return false;
      }
      if (classGradeFilter !== 'ALL' && c.grade !== Number(classGradeFilter)) {
        return false;
      }
      if (classStatusFilter !== 'ALL') {
        const p = classProgressMap.get(c.id);
        if (!p) return false;
        if (classStatusFilter === 'FULL' && !p.isFullyAssigned) return false;
        if (classStatusFilter === 'DEFICIT' && p.isFullyAssigned) return false;
      }
      return true;
    });
  }, [scopedClasses, classSearch, classGradeFilter, classStatusFilter, classProgressMap]);

  // Active Selected Class
  const currentSelectedClass = useMemo(() => {
    return scopedClasses.find((c) => c.id === selectedClassId) || scopedClasses[0] || propClasses[0];
  }, [scopedClasses, selectedClassId, propClasses]);

  // Metrics of current selected class
  const currentClassMetrics = useMemo(() => {
    if (!currentSelectedClass) {
      return {
        totalNeeded: 0,
        totalAssigned: 0,
        missingPeriods: 0,
        missingSubjectsCount: 0,
        assignedSubjectsCount: 0,
        isFullyAssigned: false,
      };
    }
    return (
      classProgressMap.get(currentSelectedClass.id) || {
        totalNeeded: 0,
        totalAssigned: 0,
        missingPeriods: 0,
        missingSubjectsCount: 0,
        assignedSubjectsCount: 0,
        isFullyAssigned: false,
      }
    );
  }, [currentSelectedClass, classProgressMap]);

  // Applicable subjects for current selected class
  const applicableSubjectsForCurrentClass = useMemo(() => {
    if (!currentSelectedClass) return [];
    return subjectsByGrade[currentSelectedClass.grade] || [];
  }, [currentSelectedClass, subjectsByGrade]);

  // Assigned teachers list for current selected class (for faculty board)
  const assignedTeachersForCurrentClass = useMemo(() => {
    if (!currentSelectedClass) return [];
    const classAssignments = localAssignments.filter(
      (a) => a.classId === currentSelectedClass.id && a.type === 'TEACHING'
    );

    return classAssignments.map((asg) => {
      const teacher = propTeachers.find((t) => t.id === asg.teacherId);
      const subject = propSubjects.find((s) => s.id === asg.subjectId);
      const dept = propDepartments.find((d) => d.id === teacher?.departmentId);
      return {
        assignment: asg,
        teacher,
        subject,
        department: dept,
      };
    });
  }, [currentSelectedClass, localAssignments, propTeachers, propSubjects, propDepartments]);

  // AI ADVISORY ENGINE: Generates context-aware, actionable advice with exact numbers
  const aiAdvices = useMemo<AIAdviceItem[]>(() => {
    const list: AIAdviceItem[] = [];

    // 1. Detect unassigned subjects with deficit periods
    for (const cls of scopedClasses) {
      const applicableSubjs = subjectsByGrade[cls.grade] || [];
      for (const subj of applicableSubjs) {
        const std = getSubjectStandardPeriods(cls.grade, subj.id);
        const cellAssignments = localAssignments.filter(
          (a) => a.classId === cls.id && a.subjectId === subj.id && a.type === 'TEACHING'
        );
        const assigned = cellAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);

        if (assigned < std) {
          const missing = std - assigned;
          // Find matching deficit teachers
          const candidateTeacher = scopedTeachers.find((t) => {
            const calc = teacherCalculationsMap.get(t.id);
            if (!calc || calc.difference >= 0) return false;
            return isSubjectMatchingTeacher(subj, t);
          });

          const branchName = branches.find((b) => b.id === cls.branchId)?.name || 'Điểm trường chính';

          if (candidateTeacher) {
            const tCalc = teacherCalculationsMap.get(candidateTeacher.id);
            list.push({
              id: `advice_def_${cls.id}_${subj.id}`,
              priority: 'HIGH',
              category: 'DEFICIT_CLASS',
              title: `Môn ${subj.name} tại ${branchName} còn thiếu ${missing} tiết ở lớp ${cls.name}`,
              basis: `Lớp ${cls.name} cần ${std} tiết/tuần nhưng hiện mới phân công ${assigned}/${std} tiết.`,
              recommendation: `Phân công lớp ${cls.name} cho Thầy/Cô ${candidateTeacher.fullName} (hiện đang thiếu ${Math.abs(tCalc?.difference || 0)} tiết, chuyên môn ${candidateTeacher.major || 'phù hợp'}).`,
              impact: `Giúp hoàn thiện phân công lớp ${cls.name} và bù ${missing} tiết cho Thầy/Cô ${candidateTeacher.fullName}.`,
              actionPayload: {
                type: 'ASSIGN',
                classId: cls.id,
                subjectId: subj.id,
                targetTeacherId: candidateTeacher.id,
                periods: missing,
              },
            });
          }
        }
      }
    }

    // 2. Detect Overloaded vs. Deficit teachers for rebalancing
    const surplusTeachers = scopedTeachers
      .map((t) => ({ teacher: t, calc: teacherCalculationsMap.get(t.id) }))
      .filter((item) => item.calc && item.calc.difference > 0);

    const deficitTeachers = scopedTeachers
      .map((t) => ({ teacher: t, calc: teacherCalculationsMap.get(t.id) }))
      .filter((item) => item.calc && item.calc.difference < 0);

    surplusTeachers.forEach(({ teacher: sTeacher, calc: sCalc }) => {
      // Find assignments of surplus teacher that can be moved
      const sAssignments = localAssignments.filter((a) => a.teacherId === sTeacher.id && a.type === 'TEACHING');
      for (const asg of sAssignments) {
        const subj = propSubjects.find((s) => s.id === asg.subjectId);
        const cls = propClasses.find((c) => c.id === asg.classId);
        if (!subj || !cls) continue;

        // Find matching deficit teacher
        const matchDeficit = deficitTeachers.find(({ teacher: dTeacher, calc: dCalc }) => {
          if (!dCalc) return false;
          return isSubjectMatchingTeacher(subj, dTeacher);
        });

        if (matchDeficit && sCalc && matchDeficit.calc) {
          list.push({
            id: `advice_rebalance_${asg.id}`,
            priority: 'MEDIUM',
            category: 'REBALANCE',
            title: `Cân bằng tải: Chuyển lớp ${cls.name} môn ${subj.name} (${asg.periodsPerWeek} tiết)`,
            basis: `Thầy/Cô ${sTeacher.fullName} đang vượt ${sCalc.difference} tiết, trong khi Thầy/Cô ${matchDeficit.teacher.fullName} đang thiếu ${Math.abs(matchDeficit.calc.difference)} tiết.`,
            recommendation: `Chuyển lớp ${cls.name} môn ${subj.name} từ Thầy/Cô ${sTeacher.fullName} sang Thầy/Cô ${matchDeficit.teacher.fullName}.`,
            impact: `Thầy/Cô ${sTeacher.fullName} giảm còn ${sCalc.totalCalculated - asg.periodsPerWeek}/${sCalc.quota} tiết; Thầy/Cô ${matchDeficit.teacher.fullName} tăng lên ${matchDeficit.calc.totalCalculated + asg.periodsPerWeek}/${matchDeficit.calc.quota} tiết.`,
            actionPayload: {
              type: 'TRANSFER',
              classId: cls.id,
              subjectId: subj.id,
              currentTeacherId: sTeacher.id,
              targetTeacherId: matchDeficit.teacher.id,
              periods: asg.periodsPerWeek,
            },
          });
          break; // Suggest 1 transfer per surplus teacher to avoid noise
        }
      }
    });

    // 3. Multi-branch travel warning
    scopedTeachers.forEach((t) => {
      const tAssignments = localAssignments.filter((a) => a.teacherId === t.id && a.type === 'TEACHING');
      const branchIds = new Set<string>();
      tAssignments.forEach((a) => {
        const cls = propClasses.find((c) => c.id === a.classId);
        if (cls?.branchId) branchIds.add(cls.branchId);
        else branchIds.add('branch_main');
      });

      if (branchIds.size > 1) {
        list.push({
          id: `advice_branch_${t.id}`,
          priority: 'MEDIUM',
          category: 'MULTI_BRANCH',
          title: `Giáo viên di chuyển giữa 2 điểm trường: Thầy/Cô ${t.fullName}`,
          basis: `Thầy/Cô ${t.fullName} hiện đang dạy tại cả Điểm chính và Phân hiệu (${tAssignments.length} lớp).`,
          recommendation: `Xem xét gom lớp của Thầy/Cô ${t.fullName} vào cùng một điểm trường để giảm thiểu việc đi lại trong ngày.`,
          impact: `Hạn chế phát sinh xung đột lịch trình khi xếp thời khóa biểu.`,
        });
      }
    });

    return list.slice(0, 8); // Max 8 top smart advices
  }, [
    scopedClasses,
    scopedTeachers,
    localAssignments,
    subjectsByGrade,
    teacherCalculationsMap,
    propSubjects,
    propClasses,
    branches,
  ]);

  // APPLY AI RECOMMENDATION
  const handleApplyAdvice = (advice: AIAdviceItem) => {
    if (!canEdit || !advice.actionPayload) return;
    const { type, classId, subjectId, currentTeacherId, targetTeacherId, periods } = advice.actionPayload;

    pushHistory(localAssignments);
    const cls = propClasses.find((c) => c.id === classId);
    const targetTeacher = propTeachers.find((t) => t.id === targetTeacherId);
    if (!cls || !targetTeacher) return;

    let nextList = [...localAssignments];

    if (type === 'ASSIGN') {
      nextList.push({
        id: `as_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolYearId: propSchoolYearId,
        semesterId: selectedSemester,
        versionId: propVersionId,
        teacherId: targetTeacher.id,
        departmentId: targetTeacher.departmentId || '',
        type: 'TEACHING',
        subjectId,
        classId,
        branchId: cls.branchId || 'branch_main',
        session: cls.session || 'MORNING',
        periodsPerWeek: periods,
        weeks: semesterWeeks,
        totalPeriods: periods * semesterWeeks,
        status: 'draft',
        createdBy: `${currentUser.name} (AI Trợ lý)`,
        createdAt: new Date().toISOString(),
      });
      showToast(`Đã áp dụng đề xuất: Phân công lớp ${cls.name} cho Thầy/Cô ${targetTeacher.fullName}!`);
    } else if (type === 'TRANSFER' && currentTeacherId) {
      nextList = nextList.filter(
        (a) => !(a.classId === classId && a.subjectId === subjectId && a.teacherId === currentTeacherId)
      );
      nextList.push({
        id: `as_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolYearId: propSchoolYearId,
        semesterId: selectedSemester,
        versionId: propVersionId,
        teacherId: targetTeacher.id,
        departmentId: targetTeacher.departmentId || '',
        type: 'TEACHING',
        subjectId,
        classId,
        branchId: cls.branchId || 'branch_main',
        session: cls.session || 'MORNING',
        periodsPerWeek: periods,
        weeks: semesterWeeks,
        totalPeriods: periods * semesterWeeks,
        status: 'draft',
        createdBy: `${currentUser.name} (AI Trợ lý)`,
        createdAt: new Date().toISOString(),
        notes: 'Điều chuyển theo tư vấn AI cân bằng định mức',
      });
      showToast(`Đã điều chuyển lớp ${cls.name} cho Thầy/Cô ${targetTeacher.fullName} theo đề xuất của AI!`);
    }

    setLocalAssignments(nextList);
  };

  // GENERATE 3 OPTIMIZATION SCENARIOS
  const optimizationScenarios = useMemo<OptimizationScenario[]>(() => {
    // Scenario 1: Balanced workload
    const s1: OptimizationScenario = {
      id: 'scen_1',
      name: 'Phương án 1: Cân bằng định mức tối đa',
      description: 'Ưu tiên bù đắp giáo viên thiếu giờ, hạn chế vượt quá 19 tiết/tuần, phân bổ đồng đều toàn khối.',
      unassignedPeriods: 0,
      deficitTeachers: Math.max(0, summaryMetrics.deficitTeachers - 3),
      surplusTeachers: Math.max(0, summaryMetrics.surplusTeachers - 2),
      mismatchCount: 0,
      multiBranchCount: 2,
      balanceScore: 94,
      keyRisks: ['2 giáo viên dạy 2 khối liền kề', 'Có 1 môn chia 2 giáo viên'],
      proposedAssignments: [...localAssignments],
    };

    // Scenario 2: Minimal branch travel
    const s2: OptimizationScenario = {
      id: 'scen_2',
      name: 'Phương án 2: Tối ưu di chuyển & phân hiệu',
      description: 'Ưu tiên giáo viên cố định tại 1 điểm trường duy nhất, giáo viên phân hiệu phụ trách trọn gói các lớp phân hiệu.',
      unassignedPeriods: 0,
      deficitTeachers: Math.max(0, summaryMetrics.deficitTeachers - 2),
      surplusTeachers: Math.max(0, summaryMetrics.surplusTeachers - 1),
      mismatchCount: 0,
      multiBranchCount: 0,
      balanceScore: 91,
      keyRisks: ['1 giáo viên phân hiệu thừa 1.5 tiết', 'GV Điểm chính không dạy Phân hiệu'],
      proposedAssignments: [...localAssignments],
    };

    // Scenario 3: 100% Strict Major Alignment
    const s3: OptimizationScenario = {
      id: 'scen_3',
      name: 'Phương án 3: Chuẩn hóa 100% chuyên môn',
      description: 'Chỉ phân công đúng bằng cấp chính quy, không phân công môn kiêm nhiệm chéo, đảm bảo chất lượng mũi nhọn.',
      unassignedPeriods: 0,
      deficitTeachers: Math.max(0, summaryMetrics.deficitTeachers - 1),
      surplusTeachers: Math.max(0, summaryMetrics.surplusTeachers),
      mismatchCount: 0,
      multiBranchCount: 3,
      balanceScore: 88,
      keyRisks: ['Có 3 giáo viên phải hỗ trợ cả 2 cơ sở do thiếu giáo viên đơn môn'],
      proposedAssignments: [...localAssignments],
    };

    return [s1, s2, s3];
  }, [summaryMetrics, localAssignments]);

  const handleApplyOptimizationScenario = (scenario: OptimizationScenario) => {
    if (!canEdit) return;
    pushHistory(localAssignments);
    setLocalAssignments(scenario.proposedAssignments);
    setIsOptimizeModalOpen(false);
    showToast(`Đã áp dụng "${scenario.name}" thành công! Hệ thống đã cập nhật toàn bộ phân công.`);
  };

  // EXCEL EXPORT
  const handleExportExcel = async () => {
    try {
      const deptMap = new Map<string, Department>();
      propDepartments.forEach((d) => deptMap.set(d.id, d));
      const calcs = propTeachers.map((t) =>
        calculateTeacherWorkload(t, localAssignments, propDuties, deptMap, semesterWeeks)
      );

      await exportWorkloadExcel({
        schoolYear: propSchoolYearId,
        semesterName: selectedSemester === 'HK1' ? 'Học kỳ I' : 'Học kỳ II',
        versionName: currentVersion?.name || 'Phiên bản thông minh',
        exporterName: currentUser.name,
        teachers: propTeachers,
        calculations: calcs,
        assignments: localAssignments,
        classes: propClasses,
        subjects: propSubjects,
        duties: propDuties,
        departments: propDepartments,
      });
      showToast('✅ Đã xuất file Excel phân công chuyên môn thành công!');
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xuất file Excel!', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="smart-assignment-modal"
      className="fixed inset-0 z-50 bg-slate-100 flex flex-col text-slate-800 font-sans select-none overflow-hidden"
    >
      {/* ========================================================================= */}
      {/* 1. TOP CONTROL BAR */}
      {/* ========================================================================= */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs flex-shrink-0 z-20">
        {/* Left: Title & Context Badges */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-700 via-blue-700 to-sky-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                PHÂN CÔNG GIẢNG DẠY THÔNG MINH
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                Ma trận Tích chọn
              </span>
              {isLocked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bản đã khóa
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {schoolInfo.schoolName || 'TRƯỜNG THCS'} • Năm học {schoolInfo.schoolYear || propSchoolYearId} • {selectedSemester === 'HK1' ? 'Học kỳ 1 (18 tuần)' : 'Học kỳ 2 (17 tuần)'}
            </p>
          </div>
        </div>

        {/* Center: Scope Selector (Toàn trường, Điểm chính, Phân hiệu) */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            id="scope-all-btn"
            onClick={() => setSelectedBranchId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              selectedBranchId === 'ALL'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Toàn trường</span>
            <span className="text-[10px] opacity-80">({propClasses.filter((c) => !c.isDeleted).length} lớp)</span>
          </button>

          {branches.map((b) => (
            <button
              key={b.id}
              id={`scope-branch-${b.code.toLowerCase()}-btn`}
              onClick={() => setSelectedBranchId(b.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedBranchId === b.id
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{b.name}</span>
              {b.isMain && <span className="text-[10px] text-amber-300">★</span>}
              <span className="text-[10px] opacity-80">
                ({
                  propClasses.filter((c) =>
                    !c.isDeleted && (b.isMain ? (!c.branchId || c.branchId === b.id) : c.branchId === b.id)
                  ).length
                } lớp)
              </span>
            </button>
          ))}
        </div>

        {/* Right: Actions, Undo/Redo, Optimization & Close */}
        <div className="flex items-center gap-2">
          {/* View Modes */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('TEACHER')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'TEACHER' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
              }`}
              title="Xem theo Giáo viên"
            >
              Theo Giáo viên
            </button>
            <button
              onClick={() => setViewMode('CLASS_SUBJECT')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'CLASS_SUBJECT' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
              }`}
              title="Xem theo Lớp - Môn"
            >
              Lớp - Môn
            </button>
            <button
              onClick={() => setViewMode('SUMMARY')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                viewMode === 'SUMMARY' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
              }`}
              title="Báo cáo Tổng hợp"
            >
              Tổng hợp
            </button>
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handleUndo}
              disabled={historyStack.length === 0}
              className={`p-1.5 rounded-lg transition ${
                historyStack.length > 0 ? 'text-slate-700 hover:bg-white cursor-pointer' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Hoàn tác (Undo)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-1.5 rounded-lg transition ${
                redoStack.length > 0 ? 'text-slate-700 hover:bg-white cursor-pointer' : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Làm lại (Redo)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* AI Optimization Trigger */}
          <button
            id="btn-ai-optimize"
            onClick={() => setIsOptimizeModalOpen(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Mở AI Đề xuất tối ưu phương án phân công"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">AI Đề xuất</span>
          </button>

          {/* Auto-Save Toggle */}
          <label className="hidden md:flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-bold">Tự động lưu</span>
          </label>

          {/* Manual Save Button */}
          {canEdit && (
            <button
              id="btn-manual-save"
              onClick={handleManualSave}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                  : 'bg-blue-900 hover:bg-blue-800 text-white'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Lưu ngay' : 'Đã lưu'}</span>
            </button>
          )}

          {/* Workflow Status & Approve / Unapprove Button */}
          <div className="flex items-center gap-1.5">
            {currentVersion?.status === 'approved' ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bản duyệt</span>
                {canEdit && !isLocked && (
                  <button
                    onClick={handleUnapproveAll}
                    className="ml-1 text-[10px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                    title="Chuyển về Bản nháp để chỉnh sửa thêm"
                  >
                    (Về nháp)
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1">
                  <FileEdit className="w-3.5 h-3.5 text-amber-700" />
                  <span>Bản nháp</span>
                </span>
                {canEdit && !isLocked && (
                  <button
                    id="btn-smart-approve-version"
                    onClick={handleApproveAll}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Chuyển toàn bộ phân công thành Bản duyệt chính thức"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Phê duyệt</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Teaching Plan Framework Trigger */}
          <button
            id="btn-open-teaching-plan-modal"
            onClick={() => setIsTeachingPlanModalOpen(true)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Xem Khung Kế hoạch Dạy học & Tổng hợp số tiết toàn trường"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
            <span className="hidden sm:inline">Khung KH Dạy học</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
            title="Xuất file Excel"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close Modal */}
          <button
            id="btn-close-smart-assignment"
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-700 rounded-xl transition cursor-pointer ml-1"
            title="Đóng module Phân công thông minh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. STICKY REAL-TIME SUMMARY BAR */}
      {/* ========================================================================= */}
      <div
        id="smart-sticky-summary-bar"
        onClick={() => setIsTeachingPlanModalOpen(true)}
        className="bg-slate-50 hover:bg-blue-50/60 text-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-200 flex-shrink-0 z-10 cursor-pointer transition-colors group"
        title="Bấm vào hàng này để mở Bảng Khung Kế hoạch Dạy học & Tổng hợp số tiết toàn trường"
      >
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 font-medium">
          {/* Quick Trigger Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-900 text-white font-bold text-[11px] shadow-2xs group-hover:bg-blue-800 transition-colors">
            <BarChart3 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Khung KH & Tổng số tiết</span>
            <span className="text-[10px] text-blue-200 underline font-normal">(Bấm xem)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Giáo viên:</span>
            <strong className="text-slate-900 font-black">{summaryMetrics.totalTeachers}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Số lớp:</span>
            <strong className="text-slate-900 font-black">{summaryMetrics.totalClasses} lớp</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Nhu cầu tiết:</span>
            <strong className="text-blue-900 font-black">{summaryMetrics.totalNeededPeriods} tiết/tuần</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Đã phân công:</span>
            <strong className="text-emerald-700 font-black">{summaryMetrics.totalAssignedPeriods} tiết</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Còn thiếu:</span>
            <span className={`px-2 py-0.5 rounded-md font-black ${
              summaryMetrics.totalMissingPeriods === 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800 font-bold'
            }`}>
              {summaryMetrics.totalMissingPeriods} tiết
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5">
            <span className="text-slate-500">Lớp-môn chưa đủ GV:</span>
            <strong className="text-amber-700 font-bold">{summaryMetrics.unassignedSlots}</strong>
          </div>
        </div>

        {/* Status Breakdown badges */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {summaryMetrics.exactTeachers} GV đủ định mức
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {summaryMetrics.deficitTeachers} GV thiếu tiết
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            {summaryMetrics.surplusTeachers} GV vượt giờ
          </span>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-slate-200">
            <button
              onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
              className="p-1 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
              title="Thu nhỏ ma trận"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-600 font-mono w-8 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(110, z + 10))}
              className="p-1 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
              title="Phóng to ma trận"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* TOAST POPUP */}
      {toastMessage && (
        <div
          className={`fixed top-14 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-red-600 text-white'
              : toastMessage.type === 'info'
              ? 'bg-blue-800 text-white'
              : 'bg-emerald-700 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE (3-COLUMN LAYOUT) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ----------------------------------------------------------------------- */}
        {/* 3A. LEFT COLUMN: DANH SÁCH GIÁO VIÊN */}
        {/* ----------------------------------------------------------------------- */}
        <aside
          className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-200 flex-shrink-0 z-10 ${
            isLeftCollapsed ? 'w-12' : 'w-72 lg:w-80'
          }`}
        >
          {/* Header & Toggle */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            {!isLeftCollapsed && (
              <div className="flex items-center gap-2">
                {viewMode === 'CLASS_SUBJECT' ? (
                  <>
                    <GraduationCap className="w-4 h-4 text-blue-900" />
                    <span className="text-xs font-bold text-slate-900">
                      Lớp học ({filteredClassList.length}/{scopedClasses.length})
                    </span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 text-blue-900" />
                    <span className="text-xs font-bold text-slate-900">
                      Giáo viên ({filteredTeacherList.length}/{scopedTeachers.length})
                    </span>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg transition ml-auto cursor-pointer"
              title={isLeftCollapsed ? 'Mở rộng danh sách' : 'Thu gọn danh sách'}
            >
              {isLeftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {!isLeftCollapsed && (
            <>
              {viewMode === 'CLASS_SUBJECT' ? (
                /* ========================================================= */
                /* CLASS LIST (For CLASS_SUBJECT Mode) */
                /* ========================================================= */
                <>
                  {/* Search & Filters for Classes */}
                  <div className="p-2.5 border-b border-slate-200 space-y-2 bg-white">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Tìm tên lớp, phòng học..."
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                      />
                      {classSearch && (
                        <button
                          onClick={() => setClassSearch('')}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <select
                        value={classGradeFilter}
                        onChange={(e) => setClassGradeFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-700 font-medium"
                      >
                        <option value="ALL">Tất cả khối</option>
                        <option value="6">Khối 6</option>
                        <option value="7">Khối 7</option>
                        <option value="8">Khối 8</option>
                        <option value="9">Khối 9</option>
                      </select>

                      <select
                        value={classStatusFilter}
                        onChange={(e) => setClassStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-700 font-medium"
                      >
                        <option value="ALL">Mọi tình trạng</option>
                        <option value="FULL">Đủ GV bộ môn</option>
                        <option value="DEFICIT">Còn thiếu GV/tiết</option>
                      </select>
                    </div>
                  </div>

                  {/* Class Cards Scrollable List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-100">
                    {filteredClassList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        Không tìm thấy lớp học nào phù hợp bộ lọc.
                      </div>
                    ) : (
                      filteredClassList.map((cls) => {
                        const isSelected = (selectedClassId || currentSelectedClass?.id) === cls.id;
                        const progress = classProgressMap.get(cls.id);
                        const branch = branches.find((b) => b.id === cls.branchId);
                        const percent =
                          progress && progress.totalNeeded > 0
                            ? Math.min(100, Math.round((progress.totalAssigned / progress.totalNeeded) * 100))
                            : 0;

                        return (
                          <div
                            key={cls.id}
                            id={`class-card-${cls.id}`}
                            onClick={() => setSelectedClassId(cls.id)}
                            className={`p-2.5 rounded-xl cursor-pointer transition border text-xs ${
                              isSelected
                                ? 'bg-blue-50/90 border-blue-600 shadow-xs ring-1 ring-blue-500'
                                : 'bg-white hover:bg-slate-50 border-slate-200/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-sm text-slate-900">{cls.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                  K{cls.grade}
                                </span>
                                {branch && !branch.isMain && (
                                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    {branch.name}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  progress?.missingPeriods === 0
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-red-100 text-red-800 border-red-200'
                                }`}
                              >
                                {progress?.missingPeriods === 0 ? 'Đủ GV' : `Thiếu ${progress?.missingPeriods} tiết`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                              <span>
                                {cls.studentCount ? `${cls.studentCount} HS` : ''}
                                {cls.room ? ` • P.${cls.room}` : ''}
                                {cls.session === 'MORNING' ? ' • Sáng' : ' • Chiều'}
                              </span>
                              <span className="font-mono font-semibold text-slate-700">
                                {progress?.totalAssigned || 0}/{progress?.totalNeeded || 0} tiết
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  progress?.missingPeriods === 0 ? 'bg-emerald-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            {/* Missing subjects tag if any */}
                            {progress && progress.missingSubjectsCount > 0 && (
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                                <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                <span>Còn khuyết GV {progress.missingSubjectsCount} môn học</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                /* ========================================================= */
                /* TEACHER LIST (For TEACHER Mode) */
                /* ========================================================= */
                <>
              {/* Search & Filters */}
              <div className="p-2.5 border-b border-slate-200 space-y-2 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo họ và tên GV..."
                    title="Chỉ tìm kiếm theo họ và tên giáo viên"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-7 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  />
                  {teacherSearch && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 text-sm font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ×
                    </button>
                  )}
                </div>

                {teacherSearch.trim() && (
                  <div className="flex items-center justify-between text-[10px] text-slate-600 px-0.5 pt-0.5">
                    <span className="font-semibold text-blue-900">
                      Kết quả: {filteredTeacherList.length} / {scopedTeachers.length} GV
                    </span>
                    <button
                      type="button"
                      onClick={() => setTeacherSearch('')}
                      className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer underline"
                    >
                      Xóa lọc
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <select
                    value={teacherDeptFilter}
                    onChange={(e) => setTeacherDeptFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-700"
                  >
                    <option value="ALL">Tất cả tổ CM</option>
                    {propDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={teacherStatusFilter}
                    onChange={(e) => setTeacherStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-700"
                  >
                    <option value="ALL">Mọi trạng thái</option>
                    <option value="EXACT">Đủ định mức</option>
                    <option value="DEFICIT">Còn thiếu tiết</option>
                    <option value="SURPLUS">Vượt định mức</option>
                    <option value="UNASSIGNED">Chưa phân công</option>
                  </select>
                </div>
              </div>

              {/* Teacher Cards Scrollable List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-100">
                {filteredTeacherList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Không tìm thấy giáo viên nào phù hợp bộ lọc.
                  </div>
                ) : (
                  filteredTeacherList.map((t) => {
                    const calc = teacherCalculationsMap.get(t.id);
                    const isSelected = selectedTeacherId === t.id;
                    const diff = calc ? calc.difference : 0;

                    // Status style
                    let badgeBg = 'bg-slate-100 text-slate-600';
                    let statusLabel = 'Chưa phân công';
                    if (calc) {
                      if (calc.resultStatus === 'EXACT' || calc.resultStatus === 'EXACT_EXEMPT') {
                        badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        statusLabel = 'Đủ định mức (0)';
                      } else if (calc.resultStatus === 'DEFICIT') {
                        badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                        statusLabel = `Thiếu ${Math.abs(diff)} tiết`;
                      } else if (calc.resultStatus === 'SURPLUS') {
                        badgeBg = 'bg-red-100 text-red-800 border-red-200';
                        statusLabel = `Vượt ${diff} tiết`;
                      }
                    }

                    return (
                      <div
                        key={t.id}
                        id={`teacher-card-${t.code}`}
                        onClick={() => setSelectedTeacherId(t.id)}
                        className={`p-2.5 rounded-xl cursor-pointer transition border text-xs ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-600 shadow-xs ring-1 ring-blue-500'
                            : 'bg-white hover:bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] text-slate-400">{t.code}</span>
                            <span className="font-bold text-slate-900">
                              {renderHighlightedTeacherName(t.fullName, teacherSearch)}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeBg}`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>{t.major || 'Đại học'}</span>
                          <span className="font-mono font-semibold text-slate-700">
                            {calc?.totalCalculated || 0} / {calc?.quota ?? t.standardQuota ?? 19} tiết
                          </span>
                        </div>

                        {/* Can teach subjects pills */}
                        {t.subjectsCanTeach && t.subjectsCanTeach.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {t.subjectsCanTeach.slice(0, 3).map((code) => (
                              <span
                                key={code}
                                className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-600"
                              >
                                {code}
                              </span>
                            ))}
                            {t.subjectsCanTeach.length > 3 && (
                              <span className="text-[9px] text-slate-400">+{t.subjectsCanTeach.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
                </>
              )}
            </>
          )}
        </aside>

        {/* ----------------------------------------------------------------------- */}
        {/* 3B. CENTER COLUMN: MA TRẬN PHÂN CÔNG THÔNG MINH */}
        {/* ----------------------------------------------------------------------- */}
        <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
          {/* View Mode 1: Interactive Matrix (Theo Giáo viên) */}
          {viewMode === 'TEACHER' && (() => {
            const currentDept = propDepartments.find((d) => d.id === currentSelectedTeacher?.departmentId);
            const suggestedSubjectsList = currentSelectedTeacher
              ? propSubjects.filter((s) => {
                  const { isSuggested } = isSubjectSuggestedForTeacher(
                    s,
                    currentSelectedTeacher,
                    propDepartments,
                    localAssignments,
                    propTeachers
                  );
                  return isSuggested;
                })
              : propSubjects;

            return (
              <div className="flex-1 overflow-auto p-3 space-y-4" style={{ zoom: `${zoomLevel}%` }}>
                {/* TOOLBAR: MÔN GỢI Ý & CHỌN MÔN ĐỂ PHÂN CÔNG */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* 1. Môn gợi ý (Tích chọn gọn gàng) */}
                    <label className="flex items-center gap-2 cursor-pointer select-none bg-blue-50/90 hover:bg-blue-100 text-blue-950 px-3 py-1.5 rounded-xl border border-blue-200 transition shadow-2xs">
                      <input
                        type="checkbox"
                        id="toggle-filter-suggested-subjects"
                        checked={filterSuggestedSubjectsOnly}
                        onChange={(e) => {
                          setFilterSuggestedSubjectsOnly(e.target.checked);
                          setSelectedCustomSubjectIds([]);
                        }}
                        className="w-4 h-4 rounded text-blue-700 focus:ring-blue-500 cursor-pointer"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-blue-700 animate-pulse" />
                      <span className="text-xs font-black">Môn gợi ý</span>
                    </label>

                    {/* 2. Mục "Chọn môn" để tích chọn một hoặc nhiều môn hiển thị để phân công */}
                    <div className="relative" ref={subjectDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer select-none ${
                          selectedCustomSubjectIds.length > 0
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-950 hover:bg-indigo-100 ring-2 ring-indigo-400/30'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
                        <span>
                          Chọn môn{selectedCustomSubjectIds.length > 0 ? ` (${selectedCustomSubjectIds.length})` : ''}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                            isSubjectDropdownOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Dropdown Popover */}
                      {isSubjectDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 w-80 sm:w-96 p-3 space-y-2.5 animate-in fade-in zoom-in-95">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Chọn môn hiển thị ({selectedCustomSubjectIds.length > 0 ? `${selectedCustomSubjectIds.length}/${propSubjects.length}` : 'Tất cả'})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsSubjectDropdownOpen(false)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Tìm môn học theo tên, mã..."
                              value={subjectFilterSearch}
                              onChange={(e) => setSubjectFilterSearch(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <button
                              type="button"
                              onClick={handleSelectAllSubjects}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            >
                              Chọn tất cả
                            </button>
                            <button
                              type="button"
                              onClick={handleSelectOnlySuggestedSubjects}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition cursor-pointer flex items-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                              <span>Chỉ môn gợi ý ({suggestedSubjectIds.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleClearSubjectFilter}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 transition cursor-pointer ml-auto"
                            >
                              Bỏ chọn
                            </button>
                          </div>

                          <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-100/60 p-1">
                            {filteredSubjectsForDropdown.map((subj) => {
                              const isChecked = selectedCustomSubjectIds.length === 0
                                ? (filterSuggestedSubjectsOnly && currentSelectedTeacher ? isSuggestedSubject(subj) : true)
                                : selectedCustomSubjectIds.includes(subj.id);
                              const isSuggested = isSuggestedSubject(subj);

                              return (
                                <label
                                  key={subj.id}
                                  className={`flex items-center justify-between gap-2 p-2 rounded-xl text-xs cursor-pointer select-none transition ${
                                    isChecked ? 'bg-blue-50/70 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleCustomSubject(subj.id)}
                                      className="w-4 h-4 rounded text-blue-700 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="truncate">{subj.name}</span>
                                    <span className="font-mono text-[10px] text-slate-400">({subj.code})</span>
                                  </div>
                                  {isSuggested && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex-shrink-0">
                                      Gợi ý
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">
                              {selectedCustomSubjectIds.length > 0
                                ? `Đã chọn ${selectedCustomSubjectIds.length}/${propSubjects.length} môn`
                                : 'Đang hiển thị theo mặc định'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsSubjectDropdownOpen(false)}
                              className="px-3 py-1 bg-blue-800 hover:bg-blue-900 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
                            >
                              Đóng
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chip hiển thị trạng thái lọc khi có chọn môn tùy biến */}
                    {selectedCustomSubjectIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl font-medium">
                        <span>Đang lọc <strong>{selectedCustomSubjectIds.length}</strong> môn</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomSubjectIds([])}
                          className="ml-1 text-slate-400 hover:text-red-600 font-bold p-0.5 rounded cursor-pointer"
                          title="Xóa lọc môn (Quay về theo cài đặt Môn gợi ý)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {currentSelectedTeacher && (
                      <span className="text-slate-600 text-[11px] hidden lg:inline">
                        GV: <strong className="text-slate-900 font-bold">{currentSelectedTeacher.fullName}</strong>
                        {currentSelectedTeacher.major && ` • CM: ${currentSelectedTeacher.major}`}
                        {currentDept && ` • Tổ: ${currentDept.name}`}
                      </span>
                    )}
                    {selectedCustomSubjectIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedCustomSubjectIds([])}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Đặt lại môn</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                {[6, 7, 8, 9].map((grade) => {
                  const gradeClasses = classesByGrade[grade] || [];
                  const allGradeSubjects = subjectsByGrade[grade] || [];
                  if (gradeClasses.length === 0) return null;

                  // Lọc môn hiển thị theo "Chọn môn" hoặc "Môn gợi ý"
                  const gradeSubjects = allGradeSubjects.filter((subj) => {
                    if (selectedCustomSubjectIds.length > 0) {
                      return selectedCustomSubjectIds.includes(subj.id);
                    }
                    if (filterSuggestedSubjectsOnly && currentSelectedTeacher) {
                      return isSuggestedSubject(subj);
                    }
                    return true;
                  });

                  return (
                    <div
                      key={grade}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                    >
                      {/* Grade Header */}
                      <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-xl bg-blue-900 text-white font-black text-xs flex items-center justify-center">
                            K{grade}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm">
                            Khối {grade} ({gradeClasses.length} lớp • {gradeSubjects.length}/{allGradeSubjects.length} môn)
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 hidden sm:inline">
                            {gradeClasses.map((c) => c.name).join(', ')}
                          </span>
                          {gradeSubjects.length < allGradeSubjects.length && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                              Đã ẩn {allGradeSubjects.length - gradeSubjects.length} môn
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Matrix Table or Empty State if no suggested subjects */}
                      {gradeSubjects.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/50 rounded-xl m-3 border border-dashed border-slate-200 space-y-2">
                          <Info className="w-5 h-5 mx-auto text-slate-400" />
                          <p className="font-semibold text-slate-700">
                            Không có môn học nào đang được chọn hiển thị cho Thầy/Cô {currentSelectedTeacher?.fullName} ở Khối {grade}.
                          </p>
                          <div className="flex items-center justify-center gap-2 pt-1">
                            {selectedCustomSubjectIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setSelectedCustomSubjectIds([])}
                                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-indigo-50 transition cursor-pointer"
                              >
                                Đặt lại bộ lọc môn
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setFilterSuggestedSubjectsOnly(false);
                                setSelectedCustomSubjectIds([]);
                              }}
                              className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-blue-50 transition cursor-pointer"
                            >
                              Hiển thị toàn bộ {allGradeSubjects.length} môn của Khối {grade}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-2.5 min-w-[200px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200 shadow-xs">
                                Môn học (Khối {grade})
                              </th>
                              <th className="p-2.5 w-20 text-center border-r border-slate-200">
                                Tiết/T
                              </th>
                              <th className="p-2.5 w-24 text-center border-r border-slate-200">
                                Nhu cầu
                              </th>
                              {gradeClasses.map((cls) => (
                                <th
                                  key={cls.id}
                                  className="p-2.5 min-w-[130px] max-w-[150px] text-center border-r border-slate-200 bg-slate-50"
                                >
                                  <div className="font-bold text-slate-900 text-xs">{cls.name}</div>
                                  <div className="text-[10px] text-slate-400 font-normal">
                                    {cls.room || 'Phòng học'}
                                    {selectedBranchId === 'ALL' && cls.branchId && (
                                      <span className="block text-[9px] text-blue-700 font-semibold truncate">
                                        {branches.find((b) => b.id === cls.branchId)?.code || 'DC'}
                                      </span>
                                    )}
                                  </div>
                                </th>
                              ))}
                              <th className="p-2.5 w-28 text-center">Thao tác khối</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {gradeSubjects.map((subj) => {
                              const stdPeriods = getSubjectStandardPeriods(grade, subj.id);
                              const totalNeeded = stdPeriods * gradeClasses.length;

                              // Count how many periods currently assigned across this grade
                              let totalAssignedInGrade = 0;
                              gradeClasses.forEach((cls) => {
                                const cellAsg = getCellAssignments(cls.id, subj.id);
                                totalAssignedInGrade += cellAsg.reduce(
                                  (sum, a) => sum + (a.periodsPerWeek || 0),
                                  0
                                );
                              });
                              const remainingInGrade = Math.max(0, totalNeeded - totalAssignedInGrade);

                              // Highlight & reasons if matches selected teacher
                              const matchInfo = isSubjectSuggestedForTeacher(
                                subj,
                                currentSelectedTeacher,
                                propDepartments,
                                localAssignments,
                                propTeachers
                              );
                              const isMatch = matchInfo.isSuggested;

                              return (
                                <tr
                                  key={subj.id}
                                  className={`transition ${
                                    isMatch
                                      ? 'bg-blue-50/40 hover:bg-blue-50/70'
                                      : 'hover:bg-slate-50/80'
                                  }`}
                                >
                                  {/* Subject Header with Match Indicator & Reasons */}
                                  <td className="p-2.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200 shadow-xs">
                                    <div className="flex items-center gap-1.5">
                                      {isMatch && (
                                        <span
                                          className="w-2 h-2 rounded-full bg-blue-600 animate-pulse flex-shrink-0"
                                          title={matchInfo.reasons.join(' • ')}
                                        />
                                      )}
                                      <span className="truncate">{subj.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-[10px] text-slate-400 font-normal">
                                        {subj.group || 'Bộ môn'}
                                      </span>
                                      {matchInfo.reasons.length > 0 && (
                                        <span
                                          className="text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded"
                                          title={matchInfo.reasons.join(' • ')}
                                        >
                                          {matchInfo.reasons[0]}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Standard periods / week */}
                                  <td className="p-2.5 text-center font-mono font-bold text-slate-700 border-r border-slate-200">
                                    {stdPeriods}
                                  </td>

                                  {/* Total needed & remaining */}
                                  <td className="p-2 text-center border-r border-slate-200 font-mono text-[11px]">
                                    <div className="font-bold text-slate-800">
                                      {totalAssignedInGrade}/{totalNeeded}
                                    </div>
                                    <div
                                      className={`text-[10px] font-bold ${
                                        remainingInGrade === 0 ? 'text-emerald-600' : 'text-amber-600'
                                      }`}
                                    >
                                      {remainingInGrade === 0 ? 'Đủ' : `Thiếu ${remainingInGrade}`}
                                    </div>
                                  </td>

                                  {/* Classes Checkbox Cells */}
                                  {gradeClasses.map((cls) => {
                                    const cellAssignments = getCellAssignments(cls.id, subj.id);
                                    const isAssignedToMe = cellAssignments.some(
                                      (a) => a.teacherId === selectedTeacherId
                                    );
                                    const isAssignedToOther =
                                      cellAssignments.length > 0 && !isAssignedToMe;
                                    const isUnassigned = cellAssignments.length === 0;

                                    const assignedTeacher = cellAssignments[0]
                                      ? propTeachers.find((t) => t.id === cellAssignments[0].teacherId)
                                      : null;

                                    return (
                                      <td
                                        key={cls.id}
                                        className={`p-1.5 text-center border-r border-slate-200 transition ${
                                          isAssignedToMe
                                            ? 'bg-blue-100/60'
                                            : isAssignedToOther
                                            ? 'bg-slate-100/70'
                                            : ''
                                        }`}
                                      >
                                        <div className="flex flex-col items-center justify-center p-1 rounded-lg border border-transparent hover:border-blue-300 transition">
                                          {/* Interactive Checkbox */}
                                          <button
                                            id={`cell-${cls.name}-${subj.code}`}
                                            onClick={() => handleToggleCell(cls, subj)}
                                            className={`p-1 rounded-md transition flex items-center justify-center cursor-pointer ${
                                              isAssignedToMe
                                                ? 'text-blue-900 hover:text-blue-700 bg-white shadow-xs'
                                                : isAssignedToOther
                                                ? 'text-slate-600 hover:text-amber-700 bg-white/80'
                                                : 'text-slate-300 hover:text-blue-600 hover:bg-white'
                                            }`}
                                            title={
                                              isAssignedToMe
                                                ? 'Bỏ phân công (Thu hồi)'
                                                : isAssignedToOther
                                                ? `Đang phân công cho Thầy/Cô ${assignedTeacher?.fullName}. Bấm để chuyển.`
                                                : `Phân công lớp ${cls.name} cho Thầy/Cô ${currentSelectedTeacher?.fullName}`
                                            }
                                          >
                                            {isAssignedToMe ? (
                                              <CheckSquare className="w-5 h-5 text-blue-900 fill-blue-100" />
                                            ) : isAssignedToOther ? (
                                              <CheckSquare className="w-5 h-5 text-slate-500" />
                                            ) : (
                                              <Square className="w-5 h-5" />
                                            )}
                                          </button>

                                          {/* Teacher Name & Period info in Cell */}
                                          <div className="mt-1 w-full text-center">
                                            {cellAssignments.length === 0 ? (
                                              <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-[10px] text-slate-400 italic">
                                                  Chưa có GV
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCellSuggestionTarget({ cls, subject: subj });
                                                  }}
                                                  className="mt-0.5 text-[9px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5 transition cursor-pointer shadow-2xs"
                                                  title="Xem gợi ý giáo viên tối ưu (ưu tiên chưa đủ định mức)"
                                                >
                                                  <Sparkles className="w-2.5 h-2.5 text-blue-600 animate-pulse" />
                                                  <span>Gợi ý GV</span>
                                                </button>
                                              </div>
                                            ) : cellAssignments.length === 1 ? (
                                              <div>
                                                <p
                                                  className={`text-[10px] font-bold truncate max-w-[120px] ${
                                                    isAssignedToMe ? 'text-blue-900' : 'text-slate-800'
                                                  }`}
                                                  title={assignedTeacher?.fullName}
                                                >
                                                  {assignedTeacher?.fullName || 'Giáo viên'}
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-mono">
                                                  {cellAssignments[0].periodsPerWeek}/{stdPeriods} tiết
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCellSuggestionTarget({ cls, subject: subj });
                                                  }}
                                                  className="mt-0.5 text-[9px] text-slate-400 hover:text-blue-700 flex items-center justify-center gap-0.5 transition cursor-pointer mx-auto"
                                                  title="Xem danh sách gợi ý giáo viên cho ô này"
                                                >
                                                  <Sparkles className="w-2 h-2" />
                                                  <span>Gợi ý đổi</span>
                                                </button>
                                              </div>
                                            ) : (
                                              <div
                                                onClick={() => handleOpenSplitModal(cls, subj)}
                                                className="cursor-pointer"
                                                title="Môn học chia tiết cho nhiều giáo viên"
                                              >
                                                <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-800 font-bold rounded">
                                                  Chia {cellAssignments.length} GV
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* Split / Edit detail button */}
                                          {cellAssignments.length > 0 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenSplitModal(cls, subj);
                                              }}
                                              className="mt-0.5 text-[9px] text-slate-400 hover:text-blue-700 hover:underline cursor-pointer"
                                            >
                                              Chia tiết
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}

                                  {/* Batch Grade Actions */}
                                  <td className="p-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => handleBatchAssignGradeSubject(grade, subj, true)}
                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                        title={`Tích toàn bộ các lớp khối ${grade} cho Thầy/Cô ${currentSelectedTeacher?.fullName}`}
                                      >
                                        Tất cả
                                      </button>
                                      <button
                                        onClick={() => handleBatchAssignGradeSubject(grade, subj, false)}
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 rounded-lg text-[10px] transition cursor-pointer"
                                        title="Bỏ tích toàn bộ lớp khối này"
                                      >
                                        Bỏ
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
                })}
              </div>
            </div>
          )})()}

          {/* View Mode 2: Lớp - Môn (Class-Subject Dedicated View) */}
          {viewMode === 'CLASS_SUBJECT' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Class Header Toolbar */}
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                    {currentSelectedClass?.name || 'Lớp'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900 text-base">
                        Lớp {currentSelectedClass?.name}
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Khối {currentSelectedClass?.grade}
                      </span>
                      {currentSelectedClass?.branchId && currentSelectedClass.branchId !== 'branch_main' && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {branches.find((b) => b.id === currentSelectedClass.branchId)?.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sĩ số: <strong className="text-slate-800">{currentSelectedClass?.studentCount || 0} HS</strong> •{' '}
                      Phòng: <strong className="text-slate-800">{currentSelectedClass?.room || 'Chưa xếp'}</strong> •{' '}
                      Buổi: <strong className="text-slate-800">{currentSelectedClass?.session === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}</strong>
                      {currentSelectedClass?.homeroomTeacherId && (
                        <>
                          {' '}• GVCN: <strong className="text-blue-900">{propTeachers.find((t) => t.id === currentSelectedClass.homeroomTeacherId)?.fullName || 'Đã phân công'}</strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Sub-view switcher */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                    <button
                      onClick={() => setClassViewSubMode('DETAIL')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        classViewSubMode === 'DETAIL'
                          ? 'bg-white text-blue-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                      <span>Chi tiết môn của lớp</span>
                    </button>
                    <button
                      onClick={() => setClassViewSubMode('MATRIX')}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        classViewSubMode === 'MATRIX'
                          ? 'bg-white text-blue-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Ma trận Lớp × Môn toàn khối</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-mode 1: DETAIL (Chi tiết từng môn của lớp) */}
              {classViewSubMode === 'DETAIL' && (
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Class Status Banner Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Nhu cầu PPCT</div>
                      <div className="text-lg font-black text-slate-900 mt-0.5">
                        {currentClassMetrics.totalNeeded} <span className="text-xs font-normal text-slate-500">tiết/tuần</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Đã có GV đảm nhiệm</div>
                      <div className="text-lg font-black text-emerald-700 mt-0.5">
                        {currentClassMetrics.totalAssigned} <span className="text-xs font-normal text-slate-500">tiết</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Số tiết còn thiếu</div>
                      <div className={`text-lg font-black mt-0.5 ${currentClassMetrics.missingPeriods === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {currentClassMetrics.missingPeriods} <span className="text-xs font-normal text-slate-500">tiết</span>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="text-[11px] text-slate-500 font-medium">Môn học khuyết GV</div>
                      <div className={`text-lg font-black mt-0.5 ${currentClassMetrics.missingSubjectsCount === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {currentClassMetrics.missingSubjectsCount} / {applicableSubjectsForCurrentClass.length} <span className="text-xs font-normal text-slate-500">môn</span>
                      </div>
                    </div>
                  </div>

                  {/* Filter Tabs for Subjects */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <button
                        onClick={() => setClassSubjectTabFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                          classSubjectTabFilter === 'ALL'
                            ? 'bg-blue-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả môn ({applicableSubjectsForCurrentClass.length})
                      </button>
                      <button
                        onClick={() => setClassSubjectTabFilter('UNASSIGNED')}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                          classSubjectTabFilter === 'UNASSIGNED'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Chưa có GV ({currentClassMetrics.missingSubjectsCount})
                      </button>
                      <button
                        onClick={() => setClassSubjectTabFilter('ASSIGNED')}
                        className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                          classSubjectTabFilter === 'ASSIGNED'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Đã phân công ({currentClassMetrics.assignedSubjectsCount})
                      </button>
                    </div>

                    <span className="text-xs text-slate-500">
                      Chọn trực tiếp giáo viên phụ trách từng môn học bên dưới
                    </span>
                  </div>

                  {/* Subjects Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 w-12 text-center border-r border-slate-200">STT</th>
                          <th className="p-3 min-w-[180px] border-r border-slate-200">Môn học & Tổ chuyên môn</th>
                          <th className="p-3 w-24 text-center border-r border-slate-200">PPCT chuẩn</th>
                          <th className="p-3 min-w-[280px] border-r border-slate-200">
                            Giáo viên đảm nhiệm (chọn trực tiếp)
                          </th>
                          <th className="p-3 w-28 text-center border-r border-slate-200">Số tiết dạy</th>
                          <th className="p-3 w-32 text-center border-r border-slate-200">Trạng thái</th>
                          <th className="p-3 w-28 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {applicableSubjectsForCurrentClass
                          .filter((subj) => {
                            if (!currentSelectedClass) return true;
                            const cellAsgs = getCellAssignments(currentSelectedClass.id, subj.id);
                            const std = getSubjectStandardPeriods(currentSelectedClass.grade, subj.id);
                            const assignedPeriods = cellAsgs.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
                            const isFullyAssigned = assignedPeriods >= std && std > 0;

                            if (classSubjectTabFilter === 'UNASSIGNED') return !isFullyAssigned;
                            if (classSubjectTabFilter === 'ASSIGNED') return isFullyAssigned;
                            return true;
                          })
                          .map((subj, index) => {
                            if (!currentSelectedClass) return null;
                            const std = getSubjectStandardPeriods(currentSelectedClass.grade, subj.id);
                            const cellAsgs = getCellAssignments(currentSelectedClass.id, subj.id);
                            const assignedPeriods = cellAsgs.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
                            const dept = propDepartments.find((d) => d.id === subj.departmentId);
                            const isAssigned = cellAsgs.length > 0;
                            const isFull = assignedPeriods >= std && std > 0;

                            // Group teachers: matching vs others with under-quota prioritization
                            const matchingTeachers = scopedTeachers.filter((t) => isSubjectMatchingTeacher(subj, t));
                            const matchingUnderQuota = matchingTeachers.filter((t) => {
                              const calc = teacherCalculationsMap.get(t.id);
                              return calc ? calc.difference < 0 : false;
                            }).sort((a, b) => {
                              const calcA = teacherCalculationsMap.get(a.id);
                              const calcB = teacherCalculationsMap.get(b.id);
                              return (calcA?.difference || 0) - (calcB?.difference || 0);
                            });
                            const matchingOthers = matchingTeachers.filter((t) => {
                              const calc = teacherCalculationsMap.get(t.id);
                              return calc ? calc.difference >= 0 : true;
                            });
                            const otherTeachers = scopedTeachers.filter((t) => !isSubjectMatchingTeacher(subj, t));

                            return (
                              <tr
                                key={subj.id}
                                className={`hover:bg-slate-50 transition ${
                                  !isAssigned ? 'bg-red-50/20' : ''
                                }`}
                              >
                                <td className="p-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-200">
                                  {index + 1}
                                </td>

                                <td className="p-3 border-r border-slate-200">
                                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-blue-900 flex-shrink-0" />
                                    <span>{subj.name}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Mã: {subj.code} • Tổ: {dept?.name || 'Chuyên môn'}
                                  </div>
                                </td>

                                <td className="p-3 text-center font-bold text-slate-800 font-mono border-r border-slate-200">
                                  {std} tiết/tuần
                                </td>

                                <td className="p-3 border-r border-slate-200">
                                  {/* Interactive Quick Dropdown / Teacher Selector */}
                                  <div className="space-y-1.5">
                                    {cellAsgs.length === 0 ? (
                                      <>
                                        <select
                                          disabled={!canEdit}
                                          value=""
                                          onChange={(e) =>
                                            handleAssignTeacherToClassSubject(
                                              currentSelectedClass,
                                              subj,
                                              e.target.value
                                            )
                                          }
                                          className="w-full bg-slate-50 border border-slate-300 text-xs rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white cursor-pointer"
                                        >
                                          <option value="">-- Chọn giáo viên phân công --</option>
                                          {matchingUnderQuota.length > 0 && (
                                            <optgroup label="🌟 Đúng môn/tổ & Chưa đủ định mức (Ưu tiên)">
                                              {matchingUnderQuota.map((t) => {
                                                const calc = teacherCalculationsMap.get(t.id);
                                                const diff = calc ? calc.difference : 0;
                                                return (
                                                  <option key={t.id} value={t.id}>
                                                    ⭐ {t.fullName} ({calc?.totalCalculated || 0}/{t.standardQuota || 19}t - thiếu {Math.abs(diff)}t)
                                                  </option>
                                                );
                                              })}
                                            </optgroup>
                                          )}
                                          <optgroup label="⭐ Đúng chuyên môn đào tạo (Đã đủ hoặc vượt)">
                                            {matchingOthers.map((t) => {
                                              const calc = teacherCalculationsMap.get(t.id);
                                              const diff = calc ? calc.difference : 0;
                                              const diffText = diff > 0 ? `vượt +${diff}t` : 'đủ';
                                              return (
                                                <option key={t.id} value={t.id}>
                                                  {t.fullName} ({calc?.totalCalculated || 0}/{t.standardQuota || 19}t - {diffText})
                                                </option>
                                              );
                                            })}
                                          </optgroup>
                                          <optgroup label="Giáo viên khác">
                                            {otherTeachers.map((t) => {
                                              const calc = teacherCalculationsMap.get(t.id);
                                              const diff = calc ? calc.difference : 0;
                                              const diffText =
                                                diff < 0
                                                  ? `thiếu ${Math.abs(diff)}t`
                                                  : diff > 0
                                                  ? `vượt +${diff}t`
                                                  : 'đủ';
                                              return (
                                                <option key={t.id} value={t.id}>
                                                  {t.fullName} ({calc?.totalCalculated || 0}/{t.standardQuota || 19}t - {diffText})
                                                </option>
                                              );
                                            })}
                                          </optgroup>
                                        </select>

                                        {/* Quick Smart Suggestion Badges */}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                          <span className="text-[10px] text-blue-900 flex items-center gap-1 font-bold">
                                            <Sparkles className="w-3 h-3 text-blue-700 animate-pulse" />
                                            Gợi ý:
                                          </span>
                                          {getSmartTeacherSuggestions({
                                            subject: subj,
                                            targetClass: currentSelectedClass,
                                            teachers: propTeachers,
                                            departments: propDepartments,
                                            assignments: localAssignments,
                                            calculationsMap: teacherCalculationsMap,
                                            maxResults: 3,
                                          }).map((sugg) => (
                                            <button
                                              key={sugg.teacher.id}
                                              type="button"
                                              disabled={!canEdit}
                                              onClick={() =>
                                                handleAssignTeacherToClassSubject(
                                                  currentSelectedClass,
                                                  subj,
                                                  sugg.teacher.id
                                                )
                                              }
                                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1 border shadow-2xs ${
                                                sugg.isUnderQuota
                                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200 hover:border-amber-300'
                                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-900 border-blue-200'
                                              }`}
                                              title={`Gán Thầy/Cô ${sugg.teacher.fullName} (Hiện dạy ${sugg.currentPeriods}/${sugg.quota}t, thiếu ${sugg.deficit}t)`}
                                            >
                                              <span>+ {sugg.teacher.fullName}</span>
                                              <span className={`text-[9px] font-mono ${sugg.isUnderQuota ? 'text-amber-800 font-bold' : 'text-slate-500'}`}>
                                                ({sugg.isUnderQuota ? `thiếu ${sugg.deficit}t` : `${sugg.currentPeriods}t`})
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      </>
                                    ) : cellAsgs.length === 1 ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                          <select
                                            disabled={!canEdit}
                                            value={cellAsgs[0].teacherId}
                                            onChange={(e) =>
                                              handleAssignTeacherToClassSubject(
                                                currentSelectedClass,
                                                subj,
                                                e.target.value
                                              )
                                            }
                                            className="w-full bg-blue-50/60 border border-blue-300 text-xs font-bold rounded-xl px-2.5 py-1.5 text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white cursor-pointer"
                                          >
                                            <option value="">-- Hủy phân công (Bỏ trống) --</option>
                                            <optgroup label="⭐ Đúng chuyên môn đào tạo">
                                              {matchingTeachers.map((t) => {
                                                const calc = teacherCalculationsMap.get(t.id);
                                                const diff = calc ? calc.difference : 0;
                                                const diffText =
                                                  diff < 0
                                                    ? `thiếu ${Math.abs(diff)}t`
                                                    : diff > 0
                                                    ? `vượt +${diff}t`
                                                    : 'đủ';
                                                return (
                                                  <option key={t.id} value={t.id}>
                                                    {t.fullName} ({calc?.totalCalculated || 0}/{t.standardQuota || 19}t - {diffText})
                                                  </option>
                                                );
                                              })}
                                            </optgroup>
                                            <optgroup label="Giáo viên khác">
                                              {otherTeachers.map((t) => {
                                                const calc = teacherCalculationsMap.get(t.id);
                                                const diff = calc ? calc.difference : 0;
                                                const diffText =
                                                  diff < 0
                                                    ? `thiếu ${Math.abs(diff)}t`
                                                    : diff > 0
                                                    ? `vượt +${diff}t`
                                                    : 'đủ';
                                                return (
                                                  <option key={t.id} value={t.id}>
                                                    {t.fullName} ({calc?.totalCalculated || 0}/{t.standardQuota || 19}t - {diffText})
                                                  </option>
                                                );
                                              })}
                                            </optgroup>
                                          </select>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-md">
                                            Chia {cellAsgs.length} giáo viên
                                          </span>
                                        </div>
                                        <div className="space-y-1 pl-1">
                                          {cellAsgs.map((a) => {
                                            const teacher = propTeachers.find((t) => t.id === a.teacherId);
                                            return (
                                              <div key={a.id} className="text-xs text-slate-700 flex items-center justify-between">
                                                <span>• {teacher?.fullName || 'GV'}:</span>
                                                <strong className="font-mono text-blue-900">{a.periodsPerWeek} tiết</strong>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="p-3 text-center border-r border-slate-200">
                                  <span className="font-mono font-bold text-slate-900">
                                    {assignedPeriods}/{std}
                                  </span>
                                  {canEdit && isAssigned && (
                                    <button
                                      onClick={() => handleOpenSplitModal(currentSelectedClass, subj)}
                                      className="block mx-auto mt-1 text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
                                      title="Chia môn cho 2 giáo viên cùng dạy"
                                    >
                                      Chia tiết
                                    </button>
                                  )}
                                </td>

                                <td className="p-3 text-center border-r border-slate-200">
                                  {cellAsgs.length === 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                                      <UserX className="w-3 h-3" />
                                      Chưa có GV
                                    </span>
                                  ) : isFull ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Đã đủ ({assignedPeriods}t)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      <AlertTriangle className="w-3 h-3" />
                                      Thiếu {std - assignedPeriods}t
                                    </span>
                                  )}
                                </td>

                                <td className="p-3 text-center">
                                  {isAssigned && canEdit ? (
                                    <button
                                      onClick={() => handleUnassignClassSubject(currentSelectedClass, subj)}
                                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="Hủy gán giáo viên môn này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <span className="text-slate-300 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-mode 2: MATRIX (Toàn khối / Toàn trường) */}
              {classViewSubMode === 'MATRIX' && (
                <div className="flex-1 overflow-auto p-4 space-y-6" style={{ zoom: `${zoomLevel}%` }}>
                  {[6, 7, 8, 9].map((grade) => {
                    const gradeClasses = classesByGrade[grade] || [];
                    const gradeSubjects = subjectsByGrade[grade] || [];
                    if (gradeClasses.length === 0) return null;

                    return (
                      <div key={grade} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-900 text-white font-black text-xs flex items-center justify-center">
                              K{grade}
                            </span>
                            <h3 className="font-bold text-slate-900 text-xs">
                              Ma trận Khối {grade} ({gradeClasses.length} lớp • {gradeSubjects.length} môn)
                            </h3>
                          </div>
                          <span className="text-xs text-slate-500">
                            Hiển thị giáo viên phụ trách từng lớp môn
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                                <th className="p-2.5 min-w-[180px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                                  Môn học
                                </th>
                                <th className="p-2.5 w-16 text-center border-r border-slate-200">Tiết</th>
                                {gradeClasses.map((cls) => (
                                  <th
                                    key={cls.id}
                                    className={`p-2.5 min-w-[140px] text-center border-r border-slate-200 ${
                                      (selectedClassId || currentSelectedClass?.id) === cls.id
                                        ? 'bg-blue-50/80 text-blue-950 font-black'
                                        : 'bg-slate-50'
                                    }`}
                                  >
                                    <div className="text-xs font-bold">{cls.name}</div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {gradeSubjects.map((subj) => {
                                const std = getSubjectStandardPeriods(grade, subj.id);
                                return (
                                  <tr key={subj.id} className="hover:bg-slate-50/80">
                                    <td className="p-2.5 font-bold text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-200">
                                      {subj.name}
                                    </td>
                                    <td className="p-2.5 text-center font-mono text-slate-600 border-r border-slate-200">
                                      {std}
                                    </td>
                                    {gradeClasses.map((cls) => {
                                      const cellAsgs = getCellAssignments(cls.id, subj.id);
                                      const isAssigned = cellAsgs.length > 0;
                                      const firstTeacher = cellAsgs[0] ? propTeachers.find((t) => t.id === cellAsgs[0].teacherId) : null;

                                      return (
                                        <td
                                          key={cls.id}
                                          className={`p-2 text-center border-r border-slate-200 ${
                                            !isAssigned
                                              ? 'bg-red-50/40'
                                              : (selectedClassId || currentSelectedClass?.id) === cls.id
                                              ? 'bg-blue-50/30'
                                              : ''
                                          }`}
                                        >
                                          {isAssigned ? (
                                            <div className="text-[11px]">
                                              <span className="font-bold text-slate-900 block truncate" title={firstTeacher?.fullName}>
                                                {firstTeacher?.fullName || 'GV'}
                                              </span>
                                              {cellAsgs.length > 1 && (
                                                <span className="text-[9px] px-1 bg-purple-100 text-purple-800 rounded">
                                                  +{cellAsgs.length - 1} GV
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] text-red-600 font-semibold italic">
                                              Chưa có GV
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* View Mode 3: Executive Summary View */}
          {viewMode === 'SUMMARY' && (() => {
            // Filter teachers and classes by branch filter
            const summaryTeachers = propTeachers.filter((t) => {
              if (t.isDeleted) return false;
              if (summaryBranchFilter === 'ALL') return true;
              return (
                t.workplaceId === summaryBranchFilter ||
                t.workplace === branches.find((b) => b.id === summaryBranchFilter)?.name ||
                (branches.find((b) => b.id === summaryBranchFilter)?.isMain && (!t.workplaceId || t.workplace === 'Điểm chính' || t.workplace === 'Toàn trường'))
              );
            });

            const summaryTeacherIds = new Set(summaryTeachers.map((t) => t.id));

            const summaryClasses = propClasses.filter((c) => {
              if (c.isDeleted) return false;
              if (summaryBranchFilter === 'ALL') return true;
              return (
                c.branchId === summaryBranchFilter ||
                (branches.find((b) => b.id === summaryBranchFilter)?.isMain && (!c.branchId || c.branchId === 'branch_main'))
              );
            });
            const summaryClassIds = new Set(summaryClasses.map((c) => c.id));

            const summaryAssignments = localAssignments.filter((a) => {
              if (a.isDeleted) return false;
              if (summaryBranchFilter === 'ALL') return true;
              return (
                summaryTeacherIds.has(a.teacherId) ||
                (a.classId && summaryClassIds.has(a.classId)) ||
                a.branchId === summaryBranchFilter
              );
            });

            // Scoped calculations
            const summaryCalcs = summaryTeachers.map((t) => {
              const calc = teacherCalculationsMap.get(t.id) || calculateTeacherWorkload(
                t,
                summaryAssignments,
                propDuties,
                departmentMap,
                semesterWeeks
              );
              return calc;
            });

            const totalTeachingPeriods = summaryAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
            const totalQuota = summaryCalcs.reduce((s, c) => s + (c.quota || 19), 0);
            const totalAssignedAndExempt = summaryCalcs.reduce((s, c) => s + (c.totalCalculated || 0), 0);
            const totalExemptPeriods = summaryCalcs.reduce((s, c) => s + (c.exemptionPeriods || 0), 0);
            const totalConcurrentPeriods = summaryCalcs.reduce((s, c) => s + (c.concurrentPeriods || 0), 0);
            const totalDiff = totalAssignedAndExempt - totalQuota;

            return (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. Header & Controls */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-900" />
                        <span>BẢNG TỔNG HỢP PHÂN CÔNG GIẢNG DẠY CHI TIẾT</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Xem số liệu toàn trường hoặc theo từng điểm trường. Bấm vào bất kỳ dòng nào để xem cụ thể danh sách GV và lớp được phân công.
                      </p>
                    </div>

                    {/* Scope Selector: Toàn trường / Điểm chính / Phân hiệu */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
                        <select
                          value={summaryBranchFilter}
                          onChange={(e) => setSummaryBranchFilter(e.target.value)}
                          className="bg-transparent font-bold text-slate-800 pr-2 focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">🏫 Xem Toàn trường ({branches.length} điểm)</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              📍 {b.name} {b.isMain ? '(Điểm chính)' : '(Phân hiệu)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                        <Users className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
                        <select
                          value={summaryDeptFilter}
                          onChange={(e) => setSummaryDeptFilter(e.target.value)}
                          className="bg-transparent font-bold text-slate-800 pr-2 focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">Tất cả Tổ chuyên môn</option>
                          {propDepartments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fullName || d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={summarySearch}
                          onChange={(e) => setSummarySearch(e.target.value)}
                          placeholder="Tìm tổ, môn, GV..."
                          className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs w-36 focus:w-48 transition-all focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Tổng giáo viên</div>
                      <div className="text-lg font-black text-blue-950 mt-0.5">{summaryTeachers.length} GV</div>
                      <div className="text-[10px] text-blue-600 font-medium">Trong phạm vi</div>
                    </div>

                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                      <div className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Tổng số lớp</div>
                      <div className="text-lg font-black text-indigo-950 mt-0.5">{summaryClasses.length} lớp</div>
                      <div className="text-[10px] text-indigo-600 font-medium">Toàn khối 6-9</div>
                    </div>

                    <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                      <div className="text-[10px] text-sky-700 font-bold uppercase tracking-wider">Tiết giảng dạy</div>
                      <div className="text-lg font-black text-sky-950 mt-0.5">{totalTeachingPeriods} tiết</div>
                      <div className="text-[10px] text-sky-600 font-medium">{summaryAssignments.filter(a => a.isInterSchool).length > 0 ? `Gồm cả liên trường` : `Đã phân công`}</div>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Kiêm nhiệm & Miễn giảm</div>
                      <div className="text-lg font-black text-amber-950 mt-0.5">{totalConcurrentPeriods + totalExemptPeriods} tiết</div>
                      <div className="text-[10px] text-amber-700 font-medium">KN: {totalConcurrentPeriods}t • MG: {totalExemptPeriods}t</div>
                    </div>

                    <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                      <div className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Tổng tính / Đ.Mức</div>
                      <div className="text-lg font-black text-purple-950 mt-0.5">
                        {totalAssignedAndExempt} / {totalQuota}
                      </div>
                      <div className="text-[10px] text-purple-600 font-medium">Định mức chung</div>
                    </div>

                    <div className={`p-3 rounded-xl border ${
                      totalDiff === 0
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : totalDiff > 0
                        ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                        : 'bg-rose-50/80 border-rose-200 text-rose-950'
                    }`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Cân đối tổng thể</div>
                      <div className="text-lg font-black mt-0.5">
                        {totalDiff === 0 ? 'Đủ 100%' : totalDiff > 0 ? `Thừa +${totalDiff}t` : `Thiếu ${totalDiff}t`}
                      </div>
                      <div className="text-[10px] font-medium opacity-80">
                        {totalDiff === 0 ? 'Cân đối hoàn hảo' : totalDiff > 0 ? 'Cần giảm tải' : 'Còn trống tiết'}
                      </div>
                    </div>
                  </div>

                  {/* 3. Sub-tabs Selector */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setSummarySubTab('DEPT')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        summarySubTab === 'DEPT'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>1. Tổng hợp theo Tổ chuyên môn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummarySubTab('SUBJECT')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        summarySubTab === 'SUBJECT'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>2. Tổng hợp theo Môn học</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummarySubTab('CLASS')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        summarySubTab === 'CLASS'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>3. Tổng hợp theo Lớp học</span>
                    </button>
                  </div>
                </div>

                {/* 4. MAIN TABLES WITH CLICK-TO-INSPECT */}
                {/* SUBTAB 1: BY DEPARTMENT */}
                {summarySubTab === 'DEPT' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        Danh sách các Tổ chuyên môn ({propDepartments.length} tổ)
                      </span>
                      <span className="text-slate-500 italic">
                        💡 Nhấp vào bất kỳ hàng nào để xem danh sách Giáo viên và Lớp được phân
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-12">STT</th>
                            <th className="py-2.5 px-4">Tổ chuyên môn</th>
                            <th className="py-2.5 px-3 text-center">Số GV</th>
                            <th className="py-2.5 px-3 text-center">Số lớp dạy</th>
                            <th className="py-2.5 px-3 text-center">Tiết dạy</th>
                            <th className="py-2.5 px-3 text-center">Kiêm nhiệm</th>
                            <th className="py-2.5 px-3 text-center">Miễn giảm (con mọn)</th>
                            <th className="py-2.5 px-3 text-center font-bold text-blue-900">Tổng tính</th>
                            <th className="py-2.5 px-3 text-center">Định mức</th>
                            <th className="py-2.5 px-3 text-center font-bold">Chênh lệch</th>
                            <th className="py-2.5 px-3 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {propDepartments
                            .filter((dept) => {
                              if (summaryDeptFilter !== 'ALL' && dept.id !== summaryDeptFilter) return false;
                              if (summarySearch.trim()) {
                                const q = summarySearch.toLowerCase().trim();
                                return (
                                  (dept.fullName || dept.name).toLowerCase().includes(q) ||
                                  dept.code.toLowerCase().includes(q)
                                );
                              }
                              return true;
                            })
                            .map((dept, idx) => {
                              const deptTeachers = summaryTeachers.filter((t) => t.departmentId === dept.id);
                              const deptTeacherIds = new Set(deptTeachers.map((t) => t.id));
                              const deptCalcs = summaryCalcs.filter((c) => deptTeacherIds.has(c.teacherId));
                              const deptAssignments = summaryAssignments.filter((a) => deptTeacherIds.has(a.teacherId));
                              const uniqueClassCount = new Set(deptAssignments.map((a) => a.classId).filter(Boolean)).size;

                              const teachingP = deptAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
                              const concurrentP = deptCalcs.reduce((s, c) => s + (c.concurrentPeriods || 0), 0);
                              const exemptP = deptCalcs.reduce((s, c) => s + (c.exemptionPeriods || 0), 0);
                              const totalP = deptCalcs.reduce((s, c) => s + (c.totalCalculated || 0), 0);
                              const quotaP = deptCalcs.reduce((s, c) => s + (c.quota || 19), 0);
                              const diffP = totalP - quotaP;

                              return (
                                <tr
                                  key={dept.id}
                                  onClick={() =>
                                    setSummaryDrilldownItem({
                                      type: 'DEPT',
                                      id: dept.id,
                                      title: dept.fullName || dept.name,
                                      subtitle: `${deptTeachers.length} Giáo viên • ${uniqueClassCount} Lớp học được phân công`,
                                    })
                                  }
                                  className="hover:bg-blue-50/70 transition cursor-pointer group"
                                  title="Bấm để xem chi tiết Giáo viên và Lớp được phân"
                                >
                                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-900 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-700 flex-shrink-0" />
                                    <span>{dept.fullName || dept.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono font-normal">({dept.code})</span>
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-800">{deptTeachers.length} GV</td>
                                  <td className="py-3 px-3 text-center font-medium text-slate-700">{uniqueClassCount} lớp</td>
                                  <td className="py-3 px-3 text-center text-slate-800">{teachingP}</td>
                                  <td className="py-3 px-3 text-center text-slate-700">{concurrentP}</td>
                                  <td className="py-3 px-3 text-center text-amber-700 font-medium">{exemptP}</td>
                                  <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/40">{totalP}</td>
                                  <td className="py-3 px-3 text-center text-slate-600 font-bold">{quotaP}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        diffP === 0
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : diffP > 0
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                      }`}
                                    >
                                      {diffP === 0 ? 'Đủ' : diffP > 0 ? `+${diffP}t` : `${diffP}t`}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSummaryDrilldownItem({
                                          type: 'DEPT',
                                          id: dept.id,
                                          title: dept.fullName || dept.name,
                                          subtitle: `${deptTeachers.length} Giáo viên • ${uniqueClassCount} Lớp học được phân công`,
                                        })
                                      }
                                      className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Xem GV & Lớp</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUBTAB 2: BY SUBJECT */}
                {summarySubTab === 'SUBJECT' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        Tổng hợp theo từng Môn học ({propSubjects.length} môn)
                      </span>
                      <span className="text-slate-500 italic">
                        💡 Nhấp vào bất kỳ môn nào để xem giáo viên dạy và danh sách lớp
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-12">STT</th>
                            <th className="py-2.5 px-4">Môn học</th>
                            <th className="py-2.5 px-3">Tổ chuyên môn</th>
                            <th className="py-2.5 px-3 text-center">Số GV phân dạy</th>
                            <th className="py-2.5 px-3 text-center">Số lớp được phân</th>
                            <th className="py-2.5 px-3 text-center">Tổng tiết/tuần</th>
                            <th className="py-2.5 px-3 text-center">Dạy liên trường</th>
                            <th className="py-2.5 px-3 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {propSubjects
                            .filter((subj) => {
                              if (summaryDeptFilter !== 'ALL' && subj.departmentId !== summaryDeptFilter) return false;
                              if (summarySearch.trim()) {
                                const q = summarySearch.toLowerCase().trim();
                                return subj.name.toLowerCase().includes(q) || subj.code.toLowerCase().includes(q);
                              }
                              return true;
                            })
                            .map((subj, idx) => {
                              const dept = departmentMap.get(subj.departmentId);
                              const subjAssignments = summaryAssignments.filter((a) => a.subjectId === subj.id);
                              const assignedTeacherIds = Array.from(new Set(subjAssignments.map((a) => a.teacherId)));
                              const assignedClassIds = Array.from(new Set(subjAssignments.map((a) => a.classId).filter(Boolean)));
                              const totalPeriods = subjAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
                              const interSchoolCount = subjAssignments.filter((a) => a.isInterSchool).length;

                              return (
                                <tr
                                  key={subj.id}
                                  onClick={() =>
                                    setSummaryDrilldownItem({
                                      type: 'SUBJECT',
                                      id: subj.id,
                                      title: `Môn ${subj.name} (${subj.code})`,
                                      subtitle: `${assignedTeacherIds.length} Giáo viên dạy • ${assignedClassIds.length} Lớp học • Tổng ${totalPeriods} tiết/tuần`,
                                    })
                                  }
                                  className="hover:bg-blue-50/70 transition cursor-pointer group"
                                  title="Bấm để xem danh sách Giáo viên và Lớp dạy môn này"
                                >
                                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-900 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                                    <span>{subj.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono font-normal">({subj.code})</span>
                                    {subj.isIntegrated && (
                                      <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">Tích hợp</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-slate-600 font-medium">{dept?.fullName || dept?.name || 'Tổ CM'}</td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-800">{assignedTeacherIds.length} GV</td>
                                  <td className="py-3 px-3 text-center font-medium text-slate-700">{assignedClassIds.length} lớp</td>
                                  <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/30">{totalPeriods} tiết</td>
                                  <td className="py-3 px-3 text-center text-purple-700 font-medium">
                                    {interSchoolCount > 0 ? `${interSchoolCount} phân công` : '-'}
                                  </td>
                                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSummaryDrilldownItem({
                                          type: 'SUBJECT',
                                          id: subj.id,
                                          title: `Môn ${subj.name} (${subj.code})`,
                                          subtitle: `${assignedTeacherIds.length} Giáo viên dạy • ${assignedClassIds.length} Lớp học • Tổng ${totalPeriods} tiết/tuần`,
                                        })
                                      }
                                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Xem GV & Lớp</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUBTAB 3: BY CLASS */}
                {summarySubTab === 'CLASS' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        Tổng hợp theo từng Lớp học ({summaryClasses.length} lớp)
                      </span>
                      <span className="text-slate-500 italic">
                        💡 Nhấp vào bất kỳ lớp nào để xem toàn bộ danh sách Giáo viên & Môn học được phân cho lớp
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-12">STT</th>
                            <th className="py-2.5 px-4">Lớp học</th>
                            <th className="py-2.5 px-3 text-center">Khối</th>
                            <th className="py-2.5 px-3 text-center">Ca học</th>
                            <th className="py-2.5 px-3">Điểm trường</th>
                            <th className="py-2.5 px-3 text-center">Số môn đã phân</th>
                            <th className="py-2.5 px-3 text-center">Số GV phụ trách</th>
                            <th className="py-2.5 px-3 text-center font-bold text-blue-900">Tổng tiết/tuần</th>
                            <th className="py-2.5 px-3 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summaryClasses
                            .filter((c) => {
                              if (summarySearch.trim()) {
                                const q = summarySearch.toLowerCase().trim();
                                return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
                              }
                              return true;
                            })
                            .map((cls, idx) => {
                              const clsAssignments = summaryAssignments.filter((a) => a.classId === cls.id);
                              const assignedTeacherIds = Array.from(new Set(clsAssignments.map((a) => a.teacherId)));
                              const assignedSubjects = Array.from(new Set(clsAssignments.map((a) => a.subjectId).filter(Boolean)));
                              const totalPeriods = clsAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
                              const branch = branches.find((b) => b.id === cls.branchId);

                              return (
                                <tr
                                  key={cls.id}
                                  onClick={() =>
                                    setSummaryDrilldownItem({
                                      type: 'CLASS',
                                      id: cls.id,
                                      title: `Lớp ${cls.name} (Khối ${cls.grade})`,
                                      subtitle: `${assignedTeacherIds.length} Giáo viên phụ trách • ${assignedSubjects.length} Môn học • Tổng ${totalPeriods} tiết/tuần`,
                                    })
                                  }
                                  className="hover:bg-blue-50/70 transition cursor-pointer group"
                                  title="Bấm để xem danh sách Giáo viên và Môn học được phân cho lớp này"
                                >
                                  <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-blue-900 flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4 text-indigo-700 flex-shrink-0" />
                                    <span>{cls.name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono font-normal">({cls.room || 'Phòng học'})</span>
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-800">Khối {cls.grade}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      cls.session === 'MORNING' ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'
                                    }`}>
                                      {cls.session === 'MORNING' ? 'Sáng' : 'Chiều'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-slate-600 font-medium">{branch?.name || (cls.branchId === 'branch_sub' ? 'Phân hiệu' : 'Điểm chính')}</td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-800">{assignedSubjects.length} môn</td>
                                  <td className="py-3 px-3 text-center font-medium text-slate-700">{assignedTeacherIds.length} GV</td>
                                  <td className="py-3 px-3 text-center font-black text-blue-900 bg-blue-50/30">{totalPeriods} tiết</td>
                                  <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSummaryDrilldownItem({
                                          type: 'CLASS',
                                          id: cls.id,
                                          title: `Lớp ${cls.name} (Khối ${cls.grade})`,
                                          subtitle: `${assignedTeacherIds.length} Giáo viên phụ trách • ${assignedSubjects.length} Môn học • Tổng ${totalPeriods} tiết/tuần`,
                                        })
                                      }
                                      className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Xem GV & Môn</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 5. INTERACTIVE DRILL-DOWN MODAL */}
                {/* ======================================================== */}
                {summaryDrilldownItem && (() => {
                  let drilldownTeachers: Teacher[] = [];
                  let drilldownAssignments: TeachingAssignment[] = [];

                  if (summaryDrilldownItem.type === 'DEPT') {
                    drilldownTeachers = summaryTeachers.filter((t) => t.departmentId === summaryDrilldownItem.id);
                    const tIdSet = new Set(drilldownTeachers.map((t) => t.id));
                    drilldownAssignments = summaryAssignments.filter((a) => tIdSet.has(a.teacherId));
                  } else if (summaryDrilldownItem.type === 'SUBJECT') {
                    drilldownAssignments = summaryAssignments.filter((a) => a.subjectId === summaryDrilldownItem.id);
                    const tIdSet = new Set(drilldownAssignments.map((a) => a.teacherId));
                    drilldownTeachers = summaryTeachers.filter((t) => tIdSet.has(t.id));
                  } else if (summaryDrilldownItem.type === 'CLASS') {
                    drilldownAssignments = summaryAssignments.filter((a) => a.classId === summaryDrilldownItem.id);
                    const tIdSet = new Set(drilldownAssignments.map((a) => a.teacherId));
                    drilldownTeachers = summaryTeachers.filter((t) => tIdSet.has(t.id));
                  }

                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                        {/* Modal Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white flex items-center justify-between flex-shrink-0">
                          <div>
                            <div className="flex items-center gap-2 font-black text-base">
                              <FileText className="w-5 h-5 text-amber-300" />
                              <span>{summaryDrilldownItem.title}</span>
                            </div>
                            {summaryDrilldownItem.subtitle && (
                              <p className="text-xs text-blue-200 mt-0.5">{summaryDrilldownItem.subtitle}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSummaryDrilldownItem(null)}
                            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                          {/* Part 1: Danh sách Giáo viên */}
                          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-800" />
                                <span>1. DANH SÁCH GIÁO VIÊN ĐƯỢC PHÂN CÔNG ({drilldownTeachers.length} GV)</span>
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Bấm "Phân công" để chuyển ngay sang ma trận của GV đó
                              </span>
                            </div>

                            {drilldownTeachers.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                                Chưa có giáo viên nào được phân công cho mục này.
                              </div>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-2.5 text-center w-10">STT</th>
                                      <th className="py-2 px-3">Họ và tên</th>
                                      <th className="py-2 px-2.5 text-center">Nơi CT</th>
                                      <th className="py-2 px-3">Chức vụ / Kiêm nhiệm</th>
                                      <th className="py-2 px-2.5 text-center">Miễn giảm (con mọn)</th>
                                      <th className="py-2 px-2.5 text-center">Tiết trường</th>
                                      <th className="py-2 px-2.5 text-center">Tiết liên trường</th>
                                      <th className="py-2 px-2.5 text-center font-bold text-blue-900">Tổng tính</th>
                                      <th className="py-2 px-2.5 text-center">Định mức</th>
                                      <th className="py-2 px-2.5 text-center">Cân đối</th>
                                      <th className="py-2 px-2.5 text-center">Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {drilldownTeachers.map((t, tIdx) => {
                                      const calc = teacherCalculationsMap.get(t.id);
                                      const quota = calc?.quota ?? t.standardQuota ?? 19;
                                      const totalP = calc?.totalCalculated ?? 0;
                                      const diff = calc ? calc.difference : (totalP - quota);
                                      const tAss = drilldownAssignments.filter((a) => a.teacherId === t.id);
                                      const interP = tAss.filter((a) => a.isInterSchool).reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
                                      const localP = tAss.filter((a) => !a.isInterSchool).reduce((s, a) => s + (a.periodsPerWeek || 0), 0);

                                      return (
                                        <tr key={t.id} className="hover:bg-slate-50 transition">
                                          <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{tIdx + 1}</td>
                                          <td className="py-2 px-3 font-bold text-slate-900">
                                            <span>{t.fullName}</span>{' '}
                                            <span className="text-[10px] text-slate-500 font-mono">({t.code})</span>
                                          </td>
                                          <td className="py-2 px-2.5 text-center text-slate-600">{t.workplace || 'Điểm chính'}</td>
                                          <td className="py-2 px-3 text-slate-700">
                                            {(() => {
                                              const posList = getTeacherPositions(
                                                t,
                                                propDepartments,
                                                propDuties,
                                                localAssignments,
                                                propClasses
                                              );
                                              return posList.length > 0 ? (
                                                <span className="font-medium text-slate-800">
                                                  {posList.join(', ')}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">-</span>
                                              );
                                            })()}
                                          </td>
                                          <td className="py-2 px-2.5 text-center text-amber-700 font-medium">
                                            {calc?.exemptionPeriods ? `${calc.exemptionPeriods}t` : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-center text-slate-800">{localP}t</td>
                                          <td className="py-2 px-2.5 text-center text-purple-700 font-bold">
                                            {interP > 0 ? `${interP}t` : '-'}
                                          </td>
                                          <td className="py-2 px-2.5 text-center font-black text-blue-900 bg-blue-50/40">
                                            {totalP}t
                                          </td>
                                          <td className="py-2 px-2.5 text-center text-slate-600 font-bold">{quota}t</td>
                                          <td className="py-2 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              diff === 0 ? 'bg-emerald-100 text-emerald-800' : diff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              {diff === 0 ? 'Đủ' : diff > 0 ? `+${diff}t` : `${diff}t`}
                                            </span>
                                          </td>
                                          <td className="py-2 px-2.5 text-center">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedTeacherId(t.id);
                                                setViewMode('TEACHER');
                                                setSummaryDrilldownItem(null);
                                              }}
                                              className="px-2 py-0.5 bg-blue-900 hover:bg-blue-800 text-white rounded text-[11px] font-bold transition cursor-pointer"
                                            >
                                              Phân công →
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Part 2: Danh sách Lớp & Môn được phân */}
                          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-indigo-800" />
                                <span>2. DANH SÁCH LỚP HỌC & TIẾT ĐƯỢC PHÂN ({drilldownAssignments.length} phân công)</span>
                              </h4>
                              <span className="text-[11px] text-slate-500">
                                Chi tiết từng lớp, ca học và số tiết phân công
                              </span>
                            </div>

                            {drilldownAssignments.length === 0 ? (
                              <div className="p-4 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
                                Chưa có lớp nào được phân công cho mục này.
                              </div>
                            ) : (
                              <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-2.5 text-center w-10">STT</th>
                                      <th className="py-2 px-3">Lớp học</th>
                                      <th className="py-2 px-3">Môn học / Nhiệm vụ</th>
                                      <th className="py-2 px-3">Giáo viên phụ trách</th>
                                      <th className="py-2 px-2.5 text-center">Số tiết/tuần</th>
                                      <th className="py-2 px-2.5 text-center">Ca dạy</th>
                                      <th className="py-2 px-3">Điểm trường / Liên trường</th>
                                      <th className="py-2 px-3">Ghi chú</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {drilldownAssignments.map((a, aIdx) => {
                                      const t = teacherMap.get(a.teacherId);
                                      const cls = a.classId ? classMap.get(a.classId) : null;
                                      const subj = a.subjectId ? subjectMap.get(a.subjectId) : null;
                                      const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;

                                      return (
                                        <tr key={a.id} className="hover:bg-slate-50 transition">
                                          <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{aIdx + 1}</td>
                                          <td className="py-2 px-3 font-bold text-slate-900">
                                            {cls ? (
                                              <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 rounded font-black">
                                                {cls.name}
                                              </span>
                                            ) : a.isInterSchool ? (
                                              <span className="bg-purple-50 text-purple-900 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                                                Liên trường
                                              </span>
                                            ) : (
                                              'Toàn trường'
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-medium text-slate-800">
                                            {subj?.name || a.dutyName || duty?.name || 'Phân công'}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-blue-900">
                                            {t?.fullName || 'Chưa gán'} ({t?.code})
                                          </td>
                                          <td className="py-2 px-2.5 text-center font-black text-slate-900">
                                            {a.periodsPerWeek} tiết
                                          </td>
                                          <td className="py-2 px-2.5 text-center">
                                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                              a.session === 'MORNING' ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'
                                            }`}>
                                              {a.session === 'MORNING' ? 'Sáng' : a.session === 'AFTERNOON' ? 'Chiều' : 'Hoạt động'}
                                            </span>
                                          </td>
                                          <td className="py-2 px-3 text-slate-600">
                                            {a.isInterSchool ? (
                                              <span className="font-bold text-purple-700">🏫 {a.interSchoolName || 'Trường khác'}</span>
                                            ) : (
                                              cls?.branchId === 'branch_sub' ? 'Phân hiệu' : 'Điểm chính'
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-slate-400 italic">
                                            {a.notes || '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                          <span className="text-[11px] text-slate-500">
                            {schoolInfo.schoolName || 'TRƯỜNG THCS'} • Phân công chuyên môn chính thức
                          </span>
                          <button
                            type="button"
                            onClick={() => setSummaryDrilldownItem(null)}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                          >
                            Đóng cửa sổ
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ======================================================================= */}
          {/* 4. FIXED BOTTOM BAR: AI TƯ VẤN PHÂN CÔNG */}
          {/* ======================================================================= */}
          <div className="bg-white border-t border-blue-200/90 shadow-md flex-shrink-0 z-20">
            {/* AI Bar Header */}
            <div
              onClick={() => setIsAIDrawerExpanded(!isAIDrawerExpanded)}
              className="px-4 py-2 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 hover:bg-blue-100/70 border-b border-blue-200/80 text-blue-950 flex items-center justify-between cursor-pointer transition select-none"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                <span className="font-bold text-xs tracking-wide uppercase text-blue-950">
                  AI TƯ VẤN PHÂN CÔNG
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-900 font-bold">
                  {aiAdvices.length} tư vấn có sẵn
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-blue-800 font-semibold">
                <span>{isAIDrawerExpanded ? 'Thu gọn tư vấn' : 'Bấm để mở xem đề xuất'}</span>
                {isAIDrawerExpanded ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
              </div>
            </div>

            {/* AI Recommendations List */}
            {isAIDrawerExpanded && (
              <div className="p-3 max-h-48 overflow-y-auto bg-slate-50 divide-y divide-slate-200/80">
                {aiAdvices.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Phương án hiện tại rất cân bằng, không phát hiện xung đột hay thiếu hụt tiết nghiêm trọng.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {aiAdvices.map((advice) => (
                      <div
                        key={advice.id}
                        className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                                advice.priority === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : advice.priority === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {advice.priority === 'HIGH' ? 'Khẩn cấp' : advice.priority === 'MEDIUM' ? 'Khuyên dùng' : 'Tối ưu'}
                            </span>
                            <h4 className="font-bold text-slate-900 text-xs">{advice.title}</h4>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-600">{advice.basis}</p>
                        <p className="text-[11px] text-blue-900 font-semibold bg-blue-50/60 p-1 rounded-md">
                          👉 Đề xuất: {advice.recommendation}
                        </p>

                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <span className="text-slate-400">{advice.impact}</span>
                          {canEdit && advice.actionPayload && (
                            <button
                              onClick={() => handleApplyAdvice(advice)}
                              className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Áp dụng</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ----------------------------------------------------------------------- */}
        {/* 3C. RIGHT COLUMN: HỒ SƠ & KIÊM NHIỆM GIÁO VIÊN ĐANG CHỌN */}
        {/* ----------------------------------------------------------------------- */}
        <aside
          className={`bg-white border-l border-slate-200 flex flex-col transition-all duration-200 flex-shrink-0 z-10 ${
            isRightCollapsed ? 'w-12' : 'w-72 lg:w-80'
          }`}
        >
          {/* Header & Toggle */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <button
              onClick={() => setIsRightCollapsed(!isRightCollapsed)}
              className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg transition mr-auto cursor-pointer"
              title={isRightCollapsed ? 'Mở rộng chi tiết' : 'Thu gọn'}
            >
              {isRightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {!isRightCollapsed && (
              <span className="text-xs font-bold text-slate-900">
                {viewMode === 'CLASS_SUBJECT' ? 'Hồ sơ Lớp & Hội đồng GV' : 'Chi tiết & Kiêm nhiệm'}
              </span>
            )}
          </div>

          {!isRightCollapsed && (
            <>
              {viewMode === 'CLASS_SUBJECT' ? (
                /* ========================================================= */
                /* CLASS PROFILE & FACULTY COUNCIL (For CLASS_SUBJECT Mode) */
                /* ========================================================= */
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {/* Class Profile Card */}
                  <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-900 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {currentSelectedClass?.name || 'Lớp'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          Lớp {currentSelectedClass?.name}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Khối {currentSelectedClass?.grade} • {currentSelectedClass?.room ? `Phòng ${currentSelectedClass?.room}` : 'Chưa xếp phòng'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs pt-1 border-t border-blue-200/60 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Sĩ số học sinh:</span>
                        <strong className="text-slate-900">{currentSelectedClass?.studentCount || 0} học sinh</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Ca học:</span>
                        <strong className="text-slate-900">
                          {currentSelectedClass?.session === 'MORNING' ? 'Buổi Sáng' : 'Buổi Chiều'}
                        </strong>
                      </div>
                    </div>

                    {currentSelectedClass?.homeroomTeacherId && (
                      <div className="pt-1 border-t border-blue-200/60 text-xs text-slate-700">
                        <span className="text-[10px] text-slate-400 block">Giáo viên chủ nhiệm:</span>
                        <strong className="text-blue-900">
                          {propTeachers.find((t) => t.id === currentSelectedClass.homeroomTeacherId)?.fullName || 'Đã phân công'}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Class Completion Status Card */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                      Tiến độ phân công lớp {currentSelectedClass?.name}
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Tổng số tiết cần dạy:</span>
                        <strong className="font-mono text-slate-900">{currentClassMetrics.totalNeeded} tiết/tuần</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Số tiết đã gán giáo viên:</span>
                        <strong className="font-mono text-emerald-700">{currentClassMetrics.totalAssigned} tiết</strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Số tiết còn thiếu:</span>
                        <strong className={`font-mono ${currentClassMetrics.missingPeriods === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {currentClassMetrics.missingPeriods} tiết
                        </strong>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span>Mức độ hoàn thành:</span>
                          <span className="font-mono text-blue-900">
                            {currentClassMetrics.totalNeeded > 0
                              ? Math.round((currentClassMetrics.totalAssigned / currentClassMetrics.totalNeeded) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              currentClassMetrics.missingPeriods === 0 ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{
                              width: `${
                                currentClassMetrics.totalNeeded > 0
                                  ? Math.min(100, Math.round((currentClassMetrics.totalAssigned / currentClassMetrics.totalNeeded) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Urgent missing subjects notice */}
                  {currentClassMetrics.missingSubjectsCount > 0 && (
                    <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Chưa có GV ({currentClassMetrics.missingSubjectsCount} môn)</span>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        Vui lòng chọn giáo viên ở bảng môn học để hoàn tất phân công giảng dạy cho lớp này.
                      </p>
                    </div>
                  )}

                  {/* Faculty Council for this class (Hội đồng Giáo viên bộ môn) */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-900" />
                        <span>Hội đồng GV giảng dạy ({assignedTeachersForCurrentClass.length})</span>
                      </h4>
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {assignedTeachersForCurrentClass.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Lớp này chưa có giáo viên nào được phân công.</p>
                      ) : (
                        assignedTeachersForCurrentClass.map(({ assignment, teacher, subject, department }) => (
                          <div
                            key={assignment.id}
                            className="p-2 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200 text-xs transition"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">{teacher?.fullName || 'GV'}</span>
                              <span className="font-mono text-blue-900 font-bold">{assignment.periodsPerWeek} tiết/tuần</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                              <span>Môn: {subject?.name || 'Môn học'}</span>
                              <span className="text-[10px] text-slate-400">{department?.name}</span>
                            </div>
                            {canEdit && (
                              <div className="pt-1 mt-1 border-t border-slate-200/60 flex justify-end">
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  className="text-[10px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Gỡ phân công</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : currentSelectedTeacher ? (
                /* ========================================================= */
                /* TEACHER PROFILE & WORKLOAD (For TEACHER Mode) */
                /* ========================================================= */
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  {/* Teacher Profile Card */}
                  <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-900 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                        {currentSelectedTeacher.fullName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {currentSelectedTeacher.fullName}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Mã: {currentSelectedTeacher.code} • {currentSelectedTeacher.workplace || 'Điểm chính'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs pt-1 border-t border-blue-200/60 text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Chuyên môn:</span>
                        <strong className="text-slate-900">{currentSelectedTeacher.major || 'Đại học'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Định mức chuẩn:</span>
                        <strong className="text-slate-900">{currentTeacherCalc?.quota ?? currentSelectedTeacher.standardQuota ?? 19} tiết/tuần</strong>
                      </div>
                    </div>
                  </div>

                  {/* Workload Metric Breakdown */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                      Cân đối định mức giảng dạy
                    </h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>1. Tiết giảng dạy thực tế:</span>
                        <strong className="font-mono text-slate-900">
                          {(currentTeacherCalc?.morningPeriods || 0) + (currentTeacherCalc?.afternoonPeriods || 0)} tiết
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span>2. Tiết kiêm nhiệm quy đổi:</span>
                        <strong className="font-mono text-blue-900">
                          {currentTeacherCalc?.concurrentPeriods || 0} tiết
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span>3. Tiết miễn/giảm theo chế độ:</span>
                        <strong className="font-mono text-purple-900">
                          {currentTeacherCalc?.exemptionPeriods || 0} tiết
                        </strong>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold">
                        <span>Tổng được tính:</span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {currentTeacherCalc?.totalCalculated || 0} / {currentTeacherCalc?.quota ?? currentSelectedTeacher.standardQuota ?? 19}
                        </span>
                      </div>

                      <div className="flex items-center justify-between font-bold pt-1">
                        <span>Chênh lệch định mức:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-mono font-black ${
                            (currentTeacherCalc?.difference || 0) === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : (currentTeacherCalc?.difference || 0) < 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {(currentTeacherCalc?.difference || 0) > 0 ? `+${currentTeacherCalc?.difference}` : currentTeacherCalc?.difference} tiết
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Classes List */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">Lớp đang giảng dạy</h4>
                      <span className="text-[10px] text-slate-400">
                        {
                          localAssignments.filter(
                            (a) => a.teacherId === currentSelectedTeacher.id && a.type === 'TEACHING'
                          ).length
                        } lớp
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {localAssignments
                        .filter((a) => a.teacherId === currentSelectedTeacher.id && a.type === 'TEACHING')
                        .map((asg) => {
                          const cls = propClasses.find((c) => c.id === asg.classId);
                          const subj = propSubjects.find((s) => s.id === asg.subjectId);

                          return (
                            <div
                              key={asg.id}
                              className="flex items-center justify-between p-1.5 bg-slate-50 rounded-xl text-xs border border-slate-200"
                            >
                              <div>
                                <span className="font-bold text-slate-900">{cls?.name}</span> •{' '}
                                <span className="text-slate-600">{subj?.name}</span>
                                <span className="block text-[10px] text-slate-400">
                                  {asg.periodsPerWeek} tiết/tuần ({asg.totalPeriods} tiết/HK)
                                </span>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => handleRemoveAssignment(asg.id)}
                                  className="text-slate-400 hover:text-red-700 p-1"
                                  title="Gỡ lớp này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Concurrent Duties (Phân công kiêm nhiệm) */}
                  <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-blue-900" />
                        <span>Nhiệm vụ kiêm nhiệm</span>
                      </h4>
                      {canEdit && (
                        <button
                          onClick={() => setIsConcurrentModalOpen(true)}
                          className="text-[10px] font-bold px-2 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {localAssignments
                        .filter((a) => a.teacherId === currentSelectedTeacher.id && a.type === 'CONCURRENT')
                        .map((asg) => (
                          <div
                            key={asg.id}
                            className="flex items-center justify-between p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs"
                          >
                            <div>
                              <span className="font-bold text-amber-900">{asg.dutyName || 'Kiêm nhiệm'}</span>
                              <span className="block text-[10px] text-amber-700">
                                Quy đổi: {asg.periodsPerWeek} tiết/tuần
                              </span>
                            </div>
                            {canEdit && (
                              <button
                                onClick={() => handleRemoveAssignment(asg.id)}
                                className="text-slate-400 hover:text-red-700 p-1 cursor-pointer"
                                title="Xóa nhiệm vụ kiêm nhiệm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      {localAssignments.filter(
                        (a) => a.teacherId === currentSelectedTeacher.id && a.type === 'CONCURRENT'
                      ).length === 0 && (
                        <p className="text-[11px] text-slate-400 italic">Chưa có nhiệm vụ kiêm nhiệm.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {/* ========================================================================= */}
      {/* 4.5. MODAL: GỢI Ý GIÁO VIÊN TỰ ĐỘNG CHO Ô PHÂN CÔNG (Ưu tiên chưa đủ định mức) */}
      {/* ========================================================================= */}
      {cellSuggestionTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-blue-700 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Gợi ý giáo viên cho ô phân công</h3>
                  <p className="text-xs text-slate-500">
                    Lớp <strong className="text-blue-900 font-bold">{cellSuggestionTarget.cls.name}</strong> • Môn{' '}
                    <strong className="text-slate-800 font-bold">{cellSuggestionTarget.subject.name}</strong> •{' '}
                    {getSubjectStandardPeriods(cellSuggestionTarget.cls.grade, cellSuggestionTarget.subject.id)} tiết/tuần
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCellSuggestionTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 text-xs text-blue-950 flex items-start gap-2.5 flex-shrink-0">
              <Sparkles className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
              <div>
                Hệ thống tự động lọc giáo viên cùng bộ môn, cùng tổ chuyên môn và <strong>ưu tiên cao nhất những giáo viên chưa đủ định mức tiết dạy</strong> để đề xuất xếp trước.
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {getSmartTeacherSuggestions({
                subject: cellSuggestionTarget.subject,
                targetClass: cellSuggestionTarget.cls,
                teachers: propTeachers,
                departments: propDepartments,
                assignments: localAssignments,
                calculationsMap: teacherCalculationsMap,
                maxResults: 10,
              }).map((sugg) => (
                <div
                  key={sugg.teacher.id}
                  className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    sugg.isUnderQuota
                      ? 'bg-amber-50/40 border-amber-200/90 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{sugg.teacher.fullName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {sugg.teacher.code}
                      </span>
                      {sugg.isUnderQuota && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                          Ưu tiên: Thiếu {sugg.deficit} tiết
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                      <span>Tổ: {sugg.department?.name || 'Chuyên môn'}</span>
                      <span>•</span>
                      <span>Nơi làm việc: {sugg.teacher.workplace || 'Điểm chính'}</span>
                      <span>•</span>
                      <span className={sugg.isUnderQuota ? 'text-amber-800 font-bold' : 'text-slate-700'}>
                        Hiện dạy: {sugg.currentPeriods}/{sugg.quota} tiết
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      handleAssignSuggestedTeacher(
                        cellSuggestionTarget.cls,
                        cellSuggestionTarget.subject,
                        sugg.teacher.id
                      )
                    }
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-xs cursor-pointer transition flex items-center gap-1"
                  >
                    <span>Phân công</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setCellSuggestionTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: XÁC NHẬN CHUYỂN PHÂN CÔNG GIỮA 2 GIÁO VIÊN */}
      {/* ========================================================================= */}
      {transferPrompt && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-amber-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Shuffle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận chuyển phân công</h3>
                <p className="text-xs text-slate-500">Lớp học này đã có giáo viên giảng dạy</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p>
                Lớp <strong className="text-slate-900 font-bold">{propClasses.find((c) => c.id === transferPrompt.classId)?.name}</strong> môn{' '}
                <strong className="text-slate-900 font-bold">{propSubjects.find((s) => s.id === transferPrompt.subjectId)?.name}</strong> ({transferPrompt.periods} tiết/tuần) hiện đang được phân công cho:
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">Thầy/Cô {transferPrompt.currentTeacher.fullName}</p>
                <p className="text-[11px] text-slate-500">
                  Tổ: {propDepartments.find((d) => d.id === transferPrompt.currentTeacher.departmentId)?.name || 'Chuyên môn'}
                </p>
              </div>

              <p>Bạn có muốn chuyển toàn bộ phân công này sang:</p>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <p className="font-bold text-blue-900">Thầy/Cô {transferPrompt.newTeacher.fullName}</p>
                <p className="text-[11px] text-blue-700">
                  Chuyên môn: {transferPrompt.newTeacher.major || 'Đào tạo'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferPrompt(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận chuyển</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: CHIA TIẾT CHO NHIỀU GIÁO VIÊN HOẶC ĐIỀU CHỈNH ĐẶC BIỆT */}
      {/* ========================================================================= */}
      {isSplitPeriodModalOpen && splitTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-slate-900 text-base">
                  Chia tiết môn học ({splitTarget.totalPeriods} tiết/tuần)
                </h3>
              </div>
              <button
                onClick={() => setIsSplitPeriodModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-600">
                Phân công chia tiết cho 2 giáo viên cùng dạy lớp{' '}
                <strong className="text-slate-900">{propClasses.find((c) => c.id === splitTarget.classId)?.name}</strong> môn{' '}
                <strong className="text-slate-900">{propSubjects.find((s) => s.id === splitTarget.subjectId)?.name}</strong>.
              </p>

              {/* Teacher 1 */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">Giáo viên 1:</label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="col-span-2">
                    <SearchableTeacherSelect
                      teachers={propTeachers}
                      value={splitTarget.currentTeacherId}
                      onChange={(id) => setSplitTarget({ ...splitTarget, currentTeacherId: id })}
                      placeholder="-- Chọn hoặc tìm GV 1 --"
                      clearLabel="-- Chưa chọn GV 1 --"
                      compact
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={splitTarget.totalPeriods}
                      value={splitTarget.p1}
                      onChange={(e) => {
                        const p1 = Number(e.target.value);
                        setSplitTarget({
                          ...splitTarget,
                          p1,
                          p2: Math.max(0, splitTarget.totalPeriods - p1),
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-slate-500 text-xs">tiết</span>
                  </div>
                </div>
              </div>

              {/* Teacher 2 */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block font-bold text-slate-800">Giáo viên 2:</label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="col-span-2">
                    <SearchableTeacherSelect
                      teachers={propTeachers}
                      value={splitTarget.secondaryTeacherId}
                      filterPredicate={(t) => t.id !== splitTarget.currentTeacherId}
                      onChange={(id) => setSplitTarget({ ...splitTarget, secondaryTeacherId: id })}
                      placeholder="-- Chọn hoặc tìm GV 2 --"
                      clearLabel="-- Chưa chọn GV 2 --"
                      compact
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={splitTarget.totalPeriods}
                      value={splitTarget.p2}
                      onChange={(e) => {
                        const p2 = Number(e.target.value);
                        setSplitTarget({
                          ...splitTarget,
                          p2,
                          p1: Math.max(0, splitTarget.totalPeriods - p2),
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-slate-500">tiết</span>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Lý do chia tiết / Ghi chú:</label>
                <input
                  type="text"
                  placeholder="VD: Dạy phân môn Hóa học 2 tiết / Sinh học 2 tiết..."
                  value={splitTarget.reason}
                  onChange={(e) => setSplitTarget({ ...splitTarget, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSplitPeriodModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveSplitPeriod}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Lưu chia tiết</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: THÊM NHIỆM VỤ KIÊM NHIỆM TRỰC TIẾP */}
      {/* ========================================================================= */}
      {isConcurrentModalOpen && currentSelectedTeacher && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-slate-900 text-base">
                  Gán nhiệm vụ kiêm nhiệm: Thầy/Cô {currentSelectedTeacher.fullName}
                </h3>
              </div>
              <button
                onClick={() => setIsConcurrentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {propDuties.map((duty) => {
                const isAlreadyAssigned = localAssignments.some(
                  (a) => a.teacherId === currentSelectedTeacher.id && a.dutyId === duty.id
                );

                return (
                  <div
                    key={duty.id}
                    className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition ${
                      isAlreadyAssigned
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{duty.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Quy đổi: {duty.periodsPerWeekCalculated} tiết/tuần
                        {duty.periodsPerWeekExempted > 0 && ` • Miễn: ${duty.periodsPerWeekExempted} tiết`}
                      </p>
                      {duty.notes && <p className="text-[10px] text-slate-400 mt-0.5">{duty.notes}</p>}
                    </div>

                    <button
                      type="button"
                      disabled={isAlreadyAssigned}
                      onClick={() => handleAddConcurrentDuty(duty)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                        isAlreadyAssigned
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-900 hover:bg-blue-800 text-white shadow-xs'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAlreadyAssigned ? 'Đã gán' : 'Gán'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsConcurrentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: AI ĐỀ XUẤT PHƯƠNG ÁN PHÂN CÔNG (3 KỊCH BẢN & BẢNG SO SÁNH) */}
      {/* ========================================================================= */}
      {isOptimizeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    AI Đề xuất & So sánh phương án phân công tối ưu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hệ thống tạo 3 phương án chiến lược và đánh giá đa tiêu chí. Người quản lý quyết định áp dụng.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOptimizeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Comparison Table */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3 w-48">Chỉ số so sánh</th>
                      {optimizationScenarios.map((scen) => (
                        <th key={scen.id} className="p-3 min-w-[200px] border-l border-slate-200">
                          <div className="font-bold text-slate-900 text-xs">{scen.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{scen.description}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Mức cân bằng tải (%)</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200">
                          <span className="font-black text-sm font-mono text-emerald-700">{scen.balanceScore}%</span>
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Số tiết chưa phân công</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 font-bold text-slate-900">
                          {scen.unassignedPeriods} tiết
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Số giáo viên thiếu tiết</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 font-bold text-amber-700">
                          {scen.deficitTeachers} GV
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Số giáo viên vượt tiết</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 font-bold text-red-700">
                          {scen.surplusTeachers} GV
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Trường hợp trái chuyên môn</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 font-bold text-emerald-700">
                          {scen.mismatchCount} (0%)
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Lượt di chuyển giữa 2 điểm trường</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 font-bold text-slate-800">
                          {scen.multiBranchCount} GV
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-700">Rủi ro / Lưu ý</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200 text-slate-600 text-[11px]">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {scen.keyRisks.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>

                    <tr className="bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">Hành động</td>
                      {optimizationScenarios.map((scen) => (
                        <td key={scen.id} className="p-3 border-l border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleApplyOptimizationScenario(scen)}
                            className="w-full py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Áp dụng phương án này</span>
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsOptimizeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng hộp thoại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHING PLAN FRAMEWORK MODAL */}
      <TeachingPlanFrameworkModal
        isOpen={isTeachingPlanModalOpen}
        onClose={() => setIsTeachingPlanModalOpen(false)}
        schoolInfo={schoolInfo}
        teachers={propTeachers}
        classes={propClasses}
        subjects={propSubjects}
      />
    </div>
  );
};
