import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'

export function formatDevice(d: any) {
  return {
    id: d.id,
    name: d.name,
    location: d.location,
    ip: d.ip || null,
    status: d.status as 'ONLINE' | 'OFFLINE' | 'MAINTENANCE',
    lastSeen: d.last_seen ? d.last_seen.toISOString() : null,
    createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
  }
}

export async function list() {
  const devices = await (prisma as any).device.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return devices.map(formatDevice)
}

export async function get(id: string) {
  const device = await (prisma as any).device.findUnique({
    where: { id },
  })
  if (!device) throw new AppError(404, 'Device not found')
  return formatDevice(device)
}

export async function create(data: { name: string; location: string; ip?: string | null; status?: string }) {
  const device = await (prisma as any).device.create({
    data: {
      name: data.name,
      location: data.location,
      ip: data.ip ?? null,
      status: data.status ?? 'OFFLINE',
    },
  })
  return formatDevice(device)
}

export async function update(id: string, data: { name?: string; location?: string; ip?: string | null; status?: string }) {
  await get(id)
  const updated = await (prisma as any).device.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.ip !== undefined ? { ip: data.ip } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  })
  return formatDevice(updated)
}

export async function remove(id: string): Promise<void> {
  await get(id)
  await (prisma as any).device.delete({ where: { id } })
}

export async function updateStatus(id: string, status: string) {
  try {
    const updated = await (prisma as any).device.update({
      where: { id },
      data: { status, last_seen: new Date() },
    })
    return formatDevice(updated)
  } catch {
    return null
  }
}
