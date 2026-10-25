import React from 'react';
import {
  Building2,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Users,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { DepartmentItem } from '../../../types';

export interface DepartmentTabContentProps {
  loading: boolean;
  searchQuery: string;
  filteredDepartments: DepartmentItem[];
  departments: DepartmentItem[];

  // Add form props
  isAddingDept: boolean;
  setIsAddingDept: (val: boolean) => void;
  newDeptName: string;
  setNewDeptName: (val: string) => void;
  newDeptCode: string;
  setNewDeptCode: (val: string) => void;
  newDeptDesc: string;
  setNewDeptDesc: (val: string) => void;
  savingAddDept: boolean;
  addDeptInputRef: React.RefObject<HTMLInputElement | null>;
  handleSaveNewDept: () => void;

  // Edit form props
  editingDeptId: number | null;
  setEditingDeptId: (id: number | null) => void;
  editDeptName: string;
  setEditDeptName: (val: string) => void;
  editDeptDesc: string;
  setEditDeptDesc: (val: string) => void;
  savingEditDept: boolean;
  handleStartEditDept: (dept: DepartmentItem) => void;
  handleSaveEditDept: (id: number) => void;

  // Delete props
  deleteConfirmDept: DepartmentItem | null;
  setDeleteConfirmDept: (dept: DepartmentItem | null) => void;
  deletingDeptId: number | null;
  handleExecuteDeleteDept: (id: number) => void;
}

export const DepartmentTabContent: React.FC<DepartmentTabContentProps> = ({
  loading,
  searchQuery,
  filteredDepartments,
  departments,
  isAddingDept,
  setIsAddingDept,
  newDeptName,
  setNewDeptName,
  newDeptCode,
  setNewDeptCode,
  newDeptDesc,
  setNewDeptDesc,
  savingAddDept,
  addDeptInputRef,
  handleSaveNewDept,
  editingDeptId,
  setEditingDeptId,
  editDeptName,
  setEditDeptName,
  editDeptDesc,
  setEditDeptDesc,
  savingEditDept,
  handleStartEditDept,
  handleSaveEditDept,
  deleteConfirmDept,
  setDeleteConfirmDept,
  deletingDeptId,
  handleExecuteDeleteDept,
}) => {
  return (
    <div className="space-y-3">
      {/* Draft Add Form */}
      {isAddingDept && (
        <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-[#18152e] border-2 border-purple-400/80 dark:border-purple-500/70 shadow-md animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200 dark:border-purple-500/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-600 text-white">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wide">
                Tạo phòng ban mới trên Database
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingDept(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Tên phòng ban <span className="text-rose-500">*</span>
              </label>
              <input
                ref={addDeptInputRef}
                type="text"
                placeholder="Ví dụ: Nghiên cứu & Phát triển (R&D)"
                value={newDeptName}
                onChange={(e) => {
                  setNewDeptName(e.target.value);
                  if (!newDeptCode) {
                    const autoCode = e.target.value
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-zA-Z0-9]/g, '_')
                      .toUpperCase();
                    setNewDeptCode(autoCode ? `DEPT_${autoCode}` : '');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNewDept();
                  if (e.key === 'Escape') setIsAddingDept(false);
                }}
                className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Mã phòng ban (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Tự động sinh nếu để trống (Ví dụ: DEPT_RND)"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value)}
                className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Mô tả chức năng nhiệm vụ (Tùy chọn)
            </label>
            <input
              type="text"
              placeholder="Mô tả ngắn gọn về phạm vi công việc của phòng ban..."
              value={newDeptDesc}
              onChange={(e) => setNewDeptDesc(e.target.value)}
              className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={savingAddDept}
              onClick={() => setIsAddingDept(false)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-[#181c38] hover:bg-slate-300 dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={savingAddDept}
              onClick={handleSaveNewDept}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {savingAddDept ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Lưu vào CSDL</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && departments.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-purple-600 dark:text-purple-400" />
          <span className="text-xs">Đang tải danh sách phòng ban từ CSDL...</span>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-slate-50 dark:bg-[#0f1224]/40 border border-dashed border-slate-200 dark:border-[#21264b]">
          <Building2 className="w-9 h-9 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {searchQuery ? 'Không tìm thấy phòng ban phù hợp' : 'Chưa có phòng ban nào'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm'
              : 'Bấm nút "Thêm phòng ban mới" ở trên để khởi tạo'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredDepartments.map((dept) => {
            const isEditing = editingDeptId === dept.id;
            const isConfirmingDelete = deleteConfirmDept?.id === dept.id;
            const isDeleting = deletingDeptId === dept.id;

            if (isEditing) {
              return (
                <div
                  key={dept.id}
                  className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-500/60 shadow-sm space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Edit2 className="w-4 h-4" />
                    <span>Chỉnh sửa phòng ban</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Tên phòng ban
                      </label>
                      <input
                        type="text"
                        value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditDept(dept.id);
                          if (e.key === 'Escape') setEditingDeptId(null);
                        }}
                        className="w-full bg-white dark:bg-[#0f1224] border border-amber-300 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Mô tả
                      </label>
                      <input
                        type="text"
                        value={editDeptDesc}
                        onChange={(e) => setEditDeptDesc(e.target.value)}
                        className="w-full bg-white dark:bg-[#0f1224] border border-amber-300 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={savingEditDept}
                      onClick={() => setEditingDeptId(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#181c38] hover:bg-slate-300 dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={savingEditDept}
                      onClick={() => handleSaveEditDept(dept.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingEditDept ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Lưu thay đổi</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={dept.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#0f1224]/70 border border-slate-200/90 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-[#2e3566] transition-all group shadow-xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/40 text-purple-600 dark:text-purple-400 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {dept.name}
                        </span>
                      </div>

                      {dept.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {dept.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditDept(dept)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-[#1f244d] transition-all cursor-pointer"
                      title="Sửa phòng ban"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmDept(dept)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                      title="Xóa phòng ban"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats footer in card */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-[#1a1f3f] text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-500" />
                    <span>
                      <strong>{dept.employee_count}</strong> nhân sự
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      <strong>{dept.position_count ?? 0}</strong> chức vụ trực thuộc
                    </span>
                  </div>
                </div>

                {/* Inline Delete Confirmation Alert */}
                {isConfirmingDelete && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 animate-in fade-in duration-150 space-y-2 mt-2">
                    <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">
                          Bạn có chắc chắn muốn xóa phòng ban "{dept.name}"?
                        </p>
                        {dept.employee_count > 0 && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">
                            Lưu ý: Có <strong>{dept.employee_count}</strong> nhân sự đang thuộc
                            phòng ban này. Hệ thống sẽ tự động gỡ liên kết phòng ban an toàn trên CSDL.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setDeleteConfirmDept(null)}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-[#181c38] text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleExecuteDeleteDept(dept.id)}
                        className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Xác nhận xóa</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
