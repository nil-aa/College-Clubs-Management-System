import { describe, expect, it, vi } from 'vitest';
import { EventService } from '../src/modules/events/service.js';
import { HttpError } from '../src/shared/errors/http.js';

const clubId = '10000000-0000-0000-0000-000000000001';
const sheetId = '20000000-0000-0000-0000-000000000001';
const clubHeadId = '30000000-0000-0000-0000-000000000001';
const facultyId = '40000000-0000-0000-0000-000000000001';

function fixture(initialStatus: 'OPEN' | 'CLOSED' | 'APPROVED' = 'OPEN') {
  const sheet: Record<string, unknown> = {
    id: sheetId,
    event_id: '50000000-0000-0000-0000-000000000001',
    club_id: clubId,
    status: initialStatus,
  };
  const repository: any = {
    transaction: (work: (tx: any) => Promise<unknown>) => work(repository),
    getOdSheet: async () => ({ sheet, students: [] }),
    getClub: async () => ({ id: clubId, is_active: true }),
    insertAudit: vi.fn(async () => 1n),
    closeOdSheet: vi.fn(async () => {
      if (sheet.status !== 'OPEN')
        throw new Error('Only an open participation list can be closed.');
      sheet.status = 'CLOSED';
      return sheet;
    }),
    approveOdSheet: vi.fn(async () => {
      if (sheet.status !== 'CLOSED')
        throw new Error('Only a closed participation list can be approved.');
      sheet.status = 'APPROVED';
      return sheet;
    }),
  };
  const authz: any = {
    canManageClub: vi.fn(
      async (actorId: string, targetClub: string) =>
        actorId === clubHeadId && targetClub === clubId,
    ),
    hasRole: vi.fn(
      async (actorId: string, role: string, targetClub?: string) =>
        role === 'faculty_coordinator' &&
        actorId === facultyId &&
        (targetClub === undefined || targetClub === clubId),
    ),
  };
  return { service: new EventService(repository, authz), repository, sheet };
}

describe('faculty OD approval lifecycle', () => {
  it('allows a club head to close an open list, then a scoped faculty coordinator to approve it', async () => {
    const { service, repository, sheet } = fixture();
    await service.closeOdSheet(clubHeadId, sheetId);
    expect(sheet.status).toBe('CLOSED');
    await service.approveOdSheet(facultyId, sheetId);
    expect(sheet.status).toBe('APPROVED');
    expect(repository.insertAudit).toHaveBeenCalledTimes(2);
  });

  it('rejects faculty from viewing a list before the club head closes it', async () => {
    const { service } = fixture('OPEN');
    await expect(service.facultyOdSheetDetail(facultyId, sheetId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('hides another club’s list from a faculty coordinator', async () => {
    const { service } = fixture('CLOSED');
    await expect(service.facultyOdSheetDetail('other-faculty', sheetId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('rejects repeat approval and records no additional approval audit', async () => {
    const { service, repository } = fixture('APPROVED');
    await expect(service.approveOdSheet(facultyId, sheetId)).rejects.toBeInstanceOf(HttpError);
    expect(repository.insertAudit).not.toHaveBeenCalled();
  });

  it('prevents a user without Club Head authority from closing a list', async () => {
    const { service, repository } = fixture();
    await expect(service.closeOdSheet('student', sheetId)).rejects.toMatchObject({ status: 403 });
    expect(repository.closeOdSheet).not.toHaveBeenCalled();
  });
});
