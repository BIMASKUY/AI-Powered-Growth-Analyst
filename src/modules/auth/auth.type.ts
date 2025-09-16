export interface MicrosoftOAuth {
  token_type: string;
  scope: string;
  expires_in: number;
  ext_expires_in: number;
  access_token: string;
  id_token: string;
}

export interface MicrosoftGraphUser {
  '@odata.context': string;
  businessPhones: string[];
  displayName: string | null;
  givenName: string | null;
  jobTitle: string | null;
  mail: string;
  mobilePhone: string | null;
  officeLocation: string | null;
  preferredLanguage: string | null;
  surname: string | null;
  userPrincipalName: string | null;
  id: string;
}

export interface Payload {
  user_id: string;
  iat: number;
  exp: number;
}