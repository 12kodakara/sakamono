/**
 * sitemap.xml に載せるURLの選び方。
 *
 * ══════════════════════════════════════════════════════════
 * ★「生成されているページを全部載せる」をやめた理由★
 *
 *   sitemap は「このページを見てほしい」という検索エンジンへの申告です。
 *   中身の無いページまで申告すると、サイト全体が薄いと見なされ、
 *   本当に見てほしいページの評価まで下がります。
 *
 *   SEO監査で見つかった、申告すべきでないページ:
 *     ・所属クラブも商品も無いリーグ（「準備中です」だけのページ）
 *     ・海外価格も国内価格も無い商品（比べる数字が1つも無いページ）
 *
 *   ★ページそのものは消しません。★
 *   リンクからは今までどおり見られます。sitemap に載せないだけです。
 *   データが入れば、コードを直さなくても自動で載るようになります。
 * ══════════════════════════════════════════════════════════
 *
 * ★この関数はデータを受け取って結果を返すだけです。★
 *   データの取得は src/app/sitemap.ts が行います。
 *   こうしておくと、実データを使わずにテストできます。
 */

import { normalizePath } from './seo'

/* ------------------------------------------------------------
 * 入力（repository から渡すものの最小限の形）
 * ---------------------------------------------------------- */

export interface SitemapLeagueInput {
  slug: string
  clubCount: number
  productCount: number
}

export interface SitemapClubInput {
  slug: string
  productCount: number
}

export interface SitemapProductInput {
  /** 商品ページのパス（'/products/xxx/'）。 */
  href: string
  /** 海外価格（日本到着推定額の元）があるか。 */
  hasOverseasPrice: boolean
  /** 審査を通った国内価格があるか。 */
  hasDomesticPrice: boolean
}

export interface SitemapInput {
  /** 公開URLの土台（末尾スラッシュなし）。例: https://12kodakara.github.io/sakamono */
  siteUrl: string
  leagues: SitemapLeagueInput[]
  clubs: SitemapClubInput[]
  products: SitemapProductInput[]
  /** セール中の商品数（0ならセール一覧を載せない）。 */
  saleCount: number
  /** 価格差ランキングに載る商品数（0ならランキングを載せない）。 */
  rankingCount: number
  /**
   * 全クラブ横断のユニフォーム一覧（/kits/）の中身。
   * 省略したときは載せない。
   */
  kits?: SitemapKitsInput
}

export interface SitemapKitsInput {
  /** 掲載しているユニフォームの数。 */
  kitCount: number
  /** ユニフォームを掲載しているクラブの数。 */
  clubCount: number
}

/* ------------------------------------------------------------
 * 出力
 * ---------------------------------------------------------- */

export type SitemapPageKind =
  | 'top'
  | 'index'
  | 'league'
  | 'club'
  | 'product'
  | 'listing'
  | 'static'

export interface SitemapEntry {
  url: string
  kind: SitemapPageKind
  changeFrequency: 'daily' | 'weekly'
  priority: number
}

/* ------------------------------------------------------------
 * URLの組み立て
 * ---------------------------------------------------------- */

/**
 * サイト内のパスを、sitemap に載せる絶対URLへ直す。
 *
 * ★canonical と同じ形にそろえます。★
 *   canonical は src/lib/seo.ts の `${SITE_URL}${normalizePath(path)}` で作っています。
 *   同じ normalizePath を通すので、末尾スラッシュの付け方が食い違いません。
 *
 *   ・先頭スラッシュあり・末尾スラッシュあり（trailingSlash: true と同じ）
 *   ・各区切りはURLエンコード（いまのslugは英小文字とハイフンだけなので変化なし）
 *   ・siteUrl の末尾スラッシュは取り除く（'//' を作らない）
 */
export function toSitemapUrl(siteUrl: string, path: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  const normalized = normalizePath(path)
  const encoded = normalized.split('/').map(encodeSegment).join('/')
  return `${base}${encoded}`
}

/**
 * パスの1区切りをURLエンコードする。
 *
 * すでにエンコード済みの区切り（'%E3%83%AA' など）を二重に
 * エンコードしないよう、一度戻してからエンコードします。
 * 戻せない不正な '%' を含む場合は、そのままエンコードします。
 */
function encodeSegment(segment: string): string {
  if (!segment) return segment
  try {
    return encodeURIComponent(decodeURIComponent(segment))
  } catch {
    return encodeURIComponent(segment)
  }
}

/* ------------------------------------------------------------
 * 掲載の判断
 *
 * ★この判定は robots meta（index / noindex）でも使います。★
 *   「sitemap に載せない＝検索に出す価値が無い」ページは、
 *   各ページの generateMetadata でも noindex にしています。
 *   判定を1か所にしておかないと、sitemap には無いのに index される
 *   （またはその逆の）食い違いが起きます。
 * ---------------------------------------------------------- */

/** 所属クラブも商品も無いリーグは、「準備中です」だけのページになる。 */
export function isLeagueListable(league: SitemapLeagueInput): boolean {
  return league.clubCount > 0 && league.productCount > 0
}

/** 商品が1つも無いクラブは、一覧も比較も表示できない。 */
export function isClubListable(club: SitemapClubInput): boolean {
  return club.productCount > 0
}

/**
 * 比べる数字が1つでもある商品だけを載せる。
 *
 * ★どちらも無い商品ページは「確認できていません」が並ぶだけです。★
 *   価格比較サイトの商品ページとして、検索から来た人に見せる中身がありません。
 */
export function isProductListable(product: SitemapProductInput): boolean {
  return product.hasOverseasPrice || product.hasDomesticPrice
}

/**
 * 全クラブ横断のユニフォーム一覧（/kits/）を載せるか。
 *
 * ★ユニフォームのあるクラブが2つ以上のときだけ★。
 *   1クラブだけなら、そのクラブのページとほぼ同じ中身になり、
 *   「クラブ横断で探す」ページとしての意味がないためです。
 */
export function isKitsIndexListable(kits: SitemapKitsInput): boolean {
  return kits.kitCount > 0 && kits.clubCount >= 2
}

/**
 * sitemap に載せるURLの一覧を作る。
 *
 * changeFrequency / priority は変更前の値をそのまま引き継いでいます
 * （Googleはこの2つをほぼ参照しないため、今回は見直していません）。
 *
 * ★載せないもの★
 *   ・/search/            … 検索語で中身が変わる。ページ側も noindex
 *   ・クエリ付きURL        … 同じページの重複になる
 *   ・404 / _not-found    … エラーページ
 *   ・中身の無いリーグ・クラブ・商品（上の判定関数を参照）
 *
 * ★同じURLは1回だけ載せます。★
 */
export function buildSitemapEntries(input: SitemapInput): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  const seen = new Set<string>()

  const add = (
    path: string,
    kind: SitemapPageKind,
    changeFrequency: SitemapEntry['changeFrequency'],
    priority: number,
  ) => {
    const url = toSitemapUrl(input.siteUrl, path)
    if (seen.has(url)) return
    seen.add(url)
    entries.push({ url, kind, changeFrequency, priority })
  }

  /* ---- トップ ---- */
  add('/', 'top', 'daily', 1)

  /* ---- 一覧（クラブ・リーグを探す入口）---- */
  add('/clubs/', 'index', 'daily', 0.7)
  add('/leagues/', 'index', 'daily', 0.7)

  /* ---- リーグ ---- */
  for (const league of input.leagues.filter(isLeagueListable)) {
    add(`/leagues/${league.slug}/`, 'league', 'weekly', 0.6)
  }

  /* ---- クラブ ---- */
  for (const club of input.clubs.filter(isClubListable)) {
    add(`/clubs/${club.slug}/`, 'club', 'daily', 0.8)
  }

  /* ---- 商品 ---- */
  for (const product of input.products.filter(isProductListable)) {
    add(product.href, 'product', 'daily', 0.9)
  }

  /* ---- 集計ページ（掲載する商品があるときだけ）---- */
  if (input.kits && isKitsIndexListable(input.kits)) add('/kits/', 'listing', 'daily', 0.7)
  if (input.saleCount > 0) add('/sale/', 'listing', 'daily', 0.7)
  if (input.rankingCount > 0) add('/rankings/', 'listing', 'daily', 0.7)

  /* ---- 静的ページ ---- */
  add('/about/', 'static', 'daily', 0.7)

  return entries
}
