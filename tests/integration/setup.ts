/**
 * Integration harness bootstrap.
 *
 * Live suite:
 *   RUN_INTEGRATION=1 \
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/jevah_like_test \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 \
 *   JWT_SECRET=integration-test-secret \
 *   npm run test:integration
 *
 * When RUN_INTEGRATION=1, missing/unreachable infra fails the suite.
 */
import dotenv from "dotenv";

dotenv.config();

const RUN = process.env.RUN_INTEGRATION === "1";

if (RUN) {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || "integration-test-secret-do-not-use-in-prod";
  process.env.LIKE_RATE_LIMIT_PER_CONTENT =
    process.env.LIKE_RATE_LIMIT_PER_CONTENT || "3";
  process.env.LIKE_RATE_WINDOW_PER_CONTENT_SECONDS =
    process.env.LIKE_RATE_WINDOW_PER_CONTENT_SECONDS || "10";

  const mongo =
    process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
  const redis = process.env.TEST_REDIS_URL || process.env.REDIS_URL;

  if (!mongo) {
    throw new Error(
      "RUN_INTEGRATION=1 requires TEST_MONGODB_URI (or MONGODB_URI). Refusing to silently skip."
    );
  }
  if (!redis) {
    throw new Error(
      "RUN_INTEGRATION=1 requires TEST_REDIS_URL (or REDIS_URL). Refusing to silently skip."
    );
  }

  // App + engagement Redis read these
  process.env.MONGODB_URI = mongo;
  process.env.REDIS_URL = redis;
  process.env.SOCKET_REDIS_ADAPTER = "false";
}

export const RUN_INTEGRATION = RUN;
