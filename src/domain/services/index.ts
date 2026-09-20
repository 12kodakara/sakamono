/**
 * 価格計算サービスのまとめ。
 *
 * 画面（components / app）はここから import する。
 * 個々のファイルを直接指定しても動くが、入口を1つにしておくと
 * 「価格の計算はこのフォルダにある」と分かりやすい。
 *
 *   exchange       … 円換算
 *   shipping       … 送料の解決
 *   importCost     … 輸入コストの見積り
 *   paymentCost    … 決済・為替関連コスト
 *   landedCost     … 日本到着推定額（上の4つを合計する）
 *   variantMatch   … レプリカ/オーセンティックなどの取り違え防止
 *   domesticPrice  … 国内比較価格の選択
 *   priceComparison… 海外と国内の比較結果
 *   discount       … 割引率
 *   priceHistory   … 価格履歴のまとめ
 *   freshness      … 価格データの鮮度
 *   saleSignals    … 注目セール判定の材料
 */

export * from './exchange'
export * from './shipping'
export * from './importCost'
export * from './paymentCost'
export * from './landedCost'
export * from './variantMatch'
export * from './domesticPrice'
export * from './priceComparison'
export * from './discount'
export * from './priceHistory'
export * from './freshness'
export * from './saleSignals'
