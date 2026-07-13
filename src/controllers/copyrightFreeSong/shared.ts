import { CopyrightFreeSongService } from "../../service/copyrightFreeSong.service";
import { CopyrightFreeSongInteractionService } from "../../service/copyrightFreeSongInteraction.service";

export const songService = new CopyrightFreeSongService();
export const interactionService = new CopyrightFreeSongInteractionService();

export const normalizeUrl = (url: string | undefined | null): string | null => {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  // Encode spaces and other unsafe characters without double-encoding full URLs.
  // (encodeURI preserves : / ? & = #)
  try {
    return encodeURI(trimmed);
  } catch {
    return trimmed;
  }
};
