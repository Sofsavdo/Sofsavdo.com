# Cleanup Plan

**Date**: 2026-08-01  
**Purpose**: Safe removal of old pages and endpoints after simplified UI rollout

---

## Cleanup Strategy Overview

After the simplified UI has been fully rolled out and validated (Phase 8 complete), we will begin the cleanup process to remove old pages and endpoints. This cleanup will be done gradually to ensure no breaking changes and to allow for quick rollback if needed.

**Prerequisites for Cleanup**:
- Phase 8 (100% rollout) complete
- All success criteria met for 7 days
- No critical bugs
- User satisfaction ≥ 4.0/5
- Support team fully trained on new UI

---

## Cleanup Timeline

### Week 1: Preparation (Post-Rollout)
**Goal**: Prepare for cleanup without making any changes

**Actions**:
- Audit all old pages and endpoints
- Identify dependencies and usage
- Document all old routes and their replacements
- Create backup plan
- Communicate cleanup plan to team

**Deliverables**:
- Old pages inventory
- Old endpoints inventory
- Dependency map
- Backup plan document
- Team communication summary

---

### Week 2: Archive Old Frontend Pages (No Deletion)
**Goal**: Archive old pages without deleting

**Actions**:
- Move old creator pages to `/creator/old/` directory
- Move old admin pages to `/admin/old/` directory
- Move old buyer pages to `/buyer/old/` directory
- Add redirect logic to point old routes to new routes
- Test redirects

**Old Creator Pages to Archive**:
- `/creator/(app)/dashboard/page.tsx` → `/creator/old/dashboard/page.tsx`
- `/creator/(app)/campaigns/page.tsx` → `/creator/old/campaigns/page.tsx`
- `/creator/(app)/earnings/page.tsx` → `/creator/old/earnings/page.tsx`
- `/creator/(app)/profile/page.tsx` → `/creator/old/profile/page.tsx`
- `/creator/(app)/onboarding/page.tsx` → `/creator/old/onboarding/page.tsx`
- `/creator/(app)/content/page.tsx` → `/creator/old/content/page.tsx`

**Old Admin Pages to Archive**:
- `/admin/(app)/dashboard/page.tsx` → `/admin/old/dashboard/page.tsx`
- `/admin/(app)/products/page.tsx` → `/admin/old/products/page.tsx`
- `/admin/(app)/orders/page.tsx` → `/admin/old/orders/page.tsx`
- `/admin/(app)/creators/page.tsx` → `/admin/old/creators/page.tsx`
- `/admin/(app)/earnings/page.tsx` → `/admin/old/earnings/page.tsx`
- `/admin/(app)/settings/page.tsx` → `/admin/old/settings/page.tsx`

**Old Buyer Pages to Archive**:
- `/buyer/(app)/products/[id]/page.tsx` → `/buyer/old/products/[id]/page.tsx`
- `/buyer/(app)/checkout/page.tsx` → `/buyer/old/checkout/page.tsx`
- `/buyer/(app)/order-success/page.tsx` → `/buyer/old/order-success/page.tsx`

**Redirect Logic**:
```typescript
// In middleware.ts
const oldRoutes = [
  '/creator/dashboard',
  '/creator/campaigns',
  '/creator/earnings',
  '/creator/profile',
  '/creator/onboarding',
  '/creator/content',
  '/admin/dashboard',
  '/admin/products',
  '/admin/orders',
  '/admin/creators',
  '/admin/earnings',
  '/admin/settings',
  '/buyer/products',
  '/buyer/checkout',
  '/buyer/order-success',
];

const newRoutes = {
  '/creator/dashboard': '/creator/v2/products',
  '/creator/campaigns': '/creator/v2/products',
  '/creator/earnings': '/creator/v2/earnings',
  '/creator/profile': '/creator/v2/profile',
  '/creator/onboarding': '/creator/v2/auth/register',
  '/creator/content': '/creator/v2/profile',
  '/admin/dashboard': '/admin/v2/dashboard',
  '/admin/products': '/admin/v2/products',
  '/admin/orders': '/admin/v2/orders',
  '/admin/creators': '/admin/v2/creators',
  '/admin/earnings': '/admin/v2/earnings',
  '/admin/settings': '/admin/v2/settings',
  '/buyer/products': '/buyer/v2/products',
  '/buyer/checkout': '/buyer/v2/checkout',
  '/buyer/order-success': '/buyer/v2/order-success',
};
```

**Success Criteria**:
- All old pages archived
- Redirects working correctly
- No broken links
- No increase in 404 errors

---

### Week 3: Deprecate Old API Endpoints (No Deletion)
**Goal**: Mark old endpoints as deprecated without removing

**Actions**:
- Add deprecation headers to old API endpoints
- Add warning messages in API responses
- Update API documentation
- Monitor usage of old endpoints
- Communicate deprecation to API consumers

**Old API Endpoints to Deprecate**:
- `POST /api/auth/register` → Use `/api/v2/auth/register`
- `POST /api/auth/login` → Use `/api/v2/auth/login/phone`
- `GET /api/products` → Use `/api/v2/products`
- `POST /api/products` → Use `/api/v2/products`
- `PUT /api/products/:id` → Use `/api/v2/products/:id`
- `DELETE /api/products/:id` → Use `/api/v2/products/:id`
- `GET /api/creators/me` → Use `/api/v2/creators/me`
- `PUT /api/creators/me` → Use `/api/v2/creators/me`
- `GET /api/earnings` → Use `/api/v2/earnings`
- `POST /api/earnings/withdraw` → Use `/api/v2/earnings/withdraw`
- `GET /api/orders` → Use `/api/v2/orders`
- `PUT /api/orders/:id/status` → Use `/api/v2/orders/:id/status`

**Deprecation Headers**:
```typescript
// In old controllers
@Header('X-API-Deprecated', 'true')
@Header('X-API-Deprecation-Date', '2026-09-01')
@Header('X-API-Replacement', '/api/v2/...')
```

**Deprecation Response Message**:
```json
{
  "data": { ... },
  "warnings": [
    {
      "type": "deprecation",
      "message": "This endpoint is deprecated and will be removed on 2026-10-01. Please use /api/v2/... instead."
    }
  ]
}
```

**Success Criteria**:
- All old endpoints marked as deprecated
- API documentation updated
- Usage monitoring in place
- No increase in errors

---

### Week 4: Monitor Deprecated Endpoints
**Goal**: Monitor usage of deprecated endpoints to ensure safe removal

**Actions**:
- Track usage metrics for deprecated endpoints
- Identify any consumers still using old endpoints
- Reach out to consumers with migration guidance
- Fix any integration issues
- Plan removal timeline

**Metrics to Track**:
- Request count per deprecated endpoint
- Unique consumers per endpoint
- Error rates
- Response times

**Success Criteria**:
- Usage of deprecated endpoints < 5% of total
- All known consumers migrated
- No critical dependencies on old endpoints

---

### Week 5: Remove Archived Frontend Pages
**Goal**: Delete archived old pages after confirming no usage

**Actions**:
- Verify no traffic to old pages for 7 days
- Remove redirect logic
- Delete archived page files
- Update routing configuration
- Test that new pages work correctly

**Success Criteria**:
- No traffic to old pages for 7 days
- All old page files deleted
- New pages working correctly
- No broken links

---

### Week 6: Remove Deprecated API Endpoints
**Goal**: Delete deprecated API endpoints after confirming no usage

**Actions**:
- Verify no usage of deprecated endpoints for 7 days
- Remove endpoint code
- Update API documentation
- Remove from Swagger/OpenAPI spec
- Test that new endpoints work correctly

**Success Criteria**:
- No usage of deprecated endpoints for 7 days
- All old endpoint code deleted
- API documentation updated
- New endpoints working correctly

---

### Week 7: Cleanup Supporting Code
**Goal**: Remove any supporting code that's no longer needed

**Actions**:
- Remove old DTOs that are no longer used
- Remove old service methods that are no longer used
- Remove old components that are no longer used
- Clean up imports
- Update documentation

**Code to Remove**:
- Old DTOs in `/dto/` folders (if not used by v1 API)
- Old service methods (if not used by v1 API)
- Old components in `/components/` (if not used)
- Unused imports throughout codebase

**Success Criteria**:
- No unused code remains
- Codebase clean
- No build errors
- Documentation updated

---

### Week 8: Final Verification
**Goal**: Verify that cleanup is complete and system is stable

**Actions**:
- Run full test suite
- Perform end-to-end testing
- Verify all user flows work
- Check performance metrics
- Document cleanup completion

**Success Criteria**:
- All tests passing
- All user flows working
- Performance metrics stable
- No errors in logs
- Cleanup documented

---

## Rollback Plan

If issues arise during cleanup, rollback will be performed:

### Rollback Triggers
- Increase in 404 errors > 10%
- Increase in API errors > 5%
- User complaints about missing functionality
- Performance degradation > 20%
- Critical bugs discovered

### Rollback Procedure
1. Restore archived pages from backup
2. Re-enable deprecated endpoints
3. Restore redirect logic
4. Monitor for stability
5. Investigate root cause
6. Fix issues
7. Resume cleanup

### Rollback Time
- Restore pages: < 30 minutes
- Re-enable endpoints: < 15 minutes
- Full system stabilization: < 2 hours

---

## Backup Strategy

Before each cleanup phase, backups will be created:

### Database Backup
- Full database backup before any changes
- Incremental backups during cleanup
- Backups retained for 30 days

### Code Backup
- Git tags before each cleanup phase
- Branch with old code retained
- Ability to revert quickly

### Configuration Backup
- Environment variables backed up
- Configuration files backed up
- Feature flag states backed up

---

## Monitoring During Cleanup

### Real-time Monitoring
- 404 error rate
- API error rate
- Page load times
- User engagement metrics
- Support ticket volume

### Daily Reports
- Cleanup progress
- Error rates
- User feedback
- System health
- Recommendations

### Weekly Reports
- Cleanup completion status
- Metrics comparison
- Risk assessment
- Next week's plan

---

## Communication Plan

### Internal Communication
- Daily standups during cleanup weeks
- Weekly progress reports
- Critical issue notifications
- Cleanup completion summary

### External Communication
- API consumers notified of deprecation
- Migration guides provided
- Support available during transition
- Timeline communicated clearly

---

## Success Criteria

### Must-Have Criteria
- [ ] All old pages removed
- [ ] All old endpoints removed
- [ ] No increase in errors
- [ ] All user flows working
- [ ] Performance stable
- [ ] Documentation updated
- [ ] Team trained on new system

### Nice-to-Have Criteria
- [ ] Codebase size reduced by ≥ 20%
- [ ] Build time improved
- [ ] Maintenance burden reduced
- [ ] User experience improved

---

## Post-Cleanup Actions

### Immediate Actions (Week 1 after cleanup)
- Continue monitoring for 30 days
- Collect user feedback
- Address any issues quickly
- Document lessons learned

### Short-term Actions (Weeks 2-4 after cleanup)
- Optimize new code based on metrics
- Plan next iteration of improvements
- Update training materials
- Archive cleanup documentation

### Long-term Actions (Months 2-3 after cleanup)
- Review cleanup effectiveness
- Plan future cleanup cycles
- Establish cleanup best practices
- Update development processes

---

## Conclusion

This cleanup plan ensures safe removal of old pages and endpoints after the simplified UI has been fully validated. The phased approach with monitoring and rollback capabilities minimizes risk while ensuring a clean, maintainable codebase.
