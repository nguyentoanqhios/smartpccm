import { Teacher, Department, SpecialDuty, TeachingAssignment, SchoolClass } from '../types';

export const STANDARD_POSITION_PRESETS = [
  'Hiệu trưởng',
  'Phó hiệu trưởng',
  'Tổ trưởng chuyên môn',
  'Tổ phó chuyên môn',
  'Giáo viên chủ nhiệm',
  'Chủ tịch Công đoàn',
  'Phó Chủ tịch Công đoàn',
  'Bí thư Chi đoàn',
  'Tổng phụ trách Đội',
  'Thư ký hội đồng',
  'Trưởng ban TTND',
  'Tổ tư vấn tâm lý',
  'Phụ trách thiết bị / phòng bộ môn',
  'Phụ trách CNTT & Chuyển đổi số',
];

/**
 * Chuẩn hóa tên chức vụ / vị trí công việc để loại bỏ trùng lặp
 * (Ví dụ: "Tổ trưởng" và "Tổ trưởng chuyên môn" là cùng một chức vụ, đồng bộ thành "Tổ trưởng chuyên môn")
 */
export function normalizePositionName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // 1. Nhóm Tổ trưởng chuyên môn
  if (
    lower === 'tổ trưởng' ||
    lower === 'tổ trưởng chuyên môn' ||
    lower === 'ttcm' ||
    lower === 'tổ trưởng bộ môn' ||
    lower === 'to truong' ||
    lower === 'to truong chuyen mon' ||
    lower.startsWith('tổ trưởng tổ') ||
    lower.startsWith('tổ trưởng chuyên môn')
  ) {
    return 'Tổ trưởng chuyên môn';
  }

  // 2. Nhóm Tổ phó chuyên môn
  if (
    lower === 'tổ phó' ||
    lower === 'tổ phó chuyên môn' ||
    lower === 'tpcm' ||
    lower === 'tổ phó bộ môn' ||
    lower === 'to pho' ||
    lower === 'to pho chuyen mon' ||
    lower.startsWith('tổ phó tổ') ||
    lower.startsWith('tổ phó chuyên môn')
  ) {
    return 'Tổ phó chuyên môn';
  }

  // 3. Nhóm Tổng phụ trách
  if (
    lower === 'tổng phụ trách' ||
    lower === 'tổng phụ trách đội' ||
    lower === 'tpt' ||
    lower === 'tpt đội'
  ) {
    return 'Tổng phụ trách Đội';
  }

  // 4. Nhóm Thư ký hội đồng
  if (
    lower === 'thư ký' ||
    lower === 'thư ký hội đồng' ||
    lower === 'thu ky' ||
    lower === 'thu ky hoi dong' ||
    lower === 'thư ký hđsp' ||
    lower === 'tkhđ' ||
    lower.includes('thư ký')
  ) {
    return 'Thư ký hội đồng';
  }

  // 5. Nhóm Giáo viên chủ nhiệm
  if (
    lower === 'chủ nhiệm' ||
    lower === 'chủ nhiệm lớp' ||
    lower === 'giáo viên chủ nhiệm' ||
    lower === 'gvcn' ||
    lower === 'chu nhiem' ||
    lower === 'chu nhiem lop'
  ) {
    return 'Giáo viên chủ nhiệm';
  }

  // Nếu là "Chủ nhiệm 6A1" hoặc "GVCN 6A1"
  if (lower.startsWith('gvcn ') || lower.startsWith('chủ nhiệm lớp ') || lower.startsWith('chủ nhiệm ')) {
    const classPart = trimmed.replace(/^(gvcn|chủ nhiệm lớp|chủ nhiệm)\s*/i, '').trim();
    if (classPart) {
      return `Chủ nhiệm lớp ${classPart.toUpperCase()}`;
    }
    return 'Giáo viên chủ nhiệm';
  }

  return trimmed;
}

/**
 * Trả về danh sách tất cả các vị trí công việc của một giáo viên (đã chuẩn hóa và loại bỏ trùng lặp):
 * - Đồng bộ từ teacher.positions
 * - Đồng bộ từ teacher.status (Hiệu trưởng / Phó hiệu trưởng)
 * - Đồng bộ từ chức danh Tổ trưởng / Tổ phó trong Department
 * - Đồng bộ từ danh sách lớp học (homeroomTeacherId)
 * - Đồng bộ từ các nhiệm vụ kiêm nhiệm được gán trong assignments
 */
export function getTeacherPositions(
  teacher: Teacher,
  departments: Department[] = [],
  duties: SpecialDuty[] = [],
  assignments: TeachingAssignment[] = [],
  classes: SchoolClass[] = []
): string[] {
  const result = new Set<string>();

  // 1. Vị trí đã lưu trong teacher.positions
  if (Array.isArray(teacher.positions)) {
    teacher.positions.forEach((p) => {
      const norm = normalizePositionName(p);
      if (norm) result.add(norm);
    });
  }

  // 2. Kiểm tra status BGH
  if (teacher.status === 'PRINCIPAL') {
    result.add('Hiệu trưởng');
  } else if (teacher.status === 'VICE_PRINCIPAL') {
    result.add('Phó hiệu trưởng');
  }

  // 3. Kiểm tra vai trò trong các tổ bộ môn
  departments.forEach((dept) => {
    if (dept.headTeacherId === teacher.id) {
      result.add('Tổ trưởng chuyên môn');
    }
    if (
      dept.deputyTeacherId === teacher.id ||
      (Array.isArray(dept.deputyTeacherIds) && dept.deputyTeacherIds.includes(teacher.id))
    ) {
      result.add('Tổ phó chuyên môn');
    }
  });

  // 4. Kiểm tra phân công chủ nhiệm từ danh sách lớp học (homeroomTeacherId)
  if (Array.isArray(classes)) {
    const homeroomClasses = classes.filter((c) => !c.isDeleted && c.homeroomTeacherId === teacher.id);
    homeroomClasses.forEach((c) => {
      result.add(`Chủ nhiệm lớp ${c.name}`);
    });
  }

  // 5. Đồng bộ từ phân công kiêm nhiệm (assignments)
  if (Array.isArray(assignments)) {
    assignments.forEach((asg) => {
      if (asg.teacherId === teacher.id && !asg.isDeleted) {
        if (
          asg.type === 'CONCURRENT' ||
          asg.type === 'CONCURRENT_DUTY' ||
          asg.type === 'EXEMPTION' ||
          Boolean(asg.dutyId) ||
          Boolean(asg.dutyName)
        ) {
          let rawName = asg.dutyName;
          if (!rawName && asg.dutyId) {
            const found = duties.find((d) => d.id === asg.dutyId || d.code === asg.dutyId);
            if (found) rawName = found.name;
          }
          if (rawName) {
            const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
            const norm = normalizePositionName(cleanName);
            if (norm) result.add(norm);
          } else if (asg.classId && Array.isArray(classes)) {
            const cls = classes.find((c) => c.id === asg.classId);
            if (cls) {
              result.add(`Chủ nhiệm lớp ${cls.name}`);
            }
          }
        }
      }
    });
  }

  // 6. Khử trùng lặp thông minh:
  // Nếu đã có "Chủ nhiệm lớp X" thì loại bỏ "Giáo viên chủ nhiệm" chung chung nếu có
  const list = Array.from(result);
  const hasSpecificCN = list.some((p) => p.startsWith('Chủ nhiệm lớp '));
  const filtered = list.filter((p) => {
    if (hasSpecificCN && p === 'Giáo viên chủ nhiệm') {
      return false;
    }
    return true;
  });

  return filtered;
}

/**
 * Kiểu định dạng hiển thị huy hiệu (badge) cho từng vị trí công việc
 */
export function getPositionBadgeStyle(pos: string): string {
  const p = pos.toLowerCase();
  if (p.includes('hiệu trưởng') && !p.includes('phó')) {
    return 'bg-red-50 text-red-900 border-red-300 font-black shadow-2xs';
  }
  if (p.includes('phó hiệu trưởng')) {
    return 'bg-blue-50 text-blue-900 border-blue-300 font-black shadow-2xs';
  }
  if (p.includes('tổ trưởng')) {
    return 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold';
  }
  if (p.includes('tổ phó')) {
    return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
  }
  if (p.includes('công đoàn')) {
    return 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold';
  }
  if (p.includes('đoàn') || p.includes('đội') || p.includes('tổng phụ trách')) {
    return 'bg-sky-50 text-sky-900 border-sky-300 font-bold';
  }
  if (p.includes('chủ nhiệm')) {
    return 'bg-teal-50 text-teal-900 border-teal-300 font-semibold';
  }
  if (p.includes('thư ký') || p.includes('ttnd') || p.includes('thanh tra')) {
    return 'bg-purple-50 text-purple-900 border-purple-300 font-semibold';
  }
  return 'bg-slate-100 text-slate-800 border-slate-300 font-medium';
}
