import React, { useState, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { PhotosProvider } from "./contexts/PhotosContext";
import AuthGuard from "./components/AuthGuard";
import MapComponent from "./MapComponent";
import ListView from "./components/ListView";
import Header from "./components/Header";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState("list");

  // Initialize view from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get("view");
    if (view && (view === "map" || view === "list")) {
      setCurrentView(view);
    }
  }, []);

  const handleViewChange = (view) => {
    setCurrentView(view);

    // Update URL without page reload
    const url = new URL(window.location);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url);
  };

  return (
    <AuthProvider>
      <PhotosProvider>
        <AuthGuard>
          <div className="App h-full flex flex-col">
            <Header currentView={currentView} onViewChange={handleViewChange} />
            <div className="flex-1 overflow-hidden min-h-0">
              {currentView === "map" && <MapComponent />}
              {currentView === "list" && (
                <ListView onViewChange={handleViewChange} />
              )}
            </div>
          </div>
        </AuthGuard>
      </PhotosProvider>
    </AuthProvider>
  );
}

export default App;
