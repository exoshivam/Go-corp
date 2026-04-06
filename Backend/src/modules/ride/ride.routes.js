import express from "express"
const router = express.Router();
import { authUser, authDriver } from "../../middleware/auth.middleware.js";
import { bookRide, getClusters, getPendingRides, getPendingBatches, getRoute, getInvitedPeople, getRidesWithEmployeeInvite, getRideEmployeeGroup, cancelRide, getRideById, verifyOTP, testClusterRides, getAllBatches, cleanupTestData } from "./ride.controller.js";
import { body, param, query } from "express-validator"

router.post("/book-ride", [

  body('employee_id').notEmpty().withMessage('Employee ID is required'),

  body('office_id').notEmpty().withMessage('Office ID is required'),

  body('pickup_location').notEmpty().withMessage('Pickup location is required'),

  body('drop_location').notEmpty().withMessage('Drop location is required'),

  body('scheduled_at').notEmpty().withMessage('Scheduled time is required')
    .isISO8601().withMessage('Scheduled time must be a valid ISO 8601 date'),

  body('invited_employee_ids')
    .optional()
    .isArray()
    .withMessage('invited_employee_ids must be an array')
    .custom((value) => {
      if (value && value.length > 3) {
        throw new Error('Maximum 3 people can be invited (4 total including requester)');
      }
      return true;
    }),

], authUser, bookRide);

router.get("/invited-people/:employee_id", [
  param('employee_id').matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid employee ID format')
], authUser, getInvitedPeople);

// For clustering service: Get rides where this employee was invited
router.get("/clustering/rides-with-invite", [
  query('employee_id').notEmpty().withMessage('Employee ID is required'),
  query('scheduled_at').notEmpty().withMessage('Scheduled time is required').isISO8601().withMessage('Must be valid ISO 8601 date')
], getRidesWithEmployeeInvite);

// For clustering service: Get all employees in a ride group (requester + invited)
router.get("/clustering/ride-employee-group/:ride_id", [
  param('ride_id').matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ride ID format')
], getRideEmployeeGroup);

// Specific named routes BEFORE generic :ride_id route
router.get("/clusters", getClusters);
router.get("/pending-rides", authDriver, getPendingRides);
router.get("/pending-batches", authDriver, getPendingBatches);
router.get("/route", getRoute);

// TEST ENDPOINT: Manually trigger clustering for pending rides (for testing only)
router.post("/test/cluster-now", testClusterRides);

// TEST ENDPOINT: Get all batches with employee details
router.get("/test/all-batches", getAllBatches);

// TEST ENDPOINT: Clean up all test data (rides + batches)
router.post("/test/cleanup", cleanupTestData);

// Generic :ride_id route LAST (matches any ride ID)
router.get("/:ride_id", [
  param('ride_id').matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ride ID format')
], authUser, getRideById);

// Cancel a ride (employee can only cancel PENDING/IN_CLUSTERING)
router.patch("/cancel/:ride_id", [
  param('ride_id').matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ride ID format')
], authUser, cancelRide);

router.post("/verify-otp", [
  body('ride_id').notEmpty().withMessage('Ride ID is required').matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ride ID format'),
  body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
], verifyOTP);

export default router;