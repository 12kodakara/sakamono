/**
 * robots.txt と robots meta の、環境ごとの動作のテスト。
 *
 * ★守りたいこと★
 *   ・本番（NEXT_PUBLIC_SITE_PREVIEW=false）だけがクロール許可＋index になる
 *   ・それ以外（ローカル・設定し忘れ）は、全ページ noindex＋クロール拒否のまま
 *   ・本番でも、ページ個別の noindex 指定（検索ページ・中身の無いページ）は残る
 *   ・robots.txt の Sitemap は sitemap.xml と同じ SITE_URL から作る
 *
 * IS_PREVIEW / SITE_URL は読み込んだ時点の環境変数で決まるので、
 * 環境変数を差し替えるたびにモジュールを読み込み直します。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

const SITE = 'https://12kodakara.github.io/sakamono'

async function load(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string)
  const robots = (await import('@/app/robots')).default
  const { buildPageMetadata } = await import('@/lib/seo')
  return { robots, buildPageMetadata }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('本番（NEXT_PUBLIC_SITE_PREVIEW=false）', () => {
  const env = { NEXT_PUBLIC_SITE_PREVIEW: 'false', NEXT_PUBLIC_SITE_URL: SITE }

  it('robots.txt は全体のクロールを許可し、sitemap を案内する', async () => {
    const { robots } = await load(env)
    const result = robots()
    expect(result.rules).toEqual({ userAgent: '*', allow: '/' })
    expect(result.sitemap).toBe(`${SITE}/sitemap.xml`)
  })

  it('★noindex のページを robots.txt で塞がない（noindex を読ませるため）★', async () => {
    const { robots } = await load(env)
    const rules = robots().rules as { disallow?: unknown }
    expect(rules.disallow).toBeUndefined()
  })

  it('通常のページは index, follow', async () => {
    const { buildPageMetadata } = await load(env)
    expect(buildPageMetadata({ path: '/' }).robots).toEqual({ index: true, follow: true })
  })

  it('★ページ個別の noindex は本番でも残る★', async () => {
    const { buildPageMetadata } = await load(env)
    expect(buildPageMetadata({ path: '/search/', noindex: true }).robots).toEqual({
      index: false,
      follow: true,
    })
  })
})

describe('★開発版（設定なし・設定し忘れ）★', () => {
  it('何も設定しなければ、全ページ noindex＋クロール拒否', async () => {
    const { robots, buildPageMetadata } = await load({
      NEXT_PUBLIC_SITE_PREVIEW: undefined,
      NEXT_PUBLIC_SITE_URL: SITE,
    })
    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' })
    expect(robots().sitemap).toBeUndefined()
    expect(buildPageMetadata({ path: '/' }).robots).toEqual({ index: false, follow: true })
  })

  it('false 以外の値（true・空文字・綴り違い）は開発版として扱う', async () => {
    for (const value of ['true', '', 'False', '0', 'no']) {
      const { buildPageMetadata } = await load({ NEXT_PUBLIC_SITE_PREVIEW: value })
      expect(buildPageMetadata({ path: '/' }).robots).toEqual({ index: false, follow: true })
    }
  })
})
