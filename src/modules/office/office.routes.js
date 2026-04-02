import { Router } from "express"
import { createOffice } from "./office.controller.js"

const router = Router()

router.post('/add-office', createOffice)

export default router