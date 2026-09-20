/**
 * リーグの fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 * リーグ名・国名は事実に基づく情報ですが、このファイル自体は
 * 「第1段階で表示に使うデータ」であり、第2段階以降は
 * データ取得層（src/data/adapters/）からの供給へ置き換わります。
 *
 * ■ Bundesliga について
 *   本段階では対象外のため、このファイルに含めていません。
 *   「active: false で置いておく」のではなく行ごと存在させないことで、
 *   表示ロジックの取りこぼしで誤って出てしまう事故を防いでいます。
 *   将来対象へ加えるときは、ここへ1件追加するだけで全ページへ反映されます。
 *
 * ■ ロゴについて
 *   リーグロゴは権利確認が済んでいないため、画像は持たせていません。
 *   画面ではテキストと汎用的な表示で代用します。
 */

import type { League } from '@/domain/types'

export const leagueFixtures: League[] = [
  {
    id: 'league-premier-league',
    slug: 'premier-league',
    name: 'Premier League',
    nameJa: 'プレミアリーグ',
    country: 'イングランド',
    displayOrder: 1,
    active: true,
  },
  {
    id: 'league-la-liga',
    slug: 'la-liga',
    name: 'La Liga',
    nameJa: 'ラ・リーガ',
    country: 'スペイン',
    displayOrder: 2,
    active: true,
  },
  {
    id: 'league-serie-a',
    slug: 'serie-a',
    name: 'Serie A',
    nameJa: 'セリエA',
    country: 'イタリア',
    displayOrder: 3,
    active: true,
  },
  {
    id: 'league-ligue-1',
    slug: 'ligue-1',
    name: 'Ligue 1',
    nameJa: 'リーグ・アン',
    country: 'フランス',
    displayOrder: 4,
    active: true,
  },
  {
    id: 'league-eredivisie',
    slug: 'eredivisie',
    name: 'Eredivisie',
    nameJa: 'エールディヴィジ',
    country: 'オランダ',
    displayOrder: 5,
    active: true,
  },
]
