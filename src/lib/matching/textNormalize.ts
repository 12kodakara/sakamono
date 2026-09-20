/**
 * 商品名を比べられる形へそろえる。
 *
 * 日本のECサイトの商品名は表記がばらばらです。
 *
 *   ＬＩＶＥＲＰＯＯＬ ／ Liverpool ／ リバプール ／ リヴァプール
 *   25/26 ／ 2025/26 ／ 2025-26 ／ 25-26
 *   ｱﾃﾞｨﾀﾞｽ ／ アディダス ／ adidas
 *
 * そのまま文字列比較しても一致しないので、比べる前にそろえます。
 *
 * ★ただし、そろえすぎないこと。★
 *   「ホーム」と「アウェイ」を同じにしてしまうような正規化は、
 *   別商品を同じ商品と判定させてしまい、価格比較を壊します。
 *   ここでやるのは「同じ言葉の書き方の違い」を吸収するところまでです。
 */

/**
 * 全角・半角、大文字・小文字、余分な空白をそろえる。
 *
 * NFKC 正規化で
 *   ＡＢＣ → ABC ／ ｱﾃﾞｨﾀﾞｽ → アディダス ／ １２３ → 123
 * がまとめて片付きます。
 *
 * ★カタカナの長音符「ー」は変換しません。★
 *   「アウェー」と「アウェイ」は別の書き方なので別途そろえます。
 *   ハイフンと混同すると「ホーム-25」のような文字列が壊れます。
 */
export function normalizeText(value: string): string {
  if (typeof value !== 'string') return ''

  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      // ハイフンに見える記号をすべて半角ハイフンへ（長音符 U+30FC は対象外）
      .replace(/[‐‑‒–—―−－]/g, '-')
      // 記号類を空白へ（スラッシュとハイフンは意味を持つので残す）
      .replace(/[【】［］\[\]（）()｛｝{}「」『』〈〉《》"'`,、。．.!！?？:：;；|｜*＊+＋~〜^＾#＃%％&＆@＠]/g, ' ')
      // 中黒・読点などの区切りは空白へ
      .replace(/[・･]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * 記号を残したまま、全角・半角と大文字・小文字だけをそろえる。
 *
 * normalizeText() は「.」「#」などの記号を空白へ置き換えます。
 * そのため、記号そのものに意味がある判定
 * （「No.11」「7.フロリアン・ヴィルツ」のような背番号表記）には使えません。
 * そういう判定にはこちらを使います。
 */
export function normalizeLight(value: string): string {
  if (typeof value !== 'string') return ''
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ')
    .trim()
}

/** 語として含まれているか判定するために、前後へ空白を付けた形にする。 */
export function padded(value: string): string {
  return ` ${normalizeText(value)} `
}

/**
 * 正規化した文字列に、その語が含まれているか。
 *
 * 日本語には単語の区切りが無いため、英字の語は前後の空白で区切って探し、
 * 日本語の語はそのまま部分一致で探します。
 */
export function containsTerm(haystackPadded: string, term: string): boolean {
  const normalized = normalizeText(term)
  if (!normalized) return false

  // 英数字だけの語は、別の語の一部に埋もれないよう空白で区切って探す
  if (/^[a-z0-9][a-z0-9\s-]*$/.test(normalized)) {
    return haystackPadded.includes(` ${normalized} `)
  }
  return haystackPadded.includes(normalized)
}

/** 語の一覧のうち、1つでも含まれていればtrue。 */
export function containsAnyTerm(haystackPadded: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsTerm(haystackPadded, term))
}

/** 含まれていた語をすべて返す（どの語で判定したかを記録に残すため）。 */
export function matchedTerms(haystackPadded: string, terms: readonly string[]): string[] {
  return terms.filter((term) => containsTerm(haystackPadded, term))
}

/* ------------------------------------------------------------
 * シーズン
 * ---------------------------------------------------------- */

/**
 * シーズン表記を '2025/26' の形へそろえる。
 *
 * 対応する書き方: 2025/26 ／ 2025-26 ／ 25/26 ／ 25-26
 *
 * ★連続する2年でなければ採用しません。★
 *   「2025/28」やサイズ表記の「10/40」をシーズンと誤認しないためです。
 */
export function normalizeSeason(value: string | null | undefined): string | null {
  if (!value) return null

  const text = normalizeText(value)

  const fourDigit = text.match(/(?:^|\s)(20\d{2})\s*[/-]\s*(\d{2})(?:\s|$)/)
  if (fourDigit) {
    const start = Number(fourDigit[1])
    const end = Number(fourDigit[2])
    return (start + 1) % 100 === end ? `${start}/${fourDigit[2]}` : null
  }

  const twoDigit = text.match(/(?:^|\s)(\d{2})\s*[/-]\s*(\d{2})(?:\s|$)/)
  if (twoDigit) {
    const start = Number(twoDigit[1])
    const end = Number(twoDigit[2])
    return (start + 1) % 100 === end ? `20${twoDigit[1]}/${twoDigit[2]}` : null
  }

  return null
}

/**
 * 文章の中に出てくるシーズン表記をすべて拾う。
 *
 * 商品名に複数のシーズンが書かれていることがあります
 * （「24/25 25/26 対応」など）。その場合は「どれか1つ」と決めつけず、
 * 全部返して呼び出し側に判断させます。
 */
export function extractSeasons(value: string | null | undefined): string[] {
  if (!value) return []

  const text = normalizeText(value)
  const found = new Set<string>()

  const pattern = /(\d{2,4})\s*[/-]\s*(\d{2})/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const rawStart = match[1]
    const end = Number(match[2])

    if (rawStart.length === 4) {
      const start = Number(rawStart)
      if (start >= 2000 && start <= 2099 && (start + 1) % 100 === end) {
        found.add(`${start}/${match[2]}`)
      }
    } else if (rawStart.length === 2) {
      const start = Number(rawStart)
      if ((start + 1) % 100 === end) {
        found.add(`20${rawStart}/${match[2]}`)
      }
    }
  }

  return [...found]
}

/* ------------------------------------------------------------
 * 商品コード・品番
 * ---------------------------------------------------------- */

/**
 * メーカー品番やJANを比べる形へそろえる。
 * 英数字以外を落とし、大文字にします（JV6423 / jv-6423 を同じ扱いにするため）。
 */
export function normalizeCode(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.normalize('NFKC').replace(/[^0-9a-zA-Z]/g, '').toUpperCase()
  return normalized.length > 0 ? normalized : null
}

/** JANコードとして形が正しいか（8桁または13桁の数字）。 */
export function isJanCodeShape(value: string | null | undefined): boolean {
  const normalized = normalizeCode(value)
  if (!normalized) return false
  return /^\d{8}$/.test(normalized) || /^\d{13}$/.test(normalized)
}

/**
 * EANコードが、日本国内のJANとしてそのまま使えるか。
 *
 * ★EANだからといって自動的にJAN扱いしないこと。★
 *   JANは EAN のうち、日本の国コード（45 / 49）で始まるものです。
 *   ヨーロッパで採番された EAN（例: 50〜で始まる英国）を
 *   JANとして国内検索に使っても、まず見つかりません。
 *   見つかった場合はむしろ別商品の可能性が高く、危険です。
 */
export function isEanUsableAsJan(ean: string | null | undefined): boolean {
  const normalized = normalizeCode(ean)
  if (!normalized || !/^\d{13}$/.test(normalized)) return false
  return normalized.startsWith('45') || normalized.startsWith('49')
}

/**
 * そのJANが、日本国内で流通する商品のコードとして使えるか。
 *
 * ★2で始まる13桁は「インストアコード」です。★
 *   GS1が店舗内・事業所内限定の用途に開けている範囲で、
 *   量り売りの値札などに使われます。全国で流通する商品には付きません。
 *   サカモノの開発用fixtureも、実在のコードとぶつからないよう
 *   この範囲の値をダミーとして使っています。
 *
 *   ★ダミーのコードを外部APIへ投げないこと。★
 *   ★ダミーのコードを「一致しなかった」という判断材料にもしないこと。★
 *   どちらも、意味のないリクエストと、意味のない食い違いを生みます。
 */
export function isDistributableJan(value: string | null | undefined): boolean {
  const normalized = normalizeCode(value)
  if (!normalized || !/^\d{13}$/.test(normalized)) return false
  return !normalized.startsWith('2')
}
