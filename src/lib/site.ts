/**
 * サイト全体で使う定数。
 *
 * サイト名やナビゲーションをここへまとめ、各ページで書き写さないようにする。
 */

export const SITE_NAME = 'サカモノ'
export const SITE_TAGLINE = '海外サッカーグッズ、日本までいくら？'
export const SITE_DESCRIPTION =
  '海外クラブ公式ストアのサッカーグッズを、国際送料や輸入コストを含んだ「日本到着推定額」で国内価格と比較できるサイトです。'

/**
 * 公開URL。canonical・OGP・sitemap で使う。
 * .env.local の NEXT_PUBLIC_SITE_URL で上書きできる。
 * 末尾のスラッシュは付けない。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com').replace(
  /\/+$/,
  '',
)

/**
 * 開発版（プレビュー）として公開しているか。
 *
 * ══════════════════════════════════════════════════════════
 * ★既定は「開発版」です。★
 *
 *   開発版のあいだは、検索エンジンに登録させません。
 *   テストデータ混じりのページが「サカモノ」として先に登録されると、
 *   本番公開のときに上書きするのに手間がかかります。
 *
 *   ★既定を「本番」にしないのは、付け忘れの向きが違うからです。★
 *     既定が本番だと、設定を忘れた開発版が検索結果に出てしまいます（戻しにくい）。
 *     既定が開発版だと、設定を忘れた本番が登録されないだけです（あとから直せる）。
 *     間違えたときに軽いほうを既定にしています。
 *
 * ── 本番公開するとき ──────────────────────────────
 *   .env.local（またはデプロイ環境の環境変数）へ次の1行を足すだけです。
 *
 *     NEXT_PUBLIC_SITE_PREVIEW=false
 *
 *   これで noindex が外れ、robots.txt もクロール許可へ変わります。
 * ══════════════════════════════════════════════════════════
 */
export const IS_PREVIEW = (process.env.NEXT_PUBLIC_SITE_PREVIEW ?? 'true') !== 'false'

/**
 * サイトを置く場所のパス（先頭スラッシュあり・末尾スラッシュなし）。
 *
 * ══════════════════════════════════════════════════════════
 * ★ハードコードしないための1か所★
 *
 *   置き場所によって前に付くパスが変わります。
 *
 *     ローカル開発            ''            → /clubs/
 *     GitHub Pages（project） '/sakamono'   → /sakamono/clubs/
 *     将来の独自ドメイン       ''            → /clubs/
 *
 *   ★'/sakamono' をソースへ直接書かないこと。★
 *     独自ドメインへ移したときに、書いた分だけ消して回ることになります。
 *     置き場所を変えるのは環境変数1つで済ませます。
 *
 * ── next/link と /_next/ は自動 ──────────────────────
 *   next.config.ts の basePath を設定すれば、
 *   <Link> のリンク先と /_next/ のCSS・JSはNext.jsが自動で前置きします。
 *   手で直す必要はありません（約1,700箇所）。
 *
 * ── ★自動にならないもの★ ────────────────────────────
 *   生の <img src="/images/..."> はNext.jsの対象外です。
 *   そこだけ assetPath() を通します。
 * ══════════════════════════════════════════════════════════
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '')

/**
 * public/ に置いた静的ファイルのURLを作る。
 *
 * ★データ側は '/images/foo.svg' のまま持たせます。★
 *   置き場所は表示のときに決まるものなので、
 *   fixtureや取り込み結果に '/sakamono/' を混ぜません。
 *   データを作り直さずに引っ越せるようにするためです。
 */
export function assetPath(path: string): string {
  // 外部URLやデータURIはそのまま
  if (!path.startsWith('/')) return path
  return `${BASE_PATH}${path}`
}

export interface NavItem {
  href: string
  label: string
}

/** ヘッダーのナビゲーション。 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'ホーム' },
  { href: '/clubs/', label: 'クラブから探す' },
  { href: '/leagues/', label: 'リーグから探す' },
  { href: '/sale/', label: 'セール情報' },
  { href: '/rankings/', label: '価格差ランキング' },
  { href: '/about/', label: 'このサイトについて' },
]
