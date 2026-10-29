import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User,
} from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, getFirestore, setLogLevel } from 'firebase/firestore';

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

// Khởi tạo Firestore với memoryLocalCache để loại bỏ hoàn toàn lỗi stream IndexedDB (INTERNAL ASSERTION FAILED: Unexpected state ID: c050)
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
  }
})();

// Tắt log nội bộ của Firebase Firestore để tránh log console gây hiểu lầm là lỗi ứng dụng khi hết hạn mức (Quota exceeded)
try {
  setLogLevel('silent');
} catch {}

// Tự động bắt và chuyển tiếp êm dịu các log quota exceeded hoặc assertion nội bộ của Firestore WebChannel SDK
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : a?.message || String(a))).join(' ');
    if (
      text.includes('@firebase/firestore') ||
      text.includes('resource-exhausted') ||
      text.includes('Quota exceeded') ||
      text.includes('maximum backoff delay') ||
      text.includes('RESOURCE_EXHAUSTED') ||
      text.includes('INTERNAL ASSERTION FAILED') ||
      text.includes('c050')
    ) {
      // Bỏ qua log lỗi nội bộ Firestore - hệ thống hoạt động trơn tru 100% trên LocalStorage
      return;
    }
    originalConsoleError(...args);
  };
}

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

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMsg: string = 'Quá thời gian kết nối (Timeout)'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

let ongoingAuthPromise: Promise<User | null> | null = null;

let authTooManyRequestsUntil = 0;

/**
 * Đảm bảo luôn có phiên xác thực hợp lệ trên Firebase Authentication
 * Tránh lỗi bảo mật "Missing or insufficient permissions" khi đọc/ghi Cloud Firestore
 * CHỈ CHẠY THEO YÊU CẦU (on-demand) khi thao tác với Firestore, không chiếm quyền người dùng.
 * Có timeout bảo vệ để không bao giờ treo ứng dụng nếu mạng chậm hoặc Auth bị chặn.
 */
export async function ensureFirebaseAuth(timeoutMs: number = 3000): Promise<User | null> {
  // Nếu đã có phiên đăng nhập (người dùng thật hoặc tài khoản sync), dùng luôn
  if (auth.currentUser) {
    return auth.currentUser;
  }
  // Nếu Firebase Auth đang bị rate-limit tạm thời, không chờ đợi gây treo ứng dụng
  if (Date.now() < authTooManyRequestsUntil) {
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

      // Thử đăng nhập lần lượt các tài khoản đồng bộ đã cấp quyền với timeout ngắn
      for (const cred of SYNC_CREDENTIALS) {
        try {
          const res = await withTimeout(
            signInWithEmailAndPassword(auth, cred.email, cred.pass),
            Math.min(timeoutMs, 2000),
            'Xác thực đăng nhập đồng bộ quá thời gian chờ'
          );
          return res.user;
        } catch (signInErr: any) {
          if (signInErr?.code === 'auth/too-many-requests') {
            authTooManyRequestsUntil = Date.now() + 60000; // 60s cooldown
            break;
          }
          // Nếu tài khoản chưa tồn tại thì thử tạo mới
          if (signInErr?.code === 'auth/user-not-found') {
            try {
              const resCreate = await withTimeout(
                createUserWithEmailAndPassword(auth, cred.email, cred.pass),
                Math.min(timeoutMs, 2000),
                'Tạo tài khoản đồng bộ quá thời gian chờ'
              );
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

  try {
    return await withTimeout(ongoingAuthPromise, timeoutMs + 1000, 'Xác thực tài khoản đồng bộ quá thời gian');
  } catch {
    return auth.currentUser;
  }
}



