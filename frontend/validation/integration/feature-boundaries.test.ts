import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('feature public boundaries', () => {
  it('keeps application domain consumers independent of the aggregate context', () => {
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [resolve(dir, entry.name)] : []);
    }
    const consumers = ['src/pages', 'src/features'].flatMap(dir => files(resolve(dir))).filter(file => readFileSync(file, 'utf8').includes('useApp('));
    expect(consumers).toEqual([]);
  });
  it('imports other features through their entry point', () => {
    function files(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [resolve(dir, entry.name)] : []);
    }
    const root = resolve('src');
    const problems: string[] = [];
    for (const file of [...files(resolve(root, 'features')), ...files(resolve(root, 'pages'))]) {
      const owner = file.replaceAll('\\', '/').match(/\/features\/([^/]+)\//)?.[1];
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        const specifier = match[1];
        const target = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : specifier.startsWith('.') ? resolve(file, '..', specifier) : '';
        const feature = target.replaceAll('\\', '/').match(/\/features\/([^/]+)\/(.+)/);
        if (feature && feature[1] !== owner && feature[2] !== 'index' && feature[2] !== 'index.ts') problems.push(`${file}: ${specifier}`);
      }
    }
    expect(problems).toEqual([]);
  });
  it('uses domain contexts directly on the payroll page', () => {
    const source = readFileSync(resolve('src/pages/manager/ManagerPayroll.tsx'), 'utf8');
    expect(source).not.toContain('useApp(');
  });
  it('does not rebuild a combined domain context for every provider update', () => {
    expect(readFileSync(resolve('src/context/AppContext.tsx'), 'utf8')).not.toContain('AppConsumerBridge');
  });
  it.each(['src/features/payrolls/hooks/useEmployeePayrollDetail.ts', 'src/features/employees/components/EmployeeMonthlyAverages.tsx'])('%s reads payroll from its domain context', file => {
    expect(readFileSync(resolve(file), 'utf8')).not.toContain('useApp(');
  });
  it.each([
    'src/pages/employee/EmployeeAttendance.tsx',
    'src/pages/employee/EmployeeDashboard.tsx',
    'src/pages/employee/EmployeeSalaryEstimate.tsx',
    'src/pages/manager/ManagerAttendanceMonitor.tsx',
    'src/pages/manager/ManagerDevices.tsx',
    'src/pages/manager/ManagerSchedule.tsx',
    'src/pages/manager/ManagerReports.tsx',
  ])('%s imports features through their public entry point', (file) => {
    const source = readFileSync(resolve(file), 'utf8');
    expect(source).not.toMatch(/from\s+['"][^'"]*features\/[^/'"]+\/[^'"]+/);
  });
});
