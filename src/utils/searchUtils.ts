/**
 * Search Utilities for Vietnamese and educational queries
 * Accents-insensitive, token-based, word-boundary, and acronym matching
 */

/**
 * Normalizes Vietnamese string: removes diacritical marks, converts to lowercase, handles Đ/đ
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

/**
 * Common subject aliases and abbreviations in Vietnamese school curriculum
 */
export const SUBJECT_ALIASES: Record<string, string[]> = {
  'toan': ['toan', 'toán'],
  'ngu van': ['van', 'văn', 'ngu van', 'ngữ văn', 'nv'],
  'khoa hoc tu nhien': ['khtn', 'khoa hoc tu nhien', 'tự nhiên', 'tu nhien'],
  'lich su va dia li': ['lsdl', 'ls&dl', 'ls dl', 'lich su', 'lịch sử', 'dia li', 'địa lí', 'địa lý', 'dia ly', 'su', 'sử', 'dia', 'địa'],
  'tieng anh': ['anh', 'tieng anh', 'tiếng anh', 'ta', 'en', 'english'],
  'tin hoc': ['tin', 'tin hoc', 'tin học', 'th'],
  'giao duc the chat': ['gdtc', 'the chat', 'thể chất', 'the duc', 'thể dục', 'td'],
  'giao duc cong dan': ['gdcd', 'cong dan', 'công dân'],
  'cong nghe': ['cn', 'cong nghe', 'công nghệ'],
  'nghe thuat (am nhac)': ['am nhac', 'âm nhạc', 'nhac', 'nhạc', 'an'],
  'nghe thuat (my thuat)': ['my thuat', 'mỹ thuật', 've', 'vẽ', 'mt'],
  'hoat dong trai nghiem, huong nghiep': ['hdtn', 'hdtn,hn', 'hdtn-hn', 'trai nghiem', 'trải nghiệm', 'huong nghiep', 'hướng nghiệp'],
  'giao duc quoc phong va an ninh': ['gdqp', 'gdqp-an', 'quoc phong', 'quốc phòng'],
};

/**
 * Generates an acronym from a multi-word phrase (e.g., "Khoa học tự nhiên" -> "khtn", "Nguyễn Văn Toàn" -> "nvt")
 * Requires at least 2 words to form a meaningful acronym.
 */
export function getAcronym(str: string): string {
  if (!str) return '';
  const clean = removeVietnameseTones(str);
  const words = clean.split(/[\s,_\-–—/]+/).filter(Boolean);
  if (words.length < 2) return '';
  return words.map((w) => w[0]).join('');
}

/**
 * Checks if a query matches any of the target texts
 * High performance, accurate Vietnamese text matching with accents-insensitive and acronym support
 */
export function matchesQuery(
  query: string,
  ...targets: (string | number | undefined | null)[]
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim().toLowerCase();
  const normalizedQuery = removeVietnameseTones(query);
  if (!normalizedQuery) return true;

  const validTargets = targets.filter(
    (t): t is string | number => t !== undefined && t !== null && String(t).trim() !== ''
  );
  if (validTargets.length === 0) return false;

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  // 1. Direct match on each target
  for (const t of validTargets) {
    const rawTarget = String(t).toLowerCase();
    const normalizedTarget = removeVietnameseTones(rawTarget);

    // Exact or substring match (raw or normalized)
    if (rawTarget.includes(rawQuery) || normalizedTarget.includes(normalizedQuery)) {
      return true;
    }

    // Acronym match (e.g. user typed "khtn", target is "Khoa học tự nhiên", or user typed "nvt" for "Nguyễn Văn Toàn")
    if (normalizedQuery.length >= 2) {
      const acr = getAcronym(rawTarget);
      if (acr && (acr === normalizedQuery || acr.startsWith(normalizedQuery))) {
        return true;
      }
    }

    // Common Vietnamese educational subject aliases
    for (const [canonical, aliases] of Object.entries(SUBJECT_ALIASES)) {
      if (normalizedTarget.includes(canonical)) {
        if (aliases.includes(normalizedQuery) || aliases.some((a) => a === normalizedQuery)) {
          return true;
        }
      }
    }
  }

  // 2. Multi-token match: all tokens of the query must match within the combined targets
  if (queryTokens.length > 1) {
    const combinedRaw = validTargets.map((t) => String(t).toLowerCase()).join(' ');
    const combinedNormalized = removeVietnameseTones(combinedRaw);

    const allTokensMatch = queryTokens.every((token) => {
      if (combinedNormalized.includes(token)) return true;
      if (token.length >= 2) {
        return validTargets.some((t) => {
          const acr = getAcronym(String(t));
          return acr && (acr === token || acr.startsWith(token));
        });
      }
      return false;
    });

    if (allTokensMatch) return true;
  }

  return false;
}

/**
 * So khớp CHÍNH XÁC theo HỌ VÀ TÊN GIÁO VIÊN
 * - Khớp chính xác nội dung người dùng gõ (không mở rộng sang mã, môn học, nơi công tác...)
 * - Hỗ trợ cả tiếng Việt có dấu và không dấu
 * - Hỗ trợ gõ họ tên đầy đủ hoặc tên đệm + tên (VD: "Nguyễn Toàn" khớp "Nguyễn Văn Toàn")
 */
export function matchesTeacherFullName(query: string, fullName?: string | null): boolean {
  if (!query || !query.trim()) return true;
  if (!fullName || !fullName.trim()) return false;

  const rawQuery = query.trim().toLowerCase();
  const rawName = fullName.trim().toLowerCase();

  // 1. Khớp chuỗi trực tiếp có dấu (người dùng gõ chuẩn tiếng Việt)
  if (rawName.includes(rawQuery)) {
    return true;
  }

  // 2. Khớp chuỗi trực tiếp không dấu
  const normQuery = removeVietnameseTones(rawQuery);
  const normName = removeVietnameseTones(rawName);

  if (normName.includes(normQuery)) {
    return true;
  }

  // 3. Khớp nhiều từ: từng từ người dùng gõ đều phải xuất hiện trong họ và tên
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    return queryTokens.every((token) => normName.includes(token));
  }

  return false;
}
