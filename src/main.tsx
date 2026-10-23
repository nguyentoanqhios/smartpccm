import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary fallbackTitle="Khởi động ứng dụng Phân công chuyên môn">
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  }
} catch (err: any) {
  console.error('Fatal initialization error:', err);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 20px; font-family: system-ui, sans-serif;">
        <div style="max-width: 480px; width: 100%; background: #ffffff; border: 1px solid #fecdd3; border-radius: 20px; padding: 28px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
          <div style="width: 52px; height: 52px; border-radius: 16px; background: #ffe4e6; color: #e11d48; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px; font-weight: bold;">!</div>
          <h2 style="font-size: 17px; font-weight: 700; color: #881337; margin: 0 0 8px 0;">Sự cố khởi động hệ thống</h2>
          <p style="font-size: 13px; color: #475569; margin: 0 0 20px 0; line-height: 1.5;">${err?.message || 'Không thể nạp thành phần giao diện.'}</p>
          <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="padding: 10px 24px; background: #1e3a8a; color: #fff; border: none; border-radius: 12px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Xóa bộ nhớ đệm & Tải lại
          </button>
        </div>
      </div>
    `;
  }
}
