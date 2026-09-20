/**
 * このサイトについて（/about/）。
 *
 * 「日本到着推定額について」は他のページから #landed-cost で参照されるため、
 * 見出しのidを変えないこと。
 */

import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { getDataSourceMeta } from '@/data/repository'
import {
  CONSUMPTION_TAX_RATE,
  DUTY_FREE_THRESHOLD_JPY,
  FX_RATE_AS_OF,
  FX_RATES_JPY,
  PERSONAL_IMPORT_TAX_BASE_RATE,
} from '@/lib/pricing/config'
import { formatJpy } from '@/lib/format'
import { buildPageMetadata } from '@/lib/seo'
import { SITE_NAME } from '@/lib/site'

export const metadata = buildPageMetadata({
  title: 'このサイトについて',
  description:
    'サカモノの目的、日本到着推定額の計算の考え方、価格差を表示する条件、データの扱いについて説明します。',
  path: '/about/',
})

export default async function AboutPage() {
  const meta = await getDataSourceMeta()

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: 'このサイトについて' }]} />
      </div>

      <div className="container page-body">
        <article className="prose">
          <h1 className="page-title">このサイトについて</h1>

          <p>
            {SITE_NAME}は、海外クラブの公式ストアで売られているサッカーグッズが
            「日本まで届けるといくらになるのか」を分かりやすくするサイトです。
          </p>
          <p>
            海外の価格だけを見ても、送料や輸入にかかる費用が分からなければ、
            国内で買う場合と比べられません。そこで{SITE_NAME}
            は、商品代金の円換算に送料や輸入コストの目安を加えた
            <strong>日本到着推定額</strong>を計算し、国内価格と並べて表示します。
          </p>

          {/* ---- ここのidは他ページから参照されている ---- */}
          <h2 id="landed-cost">日本到着推定額について</h2>

          <p>日本到着推定額は、次の4つを足したものです。</p>
          <ul>
            <li>商品価格の円換算</li>
            <li>国際送料（推定）</li>
            <li>輸入コスト（関税・消費税・通関手数料の推定）</li>
            <li>決済・為替関連コスト（海外事務手数料などの推定）</li>
          </ul>

          <h3>為替について</h3>
          <p>
            現在は 1ポンド = {FX_RATES_JPY.GBP}円、1ユーロ = {FX_RATES_JPY.EUR}円（
            {FX_RATE_AS_OF}時点の想定値）で計算しています。
            実際のレートは日々変わり、カード会社のレートもこれとは異なります。
          </p>

          <h3>関税・消費税について</h3>
          <p>
            個人が自分で使うために海外から商品を取り寄せる場合、
            海外小売価格の{Math.round(PERSONAL_IMPORT_TAX_BASE_RATE * 100)}
            %を課税価格とする簡易な計算が用いられます。
            {SITE_NAME}もこの方法で試算し、課税価格が{formatJpy(DUTY_FREE_THRESHOLD_JPY)}
            以下の場合は非課税として計算しています。
            課税される場合は、商品の種類ごとの関税率と消費税（
            {Math.round(CONSUMPTION_TAX_RATE * 100)}%）、
            それに通関手数料の目安を加えています。
          </p>
          <p>
            関税率は素材や形状によって細かく分かれます。{SITE_NAME}
            が使っているのは代表的な値であり、実際の税額とは異なることがあります。
          </p>

          <h3>推定であることについて</h3>
          <p>
            <strong>日本到着推定額は確定額ではありません。</strong>
            為替・配送方法・購入点数・税関の判断・各ストアのキャンペーンによって、
            実際の支払額は変わります。購入前に、必ず販売元のページで最終的な金額をご確認ください。
          </p>

          <h2>価格差を表示する条件</h2>
          <p>
            「国内より○○円安い」という表示は、海外の商品と国内の商品が
            同じものだと十分に確認できた場合にだけ出しています。
          </p>
          <ul>
            <li>商品コード（EAN／JAN）が一致している</li>
            <li>メーカー品番が一致し、クラブも一致している</li>
            <li>担当者が目で見て確認した</li>
          </ul>
          <p>
            これらに当てはまらない組み合わせは、価格差を表示せず、価格差ランキングにも載せません。
            サイズ違い・年式違い・仕様違いの商品どうしを比べて、
            誤った差額をお見せしないためです。
          </p>

          <h2>取り扱う販売元について</h2>
          <p>
            海外クラブの公式ストアと、確認できた国内の販売元を中心に比較しています。
            ただし{SITE_NAME}は、掲載している商品が正規品であることを保証するものではありません。
            最終的なご判断は、販売元の情報をご確認のうえお願いします。
          </p>

          <h2>データについて</h2>
          <p>
            価格・在庫は、{SITE_NAME}が確認した時点の情報です。
            確認後に変更されている場合があります。各商品ページに最終確認日時を表示しています。
          </p>
          {meta.isSampleData ? (
            <div className="notice" style={{ marginTop: 'var(--space-4)' }}>
              <p className="notice__title">現在はサンプル表示です</p>
              <p>
                このサイトは現在、開発中のサンプルデータを表示しています。
                商品名・価格・在庫・割引率はすべて動作確認用の値で、実際の販売情報ではありません。
                外部サイトからの価格取得は行っていません。
              </p>
            </div>
          ) : null}

          <h2>商標・著作権について</h2>
          <p>
            クラブ名・リーグ名・メーカー名およびそれらのロゴは、各権利者の商標です。
            {SITE_NAME}は、各クラブ・リーグ・メーカー・販売元とは提携していません。
            ロゴ画像や商品写真は、利用条件の確認が済むまで掲載していません。
          </p>
        </article>
      </div>
    </>
  )
}
