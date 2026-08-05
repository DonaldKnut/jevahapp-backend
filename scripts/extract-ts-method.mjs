/** Extract a TypeScript class method, ignoring `{` in param/return types. */
export function extractClassMethod(lines, name) {
  const re = new RegExp(
    `^\\s+(?:private\\s+)?(?:static\\s+)?(?:async\\s+)?${name}\\(`
  );
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) throw new Error("method not found: " + name);

  let paren = 0;
  let brace = 0;
  let angle = 0;
  let phase = "params";
  let bodyBrace = 0;

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];

      if (phase === "params") {
        if (ch === "(") paren++;
        else if (ch === ")") {
          paren--;
          if (paren === 0) phase = "afterParams";
        }
        continue;
      }

      if (phase === "afterParams") {
        if (/\s/.test(ch)) continue;
        if (ch === ":") {
          phase = "returnType";
          continue;
        }
        if (ch === "{") {
          phase = "body";
          bodyBrace = 1;
          continue;
        }
        continue;
      }

      if (phase === "returnType") {
        if (ch === "{") {
          if (brace === 0 && angle === 0 && paren === 0) {
            phase = "body";
            bodyBrace = 1;
            continue;
          }
          brace++;
        } else if (ch === "}") {
          brace = Math.max(0, brace - 1);
        } else if (ch === "<") angle++;
        else if (ch === ">") angle = Math.max(0, angle - 1);
        else if (ch === "(") paren++;
        else if (ch === ")") paren = Math.max(0, paren - 1);
        continue;
      }

      if (phase === "body") {
        if (ch === "{") bodyBrace++;
        else if (ch === "}") {
          bodyBrace--;
          if (bodyBrace === 0) return lines.slice(start, i + 1);
        }
      }
    }
  }
  throw new Error("unclosed method: " + name);
}
