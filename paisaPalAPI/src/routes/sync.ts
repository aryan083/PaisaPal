import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import Transaction from '../models/Transaction'
import { IdempotencyKey } from '../models/IdempotencyKey'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../middleware/asyncHandler'
import { createAuditLog } from '../lib/audit'

const router = Router()

router.use(requireAuth)

interface SyncOperation {
  idempotencyKey: string
  operation: 'create' | 'update' | 'delete'
  resource: 'transaction'
  data: Record<string, unknown>
  timestamp: string
}

interface SyncRequest {
  operations: SyncOperation[]
}

interface SyncResult {
  idempotencyKey: string
  success: boolean
  resourceId?: string
  error?: string
}

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  const { operations } = req.body as SyncRequest

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({
      data: null,
      error: 'No operations to sync',
      errorCode: 'SYNC_EMPTY',
      suggestion: 'Please try again after making some changes.',
      requestId: req.requestId,
    })
  }

  const results: SyncResult[] = []

  for (const op of operations) {
    try {
      // Check idempotency key
      const existingKey = await IdempotencyKey.findOne({ key: op.idempotencyKey })
      
      if (existingKey) {
        // Already processed, return cached result
        results.push({
          idempotencyKey: op.idempotencyKey,
          success: true,
          resourceId: existingKey.response.resourceId as string,
        })
        continue
      }

      let resourceId: string
      let response: Record<string, unknown>

      switch (op.operation) {
        case 'create':
          const created = await Transaction.create({
            ...op.data,
            userId,
          })
          resourceId = created._id.toString()
          response = { resourceId, data: created.toObject() }
          
          createAuditLog({
            userId,
            action: 'CREATE',
            resource: 'transaction',
            resourceId,
            after: created.toObject() as unknown as Record<string, unknown>,
            req,
          })
          break

        case 'update':
          const updated = await Transaction.findOneAndUpdate(
            { _id: op.data._id, userId },
            op.data,
            { new: true, runValidators: true }
          ).lean()
          
          if (!updated) {
            throw new Error('Transaction not found')
          }
          resourceId = updated._id.toString()
          response = { resourceId, data: updated }
          
          createAuditLog({
            userId,
            action: 'UPDATE',
            resource: 'transaction',
            resourceId,
            after: updated as Record<string, unknown>,
            req,
          })
          break

        case 'delete':
          const deleted = await Transaction.findOneAndDelete({
            _id: op.data._id,
            userId,
          }).lean()
          
          if (!deleted) {
            throw new Error('Transaction not found')
          }
          resourceId = deleted._id.toString()
          response = { resourceId }
          
          createAuditLog({
            userId,
            action: 'DELETE',
            resource: 'transaction',
            resourceId,
            before: deleted as Record<string, unknown>,
            req,
          })
          break

        default:
          throw new Error(`Unknown operation: ${op.operation}`)
      }

      // Store idempotency key with response
      await IdempotencyKey.create({
        key: op.idempotencyKey,
        userId,
        response,
      })

      results.push({
        idempotencyKey: op.idempotencyKey,
        success: true,
        resourceId,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      results.push({
        idempotencyKey: op.idempotencyKey,
        success: false,
        error: errorMessage,
      })
    }
  }

  return res.status(200).json({
    data: { results },
    error: null,
  })
}))

router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId
  
  const pendingKeys = await IdempotencyKey.countDocuments({ userId })
  
  return res.status(200).json({
    data: {
      pendingKeys,
      lastSync: new Date().toISOString(),
    },
    error: null,
  })
}))

export default router
