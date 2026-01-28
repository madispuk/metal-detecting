import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { supabase } from "../supabase";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error);
          setError(error.message);
        } else {
          setUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("Error in getInitialSession:", err);
        setError("Failed to check authentication status");
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.id);

      // Only set user if it's a valid session and not a sign out event
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
      } else if (session?.user) {
        setUser(session.user);
      }

      setLoading(false);
      setError(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }

      return { success: true, user: data.user };
    } catch (err) {
      const errorMessage = "An unexpected error occurred during sign in";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Starting sign out process...");

      // Clear local state immediately
      setUser(null);

      // Clear any stored session data
      localStorage.removeItem(
        "sb-" +
          supabase.supabaseUrl.split("//")[1].split(".")[0] +
          "-auth-token"
      );
      sessionStorage.clear();

      // Try to sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.warn(
          "Supabase signOut error (but local state cleared):",
          error
        );
        return { success: true };
      }

      console.log("Sign out successful");
      return { success: true };
    } catch (err) {
      console.warn("Sign out error (but local state cleared):", err);
      return { success: true };
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is admin
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.user_metadata?.admin === true;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      signOut,
      isAuthenticated: !!user,
      isAdmin,
    }),
    [user, loading, error, signIn, signOut, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
