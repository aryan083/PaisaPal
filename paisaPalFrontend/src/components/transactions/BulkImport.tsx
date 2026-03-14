import { useState, useCallback, useMemo } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Upload, Eye, Copy, Check, X, Edit2, Trash2 } from 'lucide-react'
import { importTransactionsCsv, type ImportResult } from '@/lib/api'
import { getAvailableCategories, type Category } from '@/types'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { useStore } from '@/store'
import { useSyncStore } from '@/stores/syncStore'
import * as XLSX from 'xlsx'

const EXPECTED_HEADERS = ['Date', 'Particulars', 'Amount paid', 'Total expenses', 'Mode of payment', 'Notes', 'Category']

interface PreviewRow {
  row: number
  date: string
  particulars: string
  amount: number
  category: Category
  mode: 'Online' | 'Cash'
  notes: string
  isDuplicate: boolean
  isSelected: boolean
  isEditing: boolean
  error?: string
}

interface BulkImportProps {
  open: boolean
  onClose: () => void
}

export function BulkImport({ open, onClose }: BulkImportProps) {
  const { settings, updateSettings, bulkAddTransactions } = useStore()
  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input')
  const [visibleRows, setVisibleRows] = useState(200)

  const categories = getAvailableCategories(settings)

  const addCategory = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) return

    const next = [...(settings.categoryConfig ?? []), { name: trimmed, color: '#6080a0' }]
    try {
      await updateSettings({ categoryConfig: next })
      toast.success(`Added category: ${trimmed}`)
    } catch (err) {
      const u = getUserError(err, 'Failed to add category')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
    }
  }

  const isExcelFile = (f: File) => {
    const name = f.name.toLowerCase()
    return name.endsWith('.xlsx')
  }

  const isUnknownCategory = (cat: string) => !categories.includes(cat)

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        const next = line[i + 1]
        if (inQuotes && next === '"') {
          current += '"'
          i += 1
          continue
        }
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
        continue
      }
      current += ch
    }
    result.push(current)
    return result.map((v) => v.trim())
  }

  const normalizeClientRecord = (r: Record<string, string>) => {
    const date = r['date']
    const particulars = r['particulars'] || r['description']
    const amount = r['amount'] || r['amount paid']
    const category = r['category']
    const mode = r['mode'] || r['mode of payment'] || r['payment mode']
    const notes = r['notes'] || r['note'] || ''

    return { date, particulars, amount, category, mode, notes }
  }

  const normalizeClientRecordUnknown = (r: Record<string, unknown>) => {
    const toStr = (v: unknown) => (v === null || v === undefined ? '' : String(v))

    const date = r['date']
    const particulars = r['particulars'] ?? r['description']
    const amount = r['amount'] ?? r['amount paid'] ?? r['amount_paid']
    const category = r['category']
    const mode =
      r['mode'] ??
      r['mode of payment'] ??
      r['mode_of_payment'] ??
      r['payment mode'] ??
      r['payment_mode']
    const notes = r['notes'] ?? r['note'] ?? ''

    const normalizedDate =
      date instanceof Date ? formatDateForDisplay(date) : toStr(date)

    return {
      date: normalizedDate,
      particulars: toStr(particulars),
      amount: toStr(amount),
      category: toStr(category),
      mode: toStr(mode),
      notes: toStr(notes),
    }
  }

  const parseCsvClient = (csv: string): Array<Record<string, string>> => {
    const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    const nonEmpty = lines.filter((l) => l.trim().length > 0)
    if (nonEmpty.length === 0) return []

    const header = splitCsvLine(nonEmpty[0] ?? '')
    const keys = header.map((h) => h.trim().toLowerCase())

    const out: Array<Record<string, string>> = []
    for (let i = 1; i < nonEmpty.length; i += 1) {
      const row = splitCsvLine(nonEmpty[i] ?? '')
      const rec: Record<string, string> = {}
      for (let j = 0; j < keys.length; j += 1) {
        const key = keys[j]
        if (!key) continue
        rec[key] = row[j] ?? ''
      }
      out.push(normalizeClientRecord(rec))
    }
    return out
  }

  const parseXlsxClient = async (f: File): Promise<Array<Record<string, string>>> => {
    const data = await f.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array', cellDates: true })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return []

    const ws = wb.Sheets[sheetName]
    if (!ws) return []

    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false,
    })

    return json.map((row) => {
      const normalized: Record<string, unknown> = {}
      Object.entries(row).forEach(([k, v]) => {
        normalized[k.trim().toLowerCase()] = v
      })
      return normalizeClientRecordUnknown(normalized)
    })
  }

  const handleDryRun = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    try {
      setLoading(true)
      const online = useSyncStore.getState().isOnline

      const isExcel = isExcelFile(file)

      if (!online) {
        const parsed = isExcel ? await parseXlsxClient(file) : parseCsvClient(await file.text())

        const rows: PreviewRow[] = parsed.map((p, idx) => {
          const rowNumber = idx + 2
          const date = String(p.date ?? '')
          const particulars = String(p.particulars ?? '')
          const amount = Number(p.amount ?? 0)
          const category = String(p.category ?? 'Other')
          const modeRaw = String(p.mode ?? 'Online')
          const mode: 'Online' | 'Cash' = modeRaw === 'Cash' ? 'Cash' : 'Online'
          const notes = String(p.notes ?? '')

          const err =
            !date || !particulars || Number.isNaN(amount)
              ? 'Invalid row'
              : ''

          return {
            row: rowNumber,
            date,
            particulars,
            amount,
            category: (category || 'Other') as Category,
            mode,
            notes,
            isDuplicate: false,
            isSelected: !err,
            isEditing: false,
            ...(err ? { error: err } : {}),
          }
        })

        setPreviewRows(rows)
        setStep('preview')

        const errCount = rows.filter((r) => r.error).length
        if (errCount > 0) {
          toast.warning(`${errCount} rows have errors - please fix them`)
        } else {
          toast.success(`Ready to import ${rows.length} transactions (offline)`)
        }
        return
      }

      if (isExcel) {
        const parsed = await parseXlsxClient(file)
        const rows: PreviewRow[] = parsed.map((p, idx) => {
          const rowNumber = idx + 2
          const date = String(p.date ?? '')
          const particulars = String(p.particulars ?? '')
          const amount = Number(p.amount ?? 0)
          const category = String(p.category ?? 'Other')
          const modeRaw = String(p.mode ?? 'Online')
          const mode: 'Online' | 'Cash' = modeRaw === 'Cash' ? 'Cash' : 'Online'
          const notes = String(p.notes ?? '')

          const err =
            !date || !particulars || Number.isNaN(amount)
              ? 'Invalid row'
              : ''

          return {
            row: rowNumber,
            date,
            particulars,
            amount,
            category: (category || 'Other') as Category,
            mode,
            notes,
            isDuplicate: false,
            isSelected: !err,
            isEditing: false,
            ...(err ? { error: err } : {}),
          }
        })

        const csvContent = buildCsvFromRows(rows.filter((r) => !r.error))
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        const csvFile = new File([csvBlob], 'import.csv', { type: 'text/csv' })

        const result = await importTransactionsCsv(csvFile, { dryRun: true })

        const resultRows: PreviewRow[] = (result.preview || []).map((p) => ({
          row: p.row,
          date: formatDateForDisplay(p.data.date),
          particulars: p.data.particulars,
          amount: p.data.amount,
          category: p.data.category as Category,
          mode: p.data.mode as 'Online' | 'Cash',
          notes: p.data.notes,
          isDuplicate: p.isDuplicate,
          isSelected: !p.isDuplicate,
          isEditing: false,
        }))

        for (const err of result.errors) {
          resultRows.push({
            row: err.row,
            date: '',
            particulars: '',
            amount: 0,
            category: 'Other',
            mode: 'Online',
            notes: '',
            isDuplicate: false,
            isSelected: false,
            isEditing: true,
            error: err.error,
          })
        }

        resultRows.sort((a, b) => a.row - b.row)

        setPreviewRows(resultRows)
        setStep('preview')

        if (result.errors.length > 0) {
          toast.warning(`${result.errors.length} rows have errors - please fix them`)
        } else if (result.duplicates > 0) {
          toast.info(
            `Found ${result.duplicates} potential duplicates - review and select what to import`,
          )
        } else {
          toast.success(`Ready to import ${resultRows.length} transactions`)
        }
        return
      }

      const result = await importTransactionsCsv(file, { dryRun: true })
      
      // Transform preview data into editable rows
      const rows: PreviewRow[] = (result.preview || []).map((p, idx) => ({
        row: p.row,
        date: formatDateForDisplay(p.data.date),
        particulars: p.data.particulars,
        amount: p.data.amount,
        category: p.data.category as Category,
        mode: p.data.mode as 'Online' | 'Cash',
        notes: p.data.notes,
        isDuplicate: p.isDuplicate,
        isSelected: !p.isDuplicate,
        isEditing: false,
      }))
      
      // Add error rows
      for (const err of result.errors) {
        rows.push({
          row: err.row,
          date: '',
          particulars: '',
          amount: 0,
          category: 'Other',
          mode: 'Online',
          notes: '',
          isDuplicate: false,
          isSelected: false,
          isEditing: true,
          error: err.error,
        })
      }
      
      // Sort by row number
      rows.sort((a, b) => a.row - b.row)
      
      setPreviewRows(rows)
      setStep('preview')
      
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} rows have errors - please fix them`)
      } else if (result.duplicates > 0) {
        toast.info(`Found ${result.duplicates} potential duplicates - review and select what to import`)
      } else {
        toast.success(`Ready to import ${rows.length} transactions`)
      }
    } catch (err) {
      const u = getUserError(err, 'Failed to preview import')
      toast.error(formatToastMessage(u))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDateForDisplay = (date: Date | string): string => {
    const d = date instanceof Date ? date : new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  const toggleRowSelection = (rowNum: number) => {
    setPreviewRows(rows => 
      rows.map(r => r.row === rowNum ? { ...r, isSelected: !r.isSelected } : r)
    )
  }

  const toggleRowEditing = (rowNum: number) => {
    setPreviewRows(rows => 
      rows.map(r => r.row === rowNum ? { ...r, isEditing: !r.isEditing } : r)
    )
  }

  const deleteRow = (rowNum: number) => {
    setPreviewRows(rows => rows.filter(r => r.row !== rowNum))
  }

  const updateRow = (rowNum: number, field: keyof PreviewRow, value: string | number) => {
    setPreviewRows(rows => 
      rows.map(r => {
        if (r.row !== rowNum) return r
        const updated = { ...r, [field]: value }
        // Clear error when user edits
        if (r.error) {
          updated.error = undefined
          updated.isSelected = true
        }
        return updated
      })
    )
  }

  const selectAll = () => {
    setPreviewRows(rows => rows.map(r => ({ ...r, isSelected: !r.error && !r.isDuplicate })))
  }

  const deselectAll = () => {
    setPreviewRows(rows => rows.map(r => ({ ...r, isSelected: false })))
  }

  const handleImport = async () => {
    const selectedRows = previewRows.filter(r => r.isSelected && !r.error)
    if (selectedRows.length === 0) {
      toast.error('No valid rows selected for import')
      return
    }

    try {
      setLoading(true)
      const online = useSyncStore.getState().isOnline

      if (!online) {
        await bulkAddTransactions(
          selectedRows.map((r) => ({
            date: r.date,
            particulars: r.particulars,
            amount: r.amount,
            category: r.category,
            mode: r.mode,
            notes: r.notes,
          })),
        )

        setImportResult({
          inserted: selectedRows.length,
          failed: 0,
          duplicates: 0,
          errors: [],
        })
        setStep('result')
        toast.success(`Imported ${selectedRows.length} transactions (offline)`)
        return
      }
      
      // Build CSV from selected rows
      const csvContent = buildCsvFromRows(selectedRows)
      const csvBlob = new Blob([csvContent], { type: 'text/csv' })
      const csvFile = new File([csvBlob], 'import.csv', { type: 'text/csv' })
      
      const result = await importTransactionsCsv(csvFile, { skipDuplicates: false })
      setImportResult(result)
      setStep('result')
      toast.success(`Imported ${result.inserted} transactions`)
    } catch (err) {
      const u = getUserError(err, 'Failed to import transactions')
      toast.error(formatToastMessage(u))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const buildCsvFromRows = (rows: PreviewRow[]): string => {
    const header = 'date,particulars,amount,category,mode,notes\n'
    const csvRows = rows.map(r => {
      const date = r.date // DD-MM-YYYY format
      const particulars = `"${r.particulars.replace(/"/g, '""')}"`
      const amount = r.amount
      const category = r.category
      const mode = r.mode
      const notes = `"${r.notes.replace(/"/g, '""')}"`
      return `${date},${particulars},${amount},${category},${mode},${notes}`
    })
    return header + csvRows.join('\n')
  }

  const handleClose = () => {
    setFile(null)
    setPreviewRows([])
    setImportResult(null)
    setStep('input')
    setVisibleRows(200)
    onClose()
  }

  const selectedCount = useMemo(
    () => previewRows.filter(r => r.isSelected && !r.error).length,
    [previewRows],
  )
  const errorCount = useMemo(
    () => previewRows.filter(r => r.error).length,
    [previewRows],
  )
  const duplicateCount = useMemo(
    () => previewRows.filter(r => r.isDuplicate).length,
    [previewRows],
  )

  const displayedRows = useMemo(
    () => previewRows.slice(0, visibleRows),
    [previewRows, visibleRows],
  )

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-display text-foreground flex items-center gap-2">
            <Upload className="h-5 w-5" /> Bulk Import
          </SheetTitle>
        </SheetHeader>

        {step === 'input' && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Upload a CSV file with your transactions. Expected columns:
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {EXPECTED_HEADERS.map(h => (
                  <span key={h} className="rounded-lg bg-secondary px-2 py-1 text-xs text-muted-foreground">{h}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>Date</strong> (DD-MM-YYYY), <strong>Particulars</strong>, and <strong>Amount</strong> are required. Missing categories default to "Other".
              </p>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {file ? file.name : 'Click to upload CSV file'}
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDryRun}
                disabled={loading || !file}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> Preview & Edit
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-primary hover:underline">
                  Select All Valid
                </button>
                <span className="text-muted-foreground">|</span>
                <button onClick={deselectAll} className="text-xs text-muted-foreground hover:underline">
                  Deselect All
                </button>
              </div>
              <div className="text-sm">
                <span className="text-[hsl(var(--success))]">{selectedCount}</span>
                <span className="text-muted-foreground"> selected to import</span>
                {errorCount > 0 && (
                  <span className="ml-2 text-[hsl(var(--danger))]">({errorCount} errors)</span>
                )}
                {duplicateCount > 0 && (
                  <span className="ml-2 text-[hsl(var(--warning))]">({duplicateCount} duplicates)</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Showing {Math.min(visibleRows, previewRows.length)} of {previewRows.length}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleRows(v => Math.min(previewRows.length, v + 200))}
                  disabled={visibleRows >= previewRows.length}
                  className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                >
                  Show 200 more
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  type="button"
                  onClick={() => setVisibleRows(previewRows.length)}
                  disabled={visibleRows >= previewRows.length}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  Show all
                </button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left w-8"></th>
                      <th className="px-2 py-2 text-left">Row</th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Particulars</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-left">Category</th>
                      <th className="px-2 py-2 text-left">Mode</th>
                      <th className="px-2 py-2 text-left">Notes</th>
                      <th className="px-2 py-2 text-center w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map(row => (
                      <tr 
                        key={row.row} 
                        className={`border-t border-border ${
                          row.error ? 'bg-[hsl(var(--danger)/0.1)]' : 
                          row.isDuplicate ? 'bg-[hsl(var(--warning)/0.1)]' : 
                          row.isSelected ? 'bg-[hsl(var(--success)/0.05)]' : ''
                        }`}
                      >
                        <td className="px-2 py-1">
                          <input
                            type="checkbox"
                            checked={row.isSelected}
                            disabled={!!row.error}
                            onChange={() => toggleRowSelection(row.row)}
                            className="h-4 w-4 rounded"
                          />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground text-xs">{row.row}</td>
                        
                        {row.isEditing ? (
                          <>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={row.date}
                                onChange={e => updateRow(row.row, 'date', e.target.value)}
                                className="w-20 px-1 py-0.5 text-xs rounded border border-border bg-background"
                                placeholder="DD-MM-YYYY"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={row.particulars}
                                onChange={e => updateRow(row.row, 'particulars', e.target.value)}
                                className="w-32 px-1 py-0.5 text-xs rounded border border-border bg-background"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="number"
                                value={row.amount}
                                onChange={e => updateRow(row.row, 'amount', Number(e.target.value))}
                                className="w-16 px-1 py-0.5 text-xs rounded border border-border bg-background text-right"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <select
                                value={row.category}
                                onChange={e => updateRow(row.row, 'category', e.target.value)}
                                className="px-1 py-0.5 text-xs rounded border border-border bg-background"
                              >
                                {categories.map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-1 py-1">
                              <select
                                value={row.mode}
                                onChange={e => updateRow(row.row, 'mode', e.target.value)}
                                className="px-1 py-0.5 text-xs rounded border border-border bg-background"
                              >
                                <option value="Online">Online</option>
                                <option value="Cash">Cash</option>
                              </select>
                            </td>
                            <td className="px-1 py-1">
                              <input
                                type="text"
                                value={row.notes}
                                onChange={e => updateRow(row.row, 'notes', e.target.value)}
                                className="w-20 px-1 py-0.5 text-xs rounded border border-border bg-background"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 py-1 text-xs">{row.date}</td>
                            <td className="px-2 py-1 text-xs truncate max-w-[150px]">{row.particulars}</td>
                            <td className="px-2 py-1 text-xs text-right">₹{row.amount}</td>
                            <td className="px-2 py-1 text-xs">
                              <div className="flex items-center gap-2">
                                <span>{row.category}</span>
                                {isUnknownCategory(row.category) && (
                                  <button
                                    type="button"
                                    onClick={() => void addCategory(row.category)}
                                    className="text-[10px] rounded-md bg-secondary px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
                                    title="Add this category to your Settings"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1 text-xs">{row.mode}</td>
                            <td className="px-2 py-1 text-xs truncate max-w-[100px]">{row.notes}</td>
                          </>
                        )}
                        
                        <td className="px-2 py-1">
                          <div className="flex items-center justify-center gap-1">
                            {row.error && (
                              <span className="text-xs text-[hsl(var(--danger))] whitespace-nowrap">{row.error}</span>
                            )}
                            {row.isDuplicate && !row.error && (
                              <span className="text-[hsl(var(--warning))]" title="Duplicate">
                                <Copy className="h-3 w-3" />
                              </span>
                            )}
                            <button
                              onClick={() => toggleRowEditing(row.row)}
                              className="p-1 hover:bg-secondary rounded"
                              title={row.isEditing ? 'Save' : 'Edit'}
                            >
                              {row.isEditing ? <span className="text-[hsl(var(--success))]"><Check className="h-3 w-3" /></span> : <Edit2 className="h-3 w-3 text-muted-foreground" />}
                            </button>
                            <button
                              onClick={() => deleteRow(row.row)}
                              className="p-1 hover:bg-secondary rounded"
                              title="Delete"
                            >
                              <span className="text-[hsl(var(--danger))]"><Trash2 className="h-3 w-3" /></span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('input')}
                className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading || selectedCount === 0}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${selectedCount} Transactions`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && importResult && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[hsl(var(--success)/0.1)] p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--success))]">{importResult.inserted}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--warning)/0.1)] p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--warning))]">{importResult.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicates</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--danger)/0.1)] p-3 text-center">
                <p className="text-lg font-bold text-[hsl(var(--danger))]">{importResult.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="rounded-xl bg-secondary p-3 text-center">
                <p className="text-lg font-bold text-foreground">{importResult.inserted + importResult.duplicates + importResult.failed}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Errors</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-[hsl(var(--danger))] bg-[hsl(var(--danger)/0.05)] rounded-lg px-2 py-1">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicates */}
            {importResult.duplicateDetails && importResult.duplicateDetails.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Duplicates Skipped
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.duplicateDetails.map((dup, i) => (
                    <div key={i} className="text-xs text-muted-foreground bg-secondary rounded-lg px-2 py-1">
                      Row {dup.row}: {dup.particulars} - ₹{dup.amount} ({dup.date})
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
