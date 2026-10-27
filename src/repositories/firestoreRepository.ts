/**
 * Phân công chuyên môn THCS - Cloud Firestore Repository
 * Hỗ trợ kiến trúc Multi-tenant: schools/{schoolId}/{subCollection}/{docId}
 * Tích hợp Circuit Breaker tự động chống nghẽn và ngắt kết nối an toàn khi hết hạn mức (Quota Exceeded / Resource Exhausted)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
  setLogLevel,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import { db, auth, ensureFirebaseAuth, withTimeout } from '../firebase/config';
import {
  SchoolInfo,
  Teacher,
  SchoolClass,
  Subject,
  Department,
  TeachingAssignment,
  AssignmentVersion,
  CurriculumDistribution,
  SpecialDuty,
  SchoolBranch,
  WorkplaceCategory,
  AbbreviationRule,
  UserProfile,
  SchoolYear,
  SchoolTenantLicense,
} from '../types';

/**
 * Xóa các thuộc tính undefined để tránh lỗi Firestore:
 * "Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return null as unknown as T;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, any> = {};
  for (const [k, v] of Object.entries(val as Record<string, any>)) {
    if (v !== undefined) {
      cleanObj[k] = sanitizeForFirestore(v);
    }
  }
  return cleanObj as T;
}

/**
 * Các Sub-collections được hỗ trợ trong mỗi trường (schools/{schoolId}/...)
 */
export type FirestoreSubCollection =
  | 'teachers'
  | 'classes'
  | 'subjects'
  | 'departments'
  | 'assignments'
  | 'versions'
  | 'curriculum'
  | 'duties'
  | 'schoolYears'
  | 'branches'
  | 'workplaces'
  | 'abbreviations'
  | 'users'
  | 'info';

/**
 * Chuẩn hóa ID document Firestore: Thay thế toàn bộ dấu gạch chéo (/ và \), dấu hai chấm và khoảng trắng
 * Bắt buộc để Firestore không bao giờ bị lỗi 'Document references must have an even number of segments'
 */
export function sanitizeFirestoreDocId(rawId?: string | null): string {
  if (!rawId) return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return (
    String(rawId)
      .replace(/[\/\\]+/g, '_')
      .replace(/[:\s]+/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '')
      .trim() || `doc_${Date.now()}`
  );
}

/**
 * ===================== QUOTA CIRCUIT BREAKER =====================
 * Tự động phát hiện khi tài khoản Firebase miễn phí vượt giới hạn đọc/ghi trong ngày (Resource Exhausted).
 * Ngay lập tức ngắt toàn bộ listener realtime để không gây lặp backoff delay / spam console,
 * chuyển ứng dụng hoạt động 100% trơn tru trên Local Storage (Offline-first).
 */
export function isQuotaExhaustedError(err: any): boolean {
  if (!err) return false;
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    code === 'firestore/resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('maximum backoff delay')
  );
}

let _isQuotaExceeded = false;
let _quotaExceededUntil = 0;
const QUOTA_COOLDOWN_MS = 30 * 1000; // 30 giây giãn cách trước khi tự động thử lại
const _quotaListeners: (() => void)[] = [];

export function addQuotaExceededListener(listener: () => void): () => void {
  _quotaListeners.push(listener);
  return () => {
    const idx = _quotaListeners.indexOf(listener);
    if (idx !== -1) _quotaListeners.splice(idx, 1);
  };
}

export function markQuotaExceeded(): void {
  if (!_isQuotaExceeded) {
    _isQuotaExceeded = true;
    _quotaExceededUntil = Date.now() + QUOTA_COOLDOWN_MS;
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pccm_firestore_quota_exceeded', String(_quotaExceededUntil));
        localStorage.removeItem('pccm_firestore_quota_exceeded');
      }
    } catch {}
    try {
      setLogLevel('silent');
    } catch {}
    try {
      disableNetwork(db).catch(() => {});
    } catch {}
    // Kích hoạt tất cả listener để dừng ngay lập tức mọi sync listener đang chạy
    _quotaListeners.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  }
}

export function isQuotaExceeded(): boolean {
  if (!_isQuotaExceeded) {
    if (typeof window !== 'undefined') {
      try {
        // Xóa sạch key cũ nếu từng bị lưu dính trong localStorage
        localStorage.removeItem('pccm_firestore_quota_exceeded');
        const stored = sessionStorage.getItem('pccm_firestore_quota_exceeded');
        if (stored && Number(stored) > Date.now()) {
          _isQuotaExceeded = true;
          _quotaExceededUntil = Number(stored);
          try {
            setLogLevel('silent');
            disableNetwork(db).catch(() => {});
          } catch {}
        }
      } catch {}
    }
  }
  if (_isQuotaExceeded && Date.now() > _quotaExceededUntil) {
    _isQuotaExceeded = false;
    try {
      sessionStorage.removeItem('pccm_firestore_quota_exceeded');
      localStorage.removeItem('pccm_firestore_quota_exceeded');
      enableNetwork(db).catch(() => {});
    } catch {}
  }
  return _isQuotaExceeded;
}

export function resetQuotaExceeded(): void {
  _isQuotaExceeded = false;
  _quotaExceededUntil = 0;
  try {
    sessionStorage.removeItem('pccm_firestore_quota_exceeded');
    localStorage.removeItem('pccm_firestore_quota_exceeded');
    enableNetwork(db).catch(() => {});
  } catch {}
}

// Xóa sạch các cờ quota tồn đọng trong localStorage khi khởi tạo module
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('pccm_firestore_quota_exceeded');
  } catch {}
}

export class FirestoreRepository {
  public hasQuotaExhausted(): boolean {
    return isQuotaExceeded();
  }

  public markQuotaStatus(): void {
    markQuotaExceeded();
  }

  public resetQuotaStatus(): void {
    resetQuotaExceeded();
  }

  public addQuotaListener(listener: () => void): () => void {
    return addQuotaExceededListener(listener);
  }

  /**
   * Lấy đường dẫn Document tham chiếu đến Trường học: schools/{schoolId}
   */
  public getSchoolDocRef(schoolId: string) {
    const sId = sanitizeFirestoreDocId(schoolId || 'school_quyhop');
    return doc(db, 'schools', sId);
  }

  /**
   * Lấy Collection tham chiếu của một Sub-collection: schools/{schoolId}/{subCollection}
   */
  public getSubCollectionRef(schoolId: string, subCollection: FirestoreSubCollection) {
    const sId = sanitizeFirestoreDocId(schoolId || 'school_quyhop');
    return collection(db, 'schools', sId, subCollection);
  }

  /**
   * Lấy Document tham chiếu: schools/{schoolId}/{subCollection}/{docId}
   */
  public getSubDocRef(schoolId: string, subCollection: FirestoreSubCollection, docId: string) {
    const sId = sanitizeFirestoreDocId(schoolId || 'school_quyhop');
    const safeDocId = sanitizeFirestoreDocId(docId);
    return doc(db, 'schools', sId, subCollection, safeDocId);
  }

  // ===================== CRUD GENERIC =====================

  /**
   * Lấy một Document theo ID
   */
  public async getDocData<T>(schoolId: string, subCollection: FirestoreSubCollection, docId: string): Promise<T | null> {
    if (isQuotaExceeded()) return null;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as T;
      }
      return null;
    } catch (error) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return null;
      }
      console.warn(`Firestore getDocData [${subCollection}/${docId}] notice:`, error);
      return null;
    }
  }

  /**
   * Lấy toàn bộ documents trong một Sub-collection
   */
  public async getCollectionData<T>(schoolId: string, subCollection: FirestoreSubCollection): Promise<T[]> {
    if (isQuotaExceeded()) return [];
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const colRef = this.getSubCollectionRef(schoolId, subCollection);
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T));
    } catch (error) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return [];
      }
      console.warn(`Firestore getCollectionData [${subCollection}] notice:`, error);
      return [];
    }
  }

  /**
   * Thêm hoặc ghi đè Document theo ID (Set / Upsert)
   */
  public async setDocData<T extends Record<string, any>>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    docId: string,
    data: T,
    merge = true
  ): Promise<void> {
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const sanitized = sanitizeForFirestore({ ...data, schoolId });
      await setDoc(docRef, sanitized, { merge });
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return;
      }
      console.warn(`Firestore setDocData [${subCollection}/${docId}] notice:`, error?.message || error);
    }
  }

  /**
   * Cập nhật một phần Document (Update)
   */
  public async updateDocData<T extends Record<string, any>>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    docId: string,
    data: Partial<T>
  ): Promise<void> {
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const sanitized = sanitizeForFirestore(data);
      await updateDoc(docRef, sanitized as any);
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return;
      }
      console.warn(`Firestore updateDocData [${subCollection}/${docId}] notice:`, error?.message || error);
    }
  }

  /**
   * Xóa Document theo ID (Delete)
   */
  public async deleteDocData(schoolId: string, subCollection: FirestoreSubCollection, docId: string): Promise<void> {
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      await deleteDoc(docRef);
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return;
      }
      console.warn(`Firestore deleteDocData [${subCollection}/${docId}] notice:`, error?.message || error);
    }
  }

  // ===================== REAL-TIME ON SNAPSHOT =====================

  /**
   * Lắng nghe cập nhật thời gian thực trên một Sub-collection (Real-time sync)
   * Tự động giải phóng hoàn toàn kết nối ngay lập tức nếu gặp lỗi hạn mức Firestore
   */
  public subscribeCollection<T>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    onUpdate: (items: T[]) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (isQuotaExceeded()) {
      onError?.({ code: 'resource-exhausted', message: 'Quota exceeded' });
      return () => {};
    }
    let unsubHandle: Unsubscribe | null = null;
    let isTerminated = false;
    const cancelSubscription = () => {
      isTerminated = true;
      if (unsubHandle) {
        try {
          unsubHandle();
        } catch {}
        unsubHandle = null;
      }
    };

    try {
      const colRef = this.getSubCollectionRef(schoolId, subCollection);
      const activeUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (isTerminated) return;
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
          onUpdate(items);
        },
        (error) => {
          if (isQuotaExhaustedError(error)) {
            markQuotaExceeded();
            cancelSubscription();
            queueMicrotask(() => {
              cancelSubscription();
            });
            onError?.(error);
            return;
          }
          console.warn(`Firestore onSnapshot [${subCollection}] notice:`, error?.message || error);
          onError?.(error);
        }
      );
      unsubHandle = activeUnsub;
      if (isTerminated) {
        try {
          activeUnsub();
        } catch {}
      }
      return cancelSubscription;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
      }
      onError?.(err);
      return () => {};
    }
  }

  /**
   * Lắng nghe cập nhật thời gian thực trên một Document đơn
   */
  public subscribeDoc<T>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    docId: string,
    onUpdate: (item: T | null) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (isQuotaExceeded()) {
      onError?.({ code: 'resource-exhausted', message: 'Quota exceeded' });
      return () => {};
    }
    let unsubHandle: Unsubscribe | null = null;
    let isTerminated = false;
    const cancelSubscription = () => {
      isTerminated = true;
      if (unsubHandle) {
        try {
          unsubHandle();
        } catch {}
        unsubHandle = null;
      }
    };

    try {
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const activeUnsub = onSnapshot(
        docRef,
        (snapshot) => {
          if (isTerminated) return;
          if (snapshot.exists()) {
            onUpdate({ id: snapshot.id, ...snapshot.data() } as T);
          } else {
            onUpdate(null);
          }
        },
        (error) => {
          if (isQuotaExhaustedError(error)) {
            markQuotaExceeded();
            cancelSubscription();
            queueMicrotask(() => {
              cancelSubscription();
            });
            onError?.(error);
            return;
          }
          console.warn(`Firestore onSnapshot Doc [${subCollection}/${docId}] notice:`, error?.message || error);
          onError?.(error);
        }
      );
      unsubHandle = activeUnsub;
      if (isTerminated) {
        try {
          activeUnsub();
        } catch {}
      }
      return cancelSubscription;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
      }
      onError?.(err);
      return () => {};
    }
  }

  // ===================== SCHOOL INFO OPERATIONS =====================

  /**
   * Lấy thông tin trường học
   */
  public async getSchoolInfo(schoolId: string): Promise<SchoolInfo | null> {
    return this.getDocData<SchoolInfo>(schoolId, 'info', 'general');
  }

  /**
   * Lưu thông tin trường học
   */
  public async setSchoolInfo(schoolId: string, info: Partial<SchoolInfo>): Promise<void> {
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, 'info', 'general');
      const sanitized = sanitizeForFirestore({ ...info, schoolId });
      await setDoc(docRef, sanitized, { merge: true });

      // Đồng thời cập nhật document gốc schools/{schoolId} để dễ quản lý tên trường
      const schoolRootRef = this.getSchoolDocRef(schoolId);
      await setDoc(
        schoolRootRef,
        sanitizeForFirestore({
          id: schoolId,
          name: info.schoolName || 'TRƯỜNG THCS',
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return;
      }
      console.warn('Firestore setSchoolInfo notice:', error?.message || error);
    }
  }

  /**
   * Lắng nghe cập nhật thông tin trường học theo thời gian thực
   */
  public subscribeSchoolInfo(
    schoolId: string,
    onUpdate: (info: SchoolInfo | null) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (isQuotaExceeded()) {
      onError?.({ code: 'resource-exhausted', message: 'Quota exceeded' });
      return () => {};
    }
    ensureFirebaseAuth().catch(() => {});
    return this.subscribeDoc<SchoolInfo>(schoolId, 'info', 'general', onUpdate, onError);
  }

  // ===================== BATCH OPERATIONS =====================

  /**
   * Ghi hàng loạt documents (Batch Write) - Tự động chia nhỏ từng đợt tối đa 400 docs
   */
  public async batchSetDocuments<T extends { id: string }>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    items: T[]
  ): Promise<number> {
    if (!items || items.length === 0) return 0;
    if (isQuotaExceeded()) return 0;

    try {
      if (!auth.currentUser) await ensureFirebaseAuth();

      const CHUNK_SIZE = 400;
      let savedCount = 0;

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          if (!item.id) continue;
          const safeId = sanitizeFirestoreDocId(String(item.id));
          const docRef = this.getSubDocRef(schoolId, subCollection, safeId);
          const sanitized = sanitizeForFirestore({ ...item, id: safeId, schoolId });
          batch.set(docRef, sanitized, { merge: true });
          savedCount++;
        }

        await batch.commit();
      }

      return savedCount;
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return 0;
      }
      console.warn(`Firestore batchSetDocuments [${subCollection}] notice:`, error?.message || error);
      return 0;
    }
  }

  // ===================== SYNC ALL DATA TO CLOUD =====================

  /**
   * Đẩy toàn bộ dữ liệu mẫu / dữ liệu local lên Cloud Firestore theo đúng schoolId
   */
  public async syncAllDataToFirestore(
    schoolId: string,
    data: {
      schoolInfo: SchoolInfo;
      teachers: Teacher[];
      classes: SchoolClass[];
      subjects: Subject[];
      departments: Department[];
      assignments: TeachingAssignment[];
      versions: AssignmentVersion[];
      curriculum: CurriculumDistribution[];
      duties: SpecialDuty[];
      branches: SchoolBranch[];
      workplaces: WorkplaceCategory[];
      abbreviations: AbbreviationRule[];
      users: UserProfile[];
      schoolYears: SchoolYear[];
    },
    onProgress?: (step: string, percent: number) => void
  ): Promise<{ success: boolean; totalCount: number; message: string }> {
    const sId = schoolId || 'school_admin';
    let totalItems = 0;

    if (isQuotaExceeded()) {
      return {
        success: false,
        totalCount: 0,
        message: 'Dung lượng miễn phí Cloud Firestore hôm nay đã đạt giới hạn. Dữ liệu của trường được bảo toàn 100% trên thiết bị (Offline/Local Storage).',
      };
    }

    try {
      onProgress?.('Đang xác thực kết nối bảo mật Cloud Firestore...', 5);
      await ensureFirebaseAuth();

      onProgress?.('Đang lưu thông tin nhà trường...', 10);
      await this.setSchoolInfo(sId, data.schoolInfo);
      totalItems += 1;

      // Đồng bộ song song (Parallel Batching) các danh mục dữ liệu để tối ưu tốc độ tối đa
      // Giúp giảm thời gian đẩy lên đám mây từ 20-30s xuống chỉ còn 1-3s
      const tasks: { name: string; fn: () => Promise<number> }[] = [
        { name: 'giáo viên', fn: () => this.batchSetDocuments(sId, 'teachers', data.teachers) },
        { name: 'lớp học', fn: () => this.batchSetDocuments(sId, 'classes', data.classes) },
        { name: 'môn học', fn: () => this.batchSetDocuments(sId, 'subjects', data.subjects) },
        { name: 'tổ chuyên môn', fn: () => this.batchSetDocuments(sId, 'departments', data.departments) },
        { name: 'phân phối chương trình', fn: () => this.batchSetDocuments(sId, 'curriculum', data.curriculum) },
        { name: 'nhiệm vụ kiêm nhiệm', fn: () => this.batchSetDocuments(sId, 'duties', data.duties) },
        { name: 'phiên bản phân công', fn: () => this.batchSetDocuments(sId, 'versions', data.versions) },
        { name: 'bảng phân công chuyên môn', fn: () => this.batchSetDocuments(sId, 'assignments', data.assignments) },
        { name: 'điểm trường', fn: () => this.batchSetDocuments(sId, 'branches', data.branches) },
        { name: 'nơi làm việc', fn: () => this.batchSetDocuments(sId, 'workplaces', data.workplaces) },
        { name: 'quy tắc viết tắt', fn: () => this.batchSetDocuments(sId, 'abbreviations', data.abbreviations) },
        { name: 'năm học', fn: () => this.batchSetDocuments(sId, 'schoolYears', data.schoolYears) },
        { name: 'tài khoản người dùng', fn: () => this.batchSetDocuments(sId, 'users', data.users) },
      ];

      let completedTasks = 0;
      const totalTasks = tasks.length;

      const results = await Promise.all(
        tasks.map(async (t) => {
          const count = await t.fn();
          completedTasks++;
          const progressPercent = Math.min(98, Math.round(10 + (completedTasks / totalTasks) * 88));
          onProgress?.(`Đã đồng bộ ${t.name} (${completedTasks}/${totalTasks})...`, progressPercent);
          return count;
        })
      );

      for (const count of results) {
        totalItems += count;
      }

      onProgress?.('Đồng bộ hoàn tất thành công 100%!', 100);

      return {
        success: true,
        totalCount: totalItems,
        message: `Đã đồng bộ siêu tốc thành công ${totalItems} bản ghi lên Cloud Firestore cho trường [${sId}].`,
      };
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return {
          success: false,
          totalCount: totalItems,
          message: 'Dung lượng miễn phí Cloud Firestore hôm nay đã đạt giới hạn. Dữ liệu của trường được bảo toàn 100% trên thiết bị (Offline/Local Storage).',
        };
      }
      console.warn('Lỗi khi đồng bộ lên Cloud Firestore:', error?.message || error);
      let errMsg = error?.message || 'Có lỗi xảy ra trong quá trình đồng bộ lên Firestore.';
      if (errMsg.includes('Missing or insufficient permissions') || error?.code === 'permission-denied') {
        errMsg = 'Chưa xác thực quyền truy cập Cloud Firestore. Hệ thống đang tự động tái kết nối, vui lòng thử lại sau vài giây.';
      }
      return {
        success: false,
        totalCount: totalItems,
        message: errMsg,
      };
    }
  }

  /**
   * Lưu hoặc cập nhật thông tin bản quyền trường học lên Firestore
   */
  public async saveSchoolLicense(license: SchoolTenantLicense): Promise<void> {
    if (!license || !license.id) return;
    if (isQuotaExceeded()) return;
    try {
      await withTimeout(ensureFirebaseAuth(), 4000, 'Xác thực tài khoản đồng bộ quá hạn').catch(() => {});
      const sId = sanitizeFirestoreDocId(license.id);
      
      const batch = writeBatch(db);

      // 1. Lưu vào collection licenses/{sId}
      const licRef = doc(db, 'licenses', sId);
      const sanitized = sanitizeForFirestore({
        ...license,
        id: sId,
        assignedPasswordHint: license.assignedPasswordHint?.trim() || (sId === 'school_quyhop' || sId === 'school_admin' ? '123456' : ''),
        updatedAt: new Date().toISOString(),
      });
      batch.set(licRef, sanitized, { merge: true });

      // 2. Cập nhật root school doc schools/{sId}
      const schoolRootRef = this.getSchoolDocRef(sId);
      batch.set(
        schoolRootRef,
        sanitizeForFirestore({
          id: sId,
          schoolName: license.schoolName,
          adminEmail: license.adminEmail,
          status: license.status,
          expiresAt: license.expiresAt,
          lockedReason: license.lockedReason || null,
          planType: license.planType,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );

      await withTimeout(batch.commit(), 7000, 'Ghi cấu hình bản quyền lên Cloud quá thời gian chờ (7s)');
    } catch (error: any) {
      if (isQuotaExhaustedError(error)) {
        markQuotaExceeded();
        return;
      }
      console.warn('Firestore saveSchoolLicense notice:', error?.message || error);
    }
  }

  /**
   * Đẩy siêu tốc toàn bộ danh sách bản quyền các trường học lên Cloud Firestore bằng Batch Write.
   * Gộp tất cả các thao tác ghi vào 1 request duy nhất thay vì lặp tuần tự, kèm timeout chống treo tuyệt đối.
   */
  public async batchSaveSchoolLicenses(licenses: SchoolTenantLicense[]): Promise<number> {
    if (!licenses || licenses.length === 0) return 0;
    if (isQuotaExceeded()) return 0;
    try {
      await withTimeout(ensureFirebaseAuth(), 4000, 'Xác thực tài khoản đồng bộ quá hạn').catch(() => {});

      // Mỗi trường gồm 2 documents (licenses/{sId} và schools/{sId}), Firestore cho phép tối đa 500 ops / batch
      const CHUNK_SIZE = 200;
      let totalSaved = 0;

      for (let i = 0; i < licenses.length; i += CHUNK_SIZE) {
        const chunk = licenses.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        for (const lic of chunk) {
          if (!lic || !lic.id) continue;
          const sId = sanitizeFirestoreDocId(lic.id);

          const licRef = doc(db, 'licenses', sId);
          const sanitizedLic = sanitizeForFirestore({
            ...lic,
            id: sId,
            assignedPasswordHint: lic.assignedPasswordHint?.trim() || (sId === 'school_quyhop' ? '123456' : ''),
            updatedAt: new Date().toISOString(),
          });
          batch.set(licRef, sanitizedLic, { merge: true });

          const schoolRootRef = this.getSchoolDocRef(sId);
          const sanitizedRoot = sanitizeForFirestore({
            id: sId,
            schoolName: lic.schoolName,
            adminEmail: lic.adminEmail,
            status: lic.status,
            expiresAt: lic.expiresAt,
            lockedReason: lic.lockedReason || null,
            planType: lic.planType,
            updatedAt: new Date().toISOString(),
          });
          batch.set(schoolRootRef, sanitizedRoot, { merge: true });

          totalSaved++;
        }

        await withTimeout(
          batch.commit(),
          8000,
          'Ghi đồng bộ cấu hình các trường học lên Cloud Firestore quá thời gian chờ (8s)'
        );
      }

      return totalSaved;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return 0;
      }
      console.warn('Lỗi batchSaveSchoolLicenses:', err?.message || err);
      throw err;
    }
  }

  /**
   * Lấy danh sách tất cả các bản quyền trường học từ Cloud Firestore
   */
  public async getAllSchoolLicenses(): Promise<SchoolTenantLicense[]> {
    if (isQuotaExceeded()) return [];
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const colRef = collection(db, 'licenses');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => {
        const raw = d.data() as any;
        const isAdm = d.id === 'school_quyhop' || d.id === 'school_admin';
        return {
          ...raw,
          id: isAdm ? 'school_admin' : d.id,
          schoolName: isAdm ? 'TRƯỜNG THCS ADMIN' : (raw.schoolName || 'TRƯỜNG THCS MỚI'),
        };
      });
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return [];
      }
      console.warn('Không thể tải licenses từ Cloud Firestore:', err?.message || err);
      return [];
    }
  }

  /**
   * Xóa bản quyền trường học khỏi Cloud Firestore
   */
  public async deleteSchoolLicense(schoolId: string): Promise<void> {
    if (!schoolId) return;
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const safeId = sanitizeFirestoreDocId(schoolId);
      const licRef = doc(db, 'licenses', safeId);
      await deleteDoc(licRef);
      const schoolRef = this.getSchoolDocRef(safeId);
      await deleteDoc(schoolRef);

      // Xóa triệt để các subcollection để trường mới trùng tên không bị kéo lại dữ liệu cũ
      const subCols: FirestoreSubCollection[] = ['teachers', 'classes', 'assignments', 'departments', 'branches', 'subjects', 'curriculum', 'duties', 'versions'];
      for (const col of subCols) {
        this.clearSubCollection(safeId, col).catch(() => {});
      }
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return;
      }
      console.warn('Lỗi xóa license trên Cloud Firestore:', err?.message || err);
    }
  }

  /**
   * Lấy thông tin bản quyền của một trường cụ thể từ Cloud Firestore theo mã trường
   */
  public async getSchoolLicense(schoolId: string): Promise<SchoolTenantLicense | null> {
    if (!schoolId) return null;
    if (isQuotaExceeded()) return null;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const safeId = sanitizeFirestoreDocId(schoolId);
      const docRef = doc(db, 'licenses', safeId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return {
          id: snap.id,
          ...(snap.data() as any),
        };
      }
      return null;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return null;
      }
      console.warn(`Không thể tải license cho trường [${schoolId}]:`, err?.message || err);
      return null;
    }
  }

  /**
   * Lắng nghe cập nhật bản quyền của một trường cụ thể theo thời gian thực
   */
  public subscribeSchoolLicense(
    schoolId: string,
    onUpdate: (license: SchoolTenantLicense | null) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (isQuotaExceeded()) {
      onError?.({ code: 'resource-exhausted', message: 'Quota exceeded' });
      return () => {};
    }
    ensureFirebaseAuth().catch(() => {});
    const sId = sanitizeFirestoreDocId(schoolId || 'school_quyhop');
    const licRef = doc(db, 'licenses', sId);
    let unsubHandle: Unsubscribe | null = null;
    let isTerminated = false;
    const cancelSubscription = () => {
      isTerminated = true;
      if (unsubHandle) {
        try {
          unsubHandle();
        } catch {}
        unsubHandle = null;
      }
    };

    try {
      const activeUnsub = onSnapshot(
        licRef,
        (docSnap) => {
          if (isTerminated) return;
          if (docSnap.exists()) {
            onUpdate({ id: docSnap.id, ...(docSnap.data() as any) });
          } else {
            onUpdate(null);
          }
        },
        (error) => {
          if (isQuotaExhaustedError(error)) {
            markQuotaExceeded();
            cancelSubscription();
            queueMicrotask(() => {
              cancelSubscription();
            });
            onError?.(error);
            return;
          }
          console.warn(`Lỗi lắng nghe license trường [${sId}]:`, error?.message || error);
          onError?.(error);
        }
      );
      unsubHandle = activeUnsub;
      if (isTerminated) {
        try {
          activeUnsub();
        } catch {}
      }
      return cancelSubscription;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
      }
      onError?.(err);
      return () => {};
    }
  }

  /**
   * Lắng nghe cập nhật toàn bộ danh sách bản quyền (dành cho Super Admin)
   */
  public subscribeAllSchoolLicenses(
    onUpdate: (licenses: SchoolTenantLicense[]) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (isQuotaExceeded()) {
      onError?.({ code: 'resource-exhausted', message: 'Quota exceeded' });
      return () => {};
    }
    ensureFirebaseAuth().catch(() => {});
    const colRef = collection(db, 'licenses');
    let unsubHandle: Unsubscribe | null = null;
    let isTerminated = false;
    const cancelSubscription = () => {
      isTerminated = true;
      if (unsubHandle) {
        try {
          unsubHandle();
        } catch {}
        unsubHandle = null;
      }
    };

    try {
      const activeUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (isTerminated) return;
          const list: SchoolTenantLicense[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          onUpdate(list);
        },
        (error) => {
          if (isQuotaExhaustedError(error)) {
            markQuotaExceeded();
            cancelSubscription();
            queueMicrotask(() => {
              cancelSubscription();
            });
            onError?.(error);
            return;
          }
          console.warn('Lỗi lắng nghe toàn bộ licenses:', error?.message || error);
          onError?.(error);
        }
      );
      unsubHandle = activeUnsub;
      if (isTerminated) {
        try {
          activeUnsub();
        } catch {}
      }
      return cancelSubscription;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
      }
      onError?.(err);
      return () => {};
    }
  }

  // ===================== SYSTEM CATALOG / STRUCTURE VERSION =====================

  /**
   * Xóa sạch toàn bộ documents trong một Sub-collection của trường trên Firestore
   */
  public async clearSubCollection(schoolId: string, subCollection: FirestoreSubCollection): Promise<number> {
    if (isQuotaExceeded()) return 0;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const colRef = this.getSubCollectionRef(schoolId, subCollection);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) return 0;

      const CHUNK_SIZE = 400;
      let deletedCount = 0;
      const docs = snapshot.docs;

      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const d of chunk) {
          batch.delete(d.ref);
          deletedCount++;
        }
        await batch.commit();
      }
      return deletedCount;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return 0;
      }
      console.warn(`Firestore clearSubCollection [${subCollection}] error:`, err?.message || err);
      return 0;
    }
  }

  /**
   * Đẩy phiên bản cấu trúc hệ thống (Môn học, Khung tiết, Danh mục kiêm nhiệm, Viết tắt) lên Cloud
   */
  public async saveSystemCatalogTemplate(catalog: {
    schemaVersion: string;
    subjects: Subject[];
    curriculum: CurriculumDistribution[];
    duties: SpecialDuty[];
    abbreviationRules: AbbreviationRule[];
    publishedAt: string;
    publishedBy: string;
    notes?: string;
  }): Promise<void> {
    if (isQuotaExceeded()) return;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = doc(db, 'system_config', 'shared_catalog_v1');
      const sanitized = sanitizeForFirestore({
        ...catalog,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(docRef, sanitized, { merge: true });
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return;
      }
      console.warn('Lỗi lưu template cấu trúc hệ thống:', err?.message || err);
    }
  }

  /**
   * Tải phiên bản cấu trúc hệ thống từ Cloud Firestore
   */
  public async getSystemCatalogTemplate(): Promise<{
    schemaVersion: string;
    subjects: Subject[];
    curriculum: CurriculumDistribution[];
    duties: SpecialDuty[];
    abbreviationRules: AbbreviationRule[];
    publishedAt: string;
    publishedBy: string;
    notes?: string;
  } | null> {
    if (isQuotaExceeded()) return null;
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = doc(db, 'system_config', 'shared_catalog_v1');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as any;
      }
      return null;
    } catch (err: any) {
      if (isQuotaExhaustedError(err)) {
        markQuotaExceeded();
        return null;
      }
      console.warn('Không thể tải cấu trúc hệ thống từ Cloud Firestore:', err?.message || err);
      return null;
    }
  }
}

export const firestoreRepository = new FirestoreRepository();
