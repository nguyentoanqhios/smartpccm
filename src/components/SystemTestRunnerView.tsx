/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Section XV Mandatory System Test Execution & Verification Suite
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Award,
  Terminal,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { runAllSystemTests, TestCaseResult } from '../tests/systemTests';

export const SystemTestRunnerView: React.FC = () => {
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);

  const executeTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const results = runAllSystemTests();
      setTestResults(results);
      setIsRunning(false);
      setLastExecuted(new Date().toLocaleTimeString('vi-VN'));
    }, 300);
  };

  useEffect(() => {
    executeTests();
  }, []);

  const totalTests = testResults.length;
  const passedTests = testResults.filter((t) => t.passed).length;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER & TEST RUNNER CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-700" />
              Bộ kiểm thử tự động Section XV (10 Test Cases)
            </h2>
            {passRate === 100 ? (
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Đạt 10/10 Test (100%)
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {passedTests}/{totalTests} Test Passed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Xác minh toàn bộ 10 kịch bản nghiệp vụ bắt buộc theo quy định phân công chuyên môn
          </p>
        </div>

        <button
          id="btn-run-system-tests"
          onClick={executeTests}
          disabled={isRunning}
          className="bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {isRunning ? 'Đang thực thi...' : 'Chạy lại 10 Test Cases'}
        </button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Tổng số Test Cases</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{totalTests}</div>
          <div className="text-[11px] text-slate-400">Section XV Requirements</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Số Test Thành công</div>
          <div className="text-3xl font-black text-emerald-700 mt-1">{passedTests}</div>
          <div className="text-[11px] text-emerald-600 font-semibold">Tỷ lệ thành công: {passRate}%</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">Lần chạy gần nhất</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{lastExecuted || 'Chưa chạy'}</div>
          <div className="text-[11px] text-slate-400">Kiểm tra tự động Client-side Engine</div>
        </div>
      </div>

      {/* TEST CASES ACCORDION / LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Chi tiết kết quả từng kịch bản kiểm thử</h3>
        </div>

        <div className="divide-y divide-slate-100">
          {testResults.map((t) => (
            <div key={t.id} className="p-4 hover:bg-slate-50/60 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {t.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        TC #{t.id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{t.description}</p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    t.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {t.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>

              {/* Expected vs Actual Box */}
              <div className="mt-3 bg-slate-50 p-2.5 rounded-xl text-xs grid grid-cols-1 md:grid-cols-2 gap-2 border border-slate-100">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Kết quả kỳ vọng:</span>
                  <span className="font-semibold text-slate-800">{t.expectedResult}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Kết quả thực tế:</span>
                  <span className={`font-bold ${t.passed ? 'text-emerald-800' : 'text-red-700'}`}>
                    {t.actualResult}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
