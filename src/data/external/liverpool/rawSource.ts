/**
 * 生データの取得元。
 *
 * ══════════════════════════════════════════════════════════════
 * ★★ ここに HTTP で取りに行く実装が無いのは、意図的です ★★
 *
 *   Liverpool FC 公式ストアの利用規約 第15.7条は
 *     「mass, automated or systematic extractions」
 *     「別の電子データベースへの取り込み」
 *     「再配信」
 *   を明示的に禁止しています。
 *   サカモノの用途はこの3つすべてに該当するため、
 *   第3段階では公式サイトからの自動取得を実装しません。
 *
 *   詳しい調査結果: docs/data-sources/liverpool.md
 *
 *   正規の入手経路は Webgains の公式商品フィード（プログラムID 7413）です。
 *   フィードを入手できたら、フィードを LiverpoolRawProduct[] へ写す
 *   実装をこのファイルへ1つ足すだけで、ここから先はそのまま動きます。
 * ══════════════════════════════════════════════════════════════
 *
 * 取得元をインターフェースにしてあるのは、
 * 経路（フィード / 手入力 / 将来の公式API）が変わっても
 * 正規化から先を書き換えずに済むようにするためです。
 */

import { IngestionError } from './errors'
import type { LiverpoolRawFeed } from './types'

export interface LiverpoolRawSource {
  /** この取得元の説明（ログや記録に残す）。 */
  readonly description: string
  /** 生データを1本読み込む。 */
  load(): Promise<LiverpoolRawFeed>
}

/* ------------------------------------------------------------
 * ファイルから読む取得元
 * ---------------------------------------------------------- */

/**
 * ローカルのJSONファイルから読み込む。
 *
 * 置き場所の想定:
 *   external/liverpool/raw.json   … 入手した生データ（gitignore）
 *
 * Webgains のフィードを入手したら、このファイルの形へ変換して置けば動きます。
 */
export class FileRawSource implements LiverpoolRawSource {
  readonly description: string

  constructor(private readonly filePath: string) {
    this.description = `ローカルファイル: ${filePath}`
  }

  async load(): Promise<LiverpoolRawFeed> {
    const { readFile } = await import('node:fs/promises')

    let text: string
    try {
      text = await readFile(this.filePath, 'utf8')
    } catch {
      throw new IngestionError(
        'source-missing',
        [
          `生データのファイルが見つかりません: ${this.filePath}`,
          '',
          'Webgains の公式商品フィード（プログラムID 7413）を入手し、',
          'LiverpoolRawFeed の形へ変換してこの場所へ置いてください。',
          'まず動作だけ確かめたい場合は --sample を付けて実行してください。',
        ].join('\n'),
      )
    }

    try {
      return JSON.parse(text) as LiverpoolRawFeed
    } catch (error) {
      throw new IngestionError(
        'parse',
        `生データのJSONを読めませんでした: ${this.filePath}（${String(error)}）`,
      )
    }
  }
}

/* ------------------------------------------------------------
 * メモリ上のデータから読む取得元（テスト・サンプル用）
 * ---------------------------------------------------------- */

export class InMemoryRawSource implements LiverpoolRawSource {
  readonly description: string

  constructor(
    private readonly feed: LiverpoolRawFeed,
    description = 'メモリ上のデータ',
  ) {
    this.description = description
  }

  async load(): Promise<LiverpoolRawFeed> {
    return this.feed
  }
}

/* ------------------------------------------------------------
 * 将来 HTTP 取得を足すときのために
 * ---------------------------------------------------------- */

/**
 * ネットワーク経由の取得元を作ろうとしたときに呼ばれる関数。
 *
 * ★あえて必ず失敗させています。★
 *   「動くコードがあるのに使っていないだけ」の状態にすると、
 *   誰かが気軽に有効化してしまう恐れがあるためです。
 *
 * 規約上問題のない経路（公式フィード等）を確保できたら、
 * その経路専用の LiverpoolRawSource を新しく作ってください。
 */
export function createHttpRawSource(): never {
  throw new IngestionError(
    'blocked',
    [
      'Liverpool FC 公式ストアからの自動取得は実装していません。',
      '利用規約 第15.7条が、自動・体系的な抽出、別データベースへの取り込み、再配信を禁止しているためです。',
      '',
      '正規の入手経路: Webgains 公式商品フィード（プログラムID 7413）',
      '詳細: docs/data-sources/liverpool.md',
    ].join('\n'),
  )
}
