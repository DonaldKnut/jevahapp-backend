import { Request, Response } from "express";
import { Types } from "mongoose";
import { Media } from "../../models/media.model";
import contaboStreamingService from "../../service/contaboStreaming.service";
import liveRecordingService from "../../service/liveRecording.service";

export const startMuxLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description, category, topics } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const stream = await contaboStreamingService.startLiveStream({
      title,
      description,
      category,
      topics: Array.isArray(topics)
        ? topics
        : typeof topics === "string"
          ? topics.split(",").map(t => t.trim())
          : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Live stream started successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
      },
    });
  } catch (error: any) {
    console.error("Contabo live stream creation error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start live stream",
    });
  }
};

export const endMuxLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { id } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!Types.ObjectId.isValid(id)) {
      response.status(400).json({
        success: false,
        message: "Invalid media identifier",
      });
      return;
    }

    const stream = await Media.findById(id);

    if (!stream || !stream.isLive) {
      response.status(404).json({
        success: false,
        message: "Live stream not found",
      });
      return;
    }

    if (
      stream.uploadedBy.toString() !== userIdentifier &&
      request.userRole !== "admin"
    ) {
      response.status(403).json({
        success: false,
        message: "Unauthorized to end this live stream",
      });
      return;
    }

    await contaboStreamingService.endLiveStream(
      stream.streamId!,
      userIdentifier
    );

    response.status(200).json({
      success: true,
      message: "Live stream ended successfully",
    });
  } catch (error: any) {
    console.error("End live stream error:", error);
    response
      .status(error.message === "Live stream not found" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Failed to end live stream",
      });
  }
};

export const getLiveStreams = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const streams = await contaboStreamingService.getActiveStreams();

    response.status(200).json({
      success: true,
      streams,
    });
  } catch (error: any) {
    console.error("Get live streams error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to retrieve live streams",
    });
  }
};

// New Contabo-specific endpoints

export const getStreamStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const status = await contaboStreamingService.getStreamStatus(streamId);

    response.status(200).json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error("Get stream status error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get stream status",
    });
  }
};

export const scheduleLiveStream = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const {
      title,
      description,
      category,
      topics,
      scheduledStart,
      scheduledEnd,
    } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!scheduledStart) {
      response.status(400).json({
        success: false,
        message: "Scheduled start time is required",
      });
      return;
    }

    const stream = await contaboStreamingService.scheduleLiveStream({
      title,
      description,
      category,
      topics: Array.isArray(topics)
        ? topics
        : typeof topics === "string"
          ? topics.split(",").map(t => t.trim())
          : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
    });

    response.status(201).json({
      success: true,
      message: "Live stream scheduled successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
        scheduledStart,
        scheduledEnd,
      },
    });
  } catch (error: any) {
    console.error("Schedule live stream error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to schedule live stream",
    });
  }
};

export const getStreamStats = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const stats = await contaboStreamingService.getStreamStats(streamId);

    response.status(200).json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("Get stream stats error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get stream statistics",
    });
  }
};

/**
 * Start recording a live stream
 */
export const startRecording = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId, streamKey, title, description, category, topics } =
      request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!streamId || !streamKey || !title) {
      response.status(400).json({
        success: false,
        message: "Stream ID, stream key, and title are required",
      });
      return;
    }

    const recording = await liveRecordingService.startRecording({
      streamId,
      streamKey,
      title,
      description,
      category,
      topics: topics ? JSON.parse(topics) : [],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Recording started successfully",
      recording,
    });
  } catch (error: any) {
    console.error("Start recording error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start recording",
    });
  }
};

/**
 * Stop recording a live stream
 */
export const stopRecording = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const recording = await liveRecordingService.stopRecording(
      streamId,
      userIdentifier
    );

    response.status(200).json({
      success: true,
      message: "Recording stopped successfully",
      recording,
    });
  } catch (error: any) {
    console.error("Stop recording error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to stop recording",
    });
  }
};

/**
 * Get recording status
 */
export const getRecordingStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { streamId } = request.params;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const status = await liveRecordingService.getRecordingStatus(streamId);

    response.status(200).json({
      success: true,
      status,
    });
  } catch (error: any) {
    console.error("Get recording status error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get recording status",
    });
  }
};

/**
 * Get user's recordings
 */
export const getUserRecordings = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    const recordings =
      await liveRecordingService.getUserRecordings(userIdentifier);

    response.status(200).json({
      success: true,
      recordings,
    });
  } catch (error: any) {
    console.error("Get user recordings error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to get user recordings",
    });
  }
};

export const goLive = async (
  request: Request,
  response: Response
): Promise<void> => {
  try {
    const { title, description } = request.body;
    const userIdentifier = request.userId;

    if (!userIdentifier) {
      response.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
      return;
    }

    if (!title || title.trim() === "") {
      response.status(400).json({
        success: false,
        message: "Title is required for live stream",
      });
      return;
    }

    // Start live stream immediately with minimal info
    const stream = await contaboStreamingService.startLiveStream({
      title: title.trim(),
      description: description?.trim() || "Live stream",
      category: "live",
      topics: ["live-stream"],
      uploadedBy: new Types.ObjectId(userIdentifier),
    });

    response.status(201).json({
      success: true,
      message: "Live stream started successfully",
      stream: {
        streamKey: stream.streamKey,
        rtmpUrl: stream.rtmpUrl,
        playbackUrl: stream.playbackUrl,
        hlsUrl: stream.hlsUrl,
        dashUrl: stream.dashUrl,
        streamId: stream.streamId,
      },
    });
  } catch (error: any) {
    console.error("Go live stream creation error:", error);
    response.status(500).json({
      success: false,
      message: "Failed to start live stream",
    });
  }
};
