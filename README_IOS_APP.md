# iPhoneアプリ化（Capacitor）について

このアプリは、Server Actions・Cookieベースの認証（Supabase Auth）・サーバー側レンダリングを
多用しているため、「Webの画面をまるごとアプリ内バンドルとして持たせる」方式ではなく、
**実際にデプロイした本番URLを、ネイティブのアプリ（WKWebView）でそのまま開く方式**
（Capacitorの`server.url`方式）を採用しています。これによりWeb側のコードは一切変更せずに
そのままiPhoneアプリとして動作します。

## すでに完了していること

- [x] Capacitorパッケージ導入（`@capacitor/core` `@capacitor/ios` `@capacitor/app` `@capacitor/cli` `@capacitor/assets`）
- [x] `capacitor.config.ts` 作成（アプリID: `com.interestdashboard.app`、アプリ名: 「関心ダッシュボード」）
- [x] `ios/` ディレクトリにXcodeプロジェクトを生成済み（`npx cap add ios`）
- [x] アプリアイコン・スプラッシュ画像を生成し、Xcodeプロジェクトへ反映済み
- [x] ノッチ・ホームインジケーター対応（safe-area）をCSSに追加
- [x] `npm run ios:sync` / `npm run ios:open` / `npm run ios:assets` スクリプトを追加
- [x] Vercelへログイン・プロジェクト作成（`nearbyme/interest-dashboard`）
- [x] 本番環境変数（Supabase・Anthropic・Brave Search・Debug APIキー、`AI_COST_SAVING_MODE=false`）を設定
- [x] 本番デプロイ完了。本番URL: **https://interest-dashboard-nine.vercel.app**
- [x] `capacitor.config.ts`の`server.url`を上記の本番URLに更新し、`npx cap sync ios`まで実施済み
- [x] Xcodeインストール済み（バージョン26.6を確認）

**Webアプリとしては、この本番URLに誰でもアクセスできる状態になっています。**
アカウント登録・トピック登録・マイページの動作を、まずはブラウザで一度確認しておくことをおすすめします。

## ここから先、あなたに行っていただく必要がある作業

Apple IDでの署名・実機での実行は、Xcodeを操作する必要があるため私だけでは進められません。

### 1. プロジェクトを開いて実行

```bash
npm run ios:open
```

Xcodeが開きます。左側のプロジェクトナビゲータで `App` ターゲット →
「Signing & Capabilities」タブを開き、以下を設定してください。

- **Team**: あなたのApple ID（無料のPersonal Teamで、自分のiPhoneで動かすだけなら十分です）
- 初回はApple IDの追加が必要な場合があります（Xcode → Settings → Accounts）

その後、上部の実行先を「あなたのiPhone」（USB接続、または同じWi-Fiで無線）か
「iPhoneのシミュレータ」に選び、▶ボタンで実行します。
実機の場合、初回は iPhone側の「設定 → 一般 → VPNとデバイス管理」で開発者を信頼する操作が必要です。

無料のApple IDでの実機インストールは7日間で失効し、再度Xcodeから実行し直す必要がある制限が
あります（Apple Developer Program、年間$99に登録すると1年間有効になり、TestFlightやApp Store
配信もできるようになります）。

### 2. （将来的に）App Storeで配信したい場合

- Apple Developer Program（年間$99）への登録
- App Store Connectでアプリを作成（プライバシーポリシーURL・スクリーンショット・審査情報等が必要）
- TestFlightでの内部テスト → 審査提出

このあたりは登録が完了してから、改めて一緒に進めましょう。

## 今後、Webアプリ側を更新したとき

`server.url`方式のため、**Webアプリ（Vercel側）を更新してデプロイし直すだけで、
インストール済みのiPhoneアプリにも自動的に反映されます**。Xcodeでの再ビルドは、
アイコン・アプリ名・ネイティブ機能（プッシュ通知等）を変更したときだけ必要になります。
