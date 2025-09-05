import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

interface ValidationErrorResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let errors: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (
        exception instanceof BadRequestException &&
        typeof errorResponse === 'object'
      ) {
        // Handle class-validator errors
        const validationResponse = errorResponse as ValidationErrorResponse;

        if (Array.isArray(validationResponse.message)) {
          errors = validationResponse.message;
        } else {
          errors = validationResponse.message || 'Validation error';
        }
      } else {
        // Handle other HTTP exceptions
        errors =
          typeof errorResponse === 'string'
            ? errorResponse
            : (errorResponse as ValidationErrorResponse)?.message ||
              'An error occurred';
      }
    } else {
      // Handle unexpected errors
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errors = 'Something went wrong';

      const errorMessage = this.getErrorMessage(exception);

      this.logger.error(
        `Unexpected error: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
        'GlobalExceptionFilter',
      );
    }

    response.status(status).json({ errors });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error !== null) {
      return JSON.stringify(error);
    }
    return 'Unknown error occurred';
  }
}
