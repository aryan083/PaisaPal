import { useStore } from '@/store'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TransactionSchema, type TransactionInput } from '@/lib/schemas'
import { getAvailableCategories } from '@/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { formatToastMessage, getUserError } from '@/lib/userError'
import { toLocalDateKey } from '@/lib/utils'

export function TransactionForm() {
  const { settings, formOpen, closeForm, editingTransaction, addTransaction, updateTransaction } = useStore()
  const isEditing = !!editingTransaction

  const categories = getAvailableCategories(settings)

  const form = useForm<TransactionInput>({
    resolver: zodResolver(TransactionSchema),
    defaultValues: {
      date: toLocalDateKey(new Date()),
      particulars: '',
      amount: 0,
      category: 'Other',
      mode: 'Online',
      notes: '',
    },
  })

  useEffect(() => {
    if (editingTransaction) {
      form.reset({
        date: toLocalDateKey(editingTransaction.date),
        particulars: editingTransaction.particulars,
        amount: editingTransaction.amount,
        category: editingTransaction.category,
        mode: editingTransaction.mode,
        notes: editingTransaction.notes,
      })
    } else {
      form.reset({
        date: toLocalDateKey(new Date()),
        particulars: '',
        amount: 0,
        category: 'Other',
        mode: 'Online',
        notes: '',
      })
    }
  }, [editingTransaction, formOpen, form])

  const onSubmit = async (data: TransactionInput) => {
    try {
      if (isEditing && editingTransaction) {
        await updateTransaction(editingTransaction.id, data)
        toast.success('Transaction updated')
      } else {
        await addTransaction({
          date: data.date,
          dateKey: data.date,
          particulars: data.particulars,
          amount: data.amount,
          category: data.category,
          mode: data.mode,
          notes: data.notes ?? '',
        })
        toast.success('Transaction added')
      }
      closeForm()
      form.reset()
    } catch (err) {
      const u = getUserError(err, 'Failed to save transaction')
      toast.error(formatToastMessage(u))
      console.error(err)
    }
  }

  return (
    <Sheet open={formOpen} onOpenChange={open => { if (!open) closeForm() }}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-display text-foreground">{isEditing ? 'Edit Transaction' : 'Add Transaction'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 mt-6">
          {/* Date */}
          <div>
            <label htmlFor="date" className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
            <input
              id="date"
              type="date"
              {...form.register('date')}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            {form.formState.errors.date && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.date.message}</p>
            )}
          </div>

          {/* Particulars */}
          <div>
            <label htmlFor="particulars" className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <input
              id="particulars"
              {...form.register('particulars')}
              placeholder="What did you spend on?"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            {form.formState.errors.particulars && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.particulars.message}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="text-xs font-medium text-muted-foreground mb-1 block">Amount (₹)</label>
            <input
              id="amount"
              type="number"
              step="1"
              {...form.register('amount', { valueAsNumber: true })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
            <select
              id="category"
              {...form.register('category')}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Payment Mode</label>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <div className="flex gap-2">
                  {(['Online', 'Cash', 'Card'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => field.onChange(m)}
                      className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                        field.value === m
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
            <textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Any extra details..."
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!form.formState.isValid}
            className="mt-2 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update Transaction' : 'Add Transaction'}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
