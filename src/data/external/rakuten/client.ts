/**
 * 楽天市場 商品検索API（IchibaItem/Search）のクライアント。
 *
 * 公式仕様: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
 *
 * ══════════════════════════════════════════════════════════
 * ★相手のサーバーに負荷をかけないための決まり★
 *
 *   1. 公式は具体的な秒間回数を明示していませんが、
 *      「短時間に同一URLへ多数アクセスすると一定期間応答しなくなる」
 *      と書かれています。Yahoo!側と同じ1.5秒間隔で余裕をみます。
 *   2. 同時に複数のリクエストを投げない（必ず1本ずつ順番に）。
 *   3. 429（利用制限）が返ったら、間隔を空けて数回だけ再試行し、
 *      それでも駄目なら止める。★連打しない★
 *   4. 429以外の4xxは再試行しない。何度送っても結果は同じで、
 *      迷惑をかけるだけ。
 *   5. 同じ検索を短時間に繰り返さない（キャッシュ）。
 * ══════════════════════════════════════════════════════════
 *
 * ★HTMLスクレイピングは行いません。★
 *   楽天市場の商品ページや検索結果ページの取得、
 *   非公開APIの利用はしません。
 */

import { IngestionError, isRetryable } from '../ingestionErrors'
import { DEFAULT_CACHE_TTL_MS, readCache, writeCache } from '../cache'
import { validateRakutenResponse, type RakutenResponseValidationResult } from './rawSchema'
import type { RakutenSearchPlan } from './queryBuilder'
import type { RakutenSearchResult } from './types'

/**
 * 現行のエンドポイント。
 *
 * ★旧 app.rakuten.co.jp は 2026年5月14日に停止しました。★
 *   指示書に書かれていたバージョンとは異なります。
 */
export const RAKUTEN_ITEM_SEARCH_ENDPOINT =
  'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701'

/** キャッシュの置き場所。.gitignore 済み。 */
export const RAKUTEN_CACHE_DIR = '.cache/rakuten'

/** リクエストの最小間隔（ミリ秒）。 */
export const MIN_REQUEST_INTERVAL_MS = 1500

/** 1リクエストの制限時間。 */
export const REQUEST_TIMEOUT_MS = 10_000

/** 再試行の上限。★無限に繰り返さない。★ */
export const MAX_RETRIES = 2

/** 再試行までの待ち時間（回数ごと）。 */
export const RETRY_DELAY_MS = [2_000, 5_000]

/**
 * 楽天の認証情報。
 *
 * ★applicationId だけでは通りません。★
 *   2026年のAPI刷新で accessKey が必須になりました。
 *   片方だけ送ると 400 が返ります。
 */
export interface RakutenCredentials {
  applicationId: string
  accessKey: string
  /**
   * アフィリエイトID。
   * ★価格の取得には不要なので、第5段階では必須にしません。★
   *   指示書26のとおり、本番アフィリエイトリンクはまだ作りません。
   */
  affiliateId?: string | null
}

export interface RakutenClientOptions {
  credentials: RakutenCredentials
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

export interface RakutenEnv {
  RAKUTEN_APPLICATION_ID?: string
  RAKUTEN_ACCESS_KEY?: string
  RAKUTEN_AFFILIATE_ID?: string
}

/**
 * 環境変数から認証情報を読む。
 *
 * ★キーが無くても build / test が落ちないこと。★
 *   無い場合は null を返し、呼び出し側が「APIキー未設定」として
 *   分かる形で扱えるようにします。
 *
 * ★両方そろっていないと使えません。★
 *   片方だけで送ると 400 になるので、ここで null にします。
 */
export function readRakutenCredentials(
  env: RakutenEnv = process.env as RakutenEnv,
): RakutenCredentials | null {
  const applicationId = env.RAKUTEN_APPLICATION_ID?.trim()
  const accessKey = env.RAKUTEN_ACCESS_KEY?.trim()
  if (!applicationId || !accessKey) return null

  const affiliateId = env.RAKUTEN_AFFILIATE_ID?.trim()
  return {
    applicationId,
    accessKey,
    affiliateId: affiliateId && affiliateId.length > 0 ? affiliateId : null,
  }
}

/** どちらの値が足りないかを、★値そのものは出さずに★伝える。 */
export function describeMissingCredentials(env: RakutenEnv = process.env as RakutenEnv): string[] {
  const missing: string[] = []
  if (!env.RAKUTEN_APPLICATION_ID?.trim()) missing.push('RAKUTEN_APPLICATION_ID')
  if (!env.RAKUTEN_ACCESS_KEY?.trim()) missing.push('RAKUTEN_ACCESS_KEY')
  return missing
}

/** 認証情報が無いことを表すエラー。 */
export function missingCredentialsError(
  env: RakutenEnv = process.env as RakutenEnv,
): IngestionError {
  const missing = describeMissingCredentials(env)
  return new IngestionError(
    'auth-missing',
    [
      `楽天ウェブサービスの認証情報が設定されていません（不足: ${missing.join(' / ')}）。`,
      '',
      '楽天ウェブサービスでアプリを登録し、.env.local へ次の形で書いてください:',
      '  RAKUTEN_APPLICATION_ID=あなたのアプリID',
      '  RAKUTEN_ACCESS_KEY=あなたのアクセスキー',
      '',
      '★2026年のAPI刷新で、applicationId と accessKey の両方が必須になりました。★',
      '  片方だけでは 400 が返ります。',
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
 *   認証に関わる値を必ず伏せ字へ置き換えてから外へ出す。
 */
export function redactCredentials(text: string): string {
  return text
    .replace(/applicationId=[^&\s"']+/gi, 'applicationId=***')
    .replace(/accessKey=[^&\s"']+/gi, 'accessKey=***')
    .replace(/affiliateId=[^&\s"']+/gi, 'affiliateId=***')
}

/** ★キーを含まないパラメータだけを記録用に返す。★ */
function sanitizeParams(params: Record<string, string>): Record<string, string> {
  const {
    applicationId: _applicationId,
    accessKey: _accessKey,
    affiliateId: _affiliateId,
    ...rest
  } = params
  return rest
}

/** キャッシュのキー。★認証情報は入れない。★ */
function cacheKey(params: Record<string, string>): string {
  const sorted = Object.entries(sanitizeParams(params))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return Buffer.from(sorted).toString('base64url').slice(0, 120)
}

/** HTTPステータスから、こちらの扱いを決める。 */
function classifyStatus(status: number): IngestionError | null {
  if (status >= 200 && status < 300) return null
  if (status === 429) {
    return new IngestionError('rate-limited', '楽天APIの利用制限にかかりました（429）')
  }
  if (status === 401 || status === 403) {
    return new IngestionError(
      'auth-invalid',
      `楽天APIに拒否されました（${status}）。アプリIDとアクセスキーを確認してください`,
    )
  }
  if (status === 400) {
    return new IngestionError(
      'client-error',
      [
        '楽天APIがリクエストを受け付けませんでした（400）。',
        'よくある原因: applicationId と accessKey のどちらかだけを送っている／',
        'keyword が2文字未満または128バイト超／hits が30を超えている。',
      ].join(''),
    )
  }
  if (status >= 500) {
    return new IngestionError('server-error', `楽天API がエラーを返しました（${status}）`)
  }
  // ★429以外の4xxは再試行しない。何度送っても同じ結果になるため。★
  return new IngestionError(
    'client-error',
    `楽天API がエラーを返しました（${status}）。リクエスト内容を確認してください`,
  )
}

/* ------------------------------------------------------------
 * クライアント
 * ---------------------------------------------------------- */

export class RakutenIchibaClient {
  private lastRequestAt = 0

  constructor(private readonly options: RakutenClientOptions) {}

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

    const url = new URL(RAKUTEN_ITEM_SEARCH_ENDPOINT)
    url.searchParams.set('applicationId', this.options.credentials.applicationId)
    if (this.options.credentials.affiliateId) {
      // ★アフィリエイトリンクは作りませんが、IDがあれば規約上つけて構いません。★
      //   第5段階では affiliateUrl を使わないので、動作への影響はありません。
      url.searchParams.set('affiliateId', this.options.credentials.affiliateId)
    }
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
        headers: {
          Accept: 'application/json',
          // ★accessKey はヘッダーで送ります。★
          //   クエリ文字列にも置けますが、URLはログやエラー文言へ
          //   混ざりやすいので、秘密の値はヘッダー側に寄せます。
          accessKey: this.options.credentials.accessKey,
        },
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError'
      throw new IngestionError(
        aborted ? 'timeout' : 'network',
        aborted
          ? `楽天APIの応答が ${REQUEST_TIMEOUT_MS}ms 以内に返りませんでした`
          : redactCredentials(`楽天APIへ接続できませんでした: ${String(error)}`),
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
        redactCredentials(`楽天APIの応答をJSONとして読めませんでした: ${String(error)}`),
      )
    }
  }

  /**
   * 再試行つきで送る。
   *
   * ★再試行してよいのは timeout / 429 / 5xx / 通信断だけ。★
   *   それ以外（400 など）は何度送っても同じなので、すぐ諦める。
   */
  private async requestWithRetry(params: Record<string, string>): Promise<unknown> {
    let lastError: IngestionError | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await this.requestOnce(params)
      } catch (error) {
        if (!(error instanceof IngestionError)) throw error
        lastError = error

        if (!isRetryable(error.kind) || attempt === MAX_RETRIES) break

        const delay = RETRY_DELAY_MS[attempt] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1]
        this.log(
          `  ${error.message} → ${delay / 1000}秒待って再試行します（${attempt + 1}/${MAX_RETRIES}）`,
        )
        await this.sleep(delay)
      }
    }

    throw lastError ?? new IngestionError('unknown', '楽天APIへのリクエストに失敗しました')
  }

  /** 検索条件1つ分を実行する。 */
  async search(plan: RakutenSearchPlan): Promise<RakutenSearchResult> {
    const fetchedAt = new Date().toISOString()
    const key = cacheKey(plan.params)

    /* ---- キャッシュ ---- */
    const cached = await readCache<unknown>(key, {
      directory: RAKUTEN_CACHE_DIR,
      ttlMs: this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      disabled: this.options.noCache,
    })

    if (cached) {
      this.log('  キャッシュを使用しました（--no-cache で無効化できます）')
      return this.toResult(plan, validateRakutenResponse(cached, fetchedAt), fetchedAt, true)
    }

    /* ---- 実行 ---- */
    const body = await this.requestWithRetry(plan.params)

    await writeCache(key, body, `楽天検索: ${plan.description}`, {
      directory: RAKUTEN_CACHE_DIR,
      ttlMs: this.options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      disabled: this.options.noCache,
    })

    return this.toResult(plan, validateRakutenResponse(body, fetchedAt), fetchedAt, false)
  }

  private toResult(
    plan: RakutenSearchPlan,
    validation: RakutenResponseValidationResult,
    fetchedAt: string,
    fromCache: boolean,
  ): RakutenSearchResult {
    if (!validation.valid) {
      throw new IngestionError(
        'unexpected-schema',
        `楽天APIの応答が想定と違います:\n${validation.errors.map((e) => `  - ${e.message}`).join('\n')}`,
      )
    }

    return {
      // ★記録にも認証情報は残さない★
      requestParams: sanitizeParams(plan.params),
      level: plan.level,
      totalResultsAvailable: validation.totalResultsAvailable,
      totalResultsReturned: validation.totalResultsReturned,
      items: validation.items,
      fetchedAt,
      fromCache,
    }
  }
}
