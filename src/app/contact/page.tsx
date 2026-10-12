/**
 * お問い合わせ（/contact/）。
 *
 * ★載せてよいのは、実際に届く手段だけです。★
 *   架空のメールアドレスは作りません。ここに載せているのは、
 *   このサイト専用に用意したアドレスです。
 *
 * ★運営者の個人情報は載せません。★
 *   住所・電話番号・私用のメールアドレスは、窓口のために公開する必要がありません。
 *
 * ★アドレスを変えるときは site.ts の1か所を直せば済みます。★
 *   プライバシーポリシーの記載も合わせて見直してください。
 */

import Link from 'next/link'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { buildPageMetadata } from '@/lib/seo'
import { CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_SUBJECT, SITE_NAME, SITE_OPERATOR } from '@/lib/site'

export const metadata = buildPageMetadata({
  title: 'お問い合わせ',
  description:
    'サカモノへのお問い合わせ方法をご案内します。価格や商品情報の誤り、掲載内容についてのご連絡をメールでお待ちしています。',
  path: '/contact/',
})

export default function ContactPage() {
  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: 'お問い合わせ' }]} />
      </div>

      <div className="container page-body">
        <article className="prose">
          <h1 className="page-title">お問い合わせ</h1>
          <p>
            {SITE_NAME}は{SITE_OPERATOR}が個人で運営しています。
            掲載内容の誤り、商品情報・価格表示についてのご指摘、その他のご連絡をお待ちしています。
          </p>

          <h2>メールでのお問い合わせ</h2>
          <p>
            下のアドレスへメールをお送りください。
            {SITE_NAME}専用のアドレスで、ほかの用途には使用していません。
          </p>
          <p>
            <a className="button button--primary" href={CONTACT_MAILTO}>
              メールを作成する
              <span className="visually-hidden">
                （お使いのメールソフトが開きます。宛先 {CONTACT_EMAIL}）
              </span>
            </a>
          </p>
          <dl className="spec-list">
            <dt>宛先</dt>
            <dd>
              <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
            </dd>
            <dt>件名</dt>
            <dd>{CONTACT_SUBJECT}（ボタンから作成すると自動で入ります）</dd>
          </dl>
          <p>
            ボタンを押すと、お使いのメールソフトが開きます。
            開かない場合は、上の宛先をコピーしてお送りください。
          </p>

          <div className="notice" style={{ marginTop: 'var(--space-4)' }}>
            <p className="notice__title">お返事について</p>
            <p>
              個人で運営しているため、お返事までお時間をいただくことがあります。
              内容によってはお返事できない場合もあります。あらかじめご了承ください。
            </p>
          </div>

          <h2>お問い合わせでお預かりする情報</h2>
          <p>
            メールアドレスとご記載の内容をお預かりします。
            これらは<strong>そのお問い合わせへの対応のためにのみ</strong>使用し、
            ほかの目的には使いません。第三者へ提供することもありません。
            詳しくは <Link href="/privacy/">プライバシーポリシー</Link> をご確認ください。
          </p>

          <h2>お答えできないこと</h2>
          <p>
            当サイトは各クラブ・リーグ・メーカー・販売元の公式サイトではなく、提携・運営関係もありません。
            商品の在庫・注文・配送・返品については、購入された販売元へ直接お問い合わせください。
          </p>
          <p>
            表示している金額は推定値です。考え方は{' '}
            <Link href="/about/#landed-cost">日本到着推定額について</Link> で説明しています。
          </p>
        </article>
      </div>
    </>
  )
}
