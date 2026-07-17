"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { JwtPayload, AuthResult } from "../types";

interface AuthState {
  user: JwtPayload | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setState({ user: null, loading: false, error: null });
      return;
    }

    api.setToken(token);
    api
      .get<JwtPayload>("/auth/me")
      .then((res) => {
        if (res.success && res.data) {
          setState({ user: res.data as JwtPayload, loading: false, error: null });
        } else {
          api.setToken(null);
          setState({ user: null, loading: false, error: null });
        }
      })
      .catch(() => {
        api.setToken(null);
        setState({ user: null, loading: false, error: null });
      });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await api.post<AuthResult>("/auth/login", { username, password });

    if (res.success && res.data) {
      const data = res.data as AuthResult;
      api.setToken(data.accessToken);
      setState({ user: data.user, loading: false, error: null });
      return true;
    } else {
      setState({
        user: null,
        loading: false,
        error: res.error?.message || "Login failed",
      });
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, login, logout };
}
