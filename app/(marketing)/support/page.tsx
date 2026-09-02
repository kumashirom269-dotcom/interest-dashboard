import Link from "next/link";

export const metadata = {
  title: "サポート | 関心情報ダッシュボード",
};

export default function SupportPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          サポート
        </h1>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-700">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            お問い合わせ
          </h2>
          <p>
            「関心情報ダッシュボード」のご利用方法、不具合のご報告、ご意見・ご要望など
            は、以下のメールアドレスまでお願いいたします。
          </p>
          <p>Eメール: kumashiro.m.269@gmail.com</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            よくあるご質問
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium text-slate-900">
                Q. パスワードを忘れてしまいました
              </p>
              <p>
                A. ログイン画面の「パスワードをお忘れですか？」からメールアドレスを入
                力すると、再設定用のリンクが届きます。
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">
                Q. アカウントを削除したいです
              </p>
              <p>
                A. 上記のお問い合わせ先までご連絡ください。確認のうえ、アカウントおよ
                び関連データを削除いたします。
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-900">
                Q. 表示される情報は正確ですか？
              </p>
              <p>
                A. 本サービスの情報はAIが自動収集・要約したものです。誤りが含まれる場
                合があるため、重要な判断の際は公式情報源をご確認ください。詳しくは
                <Link
                  href="/terms"
                  className="mx-1 font-medium text-slate-900 underline underline-offset-2"
                >
                  利用規約
                </Link>
                をご覧ください。
              </p>
            </div>
          </div>
        </section>
      </div>

      <Link
        href="/"
        className="text-sm font-medium text-slate-900 underline underline-offset-2"
      >
        トップページへ戻る
      </Link>
    </div>
  );
}
