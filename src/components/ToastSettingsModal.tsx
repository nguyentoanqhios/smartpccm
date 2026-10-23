/**
 * Bảng cài đặt & Tùy chọn hệ thống thông báo Toast
 * Cho phép bật/tắt toàn bộ, chọn lọc từng loại hành động, vị trí, thời gian và xem lịch sử
 */

import React, { useState, useEffect } from 'react';
import {
  toastService,
  ToastSettings,
  ToastActionCategory,
  ToastItem,
} from '../services/toastService';
import {
  Bell,
  BellOff,
  Sliders,
  PlusCircle,
  Edit3,
  Trash2,
  Award,
  Layers,
  Volume2,
  VolumeX,
  Clock,
  Layout,
  X,
  RotateCcw,
  Sparkles,
  Check,
  History,
  Search,
} from 'lucide-react';

interface ToastSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ToastSettingsModal: React.FC<ToastSettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<ToastSettings>(toastService.getSettings());
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [historyItems, setHistoryItems] = useState<ToastItem[]>(toastService.getHistory());
  const [historySearch, setHistorySearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSettings(toastService.getSettings());
      setHistoryItems(toastService.getHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMasterToggle = () => {
    const next = !settings.enabled;
    const updated = { ...settings, enabled: next };
    setSettings(updated);
    toastService.updateSettings({ enabled: next });
  };

  const handleCategoryToggle = (category: ToastActionCategory) => {
    const updatedCategories = {
      ...settings.categories,
      [category]: !settings.categories[category],
    };
    const updated = { ...settings, categories: updatedCategories };
    setSettings(updated);
    toastService.updateSettings({ categories: updatedCategories });
  };

  const handleDurationChange = (duration: number) => {
    setSettings((prev) => ({ ...prev, duration }));
    toastService.updateSettings({ duration });
  };

  const handlePositionChange = (position: ToastSettings['position']) => {
    setSettings((prev) => ({ ...prev, position }));
    toastService.updateSettings({ position });
  };

  const handleSoundToggle = () => {
    const next = !settings.playSound;
    setSettings((prev) => ({ ...prev, playSound: next }));
    toastService.updateSettings({ playSound: next });
  };

  const handleResetDefaults = () => {
    if (confirm('Khôi phục toàn bộ cài đặt thông báo về trạng thái ban đầu?')) {
      toastService.resetSettings();
      setSettings(toastService.getSettings());
    }
  };

  const handleTestQuota = () => {
    toastService.notifyQuotaChange('Nguyễn Văn Toàn', 19, 15, 'Giảm do kiêm nhiệm thêm công tác');
  };

  const handleTestAdd = () => {
    toastService.notifyAssignmentAdd('Nguyễn Văn Toàn', '8A1', 'Toán học', 4, 'MORNING');
  };

  const handleTestUpdate = () => {
    toastService.notifyAssignmentUpdate(
      'Nguyễn Văn Toàn',
      '9A2',
      'Toán học',
      'Đổi từ ca Chiều sang ca Sáng'
    );
  };

  const handleTestDelete = () => {
    toastService.notifyAssignmentDelete('Nguyễn Văn Toàn', '8A9', 'GDCD', 1, false);
  };

  const handleClearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử thông báo gần đây?')) {
      toastService.clearHistory();
      setHistoryItems([]);
    }
  };

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      item.message.toLowerCase().includes(q) ||
      (item.teacherName && item.teacherName.toLowerCase().includes(q)) ||
      item.title.toLowerCase().includes(q)
    );
  });

  const categoriesConfig: {
    key: ToastActionCategory;
    name: string;
    description: string;
    example: string;
    icon: React.ElementType;
    colorClass: string;
  }[] = [
    {
      key: 'quota',
      name: 'Thay đổi định mức giáo viên',
      description: 'Thông báo khi cập nhật định mức tiết dạy của giáo viên trong hồ sơ hoặc bảng định mức',
      example: 'Nguyễn Văn Toàn: sửa định mức từ 19 thành 15 tiết/tuần (-4 tiết)',
      icon: Sliders,
      colorClass: 'text-amber-700 bg-amber-100 border-amber-300',
    },
    {
      key: 'assignment_add',
      name: 'Gán lớp / Thêm phân công mới',
      description: 'Thông báo khi gán thêm lớp, môn học hoặc phân công giảng dạy cho giáo viên',
      example: 'Nguyễn Văn Toàn: thêm phân công lớp 8A1 • Môn Toán (4 tiết/tuần • Buổi Sáng)',
      icon: PlusCircle,
      colorClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
    },
    {
      key: 'assignment_update',
      name: 'Chỉnh sửa phân công giảng dạy',
      description: 'Thông báo khi sửa đổi ca học, số tiết, môn học hoặc giáo viên phụ trách phân công',
      example: 'Nguyễn Văn Toàn: sửa phân công lớp 9A2 (Toán) • Đổi từ ca Chiều sang ca Sáng',
      icon: Edit3,
      colorClass: 'text-blue-700 bg-blue-100 border-blue-300',
    },
    {
      key: 'assignment_delete',
      name: 'Xóa phân công giảng dạy',
      description: 'Thông báo khi xóa phân công giảng dạy hoặc chuyển phân công vào thùng rác',
      example: 'Nguyễn Văn Toàn: xóa phân công lớp 8A9 (GDCD) (1 tiết/tuần)',
      icon: Trash2,
      colorClass: 'text-rose-700 bg-rose-100 border-rose-300',
    },
    {
      key: 'duty',
      name: 'Nhiệm vụ kiêm nhiệm & Miễn giảm',
      description: 'Thông báo khi phân công, điều chỉnh hoặc hủy nhiệm vụ kiêm nhiệm (Tổ trưởng, Chủ nhiệm...)',
      example: 'Nguyễn Văn Toàn: thêm nhiệm vụ "Tổ trưởng chuyên môn" (3 tiết/tuần)',
      icon: Award,
      colorClass: 'text-indigo-700 bg-indigo-100 border-indigo-300',
    },
    {
      key: 'bulk',
      name: 'Tác vụ hàng loạt & Đợt phân công',
      description: 'Thông báo kết quả khi lưu định mức hàng loạt, phân công thông minh, xóa hàng loạt',
      example: 'Cập nhật định mức hàng loạt: Đã cập nhật định mức mới cho 12 giáo viên',
      icon: Layers,
      colorClass: 'text-purple-700 bg-purple-100 border-purple-300',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-sm border border-blue-500/40">
              <Bell className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Cài đặt thông báo thao tác (Toast)</span>
                <span className="text-[10px] bg-blue-500/40 text-blue-200 px-2 py-0.5 rounded-full font-semibold uppercase">
                  Thời gian thực
                </span>
              </h2>
              <p className="text-xs text-blue-200">
                Xác nhận nhanh các tác vụ sửa định mức, gán lớp, xóa phân công
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-blue-600" />
            <span>Tùy chọn hiển thị & Bộ lọc hành động</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>Lịch sử thông báo ({historyItems.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {activeTab === 'settings' ? (
            <>
              {/* Master Switch Panel */}
              <div
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                  settings.enabled
                    ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      settings.enabled ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'
                    }`}
                  >
                    {settings.enabled ? (
                      <Bell className="w-5 h-5" />
                    ) : (
                      <BellOff className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black">
                      {settings.enabled
                        ? 'Đang bật thông báo Toast trên màn hình'
                        : 'Đã tắt toàn bộ thông báo Toast'}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {settings.enabled
                        ? 'Hệ thống sẽ hiển thị một thẻ thông báo nhỏ xác nhận mỗi khi bạn thực hiện xong tác vụ'
                        : 'Các thao tác sẽ diễn ra âm thầm không làm phiền, nhưng vẫn được lưu trong lịch sử'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={handleMasterToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Action Categories Filter */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-700" />
                      <span>Chọn nhận thông báo đối với những hành động nào:</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bật hoặc tắt từng loại hành động theo nhu cầu làm việc của bạn
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = {
                          quota: true,
                          assignment_add: true,
                          assignment_update: true,
                          assignment_delete: true,
                          duty: true,
                          bulk: true,
                        };
                        setSettings((prev) => ({ ...prev, categories: allOn }));
                        toastService.updateSettings({ categories: allOn });
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition"
                    >
                      Bật tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allOff = {
                          quota: false,
                          assignment_add: false,
                          assignment_update: false,
                          assignment_delete: false,
                          duty: false,
                          bulk: false,
                        };
                        setSettings((prev) => ({ ...prev, categories: allOff }));
                        toastService.updateSettings({ categories: allOff });
                      }}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 transition"
                    >
                      Tắt tất cả
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {categoriesConfig.map((cat) => {
                    const isChecked = settings.categories[cat.key];
                    const IconComp = cat.icon;
                    return (
                      <div
                        key={cat.key}
                        onClick={() => handleCategoryToggle(cat.key)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                          isChecked
                            ? 'bg-white border-slate-300 shadow-2xs hover:border-blue-400'
                            : 'bg-slate-50/70 border-slate-200 opacity-60 hover:opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cat.colorClass}`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                                {cat.name}
                              </h4>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  isChecked
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border-slate-300'
                                }`}
                              >
                                {isChecked ? 'BẬT' : 'TẮT'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                            <div className="mt-1.5 text-[11px] font-medium text-slate-700 bg-slate-100/90 rounded px-2 py-1 inline-flex items-center gap-1.5 border border-slate-200">
                              <span className="text-blue-700 font-bold">Ví dụ:</span>
                              <span>{cat.example}</span>
                            </div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Display & Position Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                {/* Duration */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Thời gian tự đóng thông báo:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { val: 3000, label: '3 giây (Nhanh)' },
                      { val: 5000, label: '5 giây (Chuẩn)' },
                      { val: 8000, label: '8 giây (Chậm)' },
                      { val: 0, label: 'Không tự đóng' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => handleDurationChange(opt.val)}
                        className={`px-2.5 py-1.5 rounded-lg font-medium border text-center transition ${
                          settings.duration === opt.val
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                    <Layout className="w-4 h-4 text-blue-600" />
                    <span>Vị trí hiển thị trên màn hình:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { pos: 'top-right', label: 'Trên bên phải' },
                      { pos: 'top-center', label: 'Trên ở giữa' },
                      { pos: 'bottom-right', label: 'Dưới bên phải' },
                      { pos: 'bottom-left', label: 'Dưới bên trái' },
                    ].map((opt) => (
                      <button
                        key={opt.pos}
                        type="button"
                        onClick={() => handlePositionChange(opt.pos as ToastSettings['position'])}
                        className={`px-2.5 py-1.5 rounded-lg font-medium border text-center transition ${
                          settings.position === opt.pos
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sound Toggle & Test Panel */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSoundToggle}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      settings.playSound
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {settings.playSound ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                    <span>{settings.playSound ? 'Âm thanh: BẬT' : 'Âm thanh: TẮT'}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Phát tiếng chuông nhẹ khi hoàn thành tác vụ
                  </span>
                </div>

                {/* Quick Test Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600">Thử nghiệm:</span>
                  <button
                    type="button"
                    onClick={handleTestQuota}
                    className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-1 rounded font-semibold transition"
                    title="Thử thông báo sửa định mức"
                  >
                    Định mức
                  </button>
                  <button
                    type="button"
                    onClick={handleTestAdd}
                    className="text-[11px] bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 px-2 py-1 rounded font-semibold transition"
                    title="Thử thông báo thêm phân công"
                  >
                    Gán lớp
                  </button>
                  <button
                    type="button"
                    onClick={handleTestUpdate}
                    className="text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 px-2 py-1 rounded font-semibold transition"
                    title="Thử thông báo sửa phân công"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={handleTestDelete}
                    className="text-[11px] bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 px-2 py-1 rounded font-semibold transition"
                    title="Thử thông báo xóa phân công"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Notification History */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Tìm kiếm theo tên giáo viên, môn, lớp trong lịch sử..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {historyItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
                  >
                    Xóa lịch sử
                  </button>
                )}
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">Chưa có thông báo nào được ghi nhận</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Khi bạn thực hiện thao tác sửa định mức, gán lớp hay xóa phân công, lịch sử sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-900 font-medium">{item.message}</p>
                        {item.details && (
                          <p className="text-[11px] text-slate-500 italic">{item.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục mặc định</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            Hoàn tất & Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
