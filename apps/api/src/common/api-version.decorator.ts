/**
 * API Version Decorator
 * 
 * Decorator to set API version for controllers and routes.
 * Used for versioning the API (v1 for old, v2 for simplified).
 */

import { SetMetadata } from '@nestjs/common';

export const API_VERSION_KEY = 'apiVersion';

export const API_VERSION_V1 = 'v1';
export const API_VERSION_V2 = 'v2';

export const ApiVersion = (version: string) => SetMetadata(API_VERSION_KEY, version);
