// The concrete Prisma repository is shared by M1 modules so transactions can
// span profile, audit, and notification writes. This module file is the
// ownership boundary for future user-specific queries.
export type { M1Repository } from '../../shared/db/repository.js';
