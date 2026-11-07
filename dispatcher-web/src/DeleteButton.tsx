import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient.ts";

const refusals = ["not_missing_from_osm", "stop_in_use"];

export const failureKey = (failure: unknown) => (failure instanceof ApiError && refusals.includes(failure.code) ? `delete.${failure.code}` : "routes.failed");

export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span>
      {t("delete.question")}{" "}
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          onDelete();
        }}
      >
        {t("delete.confirm")}
      </button>{" "}
      <button type="button" onClick={() => setAsking(false)}>
        {t("delete.cancel")}
      </button>
    </span>
  );
}
