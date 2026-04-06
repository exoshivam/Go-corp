import { getDistance } from "../../utils/geo.js";

const CLUSTER_RADIUS = 2000; 

export function clusterRequests(requests) {
  const clusters = [];

  for (let req of requests) {
    let added = false;

    for (let cluster of clusters) {
      
      const base = cluster[0];

      const dist = getDistance(
        req.pickup_location.coordinates,
        base.pickup_location.coordinates
      );

      if (dist <= CLUSTER_RADIUS) {
        cluster.push(req);
        added = true;
        break;
      }
    }

    if (!added) {
      clusters.push([req]); // Start a new cluster with this request as the base
    }
  }

  return clusters;
}