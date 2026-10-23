/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Teacher Suggestion Engine (Thuật toán gợi ý giáo viên thông minh)
 *
 * Tiêu chí xếp hạng:
 * 1. Môn học & Tổ bộ môn: Ưu tiên GV cùng tổ chuyên môn hoặc có chuyên ngành đào tạo / danh sách môn có thể dạy.
 * 2. Định mức tiết dạy: Ưu tiên tối đa giáo viên CHƯA ĐỦ ĐỊNH MỨC tiết dạy (thiếu tiết nhiều nhất ưu tiên lên trước).
 * 3. Điểm trường / Nơi làm việc: Ưu tiên GV có cùng điểm làm việc với lớp học (Điểm chính / Phân hiệu).
 */

import { Teacher, Subject, Department, SchoolClass, TeachingAssignment, TeacherCalculationResult } from '../types';

export interface TeacherSuggestion {
  teacher: Teacher;
  department?: Department;
  currentPeriods: number;
  quota: number;
  difference: number; // âm là thiếu, 0 là đủ, dương là vượt
  deficit: number;    // số tiết còn thiếu để đạt định mức (>= 0)
  score: number;      // Điểm gợi ý (càng cao càng ưu tiên)
  isUnderQuota: boolean;
  isSameDepartment: boolean;
  isMatchingSubject: boolean;
  isSameBranch: boolean;
  matchReason: string;
  recommendationTier: 'STRONGLY_RECOMMENDED' | 'SUITABLE' | 'AT_QUOTA' | 'OVER_QUOTA';
}

/**
 * Kiểm tra xem giáo viên có phù hợp với môn học hay không
 */
export function isTeacherMatchingSubject(teacher: Teacher, subject: Subject, department?: Department): boolean {
  if (!teacher || !subject) return false;

  // 1. Cùng tổ bộ môn
  if (subject.departmentId && teacher.departmentId && subject.departmentId === teacher.departmentId) {
    return true;
  }

  // 2. Môn có trong subjectsCanTeach của giáo viên
  if (Array.isArray(teacher.subjectsCanTeach)) {
    const sId = subject.id?.toLowerCase();
    const sCode = subject.code?.toLowerCase();
    const sName = subject.name?.toLowerCase();
    const sShort = subject.shortName?.toLowerCase();

    const hasMatch = teacher.subjectsCanTeach.some((item) => {
      if (!item) return false;
      const lower = item.toLowerCase();
      return lower === sId || lower === sCode || lower === sName || lower === sShort;
    });
    if (hasMatch) return true;
  }

  // 3. Khớp theo chuyên ngành đào tạo (major)
  if (teacher.major) {
    const m = teacher.major.toLowerCase();
    const sName = subject.name.toLowerCase();
    const sShort = (subject.shortName || '').toLowerCase();
    const sCode = (subject.code || '').toLowerCase();

    if (
      sName.includes(m) ||
      m.includes(sName) ||
      (sShort && (sShort.includes(m) || m.includes(sShort))) ||
      (sCode && m.includes(sCode))
    ) {
      return true;
    }

    // Tích hợp: KHTN (Lý, Hóa, Sinh)
    if (sCode === 'khtn' || sName.includes('khoa học tự nhiên')) {
      if (m.includes('lý') || m.includes('vật lí') || m.includes('hóa') || m.includes('sinh')) {
        return true;
      }
    }

    // Tích hợp: Lịch sử & Địa lí (Sử, Địa)
    if (sCode === 'su_dia' || sName.includes('lịch sử') || sName.includes('địa')) {
      if (m.includes('sử') || m.includes('địa')) {
        return true;
      }
    }

    // Nghệ thuật: Âm nhạc, Mỹ thuật
    if (sCode === 'nghe_thuat' || sName.includes('nghệ thuật')) {
      if (m.includes('nhạc') || m.includes('họa') || m.includes('mỹ thuật')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tính số tiết hiện tại của giáo viên trong học kỳ
 */
export function getTeacherAssignedPeriods(
  teacherId: string,
  assignments: TeachingAssignment[],
  calculationsMap?: Map<string, TeacherCalculationResult>
): { currentPeriods: number; quota: number; difference: number } {
  if (calculationsMap && calculationsMap.has(teacherId)) {
    const calc = calculationsMap.get(teacherId)!;
    return {
      currentPeriods: calc.totalCalculated ?? calc.actualTotalAssigned ?? 0,
      quota: calc.quota ?? 19,
      difference: calc.difference ?? 0,
    };
  }

  // Dự phòng tính trực tiếp từ assignments
  let total = 0;
  for (const a of assignments) {
    if (a.teacherId === teacherId && !a.isDeleted) {
      total += a.periodsPerWeek || 0;
    }
  }
  return {
    currentPeriods: total,
    quota: 19,
    difference: total - 19,
  };
}

/**
 * Trả về danh sách gợi ý giáo viên thông minh đã được xếp hạng
 */
export function getSmartTeacherSuggestions({
  subject,
  targetClass,
  teachers,
  departments,
  assignments,
  calculationsMap,
  maxResults = 10,
}: {
  subject?: Subject | null;
  targetClass?: SchoolClass | null;
  teachers: Teacher[];
  departments: Department[];
  assignments: TeachingAssignment[];
  calculationsMap?: Map<string, TeacherCalculationResult>;
  maxResults?: number;
}): TeacherSuggestion[] {
  if (!teachers || teachers.length === 0) return [];

  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const activeTeachers = teachers.filter((t) => !t.isDeleted && t.status === 'ACTIVE');

  const suggestions: TeacherSuggestion[] = [];

  for (const teacher of activeTeachers) {
    const dept = deptMap.get(teacher.departmentId);
    const { currentPeriods, quota, difference } = getTeacherAssignedPeriods(teacher.id, assignments, calculationsMap);
    const deficit = Math.max(0, quota - currentPeriods);
    const isUnderQuota = difference < 0;

    let isSameDept = false;
    let isMatchingSubj = false;

    if (subject) {
      isSameDept = Boolean(subject.departmentId && teacher.departmentId && subject.departmentId === teacher.departmentId);
      isMatchingSubj = isTeacherMatchingSubject(teacher, subject, dept);
    }

    // Kiểm tra cùng điểm trường / nơi làm việc
    let isSameBranch = true;
    if (targetClass?.branchId && teacher.workplaceId) {
      isSameBranch = teacher.workplaceId === targetClass.branchId || teacher.workplaceId === 'wp_all';
    }

    // =========================================================================
    // HỆ THỐNG TÍNH ĐIỂM ƯU TIÊN (SCORING MATRIX)
    // =========================================================================
    let score = 0;

    // 1. Tiêu chí Môn học & Tổ bộ môn (Nền tảng chuyên môn)
    if (isMatchingSubj) score += 200;
    if (isSameDept) score += 150;

    // 2. Tiêu chí Định mức tiết dạy (Trọng số cao nhất theo yêu cầu)
    if (isUnderQuota) {
      // Ưu tiên cực mạnh cho GV chưa đủ định mức: cộng 300 điểm + 15 điểm cho mỗi tiết thiếu
      score += 300 + (deficit * 15);
    } else if (difference === 0) {
      // Đã đủ định mức chuẩn: cộng 50 điểm
      score += 50;
    } else {
      // Vượt giờ: trừ điểm để ưu tiên người thiếu tiết
      score -= Math.min(200, difference * 10);
    }

    // 3. Tiêu chí Vị trí địa lý / Điểm trường
    if (isSameBranch) {
      score += 50;
    } else {
      score -= 80; // Giảm ưu tiên nếu phải di chuyển giữa các phân hiệu
    }

    // Xác định phân hạng gợi ý
    let recommendationTier: TeacherSuggestion['recommendationTier'] = 'SUITABLE';
    if ((isMatchingSubj || isSameDept) && isUnderQuota) {
      recommendationTier = 'STRONGLY_RECOMMENDED';
    } else if (difference === 0) {
      recommendationTier = 'AT_QUOTA';
    } else if (difference > 0) {
      recommendationTier = 'OVER_QUOTA';
    }

    // Tạo thông điệp lý do gợi ý rõ ràng, trực quan
    const reasons: string[] = [];
    if (isUnderQuota) {
      reasons.push(`Chưa đủ định mức: hiện dạy ${currentPeriods}/${quota} tiết (Thiếu ${deficit} tiết)`);
    } else if (difference === 0) {
      reasons.push(`Đã đủ định mức (${quota}/${quota} tiết)`);
    } else {
      reasons.push(`Đang vượt giờ (${currentPeriods}/${quota} tiết, +${difference} tiết)`);
    }

    if (isMatchingSubj) {
      reasons.push(`Đúng chuyên môn ${subject?.name || ''}`);
    } else if (isSameDept) {
      reasons.push(`Cùng tổ ${dept?.name || 'bộ môn'}`);
    }

    if (teacher.workplace) {
      reasons.push(teacher.workplace);
    }

    suggestions.push({
      teacher,
      department: dept,
      currentPeriods,
      quota,
      difference,
      deficit,
      score,
      isUnderQuota,
      isSameDepartment: isSameDept,
      isMatchingSubject: isMatchingSubj,
      isSameBranch,
      matchReason: reasons.join(' • '),
      recommendationTier,
    });
  }

  // Sắp xếp danh sách gợi ý: Điểm cao nhất lên đầu
  suggestions.sort((a, b) => {
    // 1. Điểm tổng thể
    if (b.score !== a.score) return b.score - a.score;
    // 2. Giáo viên thiếu nhiều tiết hơn ưu tiên lên trước
    if (b.deficit !== a.deficit) return b.deficit - a.deficit;
    // 3. Tên theo thứ tự bảng chữ cái
    return a.teacher.fullName.localeCompare(b.teacher.fullName);
  });

  return suggestions.slice(0, maxResults);
}
