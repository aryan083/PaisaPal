import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Upload, Eye, Copy } from 'lucide-react'
import { importTransactionsCsv, type ImportResult } from '@/lib/api'

const EXPECTED_HEADERS = ['Date', 'Particulars', 'Amount paid', 'Total expenses', 'Mode of payment', 'Notes', 'Category']

interface BulkImportProps {
  open: boolean
  onClose: () => void
}

export function BulkImport({ open, onClose }: BulkImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [step, setStep] = useState<'input' | 'result'>('input')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
    }
  }

  const handleDryRun = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    try {
      setLoading(true)
      const result = await importTransactionsCsv(file, { dryRun: true })
      setImportResult(result)
      setStep('result')
      if (result.duplicates > 0) {
        toast.info(`Found ${result.duplicates} potential duplicates`)
      } else {
        toast.success(`Ready to import ${result.inserted} transactions`)
      }
    } catch (err) {
      toast.error('Failed to preview import')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    try {
      setLoading(true)
      const result = await importTransactionsCsv(file, { skipDuplicates })
      setImportResult(result)
      setStep('result')
      toast.success(`Imported ${result.inserted} transactions`)
      if (result.duplicates > 0) {
        toast.info(`Skipped ${result.duplicates} duplicates`)
      }
    } catch (err) {
      toast.error('Failed to import transactions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setImportResult(null)
    setStep('input')
    onClose()
  }

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
                Upload a CSV file with your transactions. Expected columns:
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

            {/* File Upload */}
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
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

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipDuplicates"
                checked={skipDuplicates}
                onChange={e => setSkipDuplicates(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="skipDuplicates" className="text-sm text-muted-foreground">
                Skip duplicates (recommended)
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDryRun}
                disabled={loading || !file}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                <Eye className="h-4 w-4" /> Preview
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !file}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? 'Importing...' : 'Import'}
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
