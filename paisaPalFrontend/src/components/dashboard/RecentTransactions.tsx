import { formatCurrency, formatDateShortWithWeekday } from '@/lib/utils'
import { CATEGORY_HEX, type Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
}

export function RecentTransactions({ transactions }: Props) {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Recent Transactions</h3>
      <div className="flex flex-col gap-2">
        {recent.length === 0 && <p className="text-xs text-muted-foreground">No transactions</p>}
        {recent.map(tx => (
          <div key={tx.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_HEX[tx.category] }} />
              <div className="overflow-hidden">
                <p className="text-xs text-foreground truncate">{tx.particulars}</p>
                <p className="text-[10px] text-muted-foreground">{formatDateShortWithWeekday(tx.date)}</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-foreground ml-2">{formatCurrency(tx.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
