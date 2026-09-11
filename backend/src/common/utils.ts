const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildIdOrCodeWhere(idOrCode: string) {
  if (UUID_REGEX.test(idOrCode)) {
    return { OR: [{ id: idOrCode }, { employee_code: idOrCode }] }
  }
  return { employee_code: idOrCode }
}
