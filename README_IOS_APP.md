# iPhoneアプリ化（Capacitor）について

このアプリは、Server Actions・Cookieベースの認証（Supabase Auth）・サーバー側レンダリングを
多用しているため、「Webの画面をまるごとアプリ内バンドルとして持たせる」方式ではなく、
**実際にデプロイした本番URLを、ネイティブのアプリ（WKWebView）でそのまま開く方式**
（Capacitorの`server.url`方式）を採用しています。これによりWeb側のコードは一切変更せずに
そのままiPhoneアプリとして動作します。

## セットアップ済みの内容

- [x] Capacitorパッケージ導入（`@capacitor/core` `@capacitor/ios` `@capacitor/app` `@capacitor/cli` `@capacitor/assets`）
- [x] `capacitor.config.ts` 作成（アプリID: `com.interestdashboard.app`、アプリ名: 「Antenna」）
- [x] `ios/` ディレクトリにXcodeプロジェクト生成済み（`npx cap add ios`）
- [x] アプリアイコン・スプラッシュ画像を生成し、Xcodeプロジェクトへ反映済み
- [x] ノッチ・ホームインジケーター対応（safe-area）をCSSに追加
- [x] `npm run ios:sync` / `npm run ios:open` / `npm run ios:assets` スクリプトを整備
- [x] `capacitor.config.ts`の`server.url`を本番カスタムドメイン **https://www.myantenna.app** に設定済み
- [x] Apple Developer Program登録済み（Team ID: `WAY9789685`）
- [x] App Store Connectでアプリ作成済み（Bundle ID: `com.interestdashboard.app`）
- [x] TestFlight・App Store Connectへのビルドアップロード運用が確立済み（後述）
- [x] App Store審査への提出運用が確立済み（審査状況は随時変動するため、最新状況はApp Store Connectで確認してください）

## ローカルで実機・シミュレータで動かしたい場合

```bash
npm run ios:open
```

Xcodeが開きます。左側のプロジェクトナビゲータで `App` ターゲット →
「Signing & Capabilities」タブで、Teamが正しく設定されていることを確認してください
（すでに`WAY9789685`で構成済みです）。

上部の実行先を「あなたのiPhone」（USB接続、または同じWi-Fiで無線）か
「iPhoneのシミュレータ」に選び、▶ボタンで実行します。
実機の場合、初回は iPhone側の「設定 → 一般 → VPNとデバイス管理」で開発者を信頼する操作が必要です。

## 新しいビルドをApp Store Connectへ提出する手順

Web側の修正（`Vercel --prod`でのデプロイ）だけでは、**すでにインストール・審査提出済みのアプリには反映されますが、新しいバイナリとしての再提出そのものは別途必要**です（Apple審査の却下対応や、`capacitor.config.ts`自体の変更を含む場合など）。

1. `ios/App/App.xcodeproj/project.pbxproj`の`CURRENT_PROJECT_VERSION`（ビルド番号）を、既存のTestFlightビルドと重複しない値に上げる（`MARKETING_VERSION`はそのままでよい）
2. `npm run ios:sync`でCapacitor設定をXcodeプロジェクトへ反映
3. `npm run ios:open`でXcodeを開く
4. 実行先を **「Any iOS Device (arm64)」** に切り替える（実機・シミュレータのままだとArchiveメニューが選べない）
5. メニューバー → **Product → Archive**
6. ビルド完了後、自動的に開く「Organizer」ウィンドウで対象アーカイブを選択 → **Distribute App**
7. 配布方法「App Store Connect」→「Upload」を選択し、デフォルト設定のままアップロード
8. アップロード後、App Store Connect側でビルドの処理完了（10〜30分程度）を待つ
9. App Store Connect → 対象アプリ → 配信 → 該当バージョンのページで、処理済みビルドを選択
10. 初回または久しぶりの提出の場合、輸出コンプライアンス（暗号化に関する質問）に回答が必要になることがある。このアプリはOS標準のHTTPS通信のみを使用しており独自の暗号化は実装していないため、「標準的な暗号化アルゴリズム」を選択する
11. 「App Review情報」のメモ欄・サインイン情報（審査用デモアカウント）を必要に応じて更新
12. 「審査へ提出」

## App Store審査について

- 却下・追加情報要求への対応履歴や、審査ガイドラインごとの対応方針はプロジェクトの会話ログ・コミット履歴を参照してください
- よくある却下理由と対応:
  - **Guideline 5.1.1(v)（アカウント削除）**: アプリ内（設定画面）から完結する削除導線を実装済み
  - **Guideline 2.1（追加情報要求）**: アプリの説明・外部サービス一覧・デモアカウント等をApp Review情報欄に記載する運用
  - **Guideline 4.3(a)（スパム判定）**: Capacitorの`server.url`方式（Webサイトをそのままラップする構成）は、Appleの自動類似性検出に引っかかりやすい技術的特徴を持つ。実際にオリジナルな機能（AIによる情報源自動発掘・パーソナライズ推薦等）を持つことを、審査への返信で具体的に説明する必要がある場合がある

## 今後、Webアプリ側を更新したとき

`server.url`方式のため、**Webアプリ（Vercel側）を更新してデプロイし直すだけで、
インストール済みのiPhoneアプリにも自動的に反映されます**。Xcodeでの再ビルド・再提出は、
アイコン・アプリ名・`capacitor.config.ts`自体の変更・ネイティブ機能（プッシュ通知等）の
追加など、ネイティブ側の変更を伴うときだけ必要になります。
