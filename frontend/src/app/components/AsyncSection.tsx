import { useTranslation } from "react-i18next";
import { Button } from "./ds/Button";
import { Spinner } from "./ds/Spinner";

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
        <p className="text-sm text-muted-foreground">{t("states.loading")}</p>
      </div>
    );
  }

  if (fetchState === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center px-4">
        <p className="text-sm text-destructive" role="alert">
          {errorKey ? t(errorKey) : t("states.errorGeneric")}
        </p>
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
