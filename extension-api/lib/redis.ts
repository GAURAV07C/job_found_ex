import IORedis from 'ioredis';

const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || '';

export async function getRedis() {
  if (!url) throw new Error('Redis not configured. Set UPSTASH_REDIS_URL or REDIS_URL.');
  return new IORedis(url, { maxRetriesPerRequest: null });
}
