// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as attendanceApi from '../src/features/attendances/api/attendanceApi';
import { useRawLogsPagination } from '../src/features/attendances/hooks/useRawLogsPagination';
import { useTableSort, compareEmployeeNames, compareEmployeeCodes } from '../src/hooks/useTableSort';
import { TableHeadCell } from '../src/components/common/Table';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeTable } from '../src/features/employees/components/EmployeeTable';

vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { role: 'admin' }, role: 'admin' }) }));
vi.mock('../src/context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

it('cycles employee headers through ascending, descending, and original row order', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const employees = [
    { employee_id: 'NV-10', full_name: 'Hà Quốc Việt', hourly_rate: 9000 },
    { employee_id: 'NV-2', full_name: 'Nguyễn Quang Anh', hourly_rate: 100000 },
    { employee_id: 'NV-1', full_name: 'Bùi Quốc Bảo', hourly_rate: 85000 },
  ].map(employee => ({ ...employee, created_at: '2026-11-01', status: 'ACTIVE' })) as any;
  const host = document.createElement('div');
  const root = createRoot(host);
  const client = new QueryClient();
  try {
    act(() => root.render(<QueryClientProvider client={client}><MemoryRouter><EmployeeTable filteredEmployees={employees} onOpenEdit={() => {}} onOpenStatusToggle={() => {}} /></MemoryRouter></QueryClientProvider>));
    const headers = host.querySelectorAll('th');
    const cases = [
      { column: 0, order: ['NV-2', 'NV-1', 'NV-10'] },
      { column: 1, order: ['NV-1', 'NV-2', 'NV-10'] },
      { column: 5, order: ['NV-10', 'NV-1', 'NV-2'] },
    ];
    for (const { column, order } of cases) {
      for (let click = 0; click < 6; click++) {
        act(() => headers[column].querySelector('button')!.click());
        expect([...host.querySelectorAll('tbody tr')].map(row => row.children[1].textContent))
          .toEqual(click % 3 === 2 ? ['NV-10', 'NV-2', 'NV-1'] : click % 3 === 1 ? [...order].reverse() : order);
        expect(headers[column].getAttribute('aria-sort')).toBe(['ascending', 'descending', 'none'][click % 3]);
      }
    }
    expect([...headers].filter(header => header.querySelector('button'))).toHaveLength(3);
  } finally { act(() => root.unmount()); client.clear(); }
});

it('compares Vietnamese given names and numeric employee codes', () => {
  expect(['Hà Quốc Việt', 'Bùi Quốc Bảo', 'Nguyễn Quang Anh', 'Hoàng Bích Ngọc'].sort(compareEmployeeNames))
    .toEqual(['Nguyễn Quang Anh', 'Bùi Quốc Bảo', 'Hoàng Bích Ngọc', 'Hà Quốc Việt']);
  expect(['An Đông', 'An Dũng', 'An Đạt'].sort(compareEmployeeNames)).toEqual(['An Dũng', 'An Đạt', 'An Đông']);
  expect(['NV-10', 'NV-002', 'DEMO-PBL6-20', 'NV-1'].sort(compareEmployeeCodes))
    .toEqual(['NV-1', 'NV-002', 'NV-10', 'DEMO-PBL6-20']);
});

it('toggles only requested columns, sorts money numerically, and preserves source rows', () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const rows = [
    { name: 'Hà Quốc Việt', code: 'NV-10', rate: 100000 },
    { name: 'Nguyễn Quang Anh', code: 'NV-2', rate: 9000 },
    { name: 'Bùi Quốc Bảo', code: 'NV-1', rate: 85000 },
  ];
  function Table() {
    const { sortedRows, sortProps } = useTableSort(rows, {
      name: (a, b) => compareEmployeeNames(a.name, b.name),
      code: (a, b) => compareEmployeeCodes(a.code, b.code),
      rate: (a, b) => a.rate - b.rate,
    });
    return <table><thead><tr>
      <TableHeadCell {...sortProps('name')}>Nhân viên</TableHeadCell>
      <TableHeadCell {...sortProps('code')}>Mã NV</TableHeadCell>
      <TableHeadCell {...sortProps('rate')}>Lương theo giờ</TableHeadCell>
      <TableHeadCell>Trạng thái</TableHeadCell>
    </tr></thead><tbody>{sortedRows.map(row => <tr key={row.code}><td>{row.code}</td></tr>)}</tbody></table>;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  const order = () => [...host.querySelectorAll('tbody td')].map(cell => cell.textContent);
  const click = (index: number) => act(() => host.querySelectorAll('button')[index].click());
  try {
    act(() => root.render(<Table />));
    expect(order()).toEqual(['NV-10', 'NV-2', 'NV-1']);
    click(0); expect(order()).toEqual(['NV-2', 'NV-1', 'NV-10']);
    expect(host.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
    click(0); expect(order()).toEqual(['NV-10', 'NV-1', 'NV-2']);
    click(0); expect(order()).toEqual(['NV-10', 'NV-2', 'NV-1']);
    expect(host.querySelector('th')?.getAttribute('aria-sort')).toBe('none');
    click(1); expect(order()).toEqual(['NV-1', 'NV-2', 'NV-10']);
    click(1); expect(order()).toEqual(['NV-10', 'NV-2', 'NV-1']);
    click(1); expect(order()).toEqual(['NV-10', 'NV-2', 'NV-1']);
    click(2); expect(order()).toEqual(['NV-2', 'NV-1', 'NV-10']);
    click(2); expect(order()).toEqual(['NV-10', 'NV-1', 'NV-2']);
    click(2); expect(order()).toEqual(['NV-10', 'NV-2', 'NV-1']);
    expect(rows.map(row => row.code)).toEqual(['NV-10', 'NV-2', 'NV-1']);
    expect(host.querySelectorAll('th')[3].querySelector('button')).toBeNull();
    expect(host.querySelector('svg')).toBeNull();
  } finally { act(() => root.unmount()); }
});

it('sorts raw logs across pages before selecting the current page', async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const logs = ['Hà Quốc Việt', 'Bùi Quốc Bảo', 'Nguyễn Quang Anh'].map((employee_name, index) => ({ employee_name, employee_id: `NV-${index}` })) as any;
  const fetch = vi.spyOn(attendanceApi, 'fetchAttendanceApi').mockResolvedValue(logs);
  let handle: ReturnType<typeof useRawLogsPagination>;
  function Consumer({ direction }: { direction: 'ascending' | 'descending' }) {
    handle = useRawLogsPagination({ pageSize: 2, employeeNameSort: direction });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(<Consumer direction="ascending" />));
    await act(async () => handle.setShowRawLogs(true));
    expect(handle!.rawLogsData.map(log => log.employee_name)).toEqual(['Nguyễn Quang Anh', 'Bùi Quốc Bảo']);
    await act(async () => handle.loadRawLogsPage(2));
    expect(handle!.rawLogsData.map(log => log.employee_name)).toEqual(['Hà Quốc Việt']);
    await act(async () => root.render(<Consumer direction="descending" />));
    expect(handle!.rawLogPage).toBe(1);
    expect(handle!.rawLogsData.map(log => log.employee_name)).toEqual(['Hà Quốc Việt', 'Bùi Quốc Bảo']);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => handle.loadRawLogsPage(1, true));
    expect(fetch).toHaveBeenCalledTimes(2);
  } finally { act(() => root.unmount()); fetch.mockRestore(); }
});
