/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Teacher Directory & Workload Quota Management View
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  Search,
  CheckCircle2,
  AlertTriangle,
  Award,
  Phone,
  Mail,
  Calendar,
  Layers,
  BookOpen,
  Filter,
  X,
  Info,
  Maximize,
  Minimize,
  Eye,
  Edit3,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Check,
  TableProperties,
  RotateCcw,
  Copy,
  PlusCircle,
  Building2,
  Tag,
  Settings,
  Sparkles,
  Sliders,
  GraduationCap,
  Columns,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowLeftRight,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Save,
} from 'lucide-react';
import {
  Teacher,
  Department,
  SpecialDuty,
  Subject,
  TeacherCalculationResult,
  TeacherStatus,
  WorkplaceCategory,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { toastService } from '../services/toastService';
import { BulkTeacherQuotaModal } from './BulkTeacherQuotaModal';
import { normalizePositionName, getTeacherPositions } from '../utils/teacherPositions';
import { matchesQuery } from '../utils/searchUtils';
import { TeacherExcelImportModal } from './TeacherExcelImportModal';
import { exportTeacherMasterProfileTemplate, exportTeacherMasterListExcel } from '../import-export/excelService';

interface TeacherManagementViewProps {
  teachers: Teacher[];
  departments: Department[];
  duties: SpecialDuty[];
  subjects: Subject[];
  calculations: TeacherCalculationResult[];
  onSelectTeacherForAssignment?: (teacherId: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  initialSearchTerm?: string;
  searchFilterToken?: number;
}

const formatBirthDate = (bDate?: string): string | null => {
  if (!bDate) return null;
  const trimmed = bDate.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '0' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined'
  ) {
    return null;
  }

  // Format YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
  }

  // Format DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  // Only 4-digit year
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle Javascript GMT Date strings or ISO strings (e.g. "Tue Oct 21 1975 07:00:00 GMT+0700 (Indochina Time)")
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      if (year >= 1920 && year <= 2050) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${year}`;
      }
    }
  }

  return null;
};

export type TeacherColumnKey =
  | 'stt'
  | 'code'
  | 'fullName'
  | 'timetableName'
  | 'email'
  | 'birthDate'
  | 'startYear'
  | 'initialDegree'
  | 'higherDegree'
  | 'department'
  | 'workplace'
  | 'subjects'
  | 'bdHsgInfo'
  | 'quota'
  | 'receivedPeriods'
  | 'progress'
  | 'actions';

export interface ColumnDefinition {
  id: TeacherColumnKey;
  label: string;
}

const TEACHER_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { id: 'stt', label: 'STT' },
  { id: 'code', label: 'Mã giáo viên' },
  { id: 'fullName', label: 'Họ và tên giáo viên' },
  { id: 'timetableName', label: 'Tên TKB (Thời khóa biểu)' },
  { id: 'email', label: 'Email giáo viên' },
  { id: 'birthDate', label: 'Ngày sinh' },
  { id: 'startYear', label: 'Năm vào ngành' },
  { id: 'initialDegree', label: 'Trình độ CM ban đầu' },
  { id: 'higherDegree', label: 'Trình độ CM nâng cao' },
  { id: 'department', label: 'Tổ chuyên môn' },
  { id: 'workplace', label: 'Nơi làm việc' },
  { id: 'subjects', label: 'Môn giảng dạy' },
  { id: 'bdHsgInfo', label: 'Bồi dưỡng HSG (BD HSG)' },
  { id: 'quota', label: 'Định mức tiết' },
  { id: 'receivedPeriods', label: 'Tiết thực nhận' },
  { id: 'progress', label: 'Tiến độ' },
  { id: 'actions', label: 'Thao tác' },
];

const DEFAULT_COLUMN_VISIBILITY: Record<TeacherColumnKey, boolean> = {
  stt: true,
  code: true,
  fullName: true,
  timetableName: true,
  email: true,
  birthDate: true,
  startYear: true,
  initialDegree: true,
  higherDegree: true,
  department: true,
  workplace: true,
  subjects: true,
  bdHsgInfo: true,
  quota: true,
  receivedPeriods: true,
  progress: true,
  actions: true,
};

export const TeacherManagementView: React.FC<TeacherManagementViewProps> = ({
  teachers,
  departments,
  duties,
  subjects,
  calculations,
  onSelectTeacherForAssignment,
  isFullscreen = false,
  onToggleFullscreen,
  initialSearchTerm,
  searchFilterToken,
}) => {
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>(() => {
    try {
      return (localStorage.getItem('teacher_view_mode') as 'GRID' | 'LIST') || 'LIST';
    } catch {
      return 'LIST';
    }
  });

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return subjects.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [subjects]);

  // Column visibility state with persistence
  const [visibleColumns, setVisibleColumns] = useState<Record<TeacherColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('teacher_table_columns_visible');
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    };
    if (isColumnDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColumnDropdownOpen]);

  const toggleColumn = (colId: TeacherColumnKey) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem('teacher_table_columns_visible', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const showAllColumns = () => {
    setVisibleColumns(DEFAULT_COLUMN_VISIBILITY);
    try {
      localStorage.setItem('teacher_table_columns_visible', JSON.stringify(DEFAULT_COLUMN_VISIBILITY));
    } catch {}
  };
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');

  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm, searchFilterToken]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedWorkplace, setSelectedWorkplace] = useState('ALL');
  const [selectedTeacherModal, setSelectedTeacherModal] = useState<Teacher | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [showUnsavedEditPrompt, setShowUnsavedEditPrompt] = useState(false);

  const handleRequestCloseEditModal = () => {
    if (isFormDirty) {
      setShowUnsavedEditPrompt(true);
    } else {
      setIsEditModalOpen(false);
    }
  };
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [showTrashBin, setShowTrashBin] = useState(false);
  const [isBulkQuotaModalOpen, setIsBulkQuotaModalOpen] = useState(false);
  const [isBulkClearDutiesModalOpen, setIsBulkClearDutiesModalOpen] = useState(false);

  const handleConfirmBulkClearDuties = () => {
    const idsToClear = selectedTeacherIds.length > 0 ? selectedTeacherIds : teachers.filter((t) => !t.isDeleted).map((t) => t.id);
    if (idsToClear.length === 0) return;
    const count = dataStore.bulkClearDutiesForTeachers(idsToClear);
    showToast(`Đã xóa sạch phân công kiêm nhiệm của ${idsToClear.length} giáo viên (${count} mục phân công)!`);
    setIsBulkClearDutiesModalOpen(false);
    setSelectedTeacherIds([]);
  };
  const [isWorkplaceModalOpen, setIsWorkplaceModalOpen] = useState(false);
  const [editingWp, setEditingWp] = useState<WorkplaceCategory | null>(null);
  const [wpName, setWpName] = useState('');
  const [wpCode, setWpCode] = useState('');
  const [wpDescription, setWpDescription] = useState('');
  const [wpIsDefault, setWpIsDefault] = useState(false);
  const [wpToDelete, setWpToDelete] = useState<WorkplaceCategory | null>(null);
  const [wpReassignToId, setWpReassignToId] = useState('');

  // Deletion modals & toast
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [deleteMode, setDeleteMode] = useState<'SOFT' | 'PERMANENT'>('SOFT');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'SOFT' | 'PERMANENT'>('SOFT');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, _type?: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSetViewMode = (mode: 'GRID' | 'LIST') => {
    setViewMode(mode);
    try {
      localStorage.setItem('teacher_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const currentUser = dataStore.getCurrentUser();
  const isTenantSchool = dataStore.getSchoolId() !== 'school_quyhop' || Boolean(dataStore.detectUrlSchoolId() && dataStore.detectUrlSchoolId() !== 'school_quyhop');
  const canEdit = currentUser.permission === 'edit' || currentUser.role === 'admin' || currentUser.role === 'principal' || isTenantSchool;

  const workplaces = dataStore.getWorkplaces();

  // Form states
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formTimetableName, setFormTimetableName] = useState('');
  const [formGender, setFormGender] = useState<'Nam' | 'Nữ'>('Nữ');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formStartYear, setFormStartYear] = useState('');
  const [formInitialDegree, setFormInitialDegree] = useState('');
  const [formHigherDegree, setFormHigherDegree] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formWorkplaceId, setFormWorkplaceId] = useState('');
  const [formStatus, setFormStatus] = useState<TeacherStatus>('ACTIVE');
  const [formQuota, setFormQuota] = useState(19);
  const [formMajor, setFormMajor] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBdHsgInfo, setFormBdHsgInfo] = useState('');
  const [formOffDay, setFormOffDay] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPositions, setFormPositions] = useState<string[]>([]);
  const [formSubjects, setFormSubjects] = useState<string[]>([]);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const calcMap = useMemo(() => new Map(calculations.map((c) => [c.teacherId, c])), [calculations]);

  const deletedTeachersCount = useMemo(() => teachers.filter((t) => t.isDeleted).length, [teachers]);

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      if (showTrashBin) {
        if (!t.isDeleted) return false;
      } else {
        if (t.isDeleted) return false;
      }

      if (searchTerm.trim()) {
        const matches = matchesQuery(
          searchTerm,
          t.fullName,
          t.code,
          t.major,
          t.phone,
          ...(t.subjectsCanTeach || [])
        );
        if (!matches) return false;
      }

      // 1. Lọc theo Điểm trường / Nơi làm việc (Toàn trường, Điểm chính, Phân hiệu...)
      if (selectedWorkplace !== 'ALL') {
        const targetWp = workplaces.find((w) => w.id === selectedWorkplace);
        const targetName = (targetWp?.name || '').trim().toLowerCase();
        if (targetName === 'toàn trường' || selectedWorkplace === 'wp_all') {
          // Toàn trường hiển thị tất cả
        } else {
          const teacherWpId = t.workplaceId;
          const teacherWpName = (t.workplace || '').trim().toLowerCase();
          const matchesId = teacherWpId === selectedWorkplace;
          const matchesName = teacherWpName === targetName;
          const partialMatch = targetName ? teacherWpName.includes(targetName) : false;
          if (!matchesId && !matchesName && !partialMatch) return false;
        }
      }

      // 2. Tiếp sau đó lọc theo Tổ chuyên môn (Tất cả hoặc theo từng tổ)
      if (selectedDept !== 'ALL' && t.departmentId !== selectedDept) return false;

      // 3. Lọc theo Trạng thái
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      return true;
    });
  }, [teachers, searchTerm, selectedDept, selectedStatus, selectedWorkplace, showTrashBin, workplaces]);

  // Tự động làm sạch bộ lọc Tổ chuyên môn nếu tổ đang chọn bị xóa khỏi hệ thống
  useEffect(() => {
    if (selectedDept !== 'ALL' && !departments.some((d) => d.id === selectedDept)) {
      setSelectedDept('ALL');
    }
  }, [departments, selectedDept]);

  // =========================================================================
  // BỘ ĐIỀU KHIỂN & THANH CUỘN NGANG ĐỒNG BỘ CHO DANH SÁCH RỘNG
  // =========================================================================
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScrollRef = useRef(false);

  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    maxScroll: 0,
    canScrollLeft: false,
    canScrollRight: false,
    tableWidth: 0,
    containerWidth: 0,
  });

  const [tableFitScreen, setTableFitScreen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('teacher_table_fit_screen') !== 'false';
    } catch {
      return true;
    }
  });

  const updateScrollState = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const scrollLeft = Math.round(el.scrollLeft);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setScrollState({
      scrollLeft,
      maxScroll,
      canScrollLeft: scrollLeft > 2,
      canScrollRight: scrollLeft < maxScroll - 2,
      tableWidth: el.scrollWidth,
      containerWidth: el.clientWidth,
    });
  }, []);

  const handleTableScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    const el = tableContainerRef.current;
    if (!el) return;
    if (topScrollRef.current) {
      isSyncingScrollRef.current = true;
      topScrollRef.current.scrollLeft = el.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
    updateScrollState();
  }, [updateScrollState]);

  const handleTopScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    const topEl = topScrollRef.current;
    if (!topEl) return;
    if (tableContainerRef.current) {
      isSyncingScrollRef.current = true;
      tableContainerRef.current.scrollLeft = topEl.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updateScrollState, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updateScrollState, viewMode, visibleColumns, filteredTeachers.length]);

  const scrollByAmount = useCallback((delta: number) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }, []);

  const scrollToStart = useCallback(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, []);

  const scrollToEnd = useCallback(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ left: tableContainerRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, []);

  const scrollToQuotas = useCallback(() => {
    if (tableContainerRef.current) {
      const target = (tableContainerRef.current.scrollWidth - tableContainerRef.current.clientWidth) * 0.72;
      tableContainerRef.current.scrollTo({ left: target, behavior: 'smooth' });
    }
  }, []);

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setFormCode(`GV0${teachers.length + 1}`);
    setFormName('');
    setFormGender('Nữ');
    setFormBirthDate('');
    setFormStartYear('');
    setFormInitialDegree('Đại học Sư phạm');
    const deptList = departments.length > 0 ? departments : dataStore.getDepartments();
    const validDeptId = deptList.find((d) => d.id === selectedDept)?.id || deptList[0]?.id || '';
    setFormDeptId(validDeptId);
    const wpList = workplaces.length > 0 ? workplaces : dataStore.getWorkplaces();
    const defaultWp = wpList.find((w) => w.isDefault) || wpList[0];
    setFormWorkplaceId(defaultWp?.id || 'wp_main');
    setFormStatus('ACTIVE');
    setFormQuota(19);
    setFormMajor('Sư phạm');
    setFormPhone('');
    setFormEmail('');
    setFormBdHsgInfo('');
    setFormOffDay('');
    setFormNotes('');
    setFormTimetableName('');
    setFormPositions([]);
    setFormSubjects([]);
    setIsFormDirty(false);
    setShowUnsavedEditPrompt(false);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setFormCode(t.code);
    setFormName(t.fullName);
    setFormTimetableName(t.timetableName || t.shortName || (t.fullName ? t.fullName.trim().split(/\s+/).slice(-1)[0] : ''));
    setFormGender(t.gender || 'Nữ');
    setFormBirthDate(t.birthDate || '');
    setFormStartYear(t.startYear ? String(t.startYear) : '');
    setFormInitialDegree(t.initialDegree || '');
    setFormHigherDegree(t.higherDegree || '');
    const validDept = departments.find((d) => d.id === t.departmentId);
    setFormDeptId(validDept ? validDept.id : (departments[0]?.id || ''));
    const matchedWp =
      workplaces.find((w) => w.id === t.workplaceId) ||
      workplaces.find((w) => w.name === t.workplace) ||
      workplaces.find((w) => w.isDefault) ||
      workplaces[0];
    setFormStatus(t.status);
    let defaultQuotaForT = 19;
    if (t.status === 'PRINCIPAL') defaultQuotaForT = 2;
    else if (t.status === 'VICE_PRINCIPAL') defaultQuotaForT = 4;
    const initialQuota =
      t.standardQuota !== undefined &&
      t.standardQuota !== null &&
      !(t.standardQuota === 19 && (t.status === 'PRINCIPAL' || t.status === 'VICE_PRINCIPAL'))
        ? t.standardQuota
        : defaultQuotaForT;
    setFormQuota(initialQuota);
    setFormMajor(t.major || '');
    setFormPhone(t.phone || '');
    setFormEmail(t.email || '');
    setFormBdHsgInfo(t.bdHsgInfo || '');
    setFormOffDay(t.offDay || '');
    setFormNotes(t.notes || '');
    const curPos = getTeacherPositions(t, departments, duties, dataStore.getAssignments(), dataStore.getClasses());
    setFormPositions(Array.from(new Set([...(t.positions || []), ...curPos])));
    setFormSubjects(Array.from(new Set((t.subjectsCanTeach || []).map((s) => s.trim()).filter(Boolean))));
    setIsFormDirty(false);
    setShowUnsavedEditPrompt(false);
    setIsEditModalOpen(true);
  };

  const handleDuplicateTeacher = (t: Teacher) => {
    setEditingTeacher(null);
    let nextNum = teachers.length + 1;
    while (teachers.some((x) => x.code === `GV${nextNum.toString().padStart(2, '0')}`)) {
      nextNum++;
    }
    setFormCode(`GV${nextNum.toString().padStart(2, '0')}`);
    setFormName(`${t.fullName} (Bản sao)`);
    setFormTimetableName(t.timetableName ? `${t.timetableName}_Copy` : '');
    setFormGender(t.gender || 'Nữ');
    setFormBirthDate(t.birthDate || '');
    setFormStartYear(t.startYear ? String(t.startYear) : '');
    setFormInitialDegree(t.initialDegree || '');
    setFormHigherDegree(t.higherDegree || '');
    const validDept = departments.find((d) => d.id === t.departmentId);
    setFormDeptId(validDept ? validDept.id : (departments[0]?.id || ''));
    const matchedWp =
      workplaces.find((w) => w.id === t.workplaceId) ||
      workplaces.find((w) => w.name === t.workplace) ||
      workplaces.find((w) => w.isDefault) ||
      workplaces[0];
    setFormWorkplaceId(matchedWp?.id || '');
    setFormStatus(t.status);
    setFormQuota(t.standardQuota || 19);
    setFormMajor(t.major || '');
    setFormPhone(t.phone || '');
    setFormEmail('');
    setFormBdHsgInfo(t.bdHsgInfo || '');
    setFormOffDay(t.offDay || '');
    setFormNotes(t.notes || '');
    setFormPositions(t.positions || []);
    setFormSubjects(Array.from(new Set((t.subjectsCanTeach || []).map((s) => s.trim()).filter(Boolean))));
    setIsFormDirty(true);
    setShowUnsavedEditPrompt(false);
    setIsEditModalOpen(true);
    showToast(`Đã tạo bản sao từ giáo viên "${t.fullName}". Bạn có thể tinh chỉnh và lưu lại!`);
  };

  const handleSaveTeacher = (e: React.FormEvent, continueAdding = false) => {
    e.preventDefault();
    if (!formName.trim() || !formCode.trim()) {
      showToast('Vui lòng nhập đầy đủ Họ và tên cùng Mã giáo viên!', 'error');
      return;
    }

    const chosenWp = workplaces.find((w) => w.id === formWorkplaceId) || workplaces[0];
    const parsedStartYear = formStartYear ? parseInt(formStartYear, 10) : undefined;
    const cleanStartYear = !parsedStartYear || isNaN(parsedStartYear) ? undefined : parsedStartYear;

    // Kiểm tra và lấy departmentId hợp lệ (phòng trường hợp tổ đã bị xóa hoặc chưa nạp)
    const deptList = departments.length > 0 ? departments : dataStore.getDepartments();
    const chosenDept = deptList.find((d) => d.id === formDeptId) || deptList[0];
    const validDeptId = chosenDept?.id || '';

    // Loại bỏ trùng lặp môn học
    const cleanSubjects: string[] = Array.from(
      new Set(formSubjects.map((s) => s.trim()).filter((s): s is string => Boolean(s)))
    );

    if (editingTeacher) {
      const oldQuota = editingTeacher.standardQuota ?? 19;
      // Lấy chính xác danh sách chức vụ theo lựa chọn trong Form do người dùng xác nhận
      const cleanPositions: string[] = Array.from(
        new Set(formPositions.map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p)))
      );

      dataStore.updateTeacher(editingTeacher.id, {
        code: formCode.trim(),
        fullName: formName.trim(),
        timetableName: formTimetableName.trim(),
        gender: formGender,
        birthDate: formBirthDate.trim() || undefined,
        startYear: cleanStartYear,
        initialDegree: formInitialDegree.trim() || undefined,
        higherDegree: formHigherDegree.trim() || undefined,
        departmentId: validDeptId,
        workplaceId: chosenWp?.id,
        workplace: chosenWp?.name,
        status: formStatus,
        standardQuota: formQuota,
        major: formMajor.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        bdHsgInfo: formBdHsgInfo.trim() || undefined,
        offDay: formOffDay.trim() || undefined,
        notes: formNotes.trim() || undefined,
        subjectsCanTeach: cleanSubjects,
        positions: cleanPositions,
      });

      // Đồng bộ chức vụ và quyền hạn của giáo viên để không còn tồn tại dữ liệu trùng lặp hoặc thừa
      dataStore.syncTeacherPositions(editingTeacher.id, cleanPositions, validDeptId);

      if (formQuota !== oldQuota) {
        toastService.notifyQuotaChange(formName.trim(), oldQuota, formQuota);
      } else {
        toastService.notify({
          category: 'quota',
          type: 'success',
          title: 'Cập nhật hồ sơ giáo viên',
          teacherName: formName.trim(),
          message: `${formName.trim()}: sửa thông tin hồ sơ giáo viên thành công`,
        });
      }

      setIsFormDirty(false);
      setShowUnsavedEditPrompt(false);
      showToast(`Đã cập nhật hồ sơ giáo viên "${formName.trim()}"`);
      setIsEditModalOpen(false);
    } else {
      try {
        const created = dataStore.addTeacher({
          code: formCode.trim(),
          fullName: formName.trim(),
          timetableName: formTimetableName.trim(),
          gender: formGender,
          birthDate: formBirthDate.trim() || undefined,
          startYear: cleanStartYear,
          initialDegree: formInitialDegree.trim() || undefined,
          higherDegree: formHigherDegree.trim() || undefined,
          departmentId: validDeptId,
          workplaceId: chosenWp?.id,
          workplace: chosenWp?.name,
          status: formStatus,
          standardQuota: formQuota,
          major: formMajor.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          bdHsgInfo: formBdHsgInfo.trim() || undefined,
          offDay: formOffDay.trim() || undefined,
          notes: formNotes.trim() || undefined,
          subjectsCanTeach: cleanSubjects,
          positions: formPositions,
        });

        if (created) {
          dataStore.syncTeacherPositions(created.id, formPositions, validDeptId);
        }

        toastService.notify({
          category: 'assignment_add',
          type: 'success',
          title: 'Thêm hồ sơ giáo viên mới',
          teacherName: formName.trim(),
          message: `${formName.trim()}: thêm hồ sơ giáo viên mới (Định mức: ${formQuota} tiết/tuần)`,
        });

        if (continueAdding) {
          showToast(`Đã thêm mới giáo viên "${formName.trim()}"! Tiếp tục nhập giáo viên tiếp theo...`);
          setFormName('');
          setFormBirthDate('');
          setFormStartYear('');
          setFormInitialDegree('Đại học Sư phạm');
          setFormHigherDegree('');
          setFormPhone('');
          setFormEmail('');
          setFormBdHsgInfo('');
          setFormOffDay('');
          setFormNotes('');
          setFormPositions([]);
          setFormMajor('');
          setFormSubjects([]);
          const nextNum = teachers.length + 2;
          setFormCode(`GV_${String(nextNum).padStart(3, '0')}`);
        } else {
          setIsFormDirty(false);
          setShowUnsavedEditPrompt(false);
          showToast(`Đã thêm mới giáo viên "${formName.trim()}"`);
          setIsEditModalOpen(false);
        }
      } catch (err: any) {
        showToast(err?.message || 'Không thể thêm hồ sơ giáo viên. Vui lòng kiểm tra lại.');
      }
    }
  };

  // Workplace category CRUD handlers
  const handleSaveWorkplaceCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpName.trim()) {
      showToast('Vui lòng nhập tên nơi làm việc!');
      return;
    }
    const code = wpCode.trim() || wpName.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 10);

    if (editingWp) {
      dataStore.updateWorkplace(editingWp.id, {
        name: wpName.trim(),
        code,
        description: wpDescription.trim(),
        isDefault: wpIsDefault,
      });
      showToast(`Đã cập nhật danh mục nơi làm việc "${wpName.trim()}"`);
    } else {
      dataStore.addWorkplace({
        name: wpName.trim(),
        code,
        description: wpDescription.trim(),
        isDefault: wpIsDefault,
        active: true,
      });
      showToast(`Đã thêm mới danh mục nơi làm việc "${wpName.trim()}"`);
    }

    setEditingWp(null);
    setWpName('');
    setWpCode('');
    setWpDescription('');
    setWpIsDefault(false);
  };

  const handleStartEditWp = (w: WorkplaceCategory) => {
    setEditingWp(w);
    setWpName(w.name);
    setWpCode(w.code);
    setWpDescription(w.description || '');
    setWpIsDefault(!!w.isDefault);
  };

  const handleCancelEditWp = () => {
    setEditingWp(null);
    setWpName('');
    setWpCode('');
    setWpDescription('');
    setWpIsDefault(false);
  };

  const handleRestoreDefaultWorkplaces = () => {
    dataStore.restoreDefaultWorkplaces();
    showToast('Đã khôi phục 3 nơi làm việc chuẩn: Điểm chính, Phân hiệu, Toàn trường');
  };

  const handleRequestDeleteWorkplace = (w: WorkplaceCategory) => {
    setWpToDelete(w);
    const otherWps = workplaces.filter((item) => item.id !== w.id);
    setWpReassignToId(otherWps[0]?.id || '');
  };

  const handleConfirmDeleteWorkplace = () => {
    if (!wpToDelete) return;
    if (workplaces.length <= 1) {
      showToast('Không thể xóa danh mục nơi làm việc duy nhất trong hệ thống!');
      return;
    }
    const affectedCount = teachers.filter(
      (t) => t.workplaceId === wpToDelete.id || t.workplace === wpToDelete.name
    ).length;
    dataStore.deleteWorkplace(wpToDelete.id, wpReassignToId);
    showToast(
      `Đã xóa danh mục "${wpToDelete.name}". ${
        affectedCount > 0 ? `Đã chuyển ${affectedCount} giáo viên sang nơi làm việc mới.` : ''
      }`
    );
    setWpToDelete(null);
  };

  // Safe delete with custom modal
  const handleRequestDelete = (t: Teacher) => {
    setTeacherToDelete(t);
    setDeleteMode('SOFT');
  };

  const handleConfirmDeleteTeacher = () => {
    if (!teacherToDelete) return;
    const isPermanent = deleteMode === 'PERMANENT';
    const teacherName = teacherToDelete.fullName;
    const teacherId = teacherToDelete.id;

    dataStore.deleteTeacher(teacherId, isPermanent);
    if (isPermanent) {
      const allAssignments = dataStore.getAssignments(undefined, undefined, undefined, true);
      const teacherAss = allAssignments.filter((a) => a.teacherId === teacherId);
      if (teacherAss.length > 0) {
        dataStore.bulkDeleteAssignments(
          teacherAss.map((a) => a.id),
          true,
          `Xóa theo hồ sơ giáo viên ${teacherName}`
        );
      }
    }

    toastService.notify({
      category: 'assignment_delete',
      type: 'warning',
      title: isPermanent ? 'Xóa vĩnh viễn hồ sơ giáo viên' : 'Chuyển giáo viên vào lưu trữ',
      teacherName,
      message: `${teacherName}: xóa hồ sơ giáo viên khỏi hệ thống`,
    });

    showToast(
      isPermanent
        ? `Đã xóa vĩnh viễn hồ sơ giáo viên "${teacherName}"!`
        : `Đã chuyển hồ sơ giáo viên "${teacherName}" vào lưu trữ!`
    );
    setSelectedTeacherIds((prev) => prev.filter((id) => id !== teacherId));
    setTeacherToDelete(null);
  };

  const handleConfirmBulkDeleteTeachers = () => {
    if (selectedTeacherIds.length === 0) return;
    const isPermanent = bulkDeleteMode === 'PERMANENT';
    const count = selectedTeacherIds.length;

    dataStore.bulkDeleteTeachers(selectedTeacherIds, isPermanent);
    if (isPermanent) {
      const allAssignments = dataStore.getAssignments(undefined, undefined, undefined, true);
      const affected = allAssignments.filter((a) => selectedTeacherIds.includes(a.teacherId));
      if (affected.length > 0) {
        dataStore.bulkDeleteAssignments(
          affected.map((a) => a.id),
          true,
          'Xóa phân công theo danh sách giáo viên bị xóa'
        );
      }
    }

    toastService.notifyBulk(
      isPermanent ? 'Xóa vĩnh viễn hồ sơ giáo viên' : 'Chuyển giáo viên vào lưu trữ',
      `Đã ${isPermanent ? 'xóa vĩnh viễn' : 'chuyển vào lưu trữ'} ${count} hồ sơ giáo viên thành công`
    );

    showToast(
      isPermanent
        ? `Đã xóa vĩnh viễn ${count} hồ sơ giáo viên đã chọn!`
        : `Đã chuyển ${count} hồ sơ giáo viên vào lưu trữ!`
    );
    setSelectedTeacherIds([]);
    setIsBulkDeleteModalOpen(false);
  };

  const handleRestoreTeacher = (t: Teacher) => {
    dataStore.restoreTeacher(t.id);
    showToast(`Đã khôi phục thành công giáo viên "${t.fullName}"!`);
  };

  const handleConfirmRestoreBulkTeachers = () => {
    if (selectedTeacherIds.length === 0) return;
    const count = dataStore.bulkRestoreTeachers(selectedTeacherIds);
    showToast(`Đã khôi phục thành công ${count} hồ sơ giáo viên!`);
    setSelectedTeacherIds([]);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER WITH CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Hồ sơ GV và định mức
                </h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  canEdit ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                }`}>
                  {canEdit ? <Edit3 className="w-3 h-3 text-emerald-700" /> : <Eye className="w-3 h-3 text-sky-700" />}
                  {canEdit ? 'Quyền Chỉnh sửa' : 'Chỉ Xem'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tổng số {filteredTeachers.length} giáo viên thuộc {departments.length} tổ chuyên môn
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* VIEW MODE TOGGLE (Grid vs List) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleSetViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'GRID'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị dạng lưới thẻ"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lưới thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('LIST')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị dạng danh sách chi tiết"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Danh sách</span>
              </button>
            </div>

            {/* COLUMN VISIBILITY TOGGLE (For Table view) */}
            <div className="relative" ref={columnDropdownRef}>
              <button
                id="btn-toggle-columns"
                type="button"
                onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  isColumnDropdownOpen
                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                }`}
                title="Tùy chỉnh ẩn / hiện các cột trong bảng danh sách"
              >
                <Columns className="w-3.5 h-3.5 text-blue-600" />
                <span>Ẩn/hiện cột</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded-full font-bold text-slate-600">
                  {Object.values(visibleColumns).filter(Boolean).length}/{TEACHER_COLUMN_DEFINITIONS.length}
                </span>
              </button>

              {isColumnDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 px-3.5 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Columns className="w-3.5 h-3.5 text-blue-600" />
                      <span>Các cột trong bảng</span>
                    </div>
                    <button
                      type="button"
                      onClick={showAllColumns}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                    >
                      Hiện tất cả
                    </button>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {TEACHER_COLUMN_DEFINITIONS.map((col) => {
                      const isChecked = visibleColumns[col.id];
                      return (
                        <label
                          key={col.id}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition select-none text-xs"
                        >
                          <span className={isChecked ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            {col.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleColumn(col.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Đã lưu tự động</span>
                    <button
                      type="button"
                      onClick={() => setIsColumnDropdownOpen(false)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TRASH BIN TOGGLE BUTTON */}
            <button
              type="button"
              onClick={() => {
                setShowTrashBin((prev) => !prev);
                setSelectedTeacherIds([]);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                showTrashBin
                  ? 'bg-red-50 text-red-700 border-red-200 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={showTrashBin ? 'Quay lại danh sách đang hoạt động' : 'Xem hồ sơ giáo viên đã xóa trong thùng rác'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{showTrashBin ? 'Thoát thùng rác' : `Thùng rác (${deletedTeachersCount})`}</span>
            </button>

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

            {canEdit && (
              <button
                id="btn-import-teacher-excel"
                type="button"
                onClick={() => setIsExcelImportModalOpen(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Nhập toàn bộ thông tin hồ sơ giáo viên từ file Excel (Dữ liệu gốc đồng bộ toàn App)"
              >
                <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
                <span>Nhập hồ sơ Excel</span>
              </button>
            )}

            <button
              id="btn-export-teacher-excel"
              type="button"
              onClick={() => exportTeacherMasterListExcel(filteredTeachers, departments, calculations)}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm px-3 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              title="Xuất toàn bộ danh sách hồ sơ giáo viên ra Excel"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Xuất Excel</span>
            </button>

            {canEdit && (
              <button
                id="btn-manage-workplaces"
                type="button"
                onClick={() => setIsWorkplaceModalOpen(true)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Quản lý danh mục Nơi làm việc (Điểm chính, Phân hiệu, Toàn trường)"
              >
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span>Nơi làm việc ({workplaces.length})</span>
              </button>
            )}

            {canEdit && (
              <button
                id="btn-bulk-quota"
                type="button"
                onClick={() => setIsBulkQuotaModalOpen(true)}
                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Nhập, sửa định mức tiết dạy cho hàng loạt giáo viên hoặc theo điểm trường, tổ chuyên môn"
              >
                <Sliders className="w-4 h-4 text-amber-700" />
                <span>Định mức</span>
              </button>
            )}

            {canEdit && (
              <button
                id="btn-bulk-clear-duties-header"
                type="button"
                onClick={() => setIsBulkClearDutiesModalOpen(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                title="Xóa toàn bộ nhiệm vụ kiêm nhiệm của tất cả giáo viên trong trường hoặc các giáo viên được chọn"
              >
                <Briefcase className="w-4 h-4 text-indigo-700" />
                <span>Xóa kiêm nhiệm</span>
              </button>
            )}

            {canEdit && (
              <button
                id="btn-add-teacher"
                onClick={handleOpenAddModal}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm giáo viên
              </button>
            )}
          </div>
        </div>

        {/* SEARCH & FILTERS (Workplace -> Department -> Search -> Status) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          {/* 1. Điểm trường / Nơi làm việc (Toàn trường, Điểm chính, Phân hiệu...) */}
          <div>
            <select
              id="teacher-filter-workplace"
              value={selectedWorkplace}
              onChange={(e) => setSelectedWorkplace(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer font-bold"
              title="Lọc theo Điểm trường / Nơi làm việc"
            >
              <option value="ALL">Toàn trường ({teachers.filter((t) => !t.isDeleted).length} GV)</option>
              {workplaces
                .filter((w) => w.name.trim().toLowerCase() !== 'toàn trường' && w.code !== 'TT')
                .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                .map((w) => {
                  const count = teachers.filter((t) => {
                    if (t.isDeleted) return false;
                    const wName = w.name.trim().toLowerCase();
                    const tWName = (t.workplace || '').trim().toLowerCase();
                    return t.workplaceId === w.id || tWName === wName || (wName && tWName.includes(wName));
                  }).length;
                  return (
                    <option key={w.id} value={w.id}>
                      {w.name} ({count} GV)
                    </option>
                  );
                })}
            </select>
          </div>

          {/* 2. Tiếp sau đó chọn hiển thị theo Tổ chuyên môn hoặc Tất cả */}
          <div>
            <select
              id="teacher-filter-dept"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer font-semibold"
              title="Lọc theo Tổ chuyên môn"
            >
              <option value="ALL">
                Tất cả các tổ (
                {
                  teachers.filter((t) => {
                    if (t.isDeleted) return false;
                    if (selectedWorkplace === 'ALL') return true;
                    const targetWp = workplaces.find((w) => w.id === selectedWorkplace);
                    const targetName = (targetWp?.name || '').trim().toLowerCase();
                    const tWName = (t.workplace || '').trim().toLowerCase();
                    return (
                      t.workplaceId === selectedWorkplace ||
                      tWName === targetName ||
                      (targetName && tWName.includes(targetName))
                    );
                  }).length
                }{' '}
                GV)
              </option>
              {departments.map((d) => {
                const count = teachers.filter((t) => {
                  if (t.isDeleted) return false;
                  if (t.departmentId !== d.id) return false;
                  if (selectedWorkplace !== 'ALL') {
                    const targetWp = workplaces.find((w) => w.id === selectedWorkplace);
                    const targetName = (targetWp?.name || '').trim().toLowerCase();
                    const tWName = (t.workplace || '').trim().toLowerCase();
                    return (
                      t.workplaceId === selectedWorkplace ||
                      tWName === targetName ||
                      (targetName && tWName.includes(targetName))
                    );
                  }
                  return true;
                }).length;
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} ({count} GV)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Ô tìm kiếm */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo giáo viên hoặc môn..."
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

          {/* 4. Trạng thái */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang giảng dạy</option>
              <option value="MATERNITY">Nghỉ thai sản</option>
              <option value="PRINCIPAL">Hiệu trưởng (Quy định 2 tiết/tuần)</option>
              <option value="VICE_PRINCIPAL">Phó hiệu trưởng (Quy định 4 tiết/tuần)</option>
              <option value="PROBATIONARY">Tập sự (Miễn 2)</option>
              <option value="SECONDED">Biệt phái</option>
            </select>
          </div>
        </div>

        {/* BULK ACTION BAR */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
            <input
              type="checkbox"
              checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0}
              onChange={() => {
                if (selectedTeacherIds.length === filteredTeachers.length) {
                  setSelectedTeacherIds([]);
                } else {
                  setSelectedTeacherIds(filteredTeachers.map((t) => t.id));
                }
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Chọn tất cả ({selectedTeacherIds.length}/{filteredTeachers.length} GV)</span>
          </label>

          {selectedTeacherIds.length > 0 && canEdit && (
            <div className="flex items-center gap-2 animate-in fade-in flex-wrap">
              {showTrashBin ? (
                <>
                  <button
                    onClick={handleConfirmRestoreBulkTeachers}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Khôi phục ({selectedTeacherIds.length} GV)
                  </button>
                  <button
                    onClick={() => {
                      setBulkDeleteMode('PERMANENT');
                      setIsBulkDeleteModalOpen(true);
                    }}
                    className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa vĩnh viễn ({selectedTeacherIds.length} GV)
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <Building2 className="w-3.5 h-3.5 text-slate-600 ml-1.5" />
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        dataStore.batchUpdateTeacherWorkplace(selectedTeacherIds, e.target.value);
                        const targetWp = workplaces.find((w) => w.id === e.target.value);
                        showToast(`Đã chuyển ${selectedTeacherIds.length} GV sang nơi làm việc "${targetWp?.name}"`);
                        e.target.value = '';
                      }}
                      defaultValue=""
                      className="bg-white border border-slate-300 text-xs rounded-lg px-2 py-1 font-medium cursor-pointer"
                    >
                      <option value="" disabled>
                        Gán nơi làm việc ({selectedTeacherIds.length} GV)...
                      </option>
                      {workplaces
                        .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                        .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsBulkQuotaModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Nhập, sửa định mức cho các giáo viên đã chọn"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Sửa định mức ({selectedTeacherIds.length} GV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBulkClearDutiesModalOpen(true)}
                    className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Xóa toàn bộ nhiệm vụ kiêm nhiệm của các giáo viên đã chọn"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Xóa kiêm nhiệm ({selectedTeacherIds.length} GV)</span>
                  </button>

                  <button
                    onClick={() => {
                      setBulkDeleteMode('SOFT');
                      setIsBulkDeleteModalOpen(true);
                    }}
                    className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa hàng loạt ({selectedTeacherIds.length} GV)
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TRASH BIN BANNER */}
      {showTrashBin && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-200/70 rounded-xl text-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Đang hiển thị Thùng rác ({filteredTeachers.length} giáo viên đã xóa/lưu trữ).</span>
              <p className="text-[11px] text-amber-700 mt-0.5">Bạn có thể chọn giáo viên để Khôi phục trở lại hoặc Xóa vĩnh viễn khỏi hệ thống.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowTrashBin(false);
              setSelectedTeacherIds([]);
            }}
            className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-xl font-bold transition cursor-pointer text-xs flex items-center gap-1"
          >
            <span>Quay lại danh sách chính &rarr;</span>
          </button>
        </div>
      )}

      {/* VIEW MODE: GRID OR LIST */}
      {viewMode === 'GRID' ? (
        /* TEACHER CARDS GRID (Responsive) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((teacher) => {
          const dept = deptMap.get(teacher.departmentId);
          const calc = calcMap.get(teacher.id);
          const isSelected = selectedTeacherIds.includes(teacher.id);

          return (
            <div
              key={teacher.id}
              className={`bg-white rounded-2xl border transition p-4 flex flex-col justify-between ${
                isSelected ? 'border-blue-500 bg-blue-50/40 shadow-xs' : 'border-slate-200 shadow-2xs hover:shadow-md'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedTeacherIds((prev) =>
                          prev.includes(teacher.id) ? prev.filter((id) => id !== teacher.id) : [...prev, teacher.id]
                        );
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {teacher.fullName.split(' ').pop()?.charAt(0) || 'G'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{teacher.fullName}</span>
                        {dept?.headTeacherId === teacher.id && (
                          <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.2 rounded border border-blue-200">
                            Tổ trưởng chuyên môn
                          </span>
                        )}
                        {((Array.isArray(dept?.deputyTeacherIds) && dept.deputyTeacherIds.includes(teacher.id)) || dept?.deputyTeacherId === teacher.id) && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                            Tổ phó chuyên môn
                          </span>
                        )}
                      </h3>
                      <div className="text-[11px] text-slate-500">{teacher.code} • {dept?.name}</div>
                    </div>
                  </div>

                  {/* Status & Workplace Chips */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        teacher.status === 'MATERNITY'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : teacher.status === 'PRINCIPAL' || teacher.status === 'VICE_PRINCIPAL'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : teacher.status === 'PROBATIONARY'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {teacher.statusLabel || teacher.status}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border shadow-2xs ${
                        teacher.workplace === 'Phân hiệu'
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : teacher.workplace === 'Toàn trường'
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      }`}
                    >
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      <span>{teacher.workplace || 'Điểm chính'}</span>
                    </span>
                  </div>
                </div>

                {/* Workload Metric Bar */}
                {calc && (
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Tiến độ định mức:</span>
                      <span className="font-bold text-slate-900">
                        {calc.totalCalculated} / {calc.quota} tiết
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.min(100, (calc.morningPeriods / calc.quota) * 100)}%` }}
                        className="bg-blue-800 h-full"
                        title={`Sáng: ${calc.morningPeriods} tiết`}
                      />
                      <div
                        style={{ width: `${Math.min(100, (calc.afternoonPeriods / calc.quota) * 100)}%` }}
                        className="bg-sky-500 h-full"
                        title={`Chiều: ${calc.afternoonPeriods} tiết`}
                      />
                      <div
                        style={{ width: `${Math.min(100, (calc.concurrentPeriods / calc.quota) * 100)}%` }}
                        className="bg-teal-500 h-full"
                        title={`Kiêm nhiệm: ${calc.concurrentPeriods} tiết`}
                      />
                      <div
                        style={{ width: `${Math.min(100, (calc.exemptionPeriods / calc.quota) * 100)}%` }}
                        className="bg-amber-500 h-full"
                        title={`Miễn giảm: ${calc.exemptionPeriods} tiết`}
                      />
                    </div>

                    {/* Status Text */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-500">
                        Thực dạy: <strong>{calc.actualTotalAssigned}</strong> | Miễn: <strong>{calc.exemptionPeriods}</strong>
                      </span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          calc.resultStatus === 'EXACT' || calc.resultStatus === 'EXACT_EXEMPT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : calc.resultStatus === 'DEFICIT'
                            ? 'bg-red-100 text-red-800'
                            : calc.resultStatus === 'SURPLUS'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {calc.resultStatus === 'EXACT'
                          ? 'ĐỦ'
                          : calc.resultStatus === 'EXACT_EXEMPT'
                          ? 'ĐỦ (MIỄN)'
                          : calc.resultStatus === 'DEFICIT'
                          ? `THIẾU ${calc.deficitAmount}`
                          : calc.resultStatus === 'SURPLUS'
                          ? `THỪA ${calc.surplusAmount}`
                          : 'CHƯA GÁN'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Details list */}
                <div className="mt-3 text-xs space-y-1 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>Môn dạy: {teacher.subjectsCanTeach.map((id) => subjectMap.get(id)?.shortName || id).join(', ') || 'Chưa gán'}</span>
                  </div>
                  {teacher.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{teacher.phone}</span>
                    </div>
                  )}
                  {teacher.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{teacher.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => setSelectedTeacherModal(teacher)}
                  className="text-blue-700 hover:text-blue-900 font-bold"
                >
                  Xem chi tiết
                </button>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    {showTrashBin ? (
                      <>
                        <button
                          onClick={() => handleRestoreTeacher(teacher)}
                          className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title="Khôi phục hồ sơ giáo viên"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setTeacherToDelete(teacher);
                            setDeleteMode('PERMANENT');
                          }}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Xóa vĩnh viễn khỏi CSDL"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        {onSelectTeacherForAssignment && (
                          <button
                            onClick={() => onSelectTeacherForAssignment(teacher.id)}
                            className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            title="Phân công chuyên môn"
                          >
                            <TableProperties className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(teacher)}
                          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title="Chỉnh sửa hồ sơ"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateTeacher(teacher)}
                          className="p-1 rounded-lg text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                          title="Nhân bản hồ sơ giáo viên"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRequestDelete(teacher)}
                          className="p-1 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Xóa giáo viên"
                        >
                          <Trash2 className="w-4 h-4" />
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
      ) : (
        <>
          {/* TEACHER LIST VIEW (TABLE) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col relative">
          {/* TOP HORIZONTAL CONTROLLER & QUICK NAVIGATOR */}
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs select-none">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px] mr-1">
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                <span>Cuộn ngang bảng:</span>
              </span>
              <button
                type="button"
                onClick={scrollToStart}
                disabled={!scrollState.canScrollLeft}
                className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer text-[11px] shadow-2xs"
                title="Về đầu bảng (Mã, Họ và tên GV)"
              >
                |◀ Đầu
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount(-280)}
                disabled={!scrollState.canScrollLeft}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer text-[11px] shadow-2xs"
                title="Cuộn sang trái 280px"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trái</span>
              </button>
              <button
                type="button"
                onClick={() => scrollByAmount(280)}
                disabled={!scrollState.canScrollRight}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer text-[11px] shadow-2xs"
                title="Cuộn sang phải 280px"
              >
                <span>Phải</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={scrollToEnd}
                disabled={!scrollState.canScrollRight}
                className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border border-slate-200 rounded-lg font-bold text-slate-700 flex items-center gap-1 transition cursor-pointer text-[11px] shadow-2xs"
                title="Đến cuối bảng (Định mức, Thao tác)"
              >
                Cuối ▶|
              </button>
              <button
                type="button"
                onClick={scrollToQuotas}
                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer text-[11px]"
                title="Cuộn nhanh đến cột Định mức & Tiết thực nhận"
              >
                ⚡ Đến Định mức
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* TOGGLE FIT SCREEN VS FULL PAGE */}
              <button
                type="button"
                onClick={() => {
                  setTableFitScreen((prev) => {
                    const next = !prev;
                    try {
                      localStorage.setItem('teacher_table_fit_screen', String(next));
                    } catch {}
                    return next;
                  });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[11px] transition cursor-pointer ${
                  tableFitScreen
                    ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title={
                  tableFitScreen
                    ? 'Đang bật khung vừa màn hình: Thanh trượt ngang luôn ở đáy khung nhìn không bị khuất!'
                    : 'Chuyển sang khung vừa màn hình để thanh trượt ngang luôn hiển thị'
                }
              >
                <Maximize2 className="w-3 h-3 text-blue-600" />
                <span>{tableFitScreen ? 'Khung vừa màn hình (Khuyên dùng)' : 'Cuộn toàn trang'}</span>
              </button>

              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                {scrollState.maxScroll > 0
                  ? `${Math.round((scrollState.scrollLeft / scrollState.maxScroll) * 100)}%`
                  : '100%'}
              </span>
            </div>
          </div>

          {/* DEDICATED TOP HORIZONTAL SCROLL TRACK */}
          <div
            ref={topScrollRef}
            onScroll={handleTopScroll}
            className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-100/80"
            style={{ height: '14px' }}
            title="Kéo thanh trượt ngang trên đây để xem các cột bên phải"
          >
            <div style={{ width: `${scrollState.tableWidth || 1600}px`, height: '1px' }} />
          </div>

          {/* MAIN TABLE CONTAINER */}
          <div
            ref={tableContainerRef}
            onScroll={handleTableScroll}
            className={`overflow-x-auto ${
              tableFitScreen ? 'max-h-[calc(100vh-270px)] min-h-[380px] overflow-y-auto' : ''
            }`}
          >
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-20 shadow-2xs">
                <tr>
                  <th className="py-3.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0}
                      onChange={() => {
                        if (selectedTeacherIds.length === filteredTeachers.length) {
                          setSelectedTeacherIds([]);
                        } else {
                          setSelectedTeacherIds(filteredTeachers.map((t) => t.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {visibleColumns.stt && <th className="py-3.5 px-2 text-center w-12">STT</th>}
                  {visibleColumns.code && <th className="py-3.5 px-3 text-center w-20">Mã GV</th>}
                  {visibleColumns.fullName && <th className="py-3.5 px-4 font-bold min-w-[150px]">Họ và tên giáo viên</th>}
                  {visibleColumns.timetableName && <th className="py-3.5 px-3 text-center min-w-[90px] whitespace-nowrap">Tên TKB</th>}
                  {visibleColumns.email && <th className="py-3.5 px-3 min-w-[150px]">Email</th>}
                  {visibleColumns.birthDate && <th className="py-3.5 px-3 text-center min-w-[95px] whitespace-nowrap">Ngày sinh</th>}
                  {visibleColumns.startYear && <th className="py-3.5 px-3 text-center min-w-[90px] whitespace-nowrap">Năm vào ngành</th>}
                  {visibleColumns.initialDegree && <th className="py-3.5 px-3 min-w-[130px] whitespace-nowrap">Trình độ CM ban đầu</th>}
                  {visibleColumns.higherDegree && <th className="py-3.5 px-3 min-w-[130px] whitespace-nowrap">Trình độ CM nâng cao</th>}
                  {visibleColumns.department && <th className="py-3.5 px-3 min-w-[120px]">Tổ chuyên môn</th>}
                  {visibleColumns.workplace && <th className="py-3.5 px-3 text-center min-w-[110px]">Nơi làm việc</th>}
                  {visibleColumns.subjects && <th className="py-3.5 px-3 min-w-[130px]">Môn giảng dạy</th>}
                  {visibleColumns.bdHsgInfo && <th className="py-3.5 px-3 text-center min-w-[130px]">BD HSG</th>}
                  {visibleColumns.quota && <th className="py-3.5 px-3 text-center min-w-[75px]">Định mức</th>}
                  {visibleColumns.receivedPeriods && <th className="py-3.5 px-3 text-center min-w-[85px]">Tiết thực nhận</th>}
                  {visibleColumns.progress && <th className="py-3.5 px-3 text-center min-w-[75px]">Tiến độ</th>}
                  {visibleColumns.actions && <th className="py-3.5 px-3 text-center min-w-[100px]">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher, index) => {
                  const dept = deptMap.get(teacher.departmentId);
                  const calc = calcMap.get(teacher.id);
                  const isSelected = selectedTeacherIds.includes(teacher.id);

                  return (
                    <tr
                      key={teacher.id}
                      className={`hover:bg-blue-50/50 transition ${
                        isSelected ? 'bg-blue-50/70' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedTeacherIds((prev) =>
                              prev.includes(teacher.id) ? prev.filter((id) => id !== teacher.id) : [...prev, teacher.id]
                            );
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* STT */}
                      {visibleColumns.stt && (
                        <td className="py-3 px-2 text-center text-slate-400 font-semibold">{index + 1}</td>
                      )}

                      {/* Code */}
                      {visibleColumns.code && (
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{teacher.code}</td>
                      )}

                      {/* Name & Major */}
                      {visibleColumns.fullName && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{teacher.fullName}</span>
                          </div>
                          {teacher.major && <div className="text-[11px] text-slate-400">{teacher.major}</div>}
                        </td>
                      )}

                      {/* Tên TKB */}
                      {visibleColumns.timetableName && (
                        <td className="py-3 px-3 text-center">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200"
                            title="Tên sử dụng trong Thời khóa biểu (Tên TKB)"
                          >
                            {teacher.timetableName || teacher.shortName || (teacher.fullName ? teacher.fullName.trim().split(/\s+/).pop() : '')}
                          </span>
                        </td>
                      )}

                      {/* Email */}
                      {visibleColumns.email && (
                        <td className="py-3 px-3 text-slate-700 text-[11px] font-mono">
                          {teacher.email ? (
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate max-w-[170px]" title={teacher.email}>{teacher.email}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa có</span>
                          )}
                        </td>
                      )}

                      {/* Ngày sinh */}
                      {visibleColumns.birthDate && (
                        <td className="py-3 px-3 text-center font-medium text-slate-700 whitespace-nowrap">
                          {formatBirthDate(teacher.birthDate) || <span className="text-slate-400">-</span>}
                        </td>
                      )}

                      {/* Năm vào ngành */}
                      {visibleColumns.startYear && (
                        <td className="py-3 px-3 text-center font-medium text-slate-700 whitespace-nowrap">
                          {teacher.startYear ? teacher.startYear : <span className="text-slate-400">-</span>}
                        </td>
                      )}

                      {/* Trình độ CM ban đầu */}
                      {visibleColumns.initialDegree && (
                        <td className="py-3 px-3 text-slate-700 text-[11px]">
                          {teacher.initialDegree ? (
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                              {teacher.initialDegree}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Trình độ CM nâng cao */}
                      {visibleColumns.higherDegree && (
                        <td className="py-3 px-3 text-slate-700 text-[11px]">
                          {teacher.higherDegree ? (
                            <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded font-medium border border-blue-100">
                              {teacher.higherDegree}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Department */}
                      {visibleColumns.department && (
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800">{dept?.name || 'Chưa phân tổ'}</div>
                          {dept?.headTeacherId === teacher.id && (
                            <span className="inline-block mt-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200">
                              Tổ trưởng chuyên môn
                            </span>
                          )}
                          {((Array.isArray(dept?.deputyTeacherIds) && dept.deputyTeacherIds.includes(teacher.id)) || dept?.deputyTeacherId === teacher.id) && (
                            <span className="inline-block mt-0.5 ml-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
                              Tổ phó chuyên môn
                            </span>
                          )}
                        </td>
                      )}

                      {/* Workplace */}
                      {visibleColumns.workplace && (
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border shadow-2xs ${
                              teacher.workplace === 'Phân hiệu'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : teacher.workplace === 'Toàn trường'
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            }`}
                          >
                            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{teacher.workplace || 'Điểm chính'}</span>
                          </span>
                        </td>
                      )}

                      {/* Subjects */}
                      {visibleColumns.subjects && (
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(teacher.subjectsCanTeach || []).map((subId) => (
                              <span key={subId} className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                {subjectMap.get(subId)?.name || subId}
                              </span>
                            ))}
                            {(!teacher.subjectsCanTeach || teacher.subjectsCanTeach.length === 0) && (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* BD HSG */}
                      {visibleColumns.bdHsgInfo && (
                        <td className="py-3 px-3 text-center text-slate-700 text-[11px]">
                          {teacher.bdHsgInfo ? (
                            <span
                              className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded font-semibold max-w-[180px] truncate mx-auto"
                              title={teacher.bdHsgInfo}
                            >
                              {teacher.bdHsgInfo}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Quota */}
                      {visibleColumns.quota && (
                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          {calc?.quota ?? teacher.standardQuota ?? 19} tiết
                        </td>
                      )}

                      {/* Breakdown */}
                      {visibleColumns.receivedPeriods && (
                        <td className="py-3 px-3 text-center">
                          {calc ? (
                            <div>
                              <span className="font-black text-slate-900 text-sm">{calc.totalReceivedPeriods}</span>
                              <div className="text-[10px] text-slate-500">
                                (S:{calc.morningPeriods} | C:{calc.afternoonPeriods} | KN:{calc.concurrentPeriods} | MG:{calc.exemptionPeriods})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Status badge */}
                      {visibleColumns.progress && (
                        <td className="py-3 px-3 text-center">
                          {calc ? (
                            <span
                              className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                calc.resultStatus === 'EXACT' || calc.resultStatus === 'EXACT_EXEMPT'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : calc.resultStatus === 'DEFICIT'
                                  ? 'bg-red-100 text-red-800'
                                  : calc.resultStatus === 'SURPLUS'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {calc.resultStatus === 'EXACT'
                                ? 'ĐỦ'
                                : calc.resultStatus === 'EXACT_EXEMPT'
                                ? 'ĐỦ (MIỄN)'
                                : calc.resultStatus === 'DEFICIT'
                                ? `THIẾU ${calc.deficitAmount}`
                                : calc.resultStatus === 'SURPLUS'
                                ? `THỪA ${calc.surplusAmount}`
                                : 'CHƯA GÁN'}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      {visibleColumns.actions && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedTeacherModal(teacher)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <>
                                {showTrashBin ? (
                                  <>
                                    <button
                                      onClick={() => handleRestoreTeacher(teacher)}
                                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                      title="Khôi phục hồ sơ giáo viên"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTeacherToDelete(teacher);
                                        setDeleteMode('PERMANENT');
                                      }}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                      title="Xóa vĩnh viễn khỏi CSDL"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {onSelectTeacherForAssignment && (
                                      <button
                                        onClick={() => onSelectTeacherForAssignment(teacher.id)}
                                        className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                        title="Phân công chuyên môn"
                                      >
                                        <TableProperties className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenEdit(teacher)}
                                      className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                                      title="Chỉnh sửa hồ sơ"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateTeacher(teacher)}
                                      className="p-1.5 text-indigo-700 hover:bg-indigo-50 rounded-lg cursor-pointer"
                                      title="Nhân bản hồ sơ giáo viên"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleRequestDelete(teacher)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                      title="Xóa hồ sơ giáo viên"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTTOM SYNCED HORIZONTAL CONTROLLER & RUNNER */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between text-xs text-slate-600 select-none flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-700 font-semibold">
                Tổng số {filteredTeachers.length} giáo viên
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Mẹo: Giữ phím <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-700">Shift</kbd> + lăn chuột để cuộn ngang tức thì
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollByAmount(-280)}
                disabled={!scrollState.canScrollLeft}
                className="p-1 px-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded font-bold text-slate-700 transition cursor-pointer text-xs"
                title="Cuộn sang trái"
              >
                ◀ Trái
              </button>
              <div className="w-32 sm:w-48 h-2.5 bg-slate-200 rounded-full relative overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all"
                  style={{
                    width: `${Math.max(15, (scrollState.containerWidth / (scrollState.tableWidth || 1)) * 100)}%`,
                    marginLeft: `${
                      scrollState.maxScroll > 0
                        ? (scrollState.scrollLeft / scrollState.maxScroll) *
                          (100 - Math.max(15, (scrollState.containerWidth / (scrollState.tableWidth || 1)) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => scrollByAmount(280)}
                disabled={!scrollState.canScrollRight}
                className="p-1 px-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 rounded font-bold text-slate-700 transition cursor-pointer text-xs"
                title="Cuộn sang phải"
              >
                Phải ▶
              </button>
            </div>
          </div>
        </div>

        {/* FLOATING QUICK SCROLL BAR WHEN IN FULL-PAGE MODE OR ZOOMED */}
        {!tableFitScreen && scrollState.maxScroll > 0 && (
          <div className="fixed bottom-5 right-6 z-40 bg-slate-900/90 text-white backdrop-blur px-3 py-2 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-2">
            <span className="font-bold text-[11px] text-slate-300">Cuộn bảng:</span>
            <button
              type="button"
              onClick={() => scrollByAmount(-280)}
              disabled={!scrollState.canScrollLeft}
              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold transition cursor-pointer"
              title="Cuộn sang trái"
            >
              ◀ Trái
            </button>
            <button
              type="button"
              onClick={scrollToQuotas}
              className="p-1 px-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition cursor-pointer text-[11px]"
              title="Cuộn đến cột Định mức & Tiết dạy"
            >
              ⚡ Định mức
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount(280)}
              disabled={!scrollState.canScrollRight}
              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg font-bold transition cursor-pointer"
              title="Cuộn sang phải"
            >
              Phải ▶
            </button>
            <button
              type="button"
              onClick={() => setTableFitScreen(true)}
              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-[10px] font-bold transition cursor-pointer ml-1"
              title="Cố định khung vừa màn hình"
            >
              Khung vừa MH
            </button>
          </div>
        )}
      </>
    )}

      {filteredTeachers.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-blue-200 p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center shadow-inner">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              {teachers.length === 0 ? 'Trường chưa có giáo viên nào' : 'Không tìm thấy giáo viên nào phù hợp bộ lọc'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {teachers.length === 0
                ? 'Hãy thêm từng giáo viên mới để bắt đầu xếp thời khóa biểu và phân công chuyên môn.'
                : 'Vui lòng thay đổi từ khóa tìm kiếm, tổ chuyên môn hoặc bộ lọc nơi làm việc.'}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm giáo viên mới</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TEACHER DETAIL MASTER PROFILE MODAL */}
      {selectedTeacherModal && (() => {
        const t = selectedTeacherModal;
        const d = deptMap.get(t.departmentId);
        const calc = calcMap.get(t.id);
        const birthDateFormatted = formatBirthDate(t.birthDate);
        const currentYear = new Date().getFullYear();
        const age = t.birthDate ? currentYear - new Date(t.birthDate).getFullYear() : null;
        const tenureYears = t.startYear ? currentYear - t.startYear : null;
        const activeVersionId = dataStore.getSelectedContext().versionId;
        const activeAssignments = dataStore
          .getAssignments()
          .filter((a) => a.teacherId === t.id && a.versionId === activeVersionId);

        const isHead = d?.headTeacherId === t.id;
        const isDeputy =
          (Array.isArray(d?.deputyTeacherIds) && d.deputyTeacherIds.includes(t.id)) ||
          d?.deputyTeacherId === t.id;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
              {/* Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-md shrink-0 ${
                      t.gender === 'Nam' ? 'bg-sky-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                  >
                    {t.fullName.split(' ').slice(-1)[0]?.slice(0, 2).toUpperCase() || 'GV'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold">{t.fullName}</h2>
                      <span className="font-mono bg-white/20 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
                        {t.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.gender === 'Nam' ? 'bg-sky-400/20 text-sky-200 border border-sky-400/30' : 'bg-rose-400/20 text-rose-200 border border-rose-400/30'
                        }`}
                      >
                        {t.gender || 'Nữ'}
                      </span>
                    </div>
                    <p className="text-xs text-blue-200/90 mt-0.5 flex items-center gap-2">
                      <span>{d?.name || 'Chưa phân tổ'}</span>
                      <span>•</span>
                      <span>{t.workplace || 'Điểm chính'}</span>
                      <span>•</span>
                      <span className="font-medium text-emerald-300">
                        {t.statusLabel || (t.status === 'ACTIVE' ? 'Đang giảng dạy' : t.status)}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeacherModal(null)}
                  className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-800">
                {/* Positions & Roles */}
                <div className="flex flex-wrap items-center gap-1.5 pb-1 border-b border-slate-100">
                  <span className="font-bold text-slate-600 mr-1">Chức vụ & Vị trí:</span>
                  {isHead && (
                    <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                      Tổ trưởng chuyên môn
                    </span>
                  )}
                  {isDeputy && (
                    <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                      Tổ phó chuyên môn
                    </span>
                  )}
                  {t.positions && t.positions.length > 0
                    ? t.positions.map((pos, pIdx) => (
                        <span key={pIdx} className="bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded-md border border-slate-200">
                          {pos}
                        </span>
                      ))
                    : !isHead && !isDeputy && <span className="text-slate-500 italic">Giáo viên trực tiếp giảng dạy</span>}
                </div>

                {/* 2-Column Grid: Personal info & Qualifications */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Nhân thân & Công tác */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-1.5 text-blue-900">
                      <Users className="w-4 h-4 text-blue-700" />
                      Thông tin nhân sự & Công tác
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Ngày sinh:</span>
                        <span className="font-bold text-slate-800">{birthDateFormatted || 'Chưa cập nhật'}</span>
                        {age && <span className="text-slate-500 text-[10px] ml-1">({age} tuổi)</span>}
                      </div>
                      <div>
                        <span className="text-slate-500 block">Năm vào ngành:</span>
                        <span className="font-bold text-slate-800">{t.startYear || 'Chưa cập nhật'}</span>
                        {tenureYears && <span className="text-blue-700 text-[10px] ml-1">({tenureYears} năm thâm niên)</span>}
                      </div>
                      <div>
                        <span className="text-slate-500 block">Nơi làm việc:</span>
                        <span className="font-semibold text-slate-800">{t.workplace || 'Điểm chính'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ngày nghỉ CM:</span>
                        <span className="font-semibold text-indigo-700">{t.offDay || 'Không cố định'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Trình độ & Môn dạy */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-1.5 text-blue-900">
                      <GraduationCap className="w-4 h-4 text-blue-700" />
                      Trình độ chuyên môn & Đào tạo
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Trình độ ban đầu:</span>
                        <span className="font-bold text-slate-800">{t.initialDegree || 'Chưa cập nhật'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Trình độ nâng cao:</span>
                        <span className="font-bold text-slate-800">{t.higherDegree || 'Không'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Chuyên ngành đào tạo:</span>
                        <span className="font-bold text-blue-900">{t.major || 'Chưa cập nhật'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block mb-1">Môn có thể dạy:</span>
                        <div className="flex flex-wrap gap-1">
                          {t.subjectsCanTeach && t.subjectsCanTeach.length > 0 ? (
                            t.subjectsCanTeach.map((sub, sIdx) => (
                              <span key={sIdx} className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">
                                {sub}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic">Theo chuyên ngành</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Contact & BD HSG */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 border-b border-slate-200/80 pb-1.5 flex items-center gap-1.5 text-blue-900">
                    <Phone className="w-4 h-4 text-blue-700" />
                    Liên hệ & Bồi dưỡng học sinh giỏi
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Số điện thoại:</span>
                      {t.phone ? (
                        <a href={`tel:${t.phone}`} className="font-bold text-blue-700 hover:underline">
                          {t.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">Chưa có SĐT</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Email:</span>
                      {t.email ? (
                        <a href={`mailto:${t.email}`} className="font-bold text-blue-700 hover:underline">
                          {t.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">Chưa có Email</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Bồi dưỡng HSG:</span>
                      <span className="font-bold text-amber-900">{t.bdHsgInfo || 'Không có'}</span>
                    </div>
                    {t.notes && (
                      <div className="col-span-1 sm:col-span-3 pt-1 border-t border-slate-200 text-slate-600">
                        <span className="font-bold text-slate-700">Ghi chú hồ sơ: </span>
                        <span>{t.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card 4: Quota & Workload Breakdown */}
                {calc && (
                  <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-blue-700" />
                        <span>Phân tích định mức & Số tiết giảng dạy</span>
                      </div>
                      <div className="text-xs font-bold">
                        <span>Định mức chuẩn: </span>
                        <span className="text-blue-900 font-mono text-sm">{calc.quota} tiết/tuần</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-slate-500 text-[10px]">Tiết Sáng (Buổi 1)</div>
                        <div className="text-base font-bold text-blue-700 font-mono mt-0.5">{calc.morningPeriods}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-slate-500 text-[10px]">Tiết Chiều (Buổi 2)</div>
                        <div className="text-base font-bold text-sky-700 font-mono mt-0.5">{calc.afternoonPeriods}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-slate-500 text-[10px]">Tiết Kiêm nhiệm</div>
                        <div className="text-base font-bold text-teal-700 font-mono mt-0.5">{calc.concurrentPeriods}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="text-slate-500 text-[10px]">Tiết Miễn giảm</div>
                        <div className="text-base font-bold text-amber-700 font-mono mt-0.5">{calc.exemptionPeriods}</div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-blue-200 flex items-center justify-between text-xs font-bold">
                      <div className="text-slate-700">
                        Tổng tiết thực nhận: <span className="text-blue-900 font-mono text-sm">{calc.totalCalculated}</span> / {calc.quota} tiết
                      </div>
                      <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-900">
                        {calc.resultStatus}
                      </div>
                    </div>
                  </div>
                )}

                {/* Card 5: Current Teaching Assignments Table */}
                {activeAssignments.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>Các lớp đang được phân công dạy ({activeAssignments.length} phân công)</span>
                      <span className="text-[11px] text-slate-500 font-normal">Học kỳ hiện tại</span>
                    </div>
                    <div className="overflow-x-auto max-h-[220px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-semibold text-[10px] uppercase border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="py-2 px-3">Lớp</th>
                            <th className="py-2 px-3">Môn học</th>
                            <th className="py-2 px-3">Phân môn</th>
                            <th className="py-2 px-3 text-center">Số tiết/tuần</th>
                            <th className="py-2 px-3 text-center">Buổi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeAssignments.map((a, aIdx) => {
                            const cls = dataStore.getClasses().find((c) => c.id === a.classId);
                            const sub = subjectMap.get(a.subjectId);
                            return (
                              <tr key={aIdx} className="hover:bg-blue-50/50">
                                <td className="py-2 px-3 font-bold text-slate-900">{cls?.name || cls?.code || a.classId}</td>
                                <td className="py-2 px-3 font-medium text-blue-900">{sub?.name || a.subjectId}</td>
                                <td className="py-2 px-3 text-slate-600">{a.notes || '-'}</td>
                                <td className="py-2 px-3 text-center font-bold text-slate-800">{a.periodsPerWeek}</td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      cls?.session === 'MORNING'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {cls?.session === 'MORNING' ? 'Sáng' : 'Chiều'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherModal(null);
                        handleOpenEdit(t);
                      }}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Sửa hồ sơ giáo viên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeacherModal(null);
                        handleRequestDelete(t);
                      }}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <button
                  onClick={() => setSelectedTeacherModal(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EDIT / CREATE TEACHER MASTER PROFILE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <GraduationCap className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingTeacher ? `Cập nhật hồ sơ: ${editingTeacher.fullName}` : 'Thêm mới hồ sơ giáo viên (Căn cứ gốc)'}
                  </h3>
                  <p className="text-[11px] text-blue-200/80">
                    Thông tin nhập ở đây sẽ đồng bộ sang tất cả phân hệ phân công chuyên môn và báo cáo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseEditModal}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Form Content */}
            <form onSubmit={handleSaveTeacher} onChange={() => setIsFormDirty(true)} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
              {/* Group 1: Thông tin nhân thân */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="font-bold text-blue-950 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Users className="w-4 h-4 text-blue-700" />
                  <span>1. Thông tin nhân sự cơ bản</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mã GV *</label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="VD: GV01"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Nguyễn Văn An"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                    <select
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value as 'Nam' | 'Nữ')}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="Nữ">Nữ</option>
                      <option value="Nam">Nam</option>
                    </select>
                  </div>
                </div>

                {/* Tên sử dụng trong Thời khóa biểu (Tên TKB) */}
                <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Tên định nghĩa sử dụng trong Thời khóa biểu (Tên TKB)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const parts = formName.trim().split(/\s+/);
                        if (parts.length > 0) {
                          setFormTimetableName(parts[parts.length - 1]);
                        }
                      }}
                      className="text-[11px] text-indigo-700 hover:underline font-bold cursor-pointer"
                    >
                      Tự động lấy tên
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formTimetableName}
                    onChange={(e) => setFormTimetableName(e.target.value)}
                    placeholder="VD: Toàn, Thành-Toán, HươngT (tên hiển thị gọn gàng trên lưới TKB)"
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                    <input
                      type="date"
                      value={formBirthDate}
                      onChange={(e) => setFormBirthDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Năm vào ngành</label>
                    <input
                      type="number"
                      value={formStartYear}
                      onChange={(e) => setFormStartYear(e.target.value)}
                      placeholder="VD: 2005"
                      min="1970"
                      max="2035"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Group 2: Trình độ đào tạo & Chuyên môn */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="font-bold text-blue-950 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>2. Trình độ chuyên môn & Môn giảng dạy</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Trình độ CM ban đầu</label>
                    <input
                      type="text"
                      value={formInitialDegree}
                      onChange={(e) => setFormInitialDegree(e.target.value)}
                      placeholder="VD: Đại học Sư phạm..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Trình độ CM nâng cao</label>
                    <input
                      type="text"
                      value={formHigherDegree}
                      onChange={(e) => setFormHigherDegree(e.target.value)}
                      placeholder="VD: Thạc sĩ Toán học..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Chuyên ngành đào tạo *</label>
                    <input
                      type="text"
                      value={formMajor}
                      onChange={(e) => setFormMajor(e.target.value)}
                      placeholder="VD: Toán - Tin, Ngữ văn..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {formStatus === 'PRINCIPAL'
                        ? 'Số tiết dạy quy định của Hiệu trưởng (tiết/tuần)'
                        : formStatus === 'VICE_PRINCIPAL'
                        ? 'Số tiết dạy quy định của Phó HT (tiết/tuần)'
                        : 'Định mức tiết chuẩn (tiết/tuần)'}
                    </label>
                    <input
                      type="number"
                      value={formQuota}
                      onChange={(e) => setFormQuota(parseInt(e.target.value, 10) || 0)}
                      min="0"
                      max="35"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-blue-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    {(formStatus === 'PRINCIPAL' || formStatus === 'VICE_PRINCIPAL') && (
                      <p className="text-[11px] text-amber-700 font-medium mt-1 leading-tight">
                        * Theo TT 28/2009: {formStatus === 'PRINCIPAL' ? 'Hiệu trưởng dạy 2 tiết/tuần' : 'Phó Hiệu trưởng dạy 4 tiết/tuần'}. Hệ thống tính đủ theo số tiết quy định này riêng, không tính vào kiêm nhiệm hay miễn giảm.
                      </p>
                    )}
                  </div>
                </div>

                {/* Môn có thể dạy - Tag selectors */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Các môn có thể đảm nhiệm giảng dạy (nhấp để chọn / bỏ chọn):
                  </label>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                    {uniqueSubjects.map((sub) => {
                      const isSelected = formSubjects.includes(sub.name) || formSubjects.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormSubjects(formSubjects.filter((s) => s !== sub.name && s !== sub.id));
                            } else {
                              setFormSubjects([...formSubjects, sub.name]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Group 3: Đơn vị công tác & Phân công */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="font-bold text-blue-950 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <span>3. Đơn vị công tác & Phân công</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tổ chuyên môn *</label>
                    <select
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nơi làm việc *</label>
                    <select
                      value={formWorkplaceId}
                      onChange={(e) => setFormWorkplaceId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium cursor-pointer"
                    >
                      {workplaces
                        .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.isDefault ? '(Mặc định)' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Trạng thái công tác *</label>
                    <select
                      value={formStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as any;
                        setFormStatus(newStatus);
                        if (newStatus === 'PRINCIPAL' && (!formQuota || formQuota === 19)) {
                          setFormQuota(2);
                        } else if (newStatus === 'VICE_PRINCIPAL' && (!formQuota || formQuota === 19)) {
                          setFormQuota(4);
                        } else if (newStatus === 'ACTIVE' && (formQuota === 2 || formQuota === 4)) {
                          setFormQuota(19);
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium cursor-pointer"
                    >
                      <option value="ACTIVE">Đang giảng dạy (ĐM 19)</option>
                      <option value="MATERNITY">Nghỉ thai sản</option>
                      <option value="PRINCIPAL">Hiệu trưởng (Quy định 2 tiết/tuần)</option>
                      <option value="VICE_PRINCIPAL">Phó hiệu trưởng (Quy định 4 tiết/tuần)</option>
                      <option value="PROBATIONARY">Tập sự (Miễn 2)</option>
                      <option value="SECONDED">Biệt phái</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ngày nghỉ chuyên môn</label>
                    <select
                      value={formOffDay}
                      onChange={(e) => setFormOffDay(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium cursor-pointer"
                    >
                      <option value="">Không cố định / Chưa xếp</option>
                      <option value="Thứ 2">Thứ 2</option>
                      <option value="Thứ 3">Thứ 3</option>
                      <option value="Thứ 4">Thứ 4</option>
                      <option value="Thứ 5">Thứ 5</option>
                      <option value="Thứ 6">Thứ 6</option>
                      <option value="Thứ 7">Thứ 7</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bồi dưỡng học sinh giỏi (BD HSG)
                    </label>
                    <input
                      type="text"
                      value={formBdHsgInfo}
                      onChange={(e) => setFormBdHsgInfo(e.target.value)}
                      placeholder="VD: BD HSG Toán 9 (2 tiết/tuần)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Group 4: Liên hệ & Ghi chú */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="font-bold text-blue-950 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Phone className="w-4 h-4 text-blue-700" />
                  <span>4. Thông tin liên hệ & Ghi chú</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="VD: 0912345678"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="VD: gv@thcs.edu.vn"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Ghi chú hồ sơ</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Ghi chú về thâm niên, thành tích hoặc nguyện vọng chuyên môn..."
                      rows={2}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={handleRequestCloseEditModal}
                  className="px-4 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                {!editingTeacher && (
                  <button
                    type="button"
                    onClick={(e) => handleSaveTeacher(e, true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Lưu & Nhập tiếp</span>
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-blue-800 hover:bg-blue-900 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingTeacher ? 'Lưu cập nhật hồ sơ' : 'Lưu hồ sơ giáo viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HỎI LƯU THÔNG TIN GIÁO VIÊN TRƯỚC KHI THOÁT / ĐÓNG MODAL */}
      {showUnsavedEditPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Dữ liệu hồ sơ có thay đổi!</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bạn có muốn lưu các thông tin vừa chỉnh sửa trước khi thoát không?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/60 p-3 rounded-2xl border border-amber-200/80">
              Nếu bạn thoát mà không lưu, các thay đổi vừa nhập (mã, tên, định mức, môn giảng dạy, nơi làm việc...) sẽ bị hủy bỏ.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  setShowUnsavedEditPrompt(false);
                  handleSaveTeacher(e);
                }}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Lưu thay đổi & Đóng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFormDirty(false);
                  setShowUnsavedEditPrompt(false);
                  setIsEditModalOpen(false);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Bỏ qua thay đổi & Đóng</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUnsavedEditPrompt(false)}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer text-center"
              >
                Ở lại tiếp tục chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM SINGLE DELETE TEACHER MODAL */}
      {/* ========================================================================= */}
      {teacherToDelete && (() => {
        const isPermanent = deleteMode === 'PERMANENT';
        const teacherDept = deptMap.get(teacherToDelete.departmentId);
        const teacherCalc = calcMap.get(teacherToDelete.id);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {isPermanent ? 'Xác nhận xóa vĩnh viễn giáo viên' : 'Chuyển giáo viên vào thùng rác'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isPermanent
                      ? 'Dữ liệu hồ sơ giáo viên và toàn bộ phân công liên quan sẽ bị xóa hoàn toàn khỏi hệ thống.'
                      : 'Hồ sơ sẽ được chuyển vào thùng rác và có thể khôi phục lại bất kỳ lúc nào.'}
                  </p>
                </div>
              </div>

              {/* Teacher Summary Box */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-900">{teacherToDelete.fullName} ({teacherToDelete.code})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tổ chuyên môn:</span>
                  <span className="font-semibold text-blue-900">{teacherDept?.name || 'Chưa phân tổ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Định mức chuẩn:</span>
                  <span className="font-bold text-slate-800">{teacherToDelete.standardQuota || 19} tiết/tuần</span>
                </div>
                {teacherCalc && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số tiết đã xếp:</span>
                    <span className="font-black text-slate-900">{teacherCalc.totalCalculated} / {teacherCalc.quota} tiết</span>
                  </div>
                )}
              </div>

              {/* Mode Selector */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 block">Hình thức xóa:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteMode('SOFT')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      deleteMode === 'SOFT'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold">Thùng rác (Lưu trữ)</div>
                    <div className="text-[10px] text-slate-500 font-normal">An toàn, có thể khôi phục</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteMode('PERMANENT')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      deleteMode === 'PERMANENT'
                        ? 'border-red-600 bg-red-50/70 text-red-900 ring-2 ring-red-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-red-700">Xóa vĩnh viễn</div>
                    <div className="text-[10px] text-red-500 font-normal">Xóa sạch khỏi CSDL</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTeacherToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="confirm-delete-teacher-btn"
                  type="button"
                  onClick={handleConfirmDeleteTeacher}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs cursor-pointer flex items-center gap-1.5 ${
                    isPermanent ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isPermanent ? 'Xác nhận xóa vĩnh viễn' : 'Chuyển vào thùng rác'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* CONFIRM BULK DELETE TEACHERS MODAL */}
      {/* ========================================================================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {bulkDeleteMode === 'PERMANENT'
                    ? `Xác nhận xóa vĩnh viễn ${selectedTeacherIds.length} giáo viên?`
                    : `Chuyển ${selectedTeacherIds.length} giáo viên vào thùng rác?`}
                </h3>
                <p className="text-xs text-slate-500">
                  {bulkDeleteMode === 'PERMANENT'
                    ? 'Hành động này không thể hoàn tác. Các giáo viên này sẽ bị xóa hoàn toàn khỏi hệ thống.'
                    : 'Các giáo viên này sẽ được chuyển vào thùng rác và có thể khôi phục lại khi cần.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-700 block">Hình thức xóa hàng loạt:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBulkDeleteMode('SOFT')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    bulkDeleteMode === 'SOFT'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold">Thùng rác</div>
                  <div className="text-[10px] text-slate-500 font-normal">Có thể khôi phục</div>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeleteMode('PERMANENT')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                    bulkDeleteMode === 'PERMANENT'
                      ? 'border-red-600 bg-red-50/70 text-red-900 ring-2 ring-red-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-red-700">Xóa vĩnh viễn</div>
                  <div className="text-[10px] text-red-500 font-normal">Xóa sạch toàn bộ</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                id="confirm-bulk-delete-teachers-btn"
                type="button"
                onClick={handleConfirmBulkDeleteTeachers}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {bulkDeleteMode === 'PERMANENT' ? 'Xác nhận xóa vĩnh viễn' : 'Đồng ý chuyển thùng rác'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA KIÊM NHIỆM HÀNG LOẠT GIÁO VIÊN TRONG TEACHER MANAGEMENT */}
      {isBulkClearDutiesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-indigo-700">
              <div className="p-2.5 rounded-2xl bg-indigo-100">
                <Briefcase className="w-6 h-6 text-indigo-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa kiêm nhiệm hàng loạt</h3>
                <p className="text-xs text-slate-500">Đã chọn {selectedTeacherIds.length} giáo viên</p>
              </div>
            </div>
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs space-y-2 text-indigo-950">
              <div>
                Bạn có chắc chắn muốn xóa toàn bộ phân công kiêm nhiệm của <strong>{selectedTeacherIds.length} giáo viên</strong> đã chọn?
              </div>
              <p className="text-[11px] text-indigo-800">
                Hệ thống sẽ xóa triệt để mọi nhiệm vụ kiêm nhiệm, thu hồi vai trò Tổ trưởng/Tổ phó/Chủ nhiệm, cập nhật hồ sơ và tính lại định mức tiết dạy.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkClearDutiesModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkClearDuties}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-4 h-4" />
                <span>Xác nhận Xóa kiêm nhiệm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKPLACE CATEGORY MANAGEMENT MODAL */}
      {/* ========================================================================= */}
      {isWorkplaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Danh mục Nơi làm việc</h3>
                  <p className="text-xs text-slate-500">
                    Quản lý các nơi làm việc của giáo viên (Điểm chính, Phân hiệu, Toàn trường...). Có thể thêm, sửa, xóa linh hoạt.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWorkplaceModalOpen(false);
                  handleCancelEditWp();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ADD / EDIT CATEGORY FORM */}
            <form onSubmit={handleSaveWorkplaceCategory} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  {editingWp ? `Chỉnh sửa: "${editingWp.name}"` : 'Thêm mới danh mục nơi làm việc'}
                </span>
                {editingWp && (
                  <button
                    type="button"
                    onClick={handleCancelEditWp}
                    className="text-slate-500 hover:text-slate-800 underline cursor-pointer text-[11px]"
                  >
                    Hủy chỉnh sửa
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tên nơi làm việc * <span className="text-slate-400 font-normal">(VD: Điểm chính, Phân hiệu, Điểm trường A...)</span>
                  </label>
                  <input
                    type="text"
                    value={wpName}
                    onChange={(e) => setWpName(e.target.value)}
                    placeholder="Nhập tên nơi làm việc..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã ký hiệu <span className="text-slate-400 font-normal">(Tùy chọn)</span>
                  </label>
                  <input
                    type="text"
                    value={wpCode}
                    onChange={(e) => setWpCode(e.target.value)}
                    placeholder="VD: DC, PH, TT..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú / Mô tả</label>
                <input
                  type="text"
                  value={wpDescription}
                  onChange={(e) => setWpDescription(e.target.value)}
                  placeholder="Ghi chú thêm về địa điểm, cơ sở..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={wpIsDefault}
                    onChange={(e) => setWpIsDefault(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Đặt làm nơi làm việc mặc định cho giáo viên mới</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {editingWp ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingWp ? 'Lưu thay đổi' : 'Thêm nơi làm việc'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* CURRENT WORKPLACES LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>Danh sách hiện có ({workplaces.length} danh mục)</span>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreDefaultWorkplaces}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Khôi phục lại 3 danh mục chuẩn: Điểm chính, Phân hiệu, Toàn trường"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Khôi phục 3 danh mục mặc định</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Tên nơi làm việc</th>
                      <th className="py-2.5 px-3 text-center w-24">Mã</th>
                      <th className="py-2.5 px-3 text-center w-28">Số lượng GV</th>
                      <th className="py-2.5 px-3">Mô tả</th>
                      <th className="py-2.5 px-3 text-right w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workplaces.map((w) => {
                      const teacherCount = teachers.filter(
                        (t) => !t.isDeleted && (t.workplaceId === w.id || t.workplace === w.name)
                      ).length;

                      return (
                        <tr key={w.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border text-[11px] ${
                                  w.name === 'Phân hiệu'
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : w.name === 'Toàn trường'
                                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                }`}
                              >
                                <Building2 className="w-3 h-3" />
                                {w.name}
                              </span>
                              {w.isDefault && (
                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  Mặc định
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">{w.code}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                              {teacherCount} GV
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 truncate max-w-[180px]">
                            {w.description || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditWp(w)}
                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Sửa tên hoặc mã nơi làm việc"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteWorkplace(w)}
                                disabled={workplaces.length <= 1}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  workplaces.length <= 1
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-red-600 hover:bg-red-50'
                                }`}
                                title={
                                  workplaces.length <= 1
                                    ? 'Không thể xóa danh mục duy nhất'
                                    : 'Xóa danh mục nơi làm việc này'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsWorkplaceModalOpen(false);
                  handleCancelEditWp();
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM DELETE WORKPLACE MODAL */}
      {/* ========================================================================= */}
      {wpToDelete && (() => {
        const affectedTeachers = teachers.filter(
          (t) => !t.isDeleted && (t.workplaceId === wpToDelete.id || t.workplace === wpToDelete.name)
        );
        const otherWorkplaces = workplaces.filter((w) => w.id !== wpToDelete.id);

        return (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Xác nhận xóa nơi làm việc</h3>
                  <p className="text-xs text-slate-500">
                    Bạn đang chuẩn bị xóa danh mục "{wpToDelete.name}".
                  </p>
                </div>
              </div>

              {affectedTeachers.length > 0 ? (
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs space-y-2 text-amber-900">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Hiện đang có {affectedTeachers.length} giáo viên thuộc nơi làm việc này!</span>
                  </div>
                  <p className="text-slate-600">
                    Để đảm bảo tính nhất quán dữ liệu, vui lòng chọn nơi làm việc mới để tự động chuyển giao cho {affectedTeachers.length} giáo viên này:
                  </p>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Nơi làm việc chuyển sang:</label>
                    <select
                      value={wpReassignToId}
                      onChange={(e) => setWpReassignToId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-bold text-slate-900"
                    >
                      {otherWorkplaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600">
                  Nơi làm việc này hiện không có giáo viên nào trực thuộc. Bạn có thể yên tâm xóa.
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWpToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteWorkplace}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận xóa</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA KIÊM NHIỆM HÀNG LOẠT */}
      {/* ========================================================================= */}
      {isBulkClearDutiesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-indigo-700">
              <div className="p-2.5 rounded-2xl bg-indigo-100">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa kiêm nhiệm hàng loạt</h3>
                <p className="text-xs text-slate-500">Thu hồi toàn bộ nhiệm vụ kiêm nhiệm đã chọn</p>
              </div>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs space-y-2 text-indigo-950">
              <div>
                Bạn có chắc chắn muốn xóa toàn bộ phân công kiêm nhiệm của{' '}
                <strong className="text-indigo-900 font-bold text-sm">
                  {selectedTeacherIds.length > 0
                    ? `${selectedTeacherIds.length} giáo viên đã chọn`
                    : `tất cả ${teachers.filter((t) => !t.isDeleted).length} giáo viên trong trường`}
                </strong>?
              </div>
              <p className="text-[11px] text-indigo-800">
                Hệ thống sẽ đồng thời cập nhật lại hồ sơ giáo viên, thu hồi phân công kiêm nhiệm và tính toán lại định mức tiết dạy.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkClearDutiesModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkClearDuties}
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Briefcase className="w-4 h-4" />
                <span>Xác nhận Xóa kiêm nhiệm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK TEACHER QUOTA MODAL */}
      {/* ========================================================================= */}
      <BulkTeacherQuotaModal
        isOpen={isBulkQuotaModalOpen}
        onClose={() => setIsBulkQuotaModalOpen(false)}
        teachers={teachers}
        departments={departments}
        workplaces={workplaces}
        branches={dataStore.getBranches(true)}
        preSelectedTeacherIds={selectedTeacherIds}
        onSuccess={(count, msg) => {
          showToast(msg);
          setSelectedTeacherIds([]);
        }}
      />

      {/* ========================================================================= */}
      {/* TEACHER MASTER EXCEL IMPORT MODAL */}
      {/* ========================================================================= */}
      <TeacherExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        existingTeachers={teachers}
        departments={departments}
        onSuccess={(result) => {
          showToast(
            `Đã đồng bộ thành công ${result.totalProcessed} hồ sơ giáo viên (Thêm mới: ${result.addedCount}, Cập nhật: ${result.updatedCount})`
          );
        }}
      />

      {/* ========================================================================= */}
      {/* TOAST NOTIFICATION */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-blue-950 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl border border-blue-800/60 animate-in fade-in slide-in-from-bottom-3 duration-200">
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
