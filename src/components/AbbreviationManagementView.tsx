import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Printer,
  Copy,
  Layers,
  FileText,
  Sliders,
  Check,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { AbbreviationRule, AbbreviationCategory } from '../types';
import { dataStore } from '../repositories/dataStore';
import { testAbbreviationTransformation } from '../utils/abbreviationUtils';
import { openPrintInNewTab, printViaIframe } from '../utils/printService';

interface AbbreviationManagementViewProps {
  onNavigate?: (tab: string) => void;
}

export const AbbreviationManagementView: React.FC<AbbreviationManagementViewProps> = ({
  onNavigate,
}) => {
  const [rules, setRules] = useState<AbbreviationRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Multi-selection state
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());

  // Modal Add / Edit State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<AbbreviationRule> | null>(null);

  // In-App Confirmation Modal (Replaces window.confirm completely)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    type: 'SINGLE' | 'BATCH' | 'RESET';
    rule?: AbbreviationRule;
  }>({ isOpen: false, type: 'SINGLE' });

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Live tester state
  const [testInput, setTestInput] = useState(
    'Tổ trưởng chuyên môn; Chủ nhiệm lớp 6A9; 3 tiết/tuần; 54 tiết; Tiếng Anh; Bồi dưỡng học sinh giỏi'
  );

  // Legend modal
  const [showLegendModal, setShowLegendModal] = useState(false);
  const legendPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintLegend = async () => {
    if (legendPrintRef.current) {
      const html = legendPrintRef.current.innerHTML;
      const schoolName = dataStore.getSchoolInfo().schoolName || 'TRƯỜNG THCS';
      const ok = openPrintInNewTab(html, {
        title: 'Bảng Tham Chiếu Ký Hiệu Viết Tắt Chuẩn',
        orientation: 'portrait',
        schoolName,
      });
      if (!ok) {
        await printViaIframe(html, {
          title: 'Bảng Tham Chiếu Ký Hiệu Viết Tắt Chuẩn',
          orientation: 'portrait',
          schoolName,
        });
      }
    }
  };

  // Load rules from dataStore
  const refreshRules = () => {
    setRules(dataStore.getAbbreviationRules());
  };

  useEffect(() => {
    refreshRules();
    const unsubscribe = dataStore.subscribe(refreshRules);
    return () => unsubscribe();
  }, []);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      // Category filter
      if (selectedCategory !== 'ALL' && r.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'ACTIVE' && !r.isActive) return false;
      if (selectedStatus === 'INACTIVE' && r.isActive) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchOriginal = r.originalText.toLowerCase().includes(q);
        const matchAbbr = r.abbreviatedText.toLowerCase().includes(q);
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        return matchOriginal || matchAbbr || matchDesc;
      }
      return true;
    });
  }, [rules, selectedCategory, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.isActive).length;
    const duties = rules.filter((r) => r.category === 'DUTY').length;
    const subjects = rules.filter((r) => r.category === 'SUBJECT').length;
    const exemptions = rules.filter((r) => r.category === 'EXEMPTION').length;
    const general = rules.filter((r) => r.category === 'GENERAL').length;
    return { total, active, duties, subjects, exemptions, general };
  }, [rules]);

  // Live test result
  const testResult = useMemo(() => {
    return testAbbreviationTransformation(testInput, rules);
  }, [testInput, rules]);

  // Selection handlers
  const toggleSelectRule = (id: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (filteredRules.length === 0) return;
    const allFilteredSelected = filteredRules.every((r) => selectedRuleIds.has(r.id));
    if (allFilteredSelected) {
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        filteredRules.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  // Handlers
  const handleOpenAddModal = () => {
    setEditingRule({
      originalText: '',
      abbreviatedText: '',
      category: selectedCategory !== 'ALL' ? (selectedCategory as AbbreviationCategory) : 'DUTY',
      description: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: AbbreviationRule) => {
    setEditingRule({ ...rule });
    setIsModalOpen(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.originalText?.trim() || !editingRule.abbreviatedText?.trim()) {
      showToast('Vui lòng nhập đầy đủ Cụm từ gốc và Ký hiệu viết tắt', 'error');
      return;
    }

    try {
      dataStore.saveAbbreviationRule({
        id: editingRule.id,
        originalText: editingRule.originalText.trim(),
        abbreviatedText: editingRule.abbreviatedText.trim(),
        category: (editingRule.category as AbbreviationCategory) || 'DUTY',
        aliases: editingRule.aliases || [],
        description: editingRule.description?.trim() || '',
        isActive: editingRule.isActive !== false,
      });
      setIsModalOpen(false);
      setEditingRule(null);
      refreshRules();
      showToast('Đã lưu quy tắc viết tắt thành công!');
    } catch {
      showToast('Có lỗi xảy ra khi lưu quy tắc', 'error');
    }
  };

  // Khử trùng lặp và gộp về 1 định nghĩa duy nhất cho mỗi nhiệm vụ
  const handleDeduplicate = () => {
    const res = dataStore.deduplicateAbbreviationRules();
    refreshRules();
    if (res.mergedCount > 0) {
      showToast(
        `Đã khử trùng lặp thành công! Đã gộp ${res.mergedCount} mục trùng về các định nghĩa duy nhất.`
      );
    } else {
      showToast('Danh mục đã tối ưu: Mỗi nhiệm vụ chỉ có 1 định nghĩa duy nhất.');
    }
  };

  // Delete handlers via in-app modal
  const handleTriggerSingleDelete = (rule: AbbreviationRule) => {
    setDeleteConfirmModal({
      isOpen: true,
      type: 'SINGLE',
      rule,
    });
  };

  const handleTriggerBatchDelete = () => {
    if (selectedRuleIds.size === 0) return;
    setDeleteConfirmModal({
      isOpen: true,
      type: 'BATCH',
    });
  };

  const handleTriggerResetDefault = () => {
    setDeleteConfirmModal({
      isOpen: true,
      type: 'RESET',
    });
  };

  const handleExecuteConfirmedDelete = () => {
    if (deleteConfirmModal.type === 'SINGLE' && deleteConfirmModal.rule) {
      const orig = deleteConfirmModal.rule.originalText;
      const success = dataStore.deleteAbbreviationRule(deleteConfirmModal.rule.id);
      if (success) {
        setSelectedRuleIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteConfirmModal.rule!.id);
          return next;
        });
        showToast(`Đã xóa quy tắc "${orig}" thành công!`);
      } else {
        showToast(`Không tìm thấy quy tắc để xóa`, 'error');
      }
    } else if (deleteConfirmModal.type === 'BATCH') {
      const ids: string[] = Array.from(selectedRuleIds);
      const count = dataStore.deleteMultipleAbbreviationRules(ids);
      setSelectedRuleIds(new Set());
      showToast(`Đã xóa thành công ${count} quy tắc viết tắt!`);
    } else if (deleteConfirmModal.type === 'RESET') {
      dataStore.resetAbbreviationRulesToDefault();
      setSelectedRuleIds(new Set());
      showToast('Đã khôi phục danh mục quy tắc viết tắt chuẩn thành công!');
    }

    setDeleteConfirmModal({ isOpen: false, type: 'SINGLE' });
    refreshRules();
  };

  const handleToggleRule = (id: string) => {
    dataStore.toggleAbbreviationRule(id);
    refreshRules();
  };

  const handleBatchToggleActive = (makeActive: boolean) => {
    if (selectedRuleIds.size === 0) return;
    let modified = 0;
    selectedRuleIds.forEach((id) => {
      const r = rules.find((rule) => rule.id === id);
      if (r && r.isActive !== makeActive) {
        dataStore.toggleAbbreviationRule(id);
        modified++;
      }
    });
    refreshRules();
    showToast(`Đã ${makeActive ? 'bật' : 'tắt'} ${modified} quy tắc đã chọn!`);
  };

  const handleAutoDiscover = () => {
    const result = dataStore.autoDiscoverAbbreviationRules();
    if (result.discoveredCount > 0) {
      refreshRules();
      showToast(
        `Đã tự động phát hiện và bổ sung ${result.discoveredCount} chức vụ/môn học từ dữ liệu trường vào danh mục!`,
        'success'
      );
    } else {
      showToast(
        'Tất cả chức vụ, kiêm nhiệm và môn học hiện có của trường đã tồn tại trong danh mục viết tắt!',
        'info'
      );
    }
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_muc_viet_tat_PCCM_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống tệp JSON danh mục viết tắt!');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          dataStore.importAbbreviationRules(imported, 'MERGE');
          refreshRules();
          showToast(`Đã nhập thành công ${imported.length} quy tắc viết tắt!`);
        } else {
          showToast('Tệp không đúng định dạng danh sách quy tắc viết tắt', 'error');
        }
      } catch {
        showToast('Lỗi đọc tệp JSON. Vui lòng kiểm tra lại cấu trúc tệp.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getCategoryBadge = (cat: AbbreviationCategory) => {
    switch (cat) {
      case 'DUTY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Chức vụ & Kiêm nhiệm
          </span>
        );
      case 'SUBJECT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Môn học
          </span>
        );
      case 'EXEMPTION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Chế độ & Miễn giảm
          </span>
        );
      case 'GENERAL':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Đơn vị tiết & Chung
          </span>
        );
    }
  };

  const isAllFilteredSelected =
    filteredRules.length > 0 && filteredRules.every((r) => selectedRuleIds.has(r.id));
  const isSomeFilteredSelected =
    filteredRules.some((r) => selectedRuleIds.has(r.id)) && !isAllFilteredSelected;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : toastMessage.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-300'
              : 'bg-blue-50 text-blue-900 border-blue-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : toastMessage.type === 'error' ? (
            <XCircle className="w-5 h-5 text-red-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-blue-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-blue-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 backdrop-blur-xs rounded-xl border border-white/20">
                <BookOpen className="w-6 h-6 text-blue-300" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                Danh Mục Ký Hiệu Viết Tắt
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-blue-200/90 max-w-3xl leading-relaxed">
              Quy định và cấu hình các ký hiệu viết tắt cho Chức vụ, Kiêm nhiệm, Môn học, Chế độ miễn giảm và Đơn vị tiết. Hệ thống căn cứ danh mục này để hiển thị tinh gọn trên Báo cáo phân công chuyên môn, Bảng tổng hợp và file Excel xuất ra.
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap gap-2">
            <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
              <div className="text-xs text-blue-200">Tổng quy tắc</div>
              <div className="text-lg font-black text-white">{stats.total}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
              <div className="text-xs text-emerald-300">Đang bật</div>
              <div className="text-lg font-black text-emerald-300">{stats.active}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
              <div className="text-xs text-blue-200">Chức vụ/LĐ</div>
              <div className="text-lg font-black text-blue-200">{stats.duties}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
              <div className="text-xs text-amber-200">Môn học</div>
              <div className="text-lg font-black text-amber-200">{stats.subjects}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15 text-center">
              <div className="text-xs text-purple-200">Đơn vị tiết & Chung</div>
              <div className="text-lg font-black text-purple-200">{stats.general}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Live Tester Tool */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Trình thử nghiệm & Xem trước chuyển đổi viết tắt
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Kiểm tra ngay kết quả các quy tắc đang kích hoạt trong hệ thống
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                Văn bản gốc / Nhiệm vụ đầy đủ cần kiểm tra:
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setTestInput(
                      'Tổ trưởng chuyên môn; Chủ nhiệm lớp 6A9; 3 tiết/tuần; 54 tiết'
                    )
                  }
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Mẫu 1
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    setTestInput(
                      'Phó hiệu trưởng (miễn 15 tiết/tuần = 270 tiết); Nghỉ sinh (miễn 19 tiết/tuần)'
                    )
                  }
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Mẫu 2
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    setTestInput(
                      'Bồi dưỡng học sinh giỏi môn Tiếng Anh và Khoa học tự nhiên (3 tiết/tuần)'
                    )
                  }
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Mẫu 3
                </button>
              </div>
            </div>
            <textarea
              rows={3}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium text-slate-800"
              placeholder="Nhập chuỗi văn bản muốn kiểm tra viết tắt..."
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 mb-1.5 block">
              Kết quả sau khi áp dụng Danh mục viết tắt:
            </label>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 min-h-[76px] flex flex-col justify-between">
              <div className="font-semibold text-emerald-950 leading-relaxed break-words">
                {testResult.transformedText || (
                  <span className="text-slate-400 italic">Chưa có kết quả</span>
                )}
              </div>
              {testResult.matchedRules.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/60 mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] text-slate-500 font-normal">Đã áp dụng:</span>
                  {testResult.matchedRules.map((mr) => (
                    <span
                      key={mr.id}
                      className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-1.5 py-0.2 rounded font-semibold"
                    >
                      {mr.originalText} → <strong>{mr.abbreviatedText}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm từ viết tắt mới</span>
            </button>

            <button
              type="button"
              onClick={handleAutoDiscover}
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center gap-1.5 border border-indigo-200 transition cursor-pointer"
              title="Quét giáo viên, nhiệm vụ kiêm nhiệm và môn học hiện có để bổ sung nếu thiếu"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Quét tự động từ dữ liệu trường</span>
            </button>

            <button
              type="button"
              onClick={handleDeduplicate}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 border border-amber-200 transition cursor-pointer"
              title="Khử trùng lặp: Mỗi nhiệm vụ chỉ định nghĩa 1 lần và áp dụng cho tất cả tham chiếu"
            >
              <Check className="w-4 h-4 text-amber-600" />
              <span>Khử trùng lặp (1 nhiệm vụ / 1 định nghĩa)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLegendModal(true)}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 border border-slate-200 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Bảng tra cứu / In tham chiếu</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              title="Xuất file JSON lưu trữ"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Xuất JSON</span>
            </button>

            <label className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Nhập JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleTriggerResetDefault}
              className="p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
              title="Khôi phục danh mục chuẩn mặc định của Bộ GD&ĐT"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khôi phục chuẩn</span>
            </button>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100 items-center">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm cụm từ gốc, viết tắt (vd: Tổ trưởng, TT, Tiếng Anh, BD HSG, tiết)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả phân loại ({rules.length})</option>
              <option value="DUTY">Chức vụ & Kiêm nhiệm ({stats.duties})</option>
              <option value="SUBJECT">Môn học ({stats.subjects})</option>
              <option value="EXEMPTION">Chế độ & Miễn giảm ({stats.exemptions})</option>
              <option value="GENERAL">Đơn vị tiết & Chung ({stats.general})</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full py-2 px-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="ACTIVE">Đang bật ({stats.active})</option>
              <option value="INACTIVE">Đã tắt ({stats.total - stats.active})</option>
            </select>
          </div>
        </div>

        {/* Batch Operations Bar */}
        {selectedRuleIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <CheckSquare className="w-4 h-4 text-blue-700" />
              <span>Đã chọn {selectedRuleIds.size} quy tắc</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleBatchToggleActive(true)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer"
              >
                Bật đã chọn
              </button>
              <button
                type="button"
                onClick={() => handleBatchToggleActive(false)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
              >
                Tắt đã chọn
              </button>
              <button
                type="button"
                onClick={handleTriggerBatchDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedRuleIds.size} mục</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRuleIds(new Set())}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-700" />
            <span>DANH SÁCH QUY TẮC VIẾT TẮT ({filteredRules.length} quy tắc)</span>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <span>Xem hiển thị trên Báo cáo phân công</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={handleSelectAllToggle}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Chọn tất cả các mục đang hiển thị"
                  />
                </th>
                <th className="py-2.5 px-2 w-12 text-center">STT</th>
                <th className="py-2.5 px-3 w-32 text-center">Ký hiệu viết tắt</th>
                <th className="py-2.5 px-4 min-w-[200px]">Tên gọi chuẩn (Nhiệm vụ / Môn học / Chế độ)</th>
                <th className="py-2.5 px-3 w-40 text-center">Phân loại</th>
                <th className="py-2.5 px-4 min-w-[220px]">Ý nghĩa & Nội dung quy định</th>
                <th className="py-2.5 px-3 w-24 text-center">Áp dụng</th>
                <th className="py-2.5 px-3 w-24 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    Không tìm thấy quy tắc viết tắt nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule, idx) => {
                  const isSelected = selectedRuleIds.has(rule.id);
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      } ${!rule.isActive ? 'opacity-55 bg-slate-50/60' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRule(rule.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Ký hiệu viết tắt */}
                      <td className="py-2.5 px-3 font-bold text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-900 text-white font-mono text-xs tracking-wide shadow-2xs">
                          {rule.abbreviatedText}
                        </span>
                      </td>

                      {/* Tên gọi chuẩn thống nhất */}
                      <td className="py-2.5 px-4 font-bold text-slate-900 text-xs">
                        <span>{rule.originalText}</span>
                      </td>

                      {/* Phân loại */}
                      <td className="py-2.5 px-3 text-center">{getCategoryBadge(rule.category)}</td>

                      {/* Ý nghĩa & Nội dung quy định */}
                      <td className="py-2.5 px-4 text-slate-600 text-xs">
                        {rule.description ? (
                          <span>{rule.description}</span>
                        ) : (
                          <span className="text-slate-300 italic">Theo quy định hiện hành của trường</span>
                        )}
                      </td>

                      {/* Toggle Áp dụng */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            rule.isActive ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          title={rule.isActive ? 'Đang kích hoạt (Nhấn để tắt)' : 'Đã tắt (Nhấn để bật)'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.isActive ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Thao tác */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                            title="Chỉnh sửa quy tắc"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerSingleDelete(rule)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                            title="Xóa quy tắc này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* IN-APP CONFIRMATION MODAL FOR DELETIONS & RESET (NO WINDOW.CONFIRM)       */}
      {/* ========================================================================= */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {deleteConfirmModal.type === 'SINGLE'
                    ? 'Xác nhận xóa quy tắc viết tắt'
                    : deleteConfirmModal.type === 'BATCH'
                    ? 'Xác nhận xóa các mục đã chọn'
                    : 'Khôi phục danh mục chuẩn'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {deleteConfirmModal.type === 'SINGLE' && deleteConfirmModal.rule ? (
                    <>
                      Bạn có chắc chắn muốn xóa quy tắc viết tắt cho cụm từ{' '}
                      <strong className="text-slate-900">"{deleteConfirmModal.rule.originalText}"</strong>{' '}
                      (Ký hiệu:{' '}
                      <span className="font-mono font-bold text-blue-900">
                        {deleteConfirmModal.rule.abbreviatedText}
                      </span>
                      ) không? Cụm từ này sẽ trở lại dạng đầy đủ trong bảng biểu.
                    </>
                  ) : deleteConfirmModal.type === 'BATCH' ? (
                    <>
                      Bạn có chắc chắn muốn xóa{' '}
                      <strong className="text-red-700">{selectedRuleIds.size} quy tắc viết tắt</strong>{' '}
                      đang được chọn không? Thao tác này sẽ cập nhật ngay lập tức vào cơ sở dữ liệu.
                    </>
                  ) : (
                    <>
                      Bạn có chắc chắn muốn khôi phục danh mục từ viết tắt về thiết lập chuẩn mặc định
                      của Bộ GD&ĐT? Tất cả các quy tắc đã tùy biến sẽ được thiết lập lại.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, type: 'SINGLE' })}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {deleteConfirmModal.type === 'RESET' ? 'Khôi phục ngay' : 'Đồng ý xóa'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Rule */}
      {isModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-900 rounded-xl">
                  {editingRule.id ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRule.id ? 'Chỉnh sửa quy tắc viết tắt' : 'Thêm quy tắc viết tắt mới'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Định nghĩa cách rút gọn cụm từ trong bảng biểu và báo cáo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên định nghĩa chuẩn (Cụm từ gốc chính thức) <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.originalText || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, originalText: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: Tổ trưởng chuyên môn, Tiếng Anh, Bồi dưỡng học sinh giỏi..."
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Khái niệm chuẩn chính thức dùng trong hệ thống và báo cáo quy chuẩn
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ký hiệu viết tắt hiển thị <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={editingRule.abbreviatedText || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, abbreviatedText: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-blue-900 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: TT, T.Anh, BD HSG, CN, t/tuần, t..."
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Ký hiệu ngắn gọn sẽ hiển thị thay thế trong các biểu mẫu và bảng tổng hợp
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phân loại:</label>
                  <select
                    value={editingRule.category || 'DUTY'}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        category: e.target.value as AbbreviationCategory,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="DUTY">Chức vụ & Kiêm nhiệm</option>
                    <option value="SUBJECT">Môn học</option>
                    <option value="EXEMPTION">Chế độ & Miễn giảm</option>
                    <option value="GENERAL">Đơn vị tiết & Chung</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái:</label>
                  <select
                    value={editingRule.isActive !== false ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, isActive: e.target.value === 'true' })
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-800 bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="true">Đang kích hoạt (Bật)</option>
                    <option value="false">Tạm dừng (Tắt)</option>
                  </select>
                </div>
              </div>



              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ý nghĩa & Nội dung định nghĩa (Mô tả, căn cứ quy định):
                </label>
                <input
                  type="text"
                  value={editingRule.description || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="VD: Tổ trưởng chuyên môn theo Thông tư 20/2020/TT-BGDĐT..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Lưu quy tắc</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Printable Legend Reference */}
      {showLegendModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-900" />
                <h3 className="text-base font-bold text-slate-900">
                  Bảng Tham Chiếu Ký Hiệu Viết Tắt Chuẩn
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintLegend}
                  className="px-3 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 flex items-center gap-1 cursor-pointer"
                  title="In trực tiếp hoặc mở trang in"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  <span>In bảng này</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLegendModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div ref={legendPrintRef} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs font-sans">
              <p className="text-slate-600 italic">
                Bảng danh mục ký hiệu viết tắt dùng kèm theo Báo cáo Phân công chuyên môn tổng hợp:
              </p>

              {/* Group by category */}
              {(['DUTY', 'SUBJECT', 'EXEMPTION', 'GENERAL'] as AbbreviationCategory[]).map(
                (cat) => {
                  const catRules = rules.filter((r) => r.category === cat && r.isActive);
                  if (catRules.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-2">
                      <div className="font-bold text-blue-900 uppercase tracking-wider text-[11px] pb-1 border-b border-blue-200">
                        {cat === 'DUTY'
                          ? '1. Chức vụ, Quản lý & Kiêm nhiệm'
                          : cat === 'SUBJECT'
                          ? '2. Các môn học'
                          : cat === 'EXEMPTION'
                          ? '3. Chế độ giảm trừ & Miễn giảm'
                          : '4. Đơn vị tiết & Ký hiệu chung'}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {catRules.map((r) => (
                          <div
                            key={r.id}
                            className="p-2 rounded-lg border border-slate-200 bg-slate-50 flex items-baseline gap-2"
                          >
                            <span className="font-mono font-black text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-300 text-xs">
                              {r.abbreviatedText}
                            </span>
                            <div className="flex-1 truncate">
                              <span className="text-slate-800 font-bold">{r.originalText}</span>
                              {r.description && (
                                <div className="text-[10px] text-slate-500 truncate">
                                  {r.description}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLegendModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
