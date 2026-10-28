import { isRecord } from "./guards";
import { err, ok, type ParseResult } from "./result";

export type YamlValue = string | number | boolean | null | YamlValue[] | { readonly [key: string]: YamlValue };

interface YamlMap {
  [key: string]: YamlValue;
}

interface Frame {
  indent: number;
  container: YamlMap | YamlValue[];
  ownerKey: string | null;
}

function stripComment(line: string): string {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote !== null) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "#") return line.slice(0, index);
  }
  return line;
}

function parseScalar(text: string): YamlValue {
  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if (/^-?\d+$/.test(text)) return Number(text);
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }
  return text;
}

function isMap(value: Frame["container"]): value is YamlMap {
  return isRecord(value);
}

export function parseSimpleYaml(source: string): ParseResult<YamlMap> {
  const root: YamlMap = {};
  const stack: Frame[] = [{ indent: -1, container: root, ownerKey: null }];

  for (const rawLine of source.split("\n")) {
    const line = stripComment(rawLine);
    if (line.trim().length === 0) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const content = line.trim();
    const isListItem = content.startsWith("- ");
    while (stack.length > 1) {
      const top = stack[stack.length - 1];
      if (top === undefined || indent > top.indent) break;

      // YAML permits sequences at the same indentation as their key.
      if (
        isListItem &&
        indent === top.indent &&
        (Array.isArray(top.container) ||
          (isMap(top.container) &&
            Object.keys(top.container).length === 0 &&
            top.ownerKey !== null))
      ) {
        break;
      }

      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent === undefined) return err("The candidate YAML has no parent frame.");

    if (content.startsWith("- ")) {
      const item = parseScalar(content.slice(2).trim());
      if (isMap(parent.container) && Object.keys(parent.container).length === 0) {
        const owner = stack[stack.length - 2];
        if (owner === undefined || !isMap(owner.container) || parent.ownerKey === null) {
          return err("A YAML list item has no key.");
        }
        const list: YamlValue[] = [item];
        owner.container[parent.ownerKey] = list;
        const keyIndent = parent.indent;
        const ownerKey = parent.ownerKey;
        stack.pop();
        stack.push({ indent: keyIndent, container: list, ownerKey });
        continue;
      }
      if (!Array.isArray(parent.container)) return err("A YAML list item is outside a list.");
      parent.container.push(item);
      continue;
    }

    const colon = content.indexOf(":");
    if (colon <= 0) return err(`A YAML line is not a key: ${content}`);
    if (!isMap(parent.container)) return err("A YAML key is outside a mapping.");
    const key = content.slice(0, colon).trim();
    const rest = content.slice(colon + 1).trim();
    if (rest.length === 0) {
      const child: YamlMap = {};
      parent.container[key] = child;
      stack.push({ indent, container: child, ownerKey: key });
      continue;
    }
    parent.container[key] = parseScalar(rest);
  }

  return ok(root);
}
