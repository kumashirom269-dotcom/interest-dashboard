# Antenna（関心情報ダッシュボード）

あなたの趣味・仕事・学習テーマを登録するだけで、AIが情報収集元を自動で判断し、関連する記事やニュースを継続的に集めるパーソナル情報ダッシュボードです。記事へのリアクション（役に立った／興味なし／保存）を重ねるほど、収集元の優先度が調整され、その人だけの情報源に育っていきます。

- 本番環境: https://www.myantenna.app
- iOSアプリ: App Store提出中（[README_IOS_APP.md](README_IOS_APP.md)参照）

## できること

- **トピック登録**: 自由記述で関心テーマを登録するだけで、AIが実体（人物・作品・分野など）を推定し、時間的な意図（最新情報が欲しいのか、体系的な情報が欲しいのか）まで判断
- **情報源の自動発掘**: Brave Search + AIによるWeb探索で、公式サイト・ニュースサイト・YouTubeチャンネル等の候補を自動収集し、信頼度・関連度をスコアリング
- **RSS/Web収集**: 発掘した情報源から記事を定期的に取得し、AIがタイトル・要約・関連度スコアを付与
- **パーソナライズ推薦**: 記事へのリアクション（いいね／興味なし／保存／非表示）を情報源スコアにフィードバックし、以後の推薦精度を継続的に改善
- **ジャンル別の安全機構**: ペット・動物など専門的な判断が絡むジャンルでは、AI生成コンテンツに注意喚起を付与し、専門的な情報源を優先するルールを個別に設定可能
- **保存記事・収集元の管理**: 記事の保存、情報源ごとの手動編集（RSS URL・取得方法・信頼度等）、一時停止・削除

## 技術構成

| 領域 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 |
| バックエンド | Supabase（PostgreSQL / Auth / Row Level Security） |
| AI | Anthropic Claude API（トピック理解・情報源発掘・要約・推薦カード生成） |
| 検索 | Brave Search API（情報源探索） |
| メール配信 | Resend（カスタムSMTP経由、確認コード・パスワード再設定） |
| ホスティング | Vercel |
| エラー監視 | Sentry |
| モバイルアプリ | Capacitor（本番Webを iOS ネイティブアプリとしてラップ） |

## アーキテクチャ概要

1. **トピック登録** (`app/(app)/topics/`) — ユーザーが自由記述でトピックを登録すると、AIが実体特定（`lib/topic-identification/`）・分類（`lib/topic-classification/`）を行う
2. **情報源発掘** (`lib/web-discovery/`, `lib/ai/generateSourceCandidates.ts`) — Brave Search + AIで候補情報源を探索し、信頼度・関連度をスコアリング
3. **調査プラン生成** (`lib/research/`) — トピックの性質に応じた検索クエリを組み立て、候補記事を収集・評価
4. **収集パイプライン** (`app/(app)/sources/actions.ts`) — RSS/Web取得を実行し、`feed_items`として保存。取得失敗が連続した情報源はUI上で見直しを促す
5. **推薦カード生成** (`lib/recommendation/`, `lib/recommendation-cards/`) — 収集した記事から、ユーザーごとにパーソナライズした推薦カードを生成
6. **リアクション反映** (`lib/source-scores/`) — いいね／興味なし等のリアクションを情報源スコアにフィードバックし、以後の推薦・収集優先度を調整
7. **ジャンル別安全機構** (`lib/genres/`) — ジャンルごとに注意喚起文・専門情報源パターンを設定可能な仕組み（現状はペット・動物ジャンルに適用済み）

## ローカル開発

```bash
npm install
cp .env.local.example .env.local  # 各種APIキーを設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。

### 主なコマンド

```bash
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド
npm run lint     # ESLint
npm run test     # ユニットテスト（lib/__tests__配下）
npm run ios:sync # Capacitor: iOSプロジェクトへ設定を反映
npm run ios:open # Capacitor: Xcodeでプロジェクトを開く
```

### 必要な環境変数

`.env.local.example` を参照してください。Supabase・Anthropic・Brave Searchの各APIキーが必要です。

## ディレクトリ構成（抜粋）

```
app/
  (marketing)/   トップページ・利用規約・プライバシーポリシー・サポート
  (auth)/        ログイン・新規登録・パスワード再設定
  (app)/         マイページ・トピック管理・収集元管理・保存記事・設定
lib/
  ai/                 AI呼び出し（Claude）のラッパー群
  topic-identification/  トピックの実体特定
  topic-classification/  トピックの分類・時間的意図判定
  web-discovery/      情報源のWeb探索
  research/           調査プラン・検索クエリ生成
  recommendation/     推薦カード選定ロジック
  source-scores/      情報源スコアリング
  genres/             ジャンル別設定（安全機構等）
supabase/
  migrations/         DBスキーマ（マイグレーション）
```

## デプロイ

Vercelにデプロイしています。`vercel --prod` で本番反映されます（Gitプッシュ連動ではなく、CLIからの手動デプロイ運用です）。

## iOSアプリについて

Capacitorで本番Webをそのままネイティブアプリ化しています。詳細は [README_IOS_APP.md](README_IOS_APP.md) を参照してください。
