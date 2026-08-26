-- IS-33: organization scope retains full tenant access.
DROP POLICY memberships_tenant_isolation ON memberships;

CREATE POLICY memberships_tenant_access ON memberships
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

-- User scope is deliberately read-only. In particular, it cannot authorize DELETE,
-- whose policy evaluation has no WITH CHECK clause.
CREATE POLICY memberships_user_read ON memberships
  FOR SELECT
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
