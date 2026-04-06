# Ride Polling & Clustering System

## Overview

A comprehensive ride clustering and batching system for an employee cab management application. This module intelligently groups employee ride requests to maximize occupancy (up to 4 passengers per cab) while respecting employee preferences and geographic constraints.

## Architecture

### System Flow

```
RideRequest (Initial booking)
    ↓
Submit to Clustering
    ↓
    ├─ Case 1: Solo + Solo Preference → Direct to Batched
    ├─ Case 2: Single Person → Create Clustering Entry
    ├─ Case 3: Another Single → Check Clustering Matches
    ├─ Case 4: Group of 2 → Check size ≤ 2 Clusters
    ├─ Case 5: Group of 3 → Check size = 1 Clusters
    └─ Case 6: Full Group (4) → Direct to Batched
    ↓
Clustering (Active matching phase)
    ↓
Force-Batch Job (Runs every minute)
    ↓
BatchedRide (Ready for driver assignment)
    ↓
Driver Assignment
```

## Database Models

### 1. Clustering Model
Intermediate stage for rides being evaluated and grouped.

```javascript
{
  office_id: ObjectId,
  ride_request_ids: [ObjectId],        // Array of rides in cluster
  total_size: Number,                   // Total passengers (max 4)
  scheduled_at: Date,                   // Scheduled ride time
  pickup_location: GeoJSON Point,       // Cluster pickup
  drop_location: GeoJSON Point,         // Cluster drop
  route_polyline: [[lng, lat]],         // Optimized route
  pickup_order: Map<ride_id, order>,    // Pickup sequence
  status: "ACTIVE" | "FULL" | "BATCHED",
  batch_id: ObjectId,                   // Reference to BatchedRide if batched
  metadata: { reason_for_clustering },
  created_at: Date,
  updated_at: Date
}
```

### 2. BatchedRide Model
Final grouped rides ready for driver assignment.

```javascript
{
  office_id: ObjectId,
  ride_request_ids: [ObjectId],        // All rides in batch
  total_size: Number,                   // Total passengers
  scheduled_at: Date,
  pickup_location: GeoJSON Point,
  drop_location: GeoJSON Point,
  route_polyline: [[lng, lat]],
  pickup_order: Map<ride_id, order>,
  status: "PENDING" | "ASSIGNED" | "ACCEPTED" | "IN_TRANSIT" | "COMPLETED",
  driver_id: ObjectId,                  // Assigned driver
  clustering_id: ObjectId,              // Reference to original cluster
  batch_reason: "SOLO" | "FORCE_BATCH" | "FULL_SIZE" | "REACHED_SIZE_4",
  assigned_at: Date,
  created_at: Date,
  updated_at: Date
}
```

## Core Logic

### Clustering Rules (`canCluster` function)

A ride can cluster with another if **ANY** of these conditions are true:

1. **Condition 1**: Similar pickup location + similar drop location + within time window
   - Pickup distance threshold: 500m
   - Drop distance threshold: 500m
   - Time window: ±10 minutes

2. **Condition 2**: Pickup within route buffer + similar drop location + within time window
   - Route buffer: 500m (polyline distance)
   - Drop distance threshold: 500m
   - Time window: ±10 minutes

### Two-Step Polyline Pre-Filter

For efficiency, polyline route buffer checking uses a two-step approach:

**Step 1 (Cheap Pre-Filter)**:
- Check bearing similarity (±30 degree tolerance)
- Check bounding box overlap

**Step 2 (Full Check)**:
- Only if Step 1 passes: Compute actual polyline route buffer
- Uses @turf/turf for accurate distance calculation

## Case Handlers

### Case 1: Solo with Solo Preference
```
Input: Group size = 1, solo_preference = true
Action: Skip clustering → Direct to Batched
Reason: User wants to travel alone
Output: BatchedRide with batch_reason = "SOLO"
```

### Case 2: Single Person, No Preference
```
Input: Group size = 1, solo_preference = false
Action: Create Clustering entry (no check needed, first entry)
Reason: First entry in clustering pool
Output: Clustering entry, status = ACTIVE
```

### Case 3: Another Single Person
```
Input: Group size = 1, solo_preference = false
Action: Check canCluster against all existing Clustering entries
   If match found: Merge into cluster
   If no match: Create own Clustering entry
Output: Either merged into existing or new Clustering entry
```

### Case 4: Group of 2
```
Input: Group size = 2 (1 + 1 invited)
Action: Check canCluster only against clusters with size 1 or 2
   If merged to size 4: Move to Batched immediately
   If not merged: Create own Clustering entry
Output: Either Batched (if size 4) or new Clustering entry
```

### Case 5: Group of 3
```
Input: Group size = 3 (1 + 2 invited)
Action: Check canCluster only against clusters with size = 1
   If merged: Total = 4, move to Batched immediately
   If not merged: Create own Clustering entry
Output: Either Batched (guaranteed size 4) or new Clustering entry
```

### Case 6: Full Group of 4
```
Input: Group size = 4 (1 + 3 invited)
Action: Skip clustering → Direct to Batched
Reason: Already at maximum capacity
Output: BatchedRide with batch_reason = "FULL_SIZE"
```

## Optimization Features

### Size-Based Prioritization
When a new ride of size 2 or larger arrives and searches for clustering matches, clusters are sorted by size (descending). This prioritizes matching with other larger groups first, maximizing chances of reaching batch size 4 quickly.

```javascript
// Example: Size 2 ride checking against clusters
Sorted order: [size-2 cluster, size-2 cluster, size-1 cluster, size-1 cluster]
```

### Backend Validation
**Critical**: The backend validates that a ride request group size never exceeds 4, regardless of frontend validation:

```javascript
RideRequest model:
  invited_employee_ids: {
    validate: {
      validator: function(v) {
        return v.length <= 3;  // Max 3 invited = 4 total with requester
      }
    }
  }
```

## Scheduled Force-Batch Job

### Behavior
- **Frequency**: Runs every minute
- **Trigger**: Clusters with `scheduled_at ≤ now + 10 minutes`
- **Action**: Force-batch the cluster immediately

### Purpose
Ensures clusters are batched with at least 10 minutes buffer before scheduled time, allowing:
1. Driver assignment
2. Driver notifications and acceptance
3. Pickup coordination

### Example
```
Now: 2024-04-06 14:00:00
Job checks for: scheduled_at ≤ 2024-04-06 14:10:00

If cluster.scheduled_at = 2024-04-06 14:09:50
→ Force-batch immediately

If cluster.scheduled_at = 2024-04-06 14:15:00
→ Skip (still 15 minutes away)
```

## API Endpoints

### 1. Submit Ride for Clustering
```
POST /api/clustering/submit-ride
Authorization: User token

Request:
{
  "ride_id": "507f1f77bcf86cd799439011"
}

Response:
{
  "statusCode": 200|201|202,
  "message": "Ride processed",
  "data": {
    "ride_id": "...",
    "type": "SOLO" | "CLUSTERING" | "BATCHED",
    "cluster_id": "...",  // if type CLUSTERING
    "batch_id": "...",    // if type SOLO or BATCHED
    "destination": "BATCHED" | "CLUSTERING"
  }
}
```

### 2. Get Ride Clustering Status
```
GET /api/clustering/ride-status/:ride_id
Authorization: User token

Response:
{
  "statusCode": 200,
  "data": {
    "ride_id": "...",
    "status": "IN_CLUSTERING" | "BOOKED_SOLO" | ...,
    "group_size": 1|2|3|4,
    "clustering": {
      "cluster_id": "...",
      "cluster_size": 2,
      "cluster_status": "ACTIVE",
      "other_rides_in_cluster": 1
    },
    "batched": {
      "batch_id": "...",
      "batch_size": 2,
      "batch_status": "PENDING",
      "driver_id": "...",
      "other_rides_in_batch": 1
    }
  }
}
```

### 3. Get Active Clusters for Office
```
GET /api/clustering/clusters/:office_id?scheduled_at=ISO8601
Optional: filter by scheduled_at

Response:
{
  "data": {
    "count": 5,
    "clusters": [
      {
        "_id": "...",
        "total_size": 3,
        "status": "ACTIVE",
        "ride_request_ids": [...]
      }
    ]
  }
}
```

### 4. Get Batched Rides for Office
```
GET /api/clustering/batched/:office_id?status=PENDING
Optional: filter by status (PENDING, ASSIGNED, etc.)

Response:
{
  "data": {
    "count": 10,
    "batches": [...]
  }
}
```

### 5. Get Cluster Details
```
GET /api/clustering/cluster/:cluster_id

Response: Complete cluster info with all rides and their details
```

### 6. Get Batch Details
```
GET /api/clustering/batch/:batch_id

Response: Complete batch info with driver assignment details
```

### 7. Force-Batch a Cluster
```
POST /api/clustering/force-batch/:cluster_id
Authorization: Admin/System token

Request:
{
  "reason": "Optional reason"
}

Response:
{
  "data": {
    "cluster_id": "...",
    "batch_id": "...",
    "batch_size": 2
  }
}
```

### 8. Get Clustering Statistics
```
GET /api/clustering/stats/:office_id

Response:
{
  "data": {
    "clustering": {
      "active": 5,
      "full": 2,
      "batched": 10,
      "total": 17
    },
    "batched": {
      "pending": 8,
      "assigned": 2,
      "total": 10
    }
  }
}
```

## Integration with Existing System

### With User Authentication
All endpoints respect the existing auth middleware. User endpoints require `authUser` token.

### With RideRequest Model
The system works in conjunction with existing ride bookings:
1. Employee books ride via `/api/ride/book-ride`
2. Ride is created with status = "PENDING"
3. Then submitted to clustering via `/api/clustering/submit-ride`
4. Status updates to "IN_CLUSTERING" or "BOOKED_SOLO"

### With Geospatial Data
- Uses @turf/turf library for accurate polyline distance calculations
- Uses existing `getRoute` function from OSRM for polyline generation
- Uses existing `getDistance` function for bearing and location calculations

## Validation & Constraints

1. **Group Size**: Max 4 passengers (enforced in RideRequest model)
2. **Cluster Size**: Max 4 passengers (enforced in Clustering model)
3. **Batch Size**: Max 4 passengers (enforced in BatchedRide model)
4. **Time Window**: ±10 minutes from scheduled time
5. **Route Buffer**: 500 meters for polyline distance
6. **Location Threshold**: 500 meters for similar pickup/drop

## Performance Optimizations

1. **Database Indexes**:
   - `{ office_id: 1, status: 1, scheduled_at: 1 }`
   - `{ office_id: 1, scheduled_at: 1 }`
   - `{ pickup_location: "2dsphere" }`
   - `{ status: 1, scheduled_at: 1 }` (for force-batch job)

2. **Two-Step Polyline Check**:
   - Step 1: Bearing + bounding box (O(1) operations)
   - Step 2: Actual polyline distance (only if Step 1 passes)

3. **Scheduled Job Efficiency**:
   - Runs once per minute (not constantly)
   - Only checks clusters within 10-minute window
   - Batch processes all matching clusters

## File Structure

```
src/modules/clustering/
├── clustering.model.js          # Clustering model schema
├── batched.model.js             # BatchedRide model schema
├── clustering.service.js        # Core clustering logic (canCluster, preFilter)
├── clustering.handler.js        # Case handlers (6 cases)
├── clustering.controller.js     # API controllers
├── clustering.routes.js         # Route definitions
└── scheduling.job.js            # Force-batch cron job
```

## Usage Example

### Complete Flow

```javascript
// Step 1: Employee books a ride
const ride = await RideRequest.create({
  employee_id,
  office_id,
  scheduled_at: "2024-04-06T14:30:00Z",
  pickup_location: {...},
  drop_location: {...},
  invited_employee_ids: ["id1"],  // 1 invited = group size 2
  solo_preference: false
});

// Step 2: Submit to clustering system
POST /api/clustering/submit-ride
{ "ride_id": ride._id }

// System processes through Case 4:
// - Checks existing clusters of size 1 or 2
// - If compatible cluster found: merges
// - If total size becomes 4: moves to Batched
// - Otherwise: creates new Clustering entry

// Step 3: Check status anytime
GET /api/clustering/ride-status/:ride_id

// Step 4: Force-batch job runs (every minute)
// - Finds clusters with scheduled_at ≤ now + 10 min
// - Moves them to Batched if not already there

// Step 5: Driver assignment system takes over
// - Fetches from BatchedRide with status PENDING
// - Assigns driver
// - Updates batch status to ASSIGNED
```

## Testing Scenarios

### Scenario 1: Two Solo Employees (No Preference)
```
Time: 14:00
T1: Employee A books solo (no preference)
  → Case 2: Creates Clustering entry, size 1

T2: Employee B books solo (no preference), similar location/time
  → Case 3: Matches with A via canCluster
  → Merged, Clustering size = 2, status ACTIVE

T3: Force-batch job at 14:19 (scheduled time was 14:20)
  → Moves to Batched, ready for driver assignment
```

### Scenario 2: Mix of Group Sizes
```
T1: Employee A + 1 invited (size 2, no solo pref)
  → Case 4: Creates Clustering, size 2

T2: Employee B alone (no pref), matches geographically
  → Case 3: Matches with A's cluster? No (size 2 + 1 = 3, allowed)
  → Actually merges: Clustering becomes size 3

T3: Employee C alone (no pref), matches??
  → Case 3: Tries to match with size-3 cluster? Size 3 + 1 = 4 ✓
  → Merges: Clustering size 4
  → Immediately moves to Batched (REACHED_SIZE_4)
```

## Debugging & Monitoring

### Check Cluster Health
```javascript
GET /api/clustering/stats/:office_id

Returns:
- Active clusters count
- Full clusters count
- Pending batches count
- Assigned batches count
```

### View Specific Cluster
```javascript
GET /api/clustering/cluster/:cluster_id

Shows:
- All rides in cluster
- Polyline route
- Size history
- Creation reason
```

### Monitor Force-Batch Job
The job logs to console:
```
[2024-04-06T14:00:00Z] Running force-batch job...
[2024-04-06T14:00:15Z] Found 3 clusters to force-batch
[2024-04-06T14:00:18Z] Force-batch job completed: 3 success, 0 errors
```

## Future Enhancements

1. **Machine Learning Models**: Predict clustering success rates
2. **Driver Balancing**: Distribute routes fairly among drivers
3. **Real-Time Updates**: WebSocket notifications for status changes
4. **Dynamic Time Windows**: Adjust ±10 min based on traffic
5. **Preference Matching**: Respect employee friendship groups
6. **Cost Optimization**: Minimize total route distance/time
7. **A/B Testing**: Compare different clustering strategies

---

**Version**: 1.0  
**Last Updated**: April 2024  
**Maintainer**: Engineering Team
