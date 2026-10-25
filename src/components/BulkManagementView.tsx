/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Bulk Management View (Thêm, Xóa hàng loạt Lớp, GV, Môn, Khung tiết, Tổ, Kiêm nhiệm & Quản lý nhiều phiên bản)
 */

import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Users,
  BookOpen,
  Sliders,
  Calendar,
  Save,
  Building2,
  Award,
  Lock,
  Unlock,
  RefreshCw,
  FileText,
  HelpCircle,
  X,
  CheckSquare,
  Square,
  ChevronRight,
  ArrowRight,
  FileSpreadsheet,
  Download,
  Upload,
  Eye,
  Edit2,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Clock,
  FileEdit,
  PanelLeftClose,
  PanelLeftOpen,
  Briefcase,
} from 'lucide-react';
import {
  SchoolClass,
  Teacher,
  Subject,
  Department,
  SpecialDuty,
  CurriculumDistribution,
  AssignmentVersion,
  SemesterId,
  TeachingAssignment,
  SchoolSession,
  SchoolInfo,
  TeacherStatus,
  WorkplaceCategory,
  SchoolBranch,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import { parseUploadedExcel, ImportPreviewResult } from '../import-export/excelImportService';
import {
  exportWorkloadExcel,
  exportExcelTemplate,
  exportTeacherMasterProfileTemplate,
  exportTeacherMasterListExcel,
} from '../import-export/excelService';
import { calculateAllTeachersWorkload } from '../calculation-engine/workloadCalculator';
import { BulkTeacherQuotaModal } from './BulkTeacherQuotaModal';
import { TeacherExcelImportModal } from './TeacherExcelImportModal';
import { getTeacherPositions, getPositionBadgeStyle, STANDARD_POSITION_PRESETS, normalizePositionName } from '../utils/teacherPositions';
import { toastService } from '../services/toastService';
import { SearchableTeacherSelect } from './SearchableTeacherSelect';
import { matchesQuery } from '../utils/searchUtils';
import { AbbreviationManagementView } from './AbbreviationManagementView';

interface BulkManagementViewProps {
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects: Subject[];
  departments: Department[];
  duties: SpecialDuty[];
  curriculums: CurriculumDistribution[];
  versions: AssignmentVersion[];
  assignments: TeachingAssignment[];
  currentVersion?: AssignmentVersion;
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
  onNavigateToAssignments?: () => void;
}

type BulkTab = 'CLASSES' | 'TEACHERS' | 'SUBJECTS' | 'CURRICULUM' | 'DEPARTMENTS' | 'DUTIES' | 'ABBREVIATIONS' | 'VERSIONS' | 'EXCEL';

export const BulkManagementView: React.FC<BulkManagementViewProps> = ({
  classes,
  teachers,
  subjects,
  departments,
  duties,
  curriculums,
  versions,
  assignments,
  currentVersion,
  schoolYearId,
  semesterId,
  versionId,
  onNavigateToAssignments,
}) => {
  const [activeTab, setActiveTab] = useState<BulkTab>('CLASSES');
  const [subjectSubTab, setSubjectSubTab] = useState<'LIST' | 'CURRICULUM'>('LIST');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isActionPanelCollapsed, setIsActionPanelCollapsed] = useState<boolean>(false);
  const [isTeacherMasterImportModalOpen, setIsTeacherMasterImportModalOpen] = useState<boolean>(false);

  const currentUser = dataStore.getCurrentUser();
  const isTenantSchool = dataStore.getSchoolId() !== 'school_quyhop' || Boolean(dataStore.detectUrlSchoolId() && dataStore.detectUrlSchoolId() !== 'school_quyhop');
  const canEdit = currentUser.permission === 'edit' || currentUser.role === 'admin' || currentUser.role === 'principal' || isTenantSchool;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // ==========================================
  // TAB 1: CLASSES (LỚP HỌC) BULK STATE
  // ==========================================
  const branches = dataStore.getBranches();
  const defaultBranch = branches.find((b) => b.isMain) || branches[0];

  const [classGrade, setClassGrade] = useState<number>(6);
  const [classCount, setClassCount] = useState<number>(4);
  const [classPrefix, setClassPrefix] = useState<string>('A');
  const [classSession, setClassSession] = useState<SchoolSession>('MORNING');
  const [classBranchId, setClassBranchId] = useState<string>(defaultBranch?.id || 'branch_main');
  const [classDefaultStudents, setClassDefaultStudents] = useState<number>(38);
  const [classPasteText, setClassPasteText] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classFilterGrade, setClassFilterGrade] = useState<string>('ALL');
  const [classFilterBranch, setClassFilterBranch] = useState<string>('ALL');

  const activeClasses = useMemo(() => classes.filter((c) => !c.isDeleted), [classes]);
  const filteredClasses = useMemo(() => {
    return activeClasses.filter((c) => {
      if (classFilterGrade !== 'ALL' && c.grade !== Number(classFilterGrade)) return false;
      if (classFilterBranch !== 'ALL') {
        const bId = c.branchId || 'branch_main';
        if (bId !== classFilterBranch) return false;
      }
      return true;
    });
  }, [activeClasses, classFilterGrade, classFilterBranch]);

  const uniqueSubjects = useMemo(() => {
    const seen = new Set<string>();
    return subjects.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [subjects]);

  // Smart helper to compute generated class codes sequence (e.g. 6A9 -> 6A9, 6A10, 6A11...)
  const getGeneratedClassesInfo = useMemo(() => {
    const rawInput = (classPrefix || 'A').trim();
    // Match formats like: "6A9", "6A", "A9", "A", "7B10", "8A1"
    const match = rawInput.match(/^([6789])?([A-Za-zÀ-ỹ]+)?(\d+)?$/);

    let effectiveGrade = classGrade;
    let letter = 'A';
    let startNum = 1;

    if (match) {
      if (match[1]) {
        effectiveGrade = Number(match[1]);
      }
      if (match[2]) {
        letter = match[2].toUpperCase();
      }
      if (match[3]) {
        startNum = parseInt(match[3], 10);
      }
    } else {
      const digitMatch = rawInput.match(/\d+/);
      if (digitMatch) startNum = parseInt(digitMatch[0], 10);
      const letterMatch = rawInput.match(/[A-Za-zÀ-ỹ]+/);
      if (letterMatch) letter = letterMatch[0].toUpperCase();
    }

    const effectiveBranchId = classBranchId || (branches.find((b) => b.isMain)?.id || branches[0]?.id || 'branch_main');
    const currentSchoolId = dataStore.getSchoolId();
    const classList: Omit<SchoolClass, 'id'>[] = [];
    for (let i = 0; i < classCount; i++) {
      const num = startNum + i;
      const code = `${effectiveGrade}${letter}${num}`;
      classList.push({
        code,
        name: `Lớp ${code}`,
        grade: effectiveGrade as any,
        studentCount: classDefaultStudents || 35,
        session: classSession,
        branchId: effectiveBranchId,
        schoolId: currentSchoolId,
        room: `Phòng ${code}`,
        active: true,
      });
    }

    return { effectiveGrade, letter, startNum, classList };
  }, [classGrade, classPrefix, classCount, classDefaultStudents, classSession, classBranchId, branches]);

  const handleBulkGenerateClasses = () => {
    if (classCount <= 0 || classCount > 20) {
      showToast('Vui lòng chọn số lượng lớp hợp lệ (1 - 20)', 'error');
      return;
    }

    const { classList } = getGeneratedClassesInfo;
    const newClassesData: Omit<SchoolClass, 'id'>[] = [];

    classList.forEach((cls) => {
      const exists = activeClasses.some(
        (c) => c.code.toLowerCase() === cls.code.toLowerCase() || c.name.toLowerCase() === cls.name.toLowerCase()
      );
      if (!exists) {
        newClassesData.push(cls);
      }
    });

    if (newClassesData.length === 0) {
      const names = classList.map((c) => c.code).join(', ');
      showToast(`Các lớp (${names}) đã tồn tại trong danh sách lớp của trường này!`, 'error');
      return;
    }

    try {
      dataStore.bulkAddClasses(newClassesData);
      const addedNames = newClassesData.map((c) => c.code).join(', ');
      showToast(`✅ Đã tạo thành công ${newClassesData.length} lớp học: ${addedNames}!`);
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi tạo lớp học!', 'error');
    }
  };

  const handleBulkAddClassesFromText = () => {
    const text = classPasteText.trim();
    if (!text) {
      showToast('Vui lòng nhập hoặc dán danh sách lớp học cần thêm (VD: 6A1, Sáng, 38)!', 'error');
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const newClassesData: Omit<SchoolClass, 'id'>[] = [];
    const effectiveBranchId = classBranchId || (branches.find((b) => b.isMain)?.id || branches[0]?.id || 'branch_main');
    const currentSchoolId = dataStore.getSchoolId();

    lines.forEach((line) => {
      // Formats: "6A1" or "6A1, Sáng, 38" or "6A1 - Chiều - 35" or "Lớp 6A1" or "6A"
      const parts = line.split(/[,;\t\-]+/).map((p) => p.trim()).filter(Boolean);
      const rawName = parts[0] || '';
      if (!rawName) return;

      const match = rawName.match(/([6789])([A-Za-z0-9]*)/) || rawName.match(/([6789])/);
      const grade = match ? Number(match[1]) : 6;
      const code = rawName.replace(/^Lớp\s+/i, '').trim();
      
      const isAfternoon = line.toLowerCase().includes('chiều') || (parts[1] && parts[1].toLowerCase().includes('chiều'));
      const sess = isAfternoon ? 'AFTERNOON' : 'MORNING';

      // Find any number in parts that looks like student count (20..50)
      let students = classDefaultStudents || 35;
      for (let i = 1; i < parts.length; i++) {
        const num = parseInt(parts[i], 10);
        if (!isNaN(num) && num >= 10 && num <= 60) {
          students = num;
          break;
        }
      }

      const exists = activeClasses.some((c) => c.code.toLowerCase() === code.toLowerCase() || c.name.toLowerCase() === `lớp ${code}`.toLowerCase());
      if (!exists && code) {
        newClassesData.push({
          code,
          name: `Lớp ${code}`,
          grade: (grade >= 6 && grade <= 9 ? grade : 6) as any,
          studentCount: students,
          session: sess as any,
          branchId: effectiveBranchId,
          schoolId: currentSchoolId,
          active: true,
        });
      }
    });

    if (newClassesData.length === 0) {
      showToast('Không có lớp mới nào được thêm (các lớp đã tồn tại trong hệ thống).', 'error');
      return;
    }

    try {
      dataStore.bulkAddClasses(newClassesData);
      setClassPasteText('');
      showToast(`✅ Đã thêm thành công ${newClassesData.length} lớp học vào hệ thống!`);
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi thêm lớp học!', 'error');
    }
  };

  // Class Edit & Delete Modals State
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editClassName, setEditClassName] = useState<string>('');
  const [editClassCode, setEditClassCode] = useState<string>('');
  const [editClassGrade, setEditClassGrade] = useState<6 | 7 | 8 | 9>(6);
  const [editClassSession, setEditClassSession] = useState<SchoolSession>('MORNING');
  const [editClassStudentCount, setEditClassStudentCount] = useState<number>(38);
  const [editClassHomeroomTeacherId, setEditClassHomeroomTeacherId] = useState<string>('');
  const [editClassHomeroomSearch, setEditClassHomeroomSearch] = useState<string>('');
  const [editClassBranchId, setEditClassBranchId] = useState<string>('branch_main');
  const [editClassRoom, setEditClassRoom] = useState<string>('');
  const [editClassActive, setEditClassActive] = useState<boolean>(true);

  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [isBulkDeleteClassModalOpen, setIsBulkDeleteClassModalOpen] = useState<boolean>(false);

  const handleStartEditClass = (cls: SchoolClass) => {
    setEditingClass(cls);
    setEditClassName(cls.name);
    setEditClassCode(cls.code);
    setEditClassGrade(cls.grade);
    setEditClassSession(cls.session);
    setEditClassStudentCount(cls.studentCount || 38);
    setEditClassHomeroomTeacherId(cls.homeroomTeacherId || '');
    setEditClassBranchId(cls.branchId || 'branch_main');
    setEditClassRoom(cls.room || '');
    setEditClassActive(cls.active !== false);
  };

  const handleSaveEditClass = () => {
    if (!editingClass) return;
    const name = editClassName.trim();
    if (!name) {
      showToast('Tên lớp không được để trống!', 'error');
      return;
    }

    const code = editClassCode.trim() || name.replace(/^(Lớp|Lop)\s*/i, '').trim() || name;

    const duplicate = classes.some(
      (c) =>
        c.id !== editingClass.id &&
        !c.isDeleted &&
        (c.name.toLowerCase() === name.toLowerCase() || c.code.toLowerCase() === code.toLowerCase())
    );
    if (duplicate) {
      showToast(`Tên hoặc mã lớp "${name}" đã tồn tại!`, 'error');
      return;
    }

    dataStore.updateClass(editingClass.id, {
      name,
      code,
      grade: editClassGrade,
      session: editClassSession,
      studentCount: editClassStudentCount,
      homeroomTeacherId: editClassHomeroomTeacherId || undefined,
      branchId: editClassBranchId,
      room: editClassRoom || undefined,
      active: editClassActive,
    });

    setEditingClass(null);
    showToast(`✅ Đã cập nhật thành công thông tin lớp "${name}"!`);
  };

  const handleConfirmDeleteSingleClass = () => {
    if (!classToDelete) return;
    const clsName = classToDelete.name;
    dataStore.deleteClass(classToDelete.id, true);
    setSelectedClassIds((prev) => prev.filter((id) => id !== classToDelete.id));
    setClassToDelete(null);
    showToast(`Đã xóa lớp "${clsName}" thành công!`);
  };

  const handleConfirmBulkDeleteClasses = () => {
    if (selectedClassIds.length === 0) return;
    const count = dataStore.bulkDeleteClasses(selectedClassIds, true);
    setSelectedClassIds([]);
    setIsBulkDeleteClassModalOpen(false);
    showToast(`Đã xóa ${count} lớp học đã chọn!`);
  };

  const toggleSelectAllClasses = () => {
    if (selectedClassIds.length === filteredClasses.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(filteredClasses.map((c) => c.id));
    }
  };

  // ==========================================
  // TAB 2: TEACHERS (GIÁO VIÊN) BULK STATE
  // ==========================================
  const workplaces = dataStore.getWorkplaces();
  const defaultWp = workplaces.find((w) => w.isDefault) || workplaces[0];

  const [teacherPasteText, setTeacherPasteText] = useState<string>('');
  const [teacherDefaultDept, setTeacherDefaultDept] = useState<string>(departments[0]?.id || '');
  const [teacherDefaultWorkplaceId, setTeacherDefaultWorkplaceId] = useState<string>(defaultWp?.id || '');
  const [teacherDefaultQuota, setTeacherDefaultQuota] = useState<number>(19);
  const [teacherSearchTerm, setTeacherSearchTerm] = useState<string>('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherFilterDept, setTeacherFilterDept] = useState<string>('ALL');
  const [teacherFilterWorkplace, setTeacherFilterWorkplace] = useState<string>('ALL');
  const [teacherFilterPosition, setTeacherFilterPosition] = useState<string>('ALL');
  const [isBulkQuotaModalOpen, setIsBulkQuotaModalOpen] = useState<boolean>(false);

  const activeTeachers = useMemo(() => teachers.filter((t) => !t.isDeleted), [teachers]);
  const filteredTeachers = useMemo(() => {
    return activeTeachers.filter((t) => {
      // 0. Tìm kiếm theo tên GV, mã GV, chuyên môn, môn giảng dạy (hỗ trợ tiếng Việt không dấu & viết tắt)
      if (teacherSearchTerm.trim()) {
        const match = matchesQuery(
          teacherSearchTerm,
          t.fullName,
          t.code,
          t.major,
          ...(t.subjectsCanTeach || [])
        );
        if (!match) return false;
      }

      // 1. Lọc theo Điểm trường / Nơi làm việc (Toàn trường, Điểm chính, Phân hiệu...)
      if (teacherFilterWorkplace !== 'ALL') {
        const targetWp = workplaces.find((w) => w.id === teacherFilterWorkplace);
        const targetName = (targetWp?.name || '').trim().toLowerCase();
        if (targetName === 'toàn trường' || teacherFilterWorkplace === 'wp_all') {
          // Toàn trường
        } else {
          const teacherWpId = t.workplaceId;
          const teacherWpName = (t.workplace || '').trim().toLowerCase();
          const matchesId = teacherWpId === teacherFilterWorkplace;
          const matchesName = teacherWpName === targetName;
          const partialMatch = targetName ? teacherWpName.includes(targetName) : false;
          if (!matchesId && !matchesName && !partialMatch) return false;
        }
      }

      // 2. Tiếp sau đó lọc theo Tổ chuyên môn (Tất cả hoặc theo từng tổ)
      if (teacherFilterDept !== 'ALL' && t.departmentId !== teacherFilterDept) return false;

      // 3. Lọc theo Vị trí công việc (Hiệu trưởng, Phó hiệu trưởng, Tổ trưởng, Tổ phó, Kiêm nhiệm...)
      if (teacherFilterPosition !== 'ALL') {
        const posList = getTeacherPositions(t, departments, duties, assignments);
        if (teacherFilterPosition === 'NONE') {
          if (posList.length > 0) return false;
        } else {
          const needle = teacherFilterPosition.toLowerCase();
          const hasPos = posList.some((p) => p.toLowerCase().includes(needle));
          if (!hasPos) return false;
        }
      }

      return true;
    });
  }, [activeTeachers, teacherSearchTerm, teacherFilterDept, teacherFilterWorkplace, teacherFilterPosition, workplaces, departments, duties, assignments]);

  const handleBulkAddTeachers = () => {
    let text = teacherPasteText.trim();
    if (!text) {
      setTeacherPasteText(`Nguyễn Văn An, Tổ Tự nhiên, Toán, 19\nTrần Thị Bích, Tổ Xã hội, Văn, 19\nLê Quang Cường, Tổ Ngoại ngữ, Tiếng Anh, 19\nPhạm Thị Duyên, Tổ Năng khiếu, GDTC, 19`);
      showToast('Đã nạp mẫu danh sách giáo viên! Bấm "Thêm danh sách giáo viên" lần nữa để xác nhận.');
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const newTeachersData: Omit<Teacher, 'id'>[] = [];
    let currentCodeIndex = activeTeachers.length + 1;
    const chosenDefaultWp = workplaces.find((w) => w.id === teacherDefaultWorkplaceId) || defaultWp;

    lines.forEach((line) => {
      // Formats: "Nguyễn Văn A" or "GV01, Nguyễn Văn A, Tổ Toán, Toán, 19"
      const parts = line.split(/[,;\t]+/).map((p) => p.trim());
      let code = `GV${String(currentCodeIndex).padStart(2, '0')}`;
      let fullName = parts[0];
      let deptId = teacherDefaultDept;
      let wpId = chosenDefaultWp?.id;
      let wpName = chosenDefaultWp?.name || 'Điểm chính';
      let major = 'Sư phạm';
      let quota = teacherDefaultQuota;

      if (parts.length > 1) {
        if (/^GV/i.test(parts[0])) {
          code = parts[0].toUpperCase();
          fullName = parts[1];
          if (parts[2]) {
            const foundDept = departments.find(
              (d) => d.name.toLowerCase().includes(parts[2].toLowerCase()) || d.code.toLowerCase() === parts[2].toLowerCase()
            );
            if (foundDept) deptId = foundDept.id;
          }
          if (parts[3]) major = parts[3];
          if (parts[4]) quota = parseInt(parts[4], 10) || 19;
        } else {
          fullName = parts[0];
          if (parts[1]) {
            const foundDept = departments.find(
              (d) => d.name.toLowerCase().includes(parts[1].toLowerCase()) || d.code.toLowerCase() === parts[1].toLowerCase()
            );
            if (foundDept) deptId = foundDept.id;
          }
          if (parts[2]) major = parts[2];
          if (parts[3]) quota = parseInt(parts[3], 10) || 19;
        }
      }

      if (fullName) {
        newTeachersData.push({
          code,
          fullName,
          departmentId: deptId,
          workplaceId: wpId,
          workplace: wpName,
          status: 'ACTIVE',
          standardQuota: quota,
          major,
          subjectsCanTeach: [],
        });
        currentCodeIndex++;
      }
    });

    if (newTeachersData.length === 0) return;
    try {
      dataStore.bulkAddTeachers(newTeachersData);
      setTeacherPasteText('');
      showToast(`✅ Đã thêm thành công ${newTeachersData.length} giáo viên mới vào hệ thống!`);
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi thêm giáo viên!', 'error');
    }
  };

  // Teacher Edit State
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editTeacherCode, setEditTeacherCode] = useState('');
  const [editTeacherFullName, setEditTeacherFullName] = useState('');
  const [editTeacherGender, setEditTeacherGender] = useState<'Nam' | 'Nữ'>('Nữ');
  const [editTeacherDeptId, setEditTeacherDeptId] = useState('');
  const [editTeacherWorkplaceId, setEditTeacherWorkplaceId] = useState('');
  const [editTeacherMajor, setEditTeacherMajor] = useState('');
  const [editTeacherSubjectsCanTeach, setEditTeacherSubjectsCanTeach] = useState<string[]>([]);
  const [editTeacherQuota, setEditTeacherQuota] = useState<number>(19);
  const [editTeacherPhone, setEditTeacherPhone] = useState('');
  const [editTeacherEmail, setEditTeacherEmail] = useState('');
  const [editTeacherStatus, setEditTeacherStatus] = useState<TeacherStatus>('ACTIVE');
  const [editTeacherNotes, setEditTeacherNotes] = useState('');
  const [editTeacherTimetableName, setEditTeacherTimetableName] = useState('');
  const [editTeacherPositions, setEditTeacherPositions] = useState<string[]>([]);
  const [newCustomPositionInput, setNewCustomPositionInput] = useState('');
  const [isEditTeacherDirty, setIsEditTeacherDirty] = useState(false);
  const [showUnsavedEditTeacherModal, setShowUnsavedEditTeacherModal] = useState(false);

  const handleRequestCloseEditTeacher = () => {
    if (isEditTeacherDirty) {
      setShowUnsavedEditTeacherModal(true);
    } else {
      setEditingTeacher(null);
    }
  };

  const handleStartEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setEditTeacherCode(t.code || '');
    setEditTeacherFullName(t.fullName || '');
    setEditTeacherTimetableName(t.timetableName || t.shortName || t.fullName.split(' ').slice(-1)[0] || '');
    setEditTeacherGender(t.gender === 'Nam' ? 'Nam' : 'Nữ');
    setEditTeacherDeptId(t.departmentId || departments[0]?.id || '');
    const matchedWp =
      workplaces.find((w) => w.id === t.workplaceId) ||
      workplaces.find((w) => w.name === t.workplace) ||
      defaultWp;
    setEditTeacherWorkplaceId(matchedWp?.id || '');
    setEditTeacherMajor(t.major || 'Sư phạm');
    setEditTeacherSubjectsCanTeach(t.subjectsCanTeach || []);
    setEditTeacherQuota(t.standardQuota || 19);
    setEditTeacherPhone(t.phone || '');
    setEditTeacherEmail(t.email || '');
    setEditTeacherStatus(t.status || 'ACTIVE');
    setEditTeacherNotes(t.notes || '');
    const curPos = getTeacherPositions(t, departments, duties, assignments);
    setEditTeacherPositions(curPos);
    setNewCustomPositionInput('');
    setIsEditTeacherDirty(false);
    setShowUnsavedEditTeacherModal(false);
  };

  const handleSaveEditTeacher = () => {
    if (!editingTeacher) return;
    if (!editTeacherFullName.trim()) {
      showToast('Họ và tên giáo viên không được để trống!', 'error');
      return;
    }
    const chosenWp = workplaces.find((w) => w.id === editTeacherWorkplaceId) || defaultWp;

    const cleanPositions: string[] = Array.from(
      new Set(editTeacherPositions.map((p) => normalizePositionName(p)).filter((p): p is string => Boolean(p)))
    );

    dataStore.syncTeacherPositions(editingTeacher.id, cleanPositions, editTeacherDeptId);

    const oldQuota = editingTeacher.standardQuota || 19;
    const newQuota = Number(editTeacherQuota) || 19;

    const success = dataStore.updateTeacher(editingTeacher.id, {
      code: editTeacherCode.trim().toUpperCase(),
      fullName: editTeacherFullName.trim(),
      timetableName: editTeacherTimetableName.trim(),
      gender: editTeacherGender,
      departmentId: editTeacherDeptId,
      workplaceId: chosenWp?.id,
      workplace: chosenWp?.name,
      positions: cleanPositions,
      major: editTeacherMajor.trim(),
      subjectsCanTeach: editTeacherSubjectsCanTeach,
      standardQuota: newQuota,
      phone: editTeacherPhone.trim(),
      email: editTeacherEmail.trim(),
      status: editTeacherStatus,
      notes: editTeacherNotes.trim(),
    });
    if (success) {
      if (oldQuota !== newQuota) {
        toastService.notifyQuotaChange(editTeacherFullName.trim(), oldQuota, newQuota);
      } else {
        toastService.notify({
          category: 'quota',
          type: 'success',
          title: 'Cập nhật hồ sơ giáo viên',
          teacherName: editTeacherFullName.trim(),
          message: `${editTeacherFullName.trim()}: sửa thông tin hồ sơ giáo viên thành công`,
        });
      }
      showToast(`Đã cập nhật thông tin giáo viên "${editTeacherFullName.trim()}" thành công!`);
      setIsEditTeacherDirty(false);
      setShowUnsavedEditTeacherModal(false);
      setEditingTeacher(null);
    } else {
      showToast('Không tìm thấy giáo viên để cập nhật!', 'error');
    }
  };

  // Teacher Delete Modals State
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);
  const [isBulkDeleteTeacherModalOpen, setIsBulkDeleteTeacherModalOpen] = useState<boolean>(false);
  const [isBulkClearDutiesTeacherModalOpen, setIsBulkClearDutiesTeacherModalOpen] = useState<boolean>(false);

  const handleConfirmDeleteSingleTeacher = () => {
    if (!teacherToDelete) return;
    const teacherName = teacherToDelete.fullName;
    dataStore.deleteTeacher(teacherToDelete.id, true);
    setSelectedTeacherIds((prev) => prev.filter((id) => id !== teacherToDelete.id));
    setTeacherToDelete(null);
    showToast(`Đã xóa giáo viên "${teacherName}" thành công!`);
  };

  const handleConfirmBulkDeleteTeachers = () => {
    if (selectedTeacherIds.length === 0) return;
    const count = dataStore.bulkDeleteTeachers(selectedTeacherIds, true);
    setSelectedTeacherIds([]);
    setIsBulkDeleteTeacherModalOpen(false);
    showToast(`Đã xóa thành công ${count} giáo viên đã chọn!`);
  };

  const handleConfirmBulkClearDutiesForTeachers = () => {
    const idsToClear = selectedTeacherIds.length > 0 ? selectedTeacherIds : activeTeachers.map((t) => t.id);
    if (idsToClear.length === 0) return;
    const count = dataStore.bulkClearDutiesForTeachers(idsToClear);
    setIsBulkClearDutiesTeacherModalOpen(false);
    setSelectedTeacherIds([]);
    showToast(`Đã xóa sạch toàn bộ kiêm nhiệm của ${idsToClear.length} giáo viên (${count} phân công)!`);
  };

  const toggleSelectAllTeachers = () => {
    if (selectedTeacherIds.length === filteredTeachers.length) {
      setSelectedTeacherIds([]);
    } else {
      setSelectedTeacherIds(filteredTeachers.map((t) => t.id));
    }
  };

  // ==========================================
  // TAB 3: SUBJECTS (MÔN HỌC) BULK STATE
  // ==========================================
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [subjectPasteText, setSubjectPasteText] = useState<string>('');

  // Single Subject Add State
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectShortName, setNewSubjectShortName] = useState('');
  const [newSubjectPeriods, setNewSubjectPeriods] = useState<number>(2);
  const [newSubjectGroup, setNewSubjectGroup] = useState('Tự nhiên');
  const [newSubjectDeptId, setNewSubjectDeptId] = useState(departments[0]?.id || '');
  const [newSubjectIsIntegrated, setNewSubjectIsIntegrated] = useState(false);
  const [newSubjectGrades, setNewSubjectGrades] = useState<number[]>([6, 7, 8, 9]);
  const [subjectFilterGrade, setSubjectFilterGrade] = useState<string>('ALL');

  // Subject Edit State
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectShortName, setEditSubjectShortName] = useState('');
  const [editSubjectPeriods, setEditSubjectPeriods] = useState<number>(2);
  const [editSubjectGroup, setEditSubjectGroup] = useState('Tự nhiên');
  const [editSubjectDeptId, setEditSubjectDeptId] = useState('');
  const [editSubjectIsIntegrated, setEditSubjectIsIntegrated] = useState(false);
  const [editSubjectActive, setEditSubjectActive] = useState(true);
  const [editSubjectGrades, setEditSubjectGrades] = useState<number[]>([6, 7, 8, 9]);

  // Subject Delete Modals State
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [isBulkDeleteSubjectModalOpen, setIsBulkDeleteSubjectModalOpen] = useState<boolean>(false);

  const handleConfirmDeleteSingleSubject = () => {
    if (!subjectToDelete) return;
    const subName = subjectToDelete.name;
    dataStore.deleteSubject(subjectToDelete.id, true);
    setSelectedSubjectIds((prev) => prev.filter((id) => id !== subjectToDelete.id));
    setSubjectToDelete(null);
    showToast(`Đã xóa môn học "${subName}" thành công!`);
  };

  const handleConfirmBulkDeleteSubjects = () => {
    if (selectedSubjectIds.length === 0) return;
    const count = dataStore.bulkDeleteSubjects(selectedSubjectIds, true);
    setSelectedSubjectIds([]);
    setIsBulkDeleteSubjectModalOpen(false);
    showToast(`Đã xóa thành công ${count} môn học đã chọn!`);
  };

  const handleAddSingleSubject = () => {
    const code = newSubjectCode.trim().toUpperCase();
    const name = newSubjectName.trim();
    if (!code) {
      showToast('Vui lòng nhập Mã môn học (VD: TOAN, PHAP, KNS)', 'error');
      return;
    }
    if (!name) {
      showToast('Vui lòng nhập Tên môn học (VD: Tiếng Pháp, Kỹ năng sống)', 'error');
      return;
    }
    if (subjects.some((s) => s.code.toUpperCase() === code)) {
      showToast(`Mã môn "${code}" đã tồn tại trong hệ thống!`, 'error');
      return;
    }

    const periods = Math.max(0.5, Number(newSubjectPeriods) || 2);
    const shortName = newSubjectShortName.trim() || (name.length > 8 ? name.substring(0, 8) : name);
    const targetGrades = newSubjectGrades.length > 0 ? newSubjectGrades : [6, 7, 8, 9];
    const newSub = dataStore.addSubject({
      code,
      name,
      shortName,
      group: newSubjectGroup,
      applicableGrades: targetGrades,
      departmentId: newSubjectDeptId || departments[0]?.id || '',
      allowsMultipleTeachers: newSubjectIsIntegrated,
      isIntegrated: newSubjectIsIntegrated,
      active: true,
      color: '#2563eb',
      periodsPerWeek: periods,
    });

    // Tự động khởi tạo khung số tiết cho môn mới vào các khối được chọn
    if (newSub) {
      const weeks = semesterId === 'HK1' ? 18 : 17;
      const todayStr = new Date().toISOString().split('T')[0];
      const currItems = [6, 7, 8, 9].map((grade) => ({
        schoolYearId,
        semesterId,
        grade: grade as 6 | 7 | 8 | 9,
        subjectId: newSub.id,
        periodsPerWeek: targetGrades.includes(grade) ? periods : 0,
        weeks,
        effectiveDate: todayStr,
        status: 'approved' as const,
      }));
      dataStore.bulkUpsertCurriculum(currItems);
    }

    setNewSubjectCode('');
    setNewSubjectName('');
    setNewSubjectShortName('');
    setNewSubjectPeriods(2);
    setNewSubjectIsIntegrated(false);
    setNewSubjectGrades([6, 7, 8, 9]);
    showToast(`Đã thêm thành công môn "${name}" (${code}) áp dụng Khối [${targetGrades.join(', ')}] với ${periods} tiết/tuần!`);
  };

  const handleStartEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setEditSubjectCode(s.code || '');
    setEditSubjectName(s.name || '');
    setEditSubjectShortName(s.shortName || '');
    setEditSubjectGroup(s.group || 'Tự nhiên');
    setEditSubjectDeptId(s.departmentId || departments[0]?.id || '');
    setEditSubjectIsIntegrated(Boolean(s.isIntegrated));
    setEditSubjectActive(s.active !== false);
    setEditSubjectGrades(s.applicableGrades && s.applicableGrades.length > 0 ? [...s.applicableGrades] : [6, 7, 8, 9]);

    // Lấy số tiết hiện thời từ môn học hoặc khung chương trình
    const existingCurr = curriculums.find(
      (c) => c.subjectId === s.id && c.semesterId === semesterId && c.schoolYearId === schoolYearId && (c.periodsPerWeek || 0) > 0
    );
    const periods = s.periodsPerWeek ?? existingCurr?.periodsPerWeek ?? 2;
    setEditSubjectPeriods(periods);
  };

  const handleSaveEditSubject = () => {
    if (!editingSubject) return;
    const code = editSubjectCode.trim().toUpperCase();
    const name = editSubjectName.trim();
    if (!code || !name) {
      showToast('Mã môn và tên môn học không được để trống!', 'error');
      return;
    }
    const periods = Math.max(0.5, Number(editSubjectPeriods) || 2);
    const shortName = editSubjectShortName.trim() || (name.length > 8 ? name.substring(0, 8) : name);
    const grades = editSubjectGrades.length > 0 ? editSubjectGrades : [6, 7, 8, 9];

    const success = dataStore.updateSubject(editingSubject.id, {
      code,
      name,
      shortName,
      group: editSubjectGroup,
      departmentId: editSubjectDeptId,
      isIntegrated: editSubjectIsIntegrated,
      allowsMultipleTeachers: editSubjectIsIntegrated,
      active: editSubjectActive,
      periodsPerWeek: periods,
      applicableGrades: grades,
    });

    // Đồng bộ số tiết sang khung chương trình (nếu khối không áp dụng thì gán 0)
    const weeks = semesterId === 'HK1' ? 18 : 17;
    const todayStr = new Date().toISOString().split('T')[0];
    const currItems = [6, 7, 8, 9].map((grade) => ({
      schoolYearId,
      semesterId,
      grade: grade as 6 | 7 | 8 | 9,
      subjectId: editingSubject.id,
      periodsPerWeek: grades.includes(grade) ? periods : 0,
      weeks,
      effectiveDate: todayStr,
      status: 'approved' as const,
    }));
    dataStore.bulkUpsertCurriculum(currItems);

    if (success) {
      showToast(`Đã cập nhật môn học "${name}" áp dụng Khối [${grades.join(', ')}] thành công!`);
      setEditingSubject(null);
    } else {
      showToast('Không tìm thấy môn học để cập nhật!', 'error');
    }
  };

  // Cấu hình Môn học Buổi 2 (Tăng cường & Bồi dưỡng theo từng khối)
  const [editingSession2Subject, setEditingSession2Subject] = useState<Subject | null>(null);
  const [s2FormHasSession2, setS2FormHasSession2] = useState<boolean>(true);
  const [s2FormApplicableGrades, setS2FormApplicableGrades] = useState<number[]>([6, 7, 8, 9]);
  const [s2FormActiveGradeTab, setS2FormActiveGradeTab] = useState<number>(6);
  const [s2FormGradeConfigs, setS2FormGradeConfigs] = useState<Record<number, import('../types').GradeSession2Config>>({
    6: { bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 },
    7: { bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 },
    8: { bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 },
    9: { bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 },
  });
  const [s2FormNotes, setS2FormNotes] = useState<string>('');

  const handleOpenEditSession2 = (s: Subject) => {
    setEditingSession2Subject(s);
    const cfg = s.session2Config;
    const hasS2 = Boolean(s.isSession2 || cfg?.hasSession2);
    setS2FormHasSession2(hasS2);

    // Lấy các khối được gán Buổi 2: nếu có trong session2Config thì lấy, nếu không lấy theo subject.applicableGrades
    const appGrades = (cfg?.applicableGrades && cfg.applicableGrades.length > 0)
      ? [...cfg.applicableGrades]
      : (s.applicableGrades && s.applicableGrades.length > 0)
        ? [...s.applicableGrades]
        : [6, 7, 8, 9];

    setS2FormApplicableGrades(appGrades);
    setS2FormActiveGradeTab(appGrades[0] || 6);

    // Điền cấu hình từng khối (ưu tiên gradeConfigs, sau đó fallback từ cấu hình chung)
    const initialConfigs: Record<number, import('../types').GradeSession2Config> = {};
    [6, 7, 8, 9].forEach((g) => {
      const gCfg = cfg?.gradeConfigs?.[g];
      if (gCfg) {
        initialConfigs[g] = { ...gCfg };
      } else {
        const isApp = appGrades.includes(g);
        initialConfigs[g] = {
          hasSession2: isApp,
          bdClasses: isApp ? (cfg?.bdClasses || 0) : 0,
          bdPeriods: isApp ? (cfg?.bdPeriods || (cfg?.bdClasses ? cfg.bdClasses * 70 : 0)) : 0,
          pdClasses: isApp ? (cfg?.pdClasses || 0) : 0,
          pdPeriods: isApp ? (cfg?.pdPeriods || (cfg?.pdClasses ? cfg.pdClasses * 70 : 0)) : 0,
          examClasses: (isApp && g === 9) ? (cfg?.examClasses || 0) : 0,
          examPeriods: (isApp && g === 9) ? (cfg?.examPeriods || (cfg?.examClasses ? cfg.examClasses * 70 : 0)) : 0,
        };
      }
    });
    setS2FormGradeConfigs(initialConfigs);
    setS2FormNotes(cfg?.notes || '');
  };

  const handleCopyCurrentGradeConfigToAll = (sourceGrade: number) => {
    const src = s2FormGradeConfigs[sourceGrade];
    if (!src) return;
    setS2FormGradeConfigs((prev) => {
      const next = { ...prev };
      s2FormApplicableGrades.forEach((g) => {
        next[g] = {
          ...src,
          examClasses: g === 9 ? src.examClasses : (src.examClasses || 0),
          examPeriods: g === 9 ? src.examPeriods : (src.examPeriods || 0),
        };
      });
      return next;
    });
    showToast(`Đã sao chép cấu hình Buổi 2 của Khối ${sourceGrade} cho các khối [${s2FormApplicableGrades.join(', ')}]!`);
  };

  const handleSaveSession2 = () => {
    if (!editingSession2Subject) return;

    const filteredGradeConfigs: Record<number, import('../types').GradeSession2Config> = {};
    let totalBdClasses = 0;
    let totalBdPeriods = 0;
    let totalPdClasses = 0;
    let totalPdPeriods = 0;
    let totalExamClasses = 0;
    let totalExamPeriods = 0;

    [6, 7, 8, 9].forEach((g) => {
      const isAssigned = s2FormApplicableGrades.includes(g);
      const conf = s2FormGradeConfigs[g] || { bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 };
      const hasForGrade = isAssigned && ((conf.bdClasses || 0) > 0 || (conf.pdClasses || 0) > 0 || (conf.examClasses || 0) > 0);

      filteredGradeConfigs[g] = {
        hasSession2: hasForGrade,
        bdClasses: isAssigned ? (conf.bdClasses || 0) : 0,
        bdPeriods: isAssigned ? (conf.bdPeriods || (conf.bdClasses ? conf.bdClasses * 70 : 0)) : 0,
        pdClasses: isAssigned ? (conf.pdClasses || 0) : 0,
        pdPeriods: isAssigned ? (conf.pdPeriods || (conf.pdClasses ? conf.pdClasses * 70 : 0)) : 0,
        examClasses: isAssigned ? (conf.examClasses || 0) : 0,
        examPeriods: isAssigned ? (conf.examPeriods || (conf.examClasses ? conf.examClasses * 70 : 0)) : 0,
      };

      if (isAssigned) {
        totalBdClasses += conf.bdClasses || 0;
        totalBdPeriods += conf.bdPeriods || ((conf.bdClasses || 0) * 70);
        totalPdClasses += conf.pdClasses || 0;
        totalPdPeriods += conf.pdPeriods || ((conf.pdClasses || 0) * 70);
        totalExamClasses += conf.examClasses || 0;
        totalExamPeriods += conf.examPeriods || ((conf.examClasses || 0) * 70);
      }
    });

    const hasS2 = s2FormHasSession2 && (totalBdClasses > 0 || totalPdClasses > 0 || totalExamClasses > 0 || s2FormApplicableGrades.length > 0);

    const config: import('../types').SubjectSession2Config = {
      hasSession2: hasS2,
      session2Type: 'ALL',
      applicableGrades: s2FormApplicableGrades,
      gradeConfigs: filteredGradeConfigs,
      bdClasses: totalBdClasses,
      bdPeriods: totalBdPeriods,
      pdClasses: totalPdClasses,
      pdPeriods: totalPdPeriods,
      examClasses: totalExamClasses,
      examPeriods: totalExamPeriods,
      notes: s2FormNotes.trim(),
    };

    dataStore.updateSubject(editingSession2Subject.id, {
      isSession2: hasS2,
      session2Config: config,
    });

    showToast(`Đã lưu cấu hình Buổi 2 môn "${editingSession2Subject.name}" cho các Khối [${s2FormApplicableGrades.join(', ')}] và đồng bộ 2 chiều sang Khung KHDH!`);
    setEditingSession2Subject(null);
  };

  const handleQuickToggleGrade = (subjectId: string, grade: number) => {
    const success = dataStore.toggleSubjectApplicableGrade(subjectId, grade);
    if (!success) {
      showToast('Môn học phải được áp dụng cho ít nhất một khối lớp!', 'error');
    }
  };

  const handleApplyKhtnSplitConfig = () => {
    const res = dataStore.applyStandardKhtnSplit(schoolYearId, semesterId);
    if (res.success) {
      showToast(res.message);
    } else {
      showToast(res.message, 'error');
    }
  };

  const STANDARD_GDPT_SUBJECTS: Omit<Subject, 'id'>[] = [
    { code: 'TOAN', name: 'Toán học', shortName: 'Toán', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#2563eb', periodsPerWeek: 4 },
    { code: 'VAN', name: 'Ngữ văn', shortName: 'Văn', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: departments[1]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#dc2626', periodsPerWeek: 4 },
    { code: 'ANH', name: 'Tiếng Anh', shortName: 'Anh', group: 'Ngoại ngữ', applicableGrades: [6, 7, 8, 9], departmentId: departments[2]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#059669', periodsPerWeek: 3 },
    { code: 'KHTN', name: 'Khoa học tự nhiên (K6,7)', shortName: 'KHTN', group: 'Tự nhiên', applicableGrades: [6, 7], departmentId: departments[0]?.id || '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#0891b2', periodsPerWeek: 4 },
    { code: 'KHTN_LY', name: 'KHTN - Vật lí', shortName: 'Lý 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0284c7', periodsPerWeek: 1.5 },
    { code: 'KHTN_HOA', name: 'KHTN - Hóa học', shortName: 'Hóa 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#0d9488', periodsPerWeek: 1.5 },
    { code: 'KHTN_SINH', name: 'KHTN - Sinh học', shortName: 'Sinh 8-9', group: 'Tự nhiên', applicableGrades: [8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#16a34a', periodsPerWeek: 1 },
    { code: 'SU_DIA', name: 'Lịch sử & Địa lí', shortName: 'Sử-Địa', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: departments[1]?.id || '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#d97706', periodsPerWeek: 3 },
    { code: 'GDCD', name: 'Giáo dục công dân', shortName: 'GDCD', group: 'Xã hội', applicableGrades: [6, 7, 8, 9], departmentId: departments[1]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#7c3aed', periodsPerWeek: 1 },
    { code: 'TIN', name: 'Tin học', shortName: 'Tin', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#4f46e5', periodsPerWeek: 1 },
    { code: 'CONG_NGHE', name: 'Công nghệ', shortName: 'Công nghệ', group: 'Tự nhiên', applicableGrades: [6, 7, 8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#ca8a04', periodsPerWeek: 1 },
    { code: 'GDTC', name: 'Giáo dục thể chất', shortName: 'Thể dục', group: 'Thể chất', applicableGrades: [6, 7, 8, 9], departmentId: departments[3]?.id || '', allowsMultipleTeachers: false, isIntegrated: false, active: true, color: '#16a34a', periodsPerWeek: 2 },
    { code: 'NGHE_THUAT', name: 'Nghệ thuật (Âm nhạc - Mỹ thuật)', shortName: 'Nghệ thuật', group: 'Nghệ thuật', applicableGrades: [6, 7, 8, 9], departmentId: departments[3]?.id || '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#db2777', periodsPerWeek: 2 },
    { code: 'HDTN_HN', name: 'Hoạt động trải nghiệm, hướng nghiệp', shortName: 'HĐTN', group: 'Trải nghiệm', applicableGrades: [6, 7, 8, 9], departmentId: departments[0]?.id || '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#0d9488', periodsPerWeek: 3 },
    { code: 'GDDP', name: 'Nội dung giáo dục địa phương', shortName: 'GDĐP', group: 'Đặc thù', applicableGrades: [6, 7, 8, 9], departmentId: departments[1]?.id || '', allowsMultipleTeachers: true, isIntegrated: true, active: true, color: '#9333ea', periodsPerWeek: 1 },
  ];

  const handleApplyStandardSubjects = () => {
    const toAdd: Omit<Subject, 'id'>[] = [];
    STANDARD_GDPT_SUBJECTS.forEach((sub) => {
      if (!subjects.some((s) => s.code.toLowerCase() === sub.code.toLowerCase())) {
        toAdd.push(sub);
      }
    });

    if (toAdd.length === 0) {
      showToast('Tất cả 12 môn học chuẩn GDPT 2018 đã có sẵn trong hệ thống.');
      return;
    }

    const addedSubs = dataStore.bulkAddSubjects(toAdd);
    const weeks = semesterId === 'HK1' ? 18 : 17;
    const currItems: any[] = [];
    addedSubs.forEach((sub) => {
      if (sub.periodsPerWeek) {
        [6, 7, 8, 9].forEach((g) => {
          currItems.push({
            schoolYearId,
            semesterId,
            grade: g as 6 | 7 | 8 | 9,
            subjectId: sub.id,
            periodsPerWeek: sub.periodsPerWeek || 2,
            weeks,
          });
        });
      }
    });
    if (currItems.length > 0) {
      dataStore.bulkUpsertCurriculum(currItems);
    }
    showToast(`Đã nạp bổ sung thành công ${toAdd.length} môn học chuẩn GDPT 2018 kèm khung số tiết!`);
  };

  const handleBulkAddCustomSubjects = () => {
    let text = subjectPasteText.trim();
    if (!text) {
      setSubjectPasteText(`TIENG_PHAP, Tiếng Pháp, Ngoại ngữ\nROBOTIC, Trải nghiệm Robotic, Tự chọn, true\nGD_KNS, Kỹ năng sống, Trải nghiệm`);
      showToast('Đã nạp mẫu môn học tùy chỉnh! Bấm "Thêm danh sách môn học" lần nữa để xác nhận.');
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const toAdd: Omit<Subject, 'id'>[] = [];

    lines.forEach((line) => {
      // Formats: "TIENG_PHAP, Tiếng Pháp, Ngoại ngữ"
      const parts = line.split(/[,;\t]+/).map((p) => p.trim());
      const code = (parts[0] || '').toUpperCase();
      const name = parts[1] || parts[0];
      const group = parts[2] || 'Chuyên đề';
      const isIntegrated = parts[3]?.toLowerCase() === 'true' || parts[3]?.toLowerCase() === 'tichhop';

      if (code && !subjects.some((s) => s.code.toLowerCase() === code.toLowerCase())) {
        toAdd.push({
          code,
          name,
          shortName: name.length > 8 ? name.substring(0, 8) : name,
          group,
          applicableGrades: [6, 7, 8, 9],
          departmentId: departments[0]?.id || '',
          allowsMultipleTeachers: isIntegrated,
          isIntegrated,
          active: true,
        });
      }
    });

    if (toAdd.length === 0) {
      showToast('Không có môn học mới nào được thêm (các môn có thể đã tồn tại).', 'error');
      return;
    }

    dataStore.bulkAddSubjects(toAdd);
    setSubjectPasteText('');
    showToast(`✅ Đã thêm thành công ${toAdd.length} môn học mới vào hệ thống!`);
  };

  // ==========================================
  // TAB 4: CURRICULUM (KHUNG SỐ TIẾT) BULK STATE
  // ==========================================
  const [sourceCopyGrade, setSourceCopyGrade] = useState<number>(6);
  const [targetCopyGrades, setTargetCopyGrades] = useState<number[]>([7, 8, 9]);
  const [gridPeriods, setGridPeriods] = useState<Record<string, number>>({});

  // Standard GDPT 2018 Distribution Table: Grade -> SubjectCode -> PeriodsPerWeek
  const STANDARD_DISTRIBUTION: Record<number, Record<string, number>> = {
    6: {
      TOAN: 4, VAN: 4, ANH: 3, TIENG_ANH: 3, KHTN: 4, SU_DIA: 3, LICH_SU_DIA_LI: 3,
      GDCD: 1, TIN: 1, TIN_HOC: 1, CONG_NGHE: 1, GDTC: 2, NGHE_THUAT: 2, AM_NHAC: 1, MY_THUAT: 1,
      HDTN_HN: 3, HDKT_HN: 3, GDDP: 1, NOI_DUNG_GDDP: 1,
    },
    7: {
      TOAN: 4, VAN: 4, ANH: 3, TIENG_ANH: 3, KHTN: 4, SU_DIA: 3, LICH_SU_DIA_LI: 3,
      GDCD: 1, TIN: 1, TIN_HOC: 1, CONG_NGHE: 1, GDTC: 2, NGHE_THUAT: 2, AM_NHAC: 1, MY_THUAT: 1,
      HDTN_HN: 3, HDKT_HN: 3, GDDP: 1, NOI_DUNG_GDDP: 1,
    },
    8: {
      TOAN: 4, VAN: 4, ANH: 3, TIENG_ANH: 3, KHTN: 0, KHTN_LY: 1.5, KHTN_HOA: 1.5, KHTN_SINH: 1,
      SU_DIA: 3, LICH_SU_DIA_LI: 3, GDCD: 1, TIN: 1, TIN_HOC: 1, CONG_NGHE: 1, GDTC: 2,
      NGHE_THUAT: 2, AM_NHAC: 1, MY_THUAT: 1, HDTN_HN: 3, HDKT_HN: 3, GDDP: 1, NOI_DUNG_GDDP: 1,
    },
    9: {
      TOAN: 4, VAN: 4, ANH: 3, TIENG_ANH: 3, KHTN: 0, KHTN_LY: 1.5, KHTN_HOA: 1.5, KHTN_SINH: 1,
      SU_DIA: 3, LICH_SU_DIA_LI: 3, GDCD: 1, TIN: 1, TIN_HOC: 1, CONG_NGHE: 1, GDTC: 2,
      NGHE_THUAT: 2, AM_NHAC: 1, MY_THUAT: 1, HDTN_HN: 3, HDKT_HN: 3, GDDP: 1, NOI_DUNG_GDDP: 1,
    },
  };

  const handleApplyStandardCurriculumAllGrades = () => {
    const weeks = semesterId === 'HK1' ? 18 : 17;
    const itemsToUpsert: Omit<CurriculumDistribution, 'id' | 'totalPeriods'>[] = [];

    [6, 7, 8, 9].forEach((grade) => {
      const dist = STANDARD_DISTRIBUTION[grade];
      subjects.forEach((sub) => {
        const isApplicable = !sub.applicableGrades || sub.applicableGrades.length === 0 || sub.applicableGrades.includes(grade);
        let periods = 0;
        if (isApplicable) {
          const codeUpper = sub.code.toUpperCase();
          if (dist[codeUpper] !== undefined) {
            periods = dist[codeUpper];
          } else if (codeUpper === 'TOAN' || codeUpper === 'VAN') {
            periods = 4;
          } else if (codeUpper === 'KHTN') {
            periods = (grade === 6 || grade === 7) ? 4 : 0;
          } else {
            periods = sub.periodsPerWeek || 2;
          }
        }
        itemsToUpsert.push({
          schoolYearId,
          semesterId,
          grade: grade as any,
          subjectId: sub.id,
          periodsPerWeek: periods,
          weeks,
          effectiveDate: new Date().toISOString().split('T')[0],
          status: 'approved',
        });
      });
    });

    dataStore.bulkUpsertCurriculum(itemsToUpsert);
    showToast(`Đã áp dụng chuẩn GDPT 2018 (29 tiết/tuần) cho cả 4 khối: K6-7 KHTN chung 4 tiết, K8-9 phân môn Lý 1.5 - Hóa 1.5 - Sinh 1.0 tiết!`);
  };

  const handleCopyCurriculumGrades = () => {
    if (targetCopyGrades.length === 0) {
      showToast('Vui lòng chọn ít nhất một khối đích để sao chép', 'error');
      return;
    }

    const count = dataStore.copyCurriculumAcrossGrades(sourceCopyGrade, targetCopyGrades, schoolYearId, semesterId);
    showToast(`Đã sao chép khung số tiết từ Khối ${sourceCopyGrade} sang các Khối [${targetCopyGrades.join(', ')}] (${count} bản ghi)!`);
  };

  const handleCopyCurriculumAcrossSemester = () => {
    const targetSem: SemesterId = semesterId === 'HK1' ? 'HK2' : 'HK1';
    if (!confirm(`Bạn có muốn sao chép toàn bộ khung số tiết từ ${semesterId} sang ${targetSem}?`)) return;

    const count = dataStore.copyCurriculumAcrossSemesters(semesterId, targetSem, schoolYearId);
    showToast(`Đã sao chép thành công khung số tiết sang ${targetSem} (${count} môn/khối)!`);
  };

  // ==========================================
  // TAB 5: DEPARTMENTS (TỔ CHUYÊN MÔN) BULK STATE
  // ==========================================
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [deptSearchTerm, setDeptSearchTerm] = useState<string>('');
  const [deptInputMode, setDeptInputMode] = useState<'ASSIGN_TEACHERS' | 'MANUAL'>('ASSIGN_TEACHERS');
  const [deptFormName, setDeptFormName] = useState<string>('');
  const [deptFormFullName, setDeptFormFullName] = useState<string>('');
  const [deptFormCode, setDeptFormCode] = useState<string>('');
  const [deptFormHeadTeacherId, setDeptFormHeadTeacherId] = useState<string>('');
  const [deptFormDeputyTeacherIds, setDeptFormDeputyTeacherIds] = useState<string[]>([]);
  const [deptFormActive, setDeptFormActive] = useState<boolean>(true);

  // New Teacher-to-Department Assignment State
  const [assignDeptId, setAssignDeptId] = useState<string>('');
  const [assignTeacherSearch, setAssignTeacherSearch] = useState<string>('');
  const [assignTeacherFilter, setAssignTeacherFilter] = useState<'ALL' | 'IN_DEPT' | 'UNASSIGNED' | 'OTHER_DEPTS'>('ALL');
  const [selectedTeacherIdsForDept, setSelectedTeacherIdsForDept] = useState<string[]>([]);

  // Effective department to assign teachers
  const currentAssignDept = useMemo(() => {
    if (assignDeptId) {
      const found = departments.find((d) => d.id === assignDeptId);
      if (found) return found;
    }
    return departments[0] || null;
  }, [departments, assignDeptId]);

  // Sync selected teachers whenever currentAssignDept changes or activeTeachers changes
  React.useEffect(() => {
    if (currentAssignDept) {
      const assignedIds = activeTeachers
        .filter((t) => t.departmentId === currentAssignDept.id)
        .map((t) => t.id);
      setSelectedTeacherIdsForDept(assignedIds);
    } else {
      setSelectedTeacherIdsForDept([]);
    }
  }, [currentAssignDept?.id, activeTeachers]);

  // Filtered teachers list for assignment
  const filteredTeachersForAssignment = useMemo(() => {
    if (!currentAssignDept) return [];
    let list = [...activeTeachers];

    // Filter by category
    if (assignTeacherFilter === 'IN_DEPT') {
      list = list.filter((t) => selectedTeacherIdsForDept.includes(t.id));
    } else if (assignTeacherFilter === 'UNASSIGNED') {
      list = list.filter((t) => !t.departmentId);
    } else if (assignTeacherFilter === 'OTHER_DEPTS') {
      list = list.filter((t) => t.departmentId && t.departmentId !== currentAssignDept.id);
    }

    // Search filter (hỗ trợ tiếng Việt không dấu & viết tắt)
    if (assignTeacherSearch.trim()) {
      list = list.filter((t) => {
        const subjectNames = (t.subjectsCanTeach || []).map(
          (sId) => subjects.find((s) => s.id === sId)?.name || sId
        );
        return matchesQuery(
          assignTeacherSearch,
          t.fullName,
          t.code,
          t.major,
          ...subjectNames
        );
      });
    }

    return list;
  }, [activeTeachers, currentAssignDept, assignTeacherFilter, selectedTeacherIdsForDept, assignTeacherSearch, subjects]);

  const handleToggleTeacherInDept = (teacherId: string) => {
    setSelectedTeacherIdsForDept((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    );
  };

  const handleSelectAllVisibleTeachersForDept = () => {
    const visibleIds = filteredTeachersForAssignment.map((t) => t.id);
    setSelectedTeacherIdsForDept((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleDeselectAllVisibleTeachersForDept = () => {
    const visibleIds = new Set(filteredTeachersForAssignment.map((t) => t.id));
    setSelectedTeacherIdsForDept((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const handleSaveTeacherAssignment = () => {
    if (!currentAssignDept) {
      showToast('Vui lòng chọn một tổ chuyên môn để gán giáo viên!', 'error');
      return;
    }
    dataStore.setDepartmentTeachers(currentAssignDept.id, selectedTeacherIdsForDept);
    showToast(`✅ Đã lưu phân công ${selectedTeacherIdsForDept.length} giáo viên vào "${currentAssignDept.name}"!`);
  };

  // Modals for Department
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState<string>('');
  const [editDeptFullName, setEditDeptFullName] = useState<string>('');
  const [editDeptCode, setEditDeptCode] = useState<string>('');
  const [editDeptHeadTeacherId, setEditDeptHeadTeacherId] = useState<string>('');
  const [editDeptDeputyTeacherIds, setEditDeptDeputyTeacherIds] = useState<string[]>([]);
  const [editDeptActive, setEditDeptActive] = useState<boolean>(true);

  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isBulkDeleteDeptModalOpen, setIsBulkDeleteDeptModalOpen] = useState<boolean>(false);
  const [viewingDeptDetails, setViewingDeptDetails] = useState<Department | null>(null);

  const filteredDepartments = useMemo(() => {
    if (!deptSearchTerm.trim()) return departments;
    const term = deptSearchTerm.toLowerCase().trim();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        (d.fullName && d.fullName.toLowerCase().includes(term)) ||
        d.code.toLowerCase().includes(term) ||
        teachers.find((t) => t.id === d.headTeacherId)?.fullName.toLowerCase().includes(term)
    );
  }, [departments, deptSearchTerm, teachers]);

  const handleCreateDepartment = () => {
    const name = deptFormName.trim();
    if (!name) {
      showToast('Vui lòng nhập tên tổ chuyên môn!', 'error');
      return;
    }
    const fullName = deptFormFullName.trim() || (name.startsWith('Tổ ') ? name : `Tổ ${name}`);
    let code = deptFormCode.trim();
    if (!code) {
      code = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toUpperCase();
      if (!code.startsWith('TO_') && !code.startsWith('DEPT_')) {
        code = `TO_${code}`;
      }
    }

    if (departments.some((d) => d.code.toLowerCase() === code.toLowerCase())) {
      showToast(`Mã tổ "${code}" đã tồn tại. Vui lòng chọn mã khác!`, 'error');
      return;
    }

    const cleanDeputies = deptFormDeputyTeacherIds.filter(Boolean);

    dataStore.addDepartment({
      code,
      name,
      fullName,
      headTeacherId: deptFormHeadTeacherId || undefined,
      deputyTeacherId: cleanDeputies[0] || undefined,
      deputyTeacherIds: cleanDeputies,
      teacherIds: [],
      active: deptFormActive,
    });

    setDeptFormName('');
    setDeptFormFullName('');
    setDeptFormCode('');
    setDeptFormHeadTeacherId('');
    setDeptFormDeputyTeacherIds([]);
    setDeptFormActive(true);
    showToast(`✅ Đã thêm tổ chuyên môn "${name}" thành công!`);
  };

  const handleStartEditDept = (dept: Department) => {
    setEditingDept(dept);
    setEditDeptName(dept.name);
    setEditDeptFullName(dept.fullName || (dept.name.startsWith('Tổ ') ? dept.name : `Tổ ${dept.name}`));
    setEditDeptCode(dept.code);
    setEditDeptHeadTeacherId(dept.headTeacherId || '');
    const depIds = Array.isArray(dept.deputyTeacherIds) && dept.deputyTeacherIds.length > 0
      ? dept.deputyTeacherIds
      : dept.deputyTeacherId
      ? [dept.deputyTeacherId]
      : [];
    setEditDeptDeputyTeacherIds(depIds);
    setEditDeptActive(dept.active !== false);
  };

  const handleSaveEditDept = () => {
    if (!editingDept) return;
    const name = editDeptName.trim();
    const fullName = editDeptFullName.trim() || (name.startsWith('Tổ ') ? name : `Tổ ${name}`);
    const code = editDeptCode.trim();
    if (!name) {
      showToast('Tên tổ chuyên môn không được để trống!', 'error');
      return;
    }
    if (!code) {
      showToast('Mã tổ chuyên môn không được để trống!', 'error');
      return;
    }

    const duplicate = departments.some((d) => d.id !== editingDept.id && d.code.toLowerCase() === code.toLowerCase());
    if (duplicate) {
      showToast(`Mã tổ "${code}" đã được sử dụng bởi tổ khác!`, 'error');
      return;
    }

    const cleanDeputies = editDeptDeputyTeacherIds.filter(Boolean);

    dataStore.updateDepartment(editingDept.id, {
      name,
      fullName,
      code,
      headTeacherId: editDeptHeadTeacherId || undefined,
      deputyTeacherId: cleanDeputies[0] || undefined,
      deputyTeacherIds: cleanDeputies,
      active: editDeptActive,
    });

    setEditingDept(null);
    showToast(`✅ Đã cập nhật thông tin tổ "${name}" thành công!`);
  };

  const handleConfirmDeleteSingleDept = () => {
    if (!deptToDelete) return;
    const deptName = deptToDelete.name;
    dataStore.deleteDepartment(deptToDelete.id);
    setSelectedDeptIds((prev) => prev.filter((id) => id !== deptToDelete.id));
    setDeptToDelete(null);
    showToast(`Đã xóa tổ "${deptName}" thành công!`);
  };

  const handleConfirmBulkDeleteDepts = () => {
    if (selectedDeptIds.length === 0) return;
    const count = dataStore.bulkDeleteDepartments(selectedDeptIds);
    setSelectedDeptIds([]);
    setIsBulkDeleteDeptModalOpen(false);
    showToast(`Đã xóa ${count} tổ chuyên môn đã chọn!`);
  };

  // ==========================================
  // TAB 6: DUTIES (KIÊM NHIỆM & MIỄN GIẢM) BULK STATE
  // ==========================================
  const [selectedDutyIds, setSelectedDutyIds] = useState<string[]>([]);
  const [assignDutyId, setAssignDutyId] = useState<string>(duties[0]?.id || '');
  const [assignDutyTeacherIds, setAssignDutyTeacherIds] = useState<string[]>([]);
  const [isBulkClearDutyTeacherModalOpen, setIsBulkClearDutyTeacherModalOpen] = useState<boolean>(false);
  const [dutyAssignTeacherSearch, setDutyAssignTeacherSearch] = useState<string>('');
  const [assignedDutySearchTerm, setAssignedDutySearchTerm] = useState<string>('');
  const [assignedDutyTypeFilter, setAssignedDutyTypeFilter] = useState<'ALL' | 'CONCURRENT' | 'EXEMPTION'>('ALL');
  const [selectedAssignedDutyIds, setSelectedAssignedDutyIds] = useState<string[]>([]);
  const [assignmentToDelete, setAssignmentToDelete] = useState<{ id: string; teacherName: string; dutyName: string; teacherId?: string; dutyId?: string } | null>(null);
  const [dutiesViewTab, setDutiesViewTab] = useState<'CATALOG' | 'ASSIGNED_LIST'>('CATALOG');

  // Add Duty Modal State
  const [isAddDutyModalOpen, setIsAddDutyModalOpen] = useState<boolean>(false);
  const [newDutyName, setNewDutyName] = useState<string>('');
  const [newDutyCode, setNewDutyCode] = useState<string>('');
  const [newDutyType, setNewDutyType] = useState<'CONCURRENT' | 'EXEMPTION'>('CONCURRENT');
  const [newDutyCalculated, setNewDutyCalculated] = useState<number>(2);
  const [newDutyExempted, setNewDutyExempted] = useState<number>(0);
  const [newDutyNotes, setNewDutyNotes] = useState<string>('');

  // Edit Duty Modal State
  const [editingDuty, setEditingDuty] = useState<SpecialDuty | null>(null);
  const [editDutyName, setEditDutyName] = useState<string>('');
  const [editDutyCode, setEditDutyCode] = useState<string>('');
  const [editDutyType, setEditDutyType] = useState<'CONCURRENT' | 'EXEMPTION'>('CONCURRENT');
  const [editDutyCalculated, setEditDutyCalculated] = useState<number>(0);
  const [editDutyExempted, setEditDutyExempted] = useState<number>(0);
  const [editDutyNotes, setEditDutyNotes] = useState<string>('');

  // Duty Delete Confirmation State
  const [dutyToDelete, setDutyToDelete] = useState<SpecialDuty | null>(null);

  const handleOpenAddDuty = () => {
    setNewDutyName('');
    setNewDutyCode('');
    setNewDutyType('CONCURRENT');
    setNewDutyCalculated(2);
    setNewDutyExempted(0);
    setNewDutyNotes('');
    setIsAddDutyModalOpen(true);
  };

  const handleCreateDuty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDutyName.trim()) {
      showToast('Vui lòng nhập tên nhiệm vụ kiêm nhiệm / miễn giảm!', 'error');
      return;
    }
    const code = newDutyCode.trim()
      ? newDutyCode.trim().toUpperCase()
      : newDutyName
          .trim()
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '_')
          .slice(0, 15);

    dataStore.addDuty({
      code,
      name: newDutyName.trim(),
      type: newDutyType,
      periodsPerWeekCalculated: newDutyType === 'CONCURRENT' ? Number(newDutyCalculated) || 0 : 0,
      periodsPerWeekExempted: newDutyType === 'EXEMPTION' ? Number(newDutyExempted) || 0 : 0,
      applicationMode: 'FIXED',
      notes: newDutyNotes.trim(),
    });

    setIsAddDutyModalOpen(false);
    showToast(`Đã thêm nhiệm vụ "${newDutyName.trim()}" vào danh mục thành công!`);
  };

  const handleOpenEditDuty = (duty: SpecialDuty) => {
    setEditingDuty(duty);
    setEditDutyName(duty.name);
    setEditDutyCode(duty.code);
    setEditDutyType(duty.type);
    setEditDutyCalculated(duty.periodsPerWeekCalculated || 0);
    setEditDutyExempted(duty.periodsPerWeekExempted || 0);
    setEditDutyNotes(duty.notes || '');
  };

  const handleSaveEditDuty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDuty) return;
    if (!editDutyName.trim()) {
      showToast('Tên nhiệm vụ không được để trống!', 'error');
      return;
    }

    dataStore.updateDuty(editingDuty.id, {
      name: editDutyName.trim(),
      code: editDutyCode.trim().toUpperCase(),
      type: editDutyType,
      periodsPerWeekCalculated: editDutyType === 'CONCURRENT' ? Number(editDutyCalculated) || 0 : 0,
      periodsPerWeekExempted: editDutyType === 'EXEMPTION' ? Number(editDutyExempted) || 0 : 0,
      notes: editDutyNotes.trim(),
    });

    setEditingDuty(null);
    showToast(`Đã cập nhật nhiệm vụ "${editDutyName.trim()}" thành công!`);
  };

  const handleConfirmDeleteDuty = () => {
    if (!dutyToDelete) return;
    const name = dutyToDelete.name;
    dataStore.deleteDuty(dutyToDelete.id);
    setSelectedDutyIds((prev) => prev.filter((id) => id !== dutyToDelete.id));
    setDutyToDelete(null);
    showToast(`Đã xóa nhiệm vụ "${name}" khỏi danh mục!`);
  };

  // Lọc bỏ triệt để mọi nhiệm vụ / tiết miễn mặc định cho Hiệu trưởng, Phó hiệu trưởng và Nghỉ sinh trong mục Kiêm nhiệm
  const isExcludedDuty = (d: { code?: string; name?: string; id?: string }) => {
    const normName = (d.name || '').toLowerCase().trim();
    const code = (d.code || '').toUpperCase().trim();
    const id = (d.id || '').toLowerCase().trim();
    return (
      code === 'HIEU_TRUONG' ||
      code === 'PHO_HIEU_TRUONG' ||
      code === 'PHO_HT' ||
      code === 'HT' ||
      code === 'NGHI_SINH' ||
      code === 'THAI_SAN' ||
      code === 'MATERNITY' ||
      id.startsWith('duty_hieu_truong') ||
      id.startsWith('duty_pho_hieu_truong') ||
      id.startsWith('duty_pho_ht') ||
      id.startsWith('duty_nghi_sinh') ||
      id.startsWith('duty_thai_san') ||
      normName.includes('hiệu trưởng') ||
      normName.includes('phó hiệu') ||
      normName.includes('nghỉ sinh') ||
      normName.includes('thai sản')
    );
  };

  const activeDuties = useMemo(() => {
    return (duties || []).filter((d) => !isExcludedDuty(d));
  }, [duties]);

  const currentVersionDutyAssignments = useMemo(() => {
    return assignments.filter(
      (a) =>
        a.schoolYearId === schoolYearId &&
        a.semesterId === semesterId &&
        a.versionId === versionId &&
        !a.isDeleted &&
        (a.type === 'CONCURRENT' || a.type === 'OTHER' || !!a.dutyId || !!a.dutyName) &&
        !isExcludedDuty({ code: a.dutyId, name: a.dutyName, id: a.dutyId })
    );
  }, [assignments, schoolYearId, semesterId, versionId]);

  const filteredActiveTeachersForDuty = useMemo(() => {
    if (!dutyAssignTeacherSearch.trim()) return activeTeachers;
    return activeTeachers.filter((t) =>
      matchesQuery(
        dutyAssignTeacherSearch,
        t.fullName,
        t.code,
        t.major,
        ...(t.subjectsCanTeach || [])
      )
    );
  }, [activeTeachers, dutyAssignTeacherSearch]);

  const filteredAssignedDuties = useMemo(() => {
    let list = currentVersionDutyAssignments;
    if (assignedDutyTypeFilter !== 'ALL') {
      list = list.filter((a) =>
        assignedDutyTypeFilter === 'EXEMPTION' ? a.type === 'EXEMPTION' : a.type !== 'EXEMPTION'
      );
    }
    if (assignedDutySearchTerm.trim()) {
      const q = assignedDutySearchTerm.toLowerCase().trim();
      list = list.filter((asg) => {
        const teacher = teachers.find((t) => t.id === asg.teacherId);
        const matchTeacher =
          (teacher?.fullName || '').toLowerCase().includes(q) ||
          (teacher?.code || '').toLowerCase().includes(q);
        const matchDuty = (asg.dutyName || '').toLowerCase().includes(q);
        return matchTeacher || matchDuty;
      });
    }
    return list;
  }, [currentVersionDutyAssignments, assignedDutySearchTerm, assignedDutyTypeFilter, teachers]);

  const STANDARD_DUTIES_CATALOG: Omit<SpecialDuty, 'id'>[] = [
    { code: 'CHU_NHIEM', name: 'Chủ nhiệm lớp (4 tiết/tuần)', type: 'CONCURRENT', periodsPerWeekCalculated: 4, periodsPerWeekExempted: 0, applicationMode: 'BY_CLASS', notes: 'Thông tư 16/2017 & 28/2009' },
    { code: 'TO_TRUONG', name: 'Tổ trưởng chuyên môn (3 tiết/tuần)', type: 'CONCURRENT', periodsPerWeekCalculated: 3, periodsPerWeekExempted: 0, applicationMode: 'FIXED', notes: 'Giảm định mức 3 tiết/tuần' },
    { code: 'TO_PHO', name: 'Tổ phó chuyên môn (1 tiết/tuần)', type: 'CONCURRENT', periodsPerWeekCalculated: 1, periodsPerWeekExempted: 0, applicationMode: 'FIXED', notes: 'Giảm định mức 1 tiết/tuần' },
    { code: 'TONG_PHU_TRACH', name: 'Tổng phụ trách Đội TNTP', type: 'CONCURRENT', periodsPerWeekCalculated: 17, periodsPerWeekExempted: 0, applicationMode: 'FIXED', notes: 'Dạy 2 tiết chuyên môn, 17 tiết kiêm nhiệm' },
    { code: 'TRUONG_BAN_TTND', name: 'Trưởng ban Thanh tra nhân dân', type: 'CONCURRENT', periodsPerWeekCalculated: 2, periodsPerWeekExempted: 0, applicationMode: 'FIXED', notes: 'Giảm định mức 2 tiết/tuần' },
    { code: 'THIET_BI_THI_NGHIEM', name: 'Phụ trách phòng Thiết bị / Thí nghiệm', type: 'CONCURRENT', periodsPerWeekCalculated: 3, periodsPerWeekExempted: 0, applicationMode: 'FIXED', notes: 'Giảm định mức 3 tiết/tuần' },
    { code: 'TAP_SU', name: 'Giáo viên tập sự (Giảm 2 tiết)', type: 'EXEMPTION', periodsPerWeekCalculated: 0, periodsPerWeekExempted: 2, applicationMode: 'FIXED', notes: 'Định mức 17 tiết (Giảm 2 tiết)' },
  ];

  const handleApplyStandardDuties = () => {
    const toAdd: Omit<SpecialDuty, 'id'>[] = [];
    STANDARD_DUTIES_CATALOG.forEach((d) => {
      if (!activeDuties.some((dt) => dt.code.toLowerCase() === d.code.toLowerCase())) {
        toAdd.push(d);
      }
    });

    if (toAdd.length === 0) {
      showToast('Tất cả danh mục kiêm nhiệm & miễn giảm chuẩn đã có sẵn.');
      return;
    }

    dataStore.bulkAddDuties(toAdd);
    showToast(`Đã thêm thành công ${toAdd.length} danh mục kiêm nhiệm & miễn giảm!`);
  };

  const handleBulkAssignDuties = () => {
    if (assignDutyTeacherIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một giáo viên để gán nhiệm vụ!', 'error');
      return;
    }
    const targetDuty = duties.find((d) => d.id === assignDutyId);
    if (!targetDuty) {
      showToast('Vui lòng chọn nhiệm vụ kiêm nhiệm hợp lệ', 'error');
      return;
    }

    const periods = targetDuty.periodsPerWeekCalculated || targetDuty.periodsPerWeekExempted || 2;
    const type = targetDuty.type === 'EXEMPTION' ? 'EXEMPTION' : 'CONCURRENT';

    const count = dataStore.bulkAssignDutiesToTeachers(
      assignDutyTeacherIds,
      targetDuty.id,
      targetDuty.name,
      periods,
      type,
      schoolYearId,
      semesterId,
      versionId,
      `Gán kiêm nhiệm: ${targetDuty.name}`
    );

    setAssignDutyTeacherIds([]);
    showToast(`Đã gán kiêm nhiệm "${targetDuty.name}" cho ${count} giáo viên thành công!`);
  };

  const handleConfirmBulkClearDutyForAssignedTeachers = () => {
    if (assignDutyTeacherIds.length === 0) return;
    const count = dataStore.bulkClearDutiesForTeachers(assignDutyTeacherIds);
    setIsBulkClearDutyTeacherModalOpen(false);
    setAssignDutyTeacherIds([]);
    showToast(`Đã xóa sạch toàn bộ kiêm nhiệm của ${assignDutyTeacherIds.length} giáo viên đã chọn (${count} phân công)!`);
  };

  // ==========================================
  // TAB 7: VERSIONS (LƯU & QUẢN LÝ PHIÊN BẢN ĐA DẠNG)
  // ==========================================
  const [newVersionTitle, setNewVersionTitle] = useState('');
  const [newVersionTargetSem, setNewVersionTargetSem] = useState<SemesterId>(semesterId);
  const [newVersionNotes, setNewVersionNotes] = useState('');

  const currentSemesterVersions = useMemo(() => {
    return versions.filter((v) => v.semesterId === semesterId);
  }, [versions, semesterId]);

  const handleQuickSaveNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newVersionTitle.trim() || `${semesterId} - Đợt phân công ${new Date().toLocaleDateString('vi-VN')}`;

    const created = dataStore.duplicateVersion(
      versionId,
      title,
      newVersionTargetSem,
      newVersionNotes || `Lưu phiên bản phân công mới từ ${currentVersion?.name || 'bản hiện tại'}`
    );

    if (created) {
      setNewVersionTitle('');
      setNewVersionNotes('');
      showToast(`Đã lưu thành công phiên bản mới: "${created.name}"!`);
    }
  };

  const handleSetOfficialVersion = (verId: string) => {
    versions.forEach((v) => {
      if (v.semesterId === semesterId) {
        dataStore.updateVersion(v.id, { isOfficial: v.id === verId });
      }
    });
    showToast('Đã đặt phiên bản làm phương án chính thức của học kỳ!');
  };

  const handleDeleteVersion = (verId: string) => {
    const ver = versions.find((v) => v.id === verId);
    if (!ver) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa phiên bản "${ver.name}"? Mọi phân công thuộc phiên bản này sẽ bị xóa.`)) return;

    if (dataStore.deleteVersion(verId)) {
      showToast(`Đã xóa phiên bản "${ver.name}" thành công!`);
    }
  };

  // ==========================================
  // TAB 8: EXCEL IMPORT / EXPORT & STAGING PREVIEW STATE
  // ==========================================
  const [excelUploadFile, setExcelUploadFile] = useState<File | null>(null);
  const [excelImportPreview, setExcelImportPreview] = useState<ImportPreviewResult | null>(null);
  const [excelImportMode, setExcelImportMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [excelPreviewSubTab, setExcelPreviewSubTab] = useState<'TEACHERS' | 'CLASSES' | 'ASSIGNMENTS'>('TEACHERS');
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const [excelSchoolInfo, setExcelSchoolInfo] = useState<SchoolInfo>(dataStore.getSchoolInfo());
  const [excelImportSuccessResult, setExcelImportSuccessResult] = useState<{
    teachersCount: number;
    classesCount: number;
    assignmentsCount: number;
    schoolName: string;
    schoolYear: string;
    mode: 'MERGE' | 'REPLACE';
    timestamp: string;
  } | null>(null);

  const loadSampleExcelPreview = () => {
    const currentTeachers = dataStore.getTeachers();
    const currentClasses = dataStore.getClasses();
    const currentAssignments = dataStore.getAssignments();
    const currentSchool = dataStore.getSchoolInfo();

    setExcelImportPreview({
      sheetNames: ['DU_LIEU_GV', 'LOP_HOC', 'PHAN_CONG_CHUYEN_MON'],
      schoolInfoDetected: {
        schoolName: currentSchool.schoolName,
        branchName: currentSchool.branchName,
        schoolYear: currentSchool.schoolYear,
        authorityName: currentSchool.authorityName,
      },
      teachersToImport: currentTeachers.slice(0, 10).map((t) => ({
        id: t.id,
        code: t.code,
        fullName: t.fullName,
        departmentId: t.departmentId,
        major: t.major,
        standardQuota: t.standardQuota,
        status: t.status,
        phone: t.phone,
        email: t.email,
      })),
      classesToImport: currentClasses.slice(0, 8).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        grade: c.grade,
        studentCount: c.studentCount,
        session: c.session,
      })),
      assignmentsToImport: currentAssignments.slice(0, 12).map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        classId: a.classId,
        subjectId: a.subjectId,
        type: a.type,
        periodsPerWeek: a.periodsPerWeek,
        dutyName: a.dutyName,
        notes: a.notes,
        session: a.session,
      })),
      curriculumToImport: [],
      errors: [],
      warnings: [],
      totalRows: currentTeachers.length + currentClasses.length + currentAssignments.length,
    });
    setExcelSchoolInfo(currentSchool);
    showToast('Đã nạp bản xem trước dữ liệu mẫu thành công!');
  };

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setExcelUploadFile(file);
      setIsExcelProcessing(true);
      try {
        const preview = await parseUploadedExcel(file);
        setExcelImportPreview(preview);
        if (preview.schoolInfoDetected) {
          setExcelSchoolInfo((prev) => ({
            ...prev,
            ...preview.schoolInfoDetected,
          }));
        }
        if (preview.teachersToImport.length > 0) {
          setExcelPreviewSubTab('TEACHERS');
        } else if (preview.classesToImport.length > 0) {
          setExcelPreviewSubTab('CLASSES');
        } else if (preview.assignmentsToImport.length > 0) {
          setExcelPreviewSubTab('ASSIGNMENTS');
        }
        showToast(`Đã nhận diện thành công file Excel: ${file.name}`);
      } catch (err) {
        showToast('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng file .xlsx', 'error');
      } finally {
        setIsExcelProcessing(false);
      }
    }
  };

  const handleExecuteExcelImport = () => {
    let previewToUse = excelImportPreview;

    if (!previewToUse) {
      loadSampleExcelPreview();
      const currentTeachers = dataStore.getTeachers();
      const currentClasses = dataStore.getClasses();
      const currentAssignments = dataStore.getAssignments();
      const currentSchool = dataStore.getSchoolInfo();
      previewToUse = {
        sheetNames: ['DU_LIEU_GV', 'LOP_HOC', 'PHAN_CONG_CHUYEN_MON'],
        schoolInfoDetected: currentSchool,
        teachersToImport: currentTeachers.slice(0, 10),
        classesToImport: currentClasses.slice(0, 8),
        assignmentsToImport: currentAssignments.slice(0, 12),
        curriculumToImport: [],
        errors: [],
        warnings: [],
        totalRows: currentTeachers.length + currentClasses.length + currentAssignments.length,
      };
    }

    if (
      previewToUse.teachersToImport.length === 0 &&
      previewToUse.classesToImport.length === 0 &&
      previewToUse.assignmentsToImport.length === 0
    ) {
      showToast('Không có dữ liệu hợp lệ nào được nhận diện từ file để cập nhật', 'error');
      return;
    }

    dataStore.bulkImportData({
      teachersToImport: previewToUse.teachersToImport,
      classesToImport: previewToUse.classesToImport,
      assignmentsToImport: previewToUse.assignmentsToImport,
      schoolInfoDetected: excelSchoolInfo,
      mode: excelImportMode,
    });

    const successData = {
      teachersCount: previewToUse.teachersToImport.length,
      classesCount: previewToUse.classesToImport.length,
      assignmentsCount: previewToUse.assignmentsToImport.length,
      schoolName: excelSchoolInfo.schoolName,
      schoolYear: excelSchoolInfo.schoolYear,
      mode: excelImportMode,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
    };

    setExcelImportSuccessResult(successData);

    showToast(
      `✅ CẬP NHẬT THÀNH CÔNG! Đã nạp ${successData.teachersCount} Giáo viên, ${successData.classesCount} Lớp học, ${successData.assignmentsCount} Phân công vào hệ thống!`,
      'success'
    );
  };

  const handleSaveSchoolInfoDirectly = () => {
    if (!excelSchoolInfo.schoolName.trim()) {
      showToast('Vui lòng nhập tên trường học.', 'error');
      return;
    }
    dataStore.setSchoolInfo(excelSchoolInfo);
    showToast(`✅ Đã lưu và áp dụng tên trường "${excelSchoolInfo.schoolName}" thành công!`, 'success');
  };

  const handleTriggerExcelExport = async () => {
    try {
      const currentSchool = excelSchoolInfo || dataStore.getSchoolInfo();
      const calcs = calculateAllTeachersWorkload(teachers, assignments, duties, departments);
      await exportWorkloadExcel({
        schoolYear: currentSchool.schoolYear || schoolYearId,
        semesterName: semesterId === 'HK1' ? 'Học kỳ I' : 'Học kỳ II',
        versionName: currentVersion?.name || 'Phiên bản chính thức',
        exporterName: 'Ban Giám Hiệu',
        schoolInfo: currentSchool,
        teachers,
        calculations: calcs,
        assignments,
        classes,
        subjects,
        duties,
        departments,
      });
      showToast(`✅ Đã tạo và tải xuống Sổ Phân công chuyên môn Excel (.xlsx) cho trường "${currentSchool.schoolName}" thành công!`);
    } catch (e) {
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in">
      {/* TOAST NOTIFICATION */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl font-bold text-xs flex items-center justify-between shadow-lg transition-all ${
            feedbackMsg.type === 'error'
              ? 'bg-red-900 text-red-100 border border-red-700'
              : 'bg-emerald-900 text-emerald-100 border border-emerald-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER WITH TABS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-700" />
                Nhập dữ liệu
              </h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                canEdit ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
              }`}>
                {canEdit ? 'Chỉnh sửa' : 'Chỉ Xem'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý dữ liệu hệ thống: Lớp học, Môn học, Khung tiết, Tổ chuyên môn, Giáo viên, Kiêm nhiệm và Phiên bản
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {semesterId === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} ({currentVersion?.name})
            </span>
          </div>
        </div>

        {/* TABS NAVIGATION (Order: Lớp học, Môn học, Tổ bộ môn, Giáo viên, Kiêm nhiệm, Phiên bản, Excel) */}
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 pt-3">
          {[
            { id: 'CLASSES', label: 'Lớp học', icon: GraduationCap, count: activeClasses.length },
            { id: 'SUBJECTS', label: 'Môn học', icon: BookOpen, count: subjects.length },
            { id: 'DEPARTMENTS', label: 'Tổ bộ môn', icon: Building2, count: departments.length },
            { id: 'TEACHERS', label: 'Giáo viên', icon: Users, count: activeTeachers.length },
            { id: 'DUTIES', label: 'Kiêm nhiệm', icon: Award, count: activeDuties.length },
            { id: 'ABBREVIATIONS', label: 'Danh mục viết tắt', icon: Sliders, count: dataStore.getAbbreviationRules().length },
            { id: 'VERSIONS', label: 'Phiên bản', icon: Layers, count: currentSemesterVersions.length, highlight: true },
            { id: 'EXCEL', label: 'Excel', icon: FileSpreadsheet, count: 'Xlsx', highlight: true },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id || (tab.id === 'SUBJECTS' && activeTab === 'CURRICULUM');
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as BulkTab);
                  if (tab.id === 'EXCEL' && !excelImportPreview) {
                    loadSampleExcelPreview();
                  }
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-xs'
                    : tab.highlight
                    ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-300' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. LỚP HỌC (CLASSES) BULK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'CLASSES' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Quick Bulk Generator & Paste Box */}
          {!isActionPanelCollapsed && (
            <div className="space-y-4 w-full lg:w-64 lg:flex-shrink-0 animate-in fade-in duration-150">
              {/* Quick Generator */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Tạo nhanh Lớp học</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Thu gọn cột tác vụ (độ rộng cột menu) để mở rộng bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Chọn khối</label>
                    <div className="grid grid-cols-4 gap-1">
                      {[6, 7, 8, 9].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setClassGrade(g)}
                          className={`py-1.5 rounded-lg font-bold text-xs ${
                            classGrade === g ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Khối {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Số lượng lớp</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={classCount}
                        onChange={(e) => setClassCount(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1" title="Nhập A để sinh 6A1..6A4, hoặc 6A9 để sinh 6A9, 6A10...">
                        Ký hiệu (VD: A)
                      </label>
                      <input
                        type="text"
                        value={classPrefix}
                        onChange={(e) => setClassPrefix(e.target.value)}
                        placeholder="VD: A hoặc 6A9"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold text-center focus:bg-white focus:border-blue-500"
                      />
                    </div>
                  </div>

                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Buổi học</label>
                    <select
                      value={classSession}
                      onChange={(e) => setClassSession(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-medium"
                    >
                      <option value="MORNING">Buổi 1 (Sáng)</option>
                      <option value="AFTERNOON">Buổi 2 (Chiều)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vị trí</label>
                      <select
                        value={classBranchId}
                        onChange={(e) => setClassBranchId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold text-xs"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sĩ số</label>
                      <input
                        type="number"
                        value={classDefaultStudents}
                        onChange={(e) => setClassDefaultStudents(parseInt(e.target.value, 10) || 35)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold text-center text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50 rounded-xl text-[11px] text-blue-900 border border-blue-200/80 space-y-1">
                  <div className="font-semibold text-blue-800 flex items-center justify-between">
                    <span>⚡ Danh sách lớp sẽ sinh:</span>
                    <span className="font-bold text-[10px] bg-blue-200/70 text-blue-900 px-1.5 py-0.2 rounded">
                      Khối {getGeneratedClassesInfo.effectiveGrade} • {getGeneratedClassesInfo.classList.length} lớp
                    </span>
                  </div>
                  <div className="font-mono font-bold text-blue-950 flex flex-wrap gap-1">
                    {getGeneratedClassesInfo.classList.map((c) => (
                      <span key={c.code} className="bg-white px-1.5 py-0.5 rounded border border-blue-200">
                        {c.code}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkGenerateClasses}
                  className="w-full bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tạo {getGeneratedClassesInfo.classList.length} lớp Khối {getGeneratedClassesInfo.effectiveGrade}
                </button>
              </div>
            </div>

            {/* Paste Raw Text / CSV */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Dán văn bản nhiều dòng</h3>
                </div>
                {classPasteText && (
                  <button
                    type="button"
                    onClick={() => setClassPasteText('')}
                    className="text-[11px] font-bold text-red-600 hover:bg-red-50 px-2 py-0.5 rounded-lg border border-red-200 transition cursor-pointer"
                  >
                    Xóa trắng
                  </button>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-[11px] text-slate-500">
                  Nhập hoặc dán danh sách lớp (mỗi dòng 1 lớp). Ví dụ: <code>6A1, Sáng, 38</code> hoặc <code>7A2</code>
                </p>
                <textarea
                  rows={4}
                  value={classPasteText}
                  onChange={(e) => setClassPasteText(e.target.value)}
                  placeholder={`6A1, Sáng, 38\n6A2, Sáng, 40\n7A1, Chiều, 36`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-xs focus:bg-white focus:border-emerald-500 transition"
                />

                {classPasteText.trim() && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <span>
                      Nhận diện: <strong>{classPasteText.split('\n').filter((l) => l.trim()).length} dòng</strong>
                    </span>
                    <span className="font-bold text-emerald-700">Sẵn sàng</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleBulkAddClassesFromText}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm danh sách lớp
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Right: Class List with Bulk Select & Delete */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {isActionPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                    title="Mở lại cột Thêm / Tạo lớp (độ rộng cột menu)"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-blue-700" />
                    <span>Hiện cột thêm lớp</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Thu gọn cột tác vụ để nhường toàn bộ diện tích cho bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px]">Thu gọn cột</span>
                  </button>
                )}

                <button
                  onClick={toggleSelectAllClasses}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold"
                >
                  {selectedClassIds.length === filteredClasses.length && filteredClasses.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-700" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Chọn tất cả ({selectedClassIds.length}/{filteredClasses.length})</span>
                </button>

                <div className="flex flex-wrap gap-1 items-center">
                  {['ALL', '6', '7', '8', '9'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setClassFilterGrade(g)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                        classFilterGrade === g ? 'bg-blue-900 text-white' : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      {g === 'ALL' ? 'Tất cả khối' : `Khối ${g}`}
                    </button>
                  ))}

                  <select
                    value={classFilterBranch}
                    onChange={(e) => setClassFilterBranch(e.target.value)}
                    className="ml-1 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg px-2 py-1 cursor-pointer focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ALL">🏢 Tất cả vị trí</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {selectedClassIds.length > 0 && (
                  <>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const targetBranch = branches.find((b) => b.id === e.target.value);
                        if (!targetBranch) return;
                        selectedClassIds.forEach((clsId) => {
                          dataStore.updateClass(clsId, { branchId: targetBranch.id });
                        });
                        showToast(`Đã chuyển ${selectedClassIds.length} lớp sang vị trí "${targetBranch.name}"!`);
                        e.target.value = '';
                      }}
                      className="bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-xl px-2.5 py-1.5 cursor-pointer hover:bg-emerald-100 transition"
                    >
                      <option value="" disabled>
                        🏢 Gán vị trí ({selectedClassIds.length} lớp)...
                      </option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Chuyển sang: {b.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setIsBulkDeleteClassModalOpen(true)}
                      className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition animate-in fade-in cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa hàng loạt ({selectedClassIds.length} lớp)
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1 max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-2 w-10 text-center">#</th>
                    <th className="py-2.5 px-2 w-12 text-center">STT</th>
                    <th className="py-2.5 px-3">Tên lớp</th>
                    <th className="py-2.5 px-3">Khối</th>
                    <th className="py-2.5 px-3">Buổi học</th>
                    <th className="py-2.5 px-3 text-center">Sĩ số</th>
                    <th className="py-2.5 px-3">GVCN</th>
                    <th className="py-2.5 px-3">Vị trí</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClasses.map((cls, idx) => {
                    const isSelected = selectedClassIds.includes(cls.id);
                    const hrTeacher = cls.homeroomTeacherId ? teachers.find((t) => t.id === cls.homeroomTeacherId) : null;
                    return (
                      <tr key={cls.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedClassIds((prev) =>
                                prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-black text-slate-900">{cls.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded">
                            Khối {cls.grade}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              cls.session === 'MORNING'
                                ? 'bg-sky-100 text-sky-800'
                                : cls.session === 'AFTERNOON'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {cls.session === 'MORNING'
                              ? 'Buổi sáng (B1)'
                              : cls.session === 'AFTERNOON'
                              ? 'Buổi chiều (B2)'
                              : '2 buổi/ngày'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">{cls.studentCount} HS</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {hrTeacher ? (
                            <span className="font-semibold text-slate-800">{hrTeacher.fullName}</span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa gán</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {(() => {
                            const branch = branches.find((b) => b.id === cls.branchId) || branches.find((b) => b.isMain);
                            const branchName = branch?.name || (cls.branchId === 'branch_sub' ? 'Phân hiệu' : 'Điểm chính');
                            const isSubBranch = cls.branchId === 'branch_sub' || branchName.toLowerCase().includes('phân hiệu');
                            return (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                  isSubBranch
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                }`}
                                title={`Vị trí: ${branchName}`}
                              >
                                <Building2 className="w-3 h-3 flex-shrink-0" />
                                <span>{branchName}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditClass(cls)}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Sửa thông tin lớp học"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setClassToDelete(cls)}
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Xóa lớp này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredClasses.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                        Không có lớp học nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GIÁO VIÊN (TEACHERS) BULK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'TEACHERS' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Bulk Input Box */}
          {!isActionPanelCollapsed && (
            <div className="w-full lg:w-64 lg:flex-shrink-0 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Thêm hàng loạt GV</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActionPanelCollapsed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Thu gọn cột tác vụ (độ rộng cột menu) để mở rộng bảng dữ liệu"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tổ mặc định</label>
                    <select
                      value={teacherDefaultDept}
                      onChange={(e) => setTeacherDefaultDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nơi làm việc mặc định</label>
                    <select
                      value={teacherDefaultWorkplaceId}
                      onChange={(e) => setTeacherDefaultWorkplaceId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5"
                    >
                      {workplaces
                        .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Định mức chuẩn (tiết/tuần)</label>
                  <input
                    type="number"
                    value={teacherDefaultQuota}
                    onChange={(e) => setTeacherDefaultQuota(parseInt(e.target.value, 10) || 19)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold text-center"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Dán DS giáo viên (mỗi dòng 1 GV)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTeacherPasteText(`Nguyễn Văn An, Tổ Tự nhiên, Toán, 19\nTrần Thị Bích, Tổ Xã hội, Văn, 19\nLê Quang Cường, Tổ Ngoại ngữ, Tiếng Anh, 19\nPhạm Thị Duyên, Tổ Năng khiếu, GDTC, 19`);
                        showToast('Đã nạp mẫu danh sách giáo viên! Bấm nút "Thêm danh sách GV" bên dưới.');
                      }}
                      className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition cursor-pointer"
                    >
                      ⚡ Mẫu GV
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-1">
                    Định dạng: <code>Họ tên</code> hoặc <code>Mã, Họ tên, Tổ, Môn, Tiết</code>
                  </p>
                  <textarea
                    rows={5}
                    value={teacherPasteText}
                    onChange={(e) => setTeacherPasteText(e.target.value)}
                    placeholder={`Nguyễn Văn An\nTrần Thị Bích\nLê Quang Cường\nPhạm Thị Duyên`}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-xs focus:bg-white focus:border-blue-500 transition"
                  />
                </div>

                {teacherPasteText.trim() && (
                  <div className="flex items-center justify-between text-[11px] text-blue-800 bg-blue-50/80 px-2.5 py-1 rounded-lg border border-blue-200">
                    <span>
                      Nhận diện: <strong>{teacherPasteText.split('\n').filter((l) => l.trim()).length} dòng</strong>
                    </span>
                    <span className="font-bold text-blue-700">Sẵn sàng</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleBulkAddTeachers}
                  className="w-full bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm danh sách giáo viên
                </button>
              </div>
            </div>
          )}

          {/* Right: Teacher List with Bulk Select & Delete */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {isActionPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                    title="Mở lại cột Thêm giáo viên (độ rộng cột menu)"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-blue-700" />
                    <span>Hiện cột thêm GV</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Thu gọn cột tác vụ để nhường toàn bộ diện tích cho bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px]">Thu gọn cột</span>
                  </button>
                )}

                <button
                  onClick={toggleSelectAllTeachers}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold"
                >
                  {selectedTeacherIds.length === filteredTeachers.length && filteredTeachers.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-700" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Chọn tất cả ({selectedTeacherIds.length}/{filteredTeachers.length})</span>
                </button>

                {/* 1. Điểm trường / Nơi làm việc (Toàn trường, Điểm chính, Phân hiệu...) */}
                <select
                  value={teacherFilterWorkplace}
                  onChange={(e) => setTeacherFilterWorkplace(e.target.value)}
                  className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1 font-bold text-slate-800"
                  title="Lọc theo Điểm trường / Nơi làm việc"
                >
                  <option value="ALL">Toàn trường ({activeTeachers.length} GV)</option>
                  {workplaces
                    .filter((w) => w.name.trim().toLowerCase() !== 'toàn trường' && w.code !== 'TT')
                    .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                    .map((w) => {
                      const count = activeTeachers.filter((t) => {
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

                {/* 2. Tiếp sau đó lọc theo Tổ chuyên môn hoặc Tất cả */}
                <select
                  value={teacherFilterDept}
                  onChange={(e) => setTeacherFilterDept(e.target.value)}
                  className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1 font-semibold text-slate-800"
                  title="Lọc theo Tổ chuyên môn"
                >
                  <option value="ALL">
                    Tất cả các tổ (
                    {
                      activeTeachers.filter((t) => {
                        if (teacherFilterWorkplace === 'ALL') return true;
                        const targetWp = workplaces.find((w) => w.id === teacherFilterWorkplace);
                        const targetName = (targetWp?.name || '').trim().toLowerCase();
                        const tWName = (t.workplace || '').trim().toLowerCase();
                        return (
                          t.workplaceId === teacherFilterWorkplace ||
                          tWName === targetName ||
                          (targetName && tWName.includes(targetName))
                        );
                      }).length
                    }{' '}
                    GV)
                  </option>
                  {departments.map((d) => {
                    const count = activeTeachers.filter((t) => {
                      if (t.departmentId !== d.id) return false;
                      if (teacherFilterWorkplace !== 'ALL') {
                        const targetWp = workplaces.find((w) => w.id === teacherFilterWorkplace);
                        const targetName = (targetWp?.name || '').trim().toLowerCase();
                        const tWName = (t.workplace || '').trim().toLowerCase();
                        return (
                          t.workplaceId === teacherFilterWorkplace ||
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

                {/* 3. Lọc theo Vị trí công việc & Kiêm nhiệm */}
                <select
                  value={teacherFilterPosition}
                  onChange={(e) => setTeacherFilterPosition(e.target.value)}
                  className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1 font-semibold text-slate-800"
                  title="Lọc theo Vị trí công việc & Kiêm nhiệm"
                >
                  <option value="ALL">Tất cả vị trí công việc</option>
                  <option value="Hiệu trưởng">Hiệu trưởng</option>
                  <option value="Phó hiệu trưởng">Phó hiệu trưởng</option>
                  <option value="Tổ trưởng">Tổ trưởng chuyên môn</option>
                  <option value="Tổ phó">Tổ phó chuyên môn</option>
                  <option value="Chủ tịch Công đoàn">Chủ tịch Công đoàn</option>
                  <option value="Bí thư Chi đoàn">Bí thư Chi đoàn</option>
                  <option value="Tổng phụ trách">Tổng phụ trách Đội</option>
                  <option value="Trưởng ban TTND">Trưởng ban TTND</option>
                  <option value="NONE">Chỉ GV giảng dạy (Không kiêm nhiệm)</option>
                </select>

                {/* 4. Ô tìm kiếm theo tên, mã, môn giáo viên */}
                <div className="relative min-w-[200px] flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo giáo viên hoặc môn..."
                    value={teacherSearchTerm}
                    onChange={(e) => setTeacherSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-xs rounded-lg pl-8 pr-6 py-1 font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  {teacherSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setTeacherSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsTeacherMasterImportModalOpen(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition cursor-pointer"
                  title="Nhập toàn bộ thông tin cá nhân và chuyên môn của giáo viên từ file Excel chuẩn 19+ cột"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Nhập Hồ sơ gốc (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const currentSchool = dataStore.getSchoolInfo();
                    await exportTeacherMasterListExcel(teachers, departments, currentSchool);
                    showToast('✅ Đã xuất toàn bộ hồ sơ gốc giáo viên thành file Excel (.xlsx)!');
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition cursor-pointer"
                  title="Xuất toàn bộ thông tin cá nhân và phân công của giáo viên ra file Excel"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Xuất Hồ sơ gốc</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkQuotaModalOpen(true)}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition cursor-pointer"
                  title="Nhập, sửa định mức tiết dạy cho hàng loạt giáo viên hoặc theo điểm trường, tổ chuyên môn"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-700" />
                  <span>Sửa định mức hàng loạt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkClearDutiesTeacherModalOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-xs font-bold rounded-lg px-2.5 py-1 flex items-center gap-1.5 transition cursor-pointer"
                  title="Xóa toàn bộ nhiệm vụ kiêm nhiệm của tất cả giáo viên trong trường hoặc các giáo viên đang chọn"
                >
                  <Briefcase className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Xóa kiêm nhiệm hàng loạt</span>
                </button>
              </div>

              <div>
                {selectedTeacherIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsBulkQuotaModalOpen(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition animate-in fade-in cursor-pointer"
                      title="Sửa định mức cho các giáo viên đã chọn"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      Sửa định mức ({selectedTeacherIds.length} GV)
                    </button>

                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const targetWp = workplaces.find((w) => w.id === e.target.value);
                        if (!targetWp) return;
                        dataStore.batchUpdateTeacherWorkplace(selectedTeacherIds, targetWp.id);
                        showToast(`Đã chuyển ${selectedTeacherIds.length} giáo viên sang nơi làm việc "${targetWp.name}"!`);
                        e.target.value = '';
                      }}
                      className="bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-xl px-2.5 py-1.5 cursor-pointer hover:bg-emerald-100 transition"
                    >
                      <option value="" disabled>
                        🏢 Gán nơi làm việc ({selectedTeacherIds.length} GV)...
                      </option>
                      {workplaces
                        .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            Chuyển sang: {w.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsBulkClearDutiesTeacherModalOpen(true)}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition animate-in fade-in cursor-pointer"
                      title="Xóa toàn bộ nhiệm vụ kiêm nhiệm của các giáo viên đã chọn"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Xóa kiêm nhiệm ({selectedTeacherIds.length} GV)
                    </button>

                    <button
                      onClick={() => setIsBulkDeleteTeacherModalOpen(true)}
                      className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition animate-in fade-in cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa hàng loạt ({selectedTeacherIds.length} GV)
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-2 w-10 text-center">#</th>
                    <th className="py-2.5 px-2 w-12 text-center">STT</th>
                    <th className="py-2.5 px-3">Mã GV</th>
                    <th className="py-2.5 px-3">Họ và tên</th>
                    <th className="py-2.5 px-3 text-center">Tên TKB</th>
                    <th className="py-2.5 px-3">Vị trí công việc</th>
                    <th className="py-2.5 px-3">Tổ chuyên môn</th>
                    <th className="py-2.5 px-3">Nơi làm việc</th>
                    <th className="py-2.5 px-3">Chuyên môn</th>
                    <th className="py-2.5 px-3 text-center">Định mức</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map((t, idx) => {
                    const isSelected = selectedTeacherIds.includes(t.id);
                    const dept = departments.find((d) => d.id === t.departmentId);
                    const positions = getTeacherPositions(t, departments, duties, assignments);
                    const tkbName = t.timetableName || t.shortName || (t.fullName ? t.fullName.trim().split(/\s+/).slice(-1)[0] : '');
                    return (
                      <tr key={t.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedTeacherIds((prev) =>
                                prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{t.code}</td>
                        <td className="py-2.5 px-3 font-black text-slate-900">{t.fullName}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-200"
                            title="Tên dùng trong Thời khóa biểu (Tên TKB)"
                          >
                            {tkbName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 min-w-[150px]">
                          {positions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {positions.map((pos) => (
                                <span
                                  key={pos}
                                  className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPositionBadgeStyle(pos)}`}
                                >
                                  {pos}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Giáo viên</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{dept?.name || 'Chưa gán'}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              t.workplace === 'Phân hiệu'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : t.workplace === 'Toàn trường'
                                ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            <span>{t.workplace || 'Điểm chính'}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{t.major || 'Sư phạm'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-900">{t.standardQuota || 19} tiết</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditTeacher(t)}
                              className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa thông tin giáo viên"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTeacherToDelete(t)}
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Xóa giáo viên này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTeachers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                        Không có giáo viên nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MÔN HỌC & KHUNG TIẾT (SUBJECTS & CURRICULUM) BULK TAB */}
      {/* ========================================================================= */}
      {(activeTab === 'SUBJECTS' || activeTab === 'CURRICULUM') && (
        <div className="space-y-4">
          {/* Sub-tab switcher: Danh mục Môn học vs Khung phân phối tiết */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubjectSubTab('LIST');
                  if (activeTab === 'CURRICULUM') setActiveTab('SUBJECTS');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  subjectSubTab === 'LIST' && activeTab === 'SUBJECTS'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Danh mục Môn học ({subjects.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubjectSubTab('CURRICULUM');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  subjectSubTab === 'CURRICULUM' || activeTab === 'CURRICULUM'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>Khung phân phối số tiết (ma trận tiết)</span>
              </button>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {subjectSubTab === 'CURRICULUM' || activeTab === 'CURRICULUM'
                ? 'Đang mở: Khung phân phối tiết GDPT 2018 theo từng khối lớp'
                : 'Đang mở: Quản lý danh mục tên môn, mã môn, môn kiêm nhiệm'}
            </div>
          </div>

          {(subjectSubTab === 'LIST' && activeTab !== 'CURRICULUM') && (
            <div className="flex flex-col lg:flex-row gap-4">
          {!isActionPanelCollapsed && (
            <div className="space-y-4 w-full lg:w-64 lg:flex-shrink-0 animate-in fade-in duration-150">
              {/* Form Thêm Môn Học Mới */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Thêm môn học mới</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Thu gọn cột tác vụ (độ rộng cột menu) để mở rộng bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mã môn <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="VD: PHAP, KNS"
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono text-xs uppercase focus:bg-white focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tên viết tắt</label>
                    <input
                      type="text"
                      placeholder="VD: Pháp"
                      value={newSubjectShortName}
                      onChange={(e) => setNewSubjectShortName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:bg-white focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Tên đầy đủ môn học <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      placeholder="VD: Tiếng Pháp, Kỹ năng sống..."
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:bg-white focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Số tiết/tuần <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0.5}
                        max={20}
                        step={0.5}
                        placeholder="VD: 2"
                        value={newSubjectPeriods || ''}
                        onChange={(e) => setNewSubjectPeriods(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-medium pointer-events-none">tiết</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nhóm môn</label>
                    <select
                      value={newSubjectGroup}
                      onChange={(e) => setNewSubjectGroup(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium focus:bg-white focus:border-blue-500 transition"
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
                    <label className="block font-semibold text-slate-700 mb-1">Tổ bộ môn phụ trách</label>
                    <select
                      value={newSubjectDeptId}
                      onChange={(e) => setNewSubjectDeptId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium focus:bg-white focus:border-blue-500 transition"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-slate-700 text-xs flex items-center gap-1.5">
                      <span>Khối lớp áp dụng <span className="text-red-500">*</span>:</span>
                      <span className="text-[10px] text-blue-700 font-bold">({newSubjectGrades.length} khối)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setNewSubjectGrades([6, 7, 8, 9])}
                        className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
                      >
                        Cả 4 khối
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setNewSubjectGrades([6, 7])}
                        className="text-[10px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        K6,7
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setNewSubjectGrades([8, 9])}
                        className="text-[10px] text-indigo-700 hover:underline font-semibold cursor-pointer"
                      >
                        K8,9
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[6, 7, 8, 9].map((g) => {
                      const isChecked = newSubjectGrades.includes(g);
                      return (
                        <label
                          key={g}
                          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer transition select-none ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewSubjectGrades((prev) => [...prev, g].sort());
                              } else {
                                if (newSubjectGrades.length <= 1) {
                                  showToast('Môn học phải áp dụng ít nhất một khối!', 'error');
                                  return;
                                }
                                setNewSubjectGrades((prev) => prev.filter((x) => x !== g));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span>Khối {g}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100/60 transition">
                  <input
                    type="checkbox"
                    checked={newSubjectIsIntegrated}
                    onChange={(e) => setNewSubjectIsIntegrated(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800 text-xs">Môn tích hợp (cho phép nhiều GV cùng dạy)</span>
                </label>

                <button
                  type="button"
                  onClick={handleAddSingleSubject}
                  className="w-full bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Thêm môn học vào hệ thống
                </button>
              </div>
            </div>

            {/* Quick 1-Click Standard Subjects */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">Chuẩn GDPT 2018 & Phân môn KHTN</h3>
              </div>
              <p className="text-xs text-slate-600">
                Khởi tạo chương trình GDPT 2018: Khối 6, 7 học môn KHTN chung (4 tiết); Khối 8, 9 tách phân môn Lý (1.5 tiết), Hóa (1.5 tiết), Sinh (1.0 tiết).
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleApplyKhtnSplitConfig}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Tự động gán K6,7 chung KHTN 4 tiết; K8,9 tách phân môn Lý-Hóa-Sinh"
                >
                  <Sparkles className="w-4 h-4" /> Cấu hình KHTN: K6-7 chung • K8-9 tách môn
                </button>
                <button
                  type="button"
                  onClick={handleApplyStandardSubjects}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Nạp danh mục 15 môn chuẩn GDPT 2018
                </button>
              </div>
            </div>

            {/* Custom Subjects Bulk Text */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase">Thêm nhiều môn bằng dán văn bản</h3>
                </div>
                {subjectPasteText && (
                  <button
                    type="button"
                    onClick={() => setSubjectPasteText('')}
                    className="text-[10px] font-bold text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-200 transition cursor-pointer"
                  >
                    Xóa trắng
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Định dạng: <code>Mã môn, Tên môn, Nhóm môn, Tích hợp(true/false)</code>
              </p>
              <textarea
                rows={3}
                value={subjectPasteText}
                onChange={(e) => setSubjectPasteText(e.target.value)}
                placeholder={`TIENG_PHAP, Tiếng Pháp, Ngoại ngữ\nROBOTIC, Trải nghiệm Robotic, Tự chọn, true`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-xs focus:bg-white focus:border-emerald-500 transition"
              />

              {subjectPasteText.trim() && (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <span>
                    Nhận diện: <strong>{subjectPasteText.split('\n').filter((l) => l.trim()).length} dòng</strong> môn học
                  </span>
                  <span className="font-bold text-emerald-700">Sẵn sàng nạp</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleBulkAddCustomSubjects}
                className="w-full bg-emerald-800 hover:bg-emerald-700 active:scale-[0.99] text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-800/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm danh sách môn học
              </button>
            </div>
          </div>
          )}

          {/* Subject List */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {isActionPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                    title="Mở lại cột Thêm môn học (độ rộng cột menu)"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-blue-700" />
                    <span>Hiện cột thêm môn</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Thu gọn cột tác vụ để nhường toàn bộ diện tích cho bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px]">Thu gọn cột</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (selectedSubjectIds.length === subjects.length) setSelectedSubjectIds([]);
                    else setSelectedSubjectIds(subjects.map((s) => s.id));
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold"
                >
                  {selectedSubjectIds.length === subjects.length && subjects.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-700" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Chọn tất cả ({selectedSubjectIds.length}/{subjects.length})</span>
                </button>
              </div>

              {selectedSubjectIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteSubjectModalOpen(true)}
                  className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa hàng loạt ({selectedSubjectIds.length} môn)
                </button>
              )}
            </div>

            {/* Thanh thống kê số lượng môn được gán cho từng khối - Đồng bộ 100% với Khung KHDH */}
            <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-bold text-slate-700 text-[11px]">Số môn được gán theo Khối:</span>
                <button
                  type="button"
                  onClick={() => setSubjectFilterGrade('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer ${
                    subjectFilterGrade === 'ALL'
                      ? 'bg-blue-900 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({subjects.length} môn)
                </button>
                {[6, 7, 8, 9].map((g) => {
                  const count = subjects.filter(
                    (s) => s.active !== false && (!s.applicableGrades || s.applicableGrades.length === 0 || s.applicableGrades.includes(g))
                  ).length;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSubjectFilterGrade(subjectFilterGrade === String(g) ? 'ALL' : String(g))}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                        subjectFilterGrade === String(g)
                          ? 'bg-blue-900 text-white shadow-2xs'
                          : 'bg-white text-blue-950 border border-blue-200 hover:bg-blue-50'
                      }`}
                      title={`Xem danh sách các môn được gán cho Khối ${g}`}
                    >
                      <span>Khối {g}:</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-black ${
                        subjectFilterGrade === String(g) ? 'bg-white text-blue-900' : 'bg-blue-100 text-blue-900'
                      }`}>
                        {count} môn
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                💡 Số lượng môn đồng bộ trực tiếp với Khung kế hoạch dạy học (K6,7: 13 môn • K8,9: 15 môn)
              </div>
            </div>

            <div className="overflow-x-auto flex-1 max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Mã môn</th>
                    <th className="py-2.5 px-3">Tên môn học</th>
                    <th className="py-2.5 px-3">Tổ bộ môn phụ trách</th>
                    <th className="py-2.5 px-3 text-center min-w-[270px]">Khung tiết theo Khối (K6 - K7 - K8 - K9)</th>
                    <th className="py-2.5 px-3 text-center min-w-[160px]">Buổi 2 (Tăng cường & BD)</th>
                    <th className="py-2.5 px-3">Nhóm</th>
                    <th className="py-2.5 px-3">Đặc thù</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects
                    .filter((s) => {
                      if (subjectFilterGrade === 'ALL') return true;
                      const g = Number(subjectFilterGrade);
                      return !s.applicableGrades || s.applicableGrades.length === 0 || s.applicableGrades.includes(g);
                    })
                    .map((s) => {
                      const isSelected = selectedSubjectIds.includes(s.id);
                      const dept = departments.find((d) => d.id === s.departmentId);

                      return (
                        <tr key={s.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/60' : ''}`}>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedSubjectIds((prev) =>
                                prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              );
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{s.code}</td>
                        <td className="py-2.5 px-3 font-black text-slate-900">{s.name}</td>
                        <td className="py-2.5 px-3">
                          {dept ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/60">
                              <Users className="w-3 h-3 text-indigo-600" />
                              {dept.name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa gán tổ</span>
                          )}
                        </td>

                        {/* Cột gộp: Khối áp dụng & Số tiết/tuần (K6 - K7 - K8 - K9) - Đồng bộ trực tiếp ma trận tiết */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {[6, 7, 8, 9].map((g) => {
                              const isApp = !s.applicableGrades || s.applicableGrades.length === 0 || s.applicableGrades.includes(g);
                              const curr = curriculums.find(
                                (c) => c.grade === g && c.subjectId === s.id && c.semesterId === semesterId
                              );
                              const periods = curr ? curr.periodsPerWeek : (s.periodsPerWeek || 0);

                              return (
                                <div
                                  key={g}
                                  className={`flex items-center rounded-lg border text-[11px] p-0.5 transition shadow-2xs ${
                                    isApp ? 'bg-blue-50/90 border-blue-200' : 'bg-slate-100/70 border-slate-200 opacity-60'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleGrade(s.id, g)}
                                    title={`Click để ${isApp ? 'bỏ' : 'kích hoạt'} áp dụng Khối ${g} cho môn "${s.name}"`}
                                    className={`w-5 h-6 rounded font-black flex items-center justify-center cursor-pointer transition ${
                                      isApp ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                                    }`}
                                  >
                                    {g}
                                  </button>
                                  {isApp ? (
                                    <input
                                      type="number"
                                      min="0"
                                      max="15"
                                      step="0.5"
                                      value={periods}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        if (curr) {
                                          dataStore.updateCurriculum(curr.id, { periodsPerWeek: val });
                                        } else {
                                          dataStore.addCurriculum({
                                            schoolYearId,
                                            semesterId,
                                            grade: g as any,
                                            subjectId: s.id,
                                            periodsPerWeek: val,
                                            weeks: semesterId === 'HK1' ? 18 : 17,
                                            effectiveDate: new Date().toISOString().split('T')[0],
                                            status: 'approved',
                                          });
                                        }
                                      }}
                                      title={`Số tiết/tuần Khối ${g} (đồng bộ ma trận tiết)`}
                                      className="w-10 text-center font-bold text-blue-950 bg-white border-0 focus:ring-1 focus:ring-blue-500 rounded text-[11px] p-0.5"
                                    />
                                  ) : (
                                    <span className="w-10 text-center text-slate-400 font-bold text-[11px] select-none">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Cột Buổi 2: Tăng cường & Bồi dưỡng - Đồng bộ sang Khung KHDH */}
                        <td className="py-2 px-3 text-center">
                          {s.isSession2 || s.session2Config?.hasSession2 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEditSession2(s)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] shadow-2xs transition cursor-pointer"
                              title="Bấm để chỉnh sửa chi tiết các lớp Buổi 2 theo từng khối"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>Buổi 2</span>
                              {s.session2Config?.applicableGrades && s.session2Config.applicableGrades.length > 0 ? (
                                <span className="text-[10px] bg-amber-200/90 text-amber-950 px-1 py-0.2 rounded font-black">
                                  K{s.session2Config.applicableGrades.join(',')}
                                </span>
                              ) : null}
                              <span className="text-[10px] bg-white px-1 py-0.2 rounded font-bold text-amber-900 border border-amber-200">
                                {s.session2Config?.bdClasses || 0} BD • {s.session2Config?.pdClasses || 0} PĐ
                              </span>
                              <Edit2 className="w-3 h-3 text-amber-700 ml-0.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEditSession2(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-800 border border-dashed border-slate-300 hover:border-amber-300 text-[11px] font-medium transition cursor-pointer"
                              title="Gán phân bổ dạy Buổi 2 (tăng cường & bồi dưỡng theo từng khối)"
                            >
                              <Plus className="w-3 h-3 text-slate-400" />
                              <span>Gán Buổi 2</span>
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{s.group}</td>
                        <td className="py-2.5 px-3">
                          {s.isIntegrated ? (
                            <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              Tích hợp (Nhiều GV)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Đơn môn</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditSubject(s)}
                              className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa môn học"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubjectToDelete(s)}
                              className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Xóa môn học này"
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
        </div>
        )}

        {/* Sub-tab 2: Khung phân phối số tiết (Tích hợp trong Môn học) */}
          {(subjectSubTab === 'CURRICULUM' || activeTab === 'CURRICULUM') && (
            <div className="space-y-4">
          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Apply GDPT 2018 Standard */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-blue-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">Chuẩn GDPT 2018 & Phân môn KHTN</h3>
              </div>
              <p className="text-xs text-slate-600">
                Tự động thiết lập khung số tiết 29 tiết/tuần: K6-7 học môn KHTN chung 4 tiết; K8-9 phân môn KHTN (Lý 1.5, Hóa 1.5, Sinh 1.0 tiết).
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleApplyKhtnSplitConfig}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  title="Cấu hình tự động: K6-7 học môn KHTN chung; K8-9 tách môn Lý, Hóa, Sinh"
                >
                  <Sparkles className="w-4 h-4" /> Cấu hình KHTN: K6-7 chung • K8-9 tách môn
                </button>
                <button
                  type="button"
                  onClick={handleApplyStandardCurriculumAllGrades}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Áp dụng 29 tiết/tuần cho 4 khối ({semesterId})
                </button>
              </div>
            </div>

            {/* Card 2: Copy Across Grades */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Copy className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">Sao chép khung tiết giữa các khối</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Khối nguồn:</span>
                  <select
                    value={sourceCopyGrade}
                    onChange={(e) => setSourceCopyGrade(Number(e.target.value))}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 font-bold"
                  >
                    {[6, 7, 8, 9].map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span>Khối đích nhận:</span>
                  <div className="flex gap-1">
                    {[6, 7, 8, 9].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setTargetCopyGrades((prev) =>
                            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                          );
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          targetCopyGrades.includes(g) ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        K{g}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCurriculumGrades}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <Copy className="w-4 h-4" /> Sao chép từ Khối {sourceCopyGrade} sang Khối [{targetCopyGrades.join(', ')}]
                </button>
              </div>
            </div>

            {/* Card 3: Copy Across Semesters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <RefreshCw className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">Đồng bộ giữa HK1 và HK2</h3>
              </div>
              <p className="text-xs text-slate-600">
                Sao chép toàn bộ định mức khung số tiết từ {semesterId} sang {semesterId === 'HK1' ? 'Học kỳ II (17 tuần)' : 'Học kỳ I (18 tuần)'}.
              </p>
              <button
                type="button"
                onClick={handleCopyCurriculumAcrossSemester}
                className="w-full bg-purple-800 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <RefreshCw className="w-4 h-4" /> Sao chép từ {semesterId} sang {semesterId === 'HK1' ? 'HK2' : 'HK1'}
              </button>
            </div>
          </div>

          {/* Full Matrix Grid for All 4 Grades */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Ma trận khung phân phối số tiết 4 Khối (GDPT 2018 – {semesterId})
                </h3>
                <span className="text-xs text-slate-500">
                  Chỉnh sửa trực tiếp số tiết/tuần. Các môn không áp dụng theo khối hiển thị dấu gạch ngang và không tính vào tổng số tiết.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">STT</th>
                    <th className="py-3 px-4">Tên môn học</th>
                    <th className="py-3 px-3">Mã môn</th>
                    <th className="py-3 px-3 text-center">Khối áp dụng</th>
                    <th className="py-3 px-3 text-center bg-blue-100/80 text-blue-950 font-bold">Khối 6 (Tiết/T)</th>
                    <th className="py-3 px-3 text-center bg-blue-100/80 text-blue-950 font-bold">Khối 7 (Tiết/T)</th>
                    <th className="py-3 px-3 text-center bg-blue-100/80 text-blue-950 font-bold">Khối 8 (Tiết/T)</th>
                    <th className="py-3 px-3 text-center bg-blue-100/80 text-blue-950 font-bold">Khối 9 (Tiết/T)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uniqueSubjects.map((sub, idx) => {
                    const isApplicableFor = (grade: number) =>
                      !sub.applicableGrades || sub.applicableGrades.length === 0 || sub.applicableGrades.includes(grade);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{sub.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{sub.code}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {[6, 7, 8, 9].map((g) => {
                              const isApp = isApplicableFor(g);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => handleQuickToggleGrade(sub.id, g)}
                                  title={`Click để ${isApp ? 'bỏ' : 'thêm'} áp dụng Khối ${g} cho môn "${sub.name}"`}
                                  className={`w-6 h-6 rounded-md text-[11px] font-black transition cursor-pointer flex items-center justify-center ${
                                    isApp
                                      ? 'bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300 shadow-2xs'
                                      : 'bg-slate-100 text-slate-300 hover:text-slate-600 hover:bg-slate-200 border border-dashed border-slate-200'
                                  }`}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        {[6, 7, 8, 9].map((grade) => {
                          const isApp = isApplicableFor(grade);
                          const curr = curriculums.find(
                            (c) => c.grade === grade && c.subjectId === sub.id && c.semesterId === semesterId
                          );
                          const periods = curr?.periodsPerWeek ?? 0;

                          if (!isApp) {
                            return (
                              <td key={grade} className="py-2.5 px-3 text-center bg-slate-50/50">
                                <span
                                  className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold text-slate-400 bg-slate-100/90 cursor-not-allowed select-none border border-dashed border-slate-200"
                                  title={`Môn "${sub.name}" không áp dụng cho Khối ${grade}. Click vào ô 'Khối áp dụng' để kích hoạt.`}
                                >
                                  —
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={grade} className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={periods}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (curr) {
                                    dataStore.updateCurriculum(curr.id, { periodsPerWeek: val });
                                  } else {
                                    dataStore.addCurriculum({
                                      schoolYearId,
                                      semesterId,
                                      grade: grade as any,
                                      subjectId: sub.id,
                                      periodsPerWeek: val,
                                      weeks: semesterId === 'HK1' ? 18 : 17,
                                      effectiveDate: new Date().toISOString().split('T')[0],
                                      status: 'approved',
                                    });
                                  }
                                }}
                                className="w-16 bg-slate-50 border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-900 focus:bg-blue-50 focus:border-blue-500 transition shadow-2xs"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/95 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td colSpan={4} className="py-3 px-4 text-right uppercase text-xs tracking-wider">
                      Tổng số tiết / tuần:
                    </td>
                    {[6, 7, 8, 9].map((g) => {
                      const total = uniqueSubjects.reduce((sum, s) => {
                        const isApplicable =
                          !s.applicableGrades || s.applicableGrades.length === 0 || s.applicableGrades.includes(g);
                        if (!isApplicable) return sum;
                        const c = curriculums.find(
                          (curr) => curr.grade === g && curr.subjectId === s.id && curr.semesterId === semesterId
                        );
                        return sum + (c?.periodsPerWeek ?? 0);
                      }, 0);

                      return (
                        <td key={g} className="py-3 px-3 text-center">
                          <span className="text-sm font-black text-blue-950">
                            {total} tiết
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TỔ CHUYÊN MÔN (DEPARTMENTS) BULK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'DEPARTMENTS' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT COLUMN: ASSIGN TEACHERS / ADD DEPARTMENT */}
          {!isActionPanelCollapsed && (
            <div className="space-y-4 w-full lg:w-64 lg:flex-shrink-0 animate-in fade-in duration-150">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                {/* HEADER WITH COLLAPSE */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Tác vụ Tổ bộ môn</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Thu gọn cột tác vụ (độ rộng cột menu) để mở rộng bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* MODE SWITCHER */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => setDeptInputMode('ASSIGN_TEACHERS')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                    deptInputMode === 'ASSIGN_TEACHERS'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Chọn GV vào tổ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeptInputMode('MANUAL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                    deptInputMode === 'MANUAL'
                      ? 'bg-white text-blue-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm tổ mới</span>
                </button>
              </div>

              {/* MODE 1: ASSIGN TEACHERS TO DEPARTMENT */}
              {deptInputMode === 'ASSIGN_TEACHERS' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <UserPlus className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">
                      Chọn giáo viên vào từng tổ
                    </h3>
                  </div>

                  {departments.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      Chưa có tổ chuyên môn nào. Hãy chuyển sang tab <strong>"+ Thêm tổ mới"</strong> để tạo tổ trước.
                    </div>
                  ) : (
                    <>
                      {/* DEPARTMENT SELECTOR */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Chọn tổ chuyên môn cần gán giáo viên:
                        </label>
                        <select
                          value={currentAssignDept?.id || ''}
                          onChange={(e) => setAssignDeptId(e.target.value)}
                          className="w-full bg-slate-50 border border-blue-300 rounded-xl px-3 py-2 text-xs font-bold text-blue-950 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                        >
                          {departments.map((d) => {
                            const count = activeTeachers.filter((t) => t.departmentId === d.id).length;
                            return (
                              <option key={d.id} value={d.id}>
                                {d.name} ({count} GV hiện tại)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* CURRENT DEPT LEADERS INFO */}
                      {currentAssignDept && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Tổ trưởng:</span>
                            <span className="font-bold text-slate-900">
                              {teachers.find((t) => t.id === currentAssignDept.headTeacherId)?.fullName || 'Chưa chỉ định'}
                            </span>
                          </div>
                          {(() => {
                            const depIds = Array.isArray(currentAssignDept.deputyTeacherIds) && currentAssignDept.deputyTeacherIds.length > 0
                              ? currentAssignDept.deputyTeacherIds
                              : currentAssignDept.deputyTeacherId
                              ? [currentAssignDept.deputyTeacherId]
                              : [];
                            const depTeachers = depIds.map((id) => teachers.find((t) => t.id === id)).filter(Boolean) as Teacher[];
                            return (
                              <div className="flex items-start justify-between text-[11px] gap-2">
                                <span className="text-slate-500 flex-shrink-0">Tổ phó ({depTeachers.length}):</span>
                                <span className="font-medium text-slate-800 text-right truncate" title={depTeachers.map((t) => t.fullName).join(', ')}>
                                  {depTeachers.length > 0
                                    ? depTeachers.map((dt) => dt.fullName).join(', ')
                                    : 'Chưa chỉ định'}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* STATS & FILTER TABS */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">
                            Đã chọn: <span className="text-blue-700 font-extrabold">{selectedTeacherIdsForDept.length}</span> GV
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Tổng: {activeTeachers.length} GV
                          </span>
                        </div>

                        {/* SEARCH INPUT */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Tìm nhanh giáo viên..."
                            value={assignTeacherSearch}
                            onChange={(e) => setAssignTeacherSearch(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-blue-500"
                          />
                          {assignTeacherSearch && (
                            <button
                              onClick={() => setAssignTeacherSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* FILTER PILLS */}
                        <div className="flex flex-wrap gap-1 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setAssignTeacherFilter('ALL')}
                            className={`px-2 py-1 rounded-lg transition ${
                              assignTeacherFilter === 'ALL'
                                ? 'bg-blue-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Tất cả ({activeTeachers.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignTeacherFilter('IN_DEPT')}
                            className={`px-2 py-1 rounded-lg transition ${
                              assignTeacherFilter === 'IN_DEPT'
                                ? 'bg-emerald-800 text-white'
                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            Thuộc tổ ({selectedTeacherIdsForDept.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignTeacherFilter('UNASSIGNED')}
                            className={`px-2 py-1 rounded-lg transition ${
                              assignTeacherFilter === 'UNASSIGNED'
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Chưa có tổ ({activeTeachers.filter((t) => !t.departmentId).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignTeacherFilter('OTHER_DEPTS')}
                            className={`px-2 py-1 rounded-lg transition ${
                              assignTeacherFilter === 'OTHER_DEPTS'
                                ? 'bg-amber-800 text-white'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            Tổ khác
                          </button>
                        </div>

                        {/* SELECT ALL / DESELECT ALL ACTION BUTTONS */}
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <button
                            type="button"
                            onClick={handleSelectAllVisibleTeachersForDept}
                            className="text-blue-700 hover:text-blue-900 font-bold hover:underline"
                          >
                            + Chọn tất cả hiển thị ({filteredTeachersForAssignment.length})
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllVisibleTeachersForDept}
                            className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                          >
                            Bỏ chọn tất cả
                          </button>
                        </div>
                      </div>

                      {/* TEACHERS LIST WITH CHECKBOXES */}
                      <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                        {filteredTeachersForAssignment.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs">
                            Không có giáo viên nào phù hợp bộ lọc.
                          </div>
                        ) : (
                          filteredTeachersForAssignment.map((t) => {
                            const isChecked = selectedTeacherIdsForDept.includes(t.id);
                            const currentDeptName = departments.find((d) => d.id === t.departmentId)?.name;
                            const isCurrentlyInOtherDept = t.departmentId && t.departmentId !== currentAssignDept?.id;

                            return (
                              <label
                                key={t.id}
                                className={`flex items-start gap-2.5 p-2 rounded-xl cursor-pointer transition select-none ${
                                  isChecked
                                    ? 'bg-blue-50/90 border border-blue-200'
                                    : 'hover:bg-slate-100/80 border border-transparent'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleTeacherInDept(t.id)}
                                  className="mt-1 rounded border-slate-300 text-blue-700 focus:ring-blue-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-xs text-slate-900 truncate">
                                      {t.fullName}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-500 font-bold">
                                      {t.code}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {t.major || 'Sư phạm'}
                                    {t.subjectsCanTeach && t.subjectsCanTeach.length > 0 && (
                                      <span>
                                        {' '}•{' '}
                                        {t.subjectsCanTeach
                                          .map((sId) => subjects.find((s) => s.id === sId)?.name || sId)
                                          .join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-1.5">
                                    {isChecked ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                        ✓ Chọn vào tổ này
                                      </span>
                                    ) : isCurrentlyInOtherDept ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-medium text-[10px]">
                                        Hiện ở: {currentDeptName}
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-medium text-[10px]">
                                        Chưa có tổ
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>

                      {/* SAVE BUTTON */}
                      <button
                        type="button"
                        onClick={handleSaveTeacherAssignment}
                        className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>
                          Lưu {selectedTeacherIdsForDept.length} giáo viên vào "{currentAssignDept?.name}"
                        </span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* MODE 2: MANUAL ADD FORM */}
              {deptInputMode === 'MANUAL' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Thêm Tổ chuyên môn mới</h3>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên tổ chuyên môn (thường dùng) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Toán – Tin hoặc KHTN"
                      value={deptFormName}
                      onChange={(e) => {
                        const name = e.target.value;
                        setDeptFormName(name);
                        if (!deptFormFullName) {
                          setDeptFormFullName(name.startsWith('Tổ ') ? name : `Tổ ${name}`);
                        }
                        // Auto suggest code if code is empty or default
                        if (!deptFormCode || deptFormCode.startsWith('TO_')) {
                          const suggested = name
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^a-zA-Z0-9\s]/g, '')
                            .trim()
                            .replace(/\s+/g, '_')
                            .toUpperCase();
                          if (suggested) setDeptFormCode(`TO_${suggested}`);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên đầy đủ của tổ <span className="text-rose-600">*</span>
                      <span className="text-[11px] font-normal text-blue-700 ml-1">
                        (dùng trong các biểu mẫu, báo cáo - không dùng viết tắt)
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Tổ Toán – Tin học hoặc Tổ Khoa học Tự nhiên"
                      value={deptFormFullName}
                      onChange={(e) => setDeptFormFullName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Tên này sẽ hiển thị trang trọng trên tiêu đề và nội dung các biểu mẫu in, xuất Excel.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mã định danh tổ <span className="text-slate-400 font-normal">(viết hoa, không dấu)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="VD: TO_NGOAI_NGU"
                      value={deptFormCode}
                      onChange={(e) => setDeptFormCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tổ trưởng chuyên môn</label>
                    <SearchableTeacherSelect
                      teachers={activeTeachers}
                      value={deptFormHeadTeacherId}
                      onChange={(id) => setDeptFormHeadTeacherId(id)}
                      placeholder="-- Chọn hoặc tìm kiếm Tổ trưởng --"
                      clearLabel="-- Không có Tổ trưởng (Bỏ chọn) --"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Tổ phó chuyên môn ({deptFormDeputyTeacherIds.length > 0 ? `${deptFormDeputyTeacherIds.length} người` : 'Chưa có'})
                      </label>
                      <button
                        type="button"
                        onClick={() => setDeptFormDeputyTeacherIds((prev) => [...prev, ''])}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                        title="Thêm một vị trí Tổ phó"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Thêm tổ phó</span>
                      </button>
                    </div>

                    {deptFormDeputyTeacherIds.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setDeptFormDeputyTeacherIds([''])}
                        className="w-full py-2 px-3 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:text-blue-700 hover:border-blue-400 bg-slate-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Chỉ định Tổ phó (hỗ trợ 1, 2, 3... tổ phó)</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {deptFormDeputyTeacherIds.map((deputyId, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 w-16 flex-shrink-0">
                              Tổ phó {idx + 1}:
                            </span>
                            <div className="flex-1">
                              <SearchableTeacherSelect
                                teachers={activeTeachers}
                                value={deputyId}
                                filterPredicate={(t) =>
                                  t.id !== deptFormHeadTeacherId &&
                                  (!deptFormDeputyTeacherIds.includes(t.id) || t.id === deputyId)
                                }
                                onChange={(val) => {
                                  setDeptFormDeputyTeacherIds((prev) => {
                                    const next = [...prev];
                                    next[idx] = val;
                                    return next;
                                  });
                                }}
                                compact
                                placeholder={`-- Tìm hoặc chọn Tổ phó ${idx + 1} --`}
                                clearLabel={`-- Bỏ chọn Tổ phó ${idx + 1} --`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDeptFormDeputyTeacherIds((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer flex-shrink-0"
                              title="Xóa tổ phó này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="dept-active-toggle"
                      checked={deptFormActive}
                      onChange={(e) => setDeptFormActive(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="dept-active-toggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Đang hoạt động (Kích hoạt ngay)
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateDepartment}
                    className="w-full mt-2 bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Tổ chuyên môn</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {/* RIGHT COLUMN: DEPARTMENTS DIRECTORY TABLE */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            {/* TOOLBAR */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {isActionPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                    title="Mở lại cột Tác vụ tổ bộ môn (độ rộng cột menu)"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-blue-700" />
                    <span>Hiện cột tác vụ</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Thu gọn cột tác vụ để nhường toàn bộ diện tích cho bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px]">Thu gọn cột</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (selectedDeptIds.length === filteredDepartments.length) setSelectedDeptIds([]);
                    else setSelectedDeptIds(filteredDepartments.map((d) => d.id));
                  }}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold transition"
                >
                  {selectedDeptIds.length === filteredDepartments.length && filteredDepartments.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-blue-700" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    Chọn tất cả ({selectedDeptIds.length}/{filteredDepartments.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    dataStore.syncAllDepartmentDutiesAndAssignments();
                    showToast('✅ Đã đồng bộ toàn bộ chức vụ Tổ trưởng (3t) & Tổ phó (1t) với Phân công chuyên môn!');
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-indigo-200 transition cursor-pointer"
                  title="Đồng bộ tự động chức vụ Tổ trưởng (3t), Tổ phó (1t) với bảng Phân công chuyên môn kiêm nhiệm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đồng bộ kiêm nhiệm</span>
                </button>
              </div>

              {/* SEARCH INPUT */}
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên tổ, mã tổ, tổ trưởng..."
                    value={deptSearchTerm}
                    onChange={(e) => setDeptSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  {deptSearchTerm && (
                    <button
                      onClick={() => setDeptSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {selectedDeptIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteDeptModalOpen(true)}
                  className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedDeptIds.length} tổ)</span>
                </button>
              )}
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto flex-1 min-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-28">Mã tổ</th>
                    <th className="py-2.5 px-3">Tên tổ chuyên môn</th>
                    <th className="py-2.5 px-3">Tổ trưởng / Tổ phó</th>
                    <th className="py-2.5 px-3 text-center w-24">Giáo viên</th>
                    <th className="py-2.5 px-3 text-center w-24">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDepartments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                        {deptSearchTerm
                          ? 'Không tìm thấy tổ chuyên môn phù hợp từ khóa.'
                          : 'Chưa có tổ chuyên môn nào. Hãy thêm tổ mới ở tab "+ Thêm tổ mới".'}
                      </td>
                    </tr>
                  ) : (
                    filteredDepartments.map((d, idx) => {
                      const isSelected = selectedDeptIds.includes(d.id);
                      const memberTeachers = activeTeachers.filter((t) => t.departmentId === d.id);
                      const headTeacher = teachers.find((t) => t.id === d.headTeacherId);
                      const deputyIds = Array.isArray(d.deputyTeacherIds) && d.deputyTeacherIds.length > 0
                        ? d.deputyTeacherIds
                        : d.deputyTeacherId
                        ? [d.deputyTeacherId]
                        : [];
                      const deputyTeachers = deputyIds
                        .map((id) => teachers.find((t) => t.id === id))
                        .filter(Boolean) as Teacher[];

                      return (
                        <tr
                          key={d.id}
                          className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/70' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedDeptIds((prev) =>
                                  prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                                );
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{d.code}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 text-xs">{d.name}</div>
                            {(() => {
                              const cleanFullName = (d.fullName || '').replace(/^Biểu mẫu:\s*/i, '').trim();
                              const fullText = cleanFullName || (d.name.startsWith('Tổ ') ? d.name : `Tổ ${d.name}`);
                              if (fullText && fullText !== d.name) {
                                return (
                                  <div className="text-[11px] text-blue-700 font-medium">
                                    <span className="font-semibold">{fullText}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <div className="text-[10px] text-slate-400 font-mono">ID: {d.id}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-1 flex flex-wrap items-center gap-1">
                              {headTeacher ? (
                                <div className="inline-flex items-center gap-1 bg-blue-100/80 text-blue-900 text-[11px] font-bold px-2 py-0.5 rounded-md border border-blue-200">
                                  <ShieldCheck className="w-3 h-3 text-blue-700" />
                                  <span>TT: {headTeacher.fullName}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Chưa có Tổ trưởng</span>
                              )}
                              {deputyTeachers.map((dt, i) => (
                                <div
                                  key={dt.id}
                                  className="inline-flex items-center gap-1 bg-amber-100/80 text-amber-900 text-[11px] font-medium px-2 py-0.5 rounded-md border border-amber-200"
                                  title={`Tổ phó ${i + 1}`}
                                >
                                  <span>TP{deputyTeachers.length > 1 ? ` ${i + 1}` : ''}: {dt.fullName}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => setViewingDeptDetails(d)}
                              title="Xem danh sách giáo viên trong tổ"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-800 hover:text-blue-900 font-bold text-xs transition"
                            >
                              <Users className="w-3 h-3 text-blue-700" />
                              <span>{memberTeachers.length} GV</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {d.active !== false ? (
                              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full border border-emerald-200">
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-slate-200 text-slate-700 font-bold text-[10px] rounded-full">
                                Tạm dừng
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignDeptId(d.id);
                                  setDeptInputMode('ASSIGN_TEACHERS');
                                }}
                                title="Chọn / phân công GV vào tổ này"
                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditDept(d)}
                                title="Chỉnh sửa tổ chuyên môn"
                                className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewingDeptDetails(d)}
                                title="Xem danh sách GV"
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeptToDelete(d)}
                                title="Xóa tổ chuyên môn"
                                className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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
      {/* 6. KIÊM NHIỆM & MIỄN GIẢM (DUTIES) BULK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'DUTIES' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {!isActionPanelCollapsed && (
            <div className="space-y-4 w-full lg:w-64 lg:flex-shrink-0 animate-in fade-in duration-150">
              {/* Quick Standard Duties Catalog */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Nạp danh mục Kiêm nhiệm</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    title="Thu gọn cột tác vụ (độ rộng cột menu) để mở rộng bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
              <p className="text-xs text-slate-600">
                Tự động nạp: Chủ nhiệm (4 tiết), Tổ trưởng (3 tiết), Tổ phó (1 tiết), Tổng phụ trách (17 tiết), TTND (2 tiết), Thiết bị thí nghiệm (3 tiết), Tập sự (giảm 2 tiết)...
              </p>
              <button
                type="button"
                onClick={handleApplyStandardDuties}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Nạp danh mục chuẩn Bộ GD&ĐT
              </button>
            </div>

            {/* Bulk Assign Duty to Multiple Teachers */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Award className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">Gán kiêm nhiệm cho nhiều GV cùng lúc</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chọn nhiệm vụ kiêm nhiệm</label>
                  <select
                    value={assignDutyId}
                    onChange={(e) => setAssignDutyId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-bold"
                  >
                    {activeDuties.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.periodsPerWeekCalculated ? `+${d.periodsPerWeekCalculated} tiết` : `-${d.periodsPerWeekExempted} tiết`})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Hiện danh sách GV đang được gán nhiệm vụ này */}
                {(() => {
                  const targetD = activeDuties.find((d) => d.id === assignDutyId);
                  if (!targetD) return null;
                  const currentlyAssigned = currentVersionDutyAssignments.filter(
                    (a) =>
                      a.dutyId === targetD.id ||
                      (a.dutyName && a.dutyName.toLowerCase() === targetD.name.toLowerCase())
                  );
                  if (currentlyAssigned.length === 0) return null;
                  return (
                    <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                        <span>Đã gán cho {currentlyAssigned.length} giáo viên:</span>
                        <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-mono">Phiên bản hiện tại</span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {currentlyAssigned.map((asg) => {
                          const t = teachers.find((tch) => tch.id === asg.teacherId);
                          return (
                            <span
                              key={asg.id}
                              className="inline-flex items-center gap-1 bg-white text-blue-950 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            >
                              <span>{t?.fullName || asg.teacherId}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignmentToDelete({
                                    id: asg.id,
                                    teacherName: t?.fullName || asg.teacherId,
                                    dutyName: targetD.name,
                                  });
                                }}
                                className="text-slate-400 hover:text-red-600 ml-0.5 cursor-pointer p-0.5 hover:bg-red-50 rounded"
                                title="Hủy gán nhiệm vụ này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 text-xs">
                      Chọn GV ({assignDutyTeacherIds.length} đã chọn)
                    </label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const ids = filteredActiveTeachersForDuty.map((t) => t.id);
                          setAssignDutyTeacherIds((prev) => Array.from(new Set([...prev, ...ids])));
                        }}
                        className="text-blue-700 hover:underline font-bold cursor-pointer"
                      >
                        Chọn hết
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAssignDutyTeacherIds([])}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  {/* Teacher Search Input */}
                  <div className="relative mb-1.5">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo giáo viên hoặc môn..."
                      value={dutyAssignTeacherSearch}
                      onChange={(e) => setDutyAssignTeacherSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-7 pr-6 py-1 text-[11px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {dutyAssignTeacherSearch && (
                      <button
                        type="button"
                        onClick={() => setDutyAssignTeacherSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50">
                    {(() => {
                      const targetDutyObj = duties.find((d) => d.id === assignDutyId);
                      const targetDutyNorm = targetDutyObj ? normalizePositionName(targetDutyObj.name).toLowerCase() : '';

                      return filteredActiveTeachersForDuty.map((t) => {
                        // Kiểm tra xem giáo viên đã được gán nhiệm vụ này trong phiên bản hiện tại chưa
                        const existingAsg = currentVersionDutyAssignments.find(
                          (a) =>
                            a.teacherId === t.id &&
                            (a.dutyId === assignDutyId ||
                              (targetDutyNorm && a.dutyName && normalizePositionName(a.dutyName).toLowerCase() === targetDutyNorm))
                        );

                        // Hoặc có trong positions
                        const hasInPositions = targetDutyNorm && Array.isArray(t.positions) && t.positions.some(
                          (pos) => normalizePositionName(pos).toLowerCase() === targetDutyNorm
                        );

                        const isAlreadyAssigned = Boolean(existingAsg || hasInPositions);

                        return (
                          <label
                            key={t.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer text-xs transition ${
                              isAlreadyAssigned
                                ? 'bg-amber-50/70 border border-amber-200 hover:bg-amber-100/70'
                                : 'hover:bg-white'
                            }`}
                            title={t.positions && t.positions.length > 0 ? `Kiêm nhiệm: ${t.positions.join(', ')}` : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={assignDutyTeacherIds.includes(t.id)}
                              onChange={() => {
                                setAssignDutyTeacherIds((prev) =>
                                  prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                                );
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-900 truncate">{t.fullName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({t.code})</span>
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                              {isAlreadyAssigned && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap">
                                  Đã có ({existingAsg?.periodsPerWeek || targetDutyObj?.periodsPerWeekCalculated || targetDutyObj?.periodsPerWeekExempted || 0}t)
                                </span>
                              )}
                              {t.major && <span className="text-[10px] text-slate-400">{t.major}</span>}
                            </div>
                          </label>
                        );
                      });
                    })()}
                    {filteredActiveTeachersForDuty.length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-[11px]">
                        Không tìm thấy giáo viên nào.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleBulkAssignDuties}
                    disabled={assignDutyTeacherIds.length === 0}
                    className="w-full bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <Award className="w-4 h-4" /> Gán cho {assignDutyTeacherIds.length} GV
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBulkClearDutyTeacherModalOpen(true)}
                    disabled={assignDutyTeacherIds.length === 0}
                    className="w-full bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-[0.99]"
                    title="Xóa toàn bộ nhiệm vụ kiêm nhiệm của các giáo viên đang tích chọn"
                  >
                    <Briefcase className="w-4 h-4" /> Xóa kiêm nhiệm ({assignDutyTeacherIds.length} GV đã chọn)
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Duties Table / Assigned List View */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {isActionPanelCollapsed ? (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                    title="Mở lại cột Tác vụ kiêm nhiệm (độ rộng cột menu)"
                  >
                    <PanelLeftOpen className="w-4 h-4 text-blue-700" />
                    <span>Hiện cột tác vụ</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsActionPanelCollapsed(true)}
                    className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg text-xs font-medium transition cursor-pointer"
                    title="Thu gọn cột tác vụ để nhường toàn bộ diện tích cho bảng dữ liệu"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px]">Thu gọn cột</span>
                  </button>
                )}

                {/* Toggle Sub-tabs */}
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setDutiesViewTab('CATALOG')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      dutiesViewTab === 'CATALOG'
                        ? 'bg-white text-blue-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Danh mục nhiệm vụ ({activeDuties.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDutiesViewTab('ASSIGNED_LIST')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      dutiesViewTab === 'ASSIGNED_LIST'
                        ? 'bg-white text-emerald-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    GV đã được gán ({currentVersionDutyAssignments.length})
                  </button>
                </div>
              </div>

              {dutiesViewTab === 'CATALOG' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAddDuty}
                    className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm nhiệm vụ mới
                  </button>

                  <button
                    onClick={() => {
                      if (selectedDutyIds.length === activeDuties.length) setSelectedDutyIds([]);
                      else setSelectedDutyIds(activeDuties.map((d) => d.id));
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    {selectedDutyIds.length === activeDuties.length && activeDuties.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-700" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Chọn tất cả ({selectedDutyIds.length}/{activeDuties.length})</span>
                  </button>

                  {selectedDutyIds.length > 0 && (
                    <button
                      onClick={() => {
                        const count = dataStore.bulkDeleteDuties(selectedDutyIds);
                        setSelectedDutyIds([]);
                        showToast(`Đã xóa thành công ${count} nhiệm vụ khỏi danh mục!`);
                      }}
                      className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa hàng loạt ({selectedDutyIds.length} mục)
                    </button>
                  )}
                </div>
              )}

              {dutiesViewTab === 'ASSIGNED_LIST' && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search box by teacher name or duty name */}
                  <div className="relative min-w-[200px] max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên GV, mã, nhiệm vụ..."
                      value={assignedDutySearchTerm}
                      onChange={(e) => setAssignedDutySearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-xs rounded-xl pl-8 pr-6 py-1.5 font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                    {assignedDutySearchTerm && (
                      <button
                        type="button"
                        onClick={() => setAssignedDutySearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Type Filter */}
                  <select
                    value={assignedDutyTypeFilter}
                    onChange={(e) => setAssignedDutyTypeFilter(e.target.value as any)}
                    className="bg-white border border-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-semibold text-slate-800"
                  >
                    <option value="ALL">Tất cả ({currentVersionDutyAssignments.length})</option>
                    <option value="CONCURRENT">Kiêm nhiệm ({currentVersionDutyAssignments.filter((a) => a.type !== 'EXEMPTION').length})</option>
                    <option value="EXEMPTION">Miễn giảm ({currentVersionDutyAssignments.filter((a) => a.type === 'EXEMPTION').length})</option>
                  </select>

                  {/* Select all */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedAssignedDutyIds.length === filteredAssignedDuties.length && filteredAssignedDuties.length > 0) {
                        setSelectedAssignedDutyIds([]);
                      } else {
                        setSelectedAssignedDutyIds(filteredAssignedDuties.map((a) => a.id));
                      }
                    }}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    {selectedAssignedDutyIds.length === filteredAssignedDuties.length && filteredAssignedDuties.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-700" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Chọn tất cả ({selectedAssignedDutyIds.length}/{filteredAssignedDuties.length})</span>
                  </button>

                  {/* Bulk Delete */}
                  {selectedAssignedDutyIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const count = dataStore.bulkDeleteDutyAssignments(selectedAssignedDutyIds);
                        showToast(`Đã xóa ${count} phân công kiêm nhiệm & miễn giảm!`);
                        setSelectedAssignedDutyIds([]);
                      }}
                      className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa đã chọn ({selectedAssignedDutyIds.length} mục)</span>
                    </button>
                  )}

                  {/* Clear all duties in school button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Bạn có chắc chắn muốn xóa sạch TẤT CẢ phân công kiêm nhiệm & miễn giảm của toàn bộ trường? Thao tác này sẽ giải phóng kiêm nhiệm của tất cả giáo viên và tính lại định mức.')) {
                        const count = dataStore.bulkClearDutiesForTeachers();
                        showToast(`Đã xóa sạch toàn bộ ${count} phân công kiêm nhiệm và miễn giảm trong toàn trường!`);
                        setSelectedAssignedDutyIds([]);
                      }
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    title="Xóa triệt để toàn bộ nhiệm vụ kiêm nhiệm của tất cả giáo viên trong trường"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                    <span>Xóa sạch tất cả kiêm nhiệm</span>
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto flex-1 max-h-[520px]">
              {dutiesViewTab === 'CATALOG' ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Mã</th>
                      <th className="py-2.5 px-3">Tên nhiệm vụ / Miễn giảm</th>
                      <th className="py-2.5 px-3">Phân loại</th>
                      <th className="py-2.5 px-3">Giáo viên được gán</th>
                      <th className="py-2.5 px-3 text-center">Tiết tính</th>
                      <th className="py-2.5 px-3 text-center">Tiết miễn</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDuties.map((d) => {
                      const isSelected = selectedDutyIds.includes(d.id);
                      const isHead = dataStore.isHeadDepartmentDuty(d.id, d.name, d.code);
                      const isDep = dataStore.isDeputyDepartmentDuty(d.id, d.name, d.code);
                      const rawAssigned = currentVersionDutyAssignments.filter(
                        (a) =>
                          a.dutyId === d.id ||
                          a.dutyId === d.code ||
                          (isHead && dataStore.isHeadDepartmentDuty(a.dutyId, a.dutyName)) ||
                          (isDep && dataStore.isDeputyDepartmentDuty(a.dutyId, a.dutyName)) ||
                          (a.dutyName && a.dutyName.toLowerCase() === d.name.toLowerCase()) ||
                          (d.code === 'CHU_NHIEM' && a.dutyName?.toLowerCase().includes('chủ nhiệm'))
                      );

                      // Khử trùng lặp tuyệt đối: Mỗi giáo viên chỉ xuất hiện DUY NHẤT 1 LẦN trong danh sách huy hiệu
                      const assignedMap = new Map<string, TeachingAssignment>();
                      for (const asg of rawAssigned) {
                        if (!assignedMap.has(asg.teacherId)) {
                          assignedMap.set(asg.teacherId, asg);
                        }
                      }
                      const assignedToDuty = Array.from(assignedMap.values());

                      return (
                        <tr key={d.id} className={`hover:bg-slate-50 transition ${isSelected ? 'bg-blue-50/60' : ''}`}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedDutyIds((prev) =>
                                  prev.includes(d.id) ? prev.filter((id) => id !== d.id) : [...prev, d.id]
                                );
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{d.code}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900">{d.name}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                d.type === 'EXEMPTION'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {d.type === 'EXEMPTION' ? 'Miễn giảm định mức' : 'Kiêm nhiệm'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 min-w-[180px]">
                            {assignedToDuty.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {assignedToDuty.map((asg) => {
                                  const teacher = teachers.find((t) => t.id === asg.teacherId);
                                  return (
                                    <span
                                      key={`${d.id}_${asg.teacherId}`}
                                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200/80 px-2 py-0.5 rounded-lg text-[11px] font-bold shadow-2xs"
                                    >
                                      <span>{teacher?.fullName || asg.teacherId}</span>
                                      <span className="text-[10px] text-blue-600 font-mono">
                                        ({asg.periodsPerWeek}t)
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAssignmentToDelete({
                                            id: asg.id,
                                            teacherId: asg.teacherId,
                                            dutyId: d.id,
                                            teacherName: teacher?.fullName || asg.teacherId,
                                            dutyName: d.name,
                                          });
                                        }}
                                        className="text-slate-400 hover:text-red-700 ml-0.5 transition cursor-pointer p-0.5 hover:bg-red-50 rounded"
                                        title="Hủy gán nhiệm vụ này"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Chưa gán</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-800">
                            {d.periodsPerWeekCalculated ? `+${d.periodsPerWeekCalculated}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-800">
                            {d.periodsPerWeekExempted ? `-${d.periodsPerWeekExempted}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditDuty(d)}
                                className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Chỉnh sửa nhiệm vụ này"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDutyToDelete(d)}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Xóa nhiệm vụ"
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
              ) : (
                /* Tab view dedicated for all Assigned Teachers */
                <table className="w-full text-left text-xs">
                  <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={
                            selectedAssignedDutyIds.length === filteredAssignedDuties.length &&
                            filteredAssignedDuties.length > 0
                          }
                          onChange={() => {
                            if (selectedAssignedDutyIds.length === filteredAssignedDuties.length) {
                              setSelectedAssignedDutyIds([]);
                            } else {
                              setSelectedAssignedDutyIds(filteredAssignedDuties.map((a) => a.id));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3 w-10 text-center">STT</th>
                      <th className="py-2.5 px-3">Mã GV</th>
                      <th className="py-2.5 px-3">Họ và tên giáo viên</th>
                      <th className="py-2.5 px-3">Tổ chuyên môn</th>
                      <th className="py-2.5 px-3">Nhiệm vụ / Miễn giảm đã gán</th>
                      <th className="py-2.5 px-3">Phân loại</th>
                      <th className="py-2.5 px-3 text-center">Số tiết</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAssignedDuties.map((asg, idx) => {
                      const teacher = teachers.find((t) => t.id === asg.teacherId);
                      const dept = departments.find((d) => d.id === teacher?.departmentId);
                      const isExemption = asg.type === 'EXEMPTION';
                      const isRowSelected = selectedAssignedDutyIds.includes(asg.id);

                      return (
                        <tr key={asg.id} className={`hover:bg-slate-50 transition ${isRowSelected ? 'bg-blue-50/60' : ''}`}>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={() => {
                                setSelectedAssignedDutyIds((prev) =>
                                  prev.includes(asg.id) ? prev.filter((id) => id !== asg.id) : [...prev, asg.id]
                                );
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{teacher?.code || '-'}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900">{teacher?.fullName || asg.teacherId}</td>
                          <td className="py-2.5 px-3 text-slate-600">{dept?.name || '-'}</td>
                          <td className="py-2.5 px-3 font-bold text-blue-900">{asg.dutyName || 'Kiêm nhiệm'}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isExemption ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isExemption ? 'Miễn giảm định mức' : 'Kiêm nhiệm'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            <span className={isExemption ? 'text-amber-800' : 'text-emerald-800'}>
                              {isExemption ? `-${asg.periodsPerWeek}` : `+${asg.periodsPerWeek}`} tiết
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignmentToDelete({
                                  id: asg.id,
                                  teacherId: asg.teacherId,
                                  dutyId: asg.dutyId || asg.dutyName,
                                  teacherName: teacher?.fullName || asg.teacherId,
                                  dutyName: asg.dutyName || 'Kiêm nhiệm',
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Hủy phân công nhiệm vụ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredAssignedDuties.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          {assignedDutySearchTerm
                            ? 'Không tìm thấy kết quả phù hợp với từ khóa tìm kiếm.'
                            : 'Chưa có giáo viên nào được gán nhiệm vụ kiêm nhiệm hoặc miễn giảm trong phiên bản này.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6.5. DANH MỤC VIẾT TẮT (ABBREVIATIONS) TAB */}
      {/* ========================================================================= */}
      {activeTab === 'ABBREVIATIONS' && (
        <div className="space-y-4">
          <AbbreviationManagementView onNavigate={(tab) => onNavigateToAssignments?.()} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. LƯU & QUẢN LÝ PHIÊN BẢN (VERSIONS) BULK TAB */}
      {/* ========================================================================= */}
      {activeTab === 'VERSIONS' && (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Quick Snapshot & Save as New Version */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5 w-full lg:w-64 lg:flex-shrink-0">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase">Lưu phân công thành Phiên bản mới</h3>
            </div>

            <p className="text-xs text-slate-600">
              Mỗi học kỳ có thể thực hiện phân công nhiều lần (Lần 1 đầu năm, Điều chỉnh lần 2, Đợt thay đổi thai sản...). Bạn có thể lưu bản chụp (snapshot) hiện tại để điều chỉnh mà không mất bản cũ.
            </p>

            <form onSubmit={handleQuickSaveNewVersion} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên phiên bản mới *</label>
                <input
                  type="text"
                  placeholder={`VD: ${semesterId} - Phân công Lần 2 (Sau điều chỉnh)`}
                  value={newVersionTitle}
                  onChange={(e) => setNewVersionTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Áp dụng cho học kỳ</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewVersionTargetSem('HK1')}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      newVersionTargetSem === 'HK1'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Học kỳ I (18 tuần)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewVersionTargetSem('HK2')}
                    className={`py-2 rounded-xl text-xs font-bold transition ${
                      newVersionTargetSem === 'HK2'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Học kỳ II (17 tuần)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú lý do tạo đợt phân công</label>
                <textarea
                  rows={2}
                  placeholder="Lý do điều chỉnh (ví dụ: bổ sung giáo viên mới, thay đổi TKB...)"
                  value={newVersionNotes}
                  onChange={(e) => setNewVersionNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="p-2.5 bg-blue-50 rounded-xl text-[11px] text-blue-900 border border-blue-200">
                Toàn bộ dữ liệu phân công của phiên bản <strong>"{currentVersion?.name}"</strong> sẽ được nhân bản sang phiên bản mới.
              </div>

              <button
                type="submit"
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <Save className="w-4 h-4" /> Lưu thành phiên bản mới
              </button>
            </form>
          </div>

          {/* Right: Version List with Switch, Lock, Official & Delete */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Danh sách các đợt phân công ({semesterId === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'})
                </h3>
                <span className="text-xs text-slate-500">Quản lý và chuyển đổi nhanh giữa các phiên bản</span>
              </div>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[520px]">
              {currentSemesterVersions.map((v) => {
                const isActiveVersion = v.id === versionId;
                const assignmentCount = assignments.filter((a) => a.versionId === v.id && !a.isDeleted).length;

                return (
                  <div
                    key={v.id}
                    className={`p-4 rounded-2xl border transition ${
                      isActiveVersion
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900">{v.name}</h4>
                          {isActiveVersion && (
                            <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Đang kích hoạt
                            </span>
                          )}
                          {v.isOfficial && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Bản chính thức
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              v.status === 'locked'
                                ? 'bg-red-100 text-red-800'
                                : v.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {v.status === 'locked' ? '🔒 Đã khóa' : v.status === 'approved' ? '✓ Đã duyệt' : '📝 Bản nháp'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-3">
                          <span>Số dòng phân công: <strong className="text-slate-800">{assignmentCount} dòng</strong></span>
                          <span>•</span>
                          <span>Tạo lúc: {new Date(v.createdAt).toLocaleDateString('vi-VN')} ({v.createdBy})</span>
                        </div>
                        {v.notes && <p className="text-[11px] text-slate-600 italic">"{v.notes}"</p>}
                      </div>

                      {/* Action buttons for Version */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isActiveVersion && (
                          <button
                            onClick={() => {
                              dataStore.setSelectedContext(schoolYearId, v.semesterId, v.id);
                              showToast(`Đã chuyển sang xem và làm việc với phiên bản: "${v.name}"!`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 flex items-center gap-1 transition"
                          >
                            <ArrowRight className="w-3.5 h-3.5" /> Chuyển sang bản này
                          </button>
                        )}

                        {!v.isOfficial && (
                          <button
                            onClick={() => handleSetOfficialVersion(v.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-xs font-bold transition"
                            title="Đặt làm phương án chính thức"
                          >
                            Đặt chính thức
                          </button>
                        )}

                        {v.status === 'draft' ? (
                          <button
                            onClick={() => {
                              dataStore.approveVersion(v.id, 'Ban Giám hiệu');
                              showToast(`✅ Đã phê duyệt phương án "${v.name}" thành Bản duyệt chính thức!`);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Phê duyệt phương án này thành Bản duyệt chính thức"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Duyệt</span>
                          </button>
                        ) : v.status === 'approved' ? (
                          <button
                            onClick={() => {
                              dataStore.unapproveVersion(v.id);
                              showToast(`Đã chuyển phương án "${v.name}" về Bản nháp`);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Chuyển về Bản nháp để hiệu chỉnh thêm"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-amber-600" />
                            <span>Về nháp</span>
                          </button>
                        ) : null}

                        <button
                          onClick={() => {
                            if (v.status === 'locked') {
                              dataStore.setVersionStatus(v.id, 'draft');
                              showToast('Đã mở khóa phiên bản để chỉnh sửa');
                            } else {
                              dataStore.setVersionStatus(v.id, 'locked', 'Khóa phương án phân công');
                              showToast('Đã khóa phiên bản!');
                            }
                          }}
                          className={`p-1.5 rounded-xl border text-xs font-bold transition ${
                            v.status === 'locked'
                              ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={v.status === 'locked' ? 'Mở khóa' : 'Khóa phiên bản'}
                        >
                          {v.status === 'locked' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleDeleteVersion(v.id)}
                          className="p-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-700 border border-slate-200 text-xs transition"
                          title="Xóa phiên bản này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. NHẬP / XUẤT EXCEL & CẬP NHẬT DỮ LIỆU HỆ THỐNG */}
      {/* ========================================================================= */}
      {activeTab === 'EXCEL' && (
        <div className="space-y-4">
          {/* TOP BANNER */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                  Excel Studio
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Xuất Nhập Excel & Bảng Xem Trước Dữ Liệu
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tải lên tệp Excel (.xlsx), tự động nhận diện cấu trúc, kiểm tra trước dữ liệu và cập nhật trực tiếp vào hệ thống phân công chuyên môn.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsTeacherMasterImportModalOpen(true)}
                className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                title="Nhập toàn bộ thông tin gốc của giáo viên từ file Excel chuẩn 19+ cột"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-200" />
                <span>Nhập Hồ sơ gốc GV (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const currentSchool = excelSchoolInfo || dataStore.getSchoolInfo();
                  await exportTeacherMasterProfileTemplate(currentSchool);
                  showToast('✅ Đã tải file Mẫu Excel Hồ sơ gốc Giáo viên (đầy đủ 19+ cột)!');
                }}
                className="bg-white hover:bg-blue-50 text-blue-900 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-blue-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="Tải mẫu Excel hồ sơ gốc giáo viên với 19+ trường thông tin chuẩn"
              >
                <Download className="w-4 h-4 text-blue-700" />
                <span>Mẫu Hồ sơ gốc GV</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const currentSchool = excelSchoolInfo || dataStore.getSchoolInfo();
                  await exportExcelTemplate(currentSchool);
                  showToast(`✅ Đã tải file Mẫu Excel chuẩn (.xlsx) cho đơn vị "${currentSchool.schoolName}"!`);
                }}
                className="bg-white hover:bg-emerald-50 text-emerald-800 font-bold px-3.5 py-2.5 rounded-xl text-xs border border-emerald-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                title="Tải mẫu Excel chuẩn (Dữ liệu GV, Lớp học, Phân công) với tên trường hiện tại"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Tải Mẫu Excel phân công</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerExcelExport}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Xuất Sổ Excel Đầy Đủ (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* MAIN EXCEL WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT COLUMN: UPLOAD & SETTINGS */}
            <div className="lg:col-span-1 space-y-4">
              {/* UPLOAD BOX */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-blue-700" />
                    <span>Tải tệp Excel lên</span>
                  </h4>
                  <button
                    type="button"
                    onClick={loadSampleExcelPreview}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem mẫu</span>
                  </button>
                </div>

                <div className="border-2 border-dashed border-blue-300 bg-blue-50/30 hover:bg-blue-50 rounded-2xl p-4 text-center transition cursor-pointer group">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileChange}
                    className="hidden"
                    id="bulk-excel-upload-input"
                  />
                  <label htmlFor="bulk-excel-upload-input" className="cursor-pointer block">
                    <Upload className="w-7 h-7 text-blue-700 mx-auto mb-1.5 group-hover:scale-110 transition" />
                    <span className="font-bold text-slate-800 text-xs block">
                      {excelUploadFile ? excelUploadFile.name : 'Bấm để chọn file Excel hoặc kéo thả'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Tệp định dạng Microsoft Excel (.xlsx)
                    </span>
                  </label>
                </div>

                {isExcelProcessing && (
                  <div className="text-center py-2.5 text-blue-700 font-bold text-xs flex items-center justify-center gap-2 bg-blue-50 rounded-xl">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang nhận diện dữ liệu Excel...
                  </div>
                )}
              </div>

              {/* SCHOOL & YEAR RECOGNITION */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-800" />
                  <h4 className="font-bold text-slate-900 text-xs">
                    Tự động nhận diện trường & năm học
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500">
                  Trích xuất tự động từ tiêu đề sheet Excel hoặc cho phép bạn điều chỉnh trước khi nạp:
                </p>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Cơ quan quản lý trực tiếp (UBND / SỞ)</label>
                    <input
                      type="text"
                      value={excelSchoolInfo.authorityName || ''}
                      onChange={(e) => setExcelSchoolInfo({ ...excelSchoolInfo, authorityName: e.target.value })}
                      placeholder="Nhập UBND... hoặc SỞ... (để trống nếu không dùng)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">
                      Tên trường học {(!dataStore.getCurrentUser()?.isSuperAdmin && !dataStore.getCurrentUser()?.email?.includes('nguyentoanqh')) && '(Cố định theo Bản quyền)'}
                    </label>
                    <input
                      type="text"
                      value={excelSchoolInfo.schoolName}
                      onChange={(e) => {
                        const u = dataStore.getCurrentUser();
                        if (u?.isSuperAdmin || u?.email?.includes('nguyentoanqh')) {
                          setExcelSchoolInfo({ ...excelSchoolInfo, schoolName: e.target.value });
                        }
                      }}
                      readOnly={!dataStore.getCurrentUser()?.isSuperAdmin && !dataStore.getCurrentUser()?.email?.includes('nguyentoanqh')}
                      placeholder={excelSchoolInfo.schoolName || 'VD: TRƯỜNG THCS'}
                      className={`w-full border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none ${
                        (!dataStore.getCurrentUser()?.isSuperAdmin && !dataStore.getCurrentUser()?.email?.includes('nguyentoanqh'))
                          ? 'bg-slate-100 cursor-not-allowed text-slate-700'
                          : 'bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Năm học</label>
                    <input
                      type="text"
                      value={excelSchoolInfo.schoolYear}
                      onChange={(e) => setExcelSchoolInfo({ ...excelSchoolInfo, schoolYear: e.target.value })}
                      placeholder={excelSchoolInfo.schoolYear || 'VD: 2026-2027'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-blue-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Phân hiệu / Điểm trường</label>
                    <input
                      type="text"
                      value={excelSchoolInfo.branchName || ''}
                      onChange={(e) => setExcelSchoolInfo({ ...excelSchoolInfo, branchName: e.target.value })}
                      placeholder={excelSchoolInfo.branchName || 'VD: PHÂN HIỆU / ĐIỂM TRƯỜNG'}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveSchoolInfoDirectly}
                      className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Lưu thông tin trường & năm học này</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* IMPORT MODE OPTIONS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-blue-700" />
                  <span>Tùy chọn chế độ nạp dữ liệu</span>
                </div>

                <div className="space-y-2 text-xs">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      excelImportMode === 'MERGE'
                        ? 'bg-blue-50/80 border-blue-500 text-blue-950 font-bold ring-1 ring-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulkExcelImportMode"
                      value="MERGE"
                      checked={excelImportMode === 'MERGE'}
                      onChange={() => setExcelImportMode('MERGE')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-bold text-blue-900">Cập nhật & Thêm mới (Merge)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-normal">
                        Nạp thêm và cập nhật thông tin mà không làm mất dữ liệu hiện tại.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                      excelImportMode === 'REPLACE'
                        ? 'bg-red-50/80 border-red-500 text-red-950 font-bold ring-1 ring-red-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulkExcelImportMode"
                      value="REPLACE"
                      checked={excelImportMode === 'REPLACE'}
                      onChange={() => setExcelImportMode('REPLACE')}
                      className="mt-0.5 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="font-bold text-red-700">Ghi đè hoàn toàn (Replace)</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-normal">
                        Thay thế toàn bộ dữ liệu cũ bằng dữ liệu mới từ file Excel.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW STAGING TABLE & PROMINENT UPDATE BUTTON */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                {/* 3 PREVIEW TABS WITH STATISTIC BADGES */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-700" />
                      <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                        Bảng xem trước dữ liệu Excel nhận diện
                      </h4>
                    </div>
                    {excelImportPreview && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng cập nhật
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setExcelPreviewSubTab('TEACHERS')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        excelPreviewSubTab === 'TEACHERS'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-700" />
                        <span>DS Giáo viên</span>
                      </div>
                      <div className="text-lg font-black text-blue-900 mt-1">
                        {excelImportPreview?.teachersToImport.length || 0}{' '}
                        <span className="text-xs font-normal text-slate-600">hồ sơ</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setExcelPreviewSubTab('CLASSES')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        excelPreviewSubTab === 'CLASSES'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-700" />
                        <span>DS Lớp học</span>
                      </div>
                      <div className="text-lg font-black text-blue-900 mt-1">
                        {excelImportPreview?.classesToImport.length || 0}{' '}
                        <span className="text-xs font-normal text-slate-600">lớp</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setExcelPreviewSubTab('ASSIGNMENTS')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        excelPreviewSubTab === 'ASSIGNMENTS'
                          ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-blue-700" />
                        <span>DS Phân công</span>
                      </div>
                      <div className="text-lg font-black text-blue-900 mt-1">
                        {excelImportPreview?.assignmentsToImport.length || 0}{' '}
                        <span className="text-xs font-normal text-slate-600">tiết/nhiệm vụ</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* TABLE VIEW */}
                <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50/50">
                  {excelPreviewSubTab === 'TEACHERS' && (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold">
                        <tr>
                          <th className="p-2.5">Mã GV</th>
                          <th className="p-2.5">Họ và tên</th>
                          <th className="p-2.5">Nơi làm việc</th>
                          <th className="p-2.5">Chuyên ngành</th>
                          <th className="p-2.5 text-center">Định mức</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {excelImportPreview?.teachersToImport.map((t, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40">
                            <td className="p-2.5 font-mono font-bold text-blue-800">{t.code}</td>
                            <td className="p-2.5 font-medium text-slate-900">{t.fullName}</td>
                            <td className="p-2.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                {t.workplace || 'Điểm chính'}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-600">{t.major}</td>
                            <td className="p-2.5 text-center font-bold text-blue-900">{t.standardQuota} tiết</td>
                          </tr>
                        ))}
                        {(!excelImportPreview || excelImportPreview.teachersToImport.length === 0) && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                              Chưa có dữ liệu giáo viên trong bản xem trước. Hãy tải file Excel hoặc bấm "Xem mẫu".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {excelPreviewSubTab === 'CLASSES' && (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold">
                        <tr>
                          <th className="p-2.5">Mã / Tên lớp</th>
                          <th className="p-2.5 text-center">Khối</th>
                          <th className="p-2.5 text-center">Sĩ số</th>
                          <th className="p-2.5">Buổi học</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {excelImportPreview?.classesToImport.map((c, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40">
                            <td className="p-2.5 font-bold text-blue-800">{c.code}</td>
                            <td className="p-2.5 text-center font-semibold text-slate-700">{c.grade}</td>
                            <td className="p-2.5 text-center font-bold">{c.studentCount} HS</td>
                            <td className="p-2.5 text-slate-600">
                              {c.session === 'AFTERNOON'
                                ? 'Buổi Chiều'
                                : c.session === 'FULL_DAY' || (c.session as any) === 'TWO_SESSIONS_PER_DAY'
                                ? '2 buổi/ngày'
                                : 'Buổi Sáng'}
                            </td>
                          </tr>
                        ))}
                        {(!excelImportPreview || excelImportPreview.classesToImport.length === 0) && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400">
                              Chưa có dữ liệu lớp học trong bản xem trước. Hãy tải file Excel hoặc bấm "Xem mẫu".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {excelPreviewSubTab === 'ASSIGNMENTS' && (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-200/80 text-slate-700 sticky top-0 font-bold">
                        <tr>
                          <th className="p-2.5">Thông tin phân công</th>
                          <th className="p-2.5">Loại</th>
                          <th className="p-2.5 text-center">Số tiết/tuần</th>
                          <th className="p-2.5">Buổi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {excelImportPreview?.assignmentsToImport.map((a, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40">
                            <td className="p-2.5 font-medium text-slate-800">{a.notes || 'Phân công môn học'}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  a.type === 'CONCURRENT'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-blue-100 text-blue-900'
                                }`}
                              >
                                {a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Giảng dạy'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-bold text-blue-900">{a.periodsPerWeek} tiết</td>
                            <td className="p-2.5 text-slate-500">
                              {a.session === 'AFTERNOON'
                                ? 'Chiều'
                                : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
                                ? '2 buổi/ngày'
                                : 'Sáng'}
                            </td>
                          </tr>
                        ))}
                        {(!excelImportPreview || excelImportPreview.assignmentsToImport.length === 0) && (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400">
                              Chưa có dữ liệu phân công trong bản xem trước. Hãy tải file Excel hoặc bấm "Xem mẫu".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* SUCCESS NOTIFICATION BANNER IF IMPORTED */}
                {excelImportSuccessResult && (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl animate-in fade-in zoom-in-95 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-900 font-black text-sm sm:text-base">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <span>CẬP NHẬT VÀO HỆ THỐNG THÀNH CÔNG!</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        {excelImportSuccessResult.timestamp}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="bg-white p-2 rounded-xl border border-emerald-200">
                        <div className="text-base font-black text-emerald-700">{excelImportSuccessResult.teachersCount}</div>
                        <div className="text-[11px] font-bold text-slate-600">Giáo viên đã nạp</div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-emerald-200">
                        <div className="text-base font-black text-emerald-700">{excelImportSuccessResult.classesCount}</div>
                        <div className="text-[11px] font-bold text-slate-600">Lớp học đã nạp</div>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-emerald-200">
                        <div className="text-base font-black text-emerald-700">{excelImportSuccessResult.assignmentsCount}</div>
                        <div className="text-[11px] font-bold text-slate-600">Phân công đã nạp</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-emerald-900">
                      <div>
                        Đơn vị: <strong>{excelImportSuccessResult.schoolName}</strong> ({excelImportSuccessResult.schoolYear}) • Chế độ:{' '}
                        <strong>{excelImportSuccessResult.mode === 'REPLACE' ? 'Ghi đè hoàn toàn' : 'Cập nhật & Thêm mới'}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveTab('TEACHERS')}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition"
                        >
                          Xem danh sách GV &rarr;
                        </button>
                        <button
                          onClick={() => setActiveTab('CLASSES')}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition"
                        >
                          Xem danh sách Lớp &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PROMINENT PRIMARY ACTION BUTTON */}
                <div className="pt-2">
                  <button
                    id="bulk-execute-import-excel-btn"
                    onClick={handleExecuteExcelImport}
                    className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:via-teal-700 hover:to-emerald-800 text-white font-black px-6 py-4 rounded-2xl flex items-center justify-center gap-3 text-base shadow-lg hover:shadow-xl transition active:scale-[0.98] cursor-pointer"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>CẬP NHẬT DỮ LIỆU VÀO HỆ THỐNG</span>
                    {excelImportPreview && (
                      <span className="bg-white/20 px-2.5 py-1 rounded-lg text-xs font-bold ml-1">
                        ({excelImportPreview.teachersToImport.length} GV • {excelImportPreview.classesToImport.length} Lớp • {excelImportPreview.assignmentsToImport.length} Phân công)
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CHỈNH SỬA TỔ CHUYÊN MÔN */}
      {/* ========================================================================= */}
      {editingDept && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-900">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chỉnh sửa Tổ chuyên môn</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {editingDept.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên tổ chuyên môn (thường dùng) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  placeholder="VD: Toán – Tin"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên đầy đủ của tổ <span className="text-rose-600">*</span>
                  <span className="text-[11px] font-normal text-blue-700 ml-1">
                    (dùng trong biểu mẫu, báo cáo - không dùng viết tắt)
                  </span>
                </label>
                <input
                  type="text"
                  value={editDeptFullName}
                  onChange={(e) => setEditDeptFullName(e.target.value)}
                  placeholder="VD: Tổ Toán – Tin học"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Tên này sẽ hiển thị trên các biểu mẫu in và xuất Excel chính thức.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mã định danh tổ <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={editDeptCode}
                  onChange={(e) => setEditDeptCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="VD: TO_TOAN_TIN"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tổ trưởng chuyên môn</label>
                <SearchableTeacherSelect
                  teachers={activeTeachers}
                  value={editDeptHeadTeacherId}
                  onChange={(id) => setEditDeptHeadTeacherId(id)}
                  placeholder="-- Chọn hoặc tìm kiếm Tổ trưởng --"
                  clearLabel="-- Không có Tổ trưởng (Bỏ chọn) --"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700">
                    Tổ phó chuyên môn ({editDeptDeputyTeacherIds.length > 0 ? `${editDeptDeputyTeacherIds.length} người` : 'Chưa có'})
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditDeptDeputyTeacherIds((prev) => [...prev, ''])}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                    title="Thêm một vị trí Tổ phó"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm tổ phó</span>
                  </button>
                </div>

                {editDeptDeputyTeacherIds.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditDeptDeputyTeacherIds([''])}
                    className="w-full py-2 px-3 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600 hover:text-blue-700 hover:border-blue-400 bg-slate-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>Chỉ định Tổ phó (hỗ trợ 1, 2, 3... tổ phó)</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {editDeptDeputyTeacherIds.map((deputyId, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 w-16 flex-shrink-0">
                          Tổ phó {idx + 1}:
                        </span>
                        <div className="flex-1">
                          <SearchableTeacherSelect
                            teachers={activeTeachers}
                            value={deputyId}
                            filterPredicate={(t) =>
                              t.id !== editDeptHeadTeacherId &&
                              (!editDeptDeputyTeacherIds.includes(t.id) || t.id === deputyId)
                            }
                            onChange={(val) => {
                              setEditDeptDeputyTeacherIds((prev) => {
                                const next = [...prev];
                                next[idx] = val;
                                return next;
                              });
                            }}
                            compact
                            placeholder={`-- Tìm hoặc chọn Tổ phó ${idx + 1} --`}
                            clearLabel={`-- Bỏ chọn Tổ phó ${idx + 1} --`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditDeptDeputyTeacherIds((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer flex-shrink-0"
                          title="Xóa tổ phó này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit-dept-active-toggle"
                  checked={editDeptActive}
                  onChange={(e) => setEditDeptActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="edit-dept-active-toggle" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Tổ đang hoạt động bình thường
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingDept(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditDept}
                className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DANH SÁCH GIÁO VIÊN TRONG TỔ CHUYÊN MÔN */}
      {/* ========================================================================= */}
      {viewingDeptDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-900">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{viewingDeptDetails.name}</h3>
                  <p className="text-xs text-slate-500">Mã tổ: <span className="font-mono font-bold text-slate-700">{viewingDeptDetails.code}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDeptDetails(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SUMMARY STATS */}
            {(() => {
              const members = activeTeachers.filter((t) => t.departmentId === viewingDeptDetails.id);
              const headTeacher = teachers.find((t) => t.id === viewingDeptDetails.headTeacherId);
              const deputyIds = Array.isArray(viewingDeptDetails.deputyTeacherIds) && viewingDeptDetails.deputyTeacherIds.length > 0
                ? viewingDeptDetails.deputyTeacherIds
                : viewingDeptDetails.deputyTeacherId
                ? [viewingDeptDetails.deputyTeacherId]
                : [];
              const deputyTeachers = deputyIds
                .map((id) => teachers.find((t) => t.id === id))
                .filter(Boolean) as Teacher[];

              return (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                      <div className="text-lg font-black text-blue-900">{members.length}</div>
                      <div className="text-[11px] font-bold text-blue-700">Tổng số Giáo viên</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div className="text-xs font-black text-slate-900 truncate" title={headTeacher?.fullName}>
                        {headTeacher ? headTeacher.fullName : 'Chưa phân công'}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">Tổ trưởng</div>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <div
                        className="text-xs font-black text-slate-900 truncate"
                        title={deputyTeachers.length > 0 ? deputyTeachers.map((d) => d.fullName).join(', ') : 'Chưa phân công'}
                      >
                        {deputyTeachers.length > 0
                          ? deputyTeachers.map((d) => d.fullName).join(', ')
                          : 'Chưa phân công'}
                      </div>
                      <div className="text-[11px] font-bold text-slate-600">
                        Tổ phó ({deputyTeachers.length})
                      </div>
                    </div>
                  </div>

                  {/* MEMBERS TABLE */}
                  <div className="overflow-x-auto overflow-y-auto flex-1 border border-slate-200 rounded-xl max-h-[350px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 text-blue-950 uppercase text-[11px] tracking-wider font-bold border-b-2 border-blue-200/80 sticky top-0 z-10 shadow-2xs">
                        <tr>
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3 w-20">Mã GV</th>
                          <th className="py-2.5 px-3">Họ và tên</th>
                          <th className="py-2.5 px-3">Chức vụ trong tổ</th>
                          <th className="py-2.5 px-3">Chuyên ngành</th>
                          <th className="py-2.5 px-3 text-center">Định mức</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {members.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                              Chưa có giáo viên nào được phân vào tổ này. Hãy vào tab "2. Giáo viên" hoặc "Quản lý Giáo viên" để phân tổ.
                            </td>
                          </tr>
                        ) : (
                          members.map((m, idx) => {
                            const isHead = m.id === viewingDeptDetails.headTeacherId;
                            const depIdx = deputyIds.indexOf(m.id);
                            const isDeputy = depIdx !== -1;

                            return (
                              <tr key={m.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{m.code}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{m.fullName}</td>
                                <td className="py-2.5 px-3">
                                  {isHead ? (
                                    <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md text-[10px] border border-blue-200">
                                      <ShieldCheck className="w-3 h-3 text-blue-700" />
                                      Tổ trưởng
                                    </span>
                                  ) : isDeputy ? (
                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md text-[10px] border border-amber-200">
                                      Tổ phó{deputyTeachers.length > 1 ? ` ${depIdx + 1}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">Thành viên</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">{m.major || 'Sư phạm'}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-blue-900">
                                  {m.baseQuota || 19} tiết
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetDept = viewingDeptDetails;
                    setViewingDeptDetails(null);
                    setAssignDeptId(targetDept.id);
                    setDeptInputMode('ASSIGN_TEACHERS');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Chọn / Gán GV vào tổ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetDept = viewingDeptDetails;
                    setViewingDeptDetails(null);
                    handleStartEditDept(targetDept);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-900 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa thông tin tổ</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingDeptDetails(null)}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XÁC NHẬN XÓA 1 TỔ CHUYÊN MÔN */}
      {/* ========================================================================= */}
      {deptToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Tổ chuyên môn</h3>
                <p className="text-xs text-slate-500">Hành động này sẽ xóa vĩnh viễn tổ khỏi danh mục</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa tổ:{' '}
                <strong className="text-rose-900 font-bold text-sm block mt-0.5">{deptToDelete.name} ({deptToDelete.code})</strong>
              </div>
              {(() => {
                const count = activeTeachers.filter((t) => t.departmentId === deptToDelete.id).length;
                return (
                  <p className="text-[11px] text-rose-800 pt-1 border-t border-rose-200/60">
                    ⚠️ Hiện đang có <strong>{count} giáo viên</strong> thuộc tổ này. Các giáo viên vẫn được giữ nguyên trong danh sách và bạn có thể phân tổ mới cho họ sau.
                  </p>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeptToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleDept}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: XÁC NHẬN XÓA HÀNG LOẠT TỔ CHUYÊN MÔN */}
      {/* ========================================================================= */}
      {isBulkDeleteDeptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa hàng loạt Tổ chuyên môn</h3>
                <p className="text-xs text-slate-500">Đã chọn {selectedDeptIds.length} tổ chuyên môn</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa <strong>{selectedDeptIds.length} tổ chuyên môn</strong> đã chọn?
              </div>
              <ul className="text-[11px] text-rose-800 list-disc list-inside max-h-32 overflow-y-auto space-y-0.5 pt-1">
                {selectedDeptIds.map((id) => {
                  const d = departments.find((item) => item.id === id);
                  return <li key={id}>{d?.name || id} ({d?.code})</li>;
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteDeptModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteDepts}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa {selectedDeptIds.length} tổ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CHỈNH SỬA THÔNG TIN LỚP HỌC */}
      {/* ========================================================================= */}
      {editingClass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chỉnh sửa thông tin Lớp học</h3>
                  <p className="text-xs text-slate-500">Cập nhật tên, khối, buổi học, sĩ số và giáo viên chủ nhiệm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên lớp học <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    placeholder="VD: 6A1, 9A4"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã lớp</label>
                  <input
                    type="text"
                    value={editClassCode}
                    onChange={(e) => setEditClassCode(e.target.value)}
                    placeholder="VD: 6A1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-700 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={editClassGrade}
                    onChange={(e) => setEditClassGrade(parseInt(e.target.value, 10) as 6 | 7 | 8 | 9)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value={6}>Khối 6</option>
                    <option value={7}>Khối 7</option>
                    <option value={8}>Khối 8</option>
                    <option value={9}>Khối 9</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Buổi học (Ca học)</label>
                  <select
                    value={editClassSession}
                    onChange={(e) => setEditClassSession(e.target.value as SchoolSession)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="MORNING">Buổi sáng (B1)</option>
                    <option value="AFTERNOON">Buổi chiều (B2)</option>
                    <option value="FULL_DAY">2 buổi/ngày</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sĩ số học sinh</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={editClassStudentCount}
                    onChange={(e) => setEditClassStudentCount(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vị trí (Điểm trường)</label>
                  <select
                    value={editClassBranchId}
                    onChange={(e) => setEditClassBranchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Giáo viên chủ nhiệm (GVCN)</label>
                <SearchableTeacherSelect
                  teachers={activeTeachers}
                  value={editClassHomeroomTeacherId}
                  onChange={(id) => setEditClassHomeroomTeacherId(id)}
                  placeholder="-- Chọn hoặc tìm kiếm GVCN --"
                  clearLabel="-- Chưa phân công GVCN (Bỏ chọn) --"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editClassActive}
                    onChange={(e) => setEditClassActive(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Lớp đang hoạt động giảng dạy</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditClass}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: XÁC NHẬN XÓA 1 LỚP HỌC */}
      {/* ========================================================================= */}
      {classToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Lớp học</h3>
                <p className="text-xs text-slate-500">Xóa vĩnh viễn lớp học khỏi hệ thống</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa lớp học:{' '}
                <strong className="text-rose-900 font-bold text-sm block mt-0.5">{classToDelete.name} ({classToDelete.code})</strong>
              </div>
              <p className="text-[11px] text-rose-800 pt-1 border-t border-rose-200/60">
                ⚠️ Khối: <strong>{classToDelete.grade}</strong> | Sĩ số: <strong>{classToDelete.studentCount} HS</strong>. Mọi phân công giảng dạy liên quan đến lớp này sẽ được xóa hoặc giải phóng.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleClass}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: XÁC NHẬN XÓA HÀNG LOẠT LỚP HỌC */}
      {/* ========================================================================= */}
      {isBulkDeleteClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa hàng loạt Lớp học</h3>
                <p className="text-xs text-slate-500">Đã chọn {selectedClassIds.length} lớp học</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa <strong>{selectedClassIds.length} lớp học</strong> đã chọn khỏi hệ thống?
              </div>
              <ul className="text-[11px] text-rose-800 list-disc list-inside max-h-32 overflow-y-auto space-y-0.5 pt-1">
                {selectedClassIds.map((id) => {
                  const c = classes.find((item) => item.id === id);
                  return <li key={id}>{c?.name || id} (Khối {c?.grade})</li>;
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteClassModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteClasses}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa {selectedClassIds.length} lớp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: XÁC NHẬN XÓA 1 GIÁO VIÊN */}
      {/* ========================================================================= */}
      {teacherToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Giáo viên</h3>
                <p className="text-xs text-slate-500">Xóa giáo viên khỏi danh mục nhà trường</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa giáo viên:{' '}
                <strong className="text-rose-900 font-bold text-sm block mt-0.5">
                  {teacherToDelete.fullName} ({teacherToDelete.code})
                </strong>
              </div>
              {(() => {
                const dept = departments.find((d) => d.id === teacherToDelete.departmentId);
                const homeroomCls = classes.filter((c) => c.homeroomTeacherId === teacherToDelete.id && !c.isDeleted);
                return (
                  <div className="text-[11px] text-rose-800 pt-1 border-t border-rose-200/60 space-y-1">
                    <p>• Tổ chuyên môn: <strong>{dept?.name || 'Chưa gán'}</strong></p>
                    <p>• Chuyên môn: <strong>{teacherToDelete.major || 'Sư phạm'}</strong> | Định mức: <strong>{teacherToDelete.standardQuota || 19} tiết</strong></p>
                    {homeroomCls.length > 0 && (
                      <p className="text-amber-700 font-semibold">
                        ⚠️ Giáo viên đang chủ nhiệm: {homeroomCls.map((c) => c.name).join(', ')}. Lớp sẽ được bỏ gán GVCN.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTeacherToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleTeacher}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: XÁC NHẬN XÓA HÀNG LOẠT GIÁO VIÊN */}
      {/* ========================================================================= */}
      {isBulkDeleteTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa hàng loạt Giáo viên</h3>
                <p className="text-xs text-slate-500">Đã chọn {selectedTeacherIds.length} giáo viên</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa <strong>{selectedTeacherIds.length} giáo viên</strong> đã chọn khỏi hệ thống?
              </div>
              <ul className="text-[11px] text-rose-800 list-disc list-inside max-h-32 overflow-y-auto space-y-0.5 pt-1">
                {selectedTeacherIds.map((id) => {
                  const t = teachers.find((item) => item.id === id);
                  return <li key={id}>{t?.fullName || id} ({t?.code})</li>;
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteTeacherModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteTeachers}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa {selectedTeacherIds.length} GV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA KIÊM NHIỆM HÀNG LOẠT GIÁO VIÊN ĐÃ CHỌN */}
      {isBulkClearDutiesTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-indigo-700">
              <div className="p-2.5 rounded-2xl bg-indigo-100">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa kiêm nhiệm hàng loạt</h3>
                <p className="text-xs text-slate-500">
                  {selectedTeacherIds.length > 0 ? `Đã chọn ${selectedTeacherIds.length} giáo viên` : `Toàn bộ ${activeTeachers.length} giáo viên trong trường`}
                </p>
              </div>
            </div>
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs space-y-2 text-indigo-950">
              <div>
                Bạn có chắc chắn muốn xóa toàn bộ phân công kiêm nhiệm của{' '}
                <strong>
                  {selectedTeacherIds.length > 0
                    ? `${selectedTeacherIds.length} giáo viên đã chọn`
                    : `tất cả ${activeTeachers.length} giáo viên trong trường`}
                </strong>?
              </div>
              <p className="text-[11px] text-indigo-800">
                Hệ thống sẽ xóa triệt để mọi nhiệm vụ kiêm nhiệm, thu hồi vai trò Tổ trưởng/Tổ phó/Chủ nhiệm, cập nhật hồ sơ và tính lại định mức tiết dạy.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkClearDutiesTeacherModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkClearDutiesForTeachers}
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
      {/* MODAL 8: CHỈNH SỬA THÔNG TIN GIÁO VIÊN */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chỉnh sửa thông tin Giáo viên</h3>
                  <p className="text-xs text-slate-500">Cập nhật hồ sơ, chuyên môn giảng dạy và định mức tiết</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseEditTeacher}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div onChange={() => setIsEditTeacherDirty(true)} className="space-y-3 text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Họ và tên giáo viên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editTeacherFullName}
                    onChange={(e) => {
                      setEditTeacherFullName(e.target.value);
                      if (!editTeacherTimetableName) {
                        const parts = e.target.value.trim().split(/\s+/);
                        if (parts.length > 0) {
                          setEditTeacherTimetableName(parts[parts.length - 1]);
                        }
                      }
                    }}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mã giáo viên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editTeacherCode}
                    onChange={(e) => setEditTeacherCode(e.target.value.toUpperCase())}
                    placeholder="VD: GV01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-700 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {/* Tên dùng trong Thời khóa biểu (Tên TKB) */}
              <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Tên định nghĩa sử dụng trong Thời khóa biểu (Tên TKB)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const parts = editTeacherFullName.trim().split(/\s+/);
                      if (parts.length > 0) {
                        setEditTeacherTimetableName(parts[parts.length - 1]);
                      }
                    }}
                    className="text-[11px] text-indigo-700 hover:underline font-bold cursor-pointer"
                  >
                    Tự động lấy tên
                  </button>
                </div>
                <input
                  type="text"
                  value={editTeacherTimetableName}
                  onChange={(e) => setEditTeacherTimetableName(e.target.value)}
                  placeholder="VD: Toàn, Thành-Toán, HươngT (tên hiển thị gọn gàng trên lưới TKB)"
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={editTeacherGender}
                    onChange={(e) => setEditTeacherGender(e.target.value as 'Nam' | 'Nữ')}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="Nữ">Cô (Nữ)</option>
                    <option value="Nam">Thầy (Nam)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tổ bộ môn</label>
                  <select
                    value={editTeacherDeptId}
                    onChange={(e) => setEditTeacherDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="">-- Chưa vào tổ --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nơi làm việc</label>
                  <select
                    value={editTeacherWorkplaceId}
                    onChange={(e) => setEditTeacherWorkplaceId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-emerald-900 bg-emerald-50/50 focus:bg-white focus:border-emerald-500 transition"
                  >
                    {workplaces
                      .filter((w, idx, arr) => arr.findIndex((x) => x.name.trim().toLowerCase() === w.name.trim().toLowerCase()) === idx)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Vị trí công việc & Kiêm nhiệm */}
              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-700" />
                    <span className="font-bold text-slate-900 text-xs">Vị trí công việc & Kiêm nhiệm</span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-semibold">
                    {editTeacherPositions.length} vị trí đã chọn
                  </span>
                </div>

                {/* Badges đã chọn */}
                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {editTeacherPositions.map((pos) => (
                    <span
                      key={pos}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border shadow-2xs ${getPositionBadgeStyle(
                        pos
                      )}`}
                    >
                      <span>{pos}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditTeacherPositions((prev) =>
                            prev.filter(
                              (p) => normalizePositionName(p).toLowerCase() !== normalizePositionName(pos).toLowerCase()
                            )
                          )
                        }
                        className="hover:opacity-75 cursor-pointer ml-0.5"
                        title="Bỏ vị trí này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {editTeacherPositions.length === 0 && (
                    <span className="text-slate-400 italic text-[11px]">Chưa chọn vị trí kiêm nhiệm (chỉ là GV bộ môn)</span>
                  )}
                </div>

                {/* Nút chọn nhanh các vị trí phổ biến */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Chọn nhanh vị trí / nhiệm vụ:
                  </label>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-xl border border-blue-100">
                    {[
                      'Hiệu trưởng',
                      'Phó hiệu trưởng',
                      'Tổ trưởng chuyên môn',
                      'Tổ phó chuyên môn',
                      'Chủ tịch Công đoàn',
                      'Bí thư Chi đoàn',
                      'Tổng phụ trách Đội',
                      'Trưởng ban TTND',
                      'Thư ký hội đồng',
                      ...duties
                        .map((d) => (d?.name || '').replace(/\s*\([^)]*\)/g, '').trim())
                        .filter(
                          (name, idx, arr) =>
                            name &&
                            arr.indexOf(name) === idx &&
                            !STANDARD_POSITION_PRESETS.some((p) => p.toLowerCase() === name.toLowerCase()) &&
                            normalizePositionName(name) !== 'Tổ trưởng chuyên môn' &&
                            normalizePositionName(name) !== 'Tổ phó chuyên môn'
                        ),
                    ].map((posName) => {
                      const canonicalName = normalizePositionName(posName);
                      const isSelected = editTeacherPositions.some(
                        (p) => normalizePositionName(p).toLowerCase() === canonicalName.toLowerCase()
                      );
                      return (
                        <button
                          key={posName}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setEditTeacherPositions((prev) =>
                                prev.filter(
                                  (p) => normalizePositionName(p).toLowerCase() !== canonicalName.toLowerCase()
                                )
                              );
                            } else {
                              setEditTeacherPositions((prev) => [
                                ...prev.filter(
                                  (p) => normalizePositionName(p).toLowerCase() !== canonicalName.toLowerCase()
                                ),
                                canonicalName,
                              ]);
                              // Auto sync appropriate status if selecting BGH
                              if (canonicalName === 'Hiệu trưởng') {
                                setEditTeacherStatus('PRINCIPAL');
                                setEditTeacherQuota(2);
                              } else if (canonicalName === 'Phó hiệu trưởng') {
                                setEditTeacherStatus('VICE_PRINCIPAL');
                                setEditTeacherQuota(4);
                              }
                            }
                          }}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-900'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {posName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Nhập vị trí tùy chỉnh khác */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newCustomPositionInput}
                    onChange={(e) => setNewCustomPositionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newCustomPositionInput.trim()) {
                          const val = normalizePositionName(newCustomPositionInput.trim());
                          if (!editTeacherPositions.some((p) => normalizePositionName(p).toLowerCase() === val.toLowerCase())) {
                            setEditTeacherPositions((prev) => [...prev, val]);
                          }
                          setNewCustomPositionInput('');
                        }
                      }
                    }}
                    placeholder="Thêm vị trí công việc khác (nhấn Enter hoặc bấm Thêm)..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCustomPositionInput.trim()) {
                        const val = normalizePositionName(newCustomPositionInput.trim());
                        if (!editTeacherPositions.some((p) => normalizePositionName(p).toLowerCase() === val.toLowerCase())) {
                          setEditTeacherPositions((prev) => [...prev, val]);
                        }
                        setNewCustomPositionInput('');
                      }
                    }}
                    className="bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chuyên môn chính (Môn dạy)</label>
                  <input
                    type="text"
                    value={editTeacherMajor}
                    onChange={(e) => setEditTeacherMajor(e.target.value)}
                    placeholder="VD: Toán, Ngữ văn..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-blue-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Định mức chuẩn (tiết/tuần)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={editTeacherQuota}
                    onChange={(e) => setEditTeacherQuota(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Trạng thái công tác</label>
                <select
                  value={editTeacherStatus}
                  onChange={(e) => setEditTeacherStatus(e.target.value as TeacherStatus)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition"
                >
                  <option value="ACTIVE">Đang công tác / Giảng dạy bình thường</option>
                  <option value="MATERNITY">Nghỉ thai sản (Miễn giảng dạy)</option>
                  <option value="SICK_LEAVE">Nghỉ ốm / Điều trị dài ngày</option>
                  <option value="PRINCIPAL">Hiệu trưởng</option>
                  <option value="VICE_PRINCIPAL">Phó hiệu trưởng</option>
                  <option value="SECONDMENT">Biệt phái</option>
                  <option value="UNPAID_LEAVE">Nghỉ không lương</option>
                  <option value="SUSPENDED">Tạm ngưng công tác</option>
                  <option value="TRANSFERRED">Đã chuyển trường</option>
                  <option value="CUSTOM">Khác</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Môn có thể giảng dạy (Chuyên môn / Kiêm nhiệm)</label>
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 max-h-28 overflow-y-auto grid grid-cols-2 gap-1.5">
                  {uniqueSubjects.map((sub) => {
                    const isChecked = editTeacherSubjectsCanTeach.includes(sub.name) || editTeacherSubjectsCanTeach.includes(sub.code);
                    return (
                      <label key={sub.id} className="flex items-center gap-1.5 hover:bg-white p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setEditTeacherSubjectsCanTeach((prev) =>
                              isChecked
                                ? prev.filter((m) => m !== sub.name && m !== sub.code)
                                : [...prev, sub.name]
                            );
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-slate-800 text-[11px] font-medium truncate">{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
                <input
                  type="text"
                  value={editTeacherNotes}
                  onChange={(e) => setEditTeacherNotes(e.target.value)}
                  placeholder="VD: Không xếp dạy tiết 1 thứ 2..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleRequestCloseEditTeacher}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditTeacher}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thông tin giáo viên</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HỎI LƯU THÔNG TIN GIÁO VIÊN KHI SỬA Ở BULK VIEW */}
      {showUnsavedEditTeacherModal && (
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
              Nếu bạn thoát mà không lưu, các thay đổi vừa chỉnh sửa cho giáo viên này sẽ bị hủy bỏ.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedEditTeacherModal(false);
                  handleSaveEditTeacher();
                }}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Lưu thay đổi & Đóng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditTeacherDirty(false);
                  setShowUnsavedEditTeacherModal(false);
                  setEditingTeacher(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Bỏ qua thay đổi & Đóng</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUnsavedEditTeacherModal(false)}
                className="w-full py-2 px-4 text-slate-500 hover:text-slate-800 text-xs font-semibold transition cursor-pointer text-center"
              >
                Ở lại tiếp tục chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 9: CHỈNH SỬA THÔNG TIN MÔN HỌC */}
      {/* ========================================================================= */}
      {editingSubject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chỉnh sửa môn học</h3>
                  <p className="text-xs text-slate-500">Cập nhật mã, tên môn và thiết lập bộ môn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mã môn <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editSubjectCode}
                    onChange={(e) => setEditSubjectCode(e.target.value.toUpperCase())}
                    placeholder="VD: TOAN, VAN"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 uppercase focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên viết tắt</label>
                  <input
                    type="text"
                    value={editSubjectShortName}
                    onChange={(e) => setEditSubjectShortName(e.target.value)}
                    placeholder="VD: Toán"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên đầy đủ môn học <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editSubjectName}
                    onChange={(e) => setEditSubjectName(e.target.value)}
                    placeholder="VD: Toán học, Ngữ văn..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số tiết/tuần <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={editSubjectPeriods || ''}
                      onChange={(e) => setEditSubjectPeriods(Number(e.target.value))}
                      placeholder="VD: 2"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                    />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 font-medium pointer-events-none">tiết</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nhóm môn</label>
                  <select
                    value={editSubjectGroup}
                    onChange={(e) => setEditSubjectGroup(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition"
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
                  <label className="block font-bold text-slate-700 mb-1">Tổ bộ môn phụ trách</label>
                  <select
                    value={editSubjectDeptId}
                    onChange={(e) => setEditSubjectDeptId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition"
                  >
                    <option value="">-- Chưa gán tổ --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <span>Khối lớp áp dụng <span className="text-red-500">*</span>:</span>
                    <span className="text-[10px] text-blue-700 font-bold">({editSubjectGrades.length} khối)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditSubjectGrades([6, 7, 8, 9])}
                      className="text-[10px] text-blue-700 hover:underline font-semibold cursor-pointer"
                    >
                      Cả 4 khối
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setEditSubjectGrades([6, 7])}
                      className="text-[10px] text-emerald-700 hover:underline font-semibold cursor-pointer"
                    >
                      K6,7
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setEditSubjectGrades([8, 9])}
                      className="text-[10px] text-indigo-700 hover:underline font-semibold cursor-pointer"
                    >
                      K8,9
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 7, 8, 9].map((g) => {
                    const isChecked = editSubjectGrades.includes(g);
                    return (
                      <label
                        key={g}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSubjectGrades((prev) => [...prev, g].sort());
                            } else {
                              if (editSubjectGrades.length <= 1) {
                                showToast('Môn học phải áp dụng ít nhất một khối!', 'error');
                                return;
                              }
                              setEditSubjectGrades((prev) => prev.filter((x) => x !== g));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span>Khối {g}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  💡 Gợi ý: Với môn KHTN chung tích chọn Khối 6, 7; các phân môn KHTN Lý, Hóa, Sinh tích chọn Khối 8, 9.
                </p>
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={editSubjectIsIntegrated}
                  onChange={(e) => setEditSubjectIsIntegrated(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-800 text-xs">Môn tích hợp (cho phép nhiều GV cùng dạy)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingSubject(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditSubject}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thông tin môn học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CẤU HÌNH MÔN HỌC BUỔI 2 (GÁN THEO TỪNG KHỐI & ĐỒNG BỘ 2 CHIỀU) */}
      {/* ========================================================================= */}
      {editingSession2Subject && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-900">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Cấu hình Môn dạy Buổi 2</h3>
                  <p className="text-xs text-slate-500">{editingSession2Subject.name} ({editingSession2Subject.code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSession2Subject(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              <label className="flex items-center gap-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={s2FormHasSession2}
                  onChange={(e) => setS2FormHasSession2(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="font-bold text-amber-950 text-xs">Môn có tổ chức dạy Buổi 2 (Tăng cường & Bồi dưỡng)</span>
              </label>

              {s2FormHasSession2 && (
                <div className="space-y-3">
                  {/* CHỌN KHỐI ÁP DỤNG BUỔI 2 */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <span>Gán môn cho Buổi 2 theo từng khối:</span>
                        <span className="text-[10px] text-amber-800 font-extrabold bg-amber-100 px-1.5 py-0.2 rounded-md">
                          {s2FormApplicableGrades.length} khối
                        </span>
                      </label>
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setS2FormApplicableGrades([6, 7, 8, 9])}
                          className="text-blue-700 hover:underline font-bold cursor-pointer"
                        >
                          Cả 4 khối
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setS2FormApplicableGrades([8, 9])}
                          className="text-indigo-700 hover:underline font-bold cursor-pointer"
                        >
                          K8,9
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={() => setS2FormApplicableGrades([9])}
                          className="text-amber-800 hover:underline font-bold cursor-pointer"
                        >
                          Chỉ K9
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[6, 7, 8, 9].map((g) => {
                        const isAssigned = s2FormApplicableGrades.includes(g);
                        return (
                          <label
                            key={g}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                              isAssigned
                                ? 'bg-amber-100/80 border-amber-300 text-amber-950 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setS2FormApplicableGrades((prev) => [...prev, g].sort());
                                  setS2FormActiveGradeTab(g);
                                } else {
                                  if (s2FormApplicableGrades.length <= 1) {
                                    showToast('Vui lòng chọn ít nhất một khối hoặc bỏ chọn "Môn có tổ chức dạy Buổi 2"!', 'error');
                                    return;
                                  }
                                  setS2FormApplicableGrades((prev) => prev.filter((x) => x !== g));
                                  if (s2FormActiveGradeTab === g) {
                                    const rem = s2FormApplicableGrades.filter((x) => x !== g);
                                    if (rem.length > 0) setS2FormActiveGradeTab(rem[0]);
                                  }
                                }
                              }}
                              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                            />
                            <span>Khối {g}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* TABS CHỌN KHỐI ĐỂ NHẬP CHI TIẾT */}
                  {s2FormApplicableGrades.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 text-[11px]">Cấu hình chi tiết theo Khối:</span>
                        {s2FormApplicableGrades.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleCopyCurrentGradeConfigToAll(s2FormActiveGradeTab)}
                            className="text-[10px] text-amber-800 hover:text-amber-950 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 transition cursor-pointer"
                            title="Sao chép các thông số của khối đang chọn cho tất cả các khối được gán Buổi 2"
                          >
                            ⚡ Sao chép Khối {s2FormActiveGradeTab} sang tất cả các khối
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        {s2FormApplicableGrades.map((g) => {
                          const gCfg = s2FormGradeConfigs[g];
                          const totalClassesInG = (gCfg?.bdClasses || 0) + (gCfg?.pdClasses || 0) + (gCfg?.examClasses || 0);
                          const isActive = s2FormActiveGradeTab === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setS2FormActiveGradeTab(g)}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                isActive
                                  ? 'bg-amber-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>Khối {g}</span>
                              {totalClassesInG > 0 && (
                                <span className={`text-[10px] px-1 py-0.2 rounded-md ${
                                  isActive ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-900'
                                }`}>
                                  {totalClassesInG} lớp
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* CHI TIẾT CỦA KHỐI ĐANG CHỌN */}
                      {(() => {
                        const activeG = s2FormActiveGradeTab;
                        const currentCfg = s2FormGradeConfigs[activeG] || {
                          bdClasses: 0,
                          bdPeriods: 0,
                          pdClasses: 0,
                          pdPeriods: 0,
                          examClasses: 0,
                          examPeriods: 0,
                        };

                        const updateCurrentGradeConfig = (patch: Partial<import('../types').GradeSession2Config>) => {
                          setS2FormGradeConfigs((prev) => ({
                            ...prev,
                            [activeG]: {
                              ...prev[activeG],
                              ...patch,
                            },
                          }));
                        };

                        return (
                          <div className="space-y-2.5 bg-amber-50/40 p-3 rounded-2xl border border-amber-200">
                            <div className="flex items-center justify-between text-[11px] pb-1 border-b border-amber-200/60 font-bold text-amber-950">
                              <span>Thông số Buổi 2 — Khối {activeG}:</span>
                              <span>
                                Tổng: {(currentCfg.bdPeriods || 0) + (currentCfg.pdPeriods || 0) + (currentCfg.examPeriods || 0)} tiết/năm
                              </span>
                            </div>

                            {/* BD */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 text-xs block">1. Bồi dưỡng học sinh giỏi (BD)</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Số lớp BD</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={currentCfg.bdClasses || 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      const currentPeriods = currentCfg.bdPeriods || 0;
                                      const newPeriods = (currentPeriods === 0 || currentPeriods === (currentCfg.bdClasses || 0) * 70)
                                        ? val * 70
                                        : currentPeriods;
                                      updateCurrentGradeConfig({ bdClasses: val, bdPeriods: newPeriods });
                                    }}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Tiết BD / Năm (35 tuần)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={currentCfg.bdPeriods || 0}
                                    onChange={(e) => updateCurrentGradeConfig({ bdPeriods: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* PD */}
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-800 text-xs block">2. Phụ đạo học sinh (PĐ)</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Số lớp PĐ</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    value={currentCfg.pdClasses || 0}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      const currentPeriods = currentCfg.pdPeriods || 0;
                                      const newPeriods = (currentPeriods === 0 || currentPeriods === (currentCfg.pdClasses || 0) * 70)
                                        ? val * 70
                                        : currentPeriods;
                                      updateCurrentGradeConfig({ pdClasses: val, pdPeriods: newPeriods });
                                    }}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Tiết PĐ / Năm (35 tuần)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={currentCfg.pdPeriods || 0}
                                    onChange={(e) => updateCurrentGradeConfig({ pdPeriods: Math.max(0, parseInt(e.target.value) || 0) })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* EXAM (Khối 9 hoặc tùy chọn) */}
                            {activeG === 9 && (
                              <div className="bg-white p-2.5 rounded-xl border border-amber-300 space-y-1">
                                <span className="font-bold text-amber-950 text-xs block">3. Ôn thi vào lớp 10 (Khối 9)</span>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Số lớp Ôn thi</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={currentCfg.examClasses || 0}
                                      onChange={(e) => {
                                        const val = Math.max(0, parseInt(e.target.value) || 0);
                                        const currentPeriods = currentCfg.examPeriods || 0;
                                        const newPeriods = (currentPeriods === 0 || currentPeriods === (currentCfg.examClasses || 0) * 70)
                                          ? val * 70
                                          : currentPeriods;
                                        updateCurrentGradeConfig({ examClasses: val, examPeriods: newPeriods });
                                      }}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Tiết Ôn thi / Năm</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={currentCfg.examPeriods || 0}
                                      onChange={(e) => updateCurrentGradeConfig({ examPeriods: Math.max(0, parseInt(e.target.value) || 0) })}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Ghi chú nghiệp vụ Buổi 2</label>
                    <input
                      type="text"
                      placeholder="VD: Dạy 2 buổi/tuần chiều Thứ 3, Thứ 5..."
                      value={s2FormNotes}
                      onChange={(e) => setS2FormNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  dataStore.updateSubject(editingSession2Subject.id, {
                    isSession2: false,
                    session2Config: { hasSession2: false, applicableGrades: [], gradeConfigs: {}, bdClasses: 0, bdPeriods: 0, pdClasses: 0, pdPeriods: 0, examClasses: 0, examPeriods: 0 },
                  });
                  showToast(`Đã hủy thiết lập Buổi 2 cho môn "${editingSession2Subject.name}"!`);
                  setEditingSession2Subject(null);
                }}
                className="text-rose-600 hover:text-rose-800 text-xs font-bold hover:underline cursor-pointer"
              >
                Hủy Buổi 2
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSession2Subject(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveSession2}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu & Đồng bộ sang Khung KHDH</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 10: XÁC NHẬN XÓA 1 MÔN HỌC */}
      {/* ========================================================================= */}
      {subjectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Môn học</h3>
                <p className="text-xs text-slate-500">Xóa vĩnh viễn môn học khỏi hệ thống</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa môn học:{' '}
                <strong className="text-rose-900 font-bold text-sm block mt-0.5">
                  {subjectToDelete.name} ({subjectToDelete.code})
                </strong>
              </div>
              {(() => {
                const dept = departments.find((d) => d.id === subjectToDelete.departmentId);
                const usage = dataStore.getSubjectUsage(subjectToDelete.id);
                return (
                  <div className="text-[11px] text-rose-800 pt-2 border-t border-rose-200/60 space-y-1">
                    <p>• Nhóm: <strong>{subjectToDelete.group}</strong> | Tổ bộ môn: <strong>{dept?.name || 'Chưa gán'}</strong></p>
                    {usage.assignmentCount > 0 || usage.curriculumCount > 0 ? (
                      <p className="text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                        ⚠️ Môn này đang có <strong>{usage.assignmentCount}</strong> phân công và <strong>{usage.curriculumCount}</strong> khung số tiết. Thao tác xóa sẽ tự động giải phóng/dọn dẹp dữ liệu liên quan.
                      </p>
                    ) : (
                      <p className="text-emerald-700">✓ Môn học này chưa có phân công giảng dạy ràng buộc.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingleSubject}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa môn học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 11: XÁC NHẬN XÓA HÀNG LOẠT MÔN HỌC */}
      {/* ========================================================================= */}
      {isBulkDeleteSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa hàng loạt Môn học</h3>
                <p className="text-xs text-slate-500">Đã chọn {selectedSubjectIds.length} môn học</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa <strong>{selectedSubjectIds.length} môn học</strong> đã chọn khỏi hệ thống?
              </div>
              <ul className="text-[11px] text-rose-800 list-disc list-inside max-h-36 overflow-y-auto space-y-0.5 pt-1">
                {selectedSubjectIds.map((id) => {
                  const s = subjects.find((item) => item.id === id);
                  return (
                    <li key={id}>
                      <strong>{s?.name || id}</strong> ({s?.code || ''})
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-rose-700 pt-1 border-t border-rose-200/60">
                ⚠️ Dữ liệu phân phối chương trình và các phân công giảng dạy tương ứng sẽ được dọn dẹp đồng bộ.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteSubjectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteSubjects}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa {selectedSubjectIds.length} môn học</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: THÊM NHIỆM VỤ KIÊM NHIỆM / MIỄN GIẢM */}
      {/* ========================================================================= */}
      {isAddDutyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Thêm nhiệm vụ kiêm nhiệm mới</h3>
                  <p className="text-xs text-slate-500">Tạo danh mục kiêm nhiệm hoặc miễn giảm định mức tiết dạy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDutyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên nhiệm vụ / chức danh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newDutyName}
                    onChange={(e) => setNewDutyName(e.target.value)}
                    placeholder="VD: Chủ tịch Công đoàn, Thư ký..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã nhiệm vụ (Tùy chọn)</label>
                  <input
                    type="text"
                    value={newDutyCode}
                    onChange={(e) => setNewDutyCode(e.target.value.toUpperCase())}
                    placeholder="Tự động nếu để trống"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-700 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại nhiệm vụ</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      newDutyType === 'CONCURRENT'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="addDutyType"
                      checked={newDutyType === 'CONCURRENT'}
                      onChange={() => setNewDutyType('CONCURRENT')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Kiêm nhiệm (Tính số tiết)</span>
                  </label>
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      newDutyType === 'EXEMPTION'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="addDutyType"
                      checked={newDutyType === 'EXEMPTION'}
                      onChange={() => setNewDutyType('EXEMPTION')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Miễn giảm định mức</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiết tính thêm (+tiết/tuần)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={newDutyCalculated}
                    onChange={(e) => setNewDutyCalculated(parseFloat(e.target.value) || 0)}
                    disabled={newDutyType === 'EXEMPTION'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-emerald-800 focus:bg-white focus:border-emerald-500 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiết miễn giảm (-tiết/tuần)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={newDutyExempted}
                    onChange={(e) => setNewDutyExempted(parseFloat(e.target.value) || 0)}
                    disabled={newDutyType === 'CONCURRENT'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-amber-800 focus:bg-white focus:border-amber-500 transition disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả nhiệm vụ / Ghi chú</label>
                <input
                  type="text"
                  value={newDutyNotes}
                  onChange={(e) => setNewDutyNotes(e.target.value)}
                  placeholder="VD: Căn cứ Thông tư 28/2009/TT-BGDĐT..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddDutyModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCreateDuty}
                className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu vào danh mục</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHỈNH SỬA NHIỆM VỤ KIÊM NHIỆM / MIỄN GIẢM */}
      {/* ========================================================================= */}
      {editingDuty && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-900">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Chỉnh sửa nhiệm vụ kiêm nhiệm</h3>
                  <p className="text-xs text-slate-500">Cập nhật định mức tiết tính hoặc miễn giảm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDuty(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tên nhiệm vụ / chức danh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editDutyName}
                    onChange={(e) => setEditDutyName(e.target.value)}
                    placeholder="VD: Chủ tịch Công đoàn..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã nhiệm vụ</label>
                  <input
                    type="text"
                    value={editDutyCode}
                    onChange={(e) => setEditDutyCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-700 focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phân loại nhiệm vụ</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      editDutyType === 'CONCURRENT'
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="editDutyType"
                      checked={editDutyType === 'CONCURRENT'}
                      onChange={() => setEditDutyType('CONCURRENT')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Kiêm nhiệm (Tính số tiết)</span>
                  </label>
                  <label
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      editDutyType === 'EXEMPTION'
                        ? 'border-amber-600 bg-amber-50/70 text-amber-900 font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="editDutyType"
                      checked={editDutyType === 'EXEMPTION'}
                      onChange={() => setEditDutyType('EXEMPTION')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span>Miễn giảm định mức</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiết tính thêm (+tiết/tuần)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={editDutyCalculated}
                    onChange={(e) => setEditDutyCalculated(parseFloat(e.target.value) || 0)}
                    disabled={editDutyType === 'EXEMPTION'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-emerald-800 focus:bg-white focus:border-emerald-500 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Số tiết miễn giảm (-tiết/tuần)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={editDutyExempted}
                    onChange={(e) => setEditDutyExempted(parseFloat(e.target.value) || 0)}
                    disabled={editDutyType === 'CONCURRENT'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-amber-800 focus:bg-white focus:border-amber-500 transition disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mô tả nhiệm vụ / Ghi chú</label>
                <input
                  type="text"
                  value={editDutyNotes}
                  onChange={(e) => setEditDutyNotes(e.target.value)}
                  placeholder="VD: Căn cứ Thông tư 28/2009/TT-BGDĐT..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingDuty(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEditDuty}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Cập nhật nhiệm vụ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN XÓA NHIỆM VỤ KIÊM NHIỆM */}
      {/* ========================================================================= */}
      {dutyToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác nhận xóa Nhiệm vụ</h3>
                <p className="text-xs text-slate-500">Xóa khỏi danh mục nhiệm vụ kiêm nhiệm</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa nhiệm vụ:{' '}
                <strong className="text-rose-900 font-bold text-sm block mt-0.5">
                  {dutyToDelete.name} ({dutyToDelete.code})
                </strong>
              </div>
              {(() => {
                const assignedCount = assignments.filter(
                  (a) => a.dutyId === dutyToDelete.id || a.dutyName?.toLowerCase() === dutyToDelete.name.toLowerCase()
                ).length;
                return assignedCount > 0 ? (
                  <p className="text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                    ⚠️ Nhiệm vụ này đang được gán cho <strong>{assignedCount}</strong> giáo viên. Thao tác xóa sẽ tự động thu hồi phân công kiêm nhiệm này của các giáo viên.
                  </p>
                ) : (
                  <p className="text-emerald-700">✓ Nhiệm vụ này hiện chưa gán cho giáo viên nào.</p>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDutyToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDuty}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XÁC NHẬN HỦY PHÂN CÔNG NHIỆM VỤ KIÊM NHIỆM / MIỄN GIẢM */}
      {/* ========================================================================= */}
      {assignmentToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Hủy phân công nhiệm vụ</h3>
                <p className="text-xs text-slate-500">Kiêm nhiệm & Miễn giảm định mức</p>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn hủy phân công mục:
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-rose-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{assignmentToDelete.dutyName}</div>
                <div className="text-slate-600">
                  Giáo viên: <span className="font-bold text-slate-800">{assignmentToDelete.teacherName}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-800 italic">
                Sau khi hủy, định mức và tiết dạy của giáo viên này sẽ tự động được cập nhật lại theo đúng quy định.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignmentToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  if (assignmentToDelete) {
                    if (assignmentToDelete.teacherId && (assignmentToDelete.dutyId || assignmentToDelete.dutyName)) {
                      dataStore.unassignDutyFromTeacher(
                        assignmentToDelete.dutyId || assignmentToDelete.dutyName,
                        assignmentToDelete.teacherId,
                        versionId
                      );
                    } else {
                      dataStore.deleteAssignment(assignmentToDelete.id, true);
                    }
                    toastService.notifyDutyChange(
                      assignmentToDelete.teacherName,
                      assignmentToDelete.dutyName,
                      'delete'
                    );
                    showToast(`Đã hủy phân công "${assignmentToDelete.dutyName}" cho ${assignmentToDelete.teacherName}!`);
                    setAssignmentToDelete(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Hủy gán</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA KIÊM NHIỆM CHO CÁC GIÁO VIÊN ĐANG CHỌN Ở TAB KIÊM NHIỆM */}
      {isBulkClearDutyTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-100">
                <Briefcase className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xóa kiêm nhiệm giáo viên</h3>
                <p className="text-xs text-slate-500">Đã chọn {assignDutyTeacherIds.length} giáo viên</p>
              </div>
            </div>
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 text-xs space-y-2 text-rose-950">
              <div>
                Bạn có chắc chắn muốn xóa toàn bộ nhiệm vụ kiêm nhiệm của <strong>{assignDutyTeacherIds.length} giáo viên</strong> đang tích chọn?
              </div>
              <p className="text-[11px] text-rose-800">
                Sau khi xóa, các phân công kiêm nhiệm sẽ được gỡ bỏ hoàn toàn, hồ sơ giáo viên và định mức sẽ được tự động tính toán lại.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkClearDutyTeacherModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkClearDutyForAssignedTeachers}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận Xóa kiêm nhiệm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK TEACHER QUOTA MODAL */}
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

      {/* TEACHER MASTER EXCEL IMPORT MODAL */}
      <TeacherExcelImportModal
        isOpen={isTeacherMasterImportModalOpen}
        onClose={() => setIsTeacherMasterImportModalOpen(false)}
        existingTeachers={teachers}
        departments={departments}
        onSuccess={(result) => {
          showToast(
            `Đã đồng bộ thành công ${result.totalProcessed} hồ sơ gốc giáo viên (Thêm mới: ${result.addedCount}, Cập nhật: ${result.updatedCount})`
          );
        }}
      />
    </div>
  );
};
