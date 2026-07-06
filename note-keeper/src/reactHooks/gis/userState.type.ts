export interface UserState {
  scopes: string[];
  loggedIn: boolean;
  userInfo: any;
  googleAccessTokenToGD: any;
  needsReauth?: boolean;
}
