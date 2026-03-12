import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
}

export function PaymentModeSplit({ stats }: Props) {
  const online = stats?.byMode.Online ?? 0
  const cash = stats?.byMode.Cash ?? 0
  const total = online + cash
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0
  const cashPct = 100 - onlinePct

  return (
    <div className="card-base p-5">
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Payment Mode</h3>
      <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
        {onlinePct > 0 && <div className="h-full bg-primary rounded-l-full transition-all" style={{ width: `${onlinePct}%` }} />}
        {cashPct > 0 && <div className="h-full bg-[hsl(var(--warning))] rounded-r-full transition-all" style={{ width: `${cashPct}%` }} />}
      </div>
      <div className="mt-3 flex justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Online {onlinePct}%</span>
          <span className="font-medium text-foreground">{formatCurrency(online)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
          <span className="text-muted-foreground">Cash {cashPct}%</span>
          <span className="font-medium text-foreground">{formatCurrency(cash)}</span>
        </div>
      </div>
    </div>
  )
}
