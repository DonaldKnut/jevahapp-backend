import { Request, Response } from "express";
import mongoose from "mongoose";
import { Church } from "../models/church.model";
import { ChurchBranch } from "../models/church-branch.model";
import { NG_STATES } from "../constants/ngStates";

export async function createChurch(
  request: Request,
  response: Response
): Promise<void> {
  const {
    name,
    aliases,
    denomination,
    website,
    verified,
    popularityScore,
    address,
    state,
    lga,
    location,
  } = request.body || {};
  if (!name || !state) {
    response
      .status(400)
      .json({ success: false, message: "name and state are required" });
    return;
  }
  const doc: any = {
    name,
    denomination,
    address,
    state,
    lga,
    location,
    isVerified: Boolean(verified),
  };
  const created = await Church.create(doc);
  response.status(201).json({ success: true, church: created });
  return;
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
    location,
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

    // Auto-generate state-wide branches if requested via flag
    if (request.query.generateStateBranches === "true") {
      for (const ns of NG_STATES) {
        // Skip if a branch already exists for this state
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
  // With Mongo, we rely on indexes. If we add Atlas Search later, trigger its pipelines here.
  response.status(200).json({ success: true, message: "Reindex queued" });
  return;
}
