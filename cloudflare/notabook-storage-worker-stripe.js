const FREE_QUOTA_BYTES = 3 * 1024 * 1024 * 1024;
const PREMIUM_DEFAULT_QUOTA_BYTES = 25 * 1024 * 1024 * 1024;
const PREMIUM_PLUS_DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024 * 1024;
const AI_PAID_MODEL = "deepseek/deepseek-chat";
const AI_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "openai/gpt-oss-20b:free"
];
const AI_FREE_DAILY_LIMIT = 10;
const AI_MONTHLY_LIMITS = { premium: 500, premium_plus: 1000 };
const AI_PAID_LIMITS = { premium: 300, premium_plus: 800 };
const FEATURE_PLAN_RANK = { free: 0, premium: 1, premium_plus: 2 };
const USER_PANEL_FEATURES = [
  ['painel_geral', 'Painel — Geral', 'Perfil, avatar e identidade visual.'],
  ['painel_planos', 'Painel — Planos', 'Consulta e gestão dos planos da conta.'],
  ['painel_loja', 'Painel — Loja', 'Ferramentas adicionais para instalar na nota.'],
  ['painel_amigos', 'Painel — Amigos', 'Convites e gestão de amizades.'],
  ['painel_definicoes', 'Painel — Definições', 'Preferências da aplicação e da interface.'],
  ['painel_pesquisa', 'Painel — Pesquisa', 'Definições da procura inteligente.'],
  ['painel_manual', 'Painel — Manual', 'Manual de utilização do NotaBook.'],
  ['painel_fusiveis', 'Painel — Fusíveis', 'Interruptores das funcionalidades de Lists.'],
  ['painel_reciclagem', 'Painel — Reciclagem', 'Recuperação e eliminação de conteúdos.'],
  ['painel_sair', 'Painel — Sair', 'Terminar a sessão da conta.']
];
const STORE_FEATURES = [
  ['ferramenta_noticias', 'Notícias', 'Ferramenta de notícias RSS disponível na Loja.', 'free'],
  ['ferramenta_tempo', 'Tempo', 'Ferramenta meteorológica com atualização diária disponível na Loja.', 'free']
];
const PROTECTED_FEATURE_KEYS = new Set([
  ...USER_PANEL_FEATURES.map(([key]) => key),
  ...STORE_FEATURES.map(([key]) => key)
]);

const ALLOWED_ORIGINS = new Set([
  "https://notabook.site",
  "https://www.notabook.site",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
]);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function headersFor(request, extra = {}) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...extra
  });

  const origin = request.headers.get("Origin");

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, PUT, DELETE, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Plan-Preview");
    headers.set("Access-Control-Expose-Headers", "Content-Length, ETag");
  }

  headers.set("Cache-Control", "no-store");

  return headers;
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: headersFor(request)
  });
}

function cleanFileName(value) {
  return String(value || "ficheiro")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "ficheiro";
}

async function authenticate(request, env) {
  const header = request.headers.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    throw new HttpError(401, "Sessão não autenticada.");
  }

  const idToken = header.slice(7).trim();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!response.ok) {
    throw new HttpError(401, "Sessão Firebase inválida ou expirada.");
  }

  const data = await response.json();
  const user = data.users?.[0];

  if (!user?.localId || user.disabled === true) {
    throw new HttpError(401, "Utilizador não autorizado.");
  }

  return user.localId;
}

async function ensureUsage(env, uid) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO storage_usage (user_id)
    VALUES (?)
  `).bind(uid).run();
}

async function getUsage(env, uid) {
  await ensureUsage(env, uid);

  return env.DB.prepare(`
    SELECT used_bytes
    FROM storage_usage
    WHERE user_id = ?
  `).bind(uid).first();
}

function quotaForPlan(env, plan) {
  if (plan === "premium") {
    return Number(env.PREMIUM_QUOTA_BYTES || PREMIUM_DEFAULT_QUOTA_BYTES);
  }

  if (plan === "premium_plus") {
    return Number(env.PREMIUM_PLUS_QUOTA_BYTES || PREMIUM_PLUS_DEFAULT_QUOTA_BYTES);
  }

  return FREE_QUOTA_BYTES;
}

function aiPolicyForPlan(plan) {
  if (plan === "premium" || plan === "premium_plus") {
    return {
      dailyLimit: null,
      monthlyLimit: AI_MONTHLY_LIMITS[plan],
      paidLimit: AI_PAID_LIMITS[plan]
    };
  }

  return {
    dailyLimit: AI_FREE_DAILY_LIMIT,
    monthlyLimit: null,
    paidLimit: 0
  };
}

function aiPeriodKeys() {
  const now = new Date();
  return {
    dayKey: now.toISOString().slice(0, 10),
    monthKey: now.toISOString().slice(0, 7)
  };
}

async function reserveAiOperation(env, uid, plan) {
  const { dayKey, monthKey } = aiPeriodKeys();
  const policy = aiPolicyForPlan(plan);

  await env.DB.prepare(`
    INSERT OR IGNORE INTO ai_usage (user_id, day_key, month_key)
    VALUES (?, ?, ?)
  `).bind(uid, dayKey, monthKey).run();

  const current = await env.DB.prepare(`
    SELECT day_key, daily_count, month_key, month_count
    FROM ai_usage
    WHERE user_id = ?
  `).bind(uid).first();

  const dailyCount = current?.day_key === dayKey ? Number(current.daily_count || 0) : 0;
  const monthCount = current?.month_key === monthKey ? Number(current.month_count || 0) : 0;

  if (policy.dailyLimit !== null && dailyCount >= policy.dailyLimit) {
    throw new HttpError(429, "Atingiste o limite diário de IA do plano Free (10 operações). Volta amanhã.");
  }

  if (policy.monthlyLimit !== null && monthCount >= policy.monthlyLimit) {
    throw new HttpError(429, `Atingiste o limite mensal de IA do plano ${plan} (${policy.monthlyLimit} operações).`);
  }

  const nextDailyCount = current?.day_key === dayKey ? dailyCount + 1 : 1;
  const nextMonthCount = current?.month_key === monthKey ? monthCount + 1 : 1;

  await env.DB.prepare(`
    UPDATE ai_usage
    SET day_key = ?, daily_count = ?, month_key = ?, month_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).bind(dayKey, nextDailyCount, monthKey, nextMonthCount, uid).run();

  const paid = plan !== "free" && monthCount < policy.paidLimit;

  return {
    plan,
    modelMode: paid ? "paid" : "free",
    dailyCount: nextDailyCount,
    monthCount: nextMonthCount,
    dailyLimit: policy.dailyLimit,
    monthlyLimit: policy.monthlyLimit,
    paidLimit: policy.paidLimit
  };
}

function aiUsageUserId(uid, entitlement) {
  return entitlement.previewPlan
    ? `preview:${uid}:${entitlement.previewPlan}`
    : uid;
}

async function openRouterChat(env, model, payload) {
  if (!env.OPENROUTER_API_KEY) {
    throw new HttpError(503, "A IA ainda não está configurada no Worker.");
  }

  const body = {
    model,
    messages: payload.messages,
    temperature: Number.isFinite(payload.temperature) ? payload.temperature : 0.4
  };

  if (payload.responseFormat && typeof payload.responseFormat === "object") {
    body.response_format = payload.responseFormat;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.APP_URL || "https://notabook.site",
      "X-Title": "notABook X"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status === 429 ? 503 : 502, data?.error?.message || "A IA rejeitou o pedido.");
  }

  return data;
}

async function runAiOperation(env, payload, modelMode) {
  if (modelMode === "paid") {
    try {
      return {
        data: await openRouterChat(env, AI_PAID_MODEL, payload),
        model: AI_PAID_MODEL
      };
    } catch (error) {
      console.warn("Modelo pago indisponível; a tentar um modelo gratuito.", error);
    }
  }

  let lastError;
  for (const model of AI_FREE_MODELS) {
    try {
      return { data: await openRouterChat(env, model, payload), model };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new HttpError(503, "Não foi possível obter uma resposta da IA.");
}

async function getSubscription(env, uid) {
  return env.DB.prepare(`
    SELECT *
    FROM subscriptions
    WHERE user_id = ?
  `).bind(uid).first();
}

function getAdminPlanPreview(request, uid, env) {
  if (!request || !isAdmin(uid, env)) return null;

  const requested = request.headers.get("X-Admin-Plan-Preview");
  return normaliseFeaturePlan(requested);
}

async function getEntitlement(env, uid, request = null) {
  const subscription = await getSubscription(env, uid);
  const active = ["active", "trialing"].includes(subscription?.status);
  // O estatuto de administrador controla apenas a administração.
  // O plano continua a refletir a subscrição Stripe para permitir testar
  // Free, Premium e Premium Plus com a própria conta de administrador.
  const actualPlan = active ? subscription.plan : "free";
  const previewPlan = getAdminPlanPreview(request, uid, env);
  const plan = previewPlan || actualPlan;

  return {
    plan,
    actualPlan,
    previewPlan,
    status: subscription?.status || "inactive",
    quotaBytes: quotaForPlan(env, plan),
    currentPeriodEnd: subscription?.current_period_end || null,
    subscription
  };
}

function normaliseFeaturePlan(value) {
  return Object.prototype.hasOwnProperty.call(FEATURE_PLAN_RANK, value) ? value : null;
}

function isFeatureAllowed(feature, plan) {
  const minimum = normaliseFeaturePlan(feature.min_plan) || "free";
  return Number(feature.active) === 1 && FEATURE_PLAN_RANK[plan] >= FEATURE_PLAN_RANK[minimum];
}

async function getFeatureRows(env) {
  const panelStatements = USER_PANEL_FEATURES.map(([key, label, description]) => env.DB.prepare(`
      INSERT OR IGNORE INTO feature_access (
        feature_key, label, description, min_plan, active, updated_at
      ) VALUES (?, ?, ?, 'free', 1, CURRENT_TIMESTAMP)
    `).bind(key, label, description));
  const storeStatements = STORE_FEATURES.map(([key, label, description, plan]) => env.DB.prepare(`
      INSERT OR IGNORE INTO feature_access (
        feature_key, label, description, min_plan, active, updated_at
      ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(key, label, description, plan));
  await env.DB.batch([...panelStatements, ...storeStatements]);

  const result = await env.DB.prepare(`
    SELECT feature_key, label, description, min_plan, active, updated_at
    FROM feature_access
    ORDER BY label COLLATE NOCASE
  `).all();
  return result.results || [];
}

function isAdmin(uid, env) {
  const configured = String(env.ADMIN_UIDS || env.ADMIN_UID || "")
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean);
  return configured.includes(uid);
}

function assertAdmin(uid, env) {
  if (!isAdmin(uid, env)) {
    throw new HttpError(403, "Acesso reservado ao administrador.");
  }
}

function stripeMode(env) {
  return String(env.STRIPE_MODE || "test").toLowerCase() === "live" ? "live" : "test";
}

async function getBillingState(env) {
  let configured = false;
  let enabled = false;
  try {
    const row = await env.DB.prepare(`
      SELECT value
      FROM billing_settings
      WHERE setting_key = 'sales_enabled'
    `).first();
    configured = Boolean(row);
    enabled = row?.value === "1";
  } catch (_) {
    // Se a tabela ainda não foi criada, as vendas ficam fechadas por segurança.
  }

  const mode = stripeMode(env);
  const liveKeyReady = String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_");
  const readyForLive = mode === "live" && liveKeyReady;

  return {
    configured,
    stripeMode: mode,
    readyForLive,
    salesEnabled: enabled && readyForLive
  };
}

async function setBillingSalesEnabled(env, enabled) {
  await env.DB.prepare(`
    INSERT INTO billing_settings (setting_key, value, updated_at)
    VALUES ('sales_enabled', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(setting_key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(enabled ? "1" : "0").run();
}

function validateFeatureInput(body, { creating = false } = {}) {
  const key = String(body.key || body.featureKey || "").trim();
  const label = String(body.label || "").trim();
  const description = String(body.description || "").trim().slice(0, 180);
  const minPlan = normaliseFeaturePlan(body.minPlan || body.min_plan || "free");

  if (creating && !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(key)) {
    throw new HttpError(400, "A chave deve ter 2-64 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.");
  }
  if (!label || label.length > 80) {
    throw new HttpError(400, "O nome da ferramenta é obrigatório e deve ter até 80 caracteres.");
  }
  if (!minPlan) {
    throw new HttpError(400, "O plano mínimo indicado é inválido.");
  }

  return {
    key,
    label,
    description,
    minPlan,
    active: body.active === false || body.active === 0 ? 0 : 1
  };
}

function stripePriceForPlan(env, plan) {
  if (plan === "premium") return env.STRIPE_PRICE_PREMIUM;
  if (plan === "premium_plus") return env.STRIPE_PRICE_PREMIUM_PLUS;
  return null;
}

function planForStripePrice(env, priceId) {
  if (priceId && priceId === env.STRIPE_PRICE_PREMIUM) return "premium";
  if (priceId && priceId === env.STRIPE_PRICE_PREMIUM_PLUS) return "premium_plus";
  return null;
}

async function stripeRequest(env, path, params) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, "Stripe ainda não está configurada no Worker.");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();

  if (!response.ok) {
    throw new HttpError(
      502,
      data?.error?.message || "A Stripe rejeitou o pedido."
    );
  }

  return data;
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;

  const values = {};
  for (const item of signatureHeader.split(",")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    values[item.slice(0, separator).trim()] = item.slice(separator + 1).trim();
  }

  const timestamp = Number(values.t);
  const signature = values.v1;

  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedPayload = `${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  return constantTimeEqual(bytesToHex(digest), signature);
}

async function findUserIdBySubscription(env, stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;

  const row = await env.DB.prepare(`
    SELECT user_id
    FROM subscriptions
    WHERE stripe_subscription_id = ?
  `).bind(stripeSubscriptionId).first();

  return row?.user_id || null;
}

async function saveSubscription(env, values) {
  await env.DB.prepare(`
    INSERT INTO subscriptions (
      user_id,
      stripe_customer_id,
      stripe_subscription_id,
      plan,
      status,
      current_period_end,
      cancel_at_period_end,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = excluded.plan,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    values.userId,
    values.customerId || null,
    values.subscriptionId || null,
    values.plan || "free",
    values.status || "inactive",
    values.currentPeriodEnd || null,
    values.cancelAtPeriodEnd ? 1 : 0
  ).run();
}

async function processStripeEvent(env, event) {
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const userId = object.client_reference_id || object.metadata?.firebase_uid;
    const plan = object.metadata?.plan || "free";

    if (userId && object.subscription) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId: object.subscription,
        plan,
        status: "active"
      });
    }
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscriptionId = object.id;
    const userId = object.metadata?.firebase_uid ||
      await findUserIdBySubscription(env, subscriptionId);
    const priceId = object.items?.data?.[0]?.price?.id;
    const detectedPlan = planForStripePrice(env, priceId) || object.metadata?.plan || "free";
    const active = ["active", "trialing"].includes(object.status);

    if (userId) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId,
        plan: active ? detectedPlan : "free",
        status: object.status || "inactive",
        currentPeriodEnd: object.current_period_end,
        cancelAtPeriodEnd: object.cancel_at_period_end
      });
    }
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const userId = object.metadata?.firebase_uid ||
      await findUserIdBySubscription(env, object.id);

    if (userId) {
      await saveSubscription(env, {
        userId,
        customerId: object.customer,
        subscriptionId: object.id,
        plan: "free",
        status: "canceled",
        currentPeriodEnd: object.current_period_end
      });
    }
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const userId = await findUserIdBySubscription(env, object.subscription);

    if (userId) {
      await env.DB.prepare(`
        UPDATE subscriptions
        SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(userId).run();
    }
  }
}

const NEWS_MARKETS = {
  PT: { setlang: "pt-PT", cc: "PT" },
  BR: { setlang: "pt-BR", cc: "BR" },
  US: { setlang: "en-US", cc: "US" },
  GB: { setlang: "en-GB", cc: "GB" },
  ES: { setlang: "es-ES", cc: "ES" }
};

function normaliseNewsTerms(value, limit) {
  return [...new Set(String(value || "")
    .split("|")
    .map(term => term.normalize("NFKC").replace(/["\\<>\u0000-\u001f]/g, "").trim().slice(0, 60))
    .filter(Boolean))]
    .slice(0, limit);
}

function buildBingNewsRssUrl(url) {
  const topics = normaliseNewsTerms(url.searchParams.get("temas"), 8);
  const excluded = normaliseNewsTerms(url.searchParams.get("excluir"), 6);
  if (!topics.length) throw new HttpError(400, "Indica pelo menos um tema de notícias.");

  const marketKey = String(url.searchParams.get("mercado") || "PT").toUpperCase();
  const market = NEWS_MARKETS[marketKey] || NEWS_MARKETS.PT;
  const query = [
    topics.join(" OR "),
    ...excluded.map(term => `-${term}`)
  ].join(" ");
  const feedUrl = new URL("https://www.bing.com/news/search");
  feedUrl.searchParams.set("q", query);
  feedUrl.searchParams.set("format", "rss");
  feedUrl.searchParams.set("setlang", market.setlang);
  feedUrl.searchParams.set("cc", market.cc);
  feedUrl.searchParams.set("count", "30");
  return feedUrl;
}

function rss(request, xml) {
  const headers = headersFor(request, { "Content-Type": "application/rss+xml; charset=utf-8" });
  headers.set("Cache-Control", "private, max-age=300");
  return new Response(xml, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: headersFor(request)
        });
      }

      const url = new URL(request.url);

      if (url.pathname === "/health" && request.method === "GET") {
        const result = await env.DB.prepare(`
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all();
        const billing = await getBillingState(env);

        return json(request, {
          ok: true,
          worker: "notabook-storage",
          r2BindingConfigured: Boolean(env.FILES),
          d1BindingConfigured: Boolean(env.DB),
          firebaseConfigured: Boolean(env.FIREBASE_API_KEY),
          stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
          stripeMode: billing.stripeMode,
          stripeLiveKeyConfigured: String(env.STRIPE_SECRET_KEY || "").startsWith("sk_live_"),
          billingSettingsConfigured: billing.configured,
          salesEnabled: billing.salesEnabled,
          aiConfigured: Boolean(env.OPENROUTER_API_KEY),
          tables: result.results.map(row => row.name)
        });
      }

      if (url.pathname === "/billing/webhook" && request.method === "POST") {
        const payload = await request.text();
        const signature = request.headers.get("Stripe-Signature");
        const valid = await verifyStripeSignature(
          payload,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );

        if (!valid) {
          throw new HttpError(400, "Assinatura do webhook Stripe inválida.");
        }

        const event = JSON.parse(payload);
        const alreadyProcessed = await env.DB.prepare(`
          SELECT event_id
          FROM billing_events
          WHERE event_id = ?
        `).bind(event.id).first();

        if (!alreadyProcessed) {
          await processStripeEvent(env, event);
          await env.DB.prepare(`
            INSERT OR IGNORE INTO billing_events (event_id)
            VALUES (?)
          `).bind(event.id).run();
        }

        return json(request, { received: true });
      }

      const uid = await authenticate(request, env);

      if (url.pathname === "/news/rss" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const features = await getFeatureRows(env);
        const feature = features.find(item => item.feature_key === "ferramenta_noticias");
        if (!feature || !isFeatureAllowed(feature, entitlement.plan)) {
          throw new HttpError(403, "A ferramenta Notícias não está disponível no teu plano.");
        }

        const feedUrl = buildBingNewsRssUrl(url);
        const response = await fetch(feedUrl, {
          headers: {
            Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
            "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
            Referer: "https://www.bing.com/news/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
          },
          redirect: "follow"
        });
        if (!response.ok) {
          throw new HttpError(502, "NBX News falhou. Tente Novamente.");
        }
        const xml = await response.text();
        if (!xml.includes("<rss") || xml.length > 2_000_000) {
          throw new HttpError(502, "NBX News falhou. Tente Novamente.");
        }
        return rss(request, xml);
      }

      if (url.pathname === "/features" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const features = await getFeatureRows(env);
        return json(request, {
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          isAdmin: isAdmin(uid, env),
          features: features
            .filter(feature => Number(feature.active) === 1)
            .map(feature => ({
              ...feature,
              allowed: isFeatureAllowed(feature, entitlement.plan)
            }))
        });
      }

      if (url.pathname === "/admin/features" && request.method === "GET") {
        assertAdmin(uid, env);
        return json(request, { features: await getFeatureRows(env) });
      }

      if (url.pathname === "/admin/features" && request.method === "POST") {
        assertAdmin(uid, env);
        const body = await request.json().catch(() => ({}));
        const feature = validateFeatureInput(body, { creating: true });
        const existing = await env.DB.prepare(`
          SELECT feature_key FROM feature_access WHERE feature_key = ?
        `).bind(feature.key).first();

        if (existing) throw new HttpError(409, "Já existe uma ferramenta com essa chave.");

        await env.DB.prepare(`
          INSERT INTO feature_access (feature_key, label, description, min_plan, active, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          feature.key, feature.label, feature.description, feature.minPlan, feature.active
        ).run();

        return json(request, { ok: true, feature: feature }, 201);
      }

      const adminFeatureKey = url.pathname.match(/^\/admin\/features\/([^/]+)$/)?.[1];
      if (adminFeatureKey && ["PUT", "DELETE"].includes(request.method)) {
        assertAdmin(uid, env);
        const key = decodeURIComponent(adminFeatureKey);
        const existing = await env.DB.prepare(`
          SELECT feature_key FROM feature_access WHERE feature_key = ?
        `).bind(key).first();
        if (!existing) throw new HttpError(404, "Ferramenta não encontrada.");

        if (request.method === "DELETE") {
          if (PROTECTED_FEATURE_KEYS.has(key)) {
            throw new HttpError(409, "Esta funcionalidade estrutural não pode ser removida; desativa-a ou altera o plano mínimo.");
          }
          await env.DB.prepare(`DELETE FROM feature_access WHERE feature_key = ?`).bind(key).run();
          return json(request, { ok: true, deleted: key });
        }

        const body = await request.json().catch(() => ({}));
        const feature = validateFeatureInput(body);
        await env.DB.prepare(`
          UPDATE feature_access
          SET label = ?, description = ?, min_plan = ?, active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE feature_key = ?
        `).bind(
          feature.label, feature.description, feature.minPlan, feature.active, key
        ).run();

        return json(request, { ok: true, feature: { ...feature, key } });
      }

      if (url.pathname === "/admin/billing" && request.method === "GET") {
        assertAdmin(uid, env);
        return json(request, { ok: true, ...(await getBillingState(env)) });
      }

      if (url.pathname === "/admin/billing" && request.method === "PUT") {
        assertAdmin(uid, env);
        const body = await request.json().catch(() => ({}));
        const enabled = body.salesEnabled === true;
        const state = await getBillingState(env);

        if (enabled && !state.readyForLive) {
          throw new HttpError(
            409,
            "Configure primeiro o Worker com STRIPE_MODE=live e uma STRIPE_SECRET_KEY sk_live_."
          );
        }

        await setBillingSalesEnabled(env, enabled);
        const updatedState = await getBillingState(env);
        return json(request, { ok: true, ...updatedState });
      }

      if (url.pathname === "/billing/create-checkout-session" && request.method === "POST") {
        const billing = await getBillingState(env);
        if (!billing.salesEnabled) {
          throw new HttpError(403, "As compras ainda não foram abertas pelo administrador.");
        }

        const body = await request.json().catch(() => ({}));
        const plan = body.plan;
        const priceId = stripePriceForPlan(env, plan);

        if (!priceId) {
          throw new HttpError(400, "Plano inválido.");
        }

        const current = await getSubscription(env, uid);
        if (["active", "trialing"].includes(current?.status)) {
          throw new HttpError(409, "Já existe uma subscrição ativa.");
        }

        const appUrl = env.APP_URL || "https://notabook.site";
        const params = new URLSearchParams();
        params.set("mode", "subscription");
        params.set("line_items[0][price]", priceId);
        params.set("line_items[0][quantity]", "1");
        params.set("client_reference_id", uid);
        params.set("metadata[firebase_uid]", uid);
        params.set("metadata[plan]", plan);
        params.set("subscription_data[metadata][firebase_uid]", uid);
        params.set("subscription_data[metadata][plan]", plan);
        params.set("success_url", `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
        params.set("cancel_url", `${appUrl}/?billing=cancelled`);

        if (current?.stripe_customer_id) {
          params.set("customer", current.stripe_customer_id);
        }

        const session = await stripeRequest(env, "checkout/sessions", params);

        return json(request, {
          ok: true,
          url: session.url,
          sessionId: session.id
        });
      }

      if (url.pathname === "/billing/plan" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);

        return json(request, {
          ok: true,
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          isAdmin: isAdmin(uid, env),
          salesEnabled: (await getBillingState(env)).salesEnabled,
          status: entitlement.status,
          quotaBytes: entitlement.quotaBytes,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(entitlement.subscription?.cancel_at_period_end)
        });
      }

      if (url.pathname === "/billing/cancel" && request.method === "POST") {
        const current = await getSubscription(env, uid);
        if (!current?.stripe_subscription_id || !["active", "trialing"].includes(current.status)) {
          throw new HttpError(409, "Não existe uma subscrição paga ativa para cancelar.");
        }

        if (Number(current.cancel_at_period_end) === 1) {
          return json(request, { ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: current.current_period_end });
        }

        const subscription = await stripeRequest(
          env,
          `subscriptions/${encodeURIComponent(current.stripe_subscription_id)}`,
          new URLSearchParams({ cancel_at_period_end: "true" })
        );

        await saveSubscription(env, {
          userId: uid,
          customerId: subscription.customer || current.stripe_customer_id,
          subscriptionId: subscription.id || current.stripe_subscription_id,
          plan: current.plan,
          status: subscription.status || current.status,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });

        return json(request, {
          ok: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end
        });
      }

      if (url.pathname === "/billing/resume" && request.method === "POST") {
        const current = await getSubscription(env, uid);
        if (!current?.stripe_subscription_id || !["active", "trialing"].includes(current.status)) {
          throw new HttpError(409, "Não existe uma subscrição paga ativa para retomar.");
        }

        const subscription = await stripeRequest(
          env,
          `subscriptions/${encodeURIComponent(current.stripe_subscription_id)}`,
          new URLSearchParams({ cancel_at_period_end: "false" })
        );

        await saveSubscription(env, {
          userId: uid,
          customerId: subscription.customer || current.stripe_customer_id,
          subscriptionId: subscription.id || current.stripe_subscription_id,
          plan: current.plan,
          status: subscription.status || current.status,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end
        });

        return json(request, {
          ok: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: subscription.current_period_end || current.current_period_end
        });
      }

      if (url.pathname === "/usage" && request.method === "GET") {
        const usage = await getUsage(env, uid);
        const usedBytes = Number(usage?.used_bytes || 0);
        const entitlement = await getEntitlement(env, uid, request);

        return json(request, {
          usedBytes,
          quotaBytes: entitlement.quotaBytes,
          remainingBytes: Math.max(0, entitlement.quotaBytes - usedBytes),
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan)
        });
      }

      if (url.pathname === "/ai/chat" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));

        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          throw new HttpError(400, "A operação de IA não contém mensagens.");
        }

        const entitlement = await getEntitlement(env, uid, request);
        const usage = await reserveAiOperation(
          env,
          aiUsageUserId(uid, entitlement),
          entitlement.plan
        );
        const result = await runAiOperation(env, body, usage.modelMode);

        return json(request, {
          ...result.data,
          ai: {
            task: body.task || "general",
            plan: usage.plan,
            model: result.model,
            modelMode: usage.modelMode,
            dailyCount: usage.dailyCount,
            dailyLimit: usage.dailyLimit,
            monthCount: usage.monthCount,
            monthlyLimit: usage.monthlyLimit,
            paidLimit: usage.paidLimit
          }
        });
      }

      if (url.pathname === "/ai/usage" && request.method === "GET") {
        const entitlement = await getEntitlement(env, uid, request);
        const { dayKey, monthKey } = aiPeriodKeys();
        const row = await env.DB.prepare(`
          SELECT day_key, daily_count, month_key, month_count
          FROM ai_usage
          WHERE user_id = ?
        `).bind(aiUsageUserId(uid, entitlement)).first();
        const policy = aiPolicyForPlan(entitlement.plan);

        return json(request, {
          plan: entitlement.plan,
          actualPlan: entitlement.actualPlan,
          previewPlan: entitlement.previewPlan,
          isPreview: Boolean(entitlement.previewPlan),
          dailyCount: row?.day_key === dayKey ? Number(row.daily_count || 0) : 0,
          dailyLimit: policy.dailyLimit,
          monthCount: row?.month_key === monthKey ? Number(row.month_count || 0) : 0,
          monthlyLimit: policy.monthlyLimit,
          paidLimit: policy.paidLimit
        });
      }

      if (url.pathname === "/files" && request.method === "GET") {
        const noteId = url.searchParams.get("noteId");
        const contextType = url.searchParams.get("contextType");
        const contextId = url.searchParams.get("contextId");
        let result;

        const columns = `
          SELECT id, file_name, content_type, size_bytes, created_at,
                 note_id, context_type, context_id
          FROM files
        `;

        if (noteId && contextType && contextId) {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ? AND note_id = ? AND context_type = ? AND context_id = ?
            ORDER BY created_at DESC
          `).bind(uid, noteId, contextType, contextId).all();
        } else if (noteId) {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ? AND note_id = ?
            ORDER BY created_at DESC
          `).bind(uid, noteId).all();
        } else {
          result = await env.DB.prepare(`${columns}
            WHERE user_id = ?
            ORDER BY created_at DESC
          `).bind(uid).all();
        }

        return json(request, { files: result.results });
      }

      if (url.pathname === "/files" && request.method === "PUT") {
        const noteId = url.searchParams.get("noteId");
        const contextType = url.searchParams.get("contextType");
        const contextId = url.searchParams.get("contextId");

        if (!noteId || !contextType || !contextId) {
          throw new HttpError(400, "É obrigatório indicar a nota e o contexto do ficheiro.");
        }

        if (!["caixa", "tarefa"].includes(contextType)) {
          throw new HttpError(400, "O contexto deve ser caixa ou tarefa.");
        }

        const size = Number(request.headers.get("Content-Length"));
        if (!Number.isSafeInteger(size) || size <= 0) {
          throw new HttpError(411, "O tamanho do ficheiro não foi indicado.");
        }

        const entitlement = await getEntitlement(env, uid, request);
        const usage = await getUsage(env, uid);
        const currentUsage = Number(usage?.used_bytes || 0);

        if (currentUsage + size > entitlement.quotaBytes) {
          throw new HttpError(413, `Atingiste o limite do plano ${entitlement.plan}.`);
        }

        const fileId = crypto.randomUUID();
        const fileName = cleanFileName(url.searchParams.get("name"));
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        const objectKey = `users/${uid}/files/${fileId}-${fileName}`;

        const reservation = await env.DB.prepare(`
          UPDATE storage_usage
          SET used_bytes = used_bytes + ?, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND used_bytes + ? <= ?
        `).bind(size, uid, size, entitlement.quotaBytes).run();

        if (Number(reservation.meta?.changes || 0) !== 1) {
          throw new HttpError(413, "O limite de armazenamento foi atingido.");
        }

        try {
          await env.FILES.put(objectKey, request.body, {
            httpMetadata: { contentType }
          });

          await env.DB.prepare(`
            INSERT INTO files (
              id, user_id, object_key, file_name, content_type, size_bytes,
              note_id, context_type, context_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            fileId, uid, objectKey, fileName, contentType, size,
            noteId, contextType, contextId
          ).run();

          const newUsage = await getUsage(env, uid);

          return json(request, {
            ok: true,
            id: fileId,
            name: fileName,
            sizeBytes: size,
            noteId,
            contextType,
            contextId,
            usedBytes: Number(newUsage?.used_bytes || 0),
            quotaBytes: entitlement.quotaBytes,
            plan: entitlement.plan
          }, 201);
        } catch (error) {
          await env.FILES.delete(objectKey);
          await env.DB.prepare(`
            UPDATE storage_usage
            SET used_bytes = MAX(0, used_bytes - ?), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(size, uid).run();
          throw error;
        }
      }

      const fileId = url.pathname.match(/^\/files\/([^/]+)$/)?.[1];

      if (fileId && request.method === "GET") {
        const file = await env.DB.prepare(`
          SELECT * FROM files WHERE id = ? AND user_id = ?
        `).bind(fileId, uid).first();

        if (!file) throw new HttpError(404, "Ficheiro não encontrado.");

        const object = await env.FILES.get(file.object_key);
        if (!object) throw new HttpError(404, "Objecto não encontrado no R2.");

        const headers = headersFor(request, {
          "Content-Type": file.content_type,
          "Content-Length": String(file.size_bytes),
          "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.file_name)}`
        });

        return new Response(object.body, { headers });
      }

      if (fileId && request.method === "DELETE") {
        const file = await env.DB.prepare(`
          SELECT * FROM files WHERE id = ? AND user_id = ?
        `).bind(fileId, uid).first();

        if (!file) throw new HttpError(404, "Ficheiro não encontrado.");

        await env.FILES.delete(file.object_key);

        await env.DB.batch([
          env.DB.prepare(`DELETE FROM files WHERE id = ? AND user_id = ?`).bind(fileId, uid),
          env.DB.prepare(`
            UPDATE storage_usage
            SET used_bytes = MAX(0, used_bytes - ?), updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).bind(file.size_bytes, uid)
        ]);

        return json(request, { ok: true, deleted: fileId });
      }

      return json(request, { error: "Rota não encontrada." }, 404);
    } catch (error) {
      console.error(error);
      return json(
        request,
        { error: error.message || "Erro interno." },
        error.status || 500
      );
    }
  }
};
