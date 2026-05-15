import { useMemo, useState } from 'react'
import Button from './Button'

export type LayoutWidth = 1 | 2 | 3

export interface LayoutCardItem {
  id: string
  title: string
  description: string
  visible: boolean
  width: LayoutWidth
}

interface CardLayoutManagerProps {
  open: boolean
  title: string
  subtitle?: string
  items: LayoutCardItem[]
  onChange: (items: LayoutCardItem[]) => void
  onClose: () => void
  onReset?: () => void
}

function reorder<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  if (sourceId === targetId) return items
  const sourceIndex = items.findIndex((item) => item.id === sourceId)
  const targetIndex = items.findIndex((item) => item.id === targetId)
  if (sourceIndex < 0 || targetIndex < 0) return items

  const next = [...items]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}

export default function CardLayoutManager({
  open,
  title,
  subtitle,
  items,
  onChange,
  onClose,
  onReset,
}: CardLayoutManagerProps) {
  const [dragId, setDragId] = useState<string | null>(null)

  const hiddenCount = useMemo(
    () => items.filter((item) => !item.visible).length,
    [items],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/30"
        aria-label="Close layout editor"
        onClick={onClose}
      />
      <aside className="h-full w-full max-w-xl border-l border-gray-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
              </div>
              <Button size="sm" variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">
                {items.length - hiddenCount} visible
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-1">
                {hiddenCount} hidden
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                Drag rows to reorder
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragId(item.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!dragId || dragId === item.id) return
                  onChange(reorder(items, dragId, item.id))
                  setDragId(null)
                }}
                onDragEnd={() => setDragId(null)}
                className={`rounded-xl border bg-white p-3 shadow-sm transition-colors ${
                  dragId === item.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 cursor-grab select-none text-gray-400" title="Drag to reorder" aria-hidden="true">
                    <span className="block leading-3">::</span>
                    <span className="block leading-3">::</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={item.visible}
                          onChange={() => {
                            onChange(items.map((current) =>
                              current.id === item.id ? { ...current, visible: !current.visible } : current,
                            ))
                          }}
                        />
                        Visible
                      </label>

                      <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                        {[1, 2, 3].map((value) => {
                          const width = value as LayoutWidth
                          const selected = item.width === width
                          return (
                            <button
                              key={`${item.id}-${width}`}
                              type="button"
                              onClick={() => {
                                onChange(items.map((current) =>
                                  current.id === item.id ? { ...current, width } : current,
                                ))
                              }}
                              className={`px-2 py-1 text-xs transition-colors ${
                                selected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                              title={width === 1 ? 'Small' : width === 2 ? 'Medium' : 'Large'}
                            >
                              {width}
                            </button>
                          )
                        })}
                      </div>

                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                          disabled={index === 0}
                          onClick={() => {
                            if (index === 0) return
                            const next = [...items]
                            const [moved] = next.splice(index, 1)
                            next.splice(index - 1, 0, moved)
                            onChange(next)
                          }}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 disabled:opacity-40"
                          disabled={index === items.length - 1}
                          onClick={() => {
                            if (index === items.length - 1) return
                            const next = [...items]
                            const [moved] = next.splice(index, 1)
                            next.splice(index + 1, 0, moved)
                            onChange(next)
                          }}
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">Card size: 1=Small, 2=Medium, 3=Large</p>
              {onReset && (
                <Button size="sm" variant="secondary" onClick={onReset}>
                  Reset Defaults
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
