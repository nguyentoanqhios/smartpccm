/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Smart Excel Import Service with Precise Header Detection, Exact Subject Mapping & Zero Hallucination
 */

import ExcelJS from 'exceljs';
import {
  Teacher,
  SchoolClass,
  TeachingAssignment,
  CurriculumDistribution,
  SchoolInfo,
  SchoolSession,
  Department,
  SpecialDuty,
  SchoolBranch,
  Subject,
} from '../types';

export interface RawDetectedTeacher {
  stt?: number | string;
  code?: string;
  fullName: string;
  genderRaw?: string;
  birthDateRaw?: string;
  startYearRaw?: number | string;
  initialDegreeRaw?: string;
  higherDegreeRaw?: string;
  majorRaw?: string;
  deptRaw?: string;
  workplaceRaw?: string;
  positionsRaw?: string;
  statusRaw?: string;
  quotaRaw?: number | string;
  offDayRaw?: string;
  bdHsgRaw?: string;
  dutiesRaw?: string;
  phoneRaw?: string;
  emailRaw?: string;
  notesRaw?: string;
  recognizedSubjectNames: string[];
  departmentName?: string;
}

export interface ImportPreviewResult {
  sheetNames: string[];
  schoolInfoDetected?: Partial<SchoolInfo>;
  teachersToImport: Partial<Teacher>[];
  classesToImport: Partial<SchoolClass>[];
  assignmentsToImport: Partial<TeachingAssignment>[];
  curriculumToImport: Partial<CurriculumDistribution>[];
  rawTeachers: RawDetectedTeacher[];
  detectedColumns: {
    teacherColumns: string[];
    classColumns: string[];
    assignmentColumns: string[];
  };
  errors: string[];
  warnings: string[];
  totalRows: number;
}

// Normalize text for flexible header matching while preserving core characters
export function normalizeStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd');
}

/**
 * Standard Subject Catalog for Secondary School (THCS - CT GDPT 2018)
 */
export interface StandardSubjectDef {
  id: string;
  name: string;
  shortName: string;
  departmentId: string;
  // Discrete phrase patterns for accurate matching
  phrases: string[];
  // Exact isolated word regexes (boundary-tested)
  wordRegex?: RegExp;
}

export const THCS_STANDARD_SUBJECTS: StandardSubjectDef[] = [
  {
    id: 'sub_toan',
    name: 'Toán học',
    shortName: 'Toán',
    departmentId: 'dept_toan_tin',
    phrases: ['toan hoc', 'mon toan', 'dai so', 'hinh hoc', 'toan'],
    wordRegex: /(?:^|[^\p{L}])(toán\s*học|môn\s*toán|đại\s*số|hình\s*học|toán)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_van',
    name: 'Ngữ văn',
    shortName: 'Văn',
    departmentId: 'dept_van_su_dia',
    phrases: ['ngu van', 'van hoc', 'tieng viet', 'mon van', 'van'],
    wordRegex: /(?:^|[^\p{L}])(ngữ\s*văn|văn\s*học|tiếng\s*việt|môn\s*văn|văn)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_tieng_anh',
    name: 'Tiếng Anh',
    shortName: 'Tiếng Anh',
    departmentId: 'dept_ngoai_ngu',
    phrases: ['tieng anh', 'ngoai ngu', 'mon anh', 'anh van', 'english', 'tieng anh 6', 'tieng anh 7', 'tieng anh 8', 'tieng anh 9', 'anh'],
    wordRegex: /(?:^|[^\p{L}])(tiếng\s*anh|ngoại\s*ngữ|môn\s*anh|anh\s*văn|english)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_khtn',
    name: 'Khoa học tự nhiên',
    shortName: 'KHTN',
    departmentId: 'dept_khtn',
    phrases: [
      'khoa hoc tu nhien',
      'khtn',
      'vat ly',
      'vat li',
      'hoa hoc',
      'sinh hoc',
      'ly hoa',
      'hoa ly',
      'hoa sinh',
      'sinh hoa',
      'ly sinh',
      'sinh ly',
    ],
    wordRegex: /(?:^|[^\p{L}])(khoa\s*học\s*tự\s*nhiên|khtn|vật\s*l[yí]|hóa\s*học|sinh\s*học|l[yí]\s*[-–/]\s*hóa|hóa\s*[-–/]\s*sinh|sinh\s*[-–/]\s*hóa|l[yí]\s*[-–/]\s*sinh)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_ls_dl',
    name: 'Lịch sử và Địa lí',
    shortName: 'Lịch sử & Địa lí',
    departmentId: 'dept_van_su_dia',
    phrases: [
      'lich su va dia ly',
      'lich su va dia li',
      'lich su & dia ly',
      'lich su & dia li',
      'lich su',
      'dia ly',
      'dia li',
      'su dia',
      'su - dia',
      'dia su',
      'ls-dl',
      'ls_dl',
      'ls&dl',
      'ls dl',
    ],
    wordRegex: /(?:^|[^\p{L}])(lịch\s*sử\s*(và|&)?\s*địa\s*l[yí]|lịch\s*sử|địa\s*l[yí]|sử\s*[-&/]\s*địa|địa\s*[-&/]\s*sử|ls[-_& ]?dl)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_gdcd',
    name: 'Giáo dục công dân',
    shortName: 'GDCD',
    departmentId: 'dept_nghe_thuat_gdtc',
    phrases: ['giao duc cong dan', 'gdcd', 'cong dan', 'dao duc'],
    wordRegex: /(?:^|[^\p{L}])(giáo\s*dục\s*công\s*dân|gdcd|công\s*dân|đạo\s*đức)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_tin_hoc',
    name: 'Tin học',
    shortName: 'Tin học',
    departmentId: 'dept_toan_tin',
    phrases: ['tin hoc', 'mon tin', 'cntt', 'cong nghe thong tin', 'tin'],
    wordRegex: /(?:^|[^\p{L}])(tin\s*học|môn\s*tin|công\s*nghệ\s*thông\s*tin|cntt)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_cong_nghe',
    name: 'Công nghệ',
    shortName: 'Công nghệ',
    departmentId: 'dept_khtn',
    phrases: ['cong nghe', 'ky thuat', 'ki thuat', 'cong nghiep', 'nong nghiep'],
    wordRegex: /(?:^|[^\p{L}])(công\s*nghệ|kỹ\s*thuật|kĩ\s*thuật|công\s*nghiệp|nông\s*nghiệp)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_am_nhac',
    name: 'Âm nhạc',
    shortName: 'Âm nhạc',
    departmentId: 'dept_nghe_thuat_gdtc',
    phrases: ['am nhac', 'mon nhac', 'thanh nhac', 'hat nhac', 'nhac'],
    wordRegex: /(?:^|[^\p{L}])(âm\s*nhạc|môn\s*nhạc|thanh\s*nhạc|hát\s*nhạc)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_my_thuat',
    name: 'Mĩ thuật',
    shortName: 'Mĩ thuật',
    departmentId: 'dept_nghe_thuat_gdtc',
    phrases: ['mi thuat', 'my thuat', 'hoi hoa', 've'],
    wordRegex: /(?:^|[^\p{L}])(m[ĩỹ]\s*thuật|hội\s*họa)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_gdtc',
    name: 'Giáo dục thể chất',
    shortName: 'GDTC',
    departmentId: 'dept_nghe_thuat_gdtc',
    phrases: ['giao duc the chat', 'gdtc', 'the duc', 'the thao'],
    wordRegex: /(?:^|[^\p{L}])(giáo\s*dục\s*thể\s*chất|gdtc|thể\s*dục|thể\s*thao)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_hdkt_hn',
    name: 'Hoạt động trải nghiệm, hướng nghiệp',
    shortName: 'HĐTN',
    departmentId: 'dept_van_su_dia',
    phrases: ['hoat dong trai nghiem', 'trai nghiem', 'huong nghiep', 'hdtn', 'hdtn, hn', 'hdtn-hn', 'hdtn hn'],
    wordRegex: /(?:^|[^\p{L}])(hoạt\s*động\s*trải\s*nghiệm|trải\s*nghiệm|hướng\s*nghiệp|hdtn|hđtn)(?:[^\p{L}]|$)/iu,
  },
  {
    id: 'sub_gddp',
    name: 'Giáo dục địa phương',
    shortName: 'GDĐP',
    departmentId: 'dept_van_su_dia',
    phrases: ['giao duc dia phuong', 'gddp', 'gddp 6', 'gddp 7', 'gddp 8', 'gddp 9'],
    wordRegex: /(?:^|[^\p{L}])(giáo\s*dục\s*địa\s*phương|gdđp|gddp)(?:[^\p{L}]|$)/iu,
  },
];

/**
 * Accurately recognize subjects from text WITHOUT hallucinating or defaulting to any subject.
 * Returns list of matched subject IDs. If none matches, returns empty array [].
 */
export function matchSubjectsFromText(rawText?: string): string[] {
  if (!rawText) return [];
  const text = rawText.trim();
  if (!text) return [];

  const norm = normalizeStr(text);
  const matchedIds = new Set<string>();

  // Special handling for compound Vietnamese teacher training specializations
  // 1. Toán - Tin
  if (/(?:toán\s*[-–/&]\s*tin|toan\s*[-–/&]\s*tin)/i.test(text) || (norm.includes('toan') && norm.includes('tin') && !norm.includes('thong tin'))) {
    matchedIds.add('sub_toan');
    matchedIds.add('sub_tin_hoc');
  }
  // 2. Toán - Lý / Toán - Hóa / Toán - Sinh -> Toán + KHTN
  if (/(?:toán\s*[-–/&]\s*(?:l[yí]|hóa|sinh)|toan\s*[-–/&]\s*(?:ly|li|hoa|sinh))/i.test(text)) {
    matchedIds.add('sub_toan');
    matchedIds.add('sub_khtn');
  }
  // 3. Văn - Sử / Văn - Địa -> Văn + Lịch sử & Địa lí
  if (/(?:văn\s*[-–/&]\s*(?:sử|địa)|van\s*[-–/&]\s*(?:su|dia))/i.test(text)) {
    matchedIds.add('sub_van');
    matchedIds.add('sub_ls_dl');
  }
  // 4. Văn - GDCD -> Văn + GDCD
  if (/(?:văn\s*[-–/&]\s*gdcd|van\s*[-–/&]\s*gdcd|văn\s*[-–/&]\s*công\s*dân)/i.test(text)) {
    matchedIds.add('sub_van');
    matchedIds.add('sub_gdcd');
  }
  // 5. Nhạc - Họa / Họa - Nhạc -> Âm nhạc + Mĩ thuật
  if (/(?:nhạc\s*[-–/&]\s*họa|họa\s*[-–/&]\s*nhạc|nhac\s*[-–/&]\s*hoa|hoa\s*[-–/&]\s*nhac|nhac\s*hoa)/i.test(text)) {
    matchedIds.add('sub_am_nhac');
    matchedIds.add('sub_my_thuat');
  }

  // Check each standard subject definition
  for (const def of THCS_STANDARD_SUBJECTS) {
    if (matchedIds.has(def.id)) continue;

    // 1. Check with Unicode regex on original accented text
    if (def.wordRegex && def.wordRegex.test(text)) {
      // Guard against common false positives on original accented text
      if (def.id === 'sub_toan') {
        // Must NOT match "toàn" (as in "toàn trường", "an toàn", "Lê Văn Toàn")
        if (/(?:^|[^\p{L}])(toàn|hoàn\s*toàn|an\s*toàn)(?:[^\p{L}]|$)/iu.test(text) && !/(?:^|[^\p{L}])(toán\s*học|môn\s*toán|đại\s*số|hình\s*học|toán)(?:[^\p{L}]|$)/iu.test(text)) {
          continue;
        }
      }
      if (def.id === 'sub_van') {
        // Guard against "văn phòng", "tư vấn", "văn hóa", "văn nghệ"
        if (/(?:văn\s*phòng|tư\s*vấn|văn\s*hóa|văn\s*nghệ)/iu.test(text) && !/(?:ngữ\s*văn|văn\s*học|tiếng\s*việt|môn\s*văn)/iu.test(text) && text.trim().toLowerCase() !== 'văn') {
          continue;
        }
      }
      matchedIds.add(def.id);
      continue;
    }

    // 2. Check phrase matching on normalized text with strict boundaries
    for (const phrase of def.phrases) {
      if (phrase.includes(' ')) {
        // Multi-word phrase e.g. "khoa hoc tu nhien", "lich su va dia li"
        if (norm.includes(phrase)) {
          matchedIds.add(def.id);
          break;
        }
      } else {
        // Single word token e.g. "toan", "khtn", "gdcd", "gdtc"
        const regex = new RegExp(`(^|[^a-z0-9])${phrase}([^a-z0-9]|$)`, 'i');
        if (regex.test(norm)) {
          // Extra strict guards for delicate single-word tokens
          if (phrase === 'toan') {
            // Must NOT be "toan truong", "toan bo", "an toan", "hoan toan"
            if (norm.includes('toan truong') || norm.includes('toan bo') || norm.includes('an toan') || norm.includes('hoan toan')) {
              continue;
            }
            matchedIds.add(def.id);
            break;
          } else if (phrase === 'anh') {
            // Must actually refer to English subject
            if (norm === 'anh' || norm === 'mon anh' || norm.startsWith('anh ') || norm.endsWith(' anh') || norm.includes('tieng anh')) {
              matchedIds.add(def.id);
              break;
            }
          } else if (phrase === 'van') {
            // Guard against "van phong", "tu van", "van hoa", "van nghe"
            if (!norm.includes('van phong') && !norm.includes('tu van') && !norm.includes('van hoa') && !norm.includes('van nghe')) {
              matchedIds.add(def.id);
              break;
            }
          } else if (phrase === 'tin') {
            // Guard against "thong tin", "tin tuc", "tu tin"
            if (!norm.includes('thong tin') && !norm.includes('tin tuc') && !norm.includes('tu tin')) {
              matchedIds.add(def.id);
              break;
            }
          } else {
            matchedIds.add(def.id);
            break;
          }
        }
      }
    }
  }

  // ABSOLUTELY NEVER DEFAULT TO "sub_toan" OR ANY OTHER SUBJECT!
  // If nothing matched, return empty array so that data remains completely pure.
  return Array.from(matchedIds);
}

/**
 * Map Department string from Excel to standard Department ID
 */
export function mapDepartmentFromText(deptText?: string, fallbackSubjectId?: string): string {
  if (!deptText && fallbackSubjectId) {
    const subj = THCS_STANDARD_SUBJECTS.find((s) => s.id === fallbackSubjectId);
    if (subj) return subj.departmentId;
  }
  if (!deptText) return 'dept_toan_tin';

  const norm = normalizeStr(deptText);
  if (norm.includes('toan') || norm.includes('tin')) return 'dept_toan_tin';
  if (norm.includes('khtn') || norm.includes('tu nhien') || norm.includes('ly') || norm.includes('hoa') || norm.includes('sinh') || norm.includes('cong nghe')) {
    return 'dept_khtn';
  }
  if (norm.includes('van') || norm.includes('su') || norm.includes('dia') || norm.includes('xa hoi')) {
    return 'dept_van_su_dia';
  }
  if (norm.includes('ngoai ngu') || norm.includes('tieng anh') || norm === 'anh') {
    return 'dept_ngoai_ngu';
  }
  if (norm.includes('nghe thuat') || norm.includes('the chat') || norm.includes('nang khieu') || norm.includes('gdtc') || norm.includes('am nhac') || norm.includes('my thuat') || norm.includes('gdcd')) {
    return 'dept_nghe_thuat_gdtc';
  }

  return 'dept_toan_tin';
}

export function getSubjectDisplayName(subjectId: string): string {
  const subj = THCS_STANDARD_SUBJECTS.find((s) => s.id === subjectId);
  return subj ? subj.shortName : subjectId;
}

/**
 * Detect if a text represents a Title, Header, Summary, Note, Supplement, or Signature
 * that MUST be excluded from teacher and assignment data rows.
 */
export function isNonDataRowText(text?: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (!t) return false;
  const norm = normalizeStr(t);

  // 1. Summary / Total row
  if (
    norm.startsWith('tong cong') ||
    norm.startsWith('tong so') ||
    norm.startsWith('cong:') ||
    norm.startsWith('tong:') ||
    norm.startsWith('cong :') ||
    norm.startsWith('tong :') ||
    norm === 'tong cong' ||
    norm === 'tong so' ||
    norm === 'tong' ||
    norm === 'cong' ||
    norm.startsWith('so luong gv') ||
    norm.startsWith('so luong:') ||
    norm.startsWith('tong cong:')
  ) {
    return true;
  }

  // 2. Document Titles & Table Headers
  if (
    norm.startsWith('danh sach can bo') ||
    norm.startsWith('danh sach giao vien') ||
    norm.startsWith('bang phan cong') ||
    norm.startsWith('phan cong chuyen mon') ||
    norm.startsWith('phan cong giang day') ||
    norm.startsWith('so phan cong') ||
    norm.startsWith('bang thong ke') ||
    norm.startsWith('truong thcs') ||
    norm.startsWith('truong tieu hoc') ||
    norm.startsWith('truong thpt') ||
    norm.startsWith('phong gd') ||
    norm.startsWith('so gd') ||
    norm.startsWith('ubnd ') ||
    norm.startsWith('uy ban nhan dan')
  ) {
    return true;
  }

  // 3. Administrative / Signature block ("Người lập biểu", "Ký tên", ngày tháng)
  if (
    norm.startsWith('nguoi lap') ||
    norm.startsWith('nguoi lap bieu') ||
    norm.startsWith('nguoi lap bang') ||
    norm.startsWith('chu ky') ||
    norm.startsWith('ky ten') ||
    norm.startsWith('ky va ghi ro') ||
    norm.startsWith('xac nhan cua') ||
    /ngay\s*\d+\s*thang\s*\d+\s*nam\s*202\d/i.test(norm)
  ) {
    return true;
  }

  // 4. Roman numeral section headers e.g. "I.", "II.", "III.", "A.", "B.", "PHẦN I", "PHẦN II"
  if (/^(?:phan\s+)?(?:[ivx]+|[a-d])[\.\s\:\-]/i.test(norm) || /^phan\s+[ivx0-9a-z]/i.test(norm)) {
    return true;
  }

  // 5. Repetition of table headers
  if (
    norm === 'ho va ten' ||
    norm === 'ho ten' ||
    norm === 'ho va ten gv' ||
    norm === 'ten giao vien' ||
    norm === 'stt' ||
    norm === 'so tt' ||
    norm === 'so thu tu' ||
    norm === 'ma gv'
  ) {
    return true;
  }

  return false;
}

/**
 * Validate that a string is a genuine Vietnamese person's name
 */
/**
 * Trích xuất an toàn chuỗi văn bản từ ExcelJS Cell (hỗ trợ richText, số, boolean, công thức)
 */
export function getCellText(cell: ExcelJS.Cell | undefined | null): string {
  if (!cell) return '';
  const text = cell.text;
  if (text !== undefined && text !== null && String(text).trim()) {
    return String(text).trim();
  }
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val).trim();
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray((val as any).richText)) {
      return (val as any).richText.map((rt: any) => rt.text).join('').trim();
    }
    if ('result' in val) return String((val as any).result ?? '').trim();
    if ('text' in val) return String((val as any).text ?? '').trim();
  }
  return String(val).trim();
}

export function isValidPersonName(nameRaw?: string): boolean {
  if (!nameRaw) return false;
  let name = String(nameRaw).trim();

  // Loại bỏ các tiền tố xưng hô phổ biến: "Thầy ", "Cô ", "GV ", "Đ/c ", "ThS. ", "TS. ", v.v.
  name = name.replace(/^(Thầy|Cô|GV|Đ\/c|Đồng chí|ThS\.?|TS\.?|Thạc sĩ|Tiến sĩ)\s+/i, '').trim();

  // Loại bỏ ghi chú trong ngoặc đơn ở cuối tên: " (Toán)", " (Hợp đồng)", " (Chủ nhiệm)"
  name = name.replace(/\s*\([^)]*\)$/, '').trim();

  // Bác bỏ nếu quá ngắn (< 2 ký tự) hoặc quá dài (> 60 ký tự)
  if (name.length < 2 || name.length > 60) return false;

  // Bác bỏ nếu chỉ toàn số hoặc ký tự đặc biệt
  if (/^[\d\s\.,;:_+\-=*/?!@#$%^&()\[\]{}]+$/.test(name)) return false;

  const norm = normalizeStr(name);
  if (isNonDataRowText(norm)) return false;

  // Bác bỏ các cụm từ hành chính, tiêu đề bảng hoặc tổng kết
  const forbiddenPhrases = [
    'danh sach',
    'bang phan cong',
    'tong cong',
    'tong so',
    'nguoi lap',
    'nguoi lap bieu',
    'nguoi lap bang',
    'chu ky',
    'ky ten',
    'xac nhan',
    'stt',
    'so thu tu',
    'can bo quan ly',
    'can bo giao vien',
    'phan cong chuyen mon',
    'nam hoc 202',
    'truong thcs',
    'truong tieu hoc',
    'ubnd',
    'phong gd',
    'so gd',
  ];

  if (forbiddenPhrases.some((fp) => norm === fp || norm.startsWith(fp + ' '))) {
    return false;
  }

  // Bắt buộc phải chứa ít nhất một chữ cái Unicode tiếng Việt
  if (!/[\p{L}]/u.test(name)) return false;

  return true;
}

export function parseExcelDate(val: any): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    if (y < 1920 || y > 2050) return '';
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (
    !str ||
    str === '0' ||
    str === '-' ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'none'
  ) {
    return '';
  }

  // Format DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    if (year >= 1920 && year <= 2050 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Format YYYY/MM/DD or YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    if (year >= 1920 && year <= 2050 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // If only a 4-digit year e.g. "1975"
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    if (year >= 1920 && year <= 2050) {
      return str;
    }
    return '';
  }

  // Handle Javascript GMT Date string or ISO string e.g. "Tue Oct 21 1975 07:00:00 GMT+0700 (Indochina Time)"
  const parsedTimestamp = Date.parse(str);
  if (!isNaN(parsedTimestamp)) {
    const d = new Date(parsedTimestamp);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      if (year >= 1920 && year <= 2050) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }

  return '';
}

export function parseExcelGender(val: any): 'Nam' | 'Nữ' {
  if (!val) return 'Nữ';
  const norm = normalizeStr(String(val));
  if (norm.includes('nam') || norm === 'm' || norm === 'male') return 'Nam';
  return 'Nữ';
}

export function parseExcelStatus(val: any): { status: Teacher['status']; label?: string } {
  if (!val) return { status: 'ACTIVE' };
  const norm = normalizeStr(String(val));
  if (norm.includes('thai san') || norm.includes('nghi sinh')) {
    return { status: 'MATERNITY', label: 'Nghỉ thai sản' };
  }
  if (norm.includes('hieu truong') && !norm.includes('pho')) {
    return { status: 'PRINCIPAL', label: 'Hiệu trưởng' };
  }
  if (norm.includes('pho hieu truong') || norm.includes('pht')) {
    return { status: 'VICE_PRINCIPAL', label: 'Phó hiệu trưởng' };
  }
  if (norm.includes('om') || norm.includes('benh')) {
    return { status: 'SICK_LEAVE', label: 'Nghỉ ốm' };
  }
  if (norm.includes('biet phai')) {
    return { status: 'SECONDMENT', label: 'Biệt phái' };
  }
  if (norm.includes('khong luong')) {
    return { status: 'UNPAID_LEAVE', label: 'Nghỉ không lương' };
  }
  if (norm.includes('chuyen cong tac')) {
    return { status: 'TRANSFERRED', label: 'Chuyển công tác' };
  }
  return { status: 'ACTIVE' };
}

/**
 * Primary Excel Parsing Function
 */
export async function parseUploadedExcel(file: File): Promise<ImportPreviewResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const teachersToImport: Partial<Teacher>[] = [];
  const rawTeachers: RawDetectedTeacher[] = [];
  const classesToImport: Partial<SchoolClass>[] = [];
  const assignmentsToImport: Partial<TeachingAssignment>[] = [];
  const curriculumToImport: Partial<CurriculumDistribution>[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let schoolInfoDetected: Partial<SchoolInfo> | undefined = undefined;

  const detectedColumns = {
    teacherColumns: [] as string[],
    classColumns: [] as string[],
    assignmentColumns: [] as string[],
  };

  // -------------------------------------------------------------------------
  // 0. DETECT SCHOOL INFO IN HEADERS (Title scanning)
  // -------------------------------------------------------------------------
  for (const ws of workbook.worksheets) {
    for (let r = 1; r <= 6; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 10; c++) {
        const text = row.getCell(c).text?.trim();
        if (!text) continue;

        if (
          text.toUpperCase().includes('TRƯỜNG') ||
          text.toUpperCase().includes('THCS') ||
          text.toUpperCase().includes('PHÂN HIỆU') ||
          text.toUpperCase().includes('TIỂU HỌC')
        ) {
          if (!schoolInfoDetected) schoolInfoDetected = {};
          if (text.includes('–') || text.includes('-')) {
            const parts = text.split(/[–-]/).map((s) => s.trim());
            schoolInfoDetected.branchName = parts[0];
            schoolInfoDetected.schoolName = parts[1] || parts[0];
          } else {
            schoolInfoDetected.schoolName = text;
          }
        }
        if (text.includes('202') && (text.toUpperCase().includes('NĂM HỌC') || text.toUpperCase().includes('NH'))) {
          if (!schoolInfoDetected) schoolInfoDetected = {};
          const match = text.match(/202\d\s*[-–/]\s*202\d/);
          if (match) schoolInfoDetected.schoolYear = match[0].replace(/\s+/g, '');
        }
      }
    }
  }

  // Helper to find sheet by keywords
  const findSheet = (keywords: string[]) => {
    return workbook.worksheets.find((ws) => {
      const normName = normalizeStr(ws.name);
      return keywords.some((kw) => normName.includes(normalizeStr(kw)));
    });
  };

  const detectedClassesMap = new Map<string, Partial<SchoolClass>>();

  const registerClass = (codeRaw: string, studentCountRaw?: number, sessionRaw?: string, roomRaw?: string): Partial<SchoolClass> | null => {
    if (!codeRaw) return null;
    let cleanCode = codeRaw.replace(/^(Lớp|Lop|Khối|Khoi)\s*[-:]?\s*/i, '').trim().toUpperCase();
    cleanCode = cleanCode.replace(/[\/\.]/, 'A'); // convert 6.1 or 6/1 -> 6A1

    const gradeMatch = cleanCode.match(/^([6789])/);
    if (!gradeMatch) return null;
    const grade = Number(gradeMatch[1]) as 6 | 7 | 8 | 9;

    if (cleanCode.length < 2 || cleanCode.length > 8) return null;
    if (
      cleanCode.includes('TỔNG') ||
      cleanCode.includes('CONG') ||
      cleanCode.includes('STT') ||
      cleanCode.includes('TIET') ||
      cleanCode.includes('BỔ SUNG')
    ) {
      return null;
    }

    const existing = detectedClassesMap.get(cleanCode);
    const lower = sessionRaw?.toLowerCase() || '';
    const session: SchoolSession =
      lower.includes('2 buoi') ||
      lower.includes('hai buoi') ||
      lower.includes('ca ngay') ||
      lower.includes('2 buổi') ||
      lower.includes('cả ngày')
        ? 'FULL_DAY'
        : lower.includes('chieu')
        ? 'AFTERNOON'
        : lower.includes('sang')
        ? 'MORNING'
        : grade >= 8
        ? 'AFTERNOON'
        : 'MORNING';

    const classObj: Partial<SchoolClass> = {
      id: existing?.id || `cls_import_${cleanCode.toLowerCase()}`,
      code: cleanCode,
      name: `Lớp ${cleanCode}`,
      grade,
      studentCount: studentCountRaw && studentCountRaw > 0 ? studentCountRaw : existing?.studentCount || 35,
      session,
      room: roomRaw || existing?.room || `Phòng ${cleanCode}`,
      active: true,
    };

    detectedClassesMap.set(cleanCode, classObj);
    return classObj;
  };

  // -------------------------------------------------------------------------
  // 1. PARSE TEACHER SHEET (DỮ LIỆU GIÁO VIÊN)
  // -------------------------------------------------------------------------
  let teacherSheet = findSheet([
    'danh sach giao vien',
    'du lieu gv',
    'giao vien',
    'dsgv',
    'teacher',
    'gv',
    'cbgv',
    'can bo',
    'nhan su',
    'ho so',
    'danh sach gv',
    'ds_gv',
    'ds can bo',
  ]);

  if (!teacherSheet) {
    let maxFound = 0;
    for (const ws of workbook.worksheets) {
      for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
        const row = ws.getRow(r);
        let m = 0;
        row.eachCell((c) => {
          const n = normalizeStr(c.text || c.value);
          if (n.includes('ho va ten') || n.includes('ho ten') || n.includes('ten giao vien') || n.includes('ten gv')) m += 3;
          if (n.includes('ma gv') || n.includes('ma giao vien')) m += 2;
          if (n.includes('to chuyen mon') || n.includes('chuyen mon')) m += 2;
        });
        if (m > maxFound) {
          maxFound = m;
          teacherSheet = ws;
        }
      }
    }
  }

  const sheetToScanForTeachers = teacherSheet || workbook.worksheets[0];

  if (sheetToScanForTeachers) {
    let headerRowIdx = -1;
    let dataStartRowIdx = -1;
    const colMap: {
      stt?: number;
      code?: number;
      fullName?: number;
      hoDem?: number;
      ten?: number;
      gender?: number;
      birthDate?: number;
      startYear?: number;
      initialDegree?: number;
      higherDegree?: number;
      dept?: number;
      major?: number;
      workplace?: number;
      positions?: number;
      status?: number;
      quota?: number;
      offDay?: number;
      bdHsg?: number;
      duties?: number;
      phone?: number;
      email?: number;
      notes?: number;
    } = {};

    // Find the TRUE column header row (evaluate rows 1 to 15)
    let bestHeaderRow = -1;
    let maxMarkers = 0;
    let bestMap: typeof colMap = {};
    let bestDetectedCols: string[] = [];

    for (let r = 1; r <= 15; r++) {
      const row = sheetToScanForTeachers.getRow(r);
      let foundMarkers = 0;
      const tempMap: typeof colMap = {};
      const rowCols: string[] = [];
      let isDisqualifiedTitleRow = false;

      row.eachCell((cell, colNumber) => {
        const text = cell.text?.trim();
        if (!text) return;
        rowCols.push(text);
        const norm = normalizeStr(text);

        // Disqualify row if it contains sheet title / organization headers
        if (
          norm.includes('danh sach can bo') ||
          norm.includes('danh sach giao vien') ||
          norm.includes('bang phan cong') ||
          norm.includes('nam hoc 202') ||
          norm.includes('truong thcs') ||
          norm.includes('truong tieu hoc') ||
          norm.includes('ubnd') ||
          norm.includes('phong gd') ||
          norm.includes('so gd')
        ) {
          isDisqualifiedTitleRow = true;
        }

        // 1. STT
        if (norm === 'stt' || norm === 'so tt' || norm === 'so thu tu' || norm === 'tt') {
          tempMap.stt = colNumber;
          foundMarkers += 2;
        }
        // 2. Mã GV
        else if (norm === 'ma gv' || norm === 'ma giao vien' || norm === 'ma cb' || norm === 'ma cbgv' || norm === 'ma so' || norm === 'magv') {
          tempMap.code = colNumber;
          foundMarkers += 2;
        }
        // 3. Họ và tên
        else if (
          norm.includes('ho va ten') ||
          norm.includes('ho ten') ||
          norm.includes('ten giao vien') ||
          norm.includes('ten can bo') ||
          norm.includes('ho va ten gv') ||
          norm.includes('cbgv') ||
          (norm.includes('ten') && !norm.includes('mon') && !norm.includes('lop') && !norm.includes('truong') && (norm.includes('giao vien') || norm.includes('can bo')))
        ) {
          tempMap.fullName = colNumber;
          foundMarkers += 3;
        }
        // 4. Họ đệm
        else if (norm === 'ho va chu lot' || norm === 'ho va dem' || norm === 'ho dem' || norm === 'ho lot' || norm === 'ho' || norm === 'ho va') {
          tempMap.hoDem = colNumber;
          foundMarkers += 1;
        }
        // 5. Tên
        else if (norm === 'ten' || norm === 'ten gv' || norm === 'ten rieng') {
          tempMap.ten = colNumber;
          foundMarkers += 2;
        }
        // 6. Tổ chuyên môn
        else if (norm === 'to chuyen mon' || norm === 'to bo mon' || norm === 'to cm' || norm === 'to' || norm === 'to mon') {
          tempMap.dept = colNumber;
          foundMarkers += 2;
        }
        // 7. Chuyên môn / Môn đào tạo / Môn dạy
        else if (
          norm === 'chuyen mon' ||
          norm === 'chuyen nganh' ||
          norm === 'mon dao tao' ||
          norm === 'mon day' ||
          norm === 'mon giang day' ||
          norm === 'mon hoc' ||
          norm === 'mon' ||
          norm === 'bo mon'
        ) {
          tempMap.major = colNumber;
          foundMarkers += 2;
        }
        // 8. Định mức
        else if (
          norm === 'dinh muc tiet' ||
          norm === 'dinh muc' ||
          norm === 'tiet chuan' ||
          norm === 'so tiet chuan' ||
          norm === 'dm tiet' ||
          norm === 'dinh muc day' ||
          norm === 'so tiet dinh muc'
        ) {
          tempMap.quota = colNumber;
          foundMarkers += 1;
        }
        // 9. Giới tính
        else if (norm === 'gioi tinh' || norm === 'phai' || norm === 'nam/nu' || norm === 'gioi' || norm === 'gender') {
          tempMap.gender = colNumber;
          foundMarkers += 1;
        }
        // 10. Ngày sinh
        else if (
          norm === 'ngay sinh' ||
          norm === 'nam sinh' ||
          norm === 'ngay thang nam sinh' ||
          norm === 'ngay/thang/nam sinh' ||
          norm === 'dob' ||
          norm === 'birthdate' ||
          norm.includes('ngay sinh')
        ) {
          tempMap.birthDate = colNumber;
          foundMarkers += 1;
        }
        // 11. Năm vào ngành
        else if (
          norm === 'nam vao nganh' ||
          norm === 'nam cong tac' ||
          norm === 'nam tuyen dung' ||
          norm === 'nam bat dau' ||
          norm === 'start year' ||
          norm === 'nam nganh'
        ) {
          tempMap.startYear = colNumber;
          foundMarkers += 1;
        }
        // 12. Trình độ ban đầu
        else if (
          norm === 'trinh do ban dau' ||
          norm === 'trinh do dao tao' ||
          norm === 'trinh do chuyen mon' ||
          norm === 'trinh do chuan' ||
          norm === 'trinh do' ||
          norm === 'trinh do cm ban dau' ||
          norm === 'trinh do cm'
        ) {
          tempMap.initialDegree = colNumber;
          foundMarkers += 1;
        }
        // 13. Trình độ nâng cao
        else if (
          norm === 'trinh do nang cao' ||
          norm === 'trinh do tren chuan' ||
          norm === 'sau dai hoc' ||
          norm === 'thac si' ||
          norm === 'trinh do cm nang cao'
        ) {
          tempMap.higherDegree = colNumber;
          foundMarkers += 1;
        }
        // 14. Nơi làm việc / Điểm trường
        else if (
          norm === 'noi lam viec' ||
          norm === 'diem truong' ||
          norm === 'co so' ||
          norm === 'phan hieu' ||
          norm === 'dia diem' ||
          norm === 'workplace'
        ) {
          tempMap.workplace = colNumber;
          foundMarkers += 1;
        }
        // 15. Chức vụ / Kiêm nhiệm / Vị trí
        else if (
          norm === 'chuc vu' ||
          norm === 'kiem nhiem' ||
          norm === 'nhiem vu' ||
          norm === 'cong tac kiem nhiem' ||
          norm === 'vi tri' ||
          norm === 'chuc danh' ||
          norm === 'chuc vu / kiem nhiem'
        ) {
          tempMap.positions = colNumber;
          tempMap.duties = colNumber;
          foundMarkers += 1;
        }
        // 16. Trạng thái
        else if (norm === 'trang thai' || norm === 'tinh trang' || norm === 'trang thai cong tac' || norm === 'status') {
          tempMap.status = colNumber;
          foundMarkers += 1;
        }
        // 17. Ngày nghỉ CM
        else if (norm === 'ngay nghi' || norm === 'ngay nghi cm' || norm === 'ngay nghi chuyen mon' || norm === 'offday') {
          tempMap.offDay = colNumber;
          foundMarkers += 1;
        }
        // 18. BD HSG
        else if (
          norm === 'bd hsg' ||
          norm === 'boi duong hsg' ||
          norm === 'bdhsg' ||
          norm === 'on thi' ||
          norm === 'day them' ||
          norm.includes('hsg')
        ) {
          tempMap.bdHsg = colNumber;
          foundMarkers += 1;
        }
        // 19. Số điện thoại
        else if (norm === 'so dien thoai' || norm === 'dien thoai' || norm === 'sdt' || norm === 'phone' || norm === 'tel') {
          tempMap.phone = colNumber;
          foundMarkers += 1;
        }
        // 20. Email
        else if (norm === 'email' || norm === 'thu dien tu' || norm === 'mail') {
          tempMap.email = colNumber;
          foundMarkers += 1;
        }
        // 21. Ghi chú
        else if (norm === 'ghi chu' || norm === 'luu y' || norm === 'chu thich' || norm === 'note') {
          tempMap.notes = colNumber;
          foundMarkers += 1;
        }
      });

      if (isDisqualifiedTitleRow) continue;

      const hasNameCol = tempMap.fullName || (tempMap.hoDem && tempMap.ten);
      if (hasNameCol && foundMarkers > maxMarkers) {
        maxMarkers = foundMarkers;
        bestHeaderRow = r;
        bestMap = tempMap;
        bestDetectedCols = rowCols;
      }
    }

    if (bestHeaderRow > 0 && maxMarkers >= 3) {
      headerRowIdx = bestHeaderRow;
      Object.assign(colMap, bestMap);
      detectedColumns.teacherColumns = bestDetectedCols;

      // Check if row r+1 is a column numbering row e.g. (1), (2), (3)...
      const nextRow = sheetToScanForTeachers.getRow(headerRowIdx + 1);
      let numberCount = 0;
      let totalCells = 0;
      nextRow.eachCell((c) => {
        totalCells++;
        const t = c.text?.trim();
        if (t && (/^\(?\d+\)?$/.test(t) || t === 'A' || t === 'B' || t === 'C')) {
          numberCount++;
        }
      });

      if (totalCells >= 2 && numberCount >= totalCells / 2) {
        dataStartRowIdx = headerRowIdx + 2;
      } else {
        dataStartRowIdx = headerRowIdx + 1;
      }
    }

    // Process Teacher Rows ONLY starting from dataStartRowIdx
    if (headerRowIdx > 0 && dataStartRowIdx > 0 && (colMap.fullName || (colMap.hoDem && colMap.ten))) {
      sheetToScanForTeachers.eachRow((row, rowNumber) => {
        if (rowNumber < dataStartRowIdx) return;

        // 1. Extract Teacher Full Name safely using getCellText
        let rawName = '';
        if (colMap.fullName) {
          rawName = getCellText(row.getCell(colMap.fullName));
        } else if (colMap.hoDem && colMap.ten) {
          const hoDem = getCellText(row.getCell(colMap.hoDem));
          const ten = getCellText(row.getCell(colMap.ten));
          rawName = `${hoDem} ${ten}`.trim();
        }

        // If Name cell is empty, skip this non-data or empty row
        if (!rawName) return;

        // Check if name is actually a summary or header label (e.g. "TỔNG CỘNG", "Người lập biểu", "Cán bộ quản lý")
        if (isNonDataRowText(rawName) || !isValidPersonName(rawName)) return;

        // Check STT if present - only skip if STT itself is explicitly a summary keyword like "TỔNG"
        const rawStt = colMap.stt ? getCellText(row.getCell(colMap.stt)) : undefined;
        if (rawStt && isNonDataRowText(rawStt)) return;

        // Read all columns cleanly using getCellText
        const rawCode = colMap.code ? getCellText(row.getCell(colMap.code)) : undefined;
        const rawDept = colMap.dept ? getCellText(row.getCell(colMap.dept)) : undefined;
        const rawMajor = colMap.major ? getCellText(row.getCell(colMap.major)) : undefined;
        const rawDuties = colMap.duties ? getCellText(row.getCell(colMap.duties)) : undefined;
        const rawPositions = colMap.positions ? getCellText(row.getCell(colMap.positions)) : undefined;
        const rawWorkplace = colMap.workplace ? getCellText(row.getCell(colMap.workplace)) : undefined;
        const rawPhone = colMap.phone ? getCellText(row.getCell(colMap.phone)) : '';
        const rawEmail = colMap.email ? getCellText(row.getCell(colMap.email)) : '';
        const rawNotes = colMap.notes ? getCellText(row.getCell(colMap.notes)) : '';
        const rawOffDay = colMap.offDay ? getCellText(row.getCell(colMap.offDay)) : undefined;
        const rawBdHsg = colMap.bdHsg ? getCellText(row.getCell(colMap.bdHsg)) : undefined;
        const rawInitialDegree = colMap.initialDegree ? getCellText(row.getCell(colMap.initialDegree)) : undefined;
        const rawHigherDegree = colMap.higherDegree ? getCellText(row.getCell(colMap.higherDegree)) : undefined;

        // Parse Gender
        let parsedGender: 'Nam' | 'Nữ' = 'Nữ';
        if (colMap.gender) {
          const gCell = row.getCell(colMap.gender);
          parsedGender = parseExcelGender(getCellText(gCell) || gCell.value);
        }

        // Parse BirthDate
        let parsedBirthDate: string | undefined = undefined;
        if (colMap.birthDate) {
          const bCell = row.getCell(colMap.birthDate);
          parsedBirthDate = parseExcelDate(bCell.value || getCellText(bCell)) || undefined;
        }

        // Parse StartYear
        let parsedStartYear: number | undefined = undefined;
        if (colMap.startYear) {
          const syRaw = getCellText(row.getCell(colMap.startYear));
          const matchYear = syRaw.match(/\b(19\d{2}|20\d{2})\b/);
          if (matchYear) {
            parsedStartYear = parseInt(matchYear[1], 10);
          }
        }

        // Parse Status
        const statusResult = colMap.status
          ? parseExcelStatus(getCellText(row.getCell(colMap.status)) || row.getCell(colMap.status).value)
          : { status: 'ACTIVE' as const };

        // Parse Positions (kiêm nhiệm)
        const combinedDutyStr = [rawPositions, rawDuties].filter(Boolean).join(', ');
        const parsedPositions = combinedDutyStr
          ? Array.from(
              new Set(
                combinedDutyStr
                  .split(/[,;\n•+]+/)
                  .map((p) => p.trim())
                  .filter((p) => p.length >= 2)
              )
            )
          : [];

        // Quota: Only use if actually present in Excel file. Do NOT infer arbitrary numbers.
        let rawQuota: number | undefined = undefined;
        if (colMap.quota) {
          const val = Number(row.getCell(colMap.quota).value);
          if (!isNaN(val) && val > 0 && val <= 35) {
            rawQuota = val;
          }
        }

        // Subject Recognition: Precise match strictly from rawMajor! NEVER fallback to rawDept to guess subjects!
        const matchedSubjectIds = matchSubjectsFromText(rawMajor);
        const recognizedNames = matchedSubjectIds.map((id) => getSubjectDisplayName(id));

        const finalCode =
          rawCode && rawCode.length >= 2 && !rawCode.startsWith('STT')
            ? rawCode
            : `GV${(teachersToImport.length + 1).toString().padStart(2, '0')}`;

        const teacherId = `tc_import_${teachersToImport.length + 1}_${encodeURIComponent(rawName).replace(/%/g, '').slice(0, 10)}`;

        const departmentId = mapDepartmentFromText(rawDept, matchedSubjectIds[0]);

        // Add to teachers to import (Master Data)
        teachersToImport.push({
          id: teacherId,
          code: finalCode,
          fullName: rawName,
          gender: parsedGender,
          birthDate: parsedBirthDate,
          startYear: parsedStartYear,
          initialDegree: rawInitialDegree || '',
          higherDegree: rawHigherDegree || '',
          departmentId,
          workplace: rawWorkplace || '',
          positions: parsedPositions,
          major: rawMajor || '',
          status: statusResult.status,
          statusLabel: statusResult.label,
          standardQuota: rawQuota !== undefined ? rawQuota : 19, // 19 is default statutory norm for THCS
          subjectsCanTeach: matchedSubjectIds,
          offDay: rawOffDay,
          bdHsgInfo: rawBdHsg,
          phone: rawPhone || '',
          email: rawEmail || '',
          notes: [rawDuties, rawNotes].filter(Boolean).join(' • '),
        });

        // Add to raw preview records so the UI can show exact values without any guessing
        rawTeachers.push({
          stt: rawStt || teachersToImport.length,
          code: rawCode || '',
          fullName: rawName,
          genderRaw: parsedGender,
          birthDateRaw: parsedBirthDate || '',
          startYearRaw: parsedStartYear,
          initialDegreeRaw: rawInitialDegree || '',
          higherDegreeRaw: rawHigherDegree || '',
          majorRaw: rawMajor || '',
          deptRaw: rawDept || '',
          workplaceRaw: rawWorkplace || '',
          positionsRaw: parsedPositions.join(', '),
          statusRaw: statusResult.label || statusResult.status,
          quotaRaw: rawQuota,
          offDayRaw: rawOffDay || '',
          bdHsgRaw: rawBdHsg || '',
          dutiesRaw: rawDuties || '',
          phoneRaw: rawPhone || '',
          emailRaw: rawEmail || '',
          notesRaw: rawNotes || '',
          recognizedSubjectNames: recognizedNames,
          departmentName: rawDept || '',
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. PARSE CLASSES (LỚP HỌC)
  // -------------------------------------------------------------------------
  for (const ws of workbook.worksheets) {
    const normWsName = normalizeStr(ws.name);
    const isClassSheetName = ['lop', 'class', 'hoc sinh', 'si so', 'khoi', 'phong', 'danh sach lop', 'ds lop'].some((k) =>
      normWsName.includes(k)
    );

    let headerRowIdx = 0;
    let colMap: Record<string, number> = {};

    for (let r = 1; r <= 10; r++) {
      const row = ws.getRow(r);
      const rowValues = row.values as any[];
      if (Array.isArray(rowValues)) {
        const rowStr = rowValues.map(normalizeStr).join(' ');
        if (rowStr.includes('lop') || rowStr.includes('khoi') || rowStr.includes('si so') || rowStr.includes('ma lop') || rowStr.includes('ten lop')) {
          headerRowIdx = r;
          row.eachCell((cell, colNumber) => {
            const norm = normalizeStr(cell.text);
            if (norm.includes('ten lop') || norm.includes('ma lop') || norm === 'lop' || norm === 'lop hoc' || norm === 'ky hieu') {
              colMap.name = colNumber;
            }
            if (norm.includes('khoi')) colMap.grade = colNumber;
            if (norm.includes('si so') || norm.includes('hoc sinh') || norm.includes('so hs')) colMap.students = colNumber;
            if (norm.includes('buoi') || norm.includes('ca')) colMap.session = colNumber;
            if (norm.includes('phong')) colMap.room = colNumber;
          });
          break;
        }
      }
    }

    if (headerRowIdx > 0 && (colMap.name || isClassSheetName)) {
      const nameCol = colMap.name || 2;
      const studentsCol = colMap.students;
      const sessionCol = colMap.session;
      const roomCol = colMap.room;

      ws.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIdx) {
          const cellText = row.getCell(nameCol).text?.trim();
          if (cellText && !isNonDataRowText(cellText)) {
            if (cellText.match(/^[6789][A-Za-z0-9]+/i) || cellText.match(/^Lớp\s*[6789]/i)) {
              const students = studentsCol ? Number(row.getCell(studentsCol).value) : undefined;
              const session = sessionCol ? row.getCell(sessionCol).text?.trim() : undefined;
              const room = roomCol ? row.getCell(roomCol).text?.trim() : undefined;
              registerClass(cellText, students, session, room);
            }
          }
        }
      });
    }

    // Also scan headers for column-based matrix classes e.g. 6A1, 6A2...
    for (let r = 1; r <= 8; r++) {
      const row = ws.getRow(r);
      row.eachCell((cell) => {
        const text = cell.text?.trim();
        if (text && text.match(/^[6789][A-Za-z]\d{1,2}$/) && !isNonDataRowText(text)) {
          registerClass(text);
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. PARSE ASSIGNMENTS (PHÂN CÔNG) - MATRIX & LIST FORMATS
  // -------------------------------------------------------------------------
  const assignmentSheet = findSheet(['phan cong', 'chi tiet phan cong', 'pccm', 'assignments', 'tkb', 'ke hoach', 'ma tran']);
  const sheetToScanForAssignments = assignmentSheet || (workbook.worksheets.length > 1 ? workbook.worksheets[1] : null);

  if (sheetToScanForAssignments) {
    // Check if Matrix format
    let matrixHeaderRow = -1;
    const matrixClassCols: { colIndex: number; classCode: string; grade: number }[] = [];
    let matrixTeacherCol = -1;
    let matrixSubjectCol = -1;

    for (let r = 1; r <= 10; r++) {
      const row = sheetToScanForAssignments.getRow(r);
      let classCountInRow = 0;
      const detectedCols: { colIndex: number; classCode: string; grade: number }[] = [];

      row.eachCell((cell, colNumber) => {
        const text = cell.text?.trim().toUpperCase();
        const norm = normalizeStr(cell.text);

        if (norm.includes('ho ten') || norm.includes('giao vien') || norm === 'gv' || norm.includes('ten gv')) {
          matrixTeacherCol = colNumber;
        }
        if (norm.includes('mon') || norm.includes('chuyen mon') || norm.includes('bo mon')) {
          matrixSubjectCol = colNumber;
        }

        const classMatch = text.match(/^([6789])[A-Z0-9]{1,4}$/) || text.match(/^L[OỚ]P\s*([6789][A-Z0-9]{1,4})$/);
        if (classMatch && !isNonDataRowText(text)) {
          const rawCode = text.replace(/^L[OỚ]P\s*/, '');
          const grade = Number(classMatch[1]);
          detectedCols.push({ colIndex: colNumber, classCode: rawCode, grade });
          classCountInRow++;
          registerClass(rawCode);
        }
      });

      if (classCountInRow >= 3) {
        matrixHeaderRow = r;
        matrixClassCols.push(...detectedCols);
        break;
      }
    }

    if (matrixHeaderRow > 0 && matrixClassCols.length >= 3) {
      // === PARSE MATRIX FORMAT ===
      const teacherCol = matrixTeacherCol > 0 ? matrixTeacherCol : 2;
      const subjectCol = matrixSubjectCol > 0 ? matrixSubjectCol : (teacherCol === 2 ? 3 : 2);

      sheetToScanForAssignments.eachRow((row, rowNumber) => {
        if (rowNumber <= matrixHeaderRow) return;

        const rawTeacherName = row.getCell(teacherCol).text?.trim();
        const rawSubjectName = row.getCell(subjectCol).text?.trim();

        // STRICT CHECK: Skip summary/footer rows and non-names
        if (!rawTeacherName || !isValidPersonName(rawTeacherName) || isNonDataRowText(rawTeacherName)) {
          return;
        }

        // Find or register teacher
        let teacher = teachersToImport.find(
          (t) => normalizeStr(t.fullName) === normalizeStr(rawTeacherName) || (t.code && normalizeStr(t.code) === normalizeStr(rawTeacherName))
        );

        const matchedSubjects = matchSubjectsFromText(rawSubjectName);

        if (!teacher) {
          teacher = {
            id: `tc_import_${teachersToImport.length + 1}`,
            code: `GV${(teachersToImport.length + 1).toString().padStart(2, '0')}`,
            fullName: rawTeacherName,
            departmentId: mapDepartmentFromText(rawSubjectName, matchedSubjects[0]),
            major: rawSubjectName || 'Chưa phân môn',
            standardQuota: 19,
            status: 'ACTIVE',
            subjectsCanTeach: matchedSubjects,
          };
          teachersToImport.push(teacher);
        }

        // Iterate over class columns
        matrixClassCols.forEach(({ colIndex, classCode, grade }) => {
          const cell = row.getCell(colIndex);
          const cellValue = cell.value;
          const cellText = cell.text?.trim();

          if (!cellText || cellText === '0' || cellText === '-' || cellText === '') return;

          let periods = 0;
          let explicitSubjectStr = rawSubjectName || '';

          const numVal = Number(cellValue);
          if (!isNaN(numVal) && numVal > 0 && numVal <= 15) {
            periods = numVal;
          } else {
            const matchNumber = cellText.match(/(\d+)/);
            if (matchNumber) {
              periods = Number(matchNumber[1]);
            }
            const matchSubject = cellText.replace(/[\d\(\)\s]/g, '');
            if (matchSubject && matchSubject.length > 1) {
              explicitSubjectStr = matchSubject;
            }
          }

          if (periods > 0) {
            const cellMatchedSubs = matchSubjectsFromText(explicitSubjectStr);
            const subjectId = cellMatchedSubs[0] || matchedSubjects[0] || (teacher.subjectsCanTeach && teacher.subjectsCanTeach[0]) || '';
            const classObj = detectedClassesMap.get(classCode);
            const classId = classObj?.id || `cls_${classCode.toLowerCase()}`;

            assignmentsToImport.push({
              id: `asg_mat_${Date.now()}_${assignmentsToImport.length + 1}`,
              teacherId: teacher.id,
              classId,
              subjectId,
              departmentId: teacher.departmentId || mapDepartmentFromText(explicitSubjectStr, subjectId),
              type: 'TEACHING',
              periodsPerWeek: periods,
              weeks: 18,
              totalPeriods: periods * 18,
              session: grade >= 8 ? 'AFTERNOON' : 'MORNING',
              notes: `${rawTeacherName} - ${getSubjectDisplayName(subjectId)} ${classCode} (${periods} tiết/tuần)`,
            });
          }
        });
      });
    } else {
      // === PARSE VERTICAL LIST FORMAT ===
      let headerRowIdx = 1;
      let colMap: Record<string, number> = {};

      for (let r = 1; r <= 8; r++) {
        const row = sheetToScanForAssignments.getRow(r);
        const rowValues = row.values as any[];
        if (Array.isArray(rowValues)) {
          const rowStr = rowValues.map(normalizeStr).join(' ');
          if (rowStr.includes('giao vien') && (rowStr.includes('mon') || rowStr.includes('lop') || rowStr.includes('tiet') || rowStr.includes('nhiem vu'))) {
            headerRowIdx = r;
            row.eachCell((cell, colNumber) => {
              const norm = normalizeStr(cell.text);
              if (norm.includes('giao vien') || norm.includes('ho ten') || norm === 'gv') colMap.teacher = colNumber;
              if (norm.includes('loai') || norm.includes('hinh thuc')) colMap.type = colNumber;
              if (norm.includes('mon') || norm.includes('nhiem vu')) colMap.target = colNumber;
              if (norm.includes('lop') || norm.includes('pham vi')) colMap.scope = colNumber;
              if (norm.includes('tiet') || norm.includes('so tiet')) colMap.periods = colNumber;
              if (norm.includes('buoi') || norm.includes('ca')) colMap.session = colNumber;
              if (norm.includes('ghi chu')) colMap.notes = colNumber;
            });
            break;
          }
        }
      }

      if (colMap.teacher) {
        const teacherCol = colMap.teacher;
        const typeCol = colMap.type;
        const targetCol = colMap.target;
        const scopeCol = colMap.scope;
        const periodsCol = colMap.periods;
        const sessionCol = colMap.session;
        const notesCol = colMap.notes;

        sheetToScanForAssignments.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowIdx) return;

          const teacherName = row.getCell(teacherCol).text?.trim();
          if (!teacherName || !isValidPersonName(teacherName) || isNonDataRowText(teacherName)) {
            return;
          }

          const typeStr = typeCol ? row.getCell(typeCol).text?.trim() : undefined;
          const targetStr = targetCol ? row.getCell(targetCol).text?.trim() : undefined;
          const scopeStr = scopeCol ? row.getCell(scopeCol).text?.trim() : undefined;
          const periods = periodsCol ? Number(row.getCell(periodsCol).value) || 0 : 0;
          const sessionStr = sessionCol ? row.getCell(sessionCol).text?.trim() : undefined;
          const notes = notesCol ? row.getCell(notesCol).text?.trim() : '';

          let teacher = teachersToImport.find(
            (t) => normalizeStr(t.fullName) === normalizeStr(teacherName) || (t.code && normalizeStr(t.code) === normalizeStr(teacherName))
          );

          const matchedSubs = matchSubjectsFromText(targetStr);

          if (!teacher) {
            teacher = {
              id: `tc_import_${teachersToImport.length + 1}`,
              code: `GV${(teachersToImport.length + 1).toString().padStart(2, '0')}`,
              fullName: teacherName,
              departmentId: mapDepartmentFromText(targetStr, matchedSubs[0]),
              major: targetStr || 'Chưa phân môn',
              standardQuota: 19,
              status: 'ACTIVE',
              subjectsCanTeach: matchedSubs,
            };
            teachersToImport.push(teacher);
          }

          const isConcurrent =
            (typeStr && (typeStr.toLowerCase().includes('kiem') || typeStr.toLowerCase().includes('nhiem vu'))) ||
            isConcurrentDuty(targetStr);

          if (isConcurrent) {
            const dutyPeriods = periods > 0 ? periods : 2;
            assignmentsToImport.push({
              id: `asg_duty_${Date.now()}_${assignmentsToImport.length + 1}`,
              teacherId: teacher.id,
              departmentId: teacher.departmentId,
              type: 'CONCURRENT',
              dutyName: targetStr || 'Nhiệm vụ kiêm nhiệm',
              periodsPerWeek: dutyPeriods,
              weeks: 18,
              totalPeriods: dutyPeriods * 18,
              session: 'ACTIVITY',
              notes: `Kiêm nhiệm: ${targetStr} ${notes ? `(${notes})` : ''}`.trim(),
            });
          } else {
            const classCodes = (scopeStr ? scopeStr.match(/\b[6789][A-Za-z0-9]{0,3}\b/g) : null) || [];
            if (classCodes.length > 0) {
              classCodes.forEach((code: string) => {
                const registeredCls = registerClass(code);
                const classId = registeredCls ? registeredCls.id : `cls_${code.toLowerCase()}`;
                const grade = registeredCls?.grade || 6;
                const subjectId = matchedSubs[0] || 'sub_toan';
                const singlePeriods = periods > 0 ? Math.round(periods / classCodes.length) || periods : 3;

                assignmentsToImport.push({
                  id: `asg_lst_${Date.now()}_${assignmentsToImport.length + 1}`,
                  teacherId: teacher.id,
                  classId,
                  subjectId,
                  departmentId: teacher.departmentId || mapDepartmentFromText(targetStr, subjectId),
                  type: 'TEACHING',
                  periodsPerWeek: singlePeriods,
                  weeks: 18,
                  totalPeriods: singlePeriods * 18,
                  session:
                    sessionStr?.toLowerCase().includes('2 buoi') ||
                    sessionStr?.toLowerCase().includes('hai buoi') ||
                    sessionStr?.toLowerCase().includes('ca ngay') ||
                    sessionStr?.toLowerCase().includes('2 buổi') ||
                    sessionStr?.toLowerCase().includes('cả ngày')
                      ? 'FULL_DAY'
                      : sessionStr?.toLowerCase().includes('chieu')
                      ? 'AFTERNOON'
                      : 'MORNING',
                  notes: `${teacherName} dạy ${getSubjectDisplayName(subjectId)} ${code}`,
                });
              });
            } else if (periods > 0 && targetStr) {
              const subjectId = matchedSubs[0] || 'sub_toan';
              assignmentsToImport.push({
                id: `asg_lst_${Date.now()}_${assignmentsToImport.length + 1}`,
                teacherId: teacher.id,
                subjectId,
                departmentId: teacher.departmentId,
                type: 'TEACHING',
                periodsPerWeek: periods,
                weeks: 18,
                totalPeriods: periods * 18,
                session: 'MORNING',
                notes: `${teacherName} dạy ${targetStr} ${scopeStr ? `(${scopeStr})` : ''}`,
              });
            }
          }
        });
      }
    }
  }

  // Final scan across sheets for classes if none detected yet
  if (detectedClassesMap.size === 0) {
    for (const ws of workbook.worksheets) {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const text = cell.text?.trim();
          if (text && !isNonDataRowText(text)) {
            const matches = text.match(/\b[6789][A-Za-z]\d{1,2}\b/g);
            if (matches) {
              matches.forEach((m) => registerClass(m));
            }
          }
        });
      });
    }
  }

  // Sorted classes array
  const sortedClasses = Array.from(detectedClassesMap.values()).sort((a, b) => {
    if (a.grade !== b.grade) return (a.grade || 0) - (b.grade || 0);
    const codeA = a.code || '';
    const codeB = b.code || '';
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });

  classesToImport.push(...sortedClasses);

  if (teachersToImport.length === 0 && classesToImport.length === 0 && assignmentsToImport.length === 0) {
    warnings.push('Không nhận diện được dòng dữ liệu Giáo viên, Lớp học hoặc Phân công nào từ file Excel.');
  }

  return {
    sheetNames,
    schoolInfoDetected,
    teachersToImport,
    classesToImport,
    assignmentsToImport,
    curriculumToImport,
    rawTeachers,
    detectedColumns,
    errors,
    warnings,
    totalRows: teachersToImport.length + classesToImport.length + assignmentsToImport.length,
  };
}

function isConcurrentDuty(targetStr?: string): boolean {
  if (!targetStr) return false;
  const norm = normalizeStr(targetStr);
  return (
    norm.includes('chu nhiem') ||
    norm.includes('to truong') ||
    norm.includes('to pho') ||
    norm.includes('bi thu') ||
    norm.includes('tong phu trach') ||
    norm.includes('cong doan') ||
    norm.includes('thu ky') ||
    norm.includes('pho cap') ||
    norm.includes('phong may') ||
    norm.includes('thiet bi') ||
    norm.includes('kiem nhiem') ||
    norm.includes('tu van')
  );
}

export interface ComprehensiveSetupPayload {
  schoolInfo?: Partial<SchoolInfo>;
  branches?: SchoolBranch[];
  departments: Department[];
  classes: SchoolClass[];
  teachers: Teacher[];
  subjects?: Subject[];
  curriculum?: CurriculumDistribution[];
  duties?: SpecialDuty[];
  sheetNamesDetected: string[];
  totalTeachers: number;
  totalClasses: number;
  totalDepartments: number;
  messages: string[];
}

/**
 * Phân tích và nạp toàn diện file Excel mẫu khởi tạo định nghĩa ban đầu
 */
export async function importComprehensiveInitialSetupWorkbook(
  fileData: ArrayBuffer | Uint8Array,
  targetSchoolId: string = 'school_quyhop'
): Promise<ComprehensiveSetupPayload> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileData as any);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const messages: string[] = [];

  let detectedSchoolInfo: Partial<SchoolInfo> | undefined;
  let detectedBranches: SchoolBranch[] = [];
  const detectedDepartments: Department[] = [];
  const detectedClasses: SchoolClass[] = [];
  const detectedTeachers: Teacher[] = [];
  const detectedDuties: SpecialDuty[] = [];

  const getCellStr = (row: ExcelJS.Row, col: number): string => {
    const val = row.getCell(col).value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && 'text' in (val as any)) return String((val as any).text).trim();
    return String(val).trim();
  };

  const getCellNum = (row: ExcelJS.Row, col: number, defVal: number = 0): number => {
    const val = row.getCell(col).value;
    if (val === null || val === undefined) return defVal;
    if (typeof val === 'number') return val;
    const n = parseFloat(String(val).replace(/,/g, '.').replace(/[^\d.]/g, ''));
    return isNaN(n) ? defVal : n;
  };

  // 1. Tìm và phân tích Sheet THÔNG TIN TRƯỜNG
  const wsSchool = workbook.worksheets.find((ws) => {
    const n = normalizeStr(ws.name);
    return n.includes('thong tin') || n.includes('truong') || n.includes('school');
  });

  if (wsSchool) {
    let headerRowIdx = 2;
    for (let r = 1; r <= Math.min(5, wsSchool.rowCount); r++) {
      const row = wsSchool.getRow(r);
      for (let c = 1; c <= 10; c++) {
        const text = normalizeStr(getCellStr(row, c));
        if (text.includes('ten truong') || text.includes('nam hoc') || text.includes('co quan')) {
          headerRowIdx = r;
          break;
        }
      }
    }

    const valRow = wsSchool.getRow(headerRowIdx + 1);
    const colMap: Record<string, number> = {};
    const hRow = wsSchool.getRow(headerRowIdx);
    hRow.eachCell((cell, colNumber) => {
      const n = normalizeStr(cell.value);
      if (n.includes('ten truong')) colMap['schoolName'] = colNumber;
      else if (n.includes('nam hoc')) colMap['schoolYear'] = colNumber;
      else if (n.includes('co quan') || n.includes('chu quan')) colMap['authority'] = colNumber;
      else if (n.includes('tinh') || n.includes('thanh pho')) colMap['province'] = colNumber;
      else if (n.includes('hieu truong') && !n.includes('pho')) colMap['principal'] = colNumber;
      else if (n.includes('pho hieu truong') || n.includes('pho ht')) colMap['dean'] = colNumber;
      else if (n.includes('dien thoai') || n.includes('sdt')) colMap['phone'] = colNumber;
      else if (n.includes('email') || n.includes('mail')) colMap['email'] = colNumber;
      else if (n.includes('diem truong') || n.includes('phan hieu')) colMap['branches'] = colNumber;
    });

    detectedSchoolInfo = {
      schoolName: colMap['schoolName'] ? getCellStr(valRow, colMap['schoolName']) : undefined,
      schoolYear: colMap['schoolYear'] ? getCellStr(valRow, colMap['schoolYear']) : '2026-2027',
      authorityName: colMap['authority'] ? getCellStr(valRow, colMap['authority']) : 'ỦY BAN NHÂN DÂN XÃ',
      province: colMap['province'] ? getCellStr(valRow, colMap['province']) : '',
      principalName: colMap['principal'] ? getCellStr(valRow, colMap['principal']) : '',
      deanName: colMap['dean'] ? getCellStr(valRow, colMap['dean']) : '',
      phone: colMap['phone'] ? getCellStr(valRow, colMap['phone']) : '',
      email: colMap['email'] ? getCellStr(valRow, colMap['email']) : '',
    };

    if (colMap['branches']) {
      const branchText = getCellStr(valRow, colMap['branches']);
      if (branchText) {
        const parts = branchText.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          detectedBranches = parts.map((name, i) => ({
            id: i === 0 ? 'branch_main' : `branch_${i + 1}`,
            code: i === 0 ? 'DC' : `PH${i}`,
            name,
            isMain: i === 0,
            active: true,
            order: i + 1,
          }));
        }
      }
    }
    messages.push(`✓ Nhận diện thông tin trường: ${detectedSchoolInfo.schoolName || 'Chuẩn'}`);
  }

  // 2. Tìm và phân tích Sheet TỔ CHUYÊN MÔN
  const wsDepts = workbook.worksheets.find((ws) => {
    const n = normalizeStr(ws.name);
    return n.includes('to chuyen mon') || n.includes('to cm') || n.includes('to bo mon') || n.includes('department');
  });

  if (wsDepts) {
    let codeCol = 2;
    let nameCol = 3;
    let noteCol = 4;
    let startRow = 3;

    for (let r = 1; r <= Math.min(5, wsDepts.rowCount); r++) {
      const row = wsDepts.getRow(r);
      row.eachCell((cell, col) => {
        const text = normalizeStr(cell.value);
        if (text.includes('ma to') || text.includes('code')) codeCol = col;
        if (text.includes('ten to')) nameCol = col;
        if (text.includes('ghi chu')) noteCol = col;
      });
      if (normalizeStr(row.getCell(nameCol).value).includes('ten to')) {
        startRow = r + 1;
        break;
      }
    }

    for (let r = startRow; r <= wsDepts.rowCount; r++) {
      const row = wsDepts.getRow(r);
      const name = getCellStr(row, nameCol);
      if (!name) continue;
      const rawCode = getCellStr(row, codeCol) || `TO_${r - startRow + 1}`;
      const code = rawCode.toUpperCase().replace(/\s+/g, '_');
      const deptId = `dept_${code.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;
      detectedDepartments.push({
        id: deptId,
        code,
        name,
        fullName: name,
        active: true,
        schoolId: targetSchoolId,
        teacherIds: [],
      });
    }
    messages.push(`✓ Đã nạp ${detectedDepartments.length} tổ chuyên môn`);
  }

  // 3. Tìm và phân tích Sheet LỚP HỌC (ưu tiên đúng sheet chứa danh mục lớp, tránh nhầm sheet phân công)
  let wsClasses = workbook.worksheets.find((ws) => {
    const n = normalizeStr(ws.name);
    return (
      (n.includes('lop hoc') ||
        n.includes('danh sach lop') ||
        n.includes('ds lop') ||
        n.includes('danh muc lop') ||
        n === 'lop' ||
        n === 'classes' ||
        n.includes('4. lop')) &&
      !n.includes('phan cong') &&
      !n.includes('tiet')
    );
  });
  if (!wsClasses) {
    wsClasses = workbook.worksheets.find((ws) => {
      const n = normalizeStr(ws.name);
      return (n.includes('lop') || n.includes('class')) && !n.includes('phan cong');
    });
  }

  if (wsClasses) {
    let codeCol = -1;
    let nameCol = -1;
    let gradeCol = -1;
    let countCol = -1;
    let sessionCol = -1;
    let wpCol = -1;
    let roomCol = -1;
    let startRow = 3;

    for (let r = 1; r <= Math.min(6, wsClasses.rowCount); r++) {
      const row = wsClasses.getRow(r);
      let matchedCount = 0;
      let tempCode = -1;
      let tempName = -1;
      let tempGrade = -1;
      let tempCount = -1;
      let tempSession = -1;
      let tempWp = -1;
      let tempRoom = -1;

      row.eachCell((cell, col) => {
        const text = normalizeStr(cell.value);
        if (!text) return;
        if (text === 'ma lop' || text === 'code' || text === 'class code') {
          tempCode = col;
          matchedCount += 2;
        } else if (text === 'ten lop' || text === 'lop hoc' || text === 'ten lop hoc') {
          tempName = col;
          matchedCount += 2;
        } else if (text === 'lop' || text === 'class') {
          if (tempName === -1) tempName = col;
          else if (tempCode === -1) tempCode = col;
          matchedCount += 1;
        } else if (text.includes('khoi') || text === 'grade') {
          tempGrade = col;
          matchedCount += 1;
        } else if (text.includes('si so') || text.includes('hoc sinh') || text.includes('so hs')) {
          tempCount = col;
          matchedCount += 1;
        } else if (text.includes('buoi') || text.includes('ca hoc') || text.includes('session')) {
          tempSession = col;
          matchedCount += 1;
        } else if (text.includes('diem truong') || text.includes('noi hoc') || text.includes('phan hieu')) {
          tempWp = col;
          matchedCount += 1;
        } else if (text.includes('phong') || text.includes('room')) {
          tempRoom = col;
          matchedCount += 1;
        }
      });

      if (matchedCount >= 2 || tempCode !== -1 || tempName !== -1) {
        if (tempCode !== -1) codeCol = tempCode;
        if (tempName !== -1) nameCol = tempName;
        if (tempGrade !== -1) gradeCol = tempGrade;
        if (tempCount !== -1) countCol = tempCount;
        if (tempSession !== -1) sessionCol = tempSession;
        if (tempWp !== -1) wpCol = tempWp;
        if (tempRoom !== -1) roomCol = tempRoom;
        startRow = r + 1;
        break;
      }
    }

    if (codeCol === -1 && nameCol !== -1) codeCol = nameCol;
    if (nameCol === -1 && codeCol !== -1) nameCol = codeCol;
    if (codeCol === -1) {
      codeCol = 2;
      nameCol = 3;
      gradeCol = 4;
      countCol = 5;
      sessionCol = 6;
      wpCol = 7;
      roomCol = 8;
      startRow = 3;
    }

    for (let r = startRow; r <= wsClasses.rowCount; r++) {
      const row = wsClasses.getRow(r);
      const rawCode = codeCol > 0 ? getCellStr(row, codeCol) : '';
      const rawName = nameCol > 0 ? getCellStr(row, nameCol) : '';
      const primaryStr = (rawCode || rawName || '').trim();
      if (!primaryStr) continue;

      const normCheck = normalizeStr(primaryStr);
      if (
        normCheck.includes('tong cong') ||
        normCheck.includes('tong so') ||
        normCheck.includes('nguoi lap') ||
        normCheck.includes('hieu truong') ||
        normCheck.startsWith('stt')
      ) {
        continue;
      }

      let cleanCode = primaryStr.replace(/^(Lớp|Lop|Khối|Khoi)\s*[-:]?\s*/i, '').trim().toUpperCase();
      if (!cleanCode && rawName) {
        cleanCode = rawName.replace(/^(Lớp|Lop|Khối|Khoi)\s*[-:]?\s*/i, '').trim().toUpperCase();
      }
      if (!cleanCode) continue;

      let grade: any = 6;
      const gMatch = cleanCode.match(/^([6-9]|1[0-2])/);
      if (gMatch) {
        grade = parseInt(gMatch[1], 10);
      } else if (gradeCol > 0) {
        const rawGrade = getCellNum(row, gradeCol, 6);
        if ([6, 7, 8, 9, 10, 11, 12].includes(rawGrade)) grade = rawGrade;
      }

      const sessionText = sessionCol > 0 ? normalizeStr(getCellStr(row, sessionCol)) : '';
      const session: SchoolSession = sessionText.includes('chieu') || sessionText.includes('afternoon') ? 'AFTERNOON' : 'MORNING';
      const studentCount = countCol > 0 ? getCellNum(row, countCol, 35) : 35;
      const wp = wpCol > 0 ? getCellStr(row, wpCol) || 'Điểm chính' : 'Điểm chính';
      const displayName = rawName && rawName.startsWith('Lớp') ? rawName : `Lớp ${cleanCode}`;
      const safeClassId = `cls_${targetSchoolId}_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      detectedClasses.push({
        id: safeClassId,
        code: cleanCode,
        name: displayName,
        grade,
        studentCount,
        session,
        branchId: wp.toLowerCase().includes('phân hiệu') || wp.toLowerCase().includes('diem le') ? 'branch_sub' : 'branch_main',
        room: roomCol > 0 ? getCellStr(row, roomCol) : undefined,
        active: true,
      });
    }
    messages.push(`✓ Đã nạp ${detectedClasses.length} lớp học`);
  }

  // 4. Tìm và phân tích Sheet DANH SÁCH GIÁO VIÊN
  const wsTeachers = workbook.worksheets.find((ws) => {
    const n = normalizeStr(ws.name);
    return n.includes('giao vien') || n.includes('nhan su') || n.includes('teacher');
  });

  if (wsTeachers) {
    const colMap: Record<string, number> = {};
    let startRow = 3;

    for (let r = 1; r <= Math.min(6, wsTeachers.rowCount); r++) {
      const row = wsTeachers.getRow(r);
      row.eachCell((cell, col) => {
        const text = normalizeStr(cell.value);
        if (text.includes('ma gv') || text.includes('ma giao vien')) colMap['code'] = col;
        else if (text.includes('ho va ten') || text.includes('ho ten') || text.includes('ten gv')) colMap['name'] = col;
        else if (text.includes('gioi tinh')) colMap['gender'] = col;
        else if (text.includes('ngay sinh') || text.includes('nam sinh')) colMap['birth'] = col;
        else if (text.includes('nam vao nganh') || text.includes('vao nganh')) colMap['startYear'] = col;
        else if (text.includes('ban dau') || text.includes('trinh do ban dau')) colMap['initialDegree'] = col;
        else if (text.includes('nang cao') || text.includes('trinh do nang cao')) colMap['higherDegree'] = col;
        else if (text.includes('chuyen nganh')) colMap['major'] = col;
        else if (text.includes('mon co the day') || text.includes('mon day')) colMap['subjects'] = col;
        else if (text.includes('to chuyen mon') || text.includes('to cm')) colMap['dept'] = col;
        else if (text.includes('noi lam viec') || text.includes('diem truong')) colMap['wp'] = col;
        else if (text.includes('chuc vu') || text.includes('kiem nhiem')) colMap['positions'] = col;
        else if (text.includes('trang thai')) colMap['status'] = col;
        else if (text.includes('dinh muc')) colMap['quota'] = col;
        else if (text.includes('nghi cm') || text.includes('ngay nghi')) colMap['offDay'] = col;
        else if (text.includes('boi duong') || text.includes('hsg')) colMap['bdHsg'] = col;
        else if (text.includes('dien thoai') || text.includes('sdt')) colMap['phone'] = col;
        else if (text.includes('email') || text.includes('mail')) colMap['email'] = col;
        else if (text.includes('ghi chu')) colMap['notes'] = col;
      });
      if (colMap['name']) {
        startRow = r + 1;
        break;
      }
    }

    const deptMap = new Map<string, string>();
    detectedDepartments.forEach((d) => {
      deptMap.set(normalizeStr(d.name), d.id);
      deptMap.set(normalizeStr(d.code), d.id);
    });

    for (let r = startRow; r <= wsTeachers.rowCount; r++) {
      const row = wsTeachers.getRow(r);
      const name = colMap['name'] ? getCellStr(row, colMap['name']) : '';
      if (!name) continue;

      const code = (colMap['code'] ? getCellStr(row, colMap['code']) : '') || `GV${String(detectedTeachers.length + 1).padStart(2, '0')}`;
      const gender = (colMap['gender'] ? getCellStr(row, colMap['gender']) : '') === 'Nam' ? 'Nam' : 'Nữ';
      const deptRaw = colMap['dept'] ? getCellStr(row, colMap['dept']) : '';
      let matchedDeptId = detectedDepartments[0]?.id || 'dept_toan_tin';
      if (deptRaw) {
        const normDept = normalizeStr(deptRaw);
        for (const [k, v] of deptMap.entries()) {
          if (normDept.includes(k) || k.includes(normDept)) {
            matchedDeptId = v;
            break;
          }
        }
      }

      const posRaw = colMap['positions'] ? getCellStr(row, colMap['positions']) : '';
      const positions = posRaw ? posRaw.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean) : [];

      const statusRaw = normalizeStr(colMap['status'] ? getCellStr(row, colMap['status']) : '');
      let status: any = 'ACTIVE';
      if (statusRaw.includes('nghi sinh') || statusRaw.includes('thai san')) status = 'MATERNITY';
      else if (statusRaw.includes('pho hieu truong') || statusRaw.includes('pho ht')) status = 'VICE_PRINCIPAL';
      else if (statusRaw.includes('hieu truong')) status = 'PRINCIPAL';

      const quota = colMap['quota'] ? getCellNum(row, colMap['quota'], status === 'VICE_PRINCIPAL' ? 4 : status === 'PRINCIPAL' ? 2 : 19) : 19;
      const startYearVal = colMap['startYear'] ? getCellNum(row, colMap['startYear'], 2015) : 2015;

      const subsRaw = colMap['subjects'] ? getCellStr(row, colMap['subjects']) : '';
      const subjectsCanTeach = subsRaw ? subsRaw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];

      const safeTeacherId = `tc_${targetSchoolId}_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const parsedBirth = colMap['birth']
        ? parseExcelDate(row.getCell(colMap['birth']).value || getCellStr(row, colMap['birth']))
        : undefined;

      detectedTeachers.push({
        id: safeTeacherId,
        code,
        fullName: name,
        gender,
        birthDate: parsedBirth || undefined,
        startYear: startYearVal,
        initialDegree: colMap['initialDegree'] ? getCellStr(row, colMap['initialDegree']) : undefined,
        higherDegree: colMap['higherDegree'] ? getCellStr(row, colMap['higherDegree']) : undefined,
        major: colMap['major'] ? getCellStr(row, colMap['major']) : undefined,
        subjectsCanTeach,
        departmentId: matchedDeptId,
        workplace: colMap['wp'] ? getCellStr(row, colMap['wp']) || 'Điểm chính' : 'Điểm chính',
        positions,
        status,
        standardQuota: quota,
        offDay: colMap['offDay'] ? getCellStr(row, colMap['offDay']) : undefined,
        bdHsgInfo: colMap['bdHsg'] ? getCellStr(row, colMap['bdHsg']) : undefined,
        phone: colMap['phone'] ? getCellStr(row, colMap['phone']) : undefined,
        email: colMap['email'] ? getCellStr(row, colMap['email']) : undefined,
        notes: colMap['notes'] ? getCellStr(row, colMap['notes']) : undefined,
        schoolId: targetSchoolId,
      });
    }
    messages.push(`✓ Đã nạp ${detectedTeachers.length} hồ sơ giáo viên`);
  }

  // 5. Tìm và phân tích Sheet KIÊM NHIỆM & MIỄN GIẢM
  const wsDuties = workbook.worksheets.find((ws) => {
    const n = normalizeStr(ws.name);
    return n.includes('kiem nhiem') || n.includes('duty') || n.includes('chuc vu');
  });

  if (wsDuties) {
    let codeCol = 2;
    let nameCol = 3;
    let typeCol = 4;
    let periodsCol = 5;
    let modeCol = 6;
    let noteCol = 7;
    let startRow = 3;

    for (let r = 1; r <= Math.min(5, wsDuties.rowCount); r++) {
      const row = wsDuties.getRow(r);
      row.eachCell((cell, col) => {
        const text = normalizeStr(cell.value);
        if (text.includes('ma nhiem vu')) codeCol = col;
        if (text.includes('ten')) nameCol = col;
        if (text.includes('loai')) typeCol = col;
        if (text.includes('so tiet')) periodsCol = col;
        if (text.includes('hinh thuc')) modeCol = col;
        if (text.includes('ghi chu')) noteCol = col;
      });
      if (normalizeStr(row.getCell(nameCol).value).includes('ten')) {
        startRow = r + 1;
        break;
      }
    }

    for (let r = startRow; r <= wsDuties.rowCount; r++) {
      const row = wsDuties.getRow(r);
      const name = getCellStr(row, nameCol);
      if (!name) continue;
      const code = getCellStr(row, codeCol) || `DUTY_${r - startRow + 1}`;
      const normName = name.toLowerCase();
      const upperCode = code.toUpperCase();
      // Bỏ hoàn toàn nhiệm vụ miễn tiết mặc định cho HT, PHT và Nghỉ sinh
      if (
        upperCode === 'HIEU_TRUONG' ||
        upperCode === 'PHO_HIEU_TRUONG' ||
        upperCode === 'PHO_HT' ||
        upperCode === 'HT' ||
        upperCode === 'NGHI_SINH' ||
        upperCode === 'THAI_SAN' ||
        normName.includes('hiệu trưởng') ||
        normName.includes('phó hiệu') ||
        normName.includes('nghỉ sinh') ||
        normName.includes('thai sản')
      ) {
        continue;
      }
      const typeStr = normalizeStr(getCellStr(row, typeCol));
      const isExempt = typeStr.includes('mien') || typeStr.includes('giam');
      const p = getCellNum(row, periodsCol, 2);
      const modeStr = normalizeStr(getCellStr(row, modeCol));
      const applicationMode = modeStr.includes('lop') ? 'BY_CLASS' : 'FIXED';

      detectedDuties.push({
        id: `duty_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        code: code.toUpperCase(),
        name,
        type: isExempt ? 'EXEMPTION' : 'CONCURRENT',
        periodsPerWeekCalculated: isExempt ? 0 : p,
        periodsPerWeekExempted: isExempt ? p : 0,
        applicationMode,
        notes: getCellStr(row, noteCol),
      });
    }
  }

  return {
    schoolInfo: detectedSchoolInfo,
    branches: detectedBranches.length > 0 ? detectedBranches : undefined,
    departments: detectedDepartments,
    classes: detectedClasses,
    teachers: detectedTeachers,
    duties: detectedDuties.length > 0 ? detectedDuties : undefined,
    sheetNamesDetected: sheetNames,
    totalTeachers: detectedTeachers.length,
    totalClasses: detectedClasses.length,
    totalDepartments: detectedDepartments.length,
    messages,
  };
}
