'use client'

/**
 * ユニフォーム一覧（/kits/）の絞り込み・並び替え（ブラウザ側で動く部分）。
 *
 * ★URLは変えません。★
 *   条件ごとに ?club=… のようなURLを作ると、中身がほぼ同じページが
 *   検索エンジンから見えてしまうためです。絞り込みはこの画面の中だけで行います。
 *
 * ★絞り込みの操作部分は、JavaScriptが動いてから表示します。★
 *   書き出したHTML（検索エンジンやJavaScriptが無い環境で見える部分）には
 *   全件の一覧だけが入り、押しても動かないボタンは入りません。
 *
 * ★選ぶと0件になる選択肢は出しません。★（src/lib/kits.ts の buildKitsFacets）
 */

import { useEffect, useMemo, useState } from 'react'
import { ProductGrid } from '@/components/product/ProductGrid'
import type { ProductView } from '@/data/viewModels'
import {
  EMPTY_KITS_FILTER,
  KITS_SORT_LABEL,
  buildKitsFacets,
  countKitsIgnoring,
  filterKits,
  normalizeKitsFilter,
  sortKits,
  type KitsFacetKey,
  type KitsFilter,
  type KitsSortKey,
} from '@/lib/kits'

export function KitsBrowser({ kits }: { kits: ProductView[] }) {
  const [filter, setFilter] = useState<KitsFilter>(EMPTY_KITS_FILTER)
  const [sort, setSort] = useState<KitsSortKey>('club')
  const [ready, setReady] = useState(false)

  useEffect(() => setReady(true), [])

  const facets = useMemo(() => buildKitsFacets(kits, filter), [kits, filter])
  const shown = useMemo(() => sortKits(filterKits(kits, filter), sort), [kits, filter, sort])
  const active = Object.values(filter).some((value) => value !== null)

  const change = (key: KitsFacetKey, value: string) => {
    setFilter((current) => normalizeKitsFilter(kits, { ...current, [key]: value === '' ? null : value }, key))
  }

  return (
    <>
      {ready ? (
        <form
          className="kits-filter"
          aria-label="ユニフォームの絞り込みと並び替え"
          onSubmit={(event) => event.preventDefault()}
        >
          {facets.map((facet) => (
            <label key={facet.key} className="kits-filter__field">
              {facet.label}
              <select value={filter[facet.key] ?? ''} onChange={(event) => change(facet.key, event.target.value)}>
                <option value="">すべて（{countKitsIgnoring(kits, filter, facet.key)}点）</option>
                {facet.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}（{option.count}点）
                  </option>
                ))}
              </select>
            </label>
          ))}

          <label className="kits-filter__field">
            並び順
            <select value={sort} onChange={(event) => setSort(event.target.value as KitsSortKey)}>
              {(Object.keys(KITS_SORT_LABEL) as KitsSortKey[]).map((key) => (
                <option key={key} value={key}>
                  {KITS_SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          {active ? (
            <button
              type="button"
              className="button button--outline kits-filter__reset"
              onClick={() => setFilter(EMPTY_KITS_FILTER)}
            >
              条件をクリア
            </button>
          ) : null}
        </form>
      ) : null}

      {/* 件数の変化を読み上げソフトへ伝える */}
      <p aria-live="polite" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {active ? `${kits.length}点中 ${shown.length}点を表示しています。` : `${shown.length}点を表示しています。`}
      </p>

      <ProductGrid
        views={shown}
        headingLevel="h3"
        showStore
        priorityCount={4}
        emptyMessage="条件に合うユニフォームはありません。条件をクリアしてお試しください。"
      />
    </>
  )
}
