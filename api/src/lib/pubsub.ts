import { WebPubSubServiceClient } from '@azure/web-pubsub';
import type { RealtimeMessage } from './types';
import { isMockMode } from './types';
import { broadcast as mockBroadcast } from './mockStore';

let client: WebPubSubServiceClient | null = null;

function getClient(): WebPubSubServiceClient {
  if (!client) {
    const conn = process.env.WEBPUBSUB_CONNECTION_STRING;
    const hub = process.env.WEBPUBSUB_HUB || 'carpool';
    if (!conn) throw new Error('WEBPUBSUB_CONNECTION_STRING not configured');
    client = new WebPubSubServiceClient(conn, hub);
  }
  return client;
}

export async function publish(message: RealtimeMessage): Promise<void> {
  if (isMockMode() || !process.env.WEBPUBSUB_CONNECTION_STRING) {
    mockBroadcast(message);
    return;
  }
  await getClient().sendToAll(JSON.stringify(message));
}

export async function negotiate(): Promise<{ url: string } | { mock: true }> {
  if (isMockMode() || !process.env.WEBPUBSUB_CONNECTION_STRING) {
    return { mock: true };
  }
  const hub = process.env.WEBPUBSUB_HUB || 'carpool';
  const serviceClient = getClient();
  const token = await serviceClient.getClientAccessToken({
    roles: [`webpubsub.joinLeaveGroup.${hub}`, `webpubsub.sendToGroup.${hub}`],
  });
  return { url: token.url };
}
