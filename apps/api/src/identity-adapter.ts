import {
  TenantAccessDeniedError,
  withTenantTransaction,
  withUserTransaction,
  type PrismaClient,
} from "@issuespan/database";
import {
  IdentityApplicationService,
  type AuthenticatedUser,
  type IdentityRepositories,
  type TenantContext,
  type TenantRole,
  type UserProfile,
} from "@issuespan/identity";

/** Composes the Prisma adapters at the API boundary. Identity itself stays database-agnostic. */
export function createIdentityService(database: PrismaClient): IdentityApplicationService {
  const repositories: IdentityRepositories = {
    users: {
      async findByEmail(email): Promise<AuthenticatedUser | null> {
        const user = await database.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            displayName: true,
            passwordHash: true,
            isActive: true,
          },
        });
        return user;
      },

      async updatePasswordHash(userId, passwordHash): Promise<void> {
        await database.user.update({
          where: { id: userId },
          data: { passwordHash },
        });
      },

      async findProfile(userId): Promise<UserProfile | null> {
        const profile = await withUserTransaction(database, userId, (transaction) => (
          transaction.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              displayName: true,
              memberships: {
                select: {
                  organizationId: true,
                  role: true,
                  organization: { select: { name: true } },
                },
              },
            },
          })
        ));

        if (!profile) return null;

        return {
          id: profile.id,
          email: profile.email,
          displayName: profile.displayName,
          memberships: profile.memberships.flatMap((membership) => {
            const role = parseTenantRole(membership.role);
            return role
              ? [{
                  organizationId: membership.organizationId,
                  organizationName: membership.organization.name,
                  role,
                }]
              : [];
          }),
        };
      },
    },

    sessions: {
      async findByTokenHash(tokenHash) {
        const session = await database.session.findUnique({
          where: { tokenHash },
          select: {
            id: true,
            userId: true,
            idleExpiresAt: true,
            absoluteExpiresAt: true,
            revokedAt: true,
            lastSeenAt: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                passwordHash: true,
                isActive: true,
              },
            },
          },
        });
        return session;
      },

      async create(session) {
        await database.session.create({
          data: {
            ...session,
            authMethod: "PASSWORD",
          },
        });
      },

      async touch(sessionId, lastSeenAt, idleExpiresAt) {
        await database.session.update({
          where: { id: sessionId },
          data: { lastSeenAt, idleExpiresAt },
        });
      },

      async revoke(sessionId, revokedAt) {
        await database.session.update({
          where: { id: sessionId },
          data: { revokedAt },
        });
      },
    },

    memberships: {
      async resolveTenant(userId, organizationId): Promise<TenantContext | null> {
        try {
          return await withTenantTransaction(
            database,
            { userId, organizationId },
            async (_transaction, context) => context,
          );
        } catch (error) {
          if (error instanceof TenantAccessDeniedError) return null;
          throw error;
        }
      },
    },
  };

  return new IdentityApplicationService(repositories);
}

function parseTenantRole(role: string): TenantRole | null {
  return role === "OWNER" || role === "ADMIN" || role === "AGENT" ? role : null;
}
