import { api } from './client';

export function assignFacultyCoordinator(userId: string, clubId: string) {
  return api.post<{ id: string }>(`/admin/users/${userId}/faculty-assignments`, {
    club_id: clubId,
  });
}

export function revokeFacultyCoordinator(userId: string, clubId: string) {
  return api.delete<{ revoked: boolean }>(`/admin/users/${userId}/faculty-assignments/${clubId}`);
}
