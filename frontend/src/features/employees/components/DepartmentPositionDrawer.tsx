import React from 'react';
import {
  Settings,
  Building2,
  Briefcase,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Drawer } from '../../../components/common/Drawer';
import { useDepartmentPositionManager } from '../hooks/useDepartmentPositionManager';
import { DepartmentTabContent } from './DepartmentTabContent';
import { PositionTabContent } from './PositionTabContent';

export interface DepartmentPositionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  initialTab?: 'departments' | 'positions';
}

export const DepartmentPositionDrawer: React.FC<DepartmentPositionDrawerProps> = ({
  isOpen,
  onClose,
  onChanged,
  initialTab = 'departments',
}) => {
  const manager = useDepartmentPositionManager({
    isOpen,
    onChanged,
    initialTab,
  });

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/25">
            <Settings className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
          </div>
          <span className="font-bold">Quản Lý Phòng Ban & Chức Vụ</span>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Tab Switcher & Quick Action Add Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100/80 dark:bg-[#0f1224]/80 p-1.5 rounded-2xl border border-slate-200/80 dark:border-[#21264b]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                manager.setActiveTab('departments');
                manager.setIsAddingPos(false);
                manager.setEditingPosId(null);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                manager.activeTab === 'departments'
                  ? 'bg-white dark:bg-[#1b1f3d] text-blue-600 dark:text-blue-300 shadow-sm border border-slate-200/80 dark:border-[#2e3566]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Phòng Ban</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  manager.activeTab === 'departments'
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-[#181c38] text-slate-600 dark:text-slate-400'
                }`}
              >
                {manager.departments.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                manager.setActiveTab('positions');
                manager.setIsAddingDept(false);
                manager.setEditingDeptId(null);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                manager.activeTab === 'positions'
                  ? 'bg-white dark:bg-[#1b1f3d] text-blue-600 dark:text-blue-300 shadow-sm border border-slate-200/80 dark:border-[#2e3566]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Chức Vụ</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  manager.activeTab === 'positions'
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                    : 'bg-slate-200 dark:bg-[#181c38] text-slate-600 dark:text-slate-400'
                }`}
              >
                {manager.positions.length}
              </span>
            </button>
          </div>

          {/* Quick Action Add Button */}
          <div>
            {manager.activeTab === 'departments' && !manager.isAddingDept && (
              <button
                type="button"
                onClick={() => {
                  manager.setEditingDeptId(null);
                  manager.setDeleteConfirmDept(null);
                  manager.setIsAddingDept(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm phòng ban mới</span>
              </button>
            )}

            {manager.activeTab === 'positions' && !manager.isAddingPos && (
              <button
                type="button"
                onClick={() => {
                  manager.setEditingPosId(null);
                  manager.setDeleteConfirmPos(null);
                  manager.setIsAddingPos(true);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm chức vụ mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                manager.activeTab === 'departments'
                  ? 'Tìm kiếm phòng ban theo tên, mã...'
                  : 'Tìm kiếm chức vụ theo tên, phòng ban...'
              }
              value={manager.searchQuery}
              onChange={(e) => manager.setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/90 dark:border-[#21264b] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            {manager.searchQuery && (
              <button
                type="button"
                onClick={() => manager.setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {manager.activeTab === 'positions' && manager.departments.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                Phòng ban:
              </span>
              <select
                value={manager.deptFilterForPos}
                onChange={(e) => manager.setDeptFilterForPos(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/90 dark:border-[#21264b] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
              >
                <option value="ALL">Tất cả phòng ban</option>
                {manager.departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab 1 Content: Departments */}
        {manager.activeTab === 'departments' && (
          <DepartmentTabContent
            loading={manager.loading}
            searchQuery={manager.searchQuery}
            filteredDepartments={manager.filteredDepartments}
            departments={manager.departments}
            isAddingDept={manager.isAddingDept}
            setIsAddingDept={manager.setIsAddingDept}
            newDeptName={manager.newDeptName}
            setNewDeptName={manager.setNewDeptName}
            newDeptCode={manager.newDeptCode}
            setNewDeptCode={manager.setNewDeptCode}
            newDeptDesc={manager.newDeptDesc}
            setNewDeptDesc={manager.setNewDeptDesc}
            savingAddDept={manager.savingAddDept}
            addDeptInputRef={manager.addDeptInputRef}
            handleSaveNewDept={manager.handleSaveNewDept}
            editingDeptId={manager.editingDeptId}
            setEditingDeptId={manager.setEditingDeptId}
            editDeptName={manager.editDeptName}
            setEditDeptName={manager.setEditDeptName}
            editDeptDesc={manager.editDeptDesc}
            setEditDeptDesc={manager.setEditDeptDesc}
            savingEditDept={manager.savingEditDept}
            handleStartEditDept={manager.handleStartEditDept}
            handleSaveEditDept={manager.handleSaveEditDept}
            deleteConfirmDept={manager.deleteConfirmDept}
            setDeleteConfirmDept={manager.setDeleteConfirmDept}
            deletingDeptId={manager.deletingDeptId}
            handleExecuteDeleteDept={manager.handleExecuteDeleteDept}
          />
        )}

        {/* Tab 2 Content: Positions */}
        {manager.activeTab === 'positions' && (
          <PositionTabContent
            loading={manager.loading}
            searchQuery={manager.searchQuery}
            deptFilterForPos={manager.deptFilterForPos}
            filteredPositions={manager.filteredPositions}
            positions={manager.positions}
            departments={manager.departments}
            isAddingPos={manager.isAddingPos}
            setIsAddingPos={manager.setIsAddingPos}
            newPosName={manager.newPosName}
            setNewPosName={manager.setNewPosName}
            newPosDeptId={manager.newPosDeptId}
            setNewPosDeptId={manager.setNewPosDeptId}
            newPosLevel={manager.newPosLevel}
            setNewPosLevel={manager.setNewPosLevel}
            savingAddPos={manager.savingAddPos}
            addPosInputRef={manager.addPosInputRef}
            handleSaveNewPos={manager.handleSaveNewPos}
            editingPosId={manager.editingPosId}
            setEditingPosId={manager.setEditingPosId}
            editPosName={manager.editPosName}
            setEditPosName={manager.setEditPosName}
            editPosDeptId={manager.editPosDeptId}
            setEditPosDeptId={manager.setEditPosDeptId}
            editPosLevel={manager.editPosLevel}
            setEditPosLevel={manager.setEditPosLevel}
            savingEditPos={manager.savingEditPos}
            handleStartEditPos={manager.handleStartEditPos}
            handleSaveEditPos={manager.handleSaveEditPos}
            deleteConfirmPos={manager.deleteConfirmPos}
            setDeleteConfirmPos={manager.setDeleteConfirmPos}
            deletingPosId={manager.deletingPosId}
            handleExecuteDeletePos={manager.handleExecuteDeletePos}
          />
        )}
      </div>
    </Drawer>
  );
};
