/**
 * Employee Module Public API (Facade)
 * Quy định các hàm, permissions và router được phép sử dụng từ bên ngoài.
 */
export * from './employee.service.js'
export * from './employee.permission.js'
export * from './employee.dto.js'
export * from './employee.model.js'
export { employeeRouter } from './employee.routes.js'
export { departmentRouter } from './department.routes.js'
export { positionRouter } from './position.routes.js'
