import { Request, Response } from "express";
import PlacesService from "../service/places.service";
import logger from "../utils/logger";

export async function suggestPlaces(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const q = String(request.query.q || "").trim();
    if (q.length < 2) {
      response
        .status(400)
        .json({ success: false, message: "q must be at least 2 characters" });
      return;
    }

    const limit = Math.min(
      parseInt(String(request.query.limit || "10"), 10) || 10,
      20
    );
    const radius =
      parseInt(String(request.query.radius || "50000"), 10) || 50000;
    const sourceParam = String(request.query.source || "combined");
    const source =
      sourceParam === "internal" || sourceParam === "mapbox"
        ? sourceParam
        : "combined";
    const churchId = request.query.churchId
      ? String(request.query.churchId)
      : null;
    const country = request.query.country
      ? String(request.query.country).toUpperCase()
      : null;

    let near: { lat: number; lng: number } | null = null;
    if (request.query.near) {
      const parts = String(request.query.near).split(",");
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (isFinite(lat) && isFinite(lng)) {
          near = { lat, lng };
        }
      }
    }

    const { results } = await PlacesService.suggest({
      q,
      near,
      radius,
      limit,
      source,
      country,
      churchId,
    });
    response.status(200).json({ success: true, source, results });
    return;
  } catch (error: any) {
    logger.error("places.suggest failed", { error: error?.message });
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
    return;
  }
}

export async function getChurchById(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const { id } = request.params;
    const data = await PlacesService.getChurchWithBranches(id);
    if (!data) {
      response
        .status(404)
        .json({ success: false, message: "Church not found" });
      return;
    }
    const { church, branches } = data;
    response
      .status(200)
      .json({ success: true, church: { ...church.toObject(), branches } });
    return;
  } catch (error: any) {
    response
      .status(500)
      .json({ success: false, message: "Internal server error" });
    return;
  }
}
