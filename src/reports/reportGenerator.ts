/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * 15 Specialized Reports & Analytics Engine (Section VIII)
 */

import {
  Teacher,
  SchoolClass,
  Subject,
  Department,
  SpecialDuty,
  TeachingAssignment,
  TeacherCalculationResult,
  ClassSubjectCheckResult,
  AuditLog,
  CurriculumDistribution,
} from '../types';
import { dataStore } from '../repositories/dataStore';

export interface ReportItemSummary {
  id: string;
  name: string;
  secondaryName?: string;
  group?: string;
  grade?: number;
  count: number;
  morningPeriods: number;
  afternoonPeriods: number;
  fullDayPeriods?: number;
  activityPeriods: number;
  concurrentPeriods: number;
  exemptionPeriods: number;
  totalPeriods: number;
  quota?: number;
  difference?: number;
  statusLabel?: string;
  statusColor?: string;
  details?: any[];
}

export function generateReportByDepartment(
  departments: Department[],
  calculations: TeacherCalculationResult[],
  multiplier: number = 1
): ReportItemSummary[] {
  return departments.map((d) => {
    const deptTeachers = calculations.filter(
      (c) => c.departmentId === d.id || c.departmentName === d.name || (d.fullName && c.departmentName === d.fullName)
    );
    const count = deptTeachers.length;
    const morningPeriods = deptTeachers.reduce((s, t) => s + (t.morningPeriods || 0), 0) * multiplier;
    const afternoonPeriods = deptTeachers.reduce((s, t) => s + (t.afternoonPeriods || 0), 0) * multiplier;
    const activityPeriods = deptTeachers.reduce((s, t) => s + (t.activityPeriods || 0), 0) * multiplier;
    const concurrentPeriods = deptTeachers.reduce((s, t) => s + (t.concurrentPeriods || 0), 0) * multiplier;
    const exemptionPeriods = deptTeachers.reduce((s, t) => s + (t.exemptionPeriods || 0), 0) * multiplier;
    const totalPeriods = deptTeachers.reduce((s, t) => s + (t.totalCalculated || 0), 0) * multiplier;
    const totalQuota = deptTeachers.reduce((s, t) => s + (t.quota || 0), 0) * multiplier;
    const difference = totalPeriods - totalQuota;

    return {
      id: d.id,
      name: d.name || d.fullName,
      secondaryName: d.code,
      count,
      morningPeriods,
      afternoonPeriods,
      activityPeriods,
      concurrentPeriods,
      exemptionPeriods,
      totalPeriods,
      quota: totalQuota,
      difference,
      details: deptTeachers,
    };
  });
}

export function generateReportByClass(
  classes: SchoolClass[],
  assignments: TeachingAssignment[],
  subjects: Subject[],
  teachers: Teacher[],
  multiplier: number = 1
): ReportItemSummary[] {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  return classes.map((c) => {
    const classAssignments = assignments.filter((a) => !a.isDeleted && (a.classId === c.id || a.classId === c.code));
    const totalPeriods = classAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;
    const morningPeriods = classAssignments
      .filter((a) => a.session === 'MORNING')
      .reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;
    const afternoonPeriods = classAssignments
      .filter((a) => a.session === 'AFTERNOON')
      .reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;
    const fullDayPeriods = classAssignments
      .filter((a) => a.session === 'FULL_DAY' || a.session === 'TWO_SESSIONS_PER_DAY')
      .reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;

    const subjectOrderMap = new Map(subjects.map((s, idx) => [s.id, idx]));
    const details = classAssignments.map((a) => {
      const s = subjectMap.get(a.subjectId || '');
      const t = teacherMap.get(a.teacherId);
      return {
        subjectId: a.subjectId,
        subjectName: s ? s.name : 'N/A',
        teacherName: t ? t.fullName : 'N/A',
        periodsPerWeek: (a.periodsPerWeek || 0) * multiplier,
        session: a.session,
      };
    });

    details.sort((a, b) => {
      const orderA = subjectOrderMap.get(a.subjectId || '') ?? 999;
      const orderB = subjectOrderMap.get(b.subjectId || '') ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const sessionText =
      c.session === 'MORNING'
        ? 'Buổi sáng'
        : c.session === 'AFTERNOON'
        ? 'Buổi chiều'
        : '2 buổi/ngày';

    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      secondaryName: `Khối ${c.grade} | Sĩ số: ${c.studentCount} HS | ${sessionText}`,
      group: `Khối ${c.grade}`,
      count: classAssignments.length,
      morningPeriods,
      afternoonPeriods,
      fullDayPeriods,
      activityPeriods: 0,
      concurrentPeriods: 0,
      exemptionPeriods: 0,
      totalPeriods,
      details,
    };
  });
}

export function generateReportBySubjectGrade(
  subjects: Subject[],
  curriculum: CurriculumDistribution[],
  assignments: TeachingAssignment[],
  classes: SchoolClass[],
  multiplier: number = 1
): any[] {
  const grades = [6, 7, 8, 9];
  const results: any[] = [];

  subjects.forEach((subj) => {
    const row: any = {
      subjectId: subj.id,
      subjectName: subj.name,
      shortName: subj.shortName,
      group: subj.group,
      grades: {} as Record<number, { required: number; assigned: number; classesCount: number }>,
      totalRequired: 0,
      totalAssigned: 0,
    };

    grades.forEach((g) => {
      const curr = curriculum.find((c) => c.grade === g && (c.subjectId === subj.id || c.subjectId === subj.code));
      const gradeClasses = classes.filter((c) => c.grade === g && !c.isDeleted);
      const standardPerWeek = curr ? curr.periodsPerWeek : 0;
      const required = standardPerWeek * gradeClasses.length * multiplier;

      // Sum assigned periods
      const gradeAssignments = assignments.filter((a) => {
        if (a.isDeleted || a.type !== 'TEACHING') return false;
        if (a.subjectId !== subj.id && a.subjectId !== subj.code) return false;
        const cls = classes.find((c) => c.id === a.classId || c.code === a.classId);
        return cls && cls.grade === g;
      });

      const assigned = gradeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;

      row.grades[g] = {
        required,
        assigned,
        classesCount: gradeClasses.length,
      };

      row.totalRequired += required;
      row.totalAssigned += assigned;
    });

    results.push(row);
  });

  return results;
}

export function generateReportByDuties(
  duties: SpecialDuty[],
  assignments: TeachingAssignment[],
  teachers: Teacher[],
  multiplier: number = 1
): ReportItemSummary[] {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const dutyResults: ReportItemSummary[] = duties.map((d) => {
    const dutyAssignments = assignments.filter((a) => !a.isDeleted && (a.dutyId === d.id || a.dutyId === d.code));
    const assignedTeacherIds = new Set(dutyAssignments.map((a) => a.teacherId));

    const teachersAssigned: Array<{ teacherName: string; periodsPerWeek: number; classOrScope: string }> = dutyAssignments.map((a) => {
      const t = teacherMap.get(a.teacherId);
      const weeklyPeriods = a.periodsPerWeek || (d.type === 'EXEMPTION' ? d.periodsPerWeekExempted : d.periodsPerWeekCalculated) || 0;
      return {
        teacherName: t ? t.fullName : 'N/A',
        periodsPerWeek: weeklyPeriods * multiplier,
        classOrScope: a.classId || 'Toàn trường',
      };
    });

    // Check if this duty corresponds to automatic status exemptions and include teachers with that status
    const isMaternityDuty = d.id === 'duty_nghi_sinh' || d.code === 'NGHI_SINH' || d.code === 'THAI_SAN' || (d.type === 'EXEMPTION' && d.name.toLowerCase().includes('sinh'));
    const isPrincipalDuty = d.id === 'duty_hieu_truong' || d.code === 'HIEU_TRUONG' || (d.type === 'EXEMPTION' && d.name.toLowerCase().includes('hiệu trưởng') && !d.name.toLowerCase().includes('phó'));
    const isVicePrincipalDuty = d.id === 'duty_pho_hieu_truong' || d.code === 'PHO_HIEU_TRUONG' || (d.type === 'EXEMPTION' && d.name.toLowerCase().includes('phó hiệu trưởng'));

    if (isMaternityDuty) {
      teachers.forEach((t) => {
        if (t.status === 'MATERNITY' && !assignedTeacherIds.has(t.id)) {
          const quota = t.standardQuota || (t.workplace === 'Phân hiệu' ? 18 : 19);
          const weeklyPeriods = d.periodsPerWeekExempted || quota;
          teachersAssigned.push({
            teacherName: t.fullName,
            periodsPerWeek: weeklyPeriods * multiplier,
            classOrScope: 'Nghỉ chế độ thai sản',
          });
          assignedTeacherIds.add(t.id);
        }
      });
    } else if (isPrincipalDuty) {
      teachers.forEach((t) => {
        if (t.status === 'PRINCIPAL' && !assignedTeacherIds.has(t.id)) {
          const quota = t.standardQuota || 19;
          const weeklyPeriods = d.periodsPerWeekExempted || Math.max(0, quota - 2);
          teachersAssigned.push({
            teacherName: t.fullName,
            periodsPerWeek: weeklyPeriods * multiplier,
            classOrScope: 'Ban Giám Hiệu',
          });
          assignedTeacherIds.add(t.id);
        }
      });
    } else if (isVicePrincipalDuty) {
      teachers.forEach((t) => {
        if (t.status === 'VICE_PRINCIPAL' && !assignedTeacherIds.has(t.id)) {
          const quota = t.standardQuota || 19;
          const weeklyPeriods = d.periodsPerWeekExempted || Math.max(0, quota - 4);
          teachersAssigned.push({
            teacherName: t.fullName,
            periodsPerWeek: weeklyPeriods * multiplier,
            classOrScope: 'Ban Giám Hiệu',
          });
          assignedTeacherIds.add(t.id);
        }
      });
    }

    const totalPeriods = teachersAssigned.reduce((s, it) => s + it.periodsPerWeek, 0);

    return {
      id: d.id,
      name: d.name,
      secondaryName: d.type === 'EXEMPTION' ? `Miễn giảm (${d.periodsPerWeekExempted || (totalPeriods > 0 && teachersAssigned.length > 0 ? Math.round(totalPeriods / (teachersAssigned.length * multiplier)) : 0)} tiết/tuần)` : `Kiêm nhiệm (${d.periodsPerWeekCalculated} tiết/tuần)`,
      group: d.type === 'EXEMPTION' ? 'Miễn giảm' : 'Kiêm nhiệm',
      count: teachersAssigned.length,
      morningPeriods: 0,
      afternoonPeriods: 0,
      activityPeriods: 0,
      concurrentPeriods: d.type === 'CONCURRENT' ? totalPeriods : 0,
      exemptionPeriods: d.type === 'EXEMPTION' ? totalPeriods : 0,
      totalPeriods,
      details: teachersAssigned,
    };
  });

  // Also include standalone/custom assignments with type === 'EXEMPTION' not tied to any known duty
  const dutyIdSet = new Set(duties.map((d) => d.id).concat(duties.map((d) => d.code)));
  const unmappedExemptions = assignments.filter((a) => !a.isDeleted && a.type === 'EXEMPTION' && (!a.dutyId || !dutyIdSet.has(a.dutyId)));

  if (unmappedExemptions.length > 0) {
    const groupedCustom = new Map<string, typeof unmappedExemptions>();
    unmappedExemptions.forEach((a) => {
      const key = a.dutyName || 'Miễn giảm khác';
      if (!groupedCustom.has(key)) groupedCustom.set(key, []);
      groupedCustom.get(key)!.push(a);
    });

    groupedCustom.forEach((items, name) => {
      const details = items.map((a) => {
        const t = teacherMap.get(a.teacherId);
        return {
          teacherName: t ? t.fullName : 'N/A',
          periodsPerWeek: (a.periodsPerWeek || 0) * multiplier,
          classOrScope: a.classId || 'Toàn trường',
        };
      });
      const totalPeriods = details.reduce((s, it) => s + it.periodsPerWeek, 0);
      dutyResults.push({
        id: `custom_exempt_${name}`,
        name,
        secondaryName: `Miễn giảm đặc thù`,
        group: 'Miễn giảm',
        count: items.length,
        morningPeriods: 0,
        afternoonPeriods: 0,
        activityPeriods: 0,
        concurrentPeriods: 0,
        exemptionPeriods: totalPeriods,
        totalPeriods,
        details,
      });
    });
  }

  return dutyResults;
}

export function generateReportBySubject(
  subjects: Subject[],
  curriculum: CurriculumDistribution[],
  assignments: TeachingAssignment[],
  classes: SchoolClass[],
  teachers: Teacher[],
  multiplier: number = 1
) {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const activeClasses = classes.filter((c) => !c.isDeleted);

  return subjects.map((subj) => {
    // Standard required periods across all classes of applicable grades
    let rawTotalRequired = 0;
    const applicableGrades = subj.applicableGrades || [6, 7, 8, 9];

    applicableGrades.forEach((g) => {
      const curr = curriculum.find((c) => c.grade === g && (c.subjectId === subj.id || c.subjectId === subj.code));
      const gradeClasses = activeClasses.filter((c) => c.grade === g);
      const perWeek = curr ? curr.periodsPerWeek : 0;
      rawTotalRequired += perWeek * gradeClasses.length;
    });

    // Assignments for this subject
    const subjAssignments = assignments.filter(
      (a) => !a.isDeleted && a.type === 'TEACHING' && (a.subjectId === subj.id || a.subjectId === subj.code)
    );

    const rawTotalAssigned = subjAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
    const assignedClasses = new Set(subjAssignments.map((a) => a.classId)).size;

    const totalRequired = rawTotalRequired * multiplier;
    const totalAssigned = rawTotalAssigned * multiplier;

    // Group teachers
    const teacherStatsMap = new Map<string, { teacherName: string; teacherCode: string; periods: number; classCount: number }>();
    subjAssignments.forEach((a) => {
      const t = teacherMap.get(a.teacherId);
      const name = t ? t.fullName : 'N/A';
      const code = t ? t.code : 'N/A';
      const prev = teacherStatsMap.get(a.teacherId) || { teacherName: name, teacherCode: code, periods: 0, classCount: 0 };
      prev.periods += (a.periodsPerWeek || 0) * multiplier;
      prev.classCount += 1;
      teacherStatsMap.set(a.teacherId, prev);
    });

    const diff = totalAssigned - totalRequired;
    let status: 'OK' | 'DEFICIT' | 'SURPLUS' = 'OK';
    if (diff < 0) status = 'DEFICIT';
    else if (diff > 0) status = 'SURPLUS';

    return {
      subjectId: subj.id,
      code: subj.code,
      name: subj.name,
      shortName: subj.shortName,
      group: subj.group,
      applicableGrades,
      assignedClasses,
      totalRequired,
      totalAssigned,
      difference: diff,
      status,
      teachers: Array.from(teacherStatsMap.values()),
    };
  });
}

export function generateReportBySession(
  classes: SchoolClass[],
  assignments: TeachingAssignment[],
  teachers: Teacher[],
  multiplier: number = 1
) {
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const activeClasses = classes.filter((c) => !c.isDeleted);
  const classMap = new Map(activeClasses.map((c) => [c.id, c]));
  const deptMap = new Map(dataStore.getDepartments().map((d) => [d.id, d.name || d.fullName]));

  // Pre-calculate session breakdown per teacher
  const teacherSessionStats = new Map<
    string,
    {
      morningPeriods: number;
      afternoonPeriods: number;
      fullDayPeriods: number;
      activityPeriods: number;
      morningAssignments: TeachingAssignment[];
      afternoonAssignments: TeachingAssignment[];
      fullDayAssignments: TeachingAssignment[];
      activityAssignments: TeachingAssignment[];
      morningClasses: Set<string>;
      afternoonClasses: Set<string>;
    }
  >();

  teachers.forEach((t) => {
    teacherSessionStats.set(t.id, {
      morningPeriods: 0,
      afternoonPeriods: 0,
      fullDayPeriods: 0,
      activityPeriods: 0,
      morningAssignments: [],
      afternoonAssignments: [],
      fullDayAssignments: [],
      activityAssignments: [],
      morningClasses: new Set<string>(),
      afternoonClasses: new Set<string>(),
    });
  });

  assignments.forEach((a) => {
    if (a.isDeleted || !a.teacherId) return;
    const stat = teacherSessionStats.get(a.teacherId);
    if (!stat) return;

    const p = (a.periodsPerWeek || 0) * multiplier;
    const c = a.classId ? classMap.get(a.classId) : null;
    const sess = a.session || (c ? c.session : 'ACTIVITY');

    if (sess === 'MORNING') {
      stat.morningPeriods += p;
      stat.morningAssignments.push(a);
      if (c) stat.morningClasses.add(c.name);
    } else if (sess === 'AFTERNOON') {
      stat.afternoonPeriods += p;
      stat.afternoonAssignments.push(a);
      if (c) stat.afternoonClasses.add(c.name);
    } else if (sess === 'FULL_DAY' || sess === 'TWO_SESSIONS_PER_DAY') {
      stat.fullDayPeriods += p;
      stat.fullDayAssignments.push(a);
      if (c) {
        stat.morningClasses.add(c.name);
        stat.afternoonClasses.add(c.name);
      }
    } else {
      stat.activityPeriods += p;
      stat.activityAssignments.push(a);
    }
  });

  const sessionConfigs = [
    {
      key: 'MORNING',
      name: 'Buổi 1 (Ca Sáng)',
      desc: 'Các lớp học chính khóa buổi sáng (Khối 6, 7)',
    },
    {
      key: 'AFTERNOON',
      name: 'Buổi 2 (Ca Chiều)',
      desc: 'Các lớp học chính khóa buổi chiều (Khối 8, 9)',
    },
    {
      key: 'FULL_DAY',
      name: '2 buổi / ngày (Cả ngày)',
      desc: 'Các lớp học 2 buổi/ngày hoặc Giáo viên tham gia giảng dạy cả 2 ca sáng & chiều',
    },
    {
      key: 'ACTIVITY',
      name: 'Hoạt động & Kiêm nhiệm',
      desc: 'Hoạt động trải nghiệm, GDĐP & các nhiệm vụ kiêm nhiệm phân công chung',
    },
  ];

  return sessionConfigs.map((cfg) => {
    let sessionClasses: SchoolClass[] = [];
    let sessionAssignments: TeachingAssignment[] = [];
    interface TeacherSessionItem {
      id: string;
      code: string;
      fullName: string;
      departmentName?: string;
      workplace?: string;
      periods: number;
      morningPeriods: number;
      afternoonPeriods: number;
      classNames: string[];
      notes?: string;
      assignmentDetails: Array<{
        title: string;
        className: string;
        periods: number;
        session: string;
      }>;
    }
    const sessionTeacherList: TeacherSessionItem[] = [];

    if (cfg.key === 'MORNING') {
      sessionClasses = activeClasses.filter((c) => c.session === 'MORNING');
      sessionAssignments = assignments.filter((a) => !a.isDeleted && a.session === 'MORNING');

      // Teachers with morning assignments
      teachers.forEach((t) => {
        const stat = teacherSessionStats.get(t.id);
        if (stat && stat.morningPeriods > 0) {
          sessionTeacherList.push({
            id: t.id,
            code: t.code,
            fullName: t.fullName,
            departmentName: (t.departmentId ? deptMap.get(t.departmentId) : '') || 'Chưa xếp tổ',
            workplace: t.workplace,
            periods: stat.morningPeriods,
            morningPeriods: stat.morningPeriods,
            afternoonPeriods: 0,
            classNames: Array.from(stat.morningClasses),
            assignmentDetails: stat.morningAssignments.map((a) => ({
              title: a.subjectId || a.dutyName || 'Tiết dạy',
              className: a.classId ? classMap.get(a.classId)?.name || a.classId : 'Toàn trường',
              periods: (a.periodsPerWeek || 0) * multiplier,
              session: 'Sáng',
            })),
          });
        }
      });
    } else if (cfg.key === 'AFTERNOON') {
      sessionClasses = activeClasses.filter((c) => c.session === 'AFTERNOON');
      sessionAssignments = assignments.filter((a) => !a.isDeleted && a.session === 'AFTERNOON');

      // Teachers with afternoon assignments
      teachers.forEach((t) => {
        const stat = teacherSessionStats.get(t.id);
        if (stat && stat.afternoonPeriods > 0) {
          sessionTeacherList.push({
            id: t.id,
            code: t.code,
            fullName: t.fullName,
            departmentName: (t.departmentId ? deptMap.get(t.departmentId) : '') || 'Chưa xếp tổ',
            workplace: t.workplace,
            periods: stat.afternoonPeriods,
            morningPeriods: 0,
            afternoonPeriods: stat.afternoonPeriods,
            classNames: Array.from(stat.afternoonClasses),
            assignmentDetails: stat.afternoonAssignments.map((a) => ({
              title: a.subjectId || a.dutyName || 'Tiết dạy',
              className: a.classId ? classMap.get(a.classId)?.name || a.classId : 'Toàn trường',
              periods: (a.periodsPerWeek || 0) * multiplier,
              session: 'Chiều',
            })),
          });
        }
      });
    } else if (cfg.key === 'FULL_DAY') {
      const directClasses = activeClasses.filter(
        (c) => c.session === 'FULL_DAY' || c.session === 'TWO_SESSIONS_PER_DAY'
      );
      const directAssignments = assignments.filter(
        (a) => !a.isDeleted && (a.session === 'FULL_DAY' || a.session === 'TWO_SESSIONS_PER_DAY')
      );

      // Find teachers who either have direct full-day assignments OR teach BOTH morning & afternoon
      const fullDayTeacherIds = new Set<string>();
      directAssignments.forEach((a) => fullDayTeacherIds.add(a.teacherId));

      teachers.forEach((t) => {
        const stat = teacherSessionStats.get(t.id);
        if (stat && ((stat.morningPeriods > 0 && stat.afternoonPeriods > 0) || stat.fullDayPeriods > 0)) {
          fullDayTeacherIds.add(t.id);
        }
      });

      const fullDayClassesSet = new Set<string>();
      directClasses.forEach((c) => fullDayClassesSet.add(c.id));

      fullDayTeacherIds.forEach((tId) => {
        const t = teacherMap.get(tId);
        if (!t) return;
        const stat = teacherSessionStats.get(tId);
        if (!stat) return;

        const allClasses = Array.from(
          new Set([...Array.from(stat.morningClasses), ...Array.from(stat.afternoonClasses)])
        );
        const tAssignments = [
          ...stat.morningAssignments,
          ...stat.afternoonAssignments,
          ...stat.fullDayAssignments,
        ];

        tAssignments.forEach((a) => {
          if (a.classId) fullDayClassesSet.add(a.classId);
        });

        sessionAssignments.push(...tAssignments);

        sessionTeacherList.push({
          id: t.id,
          code: t.code,
          fullName: t.fullName,
          departmentName: (t.departmentId ? deptMap.get(t.departmentId) : '') || 'Chưa xếp tổ',
          workplace: t.workplace,
          periods: stat.morningPeriods + stat.afternoonPeriods + stat.fullDayPeriods,
          morningPeriods: stat.morningPeriods,
          afternoonPeriods: stat.afternoonPeriods,
          classNames: allClasses,
          notes:
            stat.morningPeriods > 0 && stat.afternoonPeriods > 0
              ? `Dạy cả 2 buổi: Sáng ${stat.morningPeriods}t + Chiều ${stat.afternoonPeriods}t`
              : 'Dạy lớp 2 buổi/ngày',
          assignmentDetails: tAssignments.map((a) => {
            const c = a.classId ? classMap.get(a.classId) : null;
            const sName = a.session === 'MORNING' ? 'Sáng' : a.session === 'AFTERNOON' ? 'Chiều' : 'Cả ngày';
            return {
              title: a.subjectId || a.dutyName || 'Tiết dạy',
              className: c ? c.name : 'Toàn trường',
              periods: (a.periodsPerWeek || 0) * multiplier,
              session: sName,
            };
          }),
        });
      });

      sessionClasses = Array.from(fullDayClassesSet)
        .map((cId) => classMap.get(cId))
        .filter((c): c is SchoolClass => !!c);
    } else {
      sessionAssignments = assignments.filter((a) => !a.isDeleted && a.session === 'ACTIVITY');
      teachers.forEach((t) => {
        const stat = teacherSessionStats.get(t.id);
        if (stat && stat.activityPeriods > 0) {
          sessionTeacherList.push({
            id: t.id,
            code: t.code,
            fullName: t.fullName,
            departmentName: (t.departmentId ? deptMap.get(t.departmentId) : '') || 'Chưa xếp tổ',
            workplace: t.workplace,
            periods: stat.activityPeriods,
            morningPeriods: 0,
            afternoonPeriods: 0,
            classNames: ['Hoạt động & Kiêm nhiệm'],
            assignmentDetails: stat.activityAssignments.map((a) => ({
              title: a.dutyName || a.subjectId || 'Nhiệm vụ',
              className: a.classId ? classMap.get(a.classId)?.name || a.classId : 'Toàn trường',
              periods: (a.periodsPerWeek || 0) * multiplier,
              session: 'Hoạt động',
            })),
          });
        }
      });
    }

    const totalStudents = sessionClasses.reduce((s, c) => s + (c.studentCount || 0), 0);
    const totalPeriods = sessionTeacherList.reduce((s, t) => s + t.periods, 0);

    return {
      sessionKey: cfg.key,
      sessionName: cfg.name,
      description: cfg.desc,
      classesCount: sessionClasses.length,
      classes: sessionClasses,
      totalStudents,
      assignmentsCount: sessionAssignments.length,
      totalPeriods,
      teacherCount: sessionTeacherList.length,
      teacherNames: sessionTeacherList.map((t) => t.fullName),
      teachers: sessionTeacherList,
    };
  });
}

export function generateReportByGrade(
  classes: SchoolClass[],
  assignments: TeachingAssignment[],
  curriculum: CurriculumDistribution[],
  subjects: Subject[],
  multiplier: number = 1
) {
  const grades = [6, 7, 8, 9];
  const activeClasses = classes.filter((c) => !c.isDeleted);

  return grades.map((grade) => {
    const gradeClasses = activeClasses.filter((c) => c.grade === grade);
    const studentCount = gradeClasses.reduce((s, c) => s + (c.studentCount || 0), 0);

    // Standard required periods for this grade
    const gradeCurriculums = curriculum.filter((curr) => curr.grade === grade);
    const standardPerWeekPerClass = gradeCurriculums.reduce((s, curr) => s + (curr.periodsPerWeek || 0), 0) * multiplier;
    const totalRequiredPeriods = standardPerWeekPerClass * gradeClasses.length;

    // Assigned periods for this grade
    const gradeAssignments = assignments.filter((a) => {
      if (a.isDeleted || a.type !== 'TEACHING') return false;
      const cls = classes.find((c) => c.id === a.classId || c.code === a.classId);
      return cls && cls.grade === grade;
    });

    const totalAssignedPeriods = gradeAssignments.reduce((s, a) => s + (a.periodsPerWeek || 0), 0) * multiplier;
    const completionRate = totalRequiredPeriods > 0 ? Math.round((totalAssignedPeriods / totalRequiredPeriods) * 100) : 100;

    return {
      grade,
      gradeName: `Khối ${grade}`,
      classesCount: gradeClasses.length,
      classesList: gradeClasses.map((c) => c.name).join(', '),
      studentCount,
      standardPerWeekPerClass,
      totalRequiredPeriods,
      totalAssignedPeriods,
      difference: totalAssignedPeriods - totalRequiredPeriods,
      completionRate,
      assignmentsCount: gradeAssignments.length,
    };
  });
}

export function generateReportTeacherStructure(
  teachers: Teacher[],
  departments: Department[],
  calculations: TeacherCalculationResult[],
  multiplier: number = 1
) {
  return departments.map((dept) => {
    const deptTeachers = teachers.filter((t) => !t.isDeleted && t.departmentId === dept.id);
    const deptCalcs = calculations.filter(
      (c) => c.departmentId === dept.id || c.departmentName === dept.name || (dept.fullName && c.departmentName === dept.fullName)
    );

    const fulltimeCount = deptTeachers.filter((t) => t.status === 'ACTIVE' || !t.status || t.status === 'PRINCIPAL' || t.status === 'VICE_PRINCIPAL').length;
    const contractCount = deptTeachers.filter((t) => t.status && t.status !== 'ACTIVE' && t.status !== 'PRINCIPAL' && t.status !== 'VICE_PRINCIPAL').length;

    const exactCount = deptCalcs.filter((c) => c.resultStatus === 'EXACT' || c.resultStatus === 'EXACT_EXEMPT').length;
    const surplusCount = deptCalcs.filter((c) => c.resultStatus === 'SURPLUS').length;
    const deficitCount = deptCalcs.filter((c) => c.resultStatus === 'DEFICIT').length;

    const totalCalculated = deptCalcs.reduce((s, c) => s + (c.totalCalculated || 0), 0) * multiplier;
    const totalQuota = deptCalcs.reduce((s, c) => s + (c.quota || 0), 0) * multiplier;
    const completionRate = totalQuota > 0 ? Math.round((totalCalculated / totalQuota) * 100) : 100;

    // Group majors
    const majors = Array.from(
      new Set(deptTeachers.map((t) => t.major).filter((m): m is string => Boolean(m && m.trim())))
    ).join(', ') || 'Đa ngành';

    return {
      departmentId: dept.id,
      departmentName: dept.name || dept.fullName,
      departmentCode: dept.code,
      totalTeachers: deptTeachers.length,
      fulltimeCount,
      contractCount,
      exactCount,
      surplusCount,
      deficitCount,
      totalCalculated,
      totalQuota,
      completionRate,
      majors,
    };
  });
}
