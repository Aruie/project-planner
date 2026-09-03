export type RuntimeAccess = { username: string; password: string };

type LocalAutoLoginEnvironment = {
  DEV: boolean;
  MODE: string;
  VITE_AIDLC_LOCAL_ADMIN_USERNAME?: string;
  VITE_AIDLC_LOCAL_ADMIN_PASSWORD?: string;
};

export const getLocalAutoLoginAccess = (
  environment: LocalAutoLoginEnvironment,
): RuntimeAccess | undefined => {
  if (environment.DEV !== true || environment.MODE !== "development") {
    return undefined;
  }
  return {
    username: environment.VITE_AIDLC_LOCAL_ADMIN_USERNAME ?? "admin",
    password: environment.VITE_AIDLC_LOCAL_ADMIN_PASSWORD ?? "admin1234",
  };
};

export const localAutoLoginAccess = getLocalAutoLoginAccess({
  DEV: import.meta.env.DEV,
  MODE: import.meta.env.MODE,
});

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const basicAuthorization = (access?: RuntimeAccess): string | undefined => {
  if (!access?.username || !access.password) return undefined;
  return `Basic ${btoa(`${access.username}:${access.password}`)}`;
};
