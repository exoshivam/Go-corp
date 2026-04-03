import * as turf from "@turf/turf";

export const orderCluster = (cluster) => {

  // sort by distance to office (farthest first)
  const sorted = cluster.sort((a, b) => {
    const d1 = turf.distance(
      turf.point(a.pickup_location.coordinates),
      turf.point(a.drop_location.coordinates),
      { units: "meters" }
    );

    const d2 = turf.distance(
      turf.point(b.pickup_location.coordinates),
      turf.point(b.drop_location.coordinates),
      { units: "meters" }
    );

    return d2 - d1;
  });

  return sorted;
};

export const getRouteFromOSRM = async (orderedCluster) => {

  const coordinates = orderedCluster.map(r =>
    `${r.pickup_location.coordinates[0]},${r.pickup_location.coordinates[1]}`
  );

  // add office at end
  const office = orderedCluster[0].drop_location.coordinates;
  coordinates.push(`${office[0]},${office[1]}`);

  const url = `http://router.project-osrm.org/route/v1/driving/${coordinates.join(";")}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  const data = await res.json();

  return data.routes[0];
};

export const processClusterRoute = async (cluster) => {

  // 1. Order cluster
  const ordered = orderCluster(cluster);

  // 2. Get route
  const route = await getRouteFromOSRM(ordered);

  return {
    ordered,
    route
  };
};