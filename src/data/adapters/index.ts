/**
 * 使用するデータ取得層を決める場所。
 *
 * 環境変数 SAKAMONO_DATA_SOURCE で切り替えます。
 *   fixture   … リポジトリ内の開発用サンプルデータ（既定値）
 *   liverpool … 取り込み済みの Liverpool データ（第3段階・ローカル検証専用）
 *   fixture-yahoo … 海外は開発用fixture、国内は Yahoo!取得データ（第4段階・ローカル検証専用）
 *   api       … 外部APIから取得（未実装）
 *
 * 切り替えは .env.local に書きます（.env.example を参照）。
 *
 * ★fixture は消しません。★
 *   実データの取り込みが失敗しても、fixture でサイト開発を続けられるようにするためです。
 *
 * ★秘密情報は NEXT_PUBLIC_ に入れません。★
 *   データソース名そのものは秘密ではないので NEXT_PUBLIC_DATA_SOURCE でも切り替えられますが、
 *   サカモノは静的書き出し（ビルド時にデータを埋め込む）なので、
 *   ブラウザへ露出しない SAKAMONO_DATA_SOURCE を推奨します。
 */

import { apiAdapter } from './apiAdapter'
import { fixtureAdapter } from './fixtureAdapter'
import { fixtureWithYahooDataSource } from './fixtureWithYahooDataSource'
import { liverpoolDataSource } from './liverpoolDataSource'
import type { DataSourceKind, SakamonoDataSource } from './types'

export type { DataSourceKind, DataSourceMeta, SakamonoDataSource } from './types'

function resolveKind(): DataSourceKind {
  const value = process.env.SAKAMONO_DATA_SOURCE ?? process.env.NEXT_PUBLIC_DATA_SOURCE

  if (value === 'api') return 'api'
  if (value === 'liverpool') return 'liverpool'
  if (value === 'fixture-yahoo') return 'fixture-yahoo'
  return 'fixture'
}

/** 現在のデータ取得層を返す。 */
export function getDataSource(): SakamonoDataSource {
  switch (resolveKind()) {
    case 'api':
      return apiAdapter
    case 'liverpool':
      return liverpoolDataSource
    case 'fixture-yahoo':
      return fixtureWithYahooDataSource
    default:
      return fixtureAdapter
  }
}
