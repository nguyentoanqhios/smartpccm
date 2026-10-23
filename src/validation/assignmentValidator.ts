/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Validation & Error Checking Engine: Rules from Section V & XV
 */

import {
  SchoolClass,
  Subject,
  Teacher,
  CurriculumDistribution,
  TeachingAssignment,
  AssignmentConflict,
  ClassSubjectCheckResult,
  TeacherCalculationResult,
  SemesterId,
} from '../types';

export interface ValidationOutput {
  conflicts: AssignmentConflict[];
  classSubjectChecks: ClassSubjectCheckResult[];
  criticalErrorsCount: number;
  warningsCount: number;
  infoCount: number;
  isValidForApproval: boolean;
}

/**
 * Validates a single proposed assignment before saving
 */
export function validateProposedAssignment(params: {
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  periodsPerWeek: number;
  existingAssignments: TeachingAssignment[];
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  curriculums: CurriculumDistribution[];
}): { isValid: boolean; error?: string; warning?: string } {
  const {
    schoolYearId,
    semesterId,
    versionId,
    teacherId,
    subjectId,
    classId,
    existingAssignments,
    teachers,
    subjects,
    classes,
    curriculums,
  } = params;

  const subject = subjects.find((s) => s.id === subjectId || s.code === subjectId);
  const schoolClass = classes.find((c) => c.id === classId || c.code === classId);
  const teacher = teachers.find((t) => t.id === teacherId);

  if (!subject || !schoolClass) {
    return { isValid: false, error: 'Thông tin môn học hoặc lớp học không hợp lệ.' };
  }

  // Find curriculum distribution
  const curr = curriculums.find(
    (c) =>
      c.schoolYearId === schoolYearId &&
      c.semesterId === semesterId &&
      c.grade === schoolClass.grade &&
      (c.subjectId === subject.id || c.subjectId === subject.code)
  );

  const standardPeriods = curr ? curr.periodsPerWeek : 0;

  // Filter existing active assignments for same schoolYear, semester, version, class, subject
  const currentClassSubjectAssignments = existingAssignments.filter(
    (a) =>
      !a.isDeleted &&
      a.schoolYearId === schoolYearId &&
      a.semesterId === semesterId &&
      a.versionId === versionId &&
      (a.classId === schoolClass.id || a.classId === schoolClass.code) &&
      (a.subjectId === subject.id || a.subjectId === subject.code)
  );

  // 1. Conflict Check: Same class, subject, non-integrated subject already assigned to another teacher
  if (!subject.allowsMultipleTeachers && !subject.isIntegrated) {
    const existingOther = currentClassSubjectAssignments.find(
      (a) => a.teacherId !== teacherId
    );
    if (existingOther) {
      const otherTeacher = teachers.find((t) => t.id === existingOther.teacherId);
      const otherName = otherTeacher ? otherTeacher.fullName : 'Giáo viên khác';
      return {
        isValid: false,
        error: `Lớp ${schoolClass.code} – môn ${subject.name} đã được phân công cho ${otherName}. Không thể lưu nếu chưa xác nhận điều chỉnh.`,
      };
    }
  }

  // 2. Integrated Subject check: total periods should not exceed curriculum
  if (subject.isIntegrated || subject.allowsMultipleTeachers) {
    const otherPeriods = currentClassSubjectAssignments
      .filter((a) => a.teacherId !== teacherId)
      .reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0);
    const proposedTotal = otherPeriods + params.periodsPerWeek;
    if (standardPeriods > 0 && proposedTotal > standardPeriods) {
      return {
        isValid: true, // Allow but warn
        warning: `Tổng số tiết phân công (${proposedTotal} tiết) sẽ vượt khung chuẩn (${standardPeriods} tiết) của lớp ${schoolClass.code} môn ${subject.name}.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Runs complete system validation for the entire school year, semester, and version
 */
export function runFullValidation(params: {
  schoolYearId: string;
  semesterId: SemesterId;
  versionId: string;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  curriculums: CurriculumDistribution[];
  assignments: TeachingAssignment[];
  teacherCalculations: TeacherCalculationResult[];
}): ValidationOutput {
  const {
    schoolYearId,
    semesterId,
    versionId,
    teachers,
    classes,
    subjects,
    curriculums,
    assignments,
    teacherCalculations,
  } = params;

  const conflicts: AssignmentConflict[] = [];
  const classSubjectChecks: ClassSubjectCheckResult[] = [];

  const activeClasses = classes.filter((c) => !c.isDeleted && c.active);
  const activeSubjects = subjects.filter((s) => s.active);
  const activeAssignments = assignments.filter(
    (a) =>
      !a.isDeleted &&
      a.schoolYearId === schoolYearId &&
      a.semesterId === semesterId &&
      a.versionId === versionId
  );

  // Map for fast teacher lookup
  const teacherMap = new Map<string, Teacher>();
  teachers.forEach((t) => teacherMap.set(t.id, t));

  // Map for fast subject lookup
  const subjectMap = new Map<string, Subject>();
  subjects.forEach((s) => {
    subjectMap.set(s.id, s);
    subjectMap.set(s.code, s);
  });

  // Map for fast class lookup
  const classMap = new Map<string, SchoolClass>();
  classes.forEach((c) => {
    classMap.set(c.id, c);
    classMap.set(c.code, c);
  });

  // Check 1: Curriculum check for all class x applicable subjects
  for (const schoolClass of activeClasses) {
    const applicableSubjects = activeSubjects.filter((s) =>
      s.applicableGrades.includes(schoolClass.grade)
    );

    for (const subject of applicableSubjects) {
      // Find curriculum
      const curr = curriculums.find(
        (c) =>
          c.schoolYearId === schoolYearId &&
          c.semesterId === semesterId &&
          c.grade === schoolClass.grade &&
          (c.subjectId === subject.id || c.subjectId === subject.code)
      );

      const standardPeriodsPerWeek = curr ? curr.periodsPerWeek : 0;
      const weeks = curr ? curr.weeks : 18;
      const standardTotalPeriods = standardPeriodsPerWeek * weeks;

      // Find assignments for this class & subject
      const matchingAssignments = activeAssignments.filter(
        (a) =>
          a.type === 'TEACHING' &&
          (a.classId === schoolClass.id || a.classId === schoolClass.code) &&
          (a.subjectId === subject.id || a.subjectId === subject.code)
      );

      const assignedTeachers = matchingAssignments.map((a) => {
        const t = teacherMap.get(a.teacherId);
        return {
          teacherId: a.teacherId,
          teacherName: t ? t.fullName : 'Chưa rõ',
          periodsPerWeek: a.periodsPerWeek || 0,
          assignmentId: a.id,
        };
      });

      const assignedPeriodsPerWeek = assignedTeachers.reduce(
        (sum, item) => sum + item.periodsPerWeek,
        0
      );
      const assignedTotalPeriods = assignedPeriodsPerWeek * weeks;
      const difference = assignedPeriodsPerWeek - standardPeriodsPerWeek;

      let status: ClassSubjectCheckResult['status'] = 'OK';
      let errorMessage: string | undefined;

      // Duplicate check for non-integrated subject
      const distinctTeachers = new Set(assignedTeachers.map((t) => t.teacherId));
      if (!subject.allowsMultipleTeachers && !subject.isIntegrated && distinctTeachers.size > 1) {
        status = 'DUPLICATE';
        const teacherNames = assignedTeachers.map((t) => t.teacherName).join(', ');
        errorMessage = `Trùng phân công: ${teacherNames} cùng được phân công lớp ${schoolClass.code} môn ${subject.name}`;

        conflicts.push({
          id: `conflict_dup_${schoolClass.id}_${subject.id}`,
          severity: 'CRITICAL',
          type: 'DUPLICATE_ASSIGNMENT',
          title: `Trùng phân công môn ${subject.name} - ${schoolClass.code}`,
          message: `Lớp ${schoolClass.code} – môn ${subject.name} đã được phân công cho nhiều giáo viên (${teacherNames}).`,
          targetType: 'ASSIGNMENT',
          relatedIds: matchingAssignments.map((a) => a.id),
          suggestedAction: 'Điều chỉnh lại để chỉ 1 giáo viên giảng dạy môn này.',
        });
      } else if (assignedPeriodsPerWeek === 0 && standardPeriodsPerWeek > 0) {
        status = 'UNASSIGNED';
        conflicts.push({
          id: `conflict_unassigned_${schoolClass.id}_${subject.id}`,
          severity: 'INFO',
          type: 'UNASSIGNED_CLASS_SUBJECT',
          title: `Chưa phân công môn ${subject.name} - ${schoolClass.code}`,
          message: `Lớp ${schoolClass.code} chưa có giáo viên dạy môn ${subject.name} (cần ${standardPeriodsPerWeek} tiết/tuần).`,
          targetType: 'CLASS',
          targetId: schoolClass.id,
          suggestedAction: 'Thêm phân công cho môn học này.',
        });
      } else if (difference < 0) {
        status = 'DEFICIT';
        const deficitAmt = Math.abs(difference);
        conflicts.push({
          id: `conflict_deficit_${schoolClass.id}_${subject.id}`,
          severity: subject.isIntegrated ? 'CRITICAL' : 'WARNING',
          type: 'CLASS_SUBJECT_DEFICIT',
          title: `Thiếu tiết môn ${subject.name} - ${schoolClass.code}`,
          message: `Lớp ${schoolClass.code} môn ${subject.name} đang thiếu ${deficitAmt} tiết/tuần (đã phân ${assignedPeriodsPerWeek}/${standardPeriodsPerWeek} tiết).`,
          targetType: 'CLASS',
          targetId: schoolClass.id,
          suggestedAction: 'Phân công thêm số tiết còn thiếu.',
        });
      } else if (difference > 0) {
        status = 'SURPLUS';
        conflicts.push({
          id: `conflict_surplus_${schoolClass.id}_${subject.id}`,
          severity: 'CRITICAL',
          type: 'CLASS_SUBJECT_SURPLUS',
          title: `Thừa tiết môn ${subject.name} - ${schoolClass.code}`,
          message: `Lớp ${schoolClass.code} môn ${subject.name} đang thừa ${difference} tiết/tuần (đã phân ${assignedPeriodsPerWeek}/${standardPeriodsPerWeek} tiết).`,
          targetType: 'CLASS',
          targetId: schoolClass.id,
          suggestedAction: 'Giảm bớt số tiết đã phân công.',
        });
      }

      // Check integrated subject exact total
      if (subject.isIntegrated && assignedPeriodsPerWeek > 0 && assignedPeriodsPerWeek !== standardPeriodsPerWeek) {
        conflicts.push({
          id: `conflict_integrated_${schoolClass.id}_${subject.id}`,
          severity: 'CRITICAL',
          type: 'INTEGRATED_MISMATCH',
          title: `Môn tích hợp ${subject.name} - ${schoolClass.code} chưa khớp khung`,
          message: `Môn tích hợp ${subject.name} lớp ${schoolClass.code} có tổng ${assignedPeriodsPerWeek} tiết/tuần, khung quy định là ${standardPeriodsPerWeek} tiết/tuần.`,
          targetType: 'SUBJECT',
          targetId: subject.id,
          suggestedAction: `Cân đối phân công các phân môn sao cho tổng đúng ${standardPeriodsPerWeek} tiết.`,
        });
      }

      classSubjectChecks.push({
        classId: schoolClass.id,
        className: schoolClass.name,
        grade: schoolClass.grade,
        subjectId: subject.id,
        subjectName: subject.name,
        standardPeriodsPerWeek,
        standardTotalPeriods,
        assignedPeriodsPerWeek,
        assignedTotalPeriods,
        difference,
        status,
        isIntegrated: subject.isIntegrated,
        assignedTeachers,
        errorMessage,
      });
    }
  }

  // Check 2: Teacher quota checks
  for (const calc of teacherCalculations) {
    if (calc.resultStatus === 'DEFICIT') {
      conflicts.push({
        id: `conflict_teacher_def_${calc.teacherId}`,
        severity: 'WARNING',
        type: 'TEACHER_DEFICIT',
        title: `Giáo viên ${calc.teacherName} thiếu định mức`,
        message: `Thầy/Cô ${calc.teacherName} (${calc.departmentName}) thiếu ${calc.deficitAmount} tiết/tuần (${calc.totalCalculated}/${calc.quota} tiết).`,
        targetType: 'TEACHER',
        targetId: calc.teacherId,
        suggestedAction: 'Phân công thêm giờ dạy hoặc nhiệm vụ kiêm nhiệm.',
      });
    } else if (calc.resultStatus === 'SURPLUS') {
      const isHighSurplus = calc.surplusAmount >= 6;
      conflicts.push({
        id: `conflict_teacher_sur_${calc.teacherId}`,
        severity: isHighSurplus ? 'WARNING' : 'INFO',
        type: 'TEACHER_SURPLUS',
        title: `Giáo viên ${calc.teacherName} thừa định mức`,
        message: `Thầy/Cô ${calc.teacherName} (${calc.departmentName}) vượt ${calc.surplusAmount} tiết/tuần (${calc.totalCalculated}/${calc.quota} tiết).`,
        targetType: 'TEACHER',
        targetId: calc.teacherId,
        suggestedAction: 'Xem xét phân tải bớt cho giáo viên khác.',
      });
    }
  }

  const criticalErrorsCount = conflicts.filter((c) => c.severity === 'CRITICAL').length;
  const warningsCount = conflicts.filter((c) => c.severity === 'WARNING').length;
  const infoCount = conflicts.filter((c) => c.severity === 'INFO').length;

  const isValidForApproval = criticalErrorsCount === 0;

  return {
    conflicts,
    classSubjectChecks,
    criticalErrorsCount,
    warningsCount,
    infoCount,
    isValidForApproval,
  };
}
