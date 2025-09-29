export interface UserInfo {
  email: string;
  name: string;
  image_url: string;
}

export interface GoogleOauth extends UserInfo {
  access_token: string;
  refresh_token: string;
  scope: string[];
  expiry_date: Date;
}
