/**
 * School & Multi-Branch Setup Wizard Modal
 * Cho phép khai báo thông tin trường và danh mục các điểm trường (Điểm chính, Phân hiệu...)
 * để phần mềm sử dụng linh hoạt cho mọi trường học.
 */

import React, { useState } from 'react';
import {
  School,
  Building2,
  MapPin,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Phone,
  User,
  Info,
  ShieldCheck,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
  Download,
  Upload,
  Lock,
  Clock,
} from 'lucide-react';
import { SchoolInfo, SchoolBranch } from '../types';
import { dataStore, isSuperAdminEmail } from '../repositories/dataStore';
import { exportComprehensiveInitialSetupTemplate } from '../import-export/excelService';
import { importComprehensiveInitialSetupWorkbook } from '../import-export/excelImportService';
import { toastService } from '../services/toastService';

interface SchoolBranchSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  onComplete?: () => void;
  isFirstRun?: boolean;
}

export const SchoolBranchSetupModal: React.FC<SchoolBranchSetupModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  onComplete,
  isFirstRun = false,
}) => {
  const currentSchool = dataStore.getSchoolInfo();
  const currentBranches = dataStore.getBranches(true);
  const currentUser = dataStore.getCurrentUser();
  const isSuperAdmin = isSuperAdminEmail(currentUser?.email || '') || Boolean(currentUser?.isSuperAdmin);
  const currentLic = dataStore.getSchoolLicenseById(dataStore.getSchoolId());
  const effectiveSchoolName = (currentLic?.schoolName && currentLic.schoolName !== 'TRƯỜNG THCS MỚI')
    ? currentLic.schoolName
    : (currentSchool.schoolName && currentSchool.schoolName !== 'TRƯỜNG THCS MỚI')
    ? currentSchool.schoolName
    : (currentLic?.schoolName || currentSchool.schoolName || '');
  const isSchoolNameLocked = !isSuperAdmin && Boolean(effectiveSchoolName);
  const licenseCheck = dataStore.checkSchoolLicense();

  // Form State: School Info
  const [schoolName, setSchoolName] = useState<string>(effectiveSchoolName);

  React.useEffect(() => {
    const sId = dataStore.getSchoolId();
    const lic = dataStore.getSchoolLicenseById(sId);
    if (lic?.schoolName && lic.schoolName !== 'TRƯỜNG THCS MỚI') {
      setSchoolName(lic.schoolName);
    }
  }, []);
  const [authorityName, setAuthorityName] = useState<string>(() => {
    let auth = currentSchool.authorityName || '';
    if (auth.toUpperCase().includes('QUỲ HỢP') || auth.toUpperCase().includes('PHÒNG GIÁO DỤC') || auth.toUpperCase().includes('PHÒNG GD')) {
      auth = '';
    }
    return auth;
  });
  const [province, setProvince] = useState<string>(currentSchool.province || '');
  const [district, setDistrict] = useState<string>(currentSchool.district || '');
  const [address, setAddress] = useState<string>(currentSchool.address || '');
  const [schoolYear, setSchoolYear] = useState<string>(currentSchool.schoolYear || '2026-2027');
  const [principalName, setPrincipalName] = useState<string>(currentSchool.principalName || '');
  const [schoolPhone, setSchoolPhone] = useState<string>(() => {
    return currentSchool.phone || '';
  });
  const [schoolEmail, setSchoolEmail] = useState<string>(currentSchool.email || '');
  const [isImportingExcel, setIsImportingExcel] = useState<boolean>(false);

  // Form State: Branches List
  const [branchList, setBranchList] = useState<SchoolBranch[]>(() => {
    if (currentBranches.length > 0) {
      return currentBranches.map((b) => ({ ...b }));
    }
    return [
      {
        id: 'branch_main',
        code: 'DC',
        name: 'Điểm chính',
        isMain: true,
        address: 'Khu trung tâm',
        managerName: 'Ban Giám hiệu',
        phone: '',
        notes: 'Cơ sở đào tạo tập trung',
        active: true,
        order: 1,
      },
      {
        id: 'branch_sub',
        code: 'PH',
        name: 'Phân hiệu',
        isMain: false,
        address: 'Khu phân hiệu',
        managerName: 'Phó Hiệu trưởng phụ trách',
        phone: '',
        notes: 'Phân hiệu phục vụ học sinh cụm xa',
        active: true,
        order: 2,
      },
    ];
  });

  // Clean slate checkbox (optionally reset sample data when setting up a fresh new school)
  const [cleanSlate, setCleanSlate] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick preset handlers
  const handleSetPresetCount = (count: number) => {
    if (count === 1) {
      setBranchList([
        {
          id: 'branch_main',
          code: 'DC',
          name: 'Điểm chính',
          isMain: true,
          address: address || 'Khuôn viên trường chính',
          managerName: principalName || 'Hiệu trưởng',
          phone: schoolPhone || '',
          notes: 'Cơ sở duy nhất của trường',
          active: true,
          order: 1,
        },
      ]);
    } else if (count === 2) {
      setBranchList([
        {
          id: 'branch_main',
          code: 'DC',
          name: 'Điểm chính',
          isMain: true,
          address: 'Cơ sở chính',
          managerName: 'Hiệu trưởng',
          phone: schoolPhone || '',
          notes: 'Điểm trường trung tâm',
          active: true,
          order: 1,
        },
        {
          id: 'branch_sub',
          code: 'PH',
          name: 'Phân hiệu',
          isMain: false,
          address: 'Cơ sở phân hiệu',
          managerName: 'Phó Hiệu trưởng phụ trách',
          phone: '',
          notes: 'Phân hiệu giảng dạy cụm ngoài',
          active: true,
          order: 2,
        },
      ]);
    } else if (count === 3) {
      setBranchList([
        {
          id: 'branch_main',
          code: 'DC',
          name: 'Điểm chính',
          isMain: true,
          address: 'Cơ sở chính',
          managerName: 'Hiệu trưởng',
          phone: schoolPhone || '',
          notes: 'Điểm trường trung tâm',
          active: true,
          order: 1,
        },
        {
          id: 'branch_sub1',
          code: 'PH1',
          name: 'Phân hiệu 1',
          isMain: false,
          address: 'Điểm trường / Phân hiệu 1',
          managerName: 'Phó Hiệu trưởng',
          phone: '',
          notes: 'Phân hiệu số 1',
          active: true,
          order: 2,
        },
        {
          id: 'branch_sub2',
          code: 'PH2',
          name: 'Phân hiệu 2',
          isMain: false,
          address: 'Điểm trường / Phân hiệu 2',
          managerName: 'Tổ trưởng / Phụ trách điểm',
          phone: '',
          notes: 'Phân hiệu số 2',
          active: true,
          order: 3,
        },
      ]);
    }
  };

  const handleAddBranch = () => {
    const newIdx = branchList.length + 1;
    const newBranch: SchoolBranch = {
      id: `branch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: `PH${newIdx - 1}`,
      name: `Phân hiệu ${newIdx - 1}`,
      isMain: false,
      address: '',
      managerName: '',
      phone: '',
      notes: '',
      active: true,
      order: newIdx,
    };
    setBranchList([...branchList, newBranch]);
  };

  const handleRemoveBranch = (index: number) => {
    if (branchList.length <= 1) {
      setErrorMessage('Trường học phải có ít nhất một điểm trường (Điểm trường chính).');
      return;
    }
    const target = branchList[index];
    const remaining = branchList.filter((_, i) => i !== index);
    // If deleted branch was main, set first one as main
    if (target.isMain && remaining.length > 0) {
      remaining[0].isMain = true;
    }
    setBranchList(remaining);
  };

  const handleSetMainBranch = (index: number) => {
    const updated = branchList.map((b, i) => ({
      ...b,
      isMain: i === index,
    }));
    setBranchList(updated);
  };

  const handleUpdateBranchField = (index: number, field: keyof SchoolBranch, value: any) => {
    const updated = [...branchList];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setBranchList(updated);
  };

  const handleSave = () => {
    // Validation
    if (!schoolName.trim()) {
      setErrorMessage('Vui lòng nhập Tên trường.');
      return;
    }
    if (branchList.length === 0) {
      setErrorMessage('Vui lòng khai báo ít nhất một điểm trường.');
      return;
    }
    for (let i = 0; i < branchList.length; i++) {
      if (!branchList[i].name.trim()) {
        setErrorMessage(`Vui lòng nhập tên cho điểm trường thứ ${i + 1}.`);
        return;
      }
      if (!branchList[i].code.trim()) {
        setErrorMessage(`Vui lòng nhập mã viết tắt cho điểm trường "${branchList[i].name}".`);
        return;
      }
    }

    // Normalize branch names: Điểm chính
    const normalizedBranchList = branchList.map((b) => {
      let name = b.name.trim();
      if (b.isMain && (name.toLowerCase() === 'điểm trường chính' || name.toLowerCase() === 'điểm chính')) {
        name = 'Điểm chính';
      }
      return {
        ...b,
        name,
      };
    });

    // Save to dataStore
    let finalSchoolName = schoolName.trim();
    if (isSchoolNameLocked && currentLic?.schoolName) {
      finalSchoolName = currentLic.schoolName;
    }

    const schoolData: Partial<SchoolInfo> = {
      schoolName: finalSchoolName,
      authorityName: authorityName.trim(),
      province: province.trim(),
      district: district.trim(),
      address: address.trim(),
      schoolYear: schoolYear.trim(),
      principalName: principalName.trim(),
      phone: schoolPhone.trim(),
      email: schoolEmail.trim(),
      branchName: normalizedBranchList.length > 1 ? `CÓ ${normalizedBranchList.length} ĐIỂM TRƯỜNG` : 'ĐIỂM TRƯỜNG TẬP TRUNG',
    };

    const effectiveCleanSlate = isSuperAdmin ? cleanSlate : false;
    dataStore.setupSchoolAndBranches(schoolData, normalizedBranchList, { cleanSlate: effectiveCleanSlate });

    if (onSaved) onSaved();
    if (onComplete) onComplete();
    onClose();
  };

  const handleDownloadComprehensiveTemplate = async () => {
    try {
      await exportComprehensiveInitialSetupTemplate({
        ...currentSchool,
        schoolName: schoolName.trim() || currentSchool.schoolName,
        schoolYear: schoolYear.trim() || currentSchool.schoolYear,
        authorityName: authorityName.trim() || currentSchool.authorityName,
        email: schoolEmail.trim() || currentSchool.email,
        phone: schoolPhone.trim() || currentSchool.phone,
        principalName: principalName.trim() || currentSchool.principalName,
      });
      toastService.success('Đã tải file Mẫu Excel Khởi tạo ban đầu (7 Sheet đầy đủ)!');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi tải file mẫu Excel.');
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingExcel(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const payload = await importComprehensiveInitialSetupWorkbook(buffer, dataStore.getSchoolId());
      if (
        payload.teachers.length === 0 &&
        payload.classes.length === 0 &&
        payload.departments.length === 0 &&
        !payload.schoolInfo?.schoolName
      ) {
        setErrorMessage('Không nhận diện được dữ liệu trường học từ file Excel. Vui lòng sử dụng đúng file mẫu.');
        setIsImportingExcel(false);
        return;
      }
      await dataStore.applyComprehensiveInitialSetup(payload);
      toastService.success(
        `Đã nạp toàn diện: ${payload.schoolInfo?.schoolName || 'Trường học'}, ${payload.departments.length} Tổ CM, ${payload.classes.length} Lớp, ${payload.teachers.length} Giáo viên!`
      );
      if (onSaved) onSaved();
      if (onComplete) onComplete();
      onClose();
    } catch (err: any) {
      setErrorMessage('Lỗi đọc file Excel: ' + (err?.message || 'Kiểm tra file đúng định dạng .xlsx'));
    } finally {
      setIsImportingExcel(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="school-branch-setup-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-800/80 border border-blue-400/30 flex items-center justify-center shadow-inner">
              <School className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  KHAI BÁO TRƯỜNG HỌC & CÁC ĐIỂM TRƯỜNG
                </h2>
                {isFirstRun && (
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Khởi tạo ban đầu
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Thiết lập thông tin trường và khai báo số lượng, tên gọi các điểm trường (Điểm chính, các Phân hiệu). Mọi mục nhập và thống kê sẽ áp dụng theo danh mục này.
              </p>
            </div>
          </div>
          {!isFirstRun && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* EXCEL TEMPLATE IMPORT / EXPORT QUICK ACTIONS */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 rounded-2xl p-4 border border-blue-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    Mẫu Excel Khởi tạo Định nghĩa Ban đầu (Khuyên dùng)
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded uppercase">
                      Đầy đủ 7 sheet
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Bao gồm toàn bộ Thông tin trường, Tổ chuyên môn, Môn học, Lớp học và Danh sách chi tiết Giáo viên.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadComprehensiveTemplate}
                  className="bg-white hover:bg-blue-50 text-blue-900 font-bold px-3 py-1.5 rounded-xl border border-blue-300 flex items-center gap-1.5 transition text-xs shadow-2xs cursor-pointer active:scale-95"
                  title="Tải file Excel mẫu gồm đầy đủ các bảng dữ liệu để nhập trên máy tính"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>Tải Mẫu Excel</span>
                </button>

                <label className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition text-xs shadow-2xs cursor-pointer active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-emerald-200" />
                  <span>{isImportingExcel ? 'Đang nạp dữ liệu...' : 'Nạp file Excel đã điền'}</span>
                  <input
                    type="file"
                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleExcelUpload}
                    disabled={isImportingExcel}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* THÔNG TIN BẢN QUYỀN & THỜI HẠN SỬ DỤNG TRƯỜNG HỌC */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-blue-700/60 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-800/80 border border-blue-400/30 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-blue-300 flex items-center gap-1.5 flex-wrap">
                    <span>Bản quyền sử dụng phần mềm</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-slate-300">Mã trường: {currentLic?.id || dataStore.getSchoolId()}</span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white mt-0.5">
                    {(currentLic?.schoolName && currentLic.schoolName !== 'TRƯỜNG THCS MỚI') ? currentLic.schoolName : (schoolName || currentSchool.schoolName)}
                  </h4>
                  <div className="text-[11px] text-blue-200 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Gói cấp phép:{' '}
                      <strong className="text-amber-300 font-bold">
                        {currentLic?.planType === 'unlimited' || !currentLic?.expiresAt
                          ? 'Bản quyền Vĩnh viễn'
                          : currentLic?.planType === 'annual'
                          ? 'Gói bản quyền Hàng năm'
                          : currentLic?.planType === 'trial'
                          ? 'Gói bản quyền Dùng thử'
                          : 'Bản quyền Tiêu chuẩn'}
                      </strong>
                    </span>
                    {currentLic?.expiresAt && (
                      <span>
                        Hạn sử dụng:{' '}
                        <strong className="text-white">
                          {new Date(currentLic.expiresAt).toLocaleDateString('vi-VN')}
                        </strong>
                      </span>
                    )}
                    {currentLic?.adminEmail && (
                      <span>
                        Email quản trị:{' '}
                        <strong className="text-blue-100 font-mono font-bold">{currentLic.adminEmail}</strong>
                      </span>
                    )}
                    {currentLic?.maxTeachers && (
                      <span>
                        Hạn mức Quota:{' '}
                        <strong className="text-emerald-300 font-semibold">{currentLic.maxTeachers} GV / {currentLic.maxClasses || 25} Lớp</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expiration Status Badge */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
                <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wide">Trạng thái bản quyền</div>
                {licenseCheck.daysRemaining !== null ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-xs ${
                      licenseCheck.daysRemaining > 0
                        ? 'bg-blue-500/20 text-blue-200 border border-blue-400/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    }`}
                    title={licenseCheck.daysRemaining > 0 ? `Bản quyền còn ${licenseCheck.daysRemaining} ngày sử dụng` : 'Bản quyền đã hết hạn'}
                  >
                    <Clock className="w-3.5 h-3.5 text-blue-300" />
                    <span>{licenseCheck.daysRemaining > 0 ? `Còn ${licenseCheck.daysRemaining} ngày` : 'Bản quyền đã hết hạn'}</span>
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-xs"
                    title="Bản quyền sử dụng vĩnh viễn"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Bản quyền Vĩnh viễn</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 1: SCHOOL INFO */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
              <Building2 className="w-4 h-4 text-blue-700" />
              1. Thông tin chung của Nhà trường
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Tên trường học <span className="text-red-600">*</span>
                  </label>
                  {isSchoolNameLocked && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <Lock className="w-3 h-3 text-amber-600" />
                      Cố định theo Bản quyền
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => {
                    if (!isSchoolNameLocked) setSchoolName(e.target.value);
                  }}
                  readOnly={isSchoolNameLocked}
                  disabled={isSchoolNameLocked}
                  placeholder="Ví dụ: TRƯỜNG THCS..."
                  className={`w-full px-3 py-2 border rounded-xl font-bold outline-hidden text-xs transition ${
                    isSchoolNameLocked
                      ? 'bg-slate-100/90 text-slate-700 border-slate-300 cursor-not-allowed select-none'
                      : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500'
                  }`}
                />
                {isSchoolNameLocked && (
                  <p className="text-[10px] text-amber-700 mt-1 italic">
                    🔒 Tên trường đã được gắn theo bản quyền cấp phép. Chỉ Người cấp bản quyền mới có quyền sửa đổi.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cơ quan quản lý trực tiếp
                </label>
                <input
                  type="text"
                  value={authorityName}
                  onChange={(e) => setAuthorityName(e.target.value)}
                  placeholder="Ví dụ: UBND XÃ... / ỦY BAN NHÂN DÂN XÃ..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Năm học áp dụng
                </label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  placeholder="2026-2027"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Họ tên Hiệu trưởng / Người phụ trách
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="Nhập họ và tên Hiệu trưởng..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Địa chỉ trường chính
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ trụ sở trường học"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="0238.3888.111"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Email trường
                  </label>
                  <input
                    type="email"
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    placeholder="thcs@..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: BRANCHES DECLARATION */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  2. Khai báo danh mục các Điểm trường (Cơ sở / Phân hiệu)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Chọn quy mô số lượng điểm trường hoặc tự thêm/bớt và đặt tên theo thực tế trường
                </p>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-semibold">Chọn nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleSetPresetCount(1)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                    branchList.length === 1
                      ? 'bg-blue-800 text-white border-blue-900'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                  }`}
                >
                  1 Điểm chính
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetCount(2)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                    branchList.length === 2
                      ? 'bg-blue-800 text-white border-blue-900'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                  }`}
                >
                  2 Điểm (1 Chính + 1 Phân hiệu)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPresetCount(3)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                    branchList.length === 3
                      ? 'bg-blue-800 text-white border-blue-900'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                  }`}
                >
                  3 Điểm trường
                </button>
              </div>
            </div>

            {/* List of Branches */}
            <div className="space-y-3 pt-1">
              {branchList.map((branch, index) => (
                <div
                  key={branch.id || index}
                  className={`p-3.5 rounded-xl border transition ${
                    branch.isMain
                      ? 'bg-blue-50/70 border-blue-300 shadow-2xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center">
                        {index + 1}
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="mainBranchSelection"
                          checked={Boolean(branch.isMain)}
                          onChange={() => handleSetMainBranch(index)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          className={`font-bold text-xs ${
                            branch.isMain ? 'text-blue-900' : 'text-slate-600'
                          }`}
                        >
                          {branch.isMain ? '★ Điểm trường chính (Cơ sở trung tâm)' : 'Phân hiệu / Điểm trường lẻ'}
                        </span>
                      </label>
                    </div>

                    {branchList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(index)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                        title="Xóa điểm trường này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Tên điểm trường <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={branch.name}
                        onChange={(e) => handleUpdateBranchField(index, 'name', e.target.value)}
                        placeholder="Ví dụ: Điểm trường chính / Phân hiệu Bản Cống"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-1 focus:ring-blue-500 outline-hidden text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Mã viết tắt <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={branch.code}
                        onChange={(e) => handleUpdateBranchField(index, 'code', e.target.value.toUpperCase())}
                        placeholder="ĐC, PH, BC..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-hidden text-xs uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Người phụ trách điểm
                      </label>
                      <input
                        type="text"
                        value={branch.managerName || ''}
                        onChange={(e) => handleUpdateBranchField(index, 'managerName', e.target.value)}
                        placeholder="Phó HT phụ trách"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500 outline-hidden text-xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Địa chỉ điểm trường
                      </label>
                      <input
                        type="text"
                        value={branch.address || ''}
                        onChange={(e) => handleUpdateBranchField(index, 'address', e.target.value)}
                        placeholder="Khu vực, thôn xóm, bản làng..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500 outline-hidden text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        value={branch.phone || ''}
                        onChange={(e) => handleUpdateBranchField(index, 'phone', e.target.value)}
                        placeholder="0238..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500 outline-hidden text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddBranch}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-800 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm điểm trường mới</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: SYSTEM SYNC & INITIALIZATION MODE */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Tùy chọn Khởi tạo dữ liệu
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 p-3 bg-blue-50/80 rounded-xl border border-blue-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 block text-xs">
                    Áp dụng danh mục điểm trường và bảo toàn cơ sở dữ liệu hiện có
                  </strong>
                  <span className="text-[11px] text-slate-500">
                    Phù hợp khi trường tiếp tục sử dụng dữ liệu đã có và phân bổ lại theo các điểm trường vừa khai báo.
                  </span>
                </div>
              </div>

              {isSuperAdmin && (
                <label className="flex items-start gap-2 cursor-pointer pt-1 p-2 rounded-xl hover:bg-red-50/60 border border-transparent hover:border-red-200 transition">
                  <input
                    type="radio"
                    name="cleanSlateOption"
                    checked={cleanSlate}
                    onChange={() => setCleanSlate(true)}
                    className="mt-0.5 text-red-600"
                  />
                  <div>
                    <strong className="text-red-900 block text-xs">
                      Khởi tạo dữ liệu sạch (dữ liệu trống) để bắt đầu nhập trường mới từ đầu (Chỉ Quản trị viên cấp cao)
                    </strong>
                    <span className="text-[11px] text-red-700">
                      Xóa các lớp học, giáo viên và phân công mẫu cũ để bắt đầu nhập dữ liệu mới cho trường của mình.
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Đã cấu hình <strong>{branchList.length} điểm trường</strong> • Copyright ©2026 Nguyentoanqh</span>
          </div>

          <div className="flex items-center gap-2">
            {!isFirstRun && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button
              type="button"
              id="btn-save-school-branches"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
              <span>Lưu và Áp dụng cho toàn hệ thống</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
