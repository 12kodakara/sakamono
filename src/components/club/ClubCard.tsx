/**
 * クラブカード。
 *
 * エンブレム画像は権利確認が済んでいないため使わない。
 * 代わりにクラブ名の頭文字とクラブカラーの四角で見分けられるようにしている。
 *
 * クラブが100件規模へ増えてもレイアウトが壊れないよう、
 * 幅は固定せずグリッド（.card-grid）に任せている。
 */

import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ClubSummary } from '@/data/viewModels'
import { getClubAccentColor } from '@/lib/clubColors'

export function ClubCard({ summary }: { summary: ClubSummary }) {
  const { club, league, productCount, href } = summary

  // CSS変数はReactの型に無いので、ここだけキャストして渡す
  const style = { '--club-color': getClubAccentColor(club.slug) } as CSSProperties

  return (
    <Link href={href} className="club-card" style={style}>
      <span className="club-card__mark" aria-hidden="true">
        {club.name.charAt(0)}
      </span>
      <span className="club-card__text">
        <span className="club-card__name">{club.nameJa}</span>
        <span className="club-card__meta">
          {league.nameJa}・{productCount}件
        </span>
      </span>
    </Link>
  )
}
