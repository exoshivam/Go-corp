import express from "express"
const router = express.Router();
import { bookRide, getClusters } from "./ride.controller.js";

router.post("/book-ride", bookRide);
router.get("/clusters", getClusters);

export default router;