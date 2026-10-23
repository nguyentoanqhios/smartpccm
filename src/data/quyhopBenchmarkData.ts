/**
 * DỮ LIỆU CHUẨN GỐC 42 LỚP - TRƯỜNG THCS QUỲ HỢP
 * Năm học 2026-2027 (Chương trình GDPT 2018)
 * 
 * Quy mô:
 * - 42 Lớp học:
 *   + Khối 6: 11 lớp (6A1 -> 6A11)
 *   + Khối 7: 10 lớp (7A1 -> 7A10)
 *   + Khối 8: 9 lớp (8A1 -> 8A9)
 *   + Khối 9: 12 lớp (9A1 -> 9A12)
 * - 74 Giáo viên trực tiếp giảng dạy + Ban Giám hiệu (1 HT, 2 PHT) + TPT Đội
 * - Phân công chủ nhiệm 42 lớp chuẩn xác theo chỉ đạo
 * - Phân công kiêm nhiệm & giảng dạy Buổi 1 + Buổi 2 (Bồi dưỡng, Phụ đạo, Ôn thi lớp 9)
 */

import {
  SchoolClass,
  Teacher,
  Department,
  TeachingAssignment,
  CurriculumDistribution,
  SpecialDuty,
  SchoolInfo,
  SchoolBranch,
} from '../types';

export const QUYHOP_SCHOOL_INFO: SchoolInfo = {
  schoolName: 'TRƯỜNG THCS QUỲ HỢP',
  branchName: '',
  authorityName: '',
  provinceName: 'NGHỆ AN',
  province: 'Nghệ An',
  district: 'Quỳ Hợp',
  schoolYear: '2026-2027',
  principalName: 'Nguyễn Văn Toàn',
  deanName: 'Trần Văn Minh',
  phone: '0961 285 888',
  email: 'thcsqh@quzhop.edu.vn',
  address: 'Thị trấn Quỳ Hợp, Huyện Quỳ Hợp, Nghệ An',
  notes: 'Quy mô 42 lớp - Năm học 2026-2027',
};

export const QUYHOP_BRANCHES: SchoolBranch[] = [
  {
    id: 'branch_qh_main',
    code: 'DC',
    name: 'Điểm chính (Khu trung tâm)',
    isMain: true,
    address: 'Thị trấn Quỳ Hợp, Nghệ An',
    managerName: 'Ban Giám hiệu',
    notes: 'Khuôn viên trung tâm (28 lớp học)',
    active: true,
    order: 1,
  },
  {
    id: 'branch_qh_sub',
    code: 'PH',
    name: 'Điểm lẻ (Phân hiệu)',
    isMain: false,
    address: 'Khu vực phân hiệu, Huyện Quỳ Hợp, Nghệ An',
    managerName: 'Phó Hiệu trưởng phụ trách',
    notes: 'Khuôn viên cụm phân hiệu (14 lớp học)',
    active: true,
    order: 2,
  },
];

export const QUYHOP_DEPARTMENTS: Department[] = [
  {
    id: 'dept_toan_tin',
    schoolId: 'school_quyhop',
    code: 'TOAN_TIN',
    name: 'Tổ Toán – Tin học',
    fullName: 'Tổ Chuyên môn Toán – Tin học',
    headTeacherId: 'tc_qh_phan_tam',
    deputyTeacherIds: ['tc_qh_cao_an', 'tc_qh_nghia'],
    teacherIds: [],
    active: true,
  },
  {
    id: 'dept_khtn',
    schoolId: 'school_quyhop',
    code: 'KHTN',
    name: 'Tổ Khoa học Tự nhiên',
    fullName: 'Tổ Chuyên môn Khoa học Tự nhiên',
    headTeacherId: 'tc_qh_cuong',
    deputyTeacherIds: ['tc_qh_le_tham', 'tc_qh_binh'],
    teacherIds: [],
    active: true,
  },
  {
    id: 'dept_van_su_dia',
    schoolId: 'school_quyhop',
    code: 'VAN_KHXH',
    name: 'Tổ Ngữ văn – KHXH',
    fullName: 'Tổ Chuyên môn Ngữ văn – Lịch sử & Địa lý – GDCD',
    headTeacherId: 'tc_qh_toan',
    deputyTeacherIds: ['tc_qh_ho_nga', 'tc_qh_hoang_thao'],
    teacherIds: [],
    active: true,
  },
  {
    id: 'dept_ngoai_ngu',
    schoolId: 'school_quyhop',
    code: 'NGOAI_NGU',
    name: 'Tổ Ngoại ngữ',
    fullName: 'Tổ Chuyên môn Tiếng Anh',
    headTeacherId: 'tc_qh_khang',
    deputyTeacherIds: ['tc_qh_loc'],
    teacherIds: [],
    active: true,
  },
  {
    id: 'dept_nghe_thuat_gdtc',
    schoolId: 'school_quyhop',
    code: 'NT_GDTC',
    name: 'Tổ Nghệ thuật – GDTC – Công nghệ',
    fullName: 'Tổ Chuyên môn Nghệ thuật – GDTC – Công nghệ',
    headTeacherId: 'tc_qh_tien_anh',
    deputyTeacherIds: ['tc_qh_vinh'],
    teacherIds: [],
    active: true,
  },
];

// Danh sách Giáo viên trực tiếp & Ban giám hiệu (74 GV trực tiếp + 1 HT + 2 PHT + 1 TPT)
export const RAW_QUYHOP_TEACHERS = [
  // Ban giám hiệu & Cán bộ kiêm nhiệm trọng yếu
  { id: 'tc_qh_ht_toan', code: 'BGH01', name: 'Nguyễn Văn Toàn', dept: 'dept_toan_tin', role: 'Hiệu trưởng', quota: 2, subjects: ['Toán'], isBGH: true },
  { id: 'tc_qh_pht_minh', code: 'BGH02', name: 'Trần Văn Minh', dept: 'dept_khtn', role: 'Phó Hiệu trưởng', quota: 4, subjects: ['KHTN'], isBGH: true },
  { id: 'tc_qh_pht_hai', code: 'BGH03', name: 'Nguyễn Văn Hải', dept: 'dept_van_su_dia', role: 'Phó Hiệu trưởng', quota: 4, subjects: ['Ngữ văn'], isBGH: true },
  { id: 'tc_qh_tpt_tuan', code: 'TPT01', name: 'Lê Anh Tuấn', dept: 'dept_nghe_thuat_gdtc', role: 'Tổng phụ trách Đội', quota: 2, subjects: ['GDTC'] },

  // Tổ trưởng & Tổ phó & Cán bộ kiêm nhiệm
  { id: 'tc_qh_phan_tam', code: 'GV001', name: 'Phan Tâm', dept: 'dept_toan_tin', role: 'Tổ trưởng CM (Toán - Tin)', quota: 16, subjects: ['Toán'] },
  { id: 'tc_qh_cuong', code: 'GV002', name: 'Lê Văn Cường', dept: 'dept_khtn', role: 'Tổ trưởng CM (KHTN)', quota: 16, subjects: ['KHTN'] },
  { id: 'tc_qh_toan', code: 'GV003', name: 'Trần Văn Toàn', dept: 'dept_van_su_dia', role: 'Tổ trưởng CM (Văn - Sử - Địa)', quota: 16, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_cao_an', code: 'GV004', name: 'Cao An', dept: 'dept_toan_tin', role: 'Tổ phó CM, Trưởng ban Thanh tra', quota: 16, subjects: ['Toán'] },
  { id: 'tc_qh_le_tham', code: 'GV005', name: 'Lê Thắm', dept: 'dept_khtn', role: 'Tổ phó CM', quota: 18, subjects: ['KHTN'] },
  { id: 'tc_qh_ho_nga', code: 'GV006', name: 'Hồ Nga', dept: 'dept_van_su_dia', role: 'Tổ phó CM', quota: 18, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_hoang_thao', code: 'GV007', name: 'Hoàng Thảo', dept: 'dept_van_su_dia', role: 'Tổ phó CM', quota: 18, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_khang', code: 'GV008', name: 'Nguyễn Khang', dept: 'dept_ngoai_ngu', role: 'Tổ phó CM, Tư vấn học đường', quota: 10, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_loc', code: 'GV009', name: 'Trần Văn Lộc', dept: 'dept_ngoai_ngu', role: 'Tổ phó CM', quota: 18, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_binh', code: 'GV010', name: 'Nguyễn Văn Bính', dept: 'dept_khtn', role: 'Phụ trách vườn trường', quota: 17, subjects: ['KHTN', 'Công nghệ'] },
  { id: 'tc_qh_uyen', code: 'GV011', name: 'Nguyễn Thị Tố Uyên', dept: 'dept_toan_tin', role: 'Phụ trách phòng Tin học', quota: 18, subjects: ['Tin học'] },
  { id: 'tc_qh_giang', code: 'GV012', name: 'Trần Thị Giang', dept: 'dept_toan_tin', role: 'Phụ trách phòng Tin học', quota: 18, subjects: ['Tin học'] },
  { id: 'tc_qh_nghia', code: 'GV013', name: 'Phạm Trọng Nghĩa', dept: 'dept_toan_tin', role: 'Phụ trách phòng Tin học, Thư ký HĐ trường', quota: 16, subjects: ['Tin học', 'Toán'] },
  { id: 'tc_qh_tien_anh', code: 'GV014', name: 'Đặng Tiến Anh', dept: 'dept_nghe_thuat_gdtc', role: 'Bí thư Đoàn', quota: 17, subjects: ['GDTC'] },

  // Danh sách Giáo viên chủ nhiệm Khối 9 (12 lớp: Lợi, C An, Dũng, Thiện, Đào, Hải, Hoa Lý, Vị, Loan, Thương, Dương Hà, Đức)
  { id: 'tc_qh_loi', code: 'GV015', name: 'Nguyễn Văn Lợi', dept: 'dept_toan_tin', role: 'GVCN 9A1', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_dung', code: 'GV016', name: 'Lê Văn Dũng', dept: 'dept_van_su_dia', role: 'GVCN 9A3', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_thien', code: 'GV017', name: 'Trần Văn Thiện', dept: 'dept_ngoai_ngu', role: 'GVCN 9A4', quota: 15, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_dao', code: 'GV018', name: 'Phạm Thị Đào', dept: 'dept_khtn', role: 'GVCN 9A5', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_hai_9', code: 'GV019', name: 'Trần Văn Hải', dept: 'dept_toan_tin', role: 'GVCN 9A6', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_hoa_ly', code: 'GV020', name: 'Nguyễn Thị Hoa Lý', dept: 'dept_khtn', role: 'GVCN 9A7', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_vi', code: 'GV021', name: 'Đặng Văn Vị', dept: 'dept_van_su_dia', role: 'GVCN 9A8', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_loan', code: 'GV022', name: 'Phan Thị Loan', dept: 'dept_ngoai_ngu', role: 'GVCN 9A9', quota: 15, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_thuong', code: 'GV023', name: 'Lê Thị Thương', dept: 'dept_van_su_dia', role: 'GVCN 9A10', quota: 15, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_duong_ha', code: 'GV024', name: 'Dương Thị Hà', dept: 'dept_van_su_dia', role: 'GVCN 9A11', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_duc', code: 'GV025', name: 'Vũ Minh Đức', dept: 'dept_toan_tin', role: 'GVCN 9A12', quota: 15, subjects: ['Toán'] },

  // Danh sách Giáo viên chủ nhiệm Khối 8 (9 lớp: Phú, Sen, Lưu Thanh, N. Tâm, Ngọc Mai, Nguyễn Thảo, Nguyễn Thị Tố Uyên, Trung, Đạt)
  { id: 'tc_qh_phu', code: 'GV026', name: 'Lê Văn Phú', dept: 'dept_toan_tin', role: 'GVCN 8A1', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_sen', code: 'GV027', name: 'Trần Thị Sen', dept: 'dept_van_su_dia', role: 'GVCN 8A2', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_luu_thanh', code: 'GV028', name: 'Lưu Thị Thanh', dept: 'dept_ngoai_ngu', role: 'GVCN 8A3', quota: 15, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_n_tam', code: 'GV029', name: 'Nguyễn Văn Tâm', dept: 'dept_khtn', role: 'GVCN 8A4', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_ngoc_mai', code: 'GV030', name: 'Đặng Ngọc Mai', dept: 'dept_van_su_dia', role: 'GVCN 8A5', quota: 15, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_nguyen_thao', code: 'GV031', name: 'Nguyễn Thị Thảo', dept: 'dept_van_su_dia', role: 'GVCN 8A6', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_trung', code: 'GV032', name: 'Phạm Quốc Trung', dept: 'dept_toan_tin', role: 'GVCN 8A8', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_dat', code: 'GV033', name: 'Trần Thành Đạt', dept: 'dept_nghe_thuat_gdtc', role: 'GVCN 8A9', quota: 15, subjects: ['GDTC'] },

  // Danh sách Giáo viên chủ nhiệm Khối 7 (10 lớp: H. Nga, Hiền, Văn, Hoàng, Trương Hải, Trần Hương, Thu Hương, Lô Nhung, Tùng, Truyền)
  { id: 'tc_qh_hien', code: 'GV034', name: 'Vũ Thị Hiền', dept: 'dept_toan_tin', role: 'GVCN 7A2', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_van', code: 'GV035', name: 'Nguyễn Văn Văn', dept: 'dept_khtn', role: 'GVCN 7A3', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_hoang', code: 'GV036', name: 'Lê Huy Hoàng', dept: 'dept_van_su_dia', role: 'GVCN 7A4', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_truong_hai', code: 'GV037', name: 'Trương Văn Hải', dept: 'dept_ngoai_ngu', role: 'GVCN 7A5', quota: 15, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_tran_huong', code: 'GV038', name: 'Trần Thu Hương', dept: 'dept_van_su_dia', role: 'GVCN 7A6', quota: 15, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_thu_huong', code: 'GV039', name: 'Nguyễn Thị Thu Hương', dept: 'dept_khtn', role: 'GVCN 7A7', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_lo_nhung', code: 'GV040', name: 'Lô Thị Nhung', dept: 'dept_toan_tin', role: 'GVCN 7A8', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_tung', code: 'GV041', name: 'Hoàng Thanh Tùng', dept: 'dept_nghe_thuat_gdtc', role: 'GVCN 7A9', quota: 15, subjects: ['GDTC'] },
  { id: 'tc_qh_truyen', code: 'GV042', name: 'Đinh Văn Truyền', dept: 'dept_van_su_dia', role: 'GVCN 7A10', quota: 15, subjects: ['Ngữ văn'] },

  // Danh sách Giáo viên chủ nhiệm Khối 6 (11 lớp: Thắm, P. Hà, N Thủy, Chung, H Thảo, Tiến Anh, Giang, Nhung, Vinh, Nam, Thuỳ)
  { id: 'tc_qh_p_ha', code: 'GV043', name: 'Phan Thị Hà', dept: 'dept_van_su_dia', role: 'GVCN 6A2', quota: 15, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_n_thuy', code: 'GV044', name: 'Nguyễn Thị Thủy', dept: 'dept_toan_tin', role: 'GVCN 6A3', quota: 15, subjects: ['Toán'] },
  { id: 'tc_qh_chung', code: 'GV045', name: 'Trần Văn Chung', dept: 'dept_khtn', role: 'GVCN 6A4', quota: 15, subjects: ['KHTN'] },
  { id: 'tc_qh_nhung_6', code: 'GV046', name: 'Phan Thị Nhung', dept: 'dept_ngoai_ngu', role: 'GVCN 6A8', quota: 15, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_vinh', code: 'GV047', name: 'Lê Quang Vinh', dept: 'dept_nghe_thuat_gdtc', role: 'GVCN 6A9', quota: 15, subjects: ['Nghệ thuật'] },
  { id: 'tc_qh_nam', code: 'GV048', name: 'Hoàng Hoài Nam', dept: 'dept_nghe_thuat_gdtc', role: 'GVCN 6A10', quota: 15, subjects: ['GDTC'] },
  { id: 'tc_qh_thuy', code: 'GV049', name: 'Nguyễn Thị Thùy', dept: 'dept_khtn', role: 'GVCN 6A11', quota: 15, subjects: ['KHTN'] },

  // Các thầy cô bộ môn khác đảm bảo đủ 74 giáo viên
  { id: 'tc_qh_gv50', code: 'GV050', name: 'Nguyễn Thị Mai', dept: 'dept_toan_tin', role: 'Giáo viên Toán', quota: 19, subjects: ['Toán'] },
  { id: 'tc_qh_gv51', code: 'GV051', name: 'Trần Đức Bo', dept: 'dept_toan_tin', role: 'Giáo viên Toán', quota: 19, subjects: ['Toán'] },
  { id: 'tc_qh_gv52', code: 'GV052', name: 'Phạm Thị Lan', dept: 'dept_toan_tin', role: 'Giáo viên Toán', quota: 19, subjects: ['Toán'] },
  { id: 'tc_qh_gv53', code: 'GV053', name: 'Hoàng Đình Khiêm', dept: 'dept_toan_tin', role: 'Giáo viên Toán', quota: 19, subjects: ['Toán'] },
  { id: 'tc_qh_gv54', code: 'GV054', name: 'Lê Thị Phương', dept: 'dept_toan_tin', role: 'Giáo viên Tin học', quota: 19, subjects: ['Tin học'] },
  { id: 'tc_qh_gv55', code: 'GV055', name: 'Đặng Quốc Huy', dept: 'dept_khtn', role: 'Giáo viên KHTN (Lý)', quota: 19, subjects: ['KHTN'] },
  { id: 'tc_qh_gv56', code: 'GV056', name: 'Vũ Thị Minh', dept: 'dept_khtn', role: 'Giáo viên KHTN (Hóa)', quota: 19, subjects: ['KHTN'] },
  { id: 'tc_qh_gv57', code: 'GV057', name: 'Nguyễn Thị Hồng', dept: 'dept_khtn', role: 'Giáo viên KHTN (Sinh)', quota: 19, subjects: ['KHTN'] },
  { id: 'tc_qh_gv58', code: 'GV058', name: 'Trần Văn Kiên', dept: 'dept_khtn', role: 'Giáo viên KHTN', quota: 19, subjects: ['KHTN'] },
  { id: 'tc_qh_gv59', code: 'GV059', name: 'Phan Thị Yến', dept: 'dept_khtn', role: 'Giáo viên Công nghệ', quota: 19, subjects: ['Công nghệ'] },
  { id: 'tc_qh_gv60', code: 'GV060', name: 'Bùi Thị Hà', dept: 'dept_van_su_dia', role: 'Giáo viên Ngữ văn', quota: 19, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_gv61', code: 'GV061', name: 'Nguyễn Thị Nga', dept: 'dept_van_su_dia', role: 'Giáo viên Ngữ văn', quota: 19, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_gv62', code: 'GV062', name: 'Lê Thị Oanh', dept: 'dept_van_su_dia', role: 'Giáo viên Ngữ văn', quota: 19, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_gv63', code: 'GV063', name: 'Trần Thị Thêu', dept: 'dept_van_su_dia', role: 'Giáo viên Ngữ văn', quota: 19, subjects: ['Ngữ văn'] },
  { id: 'tc_qh_gv64', code: 'GV064', name: 'Phạm Thị Tuyết', dept: 'dept_van_su_dia', role: 'Giáo viên Lịch sử & Địa lý', quota: 19, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_gv65', code: 'GV065', name: 'Đặng Thị Cúc', dept: 'dept_van_su_dia', role: 'Giáo viên Lịch sử & Địa lý', quota: 19, subjects: ['Lịch sử & Địa lý'] },
  { id: 'tc_qh_gv66', code: 'GV066', name: 'Ngô Văn Quyền', dept: 'dept_van_su_dia', role: 'Giáo viên GDCD', quota: 19, subjects: ['GDCD', 'GDĐP'] },
  { id: 'tc_qh_gv67', code: 'GV067', name: 'Lê Thị Bình', dept: 'dept_van_su_dia', role: 'Giáo viên GDCD', quota: 19, subjects: ['GDCD', 'HĐTNHN'] },
  { id: 'tc_qh_gv68', code: 'GV068', name: 'Vũ Thị Dung', dept: 'dept_ngoai_ngu', role: 'Giáo viên Tiếng Anh', quota: 19, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_gv69', code: 'GV069', name: 'Trần Thị Vân', dept: 'dept_ngoai_ngu', role: 'Giáo viên Tiếng Anh', quota: 19, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_gv70', code: 'GV070', name: 'Nguyễn Văn Long', dept: 'dept_ngoai_ngu', role: 'Giáo viên Tiếng Anh', quota: 19, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_gv71', code: 'GV071', name: 'Hoàng Thị Mơ', dept: 'dept_ngoai_ngu', role: 'Giáo viên Tiếng Anh', quota: 19, subjects: ['Tiếng anh'] },
  { id: 'tc_qh_gv72', code: 'GV072', name: 'Phạm Thị Xoan', dept: 'dept_nghe_thuat_gdtc', role: 'Giáo viên Âm nhạc', quota: 19, subjects: ['Nghệ thuật'] },
  { id: 'tc_qh_gv73', code: 'GV073', name: 'Lê Văn Tuấn', dept: 'dept_nghe_thuat_gdtc', role: 'Giáo viên Mĩ thuật', quota: 19, subjects: ['Nghệ thuật'] },
  { id: 'tc_qh_gv74', code: 'GV074', name: 'Trần Văn Quân', dept: 'dept_nghe_thuat_gdtc', role: 'Giáo viên GDTC', quota: 19, subjects: ['GDTC'] },
  { id: 'tc_qh_gv75', code: 'GV075', name: 'Nguyễn Văn Hùng', dept: 'dept_nghe_thuat_gdtc', role: 'Giáo viên GDTC', quota: 19, subjects: ['GDTC'] },
  { id: 'tc_qh_gv76', code: 'GV076', name: 'Đinh Thị Thu', dept: 'dept_nghe_thuat_gdtc', role: 'Giáo viên Công nghệ', quota: 19, subjects: ['Công nghệ'] },
  { id: 'tc_qh_gv77', code: 'GV077', name: 'Phan Văn Quý', dept: 'dept_toan_tin', role: 'Giáo viên Tin học', quota: 19, subjects: ['Tin học'] },
  { id: 'tc_qh_gv78', code: 'GV078', name: 'Trương Thị Liễu', dept: 'dept_khtn', role: 'Giáo viên KHTN', quota: 19, subjects: ['KHTN'] },
];

export const QUYHOP_TEACHERS: Teacher[] = RAW_QUYHOP_TEACHERS.map((t) => ({
  id: t.id,
  schoolId: 'school_quyhop',
  code: t.code,
  fullName: t.name,
  gender: t.name.includes('Thị') || t.name.includes('Loan') || t.name.includes('Hà') || t.name.includes('Thảo') || t.name.includes('Thắm') || t.name.includes('Nga') || t.name.includes('Nhung') ? 'Nữ' : 'Nam',
  departmentId: t.dept,
  workplaceId: 'wp_qh_main',
  workplace: 'Điểm chính',
  positions: [t.role],
  initialDegree: 'Đại học',
  major: t.subjects[0] || 'Sư phạm',
  subjectsCanTeach: t.subjects,
  status: (t as any).isBGH ? (t.id.includes('ht') ? 'PRINCIPAL' : 'VICE_PRINCIPAL') : 'ACTIVE',
  standardQuota: t.quota,
  active: true,
}));

// Tạo 42 Lớp học THCS Quỳ Hợp (Phân chia giữa 2 điểm trường: Điểm chính 28 lớp, Điểm lẻ 14 lớp)
export const QUYHOP_CLASSES: SchoolClass[] = ([
  // Khối 6: 11 lớp (7 Điểm chính, 4 Điểm lẻ)
  { id: 'cls_qh_6a1', code: '6A1', name: 'Lớp 6A1', grade: 6, studentCount: 42, homeroomTeacherId: 'tc_qh_le_tham', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a2', code: '6A2', name: 'Lớp 6A2', grade: 6, studentCount: 41, homeroomTeacherId: 'tc_qh_p_ha', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a3', code: '6A3', name: 'Lớp 6A3', grade: 6, studentCount: 40, homeroomTeacherId: 'tc_qh_n_thuy', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a4', code: '6A4', name: 'Lớp 6A4', grade: 6, studentCount: 42, homeroomTeacherId: 'tc_qh_chung', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a5', code: '6A5', name: 'Lớp 6A5', grade: 6, studentCount: 43, homeroomTeacherId: 'tc_qh_hoang_thao', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a6', code: '6A6', name: 'Lớp 6A6', grade: 6, studentCount: 40, homeroomTeacherId: 'tc_qh_tien_anh', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a7', code: '6A7', name: 'Lớp 6A7', grade: 6, studentCount: 41, homeroomTeacherId: 'tc_qh_giang', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_6a8', code: '6A8', name: 'Lớp 6A8', grade: 6, studentCount: 42, homeroomTeacherId: 'tc_qh_nhung_6', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_6a9', code: '6A9', name: 'Lớp 6A9', grade: 6, studentCount: 39, homeroomTeacherId: 'tc_qh_vinh', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_6a10', code: '6A10', name: 'Lớp 6A10', grade: 6, studentCount: 40, homeroomTeacherId: 'tc_qh_nam', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_6a11', code: '6A11', name: 'Lớp 6A11', grade: 6, studentCount: 38, homeroomTeacherId: 'tc_qh_thuy', session: 'MORNING', branchId: 'branch_qh_sub', active: true },

  // Khối 7: 10 lớp (7 Điểm chính, 3 Điểm lẻ)
  { id: 'cls_qh_7a1', code: '7A1', name: 'Lớp 7A1', grade: 7, studentCount: 42, homeroomTeacherId: 'tc_qh_ho_nga', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a2', code: '7A2', name: 'Lớp 7A2', grade: 7, studentCount: 41, homeroomTeacherId: 'tc_qh_hien', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a3', code: '7A3', name: 'Lớp 7A3', grade: 7, studentCount: 43, homeroomTeacherId: 'tc_qh_van', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a4', code: '7A4', name: 'Lớp 7A4', grade: 7, studentCount: 40, homeroomTeacherId: 'tc_qh_hoang', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a5', code: '7A5', name: 'Lớp 7A5', grade: 7, studentCount: 42, homeroomTeacherId: 'tc_qh_truong_hai', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a6', code: '7A6', name: 'Lớp 7A6', grade: 7, studentCount: 41, homeroomTeacherId: 'tc_qh_tran_huong', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a7', code: '7A7', name: 'Lớp 7A7', grade: 7, studentCount: 40, homeroomTeacherId: 'tc_qh_thu_huong', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_7a8', code: '7A8', name: 'Lớp 7A8', grade: 7, studentCount: 42, homeroomTeacherId: 'tc_qh_lo_nhung', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_7a9', code: '7A9', name: 'Lớp 7A9', grade: 7, studentCount: 43, homeroomTeacherId: 'tc_qh_tung', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_7a10', code: '7A10', name: 'Lớp 7A10', grade: 7, studentCount: 39, homeroomTeacherId: 'tc_qh_truyen', session: 'MORNING', branchId: 'branch_qh_sub', active: true },

  // Khối 8: 9 lớp (6 Điểm chính, 3 Điểm lẻ)
  { id: 'cls_qh_8a1', code: '8A1', name: 'Lớp 8A1', grade: 8, studentCount: 42, homeroomTeacherId: 'tc_qh_phu', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a2', code: '8A2', name: 'Lớp 8A2', grade: 8, studentCount: 43, homeroomTeacherId: 'tc_qh_sen', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a3', code: '8A3', name: 'Lớp 8A3', grade: 8, studentCount: 41, homeroomTeacherId: 'tc_qh_luu_thanh', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a4', code: '8A4', name: 'Lớp 8A4', grade: 8, studentCount: 40, homeroomTeacherId: 'tc_qh_n_tam', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a5', code: '8A5', name: 'Lớp 8A5', grade: 8, studentCount: 42, homeroomTeacherId: 'tc_qh_ngoc_mai', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a6', code: '8A6', name: 'Lớp 8A6', grade: 8, studentCount: 44, homeroomTeacherId: 'tc_qh_nguyen_thao', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_8a7', code: '8A7', name: 'Lớp 8A7', grade: 8, studentCount: 40, homeroomTeacherId: 'tc_qh_uyen', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_8a8', code: '8A8', name: 'Lớp 8A8', grade: 8, studentCount: 41, homeroomTeacherId: 'tc_qh_trung', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_8a9', code: '8A9', name: 'Lớp 8A9', grade: 8, studentCount: 39, homeroomTeacherId: 'tc_qh_dat', session: 'MORNING', branchId: 'branch_qh_sub', active: true },

  // Khối 9: 12 lớp (8 Điểm chính, 4 Điểm lẻ)
  { id: 'cls_qh_9a1', code: '9A1', name: 'Lớp 9A1', grade: 9, studentCount: 44, homeroomTeacherId: 'tc_qh_loi', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a2', code: '9A2', name: 'Lớp 9A2', grade: 9, studentCount: 43, homeroomTeacherId: 'tc_qh_cao_an', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a3', code: '9A3', name: 'Lớp 9A3', grade: 9, studentCount: 42, homeroomTeacherId: 'tc_qh_dung', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a4', code: '9A4', name: 'Lớp 9A4', grade: 9, studentCount: 43, homeroomTeacherId: 'tc_qh_thien', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a5', code: '9A5', name: 'Lớp 9A5', grade: 9, studentCount: 41, homeroomTeacherId: 'tc_qh_dao', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a6', code: '9A6', name: 'Lớp 9A6', grade: 9, studentCount: 42, homeroomTeacherId: 'tc_qh_hai_9', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a7', code: '9A7', name: 'Lớp 9A7', grade: 9, studentCount: 43, homeroomTeacherId: 'tc_qh_hoa_ly', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a8', code: '9A8', name: 'Lớp 9A8', grade: 9, studentCount: 40, homeroomTeacherId: 'tc_qh_vi', session: 'MORNING', branchId: 'branch_qh_main', active: true },
  { id: 'cls_qh_9a9', code: '9A9', name: 'Lớp 9A9', grade: 9, studentCount: 42, homeroomTeacherId: 'tc_qh_loan', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_9a10', code: '9A10', name: 'Lớp 9A10', grade: 9, studentCount: 44, homeroomTeacherId: 'tc_qh_thuong', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_9a11', code: '9A11', name: 'Lớp 9A11', grade: 9, studentCount: 41, homeroomTeacherId: 'tc_qh_duong_ha', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
  { id: 'cls_qh_9a12', code: '9A12', name: 'Lớp 9A12', grade: 9, studentCount: 40, homeroomTeacherId: 'tc_qh_duc', session: 'MORNING', branchId: 'branch_qh_sub', active: true },
] as SchoolClass[]).map((c) => ({ ...c, schoolId: 'school_quyhop' }));

/**
 * Sinh phân công chuyên môn đầy đủ cho toàn bộ 42 lớp và 74 giáo viên
 */
export function generateQuyHopAssignments(): TeachingAssignment[] {
  const assignments: TeachingAssignment[] = [];
  const sy = 'sy_2026_2027';
  const ver = 'ver_hk1_official';
  const semesters: ('HK1' | 'HK2')[] = ['HK1', 'HK2'];

  // Nhóm giáo viên theo môn
  const toanTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Toán'));
  const vanTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Ngữ văn'));
  const anhTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Tiếng anh'));
  const khtnTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('KHTN'));
  const suDiaTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Lịch sử & Địa lý'));
  const gdtcTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('GDTC'));
  const tinTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Tin học'));
  const congNgheTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Công nghệ'));
  const ngheThuatTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('Nghệ thuật'));
  const gdcdTeachers = QUYHOP_TEACHERS.filter((t) => t.subjectsCanTeach.includes('GDCD'));

  semesters.forEach((sem) => {
    const weeks = sem === 'HK1' ? 18 : 17;

    // 1. Phân công giảng dạy văn hóa cho từng lớp
    QUYHOP_CLASSES.forEach((cls, idx) => {
      // Toán (4 tiết/tuần)
      const toanTch = toanTeachers[idx % toanTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_toan`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: toanTch.id,
        departmentId: toanTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_toan',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 4,
        weeks,
        totalPeriods: 4 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Ngữ văn (4 tiết/tuần)
      const vanTch = vanTeachers[idx % vanTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_van`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: vanTch.id,
        departmentId: vanTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_van',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 4,
        weeks,
        totalPeriods: 4 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Tiếng Anh (3 tiết/tuần)
      const anhTch = anhTeachers[idx % anhTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_anh`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: anhTch.id,
        departmentId: anhTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_anh',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 3,
        weeks,
        totalPeriods: 3 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // KHTN (4 tiết/tuần)
      const khtnTch = khtnTeachers[idx % khtnTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_khtn`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: khtnTch.id,
        departmentId: khtnTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_khtn',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 4,
        weeks,
        totalPeriods: 4 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Lịch sử & Địa lý (3 tiết/tuần)
      const suDiaTch = suDiaTeachers[idx % suDiaTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_sudia`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: suDiaTch.id,
        departmentId: suDiaTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_ls_dl',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 3,
        weeks,
        totalPeriods: 3 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // GDTC (2 tiết/tuần)
      const gdtcTch = gdtcTeachers[idx % gdtcTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_gdtc`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: gdtcTch.id,
        departmentId: gdtcTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_gdtc',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 2,
        weeks,
        totalPeriods: 2 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Tin học (1 tiết/tuần)
      const tinTch = tinTeachers[idx % tinTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_tin`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: tinTch.id,
        departmentId: tinTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_tin',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Công nghệ (1 tiết/tuần)
      const cnTch = congNgheTeachers[idx % congNgheTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_cn`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: cnTch.id,
        departmentId: cnTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_cn',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // Nghệ thuật (2 tiết/tuần)
      const ntTch = ngheThuatTeachers[idx % ngheThuatTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_nt`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: ntTch.id,
        departmentId: ntTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_nghethuat',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 2,
        weeks,
        totalPeriods: 2 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // GDCD (1 tiết/tuần)
      const gdcdTch = gdcdTeachers[idx % gdcdTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_gdcd`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: gdcdTch.id,
        departmentId: gdcdTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_gdcd',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });

      // HĐTNHN (3 tiết/tuần) do GVCN phụ trách
      if (cls.homeroomTeacherId) {
        const hrTch = QUYHOP_TEACHERS.find((t) => t.id === cls.homeroomTeacherId);
        if (hrTch) {
          assignments.push({
            id: `as_qh_${sem}_${cls.id}_hdtnhn`,
            schoolId: 'school_quyhop',
            schoolYearId: sy,
            semesterId: sem,
            versionId: ver,
            teacherId: hrTch.id,
            departmentId: hrTch.departmentId,
            type: 'TEACHING',
            subjectId: 'sub_hdtnhn',
            classId: cls.id,
            session: 'MORNING',
            periodsPerWeek: 3,
            weeks,
            totalPeriods: 3 * weeks,
            status: 'approved',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
          });
        }
      }

      // GDĐP (1 tiết/tuần)
      const gddpTch = vanTeachers[(idx + 2) % vanTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_${cls.id}_gddp`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: gddpTch.id,
        departmentId: gddpTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_gddp',
        classId: cls.id,
        session: 'MORNING',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });
    });

    // 2. Phân công Chủ nhiệm 42 lớp (4 tiết/tuần miễn giảm / tính theo chế độ GVCN)
    QUYHOP_CLASSES.forEach((cls) => {
      if (cls.homeroomTeacherId) {
        const tch = QUYHOP_TEACHERS.find((t) => t.id === cls.homeroomTeacherId);
        if (tch) {
          assignments.push({
            id: `as_qh_${sem}_cn_${cls.id}`,
            schoolId: 'school_quyhop',
            schoolYearId: sy,
            semesterId: sem,
            versionId: ver,
            teacherId: tch.id,
            departmentId: tch.departmentId,
            type: 'CONCURRENT',
            dutyId: 'duty_chunhiem',
            dutyName: `Chủ nhiệm lớp ${cls.code}`,
            classId: cls.id,
            session: 'ACTIVITY',
            periodsPerWeek: 4,
            weeks,
            totalPeriods: 4 * weeks,
            status: 'approved',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            notes: `Chủ nhiệm lớp ${cls.code} (4 tiết/tuần x ${weeks} tuần = ${4 * weeks} tiết)`,
          });
        }
      }
    });

    // 3. Phân công kiêm nhiệm chức vụ toàn trường theo văn bản:
    // Tổ trưởng CM: 3 người x 3 tiết = 9 tiết/tuần
    [
      { id: 'tc_qh_phan_tam', name: 'Phan Tâm', dept: 'dept_toan_tin', org: 'Tổ Toán – Tin' },
      { id: 'tc_qh_cuong', name: 'Lê Văn Cường', dept: 'dept_khtn', org: 'Tổ KHTN' },
      { id: 'tc_qh_toan', name: 'Trần Văn Toàn', dept: 'dept_van_su_dia', org: 'Tổ Ngữ văn – KHXH' },
    ].forEach((tt) => {
      assignments.push({
        id: `as_qh_${sem}_totruong_${tt.id}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: tt.id,
        departmentId: tt.dept,
        type: 'CONCURRENT',
        dutyId: 'duty_totruong',
        dutyName: `Tổ trưởng CM (${tt.org})`,
        session: 'ACTIVITY',
        periodsPerWeek: 3,
        weeks,
        totalPeriods: 3 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });
    });

    // Tổ phó CM: 6 người x 1 tiết = 6 tiết/tuần
    [
      { id: 'tc_qh_cao_an', name: 'Cao An', dept: 'dept_toan_tin' },
      { id: 'tc_qh_le_tham', name: 'Lê Thắm', dept: 'dept_khtn' },
      { id: 'tc_qh_ho_nga', name: 'Hồ Nga', dept: 'dept_van_su_dia' },
      { id: 'tc_qh_hoang_thao', name: 'Hoàng Thảo', dept: 'dept_van_su_dia' },
      { id: 'tc_qh_khang', name: 'Nguyễn Khang', dept: 'dept_ngoai_ngu' },
      { id: 'tc_qh_loc', name: 'Trần Văn Lộc', dept: 'dept_ngoai_ngu' },
    ].forEach((tp) => {
      assignments.push({
        id: `as_qh_${sem}_topho_${tp.id}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: tp.id,
        departmentId: tp.dept,
        type: 'CONCURRENT',
        dutyId: 'duty_topho',
        dutyName: 'Tổ phó Chuyên môn',
        session: 'ACTIVITY',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });
    });

    // Trưởng ban Thanh tra: 2 tiết (Cao An)
    assignments.push({
      id: `as_qh_${sem}_thanhtra_caoan`,
      schoolId: 'school_quyhop',
      schoolYearId: sy,
      semesterId: sem,
      versionId: ver,
      teacherId: 'tc_qh_cao_an',
      departmentId: 'dept_toan_tin',
      type: 'CONCURRENT',
      dutyName: 'Trưởng ban Thanh tra nhân dân',
      session: 'ACTIVITY',
      periodsPerWeek: 2,
      weeks,
      totalPeriods: 2 * weeks,
      status: 'approved',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    });

    // Tư vấn học đường: 8 tiết (Khang)
    assignments.push({
      id: `as_qh_${sem}_tuvan_khang`,
      schoolId: 'school_quyhop',
      schoolYearId: sy,
      semesterId: sem,
      versionId: ver,
      teacherId: 'tc_qh_khang',
      departmentId: 'dept_ngoai_ngu',
      type: 'CONCURRENT',
      dutyName: 'Tư vấn học đường',
      session: 'ACTIVITY',
      periodsPerWeek: 8,
      weeks,
      totalPeriods: 8 * weeks,
      status: 'approved',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    });

    // Phụ trách vườn trường: 2 tiết (Bính)
    assignments.push({
      id: `as_qh_${sem}_vuontruong_binh`,
      schoolId: 'school_quyhop',
      schoolYearId: sy,
      semesterId: sem,
      versionId: ver,
      teacherId: 'tc_qh_binh',
      departmentId: 'dept_khtn',
      type: 'CONCURRENT',
      dutyName: 'Phụ trách vườn trường',
      session: 'ACTIVITY',
      periodsPerWeek: 2,
      weeks,
      totalPeriods: 2 * weeks,
      status: 'approved',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    });

    // Phụ trách phòng Tin học: 3 tiết (Uyên, Giang, Nghĩa mỗi người 1 tiết)
    ['tc_qh_uyen', 'tc_qh_giang', 'tc_qh_nghia'].forEach((tid) => {
      assignments.push({
        id: `as_qh_${sem}_phongtin_${tid}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: tid,
        departmentId: 'dept_toan_tin',
        type: 'CONCURRENT',
        dutyName: 'Phụ trách phòng Tin học',
        session: 'ACTIVITY',
        periodsPerWeek: 1,
        weeks,
        totalPeriods: 1 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      });
    });

    // Thư ký Hội đồng trường: 2 tiết (Nghĩa)
    assignments.push({
      id: `as_qh_${sem}_thuky_nghia`,
      schoolId: 'school_quyhop',
      schoolYearId: sy,
      semesterId: sem,
      versionId: ver,
      teacherId: 'tc_qh_nghia',
      departmentId: 'dept_toan_tin',
      type: 'CONCURRENT',
      dutyName: 'Thư ký Hội đồng trường',
      session: 'ACTIVITY',
      periodsPerWeek: 2,
      weeks,
      totalPeriods: 2 * weeks,
      status: 'approved',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    });

    // Bí thư Đoàn trường: 2 tiết (Tiến Anh)
    assignments.push({
      id: `as_qh_${sem}_bithudoan_tienanh`,
      schoolId: 'school_quyhop',
      schoolYearId: sy,
      semesterId: sem,
      versionId: ver,
      teacherId: 'tc_qh_tien_anh',
      departmentId: 'dept_nghe_thuat_gdtc',
      type: 'CONCURRENT',
      dutyName: 'Bí thư Đoàn thanh niên',
      session: 'ACTIVITY',
      periodsPerWeek: 2,
      weeks,
      totalPeriods: 2 * weeks,
      status: 'approved',
      createdBy: 'system',
      createdAt: new Date().toISOString(),
    });

    // 4. Buổi 2: Ôn thi vào 10 cho Khối 9 (Toán, Văn, Tiếng Anh mỗi môn 12 lớp x 2 tiết/tuần)
    QUYHOP_CLASSES.filter((c) => c.grade === 9).forEach((cls, idx) => {
      // Ôn thi Toán 9
      const toanTch = toanTeachers[idx % toanTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_onthi_toan_${cls.id}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: toanTch.id,
        departmentId: toanTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_toan',
        classId: cls.id,
        session: 'AFTERNOON',
        periodsPerWeek: 2,
        weeks,
        totalPeriods: 2 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        notes: 'Buổi 2: Ôn thi tuyển sinh vào lớp 10 (Môn Toán)',
      });

      // Ôn thi Ngữ văn 9
      const vanTch = vanTeachers[idx % vanTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_onthi_van_${cls.id}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: vanTch.id,
        departmentId: vanTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_van',
        classId: cls.id,
        session: 'AFTERNOON',
        periodsPerWeek: 2,
        weeks,
        totalPeriods: 2 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        notes: 'Buổi 2: Ôn thi tuyển sinh vào lớp 10 (Môn Ngữ văn)',
      });

      // Ôn thi Tiếng Anh 9
      const anhTch = anhTeachers[idx % anhTeachers.length];
      assignments.push({
        id: `as_qh_${sem}_onthi_anh_${cls.id}`,
        schoolId: 'school_quyhop',
        schoolYearId: sy,
        semesterId: sem,
        versionId: ver,
        teacherId: anhTch.id,
        departmentId: anhTch.departmentId,
        type: 'TEACHING',
        subjectId: 'sub_anh',
        classId: cls.id,
        session: 'AFTERNOON',
        periodsPerWeek: 2,
        weeks,
        totalPeriods: 2 * weeks,
        status: 'approved',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        notes: 'Buổi 2: Ôn thi tuyển sinh vào lớp 10 (Môn Tiếng Anh)',
      });
    });
  });

  return assignments;
}

export const QUYHOP_ASSIGNMENTS: TeachingAssignment[] = generateQuyHopAssignments();
