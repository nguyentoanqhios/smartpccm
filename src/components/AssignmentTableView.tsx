/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Assignment Table & Matrix View with Live Validation, Multi-Class Creation & Trash Bin
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  TableProperties,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Download,
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  X,
  Sparkles,
  Info,
  Archive,
  Maximize,
  Minimize,
  Eye,
  Edit3,
  LayoutGrid,
  List,
  Users,
  CheckSquare,
  Square,
  Copy,
  PlusCircle,
  Building2,
  FileEdit,
  FileSpreadsheet,
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
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { toastService } from '../services/toastService';
import { validateProposedAssignment } from '../validation/assignmentValidator';
import { SmartAssignmentModule } from './SmartAssignmentModule';
import { TeachingPlanFrameworkModal } from './TeachingPlanFrameworkModal';
import { getSmartTeacherSuggestions, TeacherSuggestion } from '../utils/teacherSuggestionEngine';
import { matchesQuery } from '../utils/searchUtils';

interface AssignmentTableViewProps {
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  initialSearchTerm?: string;
  initialSelectedClass?: string;
  searchFilterToken?: number;
}

export const AssignmentTableView: React.FC<AssignmentTableViewProps> = ({
  teachers,
  classes,
  subjects,
  departments,
  duties,
  curriculums,
  assignments,
  calculations,
  currentVersion,
  schoolYearId,
  semesterId,
  versionId,
  isFullscreen = false,
  onToggleFullscreen,
  initialSearchTerm,
  initialSelectedClass,
  searchFilterToken,
}) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>(initialSelectedClass || 'ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [showTrashBin, setShowTrashBin] = useState(false);

  // Sync navigation filter from global search
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm, searchFilterToken]);

  useEffect(() => {
    if (initialSelectedClass !== undefined) {
      setSelectedClass(initialSelectedClass);
    }
  }, [initialSelectedClass, searchFilterToken]);

  // Dynamic School Branches
  const branches = dataStore.getBranches();

  // View Mode: TABLE (Bảng chi tiết), CARDS (Danh sách thẻ), GROUPED_TEACHER (Gom nhóm theo Giáo viên)
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARDS' | 'GROUPED_TEACHER'>(() => {
    return (localStorage.getItem('assignment_view_mode') as 'TABLE' | 'CARDS' | 'GROUPED_TEACHER') || 'TABLE';
  });

  const handleViewModeChange = (mode: 'TABLE' | 'CARDS' | 'GROUPED_TEACHER') => {
    setViewMode(mode);
    localStorage.setItem('assignment_view_mode', mode);
  };

  // Safe Deletion Modal States
  const [assignmentToDelete, setAssignmentToDelete] = useState<TeachingAssignment | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'SOFT' | 'PERMANENT'>('SOFT');

  // Bulk Selection & Deletion States
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'SOFT' | 'PERMANENT'>('SOFT');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // State to track collapsed teachers in tables (clicking teacher name collapses/expands their rows)
  const [collapsedTeacherIds, setCollapsedTeacherIds] = useState<Set<string>>(new Set());

  const toggleTeacherCollapse = (teacherId: string) => {
    setCollapsedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  const collapseAllTeachers = () => {
    const allIds = new Set(groupedByTeacher.map((g) => g.teacher.id));
    setCollapsedTeacherIds(allIds);
  };

  const expandAllTeachers = () => {
    setCollapsedTeacherIds(new Set());
  };

  // User & Permission states
  const currentUser = dataStore.getCurrentUser();
  const isLocked = currentVersion?.status === 'locked';
  const isTenantSchool = dataStore.getSchoolId() !== 'school_quyhop' || Boolean(dataStore.detectUrlSchoolId() && dataStore.detectUrlSchoolId() !== 'school_quyhop');
  const canEdit = !isLocked && (currentUser.permission === 'edit' || currentUser.role === 'admin' || currentUser.role === 'principal' || isTenantSchool);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TeachingAssignment | null>(null);
  const [isSmartAssignmentOpen, setIsSmartAssignmentOpen] = useState(false);
  const [isTeachingPlanModalOpen, setIsTeachingPlanModalOpen] = useState(false);

  // Form Fields for Add/Edit Modal
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [teacherModalSearch, setTeacherModalSearch] = useState<string>('');
  const [formType, setFormType] = useState<'TEACHING' | 'CONCURRENT' | 'ACTIVITY' | 'EXEMPTION'>('TEACHING');
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formDutyId, setFormDutyId] = useState<string>('');
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [formSession, setFormSession] = useState<'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'TWO_SESSIONS_PER_DAY' | 'ACTIVITY'>('MORNING');
  const [formPeriodsPerWeek, setFormPeriodsPerWeek] = useState<number>(3);
  const [formWeeks, setFormWeeks] = useState<number>(18);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formIsInterSchool, setFormIsInterSchool] = useState<boolean>(false);
  const [formInterSchoolName, setFormInterSchoolName] = useState<string>('');
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Fast Lookup Maps
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const dutyMap = useMemo(() => new Map(duties.map((d) => [d.id, d])), [duties]);
  const calcMap = useMemo(() => new Map(calculations.map((c) => [c.teacherId, c])), [calculations]);

  // Filtered List
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (showTrashBin) {
        if (!a.isDeleted) return false;
      } else {
        if (a.isDeleted) return false;
      }

      if (a.versionId !== versionId) return false;

      const teacher = teacherMap.get(a.teacherId);
      if (!teacher || teacher.isDeleted) return false;

      const subject = a.subjectId ? subjectMap.get(a.subjectId) : null;
      const cls = a.classId ? classMap.get(a.classId) : null;
      const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;

      // Search filter (tìm kiếm chính xác theo giáo viên, môn học, lớp, nhiệm vụ)
      if (searchTerm.trim()) {
        const matches = matchesQuery(
          searchTerm,
          teacher?.fullName,
          teacher?.code,
          subject?.name,
          subject?.shortName,
          subject?.code,
          cls?.name,
          duty?.name
        );
        if (!matches) return false;
      }

      // Branch filter (Điểm trường)
      if (selectedBranch !== 'ALL') {
        const branchObj = branches.find((b) => b.id === selectedBranch);
        if (branchObj) {
          if (branchObj.isMain) {
            const matchesClass = cls ? (!cls.branchId || cls.branchId === branchObj.id || cls.branchId === 'branch_main') : true;
            const matchesTeacher = teacher
              ? (!teacher.workplaceId || teacher.workplaceId === branchObj.id || teacher.workplaceId === 'wp_all' || teacher.workplace === branchObj.name || teacher.workplace === 'Toàn trường' || teacher.workplace === 'Điểm chính')
              : true;
            if (!matchesClass && !matchesTeacher) return false;
          } else {
            const matchesClass = cls?.branchId === branchObj.id || cls?.branchId === 'branch_sub';
            const matchesTeacher = teacher?.workplaceId === branchObj.id || teacher?.workplace === branchObj.name;
            if (!matchesClass && !matchesTeacher) return false;
          }
        }
      }

      // Status filter (Bản nháp vs Bản duyệt)
      if (selectedStatusFilter !== 'ALL') {
        if (a.status !== selectedStatusFilter) return false;
      }

      // Department filter
      if (selectedDept !== 'ALL' && a.departmentId !== selectedDept && teacher?.departmentId !== selectedDept) {
        return false;
      }

      // Grade filter
      if (selectedGrade !== 'ALL') {
        const targetGrade = parseInt(selectedGrade, 10);
        if (cls && cls.grade !== targetGrade) return false;
      }

      // Class filter
      if (selectedClass !== 'ALL' && a.classId !== selectedClass) {
        return false;
      }

      // Session filter
      if (selectedSession !== 'ALL' && a.session !== selectedSession) {
        return false;
      }

      // Type filter
      if (selectedType !== 'ALL' && a.type !== selectedType) {
        return false;
      }

      return true;
    });
  }, [
    assignments,
    showTrashBin,
    versionId,
    searchTerm,
    selectedBranch,
    selectedStatusFilter,
    selectedDept,
    selectedGrade,
    selectedClass,
    selectedSession,
    selectedType,
    branches,
    teacherMap,
    subjectMap,
    classMap,
    dutyMap,
  ]);

  // Grouped assignments by Teacher (for GROUPED_TEACHER view mode)
  const groupedByTeacher = useMemo(() => {
    const map = new Map<string, TeachingAssignment[]>();
    for (const a of filteredAssignments) {
      if (!map.has(a.teacherId)) {
        map.set(a.teacherId, []);
      }
      map.get(a.teacherId)!.push(a);
    }
    const list: { teacher: Teacher; assignments: TeachingAssignment[]; calc?: TeacherCalculationResult }[] = [];
    map.forEach((items, tId) => {
      const t = teacherMap.get(tId);
      if (t && !t.isDeleted) {
        list.push({
          teacher: t,
          assignments: items,
          calc: calcMap.get(tId),
        });
      }
    });
    list.sort((a, b) => {
      const deptA = a.teacher.departmentId || '';
      const deptB = b.teacher.departmentId || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.teacher.fullName.localeCompare(b.teacher.fullName, 'vi');
    });
    return list;
  }, [filteredAssignments, teacherMap, calcMap]);

  // Target subject & class for smart suggestions in modal
  const modalTargetSubject = useMemo(() => {
    return formSubjectId ? subjectMap.get(formSubjectId) : null;
  }, [formSubjectId, subjectMap]);

  const modalTargetClass = useMemo(() => {
    return formClassIds.length > 0 ? classMap.get(formClassIds[0]) : null;
  }, [formClassIds, classMap]);

  // Real-time Smart Teacher Suggestions (Prioritizing under-quota teachers)
  const modalSmartTeacherSuggestions = useMemo(() => {
    return getSmartTeacherSuggestions({
      subject: modalTargetSubject,
      targetClass: modalTargetClass,
      teachers,
      departments,
      assignments,
      calculationsMap: calcMap,
      maxResults: 6,
    });
  }, [modalTargetSubject, modalTargetClass, teachers, departments, assignments, calcMap]);

  // Teachers filtered for Add/Edit Modal (with search & smart priority)
  const modalFilteredTeachers = useMemo(() => {
    const active = teachers.filter((t) => !t.isDeleted);
    let list = active;
    if (teacherModalSearch.trim()) {
      list = active.filter((t) =>
        matchesQuery(
          teacherModalSearch,
          t.fullName,
          t.code,
          t.major,
          ...(t.subjectsCanTeach || [])
        )
      );
    }

    // Sort by smart recommendation score (under quota & matching department/subject first)
    const suggestions = getSmartTeacherSuggestions({
      subject: modalTargetSubject,
      targetClass: modalTargetClass,
      teachers: list,
      departments,
      assignments,
      calculationsMap: calcMap,
      maxResults: list.length,
    });

    const scoreMap = new Map<string, number>();
    suggestions.forEach((s) => scoreMap.set(s.teacher.id, s.score));

    return [...list].sort((a, b) => {
      const scoreA = scoreMap.get(a.id) ?? 0;
      const scoreB = scoreMap.get(b.id) ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [teachers, teacherModalSearch, modalTargetSubject, modalTargetClass, departments, assignments, calcMap]);

  // Open Modal for New Assignment
  const handleOpenAddModal = () => {
    if (isLocked) return;
    setEditingAssignment(null);
    setTeacherModalSearch('');
    setFormType('TEACHING');
    const defaultSubject = subjects[0];
    setFormSubjectId(defaultSubject?.id || '');

    // Auto-suggest best teacher (prioritizing under-quota)
    const topSugg = getSmartTeacherSuggestions({
      subject: defaultSubject,
      teachers,
      departments,
      assignments,
      calculationsMap: calcMap,
      maxResults: 1,
    });
    if (topSugg.length > 0) {
      setFormTeacherId(topSugg[0].teacher.id);
    } else {
      const defaultTeacher = teachers.find((t) => !t.isDeleted && t.status === 'ACTIVE') || teachers[0];
      setFormTeacherId(defaultTeacher?.id || '');
    }

    setFormDutyId('');
    setFormClassIds([]);
    setFormSession('MORNING');
    setFormPeriodsPerWeek(3);
    setFormWeeks(semesterId === 'HK1' ? 18 : 17);
    setFormNotes('');
    setFormIsInterSchool(false);
    setFormInterSchoolName('');
    setValidationWarning(null);
    setIsModalOpen(true);
  };

  // Open Modal for Editing Assignment
  const handleOpenEditModal = (assignment: TeachingAssignment) => {
    if (isLocked) return;
    setEditingAssignment(assignment);
    setTeacherModalSearch('');
    setFormTeacherId(assignment.teacherId);
    setFormType(assignment.type);
    setFormSubjectId(assignment.subjectId || '');
    setFormDutyId(assignment.dutyId || '');
    setFormClassIds(assignment.classId ? [assignment.classId] : []);
    setFormSession(assignment.session);
    setFormPeriodsPerWeek(assignment.periodsPerWeek);
    setFormWeeks(assignment.weeks);
    setFormNotes(assignment.notes || '');
    setFormIsInterSchool(Boolean(assignment.isInterSchool || assignment.interSchoolName));
    setFormInterSchoolName(assignment.interSchoolName || '');
    setValidationWarning(null);
    setIsModalOpen(true);
  };

  // Open Modal to Duplicate Assignment
  const handleOpenDuplicateModal = (assignment: TeachingAssignment) => {
    if (isLocked) return;
    setEditingAssignment(null); // Not editing, creating new assignment
    setTeacherModalSearch('');
    setFormTeacherId(assignment.teacherId);
    setFormType(assignment.type);
    setFormSubjectId(assignment.subjectId || '');
    setFormDutyId(assignment.dutyId || '');
    setFormClassIds(assignment.classId ? [assignment.classId] : []);
    setFormSession(assignment.session);
    setFormPeriodsPerWeek(assignment.periodsPerWeek);
    setFormWeeks(assignment.weeks);
    setFormNotes(assignment.notes ? `${assignment.notes} (Bản sao)` : 'Bản sao');
    setFormIsInterSchool(Boolean(assignment.isInterSchool || assignment.interSchoolName));
    setFormInterSchoolName(assignment.interSchoolName || '');
    setValidationWarning(null);
    setIsModalOpen(true);
    showToast('Đã nhân bản thông số phân công. Vui lòng kiểm tra hoặc chọn thêm lớp để lưu!');
  };

  // Auto-fill period count and suggest teacher when Subject & Grade change
  const handleSubjectChange = (subjectId: string) => {
    setFormSubjectId(subjectId);
    const subj = subjectMap.get(subjectId);

    // Auto-select best matching under-quota teacher if adding new assignment
    if (!editingAssignment && subj) {
      const topSugg = getSmartTeacherSuggestions({
        subject: subj,
        targetClass: formClassIds.length > 0 ? classMap.get(formClassIds[0]) : null,
        teachers,
        departments,
        assignments,
        calculationsMap: calcMap,
        maxResults: 1,
      });
      if (topSugg.length > 0) {
        setFormTeacherId(topSugg[0].teacher.id);
      }
    }

    if (formClassIds.length > 0) {
      const cls = classMap.get(formClassIds[0]);
      if (cls) {
        const curr = curriculums.find(
          (c) => c.grade === cls.grade && (c.subjectId === subjectId || c.subjectId === subjectMap.get(subjectId)?.code)
        );
        if (curr) {
          setFormPeriodsPerWeek(curr.periodsPerWeek);
        }
      }
    }
  };

  // Toggle class selection for multi-class assignment
  const handleToggleClass = (classId: string) => {
    let newClassIds: string[];
    if (editingAssignment) {
      // In edit mode, allow single class only
      newClassIds = [classId];
    } else {
      if (formClassIds.includes(classId)) {
        newClassIds = formClassIds.filter((id) => id !== classId);
      } else {
        newClassIds = [...formClassIds, classId];
      }
    }
    setFormClassIds(newClassIds);

    // Auto set session based on first selected class
    if (newClassIds.length > 0) {
      const cls = classMap.get(newClassIds[0]);
      if (cls) {
        setFormSession(cls.session);
        // Auto-match curriculum periods
        const curr = curriculums.find(
          (c) => c.grade === cls.grade && (c.subjectId === formSubjectId || c.subjectId === subjectMap.get(formSubjectId)?.code)
        );
        if (curr) {
          setFormPeriodsPerWeek(curr.periodsPerWeek);
        }
      }
    }

    // Pre-check conflict
    if (newClassIds.length > 0 && formType === 'TEACHING' && formSubjectId && formTeacherId) {
      const validation = validateProposedAssignment({
        schoolYearId,
        semesterId,
        versionId,
        teacherId: formTeacherId,
        subjectId: formSubjectId,
        classId: newClassIds[0],
        periodsPerWeek: formPeriodsPerWeek,
        existingAssignments: assignments,
        teachers,
        subjects,
        classes,
        curriculums,
      });

      if (!validation.isValid) {
        setValidationWarning(validation.error || 'Phát hiện xung đột phân công');
      } else {
        setValidationWarning(null);
      }
    }
  };

  // Submit Handler
  const handleSave = (e: React.FormEvent, continueAdding = false) => {
    e.preventDefault();
    if (isLocked) return;

    const teacher = teacherMap.get(formTeacherId);
    if (!teacher) return;
    const subject = subjectMap.get(formSubjectId);

    if (formType === 'TEACHING') {
      if (!formIsInterSchool && formClassIds.length === 0) {
        alert('Vui lòng chọn ít nhất một lớp học để phân công (hoặc bật tùy chọn Dạy liên trường).');
        return;
      }
      if (formIsInterSchool && !formInterSchoolName.trim()) {
        alert('Vui lòng nhập tên trường liên trường.');
        return;
      }

      if (editingAssignment) {
        // Update single assignment
        dataStore.updateAssignment(editingAssignment.id, {
          teacherId: formTeacherId,
          departmentId: teacher.departmentId,
          type: 'TEACHING',
          subjectId: formSubjectId,
          classId: formClassIds[0] || undefined,
          isInterSchool: formIsInterSchool,
          interSchoolName: formInterSchoolName.trim() || undefined,
          session: formSession,
          periodsPerWeek: formPeriodsPerWeek,
          weeks: formWeeks,
          totalPeriods: formPeriodsPerWeek * formWeeks,
          notes: formNotes,
        });
        const cls = formClassIds[0] ? classMap.get(formClassIds[0]) : null;
        toastService.notifyAssignmentUpdate(
          teacher.fullName,
          formIsInterSchool ? (formInterSchoolName || 'Liên trường') : (cls?.name || 'Lớp'),
          subject?.name || 'Môn học',
          `${formPeriodsPerWeek} tiết/tuần • ${formIsInterSchool ? 'Dạy liên trường' : formSession === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều'}`
        );
      } else if (formIsInterSchool && formClassIds.length === 0) {
        // Direct inter-school assignment without local class
        dataStore.addAssignments([
          {
            schoolYearId,
            semesterId,
            versionId,
            teacherId: formTeacherId,
            departmentId: teacher.departmentId,
            type: 'TEACHING' as const,
            subjectId: formSubjectId,
            isInterSchool: true,
            interSchoolName: formInterSchoolName.trim(),
            session: formSession,
            periodsPerWeek: formPeriodsPerWeek,
            weeks: formWeeks,
            totalPeriods: formPeriodsPerWeek * formWeeks,
            status: 'approved',
            notes: formNotes ? `${formNotes} (Dạy liên trường: ${formInterSchoolName})` : `Dạy liên trường: ${formInterSchoolName}`,
          },
        ]);
        toastService.notifyAssignmentAdd(
          teacher.fullName,
          formInterSchoolName,
          subject?.name || 'Môn học',
          formPeriodsPerWeek,
          formSession
        );
      } else {
        // Multi-class split (creates independent records for each selected class)
        const recordsToCreate = formClassIds.map((cId) => {
          const cls = classMap.get(cId);
          return {
            schoolYearId,
            semesterId,
            versionId,
            teacherId: formTeacherId,
            departmentId: teacher.departmentId,
            type: 'TEACHING' as const,
            subjectId: formSubjectId,
            classId: cId,
            isInterSchool: formIsInterSchool,
            interSchoolName: formIsInterSchool ? formInterSchoolName.trim() : undefined,
            session: cls?.session || formSession,
            periodsPerWeek: formPeriodsPerWeek,
            weeks: formWeeks,
            totalPeriods: formPeriodsPerWeek * formWeeks,
            notes: formNotes,
          };
        });
        dataStore.addAssignments(recordsToCreate);
        const classNames = formClassIds.map((cId) => classMap.get(cId)?.name || cId).join(', ');
        toastService.notifyAssignmentAdd(
          teacher.fullName,
          classNames,
          subject?.name || 'Môn học',
          formPeriodsPerWeek,
          formSession
        );
      }
    } else if (formType === 'CONCURRENT') {
      const duty = dutyMap.get(formDutyId);
      const periods = duty?.periodsPerWeekCalculated || formPeriodsPerWeek;
      if (editingAssignment) {
        dataStore.updateAssignment(editingAssignment.id, {
          teacherId: formTeacherId,
          departmentId: teacher.departmentId,
          type: 'CONCURRENT',
          dutyId: formDutyId,
          dutyName: duty?.name,
          classId: formClassIds[0] || undefined,
          session: 'ACTIVITY',
          periodsPerWeek: periods,
          weeks: formWeeks,
          totalPeriods: periods * formWeeks,
          notes: formNotes,
        });
        toastService.notifyDutyChange(teacher.fullName, duty?.name || 'Nhiệm vụ', 'update', periods);
      } else {
        dataStore.addAssignments([
          {
            schoolYearId,
            semesterId,
            versionId,
            teacherId: formTeacherId,
            departmentId: teacher.departmentId,
            type: 'CONCURRENT',
            dutyId: formDutyId,
            dutyName: duty?.name,
            classId: formClassIds[0] || undefined,
            session: 'ACTIVITY',
            periodsPerWeek: periods,
            weeks: formWeeks,
            totalPeriods: periods * formWeeks,
            status: 'approved',
            notes: formNotes,
          },
        ]);
        toastService.notifyDutyChange(teacher.fullName, duty?.name || 'Nhiệm vụ', 'add', periods);
      }
    } else if (formType === 'ACTIVITY') {
      if (editingAssignment) {
        dataStore.updateAssignment(editingAssignment.id, {
          teacherId: formTeacherId,
          departmentId: teacher.departmentId,
          type: 'ACTIVITY',
          subjectId: formSubjectId,
          classId: formClassIds[0] || undefined,
          session: 'ACTIVITY',
          periodsPerWeek: formPeriodsPerWeek,
          weeks: formWeeks,
          totalPeriods: formPeriodsPerWeek * formWeeks,
          notes: formNotes,
        });
        const cls = classMap.get(formClassIds[0]);
        toastService.notifyAssignmentUpdate(
          teacher.fullName,
          cls?.name || 'Toàn trường',
          subject?.name || 'HĐTN',
          `${formPeriodsPerWeek} tiết/tuần`
        );
      } else {
        dataStore.addAssignments([
          {
            schoolYearId,
            semesterId,
            versionId,
            teacherId: formTeacherId,
            departmentId: teacher.departmentId,
            type: 'ACTIVITY',
            subjectId: formSubjectId,
            classId: formClassIds[0] || undefined,
            session: 'ACTIVITY',
            periodsPerWeek: formPeriodsPerWeek,
            weeks: formWeeks,
            totalPeriods: formPeriodsPerWeek * formWeeks,
            status: 'approved',
            notes: formNotes,
          },
        ]);
        const cls = classMap.get(formClassIds[0]);
        toastService.notifyAssignmentAdd(
          teacher.fullName,
          cls?.name || 'Toàn trường',
          subject?.name || 'HĐTN',
          formPeriodsPerWeek,
          'ACTIVITY'
        );
      }
    }

    const saveTime = `${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}`;
    if (continueAdding) {
      showToast(`Đã lưu phân công lúc ${saveTime}! Tiếp tục nhập tiếp theo...`);
      setFormClassIds([]);
      setFormNotes('');
      setValidationWarning(null);
    } else {
      showToast(`Đã lưu phân công chuyên môn lúc ${saveTime}!`);
      setIsModalOpen(false);
    }
  };

  // Open Single Delete Modal
  const handleRequestDelete = (assignment: TeachingAssignment, defaultPermanent = false) => {
    if (isLocked) {
      showToast('⚠️ Bản phân công đã bị khóa, không thể xóa.');
      return;
    }
    setAssignmentToDelete(assignment);
    setDeleteMode(defaultPermanent || assignment.isDeleted ? 'PERMANENT' : 'SOFT');
    setIsDeleteModalOpen(true);
  };

  // Confirm Single Delete
  const handleConfirmDelete = () => {
    if (!assignmentToDelete) return;
    const isPermanent = deleteMode === 'PERMANENT';
    const teacher = teacherMap.get(assignmentToDelete.teacherId);
    const subject = assignmentToDelete.subjectId ? subjectMap.get(assignmentToDelete.subjectId) : null;
    const duty = assignmentToDelete.dutyId ? dutyMap.get(assignmentToDelete.dutyId) : null;
    const name = duty?.name || subject?.name || 'Phân công';

    dataStore.deleteAssignment(
      assignmentToDelete.id,
      isPermanent,
      isPermanent ? 'Xóa vĩnh viễn' : 'Xóa mềm vào thùng rác'
    );

    setSelectedAssignmentIds((prev) => prev.filter((id) => id !== assignmentToDelete.id));
    setIsDeleteModalOpen(false);
    setAssignmentToDelete(null);

    if (assignmentToDelete.type === 'CONCURRENT') {
      toastService.notifyDutyChange(
        teacher?.fullName || 'Giáo viên',
        name,
        'delete',
        assignmentToDelete.periodsPerWeek
      );
    } else {
      const cls = assignmentToDelete.classId ? classMap.get(assignmentToDelete.classId) : null;
      toastService.notifyAssignmentDelete(
        teacher?.fullName || 'Giáo viên',
        cls?.name || 'Lớp',
        name,
        assignmentToDelete.periodsPerWeek,
        isPermanent
      );
    }

    showToast(
      isPermanent
        ? `🗑️ Đã xóa vĩnh viễn phân công "${name}" của giáo viên ${teacher?.fullName || ''}.`
        : `📦 Đã chuyển phân công "${name}" của giáo viên ${teacher?.fullName || ''} vào thùng rác.`
    );
  };

  // Confirm Bulk Delete
  const handleConfirmBulkDelete = () => {
    if (selectedAssignmentIds.length === 0) return;
    const isPermanent = bulkDeleteMode === 'PERMANENT';
    const count = dataStore.bulkDeleteAssignments(selectedAssignmentIds, isPermanent);
    setSelectedAssignmentIds([]);
    setIsBulkDeleteModalOpen(false);

    toastService.notifyBulk(
      isPermanent ? 'Xóa vĩnh viễn phân công hàng loạt' : 'Chuyển phân công vào thùng rác',
      `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'chuyển vào thùng rác'} ${count} dòng phân công thành công`
    );

    showToast(
      isPermanent
        ? `🗑️ Đã xóa vĩnh viễn ${count} dòng phân công thành công.`
        : `📦 Đã chuyển ${count} dòng phân công vào thùng rác.`
    );
  };

  // Restore Action
  const handleRestore = (id: string) => {
    dataStore.restoreAssignment(id);
    const ass = dataStore.getAssignments(undefined, undefined, undefined, true).find((a) => a.id === id);
    if (ass) {
      const t = teacherMap.get(ass.teacherId);
      const s = ass.subjectId ? subjectMap.get(ass.subjectId) : null;
      const c = ass.classId ? classMap.get(ass.classId) : null;
      toastService.notify({
        category: 'assignment_update',
        type: 'success',
        title: 'Khôi phục phân công',
        teacherName: t?.fullName,
        message: `${t?.fullName || 'Giáo viên'}: khôi phục phân công môn ${s?.name || ''} lớp ${c?.name || ''} từ thùng rác`,
      });
    }
    showToast('✅ Đã khôi phục dòng phân công từ thùng rác.');
  };

  // Bulk Restore Action
  const handleBulkRestore = () => {
    if (selectedAssignmentIds.length === 0) return;
    let count = 0;
    for (const id of selectedAssignmentIds) {
      if (dataStore.restoreAssignment(id)) count++;
    }
    setSelectedAssignmentIds([]);
    showToast(`✅ Đã khôi phục ${count} dòng phân công từ thùng rác.`);
  };

  // Workflow: Approve / Unapprove entire Version
  const handleApproveVersion = () => {
    if (!canEdit || isLocked) return;
    dataStore.approveVersion(versionId, currentUser.name);
    showToast('✅ Đã phê duyệt phương án thành công! Toàn bộ phân công đã chuyển thành BẢN DUYỆT chính thức.');
  };

  const handleUnapproveVersion = () => {
    if (!canEdit || isLocked) return;
    dataStore.unapproveVersion(versionId);
    showToast('Đã chuyển phương án về BẢN NHÁP để tiếp tục hiệu chỉnh.');
  };

  // Toggle single assignment status (Bản nháp <-> Bản duyệt)
  const handleToggleAssignmentStatus = (assignmentId: string, currentStatus?: string) => {
    if (!canEdit || isLocked) return;
    const nextStatus = currentStatus === 'approved' ? 'draft' : 'approved';
    dataStore.bulkSetAssignmentStatus([assignmentId], nextStatus);
    showToast(`Đã chuyển dòng phân công sang [${nextStatus === 'approved' ? 'BẢN DUYỆT' : 'BẢN NHÁP'}]!`);
  };

  // Bulk status update for selected rows
  const handleBulkSetStatus = (status: 'approved' | 'draft') => {
    if (!canEdit || isLocked || selectedAssignmentIds.length === 0) return;
    const count = dataStore.bulkSetAssignmentStatus(selectedAssignmentIds, status);
    setSelectedAssignmentIds([]);
    showToast(`✅ Đã chuyển ${count} dòng phân công sang [${status === 'approved' ? 'BẢN DUYỆT' : 'BẢN NHÁP'}]!`);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* VERSION STATUS & APPROVAL WORKFLOW BANNER */}
      {currentVersion && (
        <div
          className={`rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
            currentVersion.status === 'approved'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : currentVersion.status === 'locked'
              ? 'bg-slate-100 border-slate-300 text-slate-800'
              : 'bg-amber-50/90 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black shadow-xs ${
                currentVersion.status === 'approved'
                  ? 'bg-emerald-600 text-white'
                  : currentVersion.status === 'locked'
                  ? 'bg-slate-700 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {currentVersion.status === 'approved' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : currentVersion.status === 'locked' ? (
                <Lock className="w-5 h-5" />
              ) : (
                <FileEdit className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">Phương án: {currentVersion.name}</span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    currentVersion.status === 'approved'
                      ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                      : currentVersion.status === 'locked'
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-amber-200 text-amber-900 border border-amber-300'
                  }`}
                >
                  {currentVersion.status === 'approved'
                    ? '✓ BẢN DUYỆT CHÍNH THỨC'
                    : currentVersion.status === 'locked'
                    ? '🔒 ĐÃ KHÓA'
                    : '📝 BẢN NHÁP (ĐANG BIÊN TẬP)'}
                </span>
                {currentVersion.approvedAt && currentVersion.status === 'approved' && (
                  <span className="text-[11px] text-emerald-800 font-medium">
                    (Duyệt lúc {new Date(currentVersion.approvedAt).toLocaleDateString('vi-VN')} bởi {currentVersion.approvedBy || 'Ban Giám hiệu'})
                  </span>
                )}
              </div>
              <p className="text-xs opacity-85 mt-0.5">
                {currentVersion.status === 'approved'
                  ? 'Toàn bộ dòng phân công trong phương án này đã là Bản duyệt chính thức để đưa vào áp dụng và in ấn.'
                  : currentVersion.status === 'locked'
                  ? 'Phương án đang bị khóa bảo vệ để lưu trữ dữ liệu lịch sử.'
                  : 'Phương án đang là Bản nháp. Sau khi hoàn thiện rà soát chuyên môn, hãy bấm "Chuyển thành Bản duyệt" bên phải.'}
              </p>
            </div>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && !isLocked && (
              <>
                {currentVersion.status === 'draft' ? (
                  <button
                    id="btn-approve-version-main"
                    onClick={handleApproveVersion}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    title="Chuyển toàn bộ phân công trong phiên bản này thành Bản duyệt chính thức"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Chuyển thành Bản duyệt</span>
                  </button>
                ) : currentVersion.status === 'approved' ? (
                  <button
                    id="btn-unapprove-version-main"
                    onClick={handleUnapproveVersion}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Chuyển về Bản nháp để hiệu chỉnh thêm khi cần"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-amber-600" />
                    <span>Chuyển về Bản nháp</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {/* ACTION & FILTER HEADER */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <TableProperties className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Bảng phân công chuyên môn chi tiết
                </h2>
                {isLocked ? (
                  <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-red-200">
                    <Lock className="w-3 h-3" /> Bản đã khóa
                  </span>
                ) : (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                    canEdit ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                  }`}>
                    {canEdit ? <Edit3 className="w-3 h-3 text-emerald-700" /> : <Eye className="w-3 h-3 text-sky-700" />}
                    {canEdit ? 'Quyền Chỉnh sửa' : 'Chỉ Xem'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hiển thị {filteredAssignments.length} / {assignments.filter((a) => !a.isDeleted).length} dòng phân công (Phiên bản: {currentVersion?.name})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                id="view-mode-table-btn"
                type="button"
                onClick={() => handleViewModeChange('TABLE')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  viewMode === 'TABLE'
                    ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Dạng Bảng chi tiết"
              >
                <TableProperties className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bảng</span>
              </button>
              <button
                id="view-mode-cards-btn"
                type="button"
                onClick={() => handleViewModeChange('CARDS')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Dạng Danh sách thẻ"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thẻ</span>
              </button>
              <button
                id="view-mode-grouped-btn"
                type="button"
                onClick={() => handleViewModeChange('GROUPED_TEACHER')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition ${
                  viewMode === 'GROUPED_TEACHER'
                    ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Gom nhóm theo Giáo viên"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Theo GV</span>
              </button>
            </div>

            {/* Quick Toggle Expand/Collapse All Teachers */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={
                  collapsedTeacherIds.size === groupedByTeacher.length && groupedByTeacher.length > 0
                    ? expandAllTeachers
                    : collapseAllTeachers
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-slate-700 hover:text-blue-900 hover:bg-white transition cursor-pointer"
                title={
                  collapsedTeacherIds.size === groupedByTeacher.length && groupedByTeacher.length > 0
                    ? 'Sổ ra tất cả hàng của các giáo viên'
                    : 'Thu ẩn tất cả hàng của các giáo viên'
                }
              >
                {collapsedTeacherIds.size === groupedByTeacher.length && groupedByTeacher.length > 0 ? (
                  <>
                    <ChevronsUpDown className="w-3.5 h-3.5 text-blue-700" />
                    <span className="hidden md:inline">Sổ ra tất cả GV</span>
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden md:inline">Thu ẩn tất cả GV</span>
                  </>
                )}
                {collapsedTeacherIds.size > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">
                    Thu {collapsedTeacherIds.size}/{groupedByTeacher.length} GV
                  </span>
                )}
              </button>
            </div>

            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  isFullscreen
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
                title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to Full view'}
              >
                {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5 text-blue-600" />}
                <span className="hidden md:inline">{isFullscreen ? 'Thu nhỏ' : 'Full view'}</span>
              </button>
            )}

            <button
              id="toggle-trash-btn"
              onClick={() => setShowTrashBin(!showTrashBin)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                showTrashBin
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>{showTrashBin ? 'Về danh sách chính' : 'Thùng rác'}</span>
            </button>

            {canEdit && !showTrashBin && (
              <>
                <button
                  id="btn-open-smart-assignment"
                  onClick={() => setIsSmartAssignmentOpen(true)}
                  className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer border border-purple-400/40"
                  title="Mở module Phân công giảng dạy thông minh (Ma trận tích chọn, định mức trực tiếp & AI cố vấn)"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span className="hidden sm:inline">Phân công thông minh</span>
                  <span className="sm:hidden">Thông minh</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-amber-400 text-slate-900 rounded font-black tracking-wider uppercase">MỚI</span>
                </button>

                <button
                  id="btn-add-assignment"
                  onClick={handleOpenAddModal}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Thêm phân công
                </button>
              </>
            )}
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              id="assignment-search-input"
              type="text"
              placeholder="Tìm theo giáo viên, môn, lớp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-7 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
                title="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </div>

          {/* Branch Filter (Điểm trường) */}
          <div>
            <select
              id="assignment-filter-branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              title="Lọc theo Điểm trường"
            >
              <option value="ALL">🏢 Toàn trường</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.isMain ? '★ ' : '📍 '}{b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (Bản nháp / Bản duyệt) */}
          <div>
            <select
              id="assignment-filter-status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              title="Lọc theo Bản nháp hoặc Bản duyệt"
            >
              <option value="ALL">📋 Tất cả trạng thái</option>
              <option value="draft">📝 Chỉ Bản nháp</option>
              <option value="approved">✓ Chỉ Bản duyệt</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Tất cả tổ CM</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Tất cả Khối</option>
              <option value="6">Khối 6</option>
              <option value="7">Khối 7</option>
              <option value="8">Khối 8</option>
              <option value="9">Khối 9</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Tất cả lớp</option>
              {classes.filter((c) => !c.isDeleted).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Tất cả loại</option>
              <option value="TEACHING">Giảng dạy</option>
              <option value="CONCURRENT">Kiêm nhiệm</option>
              <option value="ACTIVITY">Hoạt động / Khác</option>
            </select>
          </div>
        </div>
      </div>

      {/* BULK ACTION BAR */}
      {selectedAssignmentIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-900 bg-blue-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-blue-700" />
              Đã chọn {selectedAssignmentIds.length} dòng
            </span>
            <span className="text-xs text-blue-700 hidden sm:inline">
              (trên tổng số {filteredAssignments.length} dòng phân công)
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showTrashBin ? (
              <>
                <button
                  type="button"
                  onClick={handleBulkRestore}
                  className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Khôi phục đã chọn ({selectedAssignmentIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkDeleteMode('PERMANENT');
                    setIsBulkDeleteModalOpen(true);
                  }}
                  className="text-xs font-bold text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa vĩnh viễn ({selectedAssignmentIds.length})
                </button>
              </>
            ) : (
              <>
                {canEdit && (
                  <>
                    <button
                      id="bulk-btn-approve-selected"
                      type="button"
                      onClick={() => handleBulkSetStatus('approved')}
                      className="text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      title="Chuyển các dòng đã chọn thành Bản duyệt"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Duyệt đã chọn ({selectedAssignmentIds.length})</span>
                    </button>

                    <button
                      id="bulk-btn-draft-selected"
                      type="button"
                      onClick={() => handleBulkSetStatus('draft')}
                      className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      title="Chuyển các dòng đã chọn về Bản nháp"
                    >
                      <FileEdit className="w-3.5 h-3.5 text-amber-700" />
                      <span>Về bản nháp ({selectedAssignmentIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBulkDeleteMode('SOFT');
                        setIsBulkDeleteModalOpen(true);
                      }}
                      className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 border border-red-300 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa {selectedAssignmentIds.length} dòng
                    </button>
                  </>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedAssignmentIds([])}
              className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-white transition cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* ASSIGNMENTS DISPLAY: TABLE, CARDS, OR GROUPED BY TEACHER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* VIEW MODE 1: COMPREHENSIVE TABLE VIEW */}
        {viewMode === 'TABLE' && (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3.5 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredAssignments.length > 0 && selectedAssignmentIds.length === filteredAssignments.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAssignmentIds(filteredAssignments.map((a) => a.id));
                          } else {
                            setSelectedAssignmentIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-300"
                        title="Chọn tất cả"
                      />
                    </th>
                    <th className="py-3.5 px-2 text-center w-12">STT</th>
                    <th className="py-3.5 px-4">Giáo viên</th>
                    <th className="py-3.5 px-3 text-center">Nơi làm việc</th>
                    <th className="py-3.5 px-3">Tổ chuyên môn</th>
                    <th className="py-3.5 px-3 text-center">Loại</th>
                    <th className="py-3.5 px-4">Môn học / Nhiệm vụ</th>
                    <th className="py-3.5 px-3 text-center">Lớp</th>
                    <th className="py-3.5 px-3 text-center">Buổi</th>
                    <th className="py-3.5 px-3 text-center">Tiết/Tuần</th>
                    <th className="py-3.5 px-3 text-center">Tuần</th>
                    <th className="py-3.5 px-3 text-center">Tổng tiết</th>
                    <th className="py-3.5 px-3 text-center">Trạng thái</th>
                    <th className="py-3.5 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-400">
                        Không tìm thấy phân công nào phù hợp với bộ lọc
                      </td>
                    </tr>
                  ) : (
                    groupedByTeacher.map(({ teacher, assignments: tAssignments, calc }, teacherIdx) => {
                      const isCollapsed = collapsedTeacherIds.has(teacher.id);
                      const dept = deptMap.get(teacher.departmentId || '');
                      const totalAssigned = tAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
                      const quota = calc?.quota ?? calc?.standardQuota ?? teacher.standardQuota ?? 19;
                      const diff = calc ? calc.difference : (totalAssigned - quota);
                      const isTeacherAllSelected =
                        tAssignments.length > 0 && tAssignments.every((a) => selectedAssignmentIds.includes(a.id));
                      const isTeacherSomeSelected =
                        tAssignments.some((a) => selectedAssignmentIds.includes(a.id)) && !isTeacherAllSelected;

                      return (
                        <React.Fragment key={teacher.id}>
                          {/* Teacher Group Header Row */}
                          <tr
                            className={`transition select-none border-t-2 border-slate-300/80 cursor-pointer ${
                              isCollapsed ? 'bg-slate-100/95 hover:bg-blue-50/70' : 'bg-slate-100/70 hover:bg-slate-100'
                            }`}
                            onClick={() => toggleTeacherCollapse(teacher.id)}
                            title="Bấm vào tên GV hoặc dòng này để thu ẩn / sổ ra các hàng phân công"
                          >
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isTeacherAllSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isTeacherSomeSelected;
                                }}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const idsToAdd = tAssignments.map((a) => a.id);
                                    setSelectedAssignmentIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
                                  } else {
                                    const idsToRemove = new Set(tAssignments.map((a) => a.id));
                                    setSelectedAssignmentIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                title="Chọn tất cả phân công của GV này"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-slate-500 text-xs">
                              {teacherIdx + 1}
                            </td>
                            <td colSpan={12} className="py-2.5 px-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTeacherCollapse(teacher.id);
                                    }}
                                    className="p-1 rounded bg-white border border-slate-300 text-blue-700 hover:bg-blue-50 transition flex items-center justify-center cursor-pointer shadow-2xs"
                                    title={isCollapsed ? 'Sổ ra các hàng phân công' : 'Thu ẩn các hàng phân công'}
                                  >
                                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTeacherCollapse(teacher.id);
                                    }}
                                    className="font-black text-sm text-slate-900 hover:text-blue-700 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                                    title={isCollapsed ? 'Nhấp vào tên GV để sổ ra các hàng' : 'Nhấp vào tên GV để thu ẩn các hàng'}
                                  >
                                    <span>{teacher.fullName}</span>
                                    <span className="text-xs text-slate-500 font-mono font-semibold">({teacher.code})</span>
                                  </button>

                                  <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full">
                                    {dept ? (dept.name || dept.fullName) : 'Tổ CM'}
                                  </span>

                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      teacher.workplace === 'Phân hiệu'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                                        : teacher.workplace === 'Toàn trường'
                                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                        : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                    }`}
                                  >
                                    <Building2 className="w-2.5 h-2.5" />
                                    {teacher.workplace || 'Điểm chính'}
                                  </span>

                                  <span className="text-xs text-slate-600 font-medium">
                                    • <strong className="text-blue-900 font-bold">{tAssignments.length}</strong> hàng phân công
                                  </span>

                                  {isCollapsed && (
                                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 animate-in fade-in duration-100">
                                      Đang thu ẩn ({tAssignments.length} hàng) • Bấm vào tên GV để sổ ra
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2.5 text-xs">
                                  <span className="text-slate-500">
                                    Định mức: <strong className="text-slate-800">{quota}t</strong>
                                  </span>
                                  <span>•</span>
                                  <span className="text-slate-500">
                                    Đã xếp: <strong className="text-blue-900">{calc?.totalCalculated ?? totalAssigned}t</strong>
                                  </span>
                                  {calc && calc.exemptionPeriods > 0 && (
                                    <span className="text-[11px] text-amber-700 font-medium hidden lg:inline">
                                      ({totalAssigned}d+{calc.exemptionPeriods}m)
                                    </span>
                                  )}
                                  <span>•</span>
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                      diff === 0
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : diff > 0
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                                    }`}
                                  >
                                    {diff === 0 ? '✓ ĐỦ ĐỊNH MỨC' : diff > 0 ? `THỪA +${diff}t` : `THIẾU ${diff}t`}
                                  </span>

                                  {canEdit && !showTrashBin && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingAssignment(null);
                                        setFormTeacherId(teacher.id);
                                        setIsModalOpen(true);
                                      }}
                                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                      title="Thêm phân công mới cho giáo viên này"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Thêm</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Detail Rows for this teacher (only if NOT collapsed) */}
                          {!isCollapsed &&
                            tAssignments.map((a, subIndex) => {
                              const deptItem = deptMap.get(a.departmentId || teacher?.departmentId || '');
                              const subject = a.subjectId ? subjectMap.get(a.subjectId) : null;
                              const cls = a.classId ? classMap.get(a.classId) : null;
                              const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;
                              const isSelected = selectedAssignmentIds.includes(a.id);

                              return (
                                <tr
                                  key={a.id}
                                  className={`hover:bg-blue-50/50 transition ${
                                    isSelected ? 'bg-blue-50/70' : a.isDeleted ? 'bg-red-50/40 text-slate-400' : ''
                                  }`}
                                >
                                  <td className="py-3 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAssignmentIds((prev) => [...prev, a.id]);
                                        } else {
                                          setSelectedAssignmentIds((prev) => prev.filter((id) => id !== a.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-center font-medium text-slate-400">
                                    {teacherIdx + 1}.{subIndex + 1}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-900">
                                    <button
                                      type="button"
                                      onClick={() => toggleTeacherCollapse(teacher.id)}
                                      className="group/tname text-left cursor-pointer transition w-full"
                                      title="Bấm vào tên GV để thu ẩn các hàng của giáo viên này"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 group-hover/tname:text-blue-700 group-hover/tname:underline">
                                          {teacher.fullName}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal">({teacher.code})</span>
                                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover/tname:text-blue-600 transition" />
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                                        Định mức: <span className="font-semibold text-slate-700">{quota}t/tuần</span>
                                      </div>
                                    </button>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                        teacher?.workplace === 'Phân hiệu'
                                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                                          : teacher?.workplace === 'Toàn trường'
                                          ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                          : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      }`}
                                    >
                                      <Building2 className="w-3 h-3 flex-shrink-0" />
                                      <span>{teacher?.workplace || 'Điểm chính'}</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-slate-600">{deptItem?.name || 'N/A'}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        a.type === 'TEACHING'
                                          ? 'bg-blue-100 text-blue-800'
                                          : a.type === 'CONCURRENT'
                                          ? 'bg-teal-100 text-teal-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {a.type === 'TEACHING' ? 'Giảng dạy' : a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Hoạt động'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-slate-900">
                                    {a.dutyName || duty?.name || subject?.name || 'N/A'}
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-blue-900">
                                    {cls?.name || a.classId || 'Toàn trường'}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                        a.session === 'MORNING'
                                          ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                          : a.session === 'AFTERNOON'
                                          ? 'bg-orange-50 text-orange-800 border border-orange-200'
                                          : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {a.session === 'MORNING'
                                        ? 'Sáng (B1)'
                                        : a.session === 'AFTERNOON'
                                        ? 'Chiều (B2)'
                                        : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                        ? '2 buổi/ngày'
                                        : 'HĐ'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center font-black text-slate-900">{a.periodsPerWeek}</td>
                                  <td className="py-3 px-3 text-center text-slate-500">{a.weeks}</td>
                                  <td className="py-3 px-3 text-center font-bold text-slate-800">{a.totalPeriods}</td>
                                  <td className="py-3 px-3 text-center">
                                    {canEdit && !isLocked && !a.isDeleted ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAssignmentStatus(a.id, a.status)}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                                          a.status === 'approved'
                                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                        }`}
                                        title={a.status === 'approved' ? 'Nhấp để chuyển về Bản nháp' : 'Nhấp để chuyển thành Bản duyệt'}
                                      >
                                        {a.status === 'approved' ? '✓ Đã duyệt' : '📝 Bản nháp'}
                                      </button>
                                    ) : (
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {a.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {a.isDeleted ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        {canEdit && (
                                          <>
                                            <button
                                              onClick={() => handleRestore(a.id)}
                                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                              title="Khôi phục phân công"
                                            >
                                              <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleRequestDelete(a, true)}
                                              className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 transition cursor-pointer"
                                              title="Xóa vĩnh viễn"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1.5">
                                        {canEdit && (
                                          <>
                                            <button
                                              onClick={() => handleOpenEditModal(a)}
                                              className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                                              title="Sửa phân công"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleOpenDuplicateModal(a)}
                                              className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                                              title="Nhân bản phân công"
                                            >
                                              <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                              onClick={() => handleRequestDelete(a, false)}
                                              className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 transition cursor-pointer"
                                              title="Xóa phân công"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for phones when in table view */}
            <div className="md:hidden divide-y divide-slate-200 p-2 space-y-3">
              {filteredAssignments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không tìm thấy phân công nào phù hợp với bộ lọc
                </div>
              ) : (
                groupedByTeacher.map(({ teacher, assignments: tAssignments, calc }, teacherIdx) => {
                  const isCollapsed = collapsedTeacherIds.has(teacher.id);
                  const dept = deptMap.get(teacher.departmentId || '');
                  const totalAssigned = tAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
                  const quota = calc?.quota ?? calc?.standardQuota ?? teacher.standardQuota ?? 19;
                  const diff = calc ? calc.difference : (totalAssigned - quota);

                  return (
                    <div key={teacher.id} className="pt-2 space-y-2">
                      {/* Teacher Header Bar on Mobile */}
                      <div
                        onClick={() => toggleTeacherCollapse(teacher.id)}
                        className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between gap-2 cursor-pointer transition select-none hover:bg-blue-50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded bg-white text-blue-700 border border-slate-200">
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{teacher.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({teacher.code})</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {dept ? (dept.fullName || dept.name) : 'Tổ CM'} • {tAssignments.length} phân công
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-right">
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              diff === 0 ? 'bg-emerald-100 text-emerald-800' : diff > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {diff === 0 ? 'Đủ' : diff > 0 ? `+${diff}t` : `${diff}t`}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Cards for this teacher */}
                      {!isCollapsed ? (
                        <div className="space-y-2 pl-2">
                          {tAssignments.map((a) => {
                            const subject = a.subjectId ? subjectMap.get(a.subjectId) : null;
                            const cls = a.classId ? classMap.get(a.classId) : null;
                            const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;
                            const isSelected = selectedAssignmentIds.includes(a.id);

                            return (
                              <div
                                key={a.id}
                                className={`p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-2 ${
                                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50/40' : a.isDeleted ? 'bg-red-50/40 opacity-75' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAssignmentIds((prev) => [...prev, a.id]);
                                        } else {
                                          setSelectedAssignmentIds((prev) => prev.filter((id) => id !== a.id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">{dept?.name}</span>
                                      <h4
                                        onClick={() => toggleTeacherCollapse(teacher.id)}
                                        className="text-sm font-bold text-slate-900 cursor-pointer hover:text-blue-700 hover:underline"
                                        title="Chạm vào tên GV để thu ẩn"
                                      >
                                        {teacher?.fullName}
                                      </h4>
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      a.type === 'TEACHING'
                                        ? 'bg-blue-100 text-blue-800'
                                        : a.type === 'CONCURRENT'
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {a.type === 'TEACHING' ? 'Giảng dạy' : a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Hoạt động'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg">
                                  <div>
                                    <span className="text-slate-400 text-[10px]">Môn/Nhiệm vụ:</span>
                                    <div className="font-semibold text-slate-900">{a.dutyName || duty?.name || subject?.name}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px]">Lớp:</span>
                                    <div className="font-bold text-blue-900">{cls?.name || a.classId || 'Toàn trường'}</div>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px]">Buổi:</span>
                                    <div className="font-medium text-slate-800">
                                      {a.session === 'MORNING'
                                        ? 'Sáng (B1)'
                                        : a.session === 'AFTERNOON'
                                        ? 'Chiều (B2)'
                                        : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                        ? '2 buổi/ngày'
                                        : 'HĐ'}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 text-[10px]">Số tiết/tuần:</span>
                                    <div className="font-black text-slate-900">{a.periodsPerWeek} tiết ({a.totalPeriods} cả kỳ)</div>
                                  </div>
                                </div>

                                {canEdit && (
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    {a.isDeleted ? (
                                      <>
                                        <button
                                          onClick={() => handleRestore(a.id)}
                                          className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                                        </button>
                                        <button
                                          onClick={() => handleRequestDelete(a, true)}
                                          className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleOpenEditModal(a)}
                                          className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" /> Sửa
                                        </button>
                                        <button
                                          onClick={() => handleOpenDuplicateModal(a)}
                                          className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                          <Copy className="w-3.5 h-3.5" /> Nhân bản
                                        </button>
                                        <button
                                          onClick={() => handleRequestDelete(a, false)}
                                          className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          onClick={() => toggleTeacherCollapse(teacher.id)}
                          className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-center justify-between cursor-pointer hover:bg-blue-100/50 transition ml-2"
                        >
                          <span className="italic flex items-center gap-1.5">
                            <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                            Đang thu ẩn {tAssignments.length} phân công
                          </span>
                          <span className="font-bold underline">Chạm để mở</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* VIEW MODE 2: RESPONSIVE CARDS LIST VIEW */}
        {viewMode === 'CARDS' && (
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredAssignments.map((a) => {
                const teacher = teacherMap.get(a.teacherId);
                const dept = deptMap.get(a.departmentId || teacher?.departmentId || '');
                const subject = a.subjectId ? subjectMap.get(a.subjectId) : null;
                const cls = a.classId ? classMap.get(a.classId) : null;
                const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;
                const isSelected = selectedAssignmentIds.includes(a.id);
                const title = a.dutyName || duty?.name || subject?.name || 'Phân công';

                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl border p-4 transition shadow-2xs space-y-3 relative ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/40'
                        : a.isDeleted
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Header: Checkbox + Teacher Info + Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssignmentIds((prev) => [...prev, a.id]);
                            } else {
                              setSelectedAssignmentIds((prev) => prev.filter((id) => id !== a.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {teacher?.fullName || 'Chưa xác định'}
                          </h4>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-700">{teacher?.code}</span>
                            <span>•</span>
                            <span>{dept ? (dept.fullName || dept.name) : 'Tổ CM'}</span>
                            <span>•</span>
                            <span className="text-blue-700 font-semibold">
                              Định mức: {calcMap.get(a.teacherId)?.quota ?? teacher?.standardQuota ?? 19}t
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          a.type === 'TEACHING'
                            ? 'bg-blue-100 text-blue-800'
                            : a.type === 'CONCURRENT'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {a.type === 'TEACHING' ? 'Giảng dạy' : a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Hoạt động'}
                      </span>
                    </div>

                    {/* Content Box */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-bold text-blue-950 text-sm">{title}</div>
                        <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                          {cls?.name ? `Lớp ${cls.name}` : a.classId || 'Toàn trường'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center pt-1.5 border-t border-slate-200/60 text-xs">
                        <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Buổi</span>
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {a.session === 'MORNING'
                              ? 'Sáng (B1)'
                              : a.session === 'AFTERNOON'
                              ? 'Chiều (B2)'
                              : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                              ? '2 buổi/ngày'
                              : 'HĐ'}
                          </span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Tiết/tuần</span>
                          <span className="font-black text-slate-900 text-xs">{a.periodsPerWeek}</span>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Tổng tiết</span>
                          <span className="font-bold text-emerald-800 text-xs">{a.totalPeriods}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      {canEdit && !isLocked && !a.isDeleted ? (
                        <button
                          type="button"
                          onClick={() => handleToggleAssignmentStatus(a.id, a.status)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                            a.status === 'approved'
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                          }`}
                          title={a.status === 'approved' ? 'Nhấp để chuyển về Bản nháp' : 'Nhấp để chuyển thành Bản duyệt'}
                        >
                          {a.status === 'approved' ? '✓ Đã duyệt' : '📝 Bản nháp'}
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'}
                        </span>
                      )}

                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          {a.isDeleted ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRestore(a.id)}
                                className="px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDelete(a, true)}
                                className="px-2 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa hẳn
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(a)}
                                className="px-2.5 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDuplicateModal(a)}
                                className="px-2.5 py-1 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" /> Nhân bản
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDelete(a, false)}
                                className="px-2.5 py-1 rounded-lg text-red-700 bg-red-50 hover:bg-red-100 font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW MODE 3: GROUPED BY TEACHER */}
        {viewMode === 'GROUPED_TEACHER' && (
          <div className="p-3 sm:p-5 space-y-4">
            {groupedByTeacher.map(({ teacher, assignments: tAssignments, calc }) => {
              const isCollapsed = collapsedTeacherIds.has(teacher.id);
              const dept = deptMap.get(teacher.departmentId || '');
              const totalAssigned = tAssignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
              const quota = calc?.quota ?? calc?.standardQuota ?? teacher.standardQuota ?? 19;
              const diff = calc ? calc.difference : (totalAssigned - quota);

              return (
                <div
                  key={teacher.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* Teacher Header Bar */}
                  <div
                    onClick={() => toggleTeacherCollapse(teacher.id)}
                    className="bg-slate-50 hover:bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition select-none"
                    title="Bấm vào tên GV hoặc thanh tiêu đề này để thu ẩn / sổ ra các hàng phân công"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTeacherCollapse(teacher.id);
                        }}
                        className="w-9 h-9 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0 cursor-pointer"
                        title={isCollapsed ? 'Sổ ra bảng phân công' : 'Thu ẩn bảng phân công'}
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTeacherCollapse(teacher.id);
                            }}
                            className="text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                            title={isCollapsed ? 'Nhấp vào tên GV để sổ ra' : 'Nhấp vào tên GV để thu ẩn'}
                          >
                            <span>{teacher.fullName}</span>
                          </button>
                          <span className="text-xs text-slate-500 font-medium">({teacher.code})</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                            {dept ? (dept.fullName || dept.name) : 'Tổ CM'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              teacher.workplace === 'Phân hiệu'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : teacher.workplace === 'Toàn trường'
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            <Building2 className="w-2.5 h-2.5" />
                            {teacher.workplace || 'Điểm chính'}
                          </span>
                          {isCollapsed && (
                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              Đang thu ẩn ({tAssignments.length} hàng) • Bấm để sổ ra
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {teacher.dutyTitle || 'Giáo viên'} • {tAssignments.length} phân công
                        </div>
                      </div>
                    </div>

                    {/* Quota Metrics & Add Button */}
                    <div className="flex items-center gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-slate-500">Định mức: <strong className="text-slate-800">{quota} tiết/tuần</strong></span>
                        <span>•</span>
                        <span className="text-slate-500">Đã xếp: <strong className="text-blue-900">{calc?.totalCalculated ?? totalAssigned} tiết</strong></span>
                        {calc && calc.exemptionPeriods > 0 && (
                          <span className="text-[11px] text-amber-700 font-medium">({totalAssigned} dạy + {calc.exemptionPeriods} miễn)</span>
                        )}
                        <span>•</span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            diff === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : diff > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {diff === 0 ? '✓ Chuẩn định mức' : diff > 0 ? `Thừa +${diff} tiết` : `Thiếu ${diff} tiết`}
                        </span>
                      </div>

                      {canEdit && !showTrashBin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAssignment(null);
                            setFormTeacherId(teacher.id);
                            setIsModalOpen(true);
                          }}
                          className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Thêm phân công
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assignments Table for this Teacher (only if NOT collapsed) */}
                  {!isCollapsed ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="py-2.5 px-3 text-center w-10">Chọn</th>
                            <th className="py-2.5 px-3">Loại</th>
                            <th className="py-2.5 px-4">Môn học / Nhiệm vụ</th>
                            <th className="py-2.5 px-3 text-center">Lớp</th>
                            <th className="py-2.5 px-3 text-center">Buổi</th>
                            <th className="py-2.5 px-3 text-center">Tiết/Tuần</th>
                            <th className="py-2.5 px-3 text-center">Tổng tiết</th>
                            <th className="py-2.5 px-3 text-center">Trạng thái</th>
                            <th className="py-2.5 px-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tAssignments.map((a) => {
                            const subject = a.subjectId ? subjectMap.get(a.subjectId) : null;
                            const cls = a.classId ? classMap.get(a.classId) : null;
                            const duty = a.dutyId ? dutyMap.get(a.dutyId) : null;
                            const isSelected = selectedAssignmentIds.includes(a.id);

                            return (
                              <tr
                                key={a.id}
                                className={`hover:bg-blue-50/40 transition ${
                                  isSelected ? 'bg-blue-50/70' : a.isDeleted ? 'bg-red-50/40 text-slate-400' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAssignmentIds((prev) => [...prev, a.id]);
                                      } else {
                                        setSelectedAssignmentIds((prev) => prev.filter((id) => id !== a.id));
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      a.type === 'TEACHING'
                                        ? 'bg-blue-100 text-blue-800'
                                        : a.type === 'CONCURRENT'
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {a.type === 'TEACHING' ? 'Giảng dạy' : a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Hoạt động'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-semibold text-slate-900">
                                  {a.dutyName || duty?.name || subject?.name || 'N/A'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-blue-900">
                                  {cls?.name || a.classId || 'Toàn trường'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium">
                                  {a.session === 'MORNING'
                                    ? 'Sáng (B1)'
                                    : a.session === 'AFTERNOON'
                                    ? 'Chiều (B2)'
                                    : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                    ? '2 buổi/ngày'
                                    : 'HĐ'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-black text-slate-900">{a.periodsPerWeek}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-emerald-800">{a.totalPeriods}</td>
                                <td className="py-2.5 px-3 text-center">
                                  {canEdit && !isLocked && !a.isDeleted ? (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAssignmentStatus(a.id, a.status)}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                                        a.status === 'approved'
                                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                      }`}
                                      title={a.status === 'approved' ? 'Nhấp để chuyển về Bản nháp' : 'Nhấp để chuyển thành Bản duyệt'}
                                    >
                                      {a.status === 'approved' ? '✓ Đã duyệt' : '📝 Bản nháp'}
                                    </button>
                                  ) : (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {a.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {canEdit && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      {a.isDeleted ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleRestore(a.id)}
                                            className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                            title="Khôi phục"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRequestDelete(a, true)}
                                            className="p-1 rounded-lg text-red-700 hover:bg-red-50 transition cursor-pointer"
                                            title="Xóa vĩnh viễn"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(a)}
                                            className="p-1 rounded-lg text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                                            title="Sửa"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenDuplicateModal(a)}
                                            className="p-1 rounded-lg text-indigo-700 hover:bg-indigo-50 transition cursor-pointer"
                                            title="Nhân bản phân công"
                                          >
                                            <Copy className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRequestDelete(a, false)}
                                            className="p-1 rounded-lg text-red-700 hover:bg-red-50 transition cursor-pointer"
                                            title="Xóa"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      className="px-4 py-3 bg-slate-50/70 text-xs text-slate-500 flex items-center justify-between cursor-pointer hover:bg-blue-50/50 transition select-none"
                      onClick={() => toggleTeacherCollapse(teacher.id)}
                    >
                      <span className="italic flex items-center gap-2 text-slate-600">
                        <ChevronRight className="w-4 h-4 text-blue-600" />
                        Đang thu ẩn <strong>{tAssignments.length}</strong> hàng phân công của giáo viên này.
                      </span>
                      <span className="text-blue-700 font-bold hover:underline">
                        Bấm vào đây hoặc tên GV để sổ ra →
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredAssignments.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            {showTrashBin ? 'Thùng rác rỗng' : 'Không tìm thấy dòng phân công nào phù hợp với bộ lọc.'}
          </div>
        )}
      </div>

      {/* ADD / EDIT ASSIGNMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-700" />
                {editingAssignment ? 'Cập nhật phân công' : 'Thêm phân công chuyên môn'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Quick switch to Smart Assignment Matrix if adding new */}
              {!editingAssignment && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs text-indigo-950 font-medium">
                    <Sparkles className="w-4 h-4 text-indigo-700 flex-shrink-0 animate-pulse" />
                    <span>Phân công hàng loạt bằng ma trận tích chọn & AI?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsSmartAssignmentOpen(true);
                    }}
                    className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-xs cursor-pointer transition flex items-center gap-1"
                  >
                    <span>Mở Ma trận</span>
                  </button>
                </div>
              )}

              {/* Validation Alert Box if Conflict Detected */}
              {validationWarning && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Cảnh báo trùng lặp / lệch khung</div>
                    <div className="text-[11px] mt-0.5">{validationWarning}</div>
                  </div>
                </div>
              )}

              {/* Smart Teacher Suggestions based on Subject & Department */}
              {formType === 'TEACHING' && modalSmartTeacherSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white border border-blue-200/90 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                      <Sparkles className="w-4 h-4 text-blue-700 animate-pulse flex-shrink-0" />
                      <span>Gợi ý giáo viên phù hợp nhất ({modalTargetSubject?.name || 'Môn học'})</span>
                    </div>
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-full border border-blue-200">
                      Ưu tiên chưa đủ định mức
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Thuật toán tự động đối chiếu môn & tổ chuyên môn, sắp xếp ưu tiên giáo viên còn thiếu nhiều tiết nhất lên đầu:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {modalSmartTeacherSuggestions.slice(0, 4).map((sugg) => {
                      const isSelected = formTeacherId === sugg.teacher.id;
                      return (
                        <button
                          key={sugg.teacher.id}
                          type="button"
                          onClick={() => setFormTeacherId(sugg.teacher.id)}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-700 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                              : 'bg-white hover:bg-blue-50/70 text-slate-800 border-slate-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <div className={`font-bold text-xs flex items-center gap-1 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                <span>{sugg.teacher.fullName}</span>
                                <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  {sugg.teacher.code}
                                </span>
                              </div>
                              <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                                {sugg.department?.name || 'Tổ bộ môn'} • {sugg.teacher.workplace || 'Điểm chính'}
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-1 pt-1 border-t border-slate-100/20">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : sugg.isUnderQuota
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : sugg.difference === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {sugg.isUnderQuota
                                ? `Thiếu ${sugg.deficit}t (${sugg.currentPeriods}/${sugg.quota}t)`
                                : sugg.difference === 0
                                ? `Đủ định mức (${sugg.quota}t)`
                                : `Vượt +${sugg.difference}t`}
                            </span>
                            <span className={`text-[10px] font-bold ${isSelected ? 'text-white underline' : 'text-blue-700'}`}>
                              {isSelected ? '✓ Đang chọn' : '+ Chọn GV này'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 1. Teacher Selector with Search */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-slate-700">Giáo viên được phân công *</label>
                  {formTeacherId && teacherMap.get(formTeacherId) && (
                    <span className="text-xs text-blue-800 font-bold bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                      Định mức: {calcMap.get(formTeacherId)?.quota ?? teacherMap.get(formTeacherId)?.standardQuota ?? 19} tiết/tuần • {teacherMap.get(formTeacherId)?.workplace || 'Điểm chính'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm nhanh giáo viên theo tên, mã hoặc nơi làm việc..."
                    value={teacherModalSearch}
                    onChange={(e) => setTeacherModalSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                  />
                </div>

                <select
                  id="modal-teacher-select"
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 text-xs sm:text-sm cursor-pointer"
                  required
                >
                  {modalFilteredTeachers.length === 0 ? (
                    <option value="" disabled>Không tìm thấy giáo viên phù hợp</option>
                  ) : (
                    <>
                      {/* Top Under-Quota / Matching suggestions optgroup */}
                      {modalSmartTeacherSuggestions
                        .filter(
                          (s) =>
                            s.isUnderQuota &&
                            (!teacherModalSearch.trim() ||
                              matchesQuery(
                                teacherModalSearch,
                                s.teacher.fullName,
                                s.teacher.code,
                                s.teacher.major,
                                ...(s.teacher.subjectsCanTeach || [])
                              ))
                        ).length > 0 && (
                        <optgroup label="⭐ Gợi ý ưu tiên (Đúng môn, cùng tổ & Chưa đủ định mức)">
                          {modalSmartTeacherSuggestions
                            .filter(
                              (s) =>
                                s.isUnderQuota &&
                                (!teacherModalSearch.trim() ||
                                  matchesQuery(
                                    teacherModalSearch,
                                    s.teacher.fullName,
                                    s.teacher.code,
                                    s.teacher.major,
                                    ...(s.teacher.subjectsCanTeach || [])
                                  ))
                            )
                            .map((s) => {
                              const dept = deptMap.get(s.teacher.departmentId);
                              return (
                                <option key={`opt-sugg-${s.teacher.id}`} value={s.teacher.id}>
                                  ⭐ {s.teacher.fullName} ({s.teacher.code}) – {dept ? (dept.fullName || dept.name) : 'Tổ CM'} – Hiện dạy: {s.currentPeriods}/{s.quota}t (Thiếu {s.deficit}t)
                                </option>
                              );
                            })}
                        </optgroup>
                      )}
                      <optgroup label="Tất cả giáo viên">
                        {modalFilteredTeachers.map((t) => {
                          const dept = deptMap.get(t.departmentId);
                          const calc = calcMap.get(t.id);
                          const currentPeriods = calc?.totalCalculated ?? 0;
                          const quota = calc?.quota ?? t.standardQuota ?? 19;
                          const diff = calc ? calc.difference : (currentPeriods - quota);
                          const diffStr = diff < 0 ? `thiếu ${Math.abs(diff)}t` : diff > 0 ? `vượt +${diff}t` : 'đủ';
                          return (
                            <option key={t.id} value={t.id}>
                              {t.fullName} ({t.code}) – {dept ? (dept.fullName || dept.name) : 'Tổ CM'} – {currentPeriods}/{quota}t ({diffStr}) – {t.workplace || 'Điểm chính'}
                            </option>
                          );
                        })}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              {/* 2. Type Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại hình nhiệm vụ *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('TEACHING')}
                    className={`py-2 text-center rounded-xl font-bold transition ${
                      formType === 'TEACHING'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Giảng dạy môn
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('CONCURRENT')}
                    className={`py-2 text-center rounded-xl font-bold transition ${
                      formType === 'CONCURRENT'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Kiêm nhiệm
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('ACTIVITY')}
                    className={`py-2 text-center rounded-xl font-bold transition ${
                      formType === 'ACTIVITY'
                        ? 'bg-blue-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Hoạt động / Khác
                  </button>
                </div>
              </div>

              {/* 3. Subject / Duty selector based on Type */}
              {formType === 'TEACHING' || formType === 'ACTIVITY' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Môn học *</label>
                  <select
                    id="modal-subject-select"
                    value={formSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) {s.isIntegrated ? '– Môn tích hợp' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhiệm vụ kiêm nhiệm *</label>
                  <select
                    id="modal-duty-select"
                    value={formDutyId}
                    onChange={(e) => {
                      setFormDutyId(e.target.value);
                      const d = dutyMap.get(e.target.value);
                      if (d) setFormPeriodsPerWeek(d.periodsPerWeekCalculated || 4);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="">-- Chọn nhiệm vụ kiêm nhiệm --</option>
                    {duties.filter((d) => d.type === 'CONCURRENT').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (+{d.periodsPerWeekCalculated} tiết/tuần)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Inter-school teaching toggle */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-purple-950 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsInterSchool}
                      onChange={(e) => setFormIsInterSchool(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-700 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>Dạy liên trường (tiết dạy tại trường khác / biệt phái)</span>
                  </label>
                  {formIsInterSchool && (
                    <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                      Tổng hợp vào định mức
                    </span>
                  )}
                </div>
                {formIsInterSchool && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-900 mb-0.5">Tên trường liên trường *</label>
                      <input
                        type="text"
                        value={formInterSchoolName}
                        onChange={(e) => setFormInterSchoolName(e.target.value)}
                        placeholder="VD: THCS Châu Quang, THCS Châu Đình..."
                        className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs text-purple-950 font-medium focus:ring-2 focus:ring-purple-500"
                        required={formIsInterSchool}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-900 mb-0.5">Ghi chú lớp liên trường</label>
                      <input
                        type="text"
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        placeholder="VD: 2 lớp Mĩ thuật liên trường..."
                        className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Multi-Class Selector (Checkboxes for batch creation) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lớp học được gán {formType === 'TEACHING' ? '(Có thể chọn nhiều lớp để tự động tách dòng)' : '(Tùy chọn)'}
                </label>
                <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {classes.filter((c) => !c.isDeleted).map((c) => {
                    const isSelected = formClassIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleClass(c.id)}
                        className={`py-1.5 px-2 rounded-lg text-center font-bold text-xs transition border ${
                          isSelected
                            ? 'bg-blue-800 text-white border-blue-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Đã chọn: <strong className="text-blue-900">{formClassIds.length} lớp</strong>
                  {formClassIds.length > 1 && ' (Hệ thống sẽ tạo riêng biệt từng bản ghi cho mỗi lớp)'}
                </div>
              </div>

              {/* 5. Periods per week & Session */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số tiết/tuần *</label>
                  <input
                    id="modal-periods-input"
                    type="number"
                    min="1"
                    max="30"
                    value={formPeriodsPerWeek}
                    onChange={(e) => setFormPeriodsPerWeek(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black text-center text-sm focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Buổi dạy</label>
                  <select
                    value={formSession}
                    onChange={(e) => setFormSession(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="MORNING">Buổi sáng (Buổi 1)</option>
                    <option value="AFTERNOON">Buổi chiều (Buổi 2)</option>
                    <option value="FULL_DAY">2 buổi/ngày</option>
                    <option value="ACTIVITY">Hoạt động / Khác</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                {!editingAssignment && (
                  <button
                    type="button"
                    onClick={(e) => handleSave(e, true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Lưu & Nhập tiếp</span>
                  </button>
                )}
                <button
                  id="modal-submit-assignment-btn"
                  type="submit"
                  className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-5 py-2 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {editingAssignment ? 'Lưu cập nhật' : 'Xác nhận phân công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM SINGLE DELETE MODAL */}
      {isDeleteModalOpen && assignmentToDelete && (() => {
        const delTeacher = teacherMap.get(assignmentToDelete.teacherId);
        const delSubject = assignmentToDelete.subjectId ? subjectMap.get(assignmentToDelete.subjectId) : null;
        const delDuty = assignmentToDelete.dutyId ? dutyMap.get(assignmentToDelete.dutyId) : null;
        const delClass = assignmentToDelete.classId ? classMap.get(assignmentToDelete.classId) : null;
        const delTitle = assignmentToDelete.dutyName || delDuty?.name || delSubject?.name || 'Phân công';
        const isPermanent = deleteMode === 'PERMANENT';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isPermanent ? 'Xác nhận xóa vĩnh viễn' : 'Chuyển phân công vào thùng rác'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isPermanent
                      ? 'Dữ liệu phân công này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu.'
                      : 'Bạn có thể khôi phục lại phân công này bất kỳ lúc nào từ Thùng rác.'}
                  </p>
                </div>
              </div>

              {/* Assignment Summary Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Giáo viên:</span>
                  <span className="font-bold text-slate-900">{delTeacher?.fullName || 'N/A'} ({delTeacher?.code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nhiệm vụ / Môn:</span>
                  <span className="font-bold text-blue-900">{delTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lớp:</span>
                  <span className="font-semibold text-slate-800">{delClass?.name || assignmentToDelete.classId || 'Toàn trường'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khối lượng:</span>
                  <span className="font-black text-slate-900">
                    {assignmentToDelete.periodsPerWeek} tiết/tuần ({assignmentToDelete.totalPeriods} tiết cả kỳ)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setAssignmentToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="confirm-delete-btn"
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isPermanent ? 'Xóa vĩnh viễn' : 'Đồng ý xóa'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONFIRM BULK DELETE MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {bulkDeleteMode === 'PERMANENT'
                    ? `Xóa vĩnh viễn ${selectedAssignmentIds.length} phân công?`
                    : `Chuyển ${selectedAssignmentIds.length} phân công vào thùng rác?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {bulkDeleteMode === 'PERMANENT'
                    ? 'Hành động này không thể hoàn tác. Các phân công được chọn sẽ biến mất vĩnh viễn.'
                    : 'Các phân công này sẽ được chuyển vào thùng rác và có thể khôi phục lại khi cần.'}
                </p>
              </div>
            </div>

            <div className="bg-red-50/60 p-3 rounded-xl border border-red-200 text-xs text-red-800">
              Bạn đang chọn thao tác hàng loạt cho <strong>{selectedAssignmentIds.length}</strong> dòng phân công chuyên môn.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                id="confirm-bulk-delete-btn"
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {bulkDeleteMode === 'PERMANENT' ? 'Xóa vĩnh viễn tất cả' : 'Đồng ý xóa tất cả'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART ASSIGNMENT MODULE (Matrix & AI-Driven) */}
      <SmartAssignmentModule
        isOpen={isSmartAssignmentOpen}
        onClose={() => setIsSmartAssignmentOpen(false)}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
        departments={departments}
        duties={duties}
        curriculums={curriculums}
        assignments={assignments}
        calculations={calculations}
        currentVersion={currentVersion}
        schoolYearId={schoolYearId}
        semesterId={semesterId}
        versionId={versionId}
      />

      {/* TEACHING PLAN FRAMEWORK MODAL */}
      <TeachingPlanFrameworkModal
        isOpen={isTeachingPlanModalOpen}
        onClose={() => setIsTeachingPlanModalOpen(false)}
        schoolInfo={dataStore.getSchoolInfo()}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
      />

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-blue-950 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl border border-blue-800/60 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
