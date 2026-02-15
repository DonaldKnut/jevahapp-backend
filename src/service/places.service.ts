import axios from "axios";
import mongoose from "mongoose";
import { Church } from "../models/church.model";
import { ChurchBranch } from "../models/church-branch.model";

export type SuggestSource = "internal" | "mapbox" | "combined";

export interface SuggestQuery {
  q: string;
  near?: { lat: number; lng: number } | null;
  radius?: number; // meters
  limit?: number;
  source?: SuggestSource;
  country?: string | null;
  churchId?: string | null;
}

export interface NormalizedAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface NormalizedResult {
  id: string;
  type: "church" | "branch";
  name: string;
  parentChurch?: { id: string; name: string };
  address: NormalizedAddress;
  location?: { lat: number; lng: number } | null;
  source: "internal" | "mapbox";
  confidence: number; // 0..1
  distanceMeters?: number;
  verified?: boolean;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000; // meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aa =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

function proximityScore(distanceMeters: number, radiusMeters: number): number {
  if (!isFinite(distanceMeters) || distanceMeters < 0) return 0;
  const d = Math.min(distanceMeters, radiusMeters);
  // Exponential decay inside radius
  const score = Math.exp(-3 * (d / Math.max(1, radiusMeters)));
  return Math.max(0, Math.min(1, score));
}

function textScore(name: string, q: string, aliases?: string[]): number {
  const nq = q.trim().toLowerCase();
  const n = (name || "").toLowerCase();
  if (n === nq) return 1;
  if (n.startsWith(nq)) return 0.9;
  if (n.includes(nq)) return 0.75;
  if (aliases && aliases.some(a => (a || "").toLowerCase().includes(nq)))
    return 0.7;
  // simple fuzzy: proportion of q chars that appear in order
  let idx = 0;
  for (const ch of n) {
    if (ch === nq[idx]) idx += 1;
    if (idx === nq.length) break;
  }
  return (idx / Math.max(1, nq.length)) * 0.6;
}

function normalizeInternalBranch(
  branch: any,
  church?: any,
  near?: { lat: number; lng: number } | null,
  radius: number = 50000
): NormalizedResult {
  const location =
    branch?.location?.lat != null && branch?.location?.lng != null
      ? { lat: branch.location.lat, lng: branch.location.lng }
      : null;
  const distance =
    near && location ? haversineMeters(near, location) : undefined;
  return {
    id: (branch._id || branch.id).toString(),
    type: "branch",
    name: branch.name,
    parentChurch: church
      ? { id: church._id.toString(), name: church.name }
      : undefined,
    address: {
      line1: branch.address,
      state: branch.state,
      // city/postal/country not in current schema
    },
    location: location || undefined,
    source: "internal",
    // base confidence will be set by caller; default minimal here
    confidence: 0.5,
    distanceMeters: distance,
    verified: Boolean(branch.isVerified),
  };
}

function normalizeInternalChurch(
  church: any,
  near?: { lat: number; lng: number } | null,
  radius: number = 50000
): NormalizedResult {
  const location =
    church?.location?.lat != null && church?.location?.lng != null
      ? { lat: church.location.lat, lng: church.location.lng }
      : null;
  const distance =
    near && location ? haversineMeters(near, location) : undefined;
  return {
    id: (church._id || church.id).toString(),
    type: "church",
    name: church.name,
    address: {
      line1: church.address,
      state: church.state,
    },
    location: location || undefined,
    source: "internal",
    confidence: 0.5,
    distanceMeters: distance,
    verified: Boolean(church.isVerified),
  };
}

function normalizeMapboxFeature(
  f: any,
  q: string,
  near?: { lat: number; lng: number } | null,
  radius: number = 50000
): NormalizedResult | null {
  const center =
    Array.isArray(f.center) && f.center.length === 2
      ? { lng: f.center[0], lat: f.center[1] }
      : null;
  const distance =
    near && center
      ? haversineMeters(near, { lat: center.lat, lng: center.lng })
      : undefined;
  const text = f.text || f.text_en || f.place_name || "";
  const ts = textScore(text, q);
  // Filter types/categories to church/place of worship
  const cats = f.properties?.category || f.properties?.category_en || "";
  const lcCats = String(cats).toLowerCase();
  const allowed =
    lcCats.includes("church") || lcCats.includes("place_of_worship");
  if (!allowed) return null;
  return {
    id: f.id,
    type: "branch",
    name: text,
    address: {
      line1: f.properties?.address || f.address || undefined,
      city: f.context?.find((c: any) => c.id?.startsWith("place"))?.text,
      state: f.context?.find((c: any) => c.id?.startsWith("region"))?.text,
      postalCode: f.context?.find((c: any) => c.id?.startsWith("postcode"))
        ?.text,
      countryCode: f.context
        ?.find((c: any) => c.id?.startsWith("country"))
        ?.short_code?.toUpperCase(),
    },
    location: center ? { lat: center.lat, lng: center.lng } : undefined,
    source: "mapbox",
    confidence: ts,
    distanceMeters: distance,
    verified: false,
  };
}

function dedupeResults(results: NormalizedResult[]): NormalizedResult[] {
  const seen = new Map<string, NormalizedResult>();
  for (const r of results) {
    const key = `${r.name.toLowerCase()}|${r.address.line1 || ""}|${r.address.city || ""}|${r.address.state || ""}`;
    if (!seen.has(key)) {
      seen.set(key, r);
    } else {
      const existing = seen.get(key)!;
      // prefer internal over mapbox, or higher confidence
      if (
        (existing.source === "mapbox" && r.source === "internal") ||
        r.confidence > existing.confidence
      ) {
        seen.set(key, r);
      }
    }
  }
  return Array.from(seen.values());
}

export class PlacesService {
  static async suggest(
    params: SuggestQuery
  ): Promise<{ source: SuggestSource; results: NormalizedResult[] }> {
    const q = params.q.trim();
    if (q.length < 2) {
      return { source: params.source || "combined", results: [] };
    }

    const near = params.near || null;
    const radius = params.radius ?? 50000;
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 20);
    const source: SuggestSource = params.source || "combined";
    const churchId = params.churchId || null;

    // Internal search
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const branchFilter: any = { $or: [{ name: re }, { address: re }] };
    if (churchId && mongoose.isValidObjectId(churchId)) {
      branchFilter.churchId = new mongoose.Types.ObjectId(churchId);
    }

    const [branches, churches] = await Promise.all([
      ChurchBranch.find(branchFilter).limit(50),
      Church.find({
        $or: [{ name: re }, { branchName: re }, { address: re }],
      }).limit(30),
    ]);

    const churchMap = new Map<string, any>();
    churches.forEach(c => churchMap.set(c._id.toString(), c));

    const internal: NormalizedResult[] = [];
    for (const b of branches) {
      const c = churchMap.get(b.churchId?.toString());
      const normalized = normalizeInternalBranch(b, c, near, radius);
      const ts = textScore(`${normalized.name} ${c?.name || ""}`, q);
      const ps =
        near && normalized.location
          ? proximityScore(normalized.distanceMeters || 0, radius)
          : 0;
      const verifiedBoost = normalized.verified ? 0.15 : 0;
      normalized.confidence = 0.6 * ts + 0.3 * ps + 0.1 * verifiedBoost;
      internal.push(normalized);
    }

    for (const c of churches) {
      const normalized = normalizeInternalChurch(c, near, radius);
      const ts = textScore(normalized.name, q);
      const ps =
        near && normalized.location
          ? proximityScore(normalized.distanceMeters || 0, radius)
          : 0;
      const verifiedBoost = normalized.verified ? 0.15 : 0;
      normalized.confidence = 0.6 * ts + 0.3 * ps + 0.1 * verifiedBoost;
      internal.push(normalized);
    }

    let results = internal;

    // If combined/mapbox and not enough, fetch Mapbox
    if (
      (source === "combined" || source === "mapbox") &&
      internal.length < limit
    ) {
      const remaining = limit - internal.length;
      const mapboxToken = process.env.MAPBOX_TOKEN;
      if (mapboxToken) {
        try {
          const paramsObj: any = {
            access_token: mapboxToken,
            limit: Math.min(remaining, 10),
            types: "poi",
          };
          if (near) paramsObj.proximity = `${near.lng},${near.lat}`;
          if (params.country) paramsObj.country = params.country;
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
          const resp = await axios.get(url, {
            params: paramsObj,
            timeout: 7000,
          });
          const features: any[] = resp.data?.features || [];
          const normalized = features
            .map(f => normalizeMapboxFeature(f, q, near, radius))
            .filter((v): v is NormalizedResult => Boolean(v));
          results = results.concat(normalized);
        } catch (err) {
          // swallow Mapbox errors, keep internal results
        }
      }
    }

    // Dedupe and sort
    results = dedupeResults(results)
      .sort((a, b) => {
        // Prefer internal on ties, then higher confidence, then nearer
        if (a.confidence === b.confidence) {
          if (a.source !== b.source) return a.source === "internal" ? -1 : 1;
          return (
            (a.distanceMeters || Infinity) - (b.distanceMeters || Infinity)
          );
        }
        return b.confidence - a.confidence;
      })
      .slice(0, limit);

    return { source, results };
  }

  static async getChurchWithBranches(id: string) {
    if (!mongoose.isValidObjectId(id)) return null;
    const church = await Church.findById(id);
    if (!church) return null;
    const branches = await ChurchBranch.find({ churchId: church._id });
    return { church, branches };
  }
}

export default PlacesService;

