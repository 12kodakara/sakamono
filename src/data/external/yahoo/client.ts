/**
 * Yahoo!ショッピング 商品検索API（v3）のクライアント。
 *
 * 公式仕様: https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html
 *
 * ══════════════════════════════════════════════════════════
 * ★相手のサーバーに負荷をかけないための決まり★
 *
 *   1. 公式の制限は「1クエリ/秒」。それより余裕を持って間隔を空ける。
 *   2. 同時に複数のリクエストを投げない（必ず1本ずつ順番に）。
 *   3. 429（利用制限）が返ったら、間隔を空けて数回だけ再試行し、
 *      それでも駄目なら止める。★連打しない★
 *   4. 429以外の4xxは再試行しない。何度送っても結果は同じで、
 *      迷惑をかけるだけ。
 *   5. 同じ検索を短時間に繰り返さない（キャッシュ）。
 * ══════════════════════════════════════════════════════════
 *
 * ★HTMLスクレイピングは行いません。★
 *   検索結果ページの取得や、非公開APIの利用はしません。
 */

import { IngestionError, isRetryable } from '../ingestionErrors'
import { DEFAULT_CACHE_TTL_MS, readCache, writeCache } from '../cache'
import { validateYahooResponse, type YahooResponseValidationResult } from './rawSchema'
import type { YahooSearchPlan } from './queryBuilder'
import type { YahooSearchResult } from './types'

export const YAHOO_ITEM_SEARCH_ENDPOINT =
  'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch'

/** キャッシュの置き場所。.gitignore 済み。 */
export const YAHOO_CACHE_DIR = '.cache/yahoo'

/**
 * リクエストの最小間隔（ミリ秒）。
 * 公式の制限は1秒に1クエリなので、余裕をみて1.5秒あける。
 */
export const MIN_REQUEST_INTERVAL_MS = 1500

/** 1リクエストの制限時間。 */
export const REQUEST_TIMEOUT_MS = 10_000

/** 再試行の上限。★無限に繰り返さない。★ */
export const MAX_RETRIES = 2

/** 再試行までの待ち時間（回数ごと）。 */
export const RETRY_DELAY_MS = [2_000, 5_000]

export interface YahooClientOptions {
  /** Client ID（アプリケーションID）。★ログや出力に出さないこと。★ */
  appId: string
  /** キャッシュを使わない。 */
  noCache?: boolean
  /** キャッシュの有効期限。 */
  cacheTtlMs?: number
  /** テスト用に fetch を差し替える。 */
  fetchImpl?: typeof fetch
  /** テスト用に待ち時間を差し替える。 */
  sleepImpl?: (ms: number) => Promise<void>
  /** 進捗の表示。 */
  onProgress?: (message: string) => void
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * 環境変数から Client ID を読む。
 *
 * ★キーが無くても build / test が落ちないこと。★
 *   無い場合は null を返し、呼び出し側が「APIキー未設定」として
 *   分かる形で扱えるようにします。
 */
export function readYahooAppId(
  env: { YAHOO_CLIENT_ID?: string } = process.env as { YAHOO_CLIENT_ID?: string },
): string | null {
  const value = env.YAHOO_CLIENT_ID?.trim()
  return value && value.length > 0 ? value : null
}

/** APIキーが無いことを表すエラー。 */
export function missingAppIdError(): IngestionError {
  return new IngestionError(
    'auth-missing',
    [
      'YAHOO_CLIENT_ID が設定されていません。',
      '',
      'Yahoo!デベロッパーネットワークでアプリケーションを登録し、',
      'Client ID を .env.local へ次の形で書いてください:',
      '  YAHOO_CLIENT_ID=あなたのClient ID',
      '',
      '.env.local は .gitignore 済みです。キーをソースやREADMEへ書かないでください。',
      '',
      'キーが無くても、--sample を付ければ保存済みのサンプル応答で動作を確認できます。',
    ].join('\n'),
  )
}

/**
 * ★万一エラー文言にURLが混ざっても、キーを表に出さないための保険。★
 *   通信ライブラリの例外メッセージにURLが含まれることがあるため、
 *   appid の値を必ず伏せ字へ置き換えてから外へ出す。
 */
function redactAppId(text: string): string {
  return text.replace(/appid=[^&s"']+/gi, 'appid=***')
}

/** ★キーを含まないパラメータだけを記録用に返す。★ */
function sanitizeParams(params: Record<string, string>): Record<string, string> {
  const { appid: _appid, ...rest } = params
  return rest
}

/** キャッシュのキー。★appid は入れない。★ */
function cacheKey(params: Record<string, string>): string {
  const sorted = Object.entries(sanitizeParams(params))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  // ファイル名に使える形へ
  return Buffer.from(sorted).toString('base64url').slice(0, 120)
}

/** HTTPステータスから、こちらの扱いを決める。 */
function classifyStatus(status: number): IngestionError | null {
  if (status >= 200 && status < 300) return null
  if (status === 429) {
    return new IngestionError('rate-limited', 'Yahoo! APIの利用制限にかかりました（429）')
  }
  if (status === 401 || status === 403) {
    return new IngestionError(
      'auth-invalid',
      `Yahoo! APIに拒否されました（${status}）。Client ID を確認してください`,
    )
  }
  if (status >= 500) {
    return new IngestionError('server-error', `Yahoo! API がエラーを返しました（${status}）`)
  }
  // ★429以外の4xxは再試行しない。何度送っても同じ結果になるため。★
  return new IngestionError(
    'client-error',
    `Yahoo! API がエラーを返しました（${status}）。リクエスト内容を確認してください`,
  )
}

/* ------------------------------------------------------------
 * クライアント
 * ---------------------------------------------------------- */

export class YahooShoppingClient {
  private lastRequestAt = 0

  constructor(private readonly options: YahooClientOptions) {}

  private get fetchImpl(): typeof fetch {
    return this.options.fetchImpl ?? globalThis.fetch
  }

  private get sleep(): (ms: number) => Promise<void> {
    return this.options.sleepImpl ?? defaultSleep
  }

  private log(message: string): void {
    this.options.onProgress?.(message)
  }

  /** 前回のリクエストから十分に間隔が空くまで待つ。 */
  private async waitForSlot(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (this.lastRequestAt > 0 && elapsed < MIN_REQUEST_INTERVAL_MS) {
      await this.sleep(MIN_REQUEST_INTERVAL_MS - elapsed)
    }
    this.lastRequestAt = Date.now()
  }

  /** 1回だけ送る（再試行はしない）。 */
  private async requestOnce(params: Record<string, string>): Promise<unknown> {
    await this.waitForSlot()

    const url = new URL(YAHOO_ITEM_SEARCH_ENDPOINT)
    url.searchParams.set('appid', this.options.appId)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      throw new IngestionError(
        aborted ? 'timeout' : 'network',
        aborted
          ? `Yahoo! APIの応答が ${REQUEST_TIMEOUT_MS}ms 以内に返りませんでした`
          : redactAppId(`Yahoo! APIへ接続できませんでした: ${String(error)}`),
      )
    } finally {
      clearTimeout(timer)
    }

    const statusError = classifyStatus(response.status)
    if (statusError) throw statusError

    try {
      return await response.json()
    } catch (error) {
      throw new IngestionError(
        'parse',
        redactAppId(`Yahoo! APIの応答をJSONとして読めませんでした: ${String(error)}`),
      )
    }
  }

  /**
   * 再試行つきで送る。
   *
   * ★再試行してよいのは timeout / 429 / 5xx / 通信断だけ。★
   *   それ以外（404 など）は何度送っても同じなので、すぐ諦める。
   */
  private async requestWithRetry(params: Record<string, string>): Promise<unknown> {
    let lastError: IngestionError | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.requestOnce(params)
      } catch (error) {
        if (!(error instanceof IngestionError)) throw error
        lastError = error

        // 再試行してよい種類の定義は ingestionErrors.ts の1か所だけに置く
        if (!isRetryable(error.kind) || attempt === MAX_RETRIES) break

        const delay = RETRY_DELAY_MS[attempt] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1]
        this.log(`  ${error.message} → ${delay / 1000}秒待って再試行します（${attempt + 1}/${MAX_RETRIES}）`)
        await this.sleep(delay)
      }
    }

    throw lastError ?? new IngestionError('unknown', 'Yahoo! APIへのリクエストに失敗しました')
  }

  /** 検索条件1つ分を実行する。 */
  async search(plan: YahooSearchPlan): Promise<YahooSearchResult> {
    const fetchedAt = new Date().toISOString()
    const key = cacheKey(plan.params)

    /* ---- キャッシュ ---- */
    const cached = await readCache<unknown>(key, {
      directory: YAHOO_CACHE_DIR,
      ttlMs: this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      disabled: this.options.noCache,
    })

    if (cached) {
      this.log('  キャッシュを使用しました（--no-cache で無効化できます）')
      return this.toResult(plan, validateYahooResponse(cached, fetchedAt), fetchedAt, true)
    }

    /* ---- 実行 ---- */
    const body = await this.requestWithRetry(plan.params)

    await writeCache(key, body, `Yahoo検索: ${plan.description}`, {
      directory: YAHOO_CACHE_DIR,
      ttlMs: this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      disabled: this.options.noCache,
    })

    return this.toResult(plan, validateYahooResponse(body, fetchedAt), fetchedAt, false)
  }

  private toResult(
    plan: YahooSearchPlan,
    validation: YahooResponseValidationResult,
    fetchedAt: string,
    fromCache: boolean,
  ): YahooSearchResult {
    if (!validation.valid) {
      throw new IngestionError(
        'unexpected-schema',
        `Yahoo! APIの応答が想定と違います:\n${validation.errors.map((e) => `  - ${e.message}`).join('\n')}`,
      )
    }

    return {
      // ★記録にも appid は残さない★
      requestParams: sanitizeParams(plan.params),
      level: plan.level,
      totalResultsAvailable: validation.totalResultsAvailable,
      totalResultsReturned: validation.totalResultsReturned,
      products: validation.products,
      fetchedAt,
      fromCache,
    }
  }
}
