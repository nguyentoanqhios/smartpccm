/**
 * Phân công chuyên môn thông minh
 * Excel Import / Export Service powered by ExcelJS
 */

import ExcelJS from 'exceljs';
import {
  Teacher,
  SchoolClass,
  Subject,
  TeachingAssignment,
  TeacherCalculationResult,
  SpecialDuty,
  Department,
  SchoolInfo,
} from '../types';
import { dataStore } from '../repositories/dataStore';
import {
  abbreviateDutyName,
  applyAbbreviationRules,
  groupTeachingAssignmentsBySubject,
  cleanSchoolYear,
  getCanonicalDutyKey,
} from '../utils/abbreviationUtils';

export interface ExportWorkloadExcelParams {
  schoolYear: string;
  semesterName: string;
  versionName: string;
  exporterName: string;
  schoolInfo?: SchoolInfo;
  teachers: Teacher[];
  calculations: TeacherCalculationResult[];
  assignments: TeachingAssignment[];
  classes: SchoolClass[];
  subjects: Subject[];
  duties: SpecialDuty[];
  departments: Department[];
  branchScopeName?: string;
  departmentScopeName?: string;
  timeCycleName?: string;
  periodMultiplier?: number;
}

/**
 * MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến bảo vệ sở hữu trí tuệ
 */
export function applyLicenseWatermarkAndMetadata(workbook: ExcelJS.Workbook, fallbackSchoolName: string = 'TRƯỜNG THCS') {
  const activeLicense = dataStore.getCurrentSchoolLicense();
  const school = dataStore.getSchoolInfo();
  const guaranteedSchoolName = (activeLicense?.schoolName || school.schoolName || fallbackSchoolName).trim().toUpperCase();
  const schoolId = activeLicense?.id || dataStore.getSchoolId() || 'school_thongke';

  workbook.creator = `${guaranteedSchoolName} - Hệ thống Phân công chuyên môn`;
  workbook.lastModifiedBy = guaranteedSchoolName;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = `Bảng Phân công Chuyên môn - ${guaranteedSchoolName}`;
  workbook.subject = `Bảng Phân công Chuyên môn - ${guaranteedSchoolName}`;
  workbook.company = guaranteedSchoolName;
  workbook.manager = guaranteedSchoolName;
  workbook.description = `Phần mềm Phân công Chuyên môn. Độc quyền sử dụng: ${guaranteedSchoolName}. Mã đơn vị: ${schoolId}.`;

  workbook.eachSheet((sheet) => {
    sheet.addRow([]);
    const wmRow = sheet.addRow([
      `🔒 ĐƠN VỊ SỬ DỤNG: ${guaranteedSchoolName} • Mã đơn vị: ${schoolId}`,
    ]);
    wmRow.font = { name: 'Arial', size: 9, italic: true, bold: true, color: { argb: '64748B' } };
    wmRow.alignment = { horizontal: 'left', vertical: 'middle' };
  });
}

export async function exportWorkloadExcel(params: ExportWorkloadExcelParams): Promise<void> {
  const {
    schoolYear,
    semesterName,
    versionName,
    exporterName,
    schoolInfo: providedSchoolInfo,
    teachers,
    calculations,
    assignments,
    classes,
    subjects,
    departments,
    branchScopeName,
    departmentScopeName,
    timeCycleName,
    periodMultiplier,
  } = params;

  const school = providedSchoolInfo || dataStore.getSchoolInfo();
  const branches = dataStore.getBranches(true);
  let branchText = branchScopeName;
  if (!branchText) {
    if (branches.length > 1) {
      branchText = `Toàn trường (${branches.length} điểm trường: ${branches.map((b) => b.name).join(', ')})`;
    } else if (branches.length === 1) {
      branchText = branches[0].name;
    } else {
      branchText = 'Toàn trường';
    }
  }

  const mult = periodMultiplier || 1;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${school.schoolName} - Hệ thống Phân công chuyên môn`;
  workbook.lastModifiedBy = exporterName;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color definitions
  const PRIMARY_COLOR = '1E3A8A'; // Deep Navy
  const TEAL_COLOR = '0F766E';    // Dark Teal
  const SLATE_COLOR = '334155';   // Slate Dark
  const WHITE_COLOR = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';

  const fullSchoolHeader = [
    school.authorityName ? school.authorityName.toUpperCase() : '',
    school.schoolName ? school.schoolName.toUpperCase() : 'TRƯỜNG THCS',
  ]
    .filter(Boolean)
    .join(' – ');

  // ---------------------------------------------------------------------------------
  // SHEET 1: BẢNG TỔNG HỢP ĐỊNH MỨC TIẾT DẠY
  // ---------------------------------------------------------------------------------
  const wsSummary = workbook.addWorksheet('Tổng hợp định mức', {
    views: [{ showGridLines: true }],
  });

  // Title block
  wsSummary.mergeCells('A1:O1');
  wsSummary.getCell('A1').value = fullSchoolHeader;
  wsSummary.getCell('A1').font = { name: 'Arial', size: 11, bold: true, color: { argb: '475569' } };
  wsSummary.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

  wsSummary.mergeCells('A2:O2');
  wsSummary.getCell('A2').value = `BẢNG TỔNG HỢP PHÂN CÔNG CHUYÊN MÔN & ĐỊNH MỨC TIẾT DẠY`;
  wsSummary.getCell('A2').font = { name: 'Arial', size: 15, bold: true, color: { argb: PRIMARY_COLOR } };
  wsSummary.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  wsSummary.mergeCells('A3:O3');
  const deptSubtitle = departmentScopeName ? ` | Tổ: ${departmentScopeName}` : '';
  wsSummary.getCell('A3').value = `Đơn vị: ${school.schoolName} | Cơ sở: ${branchText}${deptSubtitle} | Chu kỳ: ${timeCycleName || 'Theo tuần'} | Năm học: ${schoolYear || school.schoolYear} | ${semesterName} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`;
  wsSummary.getCell('A3').font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
  wsSummary.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

  // Headers (Row 5)
  const unitLabel = mult === 1 ? '(Tiết/tuần)' : timeCycleName ? `(${timeCycleName})` : `(x${mult})`;
  const summaryHeaders = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Tổ chuyên môn',
    'Trạng thái',
    `Buổi 1 ${unitLabel}`,
    `Buổi 2 ${unitLabel}`,
    `HĐ / Khác ${unitLabel}`,
    `Kiêm nhiệm ${unitLabel}`,
    `Miễn / Giảm ${unitLabel}`,
    `Tổng thực tế ${unitLabel}`,
    `Tổng tính ${unitLabel}`,
    `Định mức ${unitLabel}`,
    `Chênh lệch ${unitLabel}`,
    'Kết quả',
  ];

  const headerRow = wsSummary.addRow(summaryHeaders);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PRIMARY_COLOR },
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'medium', color: { argb: PRIMARY_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });

  // Data rows
  calculations.forEach((r, idx) => {
    const morning = (r.morningPeriods || 0) * mult;
    const afternoon = (r.afternoonPeriods || 0) * mult;
    const activity = (r.activityPeriods || 0) * mult;
    const concurrent = (r.concurrentPeriods || 0) * mult;
    const exemption = (r.exemptionPeriods || 0) * mult;
    const actualTotal = ((r.actualTotalAssigned ?? (r.morningPeriods + r.afternoonPeriods)) || 0) * mult;
    const calculatedTotal = (r.totalCalculated || 0) * mult;
    const quota = (r.quota || 0) * mult;
    const diff = calculatedTotal - quota;

    let resultText = 'ĐỦ';
    let resultBg = 'DCFCE7'; // Light Green
    let resultFg = '166534'; // Dark Green

    if (r.resultStatus === 'EXACT_EXEMPT') {
      resultText = 'ĐỦ (MIỄN)';
      resultBg = 'DBEAFE'; // Light Blue
      resultFg = '1E40AF';
    } else if (diff < 0) {
      resultText = `THIẾU ${Math.abs(diff)}`;
      resultBg = 'FEE2E2'; // Light Red
      resultFg = '991B1B';
    } else if (diff > 0) {
      resultText = `THỪA +${diff}`;
      resultBg = 'FFEDD5'; // Light Orange
      resultFg = '9A3412';
    } else if (r.resultStatus === 'UNASSIGNED') {
      resultText = 'CHƯA PHÂN CÔNG';
      resultBg = 'F1F5F9';
      resultFg = '475569';
    }

    const row = wsSummary.addRow([
      idx + 1,
      r.teacherCode,
      r.teacherName,
      r.departmentName,
      r.statusLabel,
      morning,
      afternoon,
      activity,
      concurrent,
      exemption,
      actualTotal,
      calculatedTotal,
      quota,
      diff > 0 ? `+${diff}` : diff,
      resultText,
    ]);

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 3 || colNumber === 4 ? 'left' : 'center',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };

      // Result Column styling
      if (colNumber === 15) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: resultBg },
        };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: resultFg } };
      }
    });
  });

  // Total Summary Row
  const lastRowNum = wsSummary.rowCount;
  const totalRow = wsSummary.addRow([
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    { formula: `SUM(F6:F${lastRowNum})` },
    { formula: `SUM(G6:G${lastRowNum})` },
    { formula: `SUM(H6:H${lastRowNum})` },
    { formula: `SUM(I6:I${lastRowNum})` },
    { formula: `SUM(J6:J${lastRowNum})` },
    { formula: `SUM(K6:K${lastRowNum})` },
    { formula: `SUM(L6:L${lastRowNum})` },
    { formula: `SUM(M6:M${lastRowNum})` },
    { formula: `SUM(N6:N${lastRowNum})` },
    '',
  ]);
  totalRow.height = 24;
  wsSummary.mergeCells(`A${lastRowNum + 1}:E${lastRowNum + 1}`);
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: PRIMARY_COLOR } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E2E8F0' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: PRIMARY_COLOR } },
      bottom: { style: 'double', color: { argb: PRIMARY_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });

  // Column widths
  wsSummary.columns = [
    { width: 6 },  // STT
    { width: 10 }, // Mã GV
    { width: 24 }, // Tên
    { width: 24 }, // Tổ
    { width: 16 }, // Trạng thái
    { width: 12 }, // Buổi 1
    { width: 12 }, // Buổi 2
    { width: 12 }, // HĐ
    { width: 12 }, // Kiêm nhiệm
    { width: 12 }, // Miễn giảm
    { width: 14 }, // Tổng thực tế
    { width: 14 }, // Tổng tính
    { width: 12 }, // Định mức
    { width: 12 }, // Chênh lệch
    { width: 18 }, // Kết quả
  ];

  wsSummary.autoFilter = {
    from: 'A5',
    to: `O${lastRowNum}`,
  };

  // ---------------------------------------------------------------------------------
  // SHEET 2: CHI TIẾT DÒNG PHÂN CÔNG
  // ---------------------------------------------------------------------------------
  const wsDetail = workbook.addWorksheet('Chi tiết phân công', {
    views: [{ showGridLines: true }],
  });
  wsDetail.mergeCells('A1:M1');
  wsDetail.getCell('A1').value = `${school.schoolName.toUpperCase()} - DANH SÁCH CHI TIẾT PHÂN CÔNG CHUYÊN MÔN (${schoolYear || school.schoolYear} - ${semesterName})`;
  wsDetail.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: PRIMARY_COLOR } };

  const detailHeaders = [
    'STT',
    'Mã GV',
    'Giáo viên',
    'Tổ chuyên môn',
    'Loại phân công',
    'Môn học / Nhiệm vụ',
    'Lớp / Phạm vi',
    'Buổi học',
    'Số tiết/tuần',
    'Số tuần',
    'Tổng số tiết',
    'Trạng thái',
    'Ghi chú',
  ];

  const detailHeaderRow = wsDetail.addRow(detailHeaders);
  detailHeaderRow.height = 26;
  detailHeaderRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: TEAL_COLOR },
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  const activeAssignments = assignments.filter((a) => !a.isDeleted);
  activeAssignments.forEach((a, idx) => {
    const t = teacherMap.get(a.teacherId);
    const c = a.classId ? classMap.get(a.classId) : undefined;
    const s = a.subjectId ? subjectMap.get(a.subjectId) : undefined;
    const d = a.departmentId ? deptMap.get(a.departmentId) : undefined;

    const targetName = a.dutyName || (s ? s.name : 'N/A');
    const scopeName = c ? c.name : a.classId || 'Toàn trường';
    const sessionName =
      a.session === 'MORNING'
        ? 'Buổi sáng'
        : a.session === 'AFTERNOON'
        ? 'Buổi chiều'
        : a.session === 'FULL_DAY' || (a.session as any) === 'TWO_SESSIONS_PER_DAY'
        ? '2 buổi/ngày'
        : 'Hoạt động';

    const r = wsDetail.addRow([
      idx + 1,
      t ? t.code : '',
      t ? t.fullName : 'N/A',
      d ? (d.fullName || d.name) : 'N/A',
      a.type === 'TEACHING' ? 'Giảng dạy' : a.type === 'CONCURRENT' ? 'Kiêm nhiệm' : 'Hoạt động/Khác',
      targetName,
      scopeName,
      sessionName,
      a.periodsPerWeek,
      a.weeks || 18,
      a.totalPeriods,
      a.status === 'approved' ? 'Đã duyệt' : 'Bản nháp',
      a.notes || '',
    ]);
    r.height = 20;
    r.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  });

  wsDetail.columns = [
    { width: 6 },  // STT
    { width: 10 }, // Mã GV
    { width: 22 }, // Giáo viên
    { width: 20 }, // Tổ CM
    { width: 16 }, // Loại
    { width: 24 }, // Môn/Nhiệm vụ
    { width: 16 }, // Lớp
    { width: 16 }, // Buổi
    { width: 14 }, // Tiết/tuần
    { width: 10 }, // Tuần
    { width: 14 }, // Tổng tiết
    { width: 14 }, // Trạng thái
    { width: 28 }, // Ghi chú
  ];
  wsDetail.autoFilter = {
    from: 'A2',
    to: `M${wsDetail.rowCount}`,
  };

  // ---------------------------------------------------------------------------------
  // SHEET 3: DANH SÁCH GIÁO VIÊN
  // ---------------------------------------------------------------------------------
  const wsTeachers = workbook.addWorksheet('Danh sách giáo viên', {
    views: [{ showGridLines: true }],
  });
  wsTeachers.mergeCells('A1:L1');
  wsTeachers.getCell('A1').value = `${school.schoolName.toUpperCase()} - DANH SÁCH GIÁO VIÊN (${schoolYear || school.schoolYear})`;
  wsTeachers.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: SLATE_COLOR } };

  const teacherHeaders = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Tổ chuyên môn',
    'Chuyên môn',
    'Định mức',
    'Môn dạy',
    'Trình độ',
    'Năm vào ngành',
    'Ngày nghỉ CM',
    'Điện thoại',
    'Email',
    'Trạng thái',
  ];

  const teacherHeaderRow = wsTeachers.addRow(teacherHeaders);
  teacherHeaderRow.height = 26;
  teacherHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_COLOR } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  teachers
    .filter((t) => !t.isDeleted)
    .forEach((t, i) => {
      const dept = deptMap.get(t.departmentId);
      const row = wsTeachers.addRow([
        i + 1,
        t.code,
        t.fullName,
        dept ? (dept.fullName || dept.name) : '',
        t.major || '',
        t.standardQuota || 19,
        t.subjectsCanTeach.map((id) => subjectMap.get(id)?.shortName || id).join(', '),
        t.initialDegree || '',
        t.startYear || '',
        t.offDay || '',
        t.phone || '',
        t.email || '',
        t.statusLabel || t.status,
      ]);
      row.height = 20;
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: BORDER_COLOR } },
          left: { style: 'thin', color: { argb: BORDER_COLOR } },
          bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
          right: { style: 'thin', color: { argb: BORDER_COLOR } },
        };
      });
    });

  wsTeachers.columns = [
    { width: 6 },
    { width: 10 },
    { width: 24 },
    { width: 22 },
    { width: 18 },
    { width: 12 },
    { width: 20 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 16 },
  ];
  wsTeachers.autoFilter = {
    from: 'A2',
    to: `M${wsTeachers.rowCount}`,
  };

  // ---------------------------------------------------------------------------------
  // SHEET 4: DANH SÁCH LỚP HỌC (CHUẨN ĐỂ NHẬP LIỆU & QUẢN LÝ)
  // ---------------------------------------------------------------------------------
  const wsClasses = workbook.addWorksheet('Danh sách lớp học', {
    views: [{ showGridLines: true }],
  });
  wsClasses.mergeCells('A1:H1');
  wsClasses.getCell('A1').value = `${school.schoolName.toUpperCase()} - DANH SÁCH LỚP HỌC VÀ PHÂN BỔ BUỔI (${schoolYear || school.schoolYear})`;
  wsClasses.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: PRIMARY_COLOR } };

  const classHeaders = [
    'STT',
    'Mã lớp',
    'Tên lớp',
    'Khối',
    'Sĩ số',
    'Buổi học',
    'Phòng học',
    'GV Chủ nhiệm',
  ];

  const classHeaderRow = wsClasses.addRow(classHeaders);
  classHeaderRow.height = 26;
  classHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } }; // Blue 800
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sortedClassesList = [...classes]
    .filter((c) => c.active !== false)
    .sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });

  sortedClassesList.forEach((c, idx) => {
    const homeroom = c.homeroomTeacherId ? teacherMap.get(c.homeroomTeacherId) : undefined;
    const sessionText =
      c.session === 'MORNING'
        ? 'Buổi sáng'
        : c.session === 'AFTERNOON'
        ? 'Buổi chiều'
        : '2 buổi/ngày';
    const row = wsClasses.addRow([
      idx + 1,
      c.code,
      c.name,
      c.grade,
      c.studentCount || 35,
      sessionText,
      c.room || `Phòng ${c.code}`,
      homeroom ? `${homeroom.fullName} (${homeroom.code})` : '',
    ]);
    row.height = 20;
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  });

  wsClasses.columns = [
    { width: 6 },  // STT
    { width: 12 }, // Mã lớp
    { width: 16 }, // Tên lớp
    { width: 10 }, // Khối
    { width: 12 }, // Sĩ số
    { width: 16 }, // Buổi học
    { width: 16 }, // Phòng học
    { width: 26 }, // GVCN
  ];
  wsClasses.autoFilter = {
    from: 'A2',
    to: `H${wsClasses.rowCount}`,
  };

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeSchoolName = (school.schoolName || 'Truong_THCS').replace(/[^\w\sÀ-ỹ]/gi, '').replace(/\s+/g, '_');
  const safeSemester = (semesterName || 'HK1').replace(/\s+/g, '_');
  const safeVersion = (versionName || 'Chinh_thuc').replace(/\s+/g, '_');
  anchor.download = `PCCM_${safeSchoolName}_${schoolYear || school.schoolYear}_${safeSemester}_${safeVersion}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Xuất file mẫu Excel chuẩn để nhập Giáo viên, Lớp học và Phân công
 */
export async function exportExcelTemplate(customSchoolInfo?: SchoolInfo): Promise<void> {
  const school = customSchoolInfo || dataStore.getSchoolInfo();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${school.schoolName} - Mẫu nhập liệu chuẩn`;
  workbook.created = new Date();
  workbook.modified = new Date();

  const PRIMARY_COLOR = '1E3A8A'; // Deep Navy
  const WHITE_COLOR = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';

  // 1. SHEET DỮ LIỆU GIÁO VIÊN
  const wsTeachers = workbook.addWorksheet('DỮ LIỆU GV', { views: [{ showGridLines: true }] });
  wsTeachers.mergeCells('A1:I1');
  wsTeachers.getCell('A1').value = `${school.schoolName.toUpperCase()} - MẪU NHẬP DANH SÁCH GIÁO VIÊN (Năm học: ${school.schoolYear})`;
  wsTeachers.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: PRIMARY_COLOR } };

  const teacherHeaders = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Tổ chuyên môn',
    'Chuyên môn',
    'Định mức tiết',
    'Môn dạy',
    'Số điện thoại',
    'Ghi chú',
  ];
  const tHeaderRow = wsTeachers.addRow(teacherHeaders);
  tHeaderRow.height = 26;
  tHeaderRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_COLOR } };
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sampleTeachers = [
    [1, 'GV001', 'Nguyễn Văn An', 'Tổ Tự nhiên', 'Toán', 19, 'Toán, Tin học', '0912345678', 'GVCN 6A1'],
    [2, 'GV002', 'Trần Thị Bích', 'Tổ Xã hội', 'Ngữ văn', 19, 'Ngữ văn, GDCD', '0912345679', 'Tổ trưởng'],
    [3, 'GV003', 'Lê Quang Cường', 'Tổ Ngoại ngữ', 'Tiếng Anh', 19, 'Tiếng Anh', '0912345680', ''],
    [4, 'GV004', 'Phạm Thị Duyên', 'Tổ Năng khiếu', 'GDTC', 19, 'GDTC, Nghệ thuật', '0912345681', ''],
  ];
  sampleTeachers.forEach((r) => {
    const row = wsTeachers.addRow(r);
    row.height = 20;
    row.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  });
  wsTeachers.columns = [
    { width: 6 },
    { width: 12 },
    { width: 24 },
    { width: 20 },
    { width: 18 },
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 24 },
  ];

  // 2. SHEET LỚP HỌC
  const wsClasses = workbook.addWorksheet('LỚP HỌC', { views: [{ showGridLines: true }] });
  wsClasses.mergeCells('A1:G1');
  wsClasses.getCell('A1').value = `${school.schoolName.toUpperCase()} - MẪU NHẬP DANH SÁCH LỚP HỌC (Năm học: ${school.schoolYear})`;
  wsClasses.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: '0F766E' } };

  const classHeaders = ['STT', 'Mã lớp', 'Tên lớp', 'Khối', 'Sĩ số', 'Buổi học', 'Phòng học'];
  const cHeaderRow = wsClasses.addRow(classHeaders);
  cHeaderRow.height = 26;
  cHeaderRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sampleClasses = [
    [1, '6A1', 'Lớp 6A1', 6, 38, 'Sáng', 'Phòng 601'],
    [2, '6A2', 'Lớp 6A2', 6, 38, 'Sáng', 'Phòng 602'],
    [3, '6A9', 'Lớp 6A9', 6, 37, 'Sáng', 'Phòng 609'],
    [4, '6A10', 'Lớp 6A10', 6, 37, 'Sáng', 'Phòng 610'],
    [5, '7A1', 'Lớp 7A1', 7, 36, 'Sáng', 'Phòng 701'],
    [6, '7A8', 'Lớp 7A8', 7, 35, 'Sáng', 'Phòng 708'],
    [7, '8A1', 'Lớp 8A1', 8, 35, 'Chiều', 'Phòng 801'],
    [8, '9A1', 'Lớp 9A1', 9, 34, 'Chiều', 'Phòng 901'],
  ];
  sampleClasses.forEach((r) => {
    const row = wsClasses.addRow(r);
    row.height = 20;
    row.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  });
  wsClasses.columns = [
    { width: 6 },
    { width: 12 },
    { width: 16 },
    { width: 10 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
  ];

  // 3. SHEET PHÂN CÔNG CHUYÊN MÔN
  const wsAssignments = workbook.addWorksheet('PHÂN CÔNG', { views: [{ showGridLines: true }] });
  wsAssignments.mergeCells('A1:H1');
  wsAssignments.getCell('A1').value = `${school.schoolName.toUpperCase()} - MẪU NHẬP BẢNG PHÂN CÔNG CHUYÊN MÔN`;
  wsAssignments.getCell('A1').font = { name: 'Arial', size: 12, bold: true, color: { argb: '7C2D12' } };

  const assignmentHeaders = [
    'STT',
    'Họ và tên GV',
    'Tổ chuyên môn',
    'Môn học / Nhiệm vụ',
    'Lớp / Phạm vi',
    'Buổi học',
    'Số tiết/tuần',
    'Ghi chú',
  ];
  const aHeaderRow = wsAssignments.addRow(assignmentHeaders);
  aHeaderRow.height = 26;
  aHeaderRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C2D12' } };
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE_COLOR } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sampleAssignments = [
    [1, 'Nguyễn Văn An', 'Tổ Tự nhiên', 'Toán', '6A1, 6A2', 'Sáng', 8, '4 tiết/lớp'],
    [2, 'Trần Thị Bích', 'Tổ Xã hội', 'Ngữ văn', '7A1', 'Sáng', 4, 'Dạy Văn 7A1'],
    [3, 'Trần Thị Bích', 'Tổ Xã hội', 'Tổ trưởng chuyên môn', 'Tổ Xã hội', 'Hoạt động', 3, 'Kiêm nhiệm'],
  ];
  sampleAssignments.forEach((r) => {
    const row = wsAssignments.addRow(r);
    row.height = 20;
    row.eachCell((c) => {
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  });
  wsAssignments.columns = [
    { width: 6 },
    { width: 22 },
    { width: 20 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 24 },
  ];

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  // Download trigger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeName = (school.schoolName || 'Truong_THCS').replace(/[^\w\sÀ-ỹ]/gi, '').replace(/\s+/g, '_');
  anchor.download = `Mau_Nhap_Du_Lieu_PCCM_${safeName}_${school.schoolYear}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export interface ExportOfficialReportParams {
  authorityName: string;
  schoolName: string;
  branchName?: string;
  schoolYear: string;
  semesterName: string;
  semesterWeeks: number;
  assignmentRound: string; // e.g. "LẦN I"
  departmentScopeName: string; // e.g. "TỔ NGOẠI NGỮ, NĂNG KHIẾU" or "TOÀN TRƯỜNG"
  isAllSchool: boolean;
  teachers: Teacher[];
  calculations: TeacherCalculationResult[];
  assignments: TeachingAssignment[];
  classes: SchoolClass[];
  subjects: Subject[];
  departments: Department[];
  duties: SpecialDuty[];
}

export async function exportOfficialAssignmentReportExcel(params: ExportOfficialReportParams): Promise<void> {
  const {
    authorityName,
    schoolName,
    branchName,
    schoolYear,
    semesterName,
    semesterWeeks,
    assignmentRound,
    departmentScopeName,
    teachers,
    calculations,
    assignments,
    classes,
    subjects,
    departments,
    duties,
  } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${schoolName} - Hệ thống Phân công chuyên môn`;
  workbook.lastModifiedBy = 'Phân hiệu THCS';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('BC phân công CM tổng hợp', {
    views: [{ showGridLines: true }],
  });

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const calcMap = new Map(calculations.map((c) => [c.teacherId, c]));

  // 1. National header on Right, Authority on Left
  // Row 1
  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = authorityName.toUpperCase();
  ws.getCell('A1').font = { name: 'Times New Roman', size: 11, bold: false };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('G1:L1');
  ws.getCell('G1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  ws.getCell('G1').font = { name: 'Times New Roman', size: 11, bold: true };
  ws.getCell('G1').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2
  ws.mergeCells('A2:E2');
  const orgSubName = branchName || schoolName;
  ws.getCell('A2').value = orgSubName.toUpperCase();
  ws.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('G2:L2');
  ws.getCell('G2').value = 'Độc lập - Tự do - Hạnh phúc.';
  ws.getCell('G2').font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
  ws.getCell('G2').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: Main Title
  ws.mergeCells('A4:L4');
  const cleanYear = cleanSchoolYear(schoolYear);
  const mainTitle = `BÁO CÁO PHÂN CÔNG CHUYÊN MÔN TỔNG HỢP (${assignmentRound.toUpperCase()} – ${semesterName.toUpperCase()}, NĂM HỌC ${cleanYear}).`;
  ws.getCell('A4').value = mainTitle;
  ws.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
  ws.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 5: Subtitle (Department or Whole School)
  ws.mergeCells('A5:L5');
  ws.getCell('A5').value = departmentScopeName.toUpperCase();
  ws.getCell('A5').font = { name: 'Times New Roman', size: 13, bold: true };
  ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 7 & 8: Table Headers
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F8FAFC' },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: 10,
    bold: true,
  };
  const tableBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  ws.mergeCells('A7:A8');
  ws.getCell('A7').value = 'TT';

  ws.mergeCells('B7:B8');
  ws.getCell('B7').value = 'Họ và tên';

  ws.mergeCells('C7:C8');
  ws.getCell('C7').value = 'Năm sinh';

  ws.mergeCells('D7:D8');
  ws.getCell('D7').value = 'Năm vào ngành';

  ws.mergeCells('E7:F7');
  ws.getCell('E7').value = 'Trình độ chuyên môn';
  ws.getCell('E8').value = 'Trình độ ban đầu';
  ws.getCell('F8').value = 'Trình độ nâng cao';

  ws.mergeCells('G7:G8');
  ws.getCell('G7').value = `Chức vụ, kiêm nhiệm, số tiết ${semesterName.toLowerCase()}`;

  ws.mergeCells('H7:H8');
  ws.getCell('H7').value = `Phân công giảng dạy môn, lớp, tiết của ${semesterName.toLowerCase()}`;

  ws.mergeCells('I7:I8');
  ws.getCell('I7').value = `Tổng số tiết ${semesterName.toLowerCase()}`;

  ws.mergeCells('J7:J8');
  ws.getCell('J7').value = 'Số tiết trung bình/tuần';

  ws.mergeCells('K7:K8');
  ws.getCell('K7').value = 'BD HSG, Ôn thi 9, Phụ đạo HS yếu';

  ws.mergeCells('L7:L8');
  ws.getCell('L7').value = 'Nghỉ chuyên môn';

  // Apply style to header cells in rows 7 and 8
  const headerCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  [7, 8].forEach((r) => {
    headerCols.forEach((col) => {
      const cell = ws.getCell(`${col}${r}`);
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = tableBorder;
    });
  });

  // Data rows
  let rowIndex = 9;
  let totalSemesterPeriodsAll = 0;
  let totalAverageWeeklyPeriodsAll = 0;
  const activeRules = dataStore.getAbbreviationRules(true);

  teachers.forEach((teacher, idx) => {
    const calc = calcMap.get(teacher.id);
    const tAssignments = assignments.filter((a) => a.teacherId === teacher.id && !a.isDeleted);

    // Birth year
    let birthYearStr = '-';
    if (teacher.birthDate) {
      const match = teacher.birthDate.match(/\d{4}/);
      birthYearStr = match ? match[0] : teacher.birthDate;
    }

    // Start year
    const startYearStr = teacher.startYear ? String(teacher.startYear) : '-';

    // Degrees
    const initialDegreeStr = teacher.initialDegree || '-';
    const higherDegreeStr = teacher.higherDegree || '-';

    // Concurrent duties & exemptions (Abbreviated, each duty on its own line)
    const dutyLines: string[] = calc?.dutyLines && calc.dutyLines.length > 0 ? [...calc.dutyLines] : [];
    const addedDutyKeys = new Set<string>();
    dutyLines.forEach((l) => addedDutyKeys.add(getCanonicalDutyKey(l)));

    const formatDutyPeriodsStr = (p: number, isExempt: boolean = false) => {
      if (p <= 0) return '';
      const raw = isExempt
        ? `(miễn ${p} tiết/tuần = ${p * semesterWeeks} tiết)`
        : `(${p} tiết/tuần = ${p * semesterWeeks} tiết)`;
      return applyAbbreviationRules(raw, activeRules);
    };

    // 1. Quét từ phân công kiêm nhiệm / miễn giảm trong assignments (chỉ bổ sung nếu chưa có)
    const dutyAssignments = tAssignments.filter(
      (a) =>
        a.type === 'CONCURRENT_DUTY' ||
        a.type === 'CONCURRENT' ||
        a.type === 'EXEMPTION' ||
        Boolean(a.dutyName)
    );

    dutyAssignments.forEach((ca) => {
      const isExempt = ca.type === 'EXEMPTION';
      const matchedDuty = ca.dutyId
        ? duties.find((d) => d.id === ca.dutyId || d.code === ca.dutyId)
        : duties.find((d) => (ca.dutyName || '').toLowerCase().includes(d.name.toLowerCase()));

      let p = matchedDuty
        ? (isExempt
            ? (matchedDuty.periodsPerWeekExempted ?? matchedDuty.periodsPerWeekCalculated ?? ca.periodsPerWeek ?? 0)
            : (matchedDuty.periodsPerWeekCalculated ?? matchedDuty.periodsPerWeekExempted ?? ca.periodsPerWeek ?? 0))
        : (ca.periodsPerWeek || 0);
      if (p === 0 && (ca.periodsPerWeek || 0) > 0) {
        p = ca.periodsPerWeek || 0;
      }

      let rawName = ca.dutyName || matchedDuty?.name || (isExempt ? 'Miễn giảm' : 'Kiêm nhiệm');
      const pMatch = rawName.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) || rawName.match(/\((\d+)[^)]*\)/i);
      if (pMatch && p === 0) {
        p = parseInt(pMatch[1], 10);
      }
      rawName = rawName.replace(/\s*\([^)]*\)/gi, '').trim();

      const abbrName = abbreviateDutyName(rawName, activeRules);
      const isActuallyExempt = isExempt || matchedDuty?.type === 'EXEMPTION' || rawName.toLowerCase().includes('miễn') || rawName.toLowerCase().includes('sinh');
      const periodStr = p > 0 ? formatDutyPeriodsStr(p, isActuallyExempt) : '';
      const fullLine = periodStr ? `${abbrName} ${periodStr}` : abbrName;

      const dedupeKey = getCanonicalDutyKey(abbrName || rawName);
      if (!addedDutyKeys.has(dedupeKey)) {
        addedDutyKeys.add(dedupeKey);
        dutyLines.push(fullLine);
      }
    });

    // 2. Bổ sung từ teacher.positions nếu chưa có trong dutyAssignments
    if (teacher.positions && teacher.positions.length > 0) {
      teacher.positions.forEach((pos) => {
        const pMatch = pos.match(/\((\d+)\s*(?:tiết\/tuần|tiết|t\/tuần|t)?\b[^)]*\)/i) || pos.match(/\((\d+)[^)]*\)/i);
        const pFromPos = pMatch ? parseInt(pMatch[1], 10) : 0;
        let cleanPos = pos.replace(/\s*\([^)]*\)/gi, '').trim();
        const abbrPos = abbreviateDutyName(cleanPos, activeRules);
        const dedupeKey = getCanonicalDutyKey(abbrPos || cleanPos);

        if (!addedDutyKeys.has(dedupeKey)) {
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

          if (p === 0 && pFromPos > 0) {
            p = pFromPos;
          }

          const isExempt = matchedDuty?.type === 'EXEMPTION' || pos.toLowerCase().includes('miễn') || pos.toLowerCase().includes('sinh') || cleanPos.toLowerCase().includes('miễn') || cleanPos.toLowerCase().includes('sinh');
          const periodStr = p > 0 ? formatDutyPeriodsStr(p, isExempt) : '';
          const fullLine = periodStr ? `${abbrPos} ${periodStr}` : abbrPos;

          addedDutyKeys.add(dedupeKey);
          dutyLines.push(fullLine);
        }
      });
    }

    // 3. Kiểm tra số tiết miễn giảm từ calc
    if (calc && calc.exemptionPeriods > 0) {
      const alreadyHasExemptionLine = dutyLines.some((l) =>
        l.toLowerCase().includes('miễn') ||
        l.toLowerCase().includes('sinh') ||
        l.toLowerCase().includes('con nhỏ') ||
        l.toLowerCase().includes('ốm')
      );

      if (!alreadyHasExemptionLine) {
        let exemptLabel = 'Miễn giảm';
        if (teacher.status === 'MATERNITY') exemptLabel = 'Nghỉ sinh';
        else if (teacher.status === 'VICE_PRINCIPAL') exemptLabel = 'PHT';
        else if (teacher.status === 'PRINCIPAL') exemptLabel = 'HTr';
        else if (teacher.status === 'SICK_LEAVE') exemptLabel = 'Nghỉ ốm';
        else if (teacher.status === 'UNPAID_LEAVE') exemptLabel = 'Nghỉ K.Lương';

        const abbrLabel = abbreviateDutyName(exemptLabel, activeRules);
        const periodStr = formatDutyPeriodsStr(calc.exemptionPeriods, true);
        dutyLines.push(`${abbrLabel} ${periodStr}`);
      }
    }

    const dutyText = dutyLines.length > 0 ? dutyLines.join('\n') : '-';

    // Teaching assignments by subject: Mỗi môn dạy liệt kê theo từng hàng
    const subjectSummaries = groupTeachingAssignmentsBySubject(
      tAssignments,
      subjectMap,
      classMap,
      activeRules
    );
    const teachingLines = subjectSummaries.map((item) => item.lineText);

    const teachingText =
      teachingLines.length > 0
        ? teachingLines.join('\n')
        : calc && (calc.resultStatus === 'EXACT_EXEMPT' || calc.exemptionPeriods >= calc.quota)
        ? '(Miễn toàn phần)'
        : '-';

    // Total semester periods
    const weeklyCalculated = calc ? calc.totalCalculated : 0;
    const totalSemesterPeriods = weeklyCalculated * semesterWeeks;
    totalSemesterPeriodsAll += totalSemesterPeriods;
    totalAverageWeeklyPeriodsAll += weeklyCalculated;

    // Tutoring info & BD HSG
    const bdParts: string[] = [];
    if (teacher.bdHsgInfo) {
      bdParts.push(`BD HSG: ${applyAbbreviationRules(teacher.bdHsgInfo, activeRules)}`);
    }
    if (teacher.tutoringInfo) {
      bdParts.push(applyAbbreviationRules(teacher.tutoringInfo, activeRules));
    }
    const tutoringText = bdParts.length > 0 ? bdParts.join('\n') : '-';

    // Off day
    const offDayText = teacher.offDay || '-';

    const row = ws.addRow([
      idx + 1,
      teacher.fullName,
      birthYearStr,
      startYearStr,
      initialDegreeStr,
      higherDegreeStr,
      dutyText,
      teachingText,
      totalSemesterPeriods,
      weeklyCalculated,
      tutoringText,
      offDayText,
    ]);

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Times New Roman', size: 10 };
      cell.border = tableBorder;
      // Center alignment for code/numbers/dates
      if ([1, 3, 4, 9, 10, 12].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      } else if ([2, 5, 6].includes(colNumber)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });

    rowIndex++;
  });

  // Summary row
  const summaryRow = ws.addRow([
    `TỔNG CỘNG (${teachers.length} GIÁO VIÊN)`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totalSemesterPeriodsAll,
    teachers.length > 0 ? Number((totalAverageWeeklyPeriodsAll / teachers.length).toFixed(1)) : 0,
    '',
    '',
  ]);

  ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
  const sumCell = ws.getCell(`A${rowIndex}`);
  sumCell.value = `TỔNG CỘNG (${teachers.length} GIÁO VIÊN - ${departmentScopeName.toUpperCase()})`;
  sumCell.font = { name: 'Times New Roman', size: 10, bold: true };
  sumCell.alignment = { horizontal: 'center', vertical: 'middle' };

  summaryRow.eachCell((cell) => {
    cell.font = { name: 'Times New Roman', size: 10, bold: true };
    cell.border = tableBorder;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F1F5F9' },
    };
  });
  ws.getCell(`I${rowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell(`J${rowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' };

  // Signatures section (after 2 blank rows)
  const signRow1 = rowIndex + 3;
  ws.getCell(`B${signRow1}`).value = 'NGƯỜI LẬP BIỂU';
  ws.getCell(`B${signRow1}`).font = { name: 'Times New Roman', size: 11, bold: true };
  ws.getCell(`B${signRow1}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getCell(`G${signRow1}`).value = 'TỔ TRƯỞNG CHUYÊN MÔN';
  ws.getCell(`G${signRow1}`).font = { name: 'Times New Roman', size: 11, bold: true };
  ws.getCell(`G${signRow1}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getCell(`J${signRow1}`).value = 'HIỆU TRƯỞNG';
  ws.getCell(`J${signRow1}`).font = { name: 'Times New Roman', size: 11, bold: true };
  ws.getCell(`J${signRow1}`).alignment = { horizontal: 'center', vertical: 'middle' };

  const signRow2 = signRow1 + 1;
  ws.getCell(`B${signRow2}`).value = '(Ký, ghi rõ họ tên)';
  ws.getCell(`B${signRow2}`).font = { name: 'Times New Roman', size: 9, italic: true };
  ws.getCell(`B${signRow2}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getCell(`G${signRow2}`).value = '(Ký, ghi rõ họ tên)';
  ws.getCell(`G${signRow2}`).font = { name: 'Times New Roman', size: 9, italic: true };
  ws.getCell(`G${signRow2}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getCell(`J${signRow2}`).value = '(Ký, đóng dấu)';
  ws.getCell(`J${signRow2}`).font = { name: 'Times New Roman', size: 9, italic: true };
  ws.getCell(`J${signRow2}`).alignment = { horizontal: 'center', vertical: 'middle' };

  // Set column widths
  ws.columns = [
    { width: 6 },  // TT
    { width: 22 }, // Họ và tên
    { width: 10 }, // Năm sinh
    { width: 12 }, // Năm vào ngành
    { width: 22 }, // Trình độ ban đầu
    { width: 20 }, // Trình độ nâng cao
    { width: 28 }, // Chức vụ, kiêm nhiệm
    { width: 38 }, // Phân công giảng dạy
    { width: 14 }, // Tổng số tiết HK
    { width: 14 }, // Số tiết TB/tuần
    { width: 20 }, // Dạy ôn thi 9, Phụ đạo
    { width: 14 }, // Nghỉ chuyên môn
  ];

  // 2. SHEET THAM CHIẾU DANH MỤC VIẾT TẮT
  try {
    const wsLegend = workbook.addWorksheet('DANH MỤC VIẾT TẮT', { views: [{ showGridLines: true }] });
    wsLegend.mergeCells('A1:D1');
    wsLegend.getCell('A1').value = `BẢNG THAM CHIẾU CÁC KÝ HIỆU VIẾT TẮT SỬ DỤNG TRONG BÁO CÁO PHÂN CÔNG CHUYÊN MÔN`;
    wsLegend.getCell('A1').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: '1E3A8A' } };

    const legendHeaders = ['STT', 'Ký hiệu viết tắt', 'Cụm từ gốc (Đầy đủ)', 'Phân loại / Ý nghĩa tham chiếu'];
    const legHeadRow = wsLegend.addRow(legendHeaders);
    legHeadRow.height = 24;
    legHeadRow.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
      c.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const activeRules = dataStore.getAbbreviationRules(true);
    activeRules.forEach((r, idx) => {
      const row = wsLegend.addRow([
        idx + 1,
        r.abbreviatedText,
        r.originalText,
        r.description || (r.category === 'DUTY' ? 'Chức vụ, kiêm nhiệm' : r.category === 'SUBJECT' ? 'Môn học' : 'Chế độ miễn giảm'),
      ]);
      row.height = 20;
      row.eachCell((c, colNumber) => {
        c.font = { name: 'Times New Roman', size: 10 };
        c.border = tableBorder;
        if (colNumber === 1 || colNumber === 2) {
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          if (colNumber === 2) {
            c.font = { name: 'Times New Roman', size: 10, bold: true };
          }
        } else {
          c.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    wsLegend.columns = [
      { width: 8 },
      { width: 22 },
      { width: 40 },
      { width: 45 },
    ];
  } catch (err) {
    console.warn('Could not add abbreviation sheet:', err);
  }

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  // Download trigger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeScope = departmentScopeName.replace(/[^\w\sÀ-ỹ]/gi, '').replace(/\s+/g, '_');
  anchor.download = `Bang_PCCM_${assignmentRound}_${safeScope}_${schoolYear}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Tải file mẫu Excel Hồ sơ Giáo viên đầy đủ nhất (19 cột chuẩn ngành giáo dục)
 * Căn cứ gốc đồng bộ dữ liệu toàn hệ thống
 */
export async function exportTeacherMasterProfileTemplate(customSchoolInfo?: SchoolInfo): Promise<void> {
  const school = customSchoolInfo || dataStore.getSchoolInfo();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${school.schoolName} - Quản lý hồ sơ giáo viên`;
  workbook.created = new Date();

  const PRIMARY_COLOR = '1E3A8A'; // Deep Navy
  const WHITE_COLOR = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';
  const ACCENT_COLOR = 'E0E7FF'; // Indigo 100

  const ws = workbook.addWorksheet('HỒ SƠ GIÁO VIÊN', {
    views: [{ showGridLines: true }],
  });

  // Banner Title
  ws.mergeCells('A1:T1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${school.schoolName.toUpperCase()} - MẪU HỒ SƠ GIÁO VIÊN ĐẦY ĐỦ NHẤT (CĂN CỨ GỐC ĐỒNG BỘ TOÀN APP)`;
  titleCell.font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: PRIMARY_COLOR } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  // Subtitle / Note
  ws.mergeCells('A2:T2');
  const subCell = ws.getCell('A2');
  subCell.value = `* Hướng dẫn: Điền đầy đủ thông tin nhân sự. Các cột Họ và tên là bắt buộc. Hệ thống tự động đồng bộ sang tất cả các phân hệ.`;
  subCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: '475569' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  // Header Row
  const headers = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Năm vào ngành',
    'Trình độ ban đầu',
    'Trình độ nâng cao',
    'Chuyên ngành đào tạo',
    'Môn có thể dạy',
    'Tổ chuyên môn',
    'Nơi làm việc',
    'Chức vụ / Kiêm nhiệm',
    'Trạng thái công tác',
    'Định mức tiết',
    'Ngày nghỉ CM',
    'Bồi dưỡng HSG',
    'Số điện thoại',
    'Email',
    'Ghi chú',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_COLOR } };
    c.font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: WHITE_COLOR } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = {
      top: { style: 'medium', color: { argb: '0F172A' } },
      left: { style: 'thin', color: { argb: '64748B' } },
      bottom: { style: 'medium', color: { argb: '0F172A' } },
      right: { style: 'thin', color: { argb: '64748B' } },
    };
  });

  // Sample realistic teachers data
  const sampleData = [
    [
      1,
      'GV01',
      'Nguyễn Văn An',
      'Nam',
      '1982-05-14',
      2005,
      'Đại học Sư phạm',
      'Thạc sĩ Toán học',
      'Toán - Tin',
      'Toán, Tin học',
      'Tổ Tự nhiên',
      'Điểm chính',
      'Tổ trưởng, GVCN 9A1',
      'Đang giảng dạy',
      19,
      'Thứ 2',
      'BD HSG Toán 9',
      '0912345678',
      'nvan@thcs.edu.vn',
      'Giáo viên dạy giỏi cấp Tỉnh',
    ],
    [
      2,
      'GV02',
      'Trần Thị Bích',
      'Nữ',
      '1986-11-20',
      2009,
      'Đại học Sư phạm',
      'Đại học',
      'Ngữ văn',
      'Ngữ văn, GDCD',
      'Tổ Xã hội',
      'Điểm chính',
      'Tổ phó, CTCĐ',
      'Đang giảng dạy',
      19,
      'Thứ 5',
      'BD HSG Văn 8',
      '0912345679',
      'ttbich@thcs.edu.vn',
      'Phụ trách công tác công đoàn',
    ],
    [
      3,
      'GV03',
      'Lê Quang Cường',
      'Nam',
      '1989-08-05',
      2012,
      'Đại học Ngoại ngữ',
      'Thạc sĩ PP Giảng dạy Tiếng Anh',
      'Tiếng Anh',
      'Tiếng Anh',
      'Tổ Ngoại ngữ',
      'Điểm chính',
      'GVCN 7A2',
      'Đang giảng dạy',
      19,
      'Thứ 4',
      'BD HSG Tiếng Anh',
      '0912345680',
      'lqcuong@thcs.edu.vn',
      'Chứng chỉ IELTS 7.5',
    ],
    [
      4,
      'GV04',
      'Phạm Thị Duyên',
      'Nữ',
      '1991-03-22',
      2014,
      'Đại học Sư phạm TDTT',
      'Đại học',
      'GDTC',
      'Giáo dục thể chất',
      'Tổ Năng khiếu',
      'Điểm Bản Đột',
      'TPT Đội',
      'Đang giảng dạy',
      19,
      'Thứ 6',
      '',
      '0912345681',
      'ptduyen@thcs.edu.vn',
      'Tổng phụ trách Đội TNTP',
    ],
    [
      5,
      'GV05',
      'Hoàng Văn Em',
      'Nam',
      '1984-12-10',
      2007,
      'Đại học Sư phạm',
      'Đại học',
      'KHTN (Vật lý)',
      'Khoa học tự nhiên, Công nghệ',
      'Tổ Tự nhiên',
      'Điểm chính',
      'Ban TTND',
      'Đang giảng dạy',
      19,
      'Thứ 3',
      'BD KHTN 8, 9',
      '0912345682',
      'hvem@thcs.edu.vn',
      '',
    ],
    [
      6,
      'GV06',
      'Vũ Thị Giang',
      'Nữ',
      '1993-09-18',
      2016,
      'Đại học Sư phạm',
      'Thạc sĩ',
      'Lịch sử & Địa lí',
      'Lịch sử và Địa lí',
      'Tổ Xã hội',
      'Điểm chính',
      '',
      'Nghỉ thai sản',
      0,
      '',
      '',
      '0912345683',
      'vtgiang@thcs.edu.vn',
      'Nghỉ thai sản từ 10/2026',
    ],
  ];

  sampleData.forEach((rowValues) => {
    const row = ws.addRow(rowValues);
    row.height = 22;
    row.eachCell((c, colNumber) => {
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
      c.font = { name: 'Times New Roman', size: 10 };
      if ([1, 2, 4, 5, 6, 14, 15, 16].includes(colNumber)) {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Set column widths
  ws.columns = [
    { width: 6 },  // STT
    { width: 10 }, // Mã GV
    { width: 24 }, // Họ và tên
    { width: 10 }, // Giới tính
    { width: 14 }, // Ngày sinh
    { width: 13 }, // Năm vào ngành
    { width: 20 }, // Trình độ ban đầu
    { width: 22 }, // Trình độ nâng cao
    { width: 22 }, // Chuyên ngành đào tạo
    { width: 24 }, // Môn có thể dạy
    { width: 18 }, // Tổ chuyên môn
    { width: 16 }, // Nơi làm việc
    { width: 22 }, // Chức vụ / Kiêm nhiệm
    { width: 18 }, // Trạng thái
    { width: 14 }, // Định mức
    { width: 14 }, // Ngày nghỉ CM
    { width: 18 }, // Bồi dưỡng HSG
    { width: 15 }, // SĐT
    { width: 26 }, // Email
    { width: 28 }, // Ghi chú
  ];

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Mau_Ho_So_Giao_Vien_Chuan_Day_Du.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * Xuất danh sách toàn bộ hồ sơ giáo viên đang có trong hệ thống ra file Excel
 */
export async function exportTeacherMasterListExcel(
  teachers: Teacher[],
  departments: Department[],
  calculationsOrSchool?: TeacherCalculationResult[] | SchoolInfo,
  customSchoolInfo?: SchoolInfo
): Promise<void> {
  let calculations: TeacherCalculationResult[] = [];
  let school: SchoolInfo = dataStore.getSchoolInfo();

  if (Array.isArray(calculationsOrSchool)) {
    calculations = calculationsOrSchool;
    if (customSchoolInfo) school = customSchoolInfo;
  } else if (calculationsOrSchool && typeof calculationsOrSchool === 'object') {
    school = calculationsOrSchool;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${school.schoolName} - Hồ sơ giáo viên`;
  workbook.created = new Date();

  const PRIMARY_COLOR = '1E3A8A';
  const WHITE_COLOR = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';

  const ws = workbook.addWorksheet('DANH SÁCH GIÁO VIÊN', {
    views: [{ showGridLines: true }],
  });

  // Header Title
  ws.mergeCells('A1:T1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${school.schoolName.toUpperCase()} - DANH SÁCH TOÀN BỘ HỒ SƠ GIÁO VIÊN (${school.schoolYear})`;
  titleCell.font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: PRIMARY_COLOR } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  const headers = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Tên TKB',
    'Giới tính',
    'Ngày sinh',
    'Năm vào ngành',
    'Trình độ ban đầu',
    'Trình độ nâng cao',
    'Chuyên ngành',
    'Môn có thể dạy',
    'Tổ chuyên môn',
    'Nơi làm việc',
    'Chức vụ / Kiêm nhiệm',
    'Trạng thái',
    'Định mức',
    'Tiết thực nhận',
    'Ngày nghỉ CM',
    'Bồi dưỡng HSG',
    'Số điện thoại',
    'Email',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_COLOR } };
    c.font = { name: 'Times New Roman', size: 10.5, bold: true, color: { argb: WHITE_COLOR } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const calcMap = new Map(calculations.map((c) => [c.teacherId, c]));

  teachers.forEach((t, idx) => {
    const dept = departments.find((d) => d.id === t.departmentId);
    const calc = calcMap.get(t.id);
    const received = calc?.totalCalculated ?? t.standardQuota ?? 19;
    const posStr = (t.positions || []).join(', ');
    const subjectsStr = (t.subjectsCanTeach || []).join(', ');
    const tkbName = t.timetableName || t.shortName || (t.fullName ? t.fullName.trim().split(/\s+/).slice(-1)[0] : '');

    const row = ws.addRow([
      idx + 1,
      t.code || `GV${idx + 1}`,
      t.fullName,
      tkbName,
      t.gender || 'Nữ',
      t.birthDate || '',
      t.startYear || '',
      t.initialDegree || '',
      t.higherDegree || '',
      t.major || '',
      subjectsStr,
      dept?.name || '',
      t.workplace || 'Điểm chính',
      posStr,
      t.statusLabel || (t.status === 'ACTIVE' ? 'Đang công tác' : t.status),
      t.standardQuota ?? 19,
      received,
      t.offDay || '',
      t.bdHsgInfo || '',
      t.phone || '',
      t.email || '',
    ]);

    row.height = 21;
    row.eachCell((c, colNumber) => {
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
      c.font = { name: 'Times New Roman', size: 10 };
      if ([1, 2, 4, 5, 6, 14, 15, 16, 17].includes(colNumber)) {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  ws.columns = [
    { width: 6 },
    { width: 10 },
    { width: 24 },
    { width: 10 },
    { width: 14 },
    { width: 13 },
    { width: 20 },
    { width: 22 },
    { width: 20 },
    { width: 24 },
    { width: 18 },
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 15 },
    { width: 26 },
  ];

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeSchoolName = (school.schoolName || 'Truong_THCS').replace(/[^\w\sÀ-ỹ]/gi, '').replace(/\s+/g, '_');
  anchor.download = `Danh_Sach_Ho_So_Giao_Vien_${safeSchoolName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

/**
 * MẪU EXCEL KHỞI TẠO ĐỊNH NGHĨA BAN ĐẦU DÀNH CHO TRƯỜNG MỚI (TẤT CẢ THÔNG TIN + GIÁO VIÊN)
 * Gồm: 1. Thông tin trường, 2. Tổ chuyên môn, 3. Môn học & PPCT, 4. Lớp học, 5. Danh sách giáo viên chi tiết, 6. Nhiệm vụ kiêm nhiệm, 7. Hướng dẫn
 */
export async function exportComprehensiveInitialSetupTemplate(customSchoolInfo?: SchoolInfo): Promise<void> {
  const school = customSchoolInfo || dataStore.getSchoolInfo();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${school.schoolName} - Khởi tạo định nghĩa ban đầu`;
  workbook.created = new Date();

  const PRIMARY_COLOR = '1E3A8A'; // Deep Navy
  const WHITE_COLOR = 'FFFFFF';
  const BORDER_COLOR = 'CBD5E1';
  const TEAL_COLOR = '0F766E';
  const AMBER_COLOR = 'B45309';
  const PURPLE_COLOR = '6B21A8';

  const styleHeader = (row: ExcelJS.Row, bgColor: string) => {
    row.height = 26;
    row.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      c.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: WHITE_COLOR } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
  };

  const styleDataRows = (ws: ExcelJS.Worksheet) => {
    ws.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        row.height = 22;
        row.eachCell((c) => {
          c.border = {
            top: { style: 'thin', color: { argb: BORDER_COLOR } },
            left: { style: 'thin', color: { argb: BORDER_COLOR } },
            bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
            right: { style: 'thin', color: { argb: BORDER_COLOR } },
          };
          c.font = { name: 'Times New Roman', size: 10 };
          c.alignment = { vertical: 'middle' };
        });
      }
    });
  };

  // 1. SHEET THÔNG TIN TRƯỜNG
  const wsSchool = workbook.addWorksheet('1. THÔNG TIN TRƯỜNG', { views: [{ showGridLines: true }] });
  wsSchool.mergeCells('A1:I1');
  const sTitle = wsSchool.getCell('A1');
  sTitle.value = `${(school.schoolName || 'TRƯỜNG THCS').toUpperCase()} - THÔNG TIN ĐƠN VỊ TRƯỜNG HỌC BAN ĐẦU`;
  sTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: PRIMARY_COLOR } };
  sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSchool.getRow(1).height = 28;

  const schoolHeaders = [
    'Tên trường',
    'Năm học',
    'Cơ quan chủ quản (Phòng/Sở)',
    'Tỉnh / Thành phố',
    'Hiệu trưởng',
    'Phó Hiệu trưởng',
    'Điện thoại trường',
    'Email trường',
    'Điểm trường (cách nhau dấu phẩy)',
  ];
  const sHRow = wsSchool.addRow(schoolHeaders);
  styleHeader(sHRow, PRIMARY_COLOR);

  wsSchool.addRow([
    school.schoolName || 'TRƯỜNG THCS THỐNG KÊ',
    school.schoolYear || '2026-2027',
    school.authorityName || 'ỦY BAN NHÂN DÂN XÃ',
    school.province || 'Hà Nội',
    school.principalName || '',
    school.deanName || '',
    school.phone || '',
    school.email || '',
    'Điểm chính, Phân hiệu',
  ]);
  styleDataRows(wsSchool);
  wsSchool.columns = [
    { width: 28 }, { width: 14 }, { width: 28 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 18 }, { width: 24 }, { width: 28 }
  ];

  // 2. SHEET TỔ CHUYÊN MÔN
  const wsDepts = workbook.addWorksheet('2. TỔ CHUYÊN MÔN', { views: [{ showGridLines: true }] });
  wsDepts.mergeCells('A1:D1');
  const dTitle = wsDepts.getCell('A1');
  dTitle.value = `DANH MỤC TỔ CHUYÊN MÔN`;
  dTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: TEAL_COLOR } };
  dTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDepts.getRow(1).height = 28;

  const deptHeaders = ['STT', 'Mã tổ', 'Tên tổ chuyên môn', 'Ghi chú'];
  const dHRow = wsDepts.addRow(deptHeaders);
  styleHeader(dHRow, TEAL_COLOR);

  const sampleDepts = [
    [1, 'TO_TOAN_TIN', 'Tổ Toán - Tin học', 'Bao gồm bộ môn Toán và Tin học'],
    [2, 'TO_KHTN', 'Tổ Khoa học Tự nhiên', 'Bao gồm KHTN, Vật lí, Hóa học, Sinh học'],
    [3, 'TO_VAN', 'Tổ Ngữ văn', 'Bao gồm Ngữ văn'],
    [4, 'TO_NGOAI_NGU', 'Tổ Ngoại ngữ', 'Bao gồm Tiếng Anh'],
    [5, 'TO_LS_DL', 'Tổ Lịch sử & Địa lí', 'Bao gồm Lịch sử, Địa lí'],
    [6, 'TO_NGHE_THUAT_GDTC', 'Tổ Nghệ thuật - GDTC - GDCD', 'Bao gồm GDCD, GDTC, Âm nhạc, Mĩ thuật, Công nghệ'],
  ];
  sampleDepts.forEach((r) => wsDepts.addRow(r));
  styleDataRows(wsDepts);
  wsDepts.columns = [{ width: 6 }, { width: 18 }, { width: 32 }, { width: 35 }];

  // 3. SHEET MÔN HỌC & PPCT
  const wsSubjects = workbook.addWorksheet('3. MÔN HỌC & PPCT', { views: [{ showGridLines: true }] });
  wsSubjects.mergeCells('A1:G1');
  const subTitle = wsSubjects.getCell('A1');
  subTitle.value = `DANH MỤC MÔN HỌC VÀ KHUNG PHÂN PHỐI CHƯƠNG TRÌNH (CT GDPT 2018)`;
  subTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: PURPLE_COLOR } };
  subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSubjects.getRow(1).height = 28;

  const subHeaders = ['STT', 'Mã môn', 'Tên môn học', 'Khối áp dụng', 'Số tiết HK1/tuần', 'Số tiết HK2/tuần', 'Thuộc Tổ chuyên môn'];
  const subHRow = wsSubjects.addRow(subHeaders);
  styleHeader(subHRow, PURPLE_COLOR);

  const sampleSubjects = [
    [1, 'TOAN', 'Toán học', '6, 7, 8, 9', 4, 4, 'Tổ Toán - Tin học'],
    [2, 'NGU_VAN', 'Ngữ văn', '6, 7, 8, 9', 4, 4, 'Tổ Ngữ văn'],
    [3, 'TIENG_ANH', 'Tiếng Anh', '6, 7, 8, 9', 3, 3, 'Tổ Ngoại ngữ'],
    [4, 'KHTN', 'Khoa học tự nhiên', '6, 7', 4, 4, 'Tổ Khoa học Tự nhiên'],
    [5, 'KHTN_LY', 'KHTN - Vật lí', '8, 9', 1.5, 1.5, 'Tổ Khoa học Tự nhiên'],
    [6, 'KHTN_HOA', 'KHTN - Hóa học', '8, 9', 1.5, 1.5, 'Tổ Khoa học Tự nhiên'],
    [7, 'KHTN_SINH', 'KHTN - Sinh học', '8, 9', 1, 1, 'Tổ Khoa học Tự nhiên'],
    [8, 'LS_DL', 'Lịch sử và Địa lí', '6, 7, 8, 9', 3, 3, 'Tổ Lịch sử & Địa lí'],
    [9, 'GDCD', 'Giáo dục công dân', '6, 7, 8, 9', 1, 1, 'Tổ Nghệ thuật - GDTC - GDCD'],
    [10, 'GDTC', 'Giáo dục thể chất', '6, 7, 8, 9', 2, 2, 'Tổ Nghệ thuật - GDTC - GDCD'],
    [11, 'TIN_HOC', 'Tin học', '6, 7, 8, 9', 1, 1, 'Tổ Toán - Tin học'],
    [12, 'CONG_NGHE', 'Công nghệ', '6, 7, 8, 9', 1, 1, 'Tổ Nghệ thuật - GDTC - GDCD'],
    [13, 'AM_NHAC', 'Âm nhạc', '6, 7, 8, 9', 1, 1, 'Tổ Nghệ thuật - GDTC - GDCD'],
    [14, 'MY_THUAT', 'Mĩ thuật', '6, 7, 8, 9', 1, 1, 'Tổ Nghệ thuật - GDTC - GDCD'],
    [15, 'HDTN_HN', 'Hoạt động trải nghiệm, hướng nghiệp', '6, 7, 8, 9', 3, 3, 'Tổ Hoạt động trải nghiệm'],
    [16, 'NDGD_DP', 'Nội dung giáo dục địa phương', '6, 7, 8, 9', 1, 1, 'Tổ Lịch sử & Địa lí'],
  ];
  sampleSubjects.forEach((r) => wsSubjects.addRow(r));
  styleDataRows(wsSubjects);
  wsSubjects.columns = [{ width: 6 }, { width: 14 }, { width: 30 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 30 }];

  // 4. SHEET LỚP HỌC
  const wsClasses = workbook.addWorksheet('4. LỚP HỌC', { views: [{ showGridLines: true }] });
  wsClasses.mergeCells('A1:H1');
  const cTitle = wsClasses.getCell('A1');
  cTitle.value = `DANH SÁCH LỚP HỌC`;
  cTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: AMBER_COLOR } };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsClasses.getRow(1).height = 28;

  const classHeaders = ['STT', 'Mã lớp', 'Tên lớp', 'Khối', 'Sĩ số', 'Buổi học (Sáng/Chiều)', 'Điểm trường', 'Phòng học'];
  const cHRow = wsClasses.addRow(classHeaders);
  styleHeader(cHRow, AMBER_COLOR);

  const sampleClasses = [
    [1, '6A1', 'Lớp 6A1', 6, 38, 'Sáng', 'Điểm chính', 'P.601'],
    [2, '6A2', 'Lớp 6A2', 6, 38, 'Sáng', 'Điểm chính', 'P.602'],
    [3, '7A1', 'Lớp 7A1', 7, 36, 'Sáng', 'Điểm chính', 'P.701'],
    [4, '7A2', 'Lớp 7A2', 7, 35, 'Sáng', 'Điểm chính', 'P.702'],
    [5, '8A1', 'Lớp 8A1', 8, 35, 'Chiều', 'Điểm chính', 'P.801'],
    [6, '8A2', 'Lớp 8A2', 8, 35, 'Chiều', 'Điểm chính', 'P.802'],
    [7, '9A1', 'Lớp 9A1', 9, 34, 'Chiều', 'Điểm chính', 'P.901'],
    [8, '9A2', 'Lớp 9A2', 9, 34, 'Chiều', 'Điểm chính', 'P.902'],
  ];
  sampleClasses.forEach((r) => wsClasses.addRow(r));
  styleDataRows(wsClasses);
  wsClasses.columns = [{ width: 6 }, { width: 12 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 14 }];

  // 5. SHEET DANH SÁCH GIÁO VIÊN (ĐẦY ĐỦ 20 CỘT)
  const wsTeachers = workbook.addWorksheet('5. DANH SÁCH GIÁO VIÊN', { views: [{ showGridLines: true }] });
  wsTeachers.mergeCells('A1:T1');
  const tTitle = wsTeachers.getCell('A1');
  tTitle.value = `DANH SÁCH & HỒ SƠ GIÁO VIÊN CHI TIẾT (ĐẦY ĐỦ THÔNG TIN ĐỒNG BỘ TOÀN HỆ THỐNG)`;
  tTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: PRIMARY_COLOR } };
  tTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsTeachers.getRow(1).height = 28;

  const teacherHeaders = [
    'STT',
    'Mã GV',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Năm vào ngành',
    'Trình độ ban đầu',
    'Trình độ nâng cao',
    'Chuyên ngành đào tạo',
    'Môn có thể dạy',
    'Tổ chuyên môn',
    'Nơi làm việc',
    'Chức vụ / Kiêm nhiệm',
    'Trạng thái công tác',
    'Định mức tiết',
    'Ngày nghỉ CM',
    'Bồi dưỡng HSG',
    'Số điện thoại',
    'Email',
    'Ghi chú',
  ];
  const tHRow = wsTeachers.addRow(teacherHeaders);
  styleHeader(tHRow, PRIMARY_COLOR);

  const sampleTeachers = [
    [1, 'GV01', 'Nguyễn Văn An', 'Nam', '15/08/1982', 2005, 'ĐHSP Toán', 'ThS Toán', 'Toán học', 'Toán học', 'Tổ Toán - Tin học', 'Điểm chính', 'Tổ trưởng (3 tiết/tuần)', 'ACTIVE', 19, 'Thứ 5', 'Toán 9', '0912.345.601', 'nvan@thcs.edu.vn', 'Tổ trưởng chuyên môn'],
    [2, 'GV02', 'Trần Thị Bích', 'Nữ', '20/11/1985', 2008, 'ĐHSP Ngữ văn', '', 'Ngữ văn', 'Ngữ văn', 'Tổ Ngữ văn', 'Điểm chính', 'GVCN 6A1 (4 tiết/tuần)', 'ACTIVE', 19, 'Thứ 3', '', '0912.345.602', 'ttbich@thcs.edu.vn', 'Chủ nhiệm 6A1'],
    [3, 'GV03', 'Lê Quang Cường', 'Nam', '10/05/1988', 2011, 'ĐHSP Tiếng Anh', '', 'Tiếng Anh', 'Tiếng Anh', 'Tổ Ngoại ngữ', 'Điểm chính', '', 'ACTIVE', 19, 'Thứ 6', 'Tiếng Anh 8', '0912.345.603', 'lqcuong@thcs.edu.vn', ''],
    [4, 'GV04', 'Phạm Thị Duyên', 'Nữ', '02/09/1990', 2014, 'ĐHSP Vật lí', '', 'Vật lí', 'Khoa học tự nhiên; KHTN - Vật lí', 'Tổ Khoa học Tự nhiên', 'Điểm chính', 'Tổ phó (1 tiết/tuần)', 'ACTIVE', 19, 'Thứ 2', '', '0912.345.604', 'ptduyen@thcs.edu.vn', ''],
    [5, 'GV05', 'Hoàng Văn Em', 'Nam', '12/12/1978', 2001, 'ĐHSP Toán', '', 'Toán học', 'Toán học', 'Tổ Toán - Tin học', 'Điểm chính', 'Phó Hiệu trưởng', 'VICE_PRINCIPAL', 4, '', '', '0912.345.605', 'hvem@thcs.edu.vn', 'Phó Hiệu trưởng dạy 4 tiết, miễn 15 tiết'],
  ];
  sampleTeachers.forEach((r) => wsTeachers.addRow(r));
  styleDataRows(wsTeachers);
  wsTeachers.columns = [
    { width: 6 }, { width: 10 }, { width: 24 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 24 }, { width: 24 }, { width: 16 }, { width: 24 }, { width: 16 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 24 }, { width: 24 },
  ];

  // 6. SHEET NHIỆM VỤ KIÊM NHIỆM & MIỄN GIẢM
  const wsDuties = workbook.addWorksheet('6. KIÊM NHIỆM & MIỄN GIẢM', { views: [{ showGridLines: true }] });
  wsDuties.mergeCells('A1:G1');
  const dutyTitle = wsDuties.getCell('A1');
  dutyTitle.value = `DANH MỤC NHIỆM VỤ KIÊM NHIỆM VÀ MIỄN GIẢM TIẾT DẠY THEO QUY ĐỊNH BỘ GD&ĐT`;
  dutyTitle.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'BE185D' } };
  dutyTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDuties.getRow(1).height = 28;

  const dutyHeaders = ['STT', 'Mã nhiệm vụ', 'Tên chức vụ / nhiệm vụ', 'Loại nhiệm vụ (Kiêm nhiệm/Miễn giảm)', 'Số tiết/tuần', 'Hình thức áp dụng', 'Ghi chú'];
  const dutyHRow = wsDuties.addRow(dutyHeaders);
  styleHeader(dutyHRow, 'BE185D');

  const sampleDuties = [
    [1, 'TO_TRUONG', 'Tổ trưởng chuyên môn', 'Kiêm nhiệm', 3, 'Cố định', 'Tính 3 tiết/tuần'],
    [2, 'TO_PHO', 'Tổ phó chuyên môn', 'Kiêm nhiệm', 1, 'Cố định', 'Tính 1 tiết/tuần'],
    [3, 'CHU_NHIEM', 'Giáo viên chủ nhiệm', 'Kiêm nhiệm', 4, 'Theo lớp', 'Cấp THCS tính 4 tiết/tuần'],
    [4, 'THU_KY', 'Thư ký hội đồng trường', 'Kiêm nhiệm', 2, 'Cố định', 'Tính 2 tiết/tuần'],
    [5, 'PHU_TRACH_DOI', 'Tổng phụ trách Đội', 'Kiêm nhiệm', 6, 'Cố định', 'Tính theo trường hạng I/II/III'],
    [6, 'CON_MON', 'Nuôi con nhỏ dưới 12 tháng', 'Miễn giảm', 2, 'Cố định', 'Giảm 2 tiết/tuần'],
  ];
  sampleDuties.forEach((r) => wsDuties.addRow(r));
  styleDataRows(wsDuties);
  wsDuties.columns = [{ width: 6 }, { width: 16 }, { width: 28 }, { width: 22 }, { width: 14 }, { width: 16 }, { width: 35 }];

  // 7. SHEET HƯỚNG DẪN SỬ DỤNG
  const wsGuide = workbook.addWorksheet('7. HƯỚNG DẪN SỬ DỤNG', { views: [{ showGridLines: true }] });
  wsGuide.mergeCells('A1:C1');
  const gTitle = wsGuide.getCell('A1');
  gTitle.value = `HƯỚNG DẪN ĐIỀN FILE EXCEL KHỞI TẠO ĐỊNH NGHĨA BAN ĐẦU CHO TRƯỜNG MỚI`;
  gTitle.font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: PRIMARY_COLOR } };
  gTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsGuide.getRow(1).height = 30;

  const guideRows = [
    ['Bước 1', 'Sheet 1. THÔNG TIN TRƯỜNG', 'Điền chính xác Tên trường, Năm học, Cơ quan cấp trên, Tỉnh/Thành phố và Tên điểm trường (phân tách bởi dấu phẩy).'],
    ['Bước 2', 'Sheet 2. TỔ CHUYÊN MÔN', 'Rà soát danh sách Tổ chuyên môn hiện có của trường. Có thể thêm/sửa/xóa dòng theo cơ cấu thực tế.'],
    ['Bước 3', 'Sheet 3. MÔN HỌC & PPCT', 'Kiểm tra khung số tiết/tuần các môn học theo Chương trình GDPT 2018.'],
    ['Bước 4', 'Sheet 4. LỚP HỌC', 'Nhập toàn bộ các lớp của trường (Mã lớp như 6A1, 7A1, sĩ số và buổi học Sáng/Chiều).'],
    ['Bước 5', 'Sheet 5. DANH SÁCH GIÁO VIÊN', 'Nhập danh sách giáo viên của trường. Cột [Họ và tên] là bắt buộc. Cột [Tổ chuyên môn] nên khớp với tên tổ ở Sheet 2.'],
    ['Bước 6', 'Sheet 6. KIÊM NHIỆM & MIỄN GIẢM', 'Các quy chuẩn định mức giảm trừ hoặc cộng tiết kiêm nhiệm theo thông tư Bộ GD&ĐT.'],
    ['Bước 7', 'Nạp vào phần mềm', 'Lưu file Excel này, vào phần mềm bấm nút [Nhập file Excel khởi tạo vào hệ thống] tại cửa sổ Quản lý Xuất / Nhập Excel.'],
  ];

  const gHRow = wsGuide.addRow(['Bước', 'Nội dung', 'Chi tiết hướng dẫn']);
  styleHeader(gHRow, PRIMARY_COLOR);

  guideRows.forEach((r) => wsGuide.addRow(r));
  styleDataRows(wsGuide);
  wsGuide.columns = [{ width: 12 }, { width: 30 }, { width: 70 }];

  // MỤC 3: Đóng dấu Watermark & Metadata Bản quyền bất biến
  applyLicenseWatermarkAndMetadata(workbook);

  // Download Trigger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const safeSchoolName = (school.schoolName || 'Truong_Moi').replace(/[^\w\sÀ-ỹ]/gi, '').replace(/\s+/g, '_');
  anchor.download = `Mau_Excel_Khoi_Tao_Dinh_Nghia_Ban_Dau_${safeSchoolName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
