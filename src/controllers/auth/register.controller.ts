import { Request, Response, NextFunction } from "express";
import authService from "../../service/auth.service";

export async function registerUser(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { email, password, firstName, lastName } = request.body;

    if (!email || !password || !firstName || !lastName) {
      return response.status(400).json({
        success: false,
        message:
          "First name, last name, email, and password are required for registration",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return response.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 6) {
      return response.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const user = await authService.registerUser(
      email,
      password,
      firstName,
      lastName
    );

    return response.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email.",
      user,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Email address is already registered") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Unable to send verification email")) {
        return response.status(500).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Unable to send welcome email")) {
        return response.status(500).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function registerArtist(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      artistName,
      genre,
      bio,
      socialMedia,
      recordLabel,
      yearsActive,
    } = request.body;

    const avatarFile = request.file;

    if (!email || !password || !firstName || !artistName || !genre) {
      return response.status(400).json({
        success: false,
        message:
          "Email, password, first name, artist name, and genre are required fields",
      });
    }

    if (!Array.isArray(genre) || genre.length === 0) {
      return response.status(400).json({
        success: false,
        message: "Genre must be a non-empty array",
      });
    }

    const artist = await authService.registerArtist(
      email,
      password,
      firstName,
      lastName,
      artistName,
      genre,
      bio,
      socialMedia,
      recordLabel,
      yearsActive,
      avatarFile?.buffer,
      avatarFile?.mimetype
    );

    return response.status(201).json({
      success: true,
      message: "Artist registered successfully. Please verify your email.",
      artist,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Email address is already registered") {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Unable to send welcome email")) {
        return response.status(500).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Invalid genres")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("Artist name")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function verifyArtist(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { userId } = request.params;
    const { verificationDocuments } = request.body;

    if (!verificationDocuments || !Array.isArray(verificationDocuments)) {
      return response.status(400).json({
        success: false,
        message: "Verification documents array is required",
      });
    }

    const artist = await authService.verifyArtist(
      userId,
      verificationDocuments
    );

    return response.status(200).json({
      success: true,
      message: "Artist verified successfully",
      artist,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("not an artist")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}

export async function updateArtistProfile(
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    const { userId } = request.params;
    const updates = request.body;

    if (request.userId !== userId) {
      return response.status(403).json({
        success: false,
        message: "You can only update your own artist profile",
      });
    }

    const artist = await authService.updateArtistProfile(userId, updates);

    return response.status(200).json({
      success: true,
      message: "Artist profile updated successfully",
      artist,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return response.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.message.includes("not an artist")) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
      if (
        error.message.includes("Artist name") ||
        error.message.includes("genre")
      ) {
        return response.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }
    return next(error);
  }
}
