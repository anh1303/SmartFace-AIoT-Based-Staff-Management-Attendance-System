/**
 * Operations Module Bootstrap Entry
 * Hợp đồng công khai dành cho tầng lắp ráp (routes.ts, server.ts).
 */
export { operationRouter } from './operation.routes.js'
export { initializeOperationGateway } from './operation.gateway.js'
export {
  startOperationWorker,
  stopOperationWorker,
  registerOperationHandler,
  listRegisteredOperationHandlers,
  setOperationActorLookup,
} from './operation.worker.js'
