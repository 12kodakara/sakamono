<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- ここから下は手書き。next dev が書き換えるのは上のブロックだけです。 -->

# 2台のPCで開発しています（自宅PC / 会社PC）

手順の詳細は `docs/two-pc-workflow.md` にあります。作業前に読んでください。

**正本は GitHub です。** 作業開始時は `git pull`、作業終了時は `commit` → `push`。

## 会社PCには Node.js がありません

会社PCで作業している場合、`npm` で始まるコマンドは実行できません。
`npm test` / `npm run typecheck` / `npm run build` / `npm run dev` は**使えません**。

- Node.js をインストールしようとしないでください。
- 会社の制限を回避しようとしないでください。
- 代わりに `git status` と `git diff` で変更内容を確認し、commit → push してください。
  検証は GitHub Actions（`.github/workflows/deploy-pages.yml`）が行います。
- Node.js が使えるかどうかは、`node -v` が動くかで判断できます。

自宅PCでは従来どおり、`npm test` → `npm run typecheck` → `npm run build` を
実行してから commit してください。

## 秘密情報

- このリポジトリは **public（全世界に公開）** です。
- APIキーは `.env.local` にだけ置きます。Git の管理対象外です。
- `.env.local` の中身を、出力・コピー・commit・push しないでください。
- 値が空の雛形は `.env.example` です。こちらには値を書きません。
