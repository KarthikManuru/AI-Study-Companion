import { getServerSession } from 'next-auth';
import { adminAuthOptions } from './admin-config';

/**
 * Get the admin session (uses the admin-specific cookie).
 * Use this in admin pages and API routes instead of the standard getServerSession.
 */
export async function getAdminSession() {
  return getServerSession(adminAuthOptions);
}
