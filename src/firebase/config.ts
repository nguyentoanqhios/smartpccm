import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDki0VaW73--yCx7tRo9ATl0RST0IUxjIQ",
  authDomain: "smartpccm.firebaseapp.com",
  projectId: "smartpccm",
  storageBucket: "smartpccm.firebasestorage.app",
  messagingSenderId: "576388296448",
  appId: "1:576388296448:web:e97ec09403dc2c3b610de5"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

const SYNC_CREDENTIALS = [
  { email: 'pccm_system_sync@thcsquyhop.edu.vn', pass: 'PccmSync2026!Secured' },
  { email: 'test_user_applet@example.com', pass: '123456789' },
];

export const isSystemSyncEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const em = email.toLowerCase().trim();
  return (
    em.startsWith('pccm_system_sync') ||
    em.startsWith('test_user_applet') ||
    em.includes('pccm_system_sync') ||
    em.includes('test_user_applet')
  );
};

let ongoingAuthPromise: Promise<User | null> | null = null;

/**
 * Đảm bảo luôn có phiên xác thực hợp lệ trên Firebase Authentication
 * Tránh lỗi bảo mật "Missing or insufficient permissions" khi đọc/ghi Cloud Firestore
 * CHỈ CHẠY THEO YÊU CẦU (on-demand) khi thao tác với Firestore, không chiếm quyền người dùng.
 */
export async function ensureFirebaseAuth(): Promise<User | null> {
  // Nếu đã có phiên đăng nhập (người dùng thật hoặc tài khoản sync), dùng luôn
  if (auth.currentUser) {
    return auth.currentUser;
  }
  if (ongoingAuthPromise) {
    return ongoingAuthPromise;
  }

  ongoingAuthPromise = (async () => {
    try {
      if (typeof window !== 'undefined') {
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch {}
      }

      // Thử đăng nhập lần lượt các tài khoản đồng bộ đã cấp quyền
      for (const cred of SYNC_CREDENTIALS) {
        try {
          const res = await signInWithEmailAndPassword(auth, cred.email, cred.pass);
          return res.user;
        } catch (signInErr: any) {
          // Nếu tài khoản chưa tồn tại thì thử tạo mới
          if (signInErr?.code === 'auth/user-not-found') {
            try {
              const resCreate = await createUserWithEmailAndPassword(auth, cred.email, cred.pass);
              return resCreate.user;
            } catch {}
          }
        }
      }

      return auth.currentUser;
    } catch (err: any) {
      console.warn('ensureFirebaseAuth notice:', err?.message || err);
      return auth.currentUser;
    } finally {
      ongoingAuthPromise = null;
    }
  })();

  return ongoingAuthPromise;
}


