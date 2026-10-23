import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Briefcase,
  FileSpreadsheet,
  Plus,
  Edit3,
  Check,
  Search,
} from 'lucide-react';
import {
  ALL_GRADE_PLANS,
  GradeSubjectRow,
  GradePlanData,
  ConcurrentDutyRow,
  SchoolTotalSummary,
  recalculateGradePlan,
  recalculateSchoolSummary,
  SUBJECT_BASE_WEEKLY_PERIODS,
} from '../data/teachingPlanFrameworkData';
import { SchoolInfo, Teacher, SchoolClass, Subject, Department, SpecialDuty, TeachingAssignment } from '../types';
import { dataStore } from '../repositories/dataStore';

export interface TeachingPlanFrameworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolInfo?: SchoolInfo;
  teachers?: Teacher[];
  classes?: SchoolClass[];
  subjects?: Subject[];
}

export const TeachingPlanFrameworkModal: React.FC<TeachingPlanFrameworkModalProps> = ({
  isOpen,
  onClose,
  schoolInfo,
  teachers: propTeachers = [],
  classes: propClasses = [],
  subjects: propSubjects = [],
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'GRADES' | 'DUTIES' | 'BALANCE'>('OVERVIEW');
  const [selectedGradeTab, setSelectedGradeTab] = useState<number | 'ALL'>('ALL');
  const [semesterView, setSemesterView] = useState<'FULL' | 'YEAR' | 'HK1' | 'HK2'>('FULL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Store revision ticker to guarantee 100% dynamic two-way sync
  const [storeTick, setStoreTick] = useState<number>(0);
  React.useEffect(() => {
    if (!isOpen) return;
    const unsub = dataStore.subscribe(() => {
      setStoreTick((t) => t + 1);
    });
    return unsub;
  }, [isOpen]);

  // Modal chỉnh sửa nhiệm vụ kiêm nhiệm
  const [editingDuty, setEditingDuty] = useState<ConcurrentDutyRow | null>(null);
  const [isAddingNewDuty, setIsAddingNewDuty] = useState(false);

  // Xem / chỉnh sửa chi tiết môn học & Buổi 2
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<{
    subject: GradeSubjectRow;
    gradeName: string;
    grade?: number;
  } | null>(null);
  const [selectedDutyDetail, setSelectedDutyDetail] = useState<ConcurrentDutyRow | null>(null);

  // States chỉnh sửa Buổi 2 trong modal chi tiết
  const [detailEditBdClasses, setDetailEditBdClasses] = useState<number>(0);
  const [detailEditBdPeriods, setDetailEditBdPeriods] = useState<number>(0);
  const [detailEditPdClasses, setDetailEditPdClasses] = useState<number>(0);
  const [detailEditPdPeriods, setDetailEditPdPeriods] = useState<number>(0);
  const [detailEditExamClasses, setDetailEditExamClasses] = useState<number>(0);
  const [detailEditExamPeriods, setDetailEditExamPeriods] = useState<number>(0);
  const [isEditingDetailSession2, setIsEditingDetailSession2] = useState<boolean>(false);

  // Danh sách nhiệm vụ tùy chỉnh do người dùng thêm/sửa thủ công (nếu có)
  const [customDutyOverrides, setCustomDutyOverrides] = useState<Record<string, Partial<ConcurrentDutyRow>>>({});

  // 1. LẤY DỮ LIỆU ĐỒNG BỘ THỜI GIAN THỰC TỪ HỆ THỐNG
  const activeClasses = useMemo(() => {
    const list = Array.isArray(propClasses) && propClasses.length > 0 ? propClasses : dataStore.getClasses();
    return list.filter((c) => !c.isDeleted);
  }, [propClasses, isOpen, storeTick]);

  const activeSubjects = useMemo(() => {
    const list = Array.isArray(propSubjects) && propSubjects.length > 0 ? propSubjects : dataStore.getSubjects();
    return list.filter((s) => s.active !== false);
  }, [propSubjects, isOpen, storeTick]);

  const activeCurriculums = useMemo(() => {
    return dataStore.getCurriculum();
  }, [isOpen, storeTick]);

  const activeTeachers = useMemo(() => {
    const list = Array.isArray(propTeachers) ? propTeachers : dataStore.getTeachers();
    return list.filter((t) => !t.isDeleted);
  }, [propTeachers, isOpen]);

  const activeDepartments = useMemo(() => {
    return dataStore.getDepartments();
  }, [isOpen]);

  const activeAssignments = useMemo(() => {
    return dataStore.getAssignments();
  }, [isOpen]);

  // Đếm số lớp thực tế cho từng khối 6, 7, 8, 9 từ danh sách lớp của hệ thống
  const classCountByGrade = useMemo(() => {
    const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    activeClasses.forEach((cls) => {
      const g = Number(cls.grade);
      if (g >= 6 && g <= 9) {
        counts[g] = (counts[g] || 0) + 1;
      }
    });

    // Lấy chính xác số lớp thực tế của trường, nếu chưa có lớp nào thì là 0
    return {
      6: counts[6] || 0,
      7: counts[7] || 0,
      8: counts[8] || 0,
      9: counts[9] || 0,
    };
  }, [activeClasses]);

  // Đếm số giáo viên trực tiếp giảng dạy (loại trừ Hiệu trưởng, Phó hiệu trưởng)
  const [manualTeacherCount, setManualTeacherCount] = useState<number | null>(null);

  const teacherCountDirect = useMemo(() => {
    if (manualTeacherCount !== null) return manualTeacherCount;
    const directTchs = activeTeachers.filter(
      (t) => t.status !== 'PRINCIPAL' && t.status !== 'VICE_PRINCIPAL'
    );
    if (directTchs.length > 0) return directTchs.length;
    return activeTeachers.length;
  }, [activeTeachers, manualTeacherCount]);

  // 2. TỰ ĐỘNG ĐỒNG BỘ DANH SÁCH NHIỆM VỤ KIÊM NHIỆM & GIÁO VIÊN ĐẢM NHIỆM TỪ HỆ THỐNG
  const duties: ConcurrentDutyRow[] = useMemo(() => {
    // A. Lấy danh sách GVCN theo từng khối từ danh sách lớp thực tế
    const getHomeroomForGrade = (grade: number): { teachersText: string; count: number } => {
      const gradeClasses = activeClasses.filter((c) => Number(c.grade) === grade);
      const assigned: string[] = [];

      gradeClasses.forEach((cls) => {
        if (cls.homeroomTeacherId) {
          const t = activeTeachers.find((tch) => tch.id === cls.homeroomTeacherId);
          if (t) {
            assigned.push(`${t.fullName || t.name} (${cls.name})`);
          }
        } else {
          // Thử tìm trong teacher.positions xem ai là GVCN lớp này
          const t = activeTeachers.find((tch) => {
            if (!Array.isArray(tch.positions)) return false;
            return tch.positions.some(
              (p) => p.includes(cls.name) || p.toLowerCase().includes(`chủ nhiệm ${cls.name.toLowerCase()}`)
            );
          });
          if (t) {
            assigned.push(`${t.fullName || t.name} (${cls.name})`);
          }
        }
      });

      const uniqueTeachers = Array.from(new Set(assigned));
      const totalClasses = classCountByGrade[grade] ?? gradeClasses.length ?? 0;

      return {
        teachersText:
          totalClasses === 0
            ? 'Chưa có lớp học'
            : uniqueTeachers.length > 0
            ? uniqueTeachers.join(', ')
            : `Chưa phân công (${totalClasses} lớp)`,
        count: uniqueTeachers.length > 0 ? uniqueTeachers.length : totalClasses,
      };
    };

    // B. Lấy danh sách Tổ trưởng chuyên môn
    const getHeadTeachers = (): { teachersText: string; count: number } => {
      const headMap = new Map<string, string>();
      activeDepartments.forEach((dept) => {
        if (dept.headTeacherId) {
          const t = activeTeachers.find((tch) => tch.id === dept.headTeacherId);
          if (t) headMap.set(t.id, t.fullName || t.name);
        }
      });
      activeTeachers.forEach((t) => {
        if (
          Array.isArray(t.positions) &&
          t.positions.some((p) => p.toLowerCase().includes('tổ trưởng'))
        ) {
          headMap.set(t.id, t.fullName || t.name);
        }
      });

      const list = Array.from(headMap.values());
      return {
        teachersText: list.length > 0 ? list.join(', ') : (activeTeachers.length > 0 ? 'Chưa phân công' : 'Chưa có giáo viên'),
        count: list.length,
      };
    };

    // C. Lấy danh sách Tổ phó chuyên môn
    const getDeputyTeachers = (): { teachersText: string; count: number } => {
      const depMap = new Map<string, string>();
      activeDepartments.forEach((dept) => {
        if (dept.deputyTeacherId) {
          const t = activeTeachers.find((tch) => tch.id === dept.deputyTeacherId);
          if (t) depMap.set(t.id, t.fullName || t.name);
        }
        if (Array.isArray(dept.deputyTeacherIds)) {
          dept.deputyTeacherIds.forEach((id) => {
            const t = activeTeachers.find((tch) => tch.id === id);
            if (t) depMap.set(t.id, t.fullName || t.name);
          });
        }
      });
      activeTeachers.forEach((t) => {
        if (
          Array.isArray(t.positions) &&
          t.positions.some((p) => p.toLowerCase().includes('tổ phó'))
        ) {
          depMap.set(t.id, t.fullName || t.name);
        }
      });

      const list = Array.from(depMap.values());
      return {
        teachersText: list.length > 0 ? list.join(', ') : (activeTeachers.length > 0 ? 'Chưa phân công' : 'Chưa có giáo viên'),
        count: list.length,
      };
    };

    // D. Lấy giáo viên đảm nhận vị trí theo từ khóa
    const getTeachersByKeywords = (keywords: string[]): { teachersText: string; count: number } => {
      const matched = new Map<string, string>();
      activeTeachers.forEach((t) => {
        if (Array.isArray(t.positions)) {
          if (
            t.positions.some((p) =>
              keywords.some((kw) => p.toLowerCase().includes(kw.toLowerCase()))
            )
          ) {
            matched.set(t.id, t.fullName || t.name);
          }
        }
      });

      activeAssignments.forEach((asg) => {
        if (asg.teacherId) {
          const dName = asg.dutyName || '';
          if (keywords.some((kw) => dName.toLowerCase().includes(kw.toLowerCase()))) {
            const t = activeTeachers.find((tch) => tch.id === asg.teacherId);
            if (t) matched.set(t.id, t.fullName || t.name);
          }
        }
      });

      const list = Array.from(matched.values());
      return {
        teachersText: list.length > 0 ? list.join(', ') : (activeTeachers.length > 0 ? 'Chưa phân công' : 'Chưa có giáo viên'),
        count: list.length > 0 ? list.length : (activeTeachers.length > 0 ? 1 : 0),
      };
    };

    const ttcm = getHeadTeachers();
    const tpcm = getDeputyTeachers();
    const ttnd = getTeachersByKeywords(['thanh tra', 'ttnd']);
    const tuvan = getTeachersByKeywords(['tư vấn', 'tâm lý']);
    const vuon = getTeachersByKeywords(['vườn trường', 'lao động']);
    const tinhoc = getTeachersByKeywords(['tin học', 'phòng máy', 'thiết bị']);
    const thuky = getTeachersByKeywords(['thư ký']);
    const btdoan = getTeachersByKeywords(['bí thư', 'đoàn']);

    const gvcn9 = getHomeroomForGrade(9);
    const gvcn8 = getHomeroomForGrade(8);
    const gvcn7 = getHomeroomForGrade(7);
    const gvcn6 = getHomeroomForGrade(6);

    const k9Classes = classCountByGrade[9] || 0;
    const k8Classes = classCountByGrade[8] || 0;
    const k7Classes = classCountByGrade[7] || 0;
    const k6Classes = classCountByGrade[6] || 0;

    // Tạo danh sách nhiệm vụ đồng bộ hoàn toàn
    const defaultDuties: ConcurrentDutyRow[] = [
      {
        id: 'duty_ttcm',
        stt: 1,
        dutyName: 'Tổ trưởng chuyên môn',
        periodsPerWeek: ttcm.count * 3,
        inChargeTeachers: ttcm.teachersText,
        teacherCount: ttcm.count,
        periodsPerYear: ttcm.count * 3 * 35,
        periodsHk1: ttcm.count * 3 * 18,
        periodsHk2: ttcm.count * 3 * 17,
        notes: `3 tiết/tuần x ${ttcm.count} tổ trưởng`,
      },
      {
        id: 'duty_tpcm',
        stt: 2,
        dutyName: 'Tổ phó chuyên môn',
        periodsPerWeek: tpcm.count * 1,
        inChargeTeachers: tpcm.teachersText,
        teacherCount: tpcm.count,
        periodsPerYear: tpcm.count * 1 * 35,
        periodsHk1: tpcm.count * 1 * 18,
        periodsHk2: tpcm.count * 1 * 17,
        notes: `1 tiết/tuần x ${tpcm.count} tổ phó`,
      },
      {
        id: 'duty_ttnd',
        stt: 3,
        dutyName: 'Trưởng ban Thanh tra nhân dân',
        periodsPerWeek: activeTeachers.length > 0 ? 2 : 0,
        inChargeTeachers: ttnd.teachersText,
        teacherCount: activeTeachers.length > 0 ? ttnd.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 2 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 2 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 2 : 0) * 17,
        notes: activeTeachers.length > 0 ? '2 tiết/tuần theo quy định' : 'Chưa có GV',
      },
      {
        id: 'duty_tuvan',
        stt: 4,
        dutyName: 'Tư vấn học đường (Tâm lý học sinh)',
        periodsPerWeek: activeTeachers.length > 0 ? 8 : 0,
        inChargeTeachers: tuvan.teachersText,
        teacherCount: activeTeachers.length > 0 ? tuvan.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 8 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 8 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 8 : 0) * 17,
        notes: activeTeachers.length > 0 ? '8 tiết/tuần (Thông tư 31/2017)' : 'Chưa có GV',
      },
      {
        id: 'duty_vuon',
        stt: 5,
        dutyName: 'Phụ trách vườn trường',
        periodsPerWeek: activeTeachers.length > 0 ? 2 : 0,
        inChargeTeachers: vuon.teachersText,
        teacherCount: activeTeachers.length > 0 ? vuon.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 2 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 2 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 2 : 0) * 17,
        notes: activeTeachers.length > 0 ? '2 tiết/tuần' : 'Chưa có GV',
      },
      {
        id: 'duty_tinhoc',
        stt: 6,
        dutyName: 'Phụ trách phòng Tin học & Thiết bị',
        periodsPerWeek: activeTeachers.length > 0 ? 3 : 0,
        inChargeTeachers: tinhoc.teachersText,
        teacherCount: activeTeachers.length > 0 ? tinhoc.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 3 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 3 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 3 : 0) * 17,
        notes: activeTeachers.length > 0 ? '3 tiết/tuần phụ trách phòng máy' : 'Chưa có GV',
      },
      {
        id: 'duty_thuky',
        stt: 7,
        dutyName: 'Thư ký Hội đồng trường',
        periodsPerWeek: activeTeachers.length > 0 ? 2 : 0,
        inChargeTeachers: thuky.teachersText,
        teacherCount: activeTeachers.length > 0 ? thuky.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 2 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 2 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 2 : 0) * 17,
        notes: activeTeachers.length > 0 ? '2 tiết/tuần theo quy định' : 'Chưa có GV',
      },
      {
        id: 'duty_btdoan',
        stt: 8,
        dutyName: 'Bí thư Chi đoàn trường',
        periodsPerWeek: activeTeachers.length > 0 ? 2 : 0,
        inChargeTeachers: btdoan.teachersText,
        teacherCount: activeTeachers.length > 0 ? btdoan.count : 0,
        periodsPerYear: (activeTeachers.length > 0 ? 2 : 0) * 35,
        periodsHk1: (activeTeachers.length > 0 ? 2 : 0) * 18,
        periodsHk2: (activeTeachers.length > 0 ? 2 : 0) * 17,
        notes: activeTeachers.length > 0 ? '2 tiết/tuần' : 'Chưa có GV',
      },
      {
        id: 'duty_cn9',
        stt: 9,
        dutyName: `Chủ nhiệm Khối 9 (${k9Classes} lớp)`,
        periodsPerWeek: k9Classes * 4,
        inChargeTeachers: gvcn9.teachersText,
        teacherCount: k9Classes,
        periodsPerYear: k9Classes * 4 * 35,
        periodsHk1: k9Classes * 4 * 18,
        periodsHk2: k9Classes * 4 * 17,
        notes: `4 tiết/tuần x ${k9Classes} lớp = ${k9Classes * 4}t/tuần`,
        isHomeroom: true,
        grade: 9,
      },
      {
        id: 'duty_cn8',
        stt: 10,
        dutyName: `Chủ nhiệm Khối 8 (${k8Classes} lớp)`,
        periodsPerWeek: k8Classes * 4,
        inChargeTeachers: gvcn8.teachersText,
        teacherCount: k8Classes,
        periodsPerYear: k8Classes * 4 * 35,
        periodsHk1: k8Classes * 4 * 18,
        periodsHk2: k8Classes * 4 * 17,
        notes: `4 tiết/tuần x ${k8Classes} lớp = ${k8Classes * 4}t/tuần`,
        isHomeroom: true,
        grade: 8,
      },
      {
        id: 'duty_cn7',
        stt: 11,
        dutyName: `Chủ nhiệm Khối 7 (${k7Classes} lớp)`,
        periodsPerWeek: k7Classes * 4,
        inChargeTeachers: gvcn7.teachersText,
        teacherCount: k7Classes,
        periodsPerYear: k7Classes * 4 * 35,
        periodsHk1: k7Classes * 4 * 18,
        periodsHk2: k7Classes * 4 * 17,
        notes: `4 tiết/tuần x ${k7Classes} lớp = ${k7Classes * 4}t/tuần`,
        isHomeroom: true,
        grade: 7,
      },
      {
        id: 'duty_cn6',
        stt: 12,
        dutyName: `Chủ nhiệm Khối 6 (${k6Classes} lớp)`,
        periodsPerWeek: k6Classes * 4,
        inChargeTeachers: gvcn6.teachersText,
        teacherCount: k6Classes,
        periodsPerYear: k6Classes * 4 * 35,
        periodsHk1: k6Classes * 4 * 18,
        periodsHk2: k6Classes * 4 * 17,
        notes: `4 tiết/tuần x ${k6Classes} lớp = ${k6Classes * 4}t/tuần`,
        isHomeroom: true,
        grade: 6,
      },
    ];

    // Áp dụng các chỉnh sửa cá nhân (nếu có)
    return defaultDuties.map((d) => {
      const overrideKey = d.id || `duty_${d.stt}`;
      if (customDutyOverrides[overrideKey]) {
        return { ...d, ...customDutyOverrides[overrideKey] };
      }
      return d;
    });
  }, [
    activeClasses,
    activeTeachers,
    activeDepartments,
    activeAssignments,
    classCountByGrade,
    customDutyOverrides,
  ]);

  // 3. TỰ ĐỘNG TÁI TÍNH TOÁN KẾ HOẠCH DẠY HỌC 4 KHỐI THEO SỐ LỚP THỰC TẾ & MA TRẬN TIẾT
  const gradePlans: GradePlanData[] = useMemo(() => {
    const grades = [6, 7, 8, 9];
    return grades.map((g) => {
      const classCount = classCountByGrade[g] ?? 0;
      const basePlan = ALL_GRADE_PLANS.find((p) => p.grade === g) || ALL_GRADE_PLANS[0];

      // Lấy danh sách môn học áp dụng cho khối g từ dataStore
      const applicableSubjects = activeSubjects.filter(
        (s) => !s.applicableGrades || s.applicableGrades.length === 0 || s.applicableGrades.includes(g)
      );

      // Nếu có danh mục môn học trong hệ thống, sử dụng danh mục môn thực tế và số tiết từ ma trận tiết
      const subjectRows: GradeSubjectRow[] = applicableSubjects.length > 0
        ? applicableSubjects.map((s, idx) => {
            // Lấy số tiết/tuần từ khung phân phối tiết (ma trận tiết) của hệ thống
            const curr = activeCurriculums.find(
              (c) => c.grade === g && c.subjectId === s.id && (c.semesterId === 'HK1' || !c.semesterId)
            );
            const ppw = curr?.periodsPerWeek ?? (SUBJECT_BASE_WEEKLY_PERIODS[g]?.[s.name] ?? s.periodsPerWeek ?? 1);

            // Buổi 1 (Chính khóa)
            const s1Classes = classCount;
            const s1Periods = classCount > 0 ? Math.round(s1Classes * ppw * 35) : 0;
            const s1Hk1 = classCount > 0 ? Math.round(s1Classes * ppw * 18) : 0;
            const s1Hk2 = s1Periods - s1Hk1;

            // Buổi 2 (Tăng cường & Bồi dưỡng) - Lấy từ session2Config của môn học theo từng khối
            const s2Config = s.session2Config;
            const gConfig = s2Config?.gradeConfigs?.[g];
            const isGradeConfigured = Boolean(s2Config?.gradeConfigs && s2Config.gradeConfigs[g]);

            // Khối này có được gán Buổi 2 hay không
            const isGradeAssignedS2 = isGradeConfigured
              ? (gConfig?.hasSession2 !== false && ((gConfig?.bdClasses || 0) + (gConfig?.pdClasses || 0) + (gConfig?.examClasses || 0) > 0 || Boolean(gConfig?.hasSession2)))
              : (s2Config?.applicableGrades && s2Config.applicableGrades.length > 0)
                ? s2Config.applicableGrades.includes(g)
                : Boolean(s.isSession2 || s2Config?.hasSession2);

            const s2BdClasses = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.bdClasses ?? s2Config?.bdClasses ?? 0)
              : 0;
            const s2BdPeriods = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.bdPeriods ?? (s2Config?.bdPeriods ? (isGradeConfigured ? s2BdClasses * 70 : s2Config.bdPeriods) : s2BdClasses * 70))
              : 0;

            const s2PdClasses = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.pdClasses ?? s2Config?.pdClasses ?? 0)
              : 0;
            const s2PdPeriods = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.pdPeriods ?? (s2Config?.pdPeriods ? (isGradeConfigured ? s2PdClasses * 70 : s2Config.pdPeriods) : s2PdClasses * 70))
              : 0;

            const s2ExamClasses = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.examClasses ?? (g === 9 ? s2Config?.examClasses ?? 0 : 0))
              : 0;
            const s2ExamPeriods = (classCount > 0 && isGradeAssignedS2)
              ? (gConfig?.examPeriods ?? (g === 9 ? s2Config?.examPeriods ?? s2ExamClasses * 70 : s2ExamClasses * 70))
              : 0;

            const totalS2 = s2BdPeriods + s2PdPeriods + s2ExamPeriods;
            const totalYear = s1Periods + totalS2;
            const totalHk1 = s1Hk1 + (classCount > 0 ? Math.round(totalS2 * (18 / 35)) : 0);
            const totalHk2 = totalYear - totalHk1;

            return {
              stt: idx + 1,
              subjectName: s.name,
              shortName: s.shortName || s.name,
              periodsPerWeek: ppw,
              session1Classes: s1Classes,
              session1Periods: s1Periods,
              session1Hk1Periods: s1Hk1,
              session1Hk2Periods: s1Hk2,
              session2BdClasses: s2BdClasses,
              session2BdPeriods: s2BdPeriods,
              session2PdClasses: s2PdClasses,
              session2PdPeriods: s2PdPeriods,
              session2ExamClasses: s2ExamClasses,
              session2ExamPeriods: s2ExamPeriods,
              totalPeriods: totalYear,
              totalHk1Periods: totalHk1,
              totalHk2Periods: totalHk2,
            };
          })
        : basePlan.subjects.map((s) => ({
            ...s,
            session1Classes: classCount,
            session1Periods: classCount > 0 ? Math.round(classCount * s.periodsPerWeek * 35) : 0,
            session1Hk1Periods: classCount > 0 ? Math.round(classCount * s.periodsPerWeek * 18) : 0,
            session1Hk2Periods: classCount > 0 ? Math.round(classCount * s.periodsPerWeek * 17) : 0,
            session2BdPeriods: classCount > 0 ? s.session2BdPeriods : 0,
            session2PdPeriods: classCount > 0 ? s.session2PdPeriods : 0,
            session2ExamPeriods: classCount > 0 ? (s.session2ExamPeriods || 0) : 0,
            totalPeriods: classCount > 0 ? s.totalPeriods : 0,
          }));

      const totalSession1Classes = subjectRows.reduce((sum, s) => sum + s.session1Classes, 0);
      const totalSession1Periods = subjectRows.reduce((sum, s) => sum + s.session1Periods, 0);
      const totalSession1Hk1Periods = subjectRows.reduce((sum, s) => sum + (s.session1Hk1Periods || 0), 0);
      const totalSession1Hk2Periods = subjectRows.reduce((sum, s) => sum + (s.session1Hk2Periods || 0), 0);
      const totalSession2BdClasses = subjectRows.reduce((sum, s) => sum + s.session2BdClasses, 0);
      const totalSession2BdPeriods = subjectRows.reduce((sum, s) => sum + s.session2BdPeriods, 0);
      const totalSession2PdClasses = subjectRows.reduce((sum, s) => sum + s.session2PdClasses, 0);
      const totalSession2PdPeriods = subjectRows.reduce((sum, s) => sum + s.session2PdPeriods, 0);
      const totalSession2ExamClasses = subjectRows.reduce((sum, s) => sum + (s.session2ExamClasses || 0), 0);
      const totalSession2ExamPeriods = subjectRows.reduce((sum, s) => sum + (s.session2ExamPeriods || 0), 0);
      const totalSession2Periods = totalSession2BdPeriods + totalSession2PdPeriods + totalSession2ExamPeriods;
      const grandTotalPeriods = totalSession1Periods + totalSession2Periods;
      const grandTotalHk1Periods = totalSession1Hk1Periods + Math.round(totalSession2Periods * (18 / 35));
      const grandTotalHk2Periods = grandTotalPeriods - grandTotalHk1Periods;

      return {
        grade: g,
        gradeName: `Khối ${g}`,
        totalClasses: classCount,
        subjects: subjectRows,
        totalSession1Classes,
        totalSession1Periods,
        totalSession1Hk1Periods,
        totalSession1Hk2Periods,
        totalSession2BdClasses,
        totalSession2BdPeriods,
        totalSession2PdClasses,
        totalSession2PdPeriods,
        totalSession2ExamClasses,
        totalSession2ExamPeriods,
        totalSession2Periods,
        grandTotalPeriods,
        grandTotalHk1Periods,
        grandTotalHk2Periods,
      };
    });
  }, [classCountByGrade, activeSubjects, activeCurriculums]);

  // 4. TÍNH TOÁN BẢNG TỔNG HỢP TOÀN TRƯỜNG ĐỘNG
  const schoolSummary: SchoolTotalSummary = useMemo(() => {
    return recalculateSchoolSummary(gradePlans, duties, teacherCountDirect, 35, 18, 17);
  }, [gradePlans, duties, teacherCountDirect]);

  const schoolName = schoolInfo?.schoolName || 'TRƯỜNG THCS QUỲ HỢP';
  const schoolYear = schoolInfo?.schoolYear || '2026-2027';

  // Format số
  const fmt = (num: number) => Math.round(num).toLocaleString('vi-VN');

  // Hiển thị toast thông báo
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // In báo cáo
  const handlePrint = () => {
    window.print();
  };

  // Xuất file CSV
  const handleExportCSV = () => {
    let csv = '\uFEFF';
    csv += `${schoolName.toUpperCase()} - NĂM HỌC ${schoolYear}\n`;
    csv += `KHUNG KẾ HOẠCH DẠY HỌC & TỔNG HỢP SỐ TIẾT TOÀN TRƯỜNG\n\n`;

    // 1. TỔNG HỢP TOÀN TRƯỜNG
    csv += `BẢNG TỔNG HỢP TIẾT THỰC DẠY, ĐỊNH MỨC VÀ TIẾT VƯỢT GIỜ\n`;
    csv += `Thực dạy Buổi 1,Thực dạy Buổi 2,Kiêm nhiệm,Tổng thực dạy (1),Tổng định mức (2),Vượt giờ (1)-(2),Ghi chú\n`;
    csv += `${schoolSummary.session1Periods},${schoolSummary.session2Periods},${schoolSummary.concurrentPeriods},${schoolSummary.totalAssignedPeriods},${schoolSummary.standardQuotaPeriods},${schoolSummary.overtimePeriods},35 tuần/năm học\n\n`;

    // 2. CHI TIẾT CÁC KHỐI
    csv += `KẾ HOẠCH DẠY HỌC THEO KHỐI LỚP\n`;
    gradePlans.forEach((gp) => {
      csv += `\n${gp.gradeName.toUpperCase()} (${gp.totalClasses} LỚP)\n`;
      csv += `STT,Môn học/HĐGD,Tiết/tuần,Số lớp B1,Tiết HK1,Tiết HK2,Cả năm B1,Lớp BD,Tiết BD,Lớp PĐ,Tiết PĐ,Tổng tiết\n`;
      gp.subjects.forEach((s) => {
        csv += `${s.stt},"${s.subjectName}",${s.periodsPerWeek},${s.session1Classes},${s.session1Hk1Periods || ''},${s.session1Hk2Periods || ''},${s.session1Periods},${s.session2BdClasses || ''},${s.session2BdPeriods || ''},${s.session2PdClasses || ''},${s.session2PdPeriods || ''},${s.totalPeriods}\n`;
      });
      csv += `,,Tổng cộng,${gp.totalSession1Classes},${gp.totalSession1Hk1Periods},${gp.totalSession1Hk2Periods},${gp.totalSession1Periods},${gp.totalSession2BdClasses},${gp.totalSession2BdPeriods},${gp.totalSession2PdClasses},${gp.totalSession2PdPeriods},${gp.grandTotalPeriods}\n`;
    });

    // 3. KIÊM NHIỆM
    csv += `\nTỔNG HỢP SỐ TIẾT KIÊM NHIỆM TOÀN TRƯỜNG\n`;
    csv += `STT,Tên nhiệm vụ kiêm nhiệm,Tiết/tuần,Tiết HK1,Tiết HK2,Cả năm,Người kiêm nhiệm,Ghi chú\n`;
    duties.forEach((d) => {
      csv += `${d.stt},"${d.dutyName}",${d.periodsPerWeek},${d.periodsHk1 || d.periodsPerWeek * 18},${d.periodsHk2 || d.periodsPerWeek * 17},${d.periodsPerYear},"${d.inChargeTeachers}","${d.notes || ''}"\n`;
    });
    csv += `,,${duties.reduce((s, d) => s + d.periodsPerWeek, 0)},${schoolSummary.concurrentHk1Periods},${schoolSummary.concurrentHk2Periods},${schoolSummary.concurrentPeriods},,TỔNG CỘNG KIÊM NHIỆM\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Khung_Ke_Hoach_Day_Hoc_${schoolYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đã xuất file báo cáo CSV thành công!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-2 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white w-full max-w-7xl h-[94vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:h-auto">
        {/* ========================================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white px-5 py-3.5 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-blue-950 flex items-center justify-center font-black shadow-md flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white tracking-wide uppercase">
                  KHUNG KẾ HOẠCH DẠY HỌC & TỔNG HỢP SỐ TIẾT TOÀN TRƯỜNG
                </span>
                <span className="bg-amber-400 text-blue-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  CT GDPT 2018
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đồng bộ tự động
                </span>
              </div>
              <div className="text-xs text-blue-200/90 flex items-center gap-3 mt-0.5">
                <span>{schoolName}</span>
                <span>•</span>
                <span>Năm học: {schoolYear}</span>
                <span>•</span>
                <span>
                  Quy mô: {schoolSummary.totalClasses} lớp{schoolSummary.totalClasses === 0 ? ' (Chưa có lớp - Vào mục Nhập dữ liệu để tạo lớp)' : ''}
                </span>
                <span>•</span>
                <span>Định mức: {teacherCountDirect} GV giảng dạy</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
              title="Xuất bảng số liệu ra file Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất Excel / CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
              title="In báo cáo khung kế hoạch dạy học"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">In báo cáo</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-white transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAV TABS & CONTROLS */}
        {/* ========================================================================= */}
        <div className="bg-slate-100/95 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'OVERVIEW'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Tổng hợp toàn trường</span>
            </button>
            <button
              onClick={() => setActiveTab('GRADES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'GRADES'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Chi tiết các khối lớp</span>
            </button>
            <button
              onClick={() => setActiveTab('DUTIES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'DUTIES'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>
                Tổng hợp tiết kiêm nhiệm ({duties.reduce((s, d) => s + d.periodsPerWeek, 0)}t/tuần)
              </span>
            </button>
            <button
              onClick={() => setActiveTab('BALANCE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'BALANCE'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Cân đối định mức & Vượt giờ</span>
            </button>
          </div>

          {/* CHỌN HỌC KỲ (SEMESTER VIEW TOGGLE) */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Cột hiển thị:</span>
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 shadow-2xs">
              <button
                onClick={() => setSemesterView('FULL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  semesterView === 'FULL'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Hiển thị đồng thời HK I (18t), HK II (17t) và Cả năm (35t)"
              >
                Đầy đủ (HK1 + HK2 + Cả năm)
              </button>
              <button
                onClick={() => setSemesterView('YEAR')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  semesterView === 'YEAR'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả năm (35t)
              </button>
              <button
                onClick={() => setSemesterView('HK1')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  semesterView === 'HK1'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HK I (18t)
              </button>
              <button
                onClick={() => setSemesterView('HK2')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  semesterView === 'HK2'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                HK II (17t)
              </button>
            </div>
          </div>
        </div>

        {/* TOAST MESSAGE */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between border-b border-emerald-700 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="p-0.5 hover:bg-emerald-700 rounded-sm">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN BODY SCROLLABLE CONTENT */}
        {/* ========================================================================= */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* ======================================================================= */}
          {/* TAB 1: OVERVIEW & KPI CARDS (TỔNG HỢP TOÀN TRƯỜNG) */}
          {/* ======================================================================= */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* Top Summary Banner */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 border border-blue-800 shadow-md">
                <div className="flex items-center justify-between gap-3 mb-4 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      TỔNG HỢP SỐ TIẾT TOÀN TRƯỜNG & CÂN ĐỐI ĐỊNH MỨC (35 TUẦN)
                    </h3>
                    <p className="text-[11px] text-blue-200/80 mt-0.5">
                      Tự động tính từ số lớp ({schoolSummary.totalClasses} lớp), khung tiết theo CT GDPT 2018, kiêm nhiệm và định mức {teacherCountDirect} GV giảng dạy.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] bg-white/10 px-3 py-1 rounded-full border border-white/20 font-bold text-white">
                      HK I: 18 tuần • HK II: 17 tuần
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                  {/* Card 1: Buổi 1 */}
                  <div
                    onClick={() => setActiveTab('GRADES')}
                    className="bg-white/10 hover:bg-white/15 p-3 rounded-xl border border-white/15 transition cursor-pointer group"
                  >
                    <div className="text-[10.5px] text-blue-200 font-bold uppercase tracking-wider">Tiết Buổi 1</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1 group-hover:text-amber-300 transition-colors">
                      {fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.session1Hk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.session1Hk2Periods
                          : schoolSummary.session1Periods
                      )}
                    </div>
                    <div className="text-[10px] text-blue-200/70 mt-1 flex items-center justify-between">
                      <span>Chính khóa (4 khối)</span>
                      <span className="font-bold text-white">
                        {((schoolSummary.session1Periods / (schoolSummary.totalAssignedPeriods || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Buổi 2 */}
                  <div
                    onClick={() => setActiveTab('GRADES')}
                    className="bg-white/10 hover:bg-white/15 p-3 rounded-xl border border-white/15 transition cursor-pointer group"
                  >
                    <div className="text-[10.5px] text-amber-200 font-bold uppercase tracking-wider">Tiết Buổi 2</div>
                    <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                      {fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.session2Hk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.session2Hk2Periods
                          : schoolSummary.session2Periods
                      )}
                    </div>
                    <div className="text-[10px] text-amber-200/70 mt-1 flex items-center justify-between">
                      <span>BD, PĐ, Ôn thi</span>
                      <span className="font-bold text-white">
                        {((schoolSummary.session2Periods / (schoolSummary.totalAssignedPeriods || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Kiêm nhiệm */}
                  <div
                    onClick={() => setActiveTab('DUTIES')}
                    className="bg-white/10 hover:bg-white/15 p-3 rounded-xl border border-white/15 transition cursor-pointer group"
                  >
                    <div className="text-[10.5px] text-purple-200 font-bold uppercase tracking-wider">Kiêm nhiệm</div>
                    <div className="text-xl sm:text-2xl font-black text-purple-200 mt-1">
                      {fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.concurrentHk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.concurrentHk2Periods
                          : schoolSummary.concurrentPeriods
                      )}
                    </div>
                    <div className="text-[10px] text-purple-200/70 mt-1 flex items-center justify-between">
                      <span>{duties.reduce((s, d) => s + d.periodsPerWeek, 0)}t/w x 35w</span>
                      <span className="font-bold text-white">
                        {((schoolSummary.concurrentPeriods / (schoolSummary.totalAssignedPeriods || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Tổng thực dạy & kiêm nhiệm (1) */}
                  <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-400/40">
                    <div className="text-[10.5px] text-emerald-300 font-bold uppercase tracking-wider">Tổng thực dạy & kiêm nhiệm</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                      {fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.totalAssignedHk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.totalAssignedHk2Periods
                          : schoolSummary.totalAssignedPeriods
                      )}
                    </div>
                    <div className="text-[10px] text-emerald-200/70 mt-1">
                      B1 + B2 + Kiêm nhiệm
                    </div>
                  </div>

                  {/* Card 5: Tổng định mức trường (2) */}
                  <div
                    onClick={() => setActiveTab('BALANCE')}
                    className="bg-white/10 hover:bg-white/15 p-3 rounded-xl border border-white/15 transition cursor-pointer group"
                  >
                    <div className="text-[10.5px] text-slate-300 font-bold uppercase tracking-wider">Tổng định mức trường</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                      {fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.standardQuotaHk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.standardQuotaHk2Periods
                          : schoolSummary.standardQuotaPeriods
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300/80 mt-1">
                      {teacherCountDirect} GV + BGH + TPTĐ
                    </div>
                  </div>

                  {/* Card 6: Vượt giờ (Thiết kế thanh lịch, không bôi đỏ) */}
                  <div
                    onClick={() => setActiveTab('BALANCE')}
                    className="bg-indigo-500/25 hover:bg-indigo-500/35 p-3 rounded-xl border border-indigo-400/50 transition cursor-pointer"
                  >
                    <div className="text-[10.5px] text-indigo-200 font-bold uppercase tracking-wider">Tổng tiết vượt giờ</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                      +{fmt(
                        semesterView === 'HK1'
                          ? schoolSummary.overtimeHk1Periods
                          : semesterView === 'HK2'
                          ? schoolSummary.overtimeHk2Periods
                          : schoolSummary.overtimePeriods
                      )}
                    </div>
                    <div className="text-[10px] text-indigo-200/80 mt-1 font-semibold">
                      Thực dạy - Định mức
                    </div>
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-blue-200">
                    <span>
                      Phân bổ cơ cấu số tiết toàn trường ({fmt(schoolSummary.totalAssignedPeriods)} tiết = 100%)
                    </span>
                    <span className="font-semibold text-white">35 Tuần / Năm học</span>
                  </div>
                  <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden flex shadow-inner">
                    <div
                      className="bg-blue-400 h-full transition-all"
                      style={{
                        width: `${(schoolSummary.session1Periods / (schoolSummary.totalAssignedPeriods || 1)) * 100}%`,
                      }}
                      title={`Buổi 1: ${fmt(schoolSummary.session1Periods)} tiết`}
                    />
                    <div
                      className="bg-amber-400 h-full transition-all"
                      style={{
                        width: `${(schoolSummary.session2Periods / (schoolSummary.totalAssignedPeriods || 1)) * 100}%`,
                      }}
                      title={`Buổi 2: ${fmt(schoolSummary.session2Periods)} tiết`}
                    />
                    <div
                      className="bg-purple-400 h-full transition-all"
                      style={{
                        width: `${(schoolSummary.concurrentPeriods / (schoolSummary.totalAssignedPeriods || 1)) * 100}%`,
                      }}
                      title={`Kiêm nhiệm: ${fmt(schoolSummary.concurrentPeriods)} tiết`}
                    />
                  </div>
                </div>
              </div>

              {/* BẢNG TỔNG HỢP TOÀN TRƯỜNG CHUẨN CỦA BỘ VÀ SỞ GD&ĐT */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                    BẢNG TỔNG HỢP TIẾT THỰC DẠY, ĐỊNH MỨC VÀ TIẾT VƯỢT GIỜ
                  </h4>
                  <div className="text-slate-500 text-xs">
                    Căn cứ tính toán: 35 tuần/năm học ({schoolSummary.weeksHk1} tuần HK I + {schoolSummary.weeksHk2} tuần HK II)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                        <th colSpan={4} className="py-2.5 px-3 text-center border-r border-slate-300 bg-blue-50/70 text-blue-900">
                          Tiết thực dạy và kiêm nhiệm
                        </th>
                        <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-slate-300 bg-emerald-50/70 text-emerald-950 font-black">
                          Tổng tiết định mức
                        </th>
                        <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-slate-300 bg-slate-100 text-slate-900 font-black">
                          Tổng số tiết dạy vượt giờ
                        </th>
                        <th rowSpan={2} className="py-2.5 px-4 text-center bg-slate-50 text-slate-700">
                          Ghi chú & Căn cứ pháp lý
                        </th>
                      </tr>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[11px]">
                        <th className="py-2 px-3 text-right border-r border-slate-200">Buổi 1</th>
                        <th className="py-2 px-3 text-right border-r border-slate-200">Buổi 2</th>
                        <th className="py-2 px-3 text-right border-r border-slate-200">Kiêm nhiệm</th>
                        <th className="py-2 px-3 text-right border-r border-slate-300 bg-blue-100/50 font-black text-blue-950">
                          Tổng
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* DÒNG CẢ NĂM */}
                      <tr className="hover:bg-blue-50/40 transition font-bold bg-white">
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-blue-900 font-black">
                          {fmt(schoolSummary.session1Periods)}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-amber-800 font-black">
                          {fmt(schoolSummary.session2Periods)}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-purple-900 font-black">
                          {fmt(schoolSummary.concurrentPeriods)}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-300 bg-blue-50 text-blue-950 font-black text-sm">
                          {fmt(schoolSummary.totalAssignedPeriods)}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black text-sm">
                          {fmt(schoolSummary.standardQuotaPeriods)}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-300 bg-slate-50 text-slate-900 font-black text-sm">
                          +{fmt(schoolSummary.overtimePeriods)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] leading-relaxed">
                          <strong>CẢ NĂM (35 tuần):</strong> Số tiết định mức là số tiết dạy trong 35 tuần của{' '}
                          {teacherCountDirect} GV trực tiếp giảng dạy ({teacherCountDirect} x 19t x 35w = {fmt(teacherCountDirect * 19 * 35)}t),
                          HT ({schoolSummary.principalPeriods}t), 2 PHT ({schoolSummary.vicePrincipalPeriods}t), TPT Đội ({schoolSummary.teamLeaderPeriods}t).
                        </td>
                      </tr>

                      {/* DÒNG HỌC KỲ I */}
                      <tr className="hover:bg-slate-50 transition text-slate-700">
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-blue-800">
                          {fmt(schoolSummary.session1Hk1Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-amber-700">
                          {fmt(schoolSummary.session2Hk1Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-purple-800">
                          {fmt(schoolSummary.concurrentHk1Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-blue-50/60 font-bold text-blue-900">
                          {fmt(schoolSummary.totalAssignedHk1Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-emerald-50/60 font-bold text-emerald-900">
                          {fmt(schoolSummary.standardQuotaHk1Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-slate-50 font-bold text-slate-900">
                          +{fmt(schoolSummary.overtimeHk1Periods)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          <strong>HỌC KỲ I (18 tuần):</strong> Định mức {teacherCountDirect} GV = {fmt(teacherCountDirect * 19 * 18)}t; HT = 36t; 2 PHT = 144t; TPTĐ = 36t.
                        </td>
                      </tr>

                      {/* DÒNG HỌC KỲ II */}
                      <tr className="hover:bg-slate-50 transition text-slate-700">
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-blue-800">
                          {fmt(schoolSummary.session1Hk2Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-amber-700">
                          {fmt(schoolSummary.session2Hk2Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-semibold text-purple-800">
                          {fmt(schoolSummary.concurrentHk2Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-blue-50/60 font-bold text-blue-900">
                          {fmt(schoolSummary.totalAssignedHk2Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-emerald-50/60 font-bold text-emerald-900">
                          {fmt(schoolSummary.standardQuotaHk2Periods)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-300 bg-slate-50 font-bold text-slate-900">
                          +{fmt(schoolSummary.overtimeHk2Periods)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          <strong>HỌC KỲ II (17 tuần):</strong> Định mức {teacherCountDirect} GV = {fmt(teacherCountDirect * 19 * 17)}t; HT = 34t; 2 PHT = 136t; TPTĐ = 34t.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CARD CÁC KHỐI LỚP (GỌN GÀNG, TỰ ĐỘNG ĐỒNG BỘ TỪ DANH SÁCH LỚP) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {gradePlans.map((gp) => (
                  <div
                    key={gp.grade}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-blue-400 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">{gp.gradeName}</span>
                        <div className="flex items-center gap-1 bg-blue-50 text-blue-900 px-2.5 py-0.5 rounded-lg border border-blue-200 font-bold text-xs">
                          <span>{gp.totalClasses} lớp học</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5 text-slate-600 text-[11px]">
                        <div className="flex justify-between">
                          <span>Số môn học / HĐGD:</span>
                          <span className="font-bold text-slate-900">{gp.subjects.length} môn</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiết Buổi 1 (Chính khóa):</span>
                          <span className="font-bold text-blue-900">{fmt(gp.totalSession1Periods)} tiết</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tiết Buổi 2 (BD + PĐ + Ôn):</span>
                          <span className="font-bold text-amber-700">{fmt(gp.totalSession2Periods)} tiết</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-slate-900">
                          <span>Tổng tiết cả năm:</span>
                          <span className="text-blue-950 font-black text-xs">{fmt(gp.grandTotalPeriods)} tiết</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedGradeTab(gp.grade);
                        setActiveTab('GRADES');
                      }}
                      className="mt-4 w-full py-1.5 bg-slate-100 hover:bg-blue-50 text-blue-900 hover:text-blue-950 font-bold rounded-xl transition text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Xem bảng chi tiết {gp.subjects.length} môn</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: CHI TIẾT CÁC KHỐI LỚP (KHỐI 6, 7, 8, 9) */}
          {/* ======================================================================= */}
          {activeTab === 'GRADES' && (
            <div className="space-y-4">
              {/* GRADE SUB-TABS */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Chọn khối xem:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedGradeTab('ALL')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                        selectedGradeTab === 'ALL'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      Tất cả các khối
                    </button>
                    {gradePlans.map((gp) => (
                      <button
                        key={gp.grade}
                        onClick={() => setSelectedGradeTab(gp.grade)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          selectedGradeTab === gp.grade
                            ? 'bg-blue-900 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {gp.gradeName} ({gp.totalClasses} lớp • {gp.subjects.length} môn)
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 italic">
                  💡 Số lớp và danh mục môn học tự động đồng bộ từ Danh mục Môn học & Lớp. Số tiết tính theo CT GDPT 2018!
                </div>
              </div>

              {/* RENDER GRADE TABLES */}
              {gradePlans
                .filter((gp) => selectedGradeTab === 'ALL' || selectedGradeTab === gp.grade)
                .map((gradePlan) => (
                  <div
                    key={gradePlan.grade}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                  >
                    {/* Grade Header Banner */}
                    <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-400 text-blue-950 font-black flex items-center justify-center text-sm shadow-xs">
                          K{gradePlan.grade}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-white">
                            {gradePlan.gradeName.toUpperCase()} — {gradePlan.totalClasses} LỚP HỌC ({gradePlan.subjects.length} MÔN HỌC / HĐGD)
                          </h4>
                          <p className="text-[11px] text-blue-200">
                            Buổi 1: {fmt(gradePlan.totalSession1Periods)} tiết • Buổi 2: {fmt(gradePlan.totalSession2Periods)} tiết • Tổng cộng: {fmt(gradePlan.grandTotalPeriods)} tiết/năm
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-xl border border-white/20 text-xs font-bold text-amber-300">
                        {gradePlan.totalClasses} Lớp học ({classCountByGrade[gradePlan.grade]} lớp)
                      </div>
                    </div>

                    {/* Table of Subjects */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                            <th rowSpan={2} className="py-2.5 px-2 text-center w-10 border-r border-slate-200">
                              STT
                            </th>
                            <th rowSpan={2} className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">
                              Môn học / HĐGD
                            </th>
                            <th rowSpan={2} className="py-2.5 px-2 text-center w-14 border-r border-slate-200" title="Số tiết theo CT GDPT 2018 mỗi tuần trên 1 lớp">
                              Tiết/tuần
                            </th>
                            <th
                              colSpan={semesterView === 'FULL' ? 4 : 2}
                              className="py-2 px-3 text-center border-r border-slate-300 bg-blue-50/80 text-blue-950 font-black"
                            >
                              Buổi 1 (Chính khóa)
                            </th>
                            <th
                              colSpan={gradePlan.grade === 9 ? 6 : 4}
                              className="py-2 px-3 text-center border-r border-slate-300 bg-amber-50/80 text-amber-950 font-black"
                            >
                              Buổi 2 (Tăng cường & Bồi dưỡng)
                            </th>
                            <th rowSpan={2} className="py-2.5 px-3 text-right bg-slate-100 text-slate-900 font-black">
                              Tổng cộng
                            </th>
                          </tr>
                          <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[11px]">
                            {/* Buổi 1 sub-headers */}
                            <th className="py-1.5 px-2 text-center border-r border-slate-200">Số lớp</th>
                            {semesterView === 'FULL' && (
                              <>
                                <th className="py-1.5 px-2 text-right border-r border-slate-200 text-blue-800">
                                  HK I (18t)
                                </th>
                                <th className="py-1.5 px-2 text-right border-r border-slate-200 text-blue-800">
                                  HK II (17t)
                                </th>
                              </>
                            )}
                            <th className="py-1.5 px-2 text-right border-r border-slate-300 font-bold text-blue-950">
                              {semesterView === 'HK1' ? 'Tiết HK1' : semesterView === 'HK2' ? 'Tiết HK2' : 'Cả năm (35t)'}
                            </th>

                            {/* Buổi 2 sub-headers */}
                            <th className="py-1.5 px-2 text-center border-r border-slate-200 bg-amber-50/40">
                              Lớp BD
                            </th>
                            <th className="py-1.5 px-2 text-right border-r border-slate-200 bg-amber-50/40">
                              Tiết BD
                            </th>
                            <th className="py-1.5 px-2 text-center border-r border-slate-200 bg-amber-50/40">
                              Lớp PĐ
                            </th>
                            <th className="py-1.5 px-2 text-right border-r border-slate-300 bg-amber-50/40">
                              Tiết PĐ
                            </th>

                            {gradePlan.grade === 9 && (
                              <>
                                <th className="py-1.5 px-2 text-center border-r border-slate-200 bg-amber-100/50 font-bold text-amber-950">
                                  Lớp Ôn thi
                                </th>
                                <th className="py-1.5 px-2 text-right border-r border-slate-300 bg-amber-100/50 font-bold text-amber-950">
                                  Tiết Ôn thi
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {gradePlan.subjects.map((subj) => {
                            const s1Display =
                              semesterView === 'HK1'
                                ? subj.session1Hk1Periods || Math.round(subj.session1Periods * (18 / 35))
                                : semesterView === 'HK2'
                                ? subj.session1Hk2Periods || Math.round(subj.session1Periods * (17 / 35))
                                : subj.session1Periods;

                            return (
                              <tr
                                key={subj.stt}
                                onClick={() => {
                                  setSelectedSubjectDetail({ subject: subj, gradeName: gradePlan.gradeName, grade: gradePlan.grade });
                                  setDetailEditBdClasses(subj.session2BdClasses || 0);
                                  setDetailEditBdPeriods(subj.session2BdPeriods || 0);
                                  setDetailEditPdClasses(subj.session2PdClasses || 0);
                                  setDetailEditPdPeriods(subj.session2PdPeriods || 0);
                                  setDetailEditExamClasses(subj.session2ExamClasses || 0);
                                  setDetailEditExamPeriods(subj.session2ExamPeriods || 0);
                                  setIsEditingDetailSession2(false);
                                }}
                                className="hover:bg-blue-50/30 transition cursor-pointer group"
                              >
                                <td className="py-2.5 px-2 text-center text-slate-500 font-semibold border-r border-slate-100">
                                  {subj.stt}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 border-r border-slate-100 group-hover:text-blue-900 flex items-center justify-between">
                                  <span>{subj.subjectName}</span>
                                  <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-600 font-medium border-r border-slate-100 bg-slate-50/40">
                                  {subj.periodsPerWeek}
                                </td>

                                {/* Buổi 1 */}
                                <td className="py-2.5 px-2 text-center text-slate-800 font-semibold border-r border-slate-100">
                                  {subj.session1Classes}
                                </td>
                                {semesterView === 'FULL' && (
                                  <>
                                    <td className="py-2.5 px-2 text-right text-blue-800 border-r border-slate-100">
                                      {fmt(subj.session1Hk1Periods || Math.round(subj.session1Periods * (18 / 35)))}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-blue-800 border-r border-slate-100">
                                      {fmt(subj.session1Hk2Periods || Math.round(subj.session1Periods * (17 / 35)))}
                                    </td>
                                  </>
                                )}
                                <td className="py-2.5 px-2 text-right font-black text-blue-950 border-r border-slate-200 bg-blue-50/30">
                                  {fmt(s1Display)}
                                </td>

                                {/* Buổi 2 */}
                                <td className="py-2.5 px-2 text-center text-slate-600 border-r border-slate-100">
                                  {subj.session2BdClasses > 0 ? subj.session2BdClasses : ''}
                                </td>
                                <td className="py-2.5 px-2 text-right text-amber-800 font-semibold border-r border-slate-100">
                                  {subj.session2BdPeriods > 0 ? fmt(subj.session2BdPeriods) : ''}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-600 border-r border-slate-100">
                                  {subj.session2PdClasses > 0 ? subj.session2PdClasses : ''}
                                </td>
                                <td className="py-2.5 px-2 text-right text-amber-800 font-semibold border-r border-slate-200">
                                  {subj.session2PdPeriods > 0 ? fmt(subj.session2PdPeriods) : ''}
                                </td>

                                {gradePlan.grade === 9 && (
                                  <>
                                    <td className="py-2.5 px-2 text-center text-amber-900 font-semibold border-r border-slate-100 bg-amber-50/30">
                                      {subj.session2ExamClasses && subj.session2ExamClasses > 0
                                        ? subj.session2ExamClasses
                                        : ''}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-amber-900 font-black border-r border-slate-200 bg-amber-50/30">
                                      {subj.session2ExamPeriods && subj.session2ExamPeriods > 0
                                        ? fmt(subj.session2ExamPeriods)
                                        : ''}
                                    </td>
                                  </>
                                )}

                                <td className="py-2.5 px-3 text-right font-black text-slate-900 bg-slate-50/60">
                                  {fmt(subj.totalPeriods)}
                                </td>
                              </tr>
                            );
                          })}

                          {/* DÒNG TỔNG CỘNG KHỐI */}
                          <tr className="bg-blue-50/80 font-black text-slate-900 border-t-2 border-blue-900/40">
                            <td colSpan={3} className="py-3 px-3 text-center uppercase tracking-wider text-blue-950 border-r border-slate-200">
                              TỔNG CỘNG {gradePlan.gradeName.toUpperCase()}
                            </td>
                            <td className="py-3 px-2 text-center border-r border-slate-200">
                              {gradePlan.totalSession1Classes}
                            </td>
                            {semesterView === 'FULL' && (
                              <>
                                <td className="py-3 px-2 text-right border-r border-slate-200 text-blue-900">
                                  {fmt(gradePlan.totalSession1Hk1Periods)}
                                </td>
                                <td className="py-3 px-2 text-right border-r border-slate-200 text-blue-900">
                                  {fmt(gradePlan.totalSession1Hk2Periods)}
                                </td>
                              </>
                            )}
                            <td className="py-3 px-2 text-right border-r border-slate-300 text-blue-950 font-black text-sm bg-blue-100/60">
                              {fmt(
                                semesterView === 'HK1'
                                  ? gradePlan.totalSession1Hk1Periods
                                  : semesterView === 'HK2'
                                  ? gradePlan.totalSession1Hk2Periods
                                  : gradePlan.totalSession1Periods
                              )}
                            </td>

                            <td className="py-3 px-2 text-center border-r border-slate-200 text-amber-950">
                              {gradePlan.totalSession2BdClasses}
                            </td>
                            <td className="py-3 px-2 text-right border-r border-slate-200 text-amber-950">
                              {fmt(gradePlan.totalSession2BdPeriods)}
                            </td>
                            <td className="py-3 px-2 text-center border-r border-slate-200 text-amber-950">
                              {gradePlan.totalSession2PdClasses}
                            </td>
                            <td className="py-3 px-2 text-right border-r border-slate-300 text-amber-950">
                              {fmt(gradePlan.totalSession2PdPeriods)}
                            </td>

                            {gradePlan.grade === 9 && (
                              <>
                                <td className="py-3 px-2 text-center border-r border-slate-200 text-amber-950 bg-amber-100/70">
                                  {gradePlan.totalSession2ExamClasses}
                                </td>
                                <td className="py-3 px-2 text-right border-r border-slate-300 text-amber-950 bg-amber-100/70">
                                  {fmt(gradePlan.totalSession2ExamPeriods || 0)}
                                </td>
                              </>
                            )}

                            <td className="py-3 px-3 text-right font-black text-blue-950 text-sm bg-blue-100">
                              {fmt(gradePlan.grandTotalPeriods)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 3: TIẾT KIÊM NHIỆM TOÀN TRƯỜNG */}
          {/* ======================================================================= */}
          {activeTab === 'DUTIES' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 text-white rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div>
                  <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    TỔNG HỢP SỐ TIẾT KIÊM NHIỆM TOÀN TRƯỜNG
                  </h3>
                  <p className="text-xs text-purple-200/90 mt-1">
                    Cộng: <strong className="text-amber-300">{duties.reduce((s, d) => s + d.periodsPerWeek, 0)} tiết/tuần</strong> x 35 tuần ={' '}
                    <strong className="text-white text-sm font-black">{fmt(schoolSummary.concurrentPeriods)} tiết/năm</strong> • HK I:{' '}
                    {fmt(schoolSummary.concurrentHk1Periods)} tiết • HK II: {fmt(schoolSummary.concurrentHk2Periods)} tiết
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingDuty({
                        stt: duties.length + 1,
                        dutyName: '',
                        periodsPerWeek: 2,
                        inChargeTeachers: '',
                        teacherCount: 1,
                        periodsPerYear: 70,
                        notes: '',
                      });
                      setIsAddingNewDuty(true);
                    }}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-purple-950 font-black rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm nhiệm vụ kiêm nhiệm</span>
                  </button>
                </div>
              </div>

              {/* BẢNG KIÊM NHIỆM */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-bold">
                        <th className="py-3 px-3 text-center w-12 border-r border-slate-200">STT</th>
                        <th className="py-3 px-4 min-w-[220px] border-r border-slate-200">Tên kiêm nhiệm</th>
                        <th className="py-3 px-3 text-center w-24 border-r border-slate-200">Tiết/tuần</th>
                        {semesterView === 'FULL' && (
                          <>
                            <th className="py-3 px-3 text-right w-28 border-r border-slate-200 text-purple-900">
                              HK I (18w)
                            </th>
                            <th className="py-3 px-3 text-right w-28 border-r border-slate-200 text-purple-900">
                              HK II (17w)
                            </th>
                          </>
                        )}
                        <th className="py-3 px-3 text-right w-32 border-r border-slate-200 font-black text-purple-950">
                          {semesterView === 'HK1' ? 'Tiết HK1' : semesterView === 'HK2' ? 'Tiết HK2' : 'Cả năm (35w)'}
                        </th>
                        <th className="py-3 px-4 min-w-[280px] border-r border-slate-200">
                          Người kiêm nhiệm (Họ và tên)
                        </th>
                        <th className="py-3 px-4 min-w-[180px]">Ghi chú & Công thức</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {duties.map((duty) => {
                        const hk1 = duty.periodsHk1 || duty.periodsPerWeek * 18;
                        const hk2 = duty.periodsHk2 || duty.periodsPerWeek * 17;
                        const year = duty.periodsPerYear || duty.periodsPerWeek * 35;
                        const displayPeriods =
                          semesterView === 'HK1' ? hk1 : semesterView === 'HK2' ? hk2 : year;

                        return (
                          <tr
                            key={duty.stt}
                            onClick={() => setSelectedDutyDetail(duty)}
                            className="hover:bg-purple-50/40 transition cursor-pointer group"
                          >
                            <td className="py-2.5 px-3 text-center text-slate-500 font-semibold border-r border-slate-100">
                              {duty.stt}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-100 group-hover:text-purple-900 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span>{duty.dutyName}</span>
                                {duty.isHomeroom && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md font-bold">
                                    GVCN
                                  </span>
                                )}
                              </div>
                              <Edit3
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDuty(duty);
                                  setIsAddingNewDuty(false);
                                }}
                                className="w-3.5 h-3.5 text-slate-400 hover:text-purple-700"
                                title="Chỉnh sửa nhiệm vụ này"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 border-r border-slate-100">
                              {duty.periodsPerWeek}
                            </td>
                            {semesterView === 'FULL' && (
                              <>
                                <td className="py-2.5 px-3 text-right text-purple-900 border-r border-slate-100">
                                  {fmt(hk1)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-purple-900 border-r border-slate-100">
                                  {fmt(hk2)}
                                </td>
                              </>
                            )}
                            <td className="py-2.5 px-3 text-right font-black text-purple-950 border-r border-slate-200 bg-purple-50/30">
                              {fmt(displayPeriods)}
                            </td>
                            <td className="py-2.5 px-4 text-slate-800 font-medium border-r border-slate-100">
                              <span className="text-slate-900 font-semibold">{duty.inChargeTeachers}</span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({duty.teacherCount} GV)
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 text-[11px] italic">
                              {duty.notes || `${duty.periodsPerWeek}t/tuần x 35w = ${fmt(year)}t`}
                            </td>
                          </tr>
                        );
                      })}

                      {/* TỔNG CỘNG KIÊM NHIỆM */}
                      <tr className="bg-purple-100/70 font-black text-purple-950 border-t-2 border-purple-900/30">
                        <td colSpan={2} className="py-3 px-4 text-center uppercase tracking-wider border-r border-purple-200">
                          CỘNG TOÀN TRƯỜNG
                        </td>
                        <td className="py-3 px-3 text-center border-r border-purple-200 text-sm">
                          {duties.reduce((s, d) => s + d.periodsPerWeek, 0)}
                        </td>
                        {semesterView === 'FULL' && (
                          <>
                            <td className="py-3 px-3 text-right border-r border-purple-200 text-purple-950 font-black">
                              {fmt(schoolSummary.concurrentHk1Periods)}
                            </td>
                            <td className="py-3 px-3 text-right border-r border-purple-200 text-purple-950 font-black">
                              {fmt(schoolSummary.concurrentHk2Periods)}
                            </td>
                          </>
                        )}
                        <td className="py-3 px-3 text-right border-r border-purple-200 font-black text-purple-950 text-sm">
                          {fmt(
                            semesterView === 'HK1'
                              ? schoolSummary.concurrentHk1Periods
                              : semesterView === 'HK2'
                              ? schoolSummary.concurrentHk2Periods
                              : schoolSummary.concurrentPeriods
                          )}
                        </td>
                        <td colSpan={2} className="py-3 px-4 text-purple-900 text-xs font-semibold">
                          = {duties.reduce((s, d) => s + d.periodsPerWeek, 0)} tiết/tuần x 35 tuần ={' '}
                          <strong>{fmt(schoolSummary.concurrentPeriods)} tiết/năm</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 4: CÂN ĐỐI ĐỊNH MỨC & PHÂN TÍCH VƯỢT GIỜ */}
          {/* ======================================================================= */}
          {activeTab === 'BALANCE' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm uppercase flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-700" />
                      CÂN ĐỐI ĐỊNH MỨC VÀ PHÂN TÍCH VƯỢT GIỜ TOÀN TRƯỜNG
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Công thức chuẩn hóa theo quy định của Bộ GD&ĐT: Số tiết dạy vượt giờ = Tổng tiết thực dạy & kiêm nhiệm - Tổng tiết định mức.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Định mức GV:</span>
                    <span className="bg-blue-50 text-blue-900 px-2.5 py-1 rounded-lg border border-blue-200 font-black text-xs">
                      19 tiết/tuần/GV
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-blue-900 uppercase">
                      Tiết thực dạy & kiêm nhiệm
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Bao gồm toàn bộ tiết dạy buổi 1 (chính khóa) và buổi 2 các khối lớp (Bồi dưỡng BD, Phụ đạo PĐ, Ôn thi vào 10) + Số tiết kiêm nhiệm của toàn trường.
                    </p>
                    <div className="text-base font-black text-blue-950 pt-1">
                      {fmt(schoolSummary.totalAssignedPeriods)} tiết
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-emerald-900 uppercase">
                      Tiết định mức của trường
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Tính trong 35 tuần của {teacherCountDirect} GV trực tiếp giảng dạy (19t/w x 35w = {fmt(teacherCountDirect * 19 * 35)}t), HT ({schoolSummary.principalPeriods}t), 2 PHT ({schoolSummary.vicePrincipalPeriods}t), TPTĐ trường {schoolSummary.totalClasses} lớp ({schoolSummary.teamLeaderPeriods}t).
                    </p>
                    <div className="text-base font-black text-emerald-950 pt-1">
                      {fmt(schoolSummary.standardQuotaPeriods)} tiết
                    </div>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-800 uppercase">
                      Tiết dạy vượt giờ = Thực dạy - Định mức
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Tổng số tiết dạy thực tế vượt trên định mức giao khoán của nhà trường trong toàn năm học 35 tuần.
                    </p>
                    <div className="text-base font-black text-slate-900 pt-1">
                      +{fmt(schoolSummary.overtimePeriods)} tiết vượt
                    </div>
                  </div>
                </div>

                {/* THAM SỐ CẤU HÌNH TRƯỜNG */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Số GV trực tiếp giảng dạy:</span>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={teacherCountDirect}
                      onChange={(e) => setManualTeacherCount(parseInt(e.target.value) || 74)}
                      className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-center"
                    />
                    <span className="text-slate-500 text-[11px]">(Định mức: 19 tiết/tuần/GV)</span>
                  </div>

                  <div className="text-slate-600 text-xs">
                    Trung bình mỗi GV vượt giờ:{' '}
                    <strong className="text-slate-900 font-bold">
                      {(schoolSummary.overtimePeriods / (teacherCountDirect || 1)).toFixed(1)} tiết/GV/năm
                    </strong>{' '}
                    (khoảng {((schoolSummary.overtimePeriods / (teacherCountDirect || 1)) / 35).toFixed(2)} tiết/tuần)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL: CHỈNH SỬA / THÊM MỚI NHIỆM VỤ KIÊM NHIỆM */}
        {/* ========================================================================= */}
        {editingDuty && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-purple-700" />
                  {isAddingNewDuty ? 'Thêm nhiệm vụ kiêm nhiệm mới' : 'Chỉnh sửa nhiệm vụ kiêm nhiệm'}
                </h3>
                <button
                  onClick={() => setEditingDuty(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tên nhiệm vụ kiêm nhiệm:</label>
                  <input
                    type="text"
                    value={editingDuty.dutyName}
                    onChange={(e) => setEditingDuty({ ...editingDuty, dutyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                    placeholder="VD: Phụ trách phòng thiết bị, Trưởng ban..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Số tiết / tuần:</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={editingDuty.periodsPerWeek}
                      onChange={(e) => {
                        const ppw = parseFloat(e.target.value) || 0;
                        setEditingDuty({
                          ...editingDuty,
                          periodsPerWeek: ppw,
                          periodsPerYear: ppw * 35,
                          periodsHk1: ppw * 18,
                          periodsHk2: ppw * 17,
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Số người đảm nhiệm:</label>
                    <input
                      type="number"
                      min={1}
                      value={editingDuty.teacherCount}
                      onChange={(e) =>
                        setEditingDuty({ ...editingDuty, teacherCount: parseInt(e.target.value) || 1 })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Danh sách người kiêm nhiệm (Họ và tên):
                  </label>
                  <input
                    type="text"
                    value={editingDuty.inChargeTeachers}
                    onChange={(e) =>
                      setEditingDuty({ ...editingDuty, inChargeTeachers: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                    placeholder="VD: Thầy Nguyễn Văn Toàn, Cô Lê Thắm..."
                  />
                  <div className="text-[10.5px] text-slate-500 mt-1">
                    Nhập tên hoặc danh sách các thầy cô kiêm nhiệm nhiệm vụ này.
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ghi chú & căn cứ:</label>
                  <input
                    type="text"
                    value={editingDuty.notes || ''}
                    onChange={(e) => setEditingDuty({ ...editingDuty, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                    placeholder="VD: Căn cứ quyết định số... / 35 tuần"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setEditingDuty(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    const dutyKey = editingDuty.id || `duty_${editingDuty.stt}`;
                    setCustomDutyOverrides((prev) => ({
                      ...prev,
                      [dutyKey]: {
                        dutyName: editingDuty.dutyName,
                        periodsPerWeek: editingDuty.periodsPerWeek,
                        inChargeTeachers: editingDuty.inChargeTeachers,
                        teacherCount: editingDuty.teacherCount,
                        periodsPerYear: editingDuty.periodsPerWeek * 35,
                        periodsHk1: editingDuty.periodsPerWeek * 18,
                        periodsHk2: editingDuty.periodsPerWeek * 17,
                        notes: editingDuty.notes,
                      },
                    }));
                    showToast('Đã cập nhật nhiệm vụ kiêm nhiệm thành công!');
                    setEditingDuty(null);
                  }}
                  className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl transition text-xs shadow-xs cursor-pointer"
                >
                  Lưu nhiệm vụ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL CHI TIẾT MÔN HỌC (POPUP KHI CLICK VÀO DÒNG MÔN) */}
        {/* ========================================================================= */}
        {selectedSubjectDetail && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 font-black flex items-center justify-center text-xs">
                    {selectedSubjectDetail.gradeName}
                  </div>
                  <h3 className="font-black text-slate-900 text-sm">
                    {selectedSubjectDetail.subject.subjectName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedSubjectDetail(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 space-y-1">
                  <div className="text-[10px] text-blue-700 font-bold uppercase">Buổi 1 (Chính khóa):</div>
                  <div className="text-base font-black text-blue-950">
                    {selectedSubjectDetail.subject.session1Classes} lớp • {fmt(selectedSubjectDetail.subject.session1Periods)} tiết/năm
                  </div>
                  <div className="text-[11px] text-blue-800">
                    HK I (18 tuần): {fmt(selectedSubjectDetail.subject.session1Hk1Periods || Math.round(selectedSubjectDetail.subject.session1Periods * (18 / 35)))} tiết • HK II (17 tuần): {fmt(selectedSubjectDetail.subject.session1Hk2Periods || Math.round(selectedSubjectDetail.subject.session1Periods * (17 / 35)))} tiết
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-amber-800 font-bold uppercase">Buổi 2 (Tăng cường & Bồi dưỡng):</div>
                    <button
                      type="button"
                      onClick={() => setIsEditingDetailSession2(!isEditingDetailSession2)}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded-lg border border-blue-200 shadow-2xs transition cursor-pointer"
                    >
                      {isEditingDetailSession2 ? 'Hủy sửa' : '✏️ Chỉnh sửa Buổi 2'}
                    </button>
                  </div>

                  {!isEditingDetailSession2 ? (
                    <div className="text-slate-800 space-y-1">
                      {selectedSubjectDetail.subject.session2BdClasses > 0 ? (
                        <div>
                          • Đối tượng 1 (Bồi dưỡng BD):{' '}
                          <strong>
                            {selectedSubjectDetail.subject.session2BdClasses} lớp ({selectedSubjectDetail.subject.session2BdPeriods} tiết)
                          </strong>
                        </div>
                      ) : null}
                      {selectedSubjectDetail.subject.session2PdClasses > 0 ? (
                        <div>
                          • Đối tượng 2 (Phụ đạo PĐ):{' '}
                          <strong>
                            {selectedSubjectDetail.subject.session2PdClasses} lớp ({selectedSubjectDetail.subject.session2PdPeriods} tiết)
                          </strong>
                        </div>
                      ) : null}
                      {selectedSubjectDetail.subject.session2ExamClasses &&
                      selectedSubjectDetail.subject.session2ExamClasses > 0 ? (
                        <div>
                          • Đối tượng 3 (Ôn thi vào 10):{' '}
                          <strong>
                            {selectedSubjectDetail.subject.session2ExamClasses} lớp ({selectedSubjectDetail.subject.session2ExamPeriods} tiết)
                          </strong>
                        </div>
                      ) : null}
                      {!(selectedSubjectDetail.subject.session2BdClasses > 0) &&
                       !(selectedSubjectDetail.subject.session2PdClasses > 0) &&
                       !(selectedSubjectDetail.subject.session2ExamClasses && selectedSubjectDetail.subject.session2ExamClasses > 0) && (
                        <div className="text-slate-400 italic text-[11px]">
                          Chưa phân bổ tiết dạy Buổi 2 cho môn này. Bấm "Chỉnh sửa Buổi 2" để thêm.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 bg-white/90 p-2.5 rounded-lg border border-amber-300">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Lớp Bồi dưỡng (BD)</label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={detailEditBdClasses}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDetailEditBdClasses(val);
                              if (detailEditBdPeriods === 0 || detailEditBdPeriods === detailEditBdClasses * 70) {
                                setDetailEditBdPeriods(val * 70);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Tiết BD / Năm</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={detailEditBdPeriods}
                            onChange={(e) => setDetailEditBdPeriods(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Lớp Phụ đạo (PĐ)</label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={detailEditPdClasses}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDetailEditPdClasses(val);
                              if (detailEditPdPeriods === 0 || detailEditPdPeriods === detailEditPdClasses * 70) {
                                setDetailEditPdPeriods(val * 70);
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Tiết PĐ / Năm</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={detailEditPdPeriods}
                            onChange={(e) => setDetailEditPdPeriods(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {selectedSubjectDetail.grade === 9 && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Lớp Ôn thi vào 10</label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={detailEditExamClasses}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setDetailEditExamClasses(val);
                                if (detailEditExamPeriods === 0 || detailEditExamPeriods === detailEditExamClasses * 70) {
                                  setDetailEditExamPeriods(val * 70);
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Tiết Ôn thi / Năm</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={detailEditExamPeriods}
                              onChange={(e) => setDetailEditExamPeriods(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200">
                        <span className="text-[10px] text-amber-900 font-bold">
                          Đang lưu Buổi 2 riêng cho {selectedSubjectDetail.gradeName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedSubjectDetail) return;
                            const sName = selectedSubjectDetail.subject.subjectName;
                            const targetGrade = selectedSubjectDetail.grade || 6;
                            const allSubjs = dataStore.getSubjects();
                            const matched = allSubjs.find(
                              (s) => s.name.trim().toLowerCase() === sName.trim().toLowerCase() ||
                                     s.shortName.trim().toLowerCase() === sName.trim().toLowerCase() ||
                                     s.id === selectedSubjectDetail.subject.shortName
                            );
                            if (matched) {
                              const hasSession2 = detailEditBdClasses > 0 || detailEditPdClasses > 0 || detailEditExamClasses > 0;
                              dataStore.updateSubjectSession2ForGrade(matched.id, targetGrade, {
                                hasSession2,
                                bdClasses: detailEditBdClasses,
                                bdPeriods: detailEditBdPeriods,
                                pdClasses: detailEditPdClasses,
                                pdPeriods: detailEditPdPeriods,
                                examClasses: detailEditExamClasses,
                                examPeriods: detailEditExamPeriods,
                              });
                              showToast(`Đã lưu Buổi 2 Khối ${targetGrade} cho môn "${sName}" và đồng bộ 2 chiều sang Danh mục Môn học!`);
                            } else {
                              showToast(`Đã cập nhật số tiết Buổi 2 cho môn "${sName}"!`);
                            }
                            setIsEditingDetailSession2(false);
                            setSelectedSubjectDetail(null);
                          }}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-2xs"
                        >
                          Lưu & Đồng bộ sang Môn học
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center font-bold">
                  <span>Tổng số tiết môn học trong năm:</span>
                  <span className="text-sm font-black text-blue-950">
                    {fmt(selectedSubjectDetail.subject.totalPeriods)} tiết
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedSubjectDetail(null)}
                  className="px-4 py-1.5 bg-blue-900 text-white font-bold rounded-xl text-xs hover:bg-blue-800 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
