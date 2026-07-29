import { PlatformConfig, IPlatformConfig } from "../../models/platformConfig.model";

export type PublicPlatformConfig = {
  uploadsEnabled: boolean;
  registrationEnabled: boolean;
  liveStreamingEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: { ios: string; android: string };
  updatedAt: Date | null;
};

const DEFAULTS: PublicPlatformConfig = {
  uploadsEnabled: true,
  registrationEnabled: true,
  liveStreamingEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: "Jevah is briefly offline for maintenance. Back soon.",
  minAppVersion: { ios: "1.0.0", android: "1.0.0" },
  updatedAt: null,
};

function shape(doc: IPlatformConfig | null): PublicPlatformConfig {
  if (!doc) return { ...DEFAULTS };
  return {
    uploadsEnabled: doc.uploadsEnabled !== false,
    registrationEnabled: doc.registrationEnabled !== false,
    liveStreamingEnabled: doc.liveStreamingEnabled !== false,
    maintenanceMode: Boolean(doc.maintenanceMode),
    maintenanceMessage:
      doc.maintenanceMessage || DEFAULTS.maintenanceMessage,
    minAppVersion: {
      ios: doc.minAppVersion?.ios || "1.0.0",
      android: doc.minAppVersion?.android || "1.0.0",
    },
    updatedAt: doc.updatedAt || null,
  };
}

export async function getPlatformConfig(): Promise<PublicPlatformConfig> {
  const doc = await PlatformConfig.findOne().sort({ updatedAt: -1 }).lean();
  return shape(doc as IPlatformConfig | null);
}

export async function updatePlatformConfig(
  patch: Partial<{
    uploadsEnabled: boolean;
    registrationEnabled: boolean;
    liveStreamingEnabled: boolean;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    minAppVersion: { ios?: string; android?: string };
  }>,
  adminId?: string
): Promise<PublicPlatformConfig> {
  let doc = await PlatformConfig.findOne().sort({ updatedAt: -1 });
  if (!doc) {
    doc = new PlatformConfig({});
  }

  if (typeof patch.uploadsEnabled === "boolean") {
    doc.uploadsEnabled = patch.uploadsEnabled;
  }
  if (typeof patch.registrationEnabled === "boolean") {
    doc.registrationEnabled = patch.registrationEnabled;
  }
  if (typeof patch.liveStreamingEnabled === "boolean") {
    doc.liveStreamingEnabled = patch.liveStreamingEnabled;
  }
  if (typeof patch.maintenanceMode === "boolean") {
    doc.maintenanceMode = patch.maintenanceMode;
  }
  if (typeof patch.maintenanceMessage === "string") {
    doc.maintenanceMessage = patch.maintenanceMessage.slice(0, 500);
  }
  if (patch.minAppVersion && typeof patch.minAppVersion === "object") {
    if (typeof patch.minAppVersion.ios === "string") {
      doc.minAppVersion = doc.minAppVersion || ({} as any);
      doc.minAppVersion.ios = patch.minAppVersion.ios;
    }
    if (typeof patch.minAppVersion.android === "string") {
      doc.minAppVersion = doc.minAppVersion || ({} as any);
      doc.minAppVersion.android = patch.minAppVersion.android;
    }
  }
  if (adminId) {
    doc.updatedBy = adminId as any;
  }

  await doc.save();
  return shape(doc);
}
