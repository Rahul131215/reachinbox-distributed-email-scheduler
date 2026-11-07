import { Client } from '@elastic/elasticsearch';

const ELASTIC_NODE = process.env.ELASTICSEARCH_URL || process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200';
const ELASTIC_API_KEY = process.env.ELASTICSEARCH_API_KEY;

export interface ElasticHealthStatus {
  connected: boolean;
  clusterName?: string;
  status?: string;
  nodeUrl: string;
  docCount?: number;
  error?: string;
}

let esClientInstance: Client | null = null;

export function getElasticsearchClient(): Client {
  if (!esClientInstance) {
    const config: any = {
      node: ELASTIC_NODE,
      maxRetries: 2,
      requestTimeout: 2000,
    };

    if (ELASTIC_API_KEY) {
      config.auth = { apiKey: ELASTIC_API_KEY };
    }

    esClientInstance = new Client(config);
  }
  return esClientInstance;
}

export async function checkElasticHealth(): Promise<ElasticHealthStatus> {
  const client = getElasticsearchClient();
  try {
    const health = await Promise.race([
      client.cluster.health(),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Elasticsearch timeout (2000ms)')), 2000)
      ),
    ]);

    let docCount = 0;
    try {
      const countRes = await client.count({ index: 'reachinbox-emails' });
      docCount = countRes.count;
    } catch {
      // index might not be created yet
    }

    return {
      connected: true,
      clusterName: health.cluster_name,
      status: health.status,
      nodeUrl: ELASTIC_NODE,
      docCount,
    };
  } catch (err: any) {
    return {
      connected: false,
      nodeUrl: ELASTIC_NODE,
      error: err?.message || 'Elasticsearch unreachable',
    };
  }
}
