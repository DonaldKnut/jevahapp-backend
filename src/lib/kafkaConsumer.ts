import { Kafka, Consumer, logLevel } from "kafkajs";
import logger from "../utils/logger";
import { processEngagementEvent } from "./processEngagementEvent";

const TOPIC = process.env.KAFKA_ENGAGEMENT_TOPIC || "jevah.engagement.events";
const GROUP_ID = process.env.KAFKA_CONSUMER_GROUP || "jevah-engagement-workers";
const BROKERS = (process.env.KAFKA_BROKERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

let consumer: Consumer | null = null;

export async function startEngagementKafkaConsumer(): Promise<void> {
  if (!BROKERS.length) {
    logger.info("Kafka consumer skipped — KAFKA_BROKERS not set");
    return;
  }

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "jevah-worker",
    brokers: BROKERS,
    logLevel: logLevel.ERROR,
  });

  consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const parsed = JSON.parse(message.value.toString());
        const name = parsed.name as string;
        const payload = (parsed.payload || {}) as Record<string, unknown>;
        if (!name) return;
        await processEngagementEvent(name, payload);
      } catch (err) {
        logger.warn("Kafka message processing failed", {
          error: (err as Error).message,
        });
      }
    },
  });

  logger.info("Kafka engagement consumer started", { topic: TOPIC, groupId: GROUP_ID });
}

export async function stopEngagementKafkaConsumer(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
