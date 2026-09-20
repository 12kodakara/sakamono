/**
 * クラブの識別色（表示の都合の情報）。
 *
 * ドメインモデル（Club型）へは入れていない。
 * 「そのクラブがどんなクラブか」ではなく「画面でどう見分けるか」の情報であり、
 * データの出どころが変わっても影響を受けないため。
 *
 * エンブレム画像は権利確認が済んでいないため使わず、この色と頭文字で見分ける。
 * 色そのものは著作物ではないので、識別の手掛かりとして使える。
 *
 * キーは Club['slug']。未登録のクラブは既定色になるので、
 * クラブが増えてもここへ足し忘れて壊れることはない。
 */

export const CLUB_ACCENT_COLORS: Record<string, string> = {
  liverpool: '#c8102e',
  tottenham: '#132257',
  'fc-barcelona': '#a50044',
  'real-madrid': '#00529f',
}

/** クラブカラーが未登録の場合に使う色（サイトのブランドカラー）。 */
export const DEFAULT_CLUB_ACCENT = '#0f5f4a'

export function getClubAccentColor(clubSlug: string): string {
  return CLUB_ACCENT_COLORS[clubSlug] ?? DEFAULT_CLUB_ACCENT
}
