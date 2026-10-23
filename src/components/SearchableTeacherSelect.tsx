import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, User, ChevronDown } from 'lucide-react';
import { Teacher } from '../types';
import { matchesTeacherFullName, removeVietnameseTones } from '../utils/searchUtils';

export interface SearchableTeacherSelectProps {
  teachers: Teacher[];
  value: string;
  onChange: (teacherId: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  showDetails?: boolean;
  filterPredicate?: (teacher: Teacher) => boolean;
  getExtraBadge?: (teacher: Teacher) => React.ReactNode;
}

export const SearchableTeacherSelect: React.FC<SearchableTeacherSelectProps> = ({
  teachers,
  value,
  onChange,
  placeholder = '-- Chọn giáo viên --',
  allowClear = true,
  clearLabel = '-- Chưa chỉ định (Bỏ chọn) --',
  disabled = false,
  className = '',
  compact = false,
  showDetails = true,
  filterPredicate,
  getExtraBadge,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedTeacher = useMemo(() => {
    if (!value) return null;
    return teachers.find((t) => t.id === value) || null;
  }, [teachers, value]);

  const eligibleTeachers = useMemo(() => {
    const base = teachers.filter((t) => !t.isDeleted);
    if (!filterPredicate) return base;
    return base.filter(filterPredicate);
  }, [teachers, filterPredicate]);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleTeachers;
    return eligibleTeachers.filter((t) =>
      matchesTeacherFullName(searchQuery, t.fullName)
    );
  }, [eligibleTeachers, searchQuery]);

  const highlightName = (fullName: string, query: string) => {
    if (!query.trim()) return fullName;
    const lowerName = fullName.toLowerCase();
    const lowerQuery = query.trim().toLowerCase();
    const directIdx = lowerName.indexOf(lowerQuery);
    if (directIdx !== -1) {
      return (
        <>
          {fullName.substring(0, directIdx)}
          <mark className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {fullName.substring(directIdx, directIdx + query.trim().length)}
          </mark>
          {fullName.substring(directIdx + query.trim().length)}
        </>
      );
    }
    const normName = removeVietnameseTones(lowerName);
    const normQuery = removeVietnameseTones(lowerQuery);
    const normIdx = normName.indexOf(normQuery);
    if (normIdx !== -1 && normName.length === fullName.length) {
      return (
        <>
          {fullName.substring(0, normIdx)}
          <mark className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {fullName.substring(normIdx, normIdx + normQuery.length)}
          </mark>
          {fullName.substring(normIdx + normQuery.length)}
        </>
      );
    }
    return fullName;
  };

  const handleSelect = (teacherId: string) => {
    onChange(teacherId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left bg-white border rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white'
            : 'border-slate-300 hover:border-blue-400 focus:border-blue-600'
        } ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
              selectedTeacher
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            {selectedTeacher ? (
              selectedTeacher.fullName.charAt(0)
            ) : (
              <User className="w-3 h-3 text-slate-400" />
            )}
          </div>
          {selectedTeacher ? (
            <div className="truncate flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-slate-900 truncate">
                {selectedTeacher.fullName}
              </span>
              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-semibold flex-shrink-0">
                {selectedTeacher.code}
              </span>
              {showDetails && selectedTeacher.major && (
                <span className="text-[10px] text-slate-500 truncate hidden sm:inline">
                  • {selectedTeacher.major}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selectedTeacher && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 transition"
              title="Bỏ chọn"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180 text-blue-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Quick Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  } else if (e.key === 'Enter' && filteredTeachers.length > 0) {
                    e.preventDefault();
                    handleSelect(filteredTeachers[0].id);
                  }
                }}
                placeholder="Tìm theo họ và tên giáo viên..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 px-1">
              <span>
                {filteredTeachers.length} / {eligibleTeachers.length} giáo viên
              </span>
              {searchQuery && (
                <span className="text-blue-600 font-medium">Nhấn Enter để chọn mục đầu</span>
              )}
            </div>
          </div>

          {/* Teacher Options List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-100">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition flex items-center justify-between cursor-pointer ${
                  !value
                    ? 'bg-blue-50 text-blue-900 font-bold'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span>{clearLabel}</span>
                {!value && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            )}

            {filteredTeachers.map((t) => {
              const isSelected = t.id === value;
              const extraBadge = getExtraBadge ? getExtraBadge(t) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t.id)}
                  className={`w-full px-2.5 py-2 rounded-lg text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : 'hover:bg-slate-100/80 text-slate-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{highlightName(t.fullName, searchQuery)}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded font-semibold">
                        {t.code}
                      </span>
                      {extraBadge}
                    </div>
                    {showDetails && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                        {t.major && <span>{t.major}</span>}
                        {t.workplace && <span>• {t.workplace}</span>}
                        {t.phone && <span className="hidden sm:inline">• {t.phone}</span>}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {filteredTeachers.length === 0 && (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                Không tìm thấy giáo viên nào với từ khóa "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
