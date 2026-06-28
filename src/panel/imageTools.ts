import { formatJson, safeParseJson } from "../shared/json";

export type ImageValueFormat = "androidUri" | "base64";

const imageFieldPattern = /(uri|path|base64|image|img|photo|face)/i;
const preferredFieldNames: Record<ImageValueFormat, string[]> = {
  androidUri: ["uri", "path", "imageUri", "filePath"],
  base64: ["data", "base64", "faceImg", "imageBase64"],
};
const fallbackFieldNames = ["uri", "data", "faceImg", "base64", "image"];

export function buildImageFieldSuggestionsFromText(
  detailText: string,
  format: ImageValueFormat,
): string[] {
  const parsed = safeParseJson(detailText);
  const discovered = parsed.ok ? collectImageFieldPaths(parsed.value) : [];
  return Array.from(
    new Set([...discovered, ...preferredFieldNames[format], ...fallbackFieldNames]),
  );
}

export function createMockAndroidUri(fileName: string): string {
  const sanitized = fileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "_");
  return `mock://selected-image/${sanitized || "image"}`;
}

export async function convertImageFileToValue(
  file: File,
  format: ImageValueFormat,
): Promise<string> {
  if (format === "androidUri") {
    return createMockAndroidUri(file.name);
  }
  return readFileAsBase64(file);
}

export function suggestImageFormatFromText(detailText: string): ImageValueFormat {
  const parsed = safeParseJson(detailText);
  if (!parsed.ok) {
    return "androidUri";
  }

  const paths = collectImageFieldPaths(parsed.value);
  if (hasPreferredField(paths, preferredFieldNames.base64)) {
    return "base64";
  }
  return "androidUri";
}

export function suggestImageFieldPathFromText(
  detailText: string,
  format: ImageValueFormat,
): string {
  const parsed = safeParseJson(detailText);
  if (!parsed.ok) {
    return preferredFieldNames[format][0];
  }
  return suggestImageFieldPath(parsed.value, format);
}

export function writeImageValueToDetailText(
  detailText: string,
  fieldPath: string,
  imageValue: string,
): { ok: true; detailText: string } | { ok: false; error: string } {
  const parsed = safeParseJson(detailText);
  if (!parsed.ok) {
    return { ok: false, error: `Detail JSON 无效: ${parsed.error}` };
  }

  const next = setImageValueInDetail(parsed.value, fieldPath, imageValue);
  if (!next.ok) {
    return next;
  }

  return { ok: true, detailText: formatJson(next.value) };
}

function collectImageFieldPaths(detail: unknown, prefix = ""): string[] {
  if (!isPlainObject(detail)) {
    return [];
  }

  const paths: string[] = [];
  for (const [key, value] of Object.entries(detail)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (imageFieldPattern.test(key)) {
      paths.push(path);
    }
    paths.push(...collectImageFieldPaths(value, path));
  }
  return paths;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("图片读取失败"));
        return;
      }
      resolve(reader.result.split(",", 2)[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function setImageValueInDetail(
  detail: unknown,
  fieldPath: string,
  imageValue: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const segments = fieldPath
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return { ok: false, error: "图片字段不能为空" };
  }
  if (!isPlainObject(detail)) {
    return { ok: false, error: "Detail JSON 必须是对象，图片工具才能写入字段" };
  }
  return { ok: true, value: updateFieldPath(detail, segments, imageValue) };
}

function suggestImageFieldPath(detail: unknown, format: ImageValueFormat): string {
  const paths = collectImageFieldPaths(detail);
  const matched = findPreferredField(paths, preferredFieldNames[format]);
  if (matched) {
    return matched;
  }
  return paths[0] ?? preferredFieldNames[format][0];
}

function updateFieldPath(
  source: Record<string, unknown>,
  segments: string[],
  imageValue: string,
): Record<string, unknown> {
  const [head, ...rest] = segments;
  if (!head) {
    return source;
  }
  if (rest.length === 0) {
    return { ...source, [head]: imageValue };
  }

  const current = source[head];
  const nested = isPlainObject(current) ? current : {};
  return {
    ...source,
    [head]: updateFieldPath(nested, rest, imageValue),
  };
}

function findPreferredField(paths: string[], names: string[]): string | undefined {
  return paths.find((path) => names.some((name) => path === name || path.endsWith(`.${name}`)));
}

function hasPreferredField(paths: string[], names: string[]): boolean {
  return Boolean(findPreferredField(paths, names));
}
