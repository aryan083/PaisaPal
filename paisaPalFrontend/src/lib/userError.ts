export type ApiErrorPayload = {
  error?: string | null
  errorCode?: string
  suggestion?: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
  details?: unknown
}

export class ApiError extends Error {
  status: number
  errorCode?: string
  suggestion?: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
  details?: unknown

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = payload?.errorCode
    this.suggestion = payload?.suggestion
    this.requestId = payload?.requestId
    this.fieldErrors = payload?.fieldErrors
    this.details = payload?.details
  }
}

export type UserError = {
  title: string
  message: string
  suggestion?: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
}

function defaultSuggestionForStatus(status: number): string | undefined {
  if (status === 400) return 'Please double-check the form values and try again.'
  if (status === 401) return 'Please sign in again and retry.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'Please refresh the page and try again.'
  if (status === 409) return 'This already exists. Try changing the values and retry.'
  if (status === 422) return 'Please fix the highlighted fields and try again.'
  if (status >= 500) return 'Please try again in a moment.'
  return undefined
}

export function getUserError(err: unknown, fallbackTitle = 'Something went wrong'): UserError {
  if (err instanceof ApiError) {
    return {
      title: fallbackTitle,
      message: err.message || 'Request failed',
      suggestion: err.suggestion ?? defaultSuggestionForStatus(err.status),
      requestId: err.requestId,
      fieldErrors: err.fieldErrors,
    }
  }

  if (err instanceof Error) {
    const msg = err.message || 'Unexpected error'
    const isNetwork = /network|failed to fetch|fetch/i.test(msg)
    return {
      title: fallbackTitle,
      message: isNetwork ? 'Network error. Could not reach the server.' : msg,
      suggestion: isNetwork ? 'Check your internet connection and try again.' : undefined,
    }
  }

  return {
    title: fallbackTitle,
    message: 'Unexpected error',
  }
}

export function formatToastMessage(userError: UserError): string {
  const base = userError.message
  const suggestion = userError.suggestion ? ` ${userError.suggestion}` : ''
  const requestId = userError.requestId ? ` (Request ID: ${userError.requestId})` : ''
  return `${base}${suggestion}${requestId}`
}
