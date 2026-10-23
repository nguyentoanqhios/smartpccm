/**
 * Khung hiển thị Toast thông báo nổi thời gian thực
 * Phân công chuyên môn THCS Quỳ Hợp
 */

import React, { useState, useEffect } from 'react';
import {
  toastService,
  ToastItem,
  ToastSettings,
  ToastActionCategory,
} from '../services/toastService';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  Trash2,
  Sliders,
  PlusCircle,
  Edit3,
  Award,
  Layers,
  X,
  Settings,
} from 'lucide-react';

interface ToastContainerProps {
  onOpenSettings?: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ onOpenSettings }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [settings, setSettings] = useState<ToastSettings>(toastService.getSettings());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const unsubToasts = toastService.subscribe(setToasts);
    const unsubSettings = toastService.subscribeSettings(setSettings);
    return () => {
      unsubToasts();
      unsubSettings();
    };
  }, []);

  if (!settings.enabled || toasts.length === 0) {
    return null;
  }

  // Positioning classes
  const getPositionClasses = () => {
    switch (settings.position) {
      case 'top-center':
        return 'top-20 left-1/2 -translate-x-1/2 items-center';
      case 'bottom-right':
        return 'bottom-5 right-4 items-end';
      case 'bottom-left':
        return 'bottom-5 left-4 items-start';
      case 'top-right':
      default:
        return 'top-20 right-4 items-end';
    }
  };

  const getCategoryMeta = (category: ToastActionCategory) => {
    switch (category) {
      case 'quota':
        return {
          icon: Sliders,
          label: 'Định mức',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          accentColor: 'border-l-amber-500',
          iconBg: 'bg-amber-50 text-amber-700',
        };
      case 'assignment_add':
        return {
          icon: PlusCircle,
          label: 'Gán lớp',
          badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          accentColor: 'border-l-emerald-500',
          iconBg: 'bg-emerald-50 text-emerald-700',
        };
      case 'assignment_update':
        return {
          icon: Edit3,
          label: 'Sửa phân công',
          badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
          accentColor: 'border-l-blue-500',
          iconBg: 'bg-sky-50 text-sky-700',
        };
      case 'assignment_delete':
        return {
          icon: Trash2,
          label: 'Xóa phân công',
          badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
          accentColor: 'border-l-rose-500',
          iconBg: 'bg-rose-50 text-rose-700',
        };
      case 'duty':
        return {
          icon: Award,
          label: 'Kiêm nhiệm',
          badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          accentColor: 'border-l-indigo-500',
          iconBg: 'bg-indigo-50 text-indigo-700',
        };
      case 'bulk':
      default:
        return {
          icon: Layers,
          label: 'Hàng loạt',
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
          accentColor: 'border-l-purple-500',
          iconBg: 'bg-purple-50 text-purple-700',
        };
    }
  };

  return (
    <div
      aria-live="assertive"
      className={`fixed z-50 pointer-events-none flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-3 ${getPositionClasses()}`}
    >
      {toasts.map((toast) => {
        const meta = getCategoryMeta(toast.category);
        const IconComponent = meta.icon;
        const durationSec = (toast.duration || 5000) / 1000;

        return (
          <div
            key={toast.id}
            onMouseEnter={() => setHoveredId(toast.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`pointer-events-auto w-full bg-white rounded-xl shadow-xl border border-slate-200 border-l-4 ${meta.accentColor} p-3.5 flex flex-col gap-1.5 transition-all transform duration-200 hover:shadow-2xl relative overflow-hidden`}
          >
            {/* Top row: Category tag, Title, and Action buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.badgeBg}`}
                >
                  {meta.label}
                </span>
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  {toast.title}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSettings();
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                    title="Cài đặt thông báo này hoặc tắt loại hành động này"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toastService.dismiss(toast.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Đóng thông báo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div className="pl-9 pr-1">
              <p className="text-xs sm:text-sm text-slate-900 font-medium leading-relaxed">
                {toast.message}
              </p>
              {toast.details && (
                <p className="text-[11px] text-slate-500 mt-0.5 italic">{toast.details}</p>
              )}
            </div>

            {/* Footer row: Timestamp & Dismiss status */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pl-9 pt-0.5">
              <span>{new Date(toast.timestamp).toLocaleTimeString('vi-VN')}</span>
              {toast.duration && toast.duration > 0 ? (
                <span>Tự đóng sau {Math.round(durationSec)}s</span>
              ) : (
                <span className="text-amber-600 font-medium">Giữ trên màn hình</span>
              )}
            </div>

            {/* Progress bar (animates down if not hovered and duration > 0) */}
            {toast.duration && toast.duration > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    animation:
                      hoveredId === toast.id
                        ? 'none'
                        : `toastProgress ${toast.duration}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes toastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};
