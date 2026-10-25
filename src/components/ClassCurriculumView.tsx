/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Class, Curriculum Distribution & Subject Management View
 * Features: Complete Subject Management (Rename, Add, Remove, Configure), Class & Curriculum Controls
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Calendar,
  Layers,
  Save,
  CheckCircle2,
  Sliders,
  Sparkles,
  Maximize,
  Minimize,
  Eye,
  Edit3,
  Building2,
  Users,
  Sun,
  Moon,
  SunMoon,
  Copy,
  Info,
  X,
  Search,
  AlertTriangle,
  Check,
  CheckSquare,
  Square,
  Filter,
  Tag,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  LayoutGrid,
  List,
  PlusCircle,
} from 'lucide-react';
import {
  SchoolClass,
  Subject,
  CurriculumDistribution,
  SemesterId,
  SchoolSession,
  Teacher,
  Department,
  TeachingAssignment,
  SchoolBranch,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { SearchableTeacherSelect } from './SearchableTeacherSelect';
import { matchesQuery } from '../utils/searchUtils';

interface ClassCurriculumViewProps {
  classes: SchoolClass[];
  subjects: Subject[];
  curriculums: CurriculumDistribution[];
  teachers?: Teacher[];
  departments?: Department[];
  assignments?: TeachingAssignment[];
  semesterId: SemesterId;
  schoolYearId: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  initialTab?: 'CURRICULUM' | 'CLASSES' | 'SUBJECTS';
  initialSearchTerm?: string;
  searchFilterToken?: number;
}

const STANDARD_GDPT_SUBJECTS: Omit<Subject, 'id'>[] = [
  { code: 'TOAN', name: 'Toán học', shortName: 'Toán', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#2563eb' },
  { code: 'VAN', name: 'Ngữ văn', shortName: 'Văn', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#dc2626' },
  { code: 'ANH', name: 'Tiếng Anh', shortName: 'Anh', group: 'Ngoại ngữ', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#059669' },
  { code: 'KHTN', name: 'Khoa học tự nhiên (K6,7)', shortName: 'KHTN', group: 'Tự nhiên', applicableGrades: [6, 7], departmentId: '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#0891b2' },
  { code: 'KHTN_LY', name: 'KHTN - Vật lí', shortName: 'Lý 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0284c7' },
  { code: 'KHTN_HOA', name: 'KHTN - Hóa học', shortName: 'Hóa 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0d9488' },
  { code: 'KHTN_SINH', name: 'KHTN - Sinh học', shortName: 'Sinh 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#16a34a' },
  { code: 'SU_DIA', name: 'Lịch sử & Địa lí', shortName: 'Sử-Địa', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#d97706' },
  { code: 'GDCD', name: 'Giáo dục công dân', shortName: 'GDCD', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#7c3aed' },
  { code: 'TIN', name: 'Tin học', shortName: 'Tin', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#4f46e5' },
  { code: 'CONG_NGHE', name: 'Công nghệ', shortName: 'Công nghệ', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#ca8a04' },
  { code: 'GDTC', name: 'Giáo dục thể chất', shortName: 'Thể dục', group: 'Thể chất', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#16a34a' },
  { code: 'NGHE_THUAT', name: 'Nghệ thuật (Âm nhạc - Mỹ thuật)', shortName: 'Nghệ thuật', group: 'Nghệ thuật', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#db2777' },
  { code: 'HDTN_HN', name: 'Hoạt động trải nghiệm, hướng nghiệp', shortName: 'HĐTN', group: 'Trải nghiệm', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#0d9488' },
  { code: 'GDDP', name: 'Nội dung giáo dục địa phương', shortName: 'GDĐP', group: 'Đặc thù', applicableGrades: [6, 7, 8, 9], departmentId: '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#9333ea' },
];

export const ClassCurriculumView: React.FC<ClassCurriculumViewProps> = ({
  classes,
  subjects,
  curriculums,
  teachers = [],
  departments = [],
  assignments = [],
  semesterId,
  schoolYearId,
  isFullscreen = false,
  onToggleFullscreen,
  initialTab = 'CURRICULUM',
  initialSearchTerm,
  searchFilterToken,
}) => {
  const [activeTab, setActiveTab] = useState<'CURRICULUM' | 'CLASSES' | 'SUBJECTS'>(() => {
    if (!classes || classes.length === 0) return 'CLASSES';
    return initialTab || 'CURRICULUM';
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, searchFilterToken]);
  const [selectedGrade, setSelectedGrade] = useState<number>(6);
  const [isEditingCurriculum, setIsEditingCurriculum] = useState(false);
  const [curriculumDraft, setCurriculumDraft] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Branch reference for class assignments (luôn đồng bộ khi chuyển trường)
  const [branchesList, setBranchesList] = useState<SchoolBranch[]>(() => dataStore.getBranches());
  useEffect(() => {
    setBranchesList(dataStore.getBranches());
    const unsub = dataStore.subscribe(() => {
      setBranchesList(dataStore.getBranches());
    });
    return unsub;
  }, []);
  const branches = branchesList.length > 0 ? branchesList : dataStore.getBranches();

  // Class Modal States
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [formClassName, setFormClassName] = useState('');
  const [formGrade, setFormGrade] = useState<number>(6);
  const [formSession, setFormSession] = useState<SchoolSession>('MORNING');
  const [formStudentCount, setFormStudentCount] = useState<number>(38);
  const [formHomeroomTeacherId, setFormHomeroomTeacherId] = useState<string>('');
  const [formHomeroomTeacherSearch, setFormHomeroomTeacherSearch] = useState<string>('');
  const [formBranchId, setFormBranchId] = useState<string>('');

  // =========================================================================
  // SUBJECT MANAGEMENT STATES (THÊM / SỬA / BỚT MÔN HỌC)
  // =========================================================================
  const [subjectSearch, setSubjectSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Subject Form State
  const [subFormCode, setSubFormCode] = useState('');
  const [subFormName, setSubFormName] = useState('');
  const [subFormShortName, setSubFormShortName] = useState('');
  const [subFormGroup, setSubFormGroup] = useState('Tự nhiên');
  const [subFormDeptId, setSubFormDeptId] = useState('');
  const [subFormIsIntegrated, setSubFormIsIntegrated] = useState(false);
  const [subFormGrades, setSubFormGrades] = useState<number[]>([6, 7, 8, 9]);
  const [subFormPeriodsK6, setSubFormPeriodsK6] = useState<number>(2);
  const [subFormPeriodsK7, setSubFormPeriodsK7] = useState<number>(2);
  const [subFormPeriodsK8, setSubFormPeriodsK8] = useState<number>(2);
  const [subFormPeriodsK9, setSubFormPeriodsK9] = useState<number>(2);
  const [subFormAutoInitCurriculum, setSubFormAutoInitCurriculum] = useState(true);

  // Subject Deletion Modal State
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectViewMode, setSubjectViewMode] = useState<'TABLE' | 'GRID'>('TABLE');
  const [isBulkDeleteSubjectModalOpen, setIsBulkDeleteSubjectModalOpen] = useState(false);

  // Class Management Enhanced Filter & Bulk States
  const [classSearch, setClassSearch] = useState('');
  const [classFilterGrade, setClassFilterGrade] = useState<string>('ALL');
  const [classFilterSession, setClassFilterSession] = useState<string>('ALL');
  const [classViewMode, setClassViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [isBulkDeleteClassModalOpen, setIsBulkDeleteClassModalOpen] = useState(false);

  // Curriculum Filter & Quick Add States
  const [curriculumSearch, setCurriculumSearch] = useState('');
  const [isAddSubjectToGradeModalOpen, setIsAddSubjectToGradeModalOpen] = useState(false);
  const [selectedSubjectToAddToGrade, setSelectedSubjectToAddToGrade] = useState('');
  const [periodsToAddToGrade, setPeriodsToAddToGrade] = useState(2);

  // Sync search filter from global search
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      if (initialTab === 'CLASSES' || activeTab === 'CLASSES') {
        setClassSearch(initialSearchTerm);
      }
      if (initialTab === 'SUBJECTS' || activeTab === 'SUBJECTS') {
        setSubjectSearch(initialSearchTerm);
      }
      if (initialTab === 'CURRICULUM' || activeTab === 'CURRICULUM') {
        setCurriculumSearch(initialSearchTerm);
      }
    }
  }, [initialSearchTerm, searchFilterToken, initialTab]);

  const currentUser = dataStore.getCurrentUser();
  const isTenantSchool = dataStore.getSchoolId() !== 'school_quyhop' || Boolean(dataStore.detectUrlSchoolId() && dataStore.detectUrlSchoolId() !== 'school_quyhop');
  const canEdit = currentUser.permission === 'edit' || currentUser.role === 'admin' || currentUser.role === 'principal' || isTenantSchool;

  const deptList = useMemo(() => (departments.length > 0 ? departments : dataStore.getDepartments()), [departments]);
  const deptMap = useMemo(() => new Map(deptList.map((d) => [d.id, d])), [deptList]);

  const allAssignments = useMemo(
    () => (assignments.length > 0 ? assignments : dataStore.getAssignments(undefined, undefined, undefined, false)),
    [assignments]
  );

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const teacherList = useMemo(() => (teachers.length > 0 ? teachers : dataStore.getTeachers(true)), [teachers]);
  const teacherMap = useMemo(() => new Map(teacherList.map((t) => [t.id, t])), [teacherList]);

  const currentGradeCurriculum = useMemo(() => {
    return curriculums.filter(
      (c) => c.grade === selectedGrade && c.semesterId === semesterId && c.schoolYearId === schoolYearId
    );
  }, [curriculums, selectedGrade, semesterId, schoolYearId]);

  const totalGradeWeeklyPeriods = useMemo(() => {
    return currentGradeCurriculum.reduce((s, c) => s + (c.periodsPerWeek || 0), 0);
  }, [currentGradeCurriculum]);

  const activeClasses = useMemo(() => classes.filter((c) => !c.isDeleted), [classes]);

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return subjects.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [subjects]);

  // Filtered subjects for SUBJECTS tab
  const filteredSubjects = useMemo(() => {
    const seen = new Set<string>();
    return uniqueSubjects.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      const matchSearch =
        !subjectSearch.trim() ||
        matchesQuery(subjectSearch, s.name, s.code, s.shortName, s.group);
      const matchGroup = selectedGroupFilter === 'ALL' || s.group === selectedGroupFilter;
      return matchSearch && matchGroup;
    });
  }, [uniqueSubjects, subjectSearch, selectedGroupFilter]);

  // Subject groups list
  const subjectGroups = useMemo(() => {
    const groups = new Set<string>();
    subjects.forEach((s) => {
      if (s.group) groups.add(s.group);
    });
    return Array.from(groups);
  }, [subjects]);

  // Calculate subject stats
  const subjectStats = useMemo(() => {
    const map = new Map<string, { k6: number; k7: number; k8: number; k9: number; totalWeekly: number; assignmentCount: number }>();
    subjects.forEach((s) => {
      const currs = curriculums.filter(
        (c) => c.subjectId === s.id && c.semesterId === semesterId && c.schoolYearId === schoolYearId
      );
      const k6 = currs.find((c) => c.grade === 6)?.periodsPerWeek || 0;
      const k7 = currs.find((c) => c.grade === 7)?.periodsPerWeek || 0;
      const k8 = currs.find((c) => c.grade === 8)?.periodsPerWeek || 0;
      const k9 = currs.find((c) => c.grade === 9)?.periodsPerWeek || 0;
      const assignmentCount = allAssignments.filter((a) => !a.isDeleted && a.subjectId === s.id).length;
      map.set(s.id, { k6, k7, k8, k9, totalWeekly: k6 + k7 + k8 + k9, assignmentCount });
    });
    return map;
  }, [subjects, curriculums, allAssignments, semesterId, schoolYearId]);

  // =========================================================================
  // SUBJECT EDIT / ADD HANDLERS
  // =========================================================================
  const handleOpenAddSubjectModal = () => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng liên hệ quản trị viên để có quyền chỉnh sửa.', 'error');
      return;
    }
    setEditingSubject(null);
    setSubFormCode('');
    setSubFormName('');
    setSubFormShortName('');
    setSubFormGroup('Tự nhiên');
    setSubFormDeptId(deptList[0]?.id || '');
    setSubFormIsIntegrated(false);
    setSubFormGrades([6, 7, 8, 9]);
    setSubFormPeriodsK6(2);
    setSubFormPeriodsK7(2);
    setSubFormPeriodsK8(2);
    setSubFormPeriodsK9(2);
    setSubFormAutoInitCurriculum(true);
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubjectModal = (s: Subject) => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng liên hệ quản trị viên để có quyền chỉnh sửa.', 'error');
      return;
    }
    setEditingSubject(s);
    setSubFormCode(s.code || '');
    setSubFormName(s.name || '');
    setSubFormShortName(s.shortName || '');
    setSubFormGroup(s.group || 'Tự nhiên');
    setSubFormDeptId(s.departmentId || deptList[0]?.id || '');
    setSubFormIsIntegrated(Boolean(s.isIntegrated));
    setSubFormGrades(s.applicableGrades && s.applicableGrades.length > 0 ? s.applicableGrades : [6, 7, 8, 9]);
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = (e?: React.FormEvent, continueAdding = false) => {
    if (e) e.preventDefault();
    const code = subFormCode.trim().toUpperCase();
    const name = subFormName.trim();
    if (!name) {
      showToast('Vui lòng nhập tên môn học!', 'error');
      return;
    }
    if (!code) {
      showToast('Vui lòng nhập mã môn học!', 'error');
      return;
    }

    const shortName = subFormShortName.trim() || (name.length > 8 ? name.substring(0, 8) : name);

    if (editingSubject) {
      // Check if duplicate code with other subjects
      if (subjects.some((s) => s.id !== editingSubject.id && s.code.toUpperCase() === code)) {
        showToast(`Mã môn "${code}" đã trùng với một môn học khác trong hệ thống!`, 'error');
        return;
      }

      const success = dataStore.updateSubject(editingSubject.id, {
        code,
        name,
        shortName,
        group: subFormGroup,
        departmentId: subFormDeptId || deptList[0]?.id || '',
        allowsMultipleTeachers: subFormIsIntegrated,
        isIntegrated: subFormIsIntegrated,
        applicableGrades: subFormGrades,
        active: true,
      });

      if (success) {
        showToast(`Đã cập nhật thành công tên môn học: "${name}" (${code})!`);
        setIsSubjectModalOpen(false);
      } else {
        showToast('Không thể cập nhật môn học. Vui lòng thử lại!', 'error');
      }
    } else {
      // Adding new subject
      if (subjects.some((s) => s.code.toUpperCase() === code)) {
        showToast(`Mã môn "${code}" đã tồn tại trong hệ thống! Vui lòng chọn mã khác.`, 'error');
        return;
      }

      const newSub = dataStore.addSubject({
        code,
        name,
        shortName,
        group: subFormGroup,
        departmentId: subFormDeptId || deptList[0]?.id || '',
        allowsMultipleTeachers: subFormIsIntegrated,
        isIntegrated: subFormIsIntegrated,
        applicableGrades: subFormGrades,
        active: true,
        color: '#2563eb',
      });

      // Optionally auto-initialize curriculum distribution
      if (subFormAutoInitCurriculum && newSub) {
        const weeks = semesterId === 'HK1' ? 18 : 17;
        const periodsByGrade: Record<number, number> = {
          6: subFormPeriodsK6,
          7: subFormPeriodsK7,
          8: subFormPeriodsK8,
          9: subFormPeriodsK9,
        };

        const currItems = subFormGrades.map((grade) => ({
          schoolYearId,
          semesterId,
          grade: grade as 6 | 7 | 8 | 9,
          subjectId: newSub.id,
          periodsPerWeek: periodsByGrade[grade] || 2,
          weeks,
        }));
        dataStore.bulkUpsertCurriculum(currItems);
      }

      showToast(`Đã thêm thành công môn học mới: "${name}" (${code})!`);
      if (continueAdding) {
        setSubFormCode('');
        setSubFormName('');
        setSubFormShortName('');
      } else {
        setIsSubjectModalOpen(false);
      }
    }
  };

  const handlePromptDeleteSubject = (s: Subject) => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng liên hệ quản trị viên để có quyền chỉnh sửa.', 'error');
      return;
    }
    setSubjectToDelete(s);
  };

  const handleConfirmDeleteSubject = () => {
    if (!subjectToDelete) return;
    const s = subjectToDelete;
    dataStore.deleteSubject(s.id, true);
    showToast(`Đã xóa môn học "${s.name}" (${s.code}) và dọn dẹp các khung tiết liên quan thành công!`);
    setSelectedSubjectIds((prev) => prev.filter((id) => id !== s.id));
    setSubjectToDelete(null);
  };

  // SUBJECT MULTI-SELECT & BULK ACTIONS
  const handleToggleSelectAllSubjects = () => {
    if (selectedSubjectIds.length === filteredSubjects.length) {
      setSelectedSubjectIds([]);
    } else {
      setSelectedSubjectIds(filteredSubjects.map((s) => s.id));
    }
  };

  const handleToggleSelectSubject = (id: string) => {
    setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleDuplicateSubject = (s: Subject) => {
    if (!canEdit) return;
    const baseCode = `${s.code}_COPY`;
    let newCode = baseCode;
    let counter = 1;
    while (subjects.some((sub) => sub.code === newCode)) {
      newCode = `${baseCode}${counter++}`;
    }
    const newName = `${s.name} (Bản sao)`;
    const newSub = dataStore.addSubject({
      code: newCode,
      name: newName,
      shortName: s.shortName ? `${s.shortName}-C` : 'Sao',
      group: s.group,
      departmentId: s.departmentId,
      applicableGrades: s.applicableGrades || [6, 7, 8, 9],
      allowsMultipleTeachers: s.allowsMultipleTeachers,
      isIntegrated: s.isIntegrated,
      active: true,
      color: s.color || '#2563eb',
    });
    showToast(`Đã nhân bản thành công môn học mới: "${newName}" (${newCode})`);
  };

  const handleConfirmBulkDeleteSubjects = () => {
    if (selectedSubjectIds.length === 0) return;
    const count = dataStore.bulkDeleteSubjects(selectedSubjectIds, true);
    showToast(`Đã xóa thành công ${count} môn học và các dữ liệu liên quan!`);
    setSelectedSubjectIds([]);
    setIsBulkDeleteSubjectModalOpen(false);
  };

  const handleApplyStandardGDPT = () => {
    if (!canEdit) return;
    const toAdd: Omit<Subject, 'id'>[] = [];
    STANDARD_GDPT_SUBJECTS.forEach((sub) => {
      if (!subjects.some((s) => s.code.toLowerCase() === sub.code.toLowerCase())) {
        toAdd.push({
          ...sub,
          departmentId: deptList[0]?.id || '',
        });
      }
    });

    if (toAdd.length === 0) {
      showToast('Tất cả 12 môn học chuẩn GDPT 2018 đã có sẵn đầy đủ trong hệ thống!', 'info');
      return;
    }

    dataStore.bulkAddSubjects(toAdd);
    showToast(`Đã nạp bổ sung thành công ${toAdd.length} môn học chuẩn GDPT 2018!`);
  };

  // Curriculum Filtered & Handlers
  const filteredCurriculum = useMemo(() => {
    if (!curriculumSearch.trim()) return currentGradeCurriculum;
    return currentGradeCurriculum.filter((curr) => {
      const s = subjectMap.get(curr.subjectId) || subjects.find((sub) => sub.code === curr.subjectId);
      return matchesQuery(
        curriculumSearch,
        curr.subjectId,
        s?.name,
        s?.code,
        s?.shortName,
        s?.group
      );
    });
  }, [currentGradeCurriculum, curriculumSearch, subjectMap, subjects]);

  const handleStartEdit = () => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng cấp quyền chỉnh sửa cho tài khoản để thao tác.', 'error');
      return;
    }
    const draft: Record<string, number> = {};
    currentGradeCurriculum.forEach((c) => {
      draft[c.id] = c.periodsPerWeek;
    });
    setCurriculumDraft(draft);
    setIsEditingCurriculum(true);
  };

  const handleSaveCurriculum = () => {
    Object.entries(curriculumDraft).forEach(([id, periods]) => {
      dataStore.updateCurriculum(id, {
        periodsPerWeek: Math.max(0, Number(periods)),
      });
    });
    setIsEditingCurriculum(false);
    showToast(`Đã lưu khung phân phối số tiết Khối ${selectedGrade} thành công!`);
  };

  const handleCopyFromHK1 = () => {
    if (!canEdit) return;
    if (confirm('Sao chép khung phân phối số tiết từ Học kỳ 1 sang Học kỳ 2?')) {
      const count = dataStore.copyCurriculumAcrossSemesters('HK1', 'HK2', schoolYearId);
      showToast(`Đã sao chép thành công ${count} khung môn sang Học kỳ 2!`);
    }
  };

  const handleOpenAddSubjectToGradeModal = () => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng cấp quyền chỉnh sửa cho tài khoản để thao tác.', 'error');
      return;
    }
    // Find first subject not already having non-zero periods in this grade
    const existingSubjectIds = new Set(currentGradeCurriculum.filter((c) => c.periodsPerWeek > 0).map((c) => c.subjectId));
    const availableSubject = subjects.find((s) => !existingSubjectIds.has(s.id));
    setSelectedSubjectToAddToGrade(availableSubject?.id || subjects[0]?.id || '');
    setPeriodsToAddToGrade(2);
    setIsAddSubjectToGradeModalOpen(true);
  };

  const handleConfirmAddSubjectToGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectToAddToGrade) {
      showToast('Vui lòng chọn môn học cần bổ sung vào khối!', 'error');
      return;
    }
    const weeks = semesterId === 'HK1' ? 18 : 17;
    dataStore.bulkUpsertCurriculum([
      {
        schoolYearId,
        semesterId,
        grade: selectedGrade as 6 | 7 | 8 | 9,
        subjectId: selectedSubjectToAddToGrade,
        periodsPerWeek: periodsToAddToGrade,
        weeks,
        status: 'approved',
        effectiveDate: new Date().toISOString(),
      },
    ]);
    const s = subjectMap.get(selectedSubjectToAddToGrade);
    showToast(`Đã bổ sung môn "${s?.name || selectedSubjectToAddToGrade}" vào Khối ${selectedGrade} (${periodsToAddToGrade} tiết/tuần)!`);
    setIsAddSubjectToGradeModalOpen(false);
  };

  const handleRemoveSubjectFromGrade = (currId: string, subjectName: string) => {
    if (!canEdit) return;
    dataStore.updateCurriculum(currId, { periodsPerWeek: 0 });
    showToast(`Đã giảm số tiết môn "${subjectName}" về 0 tiết/tuần.`);
  };

  // Class Management Handlers
  const filteredClasses = useMemo(() => {
    return activeClasses.filter((c) => {
      const hrTeacher = c.homeroomTeacherId ? teacherMap.get(c.homeroomTeacherId) : null;
      const matchSearch =
        !classSearch.trim() ||
        matchesQuery(classSearch, c.name, hrTeacher?.fullName, hrTeacher?.code, hrTeacher?.major);
      const matchGrade = classFilterGrade === 'ALL' || c.grade === Number(classFilterGrade);
      const matchSession =
        classFilterSession === 'ALL' ||
        c.session === classFilterSession ||
        (classFilterSession === 'FULL_DAY' && (c.session === 'FULL_DAY' || (c.session as any) === 'TWO_SESSIONS_PER_DAY'));
      return matchSearch && matchGrade && matchSession;
    });
  }, [activeClasses, classSearch, classFilterGrade, classFilterSession, teacherMap]);

  const handleToggleSelectAllClasses = () => {
    if (selectedClassIds.length === filteredClasses.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(filteredClasses.map((c) => c.id));
    }
  };

  const handleToggleSelectClass = (id: string) => {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Subscribe to dataStore for branch updates
  useEffect(() => {
    const unsub = dataStore.subscribe(() => {
      setBranchesList(dataStore.getBranches());
    });
    return () => unsub();
  }, []);

  const handleGenerateSampleClasses = () => {
    try {
      const sampleClasses: Omit<SchoolClass, 'id'>[] = [
        { code: '6A1', name: '6A1', grade: 6, session: 'MORNING', studentCount: 35, active: true },
        { code: '6A2', name: '6A2', grade: 6, session: 'MORNING', studentCount: 35, active: true },
        { code: '7A1', name: '7A1', grade: 7, session: 'AFTERNOON', studentCount: 35, active: true },
        { code: '7A2', name: '7A2', grade: 7, session: 'AFTERNOON', studentCount: 35, active: true },
        { code: '8A1', name: '8A1', grade: 8, session: 'AFTERNOON', studentCount: 35, active: true },
        { code: '8A2', name: '8A2', grade: 8, session: 'AFTERNOON', studentCount: 35, active: true },
        { code: '9A1', name: '9A1', grade: 9, session: 'MORNING', studentCount: 35, active: true },
        { code: '9A2', name: '9A2', grade: 9, session: 'MORNING', studentCount: 35, active: true },
      ];
      dataStore.bulkAddClasses(sampleClasses);
      showToast('Đã khởi tạo thành công 8 lớp học mẫu (6A1, 6A2, 7A1, 7A2, 8A1, 8A2, 9A1, 9A2)!');
    } catch (err: any) {
      showToast(err?.message || 'Không thể tạo lớp mẫu', 'error');
    }
  };

  const handleOpenAddClassModal = () => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng cấp quyền chỉnh sửa cho tài khoản để thao tác.', 'error');
      return;
    }
    setEditingClass(null);
    setFormClassName(`6A${classes.filter((c) => c.grade === 6).length + 1}`);
    setFormGrade(6);
    setFormSession('MORNING');
    setFormStudentCount(38);
    setFormHomeroomTeacherId('');
    const mainBranch = branches.find((b) => b.isMain) || branches[0];
    setFormBranchId(mainBranch?.id || 'branch_main');
    setIsClassModalOpen(true);
  };

  const handleOpenEditClassModal = (cls: SchoolClass) => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng cấp quyền chỉnh sửa cho tài khoản để thao tác.', 'error');
      return;
    }
    setEditingClass(cls);
    setFormClassName(cls.name);
    setFormGrade(cls.grade);
    setFormSession(cls.session);
    setFormStudentCount(cls.studentCount);
    setFormHomeroomTeacherId(cls.homeroomTeacherId || '');
    const mainBranch = branches.find((b) => b.isMain) || branches[0];
    setFormBranchId(cls.branchId || mainBranch?.id || 'branch_main');
    setIsClassModalOpen(true);
  };

  // Smart Class Name Change: auto-detect Grade and Session
  const handleClassNameChange = (val: string) => {
    setFormClassName(val);
    const trimmed = val.trim();
    const match = trimmed.match(/^([6789])/);
    if (match) {
      const g = Number(match[1]) as 6 | 7 | 8 | 9;
      setFormGrade(g);
      // Auto set session: grade 6 & 9 default MORNING, grade 7 & 8 default AFTERNOON
      if (g === 6 || g === 9) {
        setFormSession('MORNING');
      } else {
        setFormSession('AFTERNOON');
      }
    }
  };

  const handleSaveClass = (e?: React.FormEvent, continueAdding = false) => {
    if (e) e.preventDefault();
    const name = formClassName.trim();
    if (!name) {
      showToast('Vui lòng nhập tên lớp học.', 'error');
      return;
    }

    // Check duplicate class name
    const isDuplicate = classes.some(
      (c) => !c.isDeleted && c.name.toLowerCase() === name.toLowerCase() && (!editingClass || c.id !== editingClass.id)
    );
    if (isDuplicate) {
      showToast(`Tên lớp "${name}" đã tồn tại trong danh sách lớp học!`, 'error');
      return;
    }

    try {
      if (editingClass) {
        dataStore.updateClass(editingClass.id, {
          name,
          grade: formGrade,
          session: formSession,
          studentCount: Number(formStudentCount) || 35,
          homeroomTeacherId: formHomeroomTeacherId || undefined,
          branchId: formBranchId || undefined,
        });
        showToast(`Đã cập nhật thông tin lớp ${name} thành công!`);
        setIsClassModalOpen(false);
      } else {
        dataStore.addClass({
          code: name,
          name,
          grade: formGrade as 6 | 7 | 8 | 9,
          session: formSession,
          studentCount: Number(formStudentCount) || 35,
          homeroomTeacherId: formHomeroomTeacherId || undefined,
          branchId: formBranchId || undefined,
          active: true,
        });
        showToast(`Đã thêm mới lớp học ${name} thành công!`);
        if (continueAdding) {
          // Auto increment class number if possible: 6A1 -> 6A2
          const match = name.match(/^(\d+)([A-Za-zÀ-ỹ]+)(\d+)$/);
          if (match) {
            const nextNum = parseInt(match[3], 10) + 1;
            setFormClassName(`${match[1]}${match[2]}${nextNum}`);
          } else {
            setFormClassName('');
          }
          setFormHomeroomTeacherId('');
        } else {
          setIsClassModalOpen(false);
        }
      }
    } catch (err: any) {
      showToast(err?.message || 'Không thể lưu lớp học. Vui lòng kiểm tra lại.', 'error');
    }
  };

  const handlePromptDeleteClass = (cls: SchoolClass) => {
    if (!canEdit) {
      showToast('Bạn đang ở chế độ Chỉ xem. Vui lòng cấp quyền chỉnh sửa cho tài khoản để thao tác.', 'error');
      return;
    }
    setClassToDelete(cls);
  };

  const handleConfirmDeleteClass = () => {
    if (!classToDelete) return;
    const name = classToDelete.name;
    dataStore.deleteClass(classToDelete.id, true);
    showToast(`Đã xóa thành công lớp ${name} và các phân công liên quan!`);
    setSelectedClassIds((prev) => prev.filter((id) => id !== classToDelete.id));
    setClassToDelete(null);
  };

  const handleConfirmBulkDeleteClasses = () => {
    if (selectedClassIds.length === 0) return;
    const count = dataStore.bulkDeleteClasses(selectedClassIds, true);
    showToast(`Đã xóa thành công ${count} lớp học đã chọn!`);
    setSelectedClassIds([]);
    setIsBulkDeleteClassModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-red-900 text-white border-red-700'
              : toastMessage.type === 'info'
              ? 'bg-blue-900 text-white border-blue-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-red-300 flex-shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <Info className="w-5 h-5 text-blue-300 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Lớp học, Môn học & Khung phân phối chương trình
              </h2>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  canEdit ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                }`}
              >
                {canEdit ? <Edit3 className="w-3 h-3 text-emerald-700" /> : <Eye className="w-3 h-3 text-sky-700" />}
                {canEdit ? 'Quyền Chỉnh sửa' : 'Chỉ Xem'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý danh mục môn học (Thêm, Sửa, Bớt môn), danh sách lớp học và số tiết chuẩn từng khối ({semesterId})
            </p>
          </div>
        </div>

        {/* TAB BUTTONS & FULLSCREEN */}
        <div className="flex items-center gap-2 flex-wrap">
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
              <span>{isFullscreen ? 'Thu nhỏ' : 'Full view'}</span>
            </button>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              id="tab-subjects-btn"
              onClick={() => setActiveTab('SUBJECTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'SUBJECTS' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Môn học ({subjects.length})</span>
            </button>

            <button
              id="tab-curriculum-btn"
              onClick={() => setActiveTab('CURRICULUM')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'CURRICULUM' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Khung số tiết</span>
            </button>

            <button
              id="tab-classes-btn"
              onClick={() => setActiveTab('CLASSES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'CLASSES' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Lớp học ({activeClasses.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DANH MỤC MÔN HỌC (SUBJECTS) - THÊM / SỬA TÊN / BỚT MÔN HỌC */}
      {/* ========================================================================= */}
      {activeTab === 'SUBJECTS' && (
        <div className="space-y-4">
          {/* TOP BAR: SEARCH, FILTER & QUICK ACTIONS */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm môn học theo tên, mã môn, tên viết tắt..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                {subjectSearch && (
                  <button
                    onClick={() => setSubjectSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Group Filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả nhóm môn ({subjects.length})</option>
                  {subjectGroups.map((g) => (
                    <option key={g} value={g}>
                      Nhóm: {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setSubjectViewMode('TABLE')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    subjectViewMode === 'TABLE' ? 'bg-white shadow-xs text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Chế độ bảng chi tiết"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSubjectViewMode('GRID')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    subjectViewMode === 'GRID' ? 'bg-white shadow-xs text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Chế độ thẻ ô lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Delete Button */}
              {selectedSubjectIds.length > 0 && canEdit && (
                <button
                  onClick={() => setIsBulkDeleteSubjectModalOpen(true)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition animate-in fade-in cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedSubjectIds.length}) môn đã chọn</span>
                </button>
              )}

              {canEdit && (
                <>
                  <button
                    onClick={handleApplyStandardGDPT}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
                    title="Nạp nhanh các môn học chuẩn GDPT 2018 nếu hệ thống chưa có"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Nạp chuẩn GDPT</span>
                  </button>

                  <button
                    id="add-subject-btn"
                    onClick={handleOpenAddSubjectModal}
                    className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm môn học</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* SUBJECTS TABLE VIEW */}
          {subjectViewMode === 'TABLE' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {canEdit && filteredSubjects.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.length === filteredSubjects.length && filteredSubjects.length > 0}
                      onChange={handleToggleSelectAllSubjects}
                      className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      title="Chọn tất cả các môn đang hiển thị"
                    />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Danh mục môn học của trường</span>
                      <span className="text-xs font-normal text-slate-500">
                        (Hiển thị {filteredSubjects.length} / {subjects.length} môn)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bấm nút <strong>Sửa tên</strong> để chỉnh sửa tên môn học, <strong>Nhân bản</strong> để tạo bản sao, hoặc <strong>Xóa</strong> để bớt môn.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-lg border border-blue-200">
                    {subjects.filter((s) => s.isIntegrated).length} môn tích hợp
                  </span>
                  <span className="bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg">
                    {subjects.filter((s) => !s.isIntegrated).length} môn đơn
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      {canEdit && <th className="py-3 px-3 text-center w-10"></th>}
                      <th className="py-3 px-3 text-center w-12">STT</th>
                      <th className="py-3 px-3 text-center">Mã môn</th>
                      <th className="py-3 px-4 min-w-[180px]">Tên đầy đủ môn học</th>
                      <th className="py-3 px-3 text-center">Tên viết tắt</th>
                      <th className="py-3 px-3 text-center">Nhóm môn</th>
                      <th className="py-3 px-3">Tổ bộ môn</th>
                      <th className="py-3 px-3 text-center">Đặc thù</th>
                      <th className="py-3 px-3 text-center">Khung tiết (K6 - K7 - K8 - K9)</th>
                      <th className="py-3 px-3 text-center">Phân công</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 11 : 10} className="py-12 text-center text-slate-400">
                          <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">Không tìm thấy môn học nào phù hợp</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Thử thay đổi từ khóa tìm kiếm hoặc bấm &quot;Thêm môn học mới&quot;
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredSubjects.map((s, idx) => {
                        const dept = deptMap.get(s.departmentId);
                        const stats = subjectStats.get(s.id) || { k6: 0, k7: 0, k8: 0, k9: 0, totalWeekly: 0, assignmentCount: 0 };
                        const isSelected = selectedSubjectIds.includes(s.id);
                        return (
                          <tr key={s.id} className={`hover:bg-blue-50/40 transition group ${isSelected ? 'bg-blue-50/70' : ''}`}>
                            {canEdit && (
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectSubject(s.id)}
                                  className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                              <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[11px]">
                                {s.code}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                <span>{s.name}</span>
                                {s.isIntegrated && (
                                  <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                    Tích hợp
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Khối áp dụng: {s.applicableGrades?.join(', ') || '6, 7, 8, 9'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                              {s.shortName || s.name}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  s.group === 'Tự nhiên'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : s.group === 'Xã hội'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : s.group === 'Ngoại ngữ'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : s.group === 'Nghệ thuật'
                                    ? 'bg-pink-50 text-pink-800 border-pink-200'
                                    : s.group === 'Thể chất'
                                    ? 'bg-lime-50 text-lime-800 border-lime-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {s.group || 'Chưa xếp'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-medium">
                              {dept?.name || 'Tổ liên môn'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {s.isIntegrated ? (
                                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  Nhiều GV cùng dạy
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Đơn môn</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[11px]">
                                <span title="Khối 6" className={stats.k6 > 0 ? 'font-bold text-slate-900' : 'text-slate-300'}>
                                  K6:{stats.k6}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span title="Khối 7" className={stats.k7 > 0 ? 'font-bold text-slate-900' : 'text-slate-300'}>
                                  K7:{stats.k7}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span title="Khối 8" className={stats.k8 > 0 ? 'font-bold text-slate-900' : 'text-slate-300'}>
                                  K8:{stats.k8}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span title="Khối 9" className={stats.k9 > 0 ? 'font-bold text-slate-900' : 'text-slate-300'}>
                                  K9:{stats.k9}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {stats.assignmentCount > 0 ? (
                                <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px]">
                                  {stats.assignmentCount} lớp
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0 lớp</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {canEdit && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSubjectModal(s)}
                                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="Chỉnh sửa tên môn học và các thông tin"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      <span>Sửa tên</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateSubject(s)}
                                      className="p-1.5 text-slate-500 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                      title="Nhân bản tạo bản sao môn học"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handlePromptDeleteSubject(s)}
                                      className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="Bớt / Xóa môn học này"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBJECTS GRID VIEW */}
          {subjectViewMode === 'GRID' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredSubjects.map((s) => {
                const dept = deptMap.get(s.departmentId);
                const stats = subjectStats.get(s.id) || { k6: 0, k7: 0, k8: 0, k9: 0, totalWeekly: 0, assignmentCount: 0 };
                const isSelected = selectedSubjectIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className={`bg-white p-4 rounded-2xl border transition space-y-3 relative group shadow-2xs hover:shadow-md ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectSubject(s.id)}
                            className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        )}
                        <span className="font-mono font-bold text-xs bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                          {s.code}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        {s.group || 'Môn học'}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900 leading-tight flex items-center gap-1.5">
                        <span>{s.name}</span>
                        {s.isIntegrated && (
                          <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                            Tích hợp
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">Viết tắt: {s.shortName || s.name} • Tổ: {dept?.name || 'Tổ bộ môn'}</p>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="text-[11px] text-slate-600">
                        <span className="text-slate-400 block text-[10px]">Khung tiết/tuần:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {stats.k6}-{stats.k7}-{stats.k8}-{stats.k9} (Tổng: {stats.totalWeekly}t)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px]">Phân công:</span>
                        <span className="font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                          {stats.assignmentCount} lớp
                        </span>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditSubjectModal(s)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSubject(s)}
                          className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Nhân bản môn"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptDeleteSubject(s)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Bớt / Xóa môn"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CURRICULUM DISTRIBUTION (KHUNG SỐ TIẾT MÔN HỌC) */}
      {/* ========================================================================= */}
      {activeTab === 'CURRICULUM' && (
        <div className="space-y-4">
          {/* GRADE SELECTOR & ACTION BAR */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 mr-1">Khối lớp:</span>
                {[6, 7, 8, 9].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGrade(grade)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedGrade === grade
                        ? 'bg-blue-900 text-white shadow-sm ring-2 ring-blue-600/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Khối {grade}
                  </button>
                ))}
              </div>

              {/* Curriculum Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Lọc môn trong khối..."
                  value={curriculumSearch}
                  onChange={(e) => setCurriculumSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {canEdit && (
                <button
                  onClick={handleOpenAddSubjectToGradeModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-xs font-bold transition border border-blue-200 cursor-pointer"
                  title="Bổ sung thêm môn học vào khung chương trình khối này"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Bổ sung môn vào khối {selectedGrade}</span>
                </button>
              )}

              {semesterId === 'HK2' && canEdit && (
                <button
                  onClick={handleCopyFromHK1}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sao chép từ HK1</span>
                </button>
              )}

              {canEdit &&
                (isEditingCurriculum ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingCurriculum(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleSaveCurriculum}
                      className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu khung tiết</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa số tiết Khối {selectedGrade}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* CURRICULUM TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Khung phân phối số tiết Khối {selectedGrade} ({semesterId === 'HK1' ? '18 tuần' : '17 tuần'})
                </h3>
                <span className="text-xs text-slate-500">Chương trình chuẩn GDPT 2018</span>
              </div>
              <div className="bg-blue-100 text-blue-950 font-black text-xs px-3 py-1.5 rounded-xl border border-blue-200">
                Tổng cộng: {totalGradeWeeklyPeriods} tiết/tuần
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3 px-3 text-center w-12">STT</th>
                    <th className="py-3 px-4">Tên Môn học</th>
                    <th className="py-3 px-3 text-center">Mã môn</th>
                    <th className="py-3 px-3 text-center">Đặc thù môn</th>
                    <th className="py-3 px-3 text-center">Tiết / Tuần</th>
                    <th className="py-3 px-3 text-center">Số tuần ({semesterId})</th>
                    <th className="py-3 px-3 text-center">Tổng số tiết cả kỳ</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCurriculum.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Chưa có môn học nào phù hợp trong khối này.
                      </td>
                    </tr>
                  ) : (
                    filteredCurriculum.map((curr, idx) => {
                      const s = subjectMap.get(curr.subjectId) || subjects.find((sub) => sub.code === curr.subjectId);
                      return (
                        <tr key={curr.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{s?.name || curr.subjectId}</span>
                              {s && (
                                <button
                                  onClick={() => handleOpenEditSubjectModal(s)}
                                  className="text-slate-400 hover:text-blue-700 p-0.5 rounded transition cursor-pointer"
                                  title="Chỉnh sửa tên môn học này"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-500">{s?.code || curr.subjectId}</td>
                          <td className="py-3 px-3 text-center">
                            {s?.isIntegrated && (
                              <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                                Môn tích hợp
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isEditingCurriculum ? (
                              <input
                                type="number"
                                min="0"
                                max="15"
                                value={curriculumDraft[curr.id] ?? curr.periodsPerWeek}
                                onChange={(e) =>
                                  setCurriculumDraft({
                                    ...curriculumDraft,
                                    [curr.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                                className="w-16 bg-blue-50 border border-blue-300 rounded-lg p-1 text-center font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="font-black text-slate-900 text-sm">{curr.periodsPerWeek}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-500 font-mono">{curr.weeks}</td>
                          <td className="py-3 px-3 text-center font-bold text-slate-900 font-mono">
                            {isEditingCurriculum
                              ? (curriculumDraft[curr.id] ?? curr.periodsPerWeek) * curr.weeks
                              : curr.totalPeriods}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {s && (
                                <button
                                  onClick={() => handleOpenEditSubjectModal(s)}
                                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <Edit2 className="w-3 h-3" /> Sửa môn
                                </button>
                              )}
                              {canEdit && curr.periodsPerWeek > 0 && (
                                <button
                                  onClick={() => handleRemoveSubjectFromGrade(curr.id, s?.name || curr.subjectId)}
                                  className="text-xs text-amber-700 hover:text-red-700 font-medium inline-flex items-center gap-0.5 cursor-pointer"
                                  title="Giảm số tiết môn này về 0 (bớt khỏi khối)"
                                >
                                  Bớt môn
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CLASSES LIST & MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSES' && (
        <div className="space-y-4">
          {/* CLASSES ACTION BAR */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-[280px] flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm lớp hoặc tên GVCN..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {classSearch && (
                  <button
                    onClick={() => setClassSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Grade Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {(['ALL', 6, 7, 8, 9] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setClassFilterGrade(g === 'ALL' ? 'ALL' : g)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      classFilterGrade === g
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {g === 'ALL' ? 'Tất cả khối' : `K${g}`}
                  </button>
                ))}
              </div>

              {/* Session Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setClassFilterSession('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    classFilterSession === 'ALL' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ca
                </button>
                <button
                  onClick={() => setClassFilterSession('MORNING')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    classFilterSession === 'MORNING' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sáng
                </button>
                <button
                  onClick={() => setClassFilterSession('AFTERNOON')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    classFilterSession === 'AFTERNOON' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chiều
                </button>
                <button
                  onClick={() => setClassFilterSession('FULL_DAY')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    classFilterSession === 'FULL_DAY' || classFilterSession === 'TWO_SESSIONS_PER_DAY'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2 buổi/ngày
                </button>
              </div>

              {/* View Switch */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setClassViewMode('GRID')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    classViewMode === 'GRID' ? 'bg-white shadow-xs text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Chế độ thẻ ô lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setClassViewMode('TABLE')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    classViewMode === 'TABLE' ? 'bg-white shadow-xs text-blue-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Chế độ danh sách bảng"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedClassIds.length > 0 && canEdit && (
                <button
                  onClick={() => setIsBulkDeleteClassModalOpen(true)}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition animate-in fade-in cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedClassIds.length}) lớp đã chọn</span>
                </button>
              )}

              {canEdit && (
                <div className="flex items-center gap-2">
                  {classes.length === 0 && (
                    <button
                      type="button"
                      onClick={handleGenerateSampleClasses}
                      className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                      title="Tạo nhanh 8 lớp mẫu (6A1, 6A2, 7A1, 7A2, 8A1, 8A2, 9A1, 9A2)"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>Tạo 8 lớp mẫu</span>
                    </button>
                  )}
                  <button
                    id="add-class-btn"
                    onClick={handleOpenAddClassModal}
                    className="flex items-center gap-1.5 bg-blue-900 hover:bg-blue-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm lớp</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CLASSES GRID VIEW */}
          {classViewMode === 'GRID' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredClasses.length === 0 ? (
                <div className="col-span-full py-10 px-6 text-center bg-white rounded-3xl border-2 border-dashed border-blue-200 shadow-sm space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center shadow-inner">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      {classes.length === 0 ? 'Trường chưa có lớp học nào' : 'Không tìm thấy lớp học nào phù hợp'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      {classes.length === 0
                        ? 'Hãy thêm lớp học mới hoặc bấm khởi tạo nhanh danh mục 8 lớp học mẫu chuẩn (Khối 6, 7, 8, 9) để bắt đầu phân công ngay.'
                        : 'Vui lòng thay đổi từ khóa hoặc bộ lọc tìm kiếm.'}
                    </p>
                  </div>
                  {canEdit && classes.length === 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleOpenAddClassModal}
                        className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm lớp học đầu tiên</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateSampleClasses}
                        className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>Khởi tạo 8 lớp mẫu (6A1, 6A2, 7A1, 7A2, 8A1, 8A2, 9A1, 9A2)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredClasses.map((cls) => {
                  const homeroomTeacher = cls.homeroomTeacherId ? teacherMap.get(cls.homeroomTeacherId) : null;
                  const isSelected = selectedClassIds.includes(cls.id);
                  return (
                    <div
                      key={cls.id}
                      className={`bg-white p-4 rounded-2xl border transition space-y-3 relative group shadow-2xs hover:shadow-md ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectClass(cls.id)}
                              className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          )}
                          <span className="text-[11px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                            Khối {cls.grade}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            cls.session === 'MORNING'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : cls.session === 'AFTERNOON'
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {cls.session === 'MORNING' ? (
                            <Sun className="w-3 h-3 text-amber-600" />
                          ) : cls.session === 'AFTERNOON' ? (
                            <Moon className="w-3 h-3 text-indigo-600" />
                          ) : (
                            <SunMoon className="w-3 h-3 text-emerald-600" />
                          )}
                          {cls.session === 'MORNING' ? 'Sáng (B1)' : cls.session === 'AFTERNOON' ? 'Chiều (B2)' : '2 buổi/ngày'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-black text-slate-900">{cls.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Sĩ số: {cls.studentCount} học sinh</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {homeroomTeacher ? homeroomTeacher.fullName.charAt(0) : '?'}
                        </div>
                        <div className="flex-1 truncate">
                          <span className="text-[10px] text-slate-400 block leading-tight">GVCN:</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {homeroomTeacher ? homeroomTeacher.fullName : 'Chưa phân công'}
                          </span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditClassModal(cls)}
                            className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Chỉnh sửa lớp học"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePromptDeleteClass(cls)}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Xóa lớp học"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* CLASSES TABLE VIEW */}
          {classViewMode === 'TABLE' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {canEdit && filteredClasses.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedClassIds.length === filteredClasses.length && filteredClasses.length > 0}
                      onChange={handleToggleSelectAllClasses}
                      className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  )}
                  <span className="text-xs font-bold text-slate-700">
                    Danh sách chi tiết các lớp học ({filteredClasses.length} lớp)
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      {canEdit && <th className="py-3 px-3 text-center w-10"></th>}
                      <th className="py-3 px-3 text-center w-12">STT</th>
                      <th className="py-3 px-4">Tên lớp</th>
                      <th className="py-3 px-3 text-center">Khối</th>
                      <th className="py-3 px-3 text-center">Buổi học</th>
                      <th className="py-3 px-3 text-center">Sĩ số</th>
                      <th className="py-3 px-4">Giáo viên chủ nhiệm</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClasses.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 8 : 7} className="py-12 px-6 text-center">
                          <div className="max-w-md mx-auto space-y-3">
                            <GraduationCap className="w-10 h-10 text-blue-300 mx-auto" />
                            <p className="font-bold text-slate-800 text-xs">
                              {classes.length === 0 ? 'Trường chưa có lớp học nào trong danh sách' : 'Không tìm thấy lớp học nào phù hợp với bộ lọc'}
                            </p>
                            {canEdit && classes.length === 0 && (
                              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleOpenAddClassModal}
                                  className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Thêm lớp mới</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleGenerateSampleClasses}
                                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Khởi tạo 8 lớp mẫu</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredClasses.map((cls, idx) => {
                        const homeroomTeacher = cls.homeroomTeacherId ? teacherMap.get(cls.homeroomTeacherId) : null;
                        const isSelected = selectedClassIds.includes(cls.id);
                        return (
                          <tr key={cls.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/70' : ''}`}>
                            {canEdit && (
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectClass(cls.id)}
                                  className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3 px-4 font-black text-slate-900 text-sm">{cls.name}</td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-[11px]">
                                Khối {cls.grade}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  cls.session === 'MORNING'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : cls.session === 'AFTERNOON'
                                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {cls.session === 'MORNING' ? 'Sáng (B1)' : cls.session === 'AFTERNOON' ? 'Chiều (B2)' : '2 buổi/ngày'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-800">{cls.studentCount} HS</td>
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-800">
                                {homeroomTeacher ? homeroomTeacher.fullName : <span className="text-slate-400">Chưa phân công</span>}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {canEdit && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditClassModal(cls)}
                                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3" /> Sửa
                                  </button>
                                  <button
                                    onClick={() => handlePromptDeleteClass(cls)}
                                    className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                    title="Xóa lớp học"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CHỈNH SỬA TÊN MÔN HỌC / THÊM MÔN HỌC MỚI */}
      {/* ========================================================================= */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900">
                  {editingSubject ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingSubject ? 'Chỉnh sửa tên & thông tin môn học' : 'Thêm môn học mới vào hệ thống'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingSubject
                      ? 'Cập nhật tên đầy đủ, tên viết tắt, mã môn và các đặc thù giảng dạy'
                      : 'Khai báo môn học mới để đưa vào phân phối số tiết và phân công chuyên môn'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
              {/* TÊN ĐẦY ĐỦ MÔN HỌC (QUAN TRỌNG NHẤT) */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Tên đầy đủ môn học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subFormName}
                  onChange={(e) => {
                    setSubFormName(e.target.value);
                    if (!editingSubject && !subFormShortName) {
                      setSubFormShortName(e.target.value.length > 8 ? e.target.value.substring(0, 8) : e.target.value);
                    }
                  }}
                  placeholder="VD: Toán học, Ngữ văn, Tiếng Anh, Kỹ năng sống..."
                  className="w-full bg-blue-50/50 border border-blue-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Tên chính thức hiển thị trên thời khóa biểu, bảng phân công và các biểu mẫu báo cáo.
                </p>
              </div>

              {/* MÃ MÔN & TÊN VIẾT TẮT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mã môn học <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subFormCode}
                    onChange={(e) => setSubFormCode(e.target.value.toUpperCase())}
                    placeholder="VD: TOAN, VAN, PHAP, KNS"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <span className="text-[10px] text-slate-400">Viết hoa, không dấu (dùng liên kết dữ liệu)</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên viết tắt <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subFormShortName}
                    onChange={(e) => setSubFormShortName(e.target.value)}
                    placeholder="VD: Toán, Văn, Anh, KNS"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                  <span className="text-[10px] text-slate-400">Hiển thị trong ô bảng lưới thu nhỏ</span>
                </div>
              </div>

              {/* NHÓM MÔN & TỔ BỘ MÔN */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nhóm môn học</label>
                  <select
                    value={subFormGroup}
                    onChange={(e) => setSubFormGroup(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Tự nhiên">Tự nhiên</option>
                    <option value="Xã hội">Xã hội</option>
                    <option value="Ngoại ngữ">Ngoại ngữ</option>
                    <option value="Thể chất">Thể chất</option>
                    <option value="Nghệ thuật">Nghệ thuật</option>
                    <option value="Trải nghiệm">Trải nghiệm</option>
                    <option value="Đặc thù">Đặc thù</option>
                    <option value="Tự chọn">Tự chọn</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tổ chuyên môn phụ trách</label>
                  <select
                    value={subFormDeptId}
                    onChange={(e) => setSubFormDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {deptList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ĐẶC THÙ TÍCH HỢP */}
              <label className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-blue-50/40 transition">
                <input
                  type="checkbox"
                  checked={subFormIsIntegrated}
                  onChange={(e) => setSubFormIsIntegrated(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div>
                  <span className="font-bold text-slate-900 block">
                    Môn học tích hợp (cho phép nhiều giáo viên cùng dạy trong 1 lớp)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Áp dụng cho Khoa học tự nhiên, Lịch sử & Địa lí, Hoạt động trải nghiệm...
                  </span>
                </div>
              </label>

              {/* KHỐI LỚP ÁP DỤNG */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Khối lớp áp dụng:</label>
                <div className="flex items-center gap-4">
                  {[6, 7, 8, 9].map((grade) => (
                    <label key={grade} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subFormGrades.includes(grade)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSubFormGrades([...subFormGrades, grade].sort());
                          } else {
                            if (subFormGrades.length <= 1) {
                              showToast('Môn học phải áp dụng cho ít nhất một khối lớp!', 'error');
                              return;
                            }
                            setSubFormGrades(subFormGrades.filter((g) => g !== grade));
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-bold text-slate-800">Khối {grade}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* KHỞI TẠO KHUNG TIẾT KHI THÊM MỚI */}
              {!editingSubject && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subFormAutoInitCurriculum}
                      onChange={(e) => setSubFormAutoInitCurriculum(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-900 text-xs">
                      Tự động tạo khung phân phối số tiết ({semesterId}) cho các khối đã chọn
                    </span>
                  </label>

                  {subFormAutoInitCurriculum && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Tiết K6/tuần:</span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={subFormPeriodsK6}
                          onChange={(e) => setSubFormPeriodsK6(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Tiết K7/tuần:</span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={subFormPeriodsK7}
                          onChange={(e) => setSubFormPeriodsK7(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Tiết K8/tuần:</span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={subFormPeriodsK8}
                          onChange={(e) => setSubFormPeriodsK8(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Tiết K9/tuần:</span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={subFormPeriodsK9}
                          onChange={(e) => setSubFormPeriodsK9(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-center font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                {!editingSubject && (
                  <button
                    type="button"
                    onClick={(e) => handleSaveSubject(e, true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 active:scale-[0.99] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Lưu & Nhập tiếp</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white shadow-md shadow-blue-900/20 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingSubject ? 'Lưu thay đổi tên môn' : 'Thêm môn học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: XÁC NHẬN BỚT / XÓA MÔN HỌC */}
      {/* ========================================================================= */}
      {subjectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận bớt môn học</h3>
                <p className="text-xs text-slate-500">Xóa môn học khỏi danh mục nhà trường</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Bạn đang chuẩn bị xóa môn học:{' '}
                <strong className="text-slate-900 font-bold text-sm">
                  {subjectToDelete.name} ({subjectToDelete.code})
                </strong>
              </p>

              {/* Warning about usage */}
              {(() => {
                const stats = subjectStats.get(subjectToDelete.id);
                const hasUsage = (stats?.assignmentCount || 0) > 0 || (stats?.totalWeekly || 0) > 0;
                return hasUsage ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Cảnh báo dữ liệu liên kết:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                      {stats && stats.assignmentCount > 0 && (
                        <li>
                          Đang có <strong>{stats.assignmentCount} phân công giảng dạy</strong> liên quan đến môn này.
                        </li>
                      )}
                      {stats && stats.totalWeekly > 0 && (
                        <li>
                          Môn này đang có khung tiết tại các khối (Tổng: <strong>{stats.totalWeekly} tiết/tuần</strong>).
                        </li>
                      )}
                    </ul>
                    <p className="text-[11px] pt-1 text-amber-800 font-medium">
                      Việc xóa môn học sẽ tự động dọn dẹp các khung tiết và phân công liên quan để tránh xung đột dữ liệu.
                    </p>
                  </div>
                ) : (
                  <p className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500">
                    Môn học này chưa có phân công giảng dạy nào. Bạn có thể xóa an toàn mà không ảnh hưởng đến bảng phân công.
                  </p>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubject}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa môn học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2.1: XÁC NHẬN XÓA NHIỀU MÔN HỌC (BULK DELETE SUBJECTS) */}
      {/* ========================================================================= */}
      {isBulkDeleteSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa hàng loạt môn học</h3>
                <p className="text-xs text-slate-500">Xóa đồng thời {selectedSubjectIds.length} môn học đã chọn</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Bạn đang chuẩn bị bớt <strong>{selectedSubjectIds.length} môn học</strong>:
              </p>
              <div className="max-h-36 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                {selectedSubjectIds.map((id) => {
                  const s = subjectMap.get(id);
                  return (
                    <div key={id} className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800">{s?.name || id}</span>
                      <span className="font-mono text-slate-400">{s?.code}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                Lưu ý: Các phân công giảng dạy và phân bổ khung tiết của các môn này cũng sẽ được hệ thống dọn dẹp sạch sẽ.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteSubjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteSubjects}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa {selectedSubjectIds.length} môn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2.2: BỔ SUNG MÔN HỌC VÀO KHỐI (ADD SUBJECT TO GRADE) */}
      {/* ========================================================================= */}
      {isAddSubjectToGradeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  Bổ sung môn học vào Khối {selectedGrade}
                </h3>
              </div>
              <button
                onClick={() => setIsAddSubjectToGradeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmAddSubjectToGrade} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Chọn môn học cần thêm:</label>
                <select
                  value={selectedSubjectToAddToGrade}
                  onChange={(e) => setSelectedSubjectToAddToGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {uniqueSubjects.map((s) => {
                    const isAlreadyInGrade = currentGradeCurriculum.some((c) => c.subjectId === s.id && c.periodsPerWeek > 0);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code}) {isAlreadyInGrade ? '- [Đã có trong khối]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Số tiết / tuần trong Khối {selectedGrade}:
                </label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={periodsToAddToGrade}
                  onChange={(e) => setPeriodsToAddToGrade(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Học kỳ: {semesterId} ({semesterId === 'HK1' ? '18 tuần' : '17 tuần'})
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddSubjectToGradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Thêm vào khối {selectedGrade}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CLASS MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      {isClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingClass ? 'Chỉnh sửa Lớp học' : 'Thêm Lớp học mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên lớp học <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formClassName}
                  onChange={(e) => handleClassNameChange(e.target.value)}
                  placeholder="VD: 6A1, 7A2, 8A3, 9C..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Hệ thống tự động nhận diện Khối lớp (6, 7, 8, 9) và Buổi học (Sáng cho Khối 6,9 - Chiều cho Khối 7,8) từ tên lớp.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(Number(e.target.value) as 6 | 7 | 8 | 9)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[6, 7, 8, 9].map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Buổi học</label>
                  <select
                    value={formSession}
                    onChange={(e) => setFormSession(e.target.value as SchoolSession)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MORNING">Buổi Sáng (B1)</option>
                    <option value="AFTERNOON">Buổi Chiều (B2)</option>
                    <option value="FULL_DAY">2 buổi/ngày</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sĩ số học sinh</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formStudentCount}
                    onChange={(e) => setFormStudentCount(Number(e.target.value) || 35)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giáo viên chủ nhiệm (GVCN)
                  </label>
                  <SearchableTeacherSelect
                    teachers={teacherList}
                    value={formHomeroomTeacherId}
                    onChange={(id) => setFormHomeroomTeacherId(id)}
                    placeholder="-- Tìm hoặc chọn GVCN nhanh --"
                    clearLabel="-- Chưa chỉ định GVCN (Bỏ trống) --"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phân hiệu (Điểm trường giảng dạy)
                </label>
                <select
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) {b.isMain ? '★ Điểm chính' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                {!editingClass && (
                  <button
                    type="button"
                    onClick={(e) => handleSaveClass(e, true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Lưu & Nhập tiếp</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingClass ? 'Lưu thay đổi' : 'Thêm lớp học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: XÁC NHẬN XÓA LỚP HỌC (AN TOÀN CẢNH BÁO PHÂN CÔNG) */}
      {/* ========================================================================= */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Lớp học</h3>
                <p className="text-xs text-slate-500">Xóa lớp {classToDelete.name} khỏi danh sách trường</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Bạn có chắc chắn muốn xóa lớp <strong className="text-slate-900 text-sm font-black">{classToDelete.name}</strong> (Khối {classToDelete.grade})?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Cảnh báo dữ liệu:</span>
                </div>
                <p className="text-[11px]">
                  Xóa lớp này sẽ đồng thời xóa toàn bộ các phân công chuyên môn và thời khóa biểu đã gán cho lớp {classToDelete.name}.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa lớp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: XÁC NHẬN XÓA NHIỀU LỚP HỌC (BULK DELETE CLASSES) */}
      {/* ========================================================================= */}
      {isBulkDeleteClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa hàng loạt ({selectedClassIds.length}) lớp học</h3>
                <p className="text-xs text-slate-500">Xóa các lớp được chọn cùng toàn bộ phân công liên quan</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>Danh sách các lớp chuẩn bị xóa:</p>
              <div className="max-h-36 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap gap-1.5">
                {selectedClassIds.map((id) => {
                  const cls = activeClasses.find((c) => c.id === id);
                  return (
                    <span key={id} className="bg-white border border-slate-300 font-bold px-2 py-0.5 rounded text-[11px] text-slate-800">
                      {cls?.name || id}
                    </span>
                  );
                })}
              </div>
              <p className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                Thao tác này sẽ dọn dẹp tất cả phân công và dữ liệu thời khóa biểu gắn với các lớp trên.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteClassModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteClasses}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xác nhận xóa {selectedClassIds.length} lớp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
