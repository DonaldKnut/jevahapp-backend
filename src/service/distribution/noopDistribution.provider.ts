/**
 * Future Amuse-like DSP distribution hook.
 * In-app releases are the source of truth; outbound stores plug in here later.
 */
export type DistributionTarget =
  | "spotify"
  | "apple_music"
  | "boomplay"
  | "audiomack"
  | "other";

export interface DistributionJobInput {
  releaseId: string;
  targets: DistributionTarget[];
  metadata?: Record<string, unknown>;
}

export interface DistributionJobResult {
  accepted: boolean;
  message: string;
  jobId?: string;
}

export interface DistributionProvider {
  readonly name: string;
  enqueueRelease(input: DistributionJobInput): Promise<DistributionJobResult>;
}

/** No-op provider — DSP delivery not implemented in this build. */
export class NoopDistributionProvider implements DistributionProvider {
  readonly name = "noop";

  async enqueueRelease(
    input: DistributionJobInput
  ): Promise<DistributionJobResult> {
    return {
      accepted: false,
      message: `DSP distribution not enabled (release ${input.releaseId}). In-app publish only.`,
    };
  }
}

export const distributionProvider: DistributionProvider =
  new NoopDistributionProvider();
