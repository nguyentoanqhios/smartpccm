import {
  TeachingAssignment,
  Subject,
  SchoolClass,
  AbbreviationRule,
  AbbreviationCategory,
} from '../types';
import { dataStore } from '../repositories/dataStore';

/**
 * Thoát ký tự đặc biệt trong RegExp
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lấy danh sách quy tắc viết tắt hiện hành (từ tham số hoặc từ dataStore)
 */
export function getActiveAbbreviationRules(
  customRules?: AbbreviationRule[],
  category?: AbbreviationCategory
): AbbreviationRule[] {
  let rules = customRules;
  if (!rules) {
    try {
      rules = dataStore.getAbbreviationRules(true);
    } catch {
      rules = [];
    }
  }

  if (category) {
    rules = rules.filter((r) => r.category === category || r.category === 'GENERAL');
  }

  // Sắp xếp ưu tiên các quy tắc có cụm từ gốc dài hơn
  return [...rules].sort((a, b) => b.originalText.length - a.originalText.length);
}

/**
 * Trích xuất tất cả các cụm từ cần thay thế (gồm originalText và aliases) từ danh sách quy tắc,
 * sắp xếp theo độ dài giảm dần để cụm từ dài hơn được khớp trước.
 */
export function getCompiledTerms(rules: AbbreviationRule[]): { term: string; rule: AbbreviationRule }[] {
  const terms: { term: string; rule: AbbreviationRule }[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (!rule.originalText || !rule.abbreviatedText || !rule.isActive) continue;
    const candidates = [rule.originalText, ...(rule.aliases || [])];
    for (const c of candidates) {
      if (!c) continue;
      const trimmed = c.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        terms.push({ term: trimmed, rule });
      }
    }
  }

  // Sắp xếp giảm dần theo độ dài cụm từ
  return terms.sort((a, b) => b.term.length - a.term.length);
}

/**
 * Áp dụng toàn diện các quy tắc viết tắt cho một chuỗi văn bản bất kỳ
 * Mỗi nhiệm vụ chỉ định nghĩa 1 lần và áp dụng cho tất cả tham chiếu (bao gồm các biến thể / aliases)
 */
export function applyAbbreviationRules(
  inputText?: string,
  customRules?: AbbreviationRule[],
  category?: AbbreviationCategory
): string {
  if (!inputText) return '';
  let text = inputText;

  // Lấy các quy tắc đang hoạt động
  const activeRules = getActiveAbbreviationRules(customRules, category);
  // Trích xuất toàn bộ cụm từ gốc và biến thể tham chiếu
  const compiledTerms = getCompiledTerms(activeRules);

  for (const { term, rule } of compiledTerms) {
    const abbr = rule.abbreviatedText.trim();
    if (!abbr || term.toLowerCase() === abbr.toLowerCase()) continue;

    const escaped = escapeRegExp(term);
    try {
      // Cho phép khớp ngay sau số (như 3tiết -> 3t, 15tiết -> 15t, 2tiết/tuần -> 2t/tuần)
      // Nhưng không được khớp giữa một từ chữ cái (vd: không khớp "tiết" trong "chiết" hay "thiết")
      const regex = new RegExp(`(?<![\\p{L}_])${escaped}(?![\\p{L}_])`, 'giu');
      text = text.replace(regex, abbr);
    } catch {
      const fallbackRegex = new RegExp(`(?<![a-zA-Z_])${escaped}(?![a-zA-Z_])`, 'gi');
      text = text.replace(fallbackRegex, abbr);
    }
  }

  // Chuẩn hóa thẩm mỹ cho các trường hợp thường gặp:
  // 1. "CN lớp 6A9" -> "CN 6A9"
  text = text.replace(/\bCN\s+lớp\b/gi, 'CN');
  // 2. Định dạng liền cho số tiết: "3 t/tuần" -> "3t/tuần", "54 t" -> "54t" (khi viết tắt thành t hoặc t/tuần)
  text = text.replace(/(\d+)\s+(t\/tuần)\b/gi, '$1$2');
  text = text.replace(/(\d+)\s+(t)\b(?!\/)/gi, '$1$2');

  return text.trim();
}

/**
 * Chuẩn hóa khóa nhận diện nhiệm vụ kiêm nhiệm / miễn giảm để khử trùng lặp tuyệt đối
 * Ngăn chặn việc một nhiệm vụ bị hiển thị 2 lần (ví dụ vừa có 'TT' vừa có 'Tổ trưởng' hoặc các định nghĩa con thừa)
 */
export function getCanonicalDutyKey(nameOrAbbr?: string): string {
  if (!nameOrAbbr) return '';
  const clean = nameOrAbbr.toLowerCase().trim().replace(/^(•|-|\*)\s*/, '');
  
  // 1. Nhóm Tổ trưởng (tất cả định nghĩa con: Tổ trưởng chuyên môn, Tổ trưởng Ngoại ngữ, Tổ trưởng Toán - Tin, TTCM, TT...)
  if (
    clean.includes('tổ trưởng') ||
    clean.includes('ttcm') ||
    clean === 'tt' ||
    clean.startsWith('tt ') ||
    clean.endsWith(' tt')
  ) {
    if (!clean.includes('tổ phó') && !clean.includes('tpcm') && clean !== 'tp') {
      return 'duty_to_truong';
    }
  }

  // 2. Nhóm Tổ phó (Tổ phó chuyên môn, Tổ phó Toán, TPCM, TP...)
  if (
    clean.includes('tổ phó') ||
    clean.includes('tpcm') ||
    clean === 'tp' ||
    clean.startsWith('tp ') ||
    clean.endsWith(' tp')
  ) {
    return 'duty_to_pho';
  }

  // 3. Nhóm Giáo viên Chủ nhiệm (Chủ nhiệm, GVCN, CN, Chủ nhiệm lớp...)
  if (
    clean.includes('chủ nhiệm') ||
    clean.includes('gvcn') ||
    clean === 'cn' ||
    clean.startsWith('cn ') ||
    clean.startsWith('gvcn ')
  ) {
    return 'duty_chu_nhiem';
  }

  // 4. Nhóm Tổng phụ trách Đội
  if (clean.includes('tổng phụ trách') || clean.includes('tpt') || clean.includes('tptđ')) {
    return 'duty_tpt';
  }

  // 5. Nhóm Chủ tịch Công đoàn
  if (clean.includes('chủ tịch công đoàn') || clean.includes('ctcđ') || clean.includes('ct.cđ')) {
    return 'duty_ctcd';
  }

  // 6. Nhóm Phó chủ tịch Công đoàn
  if (clean.includes('phó chủ tịch công đoàn') || clean.includes('pctcđ') || clean.includes('pct.cđ')) {
    return 'duty_pctcd';
  }

  // 7. Nhóm Bí thư Chi đoàn
  if (clean.includes('bí thư chi đoàn') || clean.includes('btcđ') || clean.includes('bt.cđ')) {
    return 'duty_btcd';
  }

  // 8. Nhóm Thư ký hội đồng
  if (clean.includes('thư ký hội đồng') || clean.includes('thư ký hđ') || clean.includes('tkhđ')) {
    return 'duty_tkhd';
  }

  // 9. Nhóm Thanh tra nhân dân
  if (clean.includes('thanh tra nhân dân') || clean.includes('ttnd') || clean.includes('trưởng ban ttnd')) {
    return 'duty_ttnd';
  }

  // 10. Nhóm Tư vấn tâm lý
  if (clean.includes('tư vấn tâm lý') || clean.includes('tvtl')) {
    return 'duty_tvtl';
  }

  // 11. Nhóm Phòng máy / Phòng bộ môn Tin học
  if (
    clean.includes('ph.tin') ||
    clean.includes('phòng tin') ||
    clean.includes('phòng máy') ||
    (clean.includes('tin') && (clean.includes('bộ môn') || clean.includes('máy vi tính') || clean.includes('phụ trách')))
  ) {
    return 'duty_ph_tin';
  }

  // 12. Nhóm Phòng bộ môn Công nghệ
  if (
    clean.includes('ph.cn') ||
    (clean.includes('công nghệ') && (clean.includes('phòng') || clean.includes('bộ môn') || clean.includes('phụ trách')) && !clean.includes('thông tin'))
  ) {
    return 'duty_ph_cn';
  }

  // 13. Nhóm Phòng bộ môn KHTN / Thí nghiệm
  if (
    clean.includes('ph.khtn') ||
    (clean.includes('khtn') && (clean.includes('phòng') || clean.includes('bộ môn') || clean.includes('thí nghiệm') || clean.includes('phụ trách'))) ||
    clean.includes('thí nghiệm khtn')
  ) {
    return 'duty_ph_khtn';
  }

  // 14. Nhóm Phụ trách Thiết bị
  if (clean.includes('thiết bị') || clean.includes('ph.thiết bị')) {
    return 'duty_ph_thiet_bi';
  }

  // 15. Nhóm Phụ trách CNTT / Chuyển đổi số
  if (clean.includes('chuyển đổi số') || clean.includes('công nghệ thông tin') || clean.includes('cntt') || clean.includes('ph.cntt')) {
    return 'duty_ph_cntt';
  }

  // 16. Nhóm Lao động vệ sinh
  if (clean.includes('lao động') || clean.includes('vệ sinh')) {
    return 'duty_lao_dong';
  }

  // 17. Phổ cập giáo dục
  if (clean.includes('phổ cập') || clean.includes('pcgd')) {
    return 'duty_pcgd';
  }

  // 18. Nghỉ sinh / Thai sản
  if (clean.includes('nghỉ sinh') || clean.includes('thai sản')) {
    return 'duty_nghi_sinh';
  }

  // 19. Con nhỏ / Nuôi con
  if (clean.includes('con nhỏ') || clean.includes('nuôi con')) {
    return 'duty_con_nho';
  }

  return clean;
}

/**
 * Viết tắt tên chức vụ, kiêm nhiệm, chế độ theo Danh mục viết tắt do người dùng định nghĩa.
 * Tự động ánh xạ từ mọi biến thể tham chiếu về cùng 1 ký hiệu viết tắt duy nhất của nhiệm vụ.
 */
export function abbreviateDutyName(rawName?: string, customRules?: AbbreviationRule[]): string {
  if (!rawName) return '';
  let text = rawName.trim();
  // Loại bỏ số tiết trong ngoặc nếu còn sót lại (ví dụ "Tổ trưởng (3 tiết)")
  text = text.replace(/\s*\([^)]*\)/gi, '').trim();
  const lower = text.toLowerCase();

  const activeRules = getActiveAbbreviationRules(customRules);

  // 1. Kiểm tra khớp trực tiếp toàn bộ chuỗi với cụm từ gốc hoặc biến thể tham chiếu
  for (const rule of activeRules) {
    if (!rule.originalText || !rule.abbreviatedText || !rule.isActive) continue;
    if (rule.originalText.trim().toLowerCase() === lower) {
      return rule.abbreviatedText.trim();
    }
    if (rule.aliases && Array.isArray(rule.aliases)) {
      for (const alias of rule.aliases) {
        if (alias && alias.trim().toLowerCase() === lower) {
          return rule.abbreviatedText.trim();
        }
      }
    }
  }

  // 2. Nhóm Tổ trưởng: nếu chuỗi chứa "tổ trưởng", "ttcm", hoặc "tt" (kể cả các định nghĩa con như Tổ trưởng Ngoại ngữ, Tổ trưởng Toán - Tin,...)
  // Chuẩn hóa toàn bộ về ký hiệu viết tắt TT của Tổ trưởng
  if (
    (lower.includes('tổ trưởng') || lower.includes('ttcm') || lower === 'tt' || lower.startsWith('tt ')) &&
    !lower.includes('tổ phó') &&
    !lower.includes('tpcm') &&
    lower !== 'tp'
  ) {
    const ttRule = activeRules.find((r) => r.id === 'abbr_tt' || r.abbreviatedText.toUpperCase() === 'TT');
    return ttRule?.abbreviatedText.trim() || 'TT';
  }

  // Nhóm Tổ phó: chuẩn hóa về TP
  if (
    lower.includes('tổ phó') ||
    lower.includes('tpcm') ||
    lower === 'tp' ||
    lower.startsWith('tp ')
  ) {
    const tpRule = activeRules.find((r) => r.id === 'abbr_tp' || r.abbreviatedText.toUpperCase() === 'TP');
    return tpRule?.abbreviatedText.trim() || 'TP';
  }

  // Nhóm Giáo viên Chủ nhiệm
  if (lower === 'chủ nhiệm' || lower === 'chủ nhiệm lớp' || lower === 'giáo viên chủ nhiệm' || lower === 'gvcn' || lower === 'cn') {
    const cnRule = activeRules.find((r) => r.id === 'abbr_cn' || r.abbreviatedText.toUpperCase() === 'CN');
    return cnRule?.abbreviatedText.trim() || 'CN';
  }

  // Nhóm phòng máy / phòng bộ môn Tin học
  if (
    lower.includes('phòng máy bộ môn tin') ||
    lower.includes('phòng bộ môn tin') ||
    lower.includes('phụ trách phòng máy bộ môn tin') ||
    lower.includes('phụ trách phòng bộ môn tin') ||
    lower.includes('phòng tin') ||
    lower.includes('ph.tin bộ môn tin') ||
    lower.includes('phụ trách phòng tin') ||
    (lower.includes('tin') && lower.includes('phòng'))
  ) {
    const phTinRule = activeRules.find((r) => r.id === 'abbr_ph_tin' || r.abbreviatedText.toLowerCase() === 'ph.tin');
    return phTinRule?.abbreviatedText.trim() || 'Ph.Tin';
  }

  // Nhóm phòng bộ môn Công nghệ
  if (
    lower.includes('phòng bộ môn công nghệ') ||
    lower.includes('phụ trách phòng bộ môn công nghệ') ||
    lower.includes('phòng công nghệ') ||
    lower.includes('ph.cn bộ môn công nghệ') ||
    (lower.includes('công nghệ') && lower.includes('phòng') && !lower.includes('thông tin'))
  ) {
    const phCnRule = activeRules.find((r) => r.id === 'abbr_ph_cn' || r.abbreviatedText.toLowerCase() === 'ph.cn');
    return phCnRule?.abbreviatedText.trim() || 'Ph.CN';
  }

  // Nhóm phòng bộ môn KHTN
  if (
    lower.includes('phòng bộ môn khtn') ||
    lower.includes('phụ trách phòng bộ môn khtn') ||
    lower.includes('phòng khtn') ||
    lower.includes('phòng thực hành khtn') ||
    lower.includes('ph.khtn bộ môn khtn') ||
    (lower.includes('khtn') && (lower.includes('phòng') || lower.includes('thí nghiệm')))
  ) {
    const phKhtnRule = activeRules.find((r) => r.id === 'abbr_ph_khtn' || r.abbreviatedText.toLowerCase() === 'ph.khtn');
    return phKhtnRule?.abbreviatedText.trim() || 'Ph.KHTN';
  }

  // 3. Áp dụng thay thế cụm từ theo quy tắc viết tắt (bao gồm DUTY, EXEMPTION và GENERAL)
  text = applyAbbreviationRules(text, activeRules);

  // 4. Chuẩn hóa dọn dẹp các cụm từ thừa còn vướng lại sau khi viết tắt
  // Ví dụ: "Ph.Tin bộ môn Tin" -> "Ph.Tin", "Ph.CN bộ môn Công nghệ" -> "Ph.CN", "Ph.KHTN bộ môn KHTN" -> "Ph.KHTN"
  text = text.replace(/\b(Ph\.Tin)\s+bộ\s+môn\s+Tin(\s+học)?\b/gi, '$1');
  text = text.replace(/\b(Ph\.CN)\s+bộ\s+môn\s+Công\s+nghệ\b/gi, '$1');
  text = text.replace(/\b(Ph\.KHTN)\s+bộ\s+môn\s+KHTN\b/gi, '$1');
  text = text.replace(/\b(Ph\.(Tin|CN|KHTN))\s+bộ\s+môn\b/gi, '$1');
  text = text.replace(/\bCN\s+lớp\b/gi, 'CN');

  return text.trim();
}

/**
 * Viết tắt tên môn học theo Danh mục viết tắt do người dùng định nghĩa
 */
export function abbreviateSubjectName(rawSubjectName?: string, customRules?: AbbreviationRule[]): string {
  if (!rawSubjectName) return '';
  const trimmed = rawSubjectName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Áp dụng các quy tắc môn học từ Danh mục viết tắt
  const rules = getActiveAbbreviationRules(customRules, 'SUBJECT');
  
  // Khớp chính xác trước với cụm từ gốc hoặc các biến thể (aliases)
  for (const rule of rules) {
    if (!rule.originalText || !rule.abbreviatedText || !rule.isActive) continue;
    if (lower === rule.originalText.trim().toLowerCase()) {
      return rule.abbreviatedText.trim();
    }
    if (rule.aliases && Array.isArray(rule.aliases)) {
      for (const alias of rule.aliases) {
        if (alias && alias.trim().toLowerCase() === lower) {
          return rule.abbreviatedText.trim();
        }
      }
    }
  }

  // Khớp regex hoặc bộ lọc từng phần
  const transformed = applyAbbreviationRules(trimmed, rules, 'SUBJECT');
  if (transformed && transformed !== trimmed) {
    return transformed.trim();
  }

  // Fallback chuẩn nếu chưa có quy tắc phù hợp
  if (lower.includes('tiếng anh') || lower.includes('ngoại ngữ')) return 'T.Anh';
  if (lower === 'ngữ văn' || lower === 'văn học') return 'Văn';
  if (lower === 'toán' || lower === 'toán học') return 'Toán';
  if (lower.includes('khoa học tự nhiên') || lower === 'khtn') return 'KHTN';
  if (lower.includes('lịch sử và địa lí') || lower.includes('lịch sử và địa lý') || lower.includes('lịch sử - địa lí')) return 'LS&ĐL';
  if (lower.includes('giáo dục công dân') || lower === 'gdcd') return 'GDCD';
  if (lower === 'tin học' || lower === 'tin') return 'Tin';
  if (lower.includes('công nghệ')) return 'C.Nghệ';
  if (lower.includes('giáo dục thể chất') || lower === 'gdtc') return 'GDTC';
  if (lower.includes('hoạt động trải nghiệm') || lower.includes('hđtn')) return 'HĐTN';
  if (lower.includes('giáo dục địa phương') || lower.includes('gdđp')) return 'GDĐP';
  if (lower === 'âm nhạc') return 'Â.Nhạc';
  if (lower === 'mĩ thuật' || lower === 'mỹ thuật') return 'M.Thuật';
  if (lower.includes('nghệ thuật')) return 'Nghệ thuật';
  if (lower === 'vật lí' || lower === 'vật lý') return 'Vật lí';
  if (lower === 'hóa học') return 'Hóa';
  if (lower === 'sinh học') return 'Sinh';

  return trimmed;
}

/**
 * Định dạng chuỗi số tiết kiêm nhiệm / miễn giảm theo quy tắc viết tắt
 * Ví dụ: "(3t/tuần = 54t)" hoặc "(miễn 15t/tuần = 270t)"
 */
export function formatDutyPeriods(
  periodsWeekly: number,
  semesterWeeks: number,
  isExemption: boolean = false,
  customRules?: AbbreviationRule[]
): string {
  if (periodsWeekly <= 0) return '';
  const raw = isExemption
    ? `(miễn ${periodsWeekly} tiết/tuần = ${periodsWeekly * semesterWeeks} tiết)`
    : `(${periodsWeekly} tiết/tuần = ${periodsWeekly * semesterWeeks} tiết)`;
  return applyAbbreviationRules(raw, customRules);
}

/**
 * Chuẩn hóa tên lớp hiển thị gọn (bỏ chữ 'Lớp ' thừa nếu có):
 * 'Lớp 6A9' -> '6A9'
 */
export function cleanClassName(rawClassName?: string): string {
  if (!rawClassName) return '';
  return rawClassName.replace(/^[Ll]ớp\s+/i, '').trim();
}

/**
 * Kiểu tóm tắt phân công giảng dạy theo từng môn học
 */
export interface SubjectGroupSummary {
  subjectId: string;
  subjectName: string;
  subjectAbbr: string;
  abbreviatedSubjectName: string;
  grade?: number;
  totalWeeklyPeriods: number;
  totalClasses: number;
  classGroupText: string;
  lineText: string;
}

/**
 * Gom phân công giảng dạy của giáo viên theo từng môn học và khối lớp mỗi hàng,
 * sau đó gom tiếp các lớp có cùng số tiết/tuần.
 * Định dạng:
 * [Tên môn viết tắt]: [Danh sách lớp theo khối] ([Số tiết]t) [[Tổng tiết khối]t/tuần]
 * Ví dụ:
 * Â.Nhạc: 6A1, 6A2, 6A3, 6A4, 6A5, 6A6, 6A7, 6A8 (1t) [8t/tuần]
 * Â.Nhạc: 7A1, 7A2, 7A3, 7A4, 7A5, 7A6, 7A7 (1t) [7t/tuần]
 * Â.Nhạc: 8A1, 8A2, 8A3, 8A4, 8A5, 8A6 (1t) [6t/tuần]
 * Quy tắc "(1t)" và "[8t/tuần]" hoàn toàn tuân thủ theo Danh mục viết tắt của hệ thống.
 */
export function groupTeachingAssignmentsBySubject(
  assignments: TeachingAssignment[],
  subjectMap: Map<string, Subject>,
  classMap: Map<string, SchoolClass>,
  customRules?: AbbreviationRule[]
): SubjectGroupSummary[] {
  // 1. Chỉ lấy các phân công dạng giảng dạy lớp hoặc liên trường
  const teachingAssigns = assignments.filter(
    (a) =>
      a.type === 'TEACHING' ||
      a.isInterSchool ||
      Boolean(a.interSchoolName) ||
      (!a.type && Boolean(a.subjectId))
  );

  if (teachingAssigns.length === 0) {
    return [];
  }

  // 2. Nhóm theo MÔN HỌC (subjectId) VÀ KHỐI LỚP (grade)
  interface GroupBucket {
    subjectId: string;
    grade: number;
    assigns: TeachingAssignment[];
  }
  const groupMap = new Map<string, GroupBucket>();

  teachingAssigns.forEach((a) => {
    const subId = a.subjectId || 'UNKNOWN_SUBJECT';
    const clsObj = a.classId ? classMap.get(a.classId) : undefined;

    // Xác định khối lớp: ưu tiên từ clsObj.grade, fallback từ tên lớp / mã lớp
    let grade = clsObj?.grade;
    if (!grade && clsObj?.name) {
      const match = clsObj.name.match(/^([6-9])/);
      if (match) grade = parseInt(match[1], 10) as 6 | 7 | 8 | 9;
    }
    if (!grade && a.classId) {
      const match = a.classId.match(/([6-9])/);
      if (match) grade = parseInt(match[1], 10) as 6 | 7 | 8 | 9;
    }
    const gradeNum = grade || 0;
    const groupKey = `${subId}__grade_${gradeNum}`;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { subjectId: subId, grade: gradeNum, assigns: [] });
    }
    groupMap.get(groupKey)!.assigns.push(a);
  });

  // Sắp xếp các nhóm:
  // 1. Giữ các khối của cùng một môn học đi liền nhau
  // 2. Trong cùng môn học: sắp xếp theo Khối tăng dần (Khối 6 -> 7 -> 8 -> 9)
  const sortedBuckets = Array.from(groupMap.values()).sort((a, b) => {
    const subA = subjectMap.get(a.subjectId);
    const subB = subjectMap.get(b.subjectId);
    const nameA = subA?.name || a.subjectId;
    const nameB = subB?.name || b.subjectId;
    const cmpSub = nameA.localeCompare(nameB, 'vi');
    if (cmpSub !== 0) return cmpSub;
    return a.grade - b.grade;
  });

  const results: SubjectGroupSummary[] = [];

  sortedBuckets.forEach(({ subjectId, grade, assigns }) => {
    const subjectObj = subjectMap.get(subjectId);
    const subName = subjectObj ? subjectObj.name : 'Môn';
    const abbrSubj = abbreviateSubjectName(subName, customRules);

    // Nhóm tiếp theo số tiết/tuần
    const periodsMap = new Map<number, string[]>();
    let totalWeekly = 0;
    let totalClasses = 0;

    assigns.forEach((a) => {
      const p = a.periodsPerWeek || 0;
      totalWeekly += p;
      totalClasses += 1;

      const clsObj = a.classId ? classMap.get(a.classId) : undefined;
      let rawCName = clsObj ? clsObj.name : '';
      if (!rawCName) {
        if (a.isInterSchool || a.interSchoolName) {
          rawCName = `Liên trường${a.interSchoolName ? ` (${a.interSchoolName})` : ''}`;
        } else {
          rawCName = a.classId || 'Lớp';
        }
      }
      const cName = cleanClassName(rawCName);

      if (!periodsMap.has(p)) {
        periodsMap.set(p, []);
      }
      periodsMap.get(p)!.push(cName);
    });

    // Sắp xếp các mức số tiết giảm dần
    const sortedPeriods = Array.from(periodsMap.keys()).sort((a, b) => b - a);

    const periodGroupParts: string[] = [];
    sortedPeriods.forEach((p) => {
      const classNames = periodsMap.get(p)!;
      // Sắp xếp tên lớp tự nhiên (ví dụ 6A1 trước 6A2 ... 6A8, 6A9 trước 6A10)
      classNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      // Áp dụng quy tắc viết tắt cho "(X tiết)" -> "(1t)"
      const unitP = applyAbbreviationRules(`(${p} tiết)`, customRules);
      periodGroupParts.push(`${classNames.join(', ')} ${unitP}`);
    });

    const classGroupText = periodGroupParts.join('; ');
    // Áp dụng quy tắc viết tắt cho "[Y tiết/tuần]" -> "[8t/tuần]"
    const unitTotal = applyAbbreviationRules(`[${totalWeekly} tiết/tuần]`, customRules);
    const lineText = `${abbrSubj}: ${classGroupText} ${unitTotal}`;

    results.push({
      subjectId,
      subjectName: subName,
      subjectAbbr: abbrSubj,
      abbreviatedSubjectName: abbrSubj,
      grade,
      totalWeeklyPeriods: totalWeekly,
      totalClasses,
      classGroupText,
      lineText,
    });
  });

  return results;
}

/**
 * Chuẩn hóa năm học: loại bỏ tiền tố 'sy_', thay gạch dưới thành gạch ngang dài
 * 'sy_2026_2027' -> '2026–2027'
 */
export function cleanSchoolYear(yearStr?: string): string {
  if (!yearStr) return '2026–2027';
  let clean = yearStr.replace(/^sy_/i, '');
  clean = clean.replace(/_/g, '–').replace(/-/g, '–');
  return clean || '2026–2027';
}

/**
 * Thử nghiệm chuyển đổi chuỗi văn bản với các quy tắc viết tắt hiện có
 */
export function testAbbreviationTransformation(
  inputText: string,
  customRules?: AbbreviationRule[]
): { transformedText: string; matchedRules: AbbreviationRule[] } {
  if (!inputText) return { transformedText: '', matchedRules: [] };

  const activeRules = getActiveAbbreviationRules(customRules);
  const compiledTerms = getCompiledTerms(activeRules);
  let transformedText = inputText;
  const matchedRuleMap = new Map<string, AbbreviationRule>();

  for (const { term, rule } of compiledTerms) {
    const abbr = rule.abbreviatedText.trim();
    if (!abbr || term.toLowerCase() === abbr.toLowerCase()) continue;

    const escaped = escapeRegExp(term);
    try {
      const regex = new RegExp(`(?<![\\p{L}_])${escaped}(?![\\p{L}_])`, 'giu');
      if (regex.test(transformedText)) {
        transformedText = transformedText.replace(regex, abbr);
        matchedRuleMap.set(rule.id, rule);
      }
    } catch {
      const fallbackRegex = new RegExp(`(?<![a-zA-Z_])${escaped}(?![a-zA-Z_])`, 'gi');
      if (fallbackRegex.test(transformedText)) {
        transformedText = transformedText.replace(fallbackRegex, abbr);
        matchedRuleMap.set(rule.id, rule);
      }
    }
  }

  // Chuẩn hóa thẩm mỹ sau cùng
  transformedText = transformedText.replace(/\bCN\s+lớp\b/gi, 'CN');
  transformedText = transformedText.replace(/(\d+)\s+(t\/tuần)\b/gi, '$1$2');
  transformedText = transformedText.replace(/(\d+)\s+(t)\b(?!\/)/gi, '$1$2');

  return { transformedText: transformedText.trim(), matchedRules: Array.from(matchedRuleMap.values()) };
}
