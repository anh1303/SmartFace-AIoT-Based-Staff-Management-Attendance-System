export { isEmployeeManager, getEmployeeScope, assertCanAccessEmployeeDetail, assertCanManageEmployee, assertCannotModifySelfControlData, assertCannotModifyOtherManager, type EmployeeActor } from './employee.permission.js'
export { monthlyHourlyRate, sourceHourlyRate } from './employee.wage.js'
export {
  findEmployeeByIdOrCode,
  findEmployeesByIds,
  findActiveEmployees,
  findActiveEmployeeIds,
  findEmployeeByUserId,
  findEmployeeByEmail,
  findEmployeeByIdOrUserId,
  countActiveEmployees,
  countScopedEmployees,
  createEmployee,
  terminateEmployee,
  findEmployeesWithFilter,
  findEmployeeWageProfile,
  findEmployeeWithRelations,
  updateEmployeePersonalDetails,
  findDepartmentByIdOrCode,
  findPositionByName,
} from './employee.queries.js'
export { generateUniqueEmployeeCode } from './employee.code.js'

export { getEmployeesForReporting, getActiveDepartmentsForReporting } from './employees.report-queries.js'
