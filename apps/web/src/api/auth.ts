import { API } from "../constants/api";
import { requestJson } from "./base-request";
import { getSession, setSession } from "../stores/session-store";
import type {
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  MessageResponse,
  RegisterInput,
  ResetPasswordInput,
  SessionUser,
  VerifyOtpInput,
} from "../types/auth";

export const authApi = {
  login: (data: LoginInput) => requestJson<LoginResponse>({ url: API.auth.login, method: "POST", data }),
  register: (data: RegisterInput) => requestJson<MessageResponse>({ url: API.auth.register, method: "POST", data }),
  verifyOtp: (data: VerifyOtpInput) => requestJson<MessageResponse>({ url: API.auth.verifyOtp, method: "POST", data }),
  resendOtp: (email: string) => requestJson<MessageResponse>({ url: API.auth.resendOtp, method: "POST", data: { email } }),
  forgotPassword: (email: string) => requestJson<MessageResponse>({ url: API.auth.forgotPassword, method: "POST", data: { email } }),
  resetPassword: (data: ResetPasswordInput) => requestJson<MessageResponse>({ url: API.auth.resetPassword, method: "POST", data }),
  changePassword: (data: ChangePasswordInput) => requestJson<MessageResponse>({ url: API.auth.changePassword, method: "POST", data }),
  me: async () => {
    const accessToken = getSession()?.accessToken;
    const result = await requestJson<SessionUser>({ url: API.auth.me });
    const session = getSession();
    if (accessToken && session?.accessToken === accessToken) setSession({ ...session, user: result.data });
    return result;
  },
};
