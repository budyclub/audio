const Bull = require('bull');
const process = require('process');
const { _sendPushNotif } = require('./handlers/push-notifications');


const jobs = {
  'push-notifications': _sendPushNotif
}

class JobQueue {

  /**
   * @instance
   */

  constructor() {
    this.queues = {};
    this.initialized = false
    this.jobRedisPrefix = ''
  }

  start() {
    if(this.initialized) return;
    this.initialized = true;

    this.jobRedisPrefix = 'jobs-queue';

    const queueOptions = {
      prefix: this.jobRedisPrefix,
      redis: {
        host: "127.0.0.1",
        port: 6379,
        password: process.env.REDIS_PASSWORD,
      },
      settings: {
        maxStalledCount: 10,
      }
    }

    for (const jobKey of Object.keys(jobs)) {
      const queue = new Bull(jobKey, queueOptions);

      const job = jobs[jobKey];

      queue.process(4, job)
        .catch(err => logger.error('Error in job queue processor %s.', jobKey, { err }))

      queue.on('failed', (job, err) => {
        console.log('Cannot execute job %d in queue %s.', job.id, jobKey, { payload: job.data, err })
      });

      queue.on('error', (err) => {
        console.log('Error in job queue %s.', jobKey, { err });
      });
      this.queues[jobKey] = queue;
    }

    // this.addRepeatableJobs();
  }

  createJob(job, options = {}) {
    // check if job key does exist
    if(!(job.key in this.queues)) {
      console.log('Unknown queue %s: cannot create job for unknown key.', job.key);

      return
    }

    const jobArgs = {
      backoff: { delay: 60 * 1000, type: 'exponential' },
      attempts: 5,
      timeout: 60000 * 10,
      priority: options?.priority,
      delay: options?.delay
    }

    return this.queues[job.key].add(job.p, jobArgs);
  }

  async terminateJob() {
    for (const jobKey of Object.keys(this.queues)) {
      await this.queues[jobKey]?.close?.();
    }
  }

  async pause() {
    for (const jobKey of Object.keys(this.queues)) {
      await this.queues[jobKey]?.pause?.(true);
    }
  }

  async resume() {
    for (const jobKey of Object.keys(this.queues)) {
      await this.queues[jobKey]?.resume?.(true);
    }
  }

  static get Instance() {
    return this.instance || (this.instance = new this());
  }
}

module.exports = {
  JobQueue,
}
