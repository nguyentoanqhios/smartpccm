import React, { useState, useEffect } from 'react';
import {
  Printer,
  ExternalLink,
  Download,
  Copy,
  Check,
  X,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  isRunningInIframe,
  printViaIframe,
  openPrintInNewTab,
  downloadPrintableHtml,
  copyTableToClipboard,
} from '../utils/printService';
import { dataStore } from '../repositories/dataStore';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  schoolName?: string;
  getContentHtml: () => string;
  getRawElement?: () => HTMLElement | null;
  orientation?: 'landscape' | 'portrait';
  onExportExcel?: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  title = 'Báo cáo Phân công Chuyên môn Tổng hợp',
  schoolName,
  getContentHtml,
  getRawElement,
  orientation: initialOrientation = 'landscape',
  onExportExcel,
}) => {
  const effectiveSchoolName = schoolName || dataStore.getSchoolInfo().schoolName || 'TRƯỜNG THCS';
  const [selectedOrientation, setSelectedOrientation] = useState<'landscape' | 'portrait'>(initialOrientation);
  const [inIframe, setInIframe] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(90);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [directPrintBlocked, setDirectPrintBlocked] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOrientation(initialOrientation);
      setInIframe(isRunningInIframe());
      setDirectPrintBlocked(false);
      setIsCopied(false);
    }
  }, [isOpen, initialOrientation]);

  if (!isOpen) return null;

  const contentHtml = getContentHtml();

  const handleDirectPrint = async () => {
    setIsPrinting(true);
    setDirectPrintBlocked(false);

    try {
      // Thử in thông qua iframe ẩn
      const success = await printViaIframe(contentHtml, {
        title,
        orientation: selectedOrientation,
        schoolName: effectiveSchoolName,
      });

      if (!success) {
        // Thử tiếp bằng window.print native
        try {
          window.print();
        } catch {
          setDirectPrintBlocked(true);
        }
      }
    } catch {
      setDirectPrintBlocked(true);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenInNewTab = () => {
    const opened = openPrintInNewTab(contentHtml, {
      title,
      orientation: selectedOrientation,
      schoolName: effectiveSchoolName,
      autoPrint: true,
    });

    if (!opened) {
      // Nếu popup bị chặn, tự động tải file HTML để người dùng mở
      handleDownloadHtml();
    }
  };

  const handleDownloadHtml = () => {
    const slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    downloadPrintableHtml(contentHtml, `${slug || 'bieu-mau-in'}.html`, {
      title,
      orientation: selectedOrientation,
      schoolName: effectiveSchoolName,
    });
  };

  const handleCopyTable = async () => {
    const el = getRawElement ? getRawElement() : document.getElementById('official-printable-report');
    if (el) {
      const ok = await copyTableToClipboard(el);
      if (ok) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col p-2 sm:p-4 animate-in fade-in duration-150">
      {/* MODAL CONTAINER */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col flex-1 max-h-[96vh] w-full max-w-7xl mx-auto overflow-hidden">
        {/* HEADER TOOLBAR */}
        <div className="bg-blue-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 border-b border-blue-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedOrientation((o) => (o === 'landscape' ? 'portrait' : 'landscape'))
                  }
                  className="text-[10px] bg-blue-500/30 hover:bg-blue-500/50 text-blue-200 border border-blue-400/40 font-semibold px-2.5 py-0.5 rounded-full uppercase cursor-pointer transition flex items-center gap-1"
                  title="Bấm để chuyển đổi giữa Khổ A4 Ngang và Khổ A4 Dọc"
                >
                  <span>{selectedOrientation === 'landscape' ? 'Khổ A4 Ngang' : 'Khổ A4 Dọc'}</span>
                  <span className="text-[9px] text-amber-300">⇄ Đổi</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">Xem trước bản in chính thức & Lựa chọn phương thức in ấn phù hợp</p>
            </div>
          </div>

          {/* ZOOM & CONTROLS */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 10, 60))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-[11px] text-slate-300 min-w-[3rem] text-center font-bold">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 10, 130))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(90)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Khôi phục 90%"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Đóng hộp thoại"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRIMARY ACTIONS STRIP */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Button: Open in New Tab (Bypasses iframe restrictions) */}
            <button
              type="button"
              id="btn-print-new-tab"
              onClick={handleOpenInNewTab}
              className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Mở tài liệu in trên tab mới để in trực tiếp không bị chặn bởi iframe"
            >
              <ExternalLink className="w-4 h-4 text-amber-300" />
              <span>Mở trang in (Tab mới)</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              id="btn-print-direct"
              onClick={handleDirectPrint}
              disabled={isPrinting}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Gửi lệnh in trực tiếp tới máy in của trình duyệt"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>{isPrinting ? 'Đang gửi in...' : 'In trực tiếp'}</span>
            </button>

            {/* Download HTML Button */}
            <button
              type="button"
              id="btn-download-html"
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Tải file HTML chuẩn trang in về máy tính"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Lưu file HTML in ấn</span>
            </button>

            {/* Copy Table to Clipboard */}
            <button
              type="button"
              id="btn-copy-table"
              onClick={handleCopyTable}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Sao chép bảng để dán vào Microsoft Word hoặc Excel"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span className={isCopied ? 'text-emerald-700 font-bold' : ''}>
                {isCopied ? 'Đã sao chép!' : 'Sao chép bảng'}
              </span>
            </button>

            {/* Optional Excel Export */}
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Xuất dữ liệu biểu mẫu ra file Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Xuất Excel</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden md:block">
            Gợi ý in: Khổ giấy <strong>A4 Ngang</strong> • Tỷ lệ <strong>100%</strong> • Lề <strong>Tối thiểu</strong>
          </div>
        </div>

        {/* NOTIFICATION BANNER IF IN IFRAME OR BLOCKED */}
        {(inIframe || directPrintBlocked) && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              {directPrintBlocked ? (
                <span>
                  <strong>Trình duyệt đã chặn hộp thoại in trực tiếp trong khung xem trước!</strong> Vui lòng bấm nút{' '}
                  <strong className="text-blue-900 underline cursor-pointer" onClick={handleOpenInNewTab}>
                    Mở trang in (Tab mới)
                  </strong>{' '}
                  hoặc <strong>Lưu file HTML in ấn</strong> để in đầy đủ không bị lỗi.
                </span>
              ) : (
                <span>
                  💡 Nếu bấm <em>In trực tiếp</em> mà trình duyệt không bật hộp thoại in, hãy bấm{' '}
                  <strong className="text-blue-900 underline cursor-pointer" onClick={handleOpenInNewTab}>
                    Mở trang in (Tab mới)
                  </strong>{' '}
                  để in ngoài khung xem trước của AI Studio.
                </span>
              )}
            </div>
          </div>
        )}

        {/* PREVIEW CONTAINER WITH PAPER SHEET EFFECT */}
        <div className="flex-1 bg-slate-200/90 p-4 sm:p-6 overflow-auto flex justify-center items-start">
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="bg-white rounded-lg shadow-xl border border-slate-300 p-8 sm:p-10 w-full max-w-[1300px] min-h-[700px] text-slate-900 font-sans print-preview-canvas"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div>
            Đơn vị: <strong>{effectiveSchoolName}</strong> • Phần mềm Quản lý Phân công Chuyên môn
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-4 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Tiến hành in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
