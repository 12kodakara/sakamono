/**
 * データの素性を知らせる帯。
 *
 * 2種類の注意を出し分ける。
 *
 *   1. サンプルデータを表示している
 *      → ダミーの価格を本物の価格のように見せないため
 *
 *   2. 実データだが、まだ公開してよい状態ではない
 *      → 第3段階で取り込んだデータは、ローカル検証のみに使うため
 *
 * どちらでもなくなったら（本番データかつ公開可）自動的に消える。
 */

import { getDataSourceMeta } from '@/data/repository'

export async function SampleDataBanner() {
  const meta = await getDataSourceMeta()

  if (meta.isSampleData) {
    return (
      <div className="sample-banner" role="note">
        <div className="container">
          <strong>開発中のサンプル表示です。</strong>
          表示している価格・在庫・割引率はすべて動作確認用のサンプル値で、実際の販売情報ではありません。
        </div>
      </div>
    )
  }

  if (!meta.publishable) {
    return (
      <div className="sample-banner sample-banner--unpublished" role="note">
        <div className="container">
          <strong>ローカル検証用の表示です。</strong>
          取り込んだデータの確認中のため、この内容のまま公開しないでください。（{meta.label}）
        </div>
      </div>
    )
  }

  return null
}
