import { useTranslation } from "react-i18next";
import { Button } from "./ds/Button";
import { Spinner } from "./ds/Spinner";
import { Text } from "./ds/Text";

export type AsyncFetchState = "initial" | "loading" | "success" | "error";

type AsyncSectionProps = {
  fetchState: AsyncFetchState;
  errorKey?: string;
  onRetry?: () => void;
  loadingClassName?: string;
  children: React.ReactNode;
  /** When true and fetchState is success, show emptyContent instead of children */
  empty?: boolean;
  emptyContent?: React.ReactNode;
};

export function AsyncSection({
  fetchState,
  errorKey,
  onRetry,
  loadingClassName,
  children,
  empty,
  emptyContent,
}: AsyncSectionProps) {
  const { t } = useTranslation();

  if (fetchState === "initial" || fetchState === "loading") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 py-8 ${loadingClassName ?? ""}`}>
        <Spinner size="lg" />
        <Text variant="muted">{t("states.loading")}</Text>
      </div>
    );
  }

  if (fetchState === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center px-4">
        <Text variant="error" role="alert">
          {errorKey ? t(errorKey) : t("states.errorGeneric")}
        </Text>
        {onRetry ? (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {t("states.retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  if (empty && emptyContent != null) {
    return <>{emptyContent}</>;
  }

  return <>{children}</>;
}
