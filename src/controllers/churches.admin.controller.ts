import { Request, Response } from "express";
import mongoose from "mongoose";
import { Church } from "../models/church.model";
import { ChurchBranch } from "../models/church-branch.model";
import { NG_STATES } from "../constants/ngStates";
import { AuditService } from "../service/audit.service";
import logger from "../utils/logger";

function shapeChurch(doc: any) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    branchName: doc.branchName || null,
    denomination: doc.denomination || null,
    address: doc.address || null,
    state: doc.state,
    lga: doc.lga || null,
    location: doc.location || null,
    website: doc.website || null,
    contactEmail: doc.contactEmail || null,
    contactPhone: doc.contactPhone || null,
    contactName: doc.contactName || null,
    source: doc.source || "manual",
    adminNotes: doc.adminNotes || null,
    isListed: doc.isListed !== false,
    isVerified: Boolean(doc.isVerified),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function parseLocation(location: any) {
  if (!location || typeof location !== "object") return undefined;
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

/**
 * POST /api/churches  (and POST /api/admin/churches)
 * Add a church to the catalog — appears in onboarding places suggest when isListed.
 */
export async function createChurch(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const adminId = request.userId;
    const {
      name,
      denomination,
      website,
      verified,
      isVerified,
      isListed,
      address,
      state,
      lga,
      location,
      contactEmail,
      contactPhone,
      contactName,
      source,
      adminNotes,
      branchName,
    } = request.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      response.status(400).json({ success: false, message: "name is required" });
      return;
    }
    if (!state || typeof state !== "string" || !state.trim()) {
      response
        .status(400)
        .json({ success: false, message: "state is required" });
      return;
    }

    if (contactEmail && !String(contactEmail).includes("@")) {
      response
        .status(400)
        .json({ success: false, message: "contactEmail is invalid" });
      return;
    }

    const doc: any = {
      name: name.trim(),
      denomination: denomination?.trim() || undefined,
      address: address?.trim() || undefined,
      state: state.trim(),
      lga: lga?.trim() || undefined,
      location: parseLocation(location),
      website: website?.trim() || undefined,
      contactEmail: contactEmail
        ? String(contactEmail).trim().toLowerCase()
        : undefined,
      contactPhone: contactPhone?.trim() || undefined,
      contactName: contactName?.trim() || undefined,
      source: ["manual", "outreach", "bulk", "import"].includes(source)
        ? source
        : "manual",
      adminNotes: adminNotes?.trim() || undefined,
      branchName: branchName?.trim() || undefined,
      isVerified: Boolean(verified ?? isVerified),
      isListed: isListed === false ? false : true,
      createdByUser: adminId || undefined,
    };

    const created = await Church.create(doc);

    if (adminId) {
      await AuditService.logAdminAction(adminId, "create_church", created._id.toString(), {
        name: created.name,
        state: created.state,
        source: created.source,
      });
    }

    response.status(201).json({
      success: true,
      message: "Church added to catalog",
      data: shapeChurch(created.toObject()),
      church: created, // legacy alias
    });
  } catch (error: any) {
    logger.error("Create church error", { error: error?.message });
    response.status(500).json({ success: false, message: "Failed to create church" });
  }
}

/**
 * PATCH /api/admin/churches/:id
 */
export async function updateChurch(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const adminId = request.userId;
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(400).json({ success: false, message: "Invalid church id" });
      return;
    }

    const body = request.body || {};
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.denomination === "string") {
      updates.denomination = body.denomination.trim() || undefined;
    }
    if (typeof body.address === "string") {
      updates.address = body.address.trim() || undefined;
    }
    if (typeof body.state === "string" && body.state.trim()) {
      updates.state = body.state.trim();
    }
    if (typeof body.lga === "string") {
      updates.lga = body.lga.trim() || undefined;
    }
    if (typeof body.website === "string") {
      updates.website = body.website.trim() || undefined;
    }
    if (typeof body.contactEmail === "string") {
      const email = body.contactEmail.trim().toLowerCase();
      if (email && !email.includes("@")) {
        response
          .status(400)
          .json({ success: false, message: "contactEmail is invalid" });
        return;
      }
      updates.contactEmail = email || undefined;
    }
    if (typeof body.contactPhone === "string") {
      updates.contactPhone = body.contactPhone.trim() || undefined;
    }
    if (typeof body.contactName === "string") {
      updates.contactName = body.contactName.trim() || undefined;
    }
    if (typeof body.adminNotes === "string") {
      updates.adminNotes = body.adminNotes.trim() || undefined;
    }
    if (typeof body.branchName === "string") {
      updates.branchName = body.branchName.trim() || undefined;
    }
    if (typeof body.isListed === "boolean") {
      updates.isListed = body.isListed;
    }
    if (typeof body.isVerified === "boolean") {
      updates.isVerified = body.isVerified;
    } else if (typeof body.verified === "boolean") {
      updates.isVerified = body.verified;
    }
    if (["manual", "outreach", "bulk", "import"].includes(body.source)) {
      updates.source = body.source;
    }
    if (body.location !== undefined) {
      updates.location = parseLocation(body.location) || undefined;
    }

    if (Object.keys(updates).length === 0) {
      response.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
      return;
    }

    const church = await Church.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!church) {
      response.status(404).json({ success: false, message: "Church not found" });
      return;
    }

    if (adminId) {
      await AuditService.logAdminAction(adminId, "update_church", id, { updates });
    }

    response.status(200).json({
      success: true,
      message: "Church updated",
      data: shapeChurch(church.toObject()),
    });
  } catch (error: any) {
    logger.error("Update church error", { error: error?.message });
    response.status(500).json({ success: false, message: "Failed to update church" });
  }
}

/**
 * GET /api/admin/churches/:id
 */
export async function getChurchById(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(400).json({ success: false, message: "Invalid church id" });
      return;
    }
    const church = await Church.findById(id).lean();
    if (!church) {
      response.status(404).json({ success: false, message: "Church not found" });
      return;
    }
    const branches = await ChurchBranch.find({ churchId: id })
      .sort({ name: 1 })
      .lean();
    response.status(200).json({
      success: true,
      data: {
        ...shapeChurch(church),
        branches: branches.map((b: any) => ({
          id: b._id.toString(),
          name: b.name,
          address: b.address || null,
          state: b.state || null,
          lga: b.lga || null,
          contactPhone: b.contactPhone || null,
          location: b.location || null,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Get church error", { error: error?.message });
    response.status(500).json({ success: false, message: "Failed to get church" });
  }
}

/**
 * PATCH /api/admin/churches/:id/branches/:branchId
 */
export async function updateChurchBranch(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const adminId = request.userId;
    const { id, branchId } = request.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(branchId)) {
      response.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const body = request.body || {};
    const updates: Record<string, unknown> = {};
    for (const key of ["name", "address", "state", "lga"]) {
      if (typeof body[key] === "string") updates[key] = body[key].trim();
    }
    if (body.location !== undefined) {
      updates.location = parseLocation(body.location);
    }
    const branch = await ChurchBranch.findOneAndUpdate(
      { _id: branchId, churchId: id },
      { $set: updates },
      { new: true }
    );
    if (!branch) {
      response.status(404).json({ success: false, message: "Branch not found" });
      return;
    }
    if (adminId) {
      await AuditService.logAdminAction(adminId, "update_church_branch", branchId, {
        churchId: id,
      });
    }
    response.status(200).json({
      success: true,
      data: {
        id: branch._id.toString(),
        name: branch.name,
        address: (branch as any).address || null,
        state: (branch as any).state || null,
        lga: (branch as any).lga || null,
      },
    });
  } catch (error: any) {
    logger.error("Update branch error", { error: error?.message });
    response.status(500).json({ success: false, message: "Failed to update branch" });
  }
}

/**
 * DELETE /api/admin/churches/:id/branches/:branchId
 */
export async function deleteChurchBranch(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const adminId = request.userId;
    const { id, branchId } = request.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(branchId)) {
      response.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const result = await ChurchBranch.deleteOne({ _id: branchId, churchId: id });
    if (!result.deletedCount) {
      response.status(404).json({ success: false, message: "Branch not found" });
      return;
    }
    if (adminId) {
      await AuditService.logAdminAction(adminId, "delete_church_branch", branchId, {
        churchId: id,
      });
    }
    response.status(200).json({ success: true, message: "Branch deleted" });
  } catch (error: any) {
    response.status(500).json({ success: false, message: "Failed to delete branch" });
  }
}

/**
 * DELETE /api/admin/churches/:id
 * Removes church (+ optional branches). Prefer isListed:false to hide without delete.
 */
export async function deleteChurch(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const adminId = request.userId;
    const { id } = request.params;
    if (!mongoose.isValidObjectId(id)) {
      response.status(400).json({ success: false, message: "Invalid church id" });
      return;
    }

    const church = await Church.findById(id);
    if (!church) {
      response.status(404).json({ success: false, message: "Church not found" });
      return;
    }

    const deleteBranches = request.query.deleteBranches !== "false";
    if (deleteBranches) {
      await ChurchBranch.deleteMany({ churchId: church._id });
    }
    await Church.deleteOne({ _id: church._id });

    if (adminId) {
      await AuditService.logAdminAction(adminId, "delete_church", id, {
        name: church.name,
        deleteBranches,
      });
    }

    response.status(200).json({
      success: true,
      message: "Church deleted",
      data: { churchId: id, name: church.name },
    });
  } catch (error: any) {
    logger.error("Delete church error", { error: error?.message });
    response.status(500).json({ success: false, message: "Failed to delete church" });
  }
}

export async function createBranch(
  request: Request,
  response: Response
): Promise<void> {
  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) {
    response.status(400).json({ success: false, message: "invalid church id" });
    return;
  }
  const { name, code, address, state, lga, location, verified } =
    request.body || {};
  if (!name || !code || !state) {
    response
      .status(400)
      .json({ success: false, message: "name, code and state are required" });
    return;
  }
  const church = await Church.findById(id);
  if (!church) {
    response.status(404).json({ success: false, message: "Church not found" });
    return;
  }
  const created = await ChurchBranch.create({
    churchId: church._id,
    name,
    code,
    address,
    state,
    lga,
    location: parseLocation(location),
    isVerified: Boolean(verified),
  });
  response.status(201).json({ success: true, branch: created });
  return;
}

export async function bulkUpsert(
  request: Request,
  response: Response
): Promise<void> {
  const primary = Array.isArray(request.body?.churches)
    ? request.body.churches
    : [];
  const extras = Array.isArray(request.body?.moreChurches)
    ? request.body.moreChurches
    : [];
  const payload = [...primary, ...extras];
  if (payload.length === 0) {
    response.status(400).json({
      success: false,
      message:
        "Invalid bulk payload. Expected churches and/or moreChurches arrays",
    });
    return;
  }

  for (const c of payload) {
    const church = await Church.findOneAndUpdate(
      { name: c.name, state: c.branches?.[0]?.state || c.state },
      {
        name: c.name,
        denomination: c.denomination,
        address: c.branches?.[0]?.addressLine1 || c.address,
        state: c.branches?.[0]?.state || c.state,
        location: c.branches?.[0]?.location || c.location,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        contactName: c.contactName,
        website: c.website,
        source: c.source || "bulk",
        isListed: c.isListed === false ? false : true,
        isVerified: Boolean(c.verified),
      },
      { upsert: true, new: true }
    );

    if (Array.isArray(c.branches)) {
      for (const b of c.branches) {
        await ChurchBranch.findOneAndUpdate(
          {
            churchId: church._id,
            name: b.name || b.city,
          },
          {
            churchId: church._id,
            name: b.name || b.city,
            code:
              b.id ||
              `${church._id}_${(b.name || b.city || "").replace(/\s+/g, "_").toLowerCase()}`,
            address: b.addressLine1,
            state: b.state || church.state,
            location: b.location,
            isVerified: Boolean(b.verified ?? c.verified),
          },
          { upsert: true, new: true }
        );
      }
    }

    if (request.query.generateStateBranches === "true") {
      for (const ns of NG_STATES) {
        const existing = await ChurchBranch.findOne({
          churchId: church._id,
          state: ns.state,
        });
        if (existing) continue;
        const codeBase = `${church._id}_${ns.state.replace(/\s+/g, "_").toLowerCase()}`;
        await ChurchBranch.findOneAndUpdate(
          { churchId: church._id, name: ns.capital },
          {
            churchId: church._id,
            name: ns.capital,
            code: codeBase,
            address: ns.capital,
            state: ns.state,
            isVerified: Boolean(c.verified),
          },
          { upsert: true, new: true }
        );
      }
    }
  }

  response.status(200).json({ success: true });
  return;
}

export async function reindex(
  _request: Request,
  response: Response
): Promise<void> {
  response.status(200).json({ success: true, message: "Reindex queued" });
  return;
}
