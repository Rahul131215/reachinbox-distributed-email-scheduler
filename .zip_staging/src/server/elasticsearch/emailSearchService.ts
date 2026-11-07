import { getElasticsearchClient } from './client';

export const EMAILS_INDEX = 'reachinbox-emails';

export interface EmailDocument {
  id: string;
  jobId: string;
  tenantId: string;
  campaignId?: string;
  recipient: string;
  sender: string;
  subject: string;
  bodyText?: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';
  scheduledFor: string;
  sentAt?: string;
  attempts?: number;
  lastError?: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface SearchFilterOptions {
  tenantId: string;
  query?: string;
  status?: string;
  campaignId?: string;
  from?: number;
  size?: number;
}

export class EmailSearchService {
  /**
   * Ensure the reachinbox-emails index exists with correct mapping and analyzers
   */
  public static async ensureIndex(): Promise<boolean> {
    const client = getElasticsearchClient();
    const exists = await client.indices.exists({ index: EMAILS_INDEX });

    if (!exists) {
      await client.indices.create({
        index: EMAILS_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'standard',
                  stopwords: '_english_',
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              jobId: { type: 'keyword' },
              tenantId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              recipient: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              sender: { type: 'keyword' },
              subject: {
                type: 'text',
                analyzer: 'email_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              bodyText: {
                type: 'text',
                analyzer: 'email_analyzer',
              },
              status: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              attempts: { type: 'integer' },
              lastError: { type: 'text' },
              idempotencyKey: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      return true;
    }
    return false;
  }

  /**
   * Index or update an email document
   */
  public static async indexEmail(doc: EmailDocument): Promise<void> {
    const client = getElasticsearchClient();
    await client.index({
      index: EMAILS_INDEX,
      id: doc.id,
      body: doc,
      refresh: 'wait_for',
    });
  }

  /**
   * Search emails isolated strictly by tenantId with full-text query, filters, and highlights
   */
  public static async searchEmails(options: SearchFilterOptions) {
    const client = getElasticsearchClient();

    const mustClauses: any[] = [];
    const filterClauses: any[] = [
      { term: { tenantId: options.tenantId } }, // Strict tenant isolation
    ];

    if (options.status) {
      filterClauses.push({ term: { status: options.status } });
    }

    if (options.campaignId) {
      filterClauses.push({ term: { campaignId: options.campaignId } });
    }

    if (options.query && options.query.trim().length > 0) {
      mustClauses.push({
        multi_match: {
          query: options.query,
          fields: ['subject^3', 'bodyText', 'recipient^2', 'sender'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    const response = await client.search<EmailDocument>({
      index: EMAILS_INDEX,
      from: options.from || 0,
      size: options.size || 20,
      body: {
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
        highlight: {
          fields: {
            subject: {},
            bodyText: {},
          },
          pre_tags: ['<mark class="bg-amber-500/20 text-amber-300 font-semibold px-1 rounded">'],
          post_tags: ['</mark>'],
        },
        sort: [{ scheduledFor: { order: 'desc' } }],
      },
    });

    const hits = response.hits.hits.map((hit: any) => ({
      ...hit._source,
      highlights: hit.highlight || {},
      score: hit._score,
    }));

    const totalHits =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : response.hits.total?.value || hits.length;

    return {
      total: totalHits,
      results: hits,
    };
  }

  /**
   * Delete an email document from the index
   */
  public static async deleteEmail(id: string): Promise<void> {
    const client = getElasticsearchClient();
    await client.delete({
      index: EMAILS_INDEX,
      id,
      refresh: true,
    });
  }
}
