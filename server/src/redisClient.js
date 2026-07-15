const IORedis = require('ioredis');
const config = require('./config');

let client = null;

function getClient() {
  if (!client) {
    client = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return client;
}

async function reconnect(url) {
  if (client) {
    try {
      client.removeAllListeners();
      await client.quit();
    } catch (e) {
      // ignore
    }
  }
  client = new IORedis(url, { maxRetriesPerRequest: null });
  return client;
}

module.exports = { getClient, reconnect };
