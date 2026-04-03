import ApiResponse from '../../utils/ApiResponse.js';
import { Office } from './office.model.js';

export const createOffice = async (req, res, next) => {
  try {
    const {
      name,
      company_id,
      address,
      office_location,
      shift_start,
      shift_end,
      working_days,
    } = req.body;

    const office = await Office.create({
      name,
      company_id,
      address,
      office_location,
      shift_start,
      shift_end,
      working_days,
    });

    res.status(201).json(new ApiResponse(201, "Office registered successfully", office))
  } catch (error) {
    next(error)
  }
};

export const getAllOffices = async (req, res, next) => {
  try {
    const offices = await Office.find()
      .select('_id name address office_location shift_start shift_end')
      .lean();

    res.status(200).json(new ApiResponse(200, "Offices retrieved successfully", offices));
  } catch (error) {
    next(error);
  }
};