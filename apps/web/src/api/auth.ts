import { API } from '../constants/api';
import { getSession, setSession } from '../stores/session-store';
import type {
  ChangePasswordInput,
  GoogleInput,
  GoogleRegisterInput,
  GoogleResult,
  GoogleSessionResult,
  LegacyVerifyOtpInput,
  LoginInput,
  LoginResponse,
  MessageResponse,
  OtpTiming,
  RegisterInput,
  RegistrationResponse,
  RegistrationStatus,
  RegistrationTokenInput,
  ResetPasswordInput,
  SessionUser,
  VerifyOtpInput,
} from '../types/auth';
import { requestJson } from './base-request';

export const authApi = {
  login: (data: LoginInput) =>
    requestJson<LoginResponse>({ url: API.auth.login, method: 'POST', data }),
  register: (data: RegisterInput) =>
    requestJson<RegistrationResponse>({ url: API.auth.register, method: 'POST', data }),
  registrationStatus: (data: RegistrationTokenInput) =>
    requestJson<RegistrationStatus>({ url: API.auth.registrationStatus, method: 'POST', data }),
  verifyOtp: (data: VerifyOtpInput) =>
    requestJson<MessageResponse>({ url: API.auth.verifyOtp, method: 'POST', data }),
  resendOtp: (data: RegistrationTokenInput) =>
    requestJson<MessageResponse & OtpTiming>({ url: API.auth.resendOtp, method: 'POST', data }),
  legacyVerifyOtp: (data: LegacyVerifyOtpInput) =>
    requestJson<MessageResponse>({ url: API.auth.legacyVerifyOtp, method: 'POST', data }),
  legacyResendOtp: (data: { email: string }) =>
    requestJson<MessageResponse>({ url: API.auth.legacyResendOtp, method: 'POST', data }),
  googleChallenge: () =>
    requestJson<{ challengeToken: string; nonce: string }>({
      url: API.auth.googleChallenge,
      method: 'POST',
      data: {},
    }),
  google: (data: GoogleInput) =>
    requestJson<GoogleResult>({ url: API.auth.google, method: 'POST', data }),
  googleRegister: (data: GoogleRegisterInput) =>
    requestJson<RegistrationResponse>({ url: API.auth.googleRegister, method: 'POST', data }),
  googleLinkVerify: (data: VerifyOtpInput) =>
    requestJson<GoogleSessionResult>({ url: API.auth.googleLinkVerify, method: 'POST', data }),
  googleLinkResend: (data: RegistrationTokenInput) =>
    requestJson<MessageResponse & OtpTiming>({
      url: API.auth.googleLinkResend,
      method: 'POST',
      data,
    }),
  forgotPassword: (email: string) =>
    requestJson<MessageResponse>({ url: API.auth.forgotPassword, method: 'POST', data: { email } }),
  resetPassword: (data: ResetPasswordInput) =>
    requestJson<MessageResponse>({ url: API.auth.resetPassword, method: 'POST', data }),
  changePassword: (data: ChangePasswordInput) =>
    requestJson<MessageResponse>({ url: API.auth.changePassword, method: 'POST', data }),
  me: async () => {
    const accessToken = getSession()?.accessToken;
    const result = await requestJson<SessionUser>({ url: API.auth.me });
    const session = getSession();
    if (accessToken && session?.accessToken === accessToken)
      setSession({ ...session, user: result.data });
    return result;
  },
};
