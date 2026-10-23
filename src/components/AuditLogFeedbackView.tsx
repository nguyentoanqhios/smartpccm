/**
 * Phân công chuyên môn thông minh - TRƯỜNG THCS QUỲ HỢP
 * Audit Log History & Teacher Feedback / Appeal View (Section X & XI)
 */

import React, { useState } from 'react';
import {
  History,
  MessageSquare,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Shield,
  Send,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { AuditLog, FeedbackRequest, UserProfile } from '../types';
import { dataStore } from '../repositories/dataStore';

interface AuditLogFeedbackViewProps {
  auditLogs: AuditLog[];
  feedbacks: FeedbackRequest[];
  currentUser: UserProfile;
}

export const AuditLogFeedbackView: React.FC<AuditLogFeedbackViewProps> = ({
  auditLogs,
  feedbacks,
  currentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'AUDIT' | 'FEEDBACK'>('AUDIT');
  const [searchTerm, setSearchTerm] = useState('');

  // Feedback form
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchTerm) return true;
    const text = `${log.userName} ${log.action} ${log.entityDescription} ${log.reason || ''}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackTitle.trim() || !feedbackContent.trim()) return;

    const ctx = dataStore.getSelectedContext();
    dataStore.submitFeedback({
      teacherId: currentUser.teacherId || currentUser.id,
      teacherName: currentUser.name,
      departmentName: currentUser.roleTitle,
      schoolYearId: ctx.schoolYearId,
      semesterId: ctx.semesterId,
      versionId: ctx.versionId,
      title: feedbackTitle,
      content: feedbackContent,
    });

    setFeedbackTitle('');
    setFeedbackContent('');
    alert('Kiến nghị của thầy/cô đã được gửi thành công đến Ban Giám hiệu!');
  };

  const handleReplyFeedback = (feedbackId: string, status: 'ACCEPTED' | 'REJECTED') => {
    const text = replyText[feedbackId] || (status === 'ACCEPTED' ? 'Đã tiếp thu và điều chỉnh.' : 'Giữ nguyên phân công.');
    dataStore.replyFeedback(feedbackId, text, status);
  };

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER & TAB TOGGLE */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-700" />
            Nhật ký điều chỉnh & Ý kiến giáo viên
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi chi tiết lịch sử thay đổi (Ai, Khi nào, Trước, Sau, Lý do) và tiếp nhận ý kiến phản hồi
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('AUDIT')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'AUDIT' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nhật ký thay đổi ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveSubTab('FEEDBACK')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'FEEDBACK' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ý kiến phản hồi ({feedbacks.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'AUDIT' ? (
        /* AUDIT LOGS VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhật ký thay đổi theo người thực hiện, hành động, lý do..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div key={log.id} className="py-3 px-2 hover:bg-slate-50 transition rounded-xl">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        log.action === 'CREATE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-100 text-blue-800'
                          : log.action === 'DELETE'
                          ? 'bg-red-100 text-red-800'
                          : log.action === 'LOCK'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <strong className="text-slate-900">{log.userName}</strong>
                    <span className="text-[11px] text-slate-400 font-normal">({log.userRole})</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-800 mt-1">{log.entityDescription}</div>

                {log.reason && (
                  <div className="text-[11px] text-slate-500 mt-0.5 italic">Lý do: {log.reason}</div>
                )}
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs">Không tìm thấy bản ghi nhật ký nào.</div>
            )}
          </div>
        </div>
      ) : (
        /* TEACHER FEEDBACKS & APPEALS */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submit form (Span 1) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-700" />
              Gửi ý kiến / Đề xuất điều chỉnh
            </h3>
            <p className="text-xs text-slate-500">
              Dành cho Giáo viên & Tổ trưởng gửi phản hồi trực tiếp đến Ban Giám hiệu.
            </p>

            <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tiêu đề kiến nghị *</label>
                <input
                  type="text"
                  placeholder="V/v Đổi buổi dạy / Số tiết kiêm nhiệm..."
                  value={feedbackTitle}
                  onChange={(e) => setFeedbackTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nội dung chi tiết *</label>
                <textarea
                  rows={4}
                  placeholder="Kính gửi Ban Giám hiệu, do điều kiện gia đình / chuyên môn..."
                  value={feedbackContent}
                  onChange={(e) => setFeedbackContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 rounded-xl shadow-xs transition"
              >
                Gửi ý kiến phản hồi
              </button>
            </form>
          </div>

          {/* Feedback list (Span 2) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Danh sách ý kiến & Phản hồi từ BGH ({feedbacks.length})</h3>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{fb.teacherName}</span>
                        <span className="text-slate-500 text-[10px]">({fb.departmentName})</span>
                      </div>
                      <h4 className="font-bold text-blue-950 mt-0.5">{fb.title}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        fb.status === 'ACCEPTED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : fb.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {fb.status === 'ACCEPTED' ? 'ĐÃ TIẾP NHẬN' : fb.status === 'REJECTED' ? 'TỪ CHỐI' : 'CHỜ DUYỆT'}
                    </span>
                  </div>

                  <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    {fb.content}
                  </p>

                  {fb.adminReply && (
                    <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-100 text-blue-900">
                      <strong>Phản hồi từ BGH:</strong> {fb.adminReply}
                    </div>
                  )}

                  {currentUser.role === 'principal' || currentUser.role === 'admin' ? (
                    fb.status === 'PENDING' && (
                      <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Ý kiến trả lời của BGH..."
                          value={replyText[fb.id] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [fb.id]: e.target.value })}
                          className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs"
                        />
                        <button
                          onClick={() => handleReplyFeedback(fb.id, 'ACCEPTED')}
                          className="bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-emerald-800"
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleReplyFeedback(fb.id, 'REJECTED')}
                          className="bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs hover:bg-red-800"
                        >
                          Từ chối
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              ))}

              {feedbacks.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">Chưa có ý kiến phản hồi nào.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
