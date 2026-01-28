import React from "react";
import { useAuth } from "../hooks/useAuth";
import { FiLogOut } from "react-icons/fi";

const Header = ({ currentView, onViewChange }) => {
  const { signOut, user } = useAuth();

  const handleSignOut = async () => {
    try {
      const result = await signOut();

      // Force redirect to login page after logout
      if (result.success) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Even if there's an error, try to redirect
      window.location.href = "/";
    }
  };

  return (
    <header className="h-12 bg-slate-800 border-b border-slate-900 flex-shrink-0">
      <div className="h-full flex items-center justify-between px-3 sm:px-4">
        {/* Left side - Navigation tabs */}
        <nav className="flex items-center">
          <button
            onClick={() => onViewChange("list")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
              currentView === "list"
                ? "border-slate-300 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            List
          </button>
          <button
            onClick={() => onViewChange("map")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
              currentView === "map"
                ? "border-slate-300 text-slate-100"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            Map
          </button>
        </nav>

        {/* Right side - User info and logout */}
        <div className="flex items-center space-x-2">
          <div className="hidden sm:block text-xs text-slate-300">
            <div className="font-medium">{user?.email}</div>
            <div className="text-xs text-slate-400">Logged in</div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors duration-200 relative z-10"
            title="Logout"
            type="button"
          >
            <FiLogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
