import Link from "next/link";

// 公開前のドラフトです。実際の公開前に、内容が実態と合っているか
// （運営体制・提供機能・第三者提供先等）を必ず見直してください。
// 法的な有効性・妥当性については、専門家（弁護士等）のレビューを推奨します。
export const metadata = {
  title: "利用規約 | Antenna",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          利用規約
        </h1>
        <p className="text-sm text-slate-500">最終改定日: 2026年9月2日</p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-slate-700">
        <p>
          この利用規約（以下「本規約」といいます）は、Antenna運営事務局
          （以下「当方」といいます）が提供する「Antenna」（以下「本サービス」
          といいます）の利用条件を定めるものです。本サービスをご利用になる方（以下
          「ユーザー」といいます）には、本規約に従って本サービスをご利用いただきます。
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第1条（適用）
          </h2>
          <p>
            本規約は、ユーザーと当方との間の本サービスの利用に関わる一切の関係に適用され
            るものとします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第2条（利用登録）
          </h2>
          <p>
            本サービスの利用を希望する方は、メールアドレスおよびパスワードにより利用登録
            を行うものとします。当方は、以下のいずれかに該当すると判断した場合、利用登録
            の申請を承認しないことがあります。
          </p>
          <ul className="list-disc pl-5">
            <li>虚偽の情報を届け出た場合</li>
            <li>本規約に違反したことがある者からの申請である場合</li>
            <li>その他、当方が利用登録を相当でないと判断した場合</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第3条（禁止事項）
          </h2>
          <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
          <ul className="list-disc pl-5">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>
              本サービスのネットワークまたはシステム等に過度な負荷をかける行為、その他
              本サービスの運営を妨害するおそれのある行為
            </li>
            <li>
              スクリプト等の自動化手段による大量のトピック登録・リクエスト送信等、通常の
              利用の範囲を超えてAPI呼び出しを発生させる行為
            </li>
            <li>当方や第三者の知的財産権、肖像権、プライバシー等を侵害する行為</li>
            <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>その他、当方が不適切と判断する行為</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第4条（本サービスの提供の停止等）
          </h2>
          <p>
            当方は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知するこ
            となく本サービスの全部または一部の提供を停止または中断することができるものと
            します。
          </p>
          <ul className="list-disc pl-5">
            <li>本サービスにかかるシステムの保守点検または更新を行う場合</li>
            <li>
              地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困
              難となった場合
            </li>
            <li>
              本サービスが利用する外部サービス（データベース・AI API・検索API等）が停止
              した場合
            </li>
            <li>その他、当方が本サービスの提供が困難と判断した場合</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第5条（保証の否認および免責事項）
          </h2>
          <p>
            本サービスは、ユーザーが登録したトピックに関連する情報を、AI（人工知能）が
            自動的に収集・要約・生成して提示するものです。当方は、本サービスが提示する
            情報について、その正確性・完全性・最新性・特定目的への適合性等を一切保証しま
            せん。特にAIが生成した要約・見出し・「なぜおすすめか」等の文章には、誤りや事
            実と異なる内容が含まれる可能性があります。
          </p>
          <p>
            医療・健康、法律、金融、防災・安全に関する情報については、本サービスの表示内
            容のみで判断・行動せず、必ず公式情報源または専門家に確認してください。当方
            は、本サービスの利用によりユーザーに生じた損害について、当方の故意または重過
            失による場合を除き、一切の責任を負いません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第6条（サービス内容の変更等）
          </h2>
          <p>
            当方は、ユーザーへの事前の告知をもって、本サービスの内容を変更、追加または廃
            止することがあり、ユーザーはこれを承諾するものとします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第7条（利用規約の変更）
          </h2>
          <p>
            当方は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変
            更できるものとします。変更後の本規約は、本ページに掲載した時点から効力を生じ
            るものとします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第8条（退会）
          </h2>
          <p>
            ユーザーは、当方所定の方法により、いつでも本サービスの利用を退会できるものと
            します。退会にあたっての具体的な手続きは
            <Link
              href="/privacy"
              className="mx-1 font-medium text-slate-900 underline underline-offset-2"
            >
              プライバシーポリシー
            </Link>
            をご確認ください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            第9条（準拠法・裁判管轄）
          </h2>
          <p>
            本規約の解釈にあたっては、日本法を準拠法とします。本サービスに関して紛争が生
            じた場合には、当方の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            お問い合わせ
          </h2>
          <p>
            本規約に関するお問い合わせは、以下の連絡先までお願いいたします。
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
