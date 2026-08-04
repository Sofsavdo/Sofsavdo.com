-- schema.prisma's AttributionSource enum has included FLOW since the Flow model was added
-- (20260811000000_add_flow_model_and_commission_fields), but that migration's own comment admits
-- it skipped actually adding the value to the database enum ("PostgreSQL doesn't support enum
-- alteration directly, need to recreate... we'll handle this in the application layer") -- which
-- never happened. Confirmed live: orders.service.ts's createOrder() creates an Attribution row
-- with source: "FLOW" for every Flow-based checkout, and every one of those checkouts crashed
-- with "invalid input value for enum AttributionSource: FLOW" at the final commit step -- the
-- entire buyer-purchases-through-a-Flow-link path has never worked end-to-end until this fix.
ALTER TYPE "AttributionSource" ADD VALUE IF NOT EXISTS 'FLOW';
