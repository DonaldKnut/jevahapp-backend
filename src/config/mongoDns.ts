import dns from "dns";
import logger from "../utils/logger";

/**
 * Windows often hands Node a 127.0.0.1 DNS stub that refuses SRV lookups
 * (`querySrv ECONNREFUSED` for mongodb+srv). Prefer public resolvers when
 * connecting via SRV, unless DNS_SERVERS is set explicitly.
 */
export function ensureMongoDnsServers(mongoUri: string): void {
  if (!mongoUri.startsWith("mongodb+srv://")) return;

  const current = dns.getServers();
  const onlyLoopback =
    current.length > 0 && current.every((s) => s === "127.0.0.1" || s === "::1");

  const fromEnv = (process.env.DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const servers =
    fromEnv.length > 0
      ? fromEnv
      : onlyLoopback
        ? ["8.8.8.8", "1.1.1.1"]
        : null;

  if (!servers) return;

  dns.setServers(servers);
  logger.info("DNS servers set for mongodb+srv", {
    previous: current,
    servers,
  });
}
