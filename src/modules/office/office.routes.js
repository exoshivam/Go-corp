import { Router } from "express"
import { createOffice, getAllOffices } from "./office.controller.js"

const router = Router()

router.post('/add-office', createOffice)
router.get('/all', getAllOffices)

export default router