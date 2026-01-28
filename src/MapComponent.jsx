import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import imageCompression from "browser-image-compression";
import {
  savePhotoToDatabase,
  loadAllPhotosFromDatabase,
  loadPhotosWithThumbnails,
  deletePhotoFromDatabase,
} from "./photoService";
import { cn } from "./lib/utils";
import PhotoModal from "./PhotoModal";
import PhotoHoverPreview from "./PhotoHoverPreview";
import ToastNotification from "./ToastNotification";
import LocationError from "./LocationError";
import { useAuth } from "./hooks/useAuth";

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Create custom blinking dot icon - mobile-friendly with Tailwind
const locationDot = () => {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: '<div class="w-6 h-6 sm:w-5 sm:h-5 bg-blue-500 border-1 sm:border-1 border-white rounded-full shadow-lg animate-pulse cursor-pointer touch-manipulation select-none"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Create blue dot icon - mobile-friendly with Tailwind responsive classes
const itemDot = () => {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: '<div class="w-6 h-6 sm:w-4 sm:h-4 bg-red-500 border-1 sm:border-1 border-white rounded-full shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-150 touch-manipulation select-none flex items-center justify-center"></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Create loading dot icon with spinning animation
const loadingDot = () => {
  return L.divIcon({
    className: "bg-transparent border-none",
    html: '<div class="w-6 h-6 sm:w-4 sm:h-4 bg-orange-500 border-1 sm:border-1 border-white rounded-full shadow-lg animate-spin touch-manipulation select-none flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};


// Component to handle map initialization
function MapInit() {
  const map = useMap();

  // Add error handling for tile loading
  useEffect(() => {
    const handleTileError = (e) => {
      console.warn("Tile loading error:", e);
    };

    map.on("tileerror", handleTileError);

    return () => {
      map.off("tileerror", handleTileError);
    };
  }, [map]);

  return null;
}

// Component to center map on specified location
function CenterOnLocation({ mapCenter, mapZoom, showLocation }) {
  const map = useMap();

  useEffect(() => {
    if (showLocation && mapCenter) {
      map.setView(mapCenter, mapZoom || 15); // Use provided zoom or default to 15
    }
  }, [map, mapCenter, mapZoom, showLocation]);

  return null;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: onMapClick,
  });
  return null;
}

// Component to handle map move events and update URL
function MapMoveHandler({ onMapMove }) {
  useMapEvents({
    moveend: onMapMove,
  });
  return null;
}

// Simple marker component with reliable event handling for both desktop and mobile
function SimpleMarker({ photo, onMouseEnter, onMouseLeave, onPhotoClick }) {
  const map = useMap();

  useEffect(() => {
    // Create marker with simple icon
    const marker = L.marker([photo.lat, photo.lng], {
      icon: itemDot(),
    });

    // Desktop hover events
    marker.on("mouseover", (e) => {
      onMouseEnter(photo, e.originalEvent);
    });

    marker.on("mouseout", () => {
      onMouseLeave();
    });

    marker.addTo(map);

    // Use timeout to ensure marker is fully rendered
    setTimeout(() => {
      // Add click event AFTER marker is added to map
      marker.on("click", (e) => {
        // Prevent the map's click event from firing
        L.DomEvent.stopPropagation(e);
        onPhotoClick(photo);
      });

      // Touch events for mobile
      marker.on("touchstart", (e) => {
        L.DomEvent.stopPropagation(e);
        // Show hover preview on touch
        onMouseEnter(photo, e.originalEvent);
      });

      marker.on("touchend", (e) => {
        L.DomEvent.stopPropagation(e);
        // Handle the touch click
        onPhotoClick(photo);
        // Keep hover preview visible for a moment
        setTimeout(() => {
          onMouseLeave();
        }, 1000);
      });

      // Also try mousedown as backup for desktop
      marker.on("mousedown", (e) => {
        L.DomEvent.stopPropagation(e);
        onPhotoClick(photo);
      });
    }, 100);

    return () => {
      marker.remove();
    };
  }, [
    photo.id,
    photo.lat,
    photo.lng,
    map,
    onMouseEnter,
    onMouseLeave,
    onPhotoClick,
  ]);

  return null;
}

const MapComponent = () => {
  const [userLocation, setUserLocation] = useState([58.5953, 25.0136]); // Default to Estonia - GPS location
  const [locationError, setLocationError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLocation, setShowLocation] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [clickCoordinates, setClickCoordinates] = useState(null);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [hoveredPhoto, setHoveredPhoto] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [loadingPhotos, setLoadingPhotos] = useState([]);
  const [mapCenter, setMapCenter] = useState(null); // Map view center (can be from URL)
  const [mapZoom, setMapZoom] = useState(15);
  const fileInputRef = useRef(null);

  // Authentication
  const { user, isAdmin } = useAuth();

  // URL synchronization functions
  const updateURL = (lat, lng, zoom) => {
    const url = new URL(window.location);
    url.searchParams.set("lat", lat.toFixed(6));
    url.searchParams.set("lng", lng.toFixed(6));
    url.searchParams.set("zoom", zoom.toString());
    window.history.replaceState({}, "", url);
  };

  const readURLParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get("lat"));
    const lng = parseFloat(urlParams.get("lng"));
    const zoom = parseInt(urlParams.get("zoom"));

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
      return { lat, lng, zoom };
    }
    return null;
  };

  // Initialize location - get GPS location and optionally set map center from URL
  useEffect(() => {
    const urlParams = readURLParams();

    // Always try to get GPS location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setShowLocation(true);
          console.log("GPS location obtained:", latitude, longitude);

          // If URL params exist, use them for map center, otherwise use GPS location
          if (urlParams) {
            setMapCenter([urlParams.lat, urlParams.lng]);
            setMapZoom(urlParams.zoom);
            console.log(
              "Using URL parameters for map center, GPS for blue dot"
            );
          } else {
            setMapCenter([latitude, longitude]);
            console.log("Using GPS location for both map center and blue dot");
          }
          setIsLoading(false);
        },
        (error) => {
          console.warn("Could not get GPS location:", error.message);
          setLocationError(error.message);

          // Fallback: use URL params or default location
          if (urlParams) {
            setMapCenter([urlParams.lat, urlParams.lng]);
            setMapZoom(urlParams.zoom);
            console.log("Using URL parameters as fallback");
          } else {
            setMapCenter([58.5953, 25.0136]); // Default to Estonia
            console.log("Using default location as fallback");
          }
          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        }
      );
    } else {
      console.warn("Geolocation is not supported by this browser");
      setLocationError("Geolocation not supported");

      // Fallback: use URL params or default location
      if (urlParams) {
        setMapCenter([urlParams.lat, urlParams.lng]);
        setMapZoom(urlParams.zoom);
        console.log("Using URL parameters as fallback (no geolocation)");
      } else {
        setMapCenter([58.5953, 25.0136]); // Default to Estonia
        console.log("Using default location as fallback (no geolocation)");
      }
      setIsLoading(false);
    }
  }, []);

  // Load photos from database on component mount
  useEffect(() => {
    const loadPhotos = async () => {
      setIsLoadingPhotos(true);
      try {
        // Try loading with thumbnails first for better performance
        const result = await loadPhotosWithThumbnails(100, 0);
        if (result.success) {
          setCapturedPhotos(result.data);
          console.log(
            `Successfully loaded ${result.data.length} photos with thumbnails`
          );
        } else {
          console.error(
            "Failed to load photos with thumbnails, trying full load:",
            result.error
          );
          // Fallback to full load if thumbnail loading fails
          const fallbackResult = await loadAllPhotosFromDatabase();
          if (fallbackResult.success) {
            setCapturedPhotos(fallbackResult.data);
            console.log(
              `Successfully loaded ${fallbackResult.data.length} photos (full load)`
            );
          } else {
            console.error("Failed to load photos:", fallbackResult.error);
            // You could show a toast notification here
          }
        }
      } catch (error) {
        console.error("Unexpected error loading photos:", error);
      } finally {
        setIsLoadingPhotos(false);
      }
    };

    loadPhotos();
  }, []);

  // Handle map clicks to capture photos (only fires when not clicking on markers)
  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    console.log("MAP CLICKED:", lat, lng);

    // Check admin permission before allowing photo upload
    if (!isAdmin) {
      setToastMessage("Admin permission required to upload photos");
      setToastOpen(true);
      return;
    }

    // Store click coordinates and open camera
    setClickCoordinates({ lat, lng });
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle map move events to update URL
  const handleMapMove = (e) => {
    const map = e.target;
    const center = map.getCenter();
    const zoom = map.getZoom();

    // Update URL with new position and zoom
    updateURL(center.lat, center.lng, zoom);

    // Update local state
    setMapCenter([center.lat, center.lng]);
    setMapZoom(zoom);
  };

  // Handle photo capture with compression
  const handlePhotoCapture = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const tempId = Date.now();
      const coordinates = {
        lat: clickCoordinates?.lat || userLocation[0],
        lng: clickCoordinates?.lng || userLocation[1],
      };

      try {
        // Compress the image before processing
        const options = {
          maxSizeMB: 2, // Maximum file size in MB
          maxWidthOrHeight: 1920, // Maximum width or height in pixels
          useWebWorker: true, // Use web worker for better performance
          quality: 0.8, // Quality from 0 to 1 (0.8 = 80% quality)
        };

        console.log(
          `Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`
        );
        const compressedFile = await imageCompression(file, options);
        console.log(
          `Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(
            2
          )} MB`
        );

        const reader = new FileReader();
        reader.onload = async (e) => {
          const photoData = {
            id: tempId,
            lat: coordinates.lat,
            lng: coordinates.lng,
            imageData: e.target.result,
            image_data: e.target.result,
            timestamp: new Date().toISOString(),
            filename: compressedFile.name || file.name,
            type: "target",
            name: null, // Will be set after save with database id
          };

          // Add loading indicator
          const loadingPhoto = {
            id: tempId,
            lat: coordinates.lat,
            lng: coordinates.lng,
            isLoading: true,
          };
          setLoadingPhotos((prev) => [...prev, loadingPhoto]);

          // Save directly to database
          const result = await savePhotoToDatabase(photoData, user);

          // Remove loading indicator
          setLoadingPhotos((prev) => prev.filter((photo) => photo.id !== tempId));

          if (result.success) {
            // Set name as "Target {database_id}"
            const savedPhoto = {
              ...result.data,
              imageData: result.data.image_data,
              name: `Target ${result.data.id}`,
            };

            // Update name in database
            const { updatePhotoDetails } = await import("./photoService");
            await updatePhotoDetails(result.data.id, `Target ${result.data.id}`, null, user);

            setCapturedPhotos((prev) => [...prev, savedPhoto]);
            console.log("Photo saved to database successfully");
            setToastMessage("Photo saved successfully!");
            setToastOpen(true);
          } else {
            console.error("Failed to save photo to database:", result.error);
            setToastMessage("Failed to save photo");
            setToastOpen(true);
          }
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error("Error compressing image:", error);
        setToastMessage("Error compressing image");
        setToastOpen(true);
      }
    }

    // Reset input
    event.target.value = "";
  };

  // Handle photo deletion
  const handleDeletePhoto = async (photoId) => {
    try {
      const result = await deletePhotoFromDatabase(photoId, user);
      if (result.success) {
        setCapturedPhotos((prev) =>
          prev.filter((photo) => photo.id !== photoId)
        );
        console.log("Photo deleted successfully");
        setToastMessage("Photo deleted successfully!");
        setToastOpen(true);
      } else {
        console.error("Failed to delete photo:", result.error);
        setToastMessage("Failed to delete photo");
        setToastOpen(true);
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
    }
  };

  // Handle mouse hover events with useCallback to prevent re-renders
  const handleMouseEnter = useCallback((photo, event) => {
    setHoveredPhoto(photo);
    setMousePosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (hoveredPhoto) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredPhoto]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredPhoto(null);
  }, []);

  // Handle photo selection for modal with useCallback
  const handlePhotoClick = useCallback((photo) => {
    setSelectedPhoto(photo);
    setShowModal(true);
  }, []);

  // Handle modal close
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPhoto(null);
  };


  if (isLoading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "18px",
          color: "#666",
        }}
      >
        Getting your location...
      </div>
    );
  }

  return (
    <div
      className="w-full h-full m-0 p-0 touch-manipulation select-none"
      style={{ width: "100%", height: "100%", margin: 0, padding: 0 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hidden file input for photo selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePhotoCapture}
      />

      {/* Photo Hover Preview */}
      <PhotoHoverPreview
        hoveredPhoto={hoveredPhoto}
        mousePosition={mousePosition}
        onHoverChange={setHoveredPhoto}
      />

      {/* Photo Modal */}
      <PhotoModal
        showModal={showModal}
        setShowModal={setShowModal}
        selectedPhoto={selectedPhoto}
        onDeletePhoto={handleDeletePhoto}
        isAdmin={isAdmin}
        user={user}
      />

      <LocationError locationError={locationError} />
      <MapContainer
        center={mapCenter || userLocation}
        zoom={mapZoom}
        className="w-full h-full touch-manipulation select-none"
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
      >
        <MapInit />
        <CenterOnLocation
          mapCenter={mapCenter}
          mapZoom={mapZoom}
          showLocation={showLocation}
        />
        <MapClickHandler onMapClick={handleMapClick} />
        <MapMoveHandler onMapMove={handleMapMove} />

        {/* Esri Satellite Imagery */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          minZoom={1}
        />

        {/* Current location marker with blinking dot - clicking triggers photo upload */}
        {showLocation && (
          <Marker
            position={userLocation}
            icon={locationDot()}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (!isAdmin) {
                  setToastMessage("Admin permission required to upload photos");
                  setToastOpen(true);
                  return;
                }
                setClickCoordinates({ lat: userLocation[0], lng: userLocation[1] });
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              },
            }}
          />
        )}

        {/* Captured photos markers with simple event handling */}
        {capturedPhotos.map((photo) => (
          <SimpleMarker
            key={photo.id}
            photo={photo}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onPhotoClick={handlePhotoClick}
          />
        ))}

        {/* Loading photos markers */}
        {loadingPhotos.map((loadingPhoto) => (
          <Marker
            key={`loading-${loadingPhoto.id}`}
            position={[loadingPhoto.lat, loadingPhoto.lng]}
            icon={loadingDot()}
          >
            <Popup>
              <div>
                <strong>Uploading...</strong>
                <br />
                Syncing to database
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Example of how to add custom tile layer (commented out for now) */}
        {/* 
        <TileLayer
          attribution='Your custom attribution'
          url="https://your-custom-tile-server.com/{z}/{x}/{y}.png"
        />
        */}
      </MapContainer>

      {/* Toast notifications */}
      <ToastNotification
        toastOpen={toastOpen}
        setToastOpen={setToastOpen}
        toastMessage={toastMessage}
      />
    </div>
  );
};

export default MapComponent;
