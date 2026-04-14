import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-slate-200">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-400 max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
