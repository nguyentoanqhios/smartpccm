/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * New / Clone Assignment Version Modal (Section VII)
 */

import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { AssignmentVersion, SemesterId } from '../types';
import { dataStore } from '../repositories/dataStore';

interface NewVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: AssignmentVersion[];
  schoolYearId: string;
  semesterId: SemesterId;
}

export const NewVersionModal: React.FC<NewVersionModalProps> = ({
  isOpen,
  onClose,
  versions,
  schoolYearId,
  semesterId,
}) => {
  const [versionName, setVersionName] = useState('');
  const [cloneFromVersionId, setCloneFromVersionId] = useState<string>('');
  const [targetSemester, setTargetSemester] = useState<SemesterId>(semesterId);
  const [notes, setNotes] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const currentUser = dataStore.getCurrentUser();
  const canEdit = currentUser?.permission === 'edit';

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setNotification({
        message: 'Bạn đang ở chế độ Chỉ xem. Chỉ tài khoản có quyền Chỉnh sửa mới được tạo phiên bản.',
        type: 'error',
      });
      return;
    }
    if (!versionName.trim()) {
      setNotification({
        message: 'Vui lòng nhập tên phiên bản phân công mới!',
        type: 'error',
      });
      return;
    }

    const newVersion = dataStore.createVersion({
      schoolYearId,
      semesterId: targetSemester,
      name: versionName.trim(),
      cloneFromVersionId: cloneFromVersionId || undefined,
      notes: notes.trim(),
    });

    if (newVersion) {
      dataStore.setSelectedContext(schoolYearId, targetSemester, newVersion.id);
      setNotification({
        message: `Đã tạo và chuyển sang phiên bản mới: "${newVersion.name}"!`,
        type: 'success',
      });
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const handleToggleLock = (versionId: string, currentStatus: string) => {
    if (!canEdit) {
      setNotification({
        message: 'Bạn không có quyền chỉnh sửa để khóa/mở khóa phiên bản.',
        type: 'error',
      });
      return;
    }

    if (currentStatus === 'locked') {
      dataStore.setVersionStatus(versionId, 'draft');
      setNotification({
        message: 'Đã mở khóa phiên bản để tiếp tục chỉnh sửa.',
        type: 'info',
      });
    } else {
      dataStore.setVersionStatus(versionId, 'locked', lockReason || 'Khóa sau khi hoàn tất kiểm tra chuyên môn');
      setNotification({
        message: 'Đã khóa an toàn phiên bản, chống chỉnh sửa vô ý!',
        type: 'success',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Quản lý & Lưu Phiên bản Phân công</h3>
              <p className="text-[11px] text-slate-500">Lưu từng đợt phân công độc lập trong học kỳ để theo dõi, so sánh và báo cáo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Notice */}
        {!canEdit && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Tài khoản hiện tại có quyền <strong>Chỉ xem</strong>. Để tạo mới hoặc thay đổi trạng thái phiên bản, vui lòng đăng nhập tài khoản có quyền <strong>Chỉnh sửa</strong>.</span>
          </div>
        )}

        {notification && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-900 border border-rose-200'
              : 'bg-blue-50 text-blue-900 border border-blue-200'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tên phiên bản mới *</label>
            <input
              type="text"
              disabled={!canEdit}
              placeholder="VD: Phương án HK1 - Lần 2 (Sau điều chỉnh TKB)..."
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Áp dụng cho học kỳ</label>
              <select
                disabled={!canEdit}
                value={targetSemester}
                onChange={(e) => setTargetSemester(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium disabled:opacity-60"
              >
                <option value="HK1">Học kỳ I (18 tuần)</option>
                <option value="HK2">Học kỳ II (17 tuần)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Sao chép dữ liệu từ</label>
              <select
                disabled={!canEdit}
                value={cloneFromVersionId}
                onChange={(e) => setCloneFromVersionId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium disabled:opacity-60"
              >
                <option value="">-- Tạo bản trống --</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.semesterId})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ghi chú mục đích điều chỉnh</label>
            <textarea
              disabled={!canEdit}
              rows={2}
              placeholder="Lý do điều chỉnh (ví dụ: bổ sung giáo viên mới, thay đổi TKB, chuyển tiết...)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 disabled:opacity-60"
            />
          </div>

          <div className="p-2.5 bg-blue-50/70 rounded-xl text-[11px] text-blue-900 border border-blue-200/80 leading-relaxed">
            💾 Toàn bộ dữ liệu được lưu trên trình duyệt và tự động đồng bộ lên Cloud. Khi tạo bản mới, bản phân công cũ vẫn được giữ nguyên vẹn để xem lại hoặc so sánh bất kỳ lúc nào.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={!canEdit}
              className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
            >
              Lưu phiên bản mới
            </button>
          </div>
        </form>

        {/* Existing versions status & lock/unlock */}
        <div className="pt-3 border-t border-slate-200">
          <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
            <span>Danh sách các phiên bản đã lưu</span>
            <span className="text-[10px] text-slate-500 font-normal">{versions.length} phiên bản</span>
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {versions.map((v) => (
              <div key={v.id} className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition">
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-slate-900 truncate">{v.name}</div>
                  <div className="text-[10px] text-slate-500">
                    Học kỳ: {v.semesterId} • {new Date(v.createdAt).toLocaleDateString('vi-VN')}
                    {v.status === 'approved' && <span className="ml-1 text-emerald-700 font-bold">• Chính thức</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      dataStore.setSelectedContext(v.schoolYearId || schoolYearId, v.semesterId, v.id);
                      setNotification({
                        message: `Đã kích hoạt phiên bản: "${v.name}"!`,
                        type: 'success',
                      });
                      setTimeout(onClose, 600);
                    }}
                    className="px-2 py-1 rounded-lg font-bold text-[10px] bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-300 transition cursor-pointer"
                  >
                    Xem bản này
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleToggleLock(v.id, v.status)}
                      title={v.status === 'locked' ? 'Mở khóa để chỉnh sửa' : 'Khóa phiên bản để bảo vệ'}
                      className={`px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition ${
                        v.status === 'locked'
                          ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {v.status === 'locked' ? <><Lock className="w-3 h-3" /> Đã khóa</> : <><Unlock className="w-3 h-3" /> Mở sửa</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
