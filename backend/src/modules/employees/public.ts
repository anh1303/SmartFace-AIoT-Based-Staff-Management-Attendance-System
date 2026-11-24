export { isEmployeeManager, getEmployeeScope, getManagedEmployeeIds, assertCanAccessEmployeeDetail, assertCanManageEmployee, resolveManagedEmployee, assertCannotModifySelfControlData, assertCannotModifyOtherManager, type EmployeeActor, type ManagedEmployeeTarget } from './employee.permission.js'
export { monthlyHourlyRate, sourceHourlyRate } from './employee.wage.js'
export {
  findEmployeeByIdOrCode,
  findEmployeesByIds,
  findEmployeesRoomMetadata,
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
export { buildIdOrCodeWhere } from './employee.model.js'
export { setFingerprintEnrolledStatus } from './employee.service.js'

export { getEmployeesForReporting, getActiveDepartmentsForReporting } from './employees.report-queries.js'
