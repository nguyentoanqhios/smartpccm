/**
 * KHUNG KẾ HOẠCH DẠY HỌC & TỔNG HỢP SỐ TIẾT TOÀN TRƯỜNG
 * Căn cứ Chương trình GDPT 2018 - Năm học 2026-2027
 * Tự động tính toán theo công thức, hỗ trợ đồng bộ 2 chiều với DS Giáo viên, Lớp học, Kiêm nhiệm.
 */

export interface GradeSubjectRow {
  stt: number;
  subjectName: string;
  shortName?: string;
  periodsPerWeek: number; // Số tiết / tuần / lớp theo CT GDPT
  // Buổi 1 (Chính khóa)
  session1Classes: number;
  session1Periods: number; // Cả năm (35 tuần)
  session1Hk1Periods?: number; // HK I (18 tuần)
  session1Hk2Periods?: number; // HK II (17 tuần)
  // Buổi 2 (Đối tượng 1: Bồi dưỡng - BD)
  session2BdClasses: number;
  session2BdPeriods: number;
  session2BdDetail?: string;
  // Buổi 2 (Đối tượng 2: Phụ đạo - PĐ)
  session2PdClasses: number;
  session2PdPeriods: number;
  // Buổi 2 (Đối tượng 3: Ôn thi vào 10 - Dành cho Khối 9)
  session2ExamClasses?: number;
  session2ExamPeriods?: number;
  // Tổng số tiết của môn học
  totalPeriods: number;
  totalHk1Periods?: number;
  totalHk2Periods?: number;
}

export interface GradePlanData {
  grade: number;
  gradeName: string;
  totalClasses: number;
  subjects: GradeSubjectRow[];
  totalSession1Classes: number;
  totalSession1Periods: number;
  totalSession1Hk1Periods: number;
  totalSession1Hk2Periods: number;
  totalSession2BdClasses: number;
  totalSession2BdPeriods: number;
  totalSession2PdClasses: number;
  totalSession2PdPeriods: number;
  totalSession2ExamClasses?: number;
  totalSession2ExamPeriods?: number;
  totalSession2Periods: number;
  grandTotalPeriods: number;
  grandTotalHk1Periods: number;
  grandTotalHk2Periods: number;
}

export interface ConcurrentDutyRow {
  id?: string;
  stt: number;
  dutyName: string;
  periodsPerWeek: number;
  inChargeTeachers: string;
  teacherCount: number;
  periodsPerYear: number; // periodsPerWeek * 35 tuần
  periodsHk1?: number;    // periodsPerWeek * 18 tuần
  periodsHk2?: number;    // periodsPerWeek * 17 tuần
  notes?: string;
  isHomeroom?: boolean;
  grade?: number;
}

export interface SchoolTotalSummary {
  session1Periods: number;       // 42.987 tiết
  session1Hk1Periods: number;
  session1Hk2Periods: number;
  session2Periods: number;       // 6.015 tiết
  session2Hk1Periods: number;
  session2Hk2Periods: number;
  concurrentPeriods: number;     // 6.965 tiết
  concurrentHk1Periods: number;
  concurrentHk2Periods: number;
  totalAssignedPeriods: number;  // (1) = 55.967 tiết
  totalAssignedHk1Periods: number;
  totalAssignedHk2Periods: number;
  standardQuotaPeriods: number;  // (2) = 49.630 tiết
  standardQuotaHk1Periods: number;
  standardQuotaHk2Periods: number;
  overtimePeriods: number;       // (1) - (2) = +6.337 tiết
  overtimeHk1Periods: number;
  overtimeHk2Periods: number;
  teacherCountDirect: number;    // 74 GV trực tiếp giảng dạy
  principalPeriods: number;      // 70 tiết (2 tiết/tuần x 35w)
  vicePrincipalPeriods: number;  // 280 tiết (2 PHT x 4 tiết/tuần x 35w)
  teamLeaderPeriods: number;     // 70 tiết (TPT Đội 2 tiết/tuần x 35w)
  totalClasses: number;          // 42 lớp
  totalWeeks: number;            // 35 tuần
  weeksHk1: number;              // 18 tuần
  weeksHk2: number;              // 17 tuần
}

// =========================================================================
// TIÊU CHUẨN SỐ TIẾT/TUẦN THEO CHƯƠNG TRÌNH GDPT 2018 (35 TUẦN/NĂM)
// =========================================================================
export const SUBJECT_BASE_WEEKLY_PERIODS: Record<number, Record<string, number>> = {
  6: {
    'Toán': 4,
    'Toán học': 4,
    'KHTN': 4,
    'Khoa học tự nhiên': 4,
    'Khoa học tự nhiên (K6,7)': 4,
    'Công nghệ': 1,
    'C.Nghệ': 1,
    'Tin học': 1,
    'Tin': 1,
    'GDTC': 2,
    'Giáo dục thể chất': 2,
    'Thể dục': 2,
    'Ngữ văn': 4,
    'Văn': 4,
    'Tiếng anh': 3,
    'Tiếng Anh': 3,
    'T.Anh': 3,
    'Lịch sử & Địa lý': 3,
    'Lịch sử và Địa lí': 3,
    'Sử - Địa': 3,
    'GDCD': 1,
    'Giáo dục công dân': 1,
    'Nghệ thuật (Âm nhạc, Mĩ thuật)': 2,
    'Nghệ thuật': 2,
    'Âm nhạc': 1,
    'Nhạc': 1,
    'Mĩ thuật': 1,
    'Mỹ thuật': 1,
    'M.Thuật': 1,
    'GDĐP (Giáo dục địa phương)': 1,
    'Giáo dục địa phương': 1,
    'Nội dung giáo dục địa phương': 1,
    'GDĐP': 1,
    'HĐTNHN (Hoạt động TN, HN)': 3,
    'Hoạt động trải nghiệm, hướng nghiệp': 3,
    'HĐ trải nghiệm, hướng nghiệp': 3,
    'HĐTN': 3,
  },
  7: {
    'Toán': 4,
    'Toán học': 4,
    'KHTN': 4,
    'Khoa học tự nhiên': 4,
    'Khoa học tự nhiên (K6,7)': 4,
    'Công nghệ': 1,
    'C.Nghệ': 1,
    'Tin học': 1,
    'Tin': 1,
    'GDTC': 2,
    'Giáo dục thể chất': 2,
    'Thể dục': 2,
    'Ngữ văn': 4,
    'Văn': 4,
    'Tiếng anh': 3,
    'Tiếng Anh': 3,
    'T.Anh': 3,
    'Lịch sử & Địa lý': 3,
    'Lịch sử và Địa lí': 3,
    'Sử - Địa': 3,
    'GDCD': 1,
    'Giáo dục công dân': 1,
    'Nghệ thuật (Âm nhạc, Mĩ thuật)': 2,
    'Nghệ thuật': 2,
    'Âm nhạc': 1,
    'Nhạc': 1,
    'Mĩ thuật': 1,
    'Mỹ thuật': 1,
    'M.Thuật': 1,
    'GDĐP (Giáo dục địa phương)': 1,
    'Giáo dục địa phương': 1,
    'Nội dung giáo dục địa phương': 1,
    'GDĐP': 1,
    'HĐTNHN (Hoạt động TN, HN)': 3,
    'Hoạt động trải nghiệm, hướng nghiệp': 3,
    'HĐ trải nghiệm, hướng nghiệp': 3,
    'HĐTN': 3,
  },
  8: {
    'Toán': 4,
    'Toán học': 4,
    'KHTN': 4,
    'Khoa học tự nhiên': 4,
    'KHTN - Vật lí': 1.5,
    'Vật lí': 1.5,
    'Lý 8-9': 1.5,
    'KHTN - Hóa học': 1.5,
    'Hóa học': 1.5,
    'Hóa 8-9': 1.5,
    'KHTN - Sinh học': 1,
    'Sinh học': 1,
    'Sinh 8-9': 1,
    'Công nghệ': 1,
    'C.Nghệ': 1,
    'Tin học': 1,
    'Tin': 1,
    'GDTC': 2,
    'Giáo dục thể chất': 2,
    'Thể dục': 2,
    'Ngữ văn': 4,
    'Văn': 4,
    'Tiếng anh': 3,
    'Tiếng Anh': 3,
    'T.Anh': 3,
    'Lịch sử & Địa lý': 3,
    'Lịch sử và Địa lí': 3,
    'Sử - Địa': 3,
    'GDCD': 1,
    'Giáo dục công dân': 1,
    'Nghệ thuật (Âm nhạc, Mĩ thuật)': 2,
    'Nghệ thuật': 2,
    'Âm nhạc': 1,
    'Nhạc': 1,
    'Mĩ thuật': 1,
    'Mỹ thuật': 1,
    'M.Thuật': 1,
    'GDĐP (Giáo dục địa phương)': 1,
    'Giáo dục địa phương': 1,
    'Nội dung giáo dục địa phương': 1,
    'GDĐP': 1,
    'HĐTNHN (Hoạt động TN, HN)': 3,
    'Hoạt động trải nghiệm, hướng nghiệp': 3,
    'HĐ trải nghiệm, hướng nghiệp': 3,
    'HĐTN': 3,
  },
  9: {
    'Toán': 4,
    'Toán học': 4,
    'KHTN': 4,
    'Khoa học tự nhiên': 4,
    'KHTN - Vật lí': 1.5,
    'Vật lí': 1.5,
    'Lý 8-9': 1.5,
    'KHTN - Hóa học': 1.5,
    'Hóa học': 1.5,
    'Hóa 8-9': 1.5,
    'KHTN - Sinh học': 1,
    'Sinh học': 1,
    'Sinh 8-9': 1,
    'Công nghệ': 1,
    'C.Nghệ': 1,
    'Tin học': 1,
    'Tin': 1,
    'GDTC': 2,
    'Giáo dục thể chất': 2,
    'Thể dục': 2,
    'Ngữ văn': 4,
    'Văn': 4,
    'Tiếng anh': 3,
    'Tiếng Anh': 3,
    'T.Anh': 3,
    'Lịch sử & Địa lý': 3,
    'Lịch sử và Địa lí': 3,
    'Sử - Địa': 3,
    'GDCD': 1,
    'Giáo dục công dân': 1,
    'Nghệ thuật (Âm nhạc, Mĩ thuật)': 2,
    'Nghệ thuật': 2,
    'Âm nhạc': 1,
    'Nhạc': 1,
    'Mĩ thuật': 1,
    'Mỹ thuật': 1,
    'M.Thuật': 1,
    'GDĐP (Giáo dục địa phương)': 1,
    'Giáo dục địa phương': 1,
    'Nội dung giáo dục địa phương': 1,
    'GDĐP': 1,
    'HĐTNHN (Hoạt động TN, HN)': 3,
    'Hoạt động trải nghiệm, hướng nghiệp': 3,
    'HĐ trải nghiệm, hướng nghiệp': 3,
    'HĐTN': 3,
  },
};

// =========================================================================
// DỮ LIỆU CHUẨN GỐC THCS QUỲ HỢP (BENCHMARK DATA)
// =========================================================================

// 1.1. KHỐI 6 (11 lớp, 35 tuần)
export const GRADE_6_PLAN: GradePlanData = {
  grade: 6,
  gradeName: 'Khối 6',
  totalClasses: 11,
  subjects: [
    { stt: 1, subjectName: 'Toán', periodsPerWeek: 4, session1Classes: 11, session1Periods: 1540, session1Hk1Periods: 792, session1Hk2Periods: 748, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1820 },
    { stt: 2, subjectName: 'KHTN', periodsPerWeek: 4, session1Classes: 11, session1Periods: 1540, session1Hk1Periods: 792, session1Hk2Periods: 748, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 2, session2PdPeriods: 70, totalPeriods: 1610 },
    { stt: 3, subjectName: 'Công nghệ', periodsPerWeek: 1, session1Classes: 11, session1Periods: 385, session1Hk1Periods: 198, session1Hk2Periods: 187, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 385 },
    { stt: 4, subjectName: 'Tin học', periodsPerWeek: 1, session1Classes: 11, session1Periods: 385, session1Hk1Periods: 198, session1Hk2Periods: 187, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 385 },
    { stt: 5, subjectName: 'GDTC', periodsPerWeek: 2, session1Classes: 11, session1Periods: 770, session1Hk1Periods: 396, session1Hk2Periods: 374, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 770 },
    { stt: 6, subjectName: 'Ngữ văn', periodsPerWeek: 4, session1Classes: 11, session1Periods: 1540, session1Hk1Periods: 792, session1Hk2Periods: 748, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1820 },
    { stt: 7, subjectName: 'Tiếng anh', periodsPerWeek: 3, session1Classes: 11, session1Periods: 1155, session1Hk1Periods: 594, session1Hk2Periods: 561, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1435 },
    { stt: 8, subjectName: 'Lịch sử & Địa lý', periodsPerWeek: 3, session1Classes: 11, session1Periods: 1155, session1Hk1Periods: 594, session1Hk2Periods: 561, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1155 },
    { stt: 9, subjectName: 'GDCD', periodsPerWeek: 1, session1Classes: 11, session1Periods: 385, session1Hk1Periods: 198, session1Hk2Periods: 187, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 385 },
    { stt: 10, subjectName: 'Nghệ thuật (Âm nhạc, Mĩ thuật)', periodsPerWeek: 2, session1Classes: 11, session1Periods: 770, session1Hk1Periods: 396, session1Hk2Periods: 374, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 770 },
    { stt: 11, subjectName: 'GDĐP (Giáo dục địa phương)', periodsPerWeek: 1, session1Classes: 11, session1Periods: 385, session1Hk1Periods: 198, session1Hk2Periods: 187, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 385 },
    { stt: 12, subjectName: 'HĐTNHN (Hoạt động TN, HN)', periodsPerWeek: 3, session1Classes: 11, session1Periods: 1155, session1Hk1Periods: 594, session1Hk2Periods: 561, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1155 },
  ],
  totalSession1Classes: 132,
  totalSession1Periods: 11165,
  totalSession1Hk1Periods: 5742,
  totalSession1Hk2Periods: 5423,
  totalSession2BdClasses: 3,
  totalSession2BdPeriods: 210,
  totalSession2PdClasses: 8,
  totalSession2PdPeriods: 700,
  totalSession2Periods: 910,
  grandTotalPeriods: 12075,
  grandTotalHk1Periods: 6210,
  grandTotalHk2Periods: 5865,
};

// 1.2. KHỐI 7 (10 lớp, 35 tuần)
export const GRADE_7_PLAN: GradePlanData = {
  grade: 7,
  gradeName: 'Khối 7',
  totalClasses: 10,
  subjects: [
    { stt: 1, subjectName: 'Toán', periodsPerWeek: 4, session1Classes: 10, session1Periods: 1400, session1Hk1Periods: 720, session1Hk2Periods: 680, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1680 },
    { stt: 2, subjectName: 'KHTN', periodsPerWeek: 4, session1Classes: 10, session1Periods: 1400, session1Hk1Periods: 720, session1Hk2Periods: 680, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 2, session2PdPeriods: 70, totalPeriods: 1470 },
    { stt: 3, subjectName: 'Công nghệ', periodsPerWeek: 1, session1Classes: 10, session1Periods: 350, session1Hk1Periods: 180, session1Hk2Periods: 170, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 350 },
    { stt: 4, subjectName: 'Tin học', periodsPerWeek: 1, session1Classes: 10, session1Periods: 350, session1Hk1Periods: 180, session1Hk2Periods: 170, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 350 },
    { stt: 5, subjectName: 'GDTC', periodsPerWeek: 2, session1Classes: 10, session1Periods: 700, session1Hk1Periods: 360, session1Hk2Periods: 340, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 700 },
    { stt: 6, subjectName: 'Ngữ văn', periodsPerWeek: 4, session1Classes: 10, session1Periods: 1400, session1Hk1Periods: 720, session1Hk2Periods: 680, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1680 },
    { stt: 7, subjectName: 'Tiếng anh', periodsPerWeek: 3, session1Classes: 10, session1Periods: 1050, session1Hk1Periods: 540, session1Hk2Periods: 510, session2BdClasses: 1, session2BdPeriods: 70, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1330 },
    { stt: 8, subjectName: 'Lịch sử & Địa lý', periodsPerWeek: 3, session1Classes: 10, session1Periods: 1050, session1Hk1Periods: 540, session1Hk2Periods: 510, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1050 },
    { stt: 9, subjectName: 'GDCD', periodsPerWeek: 1, session1Classes: 10, session1Periods: 350, session1Hk1Periods: 180, session1Hk2Periods: 170, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 350 },
    { stt: 10, subjectName: 'Nghệ thuật (Âm nhạc, Mĩ thuật)', periodsPerWeek: 2, session1Classes: 10, session1Periods: 700, session1Hk1Periods: 360, session1Hk2Periods: 340, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 700 },
    { stt: 11, subjectName: 'GDĐP (Giáo dục địa phương)', periodsPerWeek: 1, session1Classes: 10, session1Periods: 350, session1Hk1Periods: 180, session1Hk2Periods: 170, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 350 },
    { stt: 12, subjectName: 'HĐTNHN (Hoạt động TN, HN)', periodsPerWeek: 3, session1Classes: 10, session1Periods: 1050, session1Hk1Periods: 540, session1Hk2Periods: 510, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1050 },
  ],
  totalSession1Classes: 120,
  totalSession1Periods: 10150,
  totalSession1Hk1Periods: 5220,
  totalSession1Hk2Periods: 4930,
  totalSession2BdClasses: 3,
  totalSession2BdPeriods: 210,
  totalSession2PdClasses: 8,
  totalSession2PdPeriods: 700,
  totalSession2Periods: 910,
  grandTotalPeriods: 11060,
  grandTotalHk1Periods: 5688,
  grandTotalHk2Periods: 5372,
};

// 1.3. KHỐI 8 (6 lớp theo biểu khung, 35 tuần)
export const GRADE_8_PLAN: GradePlanData = {
  grade: 8,
  gradeName: 'Khối 8',
  totalClasses: 6,
  subjects: [
    { stt: 1, subjectName: 'Toán', periodsPerWeek: 6, session1Classes: 6, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 1, session2BdPeriods: 105, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1575 },
    { stt: 2, subjectName: 'KHTN', periodsPerWeek: 6, session1Classes: 6, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 2, session2PdPeriods: 70, totalPeriods: 1330 },
    { stt: 3, subjectName: 'Công nghệ', periodsPerWeek: 2.228, session1Classes: 6, session1Periods: 468, session1Hk1Periods: 241, session1Hk2Periods: 227, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 468 },
    { stt: 4, subjectName: 'Tin học', periodsPerWeek: 1.5, session1Classes: 6, session1Periods: 315, session1Hk1Periods: 162, session1Hk2Periods: 153, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 315 },
    { stt: 5, subjectName: 'GDTC', periodsPerWeek: 3, session1Classes: 6, session1Periods: 630, session1Hk1Periods: 324, session1Hk2Periods: 306, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 630 },
    { stt: 6, subjectName: 'Ngữ văn', periodsPerWeek: 6, session1Classes: 6, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 1, session2BdPeriods: 105, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1575 },
    { stt: 7, subjectName: 'Tiếng anh', periodsPerWeek: 4.5, session1Classes: 6, session1Periods: 945, session1Hk1Periods: 486, session1Hk2Periods: 459, session2BdClasses: 1, session2BdPeriods: 105, session2PdClasses: 2, session2PdPeriods: 210, totalPeriods: 1260 },
    { stt: 8, subjectName: 'Lịch sử & Địa lý', periodsPerWeek: 4.5, session1Classes: 6, session1Periods: 945, session1Hk1Periods: 486, session1Hk2Periods: 459, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 945 },
    { stt: 9, subjectName: 'GDCD', periodsPerWeek: 1.5, session1Classes: 6, session1Periods: 315, session1Hk1Periods: 162, session1Hk2Periods: 153, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 315 },
    { stt: 10, subjectName: 'Nghệ thuật (Âm nhạc, Mĩ thuật)', periodsPerWeek: 3, session1Classes: 6, session1Periods: 630, session1Hk1Periods: 324, session1Hk2Periods: 306, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 630 },
    { stt: 11, subjectName: 'GDĐP (Giáo dục địa phương)', periodsPerWeek: 1.5, session1Classes: 6, session1Periods: 315, session1Hk1Periods: 162, session1Hk2Periods: 153, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 315 },
    { stt: 12, subjectName: 'HĐTNHN (Hoạt động TN, HN)', periodsPerWeek: 4.5, session1Classes: 6, session1Periods: 945, session1Hk1Periods: 486, session1Hk2Periods: 459, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 945 },
  ],
  totalSession1Classes: 72,
  totalSession1Periods: 9288,
  totalSession1Hk1Periods: 4777,
  totalSession1Hk2Periods: 4511,
  totalSession2BdClasses: 3,
  totalSession2BdPeriods: 315,
  totalSession2PdClasses: 8,
  totalSession2PdPeriods: 700,
  totalSession2Periods: 1015,
  grandTotalPeriods: 10303,
  grandTotalHk1Periods: 5299,
  grandTotalHk2Periods: 5004,
};

// 1.4. KHỐI 9 (12 lớp, 35 tuần)
export const GRADE_9_PLAN: GradePlanData = {
  grade: 9,
  gradeName: 'Khối 9',
  totalClasses: 12,
  subjects: [
    { stt: 1, subjectName: 'Toán', periodsPerWeek: 4, session1Classes: 12, session1Periods: 1680, session1Hk1Periods: 864, session1Hk2Periods: 816, session2BdClasses: 1, session2BdPeriods: 45, session2PdClasses: 0, session2PdPeriods: 0, session2ExamClasses: 12, session2ExamPeriods: 840, totalPeriods: 2565 },
    { stt: 2, subjectName: 'KHTN', periodsPerWeek: 4, session1Classes: 12, session1Periods: 1680, session1Hk1Periods: 864, session1Hk2Periods: 816, session2BdClasses: 3, session2BdPeriods: 135, session2BdDetail: 'Lý, Hóa, Sinh', session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1815 },
    { stt: 3, subjectName: 'Công nghệ', periodsPerWeek: 1.485, session1Classes: 12, session1Periods: 624, session1Hk1Periods: 321, session1Hk2Periods: 303, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 624 },
    { stt: 4, subjectName: 'Tin học', periodsPerWeek: 1, session1Classes: 12, session1Periods: 420, session1Hk1Periods: 216, session1Hk2Periods: 204, session2BdClasses: 1, session2BdPeriods: 45, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 465 },
    { stt: 5, subjectName: 'GDTC', periodsPerWeek: 2, session1Classes: 12, session1Periods: 840, session1Hk1Periods: 432, session1Hk2Periods: 408, session2BdClasses: 7, session2BdPeriods: 210, session2BdDetail: 'Bóng đá, Bóng chuyền, Bóng bàn, Cầu lông, Đá cầu, Điền kinh, Cờ vua', session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1050 },
    { stt: 6, subjectName: 'Ngữ văn', periodsPerWeek: 4, session1Classes: 12, session1Periods: 1680, session1Hk1Periods: 864, session1Hk2Periods: 816, session2BdClasses: 1, session2BdPeriods: 45, session2PdClasses: 0, session2PdPeriods: 0, session2ExamClasses: 12, session2ExamPeriods: 840, totalPeriods: 2565 },
    { stt: 7, subjectName: 'Tiếng anh', periodsPerWeek: 3, session1Classes: 12, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 1, session2BdPeriods: 45, session2PdClasses: 0, session2PdPeriods: 0, session2ExamClasses: 12, session2ExamPeriods: 840, totalPeriods: 2145 },
    { stt: 8, subjectName: 'Lịch sử & Địa lý', periodsPerWeek: 3, session1Classes: 12, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 2, session2BdPeriods: 90, session2BdDetail: 'Lịch sử, Địa lí', session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1350 },
    { stt: 9, subjectName: 'GDCD', periodsPerWeek: 1, session1Classes: 12, session1Periods: 420, session1Hk1Periods: 216, session1Hk2Periods: 204, session2BdClasses: 1, session2BdPeriods: 45, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 465 },
    { stt: 10, subjectName: 'Nghệ thuật (Âm nhạc, Mĩ thuật)', periodsPerWeek: 2, session1Classes: 12, session1Periods: 840, session1Hk1Periods: 432, session1Hk2Periods: 408, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 840 },
    { stt: 11, subjectName: 'GDĐP (Giáo dục địa phương)', periodsPerWeek: 1, session1Classes: 12, session1Periods: 420, session1Hk1Periods: 216, session1Hk2Periods: 204, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 420 },
    { stt: 12, subjectName: 'HĐTNHN (Hoạt động TN, HN)', periodsPerWeek: 3, session1Classes: 12, session1Periods: 1260, session1Hk1Periods: 648, session1Hk2Periods: 612, session2BdClasses: 0, session2BdPeriods: 0, session2PdClasses: 0, session2PdPeriods: 0, totalPeriods: 1260 },
  ],
  totalSession1Classes: 144,
  totalSession1Periods: 12384,
  totalSession1Hk1Periods: 6369,
  totalSession1Hk2Periods: 6015,
  totalSession2BdClasses: 17,
  totalSession2BdPeriods: 660,
  totalSession2PdClasses: 0,
  totalSession2PdPeriods: 0,
  totalSession2ExamClasses: 36,
  totalSession2ExamPeriods: 2520,
  totalSession2Periods: 3180,
  grandTotalPeriods: 15564,
  grandTotalHk1Periods: 8004,
  grandTotalHk2Periods: 7560,
};

export const ALL_GRADE_PLANS: GradePlanData[] = [
  GRADE_6_PLAN,
  GRADE_7_PLAN,
  GRADE_8_PLAN,
  GRADE_9_PLAN,
];

// 2. TỔNG SỐ TIẾT KIÊM NHIỆM TOÀN TRƯỜNG (BENCHMARK)
export const CONCURRENT_DUTIES_PLAN: ConcurrentDutyRow[] = [
  {
    stt: 1,
    dutyName: 'Tổ trưởng chuyên môn',
    periodsPerWeek: 9,
    inChargeTeachers: 'Phan Tâm, Cường, Toàn',
    teacherCount: 3,
    periodsPerYear: 315,
    periodsHk1: 162,
    periodsHk2: 153,
    notes: '3 tổ trưởng x 3 tiết/tuần = 9 tiết/tuần (315 tiết/năm)',
  },
  {
    stt: 2,
    dutyName: 'Tổ phó chuyên môn',
    periodsPerWeek: 6,
    inChargeTeachers: 'Cao An, Lê Thắm, Hồ Nga, Hoàng Thảo, Khang, Lộc',
    teacherCount: 6,
    periodsPerYear: 210,
    periodsHk1: 108,
    periodsHk2: 102,
    notes: '6 tổ phó x 1 tiết/tuần = 6 tiết/tuần (210 tiết/năm)',
  },
  {
    stt: 3,
    dutyName: 'Trưởng ban Thanh tra nhân dân',
    periodsPerWeek: 2,
    inChargeTeachers: 'Công An',
    teacherCount: 1,
    periodsPerYear: 70,
    periodsHk1: 36,
    periodsHk2: 34,
    notes: '1 người x 2 tiết/tuần = 2 tiết/tuần (70 tiết/năm)',
  },
  {
    stt: 4,
    dutyName: 'Tư vấn tâm lý học đường',
    periodsPerWeek: 8,
    inChargeTeachers: 'Khang',
    teacherCount: 1,
    periodsPerYear: 280,
    periodsHk1: 144,
    periodsHk2: 136,
    notes: '8 tiết/tuần = 280 tiết/năm',
  },
  {
    stt: 5,
    dutyName: 'Phụ trách vườn trường',
    periodsPerWeek: 2,
    inChargeTeachers: 'Bính',
    teacherCount: 1,
    periodsPerYear: 70,
    periodsHk1: 36,
    periodsHk2: 34,
    notes: '2 tiết/tuần = 70 tiết/năm',
  },
  {
    stt: 6,
    dutyName: 'Phụ trách phòng Tin học',
    periodsPerWeek: 3,
    inChargeTeachers: 'Uyên, Giang, Nghĩa',
    teacherCount: 3,
    periodsPerYear: 105,
    periodsHk1: 54,
    periodsHk2: 51,
    notes: '3 người x 1 tiết/tuần = 3 tiết/tuần (105 tiết/năm)',
  },
  {
    stt: 7,
    dutyName: 'Thư ký Hội đồng trường',
    periodsPerWeek: 2,
    inChargeTeachers: 'Nghĩa',
    teacherCount: 1,
    periodsPerYear: 70,
    periodsHk1: 36,
    periodsHk2: 34,
    notes: '2 tiết/tuần = 70 tiết/năm',
  },
  {
    stt: 8,
    dutyName: 'Bí thư Đoàn trường / Chi đoàn GV',
    periodsPerWeek: 2,
    inChargeTeachers: 'Tiến Anh',
    teacherCount: 1,
    periodsPerYear: 70,
    periodsHk1: 36,
    periodsHk2: 34,
    notes: '2 tiết/tuần = 70 tiết/năm',
  },
  {
    stt: 9,
    dutyName: 'Chủ nhiệm lớp 9',
    periodsPerWeek: 48,
    inChargeTeachers: 'Lợi, C An, Dũng, Thiện, Đào, Hải, Hoa Lý, Vị, Loan, Thương, Dương Hà, Đức',
    teacherCount: 12,
    periodsPerYear: 1680,
    periodsHk1: 864,
    periodsHk2: 816,
    notes: '12 lớp x 4 tiết/tuần = 48 tiết/tuần (1.680 tiết/năm)',
    isHomeroom: true,
    grade: 9,
  },
  {
    stt: 10,
    dutyName: 'Chủ nhiệm lớp 8',
    periodsPerWeek: 36,
    inChargeTeachers: 'Phú, Sen, Lưu Thanh, N. Tâm, Ngọc Mai, Nguyễn Thảo, Nguyễn Thị Tố Uyên, Trung, Đạt',
    teacherCount: 9,
    periodsPerYear: 1260,
    periodsHk1: 648,
    periodsHk2: 612,
    notes: '9 lớp x 4 tiết/tuần = 36 tiết/tuần (1.260 tiết/năm)',
    isHomeroom: true,
    grade: 8,
  },
  {
    stt: 11,
    dutyName: 'Chủ nhiệm lớp 7',
    periodsPerWeek: 40,
    inChargeTeachers: 'H. Nga, Hiền, Văn, Hoàng, Trương Hải, Trần Hương, Thu Hương, Lô Nhung, Tùng, Truyền',
    teacherCount: 10,
    periodsPerYear: 1400,
    periodsHk1: 720,
    periodsHk2: 680,
    notes: '10 lớp x 4 tiết/tuần = 40 tiết/tuần (1.400 tiết/năm)',
    isHomeroom: true,
    grade: 7,
  },
  {
    stt: 12,
    dutyName: 'Chủ nhiệm lớp 6',
    periodsPerWeek: 44,
    inChargeTeachers: 'Thắm, P. Hà, N Thủy, Chung, H Thảo, Tiến Anh, Giang, Nhung, Vinh, Nam, Thuỳ',
    teacherCount: 11,
    periodsPerYear: 1540,
    periodsHk1: 792,
    periodsHk2: 748,
    notes: '11 lớp x 4 tiết/tuần = 44 tiết/tuần (1.540 tiết/năm)',
    isHomeroom: true,
    grade: 6,
  },
];

export const TOTAL_CONCURRENT_PERIODS_PER_WEEK = 199;
export const TOTAL_CONCURRENT_PERIODS_PER_YEAR = 6965;

// 3. TỔNG HỢP SỐ TIẾT TOÀN TRƯỜNG & CÂN ĐỐI ĐỊNH MỨC (BENCHMARK)
export const OFFICIAL_SCHOOL_TOTAL_SUMMARY: SchoolTotalSummary = {
  session1Periods: 42987,       // Buổi 1 (4 khối)
  session1Hk1Periods: 22108,
  session1Hk2Periods: 20879,
  session2Periods: 6015,        // Buổi 2 (BD + PĐ + Ôn thi)
  session2Hk1Periods: 3093,
  session2Hk2Periods: 2922,
  concurrentPeriods: 6965,      // Kiêm nhiệm toàn trường
  concurrentHk1Periods: 3582,
  concurrentHk2Periods: 3383,
  totalAssignedPeriods: 55967,  // (1) = 42.987 + 6.015 + 6.965
  totalAssignedHk1Periods: 28783,
  totalAssignedHk2Periods: 27184,
  standardQuotaPeriods: 49630,  // (2) = 49.630 tiết định mức (74 GV x 19t x 35w + HT 70t + 2 PHT 280t + TPTĐ 70t)
  standardQuotaHk1Periods: 25524,
  standardQuotaHk2Periods: 24106,
  overtimePeriods: 6337,        // (1) - (2) = 6.337 tiết vượt giờ
  overtimeHk1Periods: 3259,
  overtimeHk2Periods: 3078,
  teacherCountDirect: 74,
  principalPeriods: 70,         // Hiệu trưởng (2 tiết/tuần x 35w)
  vicePrincipalPeriods: 280,    // 2 Phó hiệu trưởng (2 x 4 tiết/tuần x 35w)
  teamLeaderPeriods: 70,        // TPT Đội trường 42 lớp (2 tiết/tuần x 35w)
  totalClasses: 42,
  totalWeeks: 35,
  weeksHk1: 18,
  weeksHk2: 17,
};

// =========================================================================
// HÀM TÍNH TOÁN ĐỘNG THEO CÔNG THỨC (DYNAMIC FORMULA ENGINE)
// =========================================================================

/**
 * Tái tính toán toàn bộ số tiết của một khối khi số lớp thay đổi hoặc số tiết/tuần thay đổi
 */
export const recalculateGradePlan = (
  basePlan: GradePlanData,
  newClassCount: number,
  weeksYear = 35,
  weeksHk1 = 18,
  weeksHk2 = 17
): GradePlanData => {
  const updatedSubjects: GradeSubjectRow[] = basePlan.subjects.map((subj) => {
    const ppw = subj.periodsPerWeek || 0;
    // Buổi 1: số lớp = newClassCount
    const s1Classes = newClassCount;
    // Số tiết cả năm = số lớp * số tiết/tuần * số tuần/năm
    const s1Periods = newClassCount > 0 ? Math.round(s1Classes * ppw * weeksYear) : 0;
    const s1Hk1 = newClassCount > 0 ? Math.round(s1Classes * ppw * weeksHk1) : 0;
    const s1Hk2 = s1Periods - s1Hk1;

    // Buổi 2: nếu số lớp = 0 thì không có tiết buổi 2
    const s2BdPeriods = newClassCount > 0 ? subj.session2BdPeriods : 0;
    const s2PdPeriods = newClassCount > 0 ? subj.session2PdPeriods : 0;
    const s2ExamPeriods = newClassCount > 0 ? (subj.session2ExamPeriods || 0) : 0;
    const totalS2 = s2BdPeriods + s2PdPeriods + s2ExamPeriods;

    const totalYear = s1Periods + totalS2;
    const totalHk1 = s1Hk1 + (newClassCount > 0 ? Math.round(totalS2 * (weeksHk1 / weeksYear)) : 0);
    const totalHk2 = totalYear - totalHk1;

    return {
      ...subj,
      session1Classes: s1Classes,
      session1Periods: s1Periods,
      session1Hk1Periods: s1Hk1,
      session1Hk2Periods: s1Hk2,
      session2BdPeriods: s2BdPeriods,
      session2PdPeriods: s2PdPeriods,
      session2ExamPeriods: s2ExamPeriods,
      totalPeriods: totalYear,
      totalHk1Periods: totalHk1,
      totalHk2Periods: totalHk2,
    };
  });

  const totalSession1Classes = updatedSubjects.reduce((sum, s) => sum + s.session1Classes, 0);
  const totalSession1Periods = updatedSubjects.reduce((sum, s) => sum + s.session1Periods, 0);
  const totalSession1Hk1Periods = updatedSubjects.reduce((sum, s) => sum + (s.session1Hk1Periods || 0), 0);
  const totalSession1Hk2Periods = updatedSubjects.reduce((sum, s) => sum + (s.session1Hk2Periods || 0), 0);

  const totalSession2BdClasses = updatedSubjects.reduce((sum, s) => sum + s.session2BdClasses, 0);
  const totalSession2BdPeriods = updatedSubjects.reduce((sum, s) => sum + s.session2BdPeriods, 0);
  const totalSession2PdClasses = updatedSubjects.reduce((sum, s) => sum + s.session2PdClasses, 0);
  const totalSession2PdPeriods = updatedSubjects.reduce((sum, s) => sum + s.session2PdPeriods, 0);
  const totalSession2ExamClasses = updatedSubjects.reduce((sum, s) => sum + (s.session2ExamClasses || 0), 0);
  const totalSession2ExamPeriods = updatedSubjects.reduce((sum, s) => sum + (s.session2ExamPeriods || 0), 0);

  const totalSession2Periods = totalSession2BdPeriods + totalSession2PdPeriods + totalSession2ExamPeriods;
  const grandTotalPeriods = totalSession1Periods + totalSession2Periods;
  const grandTotalHk1Periods = totalSession1Hk1Periods + Math.round(totalSession2Periods * (weeksHk1 / weeksYear));
  const grandTotalHk2Periods = grandTotalPeriods - grandTotalHk1Periods;

  return {
    ...basePlan,
    totalClasses: newClassCount,
    subjects: updatedSubjects,
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
};

/**
 * Tái tính toán bảng kiêm nhiệm khi số lớp các khối thay đổi (đặc biệt là GVCN)
 */
export const recalculateConcurrentDuties = (
  duties: ConcurrentDutyRow[],
  classCounts: Record<number, number>,
  weeksYear = 35,
  weeksHk1 = 18,
  weeksHk2 = 17
): ConcurrentDutyRow[] => {
  return duties.map((duty) => {
    let ppw = duty.periodsPerWeek;
    let tCount = duty.teacherCount;

    // Nếu là nhiệm vụ Chủ nhiệm lớp
    if (duty.isHomeroom && duty.grade && classCounts[duty.grade] !== undefined) {
      const gradeClasses = classCounts[duty.grade];
      ppw = gradeClasses * 4; // Mỗi lớp 4 tiết/tuần
      tCount = gradeClasses;
    }

    const periodsPerYear = ppw * weeksYear;
    const periodsHk1 = ppw * weeksHk1;
    const periodsHk2 = ppw * weeksHk2;

    return {
      ...duty,
      periodsPerWeek: ppw,
      teacherCount: tCount,
      periodsPerYear,
      periodsHk1,
      periodsHk2,
    };
  });
};

/**
 * Tái tính toán Tổng hợp số tiết toàn trường & Cân đối định mức, Vượt giờ
 */
export const recalculateSchoolSummary = (
  gradePlans: GradePlanData[],
  duties: ConcurrentDutyRow[],
  teacherCountDirect = 74,
  weeksYear = 35,
  weeksHk1 = 18,
  weeksHk2 = 17
): SchoolTotalSummary => {
  const session1Periods = gradePlans.reduce((sum, g) => sum + g.totalSession1Periods, 0);
  const session1Hk1Periods = gradePlans.reduce((sum, g) => sum + g.totalSession1Hk1Periods, 0);
  const session1Hk2Periods = gradePlans.reduce((sum, g) => sum + g.totalSession1Hk2Periods, 0);

  const session2Periods = gradePlans.reduce((sum, g) => sum + g.totalSession2Periods, 0);
  const session2Hk1Periods = Math.round(session2Periods * (weeksHk1 / weeksYear));
  const session2Hk2Periods = session2Periods - session2Hk1Periods;

  const concurrentPeriods = duties.reduce((sum, d) => sum + d.periodsPerYear, 0);
  const concurrentHk1Periods = duties.reduce((sum, d) => sum + (d.periodsHk1 || d.periodsPerWeek * weeksHk1), 0);
  const concurrentHk2Periods = duties.reduce((sum, d) => sum + (d.periodsHk2 || d.periodsPerWeek * weeksHk2), 0);

  const totalAssignedPeriods = session1Periods + session2Periods + concurrentPeriods;
  const totalAssignedHk1Periods = session1Hk1Periods + session2Hk1Periods + concurrentHk1Periods;
  const totalAssignedHk2Periods = session1Hk2Periods + session2Hk2Periods + concurrentHk2Periods;

  const totalClasses = gradePlans.reduce((sum, g) => sum + g.totalClasses, 0);
  const hasStaffOrClasses = teacherCountDirect > 0 || totalClasses > 0;

  // Định mức trường:
  // GV giảng dạy x 19 tiết/tuần x 35 tuần
  // + Hiệu trưởng (2 tiết/tuần x 35w = 70 tiết)
  // + 2 Phó HT (2 x 4 tiết/tuần x 35w = 280 tiết)
  // + TPT Đội (2 tiết/tuần x 35w = 70 tiết)
  const principalPeriodsYear = hasStaffOrClasses ? 2 * weeksYear : 0;
  const vicePrincipalPeriodsYear = hasStaffOrClasses ? 2 * 4 * weeksYear : 0;
  const teamLeaderPeriodsYear = hasStaffOrClasses ? 2 * weeksYear : 0;
  const teachersDirectPeriodsYear = teacherCountDirect * 19 * weeksYear;

  const standardQuotaPeriods = hasStaffOrClasses
    ? teachersDirectPeriodsYear + principalPeriodsYear + vicePrincipalPeriodsYear + teamLeaderPeriodsYear
    : 0;

  const principalPeriodsHk1 = hasStaffOrClasses ? 2 * weeksHk1 : 0;
  const vicePrincipalPeriodsHk1 = hasStaffOrClasses ? 2 * 4 * weeksHk1 : 0;
  const teamLeaderPeriodsHk1 = hasStaffOrClasses ? 2 * weeksHk1 : 0;
  const teachersDirectPeriodsHk1 = teacherCountDirect * 19 * weeksHk1;
  const standardQuotaHk1Periods = hasStaffOrClasses
    ? teachersDirectPeriodsHk1 + principalPeriodsHk1 + vicePrincipalPeriodsHk1 + teamLeaderPeriodsHk1
    : 0;
  const standardQuotaHk2Periods = standardQuotaPeriods - standardQuotaHk1Periods;

  const overtimePeriods = hasStaffOrClasses ? totalAssignedPeriods - standardQuotaPeriods : 0;
  const overtimeHk1Periods = hasStaffOrClasses ? totalAssignedHk1Periods - standardQuotaHk1Periods : 0;
  const overtimeHk2Periods = hasStaffOrClasses ? totalAssignedHk2Periods - standardQuotaHk2Periods : 0;

  return {
    session1Periods,
    session1Hk1Periods,
    session1Hk2Periods,
    session2Periods,
    session2Hk1Periods,
    session2Hk2Periods,
    concurrentPeriods,
    concurrentHk1Periods,
    concurrentHk2Periods,
    totalAssignedPeriods,
    totalAssignedHk1Periods,
    totalAssignedHk2Periods,
    standardQuotaPeriods,
    standardQuotaHk1Periods,
    standardQuotaHk2Periods,
    overtimePeriods,
    overtimeHk1Periods,
    overtimeHk2Periods,
    teacherCountDirect,
    principalPeriods: principalPeriodsYear,
    vicePrincipalPeriods: vicePrincipalPeriodsYear,
    teamLeaderPeriods: teamLeaderPeriodsYear,
    totalClasses,
    totalWeeks: weeksYear,
    weeksHk1,
    weeksHk2,
  };
};

export const STORAGE_KEY_TEACHING_PLAN = 'pccm_teaching_plan_framework_v2';
