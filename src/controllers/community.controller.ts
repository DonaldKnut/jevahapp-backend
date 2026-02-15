import { Request, Response } from "express";

export const getCommunityModules = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const modules = [
      {
        id: "prayer-wall",
        title: "Prayer Wall",
        description: "Share and receive prayers",
        icon: "prayer",
        enabled: true,
      },
      {
        id: "forum",
        title: "Forum",
        description: "Community discussions",
        icon: "forum",
        enabled: true,
      },
      {
        id: "polls",
        title: "Polls",
        description: "Community polls and surveys",
        icon: "polls",
        enabled: true,
      },
      {
        id: "groups",
        title: "Groups",
        description: "Join or create groups",
        icon: "groups",
        enabled: true,
      },
    ];
    res.status(200).json({ success: true, modules });
  } catch (error) {
    console.error("Get community modules error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve community modules",
    });
  }
};

