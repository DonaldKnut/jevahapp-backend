import { Request, Response } from "express";
import { PrayerPost } from "../models/prayerPost.model";
import { ForumThread } from "../models/forumThread.model";
import { Poll } from "../models/poll.model";
import { Group } from "../models/group.model";
import { User } from "../models/user.model";
import { MediaInteraction } from "../models/mediaInteraction.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";

// ===== Prayer Wall =====
export const createPrayerPost = async (req: Request, res: Response): Promise<void> => {
  const { content, prayerText, verse, color, shape, anonymous, media } = req.body || {};
  
  // Support both content and prayerText (prayerText is preferred)
  const prayerContent = prayerText || content;
  if (!prayerContent || typeof prayerContent !== "string" || prayerContent.trim().length === 0) {
    res.status(400).json({ success: false, message: "Validation error: prayerText/content is required" });
    return;
  }

  if (prayerContent.length > 2000) {
    res.status(400).json({ success: false, message: "Validation error: prayerText must be less than 2000 characters" });
    return;
  }

  // Validate verse if provided
  if (verse) {
    if (typeof verse !== "object" || !verse.text || !verse.reference) {
      res.status(400).json({ success: false, message: "Validation error: verse must have text and reference" });
      return;
    }
  }

  // Validate color if provided
  if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    res.status(400).json({ success: false, message: "Validation error: color must be a valid hex color code" });
    return;
  }

  // Validate shape if provided
  const validShapes = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
  if (shape && !validShapes.includes(shape)) {
    res.status(400).json({ success: false, message: `Validation error: shape must be one of: ${validShapes.join(", ")}` });
    return;
  }

  if (media && !Array.isArray(media)) {
    res.status(400).json({ success: false, message: "Validation error: media must be an array of strings" });
    return;
  }

  const doc = await PrayerPost.create({
    content: prayerContent.trim(),
    prayerText: prayerContent.trim(),
    verse: verse ? { text: verse.text.trim(), reference: verse.reference.trim() } : undefined,
    color: color || "#A16CE5",
    shape: shape || "square",
    anonymous: Boolean(anonymous),
    media: Array.isArray(media) ? media : [],
    authorId: req.userId,
    likesCount: 0,
    commentsCount: 0,
  });
  logger.info("Prayer post created", { postId: doc._id, authorId: req.userId });
  
  // Populate author and serialize
  await doc.populate("authorId", "firstName lastName username avatar");
  res.status(201).json({ success: true, data: serializePrayer(doc, req.userId) });
};

export const listPrayerPosts = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const sortBy = String(req.query.sortBy || "createdAt");
  const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
  
  // Build sort object
  const sort: any = {};
  if (sortBy === "likesCount") sort.likesCount = sortOrder;
  else if (sortBy === "commentsCount") sort.commentsCount = sortOrder;
  else sort.createdAt = sortOrder;

  const [items, total] = await Promise.all([
    PrayerPost.find().populate("authorId", "firstName lastName username avatar").sort(sort).skip((page - 1) * limit).limit(limit),
    PrayerPost.countDocuments(),
  ]);
  
  // Check user likes for each prayer
  const userId = req.userId;
  const prayers = await Promise.all(items.map(async (item) => {
    return await serializePrayer(item, userId);
  }));

  res.status(200).json({ 
    success: true, 
    data: {
      prayers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
};

export const getPrayerPost = async (req: Request, res: Response): Promise<void> => {
  const doc = await PrayerPost.findById(req.params.id).populate("authorId", "firstName lastName username avatar");
  if (!doc) {
    res.status(404).json({ success: false, error: "Prayer not found" });
    return;
  }
  res.status(200).json({ success: true, data: serializePrayer(doc, req.userId) });
};

export const updatePrayerPost = async (req: Request, res: Response): Promise<void> => {
  const post = await PrayerPost.findById(req.params.id);
  if (!post) {
    res.status(404).json({ success: false, error: "Prayer not found" });
    return;
  }
  if (String(post.authorId) !== String(req.userId)) {
    res.status(403).json({ success: false, error: "Forbidden: Only author can edit" });
    return;
  }
  
  const { content, prayerText, verse, color, shape, anonymous, media } = req.body || {};
  
  // Update content/prayerText
  if (prayerText !== undefined) {
    if (typeof prayerText !== "string" || prayerText.trim().length === 0) {
      res.status(400).json({ success: false, error: "Validation error: prayerText must be a non-empty string" });
      return;
    }
    post.content = prayerText.trim();
    post.prayerText = prayerText.trim();
  } else if (content !== undefined) {
    if (typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ success: false, error: "Validation error: content must be a non-empty string" });
      return;
    }
    post.content = content.trim();
    post.prayerText = content.trim();
  }

  // Update verse
  if (verse !== undefined) {
    if (verse === null) {
      post.verse = undefined;
    } else if (typeof verse === "object" && verse.text && verse.reference) {
      post.verse = { text: verse.text.trim(), reference: verse.reference.trim() };
    } else {
      res.status(400).json({ success: false, error: "Validation error: verse must have text and reference" });
      return;
    }
  }

  // Update color
  if (color !== undefined) {
    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      res.status(400).json({ success: false, error: "Validation error: color must be a valid hex color code" });
      return;
    }
    post.color = color;
  }

  // Update shape
  if (shape !== undefined) {
    const validShapes = ["rectangle", "circle", "scalloped", "square", "square2", "square3", "square4"];
    if (!validShapes.includes(shape)) {
      res.status(400).json({ success: false, error: `Validation error: shape must be one of: ${validShapes.join(", ")}` });
      return;
    }
    post.shape = shape;
  }

  if (anonymous !== undefined) post.anonymous = Boolean(anonymous);
  
  if (media !== undefined) {
    if (!Array.isArray(media)) {
      res.status(400).json({ success: false, error: "Validation error: media must be an array" });
      return;
    }
    post.media = media;
  }

  await post.save();
  await post.populate("authorId", "firstName lastName username avatar");
  logger.info("Prayer post updated", { postId: post._id, authorId: req.userId });
  res.status(200).json({ success: true, data: serializePrayer(post, req.userId) });
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
  // Check if user is admin
  const user = await User.findById(req.userId);
  if (!user || user.role !== "admin") {
    res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    return;
  }

  const { question, title, description, options, multiSelect, closesAt, expiresAt } = req.body || {};
  
  // Support both question and title
  const pollQuestion = title || question;
  if (!pollQuestion || typeof pollQuestion !== "string" || pollQuestion.trim().length < 5) {
    res.status(400).json({ success: false, error: "Validation error: title/question must be at least 5 characters" });
    return;
  }

  if (pollQuestion.length > 200) {
    res.status(400).json({ success: false, error: "Validation error: title/question must be less than 200 characters" });
    return;
  }

  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    res.status(400).json({ success: false, error: "Validation error: options must be an array with 2-10 items" });
    return;
  }

  // Validate each option
  for (const option of options) {
    if (typeof option !== "string" || option.trim().length === 0) {
      res.status(400).json({ success: false, error: "Validation error: each option must be a non-empty string" });
      return;
    }
    if (option.length > 200) {
      res.status(400).json({ success: false, error: "Validation error: each option must be less than 200 characters" });
      return;
    }
  }

  // Validate description if provided
  if (description !== undefined && description !== null && description.length > 500) {
    res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
    return;
  }

  // Validate expiry date if provided
  const expiryDate = expiresAt || closesAt;
  if (expiryDate) {
    const date = new Date(expiryDate);
    if (isNaN(date.getTime())) {
      res.status(400).json({ success: false, error: "Validation error: invalid date format" });
      return;
    }
    if (date <= new Date()) {
      res.status(400).json({ success: false, error: "Validation error: expiry date must be in the future" });
      return;
    }
  }

  const doc = await Poll.create({
    question: pollQuestion.trim(),
    title: pollQuestion.trim(),
    description: description ? description.trim() : undefined,
    options: options.map((opt: string) => opt.trim()),
    multiSelect: Boolean(multiSelect),
    closesAt: expiryDate ? new Date(expiryDate) : undefined,
    expiresAt: expiryDate ? new Date(expiryDate) : undefined,
    authorId: req.userId,
    votes: [],
  });
  
  await doc.populate("authorId", "firstName lastName username avatar");
  
  logger.info("Poll created", { pollId: doc._id, authorId: req.userId });
  
  // Import serializePoll from pollEnhancement
  const { serializePoll } = await import("./pollEnhancement.controller");
  res.status(201).json({ success: true, data: await serializePoll(doc, req.userId) });
};

export const listPolls = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const status = String(req.query.status || "active");
  const sortBy = String(req.query.sortBy || "createdAt");
  const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;
  
  const now = new Date();
  const query: any = {};
  
  if (status === "active") {
    query.$or = [{ closesAt: { $gt: now } }, { closesAt: { $exists: false } }, { expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }];
  } else if (status === "expired") {
    query.$or = [
      { closesAt: { $lte: now } },
      { expiresAt: { $lte: now } },
    ];
  }
  // "all" status doesn't filter

  // Build sort object
  const sort: any = {};
  if (sortBy === "totalVotes") {
    // Sort by vote count (requires aggregation or post-processing)
    sort.createdAt = sortOrder; // Default sort for now
  } else {
    sort.createdAt = sortOrder;
  }

  const [items, total] = await Promise.all([
    Poll.find(query)
      .populate("authorId", "firstName lastName username avatar")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Poll.countDocuments(query),
  ]);

  // Import serializePoll
  const { serializePoll } = await import("./pollEnhancement.controller");
  const polls = await Promise.all(items.map(async (item) => await serializePoll(item, req.userId)));

  res.status(200).json({ 
    success: true, 
    data: {
      polls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
};

export const getPoll = async (req: Request, res: Response): Promise<void> => {
  const doc = await Poll.findById(req.params.id).populate("authorId", "firstName lastName username avatar");
  if (!doc) {
    res.status(404).json({ success: false, error: "Poll not found" });
    return;
  }
  
  // Import serializePoll
  const { serializePoll } = await import("./pollEnhancement.controller");
  res.status(200).json({ success: true, data: await serializePoll(doc, req.userId) });
};

export const voteOnPoll = async (req: Request, res: Response): Promise<void> => {
  const { optionIndex, optionId } = req.body || {};
  
  // Support both optionIndex and optionId
  let optionIndexes: number[];
  if (optionId !== undefined) {
    // Extract index from optionId (format: pollId_index)
    const parts = String(optionId).split("_");
    if (parts.length < 2) {
      res.status(400).json({ success: false, error: "Validation error: invalid optionId format" });
      return;
    }
    const index = parseInt(parts[parts.length - 1], 10);
    if (isNaN(index)) {
      res.status(400).json({ success: false, error: "Validation error: invalid optionId" });
      return;
    }
    optionIndexes = [index];
  } else if (optionIndex !== undefined) {
    optionIndexes = Array.isArray(optionIndex) ? optionIndex : [optionIndex];
  } else {
    res.status(400).json({ success: false, error: "Validation error: optionIndex or optionId is required" });
    return;
  }

  const poll = await Poll.findById(req.params.id);
  if (!poll) {
    res.status(404).json({ success: false, error: "Poll not found" });
    return;
  }

  // Check if poll is active
  const now = new Date();
  if (poll.closesAt && new Date(poll.closesAt) <= now) {
    res.status(400).json({ success: false, error: "Poll has expired" });
    return;
  }

  // Validate option indices
  for (const idx of optionIndexes) {
    if (typeof idx !== "number" || idx < 0 || idx >= poll.options.length) {
      res.status(400).json({ success: false, error: `Validation error: invalid option index: ${idx}` });
      return;
    }
  }

  if (!poll.multiSelect && optionIndexes.length !== 1) {
    res.status(400).json({ success: false, error: "Validation error: multiSelect disabled; provide single option" });
    return;
  }

  // Remove previous vote by user, then add
  poll.votes = poll.votes.filter((v: any) => String(v.userId) !== String(req.userId));
  poll.votes.push({ userId: req.userId as any, optionIndexes, votedAt: new Date() });
  await poll.save();
  await poll.populate("authorId", "firstName lastName username avatar");
  
  logger.info("Poll voted", { pollId: poll._id, userId: req.userId });
  
  // Import serializePoll
  const { serializePoll } = await import("./pollEnhancement.controller");
  res.status(200).json({ success: true, data: await serializePoll(poll, req.userId) });
};

// ===== Groups =====
export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const { name, description, visibility, isPublic } = req.body || {};
  
  // Support both visibility and isPublic
  const groupVisibility = visibility || (isPublic === false ? "private" : "public");
  
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    res.status(400).json({ success: false, error: "Validation error: name must be at least 3 characters" });
    return;
  }

  if (name.length > 100) {
    res.status(400).json({ success: false, error: "Validation error: name must be less than 100 characters" });
    return;
  }

  if (description && description.length > 500) {
    res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
    return;
  }

  if (!["public", "private"].includes(groupVisibility)) {
    res.status(400).json({ success: false, error: "Validation error: visibility must be 'public' or 'private'" });
    return;
  }

  const doc = await Group.create({
    name: name.trim(),
    description: (description || "").trim(),
    visibility: groupVisibility,
    ownerId: req.userId,
    members: [{ userId: req.userId as any, role: "admin", joinedAt: new Date() }],
  });
  
  await doc.populate("ownerId", "firstName lastName username avatar");
  await doc.populate("members.userId", "firstName lastName username avatar");
  
  logger.info("Group created", { groupId: doc._id, ownerId: req.userId });
  res.status(201).json({ success: true, data: serializeGroup(doc, req.userId) });
};

export const listGroups = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page || 1), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const mine = String(req.query.mine || "false") === "true";
  const search = String(req.query.search || "").trim();
  const sortBy = String(req.query.sortBy || "membersCount");
  const sortOrder = String(req.query.sortOrder || "desc") === "asc" ? 1 : -1;

  // Build query
  let query: any = {};
  if (mine && req.userId) {
    query["members.userId"] = req.userId;
  } else {
    query.visibility = "public";
  }

  // Add search if provided
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Build sort object
  const sort: any = {};
  if (sortBy === "membersCount") {
    // Sort by member count (requires aggregation or post-processing)
    sort.createdAt = sortOrder; // Default sort for now
  } else if (sortBy === "name") {
    sort.name = sortOrder;
  } else {
    sort.createdAt = sortOrder;
  }

  const [items, total] = await Promise.all([
    Group.find(query)
      .populate("ownerId", "firstName lastName username avatar")
      .populate("members.userId", "firstName lastName username avatar")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Group.countDocuments(query),
  ]);

  const groups = items.map((item) => serializeGroup(item, req.userId));

  res.status(200).json({ 
    success: true, 
    data: {
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    },
  });
};

export const getGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id)
    .populate("ownerId", "firstName lastName username avatar")
    .populate("members.userId", "firstName lastName username avatar");
  
  if (!group) {
    res.status(404).json({ success: false, error: "Group not found" });
    return;
  }
  
  const isMember = group.members.some((m: any) => String(m.userId) === String(req.userId));
  if (group.visibility === "private" && !isMember && String(group.ownerId) !== String(req.userId)) {
    res.status(403).json({ success: false, error: "Forbidden: Private group access denied" });
    return;
  }
  
  res.status(200).json({ success: true, data: serializeGroup(group, req.userId) });
};

export const joinGroup = async (req: Request, res: Response): Promise<void> => {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, error: "Group not found" });
    return;
  }

  // Check if group is public
  if (group.visibility !== "public") {
    res.status(403).json({ success: false, error: "Forbidden: Cannot join private group directly" });
    return;
  }

  const already = group.members.some((m: any) => String(m.userId) === String(req.userId));
  if (!already) {
    group.members.push({ userId: req.userId as any, role: "member", joinedAt: new Date() });
    await group.save();
    logger.info("Group joined", { groupId: group._id, userId: req.userId });
  }
  
  res.status(200).json({ 
    success: true, 
    data: {
      _id: group._id,
      userId: req.userId,
      groupId: String(group._id),
      role: "member",
      joinedAt: new Date(),
    },
  });
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
    res.status(404).json({ success: false, error: "Group not found" });
    return;
  }

  // Check if user is owner or admin
  const isOwner = String(group.ownerId) === String(req.userId);
  const userMember = group.members.find((m: any) => String(m.userId) === String(req.userId));
  const isAdmin = userMember?.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403).json({ success: false, error: "Forbidden: Only group admins can edit" });
    return;
  }

  const { name, description, visibility, isPublic } = req.body || {};
  
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 3) {
      res.status(400).json({ success: false, error: "Validation error: name must be at least 3 characters" });
      return;
    }
    if (name.length > 100) {
      res.status(400).json({ success: false, error: "Validation error: name must be less than 100 characters" });
      return;
    }
    group.name = name.trim();
  }

  if (description !== undefined) {
    if (description !== null && (typeof description !== "string" || description.length > 500)) {
      res.status(400).json({ success: false, error: "Validation error: description must be less than 500 characters" });
      return;
    }
    group.description = description === null ? "" : (description || "").trim();
  }

  // Support both visibility and isPublic
  const visibilityValue = visibility || (isPublic !== undefined ? (isPublic ? "public" : "private") : undefined);
  if (visibilityValue !== undefined) {
    if (!["public", "private"].includes(visibilityValue)) {
      res.status(400).json({ success: false, error: "Validation error: visibility must be 'public' or 'private'" });
      return;
    }
    group.visibility = visibilityValue;
  }

  await group.save();
  await group.populate("ownerId", "firstName lastName username avatar");
  await group.populate("members.userId", "firstName lastName username avatar");
  
  logger.info("Group updated", { groupId: group._id, userId: req.userId });
  res.status(200).json({ success: true, data: serializeGroup(group, req.userId) });
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
 * Serialize prayer post with user interaction data
 */
async function serializePrayer(doc: any, userId?: string) {
  const obj = doc.toObject ? doc.toObject() : doc;
  
  // Check if user liked this prayer
  let userLiked = false;
  if (userId && Types.ObjectId.isValid(userId)) {
    const like = await MediaInteraction.findOne({
      user: userId,
      media: obj._id,
      interactionType: "like",
    });
    userLiked = !!like;
  }

  return {
    _id: String(obj._id),
    userId: String(obj.authorId?._id || obj.authorId),
    prayerText: obj.prayerText || obj.content,
    content: obj.content || obj.prayerText,
    verse: obj.verse || undefined,
    color: obj.color || "#A16CE5",
    shape: obj.shape || "square",
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    likesCount: obj.likesCount || 0,
    commentsCount: obj.commentsCount || 0,
    userLiked,
    author: obj.authorId && typeof obj.authorId === "object" && obj.authorId._id
      ? {
          _id: String(obj.authorId._id),
          username: obj.authorId.username,
          firstName: obj.authorId.firstName,
          lastName: obj.authorId.lastName,
          avatarUrl: obj.authorId.avatar,
        }
      : obj.authorId
        ? { _id: String(obj.authorId) }
        : null,
    anonymous: obj.anonymous || false,
    media: obj.media || [],
  };
}

/**
 * Serialize Group with enhanced format
 */
function serializeGroup(doc: any, userId?: string) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const isMember = userId && obj.members.some((m: any) => String(m.userId) === String(userId));
  const userMember = userId ? obj.members.find((m: any) => String(m.userId) === String(userId)) : null;

  return {
    _id: String(obj._id),
    name: obj.name,
    description: obj.description || "",
    profileImageUrl: obj.profileImageUrl || undefined,
    createdBy: String(obj.ownerId?._id || obj.ownerId),
    isPublic: obj.visibility === "public",
    visibility: obj.visibility,
    membersCount: obj.members?.length || 0,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    members: obj.members?.map((m: any) => ({
      _id: String(m._id || m.userId),
      userId: String(m.userId?._id || m.userId),
      role: m.role || (String(m.userId) === String(obj.ownerId) ? "admin" : "member"),
      joinedAt: m.joinedAt,
      user: m.userId && typeof m.userId === "object" && m.userId._id
        ? {
            _id: String(m.userId._id),
            username: m.userId.username,
            firstName: m.userId.firstName,
            lastName: m.userId.lastName,
            avatarUrl: m.userId.avatar,
          }
        : null,
    })) || [],
    creator: obj.ownerId && typeof obj.ownerId === "object" && obj.ownerId._id
      ? {
          _id: String(obj.ownerId._id),
          username: obj.ownerId.username,
          avatarUrl: obj.ownerId.avatar,
        }
      : null,
    isMember: !!isMember,
    userRole: userMember?.role || (isMember ? "member" : undefined),
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


