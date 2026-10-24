import React from 'react';
import {
  Briefcase,
  Building2,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Users,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { DepartmentItem, PositionItem } from '../../../types';

export interface PositionTabContentProps {
  loading: boolean;
  searchQuery: string;
  deptFilterForPos: string;
  filteredPositions: PositionItem[];
  positions: PositionItem[];
  departments: DepartmentItem[];

  // Add form props
  isAddingPos: boolean;
  setIsAddingPos: (val: boolean) => void;
  newPosName: string;
  setNewPosName: (val: string) => void;
  newPosDeptId: number | null;
  setNewPosDeptId: (val: number | null) => void;
  newPosLevel: 'EMPLOYEE' | 'MANAGER';
  setNewPosLevel: (val: 'EMPLOYEE' | 'MANAGER') => void;
  savingAddPos: boolean;
  addPosInputRef: React.RefObject<HTMLInputElement | null>;
  handleSaveNewPos: () => void;

  // Edit form props
  editingPosId: number | null;
  setEditingPosId: (id: number | null) => void;
  editPosName: string;
  setEditPosName: (val: string) => void;
  editPosDeptId: number | null;
  setEditPosDeptId: (val: number | null) => void;
  editPosLevel: 'EMPLOYEE' | 'MANAGER';
  setEditPosLevel: (val: 'EMPLOYEE' | 'MANAGER') => void;
  savingEditPos: boolean;
  handleStartEditPos: (pos: PositionItem) => void;
  handleSaveEditPos: (id: number) => void;

  // Delete props
  deleteConfirmPos: PositionItem | null;
  setDeleteConfirmPos: (pos: PositionItem | null) => void;
  deletingPosId: number | null;
  handleExecuteDeletePos: (id: number) => void;
}

export const PositionTabContent: React.FC<PositionTabContentProps> = ({
  loading,
  searchQuery,
  deptFilterForPos,
  filteredPositions,
  positions,
  departments,
  isAddingPos,
  setIsAddingPos,
  newPosName,
  setNewPosName,
  newPosDeptId,
  setNewPosDeptId,
  newPosLevel,
  setNewPosLevel,
  savingAddPos,
  addPosInputRef,
  handleSaveNewPos,
  editingPosId,
  setEditingPosId,
  editPosName,
  setEditPosName,
  editPosDeptId,
  setEditPosDeptId,
  editPosLevel,
  setEditPosLevel,
  savingEditPos,
  handleStartEditPos,
  handleSaveEditPos,
  deleteConfirmPos,
  setDeleteConfirmPos,
  deletingPosId,
  handleExecuteDeletePos,
}) => {
  return (
    <div className="space-y-3">
      {/* Draft Add Form */}
      {isAddingPos && (
        <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-[#18152e] border-2 border-purple-400/80 dark:border-purple-500/70 shadow-md animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-purple-200 dark:border-purple-500/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-600 text-white">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wide">
                Tạo chức vụ mới
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingPos(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Tên chức vụ <span className="text-rose-500">*</span>
              </label>
              <input
                ref={addPosInputRef}
                type="text"
                placeholder="Ví dụ: Kỹ sư AIoT Cấp Cao"
                value={newPosName}
                onChange={(e) => setNewPosName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNewPos();
                  if (e.key === 'Escape') setIsAddingPos(false);
                }}
                className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Phòng ban
              </label>
              <select
                value={newPosDeptId || ''}
                onChange={(e) => setNewPosDeptId(Number(e.target.value))}
                className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.department_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cấp bậc
              </label>
              <select
                value={newPosLevel}
                onChange={(e) =>
                  setNewPosLevel(e.target.value as 'EMPLOYEE' | 'MANAGER')
                }
                className="w-full bg-white dark:bg-[#0f1224] border border-purple-300 dark:border-purple-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
              >
                <option value="EMPLOYEE">Nhân viên</option>
                <option value="MANAGER">Quản lý</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={savingAddPos}
              onClick={() => setIsAddingPos(false)}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-[#181c38] hover:bg-slate-300 dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={savingAddPos}
              onClick={handleSaveNewPos}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {savingAddPos ? (
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
      {loading && positions.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin text-purple-600 dark:text-purple-400" />
          <span className="text-xs">Đang tải danh sách chức vụ từ CSDL...</span>
        </div>
      ) : filteredPositions.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-slate-50 dark:bg-[#0f1224]/40 border border-dashed border-slate-200 dark:border-[#21264b]">
          <Briefcase className="w-9 h-9 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {searchQuery || deptFilterForPos !== 'ALL'
              ? 'Không tìm thấy chức vụ phù hợp'
              : 'Chưa có chức vụ nào'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {searchQuery || deptFilterForPos !== 'ALL'
              ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm'
              : 'Bấm nút "Thêm chức vụ mới" ở trên để khởi tạo'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredPositions.map((pos) => {
            const isEditing = editingPosId === pos.id;
            const isConfirmingDelete = deleteConfirmPos?.id === pos.id;
            const isDeleting = deletingPosId === pos.id;

            if (isEditing) {
              return (
                <div
                  key={pos.id}
                  className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-300 dark:border-amber-500/60 shadow-sm space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <Edit2 className="w-4 h-4" />
                    <span>Chỉnh sửa chức vụ</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Tên chức vụ
                      </label>
                      <input
                        type="text"
                        value={editPosName}
                        onChange={(e) => setEditPosName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEditPos(pos.id);
                          if (e.key === 'Escape') setEditingPosId(null);
                        }}
                        className="w-full bg-white dark:bg-[#0f1224] border border-amber-300 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Phòng ban
                      </label>
                      <select
                        value={editPosDeptId || ''}
                        onChange={(e) => setEditPosDeptId(Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0f1224] border border-amber-300 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Cấp bậc
                      </label>
                      <select
                        value={editPosLevel}
                        onChange={(e) =>
                          setEditPosLevel(e.target.value as 'EMPLOYEE' | 'MANAGER')
                        }
                        className="w-full bg-white dark:bg-[#0f1224] border border-amber-300 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                      >
                        <option value="EMPLOYEE">Nhân viên</option>
                        <option value="MANAGER">Quản lý</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={savingEditPos}
                      onClick={() => setEditingPosId(null)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-[#181c38] hover:bg-slate-300 dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={savingEditPos}
                      onClick={() => handleSaveEditPos(pos.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingEditPos ? (
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

            const isManagerLevel = pos.level === 'MANAGER';

            return (
              <div
                key={pos.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#0f1224]/70 border border-slate-200/90 dark:border-[#21264b] hover:border-purple-300 dark:hover:border-[#2e3566] transition-all group shadow-xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {pos.name}
                        </span>

                        {isManagerLevel ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-500" />
                            Quản lý
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-blue-500" />
                            Nhân viên
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEditPos(pos)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-[#1f244d] transition-all cursor-pointer"
                      title="Sửa chức vụ"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmPos(pos)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                      title="Xóa chức vụ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats footer in card */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-[#1a1f3f] text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      <strong>{pos.employee_count}</strong> nhân sự đang giữ chức vụ này
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
                          Bạn có chắc chắn muốn xóa chức vụ "{pos.name}"?
                        </p>
                        {pos.employee_count > 0 && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-300 mt-0.5">
                            Lưu ý: Có <strong>{pos.employee_count}</strong> nhân sự đang giữ
                            chức vụ này. Hệ thống sẽ tự động gỡ liên kết an toàn trên CSDL.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setDeleteConfirmPos(null)}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-[#181c38] text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleExecuteDeletePos(pos.id)}
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
