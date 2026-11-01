// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { AttendancePairItem } from '../../src/features/attendances/hooks/useAttendancePairs'

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Manager Attendance Monitor - Modal reopening and system-wide lock checks', () => {
  // Logic from ManagerAttendanceMonitor.tsx handleOpenEditModal
  function canOpenEditModal(item: AttendancePairItem): boolean {
    const hasWorkShift = !item.isUnassigned
    const hasScanData = item.hasCheckedIn || item.hasCheckedOut || (item.rawEvents && item.rawEvents.length > 0)
    if (!hasWorkShift && !hasScanData && !item.isOffDay && item.currentOTSec === 0) {
      return false
    }
    return true
  }

  // Logic from ManagerAttendanceMonitor.tsx handleToggleLock
  function computeAffectedIncomplete(allPairs: AttendancePairItem[]): AttendancePairItem[] {
    return allPairs.filter((item) => {
      if (item.isOffDay || item.isUnassigned) return false
      const isMissingCheckout = item.hasCheckedIn && !item.hasCheckedOut
      const isMissingCheckin = !item.hasCheckedIn && item.hasCheckedOut
      const isReviewNeeded =
        item.needsReview &&
        item.reviewReason
          ?.split(',')
          .some((r) =>
            [
              'MISSING_CHECK_OUT',
              'NO_VALID_PAIR',
              'INVALID_PAIR',
              'FLAGGED_EVENT',
              'UNPAIRED_CHECK_OUT',
              'UNDER_MINIMUM_SHIFT',
              'UNDER_HALF_SHIFT',
            ].includes(r)
          )
      return isMissingCheckout || isMissingCheckin || Boolean(isReviewNeeded)
    })
  }

  it('allows opening edit modal for reopened absent day with scheduled shift even with 0 scans and 0 OT', () => {
    const reopenedAbsentItem: AttendancePairItem = {
      employee: {
        id: 'emp-1',
        employee_id: 'EMP001',
        full_name: 'Absent Staff',
        department: 'Engineering',
        position: 'Dev',
      },
      date: '2026-10-25',
      shift: {
        id: 'shift-1',
        name: 'Ca Hành Chính',
        start_time: '08:00',
        end_time: '17:00',
        timeRange: '08:00 - 17:00',
      },
      hasCheckedIn: false,
      hasCheckedOut: false,
      rawEvents: [],
      isOffDay: false,
      isUnassigned: false, // Assigned shift exists!
      currentOTSec: 0,
      initialOTSec: 0,
      currentLateEarlySec: 0,
      initialLateEarlySec: 0,
      workingHours: 0,
      needsReview: false,
    }

    expect(canOpenEditModal(reopenedAbsentItem)).toBe(true)
  })

  it('detects incomplete shifts system-wide across all departments, ignoring active filter', () => {
    // Dept A employee visible on screen
    const deptAIncomplete: AttendancePairItem = {
      employee: { id: 'emp-1', employee_id: 'EMP001', full_name: 'Dept A Staff', department: 'Dept A' },
      date: '2026-10-25',
      shift: { id: 's-1', name: 'Ca Sáng', start_time: '08:00', end_time: '12:00', timeRange: '08:00-12:00' },
      hasCheckedIn: true,
      hasCheckedOut: false, // missing checkout
      rawEvents: [{ id: '1', type: 'CHECK_IN', time: '08:00:00' }],
      isOffDay: false,
      isUnassigned: false,
      currentOTSec: 0,
      initialOTSec: 0,
      currentLateEarlySec: 0,
      initialLateEarlySec: 0,
      workingHours: 0,
      needsReview: true,
      reviewReason: 'MISSING_CHECK_OUT',
    }

    // Dept B employee filtered out from UI view, but exists in allEmployeePairs
    const deptBIncomplete: AttendancePairItem = {
      employee: { id: 'emp-2', employee_id: 'EMP002', full_name: 'Dept B Staff', department: 'Dept B' },
      date: '2026-10-25',
      shift: { id: 's-2', name: 'Ca Chiều', start_time: '13:00', end_time: '17:00', timeRange: '13:00-17:00' },
      hasCheckedIn: true,
      hasCheckedOut: false, // missing checkout
      rawEvents: [{ id: '2', type: 'CHECK_IN', time: '13:00:00' }],
      isOffDay: false,
      isUnassigned: false,
      currentOTSec: 0,
      initialOTSec: 0,
      currentLateEarlySec: 0,
      initialLateEarlySec: 0,
      workingHours: 0,
      needsReview: true,
      reviewReason: 'MISSING_CHECK_OUT',
    }

    // Complete shift
    const completeShift: AttendancePairItem = {
      employee: { id: 'emp-3', employee_id: 'EMP003', full_name: 'Complete Staff', department: 'Dept A' },
      date: '2026-10-25',
      shift: { id: 's-3', name: 'Ca Sáng', start_time: '08:00', end_time: '12:00', timeRange: '08:00-12:00' },
      hasCheckedIn: true,
      hasCheckedOut: true,
      rawEvents: [
        { id: '3', type: 'CHECK_IN', time: '08:00:00' },
        { id: '4', type: 'CHECK_OUT', time: '12:00:00' },
      ],
      isOffDay: false,
      isUnassigned: false,
      currentOTSec: 0,
      initialOTSec: 0,
      currentLateEarlySec: 0,
      initialLateEarlySec: 0,
      workingHours: 4,
      needsReview: false,
    }

    const allSystemPairs = [deptAIncomplete, deptBIncomplete, completeShift]
    const affected = computeAffectedIncomplete(allSystemPairs)

    // Both dept A and dept B incomplete shifts are caught system-wide!
    expect(affected).toHaveLength(2)
    expect(affected.map((a) => a.employee.employee_id)).toEqual(['EMP001', 'EMP002'])
  })

  it('eliminates stale query race condition when date filter changes out-of-order in raw logs pagination', async () => {
    const React = await import('react');
    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { useRawLogsPagination } = await import('../../src/features/attendances/hooks/useRawLogsPagination');
    const attendanceApi = await import('../../src/features/attendances/api/attendanceApi');

    const logsDateA = [{ id: 'log-date-A', employee_id: 'EMP001', type: 'CHECK_IN', timestamp: '2026-10-25T08:00:00Z', status: 'VALID' }] as any;
    const logsDateB = [{ id: 'log-date-B', employee_id: 'EMP002', type: 'CHECK_IN', timestamp: '2026-10-26T08:00:00Z', status: 'VALID' }] as any;

    let resolveReqA: (val: any) => void = () => {};
    let resolveReqB: (val: any) => void = () => {};

    const spy = vi.spyOn(attendanceApi, 'fetchAttendancePaginatedApi');
    spy.mockImplementation((params: any) => {
      if (params.startDate === '2026-10-25') {
        return new Promise((resolve) => {
          resolveReqA = () => resolve({ data: logsDateA, total: 1, page: 1, limit: 50, hasMore: false });
        });
      }
      return new Promise((resolve) => {
        resolveReqB = () => resolve({ data: logsDateB, total: 1, page: 1, limit: 50, hasMore: false });
      });
    });

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    let handle: any = null;
    function TestConsumer({ startDate, endDate }: { startDate: string; endDate: string }) {
      handle = useRawLogsPagination({ startDate, endDate, pageSize: 50 });
      return <div data-count={handle.rawLogsData.length} />;
    }

    await act(async () => {
      root.render(<TestConsumer startDate="2026-10-25" endDate="2026-10-25" />);
    });

    // Open raw logs modal for Date A
    await act(async () => {
      handle.setShowRawLogs(true);
    });

    // Then user quickly switches date to Date B
    await act(async () => {
      root.render(<TestConsumer startDate="2026-10-26" endDate="2026-10-26" />);
    });

    // Request B resolves first!
    await act(async () => {
      resolveReqB(null);
    });

    // The data displayed should be Date B
    expect(handle.rawLogsData).toEqual(logsDateB);

    // Now Request A finishes late (stale out-of-order response)
    await act(async () => {
      resolveReqA(null);
    });

    // The data displayed MUST NOT be overwritten by the stale Date A response!
    expect(handle.rawLogsData).toEqual(logsDateB);
    expect(handle.isLoadingRawLogs).toBe(false);

    await act(async () => {
      root.unmount();
    });
    host.remove();
    spy.mockRestore();
  })
})
