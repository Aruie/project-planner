import { useState } from "react";
import { ApiClient } from "../../shared/api/client";
import { ApiProblem, type AuthMeResponse } from "../../shared/api/models";
import { apiBaseUrl, type RuntimeAccess } from "../../shared/api/runtime-config";

export function LoginScreen({ onLogin }: { onLogin: (access: RuntimeAccess) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setPending(true);
    setError(null);
    const access = { username: username.trim(), password };
    try {
      await new ApiClient(apiBaseUrl, () => access).get<AuthMeResponse>("/auth/me");
      onLogin(access);
    } catch (reason) {
      setError(
        reason instanceof ApiProblem
          ? "로그인 정보가 올바르지 않습니다."
          : "로그인에 실패했습니다.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="login-screen">
      <section>
        <h1>산출물 관리 프로그램</h1>
        <p>관리자 로그인 후 프로젝트를 선택하세요.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            관리자 ID{" "}
            <input
              data-testid="login-username-input"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            비밀번호{" "}
            <input
              data-testid="login-password-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            data-testid="login-submit-button"
            disabled={!username.trim() || !password || pending}
          >
            {pending ? "로그인 중" : "로그인"}
          </button>
        </form>
        {error ? (
          <p data-testid="login-error-banner" className="error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
