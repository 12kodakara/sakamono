/**
 * 取り込みパイプライン確認用のサンプル生データ。
 *
 * ══════════════════════════════════════════════════════════════
 * ★★ これは Liverpool FC 公式ストアから取得したデータではありません ★★
 *
 *   すべてサカモノが手で書いた架空のデータです。
 *   商品名・価格・SKU・在庫はいずれも実在しません。
 *
 *   公式ストアの利用規約により自動取得を行っていないため
 *   （docs/data-sources/liverpool.md）、
 *   パイプラインの動作確認はこの架空データで行います。
 *
 *   origin: 'sample' が入っているので、
 *   取り込み結果には必ず「サンプル」の印が付きます。
 * ══════════════════════════════════════════════════════════════
 *
 * 意図的に「取れなかった項目」を混ぜてあります。
 * 欠けたデータを推測で埋めていないかを確かめるためです。
 *
 *   1. 理想的な商品（SKU・EAN・サイズ・在庫すべてあり、セール中）
 *   2. 通常価格が無い（セール判定ができない）
 *   3. レプリカ／オーセンティックが商品名から判別できない
 *   4. シーズンが書かれていない
 *   5. サイズ情報が無い（在庫不明）
 *   6. 全サイズ売り切れ
 *   7. オーセンティック（レプリカと取り違えてはいけない）
 *   8. トレーニングウェア
 *   9. ジャケット
 *  10. 分類できない商品
 */

import type { LiverpoolRawFeed } from './types'

const FETCHED_AT = '2026-09-19T00:00:00.000Z'

/** URLは example.com（仕様書用に予約されたドメイン）。実在ページではありません。 */
function sampleUrl(path: string): string {
  return `https://example.com/sample-liverpool/${path}`
}

export const liverpoolSampleFeed: LiverpoolRawFeed = {
  origin: 'sample',
  sourceNote:
    'サカモノが手で書いた架空のサンプル。Liverpool FC公式ストアから取得したものではありません。',
  fetchedAt: FETCHED_AT,
  products: [
    /* 1. すべての項目がそろっている商品（セール中） */
    {
      externalId: 'SAMPLE-LFC-0001',
      title: 'Sample LFC 25/26 Home Replica Shirt - Mens Short Sleeve',
      url: sampleUrl('0001?utm_source=newsletter&gclid=abc123'),
      currency: 'GBP',
      currentPrice: 64.95,
      regularPrice: 84.95,
      sku: 'SAMPLE-SKU-0001',
      ean: '2000000001001',
      imageUrl: 'https://example.com/sample-images/0001.jpg',
      variants: [
        { externalId: 'v-0001-s', size: 'S', sku: 'SAMPLE-SKU-0001-S', ean: null, available: true },
        { externalId: 'v-0001-m', size: 'M', sku: 'SAMPLE-SKU-0001-M', ean: null, available: false },
        { externalId: 'v-0001-l', size: 'L', sku: 'SAMPLE-SKU-0001-L', ean: null, available: true },
      ],
      fetchedAt: FETCHED_AT,
    },

    /* 2. 通常価格が取れない（セールかどうか分からない） */
    {
      externalId: 'SAMPLE-LFC-0002',
      title: 'Sample LFC 25/26 Away Replica Shirt - Mens',
      url: sampleUrl('0002'),
      currency: 'GBP',
      currentPrice: 74.95,
      regularPrice: null,
      sku: 'SAMPLE-SKU-0002',
      ean: null,
      imageUrl: 'https://example.com/sample-images/0002.jpg',
      variants: [
        { externalId: 'v-0002-m', size: 'M', sku: null, ean: null, available: true },
        { externalId: 'v-0002-l', size: 'L', sku: null, ean: null, available: true },
      ],
      fetchedAt: FETCHED_AT,
    },

    /* 3. レプリカ／オーセンティックが判別できない */
    {
      externalId: 'SAMPLE-LFC-0003',
      title: 'Sample LFC 25/26 Home Shirt',
      url: sampleUrl('0003'),
      currency: 'GBP',
      currentPrice: 69.95,
      regularPrice: 69.95,
      sku: 'SAMPLE-SKU-0003',
      ean: null,
      imageUrl: null,
      variants: [{ externalId: 'v-0003-m', size: 'M', sku: null, ean: null, available: true }],
      fetchedAt: FETCHED_AT,
    },

    /* 4. シーズンが書かれていない */
    {
      externalId: 'SAMPLE-LFC-0004',
      title: 'Sample LFC Home Replica Shirt',
      url: sampleUrl('0004'),
      currency: 'GBP',
      currentPrice: 59.95,
      regularPrice: 59.95,
      sku: null,
      ean: null,
      imageUrl: null,
      variants: [{ externalId: 'v-0004-m', size: 'M', sku: null, ean: null, available: true }],
      fetchedAt: FETCHED_AT,
    },

    /* 5. サイズ情報が無い（在庫が分からない） */
    {
      externalId: 'SAMPLE-LFC-0005',
      title: 'Sample LFC 25/26 Third Replica Shirt - Womens',
      url: sampleUrl('0005'),
      currency: 'GBP',
      currentPrice: 64.95,
      regularPrice: 64.95,
      sku: 'SAMPLE-SKU-0005',
      ean: null,
      imageUrl: 'https://example.com/sample-images/0005.jpg',
      variants: [],
      fetchedAt: FETCHED_AT,
    },

    /* 6. 全サイズ売り切れ */
    {
      externalId: 'SAMPLE-LFC-0006',
      title: 'Sample LFC 24/25 Home Replica Shirt - Junior',
      url: sampleUrl('0006'),
      currency: 'GBP',
      currentPrice: 39.95,
      regularPrice: 54.95,
      sku: 'SAMPLE-SKU-0006',
      ean: null,
      imageUrl: null,
      variants: [
        { externalId: 'v-0006-sb', size: 'SB', sku: null, ean: null, available: false },
        { externalId: 'v-0006-mb', size: 'MB', sku: null, ean: null, available: false },
      ],
      fetchedAt: FETCHED_AT,
    },

    /* 7. オーセンティック（★レプリカと取り違えてはいけない★） */
    {
      externalId: 'SAMPLE-LFC-0007',
      title: 'Sample LFC 25/26 Home Authentic Shirt - Mens',
      url: sampleUrl('0007'),
      currency: 'GBP',
      currentPrice: 119.95,
      regularPrice: 119.95,
      sku: 'SAMPLE-SKU-0007',
      ean: '2000000001007',
      imageUrl: null,
      variants: [
        { externalId: 'v-0007-m', size: 'M', sku: 'SAMPLE-SKU-0007-M', ean: null, available: true },
      ],
      fetchedAt: FETCHED_AT,
    },

    /* 8. トレーニングウェア */
    {
      externalId: 'SAMPLE-LFC-0008',
      title: 'Sample LFC 25/26 Training Top - Mens Long Sleeve',
      url: sampleUrl('0008'),
      currency: 'GBP',
      currentPrice: 49.95,
      regularPrice: 59.95,
      sku: 'SAMPLE-SKU-0008',
      ean: null,
      imageUrl: null,
      variants: [
        { externalId: 'v-0008-m', size: 'M', sku: null, ean: null, available: null },
        { externalId: 'v-0008-l', size: 'L', sku: null, ean: null, available: null },
      ],
      fetchedAt: FETCHED_AT,
    },

    /* 9. ジャケット */
    {
      externalId: 'SAMPLE-LFC-0009',
      title: 'Sample LFC Rain Jacket - Mens',
      url: sampleUrl('0009'),
      currency: 'GBP',
      currentPrice: 89.95,
      regularPrice: 89.95,
      sku: 'SAMPLE-SKU-0009',
      ean: null,
      imageUrl: null,
      variants: [{ externalId: 'v-0009-l', size: 'L', sku: null, ean: null, available: true }],
      fetchedAt: FETCHED_AT,
    },

    /* 10. 分類できない商品（★無理に分類しない★） */
    {
      externalId: 'SAMPLE-LFC-0010',
      title: 'Sample LFC Enamel Pin Badge',
      url: sampleUrl('0010'),
      currency: 'GBP',
      currentPrice: 6.95,
      regularPrice: 6.95,
      sku: null,
      ean: null,
      imageUrl: null,
      variants: [],
      fetchedAt: FETCHED_AT,
    },
  ],
}
