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
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: {
    // 静的エクスポートでは Next.js の画像最適化サーバーを使えない。
    // 第1段階では自前のSVGプレースホルダーのみを使うため無効化する。
    unoptimized: true,
  },
}

export default nextConfig
