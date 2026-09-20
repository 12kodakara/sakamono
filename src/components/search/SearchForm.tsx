/**
 * 検索フォーム。
 *
 * ふつうの <form method="get"> なので、JavaScriptが無くても動く。
 * 送信すると /search/?q=... へ移動する。
 *
 * 入力欄には必ず <label> を結び付ける（読み上げソフトが何の欄か伝えられるように）。
 * placeholder はラベルの代わりにはならない。
 */

export interface SearchFormProps {
  /** ページ内で重複しないid。ラベルと入力欄を結び付けるために使う。 */
  id: string
  defaultValue?: string
  placeholder?: string
  /** 画面に見えるラベルを出すか（既定は読み上げ用のみ）。 */
  showLabel?: boolean
  label?: string
}

export function SearchForm({
  id,
  defaultValue = '',
  placeholder = '商品名・クラブ名・選手名で検索',
  showLabel = false,
  label = '商品を検索',
}: SearchFormProps) {
  return (
    <form className="search-form" action="/search/" method="get" role="search">
      <label htmlFor={id} className={showLabel ? undefined : 'visually-hidden'}>
        {label}
      </label>
      <input
        id={id}
        className="search-form__input"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button type="submit" className="search-form__button">
        検索
      </button>
    </form>
  )
}
