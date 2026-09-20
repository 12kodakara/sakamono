/**
 * クラブの fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 *
 * 第1段階（MVP）で表示するのは以下の4クラブだけです。
 *   Liverpool / Tottenham Hotspur / FC Barcelona / Real Madrid
 *
 * 最終的には約100クラブ規模を想定しています。
 * クラブを増やすときはこの配列へ追加するだけでよく、
 * 一覧・クラブページ・リーグページのレイアウトは自動で追従します
 * （件数が増えても崩れないグリッドで組んであります）。
 *
 * ■ エンブレムについて
 *   クラブエンブレムは権利確認が済んでいないため画像を持たせていません。
 *   画面ではクラブ名のテキストと、クラブカラーを使った汎用表示で代用します。
 *   色そのものは著作物ではないため、識別の手掛かりとして使っています。
 */

import type { Club } from '@/domain/types'

export const clubFixtures: Club[] = [
  {
    id: 'club-liverpool',
    leagueId: 'league-premier-league',
    slug: 'liverpool',
    name: 'Liverpool FC',
    nameJa: 'リヴァプール',
    country: 'イングランド',
    officialStoreUrl: 'https://store.liverpoolfc.com/',
    displayOrder: 1,
    active: true,
  },
  {
    id: 'club-tottenham',
    leagueId: 'league-premier-league',
    slug: 'tottenham',
    name: 'Tottenham Hotspur',
    nameJa: 'トッテナム・ホットスパー',
    country: 'イングランド',
    officialStoreUrl: 'https://shop.tottenhamhotspur.com/',
    displayOrder: 2,
    active: true,
  },
  {
    id: 'club-fc-barcelona',
    leagueId: 'league-la-liga',
    slug: 'fc-barcelona',
    name: 'FC Barcelona',
    nameJa: 'FCバルセロナ',
    country: 'スペイン',
    officialStoreUrl: 'https://store.fcbarcelona.com/',
    displayOrder: 3,
    active: true,
  },
  {
    id: 'club-real-madrid',
    leagueId: 'league-la-liga',
    slug: 'real-madrid',
    name: 'Real Madrid CF',
    nameJa: 'レアル・マドリード',
    country: 'スペイン',
    officialStoreUrl: 'https://shop.realmadrid.com/',
    displayOrder: 4,
    active: true,
  },
]
