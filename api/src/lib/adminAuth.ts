/** Demo admin password — override with ADMIN_PASSWORD env in production. */
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '10205';

export function assertAdminPassword(password: string): void {
  if (password !== ADMIN_PASSWORD) {
    throw new Error('Invalid admin password');
  }
}
