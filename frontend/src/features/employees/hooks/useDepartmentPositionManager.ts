import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DepartmentItem,
  fetchDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi,
} from '../../../api/departmentApi';
import {
  PositionItem,
  fetchPositionsApi,
  createPositionApi,
  updatePositionApi,
  deletePositionApi,
} from '../../../api/positionApi';
import { useToast } from '../../../context/ToastContext';

export interface UseDepartmentPositionManagerProps {
  isOpen: boolean;
  onChanged?: () => void;
  initialTab?: 'departments' | 'positions';
}

export function useDepartmentPositionManager({
  isOpen,
  onChanged,
  initialTab = 'departments',
}: UseDepartmentPositionManagerProps) {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'departments' | 'positions'>(initialTab);
  const [loading, setLoading] = useState(false);

  // Data lists from DB
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [positions, setPositions] = useState<PositionItem[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilterForPos, setDeptFilterForPos] = useState<string>('ALL');

  // --- Department Form States ---
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [savingAddDept, setSavingAddDept] = useState(false);

  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');
  const [savingEditDept, setSavingEditDept] = useState(false);

  const [deleteConfirmDept, setDeleteConfirmDept] = useState<DepartmentItem | null>(null);
  const [deletingDeptId, setDeletingDeptId] = useState<number | null>(null);

  // --- Position Form States ---
  const [isAddingPos, setIsAddingPos] = useState(false);
  const [newPosName, setNewPosName] = useState('');
  const [newPosDeptId, setNewPosDeptId] = useState<number | null>(null);
  const [newPosLevel, setNewPosLevel] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');
  const [savingAddPos, setSavingAddPos] = useState(false);

  const [editingPosId, setEditingPosId] = useState<number | null>(null);
  const [editPosName, setEditPosName] = useState('');
  const [editPosDeptId, setEditPosDeptId] = useState<number | null>(null);
  const [editPosLevel, setEditPosLevel] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');
  const [savingEditPos, setSavingEditPos] = useState(false);

  const [deleteConfirmPos, setDeleteConfirmPos] = useState<PositionItem | null>(null);
  const [deletingPosId, setDeletingPosId] = useState<number | null>(null);

  const addDeptInputRef = useRef<HTMLInputElement | null>(null);
  const addPosInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch all data from DB
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptData, posData] = await Promise.all([
        fetchDepartmentsApi(),
        fetchPositionsApi(),
      ]);
      setDepartments(deptData);
      setPositions(posData);
    } catch {
      showToast('Không thể tải dữ liệu phòng ban & chức vụ từ máy chủ', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setIsAddingDept(false);
      setIsAddingPos(false);
      setEditingDeptId(null);
      setEditingPosId(null);
      setDeleteConfirmDept(null);
      setDeleteConfirmPos(null);
      setSearchQuery('');
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (isAddingDept) {
      setTimeout(() => addDeptInputRef.current?.focus(), 50);
    }
  }, [isAddingDept]);

  useEffect(() => {
    if (isAddingPos) {
      setTimeout(() => addPosInputRef.current?.focus(), 50);
    }
  }, [isAddingPos]);

  useEffect(() => {
    if (isAddingPos && departments.length > 0 && newPosDeptId === null) {
      setNewPosDeptId(departments[0].id);
    }
  }, [isAddingPos, departments, newPosDeptId]);

  // ==================== DEPARTMENT HANDLERS ====================
  const handleSaveNewDept = async () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên phòng ban', 'warning');
      return;
    }

    setSavingAddDept(true);
    try {
      const created = await createDepartmentApi({
        name: trimmed,
        department_code: newDeptCode.trim() || undefined,
        description: newDeptDesc.trim() || undefined,
      });
      showToast(`Đã thêm phòng ban "${created.name}" thành công vào CSDL`, 'success');
      setIsAddingDept(false);
      setNewDeptName('');
      setNewDeptCode('');
      setNewDeptDesc('');
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo phòng ban mới', 'error');
    } finally {
      setSavingAddDept(false);
    }
  };

  const handleStartEditDept = (dept: DepartmentItem) => {
    setIsAddingDept(false);
    setDeleteConfirmDept(null);
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptDesc(dept.description || '');
  };

  const handleSaveEditDept = async (id: number) => {
    const trimmed = editDeptName.trim();
    if (!trimmed) {
      showToast('Tên phòng ban không được để trống', 'warning');
      return;
    }

    setSavingEditDept(true);
    try {
      const updated = await updateDepartmentApi(id, {
        name: trimmed,
        description: editDeptDesc.trim() || undefined,
      });
      showToast(`Đã cập nhật phòng ban "${updated.name}" trên CSDL`, 'success');
      setEditingDeptId(null);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật phòng ban', 'error');
    } finally {
      setSavingEditDept(false);
    }
  };

  const handleExecuteDeleteDept = async (id: number) => {
    setDeletingDeptId(id);
    try {
      await deleteDepartmentApi(id);
      showToast('Đã xóa phòng ban khỏi cơ sở dữ liệu', 'success');
      setDeleteConfirmDept(null);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa phòng ban', 'error');
    } finally {
      setDeletingDeptId(null);
    }
  };

  // ==================== POSITION HANDLERS ====================
  const handleSaveNewPos = async () => {
    const trimmed = newPosName.trim();
    if (!trimmed) {
      showToast('Vui lòng nhập tên chức vụ', 'warning');
      return;
    }

    setSavingAddPos(true);
    try {
      const created = await createPositionApi({
        name: trimmed,
        department_id: newPosDeptId || (departments[0]?.id ?? undefined),
        level: newPosLevel,
      });
      showToast(`Đã thêm chức vụ "${created.name}" thành công vào CSDL`, 'success');
      setIsAddingPos(false);
      setNewPosName('');
      setNewPosLevel('EMPLOYEE');
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tạo chức vụ mới', 'error');
    } finally {
      setSavingAddPos(false);
    }
  };

  const handleStartEditPos = (pos: PositionItem) => {
    setIsAddingPos(false);
    setDeleteConfirmPos(null);
    setEditingPosId(pos.id);
    setEditPosName(pos.name);
    setEditPosDeptId(pos.department_id || null);
    setEditPosLevel(pos.level || 'EMPLOYEE');
  };

  const handleSaveEditPos = async (id: number) => {
    const trimmed = editPosName.trim();
    if (!trimmed) {
      showToast('Tên chức vụ không được để trống', 'warning');
      return;
    }

    setSavingEditPos(true);
    try {
      const updated = await updatePositionApi(id, {
        name: trimmed,
        department_id: editPosDeptId || undefined,
        level: editPosLevel,
      });
      showToast(`Đã cập nhật chức vụ "${updated.name}" trên CSDL`, 'success');
      setEditingPosId(null);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật chức vụ', 'error');
    } finally {
      setSavingEditPos(false);
    }
  };

  const handleExecuteDeletePos = async (id: number) => {
    setDeletingPosId(id);
    try {
      await deletePositionApi(id);
      showToast('Đã xóa chức vụ khỏi cơ sở dữ liệu', 'success');
      setDeleteConfirmPos(null);
      await loadData();
      onChanged?.();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa chức vụ', 'error');
    } finally {
      setDeletingPosId(null);
    }
  };

  // Filtered lists for display
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const query = searchQuery.toLowerCase().trim();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        d.department_code.toLowerCase().includes(query) ||
        (d.description && d.description.toLowerCase().includes(query))
    );
  }, [departments, searchQuery]);

  const filteredPositions = useMemo(() => {
    let result = positions;
    if (deptFilterForPos !== 'ALL') {
      result = result.filter(
        (p) =>
          (p.department_name && p.department_name.toLowerCase() === deptFilterForPos.toLowerCase()) ||
          (p.department_code && p.department_code.toLowerCase() === deptFilterForPos.toLowerCase())
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.position_code?.toLowerCase().includes(query) ||
          (p.department_name && p.department_name.toLowerCase().includes(query))
      );
    }
    return result;
  }, [positions, searchQuery, deptFilterForPos]);

  return {
    activeTab,
    setActiveTab,
    loading,
    departments,
    positions,
    searchQuery,
    setSearchQuery,
    deptFilterForPos,
    setDeptFilterForPos,

    // Department states & actions
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
    editingDeptId,
    setEditingDeptId,
    editDeptName,
    setEditDeptName,
    editDeptDesc,
    setEditDeptDesc,
    savingEditDept,
    deleteConfirmDept,
    setDeleteConfirmDept,
    deletingDeptId,
    filteredDepartments,
    handleSaveNewDept,
    handleStartEditDept,
    handleSaveEditDept,
    handleExecuteDeleteDept,

    // Position states & actions
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
    editingPosId,
    setEditingPosId,
    editPosName,
    setEditPosName,
    editPosDeptId,
    setEditPosDeptId,
    editPosLevel,
    setEditPosLevel,
    savingEditPos,
    deleteConfirmPos,
    setDeleteConfirmPos,
    deletingPosId,
    filteredPositions,
    handleSaveNewPos,
    handleStartEditPos,
    handleSaveEditPos,
    handleExecuteDeletePos,
  };
}
