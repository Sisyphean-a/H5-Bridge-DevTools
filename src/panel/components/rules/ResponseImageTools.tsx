import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  buildImageFieldSuggestionsFromText,
  convertImageFileToValue,
  suggestImageFormatFromText,
  suggestImageFieldPathFromText,
  type ImageValueFormat,
  writeImageValueToDetailText,
} from "../../imageTools";
import type { PanelController } from "../../usePanelController";
import { Badge, Field } from "./RulesShared";

const formatLabels: Record<ImageValueFormat, string> = {
  androidUri: "模拟 Android URI",
  base64: "Base64",
};

export function ResponseImageTools({ controller }: { controller: PanelController }) {
  const draft = controller.state.responseDraft;
  const [format, setFormat] = useState<ImageValueFormat>("androidUri");
  const [fieldPath, setFieldPath] = useState("uri");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [applying, setApplying] = useState(false);
  const suggestions = useMemo(
    () =>
      draft
        ? buildImageFieldSuggestionsFromText(draft.detailText, format)
        : [],
    [draft, format],
  );
  const previewUrl = useObjectUrl(selectedFile);

  useEffect(() => {
    if (!draft) {
      return;
    }
    const nextFormat = suggestImageFormatFromText(draft.detailText);
    setFormat(nextFormat);
    setFieldPath(suggestImageFieldPathFromText(draft.detailText, nextFormat));
    setSelectedFile(null);
  }, [draft?.id]);

  if (!draft) {
    return null;
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  const applyImage = async () => {
    if (!selectedFile) {
      pushToast(controller, "error", "请先选择一张图片");
      return;
    }

    setApplying(true);
    try {
      const imageValue = await convertImageFileToValue(selectedFile, format);
      const result = writeImageValueToDetailText(draft.detailText, fieldPath, imageValue);
      if (!result.ok) {
        pushToast(controller, "error", result.error);
        return;
      }
      controller.setState((current) => ({
        ...current,
        responseDraft:
          current.responseDraft?.id === draft.id
            ? { ...current.responseDraft, detailText: result.detailText }
            : current.responseDraft,
        toast: { level: "success", message: `已写入${formatLabels[format]}` },
      }));
    } catch (error) {
      pushToast(
        controller,
        "error",
        error instanceof Error ? error.message : "图片读取失败",
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="workspace-section">
      <div className="form-grid">
        <Field label="写入格式">
          <select
            className="control-select"
            value={format}
            onChange={(event) => setFormat(event.target.value as ImageValueFormat)}
          >
            <option value="androidUri">模拟 Android URI</option>
            <option value="base64">Base64</option>
          </select>
        </Field>
        <Field label="目标字段">
          <input
            list={`image-field-${draft.id}`}
            className="control-field mono"
            value={fieldPath}
            onChange={(event) => setFieldPath(event.target.value)}
          />
          <datalist id={`image-field-${draft.id}`}>
            {suggestions.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </Field>
        <Field label="选择图片" span2>
          <input
            type="file"
            accept="image/*"
            className="control-field"
            onChange={handleFileChange}
          />
        </Field>
        <Field label="当前文件" span2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Badge tone={selectedFile ? "green" : "gray"}>
              {selectedFile ? selectedFile.name : "未选择"}
            </Badge>
            {selectedFile ? (
              <span className="workspace-pane__subtitle mono">
                {selectedFile.type || "image/*"} / {Math.ceil(selectedFile.size / 1024)} KB
              </span>
            ) : null}
          </div>
        </Field>
        {previewUrl ? (
          <Field label="图片预览" span2>
            <img
              src={previewUrl}
              alt={selectedFile?.name ?? "selected image"}
              style={{
                width: "100%",
                maxHeight: 220,
                objectFit: "contain",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}
            />
          </Field>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button
          type="button"
          className="control-button control-button--success"
          onClick={() => void applyImage()}
          disabled={!selectedFile || applying}
        >
          {applying ? "写入中..." : "写入当前格式"}
        </button>
      </div>
    </section>
  );
}

function pushToast(
  controller: PanelController,
  level: "success" | "info" | "error",
  message: string,
) {
  controller.setState((current) => ({
    ...current,
    toast: { level, message },
  }));
}

function useObjectUrl(file: File | null): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return objectUrl;
}
