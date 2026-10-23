import React from 'react';
import {
  ShieldAlert,
  Lock,
  Calendar,
  Mail,
  Phone,
  RefreshCw,
  LogOut,
  Building2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { LicenseCheckResult } from '../types';

interface LicenseLockoutOverlayProps {
  licenseCheck: LicenseCheckResult;
  onRefresh?: () => void;
  onSignOut?: () => void;
  onLoginAsSuperAdmin?: () => void;
  onResetLocalConfig?: () => void;
}

export const LicenseLockoutOverlay: React.FC<LicenseLockoutOverlayProps> = ({
  licenseCheck,
  onRefresh,
  onSignOut,
  onLoginAsSuperAdmin,
  onResetLocalConfig,
}) => {
  const isExpired = licenseCheck.status === 'expired';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden text-center">
        {/* Top Header Badge */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 p-6 text-white relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
            {isExpired ? <Clock className="w-9 h-9 text-white animate-pulse" /> : <Lock className="w-9 h-9 text-white" />}
          </div>
          <span className="inline-block px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-white/20 border border-white/30 text-rose-100 mb-2">
            {isExpired ? 'Hết hạn sử dụng phần mềm' : 'Bản quyền đang bị tạm khóa'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {isExpired ? 'Thời hạn bản quyền đã kết thúc' : 'Quyền truy cập đã bị khóa'}
          </h2>
          <p className="text-xs text-rose-100/90 mt-1 max-w-sm mx-auto">
            Hệ thống phân công chuyên môn thông minh - Quản lý điều hành giáo dục
          </p>
        </div>

        {/* School Info & Lock Reason */}
        <div className="p-6 sm:p-7 space-y-5 text-left">
          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">
                Đơn vị trường học
              </div>
              <div className="text-sm font-black text-slate-900 truncate">
                {licenseCheck.schoolName || 'TRƯỜNG THCS'}
              </div>
              <div className="text-xs text-rose-900 font-semibold mt-1">
                Lý do: {licenseCheck.lockedReason || (isExpired ? 'Đã hết thời hạn sử dụng bản quyền.' : 'Bản quyền bị khóa bởi Ban Quản trị.')}
              </div>
            </div>
          </div>

          {licenseCheck.expiresAt && (
            <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700">
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>Ngày hết hạn bản quyền:</span>
              </div>
              <strong className="text-rose-700 font-bold">
                {new Date(licenseCheck.expiresAt).toLocaleDateString('vi-VN')}
              </strong>
            </div>
          )}

          {/* Contact Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              <span>Liên hệ gia hạn / mở khóa bản quyền:</span>
            </div>
            <p className="text-slate-600">
              Để tiếp tục sử dụng phần mềm, vui lòng liên hệ Chủ sở hữu hệ thống:
            </p>
            <div className="space-y-1.5 pt-1 text-slate-800 font-semibold">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-normal">Quản trị viên:</span>
                <span>Nguyễn Văn Toàn</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <a href="mailto:nguyentoanqh@gmail.com" className="text-blue-700 hover:underline">
                  nguyentoanqh@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>0961 285 888 (Zalo / Hotline)</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Kiểm tra lại trạng thái</span>
              </button>
            )}

            {onResetLocalConfig && (
              <button
                type="button"
                onClick={onResetLocalConfig}
                className="flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs py-2.5 px-4 rounded-xl shadow-2xs transition cursor-pointer"
                title="Khôi phục lại dữ liệu cấu hình cục bộ và đồng bộ lại với Firebase"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
                <span>Khôi phục cấu hình</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2.5 px-4 rounded-xl border border-slate-300 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>

          {onLoginAsSuperAdmin && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onLoginAsSuperAdmin}
                className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Bạn là Chủ sở hữu hệ thống? Đăng nhập mở khóa</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
