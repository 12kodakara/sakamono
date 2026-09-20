/**
 * リーグカード。
 *
 * リーグロゴは権利確認が済んでいないため使わず、
 * 日本語名・英語名・件数のテキストだけで構成している。
 */

import Link from 'next/link'
import type { LeagueSummary } from '@/data/viewModels'

export function LeagueCard({ summary }: { summary: LeagueSummary }) {
  const { league, clubCount, productCount, href } = summary

  return (
    <Link href={href} className="league-card">
      <span className="league-card__name">{league.nameJa}</span>
      <span className="league-card__name-en">{league.name}</span>
      <span className="league-card__meta">
        {league.country}・{clubCount}クラブ・{productCount}件
      </span>
    </Link>
  )
}
