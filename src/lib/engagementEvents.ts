/**
 * Kafka producer for engagement events (likes, views, shares, comments).
 * Falls back silently when KAFKA_BROKERS is unset — BullMQ analytics still runs.
 */
import { Kafka, Producer, logLevel } from "kafkajs";
import logger from "../utils/logger";
import { enqueueAnalyticsEvent } from "../queues/enqueue";

const TOPIC = process.env.KAFKA_ENGAGEMENT_TOPIC || "jevah.engagement.events";
const BROKERS = (process.env.KAFKA_BROKERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

let producer: Producer | null = null;
let connectPromise: Promise<void> | null = null;

async function getProducer(): Promise<Producer | null> {
  if (!BROKERS.length) return null;
  if (producer) return producer;

  if (!connectPromise) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || "jevah-api",
      brokers: BROKERS,
      logLevel: logLevel.ERROR,
    });
    producer = kafka.producer({ allowAutoTopicCreation: true });
    connectPromise = producer.connect().catch(err => {
      logger.warn("Kafka producer connect failed", { error: err.message });
      producer = null;
      connectPromise = null;
      throw err;
    });
  }

  try {
    await connectPromise;
    return producer;
  } catch {
    return null;
  }
}

/**
 * Fire-and-forget analytics ingest.
 * Prefer Kafka when KAFKA_BROKERS is set; otherwise BullMQ.
 * Never dual-publish (avoids duplicate AnalyticsEvent / counter bumps).
 */
export function publishEngagementEvent(
  name: string,
  payload: Record<string, unknown>
): void {
  void (async () => {
    const p = await getProducer();
    if (p) {
      await p.send({
        topic: TOPIC,
        messages: [
          {
            key: String(payload.contentId || payload.userId || ""),
            value: JSON.stringify({
              name,
              payload,
              ts: new Date().toISOString(),
            }),
          },
        ],
      });
      return;
    }

    enqueueAnalyticsEvent({ name, payload });
  })().catch(err => {
    logger.warn("Engagement event publish failed", {
      name,
      error: (err as Error).message,
    });
    // Last resort: BullMQ if Kafka send failed after producer existed
    try {
      enqueueAnalyticsEvent({ name, payload });
    } catch {
      /* ignore */
    }
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
    connectPromise = null;
  }
}
