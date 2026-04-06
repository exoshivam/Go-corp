import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import "./leafletFix";
import L from "leaflet";

const pickupIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
});

const dropIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
});

export default function MapView() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/rideRequest/map")
      .then(res => res.json())
      .then(data => {
        console.log("API DATA:", data);
        setRides(data.rides || []);
      })
      .catch(err => console.error(err));
  }, []);

  const colors = ["red", "blue", "green", "purple", "orange"];

  return (
    <MapContainer
      center={[28.5706, 77.3255]}
      zoom={11}
      style={{ height: "100vh", width: "100%" }}
    >
      {/* OpenStreetMap */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {rides.map((ride, i) => {
        const pickup = ride.pickup_location.coordinates;
        const drop = ride.drop_location.coordinates;

        return (
          <div key={i}>
            {/* Pickup */}
            <Marker
              position={[pickup[1], pickup[0]]}
              icon={pickupIcon}
            >
              <Popup>
                🟢 Pickup <br />
                {ride.pickup_address || "Location"}
              </Popup>
            </Marker>

            {/* Drop */}
            <Marker
              position={[drop[1], drop[0]]}
              icon={dropIcon}
            >
              <Popup>
                🔴 Drop <br />
                {ride.drop_address || "Location"}
              </Popup>
            </Marker>

            {/* Route Line */}
            {ride.route && ride.route.length > 0 && (
              <Polyline
                positions={ride.route.map(coord => [coord[1], coord[0]])}
                color={["red", "blue", "green", "purple"][i % 4]}
                weight={5}
                opacity={0.8}
              />
            )}
          </div>
        );
      })}
    </MapContainer>
  );
}