/**
 * Global Search Modal (Tìm kiếm toàn cục)
 * Quick Omnibox / Command Palette for Teachers, Classes, and Subjects
 * Supports Vietnamese accent-insensitive search, acronyms, keyboard navigation,
 * and direct one-click navigation to assignments or management views.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Users,
  GraduationCap,
  BookOpen,
  X,
  ArrowRight,
  Sparkles,
  Clock,
  Trash2,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Layers,
  Calendar,
  Eye,
  TableProperties,
  Sliders,
  Award,
  Filter,
} from 'lucide-react';
import {
  Teacher,
  SchoolClass,
  Subject,
  Department,
  TeachingAssignment,
  TeacherCalculationResult,
  CurriculumDistribution,
  AssignmentVersion,
  SemesterId,
} from '../types';
import { matchesQuery, removeVietnameseTones } from '../utils/searchUtils';

export interface GlobalSearchNavTarget {
  tab: 'assignments' | 'teachers' | 'classes-curriculum' | 'reports';
  filterType: 'teacher' | 'class' | 'subject';
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  classCurriculumTab?: 'CLASSES' | 'SUBJECTS' | 'CURRICULUM';
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  departments: Department[];
  calculations: TeacherCalculationResult[];
  assignments: TeachingAssignment[];
  curriculums: CurriculumDistribution[];
  currentVersion?: AssignmentVersion;
  semesterId: SemesterId;
  onNavigate: (target: GlobalSearchNavTarget) => void;
}

type SearchCategory = 'ALL' | 'TEACHERS' | 'CLASSES' | 'SUBJECTS';

interface TeacherSearchResult {
  type: 'TEACHER';
  id: string;
  teacher: Teacher;
  departmentName: string;
  calc?: TeacherCalculationResult;
  assignedClasses: string[];
  assignedSubjects: string[];
  totalAssignedPeriods: number;
}

interface ClassSearchResult {
  type: 'CLASS';
  id: string;
  schoolClass: SchoolClass;
  homeroomTeacherName?: string;
  assignedTeachersCount: number;
  assignedTeachersList: { teacherName: string; subjectName: string; periods: number }[];
  totalAssignedPeriods: number;
  expectedCurriculumPeriods: number;
}

interface SubjectSearchResult {
  type: 'SUBJECT';
  id: string;
  subject: Subject;
  assignedTeachers: { teacher: Teacher; classNames: string[]; periods: number }[];
  totalPeriodsInCurriculum: number;
  classesCount: number;
}

type UnifiedSearchResult = TeacherSearchResult | ClassSearchResult | SubjectSearchResult;

const RECENT_SEARCH_KEY = 'pccm_recent_global_searches';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  teachers,
  classes,
  subjects,
  departments,
  calculations,
  assignments,
  curriculums,
  currentVersion,
  semesterId,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCH_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch {
      setRecentSearches([]);
    }
  }, [isOpen]);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(updated));
    } catch {}
  };

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCH_KEY);
    } catch {}
  };

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Lookup Maps
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const calcMap = useMemo(() => new Map(calculations.map((c) => [c.teacherId, c])), [calculations]);

  // Filter active assignments for current version & semester
  const activeAssignments = useMemo(() => {
    return assignments.filter((a) => !a.isDeleted && (!currentVersion || a.versionId === currentVersion.id));
  }, [assignments, currentVersion]);

  // 1. Process Teachers
  const teacherResults = useMemo<TeacherSearchResult[]>(() => {
    const activeTeachers = teachers.filter((t) => !t.isDeleted);
    return activeTeachers.map((t) => {
      const deptName = deptMap.get(t.departmentId) || 'Chưa xếp tổ';
      const calc = calcMap.get(t.id);
      const teacherAssignments = activeAssignments.filter((a) => a.teacherId === t.id);

      const assignedClassSet = new Set<string>();
      const assignedSubjectSet = new Set<string>();
      let totalPeriods = 0;

      for (const a of teacherAssignments) {
        if (a.classId) {
          const cls = classMap.get(a.classId);
          if (cls) assignedClassSet.add(cls.name);
        }
        if (a.subjectId) {
          const sub = subjectMap.get(a.subjectId);
          if (sub) assignedSubjectSet.add(sub.shortName || sub.name);
        }
        totalPeriods += a.periodsPerWeek || 0;
      }

      return {
        type: 'TEACHER',
        id: t.id,
        teacher: t,
        departmentName: deptName,
        calc,
        assignedClasses: Array.from(assignedClassSet),
        assignedSubjects: Array.from(assignedSubjectSet),
        totalAssignedPeriods: totalPeriods,
      };
    });
  }, [teachers, deptMap, calcMap, activeAssignments, classMap, subjectMap]);

  // 2. Process Classes
  const classResults = useMemo<ClassSearchResult[]>(() => {
    const activeClasses = classes.filter((c) => !c.isDeleted);
    return activeClasses.map((c) => {
      const homeroomTeacher = c.homeroomTeacherId ? teacherMap.get(c.homeroomTeacherId) : null;
      const classAssignments = activeAssignments.filter((a) => a.classId === c.id);

      const teacherListMap = new Map<string, { teacherName: string; subjectName: string; periods: number }>();
      let totalPeriods = 0;

      for (const a of classAssignments) {
        const t = teacherMap.get(a.teacherId);
        const s = a.subjectId ? subjectMap.get(a.subjectId) : null;
        if (t && s) {
          const key = `${t.id}_${s.id}`;
          if (!teacherListMap.has(key)) {
            teacherListMap.set(key, {
              teacherName: t.fullName,
              subjectName: s.shortName || s.name,
              periods: a.periodsPerWeek,
            });
          }
        }
        totalPeriods += a.periodsPerWeek || 0;
      }

      // Expected curriculum periods for grade
      const gradeCurriculums = curriculums.filter(
        (cur) => cur.grade === c.grade && cur.semesterId === semesterId
      );
      const expectedCurriculumPeriods = gradeCurriculums.reduce((sum, item) => sum + (item.periodsPerWeek || 0), 0);

      return {
        type: 'CLASS',
        id: c.id,
        schoolClass: c,
        homeroomTeacherName: homeroomTeacher?.fullName,
        assignedTeachersCount: teacherListMap.size,
        assignedTeachersList: Array.from(teacherListMap.values()),
        totalAssignedPeriods: totalPeriods,
        expectedCurriculumPeriods,
      };
    });
  }, [classes, teacherMap, activeAssignments, subjectMap, curriculums, semesterId]);

  // 3. Process Subjects
  const subjectResults = useMemo<SubjectSearchResult[]>(() => {
    const activeSubjects = subjects.filter((s) => s.active !== false);
    return activeSubjects.map((s) => {
      const subjectAssignments = activeAssignments.filter((a) => a.subjectId === s.id);
      const teacherMapSub = new Map<string, { teacher: Teacher; classNames: Set<string>; periods: number }>();

      for (const a of subjectAssignments) {
        const t = teacherMap.get(a.teacherId);
        if (t) {
          if (!teacherMapSub.has(t.id)) {
            teacherMapSub.set(t.id, {
              teacher: t,
              classNames: new Set(),
              periods: 0,
            });
          }
          const entry = teacherMapSub.get(t.id)!;
          if (a.classId) {
            const cls = classMap.get(a.classId);
            if (cls) entry.classNames.add(cls.name);
          }
          entry.periods += a.periodsPerWeek || 0;
        }
      }

      const assignedTeachers = Array.from(teacherMapSub.values()).map((item) => ({
        teacher: item.teacher,
        classNames: Array.from(item.classNames),
        periods: item.periods,
      }));

      // Calculate total weekly periods across grades in curriculum
      const subCurriculums = curriculums.filter((c) => c.subjectId === s.id && c.semesterId === semesterId);
      const totalPeriodsInCurriculum = subCurriculums.reduce((sum, item) => sum + (item.periodsPerWeek || 0), 0);

      const uniqueClasses = new Set(subjectAssignments.map((a) => a.classId).filter(Boolean));

      return {
        type: 'SUBJECT',
        id: s.id,
        subject: s,
        assignedTeachers,
        totalPeriodsInCurriculum,
        classesCount: uniqueClasses.size,
      };
    });
  }, [subjects, activeAssignments, teacherMap, classMap, curriculums, semesterId]);

  // Filter based on query
  const filteredTeachers = useMemo(() => {
    if (!query.trim()) return teacherResults;
    return teacherResults.filter((item) => {
      const t = item.teacher;
      return (
        matchesQuery(
          query,
          t.fullName,
          t.code,
          t.major,
          item.departmentName,
          ...item.assignedClasses,
          ...item.assignedSubjects
        )
      );
    });
  }, [teacherResults, query]);

  const filteredClasses = useMemo(() => {
    if (!query.trim()) return classResults;
    return classResults.filter((item) => {
      const c = item.schoolClass;
      return (
        matchesQuery(
          query,
          c.name,
          `Khối ${c.grade}`,
          `K${c.grade}`,
          c.branchName,
          c.session === 'MORNING' ? 'Sáng' : 'Chiều',
          item.homeroomTeacherName,
          ...item.assignedTeachersList.map((at) => at.teacherName),
          ...item.assignedTeachersList.map((at) => at.subjectName)
        )
      );
    });
  }, [classResults, query]);

  const filteredSubjects = useMemo(() => {
    if (!query.trim()) return subjectResults;
    return subjectResults.filter((item) => {
      const s = item.subject;
      return (
        matchesQuery(
          query,
          s.name,
          s.code,
          s.shortName,
          s.group,
          ...(s.applicableGrades || []).map((g) => `Khối ${g}`),
          ...item.assignedTeachers.map((at) => at.teacher.fullName)
        )
      );
    });
  }, [subjectResults, query]);

  // Combined Results list based on selected category
  const displayedResults = useMemo<UnifiedSearchResult[]>(() => {
    if (selectedCategory === 'TEACHERS') return filteredTeachers;
    if (selectedCategory === 'CLASSES') return filteredClasses;
    if (selectedCategory === 'SUBJECTS') return filteredSubjects;

    // 'ALL' mode: interleave or group cleanly
    return [...filteredTeachers, ...filteredClasses, ...filteredSubjects];
  }, [selectedCategory, filteredTeachers, filteredClasses, filteredSubjects]);

  // Active selected item for preview
  const activeItem = displayedResults[selectedIndex] || displayedResults[0] || null;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < displayedResults.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, displayedResults.length - 1)));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeItem) {
          executePrimaryAction(activeItem);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, displayedResults, selectedIndex, activeItem]);

  // Scroll active item into view
  useEffect(() => {
    if (listContainerRef.current) {
      const selectedEl = listContainerRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Navigation Handlers
  const handleTeacherAssignClick = (item: TeacherSearchResult) => {
    saveRecentSearch(item.teacher.fullName);
    onNavigate({
      tab: 'assignments',
      filterType: 'teacher',
      teacherId: item.teacher.id,
      teacherName: item.teacher.fullName,
    });
    onClose();
  };

  const handleTeacherProfileClick = (item: TeacherSearchResult) => {
    saveRecentSearch(item.teacher.fullName);
    onNavigate({
      tab: 'teachers',
      filterType: 'teacher',
      teacherId: item.teacher.id,
      teacherName: item.teacher.fullName,
    });
    onClose();
  };

  const handleClassAssignClick = (item: ClassSearchResult) => {
    saveRecentSearch(item.schoolClass.name);
    onNavigate({
      tab: 'assignments',
      filterType: 'class',
      classId: item.schoolClass.id,
      className: item.schoolClass.name,
    });
    onClose();
  };

  const handleClassCurriculumClick = (item: ClassSearchResult) => {
    saveRecentSearch(item.schoolClass.name);
    onNavigate({
      tab: 'classes-curriculum',
      filterType: 'class',
      classId: item.schoolClass.id,
      className: item.schoolClass.name,
      classCurriculumTab: 'CLASSES',
    });
    onClose();
  };

  const handleSubjectAssignClick = (item: SubjectSearchResult) => {
    saveRecentSearch(item.subject.name);
    onNavigate({
      tab: 'assignments',
      filterType: 'subject',
      subjectId: item.subject.id,
      subjectName: item.subject.shortName || item.subject.name,
    });
    onClose();
  };

  const handleSubjectCurriculumClick = (item: SubjectSearchResult) => {
    saveRecentSearch(item.subject.name);
    onNavigate({
      tab: 'classes-curriculum',
      filterType: 'subject',
      subjectId: item.subject.id,
      subjectName: item.subject.name,
      classCurriculumTab: 'SUBJECTS',
    });
    onClose();
  };

  const executePrimaryAction = (item: UnifiedSearchResult) => {
    if (item.type === 'TEACHER') {
      handleTeacherAssignClick(item);
    } else if (item.type === 'CLASS') {
      handleClassAssignClick(item);
    } else if (item.type === 'SUBJECT') {
      handleSubjectAssignClick(item);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 pb-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[86vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70">
          <div className="relative flex items-center">
            <Search className="w-5 h-5 absolute left-3.5 text-blue-900 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              id="global-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nhanh giáo viên, lớp học hoặc môn học (hỗ trợ không dấu, mã viết tắt)..."
              className="w-full pl-11 pr-24 py-3 bg-white text-slate-900 placeholder:text-slate-400 font-medium text-sm sm:text-base rounded-xl border border-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-12 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="absolute right-3 hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-300 rounded shadow-2xs">
                ESC
              </kbd>
            </div>
          </div>

          {/* Category Filter Pills & Result Counters */}
          <div className="flex items-center justify-between mt-3 pt-1 flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>Tất cả</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'ALL' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filteredTeachers.length + filteredClasses.length + filteredSubjects.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategory('TEACHERS')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'TEACHERS'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>Giáo viên</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'TEACHERS' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filteredTeachers.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategory('CLASSES')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'CLASSES'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lớp học</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'CLASSES' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filteredClasses.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedCategory('SUBJECTS')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'SUBJECTS'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>Môn học</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedCategory === 'SUBJECTS' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filteredSubjects.length}
                </span>
              </button>
            </div>

            {/* Semester / Version Indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {semesterId === 'HK1' ? 'Học kỳ I' : 'Học kỳ II'} • {currentVersion?.name || 'Bản chính thức'}
              </span>
            </div>
          </div>
        </div>

        {/* Content Area: Two-Column Split (List on Left, Rich Details Preview on Right) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[360px] max-h-[560px]">
          {/* Left: Search Results or Recent/Suggestions */}
          <div
            ref={listContainerRef}
            className="w-full md:w-7/12 border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto p-2 divide-y divide-slate-100"
          >
            {/* When query is empty and user hasn't typed anything: show Recent & Quick Suggestions */}
            {!query.trim() && (
              <div className="p-3 space-y-4">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Tìm kiếm gần đây
                      </span>
                      <button
                        onClick={clearAllRecentSearches}
                        className="text-[11px] text-slate-400 hover:text-red-600 transition cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.map((term) => (
                        <span
                          key={term}
                          onClick={() => {
                            setQuery(term);
                            inputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 text-xs font-semibold cursor-pointer transition"
                        >
                          <span>{term}</span>
                          <button
                            onClick={(e) => removeRecentSearch(term, e)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                            title="Xóa từ khóa này"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Discovery Shortcuts */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Gợi ý tìm nhanh
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => setQuery('6A')}
                      className="text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition cursor-pointer"
                    >
                      <div className="font-bold text-slate-800">Các lớp Khối 6</div>
                      <div className="text-[11px] text-slate-500">6A1, 6A2, 6A3...</div>
                    </button>
                    <button
                      onClick={() => setQuery('Toán')}
                      className="text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition cursor-pointer"
                    >
                      <div className="font-bold text-slate-800">Môn Toán & GV Toán</div>
                      <div className="text-[11px] text-slate-500">Toán học, số tiết, GV bộ môn</div>
                    </button>
                    <button
                      onClick={() => setQuery('KHTN')}
                      className="text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition cursor-pointer"
                    >
                      <div className="font-bold text-slate-800">Môn KHTN & Tích hợp</div>
                      <div className="text-[11px] text-slate-500">Khoa học tự nhiên</div>
                    </button>
                    <button
                      onClick={() => setQuery('Văn')}
                      className="text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200 transition cursor-pointer"
                    >
                      <div className="font-bold text-slate-800">Môn Ngữ văn</div>
                      <div className="text-[11px] text-slate-500">Tổ Văn - Sử - Địa - GDCD</div>
                    </button>
                  </div>
                </div>

                {/* System Inventory Summary */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-xs text-slate-600 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">Dữ liệu sẵn sàng:</span>{' '}
                    <span>{teachers.filter((t) => !t.isDeleted).length} giáo viên</span> •{' '}
                    <span>{classes.filter((c) => !c.isDeleted).length} lớp học</span> •{' '}
                    <span>{subjects.filter((s) => s.active !== false).length} môn học</span>
                  </div>
                </div>
              </div>
            )}

            {/* Search Results List */}
            {displayedResults.length > 0 ? (
              <div className="space-y-1">
                {displayedResults.map((item, index) => {
                  const isSelected = index === selectedIndex;

                  if (item.type === 'TEACHER') {
                    const t = item.teacher;
                    const calc = item.calc;
                    const statusColor =
                      calc?.status === 'BALANCED'
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : calc?.status === 'SURPLUS'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-red-700 bg-red-50 border-red-200';

                    return (
                      <div
                        key={`teacher_${item.id}`}
                        data-index={index}
                        onClick={() => executePrimaryAction(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-50/90 border-2 border-blue-600 shadow-2xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-900 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {t.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{t.fullName}</span>
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {t.code}
                              </span>
                              <span className="text-[11px] text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                {item.departmentName}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 mt-1 truncate">
                              {item.assignedSubjects.length > 0 ? (
                                <span>
                                  Dạy: <strong className="text-slate-700">{item.assignedSubjects.join(', ')}</strong>{' '}
                                  {item.assignedClasses.length > 0 && (
                                    <span>({item.assignedClasses.join(', ')})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Chưa phân công lớp</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Workload Pill */}
                        <div className="text-right shrink-0">
                          {calc ? (
                            <span
                              className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}
                            >
                              {calc.totalAssignedPeriods}/{calc.standardQuota} tiết
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">--</span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {t.workplace || 'Toàn trường'}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'CLASS') {
                    const c = item.schoolClass;
                    return (
                      <div
                        key={`class_${item.id}`}
                        data-index={index}
                        onClick={() => executePrimaryAction(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-50/90 border-2 border-emerald-600 shadow-2xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {c.name}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">Lớp {c.name}</span>
                              <span className="text-[11px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded font-bold">
                                Khối {c.grade}
                              </span>
                              <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                {c.branchName || 'Điểm chính'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 mt-1">
                              GVCN:{' '}
                              <strong className="text-slate-700">
                                {item.homeroomTeacherName || 'Chưa phân công'}
                              </strong>{' '}
                              • {c.session === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {item.totalAssignedPeriods} tiết/tuần
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.assignedTeachersCount} GV bộ môn
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'SUBJECT') {
                    const s = item.subject;
                    return (
                      <div
                        key={`subject_${item.id}`}
                        data-index={index}
                        onClick={() => executePrimaryAction(item)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-50/90 border-2 border-amber-600 shadow-2xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs"
                            style={{ backgroundColor: s.color || '#ca8a04' }}
                          >
                            {s.shortName?.substring(0, 3) || s.code.substring(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {s.code}
                              </span>
                              <span className="text-[11px] text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded font-medium">
                                {s.group || 'Chung'}
                              </span>
                            </div>

                            <div className="text-xs text-slate-500 mt-1">
                              Áp dụng: Khối {(s.applicableGrades || [6, 7, 8, 9]).join(', ')} •{' '}
                              <strong className="text-slate-700">{item.assignedTeachers.length} GV</strong> phụ trách
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {item.classesCount} lớp học
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.totalPeriodsInCurriculum} tiết khung
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ) : query.trim() ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Không tìm thấy kết quả</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Không tìm thấy giáo viên, lớp học hoặc môn học nào phù hợp với từ khóa "
                  <strong className="text-slate-700">{query}</strong>".
                </p>
                <div className="text-[11px] text-slate-400 mt-3">
                  Mẹo: Bạn có thể gõ tiếng Việt không dấu, tìm theo mã GV, hoặc chuyển sang tab "Tất cả".
                </div>
              </div>
            ) : null}
          </div>

          {/* Right: Rich Details & Instant Action Preview */}
          <div className="w-full md:w-5/12 bg-slate-50/50 p-4 flex flex-col justify-between overflow-y-auto">
            {activeItem ? (
              <div className="space-y-4">
                {/* TEACHER PREVIEW */}
                {activeItem.type === 'TEACHER' && (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-900 text-white font-black text-base flex items-center justify-center shadow-xs">
                          {activeItem.teacher.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-base text-slate-900 leading-tight">
                            {activeItem.teacher.fullName}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-blue-900">{activeItem.teacher.code}</span>
                            <span>•</span>
                            <span>{activeItem.departmentName}</span>
                          </div>
                        </div>
                      </div>

                      {/* Workload Stats */}
                      {activeItem.calc && (
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                          <div className="bg-slate-50 p-2 rounded-lg">
                            <div className="text-[10px] text-slate-500 font-medium">Thực dạy</div>
                            <div className="text-sm font-bold text-slate-800">
                              {activeItem.calc.teachingPeriods}t
                            </div>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg">
                            <div className="text-[10px] text-slate-500 font-medium">Định mức</div>
                            <div className="text-sm font-bold text-slate-800">
                              {activeItem.calc.standardQuota}t
                            </div>
                          </div>
                          <div
                            className={`p-2 rounded-lg ${
                              activeItem.calc.status === 'BALANCED'
                                ? 'bg-emerald-50 text-emerald-800'
                                : activeItem.calc.status === 'SURPLUS'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-red-50 text-red-800'
                            }`}
                          >
                            <div className="text-[10px] font-medium">Tình trạng</div>
                            <div className="text-sm font-bold">
                              {activeItem.calc.status === 'BALANCED'
                                ? 'Đủ tiết'
                                : activeItem.calc.status === 'SURPLUS'
                                ? `+${activeItem.calc.difference}t`
                                : `${activeItem.calc.difference}t`}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Assigned Classes List */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Phân công giảng dạy học kỳ</span>
                        <span className="text-[10px] text-slate-500">
                          {activeItem.assignedClasses.length} lớp
                        </span>
                      </div>
                      {activeItem.assignedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {activeItem.assignedClasses.map((cls) => (
                            <span
                              key={cls}
                              className="px-2 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-xs font-bold"
                            >
                              Lớp {cls}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Chưa có phân công giảng dạy.</div>
                      )}

                      {/* Contact Info */}
                      <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Nơi làm việc: <strong>{activeItem.teacher.workplace || 'Toàn trường'}</strong></span>
                        </div>
                        {activeItem.teacher.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{activeItem.teacher.phone}</span>
                          </div>
                        )}
                        {activeItem.teacher.email && (
                          <div className="flex items-center gap-2 truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{activeItem.teacher.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Teacher Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleTeacherAssignClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <TableProperties className="w-4 h-4" />
                        <span>Xem bảng phân công giáo viên này</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleTeacherProfileClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-slate-500" />
                        <span>Xem hồ sơ & Định mức tiết</span>
                      </button>
                    </div>
                  </>
                )}

                {/* CLASS PREVIEW */}
                {activeItem.type === 'CLASS' && (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white font-black text-base flex items-center justify-center shadow-xs">
                          {activeItem.schoolClass.name}
                        </div>
                        <div>
                          <div className="font-bold text-base text-slate-900 leading-tight">
                            Lớp {activeItem.schoolClass.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-emerald-700">Khối {activeItem.schoolClass.grade}</span>
                            <span>•</span>
                            <span>{activeItem.schoolClass.branchName || 'Điểm chính'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-500 font-medium">GVCN</div>
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {activeItem.homeroomTeacherName || 'Chưa có'}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-500 font-medium">Buổi học</div>
                          <div className="text-xs font-bold text-slate-800">
                            {activeItem.schoolClass.session === 'MORNING' ? 'Buổi sáng' : 'Buổi chiều'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Subject Teachers Preview */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Giáo viên bộ môn ({activeItem.assignedTeachersList.length})</span>
                        <span className="text-[10px] text-slate-500">
                          {activeItem.totalAssignedPeriods} tiết/tuần
                        </span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {activeItem.assignedTeachersList.length > 0 ? (
                          activeItem.assignedTeachersList.map((item, i) => (
                            <div
                              key={i}
                              className="text-xs flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100"
                            >
                              <div>
                                <strong className="text-slate-800">{item.subjectName}</strong>:{' '}
                                <span className="text-slate-600">{item.teacherName}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {item.periods}t
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">Chưa phân công giáo viên bộ môn.</div>
                        )}
                      </div>
                    </div>

                    {/* Class Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleClassAssignClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <TableProperties className="w-4 h-4" />
                        <span>Xem bảng phân công lớp {activeItem.schoolClass.name}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleClassCurriculumClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4 text-emerald-600" />
                        <span>Xem chi tiết lớp & Khung CTGD</span>
                      </button>
                    </div>
                  </>
                )}

                {/* SUBJECT PREVIEW */}
                {activeItem.type === 'SUBJECT' && (
                  <>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl text-white font-black text-base flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: activeItem.subject.color || '#ca8a04' }}
                        >
                          {activeItem.subject.shortName?.substring(0, 3) || activeItem.subject.code.substring(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold text-base text-slate-900 leading-tight">
                            {activeItem.subject.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono font-bold text-slate-700">{activeItem.subject.code}</span>
                            <span>•</span>
                            <span>{activeItem.subject.group || 'Chung'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-500 font-medium">Áp dụng</div>
                          <div className="text-xs font-bold text-slate-800">
                            Khối {(activeItem.subject.applicableGrades || [6, 7, 8, 9]).join(', ')}
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <div className="text-[10px] text-slate-500 font-medium">Số GV dạy</div>
                          <div className="text-xs font-bold text-slate-800">
                            {activeItem.assignedTeachers.length} giáo viên
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Teachers Teaching This Subject */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Giáo viên phụ trách môn ({activeItem.assignedTeachers.length})</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {activeItem.assignedTeachers.length > 0 ? (
                          activeItem.assignedTeachers.map((item, i) => (
                            <div
                              key={i}
                              className="text-xs flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-100"
                            >
                              <div className="truncate pr-2">
                                <span className="font-bold text-slate-800">{item.teacher.fullName}</span>
                                {item.classNames.length > 0 && (
                                  <span className="text-[11px] text-slate-500 block truncate">
                                    Dạy: {item.classNames.join(', ')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                                {item.periods}t
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">Chưa có giáo viên dạy môn này.</div>
                        )}
                      </div>
                    </div>

                    {/* Subject Action Buttons */}
                    <div className="space-y-2 pt-1">
                      <button
                        onClick={() => handleSubjectAssignClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                      >
                        <TableProperties className="w-4 h-4" />
                        <span>Xem phân công môn {activeItem.subject.name}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleSubjectCurriculumClick(activeItem)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-amber-600" />
                        <span>Xem chương trình môn học & Tiết chuẩn</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Search className="w-8 h-8 text-slate-300 mb-2" />
                <div className="text-xs font-medium">Chọn một kết quả để xem trước chi tiết</div>
              </div>
            )}

            {/* Bottom Keyboard Cheatsheet */}
            <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                    ↑
                  </kbd>{' '}
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                    ↓
                  </kbd>{' '}
                  Di chuyển
                </span>
                <span>•</span>
                <span>
                  <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                    ↵
                  </kbd>{' '}
                  Mở
                </span>
              </div>
              <div>
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600">
                  ESC
                </kbd>{' '}
                Đóng
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
