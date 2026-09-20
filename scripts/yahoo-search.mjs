/**
 * Yahoo!ショッピング検索コマンドの入口。
 *
 *   npm run data:yahoo:search -- --product=<id> --sample
 *   npm run data:yahoo:search -- --product=<id> --dry-run
 *
 * 中身は TypeScript（src/data/external/yahoo/cli.ts）です。
 * このファイルは esbuild でそれを1つにまとめて実行しているだけです。
 * 専用のTS実行ツールを増やさず、すでに入っている esbuild を使っています。
 *
 * ★公式APIのみ使用します。HTMLスクレイピングは行いません。★
 *   --sample を付けた場合は外部通信も行いません。
 */

import { build, stop } from 'esbuild'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const projectRoot = process.cwd()
const outDir = path.join(projectRoot, '.cache', 'build')

/**
 * .env.local を読み込む。
 *
 * Next.js は自動で読みますが、素の Node は読みません。
 * このコマンドは Node で直接動くので、ここで明示的に読み込みます。
 *
 * ★読み込んだ値（APIキーなど）は絶対に出力しないこと。★
 */
function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.join(projectRoot, file))
    } catch {
      // ファイルが無い場合は何もしない（キーが無くても動く経路があるため）
    }
  }
}
const outFile = path.join(outDir, 'yahoo-cli.mjs')

async function run() {
  loadLocalEnv()

  await mkdir(outDir, { recursive: true })

  const result = await build({
    entryPoints: [path.join(projectRoot, 'src/data/external/yahoo/cli.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    write: false,
    // tsconfig の "@/*" -> "./src/*" と同じ解決をさせる
    alias: { '@': path.join(projectRoot, 'src') },
    // node: 系の組み込みモジュールはそのまま残す
    external: ['node:*'],
    logLevel: 'warning',
  })

  await writeFile(outFile, result.outputFiles[0].text, 'utf8')

  const module = await import(pathToFileURL(outFile).href)
  const exitCode = await module.main(process.argv.slice(2))

  // 一時ファイルは残さない
  await rm(outFile, { force: true })

  // ここで process.exit() を呼ぶと、esbuild の子プロセスが片付く前に
  // 落ちて libuv の警告が出ることがある。終了コードだけ設定して
  // Node に自然に終了させる。
  process.exitCode = exitCode
  stop()
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
  stop()
})
