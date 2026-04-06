# Clustering System - Quick Start Guide

## ⚠️ IMPORTANT: Before Testing

**Critical Requirements for Testing:**

1. **Scheduled Time Must Be FUTURE** (not past)
   - ❌ DON'T use: `"scheduled_at": "2024-04-06T14:30:00Z"` (2024 is past)
   - ✅ DO use: `"scheduled_at": "2026-04-07T14:30:00Z"` (future date)
   - Server rejects rides more than 5 minutes in the past

2. **Use Your Office Location**
   - Your office: Noida, Uttar Pradesh
   - Coordinates: `[77.3255, 28.5706]` (longitude, latitude)
   - ❌ DON'T use old coordinates: `[72.8479, 19.0760]` (those are from example)

3. **Use Proper Office Hours**
   - Your office: 00:00 - 23:59 daily
   - Can schedule rides anytime during the day

👉 **See [QUICK_TEST_COMMANDS.md](../../QUICK_TEST_COMMANDS.md) for copy-paste ready commands!**

---

## How to Use the Clustering System

### 1. For Employees (Frontend Integration)

**Step 1: Book a Ride**
```javascript
// Call existing ride booking endpoint
POST /api/ride/book-ride
{
  "employee_id": "user123",
  "office_id": "office456",
  "pickup_location": { "coordinates": [77.3255, 28.5706] },      // Noida office
  "drop_location": { "coordinates": [77.3300, 28.5750] },        // Nearby location
  "scheduled_at": "2026-04-07T14:30:00Z",                       // FUTURE DATE (2026)
  "destination_type": "OFFICE",
  "solo_preference": false,                                        // true = skip clustering
  "invited_employee_ids": ["emp1", "emp2"]                        // Optional: 0-3 people
}

Response: { ride_id, status: "PENDING" }
```

**Step 2: Submit to Clustering**
```javascript
// This triggers the clustering logic
POST /api/clustering/submit-ride
{
  "ride_id": "ride123"
}

Response:
{
  "statusCode": 202,                    // 202 = clustering, 201 = batched
  "data": {
    "type": "CLUSTERING",               // or "SOLO", "BATCHED"
    "destination": "CLUSTERING",        // or "BATCHED"
    "cluster_id": "cluster789"          // if clustering
  }
}
```

**Step 3: Check Status Anytime**
```javascript
GET /api/clustering/ride-status/ride123

Response:
{
  "status": "IN_CLUSTERING",            // Current status
  "group_size": 2,                      // Requester + invited
  "clustering": {
    "cluster_size": 3,
    "other_rides_in_cluster": 1
  }
}
```

### 2. For Administrators (Backend Operations)

**Monitor Clustering Activity**
```javascript
// Get statistics for an office
GET /api/clustering/stats/office123

// View active clusters
GET /api/clustering/clusters/office123

// View batched rides ready for assignment
GET /api/clustering/batched/office123?status=PENDING

// View specific cluster details
GET /api/clustering/cluster/cluster789

// View specific batch details
GET /api/clustering/batch/batch999
```

**Manual Force-Batch (if needed)**
```javascript
POST /api/clustering/force-batch/cluster789
{
  "reason": "Admin override - schedule change"
}
```

### 3. For Drivers (Status Tracking)

**View Your Upcoming Batches**
```javascript
// After being assigned, driver can view batch details
GET /api/clustering/batch/batch999

Returns:
- All rides in batch
- Pickup order
- Route polyline
- All employee details
```

---

## System Behavior by Scenario

### Scenario A: Solo Employee with Preference
```
Employee A books:
  - Solo ride (no invited employees)
  - solo_preference: true

Result: 
  → Sent IMMEDIATELY to Batched
  → Status: BOOKED_SOLO
  → Ready for driver assignment
  → No clustering
```

### Scenario B: Solo Employee without Preference  
```
Employee A books:
  - Solo ride
  - solo_preference: false

Result:
  → Added to Clustering pool
  → Status: IN_CLUSTERING
  → Waits for compatible rides
```

### Scenario C: Two People Get Lucky
```
Time 14:00: Employee A books solo, no preference
  → Creates Clustering entry, size 1, status ACTIVE

Time 14:02: Employee B books solo, no preference
            Same office, same scheduled time
            Similar pickup location (within 500m)
            Similar drop location (within 500m)

Result:
  → B matches with A (canCluster returns true)
  → Merged into same cluster
  → Cluster size now 2
  → Status: ACTIVE (waiting for one more or force-batch)

Time 14:19: Force-batch job runs
  → Cluster scheduled time was 14:20 (1 min away)
  → Force-batch triggered (within 10min threshold)
  → Cluster → Batched (size 2)
  → Status: PENDING (ready for driver)
```

### Scenario D: Group of 4 Reaches Target
```
Time 14:00: Employee A + 1 invited (size 2) → Creates cluster size 2

Time 14:03: Employee C alone (matches) → Merges, cluster size 3

Time 14:05: Employee D alone (matches) → Merges, cluster size 4
  → IMMEDIATELY moves to Batched (reached size 4)
  → No need to wait for force-batch job
```

### Scenario E: Group of 3 Finds Perfect Match
```
Employee X + 2 invited (size 3):
  → System searches for clusters with size = 1 only
     (because 3 + 1 = 4, any other size fails)
  
  Found: Employee Y (size 1 cluster)
  → Merges: 3 + 1 = 4
  → IMMEDIATELY to Batched
  → Both groups now ride together
```

---

## Key Constraints & Validations

### 1. Maximum Group Size
```
- Frontend: Can invite max 3 people (4 total with requester)
- Backend: Validates max 3 in invited_employee_ids array
- Cluster: Enforces max 4 total passengers
```

### 2. Geographic Thresholds
```
- Similar Pickup: Both rides' pickups within 500m
- Similar Drop: Both rides' drops within 500m
- Route Buffer: New pickup within 500m of existing route polyline
```

### 3. Time Windows
```
- Clustering Window: ±10 minutes from scheduled time
- Force-Batch Threshold: Within 10 minutes before scheduled time
- Example: If ride scheduled at 14:30
  - Clustering matches: 14:20 to 14:40
  - Force-batch triggers at: 14:20 or later
```

---

## Common Use Cases

### Use Case 1: Regular Commute
```
Employee books regularly at 8:30 AM
- If solo_preference = true: Always direct to batched (consistent solo rides)
- If solo_preference = false: May cluster with others, varied experience
```

### Use Case 2: Group Outings
```
Team of 4 going to off-site
- Book together with 3 invited employees
- Case 6 triggers: Direct to batched, no wait
- Simple, immediate assignment
```

### Use Case 3: Hybrid Group
```
Employee A: Alone (no preference)
Employee B: Alone (no preference)  
Employee C + D: Group of 2, no preference

System intelligently combines:
- A + B: Size 1+1=2 (if similar location/time)
- C+D: Size 2 (kept together)
- Or: A+C+D=4 (if compatible)
```

---

## Environment Variables & Configuration

Required in .env:
```
MONGO_URI=mongodb://...
JWT_SECRET=your_secret
PORT=5000
```

The system needs:
- Node.js 14+
- MongoDB with geospatial indexes
- Internet access to OSRM (for polylines)
- @turf/turf library (already in dependencies)
- node-cron library (already in dependencies)

---

## Troubleshooting

### Problem: Ride not getting clustered
**Check**:
1. Is solo_preference = true? (If yes, intended for solo only)
2. Are there other rides in Clustering pool?
3. Do they meet geographic thresholds? (500m distance)
4. Are they within time window? (±10 minutes)
5. Is cluster size already at max? (4 passengers)

### Problem: Cluster not batching
**Check**:
1. Is timestamp correct? (Check scheduled_at)
2. Has force-batch job triggered? (Usually within 10 min)
3. Is cluster status still ACTIVE? (Check database)

### Problem: Driver not assigned
**Check**:
1. Is batch status PENDING? (Must be PENDING for assignment)
2. Does batch_id exist in RideRequest? (Check data consistency)
3. Are there available drivers? (Check driver availability)

---

## API Response Codes

```
200 OK           - General success
201 CREATED      - Ride sent to Batched (ready)
202 ACCEPTED     - Ride sent to Clustering (pending)
400 BAD REQUEST  - Invalid input (max group size, invalid times)
401 UNAUTHORIZED - Missing/invalid auth token
404 NOT FOUND    - Resource not found
500 ERROR        - Server error
```

---

## Testing Checklist

- [ ] Solo ride with preference goes directly to Batched
- [ ] Solo ride without preference goes to Clustering
- [ ] Two compatible solos merge in Clustering
- [ ] Group of 2 can cluster with group of 1
- [ ] Group of 3 can only cluster with group of 1
- [ ] Group of 4 goes directly to Batched
- [ ] Incompatible rides don't merge (different locations)
- [ ] Rides outside time window don't merge
- [ ] Force-batch job triggers within 10 minutes
- [ ] Cluster size never exceeds 4
- [ ] Polyline route buffer works (500m threshold)
- [ ] Status updates are consistent across models

---

## Integration Checklist

- [x] Clustering models created (Clustering, BatchedRide)
- [x] Core service with can_cluster function
- [x] 6 case handlers implemented
- [x] Controllers with API endpoints
- [x] Routes registered in server.js
- [x] Force-batch job started on server startup
- [x] Two-step polyline optimization
- [x] Documentation complete

Ready to test! 🚀
