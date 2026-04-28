import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface Props {
  stats: Stats | null
  variant?: 'card' | 'embed'
}

export function PaymentModeSplit({ stats, variant = 'card' }: Props) {
  const online = stats?.byMode.Online ?? 0
  const cash = stats?.byMode.Cash ?? 0
  const card = stats?.byMode.Card ?? 0

  const total = online + cash + card
  const onlinePct = total > 0 ? Math.round((online / total) * 100) : 0
  const cashPct = total > 0 ? Math.round((cash / total) * 100) : 0
  const cardPct = Math.max(0, 100 - onlinePct - cashPct)

  const content = (
    <>
      <h3 className="text-display text-sm font-semibold text-foreground mb-4">Payment Mode</h3>
      <div className="h-3 rounded-full bg-secondary overflow-hidden flex">
        {onlinePct > 0 && (
          <div className="h-full bg-primary transition-all" style={{ width: `${onlinePct}%` }} />
        )}
        {cashPct > 0 && (
          <div
            className="h-full bg-[hsl(var(--warning))] transition-all"
            style={{ width: `${cashPct}%` }}
          />
        )}
        {cardPct > 0 && (
          <div
            className="h-full bg-[hsl(var(--success))] transition-all"
            style={{ width: `${cardPct}%` }}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
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
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
          <span className="text-muted-foreground">Card {cardPct}%</span>
          <span className="font-medium text-foreground">{formatCurrency(card)}</span>
        </div>
      </div>
    </>
  )

  if (variant === 'embed') return content

  return <div className="card-base p-5">{content}</div>
}
