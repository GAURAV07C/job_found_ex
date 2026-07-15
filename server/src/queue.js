const { Queue, Worker } = require('bullmq');
const config = require('./config');
const { sendMail } = require('./mailer');
const track = require('./track');
const { getClient, reconnect } = require('./redisClient');

const QUEUE_NAME = 'outreach-emails';

let queue = null;
let worker = null;

function buildInfra() {
  const connection = getClient();

  queue = new Queue(QUEUE_NAME, {
    connection,
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
      const info = await sendMail(mail);
      await track.markSent(mail.trackId).catch(() => {});
      return { messageId: info.messageId, to: mail.to };
    },
    {
      connection,
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
    console.error(`[queue] failed -> ${job?.data?.to} (job ${job?.id}):`, err.message);
    if (job?.data?.trackId) track.markFailed(job.data.trackId, err.message).catch(() => {});
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
