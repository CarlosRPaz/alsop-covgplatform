import { describe, it, expect } from 'vitest';
import { normalizePolicyNumber } from '@/lib/normalization';

describe('normalizePolicyNumber', () => {
    it('parses standard format: CFP + 10 digits + suffix', () => {
        const result = normalizePolicyNumber('CFP 0102162693 01');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: '01' });
    });

    it('parses digits-only (no CFP prefix)', () => {
        const result = normalizePolicyNumber('0102162693');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: null });
    });

    it('parses digits-only with suffix', () => {
        const result = normalizePolicyNumber('0102162693 02');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: '02' });
    });

    it('handles null and undefined', () => {
        expect(normalizePolicyNumber(null)).toEqual({ basePolicy: null, suffix: null });
        expect(normalizePolicyNumber(undefined)).toEqual({ basePolicy: null, suffix: null });
    });

    it('handles empty string', () => {
        expect(normalizePolicyNumber('')).toEqual({ basePolicy: null, suffix: null });
    });

    it('strips special characters', () => {
        const result = normalizePolicyNumber('CFP-0102162693-01');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: '01' });
    });

    it('is case-insensitive', () => {
        const result = normalizePolicyNumber('cfp 0102162693 01');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: '01' });
    });

    it('collapses extra whitespace', () => {
        const result = normalizePolicyNumber('CFP   0102162693   01');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: '01' });
    });

    it('falls back for non-standard policy numbers', () => {
        const result = normalizePolicyNumber('HO-12345');
        expect(result).toEqual({ basePolicy: 'HO12345', suffix: null });
    });

    it('handles leading/trailing whitespace', () => {
        const result = normalizePolicyNumber('  CFP 0102162693  ');
        expect(result).toEqual({ basePolicy: 'CFP 0102162693', suffix: null });
    });

    it('treats two different suffixes as same base policy', () => {
        const a = normalizePolicyNumber('CFP 0102162693 01');
        const b = normalizePolicyNumber('CFP 0102162693 02');
        expect(a.basePolicy).toBe(b.basePolicy);
        expect(a.suffix).not.toBe(b.suffix);
    });
});

describe('cleanPolicyNumber', () => {
    it('removes parentheses from policy numbers', async () => {
        const { cleanPolicyNumber } = await import('@/lib/internalTemplateStore');
        expect(cleanPolicyNumber('(0102162693)')).toBe('0102162693');
        expect(cleanPolicyNumber('policy (CFP 0102162693)')).toBe('policy CFP 0102162693');
    });

    it('removes term suffixes from policy numbers', async () => {
        const { cleanPolicyNumber } = await import('@/lib/internalTemplateStore');
        expect(cleanPolicyNumber('CFP 0102162693 01')).toBe('CFP 0102162693');
        expect(cleanPolicyNumber('0102162693-01')).toBe('0102162693');
        expect(cleanPolicyNumber('0102162693-1')).toBe('0102162693');
        expect(cleanPolicyNumber('0102162693 - Term 2')).toBe('0102162693');
        expect(cleanPolicyNumber('0102162693 (Term 1)')).toBe('0102162693');
    });

    it('preserves clean policy numbers without terms or parens', async () => {
        const { cleanPolicyNumber } = await import('@/lib/internalTemplateStore');
        expect(cleanPolicyNumber('CFP-9842104')).toBe('CFP-9842104');
        expect(cleanPolicyNumber('0102162693')).toBe('0102162693');
        expect(cleanPolicyNumber('CFP 0102162693')).toBe('CFP 0102162693');
    });
});

