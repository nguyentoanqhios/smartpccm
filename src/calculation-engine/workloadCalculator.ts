/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Calculation Engine: Rules from Section VI & VII
 */

import {
  Teacher,
  TeachingAssignment,
  Department,
  SpecialDuty,
  TeacherCalculationResult,
  ResultStatus,
  SemesterId,
  AbbreviationRule,
} from '../types';
import {
  abbreviateDutyName,
  applyAbbreviationRules,
  getCanonicalDutyKey,
} from '../utils/abbreviationUtils';

/**
 * Calculates workload metrics for a single teacher with strict duty deduplication
 * (Eliminates duplicate duties and sub-definitions like 'Tổ trưởng Ngoại ngữ' when 'Tổ trưởng' exists)
 */
export function calculateTeacherWorkload(
  teacher: Teacher,
  assignments: TeachingAssignment[],
  duties: SpecialDuty[],
  departmentMap: Map<string, Department>,
  semesterWeeks: number = 18,
  customRules?: AbbreviationRule[]
): TeacherCalculationResult {
  // Filter active assignments for this teacher
  const teacherAssignments = assignments.filter(
    (a) => a.teacherId === teacher.id && !a.isDeleted
  );

  let morningPeriods = 0;
  let afternoonPeriods = 0;
  let activityPeriods = 0;
  let concurrentPeriods = 0;
  let exemptionPeriods = 0;
  let interSchoolPeriods = 0;

  // 1. Phân bổ tiết giảng dạy (gồm cả liên trường) và hoạt động trải nghiệm
  for (const a of teacherAssignments) {
    const periods = a.periodsPerWeek || 0;
    const isInter = Boolean(
      a.isInterSchool ||
      a.interSchoolName ||
      (a.notes && a.notes.toLowerCase().includes('liên trường'))
    );

    if (isInter) {
      interSchoolPeriods += periods;
      if (a.session === 'AFTERNOON') {
        afternoonPeriods += periods;
      } else {
        morningPeriods += periods;
      }
    } else if (a.type === 'TEACHING') {
      if (a.session === 'AFTERNOON') {
        afternoonPeriods += periods;
      } else {
        morningPeriods += periods;
      }
    } else if (
      (a.type === 'ACTIVITY' || a.type === 'OTHER' || a.session === 'ACTIVITY' || a.session === 'OTHER') &&
      !a.dutyId &&
      !a.dutyName &&
      a.type !== 'CONCURRENT' &&
      a.type !== 'CONCURRENT_DUTY' &&
      a.type !== 'EXEMPTION'
    ) {
      activityPeriods += periods;
    }
  }

  // Nếu giáo viên có trường dữ liệu tiết dạy liên trường cố định
  if (teacher.interSchoolPeriods && Number(teacher.interSchoolPeriods) > 0) {
    const extraInter = Number(teacher.interSchoolPeriods);
    interSchoolPeriods += extraInter;
    morningPeriods += extraInter;
  }

  // 2. Thu thập và khử trùng lặp TUYỆT ĐỐI các chức vụ kiêm nhiệm / miễn giảm
  // Khóa nhận diện chuẩn tắc (Canonical key): nếu đã có 'Tổ trưởng' thì không lặp lại định nghĩa con thừa ('Tổ trưởng Ngoại ngữ', 'TTCM',...)
  const seenDutyMap = new Map<
    string,
    {
      canonicalKey: string;
      rawName: string;
      abbrName: string;
      periods: number;
      isExempt: boolean;
      assignment?: TeachingAssignment;
    }
  >();

  // A. Quét từ assignments (CONCURRENT, CONCURRENT_DUTY, EXEMPTION, hoặc có dutyId/dutyName)
  const dutyAssignments = teacherAssignments.filter(
    (a) =>
      a.type === 'CONCURRENT_DUTY' ||
      a.type === 'CONCURRENT' ||
      a.type === 'EXEMPTION' ||
      Boolean(a.dutyId) ||
      Boolean(a.dutyName)
  );

  dutyAssignments.forEach((ca) => {
    const isExemptType = ca.type === 'EXEMPTION';
    const matchedDuty = ca.dutyId
      ? duties.find((d) => d.id === ca.dutyId || d.code === ca.dutyId)
      : duties.find((d) => {
          const caName = (ca.dutyName || '').toLowerCase().trim();
          const dName = d.name.toLowerCase().trim();
          return caName.includes(dName) || dName.includes(caName);
        });

    let p = 0;
    if (matchedDuty) {
      p = isExemptType
        ? (matchedDuty.periodsPerWeekExempted ?? matchedDuty.periodsPerWeekCalculated ?? 0)
        : (matchedDuty.periodsPerWeekCalculated ?? matchedDuty.periodsPerWeekExempted ?? 0);
    }
    if (p === 0 && (ca.periodsPerWeek || 0) > 0) {
      p = ca.periodsPerWeek || 0;
    }

    let rawName = ca.dutyName || matchedDuty?.name || (isExemptType ? 'Miễn giảm' : 'Kiêm nhiệm');
    const pMatch =
      rawName.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) ||
      rawName.match(/\((\d+)[^)]*\)/i) ||
      rawName.match(/(\d+)\s*(?:tiết|t)\b/i);
    if (pMatch && p === 0) {
      p = parseInt(pMatch[1], 10);
    }
    rawName = rawName.replace(/\s*\([^)]*\)/gi, '').trim();

    const isConMon =
      rawName.toLowerCase().includes('con mọn') ||
      rawName.toLowerCase().includes('con nhỏ') ||
      rawName.toLowerCase().includes('nuôi con');
    if (isConMon && p === 0) {
      p = 2; // Chế độ con mọn tiêu chuẩn 2 tiết/tuần
    }

    const isExempt =
      isExemptType ||
      matchedDuty?.type === 'EXEMPTION' ||
      rawName.toLowerCase().includes('miễn') ||
      rawName.toLowerCase().includes('sinh') ||
      isConMon;

    const abbrName = abbreviateDutyName(rawName, customRules);
    const canonKey = getCanonicalDutyKey(abbrName || rawName || ca.dutyId || matchedDuty?.id);

    if (seenDutyMap.has(canonKey)) {
      // Đã tồn tại chức vụ chính (ví dụ đã có Tổ trưởng) -> Cập nhật số tiết mới nhất nếu lớn hơn
      const existing = seenDutyMap.get(canonKey)!;
      if (p > existing.periods) {
        existing.periods = p;
      }
      if (
        abbrName === 'TT' ||
        abbrName === 'TP' ||
        abbrName === 'CN' ||
        (abbrName.length < existing.abbrName.length && abbrName.length > 0)
      ) {
        existing.abbrName = abbrName;
      }
    } else {
      seenDutyMap.set(canonKey, {
        canonicalKey: canonKey,
        rawName,
        abbrName,
        periods: p,
        isExempt,
        assignment: ca,
      });
    }
  });

  // B. Quét từ teacher.positions (nếu chưa có trong assignments thì bổ sung, nếu đã có thì cập nhật số tiết mới nhất)
  if (teacher.positions && teacher.positions.length > 0) {
    teacher.positions.forEach((pos) => {
      const pMatch =
        pos.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) ||
        pos.match(/\((\d+)[^)]*\)/i) ||
        pos.match(/(\d+)\s*(?:tiết|t)\b/i);
      let pFromPos = pMatch ? parseInt(pMatch[1], 10) : 0;
      let cleanPos = pos.replace(/\s*\([^)]*\)/gi, '').trim();
      const abbrPos = abbreviateDutyName(cleanPos, customRules);
      const canonKey = getCanonicalDutyKey(abbrPos || cleanPos);

      const matchedDuty = duties.find(
        (d) =>
          d.name.toLowerCase() === pos.toLowerCase() ||
          d.name.toLowerCase() === cleanPos.toLowerCase() ||
          cleanPos.toLowerCase().includes(d.name.toLowerCase()) ||
          d.name.toLowerCase().includes(cleanPos.toLowerCase())
      );

      let p = matchedDuty
        ? (matchedDuty.periodsPerWeekCalculated || matchedDuty.periodsPerWeekExempted || 0)
        : pFromPos;

      if (pFromPos > 0) {
        p = pFromPos;
      }
      if (p === 0 && pFromPos > 0) {
        p = pFromPos;
      }

      const isConMon =
        pos.toLowerCase().includes('con mọn') ||
        pos.toLowerCase().includes('con nhỏ') ||
        cleanPos.toLowerCase().includes('con mọn') ||
        cleanPos.toLowerCase().includes('con nhỏ') ||
        pos.toLowerCase().includes('nuôi con') ||
        cleanPos.toLowerCase().includes('nuôi con');

      if (p === 0 && isConMon) {
        p = 2; // Chế độ con mọn giảm 2 tiết/tuần
      }

      const isExempt =
        matchedDuty?.type === 'EXEMPTION' ||
        pos.toLowerCase().includes('miễn') ||
        pos.toLowerCase().includes('sinh') ||
        cleanPos.toLowerCase().includes('miễn') ||
        cleanPos.toLowerCase().includes('sinh') ||
        isConMon;

      // Nếu đã có chức vụ này -> Đồng bộ cập nhật số tiết mới nhất
      if (seenDutyMap.has(canonKey)) {
        const existing = seenDutyMap.get(canonKey)!;
        if (p > existing.periods) {
          existing.periods = p;
        }
        return;
      }

      seenDutyMap.set(canonKey, {
        canonicalKey: canonKey,
        rawName: cleanPos,
        abbrName: abbrPos,
        periods: p,
        isExempt,
      });
    });
  }

  // B2. Bổ sung chế độ con mọn hoặc miễn giảm nếu có ghi chú trong teacher.notes
  if (teacher.notes && !seenDutyMap.has('con_mon')) {
    const n = teacher.notes.toLowerCase();
    if (n.includes('con mọn') || n.includes('con nhỏ') || n.includes('nuôi con')) {
      const pMatch = teacher.notes.match(/\((\d+)\s*(?:tiết|t)\b/i) || teacher.notes.match(/(\d+)\s*(?:tiết|t)\b/i);
      const p = pMatch ? parseInt(pMatch[1], 10) : 2;
      seenDutyMap.set('con_mon', {
        canonicalKey: 'con_mon',
        rawName: 'Con mọn (nuôi con nhỏ)',
        abbrName: 'Con mọn',
        periods: p,
        isExempt: true,
      });
    }
  }

  // C. Tính tổng số tiết kiêm nhiệm và miễn giảm từ danh sách chức vụ duy nhất đã khử trùng lặp
  seenDutyMap.forEach((duty) => {
    if (duty.isExempt) {
      exemptionPeriods += duty.periods;
    } else {
      concurrentPeriods += duty.periods;
    }
  });

  // 3. Định mức chuẩn của giáo viên (Configurable, ưu tiên định mức đã gán, mặc định 19)
  const quota =
    teacher.standardQuota !== undefined &&
    teacher.standardQuota !== null &&
    !isNaN(Number(teacher.standardQuota))
      ? Number(teacher.standardQuota)
      : 19;

  // 4. Kiểm tra chế độ miễn giảm tự động theo trạng thái giáo viên (Nghỉ sinh, Hiệu trưởng, Phó hiệu trưởng)
  if (teacher.status === 'MATERNITY' && exemptionPeriods === 0) {
    exemptionPeriods = quota;
  } else if (teacher.status === 'PRINCIPAL' && exemptionPeriods === 0) {
    exemptionPeriods = Math.max(0, quota - 2);
  } else if (teacher.status === 'VICE_PRINCIPAL' && exemptionPeriods === 0) {
    exemptionPeriods = Math.max(0, quota - 4);
  }

  // 5. Section VI Formulas:
  // Tổng phân công thực tế = Buổi 1 + Buổi 2 + Hoạt động/Khác + Kiêm nhiệm
  const actualTotalAssigned = morningPeriods + afternoonPeriods + activityPeriods + concurrentPeriods;

  // Tổng được tính = Tổng phân công thực tế + Tiết miễn/giảm
  const totalCalculated = actualTotalAssigned + exemptionPeriods;

  // Chênh lệch = Tổng được tính - Định mức
  const difference = totalCalculated - quota;

  // Kết quả
  let resultStatus: ResultStatus = 'UNASSIGNED';
  let deficitAmount = 0;
  let surplusAmount = 0;

  if (actualTotalAssigned === 0 && exemptionPeriods === 0) {
    resultStatus = 'UNASSIGNED';
    deficitAmount = quota;
  } else if (teacher.status === 'MATERNITY' || (actualTotalAssigned === 0 && exemptionPeriods >= quota)) {
    resultStatus = 'EXACT_EXEMPT';
  } else if (difference === 0) {
    resultStatus = 'EXACT';
  } else if (difference < 0) {
    resultStatus = 'DEFICIT';
    deficitAmount = Math.abs(difference);
  } else {
    resultStatus = 'SURPLUS';
    surplusAmount = difference;
  }

  const dept = departmentMap.get(teacher.departmentId);
  const departmentName = dept ? (dept.fullName || dept.name) : 'Chưa phân tổ';

  const statusLabels: Record<string, string> = {
    ACTIVE: 'Đang công tác',
    PRINCIPAL: 'Hiệu trưởng',
    VICE_PRINCIPAL: 'Phó hiệu trưởng',
    MATERNITY: 'Nghỉ sinh',
    SICK_LEAVE: 'Nghỉ ốm dài hạn',
    SECONDMENT: 'Biệt phái',
    UNPAID_LEAVE: 'Nghỉ không lương',
    SUSPENDED: 'Tạm nghỉ',
    TRANSFERRED: 'Chuyển công tác',
    CUSTOM: teacher.statusLabel || 'Khác',
  };

  // 6. Xây dựng danh sách hiển thị các dòng chức vụ đã khử trùng lặp cho cột Chức vụ của báo cáo
  const formatDutyPeriodsStr = (p: number, isExempt: boolean = false) => {
    if (p <= 0) return '';
    const raw = isExempt
      ? `(miễn ${p} tiết/tuần = ${p * semesterWeeks} tiết)`
      : `(${p} tiết/tuần = ${p * semesterWeeks} tiết)`;
    return applyAbbreviationRules(raw, customRules);
  };

  const dutyLines: string[] = [];
  seenDutyMap.forEach((duty) => {
    const periodStr = duty.periods > 0 ? formatDutyPeriodsStr(duty.periods, duty.isExempt) : '';
    const fullLine = periodStr ? `${duty.abbrName} ${periodStr}` : duty.abbrName;
    dutyLines.push(fullLine);
  });

  if (exemptionPeriods > 0) {
    const hasExemptLine = dutyLines.some(
      (l) =>
        l.toLowerCase().includes('miễn') ||
        l.toLowerCase().includes('sinh') ||
        l.toLowerCase().includes('con nhỏ') ||
        l.toLowerCase().includes('ốm')
    );
    if (!hasExemptLine) {
      let exemptLabel = 'Miễn giảm';
      if (teacher.status === 'MATERNITY') exemptLabel = 'Nghỉ sinh';
      else if (teacher.status === 'VICE_PRINCIPAL') exemptLabel = 'PHT';
      else if (teacher.status === 'PRINCIPAL') exemptLabel = 'HTr';
      else if (teacher.status === 'SICK_LEAVE') exemptLabel = 'Nghỉ ốm';
      else if (teacher.status === 'UNPAID_LEAVE') exemptLabel = 'Nghỉ K.Lương';

      const periodStr = formatDutyPeriodsStr(exemptionPeriods, true);
      dutyLines.push(periodStr ? `${exemptLabel} ${periodStr}` : exemptLabel);
    }
  }

  const dutyText = dutyLines.length > 0 ? dutyLines.join('\n') : '-';

  return {
    teacherId: teacher.id,
    teacherCode: teacher.code,
    teacherName: teacher.fullName,
    departmentId: teacher.departmentId,
    departmentName,
    status: teacher.status,
    statusLabel: statusLabels[teacher.status] || teacher.status,
    morningPeriods,
    afternoonPeriods,
    interSchoolPeriods,
    activityPeriods,
    concurrentPeriods,
    exemptionPeriods,
    actualTotalAssigned,
    totalCalculated,
    quota,
    standardQuota: quota,
    difference,
    resultStatus,
    deficitAmount,
    surplusAmount,
    assignments: teacherAssignments,
    notes: teacher.notes,
    dutyLines,
    dutyText,
  };
}

/**
 * Calculates workload metrics for all teachers
 */
export function calculateAllTeachersWorkload(
  teachers: Teacher[],
  assignments: TeachingAssignment[],
  duties: SpecialDuty[],
  departments: Department[],
  semesterWeeks: number = 18,
  customRules?: AbbreviationRule[]
): TeacherCalculationResult[] {
  const departmentMap = new Map<string, Department>();
  departments.forEach((d) => departmentMap.set(d.id, d));

  return teachers
    .filter((t) => !t.isDeleted)
    .map((teacher) =>
      calculateTeacherWorkload(teacher, assignments, duties, departmentMap, semesterWeeks, customRules)
    );
}

/**
 * Returns summary statistics for workload calculation
 */
export interface WorkloadSummaryStats {
  totalTeachers: number;
  totalActiveTeachers: number;
  totalPeriodsAssigned: number;
  totalMorningPeriods: number;
  totalAfternoonPeriods: number;
  totalActivityPeriods: number;
  totalConcurrentPeriods: number;
  totalExemptionPeriods: number;
  totalCalculatedPeriods: number;
  exactCount: number;
  exactExemptCount: number;
  deficitCount: number;
  surplusCount: number;
  unassignedCount: number;
  totalDeficitPeriods: number;
  totalSurplusPeriods: number;
  completionRate: number;
}

export function computeWorkloadSummaryStats(
  results: TeacherCalculationResult[]
): WorkloadSummaryStats {
  let totalPeriodsAssigned = 0;
  let totalMorningPeriods = 0;
  let totalAfternoonPeriods = 0;
  let totalActivityPeriods = 0;
  let totalConcurrentPeriods = 0;
  let totalExemptionPeriods = 0;
  let totalCalculatedPeriods = 0;
  let exactCount = 0;
  let exactExemptCount = 0;
  let deficitCount = 0;
  let surplusCount = 0;
  let unassignedCount = 0;
  let totalDeficitPeriods = 0;
  let totalSurplusPeriods = 0;

  const totalTeachers = results.length;
  const totalActiveTeachers = results.filter(
    (r) => r.status !== 'MATERNITY' && r.status !== 'SICK_LEAVE' && r.status !== 'UNPAID_LEAVE'
  ).length;

  for (const r of results) {
    totalPeriodsAssigned += r.actualTotalAssigned;
    totalMorningPeriods += r.morningPeriods;
    totalAfternoonPeriods += r.afternoonPeriods;
    totalActivityPeriods += r.activityPeriods;
    totalConcurrentPeriods += r.concurrentPeriods;
    totalExemptionPeriods += r.exemptionPeriods;
    totalCalculatedPeriods += r.totalCalculated;

    if (r.resultStatus === 'EXACT') exactCount++;
    else if (r.resultStatus === 'EXACT_EXEMPT') exactExemptCount++;
    else if (r.resultStatus === 'DEFICIT') {
      deficitCount++;
      totalDeficitPeriods += r.deficitAmount;
    } else if (r.resultStatus === 'SURPLUS') {
      surplusCount++;
      totalSurplusPeriods += r.surplusAmount;
    } else if (r.resultStatus === 'UNASSIGNED') {
      unassignedCount++;
    }
  }

  const qualifiedCount = exactCount + exactExemptCount;
  const completionRate = totalTeachers > 0 ? Math.round((qualifiedCount / totalTeachers) * 100) : 0;

  return {
    totalTeachers,
    totalActiveTeachers,
    totalPeriodsAssigned,
    totalMorningPeriods,
    totalAfternoonPeriods,
    totalActivityPeriods,
    totalConcurrentPeriods,
    totalExemptionPeriods,
    totalCalculatedPeriods,
    exactCount,
    exactExemptCount,
    deficitCount,
    surplusCount,
    unassignedCount,
    totalDeficitPeriods,
    totalSurplusPeriods,
    completionRate,
  };
}
