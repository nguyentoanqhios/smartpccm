/**
 * Hệ thống quản lý thông báo Toast thời gian thực
 * Phân công chuyên môn THCS Quỳ Hợp
 */

export type ToastActionCategory =
  | 'quota'             // Thay đổi định mức tiết dạy
  | 'assignment_add'    // Gán lớp / thêm phân công
  | 'assignment_update' // Sửa phân công giảng dạy
  | 'assignment_delete' // Xóa phân công giảng dạy
  | 'duty'              // Phân công kiêm nhiệm & miễn giảm
  | 'bulk';             // Thao tác hàng loạt

export type ToastType = 'success' | 'info' | 'warning' | 'error';
export type ToastPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-left';

export interface ToastSettings {
  enabled: boolean; // Bật / Tắt toàn bộ thông báo Toast
  duration: number; // 3000, 5000, 8000, 0 (0 = không tự đóng)
  position: ToastPosition;
  playSound: boolean;
  categories: {
    quota: boolean;             // Thay đổi định mức giáo viên
    assignment_add: boolean;    // Gán lớp / thêm phân công
    assignment_update: boolean; // Sửa phân công
    assignment_delete: boolean; // Xóa phân công
    duty: boolean;              // Kiêm nhiệm & miễn giảm
    bulk: boolean;              // Thao tác hàng loạt
  };
}

export interface ToastItem {
  id: string;
  category: ToastActionCategory;
  type: ToastType;
  title: string;
  teacherName?: string;
  message: string;
  details?: string;
  timestamp: number;
  duration?: number;
}

const SETTINGS_STORAGE_KEY = 'app_toast_settings_v1';
const HISTORY_STORAGE_KEY = 'app_toast_history_v1';

const DEFAULT_SETTINGS: ToastSettings = {
  enabled: true,
  duration: 5000,
  position: 'top-right',
  playSound: false,
  categories: {
    quota: true,
    assignment_add: true,
    assignment_update: true,
    assignment_delete: true,
    duty: true,
    bulk: true,
  },
};

class ToastService {
  private settings: ToastSettings = DEFAULT_SETTINGS;
  private activeToasts: ToastItem[] = [];
  private history: ToastItem[] = [];
  private listeners: ((toasts: ToastItem[]) => void)[] = [];
  private settingsListeners: ((settings: ToastSettings) => void)[] = [];

  constructor() {
    this.loadSettings();
    this.loadHistory();
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          categories: {
            ...DEFAULT_SETTINGS.categories,
            ...(parsed.categories || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Cannot load toast settings, fallback to defaults', e);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Cannot save toast settings', e);
    }
    this.notifySettingsListeners();
  }

  private loadHistory(): void {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      // Keep only the last 60 items
      const trimmed = this.history.slice(-60);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Cannot save toast history', e);
    }
  }

  private playSubtleChime(): void {
    if (!this.settings.playSound) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore autoplay error
    }
  }

  public getSettings(): ToastSettings {
    return { ...this.settings, categories: { ...this.settings.categories } };
  }

  public updateSettings(partial: Partial<ToastSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
      categories: {
        ...this.settings.categories,
        ...(partial.categories || {}),
      },
    };
    this.saveSettings();
  }

  public resetSettings(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.saveSettings();
  }

  public getActiveToasts(): ToastItem[] {
    return [...this.activeToasts];
  }

  public getHistory(): ToastItem[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
    this.saveHistory();
  }

  public subscribe(listener: (toasts: ToastItem[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getActiveToasts());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public subscribeSettings(listener: (settings: ToastSettings) => void): () => void {
    this.settingsListeners.push(listener);
    listener(this.getSettings());
    return () => {
      this.settingsListeners = this.settingsListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    const list = this.getActiveToasts();
    this.listeners.forEach((fn) => fn(list));
  }

  private notifySettingsListeners(): void {
    const s = this.getSettings();
    this.settingsListeners.forEach((fn) => fn(s));
  }

  public dismiss(id: string): void {
    this.activeToasts = this.activeToasts.filter((t) => t.id !== id);
    this.notifyListeners();
  }

  public clearAll(): void {
    this.activeToasts = [];
    this.notifyListeners();
  }

  /**
   * Phát một Toast thông báo
   */
  public notify(params: Omit<ToastItem, 'id' | 'timestamp'>): ToastItem | null {
    const toast: ToastItem = {
      ...params,
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      duration: params.duration ?? this.settings.duration,
    };

    // Always log to history for auditing
    this.history.unshift(toast);
    if (this.history.length > 60) this.history.pop();
    this.saveHistory();

    // Check if master toast switch is turned off
    if (!this.settings.enabled) {
      return null;
    }

    // Check if specific action category is filtered out
    const isCategoryAllowed = this.settings.categories[toast.category];
    if (isCategoryAllowed === false) {
      return null;
    }

    // Add to active stack (limit to max 5 simultaneous on screen to prevent screen clutter)
    this.activeToasts = [toast, ...this.activeToasts.slice(0, 4)];
    this.notifyListeners();
    this.playSubtleChime();

    // Auto dismiss timer if duration > 0
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        this.dismiss(toast.id);
      }, toast.duration);
    }

    return toast;
  }

  // =========================================================================
  // HIGH-LEVEL CONVENIENCE HELPERS ACCORDING TO USER'S INTENT
  // =========================================================================

  /**
   * Thông báo thay đổi định mức giáo viên
   * Ví dụ: "Nguyễn Văn Toàn: sửa định mức từ 19 thành 15 tiết/tuần"
   */
  public notifyQuotaChange(
    teacherName: string,
    oldQuota: number,
    newQuota: number,
    note?: string
  ): ToastItem | null {
    const diff = newQuota - oldQuota;
    const diffText = diff > 0 ? `(+${diff} tiết)` : diff < 0 ? `(${diff} tiết)` : '';
    return this.notify({
      category: 'quota',
      type: 'success',
      title: 'Đã lưu thay đổi định mức',
      teacherName,
      message: `${teacherName}: sửa định mức từ ${oldQuota} thành ${newQuota} tiết/tuần ${diffText}`.trim(),
      details: note || undefined,
    });
  }

  /**
   * Thông báo gán lớp / thêm phân công
   * Ví dụ: "Nguyễn Văn Toàn: thêm phân công Toán 9A1 (4 tiết/tuần)"
   */
  public notifyAssignmentAdd(
    teacherName: string,
    className: string,
    subjectName: string,
    periodsPerWeek: number,
    session?: string
  ): ToastItem | null {
    const sessionLabel = session === 'MORNING' ? 'Sáng' : session === 'AFTERNOON' ? 'Chiều' : session === 'ACTIVITY' ? 'Hoạt động' : '';
    const sessionPart = sessionLabel ? ` • Buổi ${sessionLabel}` : '';
    return this.notify({
      category: 'assignment_add',
      type: 'success',
      title: 'Đã gán lớp thành công',
      teacherName,
      message: `${teacherName}: thêm phân công lớp ${className} • Môn ${subjectName} (${periodsPerWeek} tiết/tuần${sessionPart})`,
    });
  }

  /**
   * Thông báo sửa phân công giảng dạy
   * Ví dụ: "Nguyễn Văn Toàn: sửa phân công Toán 9A1 từ Sáng thành Chiều"
   */
  public notifyAssignmentUpdate(
    teacherName: string,
    className: string,
    subjectName: string,
    changesDescription: string
  ): ToastItem | null {
    return this.notify({
      category: 'assignment_update',
      type: 'info',
      title: 'Đã cập nhật phân công',
      teacherName,
      message: `${teacherName}: sửa phân công lớp ${className} (${subjectName}) • ${changesDescription}`,
    });
  }

  /**
   * Thông báo xóa phân công
   * Ví dụ: "Nguyễn Văn Toàn: xóa phân công GDCD 8A9 (1 tiết/tuần)"
   */
  public notifyAssignmentDelete(
    teacherName: string,
    className: string,
    subjectName: string,
    periodsPerWeek?: number,
    isPermanent = false
  ): ToastItem | null {
    const periodText = periodsPerWeek ? ` (${periodsPerWeek} tiết/tuần)` : '';
    return this.notify({
      category: 'assignment_delete',
      type: 'warning',
      title: isPermanent ? 'Đã xóa vĩnh viễn phân công' : 'Đã chuyển phân công vào thùng rác',
      teacherName,
      message: `${teacherName}: xóa phân công lớp ${className} (${subjectName})${periodText}`,
    });
  }

  /**
   * Thông báo nhiệm vụ kiêm nhiệm & miễn giảm
   * Ví dụ: "Nguyễn Văn Toàn: thêm nhiệm vụ kiêm nhiệm Tổ trưởng chuyên môn (3 tiết/tuần)"
   */
  public notifyDutyChange(
    teacherName: string,
    dutyName: string,
    action: 'add' | 'update' | 'delete',
    periods?: number
  ): ToastItem | null {
    const actionText = action === 'add' ? 'thêm' : action === 'delete' ? 'xóa' : 'sửa';
    const periodText = periods !== undefined ? ` (${periods} tiết/tuần)` : '';
    return this.notify({
      category: 'duty',
      type: action === 'delete' ? 'warning' : 'success',
      title: 'Nhiệm vụ kiêm nhiệm & Miễn giảm',
      teacherName,
      message: `${teacherName}: ${actionText} nhiệm vụ "${dutyName}"${periodText}`,
    });
  }

  /**
   * Thông báo thao tác hàng loạt
   */
  public notifyBulk(actionTitle: string, summary: string): ToastItem | null {
    return this.notify({
      category: 'bulk',
      type: 'success',
      title: actionTitle,
      message: summary,
    });
  }

  /**
   * Thông báo Thành công
   */
  public success(message: string, title: string = 'Thành công'): ToastItem | null {
    return this.notify({
      category: 'bulk',
      type: 'success',
      title,
      message,
    });
  }

  /**
   * Thông báo Lỗi
   */
  public error(message: string, title: string = 'Có lỗi xảy ra'): ToastItem | null {
    return this.notify({
      category: 'bulk',
      type: 'error',
      title,
      message,
    });
  }

  /**
   * Thông báo Thông tin
   */
  public info(message: string, title: string = 'Thông báo'): ToastItem | null {
    return this.notify({
      category: 'bulk',
      type: 'info',
      title,
      message,
    });
  }

  /**
   * Thông báo Cảnh báo
   */
  public warning(message: string, title: string = 'Cảnh báo'): ToastItem | null {
    return this.notify({
      category: 'bulk',
      type: 'warning',
      title,
      message,
    });
  }
}

export const toastService = new ToastService();
