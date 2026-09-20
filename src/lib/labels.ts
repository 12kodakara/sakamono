/**
 * 画面に出す日本語ラベル。
 *
 * 型（英語のキー）と表示（日本語）を分け、表記ゆれを防ぐ。
 * 新しいカテゴリを追加したときは、ここへラベルを足すのを忘れないこと
 * （Record 型にしてあるので、足し忘れると型エラーで気付ける）。
 */

import type {
  Authenticity,
  GenderTarget,
  KitType,
  ProductCategory,
  ShippingType,
  Store,
  StoreListing,
  StoreType,
  VariantAvailability,
} from '@/domain/types'

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  kits: 'ユニフォーム',
  training: 'トレーニングウェア',
  jackets: 'ジャケット',
  't-shirts': 'Tシャツ',
  hoodies: 'パーカー',
  scarves: 'マフラー',
  caps: 'キャップ',
  bags: 'バッグ',
  limited: '限定アイテム',
  collaboration: 'コラボアイテム',
  other: 'その他',
}

export const KIT_TYPE_LABEL: Record<NonNullable<KitType>, string> = {
  home: 'ホーム',
  away: 'アウェイ',
  third: 'サード',
  goalkeeper: 'ゴールキーパー',
  special: 'スペシャル',
  unknown: '種類未確認',
}

export const AUTHENTICITY_LABEL: Record<NonNullable<Authenticity>, string> = {
  replica: 'レプリカ',
  authentic: 'オーセンティック',
  // 判別できていない状態。「レプリカかオーセンティックか不明」とはっきり伝える。
  unknown: 'レプリカ／オーセンティック未確認',
}

export const GENDER_LABEL: Record<GenderTarget, string> = {
  men: 'メンズ',
  women: 'ウィメンズ',
  kids: 'キッズ',
  unisex: 'ユニセックス',
  unknown: '対象未確認',
}

export const STORE_TYPE_LABEL: Record<StoreType, string> = {
  official: '公式ストア',
  authorized: '正規取扱店',
  marketplace: 'モール',
  affiliate: '提携ストア',
}

export const SHIPPING_TYPE_LABEL: Record<ShippingType, string> = {
  direct: '日本へ直接配送',
  forwarder: '転送サービス利用',
  domestic: '国内配送',
  none: '日本への配送不可',
}

/** 商品カードの1行メタ表示（例: 「2025/26 ・ ホーム ・ レプリカ」）を組み立てる。 */
export function buildProductMetaLine(input: {
  season: string | null
  kitType: KitType
  authenticity: Authenticity
  category: ProductCategory
}): string {
  // シーズンが分からない商品もあるので、その場合は行から省く（推測で埋めない）
  const parts: string[] = input.season ? [input.season] : []

  if (input.kitType) {
    parts.push(KIT_TYPE_LABEL[input.kitType])
  } else {
    parts.push(CATEGORY_LABEL[input.category])
  }

  if (input.authenticity) parts.push(AUTHENTICITY_LABEL[input.authenticity])

  return parts.join('・')
}

/* ------------------------------------------------------------
 * 在庫（第3段階で追加）
 * ---------------------------------------------------------- */

export const STOCK_STATUS_LABEL_JA: Record<VariantAvailability, string> = {
  available: '在庫あり',
  unavailable: '在庫切れ',
  // ★「在庫切れ」と言い切らない。分かっていないだけ。★
  unknown: '在庫を確認できていません',
}

/**
 * 掲載の在庫状況を求める。
 *
 * stockStatus を持っているデータソース（第3段階以降）はそれを使い、
 * 持っていないもの（第1・2段階のfixture）は inStock から素直に読み替える。
 *
 * ★unknown を「在庫切れ」として表示しないための入口。★
 */
export function resolveStockStatus(
  listing: Pick<StoreListing, 'inStock' | 'stockStatus'>,
): VariantAvailability {
  if (listing.stockStatus) return listing.stockStatus
  return listing.inStock ? 'available' : 'unavailable'
}

/* ------------------------------------------------------------
 * データの素性（第4段階で追加）
 * ---------------------------------------------------------- */

/**
 * その掲載が「実際に取得したデータ」か「開発用のサンプル」かを示す表示。
 *
 * ★実データと開発用データを同じものとして見せないための表示です。★
 * 第4段階では、海外価格が開発用・国内価格が取得データ、という
 * 混ざった状態が起こり得ます。
 */
export function describeDataOrigin(store: Pick<Store, 'dataOrigin'>): {
  label: string
  isLive: boolean
} {
  const isLive = store.dataOrigin === 'live'
  return { label: isLive ? '取得データ' : '開発用データ', isLive }
}

/** 国内候補の取得元の名前（Yahoo!ショッピングなど）。 */
export function describeDomesticSource(sourceLabel: string | undefined): string | null {
  if (!sourceLabel) return null
  const map: Record<string, string> = {
    yahoo: 'Yahoo!ショッピング',
    rakuten: '楽天市場',
  }
  return map[sourceLabel] ?? sourceLabel
}
