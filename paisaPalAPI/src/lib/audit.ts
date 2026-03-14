import { Request } from 'express'
import { AuditLog } from '../models/AuditLog'

interface AuditLogInput {
  userId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  resource: 'transaction' | 'settings' | 'budget' | 'recurring' | 'category'
  resourceId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  req?: Request
}

export function createAuditLog(input: AuditLogInput): void {
  const { userId, action, resource, resourceId, before, after, req } = input

  void AuditLog.create({
    userId,
    action,
    resource,
    resourceId,
    before,
    after,
    metadata: {
      ip: req?.ip,
      userAgent: req?.headers['user-agent'],
    },
  }).catch(err => {
    console.error('Failed to create audit log:', err)
  })
}
