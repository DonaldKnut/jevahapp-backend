import { CopyrightFreeSongService } from "../../../service/copyrightFreeSong.service";

export interface CopyrightFreeSongInteractionDeps {
  songService: CopyrightFreeSongService;
}

export function createDeps(): CopyrightFreeSongInteractionDeps {
  return { songService: new CopyrightFreeSongService() };
}
