import { useState, useCallback } from 'react'
import { useStore } from '@/store'
import { CATEGORIES, type Category, type PaymentMode } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Upload, AlertTriangle, Check, X, Pencil, Trash2 } from 'lucide-react'

interface ParsedRow {
  id: string
  date: string
  particulars: string
  amount: number
  mode: PaymentMode
  notes: string
  category: Category
  errors: string[]
  status: 'valid' | 'error' | 'editing'
}

const EXPECTED_HEADERS = ['Date', 'Particulars', 'Amount paid', 'Total expenses', 'Mode of payment', 'Notes', 'Category']

function normalizeDate(raw: string): string {
  if (!raw) return ''
  // Handle DD-MM-YYYY or DD/MM/YYYY
  const parts = raw.split(/[-/]/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (d.length <= 2 && m.length <= 2 && y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    // Handle YYYY-MM-DD already
    if (parts[0].length === 4) return raw
  }
  return raw
}

function normalizeCategory(raw: string): Category | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  const match = CATEGORIES.find(c => c.toLowerCase() === lower)
  if (match) return match
  // Fuzzy match
  const fuzzy = CATEGORIES.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))
  return fuzzy || null
}

function normalizeMode(raw: string): PaymentMode {
  const lower = (raw || '').toLowerCase().trim()
  if (lower === 'cash') return 'Cash'
  return 'Online'
}

function validateRow(row: ParsedRow): string[] {
  const errors: string[] = []
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push('Invalid date format (expected DD-MM-YYYY)')
  } else {
    const d = new Date(row.date)
    if (isNaN(d.getTime())) errors.push('Invalid date')
  }
  if (!row.particulars || row.particulars.trim().length === 0) {
    errors.push('Description is required')
  }
  if (isNaN(row.amount) || row.amount < 0) {
    errors.push('Amount must be a non-negative number')
  }
  if (!CATEGORIES.includes(row.category)) {
    errors.push(`Invalid category: "${row.category}"`)
  }
  if (row.mode !== 'Online' && row.mode !== 'Cash') {
    errors.push('Mode must be Online or Cash')
  }
  return errors
}

function parseTabOrCSV(text: string): string[][] {
  const lines = text.trim().split('\n').filter(l => l.trim())
  return lines.map(line => {
    // Try tab-separated first
    if (line.includes('\t')) return line.split('\t').map(c => c.trim())
    // CSV
    const cells: string[] = []
    let current = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { cells.push(current.trim()); current = ''; continue }
      current += ch
    }
    cells.push(current.trim())
    return cells
  })
}

interface BulkImportProps {
  open: boolean
  onClose: () => void
}

export function BulkImport({ open, onClose }: BulkImportProps) {
  const { addTransaction } = useStore()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [rawText, setRawText] = useState('')
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)

  const handleParse = useCallback(() => {
    if (!rawText.trim()) {
      toast.error('Please paste some data first')
      return
    }

    const parsed = parseTabOrCSV(rawText)
    if (parsed.length < 2) {
      toast.error('Need at least a header row and one data row')
      return
    }

    // Check headers
    const headers = parsed[0].map(h => h.toLowerCase().trim())
    const dataRows = parsed.slice(1)

    // Map column indices
    const dateIdx = headers.findIndex(h => h.includes('date'))
    const partIdx = headers.findIndex(h => h.includes('particular'))
    const amtIdx = headers.findIndex(h => h.includes('amount'))
    const modeIdx = headers.findIndex(h => h.includes('mode'))
    const notesIdx = headers.findIndex(h => h.includes('note'))
    const catIdx = headers.findIndex(h => h.includes('category') || h.includes('categ'))

    if (dateIdx === -1 || partIdx === -1 || amtIdx === -1) {
      toast.error('Could not find required columns: Date, Particulars, Amount')
      return
    }

    const parsedRows: ParsedRow[] = dataRows.map((cells, i) => {
      const rawDate = cells[dateIdx] || ''
      const rawPart = cells[partIdx] || ''
      const rawAmt = cells[amtIdx] || ''
      const rawMode = modeIdx >= 0 ? cells[modeIdx] || '' : 'Online'
      const rawNotes = notesIdx >= 0 ? cells[notesIdx] || '' : ''
      const rawCat = catIdx >= 0 ? cells[catIdx] || '' : ''

      const date = normalizeDate(rawDate)
      const amount = parseFloat(rawAmt.replace(/[₹,\s]/g, '')) || 0
      const mode = normalizeMode(rawMode)
      const category = normalizeCategory(rawCat) || 'Other'

      const row: ParsedRow = {
        id: `import-${i}-${Date.now()}`,
        date,
        particulars: rawPart,
        amount,
        mode,
        notes: rawNotes,
        category,
        errors: [],
        status: 'valid',
      }
      row.errors = validateRow(row)
      row.status = row.errors.length > 0 ? 'error' : 'valid'
      return row
    })

    setRows(parsedRows)
    setStep('review')

    const errorCount = parsedRows.filter(r => r.status === 'error').length
    if (errorCount > 0) {
      toast.warning(`${errorCount} row(s) have issues — fix them below`)
    } else {
      toast.success(`${parsedRows.length} rows parsed successfully`)
    }
  }, [rawText])

  const updateRow = (id: string, updates: Partial<ParsedRow>) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, ...updates }
      updated.errors = validateRow(updated)
      updated.status = updated.errors.length > 0 ? 'error' : 'valid'
      return updated
    }))
    setEditingRowId(null)
  }

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const importAll = () => {
    const valid = rows.filter(r => r.status === 'valid')
    const invalid = rows.filter(r => r.status === 'error')

    if (valid.length === 0) {
      toast.error('No valid rows to import')
      return
    }

    valid.forEach(r => {
      addTransaction({
        date: r.date,
        particulars: r.particulars,
        amount: r.amount,
        category: r.category,
        mode: r.mode,
        notes: r.notes,
      })
    })

    toast.success(`Imported ${valid.length} transactions${invalid.length > 0 ? `, ${invalid.length} skipped (errors)` : ''}`)

    if (invalid.length > 0) {
      setRows(invalid)
    } else {
      handleClose()
    }
  }

  const handleClose = () => {
    setRows([])
    setRawText('')
    setStep('input')
    setEditingRowId(null)
    onClose()
  }

  const validCount = rows.filter(r => r.status === 'valid').length
  const errorCount = rows.filter(r => r.status === 'error').length

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-display text-foreground flex items-center gap-2">
            <Upload className="h-5 w-5" /> Bulk Import
          </SheetTitle>
        </SheetHeader>

        {step === 'input' && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste your data below (tab-separated or CSV). Expected columns:
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {EXPECTED_HEADERS.map(h => (
                  <span key={h} className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">{h}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>Date</strong>, <strong>Particulars</strong>, and <strong>Amount</strong> are required. Missing categories default to "Other".
              </p>
            </div>

            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Date\tParticulars\tAmount paid\tTotal expenses\tMode of payment\tNotes\tCategory\n11-03-2026\tRapido: K P Epitome to Home Haven\t59\t3400\tOnline\t\tRapido`}
              rows={12}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground font-mono resize-y"
            />

            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Parse & Review
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl bg-secondary p-3 text-center">
                <p className="text-lg font-bold text-foreground">{rows.length}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="flex-1 rounded-xl bg-[hsl(var(--success)/0.1)] p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--success))]">{validCount}</p>
                <p className="text-xs text-muted-foreground">Valid</p>
              </div>
              <div className="flex-1 rounded-xl bg-[hsl(var(--danger)/0.1)] p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--danger))]">{errorCount}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {rows.map(row => (
                <div
                  key={row.id}
                  className={`rounded-xl border p-3 text-sm ${
                    row.status === 'error'
                      ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.05)]'
                      : 'border-border bg-secondary/50'
                  }`}
                >
                  {editingRowId === row.id ? (
                    <EditRow row={row} onSave={updates => updateRow(row.id, updates)} onCancel={() => setEditingRowId(null)} />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {row.status === 'valid' ? (
                              <Check className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--danger))] flex-shrink-0" />
                            )}
                            <span className="font-medium text-foreground truncate">{row.particulars || '(empty)'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{row.date}</span>
                            <span>₹{row.amount}</span>
                            <span>{row.category}</span>
                            <span>{row.mode}</span>
                          </div>
                          {row.errors.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {row.errors.map((e, i) => (
                                <p key={i} className="text-xs text-[hsl(var(--danger))]">⚠ {e}</p>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingRowId(row.id)}
                            aria-label="Edit row"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeRow(row.id)}
                            aria-label="Remove row"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setStep('input'); setRows([]) }}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground"
              >
                Back
              </button>
              <button
                onClick={importAll}
                disabled={validCount === 0}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Import {validCount} Valid Row{validCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function EditRow({ row, onSave, onCancel }: { row: ParsedRow; onSave: (u: Partial<ParsedRow>) => void; onCancel: () => void }) {
  const [date, setDate] = useState(row.date)
  const [particulars, setParticulars] = useState(row.particulars)
  const [amount, setAmount] = useState(String(row.amount))
  const [category, setCategory] = useState(row.category)
  const [mode, setMode] = useState(row.mode)
  const [notes, setNotes] = useState(row.notes)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <input value={particulars} onChange={e => setParticulars(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as Category)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as PaymentMode)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground">
            <option value="Online">Online</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 rounded-lg bg-secondary py-1.5 text-xs font-medium text-muted-foreground">Cancel</button>
        <button
          onClick={() => onSave({ date, particulars, amount: parseFloat(amount) || 0, category, mode, notes })}
          className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground"
        >
          Save
        </button>
      </div>
    </div>
  )
}
