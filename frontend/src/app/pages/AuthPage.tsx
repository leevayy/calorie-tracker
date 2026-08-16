import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useRootStore } from "@/stores/StoreContext";
import { Button } from "../components/ds/Button";
import { Input } from "../components/ds/Input";
import { Text } from "../components/ds/Text";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ds/Card";

const AuthPage = observer(function AuthPage() {
  const { t } = useTranslation();
  const { session } = useRootStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      await session.login({ email, password });
    } else {
      await session.register({ email, password });
    }
    if (session.authFetchState === "success") {
      navigate("/app");
    }
  };

  const toggleMode = () => {
    session.resetAuthFormFeedback();
    setIsLogin((v) => !v);
  };

  const showError = session.authFetchState === "error" && session.authErrorKey.length > 0;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-8">
      <Card variant="elevated" className="w-full max-w-sm">
        <CardHeader className="pb-5">
          <CardTitle className="text-2xl">{t("auth.title")}</CardTitle>
          <CardDescription>
            {isLogin ? t("auth.signInSubtitle") : t("auth.signUpSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {showError ? (
              <Text variant="error" role="alert">
                {t(session.authErrorKey)}
              </Text>
            ) : null}
            <div className="space-y-2">
              <Text as="label" htmlFor="auth-email" weight="medium">
                {t("auth.email")}
              </Text>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Text as="label" htmlFor="auth-password" weight="medium">
                {t("auth.password")}
              </Text>
              <Input
                id="auth-password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isLogin ? 1 : 8}
              />
            </div>
            <Button type="submit" className="w-full" loading={session.isAuthLoading}>
              {isLogin ? t("auth.signIn") : t("auth.signUp")}
            </Button>
          </form>

          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full whitespace-normal text-primary-ink"
              onClick={toggleMode}
            >
              {isLogin ? t("auth.toggleToSignUp") : t("auth.toggleToSignIn")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default AuthPage;
