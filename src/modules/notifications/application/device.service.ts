import { Expo } from "expo-server-sdk";
import { PushDevice, PushDevicePlatform } from "../models/pushDevice.model";
import { User } from "../../../models/user.model";
import logger from "../../../utils/logger";

export interface RegisterDeviceInput {
  userId: string;
  expoToken: string;
  installationId?: string;
  platform?: PushDevicePlatform;
  projectId?: string;
}

/**
 * Upsert PushDevice and keep User.pushNotifications.deviceTokens in sync
 * for backward-compatible send paths.
 */
export async function registerDevice(
  input: RegisterDeviceInput
): Promise<boolean> {
  const { userId, expoToken, installationId, platform, projectId } = input;

  if (!Expo.isExpoPushToken(expoToken)) {
    logger.error("Invalid Expo push token format", {
      token: String(expoToken || "").substring(0, 20),
    });
    return false;
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.error("User not found for device registration", { userId });
    return false;
  }

  await PushDevice.findOneAndUpdate(
    { expoToken },
    {
      $set: {
        userId,
        expoToken,
        status: "active",
        lastSeenAt: new Date(),
        ...(installationId !== undefined ? { installationId } : {}),
        ...(platform !== undefined ? { platform } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
      },
      $unset: { lastError: 1 },
    },
    { upsert: true, new: true }
  );

  if (!user.pushNotifications) {
    user.pushNotifications = {
      enabled: true,
      deviceTokens: [],
      preferences: {},
    };
  }
  user.pushNotifications.deviceTokens =
    user.pushNotifications.deviceTokens || [];
  if (!user.pushNotifications.deviceTokens.includes(expoToken)) {
    user.pushNotifications.deviceTokens.push(expoToken);
  }
  await user.save();

  logger.info("Push device registered", {
    userId,
    token: expoToken.substring(0, 20) + "...",
    platform,
  });
  return true;
}

/** Alias for registerDevice (upsert semantics). */
export async function upsertDevice(
  input: RegisterDeviceInput
): Promise<boolean> {
  return registerDevice(input);
}

/**
 * Mark device disabled and remove token from User.deviceTokens.
 */
export async function unregisterDevice(
  userId: string,
  expoToken: string
): Promise<boolean> {
  const user = await User.findById(userId);
  if (!user) return false;

  await PushDevice.updateOne(
    { expoToken, userId },
    {
      $set: {
        status: "disabled",
        lastSeenAt: new Date(),
      },
    }
  );

  if (user.pushNotifications?.deviceTokens?.length) {
    user.pushNotifications.deviceTokens =
      user.pushNotifications.deviceTokens.filter((t: string) => t !== expoToken);
    await user.save();
  }

  logger.info("Push device unregistered", {
    userId,
    token: expoToken.substring(0, 20) + "...",
  });
  return true;
}
