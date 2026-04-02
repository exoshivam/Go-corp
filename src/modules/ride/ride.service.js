import { RideRequest } from "./ride.model.js";

const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}
export const isWithinOfficeHours = (scheduledAt, office) => {

  const date = new Date(scheduledAt)

  const scheduledDay = date.getDay()

  if (!office.working_days.includes(scheduledDay)) return false

  const formatHHMM = (date) =>
  date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })

const scheduledMinutes = toMinutes(formatHHMM(date))

const start = toMinutes(office.shift_start)
const end = toMinutes(office.shift_end)

// console.log("Office hours in minutes:", start, "-", end)

  if (start <= end) {
    return scheduledMinutes >= start && scheduledMinutes <= end
  } else return false

}

export const isDuplicateBooking = async (employeeId, scheduledAt) => {

  const ride = await RideRequest.findOne({
    employee_id: employeeId,
    scheduled_at: scheduledAt,
    status: { $ne: "CANCELLED" }
  })
  if (ride) return true
  else return false
}


export const isLateRequest = (scheduledAt) => {

  const lateTime = toMinutes(
  new Date(Date.now() + 360 * 60 * 1000)
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
)

const scheduledTime = toMinutes(
  new Date(scheduledAt)
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
)

  if (scheduledTime < lateTime) {
    console.log("Ride request is late")
    return true
  }
  else return false
}

export const isOneEndOffice = (pickupLocation, dropLocation, officeLocation) => {
  const coords1 = pickupLocation.coordinates
  const coords2 = dropLocation.coordinates
  const officeCoords = officeLocation.coordinates

  return (coords1[0] === officeCoords[0] && coords1[1] === officeCoords[1]) ||
    (coords2[0] === officeCoords[0] && coords2[1] === officeCoords[1])

}