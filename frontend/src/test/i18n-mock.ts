import { vi } from "vitest";
import ja from "../i18n/locales/ja.json";

type NestedRecord = { [key: string]: string | NestedRecord };

/** ja.json のネスト構造を "section.key" 形式のフラットなMapに変換 */
function flatten(obj: NestedRecord, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[fullKey] = value;
    } else {
      Object.assign(result, flatten(value, fullKey));
    }
  }
  return result;
}

const translations = flatten(ja as unknown as NestedRecord);

/** {{param}} を実際の値に置換する簡易インターポレーション */
function interpolate(
  template: string,
  params?: Record<string, unknown>
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(params[key] ?? `{{${key}}}`)
  );
}

/** 安定した参照の t 関数（useCallback の deps で不要な再生成を防ぐ） */
const t = (key: string, params?: Record<string, unknown>) => {
  const template = translations[key];
  if (template === undefined) return key;
  return interpolate(template, params);
};

const translationResult = { t };

/**
 * react-i18next の vi.mock 用ファクトリ。
 *
 * 使い方:
 *   vi.mock("react-i18next", async () => {
 *     const { i18nMock } = await import("../test/i18n-mock");
 *     return i18nMock;
 *   });
 */
export const i18nMock = {
  useTranslation: () => translationResult,
};

/** vi.mock のファクトリ関数として直接渡す用 */
export function mockReactI18next() {
  vi.mock("react-i18next", () => i18nMock);
}
