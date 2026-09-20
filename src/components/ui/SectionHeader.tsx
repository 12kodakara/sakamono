/**
 * セクションの見出し。
 *
 * 見出しレベル（h2 / h3）を指定できるようにしてある。
 * 見た目のためにレベルを飛ばすと、読み上げソフトでの構造が崩れるため。
 */

import Link from 'next/link'
import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** 「もっと見る」リンク。 */
  moreHref?: string
  moreLabel?: string
  /** 見出しレベル。既定は h2。 */
  as?: 'h2' | 'h3'
  /** 見出しに付けるid（aria-labelledby から参照する）。 */
  id?: string
}

export function SectionHeader({
  title,
  description,
  moreHref,
  moreLabel = 'すべて見る',
  as: Heading = 'h2',
  id,
}: SectionHeaderProps) {
  return (
    <div className="section__header">
      <Heading className="section__title" id={id}>
        {title}
      </Heading>
      {moreHref ? (
        <Link href={moreHref} className="section__more">
          {moreLabel} →
        </Link>
      ) : null}
      {description ? <p className="section__description">{description}</p> : null}
    </div>
  )
}
