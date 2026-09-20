/**
 * 取り込み時のエラー分類（データ提供元によらず共通）。
 *
 * ★「失敗したから0円の商品を作る」は絶対にしない。★
 *   失敗は失敗として記録し、その商品は取り込まない。
 *   中途半端なデータを本番モデルへ流すくらいなら、件数が減る方がよい。
 *
 * 種類を分けているのは、対処が違うため。
 *   network / timeout → 時間をおいて再試行
 *   blocked           → ★再試行してはいけない。止める★
 *   parse / schema    → 取得元の形が変わった。コードの修正が必要
 *   unavailable       → 商品が消えただけ。正常な結果
 *   invalid-price     → 値がおかしい。その商品だけ捨てる
 */

export type IngestionErrorKind =
  /** 通信そのものに失敗した */
  | 'network'
  /** 応答が返ってこなかった */
  | 'timeout'
  /** 応答は返ったが、JSON等として読めなかった */
  | 'parse'
  /** アクセスを拒否された（403 / CAPTCHA / bot判定など） */
  | 'blocked'
  /** 商品が存在しない・販売終了 */
  | 'product-unavailable'
  /** 形は読めたが、想定していた項目が無い／型が違う */
  | 'unexpected-schema'
  /** 価格が数値でない、マイナス、通常価格より高いなど */
  | 'invalid-price'
  /** 取り込み元のファイルが見つからない */
  | 'source-missing'
  /** APIの利用制限にかかった（429）。★間隔を空ける。連打しない★ */
  | 'rate-limited'
  /** APIキーが設定されていない */
  | 'auth-missing'
  /** APIキーが拒否された（401 / 403） */
  | 'auth-invalid'
  /** サーバー側の一時的な不具合（5xx） */
  | 'server-error'
  /**
   * こちらの要求が受け付けられなかった（429以外の4xx）。
   * ★何度送っても結果は同じなので再試行しない。★
   */
  | 'client-error'
  /** 上のどれでもない */
  | 'unknown'

export const INGESTION_ERROR_LABEL_JA: Record<IngestionErrorKind, string> = {
  network: '通信エラー',
  timeout: 'タイムアウト',
  parse: '解析エラー',
  blocked: 'アクセス拒否',
  'product-unavailable': '商品が見つからない',
  'unexpected-schema': '想定外のデータ形式',
  'invalid-price': '価格が不正',
  'source-missing': '取り込み元が見つからない',
  'rate-limited': '利用制限（429）',
  'auth-missing': 'APIキー未設定',
  'auth-invalid': 'APIキーが無効',
  'server-error': 'サーバーエラー',
  'client-error': 'リクエストエラー',
  unknown: '不明なエラー',
}

export interface IngestionIssue {
  kind: IngestionErrorKind
  /** 人が読んで対処できる説明。 */
  message: string
  /** どの商品で起きたか（分かる場合）。 */
  productRef?: string
}

/**
 * これ以上リクエストを続けてはいけない種類か。
 *
 * blocked は「相手が拒否している」状態なので、
 * 再試行は迷惑行為になる。必ず止める。
 */
export function mustStopOnError(kind: IngestionErrorKind): boolean {
  return kind === 'blocked' || kind === 'auth-invalid'
}

/**
 * 時間をおいて再試行してよい種類か。
 *
 * ★4xx は再試行しない。★ 何度送っても結果は同じで、相手に迷惑をかけるだけ。
 *   例外は 429（利用制限）で、これは「間隔を空ければ通る」ため再試行の対象にする。
 */
export function isRetryable(kind: IngestionErrorKind): boolean {
  return kind === 'network' || kind === 'timeout' || kind === 'rate-limited' || kind === 'server-error'
}

export class IngestionError extends Error {
  readonly kind: IngestionErrorKind
  readonly productRef?: string

  constructor(kind: IngestionErrorKind, message: string, productRef?: string) {
    super(message)
    this.name = 'IngestionError'
    this.kind = kind
    this.productRef = productRef
  }

  toIssue(): IngestionIssue {
    return { kind: this.kind, message: this.message, productRef: this.productRef }
  }
}
