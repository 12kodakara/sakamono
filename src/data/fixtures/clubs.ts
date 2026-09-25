/**
 * クラブの fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 *
 * 第1段階（MVP）は以下の4クラブで始めました。
 *   Liverpool / Tottenham Hotspur / FC Barcelona / Real Madrid
 *
 * その後、公式一次情報で確認できた商品があるクラブを足しています。
 *   Paris Saint-Germain（2026-09-25 追加。リーグ・アンの最初のクラブ）
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
  {
    // 公式確認: パリ・サンジェルマン公式サイト（psg.fr）が案内している公式ストアを確認（2026-09-25）。
    id: 'club-psg',
    leagueId: 'league-ligue-1',
    slug: 'paris-saint-germain',
    name: 'Paris Saint-Germain',
    nameJa: 'パリ・サンジェルマン',
    country: 'フランス',
    officialStoreUrl: 'https://store.psg.fr/',
    displayOrder: 5,
    active: true,
  },
]
