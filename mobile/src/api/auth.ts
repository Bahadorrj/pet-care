import client from './client';

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  username: string;
  email: string;
}

export async function register(
  email: string,
  password: string,
  username: string,
): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/auth/register', {
    email,
    password,
    username,
  });
  return res.data;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return res.data;
}
