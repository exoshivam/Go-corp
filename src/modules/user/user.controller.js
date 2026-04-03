import ApiResponse from '../../utils/ApiResponse.js';
import { validationResult } from 'express-validator';
import { User } from './user.model.js';
import ApiError from '../../utils/ApiError.js';
import { BlacklistToken } from './blacklistToken.model.js';

export const createUser = async (req, res, next) => {
  try {
    const {
      company_id,
      office_id,
      name,
      email,
      password,
      contact,
      role
    } = req.body;

    if (!company_id || !office_id || !name || !email || !password || !contact || !role) {
      throw new ApiError(400, "All fields are required");
    }

    const isUserExists = await User.findOne({ email });
    if (isUserExists) {
      throw new ApiError(401, "Email already exists");
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, "Validation errors", errors.array());
    }

    const user = await User.create({
      company_id,
      office_id,
      name,
      email,
      password: await User.hashPassword(password),
      contact,
      role
    });

    const token = await user.generateAuthToken();

    res.status(201).json(new ApiResponse(201, "User registered successfully", { user, token }))
  } catch (error) {
    next(error || new ApiError(500, "Registration error"))
  }
};

export const loginUser = async (req, res, next) => {
  try {

    const { email, password } = req.body;
    if (!email || !password) {
      throw new ApiError(401, "Email and password are required");
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = await user.generateAuthToken();

    res.cookie('token', token);

    res.status(200).json(new ApiResponse(200, "Login successful", { user, token }))
  } catch (error) {
    next(error || new ApiError(500, "Login error"))
  }
};

export const getUserProfile = async (req, res, next) => {
  try {
    res.status(200).json(new ApiResponse(200, "User profile retrieved successfully", { user: req.user }))
  } catch (error) {
    next(error || new ApiError(500, "Profile retrieval error"))
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new ApiError(400, "No token provided");
    }

    await BlacklistToken.create({ token });

    res.clearCookie('token');

    res.status(200).json(new ApiResponse(200, "Logout successful"));

  } catch (error) {
    next(error || new ApiError(500, "Logout error"))
  }
};
