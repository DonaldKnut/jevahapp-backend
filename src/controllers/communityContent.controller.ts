import { Request, Response } from "express";
import { PrayerPost } from "../models/prayerPost.model";
import { ForumThread } from "../models/forumThread.model";
import { Poll } from "../models/poll.model";
import { Group } from "../models/group.model";
import { User } from "../models/user.model";
import logger from "../utils/logger";

// ===== Prayer Wall =====
export const createPrayerPost = async (req: Request, res: Response): Promise<void> => {
  const { content, anonymous, media } = req.body || {};
  if (!content || typeof content !== "string") {
    res.status(400).json({ success: false, message: "Validation error: content is required" });
    return;
  }
  if (media && !Array.isArray(media)) {
    res.status(400).json({ success: false, message: "Validation error: media must be an array of strings" });
    return;
  }
  const doc = await PrayerPost.create({
    content,
    anonymous: Boolean(anonymous),
    media: Array.isArray(media) ? media : [],
    authorId: req.userId,
  });
  logger.info("Prayer post created", { postId: doc._id, authorId: req.userId });
  res.status(201).json({ success: true, post: serialize(doc) });
};

export const listPrayerPosts = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const sortParam = String(req.query.sort || "recent");
  const sort: any = sortParam === "recent" ? { createdAt: -1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    PrayerPost.find().populate("authorId", "firstName lastName avatar").sort(sort).skip((page - 1) * limit).limit(limit),
    PrayerPost.countDocuments(),
  ]);
  res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
};

export const getPrayerPost = async (req: Request, res: Response): Promise<void> => {
  const doc = await PrayerPost.findById(req.params.id).populate("authorId", "firstName lastName avatar");
  if (!doc) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  res.status(200).json({ success: true, post: serialize(doc) });
};

export const updatePrayerPost = async (req: Request, res: Response): Promise<void> => {
  const post = await PrayerPost.findById(req.params.id);
  if (!post) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(post.authorId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only author can edit" });
    return;
  }
  const { content, anonymous, media } = req.body || {};
  if (content !== undefined) post.content = content;
  if (anonymous !== undefined) post.anonymous = Boolean(anonymous);
  if (media !== undefined) {
    if (!Array.isArray(media)) {
      res.status(400).json({ success: false, message: "Validation error: media must be an array" });
      return;
    }
    post.media = media;
  }
  await post.save();
  logger.info("Prayer post updated", { postId: post._id, authorId: req.userId });
  res.status(200).json({ success: true, post: serialize(post) });
};

export const deletePrayerPost = async (req: Request, res: Response): Promise<void> => {
  const post = await PrayerPost.findById(req.params.id);
  if (!post) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(post.authorId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only author can delete" });
    return;
  }
  await PrayerPost.findByIdAndDelete(req.params.id);
  logger.info("Prayer post deleted", { postId: req.params.id, authorId: req.userId });
  res.status(200).json({ success: true, message: "Post deleted" });
};

// ===== Forum =====
export const createForumThread = async (req: Request, res: Response): Promise<void> => {
  const { title, body, tags } = req.body || {};
  if (!title || typeof title !== "string") {
    res.status(400).json({ success: false, message: "Validation error: title is required" });
    return;
  }
  if (!body || typeof body !== "string") {
    res.status(400).json({ success: false, message: "Validation error: body is required" });
    return;
  }
  if (tags && !Array.isArray(tags)) {
    res.status(400).json({ success: false, message: "Validation error: tags must be an array of strings" });
    return;
  }
  const doc = await ForumThread.create({
    title,
    body,
    tags: Array.isArray(tags) ? tags : [],
    authorId: req.userId,
  });
  logger.info("Forum thread created", { threadId: doc._id, authorId: req.userId });
  res.status(201).json({ success: true, thread: serialize(doc) });
};

export const listForumThreads = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const sortParam = String(req.query.sort || "recent");
  const sort: any = sortParam === "active" ? { updatedAt: -1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    ForumThread.find().populate("authorId", "firstName lastName avatar").sort(sort).skip((page - 1) * limit).limit(limit),
    ForumThread.countDocuments(),
  ]);
  res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
};

export const getForumThread = async (req: Request, res: Response): Promise<void> => {
  const doc = await ForumThread.findById(req.params.id).populate("authorId", "firstName lastName avatar");
  if (!doc) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  res.status(200).json({ success: true, thread: serialize(doc) });
};

export const updateForumThread = async (req: Request, res: Response): Promise<void> => {
  const thread = await ForumThread.findById(req.params.id);
  if (!thread) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(thread.authorId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only author can edit" });
    return;
  }
  const { title, body, tags } = req.body || {};
  if (title !== undefined) thread.title = title;
  if (body !== undefined) thread.body = body;
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      res.status(400).json({ success: false, message: "Validation error: tags must be an array" });
      return;
    }
    thread.tags = tags;
  }
  await thread.save();
  logger.info("Forum thread updated", { threadId: thread._id, authorId: req.userId });
  res.status(200).json({ success: true, thread: serialize(thread) });
};

export const deleteForumThread = async (req: Request, res: Response): Promise<void> => {
  const thread = await ForumThread.findById(req.params.id);
  if (!thread) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(thread.authorId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only author can delete" });
    return;
  }
  await ForumThread.findByIdAndDelete(req.params.id);
  logger.info("Forum thread deleted", { threadId: req.params.id, authorId: req.userId });
  res.status(200).json({ success: true, message: "Thread deleted" });
};

// ===== Polls =====
export const createPoll = async (req: Request, res: Response): Promise<void> => {
  const { question, options, multiSelect, closesAt } = req.body || {};
  if (!question || typeof question !== "string") {
    res.status(400).json({ success: false, message: "Validation error: question is required" });
    return;
  }
  if (!Array.isArray(options) || options.length < 2) {
    res.status(400).json({ success: false, message: "Validation error: options must be an array with at least 2 items" });
    return;
  }
  const doc = await Poll.create({
    question,
    options,
    multiSelect: Boolean(multiSelect),
    closesAt: closesAt ? new Date(closesAt) : undefined,
    authorId: req.userId,
    votes: [],
  });
  logger.info("Poll created", { pollId: doc._id, authorId: req.userId });
  res.status(201).json({ success: true, poll: serializePoll(doc, req.userId) });
};

export const listPolls = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const status = String(req.query.status || "all");
  const now = new Date();
  const query: any = {};
  if (status === "open") query.$or = [{ closesAt: { $gt: now } }, { closesAt: { $exists: false } }];
  if (status === "closed") query.closesAt = { $lte: now };
  const [items, total] = await Promise.all([
    Poll.find(query).populate("authorId", "firstName lastName avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Poll.countDocuments(query),
  ]);
  res.status(200).json({ success: true, items: items.map(poll => serializePoll(poll)), page, pageSize: items.length, total });
};

export const getPoll = async (req: Request, res: Response): Promise<void> => {
  const doc = await Poll.findById(req.params.id).populate("authorId", "firstName lastName avatar");
  if (!doc) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  res.status(200).json({ success: true, poll: serializePoll(doc, req.userId) });
};

export const getMyPolls = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  
  if (!req.userId) {
    res.status(401).json({ success: false, message: "Unauthorized: User not authenticated" });
    return;
  }

  const [items, total] = await Promise.all([
    Poll.find({ authorId: req.userId })
      .populate("authorId", "firstName lastName avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Poll.countDocuments({ authorId: req.userId }),
  ]);
  
  res.status(200).json({ 
    success: true, 
    items: items.map(poll => serializePoll(poll, req.userId)), 
    page, 
    pageSize: items.length, 
    total,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  });
};

export const voteOnPoll = async (req: Request, res: Response): Promise<void> => {
  const { optionIndex } = req.body || {};
  if (optionIndex === undefined) {
    res.status(400).json({ success: false, message: "Validation error: optionIndex is required" });
    return;
  }
  const poll = await Poll.findById(req.params.id);
  if (!poll) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  const optionIndexes = Array.isArray(optionIndex) ? optionIndex : [optionIndex];
  if (!poll.multiSelect && optionIndexes.length !== 1) {
    res.status(400).json({ success: false, message: "Validation error: multiSelect disabled; provide single optionIndex" });
    return;
  }
  // Remove previous vote by user, then add
  poll.votes = poll.votes.filter((v: any) => String(v.userId) !== String(req.userId));
  poll.votes.push({ userId: req.userId as any, optionIndexes, votedAt: new Date() });
  await poll.save();
  logger.info("Poll voted", { pollId: poll._id, userId: req.userId });
  res.status(200).json({ success: true, poll: serializePoll(poll, req.userId) });
};

// ===== Groups =====
export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const { name, description, visibility } = req.body || {};
  if (!name || typeof name !== "string") {
    res.status(400).json({ success: false, message: "Validation error: name is required" });
    return;
  }
  const doc = await Group.create({
    name,
    description: description || "",
    visibility: visibility || "public",
    ownerId: req.userId,
    members: [{ userId: req.userId as any, joinedAt: new Date() }],
  });
  logger.info("Group created", { groupId: doc._id, ownerId: req.userId });
  res.status(201).json({ success: true, group: serialize(doc) });
};

export const listGroups = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const mine = String(req.query.mine || "false") === "true";
  const query: any = mine && req.userId ? { "members.userId": req.userId } : { visibility: "public" };
  const [items, total] = await Promise.all([
    Group.find(query).populate("ownerId", "firstName lastName avatar").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Group.countDocuments(query),
  ]);
  res.status(200).json({ success: true, items: items.map(serialize), page, pageSize: items.length, total });
};

export const getGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id).populate("ownerId", "firstName lastName avatar");
  if (!group) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  const isMember = group.members.some((m: any) => String(m.userId) === String(req.userId));
  if (group.visibility === "private" && !isMember && String(group.ownerId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden" });
    return;
  }
  res.status(200).json({ success: true, group: serialize(group) });
};

export const joinGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  const already = group.members.some((m: any) => String(m.userId) === String(req.userId));
  if (!already) {
    group.members.push({ userId: req.userId as any, joinedAt: new Date() });
    await group.save();
    logger.info("Group joined", { groupId: group._id, userId: req.userId });
  }
  res.status(200).json({ success: true, membership: { groupId: group._id, userId: req.userId } });
};

export const leaveGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  group.members = group.members.filter((m: any) => String(m.userId) !== String(req.userId));
  await group.save();
  logger.info("Group left", { groupId: group._id, userId: req.userId });
  res.status(200).json({ success: true });
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(group.ownerId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only owner can edit" });
    return;
  }
  const { name, description, visibility } = req.body || {};
  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  if (visibility !== undefined) {
    if (!["public", "private"].includes(visibility)) {
      res.status(400).json({ success: false, message: "Validation error: visibility must be 'public' or 'private'" });
      return;
    }
    group.visibility = visibility;
  }
  await group.save();
  logger.info("Group updated", { groupId: group._id, ownerId: req.userId });
  res.status(200).json({ success: true, group: serialize(group) });
};

export const deleteGroupPermanently = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, message: "Not Found" });
    return;
  }
  if (String(group.ownerId) !== String(req.userId)) {
    res.status(403).json({ success: false, message: "Forbidden: Only owner can delete" });
    return;
  }
  await Group.findByIdAndDelete(req.params.id);
  logger.info("Group deleted", { groupId: req.params.id, ownerId: req.userId });
  res.status(200).json({ success: true, message: "Group deleted" });
};

export default {
  createPrayerPost,
  listPrayerPosts,
  getPrayerPost,
  updatePrayerPost,
  deletePrayerPost,
  createForumThread,
  listForumThreads,
  getForumThread,
  updateForumThread,
  deleteForumThread,
  createPoll,
  listPolls,
  getPoll,
  voteOnPoll,
  createGroup,
  listGroups,
  getGroup,
  joinGroup,
  leaveGroup,
  updateGroup,
  deleteGroupPermanently,
};

/**
 * Serialize Poll with enriched options (votesCount, percentage, _id)
 */
function serializePoll(doc: any, userId?: string) {
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Calculate votes per option
  const totalVotes = obj.votes.length;
  const optionsWithStats = obj.options.map((text: string, index: number) => {
    const votesCount = obj.votes.filter((v: any) => 
      v.optionIndexes && v.optionIndexes.includes(index)
    ).length;
    const percentage = totalVotes > 0 
      ? Math.round((votesCount / totalVotes) * 100) 
      : 0;

    return {
      _id: `${obj._id}_${index}`, // Generate option ID
      text,
      votesCount,
      percentage,
    };
  });

  // Check if user voted
  const userVote = userId ? obj.votes.find((v: any) => String(v.userId) === String(userId)) : null;
  const userVoted = !!userVote;

  // Determine if poll is active
  const now = new Date();
  const isActive = !obj.closesAt || new Date(obj.closesAt) > now;

  // Handle populated authorId
  let author = undefined;
  if (obj.authorId && typeof obj.authorId === "object" && obj.authorId._id) {
    author = {
      id: String(obj.authorId._id),
      firstName: obj.authorId.firstName,
      lastName: obj.authorId.lastName,
      avatar: obj.authorId.avatar,
    };
  } else if (obj.authorId) {
    author = {
      id: String(obj.authorId),
    };
  }

  return {
    _id: String(obj._id),
    id: String(obj._id),
    title: obj.question, // Use question as title for frontend compatibility
    question: obj.question,
    description: obj.description || undefined,
    options: optionsWithStats, // Return options as objects with stats
    multiSelect: obj.multiSelect || false,
    totalVotes,
    expiresAt: obj.closesAt || obj.expiresAt,
    closesAt: obj.closesAt || obj.expiresAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    isActive,
    userVoted,
    author,
  };
}

function serialize(doc: any) {
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.id = String(obj._id);
  delete obj._id;
  delete obj.__v;
  // Handle populated authorId
  if (obj.authorId && typeof obj.authorId === "object" && obj.authorId._id) {
    obj.author = {
      id: String(obj.authorId._id),
      firstName: obj.authorId.firstName,
      lastName: obj.authorId.lastName,
      avatar: obj.authorId.avatar,
    };
    delete obj.authorId;
  }
  // Handle populated ownerId
  if (obj.ownerId && typeof obj.ownerId === "object" && obj.ownerId._id) {
    obj.owner = {
      id: String(obj.ownerId._id),
      firstName: obj.ownerId.firstName,
      lastName: obj.ownerId.lastName,
      avatar: obj.ownerId.avatar,
    };
    delete obj.ownerId;
  }
  return obj;
}


