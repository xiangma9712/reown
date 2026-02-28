import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "./Card";
import { Input } from "./Input";
import { Button } from "./Button";
import { invoke } from "../invoke";

export function GithubSettingsTab() {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [tokenStored, setTokenStored] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await invoke("get_github_auth_status");
      setTokenStored(stored);
      setToken("");
    } catch (e) {
      setMessage({
        type: "error",
        text: t("githubSettings.loadError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setMessage(null);

      const config = await invoke("load_app_config");
      await invoke("save_app_config", {
        config: { ...config, github_token: token },
      });

      setTokenStored(true);
      setToken("");
      setMessage({ type: "success", text: t("githubSettings.saveSuccess") });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("githubSettings.saveError", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [token, t]);

  const handleReset = useCallback(() => {
    setMessage(null);
    loadConfig();
  }, [loadConfig]);

  const handleDelete = useCallback(async () => {
    try {
      setMessage(null);

      await invoke("github_logout");

      setTokenStored(false);
      setToken("");
      setMessage({
        type: "success",
        text: t("githubSettings.tokenDeleted"),
      });
    } catch (e) {
      setMessage({
        type: "error",
        text: t("common.error", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    }
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-muted">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-heading">
          {t("githubSettings.title")}
        </h2>
        <p className="mt-1 text-[0.85rem] text-text-muted">
          {t("githubSettings.description")}
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={t("githubSettings.token")}
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={
                    tokenStored
                      ? t("githubSettings.tokenStoredPlaceholder")
                      : t("githubSettings.tokenPlaceholder")
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowToken((v) => !v)}
                className="mb-0"
              >
                {showToken
                  ? t("githubSettings.hideToken")
                  : t("githubSettings.showToken")}
              </Button>
            </div>
            {tokenStored && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[0.75rem] text-success">
                  {t("githubSettings.tokenStored")}
                </span>
                <button
                  onClick={handleDelete}
                  className="cursor-pointer border-none bg-transparent text-[0.75rem] text-danger hover:underline"
                >
                  {t("githubSettings.deleteToken")}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {message && (
        <div
          className={`rounded border px-4 py-2 text-[0.85rem] ${
            message.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          variant="primary"
          loading={saving}
          disabled={!token}
        >
          {t("githubSettings.save")}
        </Button>
        <Button onClick={handleReset} variant="secondary">
          {t("githubSettings.reset")}
        </Button>
      </div>
    </div>
  );
}
