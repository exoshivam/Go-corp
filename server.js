import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { DB } from "./src/config/db.js";
import companyRoutes from "./src/modules/company/company.routes.js"
import officeRoutes from "./src/modules/office/office.routes.js"
import userRoutes from "./src/modules/user/user.routes.js"
import rideRoutes from "./src/modules/ride/ride.routes.js"
import officeWalletRoutes from "./src/modules/wallet/wallet.routes.js";
// import { startBatchCloser } from "./src/modules/optimization/batch.cron.js";
import driverRoutes from "./src/modules/driver/driver.routes.js";

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("AI Cab Platform API running");
});

app.use("/api/company", companyRoutes)

app.use("/api/office", officeRoutes)

app.use("/api/user", userRoutes)

app.use("/api/ride", rideRoutes)

app.use("/api/driver", driverRoutes)

app.use("/api/wallet", officeWalletRoutes);

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error"
  })
})

DB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(`Server running on port http://localhost:${process.env.PORT}`);
  });
})


