import * as tokenService from "./token.service";
import * as loginService from "./login.service";
import * as registerService from "./register.service";
import * as passwordService from "./password.service";

class AuthService {
  oauthLogin = loginService.oauthLogin;
  clerkLogin = loginService.clerkLogin;
  loginUser = loginService.loginUser;
  getCurrentUser = loginService.getCurrentUser;
  getUserSession = loginService.getUserSession;
  updateUserAvatar = loginService.updateUserAvatar;
  getUserNameAndAge = loginService.getUserNameAndAge;
  getUserProfilePicture = loginService.getUserProfilePicture;

  registerUser = registerService.registerUser;
  registerArtist = registerService.registerArtist;
  verifyArtist = registerService.verifyArtist;
  updateArtistProfile = registerService.updateArtistProfile;
  verifyEmail = registerService.verifyEmail;
  resendVerificationEmail = registerService.resendVerificationEmail;
  completeUserProfile = registerService.completeUserProfile;

  initiatePasswordReset = passwordService.initiatePasswordReset;
  verifyResetCode = passwordService.verifyResetCode;
  resetPasswordWithCode = passwordService.resetPasswordWithCode;
  resetPassword = passwordService.resetPassword;
  changePassword = passwordService.changePassword;
  adminSetUserPassword = passwordService.adminSetUserPassword;
  adminSendPasswordReset = passwordService.adminSendPasswordReset;

  logout = tokenService.logout;
  refreshToken = tokenService.refreshToken;
  revokeRefreshToken = tokenService.revokeRefreshToken;
  revokeAllUserRefreshTokens = tokenService.revokeAllUserRefreshTokens;
}

export default new AuthService();
