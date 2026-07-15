const { Queue, Worker } = require('bullmq');
const config = require('./config');
const { sendMail } = require('./mailer');
const track = require('./track');

const QUEUE_NAME = 'outreach-emails';

let queue = null;
let worker = null;

function buildInfra() {
  // Pass connection OPTIONS (not a shared instance) so BullMQ creates and manages
  // its own dedicated connections. Sharing one ioredis instance between the Queue
  // (addBulk) and the Worker (blocking pop) can stall job processing on serverless
  // Redis (Upstash).
  const connectionOpts = { url: config.redisUrl, maxRetriesPerRequest: null };

  queue = new Queue(QUEUE_NAME, {
    connection: connectionOpts,
    defaultJobOptions: {
      attempts: config.queue.attempts,
      backoff: { type: 'fixed', delay: config.queue.backoffMs },
      removeOnComplete: { age: 60 * 60 * 24 },
      removeOnFail: { age: 60 * 60 * 24 },
    },
  });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const mail = job.data;
      // Log a snippet of the HTML for debugging
      const htmlSnippet = (mail.html || '').slice(-200);
      console.log(`[queue] sending to=${mail.to} trackId=${mail.trackId} htmlEnd=${JSON.stringify(htmlSnippet)}`);
      const info = await sendMail(mail);
      await track.markSent(mail.trackId).catch(() => {});
      return { messageId: info.messageId, to: mail.to };
    },
    {
      connection: connectionOpts,
      concurrency: config.queue.concurrency,
      limiter: {
        max: config.queue.maxPerWindow,
        duration: config.queue.windowMs,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[queue] sent -> ${job.data.to} (job ${job.id})`);
  });

  worker.on('failed', (job, err) => {
    const msg = err.message || String(err);
    console.error(`[queue] failed -> ${job?.data?.to} (job ${job?.id}):`, msg);
    if (job?.data?.trackId) track.markFailed(job.data.trackId, msg).catch(() => {});
  });
}

// Build on module load
buildInfra();

/**
 * Enqueue one or many emails. Each gets a tracking id, tracking meta is stored,
 * and the body is rewritten with an open pixel + click-tracked links.
 * @param {Array<{to,subject,body,replyTo?,fromName?,founderId?}>} emails
 * @returns {Promise<Array<{id:string, to:string, trackId:string}>>}
 */
async function enqueueEmails(emails) {
  if (!Array.isArray(emails)) emails = [emails];

  const jobsData = await Promise.all(
    emails.map(async (mail) => {
      const trackId = track.generateTrackingId();
      await track.saveMeta(trackId, {
        to: mail.to,
        founderId: mail.founderId,
        subject: mail.subject,
      });
      const html = track.buildTrackedHtml(mail.body, trackId);
      return {
        name: 'send-email',
        data: { ...mail, html, trackId },
        opts: { jobId: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
      };
    })
  );

  const jobs = await queue.addBulk(jobsData);
  return jobs.map((j) => ({ id: j.id, to: j.data.to, trackId: j.data.trackId }));
}

async function getQueueCounts() {
  return queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
}

module.exports = { queue, worker, enqueueEmails, getQueueCounts, QUEUE_NAME };
