import * as oauthController from "./oauth.controller";
import * as loginController from "./login.controller";
import * as registerController from "./register.controller";
import * as passwordController from "./password.controller";
import * as sessionController from "./session.controller";

class AuthController {
  clerkLogin = oauthController.clerkLogin;
  oauthLogin = oauthController.oauthLogin;

  loginUser = loginController.loginUser;
  verifyEmail = loginController.verifyEmail;
  resendVerificationEmail = loginController.resendVerificationEmail;

  registerUser = registerController.registerUser;
  registerArtist = registerController.registerArtist;
  verifyArtist = registerController.verifyArtist;
  updateArtistProfile = registerController.updateArtistProfile;

  resetPassword = passwordController.resetPassword;
  initiatePasswordReset = passwordController.initiatePasswordReset;
  verifyResetCode = passwordController.verifyResetCode;
  resetPasswordWithCode = passwordController.resetPasswordWithCode;

  completeUserProfile = sessionController.completeUserProfile;
  getCurrentUser = sessionController.getCurrentUser;
  getUserSession = sessionController.getUserSession;
  updateUserAvatar = sessionController.updateUserAvatar;
  logout = sessionController.logout;
  getUserNameAndAge = sessionController.getUserNameAndAge;
  getUserProfilePicture = sessionController.getUserProfilePicture;
  refreshToken = sessionController.refreshToken;
}

export default new AuthController();
