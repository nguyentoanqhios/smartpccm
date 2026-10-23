/**
 * Phân công chuyên môn THCS - Cloud Firestore Repository
 * Hỗ trợ kiến trúc Multi-tenant: schools/{schoolId}/{subCollection}/{docId}
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
} from 'firebase/firestore';
import { db, auth, ensureFirebaseAuth } from '../firebase/config';
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

export class FirestoreRepository {
  /**
   * Lấy đường dẫn Document tham chiếu đến Trường học: schools/{schoolId}
   */
  public getSchoolDocRef(schoolId: string) {
    const sId = schoolId || 'school_quyhop';
    return doc(db, 'schools', sId);
  }

  /**
   * Lấy Collection tham chiếu của một Sub-collection: schools/{schoolId}/{subCollection}
   */
  public getSubCollectionRef(schoolId: string, subCollection: FirestoreSubCollection) {
    const sId = schoolId || 'school_quyhop';
    return collection(db, 'schools', sId, subCollection);
  }

  /**
   * Lấy Document tham chiếu: schools/{schoolId}/{subCollection}/{docId}
   */
  public getSubDocRef(schoolId: string, subCollection: FirestoreSubCollection, docId: string) {
    const sId = schoolId || 'school_quyhop';
    return doc(db, 'schools', sId, subCollection, docId);
  }

  // ===================== CRUD GENERIC =====================

  /**
   * Lấy một Document theo ID
   */
  public async getDocData<T>(schoolId: string, subCollection: FirestoreSubCollection, docId: string): Promise<T | null> {
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() } as T;
      }
      return null;
    } catch (error) {
      console.warn(`Firestore getDocData [${subCollection}/${docId}] error:`, error);
      return null;
    }
  }

  /**
   * Lấy toàn bộ documents trong một Sub-collection
   */
  public async getCollectionData<T>(schoolId: string, subCollection: FirestoreSubCollection): Promise<T[]> {
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const colRef = this.getSubCollectionRef(schoolId, subCollection);
      const snapshot = await getDocs(colRef);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as T));
    } catch (error) {
      console.warn(`Firestore getCollectionData [${subCollection}] error:`, error);
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
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const sanitized = sanitizeForFirestore({ ...data, schoolId });
      await setDoc(docRef, sanitized, { merge });
    } catch (error: any) {
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
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      const sanitized = sanitizeForFirestore(data);
      await updateDoc(docRef, sanitized as any);
    } catch (error: any) {
      console.warn(`Firestore updateDocData [${subCollection}/${docId}] notice:`, error?.message || error);
    }
  }

  /**
   * Xóa Document theo ID (Delete)
   */
  public async deleteDocData(schoolId: string, subCollection: FirestoreSubCollection, docId: string): Promise<void> {
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = this.getSubDocRef(schoolId, subCollection, docId);
      await deleteDoc(docRef);
    } catch (error: any) {
      console.warn(`Firestore deleteDocData [${subCollection}/${docId}] notice:`, error?.message || error);
    }
  }

  // ===================== REAL-TIME ON SNAPSHOT =====================

  /**
   * Lắng nghe cập nhật thời gian thực trên một Sub-collection (Real-time sync)
   */
  public subscribeCollection<T>(
    schoolId: string,
    subCollection: FirestoreSubCollection,
    onUpdate: (items: T[]) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    const colRef = this.getSubCollectionRef(schoolId, subCollection);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as T));
        onUpdate(items);
      },
      (error) => {
        console.warn(`Firestore onSnapshot [${subCollection}] error:`, error);
        onError?.(error);
      }
    );
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
    const docRef = this.getSubDocRef(schoolId, subCollection, docId);
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn(`Firestore onSnapshot Doc [${subCollection}/${docId}] error:`, error);
        onError?.(error);
      }
    );
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
  }

  /**
   * Lắng nghe cập nhật thông tin trường học theo thời gian thực
   */
  public subscribeSchoolInfo(
    schoolId: string,
    onUpdate: (info: SchoolInfo | null) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
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
    if (!auth.currentUser) await ensureFirebaseAuth();

    const CHUNK_SIZE = 400;
    let savedCount = 0;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const item of chunk) {
        if (!item.id) continue;
        const docRef = this.getSubDocRef(schoolId, subCollection, String(item.id));
        const sanitized = sanitizeForFirestore({ ...item, schoolId });
        batch.set(docRef, sanitized, { merge: true });
        savedCount++;
      }

      await batch.commit();
    }

    return savedCount;
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
    const sId = schoolId || 'school_quyhop';
    let totalItems = 0;

    try {
      onProgress?.('Đang xác thực kết nối bảo mật Cloud Firestore...', 2);
      await ensureFirebaseAuth();

      onProgress?.('Đang lưu thông tin nhà trường...', 5);
      await this.setSchoolInfo(sId, data.schoolInfo);
      totalItems += 1;

      onProgress?.('Đang tải lên danh sách giáo viên...', 15);
      const teachersCount = await this.batchSetDocuments(sId, 'teachers', data.teachers);
      totalItems += teachersCount;

      onProgress?.('Đang tải lên danh mục lớp học...', 30);
      const classesCount = await this.batchSetDocuments(sId, 'classes', data.classes);
      totalItems += classesCount;

      onProgress?.('Đang tải lên danh mục môn học & tổ chuyên môn...', 45);
      const subjectsCount = await this.batchSetDocuments(sId, 'subjects', data.subjects);
      const deptsCount = await this.batchSetDocuments(sId, 'departments', data.departments);
      totalItems += subjectsCount + deptsCount;

      onProgress?.('Đang tải lên chương trình GDPT & nhiệm vụ kiêm nhiệm...', 60);
      const currCount = await this.batchSetDocuments(sId, 'curriculum', data.curriculum);
      const dutiesCount = await this.batchSetDocuments(sId, 'duties', data.duties);
      totalItems += currCount + dutiesCount;

      onProgress?.('Đang tải lên phiên bản & phân công chuyên môn...', 75);
      const versionsCount = await this.batchSetDocuments(sId, 'versions', data.versions);
      const assignCount = await this.batchSetDocuments(sId, 'assignments', data.assignments);
      totalItems += versionsCount + assignCount;

      onProgress?.('Đang tải lên điểm trường & danh mục bổ trợ...', 90);
      const branchesCount = await this.batchSetDocuments(sId, 'branches', data.branches);
      const wpCount = await this.batchSetDocuments(sId, 'workplaces', data.workplaces);
      const abbrCount = await this.batchSetDocuments(sId, 'abbreviations', data.abbreviations);
      const syCount = await this.batchSetDocuments(sId, 'schoolYears', data.schoolYears);
      const usersCount = await this.batchSetDocuments(sId, 'users', data.users);
      totalItems += branchesCount + wpCount + abbrCount + syCount + usersCount;

      onProgress?.('Đồng bộ hoàn tất thành công!', 100);

      return {
        success: true,
        totalCount: totalItems,
        message: `Đã đồng bộ thành công ${totalItems} bản ghi lên Cloud Firestore cho trường [${sId}].`,
      };
    } catch (error: any) {
      console.error('Lỗi khi đồng bộ lên Cloud Firestore:', error);
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
    if (!auth.currentUser) await ensureFirebaseAuth();
    const sId = license.id;
    // 1. Lưu vào collection licenses/{sId}
    const licRef = doc(db, 'licenses', sId);
    const sanitized = sanitizeForFirestore({
      ...license,
      assignedPasswordHint: license.assignedPasswordHint || '123456',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(licRef, sanitized, { merge: true });

    // 2. Cập nhật root school doc schools/{sId}
    const schoolRootRef = this.getSchoolDocRef(sId);
    await setDoc(
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
  }

  /**
   * Lấy danh sách tất cả các bản quyền trường học từ Cloud Firestore
   */
  public async getAllSchoolLicenses(): Promise<SchoolTenantLicense[]> {
    try {
      if (!auth.currentUser) await ensureFirebaseAuth();
      const colRef = collection(db, 'licenses');
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
    } catch (err) {
      console.warn('Không thể tải licenses từ Cloud Firestore:', err);
      return [];
    }
  }

  /**
   * Xóa bản quyền trường học khỏi Cloud Firestore
   */
  public async deleteSchoolLicense(schoolId: string): Promise<void> {
    try {
      if (!schoolId) return;
      if (!auth.currentUser) await ensureFirebaseAuth();
      const licRef = doc(db, 'licenses', schoolId);
      await deleteDoc(licRef);
      const schoolRef = this.getSchoolDocRef(schoolId);
      await deleteDoc(schoolRef);
    } catch (err) {
      console.warn('Lỗi xóa license trên Cloud Firestore:', err);
    }
  }

  /**
   * Lấy thông tin bản quyền của một trường cụ thể từ Cloud Firestore theo mã trường
   */
  public async getSchoolLicense(schoolId: string): Promise<SchoolTenantLicense | null> {
    try {
      if (!schoolId) return null;
      if (!auth.currentUser) await ensureFirebaseAuth();
      const docRef = doc(db, 'licenses', schoolId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return {
          id: snap.id,
          ...(snap.data() as any),
        };
      }
      return null;
    } catch (err) {
      console.warn(`Không thể tải license cho trường [${schoolId}]:`, err);
      return null;
    }
  }

  /**
   * Lắng nghe cập nhật bản quyền của một trường cụ thể theo thời gian thực
   */
  public subscribeSchoolLicense(
    schoolId: string,
    onUpdate: (license: SchoolTenantLicense | null) => void
  ): Unsubscribe {
    ensureFirebaseAuth().catch(() => {});
    const sId = schoolId || 'school_quyhop';
    const licRef = doc(db, 'licenses', sId);
    return onSnapshot(
      licRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate({ id: docSnap.id, ...(docSnap.data() as any) });
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.warn(`Lỗi lắng nghe license trường [${sId}]:`, error);
      }
    );
  }

  /**
   * Lắng nghe cập nhật toàn bộ danh sách bản quyền (dành cho Super Admin)
   */
  public subscribeAllSchoolLicenses(
    onUpdate: (licenses: SchoolTenantLicense[]) => void
  ): Unsubscribe {
    ensureFirebaseAuth().catch(() => {});
    const colRef = collection(db, 'licenses');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: SchoolTenantLicense[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        onUpdate(list);
      },
      (error) => {
        console.warn('Lỗi lắng nghe toàn bộ licenses:', error);
      }
    );
  }
}

export const firestoreRepository = new FirestoreRepository();
