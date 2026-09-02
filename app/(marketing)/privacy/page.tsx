import Link from "next/link";

// 公開前のドラフトです。実際の公開前に、内容が実態と合っているか
// （実際に収集している情報・送信先の事業者名等）を必ず見直してください。
// 法的な有効性・妥当性については、専門家（弁護士等）のレビューを推奨します。
export const metadata = {
  title: "プライバシーポリシー | 関心情報ダッシュボード",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          プライバシーポリシー
        </h1>
        <p className="text-sm text-slate-500">最終改定日: 2026年9月2日</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-700">
        <p>
          関心情報ダッシュボード運営事務局（以下「当方」といいます）は、「関心情報ダッシ
          ュボード」（以下「本サービス」といいます）における、ユーザーの情報の取り扱いに
          ついて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定め
          ます。
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            1. 収集する情報
          </h2>
          <p>本サービスでは、以下の情報を取得します。</p>
          <ul className="list-disc pl-5">
            <li>アカウント情報（メールアドレス・パスワード）</li>
            <li>
              ユーザーが登録したトピック名・キーワード・説明文、選択した興味カテゴリ
            </li>
            <li>
              本サービスが表示した情報に対するリアクション（いいね・非表示・保存・クリッ
              ク等）の履歴
            </li>
            <li>
              情報源（サイト・RSSフィード等）に関する設定・評価
            </li>
            <li>
              アプリの利用状況に関する技術的情報（アクセス日時、エラーログ等）
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            2. 利用目的
          </h2>
          <p>取得した情報は、以下の目的で利用します。</p>
          <ul className="list-disc pl-5">
            <li>本サービスのアカウント認証・ログイン状態の維持のため</li>
            <li>
              登録されたトピックに関連する情報を収集・選別・要約し、おすすめカードとして
              表示するため
            </li>
            <li>
              リアクション履歴等をもとに、表示する情報の精度・ユーザーごとの適合度を改善
              するため
            </li>
            <li>不正利用の防止、サービスの安定運用のため</li>
            <li>お問い合わせへの対応のため</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            3. 第三者への提供・外部サービスの利用
          </h2>
          <p>
            本サービスは、機能の提供にあたり、以下の外部事業者のサービスを利用していま
            す。これらの事業者に対し、機能の実現に必要な範囲でユーザーの情報（登録トピッ
            ク名・検索クエリ等）を送信することがあります。
          </p>
          <ul className="list-disc pl-5">
            <li>
              <span className="font-medium">Supabase</span>
              （データベース・認証基盤。アカウント情報、登録データ全般の保管）
            </li>
            <li>
              <span className="font-medium">Anthropic</span>
              （AI（Claude）による情報の分析・要約・カード生成。ユーザーが登録したトピッ
              ク名や、収集した記事の見出し・本文の一部を処理のために送信します）
            </li>
            <li>
              <span className="font-medium">Brave Search</span>
              （Web検索。トピックに関連する検索クエリを送信します）
            </li>
            <li>
              <span className="font-medium">Vercel</span>
              （ホスティング基盤。アクセスログ等を処理します）
            </li>
          </ul>
          <p>
            上記のほか、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供
            することはありません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            4. Cookie等の利用
          </h2>
          <p>
            本サービスは、ログイン状態を維持するために認証用のCookieを利用します。これら
            は本サービスの提供に必要な範囲でのみ利用し、広告目的のトラッキングには使用し
            ません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            5. データの保存期間・削除
          </h2>
          <p>
            ユーザーの情報は、アカウントが存在する間、本サービスの提供に必要な期間保存し
            ます。アカウントの削除をご希望の場合は、下記のお問い合わせ先までご連絡くださ
            い。確認のうえ、合理的な期間内にアカウントおよび関連データを削除します。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            6. 未成年の利用について
          </h2>
          <p>
            未成年の方が本サービスを利用する場合は、保護者の同意を得たうえでご利用くださ
            い。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            7. 本ポリシーの変更
          </h2>
          <p>
            当方は、必要と判断した場合には、ユーザーに通知することなく本ポリシーを変更す
            ることがあります。変更後の内容は、本ページに掲載した時点から効力を生じるもの
            とします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            8. お問い合わせ窓口
          </h2>
          <p>
            本ポリシーに関するお問い合わせ、開示・訂正・削除等のご請求は、以下の連絡先ま
            でお願いいたします。
          </p>
          <p>Eメール: kumashiro.m.269@gmail.com</p>
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
