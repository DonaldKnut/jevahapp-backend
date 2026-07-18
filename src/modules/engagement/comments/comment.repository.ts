import { Types, ClientSession } from "mongoose";
import { Interaction } from "../../../models/interaction.model";

const COMMENT_FILTER = {
  interactionType: "comment" as const,
  isRemoved: { $ne: true },
  isHidden: { $ne: true },
};

export const commentRepository = {
  async create(
    data: {
      user: Types.ObjectId;
      media: Types.ObjectId;
      content: string;
      parentCommentId?: Types.ObjectId;
    },
    session: ClientSession
  ) {
    const [doc] = await Interaction.create(
      [{ ...data, interactionType: "comment" }],
      { session }
    );
    return doc;
  },

  findById(id: string) {
    return Interaction.findById(id);
  },

  findByIdLean(id: string) {
    return Interaction.findById(id).lean();
  },

  findComment(id: string) {
    return Interaction.findOne({
      _id: id,
      interactionType: "comment",
      isRemoved: { $ne: true },
    });
  },

  findTopLevel(contentId: string, skip: number, limit: number, sort: string) {
    return Interaction.find({
      media: new Types.ObjectId(contentId),
      ...COMMENT_FILTER,
      parentCommentId: { $exists: false },
    })
      .populate("user", "firstName lastName avatar")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  },

  async findTopByScore(contentId: string, skip: number, limit: number) {
    const pipeline: any[] = [
      {
        $match: {
          media: new Types.ObjectId(contentId),
          ...COMMENT_FILTER,
          parentCommentId: { $exists: false },
        },
      },
      {
        $addFields: {
          reactionTotal: {
            $sum: {
              $map: {
                input: { $objectToArray: { $ifNull: ["$reactions", {}] } },
                as: "r",
                in: { $size: "$$r.v" },
              },
            },
          },
          score: { $add: ["$replyCount", "$reactionTotal"] },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];
    const rows = await Interaction.aggregate(pipeline);
    if (!rows.length) return [];
    const ids = rows.map((r: { _id: Types.ObjectId }) => r._id);
    const docs = await Interaction.find({ _id: { $in: ids } })
      .populate("user", "firstName lastName avatar")
      .lean();
    const map = new Map(docs.map((d: any) => [d._id.toString(), d]));
    return rows.map((r: { _id: Types.ObjectId }) => map.get(r._id.toString())).filter(Boolean);
  },

  findReplies(parentId: Types.ObjectId, limit = 50) {
    return Interaction.find({
      parentCommentId: parentId,
      ...COMMENT_FILTER,
    })
      .populate("user", "firstName lastName avatar")
      .sort("createdAt")
      .limit(limit)
      .lean();
  },

  findRepliesPaginated(parentId: string, skip: number, limit: number) {
    const parentObjId = new Types.ObjectId(parentId);
    return Promise.all([
      Interaction.find({
        parentCommentId: parentObjId,
        ...COMMENT_FILTER,
      })
        .populate("user", "firstName lastName avatar")
        .sort("createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      Interaction.countDocuments({ parentCommentId: parentObjId, ...COMMENT_FILTER }),
    ]);
  },

  countForContent(contentId: string) {
    const media = new Types.ObjectId(contentId);
    return Promise.all([
      Interaction.countDocuments({
        media,
        ...COMMENT_FILTER,
        parentCommentId: { $exists: false },
      }),
      Interaction.countDocuments({
        media,
        ...COMMENT_FILTER,
        parentCommentId: { $exists: true },
      }),
    ]);
  },

  softDelete(id: string) {
    return Interaction.findByIdAndUpdate(id, {
      isRemoved: true,
      content: "[Comment removed]",
    });
  },

  hide(id: string, moderatorId: string, reason?: string) {
    return Interaction.findByIdAndUpdate(
      id,
      {
        isHidden: true,
        hiddenBy: new Types.ObjectId(moderatorId),
        hiddenReason: reason?.slice(0, 500),
      },
      { new: true }
    ).select("_id");
  },

  unhide(id: string) {
    return Interaction.findByIdAndUpdate(
      id,
      {
        $set: { isHidden: false },
        $unset: { hiddenBy: 1, hiddenReason: 1 },
      },
      { new: true }
    ).select("_id isHidden");
  },

  dismissReports(id: string) {
    return Interaction.findByIdAndUpdate(
      id,
      {
        $set: { reportCount: 0, reportedBy: [] },
      },
      { new: true }
    ).select("_id reportCount");
  },

  async listReported(options: {
    skip: number;
    limit: number;
    hidden?: boolean;
    minReports?: number;
  }) {
    const filter: Record<string, unknown> = {
      interactionType: "comment",
      isRemoved: { $ne: true },
      reportCount: { $gte: options.minReports ?? 1 },
    };
    if (options.hidden === true) {
      filter.isHidden = true;
    } else if (options.hidden === false) {
      filter.isHidden = { $ne: true };
    }

    const [comments, total] = await Promise.all([
      Interaction.find(filter)
        .populate("user", "firstName lastName username email avatar")
        .populate("media", "title contentType thumbnailUrl uploadedBy")
        .populate("hiddenBy", "firstName lastName username")
        .sort({ reportCount: -1, updatedAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean(),
      Interaction.countDocuments(filter),
    ]);

    return { comments, total };
  },

  incrementReplyCount(parentId: Types.ObjectId, session: ClientSession) {
    return Interaction.findByIdAndUpdate(
      parentId,
      { $inc: { replyCount: 1 } },
      { session }
    );
  },

  decrementReplyCount(parentId: Types.ObjectId) {
    return Interaction.findByIdAndUpdate(parentId, { $inc: { replyCount: -1 } });
  },

  report(id: string, userId: string) {
    return Interaction.findByIdAndUpdate(
      id,
      {
        $inc: { reportCount: 1 },
        $addToSet: { reportedBy: new Types.ObjectId(userId) },
      },
      { new: true }
    );
  },

  updateContent(id: string, content: string) {
    return Interaction.findByIdAndUpdate(id, { content });
  },

  save(doc: InstanceType<typeof Interaction>) {
    return doc.save();
  },
};
