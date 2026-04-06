import axios from "axios";

export async function buildRoute(cluster) {
  const coords = [];

  for (let req of cluster) {
    coords.push(req.pickup_location.coordinates.join(","));
    coords.push(req.drop_location.coordinates.join(","));
  }

  const coordString = coords.join(";");

  const url = `http://router.project-osrm.org/trip/v1/driving/${coordString}?overview=full&geometries=geojson`;

  const res = await axios.get(url);

  const trip = res.data.trips[0];

  console.log(trip.distance, trip.duration);

  return {
    geometry: trip.geometry.coordinates,
    distance: trip.distance,
    duration: trip.duration
  };
}