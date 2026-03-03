/**
 * Centralized environment variable validation.
 * Fails fast at startup if required variables are missing.
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_ env vars when accessed
 * as literal `process.env.NEXT_PUBLIC_X` expressions. Dynamic access
 * like `process.env[name]` will NOT work on the client side.
 * That's why we reference each var directly below.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   console.log(env.SUPABASE_URL);
 */

function assertDefined(value: string | undefined, name: string): string {
    if (!value || value.trim() === '') {
        throw new Error(
            `[ENV] Missing required environment variable: ${name}. ` +
            `Please add it to your .env.local file.`
        );
    }
    return value;
}

/**
 * Validated environment variables.
 * Public vars use direct `process.env.NEXT_PUBLIC_*` references
 * so Next.js can inline them into the client bundle.
 */
export const env = {
    /** Supabase project URL (client-safe). */
    get SUPABASE_URL(): string {
        return assertDefined(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
    },

    /** Supabase anonymous/public key (client-safe, RLS-gated). */
    get SUPABASE_ANON_KEY(): string {
        return assertDefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
    },

    /**
     * Supabase service role key (SERVER-SIDE ONLY).
     * Never expose this to the browser. Only import this in:
     * - API routes (src/app/api/...)
     * - Server components
     * - Server actions
     */
    get SUPABASE_SERVICE_ROLE_KEY(): string {
        return assertDefined(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
    },

    /** Whether we're running in production. */
    get IS_PRODUCTION(): boolean {
        return process.env.NODE_ENV === 'production';
    },
} as const;
