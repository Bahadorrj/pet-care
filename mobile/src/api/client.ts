import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8000";

// eslint-disable-next-line import/no-named-as-default-member -- axios.create is the intended factory
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
