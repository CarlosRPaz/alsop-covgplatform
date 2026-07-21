import { getSupabaseAdmin } from '@/lib/supabaseClient';
import { normalizePolicyNumber } from '@/lib/normalization';

export interface DuplicateGroup {
    type: 'client' | 'policy';
    survivor_id: string;
    merged_ids: string[];
    confidence: number;
    reason: string;
    details: any;
}

/**
 * Service to execute sweeping database inspections to identify possible duplicate records
 * in order to surface them on the DuplicateReview operations queue.
 */
export class DuplicateEngine {

    /**
     * Finds clustered duplicate policies by enforcing the Global Policy Invariant:
     * Identifies multiple distinct `policies` rows that share the EXACT same Base Policy Normalization.
     */
    static async findPolicyDuplicates(): Promise<DuplicateGroup[]> {
        const supabaseAdmin = getSupabaseAdmin();
        let policies: any[] = [];
        let hasMore = true;
        let page = 0;
        const pageSize = 1000;

        while (hasMore) {
            const { data, error } = await supabaseAdmin
                .from('policies')
                .select('id, policy_number, created_at, client_id, property_address_norm')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error("Error fetching policies for duplicate detection", error);
                return [];
            }

            if (data && data.length > 0) {
                policies = policies.concat(data);
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }

        // Group by Normalized Base Policy
        const grouped = new Map<string, typeof policies>();

        for (const pol of policies) {
            const { basePolicy } = normalizePolicyNumber(pol.policy_number);
            if (!basePolicy) continue;
            
            if (!grouped.has(basePolicy)) {
                grouped.set(basePolicy, []);
            }
            grouped.get(basePolicy)!.push(pol);
        }

        const exactDuplicates: DuplicateGroup[] = [];

        for (const [base, cluster] of grouped.entries()) {
            if (cluster.length > 1) {
                // Prioritize pure base policies (no sequence suffix). Ties broken by creation date.
                cluster.sort((a, b) => {
                    const normA = normalizePolicyNumber(a.policy_number);
                    const normB = normalizePolicyNumber(b.policy_number);
                    
                    const hasSuffixA = normA.suffix ? 1 : 0;
                    const hasSuffixB = normB.suffix ? 1 : 0;
                    
                    if (hasSuffixA !== hasSuffixB) {
                        return hasSuffixA - hasSuffixB; // 0 comes before 1
                    }
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                });
                
                const survivor = cluster[0];
                const merges = cluster.slice(1);

                exactDuplicates.push({
                    type: 'policy',
                    survivor_id: survivor.id,
                    merged_ids: merges.map(m => m.id),
                    confidence: 100, // Exact Base Match is 100% confidence globally
                    reason: `Shares identical Base Policy Number: ${base}`,
                    details: {
                        survivor,
                        duplicates: merges
                    }
                });
            }
        }

        return exactDuplicates;
    }

    /**
     * Finds clustered duplicate clients via Name + Linked Policy overlap.
     */
    static async findClientDuplicates(): Promise<DuplicateGroup[]> {
        const supabaseAdmin = getSupabaseAdmin();
        let clients: any[] = [];
        let hasMore = true;
        let page = 0;
        const pageSize = 1000;

        while (hasMore) {
            const { data, error } = await supabaseAdmin
                .from('clients')
                .select(`
                    id, named_insured, email, phone, mailing_address_raw, mailing_address_norm, created_at,
                    policies(id, policy_number, carrier_name, property_address_raw, status, created_at,
                        policy_terms(id, effective_date, expiration_date, annual_premium, is_current)),
                    dec_pages(id)
                `)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error("Error fetching clients for duplicate detection", error);
                return [];
            }

            if (data && data.length > 0) {
                clients = clients.concat(data);
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }

        // ── Phase 1: Exact normalized name grouping ──
        // Normalize: remove spacing, punctuation, and lowercase
        const grouped = new Map<string, typeof clients>();

        for (const c of clients) {
            if (!c.named_insured) continue;
            const normName = c.named_insured.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normName.length < 4) continue;

            if (!grouped.has(normName)) {
                grouped.set(normName, []);
            }
            grouped.get(normName)!.push(c);
        }

        const candidateDuplicates: DuplicateGroup[] = [];
        const exactMatchedIds = new Set<string>();

        for (const [, cluster] of grouped.entries()) {
            if (cluster.length > 1) {
                cluster.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                const survivor = cluster[0];
                const merges = cluster.slice(1);

                candidateDuplicates.push({
                    type: 'client',
                    survivor_id: survivor.id,
                    merged_ids: merges.map(m => m.id),
                    confidence: 85,
                    reason: `Identical Normalized Name`,
                    details: {
                        survivor,
                        duplicates: merges
                    }
                });
                for (const c of cluster) exactMatchedIds.add(c.id);
            }
        }

        // ── Phase 2: Token-subset fuzzy matching ──
        // Catches variations like "Jason Wolsefer" vs "Jason J. Wolsefer"
        // where one name's tokens are a subset of another's.
        const ungrouped = clients.filter(c =>
            c.named_insured &&
            c.named_insured.toLowerCase().replace(/[^a-z0-9]/g, '').length >= 4 &&
            !exactMatchedIds.has(c.id)
        );

        // Tokenize each ungrouped client's name
        interface TokenEntry { client: any; tokens: Set<string>; }
        const tokenEntries: TokenEntry[] = ungrouped.map(c => ({
            client: c,
            tokens: new Set(
                c.named_insured
                    .toLowerCase()
                    .replace(/[^a-z\s]/g, '')  // keep letters + spaces
                    .split(/\s+/)
                    .filter((t: string) => t.length >= 2)  // skip single-char tokens like middle initials
            ),
        }));

        const fuzzyMatchedIds = new Set<string>();

        for (let i = 0; i < tokenEntries.length; i++) {
            if (fuzzyMatchedIds.has(tokenEntries[i].client.id)) continue;

            const a = tokenEntries[i];
            const fuzzyCluster: any[] = [a.client];

            for (let j = i + 1; j < tokenEntries.length; j++) {
                if (fuzzyMatchedIds.has(tokenEntries[j].client.id)) continue;
                const b = tokenEntries[j];

                // Check if one is a subset of the other (both directions)
                // e.g. {jason, wolsefer} ⊂ {jason, wolsefer} (exact on long tokens)
                // or {jason, wolsefer} vs {jason, j, wolsefer} — after filtering short tokens
                const aSubsetOfB = a.tokens.size > 0 && [...a.tokens].every(t => b.tokens.has(t));
                const bSubsetOfA = b.tokens.size > 0 && [...b.tokens].every(t => a.tokens.has(t));

                if (aSubsetOfB || bSubsetOfA) {
                    fuzzyCluster.push(b.client);
                    fuzzyMatchedIds.add(b.client.id);
                }
            }

            if (fuzzyCluster.length > 1) {
                fuzzyMatchedIds.add(a.client.id);
                fuzzyCluster.sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());

                const survivor = fuzzyCluster[0];
                const merges = fuzzyCluster.slice(1);

                candidateDuplicates.push({
                    type: 'client',
                    survivor_id: survivor.id,
                    merged_ids: merges.map(m => m.id),
                    confidence: 70,
                    reason: `Similar Name (Token Match)`,
                    details: {
                        survivor,
                        duplicates: merges
                    }
                });
            }
        }

        return candidateDuplicates;
    }
}
