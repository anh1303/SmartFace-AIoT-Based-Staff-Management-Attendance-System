import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Loader2,
  Users,
  AlertCircle
} from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  PositionItem,
  fetchPositionsApi,
  createPositionApi,
  updatePositionApi,
  deletePositionApi
} from '../../api/positionApi';
import { useToast } from '../../context/ToastContext';

interface PositionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPositionsChanged?: () => void;
}

export const PositionManagementModal: React.FC<PositionManagementModalProps> = ({
  isOpen,
  onClose,
  onPositionsChanged,
}) => {
  const { showToast } = useToast();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Adding draft row state
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newPositionName, setNewPositionName] = useState<string>('');
  const [savingAdd, setSavingAdd] = useState<boolean>(false);

  // Editing row state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const addInputRef = useRef<HTMLInputElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const loadPositions = async () => {
    setLoading(true);
    try {
      const data = await fetchPositionsApi();
      setPositions(data);
    } catch (err: any) {
      showToast('Không thể tải danh sách chức vụ từ máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPositions();
      setIsAdding(false);
      setNewPositionName('');
      setEditingId(null);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isAdding) {
      setTimeout(() => {
        addInputRef.current?.focus();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [isAdding]);

  useEffect(() => {
    if (editingId !== null) {
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 50);
    }
  }, [editingId]);

  // Handle Save New Position
  const handleSaveNew = async () => {
    if (!newPositionName.trim()) {
      showToast('Vui lòng nhập tên chức vụ', 'warning');
      return;
    }

    setSavingAdd(true);
    try {
      await createPositionApi(newPositionName.trim());
      showToast(`Đã thêm chức vụ "${newPositionName.trim()}" thành công`, 'success');
      setIsAdding(false);
      setNewPositionName('');
      await loadPositions();
      onPositionsChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo chức vụ mới', 'error');
    } finally {
      setSavingAdd(false);
    }
  };

  // Handle Start Edit
  const handleStartEdit = (pos: PositionItem) => {
    setIsAdding(false);
    setDeleteConfirmId(null);
    setEditingId(pos.id);
    setEditingName(pos.name);
  };

  // Handle Save Edit
  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) {
      showToast('Tên chức vụ không được để trống', 'warning');
      return;
    }

    setSavingEdit(true);
    try {
      await updatePositionApi(id, editingName.trim());
      showToast(`Đã cập nhật chức vụ thành "${editingName.trim()}"`, 'success');
      setEditingId(null);
      setEditingName('');
      await loadPositions();
      onPositionsChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật chức vụ', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Confirm Delete
  const handleExecuteDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deletePositionApi(id);
      showToast('Đã xóa chức vụ khỏi cơ sở dữ liệu', 'success');
      setDeleteConfirmId(null);
      await loadPositions();
      onPositionsChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa chức vụ', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quản Lý Danh Sách Chức Vụ"
      subtitle="Quản lý và đồng bộ danh mục chức vụ công tác trực tiếp trên cơ sở dữ liệu PostgreSQL"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Header Action: Add Position Button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Tổng số chức vụ:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-cyan-400 font-mono text-xs font-bold">
              {positions.length}
            </span>
          </div>

          {!isAdding && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDeleteConfirmId(null);
                setIsAdding(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm chức vụ</span>
            </button>
          )}
        </div>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        >
          {/* Draft Row for Adding New Position */}
          {isAdding && (
            <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg shadow-blue-950/50 animate-in fade-in duration-200">
              <div className="flex-1 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  ref={addInputRef}
                  type="text"
                  placeholder="Nhập tên chức vụ mới (Ví dụ: Kỹ thuật viên, Trưởng ca...)"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNew();
                    if (e.key === 'Escape') setIsAdding(false);
                  }}
                  className="w-full bg-slate-950 border border-blue-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={savingAdd}
                  onClick={handleSaveNew}
                  className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingAdd ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu</span>
                </button>
                <button
                  type="button"
                  disabled={savingAdd}
                  onClick={() => {
                    setIsAdding(false);
                    setNewPositionName('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
              </div>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && positions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Đang tải danh sách chức vụ từ máy chủ...</span>
            </div>
          ) : positions.length === 0 && !isAdding ? (
            <div className="py-10 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
              <Briefcase className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-300">Chưa có chức vụ nào</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Bấm nút "Thêm chức vụ" ở trên để tạo chức vụ đầu tiên
              </p>
            </div>
          ) : (
            positions.map((pos) => {
              const isEditingThis = editingId === pos.id;
              const isConfirmingDelete = deleteConfirmId === pos.id;
              const isDeletingThis = deletingId === pos.id;

              if (isEditingThis) {
                return (
                  <div
                    key={pos.id}
                    className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-150"
                  >
                    <div className="flex-1 flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                        <Edit className="w-4 h-4" />
                      </div>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(pos.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-slate-950 border border-amber-500/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(pos.id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        {savingEdit ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Lưu</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Hủy</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={pos.id}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 group-hover:border-cyan-500/30 transition-colors">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-white">
                          {pos.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {pos.department_code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>{pos.employee_count} nhân sự đang giữ chức vụ này</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-500/40 px-3 py-1 rounded-xl">
                        <span className="text-[11px] text-rose-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" /> Xóa chức vụ này?
                        </span>
                        <button
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => handleExecuteDelete(pos.id)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          {isDeletingThis ? 'Đang xóa...' : 'Đồng ý'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(pos)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-400" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdding(false);
                            setEditingId(null);
                            setDeleteConfirmId(pos.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/30 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
