import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { config } from '../infrastructure/config.js';
import { createSession, deleteSession } from '../infrastructure/session.js';
import { logger } from '../infrastructure/logger.js';
import { requireAuth } from '../middleware/require-auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import crypto from 'node:crypto';

const authRateLimit = rateLimit({ max: 10, windowSeconds: 60, keyPrefix: 'auth' });

export const authRouter = new Hono();

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function getRedirectUri(): string {
  return `${config.apiDomain}/auth/callback`;
}

/**
 * GET /auth/login
 * Discord OAuth2 認可 URL にリダイレクトする
 * ?from=admin を付与すると、ログイン後に Admin ダッシュボードへリダイレクトする
 *
 * NOTE: Discord Developer Portal の Redirect URLs に以下を登録すること:
 *   - http://localhost:3000/auth/callback  (開発用)
 *   - https://api.sumirevox.com/auth/callback  (本番)
 */
authRouter.get('/login', authRateLimit, async (c) => {
  const from = c.req.query('from');
  const state = crypto.randomUUID();

  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'Lax',
    maxAge: 300, // 5分
    path: '/',
  });

  setCookie(c, 'oauth_from', from === 'admin' ? 'admin' : 'web', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'Lax',
    maxAge: 300, // 5分
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });

  const authUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  return c.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Discord からのコールバック。トークン交換 → ユーザー情報取得 → セッション作成
 */
authRouter.get('/callback', authRateLimit, async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');

  if (!state || !storedState || state !== storedState) {
    logger.warn('OAuth callback: state mismatch');
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '認証に失敗しました。もう一度お試しください。' },
      },
      400,
    );
  }

  deleteCookie(c, 'oauth_state', { path: '/' });

  const from = getCookie(c, 'oauth_from');
  deleteCookie(c, 'oauth_from', { path: '/' });

  if (!code) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: '認証コードが見つかりません。' } },
      400,
    );
  }

  try {
    const tokenResponse = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ status: tokenResponse.status, error }, 'Token exchange failed');
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: '認証に失敗しました。' } },
        401,
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    const userResponse = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      logger.error({ status: userResponse.status }, 'User info fetch failed');
      return c.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'ユーザー情報の取得に失敗しました。' } },
        401,
      );
    }

    const userData = (await userResponse.json()) as {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
    };

    const tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    const sessionId = await createSession({
      userId: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt,
    });

    setCookie(c, 'session_id', sessionId, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60, // 7日
      path: '/',
    });

    logger.info({ userId: userData.id, username: userData.username }, 'User logged in');
    const redirectDomain = from === 'admin' ? config.adminDomain : config.webDomain;
    const redirectPath = from === 'admin' ? '/dashboard' : '/';
    return c.redirect(`${redirectDomain}${redirectPath}`);
  } catch (error) {
    logger.error({ err: error }, 'OAuth callback error');
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '認証処理中にエラーが発生しました。' } },
      500,
    );
  }
});

/**
 * GET /auth/me
 * 現在のセッションのユーザー情報を返す
 */
authRouter.get('/me', requireAuth, (c) => {
  const session = c.get('session')!;
  return c.json({
    success: true,
    data: {
      userId: session.userId,
      username: session.username,
      discriminator: session.discriminator,
      avatar: session.avatar,
    },
  });
});

/**
 * POST /auth/logout
 * セッションを削除する
 */
authRouter.post('/logout', async (c) => {
  const sessionId = c.get('sessionId');
  if (sessionId) {
    await deleteSession(sessionId);
  }
  deleteCookie(c, 'session_id', { path: '/' });
  return c.json({ success: true, data: null });
});
