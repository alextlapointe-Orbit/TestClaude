import type { CongestionLevel } from '@/types'
import clsx from 'clsx'

interface Props {
  level: CongestionLevel
  size?: 'sm' | 'md'
}

const CONFIG: Record<CongestionLevel, { label: string; className: string; dot: string }> = {
  low: { label: 'Low', className: 'badge-low', dot: 'bg-emerald-400' },
  medium: { label: 'Medium', className: 'badge-medium', dot: 'bg-amber-400' },
  high: { label: 'High', className: 'badge-high', dot: 'bg-orange-400' },
  critical: { label: 'Critical', className: 'badge-critical', dot: 'bg-red-400 animate-pulse' },
}

export default function CongestionBadge({ level, size = 'sm' }: Props) {
  const { label, className, dot } = CONFIG[level] || CONFIG.low
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5', className, size === 'sm' ? 'text-[11px]' : 'text-xs font-medium')}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}
