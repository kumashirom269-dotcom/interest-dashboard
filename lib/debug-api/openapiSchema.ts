// Custom GPT Actions等から呼び出す際にそのまま取り込める、debug API群のOpenAPI 3.1スキーマ。
// レスポンスの実体（各routeファイル）と手動で対応を取っているため、
// エンドポイントの入出力を変更した場合はこのファイルも合わせて更新すること。
export function buildDebugApiOpenApiSchema(serverUrl: string) {
  const envelope = (dataSchema: object) => ({
    type: "object",
    properties: {
      ok: { type: "boolean" },
      resource: { type: "string" },
      count: { type: "integer" },
      limit: { type: "integer" },
      generatedAt: { type: "string", format: "date-time" },
      data: { type: "array", items: dataSchema },
    },
    required: ["ok", "resource", "count", "limit", "generatedAt", "data"],
  });

  const errorSchema = {
    type: "object",
    properties: {
      ok: { type: "boolean", enum: [false] },
      error: { type: "string" },
    },
    required: ["ok", "error"],
  };

  const limitParam = {
    name: "limit",
    in: "query",
    required: false,
    description: "返却件数の上限（既定50、最大200）",
    schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  };

  const topicSchema = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string" },
      description: { type: "string" },
      keywords: { type: "array", items: { type: "string" } },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  };

  const sourceSchema = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      topic_id: { type: "string", format: "uuid" },
      name: { type: "string" },
      url: { type: "string" },
      rss_url: { type: ["string", "null"] },
      source_type: {
        type: "string",
        enum: [
          "official_blog",
          "news_site",
          "rss",
          "tech_blog",
          "local_event_site",
          "youtube_channel",
          "research_site",
          "other",
          "official_site",
          "official_news",
          "fanclub",
          "sns",
          "youtube_search",
          "magazine",
          "blog",
          "search_query",
        ],
      },
      status: {
        type: "string",
        enum: ["candidate", "active", "paused", "rejected"],
      },
      reason: { type: "string" },
      priority: { type: "integer" },
      source_score: { type: "integer" },
      created_by_ai: { type: "boolean" },
      last_checked_at: { type: ["string", "null"], format: "date-time" },
      fetch_method: {
        type: "string",
        enum: [
          "rss",
          "manual",
          "unsupported",
          "youtube_rss",
          "web_page",
          "search_query",
          "sns_reference",
          "api_required",
        ],
      },
      fetch_status: {
        type: "string",
        enum: ["unverified", "verified", "broken"],
      },
      last_fetch_error_type: { type: ["string", "null"] },
      last_fetch_error_message: { type: ["string", "null"] },
      last_fetch_attempt_at: { type: ["string", "null"], format: "date-time" },
      last_successful_fetch_at: { type: ["string", "null"], format: "date-time" },
      is_official: { type: "boolean" },
      is_specific_source: { type: "boolean" },
      is_search_seed: { type: "boolean" },
      source_reliability_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      topic_relevance_score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
      needs_review: { type: "boolean" },
      review_reason: { type: ["string", "null"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      topicName: { type: ["string", "null"] },
    },
  };

  const feedItemSchema = {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      topic_id: { type: "string", format: "uuid" },
      source_id: { type: "string", format: "uuid" },
      title: { type: "string" },
      url: { type: "string" },
      source_name: { type: "string" },
      published_at: { type: "string" },
      raw_excerpt: { type: "string" },
      summary: { type: "string" },
      ai_title: { type: ["string", "null"] },
      ai_summary: { type: ["string", "null"] },
      ai_processed_at: { type: ["string", "null"], format: "date-time" },
      image_url: { type: ["string", "null"] },
      relevance_score: { type: "number" },
      is_read: { type: "boolean" },
      is_saved: { type: "boolean" },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      topicName: { type: ["string", "null"] },
      sourceScore: { type: "number" },
      reactionTypes: { type: "array", items: { type: "string" } },
    },
  };

  const candidateEntitySchema = {
    type: "object",
    properties: {
      label: { type: "string" },
      entityType: { type: "string" },
      parentCategory: { type: "string" },
      subCategory: { type: "string" },
      detailCategory: { type: "string" },
      description: { type: "string" },
      confidence: { type: "number" },
    },
  };

  const topicClassificationSchema = {
    type: "object",
    properties: {
      topicId: { type: "string", format: "uuid" },
      topicName: { type: "string" },
      entityType: { type: "string" },
      parentCategory: { type: "string" },
      subCategory: { type: "string" },
      detailCategory: { type: "string" },
      summary: { type: "string" },
      intentTags: { type: "array", items: { type: "string" } },
      recommendedSourceTypes: { type: "array", items: { type: "string" } },
      searchKeywords: { type: "array", items: { type: "string" } },
      confidence: { type: "number" },
      needsUserConfirmation: { type: "boolean" },
      ambiguityReason: { type: "string" },
      candidateEntities: { type: "array", items: candidateEntitySchema },
      researchHints: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
  };

  function readOnlyOperation(
    operationId: string,
    summary: string,
    dataSchema: object,
  ) {
    return {
      get: {
        operationId,
        summary,
        security: [{ debugApiKey: [] }],
        parameters: [limitParam],
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": { schema: envelope(dataSchema) },
            },
          },
          "401": {
            description:
              "APIキーが未指定・不一致、または（本番環境で）未認証の場合",
            content: { "application/json": { schema: errorSchema } },
          },
          "500": {
            description:
              "サーバーエラー、またはdebug_api_config未設定などの設定不備",
            content: { "application/json": { schema: errorSchema } },
          },
        },
      },
    };
  }

  const dashboardSummarySchema = {
    type: "object",
    properties: {
      topics: {
        type: "object",
        properties: {
          count: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
              },
            },
          },
        },
      },
      sources: {
        type: "object",
        properties: {
          count: { type: "integer" },
          byStatus: { type: "object", additionalProperties: { type: "integer" } },
        },
      },
      feedItems: {
        type: "object",
        properties: {
          count: { type: "integer" },
          latest: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                title: { type: "string" },
                sourceName: { type: "string" },
                topicName: { type: ["string", "null"] },
                publishedAt: { type: "string" },
              },
            },
          },
        },
      },
      savedItems: {
        type: "object",
        properties: { count: { type: "integer" } },
      },
      topicClassifications: {
        type: "object",
        properties: {
          count: { type: "integer" },
          needsConfirmationCount: { type: "integer" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topicId: { type: "string", format: "uuid" },
                topicName: { type: "string" },
                entityType: { type: "string" },
                confidence: { type: "number" },
                needsUserConfirmation: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Interest Dashboard Debug API",
      version: "1.2.0",
      description:
        "Antennaの内部状態を確認するための読み取り専用API。" +
        "APIキー・secret・service_role等の機密情報は一切返さない。" +
        "x-debug-api-keyによるAPIキー認証は、開発者本人が自分のデータを確認するための" +
        "簡易な仕組みであり、不特定多数のユーザー向けではない。将来サービスを一般公開する際は、" +
        "OAuthまたはユーザーごとに発行するアクセストークン方式へ移行する想定（過度な作り込みはしていない）。" +
        "APIキー認証時は、DB側のdebug_api_config（一般ユーザーからは読み書き不可）に紐づく" +
        "単一ユーザーのデータのみを、読み取り専用のSECURITY DEFINER関数経由で返す。" +
        "Cookieベースのセッション認証（ブラウザでのログイン）も引き続き利用できる。",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        debugApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-debug-api-key",
          description:
            "環境変数DEBUG_API_KEYと一致するキー。Custom GPT ActionsのAPI Key認証設定で使用する。",
        },
      },
    },
    paths: {
      "/api/debug/topics": readOnlyOperation(
        "listDebugTopics",
        "登録済みトピック一覧を取得する",
        topicSchema,
      ),
      "/api/debug/sources": readOnlyOperation(
        "listDebugSources",
        "収集元（sources）一覧を取得する",
        sourceSchema,
      ),
      "/api/debug/feed-items": readOnlyOperation(
        "listDebugFeedItems",
        "フィード記事一覧を取得する（非表示にした記事は除く）",
        feedItemSchema,
      ),
      "/api/debug/topic-classifications": readOnlyOperation(
        "listDebugTopicClassifications",
        "トピックのAI分類結果一覧を取得する",
        topicClassificationSchema,
      ),
      "/api/debug/saved-items": readOnlyOperation(
        "listDebugSavedItems",
        "保存済み記事一覧を取得する",
        feedItemSchema,
      ),
      "/api/debug/dashboard-summary": {
        get: {
          operationId: "getDebugDashboardSummary",
          summary:
            "topics/sources/feed_items/topic_classifications/saved_itemsの概要を一度に取得する",
          security: [{ debugApiKey: [] }],
          responses: {
            "200": {
              description: "成功",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      resource: { type: "string" },
                      generatedAt: { type: "string", format: "date-time" },
                      note: { type: "string" },
                      data: dashboardSummarySchema,
                    },
                  },
                },
              },
            },
            "401": {
              description: "APIキーが未指定・不一致、または未認証の場合",
              content: { "application/json": { schema: errorSchema } },
            },
            "500": {
              description: "サーバーエラー、または設定不備",
              content: { "application/json": { schema: errorSchema } },
            },
          },
        },
      },
    },
  };
}
