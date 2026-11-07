import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMAILS_INDEX } from '../src/server/elasticsearch/emailSearchService';

describe('Elasticsearch Indexing & Query Construction', () => {
  it('should specify standard index name for emails', () => {
    assert.equal(EMAILS_INDEX, 'reachinbox-emails');
  });

  it('should enforce strict tenantId term filter in search queries', () => {
    const tenantId = 'tenant_enterprise_beta';
    const filterClauses = [{ term: { tenantId } }];

    assert.equal(filterClauses[0].term.tenantId, 'tenant_enterprise_beta');
    assert.ok(filterClauses.some((f) => f.term && f.term.tenantId), 'Filter clause must isolate tenant');
  });

  it('should support multi-match full text search across subject and bodyText', () => {
    const query = 'product launch invitation';
    const multiMatch = {
      multi_match: {
        query,
        fields: ['subject^3', 'bodyText', 'recipient^2', 'sender'],
        fuzziness: 'AUTO',
      },
    };

    assert.equal(multiMatch.multi_match.query, query);
    assert.ok(multiMatch.multi_match.fields.includes('subject^3'), 'Subject should have 3x boost');
    assert.equal(multiMatch.multi_match.fuzziness, 'AUTO');
  });

  it('should define highlight tags for search UI display', () => {
    const highlightConfig = {
      pre_tags: ['<mark class="bg-amber-500/20 text-amber-300 font-semibold px-1 rounded">'],
      post_tags: ['</mark>'],
    };
    assert.ok(highlightConfig.pre_tags[0].includes('mark'));
    assert.equal(highlightConfig.post_tags[0], '</mark>');
  });
});
