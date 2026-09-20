/**
 * データ取得層のインターフェース。
 *
 * ここが「サカモノの心臓部の境界線」です。
 *
 *   画面 (src/app, src/components)
 *        ↓ 呼ぶのはここまで
 *   src/data/repository.ts
 *        ↓
 *   SakamonoDataSource  ← このファイルで決めている約束ごと
 *        ↓ 実装を差し替えられる
 *   fixtureAdapter（第1段階・サンプルデータ）
 *   apiAdapter    （第2段階・外部APIから取得）
 *
 * この約束さえ守れば、データの出どころが変わっても画面は書き換え不要です。
 *
 * 戻り値をすべて Promise にしてあるのは、
 * 第2段階で非同期の通信が入っても署名を変えずに済むようにするためです。
 */

import type {
  Club,
  DomesticMatch,
  ExchangeRate,
  ImportCostRule,
  League,
  PriceSnapshot,
  Product,
  ProductVariant,
  ShippingRule,
  Store,
  StoreListing,
} from '@/domain/types'

/**
 * データの出どころ。
 *   fixture   … リポジトリ内の開発用サンプルデータ
 *   liverpool … 取り込み済みの Liverpool データ（第3段階）
 *   fixture-yahoo … 海外は開発用fixture、国内は Yahoo!取得データ（第4段階）
 *   api       … 外部API（未実装）
 */
export type DataSourceKind = 'fixture' | 'liverpool' | 'fixture-yahoo' | 'api'

export interface DataSourceMeta {
  kind: DataSourceKind
  /**
   * 表示中の価格がサンプル値かどうか。
   * true のとき、画面は必ず「サンプルデータである」旨を表示し、
   * 構造化データ（JSON-LD）へ価格を出力しません。
   */
  isSampleData: boolean
  /**
   * このデータのまま公開してよいか（第3段階で追加）。
   * false のとき、画面に「公開しないでください」の帯を出す。
   * 取り込んだばかりの実データは、検証が済むまで false にしておく。
   */
  publishable: boolean
  /** データの基準日時（ISO 8601）。 */
  generatedAt: string
  /** 画面に出す短い説明。 */
  label: string
}

export interface SakamonoDataSource {
  readonly meta: DataSourceMeta

  getLeagues(): Promise<League[]>
  getClubs(): Promise<Club[]>
  getStores(): Promise<Store[]>
  getProducts(): Promise<Product[]>
  getListings(): Promise<StoreListing[]>
  getPriceSnapshots(): Promise<PriceSnapshot[]>
  getDomesticMatches(): Promise<DomesticMatch[]>

  /* ----- 第2段階で追加 ----------------------------------- */

  /** 為替レート。第2段階では開発用の固定値。 */
  getExchangeRates(): Promise<ExchangeRate[]>
  /** 送料の決まり。 */
  getShippingRules(): Promise<ShippingRule[]>
  /** 輸入コストの見積り方。 */
  getImportCostRules(): Promise<ImportCostRule[]>

  /* ----- 第3段階で追加 ----------------------------------- */

  /**
   * サイズなどのバリエーション。
   * 取れないデータソースは空配列を返してよい（★在庫ありと決めつけない★）。
   */
  getVariants(): Promise<ProductVariant[]>
}
