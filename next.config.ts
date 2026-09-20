import type { NextConfig } from 'next'

/**
 * サカモノ / Next.js 設定
 *
 * - output: 'export'
 *   完全な静的サイトとして out/ へ書き出す。GitHub Pages などの
 *   静的ホスティングへそのまま公開できる。サーバー専用機能は使わない。
 *
 * - trailingSlash: true
 *   /clubs/liverpool/ のようにディレクトリ + index.html で出力されるため、
 *   素の静的ホスティングでもURLが壊れにくい。
 *
 * 第2段階で外部APIを使う場合も、取得はビルド時に行い（scripts/ で JSON を生成）、
 * この静的出力構成は維持する方針。
 */
/**
 * サイトを置く場所のパス。
 *
 * ★ここに '/sakamono' を直接書かないこと。★
 *   GitHub Pages の project site では /sakamono/ 配下になりますが、
 *   将来 独自ドメインへ移せば / 直下に戻ります。
 *   置き場所は環境変数だけで切り替えます。
 *
 *     ローカル開発            未設定  → /
 *     GitHub Pages（project） /sakamono
 *     将来の独自ドメイン       未設定  → /
 *
 * basePath を設定すると、Next.js が次を自動で前置きします。
 *   ・<Link> のリンク先（内部リンク）
 *   ・/_next/ 配下のCSS・JS
 * 手で直す必要はありません。
 *
 * ★自動にならないのは生の <img src="/images/..."> だけです。★
 *   そこは src/lib/site.ts の assetPath() を通しています。
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '')

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    // 静的エクスポートでは Next.js の画像最適化サーバーを使えない。
    // 第1段階では自前のSVGプレースホルダーのみを使うため無効化する。
    unoptimized: true,
  },
  // 空文字を渡すとNext.jsが警告を出すので、値があるときだけ設定する
  ...(basePath ? { basePath } : {}),
}

export default nextConfig
