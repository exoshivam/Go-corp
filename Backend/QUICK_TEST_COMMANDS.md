# 🧪 Quick Testing Reference - Copy & Paste Commands

## Fix Applied
Changed all test dates from **2024** to **2026** (current year) and coordinates to your Noida office: **[77.3255, 28.5706]**

## Quick Start - Test in This Order

### 1️⃣ HEALTH CHECK
```bash
curl http://localhost:5000/api/health
```
✅ Should return: `{"success":true,"message":"Server is healthy"}`

---

### 2️⃣ SCENARIO 1: Solo with Preference → Direct to Batched

```bash
# Create solo ride with preference
RIDE_ID=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "507f1f77bcf86cd799439011",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3255, 28.5706]},
    "drop_location": {"type": "Point", "coordinates": [77.3300, 28.5750]},
    "scheduled_at": "2026-04-07T14:30:00Z",
    "destination_type": "OFFICE",
    "pickup_address": "Office Building A",
    "drop_address": "Meeting Room B",
    "solo_preference": true,
    "invited_employee_ids": []
  }' | jq -r '.data._id')

echo "Ride created: $RIDE_ID"

# Submit to clustering
curl -X POST http://localhost:5000/api/clustering/submit-ride \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d "{\"ride_id\": \"$RIDE_ID\"}" | jq .

# Check status
curl -X GET http://localhost:5000/api/clustering/ride-status/$RIDE_ID \
  -H "Authorization: Bearer {token}" | jq '.data | {status, type: .clustering, batched: .batched}'
```

✅ **Expected**: 
- type: "SOLO"
- destination: "BATCHED"
- status in response: "BOOKED_SOLO"

---

### 3️⃣ SCENARIO 2: Two Singles Merge in Clustering

```bash
# Create first solo ride
RIDE1=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "507f1f77bcf86cd799439011",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3255, 28.5706]},
    "drop_location": {"type": "Point", "coordinates": [77.3300, 28.5750]},
    "scheduled_at": "2026-04-08T14:30:00Z",
    "destination_type": "OFFICE",
    "pickup_address": "Home 1",
    "drop_address": "Office",
    "solo_preference": false,
    "invited_employee_ids": []
  }' | jq -r '.data._id')

# Create second solo ride (similar location, slightly different time)
RIDE2=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "507f1f77bcf86cd799439013",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3260, 28.5710]},
    "drop_location": {"type": "Point", "coordinates": [77.3305, 28.5755]},
    "scheduled_at": "2026-04-08T14:32:00Z",
    "destination_type": "OFFICE",
    "pickup_address": "Home 2",
    "drop_address": "Office",
    "solo_preference": false,
    "invited_employee_ids": []
  }' | jq -r '.data._id')

echo "Ride 1: $RIDE1"
echo "Ride 2: $RIDE2"

# Submit both
curl -s -X POST http://localhost:5000/api/clustering/submit-ride \
  -H "Authorization: Bearer {token}" \
  -d "{\"ride_id\": \"$RIDE1\"}" | jq '.data.cluster_id'

CLUSTER_ID=$(curl -s -X POST http://localhost:5000/api/clustering/submit-ride \
  -H "Authorization: Bearer {token}" \
  -d "{\"ride_id\": \"$RIDE2\"}" | jq -r '.data.cluster_id')

# Check cluster (should have both rides)
curl -X GET http://localhost:5000/api/clustering/cluster/$CLUSTER_ID | jq '.data | {total_size, rides: .rides | length}'
```

✅ **Expected**:
- Both rides have same cluster_id
- cluster_size: 2
- rides in cluster: 2

---

### 4️⃣ SCENARIO 3: Reaches Size 4 → Auto-Batch

```bash
# Create group of 2 (1 + 1 invited)
RIDE_G1=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -H "Authorization: Bearer {token}" \
  -d '{
    "employee_id": "emp_g1",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3255, 28.5706]},
    "drop_location": {"type": "Point", "coordinates": [77.3300, 28.5750]},
    "scheduled_at": "2026-04-09T15:00:00Z",
    "destination_type": "OFFICE",
    "solo_preference": false,
    "invited_employee_ids": ["emp_g2"]
  }' | jq -r '.data._id')

# Create solo that matches
RIDE_G3=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -d '{
    "employee_id": "emp_g3",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3258, 28.5708]},
    "drop_location": {"type": "Point", "coordinates": [77.3303, 28.5753]},
    "scheduled_at": "2026-04-09T15:02:00Z",
    "destination_type": "OFFICE",
    "solo_preference": false,
    "invited_employee_ids": []
  }' | jq -r '.data._id')

# Create another solo to hit size 4
RIDE_G4=$(curl -s -X POST http://localhost:5000/api/ride/book-ride \
  -d '{
    "employee_id": "emp_g4",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3257, 28.5709]},
    "drop_location": {"type": "Point", "coordinates": [77.3302, 28.5754]},
    "scheduled_at": "2026-04-09T15:01:00Z",
    "destination_type": "OFFICE",
    "solo_preference": false,
    "invited_employee_ids": []
  }' | jq -r '.data._id')

# Submit all 3
curl -s -X POST http://localhost:5000/api/clustering/submit-ride -d "{\"ride_id\": \"$RIDE_G1\"}" | jq '.data.type'
curl -s -X POST http://localhost:5000/api/clustering/submit-ride -d "{\"ride_id\": \"$RIDE_G3\"}" | jq '.data.type'

# This one should trigger batching
curl -s -X POST http://localhost:5000/api/clustering/submit-ride \
  -d "{\"ride_id\": \"$RIDE_G4\"}" | jq '.data | {type, destination}'
```

✅ **Expected**:
- Last submission: type "BATCHED", destination "BATCHED"
- statusCode: 201 (created, ready)

---

### 5️⃣ VIEW STATISTICS

```bash
OFFICE_ID="507f1f77bcf86cd799439012"

# Overall stats
curl http://localhost:5000/api/clustering/stats/$OFFICE_ID | jq '.data'

# Active clusters
curl http://localhost:5000/api/clustering/clusters/$OFFICE_ID | jq '.data.count'

# Batched rides
curl http://localhost:5000/api/clustering/batched/$OFFICE_ID | jq '.data.count'
```

✅ **Expected**:
- Show counts of active clusters and batched rides
- Batched rides should have increased

---

### 6️⃣ WATCH FORCE-BATCH JOB (Every Minute)

```bash
# Create a ride scheduled 8 minutes from now
# The force-batch job will auto-batch it before scheduled time

# Create near-future ride
curl -X POST http://localhost:5000/api/ride/book-ride \
  -H "Authorization: Bearer {token}" \
  -d '{
    "employee_id": "emp_force",
    "office_id": "507f1f77bcf86cd799439012",
    "pickup_location": {"type": "Point", "coordinates": [77.3255, 28.5706]},
    "drop_location": {"type": "Point", "coordinates": [77.3300, 28.5750]},
    "scheduled_at": "2026-04-07T14:48:00Z",
    "destination_type": "OFFICE",
    "solo_preference": false,
    "invited_employee_ids": []
  }'

# Submit
curl -X POST http://localhost:5000/api/clustering/submit-ride \
  -d "{\"ride_id\": \"...\"}"

# Check server logs - should see:
# [timestamp] Running force-batch job...
# [timestamp] Found X clusters to force-batch
# [timestamp] Force-batch job completed: X success, 0 errors

# After ~2 minutes, check status
curl http://localhost:5000/api/clustering/ride-status/ride_id | jq '.data.batched'
```

✅ **Expected**: batch_reason: "FORCE_BATCH"

---

## Key Points

| Item | Value |
|------|-------|
| Noida Office Coords | `[77.3255, 28.5706]` |
| Current Year | 2026 (not 2024) |
| Office Hours | 00:00 - 23:59 (all day) |
| Days Open | Mon-Sun (1-7) |
| Time Window | ±10 minutes |
| Location Threshold | 500 meters |
| Max Passengers | 4 per cab |
| Force-Batch Trigger | Within 10min of scheduled |

---

## Token Required

Replace `{token}` with your actual JWT token from login:

```bash
# Get token from login
TOKEN=$(curl -X POST http://localhost:5000/api/user/login \
  -d '{"email": "user@example.com", "password": "password"}' | jq -r '.data.token')

# Use in all requests
-H "Authorization: Bearer $TOKEN"
```

---

## Troubleshooting

**Error: "Ride request is outside office hours"**
- Use future date (2026, not 2024)
- Use time within 00:00 - 23:59
- Use coordinates from Noida office

**Error: "404 Ride request not found"**
- Make sure ride was created first
- Use correct ride_id

**Error: "401 Unauthorized"**
- Include `-H "Authorization: Bearer {token}"`
- Token must be valid JWT

**Cluster not merging riding**
- Check pickups within 500m
- Check time within ±10 minutes
- Check both are solo or correct group sizes

---

All test files are ready to go! 🚀
