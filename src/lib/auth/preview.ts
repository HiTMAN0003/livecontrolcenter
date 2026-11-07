/**
 * Live-preview OAuth client metadata (server-only — NEVER import from the client).
 * The shared preview client id is not sufficient to authenticate: its secret is
 * supplied only by the runtime when available. No shared OAuth secret is stored
 * in this repository. Production deployments should inject per-app credentials.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview origin from the request host and validates it against this
 * list before constructing the OAuth redirect URI.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
