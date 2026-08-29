import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: error.flatten() })
    return
  }

  const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500
  const message =
    status === 500
      ? 'Internal server error'
      : error instanceof Error
        ? error.message
        : 'Request failed'
  if (status === 500) console.error(error)
  res.status(status).json({ error: message })
}
