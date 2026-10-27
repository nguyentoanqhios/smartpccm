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
 * Chuẩn hóa tên chức vụ / vị trí công việc để loại bỏ trùng lặp và làm sạch định mức trong ngoặc
 * (Ví dụ: "Bí thư Chi đoàn (2 tiết/tuần)" và "Bí thư Chi đoàn" đồng bộ thành "Bí thư Chi đoàn")
 */
export function normalizePositionName(name: string): string {
  if (!name) return '';
  const clean = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();

  // 1. Nhóm BGH
  if (lower === 'hiệu trưởng' || lower === 'hieu truong' || lower === 'ht') {
    return 'Hiệu trưởng';
  }
  if (
    lower === 'phó hiệu trưởng' ||
    lower === 'pho hieu truong' ||
    lower === 'pht' ||
    lower === 'phó ht' ||
    lower === 'pho ht'
  ) {
    return 'Phó hiệu trưởng';
  }

  // 2. Nhóm Tổ trưởng chuyên môn
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

  // 3. Nhóm Tổ phó chuyên môn
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

  // 4. Nhóm Tổng phụ trách Đội
  if (
    lower === 'tổng phụ trách' ||
    lower === 'tổng phụ trách đội' ||
    lower === 'tpt' ||
    lower === 'tpt đội' ||
    lower === 'tong phu trach' ||
    lower === 'tong phu trach doi' ||
    lower.includes('tổng phụ trách')
  ) {
    return 'Tổng phụ trách Đội';
  }

  // 5. Nhóm Thư ký hội đồng
  if (
    lower === 'thư ký' ||
    lower === 'thư ký hội đồng' ||
    lower === 'thu ky' ||
    lower === 'thu ky hoi dong' ||
    lower === 'thư ký hđsp' ||
    lower === 'tkhđ' ||
    lower === 'tkhdsp'
  ) {
    return 'Thư ký hội đồng';
  }

  // 6. Nhóm Chủ tịch Công đoàn
  if (
    lower === 'chủ tịch công đoàn' ||
    lower === 'ct công đoàn' ||
    lower === 'ctcd' ||
    lower === 'chu tich cong doan' ||
    lower === 'chủ tịch cđ' ||
    lower === 'ct cđ'
  ) {
    return 'Chủ tịch Công đoàn';
  }

  // 7. Nhóm Phó Chủ tịch Công đoàn
  if (
    lower === 'phó chủ tịch công đoàn' ||
    lower === 'pct công đoàn' ||
    lower === 'pctcd' ||
    lower === 'pho chu tich cong doan' ||
    lower === 'phó ct công đoàn' ||
    lower === 'pct cđ'
  ) {
    return 'Phó Chủ tịch Công đoàn';
  }

  // 8. Nhóm Bí thư Chi đoàn
  if (
    lower === 'bí thư chi đoàn' ||
    lower === 'bí thư đoàn' ||
    lower === 'bt chi đoàn' ||
    lower === 'bt đoàn' ||
    lower === 'bi thu chi doan' ||
    lower === 'bi thu doan' ||
    lower === 'btcd' ||
    lower === 'btd' ||
    lower === 'bí thư đoàn thanh niên'
  ) {
    return 'Bí thư Chi đoàn';
  }

  // 9. Nhóm Trưởng ban TTND
  if (
    lower === 'trưởng ban ttnd' ||
    lower === 'trưởng ban thanh tra nhân dân' ||
    lower === 'thanh tra nhân dân' ||
    lower === 'ttnd' ||
    lower === 'tb ttnd' ||
    lower === 'truong ban ttnd'
  ) {
    return 'Trưởng ban TTND';
  }

  // 10. Nhóm Tổ tư vấn tâm lý
  if (
    lower === 'tổ tư vấn tâm lý' ||
    lower === 'tư vấn tâm lý' ||
    lower === 'tham vấn học đường' ||
    lower === 'cán bộ tư vấn tâm lý' ||
    lower === 'to tu van tam ly'
  ) {
    return 'Tổ tư vấn tâm lý';
  }

  // 11. Nhóm Phụ trách thiết bị / phòng bộ môn
  if (
    lower === 'phụ trách thiết bị' ||
    lower === 'phụ trách thiết bị / phòng bộ môn' ||
    lower === 'thiết bị' ||
    lower === 'phụ trách phòng bộ môn' ||
    lower === 'nhân viên thiết bị' ||
    lower === 'phu trach thiet bi' ||
    lower.includes('thiết bị')
  ) {
    return 'Phụ trách thiết bị / phòng bộ môn';
  }

  // 12. Nhóm Phụ trách CNTT & Chuyển đổi số
  if (
    lower === 'phụ trách cntt' ||
    lower === 'phụ trách cntt & chuyển đổi số' ||
    lower === 'cntt & chuyển đổi số' ||
    lower === 'chuyển đổi số' ||
    lower === 'phụ trách công nghệ thông tin' ||
    lower === 'cntt'
  ) {
    return 'Phụ trách CNTT & Chuyển đổi số';
  }

  // 13. Nhóm Miễn giảm con mọn / nuôi con nhỏ
  if (
    lower.includes('con nhỏ') ||
    lower.includes('con mon') ||
    lower.includes('con mọn') ||
    lower.includes('nuôi con') ||
    lower.includes('dưới 12 tháng') ||
    lower.includes('duoi 12 thang')
  ) {
    return 'Nuôi con dưới 12 tháng';
  }

  // 14. Nhóm Giáo viên chủ nhiệm
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

  // Nếu là "Chủ nhiệm 6A1" hoặc "GVCN 6A1" hoặc "Chủ nhiệm lớp LỚP 6A1"
  if (
    lower.startsWith('gvcn ') ||
    lower.startsWith('chủ nhiệm lớp ') ||
    lower.startsWith('chủ nhiệm ') ||
    lower.startsWith('cn ')
  ) {
    const rawClass = clean.replace(/^(gvcn|chủ nhiệm lớp|chủ nhiệm|cn)\s*/i, '').trim();
    // Loại bỏ tiền tố "lớp" hoặc "lop" bị lặp lại (ví dụ "LỚP 6A3" -> "6A3")
    const classPart = rawClass.replace(/^(lớp|lop)\s*/i, '').trim();
    if (classPart) {
      return `Chủ nhiệm lớp ${classPart.toUpperCase()}`;
    }
    return 'Giáo viên chủ nhiệm';
  }

  return clean;
}

/**
 * Lấy định mức số tiết giảm/tính và loại kiêm nhiệm mặc định theo quy định của Bộ GD&ĐT (Thông tư 28/2009 & 15/2017)
 */
export function getDefaultDutyPeriodsAndType(posName: string): { periods: number; type: 'CONCURRENT' | 'EXEMPTION' } | null {
  if (!posName) return null;
  const norm = normalizePositionName(posName);

  switch (norm) {
    case 'Hiệu trưởng':
      return { periods: 17, type: 'EXEMPTION' }; // Giảng dạy 2 tiết
    case 'Phó hiệu trưởng':
      return { periods: 15, type: 'EXEMPTION' }; // Giảng dạy 4 tiết
    case 'Tổ trưởng chuyên môn':
      return { periods: 3, type: 'CONCURRENT' };
    case 'Tổ phó chuyên môn':
      return { periods: 1, type: 'CONCURRENT' };
    case 'Giáo viên chủ nhiệm':
      return { periods: 4, type: 'CONCURRENT' };
    case 'Chủ tịch Công đoàn':
      return { periods: 3, type: 'CONCURRENT' };
    case 'Phó Chủ tịch Công đoàn':
      return { periods: 1, type: 'CONCURRENT' };
    case 'Bí thư Chi đoàn':
      return { periods: 2, type: 'CONCURRENT' };
    case 'Tổng phụ trách Đội':
      return { periods: 17, type: 'CONCURRENT' };
    case 'Thư ký hội đồng':
      return { periods: 2, type: 'CONCURRENT' };
    case 'Trưởng ban TTND':
      return { periods: 2, type: 'CONCURRENT' };
    case 'Tổ tư vấn tâm lý':
      return { periods: 2, type: 'CONCURRENT' };
    case 'Phụ trách thiết bị / phòng bộ môn':
      return { periods: 3, type: 'CONCURRENT' };
    case 'Phụ trách CNTT & Chuyển đổi số':
      return { periods: 2, type: 'CONCURRENT' };
    case 'Nuôi con dưới 12 tháng':
      return { periods: 2, type: 'EXEMPTION' };
    default:
      if (norm.startsWith('Chủ nhiệm lớp ')) {
        return { periods: 4, type: 'CONCURRENT' };
      }
      return null;
  }
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
      const cleanClassName = (c.name || '').replace(/^(lớp|lop)\s*/i, '').trim().toUpperCase();
      if (cleanClassName) {
        result.add(`Chủ nhiệm lớp ${cleanClassName}`);
      }
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
              const cleanClassName = (cls.name || '').replace(/^(lớp|lop)\s*/i, '').trim().toUpperCase();
              if (cleanClassName) {
                result.add(`Chủ nhiệm lớp ${cleanClassName}`);
              }
            }
          }
        }
      }
    });
  }

  // 6. Khử trùng lặp thông minh:
  // - Nếu đã có "Chủ nhiệm lớp X" thì loại bỏ "Giáo viên chủ nhiệm" chung chung nếu có
  // - Khử trùng triệt để các biến thể của "Chủ nhiệm lớp LỚP X" và "Chủ nhiệm lớp X"
  const list = Array.from(result);
  const hasSpecificCN = list.some((p) => p.startsWith('Chủ nhiệm lớp '));
  const filtered = list.filter((p) => {
    if (hasSpecificCN && p === 'Giáo viên chủ nhiệm') {
      return false;
    }
    return true;
  });

  const finalPositions: string[] = [];
  const seenHomeroomClasses = new Set<string>();

  for (const pos of filtered) {
    // Bắt trọn mọi biến thể: "Chủ nhiệm lớp 6A3", "Chủ nhiệm lớp LỚP 6A3", "Chủ nhiệm 6A3", "GVCN 6A3", "Chủ nhiệm Lớp 6A3"
    const hrMatch = /^(?:chủ nhiệm(?:\s+lớp)?|gvcn)\s+(.+)$/i.exec(pos);
    if (hrMatch) {
      let clsKey = hrMatch[1].trim().toUpperCase();
      clsKey = clsKey.replace(/^(?:lớp|lop)\s*/i, '').trim();
      if (clsKey && !seenHomeroomClasses.has(clsKey)) {
        seenHomeroomClasses.add(clsKey);
        finalPositions.push(`Chủ nhiệm lớp ${clsKey}`);
      }
    } else {
      if (!finalPositions.includes(pos)) {
        finalPositions.push(pos);
      }
    }
  }

  return finalPositions;
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
