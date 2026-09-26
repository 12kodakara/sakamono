/**
 * 商品ページの「買いに行く先」を1つだけ決める。
 *
 * ══════════════════════════════════════════════════════════
 * ★なぜこれが必要か★
 *
 *   商品ページの購入ボタンは、掲載データの URL をそのまま使っていました。
 *   開発用の掲載はすべて example.com（仕様書用に予約されたドメイン）を指すため、
 *   購入するつもりで押した人が、どこにも行き着かない状態でした。
 *   商品ページ25件のうち、
 *     ・9件は example.com へのボタンがある
 *     ・16件は外部へのリンクが1つも無い（公式確認済みの商品13件を含む）
 *   という状態で、外へ出る道が1本もありませんでした。
 *
 *   一方で、クラブの公式ストアURLは公式サイトで確認済みのものが揃っていて、
 *   メーカー品番も公式の商品ページで確認したものが揃っています。
 *   この2つを使えば、買う人は実際に商品までたどり着けます。
 *
 * ★やらないこと★
 *   ・URLを組み立てて「商品ページ」のふりをさせない（推測URLは作らない）
 *   ・アフィリエイトリンクを勝手に作らない（提携していないため）
 *   ・行き先が無いときに、あるように見せない
 *
 * ★行き先の決め方（上から順に採用）★
 *   1. 掲載データに本物の商品URLがある      → そこへ送る
 *   2. クラブの公式ストアURLが分かっている  → ストアへ送り、品番で探してもらう
 *   3. どちらも無い                          → ボタンを出さない
 *
 *   将来アフィリエイトの提携ができたときは、この関数の1と2の行き先を
 *   差し替えるだけで済みます（ボタンの場所を1か所にまとめてあります）。
 * ══════════════════════════════════════════════════════════
 */

/**
 * 実在しないことが決まっているドメイン（RFC 2606 / RFC 6761 の予約ドメイン）。
 * 開発用の掲載データはここを指しています。
 */
const RESERVED_EXAMPLE_HOSTS = ['example.com', 'example.org', 'example.net', 'example.edu']

/** そのURLが「本当に買える商品ページ」として使えるか。 */
export function isRealStoreUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  // http は送らない（外部サイトへ平文で飛ばさない）
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  return !RESERVED_EXAMPLE_HOSTS.some((reserved) => host === reserved || host.endsWith(`.${reserved}`))
}

export type PurchaseLinkKind =
  /** 掲載データの商品URLへ送る。 */
  | 'listing'
  /** クラブ公式ストアのトップへ送り、品番で探してもらう。 */
  | 'official-store'
  /** 送れる先が無い。 */
  | 'none'

export interface PurchaseLink {
  kind: PurchaseLinkKind
  /** kind が 'none' のときは null。 */
  href: string | null
  /** ボタンの文字。押したあと何が起きるか分かる言い方にする。 */
  label: string | null
  /**
   * ボタンの下に出す補足。
   * 商品ページURLではないときは、そのことを隠さずに書く。
   */
  note: string | null
}

export interface PurchaseLinkInput {
  /** クラブの日本語名（ボタンの文字に使う）。 */
  clubNameJa: string
  /** 公式確認済みのクラブ公式ストアURL。無ければ null。 */
  officialStoreUrl: string | null
  /** 採用した海外掲載の商品URL。無ければ null。 */
  listingUrl: string | null
  /** その掲載のストア名。無ければ null。 */
  listingStoreName: string | null
  /** メーカー品番。公式確認できていなければ null。 */
  productCode: string | null
}

export function buildPurchaseLink(input: PurchaseLinkInput): PurchaseLink {
  const { clubNameJa, officialStoreUrl, listingUrl, listingStoreName, productCode } = input

  // 1. 掲載データに本物の商品URLがあれば、それが一番近い
  if (isRealStoreUrl(listingUrl) && listingStoreName) {
    return {
      kind: 'listing',
      href: listingUrl,
      label: `${listingStoreName}で見る`,
      note: null,
    }
  }

  // 2. クラブ公式ストアへ送る（商品ページURLは分かっていないと明記する）
  if (isRealStoreUrl(officialStoreUrl)) {
    return {
      kind: 'official-store',
      href: officialStoreUrl,
      label: `${clubNameJa}公式ストアで探す`,
      note: productCode
        ? `この商品ページのURLは確認できていません。公式ストアで品番「${productCode}」を検索してください。`
        : 'この商品ページのURLは確認できていません。公式ストアで商品名から探してください。',
    }
  }

  // 3. 送れる先が無いときは、あるように見せない
  return { kind: 'none', href: null, label: null, note: null }
}
