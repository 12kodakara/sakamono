/**
 * 商品の fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 * 商品名・品番はレイアウト確認用に作った架空のものを含みます。
 * 実在の商品情報として扱わないでください。
 *
 * ■ EAN / JAN について
 *   サンプル値には先頭が "20" のコードを使っています。
 *   このプレフィックスは店舗内管理用として予約されており、
 *   実在の市販商品へ割り当てられることがないため、
 *   本物の商品コードと衝突しません。
 *
 * ■ 画像について
 *   すべて自前で作成したSVGプレースホルダーです。
 *   クラブや用品メーカーの画像は権利確認が済むまでリポジトリへ置きません。
 *   （Product.image.source で 'placeholder' と明示しています）
 */

import type { Product, ProductImage } from '@/domain/types'

/** 画像プレースホルダーを組み立てる小さなヘルパー。 */
function placeholder(file: string, alt: string): ProductImage {
  return {
    src: `/images/${file}`,
    alt: `${alt}（商品画像は準備中のため、サカモノのプレースホルダー画像を表示しています）`,
    width: 800,
    height: 800,
    source: 'placeholder',
  }
}

export const productFixtures: Product[] = [
  /* ----- Liverpool ----------------------------------------- */
  {
    id: 'product-lfc-2526-home-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica',
    name: 'Liverpool FC 2025/26 Home Replica Shirt',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    // 第4.5段階の実データ検証で判明した事実にもとづく修正。
    // リヴァプールの2025/26シーズンのサプライヤーは adidas（Nikeは2024/25まで）。
    // ★誤ったメーカー名は、照合で全件が別メーカー扱いになり比較が成立しなくなる。★
    manufacturer: 'adidas',
    // 実データ検証で確認した実際の品番（半袖ホーム。長袖は JV6456）。
    // ★品番は商品を一意に指す事実情報。第5段階では公式フィードから取得する。★
    // 公式確認: adidas公式の商品ページ（個別）で品番・商品名・カラーを人手で確認済み（2026-09-23）。
    // 記録: docs/data-sources/manual-official-checks.md（JV6423）
    manufacturerSku: 'JV6423',
    // ★JAN/EANは未確認のままにしています。★
    //   以前は動作確認用の仮コード（先頭が20の店舗内管理用番号）を入れていましたが、
    //   公式確認済みの商品に根拠の無いコードを残さないため削除しました。
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },
  {
    id: 'product-lfc-2526-away-authentic',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-away-authentic',
    name: 'Liverpool FC 2025/26 Away Authentic Shirt',
    nameJa: 'リヴァプール 2025/26 アウェイ オーセンティック ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'away',
    authenticity: 'authentic',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-away.svg', 'アウェイユニフォーム'),
    active: true,
  },
  {
    id: 'product-lfc-2526-training-top',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-training-top',
    name: 'Liverpool FC 2025/26 Training Top',
    nameJa: 'リヴァプール 2025/26 トレーニングトップ',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null,
    category: 'training',
    kitType: null,
    authenticity: null,
    sleeve: 'long',
    gender: 'unisex',
    player: null,
    image: placeholder('placeholder-training.svg', 'トレーニングトップ'),
    active: true,
  },

  /* ----- Tottenham Hotspur --------------------------------- */
  {
    id: 'product-thfc-2526-home-replica',
    clubId: 'club-tottenham',
    slug: 'tottenham-2025-26-home-replica',
    name: 'Tottenham Hotspur 2025/26 Home Replica Shirt',
    nameJa: 'トッテナム 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null, // 未確認（開発用の仮コードを削除）
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },
  {
    id: 'product-thfc-2526-scarf',
    clubId: 'club-tottenham',
    slug: 'tottenham-2025-26-scarf',
    name: 'Tottenham Hotspur Crest Scarf',
    nameJa: 'トッテナム クレスト マフラー',
    season: '2025/26',
    manufacturer: 'Tottenham Hotspur',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null,
    category: 'scarves',
    kitType: null,
    authenticity: null,
    sleeve: null,
    gender: 'unisex',
    player: null,
    image: placeholder('placeholder-scarf.svg', 'マフラー'),
    active: true,
  },

  /* ----- FC Barcelona -------------------------------------- */
  {
    id: 'product-fcb-2526-home-replica',
    clubId: 'club-fc-barcelona',
    slug: 'fc-barcelona-2025-26-home-replica',
    name: 'FC Barcelona 2025/26 Home Replica Shirt',
    nameJa: 'FCバルセロナ 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null, // 未確認（開発用の仮コードを削除）
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },
  {
    id: 'product-fcb-2526-third-replica',
    clubId: 'club-fc-barcelona',
    slug: 'fc-barcelona-2025-26-third-replica',
    name: 'FC Barcelona 2025/26 Third Replica Shirt',
    nameJa: 'FCバルセロナ 2025/26 サード レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'third',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'women',
    player: null,
    image: placeholder('placeholder-kit-third.svg', 'サードユニフォーム'),
    active: true,
  },

  /* ----- Real Madrid --------------------------------------- */
  {
    id: 'product-rma-2526-home-replica',
    clubId: 'club-real-madrid',
    slug: 'real-madrid-2025-26-home-replica',
    name: 'Real Madrid 2025/26 Home Replica Shirt',
    nameJa: 'レアル・マドリード 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    // 公式確認: adidas公式の商品ページで品番・商品名・カラー・仕様を人手で確認済み（2026-09-23）。
    // 記録: docs/data-sources/manual-official-checks.md（JJ1931）
    manufacturerSku: 'JJ1931',
    jan: null,
    ean: null, // 未確認（開発用の仮コードを削除）
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },
  {
    id: 'product-rma-2526-home-authentic',
    clubId: 'club-real-madrid',
    slug: 'real-madrid-2025-26-home-authentic',
    name: 'Real Madrid 2025/26 Home Authentic Shirt',
    nameJa: 'レアル・マドリード 2025/26 ホーム オーセンティック ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    // 公式確認: adidas公式の商品情報で品番・商品名・カラー・仕様を人手で確認済み（2026-09-23）。
    // ★レプリカ（JJ1931）とは別商品・別品番。取り違えると価格比較が大きく狂う。★
    // 記録: docs/data-sources/manual-official-checks.md（JV5918）
    manufacturerSku: 'JV5918',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'authentic',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },

  /* ===== 第2段階で追加した検証用の商品 ====================== */

  /**
   * ケースA: 海外購入がかなり安い。
   * 前シーズンの在庫処分という想定で、大きく値下げされている。
   */
  {
    id: 'product-lfc-2425-home-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2024-25-home-replica',
    name: 'Liverpool FC 2024/25 Home Replica Shirt',
    nameJa: 'リヴァプール 2024/25 ホーム レプリカ ユニフォーム',
    season: '2024/25',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null, // 未確認（開発用の仮コードを削除）
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム'),
    active: true,
  },

  /**
   * ケースC: 送料不明。
   * 海外セレクトショップC（サンプル）だけが扱っており、
   * そのストアの日本向け送料が分からない。
   * 日本到着推定額は「算出不可」となり、送料を除く参考額だけを表示する。
   */
  {
    id: 'product-thfc-2526-away-replica',
    clubId: 'club-tottenham',
    slug: 'tottenham-2025-26-away-replica',
    name: 'Tottenham Hotspur 2025/26 Away Replica Shirt',
    nameJa: 'トッテナム 2025/26 アウェイ レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: null, // 品番は未確認（開発用の仮の値を削除）
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'away',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: placeholder('placeholder-kit-away.svg', 'アウェイユニフォーム'),
    active: true,
  },
  /* ----- Liverpool（第4.6段階：照合の精度を測るために追加）--------
   *
   * ★ここから下は「照合エンジンを確かめるための商品」です。★
   *   半袖と長袖、無地と選手名入り、大人用と子供用のように、
   *   取り違えると価格比較が壊れる組み合わせをわざと並べています。
   *
   * ★品番の扱い★
   *   実データ検証で品番を確認できたものだけ manufacturerSku を入れています。
   *   確認できていないものは null です。
   *   ★それらしい品番をでっち上げないこと。★
   *   誤った品番は、別商品を「品番が一致した」と判定させます。
   *
   * ★海外ストアの掲載はまだありません。★
   *   国内側の照合を確かめるための商品なので、
   *   日本到着推定額は出ません（画面では「取り扱い情報なし」になります）。
   * -------------------------------------------------------- */
  {
    id: 'product-lfc-2526-home-replica-long',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica-long-sleeve',
    name: 'Liverpool FC 2025/26 Home Replica Shirt (Long Sleeve)',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム（長袖）',
    season: '2025/26',
    manufacturer: 'adidas',
    // 実データ検証で確認した品番。半袖の JV6423 とは別商品・別価格。
    // 公式確認: adidas.jp の表示で品番・クラブ・シーズン・種類・仕様・メーカーの一致を人手で確認済み（2026-09-22）。
    // 記録: docs/data-sources/manual-official-checks.md（JV6456）
    manufacturerSku: 'JV6456',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'long',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム（長袖）'),
    active: true,
  },
  {
    id: 'product-lfc-2526-home-replica-junior',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica-junior',
    name: 'Liverpool FC 2025/26 Home Replica Shirt (Junior)',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム（ジュニア）',
    season: '2025/26',
    manufacturer: 'adidas',
    // 実データ検証で確認した品番。大人用の JV6423 とは別商品・別価格。
    // ★子供用は大人用よりかなり安いため、取り違えると「国内が激安」に見える。★
    // 公式確認: adidas.jp の表示で品番・クラブ・シーズン・種類・仕様・メーカーの一致を人手で確認済み（2026-09-22）。
    // 記録: docs/data-sources/manual-official-checks.md（JV6436）
    manufacturerSku: 'JV6436',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'kids',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム（ジュニア）'),
    active: true,
  },
  {
    id: 'product-lfc-2526-away-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-away-replica',
    name: 'Liverpool FC 2025/26 Away Replica Shirt',
    nameJa: 'リヴァプール 2025/26 アウェイ レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    // 実データ検証で確認した品番。
    // 公式確認: adidas.jp の表示で品番・クラブ・シーズン・種類・仕様・メーカーの一致を人手で確認済み（2026-09-22）。
    // 記録: docs/data-sources/manual-official-checks.md（JV6487）
    manufacturerSku: 'JV6487',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'away',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-away.svg', 'アウェイユニフォーム'),
    active: true,
  },
  {
    id: 'product-lfc-2526-home-replica-salah',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica-salah',
    name: 'Liverpool FC 2025/26 Home Replica Shirt (Salah 11)',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム（サラー 11番）',
    season: '2025/26',
    manufacturer: 'adidas',
    // ★無地と同じ品番です。★
    //   マーキングは後から入れるため、品番はシャツのものと同じになります。
    //   だからこそ「品番が一致した」だけで同じ商品と判断してはいけません。
    manufacturerSku: 'JV6423',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: 'モハメド・サラー',
    personalization: 'player-marked',
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム（サラー）'),
    active: true,
  },
  {
    id: 'product-lfc-2526-third-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-third-replica',
    name: 'Liverpool FC 2025/26 Third Replica Shirt',
    nameJa: 'リヴァプール 2025/26 サード レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    // 公式確認: adidas公式の商品ページ（個別）で品番・商品名・カラーを人手で確認済み（2026-09-23）。
    // 記録: docs/data-sources/manual-official-checks.md（KA6855）
    manufacturerSku: 'KA6855',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'third',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-third.svg', 'サードユニフォーム'),
    active: true,
  },
  {
    id: 'product-lfc-2526-home-authentic',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-authentic',
    name: 'Liverpool FC 2025/26 Home Authentic Shirt',
    nameJa: 'リヴァプール 2025/26 ホーム オーセンティック ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    // 公式確認: adidas公式の商品ページ（個別）で品番・商品名・カラーを人手で確認済み（2026-09-23）。
    // 記録: docs/data-sources/manual-official-checks.md（JY4237）
    manufacturerSku: 'JY4237',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    // ★レプリカと1万円以上違う別商品。取り違えは価格比較を大きく狂わせる。★
    authenticity: 'authentic',
    sleeve: 'short',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-home.svg', 'ホームユニフォーム（オーセンティック）'),
    active: true,
  },
  {
    id: 'product-lfc-2526-goalkeeper-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-goalkeeper-replica',
    name: 'Liverpool FC 2025/26 Goalkeeper Replica Shirt',
    nameJa: 'リヴァプール 2025/26 ゴールキーパー レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'adidas',
    manufacturerSku: null,
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'goalkeeper',
    authenticity: 'replica',
    sleeve: 'long',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-kit-third.svg', 'ゴールキーパーユニフォーム'),
    active: true,
  },
  {
    id: 'product-lfc-2526-anthem-jacket',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-anthem-jacket',
    name: 'Liverpool FC 2025/26 Anthem Jacket',
    nameJa: 'リヴァプール 2025/26 アンセムジャケット',
    season: '2025/26',
    manufacturer: 'adidas',
    manufacturerSku: null,
    jan: null,
    ean: null,
    category: 'jackets',
    // ユニフォームではないので kitType は付けない
    kitType: null,
    authenticity: null,
    sleeve: 'long',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: placeholder('placeholder-training.svg', 'アンセムジャケット'),
    active: true,
  },
]
