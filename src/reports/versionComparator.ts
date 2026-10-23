/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Multi-dimensional Version Comparator (Section VIII)
 */

import { TeachingAssignment, TeacherCalculationResult, Teacher, Subject, SchoolClass } from '../types';

export interface VersionDiffResult {
  sourceVersionName: string;
  targetVersionName: string;
  addedAssignments: TeachingAssignment[];
  removedAssignments: TeachingAssignment[];
  modifiedAssignments: {
    before: TeachingAssignment;
    after: TeachingAssignment;
    changes: string[];
  }[];
  teacherWorkloadDiff: {
    teacherId: string;
    teacherName: string;
    departmentName: string;
    beforeTotal: number;
    afterTotal: number;
    delta: number;
    beforeStatus: string;
    afterStatus: string;
  }[];
  totalPeriodsBefore: number;
  totalPeriodsAfter: number;
  deltaPeriods: number;
  changeRate: number; // percentage
}

export function compareAssignmentVersions(params: {
  sourceVersionName: string;
  targetVersionName: string;
  sourceAssignments: TeachingAssignment[];
  targetAssignments: TeachingAssignment[];
  sourceCalculations: TeacherCalculationResult[];
  targetCalculations: TeacherCalculationResult[];
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
}): VersionDiffResult {
  const {
    sourceVersionName,
    targetVersionName,
    sourceAssignments,
    targetAssignments,
    sourceCalculations,
    targetCalculations,
    teachers,
  } = params;

  const sourceActive = sourceAssignments.filter((a) => !a.isDeleted);
  const targetActive = targetAssignments.filter((a) => !a.isDeleted);

  const totalPeriodsBefore = sourceActive.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
  const totalPeriodsAfter = targetActive.reduce((s, a) => s + (a.periodsPerWeek || 0), 0);
  const deltaPeriods = totalPeriodsAfter - totalPeriodsBefore;
  const changeRate = totalPeriodsBefore > 0 ? Math.round(((totalPeriodsAfter - totalPeriodsBefore) / totalPeriodsBefore) * 100) : 0;

  // Map key generator: teacherId + subjectId + classId + type + dutyId
  const makeKey = (a: TeachingAssignment) =>
    `${a.teacherId}_${a.subjectId || ''}_${a.classId || ''}_${a.type}_${a.dutyId || ''}_${a.session}`;

  const sourceMap = new Map<string, TeachingAssignment>();
  sourceActive.forEach((a) => sourceMap.set(makeKey(a), a));

  const targetMap = new Map<string, TeachingAssignment>();
  targetActive.forEach((a) => targetMap.set(makeKey(a), a));

  const addedAssignments: TeachingAssignment[] = [];
  const removedAssignments: TeachingAssignment[] = [];
  const modifiedAssignments: { before: TeachingAssignment; after: TeachingAssignment; changes: string[] }[] = [];

  // Check added & modified
  targetActive.forEach((t) => {
    const key = makeKey(t);
    const s = sourceMap.get(key);
    if (!s) {
      addedAssignments.push(t);
    } else if (s.periodsPerWeek !== t.periodsPerWeek || s.weeks !== t.weeks) {
      const changes: string[] = [];
      if (s.periodsPerWeek !== t.periodsPerWeek) {
        changes.push(`Số tiết/tuần: ${s.periodsPerWeek} -> ${t.periodsPerWeek}`);
      }
      if (s.weeks !== t.weeks) {
        changes.push(`Số tuần: ${s.weeks} -> ${t.weeks}`);
      }
      modifiedAssignments.push({ before: s, after: t, changes });
    }
  });

  // Check removed
  sourceActive.forEach((s) => {
    const key = makeKey(s);
    if (!targetMap.has(key)) {
      removedAssignments.push(s);
    }
  });

  // Teacher Workload Diff
  const teacherWorkloadDiff = teachers
    .filter((t) => !t.isDeleted)
    .map((t) => {
      const before = sourceCalculations.find((c) => c.teacherId === t.id);
      const after = targetCalculations.find((c) => c.teacherId === t.id);

      const beforeTotal = before ? before.totalCalculated : 0;
      const afterTotal = after ? after.totalCalculated : 0;
      const delta = afterTotal - beforeTotal;

      return {
        teacherId: t.id,
        teacherName: t.fullName,
        departmentName: before?.departmentName || after?.departmentName || 'Chưa rõ',
        beforeTotal,
        afterTotal,
        delta,
        beforeStatus: before?.resultStatus || 'UNASSIGNED',
        afterStatus: after?.resultStatus || 'UNASSIGNED',
      };
    })
    .filter((d) => d.beforeTotal > 0 || d.afterTotal > 0);

  return {
    sourceVersionName,
    targetVersionName,
    addedAssignments,
    removedAssignments,
    modifiedAssignments,
    teacherWorkloadDiff,
    totalPeriodsBefore,
    totalPeriodsAfter,
    deltaPeriods,
    changeRate,
  };
}
